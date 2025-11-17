# ⏱️ Timelapse Creator

Transform camera streams, uploaded photos, and MQTT-triggered captures into timelapse videos with a comprehensive web interface.

![alt text](./images/screenshot1.png)

## Features

### 📹 **Multiple Input Sources**
- **RTSP Streams** - Connect to any IP camera with RTSP protocol
- **USB Cameras** - Direct access to webcams and USB video devices
- **Capture Cards** - HDMI/SDI capture cards for professional video input
- **HTTP Streams** - MJPEG, HLS, and DASH streaming protocols
- **RTMP Streams** - Live streaming from RTMP sources
- **Screen Capture** - Desktop and application window recording
- **Photo Upload** - Drag-and-drop interface for uploading image collections
- **Network Import** - Import photos from network paths and shared folders
- **MQTT Triggers** - Capture photos from any source based on MQTT message transitions (1→0)

### 🎛️ **Advanced Management**
- **Database Integration** - SQLite database for session tracking and metadata storage
- **Session Management** - View, manage, and delete all capture sessions
- **Storage Quotas** - Configurable storage limits with automatic enforcement
- **Automatic Cleanup** - Scheduled cleanup of old sessions and orphaned files

### 🎬 **Timelapse Creation**
- **Flexible Scheduling** - Set custom intervals and optional auto-stop duration
- **Customizable Output** - Adjust timelapse FPS (1-60) and choose between MP4 or GIF format
- **Multiple Output Formats** - Generate timelapses as MP4 video or GIF animation
- **Real-time Preview** - View snapshots as they're captured via WebSocket
- **Video Export** - Download generated timelapses in your chosen format
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
   docker compose up -d --build
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
2. **Select video source type:**
   - RTSP Stream, USB Camera, Capture Card, HTTP Stream, RTMP Stream, or Screen Capture
3. **Configure source-specific settings** (device path, URL, etc.)
4. **Configure MQTT settings:**
   - **Broker URL**: `mqtt://broker.example.com:1883`
   - **Topic**: `sensor/trigger`
   - **Credentials** (optional): username and password
5. **Start MQTT capture** to listen for messages
6. **Photos are captured** from your selected source when message changes from '1' to '0'
7. **Perfect for motion sensors, door triggers, etc.**

