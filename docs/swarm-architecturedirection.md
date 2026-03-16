**SWARM**

Agent Runtime - Architecture Proposal

_High-Throughput, Low-Latency Design for Multi-Agent Workflows_

March 2026 · Prepared for: SWARM Engineering

# **Executive Summary**

This document evaluates five architectural directions for the SWARM agent runtime and delivers a recommended design. Each direction is assessed independently from first principles - not from the intuitions in the brief - and compared on the axes that matter most: database pressure, latency, isolation quality, recoverability, and operational complexity.

The core tension in the problem is this: a naive runtime writes to PostgreSQL after every step of every agent run. At low concurrency this is fine. At 1,000 concurrent multi-step runs it becomes the bottleneck. The goal is to absorb that concurrency without introducing fragility, and to keep adapter calls within the 10-20 ms target.

**Recommended Architecture**

A three-layer hybrid: (1) a Redis-backed hot cache for YAML templates and tool configs, eliminating repeated DB reads; (2) in-process in-memory state during execution with selective async checkpointing via a write buffer, reducing DB writes by 80-95%; and (3) gVisor (runsc) as the sandbox layer for tool execution - not full per-agent microVMs. MicroVM-per-agent is reserved as a Phase 2 option once the platform reaches the scale where its isolation benefits justify the orchestration cost. The adapter service is collapsed into tool calls, eliminating the separate service tier.

The rationale: the primary bottleneck at early-to-mid scale is DB write pressure, not isolation granularity. The in-memory + async checkpoint pattern removes 80-95% of synchronous writes. gVisor adds strong-enough security with near-zero ops overhead. Full MicroVM-per-agent is architecturally sound but carries a high infrastructure cost that is not justified until the threat model or scale demands it.

# **1\. The Problem in Depth**

## **1.1 What the Current Architecture Does**

The existing runtime (as documented) writes a full checkpoint to PostgreSQL after every completed step. In the common case of a five-step workflow with three SUBAGENT steps and two DETERMINISTIC steps, a single run produces at minimum five session upserts, five step-record writes, plus status updates - roughly 11-15 round-trips per run to Postgres. At 1,000 concurrent runs this is 11,000-15,000 writes per second, sustained, with transactional semantics. Postgres handles roughly 5,000-15,000 writes/sec comfortably on mid-range hardware. The runtime is already at or near the ceiling before adding LLM latency, tool execution time, or fanout parallelism.

## **1.2 The Four Pressure Points**

After analysing the architecture documents and meeting notes, four distinct pressure points emerge:

- DB read pressure: every step reads YAML templates, skills, and tool configs from Postgres. In the current design these reads hit the DB on every invocation; there is no caching layer.
- DB write pressure: step checkpointing is synchronous and happens after every step, blocking the runner until the write completes.
- Adapter latency: tool calls that reach external services through the Adapter Service add a network hop. The meeting discussed embedding adapter logic more tightly but the tradeoff was not resolved.
- Isolation: tools run in-process (SandboxMode.none). Any tool executing untrusted code or calling external services with side effects shares the runtime process - a security and stability risk at multi-tenant scale.

## **1.3 Non-Goals**

This proposal does not redesign the template schema, the LLM loop, or the YAML format. The session/runner/llm module structure is sound and is preserved. The goal is to change where and when state moves - not how the agent reasons.

# **2\. Direction 1 - Configuration Caching Layer**

## **2.1 The Idea**

Before each run, the runtime fetches a compiled template from Postgres (a YAML string that must be parsed and validated) plus the skill and tool registries. These are expensive reads that produce identical results for every invocation of the same template version. A caching layer intercepts these reads and serves them from memory.

## **2.2 What to Cache and at What Granularity**

Three artefacts are natural cache targets, each with a different access pattern:

