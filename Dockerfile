# ======================
# Base
# ======================
FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable

# ======================
# Deps
# ======================
FROM base AS deps

# root deps
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches

# workspace packages（你 repo 真的存在的）
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json

# install
RUN pnpm install --no-frozen-lockfile

# ======================
# Build
# ======================
FROM deps AS build
COPY . .
RUN pnpm --filter server build

# ======================
# Runtime
# ======================
FROM base AS run
ENV NODE_ENV=production
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/server ./server
COPY package.json ./

EXPOSE 3000
CMD ["pnpm", "--filter", "server", "start"]
