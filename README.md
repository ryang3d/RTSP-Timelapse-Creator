# RTSP Timelapse Creator

Transform camera streams, uploaded photos, and MQTT-triggered captures into timelapse videos with a comprehensive web interface.

## Features

### 📹 **Multiple Input Sources**
- **RTSP Streams** - Connect to any IP camera with RTSP protocol
- **Photo Upload** - Drag-and-drop interface for uploading image collections
- **Network Import** - Import photos from network paths and shared folders
- **MQTT Triggers** - Capture photos based on MQTT message transitions (1→0)

### 🎛️ **Advanced Management**
- **Database Integration** - SQLite database for session tracking and metadata storage
- **Session Management** - View, manage, and delete all capture sessions
- **Storage Quotas** - Configurable storage limits with automatic enforcement
- **Automatic Cleanup** - Scheduled cleanup of old sessions and orphaned files

### 🎬 **Timelapse Creation**
- **Flexible Scheduling** - Set custom intervals and optional auto-stop duration
- **Customizable Output** - Adjust timelapse FPS (1-60)
- **Real-time Preview** - View snapshots as they're captured via WebSocket
- **Video Export** - Download generated timelapses as MP4 files
- **Thumbnail Generation** - Automatic thumbnail creation for photo galleries

## Quick Start

### Prerequisites

- Docker (20.10+)
- Docker Compose (1.29+)

### Deployment

1. **Clone and navigate to the project:**
   ```bash
   git clone https://git.rg3d.me/rg3d/RTSP-Timelapse-Creator
   cd RTSP-Timelapse-Creator
   ```

2. **Configure the hostname:**
   
   Edit `docker-compose.yml` and update the frontend build args to match your server's hostname or IP:
   ```yaml
   frontend:
     build:
       args:
         - REACT_APP_API_URL=http://YOUR_HOSTNAME:3001
         - REACT_APP_WS_URL=ws://YOUR_HOSTNAME:3002
   ```

3. **Start the application:**
   ```bash
   docker-compose up -d --build
   ```

4. **Access the web interface:**
   ```
   http://YOUR_HOSTNAME:3000
   ```

### Ports

- `3000` - Frontend web interface
- `3001` - Backend API
- `3002` - WebSocket server

## Usage

The application provides multiple ways to create timelapses:

### 📹 **RTSP Stream Capture**
1. **Enter your RTSP URL** in the format:
   ```
   rtsp://[username:password@]host[:port]/path
   ```
   Example: `rtsp://admin:password@192.168.1.100:554/stream1`

2. **Test the connection** to verify the stream is accessible

3. **Configure capture settings:**
   - **Snapshot Interval** - How often to capture frames (seconds)
   - **Timer Mode** (optional) - Auto-stop after specified duration
   - **Timelapse FPS** - Playback speed of final video (1-60)

4. **Start capturing** and watch snapshots appear in real-time

### 📸 **Photo Upload**
1. **Switch to "Upload Photos" tab**
2. **Drag and drop** your image files or click to select
3. **Supported formats**: JPEG, PNG, GIF (max 10MB each)
4. **Preview uploaded images** in the gallery
5. **Generate timelapse** from your photo collection

### 📁 **Network Import**
1. **Switch to "Import from Path" tab**
2. **Enter network path** to directory containing images
   - Example: `/path/to/photos` or `\\server\share\photos`
3. **Click "Import Photos"** to copy and process images
4. **Generate timelapse** from imported photos

### 📡 **MQTT Trigger**
1. **Switch to "MQTT Trigger" tab**
2. **Configure MQTT settings:**
   - **Broker URL**: `mqtt://broker.example.com:1883`
   - **Topic**: `sensor/trigger`
   - **Credentials** (optional): username and password
3. **Start MQTT capture** to listen for messages
4. **Photos are captured** when message changes from '1' to '0'
5. **Perfect for motion sensors, door triggers, etc.**

### 🎬 **Timelapse Generation**
1. **Generate timelapse** once you have at least 2 snapshots
2. **Download your video** as MP4
3. **Manage sessions** in the Sessions tab

## Example Settings

### Construction Site (8-hour workday)
- Interval: 300 seconds (5 minutes)
- Duration: 28800 seconds (8 hours)
- FPS: 30
- Result: 8 hours compressed into ~3 minutes

### Plant Growth (1 week)
- Interval: 3600 seconds (1 hour)
- Duration: 604800 seconds (7 days)
- FPS: 24
- Result: 1 week compressed into ~7 seconds

## Troubleshooting

### Connection Test Fails

- Verify RTSP URL format is correct
- Check username/password if authentication is required
- Ensure camera is accessible on the network
- Try explicitly adding port (e.g., `:554`)
- Verify camera allows multiple connections

Test manually:
```bash
docker-compose exec backend ffmpeg -rtsp_transport tcp -i "rtsp://your-url" -frames:v 1 test.jpg
```

### WebSocket Connection Issues

