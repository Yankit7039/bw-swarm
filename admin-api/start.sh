#!/bin/bash

# SWARM Admin API Startup Script
# Usage: ./start.sh [start|stop|restart]
#   ./start.sh        - Start PostgreSQL and FastAPI (default)
#   ./start.sh stop   - Stop PostgreSQL and FastAPI
#   ./start.sh restart - Restart everything

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
CONTAINER_NAME="swarm-postgres"
DB_USER="swarm"
DB_PASSWORD="swarm"
DB_NAME="swarm"
DB_PORT="5432"
API_PORT="8000"
PID_FILE=".api.pid"

# Function to stop everything
stop_services() {
    echo -e "${BLUE}=== Stopping SWARM Admin API ===${NC}"
    
    # Stop FastAPI server if running
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            echo -e "${YELLOW}Stopping FastAPI server (PID: $PID)...${NC}"
            kill "$PID" 2>/dev/null || true
            sleep 2
            # Force kill if still running
            if ps -p "$PID" > /dev/null 2>&1; then
                kill -9 "$PID" 2>/dev/null || true
            fi
            echo -e "${GREEN}✓ FastAPI server stopped${NC}"
        fi
        rm -f "$PID_FILE"
    fi
    
    # Stop PostgreSQL container
    if docker ps -q -f name=$CONTAINER_NAME > /dev/null 2>&1; then
        echo -e "${YELLOW}Stopping PostgreSQL container...${NC}"
        docker stop $CONTAINER_NAME
        echo -e "${GREEN}✓ PostgreSQL container stopped${NC}"
    else
        echo -e "${GREEN}✓ PostgreSQL container already stopped${NC}"
    fi
    
    echo -e "${GREEN}=== All services stopped ===${NC}"
}

# Handle commands
case "${1:-start}" in
    stop)
        stop_services
        exit 0
        ;;
    restart)
        stop_services
        echo ""
        echo -e "${BLUE}Restarting services...${NC}"
        echo ""
        ;;
    start|"")
        # Continue to start services
        ;;
    *)
        echo "Usage: $0 [start|stop|restart]"
        echo "  start   - Start PostgreSQL and FastAPI (default)"
        echo "  stop    - Stop PostgreSQL and FastAPI"
        echo "  restart - Restart all services"
        exit 1
        ;;
esac

echo -e "${BLUE}=== SWARM Admin API Startup ===${NC}"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running${NC}"
    echo "Please start Docker Desktop first"
    exit 1
fi

# Check if PostgreSQL container exists
if [ ! "$(docker ps -a -q -f name=$CONTAINER_NAME)" ]; then
    echo -e "${YELLOW}Creating PostgreSQL container...${NC}"
    docker run -d \
        --name $CONTAINER_NAME \
        -e POSTGRES_USER=$DB_USER \
        -e POSTGRES_PASSWORD=$DB_PASSWORD \
        -e POSTGRES_DB=$DB_NAME \
        -p $DB_PORT:5432 \
        postgres:16-alpine
    
    echo -e "${GREEN}✓ PostgreSQL container created${NC}"
else
    # Check if container is running
    if [ ! "$(docker ps -q -f name=$CONTAINER_NAME)" ]; then
        echo -e "${YELLOW}Starting existing PostgreSQL container...${NC}"
        docker start $CONTAINER_NAME
        echo -e "${GREEN}✓ PostgreSQL container started${NC}"
    else
        echo -e "${GREEN}✓ PostgreSQL container already running${NC}"
    fi
fi

# Wait for PostgreSQL to be ready
echo -e "${BLUE}Waiting for PostgreSQL to be ready...${NC}"
RETRIES=30
until docker exec $CONTAINER_NAME pg_isready -U $DB_USER -d $DB_NAME > /dev/null 2>&1 || [ $RETRIES -eq 0 ]; do
    echo -n "."
    sleep 1
    RETRIES=$((RETRIES - 1))
done

if [ $RETRIES -eq 0 ]; then
    echo -e "\n${RED}Error: PostgreSQL failed to start${NC}"
    exit 1
fi

echo -e "\n${GREEN}✓ PostgreSQL is ready${NC}"

# Check if virtual environment exists
if [ ! -d ".venv" ]; then
    echo -e "${YELLOW}Creating virtual environment...${NC}"
    python3 -m venv .venv
    echo -e "${GREEN}✓ Virtual environment created${NC}"
fi

# Activate virtual environment
echo -e "${BLUE}Activating virtual environment...${NC}"
source .venv/bin/activate

# Install dependencies if needed
if ! pip show fastapi > /dev/null 2>&1; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    pip install -e . > /dev/null 2>&1
    echo -e "${GREEN}✓ Dependencies installed${NC}"
fi

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}Creating .env file...${NC}"
    cat > .env << EOF
POSTGRES_URL=postgresql://$DB_USER:$DB_PASSWORD@localhost:$DB_PORT/$DB_NAME
PORT=$API_PORT
LOG_LEVEL=info
EOF
    echo -e "${GREEN}✓ .env file created${NC}"
fi

echo ""
echo -e "${GREEN}=== Starting FastAPI Server ===${NC}"
echo -e "${BLUE}API will be available at: http://localhost:$API_PORT${NC}"
echo -e "${BLUE}API docs: http://localhost:$API_PORT/docs${NC}"
echo ""

# Start FastAPI server in background and save PID
python -m uvicorn app.main:app --reload --port $API_PORT &
API_PID=$!
echo $API_PID > "$PID_FILE"

echo -e "${GREEN}✓ FastAPI server started (PID: $API_PID)${NC}"
echo ""
echo -e "${BLUE}Run './start.sh stop' to stop all services${NC}"
echo ""

# Wait for the server
wait $API_PID

# Clean up PID file on exit
rm -f "$PID_FILE"
