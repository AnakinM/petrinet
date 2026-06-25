# syntax=docker/dockerfile:1

# --- build stage: install deps + produce dist/ ---
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

# --- serve stage: pure-bun static server on :3000 ---
FROM oven/bun:1-slim AS serve
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY server.ts ./
EXPOSE 3000
CMD ["bun", "server.ts"]
