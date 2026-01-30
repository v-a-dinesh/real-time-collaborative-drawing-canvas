# ========================================
# Collaborative Canvas - Production Dockerfile
# Multi-stage build for optimized image size
# ========================================

# Stage 1: Build client
FROM node:20-alpine AS client-builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./
COPY vite.config.ts ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source files
COPY client/ ./client/
COPY shared/ ./shared/

# Build client
RUN npm run build:client

# Stage 2: Build server
FROM node:20-alpine AS server-builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# Install all dependencies
RUN npm ci

# Copy source files
COPY server/ ./server/
COPY shared/ ./shared/

# Build server
RUN npm run build:server

# Stage 3: Production image
FROM node:20-alpine AS production

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# Copy built assets from previous stages
COPY --from=client-builder /app/dist ./dist
COPY --from=server-builder /app/dist-server ./dist-server

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Change ownership to non-root user
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start production server (serves both client static files and WebSocket)
CMD ["node", "dist-server/production.js"]
