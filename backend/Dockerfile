FROM node:18-slim

# Install FFmpeg and required dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies and rebuild native modules
RUN npm install --production && \
    npm rebuild better-sqlite3 sharp

# Copy application files
COPY . .

# Create directories for snapshots and videos
RUN mkdir -p snapshots videos

# Expose ports
EXPOSE 3001 3002

# Start the server
CMD ["node", "server.js"]