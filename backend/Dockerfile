# Multi-stage production build for SafeGuard SOS Backend
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Production runtime stage
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Install production-only dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built application and schema
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/db/schema.sql ./dist/db/schema.sql

EXPOSE 4000

CMD ["node", "dist/server.js"]
