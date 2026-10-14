# syntax=docker/dockerfile:1
# Contexto de build: la RAÍZ del repo (monorepo con workspaces):  docker build -f apps/bff/Dockerfile .

FROM node:24-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/bff/package.json apps/bff/
RUN npm ci -w apps/bff -w packages/contracts
COPY packages/contracts packages/contracts
COPY apps/bff apps/bff
RUN npm run build -w apps/bff

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/bff/package.json apps/bff/
RUN npm ci --omit=dev -w apps/bff -w packages/contracts && npm cache clean --force
COPY --from=build /repo/apps/bff/dist apps/bff/dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/bff/dist/main.js"]
