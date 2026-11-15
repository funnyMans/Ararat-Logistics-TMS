FROM node:24.20 AS builder

RUN corepack enable && corepack prepare pnpm@11.25.0 --activate

WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json turbo.json ./
COPY packages/common/package.json packages/common/package.json
COPY packages/identity-token/package.json packages/identity-token/package.json
COPY services/api-gateway/package.json services/api-gateway/package.json
COPY services/load-service/package.json services/load-service/package.json
COPY services/counterparty-registry/package.json services/counterparty-registry/package.json
COPY services/capacity-commitment/package.json services/capacity-commitment/package.json
COPY services/dispatch-planning/package.json services/dispatch-planning/package.json
COPY services/operational-economics/package.json services/operational-economics/package.json
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter service-operational-economics build

FROM node:24.20

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate
COPY --from=builder /app /app

ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "services/operational-economics/dist/runtime.js"]
