# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --chown=node:node . .
# One dependency/build layer also works on storage drivers that copy each layer.
# proxy_ca is optional, only for environments with a trusted enterprise CA.
RUN --mount=type=secret,id=proxy_ca --mount=type=tmpfs,target=/tmp/npm-cache \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    npm ci --cache /tmp/npm-cache --no-audit --no-fund && npm run build && \
    rm -rf .next/cache && chown -R node:node .next
USER node
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["npm","start"]