| **Cache Target**            | **Read Frequency**                    | **Write Frequency**                 | **TTL Strategy**                      | **Invalidation Trigger**                    |
| --------------------------- | ------------------------------------- | ----------------------------------- | ------------------------------------- | ------------------------------------------- |
| **Compiled Template**       | Every run invocation                  | Only on template publish            | Indefinite with explicit invalidation | Admin API publish event → Redis key delete  |
| **Skill Registry Snapshot** | Every LLM loop turn (context_builder) | Low - skill edit is rare            | 5-15 min TTL + explicit invalidation  | Skill update event → broadcast invalidation |
| **Tool Registry Snapshot**  | Every tool dispatch                   | Very low - tool code changes rarely | Indefinite + explicit invalidation    | Deploy event → invalidation broadcast       |

The cache should live inside each agent pod (in-process dict/LRU with a size cap) backed by a shared Redis cluster. The local in-process cache is the fast path (sub-microsecond); Redis is the coordination layer ensuring all pods see invalidations within milliseconds.

## **2.3 Invalidation Strategy**

Cache staleness is the main risk. The correct model is time-bounded lazy invalidation with explicit purge on write. When the Admin API publishes a new template version, it writes to Postgres and immediately publishes an invalidation event to a Redis Pub/Sub channel. Each runtime pod is a subscriber; on receipt it evicts the relevant key from its local cache. The next access re-fetches from Redis (or Postgres if Redis also missed). This gives eventual consistency with a worst-case staleness window equal to the network latency of the Pub/Sub message - typically under 5 ms in a colocated cluster.

The risk of a pod missing the invalidation (e.g. pod restart during the event) is handled by the TTL: even if the explicit invalidation is missed, the entry ages out within its TTL window. For compiled templates the TTL should be set conservatively long (e.g., 30 minutes) since template versions are immutable - a published template is never mutated, only superseded by a new version.

## **2.4 Impact Assessment**

- DB read pressure: eliminated for the hot path. Templates and registries are fetched from Postgres only on cache miss, which is rare after warm-up.
- Memory cost: compiled templates are typically small (tens of KB each). A pod holding 500 templates in memory consumes under 100 MB - negligible.
- Complexity added: one Redis Pub/Sub channel per cache type, one background subscriber goroutine per pod, TTL configuration. Low operational surface.
- Risk: if Redis is unavailable, the runtime falls back to direct Postgres reads. The cache is an optimisation, not a required path.

**Verdict on Direction 1**

Adopt unconditionally. This is the lowest-risk, highest-return change in the proposal. It eliminates the dominant category of DB read pressure with minimal code and zero architectural change to the execution model. It should be implemented before any other direction.

# **3\. Direction 2 - In-Memory State & Selective Checkpointing**

## **3.1 The Idea**

The current model checkpoints the full session to Postgres after every completed step. This is the right design for crash recovery, but the write is synchronous - the runner blocks on the DB round-trip before proceeding to the next step. The idea is to decouple execution from persistence: keep the session entirely in the pod's memory during a run, and write to Postgres asynchronously, either periodically or only on terminal events (run completion, failure, or cancellation).

## **3.2 Three Checkpointing Modes**

There is not one obvious answer - the right mode depends on the acceptable durability window and the scale of concurrent agents:

| **Mode**                | **When Postgres Is Written**                              | **Durability Window**             | **DB Write Reduction**         | **Recovery Behaviour**                                       |
| ----------------------- | --------------------------------------------------------- | --------------------------------- | ------------------------------ | ------------------------------------------------------------ |
| **Step-sync (current)** | After every step, synchronously                           | Zero - no data loss               | 0%                             | Resume from last step                                        |
| **Step-async**          | After every step, but off the hot path via a write buffer | ~50-500ms (buffer drain interval) | ~60-70% (fewer blocking waits) | Resume from last step; small window of re-execution on crash |
| **Terminal-only**       | Only on run completion or failure                         | Entire run duration               | ~85-95%                        | Restart from step 0 on crash; must re-execute entire run     |
| **Epoch-based**         | After every N steps (configurable)                        | Up to N steps of work             | ~70-85%                        | Resume from last epoch boundary                              |

