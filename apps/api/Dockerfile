FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/
COPY prisma/ ./prisma/

RUN npm ci
RUN npm run build --workspace=@nirogi/contracts
RUN npm run build --workspace=@nirogi/domain
RUN npm run build --workspace=@nirogi/config
RUN npx prisma generate
RUN npm run build --workspace=@nirogi/api

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV API_PORT=4000

COPY package.json package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api ./apps/api
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma ./apps/api/prisma

WORKDIR /app/apps/api

EXPOSE 4000

CMD ["node", "dist/server.js"]
