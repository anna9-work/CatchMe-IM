# ===== base =====
FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable

# ===== deps =====
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
COPY shared/package.json ./shared/package.json
RUN pnpm install --no-frozen-lockfile

# ===== build =====
FROM deps AS build
COPY . .
RUN pnpm --filter server build

# ===== run =====
FROM base AS run
ENV NODE_ENV=production
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/server ./server
COPY --from=build /app/shared ./shared
COPY package.json ./

EXPOSE 3000
CMD ["pnpm", "--filter", "server", "start"]