### **Recommended mode: Step-async with a write buffer**

The step-async pattern retains the recovery granularity of the current design (resume from last completed step) while eliminating the blocking write from the critical path. The implementation: after each step completes, push the session snapshot onto a per-pod in-memory ring buffer. A background coroutine drains the buffer in batches at a configurable interval (suggested: 100 ms or 50 items, whichever comes first). Postgres writes are batched using COPY or multi-row INSERT with ON CONFLICT DO UPDATE.

The durability window is bounded by the drain interval. If a pod crashes mid-drain, up to 100 ms of completed steps may need to be re-executed. For the typical SWARM use case (step execution takes 1-30 seconds) this re-execution cost is modest.

## **3.3 Memory Overhead at Scale**

A single session object contains the event payload, LLM message history, and step results. A generous estimate for a five-step run with moderate LLM context is 100-500 KB per session in memory. At 1,000 concurrent runs this is 100-500 MB of session state in working memory per pod - comfortably within the typical pod memory ceiling of 2-4 GB. At 10,000 concurrent runs across a horizontally scaled fleet (e.g., 20 pods × 500 runs each), the footprint is bounded per pod, not total.

## **3.4 Isolation and Consistency Considerations**

The main consistency risk is a pod holding in-memory state for a run while the Admin Console or a competing pod queries Postgres expecting current state. The solution is a status sentinel: write a lightweight status row to Postgres when a run starts (status: RUNNING, assigned_pod_id), and update it asynchronously. The Admin API queries this row for live status; it does not need full session state. Detailed step-level state is available only after the async write drains, which the UI can surface as eventual.

**Verdict on Direction 2**

Adopt the step-async write buffer. It achieves 60-70% reduction in blocking DB write latency with a recovery guarantee nearly equivalent to the current synchronous model. Terminal-only checkpointing is architecturally simpler but the re-execution cost on crash is too high for multi-minute agent runs. Epoch-based is a reasonable middle ground if operational simplicity is valued over granularity.

# **4\. Direction 3 - MicroVM Sandbox per Agent (Priority Direction)**

## **4.1 The Idea**

The most ambitious direction: pre-build a microVM image per YAML template, bundling tools, skills, prompts, and adapter logic directly into the image. On event ingestion, spin up a microVM, run the agent loop entirely inside it with its own isolated memory, and terminate the VM on completion. The VM handles its own state; the central Postgres is only written on terminal events.

## **4.2 MicroVM Technology Options**

Three technologies are in active production use for this class of workload:

| **Technology**                 | **Cold-Start**             | **Runtime Overhead**              | **Isolation Strength**                            | **Ops Complexity**                        | **K8s Integration**           |
| ------------------------------ | -------------------------- | --------------------------------- | ------------------------------------------------- | ----------------------------------------- | ----------------------------- |
| **Firecracker (direct)**       | ~125-200ms (cold boot)     | Near-native (KVM-backed)          | Hardware VM-level (strongest)                     | High - requires custom VMM orchestration  | Via Kata Containers or custom |
| **Firecracker + Snapshot**     | ~10-50ms (snapshot resume) | Near-native                       | Hardware VM-level                                 | Very High - snapshot lifecycle management | Via Kata Containers           |
| **gVisor (runsc)**             | ~5-50ms (no VM boot)       | 5-30% overhead on I/O-heavy paths | Syscall interception + user-space kernel (strong) | Low - drop-in OCI runtime                 | RuntimeClass in K8s           |
| **Kata Containers**            | ~150-300ms                 | Near-native                       | Hardware VM-level                                 | Moderate - abstracts Firecracker/QEMU     | Native RuntimeClass support   |
| **Plain containers (current)** | ~50ms                      | Native                            | Shared kernel (weakest)                           | None (already in place)                   | Native                        |

