# TippyMe Nuxt — production image (build from repo root)
#   docker build -t tippyme .
# Pin minor/alpine so Pxxl's image scan is reproducible across deploys.
FROM node:20.19.5-alpine3.22 AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Skip lifecycle scripts: postinstall runs `nuxt prepare`,
# which need the full source tree (not available in this layer).
RUN npm ci --ignore-scripts

FROM node:20.19.5-alpine3.22 AS build
WORKDIR /app
ARG NUXT_PUBLIC_APP_URL=https://example.com
ARG NUXT_PUBLIC_API_URL=
ENV NUXT_PUBLIC_APP_URL=$NUXT_PUBLIC_APP_URL
ENV NUXT_PUBLIC_API_URL=$NUXT_PUBLIC_API_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build \
  && npm prune --omit=dev

FROM node:20.19.5-alpine3.22 AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV NUXT_PUBLIC_API_URL=
RUN addgroup -S tippy && adduser -S tippy -G tippy
COPY --from=build --chown=tippy:tippy /app/package.json /app/package-lock.json ./
COPY --from=build --chown=tippy:tippy /app/node_modules ./node_modules
COPY --from=build --chown=tippy:tippy /app/.output ./.output
USER tippy
EXPOSE 3000
# Pxxl provides its own health checks; avoid extra tools/shell in the image.
CMD ["node", ".output/server/index.mjs"]