### 🎥 **Frigate Integration**
The application integrates with [Frigate](https://frigate.video/) to automatically discover and use cameras configured in your Frigate instance.

1. **Prerequisites:**
   - Frigate must be running and accessible
   - Configure the `frigate_default` external network in `docker-compose.yml` (see Advanced Configuration)
   - Set `FRIGATE_API_URL` environment variable (defaults to `http://frigate:5000`)
   - Optionally set `FRIGATE_RTSP_HOST` if Frigate RTSP streams use a different host

2. **Using Frigate Cameras (Regular Capture):**
   - In the RTSP Stream Capture tab, expand the "Load from Frigate" section
   - Enter your Frigate API URL (or leave empty to use the default from environment)
   - Click "Load Cameras from Frigate" to fetch available cameras
   - Select a camera from the dropdown - the RTSP URL will be automatically populated
   - Configure capture settings and start capturing as normal

3. **Using Frigate Cameras (MQTT Trigger):**
   - In the MQTT Trigger tab, expand the "Load from Frigate" section
   - Load cameras as described above
   - Select a Frigate camera - it will be used as the video source for MQTT-triggered captures
   - Configure MQTT settings and start capture

4. **API Endpoint:**
   - `GET /api/frigate/cameras?apiUrl=<optional_url>` - Fetch cameras from Frigate API
   - Returns list of cameras with names, RTSP URLs, and configuration details

5. **RTSP URL Transformation:**
   - If `FRIGATE_RTSP_HOST` is set, RTSP URLs from Frigate will be transformed to use the specified host
   - Useful when Frigate runs in Docker and RTSP streams need to be accessed from the host network
   - Format: `host:port` or just `host` (e.g., `frigate:8554` or `192.168.1.100:8554`)

### 🎬 **Timelapse Generation**
1. **Choose your output format**:
   - **MP4**: Best for long timelapses, smaller file size, better quality, hardware accelerated (H.264 + NVENC)
   - **GIF**: Best for short loops, web sharing, social media, universal compatibility, no player needed
2. **Adjust FPS** to control playback speed (1-60 fps)
3. **Generate timelapse** once you have at least 2 snapshots
4. **Download your file** in the selected format (MP4 or GIF)
5. **Re-download from Sessions tab** - All generated files are preserved
6. **Manage sessions** in the Sessions tab

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
docker compose exec backend ffmpeg -rtsp_transport tcp -i "rtsp://your-url" -frames:v 1 test.jpg
```

### WebSocket Connection Issues

- Check if port 3002 is accessible
- Verify firewall settings
- Ensure backend container is running: `docker compose ps`
- Check browser console for errors

### Cannot Access from Other Devices

Update the frontend build args in `docker-compose.yml` with your server's IP address instead of `localhost`, then rebuild:
```bash
docker compose down
docker compose up -d --build
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
docker compose logs -f

# View backend logs only
docker compose logs -f backend

# Restart services
docker compose restart

# Stop services
docker compose down

# Rebuild and restart
docker compose up -d --build
```

## Architecture

- **Frontend**: React + TailwindCSS + WebSocket client (port 3000)
- **Backend**: Node.js + Express + FFmpeg + WebSocket server (ports 3001, 3002)
- **Database**: SQLite database for session tracking and metadata
- **Storage**: Docker volumes for snapshots, videos, and database
- **MQTT**: Real-time message handling for trigger-based captures
- **Scheduling**: Automated cleanup with node-cron

## Session Management

### 📊 **Sessions Tab**
- **View all sessions** with metadata (type, date, size, snapshot count)
- **Download timelapse videos** from any session with generated videos
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

### 🚀 **Hardware Acceleration (NVIDIA GPU)**
The application supports NVIDIA GPU hardware acceleration for both video decoding and encoding, significantly improving performance and reducing CPU usage.

**Features:**
- **CUDA Decoding** - Hardware-accelerated decoding for all video sources (RTSP, USB cameras, capture cards, HTTP/RTMP streams, screen capture)
- **NVENC Encoding** - Hardware-accelerated H.264 encoding for MP4 timelapse generation
- **Automatic Fallback** - Falls back to software encoding if GPU is unavailable

**Requirements:**
- NVIDIA GPU with CUDA support
- NVIDIA Docker runtime installed on the host system
- Docker Compose with GPU support configured

**Docker Configuration:**
The `docker-compose.yml` includes GPU configuration:
```yaml
deploy:
  resources:
    reservations:
      devices:
      - driver: nvidia
        count: 1
        capabilities: [gpu]
```

**Environment Variables:**
- `NVIDIA_VISIBLE_DEVICES=all` - Makes all NVIDIA GPUs visible to the container
- `NVIDIA_DRIVER_CAPABILITIES=compute,video,utility` - Enables compute, video encoding/decoding, and utility capabilities

**Device Access:**
- `/dev/dri` volume mount provides access to Direct Rendering Infrastructure for GPU acceleration

**Benefits:**
- Faster video processing and encoding
- Lower CPU usage, allowing more concurrent captures
- Better performance with high-resolution streams
- Reduced power consumption compared to software encoding

### 🔌 **Device Access Configuration**
The application requires direct access to hardware devices for USB cameras, capture cards, and GPU acceleration.

**USB Cameras and Capture Cards:**
- Device paths are mounted from the host: `/dev/video0`, `/dev/video1`, `/dev/video2`
- Add additional device paths in `docker-compose.yml` if you have more video devices
- The container runs in `privileged: true` mode to access these devices
- Required for V4L2 (Video4Linux2) device access

**GPU Access:**
- `/dev/dri` directory is mounted for Direct Rendering Infrastructure access
- Enables hardware acceleration for video processing
- Required for NVIDIA GPU acceleration (see Hardware Acceleration section)

**Privileged Mode:**
- The backend container runs with `privileged: true` to access hardware devices
- This is necessary for USB camera and capture card access
- If security is a concern, consider using specific device capabilities instead

**Example Configuration:**
```yaml
devices:
  - /dev/video0:/dev/video0
  - /dev/video1:/dev/video1
  - /dev/video2:/dev/video2
  - /dev/dri:/dev/dri  # GPU acceleration
privileged: true
```

**Troubleshooting:**
- If cameras aren't detected, verify device paths exist on the host: `ls -la /dev/video*`
- Check device permissions on the host system
- Ensure the user running Docker has access to video devices

### 🖥️ **Screen Capture Setup**
Screen capture functionality requires X11 access to capture the desktop or application windows.

**Requirements:**
- X11 display server running on the host
- X11 socket access from the container
- DISPLAY environment variable configured

**Docker Configuration:**
```yaml
volumes:
  - /tmp/.X11-unix:/tmp/.X11-unix:rw  # X11 socket access
environment:
  - DISPLAY=:0  # X11 display number
```

**X11 Socket Mount:**
- `/tmp/.X11-unix` is mounted to provide access to the X11 server
- Required for FFmpeg's `x11grab` input to capture screen content
- Must be mounted as read-write (`:rw`) for proper functionality

**DISPLAY Environment Variable:**
- `DISPLAY=:0` specifies the X11 display to capture (typically `:0` for the first display)
- Adjust if using a different display number
- Format: `:display_number.screen_number` (e.g., `:0.0`)

**Usage:**
- Select "Screen Capture" as the video source type
- Configure the display (defaults to `:0.0`)
- Optionally specify a region to capture (e.g., `1920x1080+0+0`)
- Start capture to begin recording the screen

**Platform Support:**
- Currently supported on Linux only
- Requires X11 (X Window System)
- Wayland is not currently supported

**Troubleshooting:**
- If screen capture fails, verify X11 is running: `echo $DISPLAY`
- Check X11 socket exists: `ls -la /tmp/.X11-unix/`
- Ensure X11 allows connections: `xhost +local:docker` (for testing only)
- Verify the display number matches your X11 setup

### 🌐 **Docker Network Configuration**
The application supports connecting to external Docker networks for integration with other services.

**Frigate Network Integration:**
- The `frigate_default` external network allows the backend to communicate with Frigate containers
- Required for Frigate camera discovery and RTSP stream access
- Must be created by Frigate's Docker Compose setup before starting this application

**Configuration:**
```yaml
networks:
  rtsp-network:
    driver: bridge
  frigate_default:
    external: true
```

**Setup Steps:**
1. Ensure Frigate is running and has created the `frigate_default` network
2. Verify the network exists: `docker network ls | grep frigate_default`
3. The backend service automatically connects to this network if configured
4. If Frigate uses a different network name, update `docker-compose.yml` accordingly

**Troubleshooting:**
- If Frigate cameras aren't accessible, verify the network exists: `docker network inspect frigate_default`
- Check that both containers are on the same network: `docker network inspect frigate_default | grep -A 5 Containers`
- Ensure the network name matches exactly (case-sensitive)

## API Endpoints

### 📡 **Core Capture**
- `POST /api/test-connection` - Test RTSP stream connectivity
- `POST /api/start-capture` - Start capture session (any source type)
- `POST /api/stop-capture` - Stop active capture session
- `POST /api/generate-timelapse` - Generate timelapse (MP4 or GIF) from snapshots
  - Parameters: `sessionId`, `fps`, `format` (mp4 or gif)

### 📸 **Photo Management**
- `POST /api/upload-photos` - Upload multiple photos with drag-and-drop
- `POST /api/import-from-path` - Import photos from network path
- `GET /api/session/:id` - Get session details and snapshots

### 📡 **MQTT Integration**
- `POST /api/start-mqtt-capture` - Start MQTT listener session
- `POST /api/stop-mqtt-capture` - Stop MQTT session
- `GET /api/mqtt-status/:id` - Get MQTT connection status

### 🎥 **Frigate Integration**
- `GET /api/frigate/cameras?apiUrl=<optional_url>` - Fetch cameras from Frigate API
  - Returns list of cameras with names, RTSP URLs, and configuration details
  - If `apiUrl` is not provided, uses `FRIGATE_API_URL` environment variable

### 🗄️ **Session Management**
- `GET /api/sessions` - List all sessions with metadata
- `DELETE /api/session/:id` - Delete session and all files
- `GET /api/storage-stats` - Get storage usage statistics

### 🧹 **Storage Management**
- `POST /api/cleanup/run` - Manual cleanup of old sessions
- `GET /api/cleanup/stats` - Get cleanup statistics
- `GET /api/storage/quotas` - Get storage quota settings
- `POST /api/storage/quotas` - Set storage quotas

### 📥 **Downloads**
- `GET /api/download/video/:sessionId` - Download timelapse (MP4 or GIF, auto-detects format)
- `GET /api/download/photo/:sessionId/:filename` - Download individual snapshot
- `GET /api/download/photos/:sessionId` - Download all snapshots as ZIP archive

## Environment Variables

### 🔧 **Optional Configuration**
```bash
# MQTT Default Settings (optional)
MQTT_BROKER_URL=mqtt://broker.example.com:1883
MQTT_PORT=1883
MQTT_USERNAME=your_username
MQTT_PASSWORD=your_password

# Frigate Integration (optional)
FRIGATE_API_URL=http://frigate:5000
FRIGATE_RTSP_HOST=frigate:8554

# Screen Capture (optional)
DISPLAY=:0

# NVIDIA GPU Acceleration (optional)
NVIDIA_VISIBLE_DEVICES=all
NVIDIA_DRIVER_CAPABILITIES=compute,video,utility

# Storage Quotas (optional)
MAX_TOTAL_STORAGE_MB=1024
MAX_SESSION_STORAGE_MB=100
DEFAULT_RETENTION_DAYS=7

# Photo Import Path (optional)
IMPORT_PARENT_PATH=/mnt/photo_import
```

**Variable Descriptions:**
- `MQTT_BROKER_URL` - MQTT broker URL (e.g., `mqtt://broker.example.com:1883`)
- `MQTT_PORT` - MQTT broker port (if not included in URL)
- `MQTT_USERNAME` - MQTT authentication username
- `MQTT_PASSWORD` - MQTT authentication password
- `FRIGATE_API_URL` - Frigate API endpoint (defaults to `http://frigate:5000`)
- `FRIGATE_RTSP_HOST` - Host for Frigate RTSP streams (e.g., `frigate:8554` or `192.168.1.100:8554`)
- `DISPLAY` - X11 display number for screen capture (defaults to `:0`)
- `NVIDIA_VISIBLE_DEVICES` - Which NVIDIA GPUs to make visible (defaults to `all`)
- `NVIDIA_DRIVER_CAPABILITIES` - GPU capabilities to enable (defaults to `compute,video,utility`)
- `IMPORT_PARENT_PATH` - Base path for photo imports (defaults to `/mnt/photo_import`)

## Roadmap

### ✅ **Completed Features**
- [x] **Database Integration** - SQLite database with session tracking
- [x] **Photo Upload** - Drag-and-drop interface with thumbnails
- [x] **Network Import** - Import from network paths
- [x] **MQTT Triggers** - Message-based photo capture from any video source
- [x] **Storage Management** - Quotas, cleanup, and session management
- [x] **Session Persistence** - All data survives restarts
- [x] **Universal Video Input** - USB cameras, capture cards, HTTP/RTMP streams, screen capture
- [x] **Multi-Source MQTT** - MQTT triggers work with all video source types
- [x] **Multiple Output Formats** - MP4 and GIF support for maximum compatibility

### 🚀 **Future Enhancements**
- [ ] **Additional Video Formats** - WebM, AVI support
- [ ] **Multi-Camera Support** - Simultaneous capture from multiple sources
- [ ] **Scheduled Captures** - Cron-like scheduling for automated timelapses
- [ ] **Cloud Storage** - S3, Google Cloud Storage integration
- [ ] **Video Quality Options** - Advanced encoding settings
- [ ] **User Authentication** - Multi-user support with accounts

## Dependencies

This project relies on the following open source software:

### Backend
- [Express](https://expressjs.com/) - MIT License
- [FFmpeg](https://ffmpeg.org/) - GPL/LGPL
- [Fluent-FFmpeg](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg) - MIT License
- [Sharp](https://sharp.pixelplumbing.com/) - Apache 2.0 License
- [Better-SQLite3](https://github.com/WiseLibs/better-sqlite3) - MIT License
- [MQTT.js](https://github.com/mqttjs/MQTT.js) - MIT License
- [Node-cron](https://github.com/node-cron/node-cron) - MIT License
- [Archiver](https://github.com/archiverjs/node-archiver) - MIT License
- [Multer](https://github.com/expressjs/multer) - MIT License
- [UUID](https://github.com/uuidjs/uuid) - MIT License
- [WS](https://github.com/websockets/ws) - MIT License
- [CORS](https://github.com/expressjs/cors) - MIT License

### Frontend
- [React](https://reactjs.org/) - MIT License
- [Tailwind CSS](https://tailwindcss.com/) - MIT License
- [Lucide React](https://lucide.dev/) - ISC License
- [Web Vitals](https://github.com/GoogleChrome/web-vitals) - Apache 2.0 License
- [UUID](https://github.com/uuidjs/uuid) - MIT License

### Infrastructure
- [Docker](https://www.docker.com/) - Apache 2.0 License
- [Node.js](https://nodejs.org/) - MIT License
- [Nginx](https://nginx.org/) - BSD License

For full license texts, see the respective project repositories.

## License

MIT License - see LICENSE file for details.