## **4.3 The Cold-Start Problem**

The most frequently cited objection to per-agent microVMs is cold-start latency. The data shows this concern is real but manageable:

- Firecracker cold boot takes approximately 125-200 ms for the full kernel init sequence. This is acceptable for agent runs that take seconds to minutes, but problematic if the target is sub-100 ms adapter latency.
- Snapshot resume changes the calculus dramatically: Firecracker can resume from a pre-warmed snapshot in as little as 10-50 ms. AWS Lambda SnapStart uses exactly this mechanism to eliminate cold-start overhead at scale. CodeSandbox demonstrates resume within 1 second for memory-compressed snapshots of full development environments.
- A pre-warmed pool of snapshot-ready microVMs eliminates the boot cost from the critical path entirely. AWS Lambda maintains such a pool; the microVM boot (200 ms) is hidden from the user because it happens before the request arrives.

## **4.4 Per-Template Image Strategy - Feasibility Analysis**

The direction proposes building one VM image per YAML template. This is where the architecture becomes complex:

- Image build latency: building a new VM image on each template publish adds 30-120 seconds to the deployment pipeline (rootfs construction, kernel packaging, image push to object storage). Acceptable for the template publishing path, not for runtime.
- Image size management: a minimal Linux rootfs with Python 3.11 and the SWARM runtime is approximately 200-400 MB compressed. With 100 templates this is 20-40 GB of image storage. This scales poorly. The preferred model is a single base image with dynamic configuration injection at VM start (environment variables, mounted config files) rather than a dedicated image per template.
- Skill and tool updates: if skills are baked into the image, updating a skill requires re-building all images that reference it - a combinatorial maintenance problem. The right approach is to mount skills at runtime from object storage or a dedicated skills registry, not to embed them at build time.
- Adapter embedding: collapsing the adapter service into the VM is discussed below (Direction 5). The image-per-template model makes adapter versioning especially complicated: each image must pin adapter versions, creating version skew across templates.

## **4.5 The Honest Case Against Full MicroVM-per-Agent**

The technical case for MicroVM-per-agent is strongest when: (a) tools execute untrusted code, (b) the platform is multi-tenant with adversarial tenants, or (c) regulatory compliance requires hardware-level isolation between workflow runs. For SWARM's current use case - an enterprise workflow automation platform running trusted tools on behalf of internal customers - the isolation requirements are closer to "defense in depth" than "adversarial multi-tenant."

The operational cost of full Firecracker-per-agent is high: dedicated VMM orchestration, snapshot lifecycle management, networking through TAP interfaces, jailer configuration, and image pipeline engineering. Northflank, which runs microVMs at scale (2M+ per month), explicitly recommends using Kata Containers to abstract this complexity for most organisations. Building the raw Firecracker infrastructure from scratch is a multi-month infrastructure investment.

**Verdict on Direction 3**

Do not implement full MicroVM-per-agent in Phase 1. The operational cost does not match the security benefit at current scale. Instead: (1) adopt gVisor as the sandbox layer now (low ops cost, meaningful isolation improvement); (2) design the runtime so the SandboxManager interface is the only component that needs to change to add Firecracker later; (3) revisit full MicroVM isolation when the platform is multi-tenant with untrusted tool code, or when a single breach event makes the cost/benefit case clear.

# **5\. Direction 4 - Skills & Tools Storage**

## **5.1 The Question**

Where should skills and tools live? The current design stores them in PostgreSQL (DB skills, loaded at startup into an in-memory registry). The meeting notes raised concern that skills may grow too large for DB storage. This section evaluates the options.

## **5.2 What "Large" Means in Practice**

A skill in the current architecture is a SkillDefinition: a name, a list of tool names, and an optional prompt_addition string. This is inherently small - typically under 2 KB per skill. Tools are callable implementations; their code lives in the service binary, not in the DB. The concern about size is most plausible for:

