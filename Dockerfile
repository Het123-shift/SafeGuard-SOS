# Multi-stage production Docker build for SafeGuard SOS Backend on Railway/Render
FROM node:22-alpine AS builder

WORKDIR /app/backend

# Copy backend package manifests and install
COPY backend/package*.json ./
RUN npm ci

# Copy backend source code and build
COPY backend/ ./
RUN npm run build

# Production runtime stage
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Install production dependencies
COPY backend/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled files and schema
COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/src/db/schema.sql ./dist/db/schema.sql

EXPOSE 4000

CMD ["node", "dist/server.js"]
