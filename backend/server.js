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
const archiver = require('archiver');
const DatabaseManager = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;
const WS_PORT = process.env.WS_PORT || 3002;
const DEFAULT_PARENT_PATH = process.env.IMPORT_PARENT_PATH || '';

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

// Unified capture function for all source types
async function captureFromSource(sessionId, sourceConfig) {
  const session = db.getSession(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  const config = typeof sourceConfig === 'string' ?
    JSON.parse(sourceConfig) : sourceConfig;

  const sessionDir = path.join(snapshotsDir, sessionId);
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  const snapshotFile = path.join(sessionDir, `snapshot-${Date.now()}.jpg`);

  // Build FFmpeg command based on source type
  let command;

  switch (session.source_type) {
    case 'rtsp':
      command = buildRtspCapture(config.rtspUrl || config.url, snapshotFile);
      break;
    case 'usb_camera':
    case 'capture_card':
      command = buildV4L2Capture(config, snapshotFile);
      break;
    case 'http_stream':
      command = buildHttpCapture(config, snapshotFile);
      break;
    case 'rtmp_stream':
      command = buildRtmpCapture(config.rtmpUrl || config.url, snapshotFile);
      break;
    case 'screen_capture':
      command = buildScreenCapture(config, snapshotFile);
      break;
    default:
      throw new Error(`Unsupported source type: ${session.source_type}`);
  }

  return new Promise((resolve, reject) => {
    command
      .on('end', () => resolve(snapshotFile))
      .on('error', (err) => reject(err))
      .run();
  });
}

// FFmpeg command builders for different source types
function buildRtspCapture(rtspUrl, outputFile) {
  return ffmpeg(rtspUrl)
    .inputOptions([
      '-rtsp_transport', 'tcp',
      '-timeout', '5000000',
      '-analyzeduration', '2000000',
      '-probesize', '2000000'
    ])
    .outputOptions(['-frames:v 1', '-q:v 2'])
    .output(outputFile);
}

function buildV4L2Capture(config, outputFile) {
  const { devicePath, format, resolution, fps } = config;

  const inputOptions = [
    '-f v4l2',
    format ? `-input_format ${format}` : '',
    resolution ? `-video_size ${resolution}` : '',
    fps ? `-framerate ${fps}` : '-framerate 30'
  ].filter(Boolean);

  return ffmpeg(devicePath)
    .inputOptions(inputOptions)
    .outputOptions(['-frames:v 1', '-q:v 2'])
    .output(outputFile);
}

function buildHttpCapture(config, outputFile) {
  const { httpUrl, streamFormat } = config;

  const inputOptions = streamFormat === 'hls'
    ? ['-live_start_index -1', '-timeout 10000000']
    : ['-timeout 10000000'];

  return ffmpeg(httpUrl)
    .inputOptions(inputOptions)
    .outputOptions(['-frames:v 1', '-q:v 2'])
    .output(outputFile);
}

function buildRtmpCapture(rtmpUrl, outputFile) {
  return ffmpeg(rtmpUrl)
    .inputOptions(['-timeout 10000000'])
    .outputOptions(['-frames:v 1', '-q:v 2'])
    .output(outputFile);
}

function buildScreenCapture(config, outputFile) {
  const { display, region } = config;
  const platform = process.platform;

  if (platform === 'linux') {
    const inputOptions = ['-f x11grab'];
    if (region) {
      inputOptions.push(`-video_size ${region}`);
    }

    return ffmpeg(display || ':0.0')
      .inputOptions(inputOptions)
      .outputOptions(['-frames:v 1', '-q:v 2'])
      .output(outputFile);
  } else if (platform === 'win32') {
    return ffmpeg()
      .input('desktop')
      .inputFormat('gdigrab')
      .outputOptions(['-frames:v 1', '-q:v 2'])
      .output(outputFile);
  } else {
    throw new Error(`Screen capture not supported on platform: ${platform}`);
  }
}

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
  
  if (!url || !url.trim()) {
    return res.status(400).json({ success: false, message: 'RTSP URL is required' });
  }

  const testFile = path.join(snapshotsDir, `test-${Date.now()}.jpg`);
  let responseHandled = false;
  
  // Cleanup function to ensure test file is always deleted
  const cleanup = () => {
    try {
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
        console.log('Cleaned up test file:', testFile);
      }
    } catch (err) {
      console.error('Error cleaning up test file:', err.message);
    }
  };

  const timeout = setTimeout(() => {
    if (!responseHandled) {
      responseHandled = true;
      cleanup();
      console.error('RTSP connection test timed out for URL:', url);
      res.status(400).json({ success: false, message: 'Connection timeout - unable to reach RTSP stream within 15 seconds' });
    }
  }, 15000); // 15 second timeout

  try {
    const command = ffmpeg(url)
      .inputOptions([
        '-rtsp_transport', 'tcp',
        '-timeout', '10000000', // Connection timeout in microseconds (10 seconds)
        '-analyzeduration', '2000000',
        '-probesize', '2000000'
      ])
      .outputOptions(['-frames:v', '1', '-q:v', '2'])
      .output(testFile)
      .on('start', (commandLine) => {
        console.log('FFmpeg test command:', commandLine);
      })
      .on('end', () => {
        clearTimeout(timeout);
        if (!responseHandled) {
          responseHandled = true;
          cleanup();
          console.log('RTSP connection test successful for URL:', url);
          res.json({ success: true, message: 'Connection successful' });
        }
      })
      .on('error', (err) => {
        clearTimeout(timeout);
        if (!responseHandled) {
          responseHandled = true;
          cleanup();
          console.error('RTSP connection test error for URL:', url, '- Error:', err.message);
          
          // Provide more helpful error messages
          let errorMessage = err.message;
          if (err.message.includes('ETIMEDOUT') || err.message.includes('timeout')) {
            errorMessage = 'Connection timeout - unable to reach RTSP stream';
          } else if (err.message.includes('ECONNREFUSED')) {
            errorMessage = 'Connection refused - check if the RTSP server is running';
          } else if (err.message.includes('401') || err.message.includes('Unauthorized')) {
            errorMessage = 'Authentication failed - check username and password in URL';
          } else if (err.message.includes('404') || err.message.includes('Not Found')) {
            errorMessage = 'Stream not found - check the RTSP path';
          } else if (err.message.includes('Invalid data')) {
            errorMessage = 'Invalid stream format or corrupted data';
          }
          
          res.status(400).json({ success: false, message: errorMessage });
        }
      });

    command.run();
  } catch (err) {
    clearTimeout(timeout);
    if (!responseHandled) {
      responseHandled = true;
      cleanup();
      console.error('FFmpeg command error:', err.message);
      res.status(500).json({ success: false, message: 'Failed to start connection test: ' + err.message });
    }
  }
});