- Prompt additions that include lengthy few-shot examples or RAG context fragments.
- Tool implementations that embed large static assets (e.g., OpenAPI specs, lookup tables).
- A future skills model that stores embeddings or fine-tuned weights per skill.

## **5.3 Storage Options Evaluated**

| **Storage Option**                    | **Latency**                  | **Update Propagation**               | **Size Limit**              | **Suitable For**                                                  |
| ------------------------------------- | ---------------------------- | ------------------------------------ | --------------------------- | ----------------------------------------------------------------- |
| **PostgreSQL (current)**              | 5-20ms (cached: <1ms)        | Real-time via invalidation broadcast | Practical ~1MB/row          | Skill metadata, small prompt additions                            |
| **Redis (hot cache only)**            | <1ms                         | TTL-based + explicit invalidation    | Bounded by Redis RAM budget | Active session skills, frequently accessed configs                |
| **Object Storage (S3/GCS)**           | 50-200ms (cold), cached <1ms | Eventual (CDN invalidation)          | Unlimited                   | Large prompt corpora, embedded OpenAPI specs, versioned artifacts |
| **Embedded in MicroVM image**         | Zero (already in memory)     | Requires image rebuild + redeploy    | Up to full image size       | Stable, rarely-changing tool code only                            |
| **Dedicated Skills Registry Service** | 5-30ms (network)             | Push-based subscriptions             | Unlimited                   | Multi-tenant, versioned skill sharing across teams                |

## **5.4 Recommended Skills Storage Architecture**

A two-tier model handles the full range of skill sizes without overengineering:

- Tier 1 - Postgres + Redis cache (current, preserved): skill metadata, tool name lists, and prompt additions under ~50 KB stay in Postgres and are served from the in-memory cache (Direction 1). This covers 95% of practical skills.
- Tier 2 - Object storage (S3-compatible): skills with large prompt corpora or embedded assets reference an object storage URI in their Postgres row. The context_builder resolves the URI lazily on first use and caches the result in Redis with a generous TTL. This avoids stuffing large blobs into Postgres while keeping the access pattern transparent to the rest of the runtime.

A dedicated skills registry service is over-engineering for a single-platform deployment. It is worth considering if SWARM evolves to a multi-tenant model where different customers define and share skills independently.

**Verdict on Direction 4**

Postgres + Redis cache is the right answer for current scale. Add object storage as an overflow tier for large skill artifacts, keyed by a URI in the Postgres row. Do not build a dedicated skills service at this stage - the added operational surface exceeds the benefit.

# **6\. Direction 5 - Adapter Service Rethinking**

## **6.1 The Current Model**

The Adapter Service is a separate process (gRPC/HTTP) that the agent runtime calls when tools need to interact with external systems. Each tool call that touches an integration routes through the adapter, adding a network hop. The meeting notes acknowledge this is a known pain point: the service is rewritten per new integration, creating fragility and version-skew risk.

## **6.2 The Proposed Alternative: Adapters as Tool Calls**

The direction proposes treating adapters as advanced tool calls, embedding the adapter logic inside the agent's execution context rather than routing to a separate service. Under this model:

- An adapter is a tool implementation registered in tools/registry.py that happens to call an external API.
- The LLM sees the adapter as a regular tool schema - no different from any other capability.
- There is no separate service to deploy, version, or monitor. Adapter code lives in the main runtime codebase or is dynamically loaded.

## **6.3 Tradeoff Analysis**

