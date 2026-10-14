# syntax=docker/dockerfile:1
# Contexto de build: la RAÍZ del repo (monorepo con workspaces):  docker build -f apps/web/Dockerfile .

FROM node:24-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/web/package.json apps/web/
RUN npm ci -w apps/web -w packages/contracts
COPY packages/contracts packages/contracts
COPY apps/web apps/web
RUN npm run build -w apps/web

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev -w apps/web -w packages/contracts && npm cache clean --force
COPY --from=build /repo/apps/web/dist apps/web/dist
USER node
ENV PORT=4000
EXPOSE 4000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD node -e "fetch('http://localhost:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/web/dist/web/server/server.mjs"]
