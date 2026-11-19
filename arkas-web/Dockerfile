# Kemasan satu layanan NestJS dari monorepo pnpm.
#   docker build --build-arg LAYANAN=svc-penatausahaan -t arkas/svc-penatausahaan .
# Lihat Dockerfile.web untuk aplikasi Next.js.
ARG NODE_VERSION=22.12-alpine

# ---------- tahap bangun ----------
FROM node:${NODE_VERSION} AS bangun
ARG LAYANAN
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages ./packages
COPY apps/${LAYANAN} ./apps/${LAYANAN}
# --ignore-scripts: paket tidak boleh menjalankan skrip pasang saat membangun citra
RUN pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm --filter "./apps/${LAYANAN}..." build

# ---------- tahap jalan ----------
FROM node:${NODE_VERSION} AS jalan
ARG LAYANAN
ENV NODE_ENV=production
RUN corepack enable && addgroup -S arkas && adduser -S arkas -G arkas
WORKDIR /app
COPY --from=bangun --chown=arkas:arkas /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=bangun --chown=arkas:arkas /app/packages ./packages
COPY --from=bangun --chown=arkas:arkas /app/apps/${LAYANAN} ./apps/${LAYANAN}
RUN pnpm install --frozen-lockfile --prod --ignore-scripts && pnpm store prune
USER arkas
ENV LAYANAN=${LAYANAN}
WORKDIR /app/apps/${LAYANAN}
EXPOSE 3100
CMD ["node", "dist/main.js"]