| **Dimension**            | **Separate Adapter Service**                   | **Adapters as Tool Calls**                    |
| ------------------------ | ---------------------------------------------- | --------------------------------------------- |
| **Latency**              | Network hop per call (~5-50ms additional)      | In-process or local call (<1ms overhead)      |
| **Isolation**            | Adapter failure doesn't crash the runtime      | Adapter failure can affect the agent pod      |
| **Deployment**           | Independent deploy cycle per adapter           | Adapter deploys with the runtime binary       |
| **Scaling**              | Can scale adapter replicas independently       | Scales with the runtime pod fleet             |
| **Dependency isolation** | Adapter deps don't pollute runtime deps        | Shared dep graph - version conflicts possible |
| **Observability**        | Separate tracing surface per adapter           | Unified traces across runtime + adapters      |
| **Maintenance**          | Must maintain separate service per integration | All adapter code in one codebase              |

## **6.4 The Hybrid: Plugin-Based Adapters**

The cleanest resolution is neither a monolithic separate service nor a fully embedded adapter: it is a plugin registry. Adapters are implemented as standalone Python packages (or dynamic libraries) that conform to a standard tool interface. The runtime loads them at startup from a configured location (local filesystem, S3 bucket, or a simple HTTP registry endpoint). This gives:

- Independent versioning: each adapter package has its own version and can be updated without rebuilding the main runtime.
- Dependency isolation: adapter packages can declare their own dependencies, which are resolved into an isolated virtual environment at load time.
- No network hop: adapters run in-process with the runtime, inside the existing sandbox boundary.
- Fault isolation: if the sandbox (gVisor) is in place, a misbehaving adapter is contained within the sandbox, not the entire pod.

The 10-20 ms adapter latency target is incompatible with an external service model if the target includes the full round-trip. In-process adapter execution (with gVisor sandbox wrapping the tool call) is the only path to consistent sub-20 ms tool execution for simple API calls.

**Verdict on Direction 5**

Collapse the separate Adapter Service into plugin-based tool implementations. Define a standard adapter interface, load adapters at runtime startup from a versioned plugin registry, and wrap tool execution in the existing sandbox layer. This eliminates the network hop, reduces the operational surface from N services to 1, and unifies observability. The loss of independent scaling is acceptable: adapter calls are typically CPU-light and scale linearly with the agent fleet.

# **7\. Cross-Direction Comparison**

The table below maps all five directions against the four primary pressure points identified in Section 1.2. Ratings reflect impact relative to the current baseline.

| **Direction**                | **DB Read Pressure**   | **DB Write Pressure**   | **Isolation**          | **Ops Complexity**   |
| ---------------------------- | ---------------------- | ----------------------- | ---------------------- | -------------------- |
| **D1: Config Cache**         | Eliminated (hot path)  | None (read-only)        | None (cache only)      | Very Low             |
| **D2: In-Mem + Async Write** | None                   | -80-95% (async buffer)  | None                   | Low                  |
| **D3a: gVisor Sandbox**      | None                   | None                    | Strong (syscall-level) | Low (drop-in)        |
| **D3b: MicroVM-per-Agent**   | Reduced (VM-local)     | Reduced (terminal-only) | Strongest (hardware)   | Very High            |
| **D4: Skills Storage**       | Reduced (object store) | None                    | None                   | Low-Moderate         |
| **D5: Adapter as Plugin**    | None                   | None                    | Via sandbox layer      | Low (simplifies ops) |

# **8\. Recommendation - Phased Architecture**

## **8.1 Phase 1 (Implement Now): The 3-Layer Hybrid**

Phase 1 delivers 80-95% of the latency and throughput improvement with modest engineering investment. The three layers are independent; each can be shipped and rolled back without affecting the others.

