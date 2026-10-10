# Built from the monorepo root: docker build -f apps/web/Dockerfile .
FROM node:26-alpine AS base
# Corepack was removed from Node's own distribution as of the 26.x line — it
# must be installed explicitly now instead of just enabled.
RUN npm install -g corepack && corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
# pnpm needs every workspace member's package.json to resolve the lockfile,
# even ones (api, domain) this image never builds or ships.
COPY apps/api/package.json apps/api/package.json
COPY packages/domain/package.json packages/domain/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
# NEXT_PUBLIC_* vars are inlined into the client bundle by `next build` itself —
# passing this as a runtime `environment:` in compose would be too late, since
# the browser (not this container) is what calls the API, using whatever URL
# was baked in here.
ARG NEXT_PUBLIC_API_URL=http://localhost:3000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY apps/web apps/web
RUN pnpm --filter @akaunta/web build
RUN pnpm --filter @akaunta/web deploy --prod /out

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /out ./
EXPOSE 3100
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3100/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Not `pnpm start`: the runtime stage never inherits the build stage's
# Corepack cache, so pnpm would re-fetch itself from the registry on every
# cold start. `next` is already resolved into node_modules by `pnpm deploy`
# in the build stage — invoke it directly instead.
CMD ["node_modules/.bin/next", "start", "--port", "3100"]
