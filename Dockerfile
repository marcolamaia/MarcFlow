FROM node:26-alpine AS builder
ENV NEXT_TELEMETRY_DISABLED=1
ENV SCARF_ANALYTICS=false
RUN apk add --no-cache openssl ca-certificates
WORKDIR /app

# Dependency layer — cache-friendly: only rerun when package*.json changes
COPY package*.json ./
COPY patches ./patches/
COPY prisma ./prisma/
RUN npm ci --legacy-peer-deps && npm cache clean --force

# Source & build
COPY . .
RUN npx prisma generate && npm run build

# Startup needs the Prisma CLI, tsx and TypeScript from the locked installation.
# Keep that installation instead of pruning and reinstalling the dev dependencies.

# Production image
FROM node:26-alpine AS runner
ENV NEXT_TELEMETRY_DISABLED=1
ENV SCARF_ANALYTICS=false
RUN apk add --no-cache openssl ca-certificates ffmpeg
WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/src ./src
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/public ./public
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/scripts ./scripts

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push && if [ -n \"$ADMIN_EMAIL\" ] && [ -n \"$ADMIN_PASSWORD\" ]; then node scripts/setup-admin.js \"$ADMIN_EMAIL\" \"$ADMIN_PASSWORD\"; fi && exec node node_modules/tsx/dist/cli.mjs src/server/bootstrap.ts"]