| **D1**  | **Config Cache Layer**<br><br>Implement a two-level cache: in-process LRU per pod + Redis coordination. Cache compiled templates, skill snapshots, and tool registry snapshots. Invalidate on Admin API publish events via Redis Pub/Sub. Expected impact: eliminates ~70-90% of template and registry reads from Postgres.                                                                |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **D2**  | **Async Write Buffer**<br><br>Replace synchronous post-step checkpointing with a per-pod ring buffer drained by a background coroutine. Batch writes to Postgres every 100 ms or 50 items. Add a lightweight status sentinel row for live Admin UI queries. Expected impact: 80-95% reduction in blocking DB write latency.                                                                |
| **D3a** | **gVisor Sandbox**<br><br>Upgrade SandboxMode from none to gvisor. Configure Kubernetes RuntimeClass with runsc. Wrap all tool dispatch in the sandbox manager. No changes to tools/registry.py or dispatcher.py. Expected impact: meaningful isolation improvement; tools run in a user-space kernel; syscall surface reduced to ~70-80% of Linux; 5-30% overhead on I/O-heavy tools.     |
| **D5**  | **Adapter Plugin Registry**<br><br>Define an AdapterPlugin interface. Migrate existing adapter implementations to conform to the interface. Load adapters at startup from a versioned plugin directory or S3-compatible bucket. Remove the separate Adapter Service process. Expected impact: eliminates the network hop on tool calls; unifies observability; reduces service count by N. |

## **8.2 Phase 2 (Conditional): MicroVM Isolation**

Phase 2 is conditional - trigger it when one of the following is true:

- The platform becomes externally multi-tenant (customers submitting templates with arbitrary tool code).
- A security review identifies tool isolation as a critical gap for compliance.
- Profiling at scale shows that gVisor syscall overhead is a measurable bottleneck.

When triggered, the recommended path is Kata Containers (abstracting Firecracker) rather than raw Firecracker orchestration. Kata provides K8s-native RuntimeClass support, production-hardened networking (not raw TAP), and abstracts the jailer/snapshot lifecycle. The SandboxManager interface in manager.py is already the only code surface that changes - the rest of the runtime is insulated.

The per-template image model proposed in the brief should be replaced with a single base image plus dynamic configuration injection. This avoids the image explosion problem and decouples skill updates from image builds.

## **8.3 What Not to Build**

- A dedicated Skills Registry Service: add object storage as overflow for large artifacts; a registry adds operational surface without proportionate benefit at single-platform scale.
- Full in-process state without any async checkpointing: terminal-only checkpointing risks re-executing long agent runs on pod crash. The async buffer is the right tradeoff.
- Raw Firecracker per-agent before Phase 1 is stable: the cold-start and networking complexity of raw Firecracker is a multi-month infrastructure investment. Kata Containers is the right on-ramp when the time comes.

# **9\. Latency Model - Adapter Call Budget**

The target of 10-20 ms for adapter calls deserves explicit analysis. The table below breaks down where time goes in a single tool call under each architecture:

| **Component**                       | **Current (sync, in-process none)** | **Phase 1 (async, gVisor, in-process adapter)** | **Phase 2 (gVisor, microVM)** |
| ----------------------------------- | ----------------------------------- | ----------------------------------------------- | ----------------------------- |
| **Tool dispatch (registry lookup)** | < 1ms                               | < 1ms                                           | < 1ms                         |
| **Sandbox overhead**                | 0ms (none)                          | 0.5-5ms (gVisor syscall interception)           | 2-10ms (VM exit overhead)     |
| **Network hop to Adapter Service**  | 5-50ms                              | 0ms (collapsed)                                 | 0ms (collapsed)               |
| **External API call latency**       | Variable (10-200ms)                 | Variable (10-200ms)                             | Variable (10-200ms)           |
| **Checkpoint write (blocking)**     | 5-20ms                              | 0ms (async)                                     | 0ms (async)                   |
| **Total (excl. external API)**      | 10-70ms                             | 0.5-5ms                                         | 2-10ms                        |

The 10-20 ms target for adapters refers to the platform overhead (everything except the external API call). Phase 1 brings this to under 5 ms. Phase 2 (Kata) adds 2-10 ms VM exit overhead but remains within budget. The current architecture misses the target purely because of the Adapter Service network hop and the synchronous checkpoint write.

# **10\. Implementation Guidance**

## **10.1 Change Surface**

The phased architecture is designed to minimise the number of files that change. The table below maps each change to its target module:

