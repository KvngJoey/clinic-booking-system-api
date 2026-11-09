# Multi-stage / Production Dockerfile for Clinic Booking System
FROM node:24-alpine

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./
COPY backend/package*.json ./backend/

# Install production dependencies
RUN cd backend && npm install --omit=dev

# Copy application source code
COPY . .

# Set environment defaults
ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/data

# Create persistent storage directory
RUN mkdir -p /data

# Expose port
EXPOSE 3000

# Mount persistent volume for JSON data persistence
VOLUME ["/data"]

# Start production server
CMD ["node", "backend/server.js"]

