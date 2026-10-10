# Built from the monorepo root: docker build -f apps/api/Dockerfile .
FROM node:26-alpine AS base
# Corepack was removed from Node's own distribution as of the 26.x line — it
# must be installed explicitly now instead of just enabled.
RUN npm install -g corepack && corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* tsconfig.base.json ./
COPY packages/domain/package.json packages/domain/package.json
COPY apps/api/package.json apps/api/package.json
# pnpm needs every workspace member's package.json to resolve the lockfile,
# even ones (apps/web) this image never builds or ships.
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY packages/domain packages/domain
COPY apps/api apps/api
RUN pnpm --filter @akaunta/domain build && pnpm --filter @akaunta/api build
# pnpm's node_modules are symlinks into a content-addressable store, which a plain
# `COPY` would turn into dangling links — `deploy` resolves everything into real files.
RUN pnpm --filter @akaunta/api deploy --prod /out

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /out ./
EXPOSE 3000
# Uses Node's built-in fetch instead of adding curl/wget to the image.
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