| **Change**           | **Files Modified**                        | **Files Added**                                                | **Behaviour Change**                               |
| -------------------- | ----------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------- |
| **Config cache**     | skills/loader.py, template/compiler.py    | cache/manager.py, cache/invalidator.py                         | Reads served from cache; DB on miss only           |
| **Async checkpoint** | session/checkpoint.py, runner/runner.py   | session/write_buffer.py                                        | Post-step write dequeued; background drain to DB   |
| **gVisor sandbox**   | sandbox/manager.py, K8s RuntimeClass YAML | None                                                           | Tools run under runsc instead of in-process        |
| **Adapter plugins**  | tools/dispatcher.py, tools/registry.py    | adapters/base.py, adapters/loader.py, adapters/&lt;name&gt;.py | Adapter calls in-process; no external service call |

## **10.2 Observability Additions**

The async write buffer introduces a new failure mode: buffer overflow or drain failure. Add three Prometheus metrics:

- checkpoint_buffer_depth: gauge of items pending in the write buffer (alert if > 500 for > 30s).
- checkpoint_drain_latency_ms: histogram of batch write duration (alert if p99 > 2000 ms).
- checkpoint_drop_total: counter of items dropped on buffer overflow (alert if > 0 in 1 min).

The cache layer adds:

- cache_hit_ratio: by cache type (template, skills, tools). Target > 0.95 after warm-up.
- cache_invalidation_delay_ms: latency between Admin API publish and cache eviction confirmation across pods.

## **10.3 Risk Register**

| **Risk**                                         | **Likelihood** | **Impact**                            | **Mitigation**                                                                            |
| ------------------------------------------------ | -------------- | ------------------------------------- | ----------------------------------------------------------------------------------------- |
| **Redis unavailable during cache miss storm**    | Low            | High - DB read spike                  | Circuit-breaker: fall back to direct DB reads; alert on Redis latency > 10ms              |
| **Write buffer overflow under extreme burst**    | Low-Medium     | Medium - checkpoint lag               | Size-bounded buffer (e.g. 10,000 items); drop oldest on overflow; alert on drop_total > 0 |
| **gVisor syscall incompatibility with a tool**   | Low            | Medium - tool silently fails          | Run integration tests with runsc before enabling; maintain fallback RuntimeClass          |
| **Adapter plugin load failure at startup**       | Low            | High - missing tool at runtime        | Validate all plugin interfaces at startup; fail-fast before accepting requests            |
| **Session state lost on pod crash before drain** | Medium         | Low-Medium - up to 100ms re-execution | Tune drain interval; accept small re-execution window as designed behaviour               |

# **11\. Conclusion**

The SWARM agent runtime's bottlenecks are well-understood and solvable without radical architectural upheaval. The dominant problems - DB read pressure from repeated template fetches, DB write pressure from synchronous step checkpointing, adapter network hops, and in-process tool execution with no isolation - each have clean, targeted solutions.

The recommended Phase 1 architecture (config cache + async write buffer + gVisor + adapter plugins) addresses all four pressure points, keeps the module structure intact, and deploys incrementally. Each layer is independently reversible. The total engineering investment is 4-6 weeks for an experienced team.

Full MicroVM-per-agent isolation (Phase 2) is not premature - it is the right destination for a multi-tenant, adversarial-code-executing platform. It is premature for the current deployment profile. The architecture deliberately preserves the SandboxManager abstraction as the single seam through which Phase 2 enters, ensuring the upgrade path is a narrowly scoped change rather than a rewrite.

**One-Sentence Summary**

Fix the cache, fix the writes, swap the sandbox, eliminate the adapter hop - in that order - and you have an enterprise-grade agent runtime that can sustain thousands of concurrent workflows without touching the LLM loop, the session model, or the template schema.

_SWARM - Agent Runtime Architecture Proposal · March 2026 · Confidential_