# RTSP Timelapse Creator

Transform RTSP camera streams into timelapse videos with a simple web interface.

## Features

- 📹 **RTSP Stream Support** - Connect to any IP camera with RTSP protocol
- ✅ **Connection Testing** - Verify stream accessibility before capturing
- ⏱️ **Flexible Scheduling** - Set custom intervals and optional auto-stop duration
- 🎬 **Customizable Output** - Adjust timelapse FPS (1-60)
- 📡 **Real-time Preview** - View snapshots as they're captured via WebSocket
- 💾 **Video Export** - Download generated timelapses as MP4 files

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
         - REACT_APP_API_URL=http://YOUR_HOSTNAME:3017
         - REACT_APP_WS_URL=ws://YOUR_HOSTNAME:3018
   ```

3. **Start the application:**
   ```bash
   docker-compose up -d --build
   ```

4. **Access the web interface:**
   ```
   http://YOUR_HOSTNAME:3011
   ```

### Ports

- `3011` - Frontend web interface
- `3017` - Backend API
- `3018` - WebSocket server

## Usage

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

5. **Generate timelapse** once you have at least 2 snapshots

6. **Download your video** as MP4

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

- Check if port 3018 is accessible
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

- **Frontend**: React + TailwindCSS + WebSocket client (port 3011)
- **Backend**: Node.js + Express + FFmpeg + WebSocket server (ports 3017, 3018)
- **Storage**: Docker volumes for snapshots and videos

## Roadmap

### Database & Storage Management
- [ ] **Database Integration** - SQLite/PostgreSQL for session tracking and metadata storage
- [ ] **Automatic Cleanup** - Configurable retention policies for snapshots and videos
- [ ] **Storage Quota Management** - Set and enforce storage limits per session/user
- [ ] **File Organization** - Improved directory structure and naming conventions
- [ ] **Orphaned File Detection** - Identify and clean up unused snapshot/video files

### Additional Features
- [ ] **Multi-Camera Support** - Capture timelapses from multiple streams simultaneously
- [ ] **User Authentication** - Session management and user accounts
- [ ] **Scheduled Captures** - Cron-like scheduling for automated timelapse creation
- [ ] **Cloud Storage Integration** - Support for S3, Google Cloud Storage, etc.
- [ ] **Video Quality Options** - Customizable compression and resolution settings
- [ ] **Email Notifications** - Alerts when timelapse generation completes
- [ ] **Snapshot Gallery** - Browse and manage captured snapshots before creating video

## License

MIT License - see LICENSE file for details.
