
# SWARM — Agent Runtime Architecture Options

---


## Option 3 — Full Sandbox Per Run, Adapters External

### What It Is

Every workflow run executes inside its own isolated sandbox — a container with its own kernel (gVisor in production), its own memory, its own filesystem. Tools, skills, and the YAML template are baked into the sandbox image at build time. A warm pool of pre-booted sandboxes per template eliminates cold-start delays. The Adapter Service lives outside the sandbox — the sandbox calls it over the network (gRPC). Session state lives entirely in sandbox memory during execution. Async writes to Postgres at step boundaries for crash recovery.

### Architecture

```
Container Registry
├── swarm/sandbox-order-followup:v2      (tools + skills + template baked in)
├── swarm/sandbox-refund-processor:v1
└── swarm/sandbox-sim-swap:v1
           │
           │ nodes pull images from registry
           ▼
┌────────────────────────────────────────────────────────────────────────────┐
│  KUBERNETES CLUSTER                                                         │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Warm Pool — pre-booted sandboxes waiting per template               │   │
│  │                                                                      │   │
│  │  stuck_order:   [IDLE] [IDLE] [IDLE] [IDLE] [IDLE]                   │   │
│  │  refund_processor: [IDLE] [IDLE] [IDLE]                              │   │
│  │  network_support:         [IDLE] [IDLE]                              │   │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                │                                                            │
│                │  Core claims one on event arrival                          │
│                │  injects event payload                                     │
│                ▼                                                            │
│  ┌────────────────────────────────────┐                                     │
│  │  Active Sandbox (gVisor)            │                                    │
│  │  Image: sandbox-order-followup:v2   │                                    │
│  │                                    │                                     │
│  │  Isolated kernel  Isolated memory   │                                    │
│  │  Isolated filesystem (scratchpad)   │                                    │
│  │                                    │                                     │
│  │  Full agent loop runs here:         │                                    │
│  │  LLM calls, tool calls,            │                                    │
│  │  step results — all in memory      │                                    │
│  │                                    │                                    │
│  │  Network calls out:                │                                    │
│  │    → LLM API (HTTPS)              │                                    │
│  │    → Adapter Service (gRPC) ───────┼──► Adapter Service Pod            │
│  │    → Postgres (checkpoint write)  │                                    │
│  └────────────────────────────────────┘                                    │
│                                                                             │
│  On completion: sandbox exits, pod destroyed, warm pool replenishes         │
└────────────────────────────────────────────────────────────────────────────┘
                   │
                   ▼
            PostgreSQL (checkpoint writes, final run status)
```

### Flow

```
Event arrives (template_id: "order_followup", data: { order_id: ... })
    │
    ▼
Admin API validates + writes to Postgres + pushes to Redis Stream
    │
    ▼
Core reads event from Redis (~1-2ms)
    │  looks up template_id → image: swarm/sandbox-order-followup:v2
    │  claims one IDLE sandbox from warm pool (~100-500ms)
    │  injects event payload as environment variables
    │  creates run record in Postgres
    ▼
Sandbox receives payload, agent loop starts immediately
    │  template already compiled in memory (loaded at warm boot)
    │  skills already in memory
    │  tools already in memory
    │
    │  Step 1 → LLM call → tool call → result in sandbox memory
    │  Step 2 → LLM call → adapter call (gRPC to Adapter Service) → result in memory
    │  Step 3 → deterministic tool call → result in memory
    │  ...
    │  async checkpoint to Postgres after each step
    ▼
Run complete → final status written to Postgres → sandbox exits
    │
    ▼
Warm pool replenisher spins up a fresh replacement sandbox in background
```

### Tradeoffs

|  |  |
| --- | --- |
| ✅ Complete isolation — one run cannot affect another | ❌ Image per template — every template update triggers a build |
| ✅ Sandbox crash affects only that one run | ❌ Warm pool requires careful sizing and management |
| ✅ Session state in fast in-process memory | ❌ Adapter service call adds ~5-20ms network hop per call |
| ✅ Per-run resource limits enforceable | ❌ Operationally complex — registry, build pipeline, gVisor nodes |
| ✅ Clean mental model — one event, one sandbox | ❌ Local development requires Docker image builds per template |

---