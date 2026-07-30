FROM mcr.microsoft.com/playwright:v1.51.0-noble AS builder

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/worker/ ./apps/worker/
COPY prisma/ ./prisma/

RUN npm ci
RUN npm run build --workspace=@nirogi/contracts
RUN npm run build --workspace=@nirogi/domain
RUN npm run build --workspace=@nirogi/config
RUN npx prisma generate
RUN npm run build --workspace=@nirogi/worker

FROM mcr.microsoft.com/playwright:v1.51.0-noble AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/worker ./apps/worker
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma ./apps/worker/prisma

WORKDIR /app/apps/worker

CMD ["node", "dist/worker.js"]
