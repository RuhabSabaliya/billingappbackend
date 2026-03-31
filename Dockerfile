# ---------------------------------------
# Stage 1: Build & Prisma Generation
# ---------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency graphs
COPY package.json package-lock.json* ./
COPY prisma ./prisma/

# Install dependencies (including devDependencies for Prisma generation)
RUN npm ci

# Copy full application code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# ---------------------------------------
# Stage 2: Production Shrink & Runner
# ---------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Install necessary runtime system packages if any (like Openssl for Prisma)
RUN apk add --no-cache openssl

# Don't run production as root
RUN addgroup -g 1001 nodejs && adduser -S -u 1001 expressjs

# Copy over package files
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json* ./

# Install ONLY production dependencies
RUN npm ci --omit=dev

# Copy generated Prisma client from builder
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy application source code
COPY --from=builder /app/src ./src

# Ensure logs directory exists with correct permissions
RUN mkdir logs && chown expressjs:nodejs logs

USER expressjs

EXPOSE 5000

# Start script
CMD ["node", "src/server.js"]
