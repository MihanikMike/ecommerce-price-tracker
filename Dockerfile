# =============================================================================
# E-Commerce Price Tracker - Production Dockerfile
# =============================================================================
# Multi-stage build for optimal image size and security
# Uses Playwright with Firefox for web scraping
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Dependencies
# -----------------------------------------------------------------------------
FROM node:20-slim AS deps

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# -----------------------------------------------------------------------------
# Stage 2: Builder (for any build steps if needed)
# -----------------------------------------------------------------------------
FROM node:20-slim AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Remove dev files not needed in production
RUN rm -rf .git .env.example tests/ docs/ *.md

# -----------------------------------------------------------------------------
# Stage 3: Production Runtime
# -----------------------------------------------------------------------------
FROM mcr.microsoft.com/playwright:v1.57.0-noble AS runtime

# Set environment
ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

WORKDIR /app

# Create non-root user for security
RUN groupadd --gid 1001 nodejs && \
    useradd --uid 1001 --gid nodejs --shell /bin/bash --create-home appuser

# Copy application from builder
COPY --from=builder --chown=appuser:nodejs /app ./

# Copy data files needed at runtime
COPY --chown=appuser:nodejs data/ ./data/

# Install only Firefox (smaller than all browsers)
RUN npx playwright install firefox && \
    npx playwright install-deps firefox

# Create directories for exports and logs
RUN mkdir -p /app/exports /app/logs && \
    chown -R appuser:nodejs /app/exports /app/logs

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "fetch('http://localhost:3000/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Expose health check port
EXPOSE 3000

# Default command
CMD ["node", "src/index.js"]
