# =============================================================================
# pi-web Dockerfile
# Multi-stage build:deps → builder → runner
# 最终镜像只包含运行时所需文件,无构建工具,无源码
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1:deps — 安装依赖
# -----------------------------------------------------------------------------
FROM node:22.19.0-bookworm-slim AS deps

WORKDIR /app

# 先复制 lockfile 走 Docker 层缓存(只要 lockfile 不变,这一层复用)
COPY package.json package-lock.json* bun.lock* ./

# 优先用 npm(lockfile 一定存在);如果只有 bun.lock,装个 bun
RUN if [ -f package-lock.json ]; then \
      npm ci --no-audit --no-fund; \
    elif [ -f bun.lock ]; then \
      npm install -g bun && bun install --frozen-lockfile; \
    else \
      npm install --no-audit --no-fund; \
    fi

# -----------------------------------------------------------------------------
# Stage 2:builder — 构建 Next.js 生产产物
# -----------------------------------------------------------------------------
FROM node:22.19.0-bookworm-slim AS builder

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 构建(会用 webpack 模式,见 package.json scripts.build)
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 3:runner — 最小运行时镜像
# -----------------------------------------------------------------------------
FROM node:22.19.0-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=30141
ENV HOSTNAME=0.0.0.0
# 持久化目录(由 docker-compose 挂载)
ENV PI_CODING_AGENT_DIR=/data/agent
ENV HOME=/data

# 安装 wget(用于 healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
      wget \
      tini \
    && rm -rf /var/lib/apt/lists/*

# 复用 node 基础镜像自带的 node 用户(uid 1000, gid 1000),不再创建新用户
# (官方 node 镜像里已经预装了 node:x:1000:1000)
RUN mkdir -p /data/agent /app \
    && chown -R node:node /data /app

# 只复制运行时需要的文件
COPY --from=builder --chown=node:node /app/.next           ./.next
COPY --from=builder --chown=node:node /app/node_modules    ./node_modules
COPY --from=builder --chown=node:node /app/public           ./public
COPY --from=builder --chown=node:node /app/package.json     ./package.json
COPY --from=builder --chown=node:node /app/next.config.ts   ./next.config.ts

USER node

EXPOSE 30141

# tini 做 PID 1,正确转发信号(SIGTERM → Next.js 优雅退出)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:30141/ || exit 1

# 直接调 next 的 JS 入口(不走 bin/pi-web.js 包装,容器里不需要 xdg-open 弹浏览器)
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "30141", "-H", "0.0.0.0"]
