const express = require('express');
const cors = require('cors');
const ffmpeg = require('fluent-ffmpeg');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;
const WS_PORT = process.env.WS_PORT || 3002;

app.use(cors());
app.use(express.json());
app.use('/snapshots', express.static('snapshots'));
app.use('/videos', express.static('videos'));

const snapshotsDir = path.join(__dirname, 'snapshots');
const videosDir = path.join(__dirname, 'videos');
if (!fs.existsSync(snapshotsDir)) fs.mkdirSync(snapshotsDir, { recursive: true });
if (!fs.existsSync(videosDir)) fs.mkdirSync(videosDir, { recursive: true });

const captureSessions = new Map();

const wss = new WebSocket.Server({ port: WS_PORT });

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  ws.on('close', () => console.log('WebSocket client disconnected'));
});

function broadcast(data) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

function buildRTSPUrl(url, username, password, port) {
  let rtspUrl = url;
  if (username && password) {
    rtspUrl = rtspUrl.replace('rtsp://', `rtsp://${username}:${password}@`);
  }
  if (port && port !== '554') {
    const urlParts = rtspUrl.split('://');
    const protocol = urlParts[0];
    const rest = urlParts[1];
    const authPart = rest.includes('@') ? rest.split('@')[0] + '@' : '';
    const hostPath = rest.includes('@') ? rest.split('@')[1] : rest;
    const hostParts = hostPath.split('/');
    const host = hostParts[0].split(':')[0];
    const pathPart = hostParts.slice(1).join('/');
    rtspUrl = `${protocol}://${authPart}${host}:${port}/${pathPart}`;
  }
  return rtspUrl;
}

app.post('/api/test-connection', async (req, res) => {
  const { url, username, password, port } = req.body;
  const rtspUrl = buildRTSPUrl(url, username, password, port);
  const testFile = path.join(snapshotsDir, `test-${Date.now()}.jpg`);

  ffmpeg(rtspUrl)
    .outputOptions(['-frames:v 1', '-q:v 2', '-rtsp_transport tcp'])
    .output(testFile)
    .on('end', () => {
      if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
      res.json({ success: true, message: 'Connection successful' });
    })
    .on('error', (err) => {
      res.status(400).json({ success: false, message: err.message });
    })
    .run();
});

app.post('/api/start-capture', (req, res) => {
  const { url, username, password, port, interval, duration, useTimer } = req.body;
  const sessionId = uuidv4();
  const rtspUrl = buildRTSPUrl(url, username, password, port);
  const sessionDir = path.join(snapshotsDir, sessionId);
  
  fs.mkdirSync(sessionDir, { recursive: true });

  const session = {
    id: sessionId,
    rtspUrl,
    interval: parseInt(interval),
    duration: useTimer ? parseInt(duration) : null,
    snapshots: [],
    active: true,
    startTime: Date.now()
  };

  captureSessions.set(sessionId, session);
  captureSnapshot(session);
  res.json({ success: true, sessionId });
});

function captureSnapshot(session) {
  if (!session.active) return;

  const sessionDir = path.join(snapshotsDir, session.id);
  const snapshotFile = path.join(sessionDir, `snapshot-${Date.now()}.jpg`);

  ffmpeg(session.rtspUrl)
    .outputOptions(['-frames:v 1', '-q:v 2', '-rtsp_transport tcp'])
    .output(snapshotFile)
    .on('end', () => {
      const relativePath = `/snapshots/${session.id}/${path.basename(snapshotFile)}`;
      session.snapshots.push({
        path: relativePath,
        timestamp: Date.now()
      });

      broadcast({
        type: 'snapshot',
        sessionId: session.id,
        snapshot: relativePath,
        count: session.snapshots.length
      });

      if (session.duration) {
        const elapsed = (Date.now() - session.startTime) / 1000;
        if (elapsed >= session.duration) {
          session.active = false;
          broadcast({ type: 'capture-complete', sessionId: session.id });
          return;
        }
      }

      if (session.active) {
        setTimeout(() => captureSnapshot(session), session.interval * 1000);
      }
    })
    .on('error', (err) => {
      console.error('Error capturing snapshot:', err);
      broadcast({
        type: 'error',
        sessionId: session.id,
        message: err.message
      });
    })
    .run();
}

app.post('/api/stop-capture', (req, res) => {
  const { sessionId } = req.body;
  const session = captureSessions.get(sessionId);

  if (session) {
    session.active = false;
    res.json({ success: true, snapshots: session.snapshots });
  } else {
    res.status(404).json({ success: false, message: 'Session not found' });
  }
});

app.get('/api/session/:sessionId', (req, res) => {
  const session = captureSessions.get(req.params.sessionId);
  
  if (session) {
    res.json({
      success: true,
      session: {
        id: session.id,
        snapshots: session.snapshots,
        active: session.active
      }
    });
  } else {
    res.status(404).json({ success: false, message: 'Session not found' });
  }
});

app.post('/api/generate-timelapse', (req, res) => {
  const { sessionId, fps } = req.body;
  const session = captureSessions.get(sessionId);

  if (!session || session.snapshots.length < 2) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid session or insufficient snapshots' 
    });
  }

  const outputFile = path.join(videosDir, `timelapse-${sessionId}.mp4`);
  const sessionDir = path.join(snapshotsDir, sessionId);
  const fileListPath = path.join(sessionDir, 'filelist.txt');
  
  const fileList = session.snapshots
    .map(s => `file '${path.join(__dirname, s.path.replace(/^\//, ''))}'`)
    .join('\n');
  
  fs.writeFileSync(fileListPath, fileList);

  ffmpeg()
    .input(fileListPath)
    .inputOptions(['-f concat', '-safe 0', '-r', fps.toString()])
    .outputOptions([
      '-c:v libx264',
      '-pix_fmt yuv420p',
      '-preset medium',
      '-crf 23'
    ])
    .output(outputFile)
    .on('end', () => {
      if (fs.existsSync(fileListPath)) fs.unlinkSync(fileListPath);
      const videoUrl = `/videos/timelapse-${sessionId}.mp4`;
      
      broadcast({
        type: 'timelapse-ready',
        sessionId: sessionId,
        videoUrl: videoUrl
      });

      res.json({ success: true, videoUrl: videoUrl });
    })
    .on('error', (err) => {
      console.error('Error generating timelapse:', err);
      res.status(500).json({ success: false, message: err.message });
    })
    .run();
});

app.delete('/api/session/:sessionId', (req, res) => {
  const sessionId = req.params.sessionId;
  const session = captureSessions.get(sessionId);

  if (session) {
    session.active = false;
    const sessionDir = path.join(snapshotsDir, sessionId);
    
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }

    captureSessions.delete(sessionId);
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, message: 'Session not found' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  console.log(`WebSocket server running on ws://0.0.0.0:${WS_PORT}`);
});