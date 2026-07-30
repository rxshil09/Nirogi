FROM mcr.microsoft.com/playwright:v1.51.0-noble AS builder

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/worker/ ./apps/worker/
COPY prisma/ ./prisma/

RUN npm ci
RUN npm --workspace=@nirogi/contracts run build
RUN npm --workspace=@nirogi/domain run build
RUN npm --workspace=@nirogi/config run build
RUN npx prisma generate
RUN npm --workspace=@nirogi/worker run build

FROM mcr.microsoft.com/playwright:v1.51.0-noble AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY packages/ ./packages/
COPY apps/worker/package.json ./apps/worker/
COPY prisma/ ./prisma/

RUN npm ci --omit=dev
RUN npx prisma generate

COPY --from=builder /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=builder /app/packages/domain/dist ./packages/domain/dist
COPY --from=builder /app/packages/config/dist ./packages/config/dist
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist

CMD ["node", "apps/worker/dist/worker.js"]
