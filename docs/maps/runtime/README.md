# Runtime deployment views

The local development diagram describes containers that exist in the
repository's Compose configuration. The target diagram describes logical
production responsibilities, not a selected Kubernetes, container, cloud, or
network topology.

- [Current local Compose stack](current-local-stack.svg)
- [Target runtime and data isolation](target-runtime.svg)

The target calls out independently deployable owner services and their
separate PostgreSQL clusters. Pod counts, autoscaling, orchestration
platform, production ingress, Nginx use, cluster sizing, high availability,
and network segmentation remain implementation/production qualification
decisions. Do not read the target diagram as a deployment manifest.
