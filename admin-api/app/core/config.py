from __future__ import annotations

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    postgres_url: str = "postgresql://swarm:swarm@localhost:5432/swarm"
    port: int = 8000
    log_level: str = "info"

    class Config:
        env_file = ".env"


settings = Settings()
