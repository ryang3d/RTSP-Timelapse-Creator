const express = require('express');
const cors = require('cors');
const ffmpeg = require('fluent-ffmpeg');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const sharp = require('sharp');
const mqtt = require('mqtt');
const cron = require('node-cron');
const DatabaseManager = require('./db');

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

// Initialize database
const db = new DatabaseManager();

// Keep track of active capture processes
const activeCaptures = new Map();

// MQTT client management
const mqttClients = new Map();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const sessionId = req.body.sessionId || uuidv4();
    const sessionDir = path.join(snapshotsDir, sessionId);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
    cb(null, sessionDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `upload-${timestamp}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, GIF) are allowed'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

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

app.post('/api/test-connection', async (req, res) => {
  const { url } = req.body;
  const testFile = path.join(snapshotsDir, `test-${Date.now()}.jpg`);

  let responseHandled = false;
  const timeout = setTimeout(() => {
    if (!responseHandled) {
      responseHandled = true;
      res.status(400).json({ success: false, message: 'Connection timeout - unable to reach RTSP stream' });
    }
  }, 15000); // 15 second timeout

  ffmpeg(url)
    .inputOptions([
      '-rtsp_transport', 'tcp',
      '-timeout', '5000000', // 5 second timeout in microseconds
      '-analyzeduration', '2000000',
      '-probesize', '2000000'
    ])
    .outputOptions(['-frames:v 1', '-q:v 2'])
    .output(testFile)
    .on('end', () => {
      clearTimeout(timeout);
      if (!responseHandled) {
        responseHandled = true;
        if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
        res.json({ success: true, message: 'Connection successful' });
      }
    })
    .on('error', (err) => {
      clearTimeout(timeout);
      if (!responseHandled) {
        responseHandled = true;
        console.error('Connection test error:', err.message);
        res.status(400).json({ success: false, message: err.message });
      }
    })
    .run();
});

app.post('/api/start-capture', (req, res) => {
  const { url, interval, duration, useTimer } = req.body;
  const sessionId = uuidv4();
  const sessionDir = path.join(snapshotsDir, sessionId);
  
  fs.mkdirSync(sessionDir, { recursive: true });

  // Create session in database
  const sessionData = {
    id: sessionId,
    source_type: 'rtsp',
    rtsp_url: url,
    interval_seconds: parseInt(interval),
    duration_seconds: useTimer ? parseInt(duration) : null,
    use_timer: useTimer
  };

  try {
    // Check storage quota before starting
    const quotaCheck = checkQuotaBeforeCapture(sessionId);
    if (!quotaCheck.success) {
      return res.status(400).json({ 
        success: false, 
        message: quotaCheck.message,
        quotaExceeded: true
      });
    }
    
    db.createSession(sessionData);
    
    // Start capture process
    const session = {
      id: sessionId,
      rtspUrl: url,
      interval: parseInt(interval),
      duration: useTimer ? parseInt(duration) : null,
      active: true,
      startTime: Date.now()
    };

    activeCaptures.set(sessionId, session);
    captureSnapshot(session);
    res.json({ success: true, sessionId });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ success: false, message: 'Failed to create session' });
  }
});

function captureSnapshot(session) {
  if (!session.active) return;

  const sessionDir = path.join(snapshotsDir, session.id);
  const snapshotFile = path.join(sessionDir, `snapshot-${Date.now()}.jpg`);

  ffmpeg(session.rtspUrl)
    .inputOptions([
      '-rtsp_transport', 'tcp',
      '-timeout', '5000000',
      '-analyzeduration', '2000000',
      '-probesize', '2000000'
    ])
    .outputOptions(['-frames:v 1', '-q:v 2'])
    .output(snapshotFile)
    .on('end', () => {
      const relativePath = `/snapshots/${session.id}/${path.basename(snapshotFile)}`;
      
      // Save snapshot to database
      try {
        const stats = fs.statSync(snapshotFile);
        db.addSnapshot(session.id, relativePath, {
          file_size: stats.size
        });
      } catch (error) {
        console.error('Error saving snapshot to database:', error);
      }

      // Get current snapshot count
      const snapshots = db.getSnapshots(session.id);
      
      broadcast({
        type: 'snapshot',
        sessionId: session.id,
        snapshot: relativePath,
        count: snapshots.length
      });

      if (session.duration) {
        const elapsed = (Date.now() - session.startTime) / 1000;
        if (elapsed >= session.duration) {
          session.active = false;
          db.updateSession(session.id, { active: 0, completed_at: new Date().toISOString() });
          activeCaptures.delete(session.id);
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
  const session = activeCaptures.get(sessionId);

  if (session) {
    session.active = false;
    activeCaptures.delete(sessionId);
    
    // Update database
    db.updateSession(sessionId, { active: 0, completed_at: new Date().toISOString() });
    
    // Get snapshots from database
    const snapshots = db.getSnapshots(sessionId);
    res.json({ success: true, snapshots: snapshots });
  } else {
    res.status(404).json({ success: false, message: 'Session not found' });
  }
});

app.get('/api/session/:sessionId', (req, res) => {
  const session = db.getSession(req.params.sessionId);
  
  if (session) {
    const snapshots = db.getSnapshots(req.params.sessionId);
    res.json({
      success: true,
      session: {
        id: session.id,
        snapshots: snapshots,
        active: session.active
      }
    });
  } else {
    res.status(404).json({ success: false, message: 'Session not found' });
  }
});

app.post('/api/generate-timelapse', (req, res) => {
  const { sessionId, fps } = req.body;
  const session = db.getSession(sessionId);
  const snapshots = db.getSnapshots(sessionId);

  if (!session || snapshots.length < 2) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid session or insufficient snapshots' 
    });
  }

  const outputFile = path.join(videosDir, `timelapse-${sessionId}.mp4`);
  const sessionDir = path.join(snapshotsDir, sessionId);
  const fileListPath = path.join(sessionDir, 'filelist.txt');
  
  const fileList = snapshots
    .map(s => `file '${path.join(__dirname, s.file_path.replace(/^\//, ''))}'`)
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
      
      // Save video to database
      try {
        const stats = fs.statSync(outputFile);
        db.addVideo(sessionId, videoUrl, parseInt(fps), {
          file_size: stats.size
        });
      } catch (error) {
        console.error('Error saving video to database:', error);
      }
      
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
  const session = db.getSession(sessionId);

  if (session) {
    // Stop active capture if running
    const activeSession = activeCaptures.get(sessionId);
    if (activeSession) {
      activeSession.active = false;
      activeCaptures.delete(sessionId);
    }
    
    // Delete files
    const sessionDir = path.join(snapshotsDir, sessionId);
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }
    
    const videoFile = path.join(videosDir, `timelapse-${sessionId}.mp4`);
    if (fs.existsSync(videoFile)) {
      fs.unlinkSync(videoFile);
    }

    // Delete from database (cascades to snapshots and videos)
    db.deleteSession(sessionId);
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, message: 'Session not found' });
  }
});

// New API endpoints for session management
app.get('/api/sessions', (req, res) => {
  const { limit = 50, offset = 0 } = req.query;
  const sessions = db.getAllSessions(parseInt(limit), parseInt(offset));
  res.json({ success: true, sessions });
});

app.get('/api/storage-stats', (req, res) => {
  const stats = db.getStorageStats();
  res.json({ success: true, stats });
});

// Photo upload endpoints
app.post('/api/upload-photos', upload.array('photos', 50), async (req, res) => {
  try {
    const { sessionId } = req.body;
    const files = req.files;
    
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }

    // Create session if it doesn't exist
    let session = db.getSession(sessionId);
    if (!session) {
      const sessionData = {
        id: sessionId,
        source_type: 'upload',
        interval_seconds: 1, // Not used for uploads
        use_timer: false
      };
      db.createSession(sessionData);
      session = db.getSession(sessionId);
    }

    const uploadedFiles = [];
    
    for (const file of files) {
      try {
        // Generate thumbnail
        const thumbnailPath = path.join(path.dirname(file.path), `thumb-${path.basename(file.path)}`);
        await sharp(file.path)
          .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toFile(thumbnailPath);

        // Get image metadata
        const metadata = await sharp(file.path).metadata();
        
        // Save to database
        const relativePath = `/snapshots/${sessionId}/${path.basename(file.path)}`;
        db.addSnapshot(sessionId, relativePath, {
          file_size: file.size,
          width: metadata.width,
          height: metadata.height
        });

        uploadedFiles.push({
          path: relativePath,
          thumbnail: `/snapshots/${sessionId}/thumb-${path.basename(file.path)}`,
          size: file.size,
          width: metadata.width,
          height: metadata.height
        });
      } catch (error) {
        console.error('Error processing file:', file.originalname, error);
      }
    }

    res.json({ 
      success: true, 
      sessionId,
      uploadedFiles,
      totalFiles: uploadedFiles.length
    });
  } catch (error) {
    console.error('Error uploading photos:', error);
    res.status(500).json({ success: false, message: 'Upload failed' });
  }
});

app.post('/api/import-from-path', async (req, res) => {
  try {
    const { networkPath, sessionId } = req.body;
    
    if (!networkPath) {
      return res.status(400).json({ success: false, message: 'Network path required' });
    }

    // Validate path exists
    if (!fs.existsSync(networkPath)) {
      return res.status(400).json({ success: false, message: 'Path does not exist' });
    }

    // Create session if it doesn't exist
    let session = db.getSession(sessionId);
    if (!session) {
      const sessionData = {
        id: sessionId,
        source_type: 'import',
        interval_seconds: 1, // Not used for imports
        use_timer: false
      };
      db.createSession(sessionData);
      session = db.getSession(sessionId);
    }

    const sessionDir = path.join(snapshotsDir, sessionId);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    // Find image files
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff'];
    const files = fs.readdirSync(networkPath)
      .filter(file => imageExtensions.includes(path.extname(file).toLowerCase()))
      .sort(); // Sort for consistent ordering

    if (files.length === 0) {
      return res.status(400).json({ success: false, message: 'No image files found in path' });
    }

    const importedFiles = [];
    
    for (const file of files) {
      try {
        const sourcePath = path.join(networkPath, file);
        const destPath = path.join(sessionDir, `import-${Date.now()}-${file}`);
        
        // Copy file
        fs.copyFileSync(sourcePath, destPath);
        
        // Generate thumbnail
        const thumbnailPath = path.join(sessionDir, `thumb-import-${Date.now()}-${file}`);
        await sharp(destPath)
          .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toFile(thumbnailPath);

        // Get metadata
        const metadata = await sharp(destPath).metadata();
        const stats = fs.statSync(destPath);
        
        // Save to database
        const relativePath = `/snapshots/${sessionId}/${path.basename(destPath)}`;
        db.addSnapshot(sessionId, relativePath, {
          file_size: stats.size,
          width: metadata.width,
          height: metadata.height
        });

        importedFiles.push({
          path: relativePath,
          thumbnail: `/snapshots/${sessionId}/thumb-${path.basename(destPath)}`,
          size: stats.size,
          width: metadata.width,
          height: metadata.height,
          originalName: file
        });
      } catch (error) {
        console.error('Error importing file:', file, error);
      }
    }

    res.json({ 
      success: true, 
      sessionId,
      importedFiles,
      totalFiles: importedFiles.length
    });
  } catch (error) {
    console.error('Error importing from path:', error);
    res.status(500).json({ success: false, message: 'Import failed' });
  }
});

// MQTT endpoints
app.post('/api/start-mqtt-capture', async (req, res) => {
  try {
    const { brokerUrl, topic, username, password, sessionId } = req.body;
    
    if (!brokerUrl || !topic) {
      return res.status(400).json({ success: false, message: 'Broker URL and topic are required' });
    }

    // Create session in database
    const sessionData = {
      id: sessionId,
      source_type: 'mqtt',
      source_config: JSON.stringify({ brokerUrl, topic, username }),
      interval_seconds: 1, // Not used for MQTT
      use_timer: false
    };

    db.createSession(sessionData);

    // Create MQTT client
    const client = mqtt.connect(brokerUrl, {
      username: username || undefined,
      password: password || undefined,
      keepalive: 60,
      reconnectPeriod: 1000,
      connectTimeout: 30 * 1000
    });

    let lastMessage = null;
    let isConnected = false;

    client.on('connect', () => {
      console.log(`MQTT client connected for session ${sessionId}`);
      isConnected = true;
      client.subscribe(topic, (err) => {
        if (err) {
          console.error(`Failed to subscribe to ${topic}:`, err);
          broadcast({
            type: 'mqtt-error',
            sessionId: sessionId,
            message: `Failed to subscribe to topic: ${err.message}`
          });
        } else {
          console.log(`Subscribed to topic ${topic} for session ${sessionId}`);
          broadcast({
            type: 'mqtt-connected',
            sessionId: sessionId,
            message: `Connected to broker and subscribed to ${topic}`
          });
        }
      });
    });

    client.on('message', async (receivedTopic, message) => {
      if (receivedTopic === topic) {
        const messageStr = message.toString();
        console.log(`MQTT message received for session ${sessionId}: ${messageStr}`);
        
        // Check for transition from '1' to '0' (or any change that triggers capture)
        if (lastMessage === '1' && messageStr === '0') {
          console.log(`Triggering photo capture for session ${sessionId}`);
          await captureMqttSnapshot(sessionId);
        }
        
        lastMessage = messageStr;
        
        broadcast({
          type: 'mqtt-message',
          sessionId: sessionId,
          message: messageStr,
          timestamp: new Date().toISOString()
        });
      }
    });

    client.on('error', (err) => {
      console.error(`MQTT client error for session ${sessionId}:`, err);
      broadcast({
        type: 'mqtt-error',
        sessionId: sessionId,
        message: `MQTT error: ${err.message}`
      });
    });

    client.on('close', () => {
      console.log(`MQTT client disconnected for session ${sessionId}`);
      isConnected = false;
      broadcast({
        type: 'mqtt-disconnected',
        sessionId: sessionId,
        message: 'Disconnected from MQTT broker'
      });
    });

    // Store client reference
    mqttClients.set(sessionId, {
      client,
      isConnected: () => isConnected,
      lastMessage: () => lastMessage
    });

    res.json({ success: true, sessionId });
  } catch (error) {
    console.error('Error starting MQTT capture:', error);
    res.status(500).json({ success: false, message: 'Failed to start MQTT capture' });
  }
});

app.post('/api/stop-mqtt-capture', (req, res) => {
  const { sessionId } = req.body;
  const mqttSession = mqttClients.get(sessionId);

  if (mqttSession) {
    mqttSession.client.end();
    mqttClients.delete(sessionId);
    db.updateSession(sessionId, { active: 0, completed_at: new Date().toISOString() });
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, message: 'MQTT session not found' });
  }
});

app.get('/api/mqtt-status/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const mqttSession = mqttClients.get(sessionId);

  if (mqttSession) {
    res.json({
      success: true,
      connected: mqttSession.isConnected(),
      lastMessage: mqttSession.lastMessage()
    });
  } else {
    res.status(404).json({ success: false, message: 'MQTT session not found' });
  }
});

// MQTT snapshot capture function
async function captureMqttSnapshot(sessionId) {
  const session = db.getSession(sessionId);
  if (!session) {
    console.error(`Session ${sessionId} not found for MQTT capture`);
    return;
  }

  const sessionDir = path.join(snapshotsDir, sessionId);
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  const snapshotFile = path.join(sessionDir, `mqtt-${Date.now()}.jpg`);

  // For MQTT, we'll use a placeholder image or try to capture from a default source
  // In a real implementation, you might want to specify a camera source in the MQTT config
  const sourceConfig = session.source_config ? JSON.parse(session.source_config) : {};
  const rtspUrl = sourceConfig.rtspUrl || 'rtsp://localhost:8554/stream'; // Default fallback

  ffmpeg(rtspUrl)
    .inputOptions([
      '-rtsp_transport', 'tcp',
      '-timeout', '5000000',
      '-analyzeduration', '2000000',
      '-probesize', '2000000'
    ])
    .outputOptions(['-frames:v 1', '-q:v 2'])
    .output(snapshotFile)
    .on('end', () => {
      const relativePath = `/snapshots/${sessionId}/${path.basename(snapshotFile)}`;
      
      // Save snapshot to database
      try {
        const stats = fs.statSync(snapshotFile);
        db.addSnapshot(sessionId, relativePath, {
          file_size: stats.size
        });
      } catch (error) {
        console.error('Error saving MQTT snapshot to database:', error);
      }

      // Get current snapshot count
      const snapshots = db.getSnapshots(sessionId);
      
      broadcast({
        type: 'snapshot',
        sessionId: sessionId,
        snapshot: relativePath,
        count: snapshots.length,
        source: 'mqtt'
      });
    })
    .on('error', (err) => {
      console.error('Error capturing MQTT snapshot:', err);
      broadcast({
        type: 'error',
        sessionId: sessionId,
        message: `MQTT capture error: ${err.message}`
      });
    })
    .run();
}

// Cleanup functions
async function cleanupOldSessions() {
  try {
    console.log('Starting cleanup of old sessions...');
    
    // Get default retention period from settings (7 days)
    const defaultRetention = parseInt(db.getSetting('default_retention_days', '7'));
    
    // Get sessions to delete
    const sessionsToDelete = db.getSessionsForCleanup(defaultRetention);
    console.log(`Found ${sessionsToDelete.length} sessions to clean up`);
    
    for (const session of sessionsToDelete) {
      try {
        // Delete files
        const sessionDir = path.join(snapshotsDir, session.id);
        if (fs.existsSync(sessionDir)) {
          fs.rmSync(sessionDir, { recursive: true, force: true });
          console.log(`Deleted session directory: ${sessionDir}`);
        }
        
        const videoFile = path.join(videosDir, `timelapse-${session.id}.mp4`);
        if (fs.existsSync(videoFile)) {
          fs.unlinkSync(videoFile);
          console.log(`Deleted video file: ${videoFile}`);
        }
        
        // Delete from database
        db.deleteSession(session.id);
        console.log(`Deleted session from database: ${session.id}`);
      } catch (error) {
        console.error(`Error cleaning up session ${session.id}:`, error);
      }
    }
    
    console.log(`Cleanup completed. Deleted ${sessionsToDelete.length} sessions.`);
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

async function cleanupOrphanedFiles() {
  try {
    console.log('Starting cleanup of orphaned files...');
    
    // Get all files in snapshots and videos directories
    const snapshotFiles = [];
    const videoFiles = [];
    
    if (fs.existsSync(snapshotsDir)) {
      const snapshotDirs = fs.readdirSync(snapshotsDir);
      for (const dir of snapshotDirs) {
        const dirPath = path.join(snapshotsDir, dir);
        if (fs.statSync(dirPath).isDirectory()) {
          const files = fs.readdirSync(dirPath);
          for (const file of files) {
            snapshotFiles.push(path.join(dirPath, file));
          }
        }
      }
    }
    
    if (fs.existsSync(videosDir)) {
      const files = fs.readdirSync(videosDir);
      for (const file of files) {
        videoFiles.push(path.join(videosDir, file));
      }
    }
    
    // Get all files referenced in database
    const dbSnapshots = db.prepare('SELECT file_path FROM snapshots').all();
    const dbVideos = db.prepare('SELECT file_path FROM videos').all();
    
    const dbSnapshotPaths = new Set(dbSnapshots.map(s => path.join(__dirname, s.file_path.replace(/^\//, ''))));
    const dbVideoPaths = new Set(dbVideos.map(v => path.join(__dirname, v.file_path.replace(/^\//, ''))));
    
    // Find orphaned files
    const orphanedSnapshots = snapshotFiles.filter(file => !dbSnapshotPaths.has(file));
    const orphanedVideos = videoFiles.filter(file => !dbVideoPaths.has(file));
    
    // Delete orphaned files
    let deletedCount = 0;
    
    for (const file of orphanedSnapshots) {
      try {
        fs.unlinkSync(file);
        deletedCount++;
        console.log(`Deleted orphaned snapshot: ${file}`);
      } catch (error) {
        console.error(`Error deleting orphaned snapshot ${file}:`, error);
      }
    }
    
    for (const file of orphanedVideos) {
      try {
        fs.unlinkSync(file);
        deletedCount++;
        console.log(`Deleted orphaned video: ${file}`);
      } catch (error) {
        console.error(`Error deleting orphaned video ${file}:`, error);
      }
    }
    
    console.log(`Orphaned files cleanup completed. Deleted ${deletedCount} files.`);
  } catch (error) {
    console.error('Error during orphaned files cleanup:', error);
  }
}

// Schedule cleanup to run every hour
cron.schedule('0 * * * *', () => {
  console.log('Running scheduled cleanup...');
  cleanupOldSessions();
  cleanupOrphanedFiles();
});

// Additional cleanup endpoints
app.post('/api/cleanup/run', async (req, res) => {
  try {
    await cleanupOldSessions();
    await cleanupOrphanedFiles();
    res.json({ success: true, message: 'Cleanup completed' });
  } catch (error) {
    console.error('Manual cleanup error:', error);
    res.status(500).json({ success: false, message: 'Cleanup failed' });
  }
});

app.get('/api/cleanup/stats', (req, res) => {
  try {
    const stats = db.getStorageStats();
    const oldSessions = db.getSessionsForCleanup(7); // 7 days default
    const quotas = db.getStorageQuotas();
    
    res.json({
      success: true,
      stats: {
        ...stats,
        oldSessionsCount: oldSessions.length,
        quotas: quotas
      }
    });
  } catch (error) {
    console.error('Error getting cleanup stats:', error);
    res.status(500).json({ success: false, message: 'Failed to get cleanup stats' });
  }
});

// Storage quota management endpoints
app.get('/api/storage/quotas', (req, res) => {
  try {
    const quotas = db.getStorageQuotas();
    const stats = db.getStorageStats();
    const quotaStatus = db.checkStorageQuota();
    
    res.json({
      success: true,
      quotas: quotas,
      stats: stats,
      quotaStatus: quotaStatus
    });
  } catch (error) {
    console.error('Error getting storage quotas:', error);
    res.status(500).json({ success: false, message: 'Failed to get storage quotas' });
  }
});

app.post('/api/storage/quotas', (req, res) => {
  try {
    const { maxTotalMB, maxSessionMB } = req.body;
    
    if (!maxTotalMB || !maxSessionMB || maxTotalMB < 1 || maxSessionMB < 1) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid quota values. Must be positive numbers.' 
      });
    }
    
    db.setStorageQuotas(maxTotalMB, maxSessionMB);
    
    res.json({ 
      success: true, 
      message: 'Storage quotas updated successfully',
      quotas: { maxTotalMB, maxSessionMB }
    });
  } catch (error) {
    console.error('Error setting storage quotas:', error);
    res.status(500).json({ success: false, message: 'Failed to set storage quotas' });
  }
});

// Add quota checking to capture endpoints
function checkQuotaBeforeCapture(sessionId) {
  const quotaCheck = db.checkStorageQuota(sessionId);
  if (!quotaCheck.allowed) {
    return {
      success: false,
      message: quotaCheck.message,
      quotaExceeded: true
    };
  }
  return { success: true };
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  console.log(`WebSocket server running on ws://0.0.0.0:${WS_PORT}`);
});
