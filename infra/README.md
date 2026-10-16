# Local development environment

The current Compose environment contains the API gateway and local
observability services. It does not contain a database, the planned Identity
service, or any TMS business services. The gateway currently serves health,
readiness, and metrics only.

See the [documentation guide](../docs/README.md) for the distinction between
the product target and implemented repository capabilities.

## Start and inspect

From the repository root:

```sh
cp -n .env.example .env
pnpm install --frozen-lockfile
pnpm build
docker compose -f infra/docker-compose.dev.yml up -d --build
```

The gateway is available at `http://localhost:3000`; the local Nginx entry
point is `http://localhost:8080`. Grafana is at `http://localhost:3005` and
Prometheus at `http://localhost:9090`. Published ports bind to loopback.

```sh
pnpm docker:status
pnpm docker:health
pnpm docker:logs
pnpm docker:down
```

`pnpm docker:down` preserves named observability volumes. Removing local
observability data is destructive; use
`docker compose -f infra/docker-compose.dev.yml down --volumes` only when
that reset is intended.

## Boundaries

- There is no application datastore in the current stack. Introduce one with
  an approved product workflow and explicit ownership.
- The planned Identity service, authentication, account lifecycle, and
  authorization are not implemented. The current environment has no account
  provisioning operation.
- Prometheus scrapes the gateway and local observability components;
  OpenTelemetry exports traces to local Tempo.
- Local observability is diagnostic, not durable business history or a
  production monitoring design.
- Local configuration and credentials are for development only. Never
  expose this stack or reuse local defaults in a deployed environment.
