# 📹 RTSP Timelapse Creator

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Docker](https://img.shields.io/badge/docker-ready-brightgreen.svg)

**Transform your RTSP camera streams into stunning timelapse videos with just a few clicks.**

[Features](#-features) • [Quick Start](#-quick-start) • [Usage](#-usage) • [Documentation](#-documentation) • [Troubleshooting](#-troubleshooting)

</div>

---

## 🎯 Overview

RTSP Timelapse Creator is a full-stack web application that connects to your IP cameras via RTSP protocol and creates beautiful timelapse videos. Perfect for construction sites, weather monitoring, plant growth, or any long-term visual documentation.

### Why Use This?

- 🎥 **No Recording Required** - Captures snapshots directly, saving storage space
- ⏱️ **Flexible Scheduling** - Set custom intervals and durations
- 🔒 **Secure Authentication** - Supports RTSP username/password authentication
- 🎬 **Professional Output** - Generate high-quality MP4 timelapses
- 🚀 **Easy Deployment** - Docker-ready for quick setup
- 📡 **Real-time Updates** - See snapshots as they're captured via WebSocket

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **RTSP Stream Support** | Connect to any IP camera with RTSP protocol |
| **Authentication** | Username, password, and custom port configuration |
| **Connection Testing** | Verify stream accessibility before capturing |
| **Smart Capture Modes** | Timer-based automatic stop or manual control |
| **Customizable Intervals** | Set snapshot frequency from 1 second to hours |
| **Adjustable FPS** | Generate timelapses from 1-60 FPS |
| **Real-time Preview** | View snapshots as they're captured |
| **Snapshot Gallery** | Review all captured frames before generation |
| **Video Download** | Export timelapses as MP4 files |
| **Session Management** | Multiple capture sessions with cleanup |

---

## 🏗️ Architecture

```
┌─────────────┐      WebSocket      ┌─────────────┐
│   React     │◄──────────────────►│   Node.js   │
│  Frontend   │                     │   Backend   │
│             │       HTTP          │             │
│ (Port 3000) │◄──────────────────►│ (Port 3001) │
└─────────────┘                     └──────┬──────┘
                                           │
                                           │ FFmpeg
                                           │
                                    ┌──────▼──────┐
                                    │    RTSP     │
                                    │   Camera    │
                                    └─────────────┘
```

### Tech Stack

**Frontend:**
- React 18
- TailwindCSS
- Lucide Icons
- WebSocket Client

**Backend:**
- Node.js + Express
- FFmpeg (video processing)
- WebSocket Server
- File System Storage

**Deployment:**
- Docker
- Docker Compose
- Nginx (reverse proxy)

---

## 🚀 Quick Start

### Prerequisites

Before you begin, ensure you have:

- ✅ Docker (20.10+)
- ✅ Docker Compose (1.29+)
- ✅ An RTSP camera or test stream

### Installation

**1. Clone the repository:**

```bash
git clone https://github.com/yourusername/rtsp-timelapse.git
cd rtsp-timelapse
```

**2. Create the project structure:**

```bash
mkdir -p backend frontend/public frontend/src
```

**3. Copy all files to their respective directories** (see file structure below)

**4. Build and start the application:**

```bash
docker-compose up --build
```

**5. Open your browser:**

```
http://localhost:3000
```

That's it! 🎉

### Test with Sample Stream

Use this public RTSP test stream to try the application:

```
rtsp://wowzaec2demo.streamlock.net/vod/mp4:BigBuckBunny_115k.mp4
```

---

## 📁 Project Structure

```
rtsp-timelapse/
│
├── 📄 docker-compose.yml          # Docker orchestration
├── 📄 README.md                   # This file
├── 📄 .env.example                # Environment variables template
├── 📄 .gitignore                  # Git exclusions
│
├── 📂 backend/                    # Node.js Backend
│   ├── 📄 Dockerfile              # Backend container config
│   ├── 📄 package.json            # Node dependencies
│   ├── 📄 server.js               # Express server + FFmpeg logic
│   ├── 📂 snapshots/              # Captured images (auto-created)
│   └── 📂 videos/                 # Generated timelapses (auto-created)
│
└── 📂 frontend/                   # React Frontend
    ├── 📄 Dockerfile              # Frontend container config
    ├── 📄 nginx.conf              # Nginx configuration
    ├── 📄 package.json            # React dependencies
    ├── 📄 tailwind.config.js      # TailwindCSS config
    │
    ├── 📂 public/
    │   └── 📄 index.html          # HTML template
    │
    └── 📂 src/
        ├── 📄 index.js            # React entry point
        ├── 📄 index.css           # Global styles + Tailwind
        └── 📄 App.js              # Main application component
```

---

## 💡 Usage

### Step-by-Step Guide

#### 1. **Configure Your RTSP Stream**

<img src="https://via.placeholder.com/800x400/4A5568/FFFFFF?text=Configuration+Panel" alt="Configuration" width="600"/>

Fill in your camera details:

- **RTSP URL**: Your camera's stream URL (e.g., `rtsp://192.168.1.100/stream1`)
- **Username**: Camera username (if required)
- **Password**: Camera password (if required)
- **Port**: RTSP port (default: 554)

#### 2. **Test the Connection**

Click **"Test Connection"** to verify the stream is accessible:

- ✅ Green checkmark = Success
- ❌ Red X = Connection failed

#### 3. **Configure Capture Settings**

**Snapshot Interval:**
- How often to capture frames (1-3600 seconds)
- Example: 5 seconds = 720 frames per hour

**Timer Mode (Optional):**
- ☑️ Enable to auto-stop after a set duration
- Example: 60 seconds = captures for 1 minute

**Timelapse FPS:**
- Playback speed of final video (1-60 FPS)
- Example: 30 FPS = smooth, cinematic playback

#### 4. **Start Capturing**

Click **"Start Capture"** and watch the magic happen:

- Snapshots appear in real-time
- Counter shows total frames captured
- Latest snapshot displayed in preview

#### 5. **Generate Timelapse**

Once you have enough snapshots (minimum 2):

1. Click **"Stop Capture"** (if still running)
2. Click **"Generate Timelapse"**
3. Wait for processing (typically 5-30 seconds)
4. Preview plays automatically

#### 6. **Download Your Video**

Click **"Download Video"** to save your timelapse as MP4!

---

## 🎬 Usage Examples

### Construction Site Monitoring

```
Interval: 300 seconds (5 minutes)
Duration: 28800 seconds (8 hours)
FPS: 30
Result: 8-hour workday in ~3 minutes
```

### Plant Growth Timelapse

```
Interval: 3600 seconds (1 hour)
Duration: 604800 seconds (7 days)
FPS: 24
Result: 1 week in ~7 seconds
```

### Weather & Sky Monitoring

```
Interval: 60 seconds (1 minute)
Duration: 43200 seconds (12 hours)
FPS: 60
Result: 12 hours in ~12 seconds
```

### Traffic Monitoring

```
Interval: 10 seconds
Duration: 3600 seconds (1 hour)
FPS: 30
Result: 1 hour in ~12 seconds
```

---

## 🔧 Configuration

### Environment Variables

Create a `.env` file from `.env.example`:

```bash
cp .env.example .env
```

**Backend Variables:**

```env
PORT=3001                # Backend API port
WS_PORT=3002             # WebSocket port
NODE_ENV=production      # Environment mode
```

**Frontend Variables:**

```env
REACT_APP_API_URL=http://localhost:3001    # Backend API URL
REACT_APP_WS_URL=ws://localhost:3002       # WebSocket URL
```

### Docker Compose Options

**Development Mode** (with hot reload):

```yaml
services:
  backend:
    volumes:
      - ./backend:/app
      - /app/node_modules
    command: npm run dev
```

**Production Mode** (optimized):

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
    restart: always
```

---

## 🐳 Docker Commands

### Basic Commands

```bash
# Build containers
docker-compose build

# Start services
docker-compose up

# Start in background (detached mode)
docker-compose up -d

# View logs
docker-compose logs -f

# View logs for specific service
docker-compose logs -f backend

# Stop services
docker-compose down

# Stop and remove volumes (clears all data)
docker-compose down -v

# Restart services
docker-compose restart

# Rebuild and start
docker-compose up --build
```

### Advanced Commands

```bash
# Execute command in running container
docker-compose exec backend sh

# Check service status
docker-compose ps

# View resource usage
docker stats

# Prune unused Docker resources
docker system prune -a
```

---

## 🌐 API Reference

### Endpoints

#### **POST** `/api/test-connection`

Test RTSP stream connectivity.

**Request Body:**
```json
{
  "url": "rtsp://example.com/stream",
  "username": "admin",
  "password": "password",
  "port": "554"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Connection successful"
}
```

---

#### **POST** `/api/start-capture`

Start capturing snapshots from the stream.

**Request Body:**
```json
{
  "url": "rtsp://example.com/stream",
  "username": "admin",
  "password": "password",
  "port": "554",
  "interval": 5,
  "duration": 60,
  "useTimer": true
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

#### **POST** `/api/stop-capture`

Stop the current capture session.

**Request Body:**
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response:**
```json
{
  "success": true,
  "snapshots": [...]
}
```

---

#### **POST** `/api/generate-timelapse`

Generate timelapse video from captured snapshots.

**Request Body:**
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "fps": 30
}
```

**Response:**
```json
{
  "success": true,
  "videoUrl": "/videos/timelapse-550e8400.mp4"
}
```

---

#### **GET** `/api/session/:sessionId`

Get session information and snapshots.

**Response:**
```json
{
  "success": true,
  "session": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "snapshots": [...],
    "active": false
  }
}
```

---

#### **DELETE** `/api/session/:sessionId`

Delete a session and cleanup files.

**Response:**
```json
{
  "success": true
}
```

---

### WebSocket Events

The application uses WebSocket for real-time updates:

#### **snapshot**
```json
{
  "type": "snapshot",
  "sessionId": "550e8400-...",
  "snapshot": "/snapshots/550e8400/.../snapshot-1234567890.jpg",
  "count": 42
}
```

#### **capture-complete**
```json
{
  "type": "capture-complete",
  "sessionId": "550e8400-..."
}
```

#### **timelapse-ready**
```json
{
  "type": "timelapse-ready",
  "sessionId": "550e8400-...",
  "videoUrl": "/videos/timelapse-550e8400.mp4"
}
```

#### **error**
```json
{
  "type": "error",
  "sessionId": "550e8400-...",
  "message": "Connection timeout"
}
```

---

## 🔍 Troubleshooting

### Common Issues

#### ❌ Connection Test Fails

**Problem:** Red X appears when testing connection

**Solutions:**
1. Verify RTSP URL is correct
2. Check username/password if authentication is required
3. Ensure camera is accessible on the network
4. Try adding port explicitly (e.g., `:554`)
5. Check if camera allows multiple connections

```bash
# Test RTSP stream manually with FFmpeg
docker-compose exec backend ffmpeg -rtsp_transport tcp -i "rtsp://your-url" -frames:v 1 test.jpg
```

---

#### ❌ WebSocket Connection Failed

**Problem:** Real-time updates not working

**Solutions:**
1. Check if port 3002 is open
2. Verify firewall settings
3. Ensure backend container is running: `docker-compose ps`
4. Check browser console for errors

```bash
# Check if WebSocket port is listening
docker-compose exec backend netstat -tuln | grep 3002
```

---

#### ❌ FFmpeg Errors

**Problem:** "ffmpeg not found" or processing errors

**Solutions:**
1. Rebuild backend container: `docker-compose build backend`
2. Verify FFmpeg is installed: `docker-compose exec backend ffmpeg -version`
3. Check backend logs: `docker-compose logs backend`

---

#### ❌ Out of Memory

**Problem:** Container crashes during video generation

**Solutions:**
1. Increase Docker memory limit in Docker Desktop
2. Reduce FPS or number of snapshots
3. Add memory limits in `docker-compose.yml`:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 4G
```

---

#### ❌ Cannot Access from Other Devices

**Problem:** Application only works on localhost

**Solutions:**
1. Find your machine's IP address:
   - Windows: `ipconfig`
   - Mac/Linux: `ifconfig` or `ip addr`

2. Update `.env` file:
```env
REACT_APP_API_URL=http://YOUR_IP:3001
REACT_APP_WS_URL=ws://YOUR_IP:3002
```

3. Rebuild frontend: `docker-compose up --build frontend`

---

#### ❌ Snapshots Not Appearing

**Problem:** Capture starts but no snapshots show

**Solutions:**
1. Check backend logs: `docker-compose logs -f backend`
2. Verify stream is still active
3. Check disk space: `docker-compose exec backend df -h`
4. Restart capture with shorter interval

---

### Debug Mode

Enable detailed logging:

**Backend:**
```javascript
// In server.js, add at the top
process.env.DEBUG = 'ffmpeg:*';
```

**View all logs:**
```bash
docker-compose logs -f --tail=100
```

---

## 🚀 Production Deployment

### Security Considerations

1. **Use SSL/TLS** with a reverse proxy (nginx, Caddy, Traefik)
2. **Add authentication** to prevent unauthorized access
3. **Configure firewall** to restrict port access
4. **Use environment variables** for sensitive data
5. **Regular backups** of volumes

### Reverse Proxy Example (Nginx)

```nginx
server {
    listen 443 ssl http2;
    server_name timelapse.yourdomain.com;

    ssl_certificate /etc/ssl/certs/cert.pem;
    ssl_certificate_key /etc/ssl/private/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        proxy_pass http://localhost:3001;
    }

    location /ws {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
    }
}
```

### Resource Limits

Add to `docker-compose.yml`:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 512M
    restart: unless-stopped
```

### Monitoring

Use Docker stats or integrate with monitoring tools:

```bash
# Real-time resource monitoring
docker stats

# Export metrics (Prometheus compatible)
docker-compose exec backend curl http://localhost:3001/metrics
```

---

## 📚 Additional Resources

### RTSP Camera Setup Guides

- **Hikvision**: [Official RTSP Guide](https://www.hikvision.com)
- **Dahua**: [RTSP URL Format](https://www.dahuasecurity.com)
- **Axis**: [RTSP Configuration](https://www.axis.com)
- **Generic IP Cameras**: Usually `rtsp://IP:554/stream` or `rtsp://IP:554/h264`

### Useful Tools

- **RTSP Tester**: [VLC Media Player](https://www.videolan.org/vlc/)
- **Network Scanner**: [Angry IP Scanner](https://angryip.org/)
- **Docker Desktop**: [Download](https://www.docker.com/products/docker-desktop/)

### Learning Resources

- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [RTSP Protocol Specification](https://datatracker.ietf.org/doc/html/rfc2326)

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow existing code style
- Add comments for complex logic
- Test with real RTSP streams
- Update documentation as needed

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **FFmpeg** - The backbone of video processing
- **React** - Frontend framework
- **Express** - Backend framework
- **Docker** - Containerization platform
- **TailwindCSS** - Utility-first CSS framework

---

## 📮 Support

Having issues? Here's how to get help:

1. **Check the [Troubleshooting](#-troubleshooting) section**
2. **Search [existing issues](https://github.com/yourusername/rtsp-timelapse/issues)**
3. **Open a [new issue](https://github.com/yourusername/rtsp-timelapse/issues/new)** with:
   - Your Docker version
   - Error logs from `docker-compose logs`
   - Steps to reproduce
   - Expected vs actual behavior

---

## ⭐ Show Your Support

If this project helped you, please give it a ⭐️ on GitHub!

---

<div align="center">

**Made with ❤️ for the timelapse community**

[⬆ Back to Top](#-rtsp-timelapse-creator)

</div>