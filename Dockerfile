# ===== base =====
FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable

# ===== deps =====
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
# 先只複製各 workspace 的 package.json（加速 + 正確解析 workspace）
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
COPY shared/package.json ./shared/package.json
# 不要 frozen，避免 overrides mismatch
RUN pnpm install --no-frozen-lockfile

# ===== build =====
FROM deps AS build
COPY . .
# 只 build server（你現在先要讓後端活）
RUN pnpm --filter server build

# ===== run =====
FROM base AS run
ENV NODE_ENV=production
WORKDIR /app

# 需要 runtime deps（用 deps 的 node_modules）
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/server ./server
COPY --from=build /app/shared ./shared
COPY package.json pnpm-workspace.yaml ./

# 你的 server start script 會被呼叫
EXPOSE 3000
CMD ["pnpm", "--filter", "server", "start"]