- Check if port 3002 is accessible
- Verify firewall settings
- Ensure backend container is running: `docker-compose ps`
- Check browser console for errors

### Cannot Access from Other Devices

Update the frontend build args in `docker-compose.yml` with your server's IP address instead of `localhost`, then rebuild:
```bash
docker-compose down
docker-compose up -d --build
```

### Out of Memory During Video Generation

- Reduce FPS or number of snapshots
- Increase Docker memory limit in Docker Desktop settings
- Add memory limits to docker-compose.yml:
  ```yaml
  backend:
    deploy:
      resources:
        limits:
          memory: 4G
  ```

## Docker Commands

```bash
# View logs
docker-compose logs -f

# View backend logs only
docker-compose logs -f backend

# Restart services
docker-compose restart

# Stop services
docker-compose down

# Rebuild and restart
docker-compose up -d --build
```

## Architecture

- **Frontend**: React + TailwindCSS + WebSocket client (port 3000)
- **Backend**: Node.js + Express + FFmpeg + WebSocket server (ports 3001, 3002)
- **Database**: SQLite with PostgreSQL migration path
- **Storage**: Docker volumes for snapshots, videos, and database
- **MQTT**: Real-time message handling for trigger-based captures
- **Scheduling**: Automated cleanup with node-cron

## Session Management

### 📊 **Sessions Tab**
- **View all sessions** with metadata (type, date, size, snapshot count)
- **Delete individual sessions** or run bulk cleanup
- **Storage statistics** showing total usage and quotas
- **Manual cleanup** to remove old sessions and orphaned files

### 🗄️ **Database Features**
- **Persistent storage** - All sessions survive server restarts
- **Metadata tracking** - File sizes, dimensions, timestamps
- **Storage quotas** - Configurable limits per session and total
- **Automatic cleanup** - Hourly cleanup of old sessions (7-day default)

## Advanced Configuration

### 🗂️ **Storage Management**
- **Retention policies** - Configurable cleanup intervals
- **Storage quotas** - Prevent disk space issues
- **Orphaned file detection** - Clean up unused files
- **Session metadata** - Track all capture details

### 📡 **MQTT Integration**
- **Broker connection** - Support for any MQTT broker
- **Authentication** - Username/password support
- **Trigger patterns** - Customizable message-based capture
- **Real-time status** - Connection and message monitoring

## API Endpoints

### 📡 **Core Capture**
- `POST /api/test-connection` - Test RTSP stream connectivity
- `POST /api/start-capture` - Start RTSP capture session
- `POST /api/stop-capture` - Stop active capture session
- `POST /api/generate-timelapse` - Generate video from snapshots

### 📸 **Photo Management**
- `POST /api/upload-photos` - Upload multiple photos with drag-and-drop
- `POST /api/import-from-path` - Import photos from network path
- `GET /api/session/:id` - Get session details and snapshots

### 📡 **MQTT Integration**
- `POST /api/start-mqtt-capture` - Start MQTT listener session
- `POST /api/stop-mqtt-capture` - Stop MQTT session
- `GET /api/mqtt-status/:id` - Get MQTT connection status

### 🗄️ **Session Management**
- `GET /api/sessions` - List all sessions with metadata
- `DELETE /api/session/:id` - Delete session and all files
- `GET /api/storage-stats` - Get storage usage statistics

### 🧹 **Storage Management**
- `POST /api/cleanup/run` - Manual cleanup of old sessions
- `GET /api/cleanup/stats` - Get cleanup statistics
- `GET /api/storage/quotas` - Get storage quota settings
- `POST /api/storage/quotas` - Set storage quotas

## Environment Variables

### 🔧 **Optional Configuration**
```bash
# MQTT Default Settings (optional)
MQTT_BROKER_URL=mqtt://broker.example.com:1883
MQTT_USERNAME=your_username
MQTT_PASSWORD=your_password

# Storage Quotas (optional)
MAX_TOTAL_STORAGE_MB=1024
MAX_SESSION_STORAGE_MB=100
DEFAULT_RETENTION_DAYS=7
```

## Roadmap

### ✅ **Completed Features**
- [x] **Database Integration** - SQLite database with session tracking
- [x] **Photo Upload** - Drag-and-drop interface with thumbnails
- [x] **Network Import** - Import from network paths
- [x] **MQTT Triggers** - Message-based photo capture
- [x] **Storage Management** - Quotas, cleanup, and session management
- [x] **Session Persistence** - All data survives restarts

### 🚀 **Future Enhancements**
- [ ] **Universal Video Input** - USB cameras, capture cards, HTTP streams
- [ ] **Multi-Camera Support** - Simultaneous capture from multiple sources
- [ ] **Scheduled Captures** - Cron-like scheduling for automated timelapses
- [ ] **Cloud Storage** - S3, Google Cloud Storage integration
- [ ] **Video Quality Options** - Advanced encoding settings
- [ ] **User Authentication** - Multi-user support with accounts

## License

MIT License - see LICENSE file for details.
