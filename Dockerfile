# =============================================================================
# YARDURA DOCKERFILE
# Multi-stage build for development and production
# =============================================================================

# =============================================================================
# BASE STAGE - Common dependencies
# =============================================================================
FROM node:20-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    libc6-compat \
    curl \
    postgresql-client \
    redis \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# =============================================================================
# DEPENDENCIES STAGE - Install all dependencies
# =============================================================================
FROM base AS deps

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# =============================================================================
# DEVELOPMENT STAGE - For local development
# =============================================================================
FROM base AS development

# Copy package files and install all dependencies (including dev)
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Change ownership of app directory
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Default command for development
CMD ["npm", "run", "dev"]

# =============================================================================
# BUILDER STAGE - For production builds
# =============================================================================
FROM base AS builder

# Copy package files and install all dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED 1
ENV NODE_ENV production

# Build the application
RUN npm run build

# =============================================================================
# PRODUCTION STAGE - Optimized for production
# =============================================================================
FROM base AS production

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/next-env.d.ts ./

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Change ownership and permissions
RUN chown -R nextjs:nodejs /app
RUN chmod -R 755 /app/.next

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Set environment variables for production
ENV NEXT_TELEMETRY_DISABLED 1
ENV NODE_ENV production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Start the application
CMD ["npm", "start"]

# =============================================================================
# WORKER STAGE - For background processing
# =============================================================================
FROM base AS worker

# Copy package files and install all dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Change ownership of app directory
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Set environment variables for worker
ENV NEXT_TELEMETRY_DISABLED 1
ENV NODE_ENV production

# Default command for worker (can be overridden)
CMD ["npm", "run", "worker"]


