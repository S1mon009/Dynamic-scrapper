# syntax=docker/dockerfile:1
#
# Two runtime targets, built with: docker build --target <name> .
#
#   runtime-slim (default)  ~180-220MB  static engine only (fetch + jsdom)
#   runtime-full             ~1.5-2GB   adds Chromium, for --engine dynamic
#
# The size gap is inherent to bundling a real browser, not something a
# smarter Dockerfile can shrink away — pick runtime-slim unless you actually
# need JS-rendered (SPA) pages, and use runtime-full only for that.

##################################################################
# 1) deps — install every dependency (dev included), for the build step
##################################################################
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

##################################################################
# 2) build — compile TypeScript, then prune devDependencies away
##################################################################
FROM deps AS build
WORKDIR /app
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build \
    && npm prune --omit=dev --no-audit --no-fund

##################################################################
# 3) runtime-slim — small image, static engine only
##################################################################
FROM node:20-slim AS runtime-slim
WORKDIR /app
ENV NODE_ENV=production
RUN groupadd --system scraper && useradd --system --gid scraper --create-home scraper \
    && mkdir -p /app/downloads && chown -R scraper:scraper /app
COPY --from=build --chown=scraper:scraper /app/node_modules ./node_modules
COPY --from=build --chown=scraper:scraper /app/dist ./dist
COPY --chown=scraper:scraper bin ./bin
COPY --chown=scraper:scraper package.json ./
USER scraper
VOLUME ["/app/downloads"]
ENTRYPOINT ["node", "bin/scraper.js"]
CMD ["--help"]

##################################################################
# 4) runtime-full — adds a matching Chromium build, for engine: dynamic
#    Keep this tag's Playwright version in step with package.json's
#    "playwright" dependency — the browser build and the npm package
#    version must match.
##################################################################
FROM mcr.microsoft.com/playwright:v1.47.2-jammy AS runtime-full
WORKDIR /app
ENV NODE_ENV=production
RUN mkdir -p /app/downloads && chown -R pwuser:pwuser /app
COPY --from=build --chown=pwuser:pwuser /app/node_modules ./node_modules
COPY --from=build --chown=pwuser:pwuser /app/dist ./dist
COPY --chown=pwuser:pwuser bin ./bin
COPY --chown=pwuser:pwuser package.json ./
USER pwuser
VOLUME ["/app/downloads"]
ENTRYPOINT ["node", "bin/scraper.js"]
CMD ["--help"]
