FROM node:18-alpine

# Install FFmpeg
RUN apk add --no-cache ffmpeg

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Create directories for snapshots and videos
RUN mkdir -p snapshots videos

# Expose ports
EXPOSE 3001 3002

# Start the server
CMD ["node", "server.js"]