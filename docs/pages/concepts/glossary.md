---
title: Glossary
description: Terms used across bw-swarm documentation.
---

# Glossary

| Term | Meaning |
|------|---------|
| **Run** | A single execution instance for a `template_id` and JSON `payload`, tracked in `runs` |
| **Template** | Registered workflow + container image; stored in `templates`, implemented under `templates/` |
| **Runtime** | Service that accepts run creation and coordinates sandbox execution |
| **Sandbox pod** | Kubernetes (or similar) workload that runs the template code and writes back to Postgres |
| **Admin API** | HTTP API for templates and run visibility used by Admin Console |
| **Workflow YAML** | Optional YAML definition associated with a template row, editable from the console |
| **Warm pool** | Pre-provisioned pool of pods for faster template startup (see infra K8s manifests) |

Deeper product vocabulary may appear under `bible/product/` in the repo.
