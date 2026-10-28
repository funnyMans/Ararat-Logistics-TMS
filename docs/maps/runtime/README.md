# Runtime deployment views

The local development diagram describes containers that exist in the
repository's Compose configuration. PostgreSQL and RabbitMQ are isolated to
foundation conformance tests; Temporal has its own persistent PostgreSQL
service and is used only by workflow conformance tests. NATS is test-only,
ephemeral secondary fan-out. The conformance test manually republishes a
message assembled from a committed PostgreSQL fact; no automatic replay
worker is implemented. Neither PostgreSQL service has a TMS business schema,
and the brokers have no application/business routes. The target diagram describes
logical production responsibilities, not a selected Kubernetes, container,
cloud, or network topology.

- [Current local Compose stack](current-local-stack.svg)
- [Target runtime and data isolation](target-runtime.svg)

The target calls out independently deployable owner services and their
separate PostgreSQL clusters. Pod counts, autoscaling, orchestration
platform, production ingress, Nginx use, cluster sizing, high availability,
and network segmentation remain implementation/production qualification
decisions. Do not read the target diagram as a deployment manifest.
