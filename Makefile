.PHONY: help build images build-image up down restart rebuild logs status health

help:
	@printf "Available targets:\n"
	@printf "  make build         Build workspace packages\n"
	@printf "  make images        Build local service images\n"
	@printf "  make build-image SERVICE=api-gateway  Build one service image\n"
	@printf "  make up            Start the local TMS gateway environment\n"
	@printf "  make down          Stop containers and preserve local data\n"
	@printf "  make restart       Restart the local stack\n"
	@printf "  make rebuild       Rebuild images without cache\n"
	@printf "  make logs          Follow container logs\n"
	@printf "  make status        Show Compose service status\n"
	@printf "  make health        Check gateway health and readiness\n"

build:
	pnpm build

images: build
	docker compose -f infra/docker-compose.dev.yml build

build-image:
	@test -n "$(SERVICE)" || (printf "Usage: make build-image SERVICE=api-gateway\n" >&2; exit 2)
	docker compose -f infra/docker-compose.dev.yml build "$(SERVICE)"

up:
	docker compose -f infra/docker-compose.dev.yml up -d --build

down:
	docker compose -f infra/docker-compose.dev.yml down --remove-orphans

restart: down up

rebuild:
	docker compose -f infra/docker-compose.dev.yml build --no-cache

logs:
	docker compose -f infra/docker-compose.dev.yml logs -f --tail=200

status:
	docker compose -f infra/docker-compose.dev.yml ps --all

health:
	curl -fsS http://localhost:8080/health
	@printf "\n"
	curl -fsS http://localhost:3000/ready
	@printf "\n"
