.PHONY: help dev kill-ports print-urls test lint format db-generate db-migrate db-seed create-admin up down logs clean release
.DEFAULT_GOAL := help

help:       ## show this help
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*##/ { printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

# A real file target, not .PHONY, and deliberately with NO prerequisite: Make
# only runs this recipe when .env does not exist at all, so every target below
# can safely depend on it without .env, Postgres/Redis fall back to OS-level
# connection defaults (your OS username, no password) instead of failing
# clearly, which is exactly the confusing error this prevents.
#
# `.env: .env.example` would be wrong here even though it looks more correct:
# Make treats a file target as out of date when its prerequisite is NEWER, so
# editing .env.example later (e.g. adding a new variable) would make Make
# silently overwrite your real .env on the next `make dev`/`down`/etc. — wiping
# real credentials. Never add .env.example as a prerequisite of this rule.
.env:
	cp .env.example .env
	@echo "Created .env from .env.example — edit it if you need different credentials."

# Only the ports native dev processes (tsx/next) bind directly, not Postgres/
# Redis/Mailpit's published ports — those are Docker-managed, and the PID
# holding them on macOS is often Docker Desktop's own proxy, shared with
# unrelated containers; killing it is a disproportionate side effect for this
# convenience step, and `docker compose up -d` already reconciles its own
# containers idempotently without needing a kill first.
DEV_APP_PORTS := 3000 3100

kill-ports: ## free the app ports (3000, 3100) so `make dev` never hits EADDRINUSE
	@for port in $(DEV_APP_PORTS); do \
		pid=$$(lsof -ti:$$port -sTCP:LISTEN 2>/dev/null); \
		if [ -n "$$pid" ]; then \
			echo "Port $$port is in use by pid $$pid — killing it"; \
			kill -9 $$pid; \
		fi; \
	done

print-urls: ## show the dev stack's services and access URLs
	@echo ""
	@echo "Services:"
	@echo "  API          http://localhost:3000"
	@echo "  API docs     http://localhost:3000/docs"
	@echo "  Web          http://localhost:3100"
	@echo "  Postgres     localhost:5432"
	@echo "  Redis        localhost:6379"
	@echo "  Mailpit UI   http://localhost:8025"
	@echo ""

dev: .env kill-ports ## start infra + every app in dev mode: api :3000 (Swagger at /docs), web :3100
	# --wait blocks until postgres/redis/mailpit report healthy (not just
	# "started") — without it, `docker compose up -d` returns the moment the
	# containers launch, and db-migrate below can race Postgres's own startup
	# and fail with ECONNREFUSED before it's actually accepting connections.
	docker compose up -d --wait postgres redis mailpit
	$(MAKE) db-migrate
	$(MAKE) print-urls
	pnpm turbo run dev

test:       ## run the full test suite
	pnpm turbo run test

lint:       ## lint + type-check every package
	pnpm turbo run lint typecheck

format:     ## format the whole repo
	pnpm format

db-generate: .env ## generate a migration from schema.ts changes
	pnpm --filter @akaunta/api run db:generate

db-migrate: .env  ## apply pending database migrations
	pnpm --filter @akaunta/api run db:migrate

db-seed: .env     ## populate realistic test data (run after db-migrate)
	pnpm --filter @akaunta/api run seed

create-admin: .env ## create a real login: make create-admin ARGS='--email you@x.com --password secret --group "My Group"'
	pnpm --filter @akaunta/api run create-admin -- $(ARGS)

up: .env    ## run the whole product via docker compose (self-hosted/production shape)
	docker compose up -d

down: .env  ## stop docker compose AND kill any lingering dev processes (incl. backgrounded/orphaned children)
	# Leading "-" on every line: if docker compose itself fails (e.g. a wedged
	# container that won't accept a stop/kill signal — a real Docker daemon
	# issue, not something this Makefile can fix), the process cleanup below
	# still runs instead of Make aborting and leaving things half-cleaned.
	-docker compose --profile dev down
	-pkill -f "turbo run dev"
	# Matches any tsx- or next-invoked process this project spawns by its
	# absolute path — not just `tsx watch`/`next dev` — so a one-off script
	# left hung (db:migrate, seed, db:generate) is caught too, not only the
	# persistent dev-watch processes.
	-pkill -f "$(CURDIR)/node_modules/.pnpm/tsx"
	-pkill -f "$(CURDIR)/node_modules/.pnpm/next"
	-@$(MAKE) kill-ports

logs: .env  ## tail docker compose logs (any profile)
	docker compose --profile dev logs -f

clean:      ## remove build output and caches
	pnpm turbo run clean
	rm -rf node_modules apps/*/node_modules packages/*/node_modules .turbo

release:    ## cut a new release (see Engineering Practices in the plan)
	pnpm changeset version && pnpm changeset publish