app.post('/api/start-capture', (req, res) => {
  const { sourceType, sourceConfig, interval, duration, useTimer } = req.body;
  const sessionId = uuidv4();
  const sessionDir = path.join(snapshotsDir, sessionId);

  fs.mkdirSync(sessionDir, { recursive: true });

  // Create session in database with unified configuration
  const sessionData = {
    id: sessionId,
    source_type: sourceType || 'rtsp',
    source_config: JSON.stringify(sourceConfig || {}),
    rtsp_url: sourceConfig?.rtspUrl || sourceConfig?.url, // Legacy compatibility
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
      sourceType: sourceType || 'rtsp',
      sourceConfig: sourceConfig || {},
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

  // Use unified capture function
  captureFromSource(session.id, session.sourceConfig)
    .then((capturedFile) => {
      const relativePath = `/snapshots/${session.id}/${path.basename(capturedFile)}`;

      // Save snapshot to database
      try {
        const stats = fs.statSync(capturedFile);
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
    .catch((err) => {
      console.error('Error capturing snapshot:', err);
      broadcast({
        type: 'error',
        sessionId: session.id,
        message: err.message
      });
    });
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

// Device enumeration endpoint
app.get('/api/list-devices', (req, res) => {
  try {
    const devices = {
      usbCameras: [],
      captureCards: [],
      screens: []
    };

    // Enumerate V4L2 devices (USB cameras and capture cards)
    try {
      const v4lDevices = fs.readdirSync('/dev/').filter(file => file.startsWith('video'));
      for (const device of v4lDevices) {
        const devicePath = `/dev/${device}`;

        // Try to get device info using v4l2-ctl if available
        try {
          const { execSync } = require('child_process');
          const info = execSync(`v4l2-ctl -d ${devicePath} --info 2>/dev/null || echo "Unknown device"`).toString();

          // Basic classification based on device name and info
          if (info.includes('usb') || info.includes('USB') || device.includes('0')) {
            devices.usbCameras.push({
              path: devicePath,
              name: info.split('\n')[0] || `USB Camera (${device})`,
              device: device
            });
          } else {
            devices.captureCards.push({
              path: devicePath,
              name: info.split('\n')[0] || `Capture Card (${device})`,
              device: device
            });
          }
        } catch (error) {
          // Fallback if v4l2-ctl not available
          if (device.includes('0')) {
            devices.usbCameras.push({
              path: devicePath,
              name: `Camera (${device})`,
              device: device
            });
          } else {
            devices.captureCards.push({
              path: devicePath,
              name: `Capture Device (${device})`,
              device: device
            });
          }
        }
      }
    } catch (error) {
      console.warn('Could not enumerate V4L2 devices:', error.message);
    }

    // Screen/display enumeration
    try {
      if (process.platform === 'linux') {
        devices.screens.push({
          display: ':0.0',
          name: 'Primary Display',
          resolution: 'auto'
        });
      } else if (process.platform === 'win32') {
        devices.screens.push({
          display: 'desktop',
          name: 'Desktop',
          resolution: 'auto'
        });
      }
    } catch (error) {
      console.warn('Could not enumerate displays:', error.message);
    }

    res.json({
      success: true,
      devices: devices
    });
  } catch (error) {
    console.error('Error listing devices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to enumerate devices',
      error: error.message
    });
  }
});

// Source testing endpoint
app.post('/api/test-source', async (req, res) => {
  const { sourceType, sourceConfig } = req.body;

  if (!sourceType || !sourceConfig) {
    return res.status(400).json({
      success: false,
      message: 'Source type and configuration required'
    });
  }

  const testFile = path.join(snapshotsDir, `test-${Date.now()}.jpg`);
  let responseHandled = false;

  // Cleanup function
  const cleanup = () => {
    try {
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }
    } catch (err) {
      console.error('Error cleaning up test file:', err.message);
    }
  };

  const timeout = setTimeout(() => {
    if (!responseHandled) {
      responseHandled = true;
      cleanup();
      res.status(400).json({
        success: false,
        message: 'Connection timeout - unable to reach source within 15 seconds'
      });
    }
  }, 15000);

  try {
    await captureFromSource('test-session', sourceConfig);

    clearTimeout(timeout);
    if (!responseHandled) {
      responseHandled = true;
      cleanup();
      res.json({ success: true, message: 'Connection successful' });
    }
  } catch (error) {
    clearTimeout(timeout);
    if (!responseHandled) {
      responseHandled = true;
      cleanup();

      let errorMessage = error.message;
      if (error.message.includes('ENOENT') && sourceType.includes('camera')) {
        errorMessage = 'Device not found - check if camera is connected';
      } else if (error.message.includes('EACCES')) {
        errorMessage = 'Permission denied - check device permissions';
      } else if (error.message.includes('ETIMEDOUT') || error.message.includes('timeout')) {
        errorMessage = 'Connection timeout - unable to reach source';
      }

      res.status(400).json({ success: false, message: errorMessage });
    }
  }
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

        // Get image metadata including EXIF
        const metadata = await sharp(file.path).metadata();

        // Extract capture date from EXIF or file stats
        let capturedAt = new Date(); // fallback to processing time

        // Try EXIF DateTimeOriginal first
        if (metadata.exif && metadata.exif.DateTimeOriginal) {
          try {
            // EXIF dates are in "YYYY:MM:DD HH:MM:SS" format
            const exifDateStr = metadata.exif.DateTimeOriginal;
            const dateParts = exifDateStr.split(' ');
            if (dateParts.length === 2) {
              const dateStr = dateParts[0].replace(/:/g, '-');
              const timeStr = dateParts[1];
              capturedAt = new Date(`${dateStr}T${timeStr}`);
            }
          } catch (error) {
            console.warn('Failed to parse EXIF DateTimeOriginal:', error.message);
          }
        }

        // Fallback to EXIF DateTime
        if (capturedAt.getTime() === new Date().getTime() && metadata.exif && metadata.exif.DateTime) {
          try {
            const exifDateStr = metadata.exif.DateTime;
            const dateParts = exifDateStr.split(' ');
            if (dateParts.length === 2) {
              const dateStr = dateParts[0].replace(/:/g, '-');
              const timeStr = dateParts[1];
              capturedAt = new Date(`${dateStr}T${timeStr}`);
            }
          } catch (error) {
            console.warn('Failed to parse EXIF DateTime:', error.message);
          }
        }

        // Final fallback to file modification time
        if (capturedAt.getTime() === new Date().getTime()) {
          try {
            const stats = fs.statSync(file.path);
            capturedAt = stats.mtime;
          } catch (error) {
            console.warn('Failed to get file modification time:', error.message);
          }
        }

        // Save to database
        const relativePath = `/snapshots/${sessionId}/${path.basename(file.path)}`;
        db.addSnapshot(sessionId, relativePath, {
          file_size: file.size,
          width: metadata.width,
          height: metadata.height,
          captured_at: capturedAt.toISOString()
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

// New API endpoint to list child directories
app.get('/api/list-child-directories', (req, res) => {
  try {
    const { parentPath } = req.query;

    if (!parentPath) {
      return res.status(400).json({ success: false, message: 'Parent path required' });
    }

    // Validate parent path exists
    if (!fs.existsSync(parentPath)) {
      return res.status(400).json({ success: false, message: 'Parent path does not exist' });
    }

    // Check if it's a directory
    if (!fs.statSync(parentPath).isDirectory()) {
      return res.status(400).json({ success: false, message: 'Parent path is not a directory' });
    }

    // Get child directories
    const items = fs.readdirSync(parentPath);
    const childDirectories = items
      .filter(item => {
        const itemPath = path.join(parentPath, item);
        return fs.statSync(itemPath).isDirectory();
      })
      .sort();

    res.json({
      success: true,
      parentPath,
      childDirectories,
      defaultParentPath: DEFAULT_PARENT_PATH
    });
  } catch (error) {
    console.error('Error listing child directories:', error);
    res.status(500).json({ success: false, message: 'Failed to list child directories' });
  }
});

app.post('/api/import-from-path', async (req, res) => {
  try {
    const { parentPath, childDirectory, sessionId } = req.body;

    if (!parentPath || !childDirectory) {
      return res.status(400).json({ success: false, message: 'Parent path and child directory required' });
    }

    const networkPath = path.join(parentPath, childDirectory);

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

        // Determine capture date from file creation date
        const capturedAt = stats.birthtime || stats.mtime || new Date();

        // Save to database
        const relativePath = `/snapshots/${sessionId}/${path.basename(destPath)}`;
        db.addSnapshot(sessionId, relativePath, {
          file_size: stats.size,
          width: metadata.width,
          height: metadata.height,
          captured_at: capturedAt.toISOString()
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

// MQTT endpoints with support for all source types
app.post('/api/start-mqtt-capture', async (req, res) => {
  try {
    const {
      brokerUrl,
      topic,
      username,
      password,
      sourceType,      // NEW: Type of video source
      sourceConfig,    // NEW: Source-specific configuration
      sessionId
    } = req.body;

    if (!brokerUrl || !topic) {
      return res.status(400).json({ success: false, message: 'Broker URL and topic are required' });
    }

    // Validate source type (exclude file-based sources)
    const validMqttSources = [
      'rtsp',
      'usb_camera',
      'capture_card',
      'http_stream',
      'rtmp_stream',
      'screen_capture'
    ];

    if (!sourceType || !validMqttSources.includes(sourceType)) {
      return res.status(400).json({
        success: false,
        message: 'Valid source type required for MQTT capture. File-based sources not supported.'
      });
    }

    if (!sourceConfig) {
      return res.status(400).json({
        success: false,
        message: 'Source configuration required'
      });
    }

    // Create session in database with unified configuration
    const sessionData = {
      id: sessionId,
      source_type: sourceType,  // Store actual source type
      source_config: JSON.stringify({
        ...sourceConfig,        // Source-specific config
        mqttBrokerUrl: brokerUrl,
        mqttTopic: topic,
        mqttUsername: username
      }),
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
          console.log(`Triggering photo capture for session ${sessionId} from ${sourceType} source`);
          try {
            await captureMqttSnapshot(sessionId);
          } catch (error) {
            console.error(`Error capturing MQTT snapshot for ${sourceType}:`, error);
            broadcast({
              type: 'error',
              sessionId: sessionId,
              message: `MQTT capture error: ${error.message}`
            });
          }
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

// MQTT snapshot capture function (now uses unified capture)
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

  // Get source configuration from session
  const sourceConfig = session.source_config ? JSON.parse(session.source_config) : {};

  try {
    // Use unified capture function for any source type
    const snapshotFile = await captureFromSource(sessionId, sourceConfig);
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
  } catch (error) {
    console.error('Error capturing MQTT snapshot:', error);
    broadcast({
      type: 'error',
      sessionId: sessionId,
      message: `MQTT capture error: ${error.message}`
    });
  }
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

// Video download endpoint with forced download headers
app.get('/api/download/video/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const videoPath = path.join(videosDir, `timelapse-${sessionId}.mp4`);

  if (!fs.existsSync(videoPath)) {
    return res.status(404).json({ success: false, message: 'Video not found' });
  }

  const filename = `timelapse-${sessionId}.mp4`;

  // Set headers to force download
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'video/mp4');

  // Stream the file
  const fileStream = fs.createReadStream(videoPath);
  fileStream.pipe(res);

  fileStream.on('error', (err) => {
    console.error('Error streaming video file:', err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Error downloading video' });
    }
  });
});

// Individual photo download endpoint
app.get('/api/download/photo/:sessionId/:filename', (req, res) => {
  const { sessionId, filename } = req.params;
  const photoPath = path.join(snapshotsDir, sessionId, filename);

  if (!fs.existsSync(photoPath)) {
    return res.status(404).json({ success: false, message: 'Photo not found' });
  }

  // Set headers to force download
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'image/jpeg');

  // Stream the file
  const fileStream = fs.createReadStream(photoPath);
  fileStream.pipe(res);

  fileStream.on('error', (err) => {
    console.error('Error streaming photo file:', err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Error downloading photo' });
    }
  });
});

// Session photos zip download endpoint
app.get('/api/download/photos/:sessionId', (req, res) => {
  const { sessionId } = req.params;

  // Check if session exists
  const session = db.getSession(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  // Get all snapshots for the session
  const snapshots = db.getSnapshots(sessionId);
  if (snapshots.length === 0) {
    return res.status(404).json({ success: false, message: 'No photos found for this session' });
  }

  const sessionDir = path.join(snapshotsDir, sessionId);
  const zipFilename = `session-${sessionId}-photos.zip`;

  // Set headers for zip download
  res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);
  res.setHeader('Content-Type', 'application/zip');

  // Create zip archive
  const archive = archiver('zip', {
    zlib: { level: 9 } // Maximum compression
  });

  // Handle archive errors
  archive.on('error', (err) => {
    console.error('Archive error:', err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Error creating zip archive' });
    }
  });

  // Pipe archive to response
  archive.pipe(res);

  // Add each photo to the archive
  snapshots.forEach((snapshot) => {
    const filePath = path.join(__dirname, snapshot.file_path.replace(/^\//, ''));
    const fileName = path.basename(snapshot.file_path);

    if (fs.existsSync(filePath)) {
      archive.file(filePath, { name: fileName });
    } else {
      console.warn(`Photo file not found: ${filePath}`);
    }
  });

  // Finalize the archive
  archive.finalize();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  console.log(`WebSocket server running on ws://0.0.0.0:${WS_PORT}`);
});
