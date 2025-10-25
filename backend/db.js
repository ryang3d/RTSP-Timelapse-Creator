const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class DatabaseManager {
  constructor() {
    const dbPath = path.join(__dirname, 'data', 'timelapse.db');
    
    // Ensure data directory exists
    const dataDir = path.dirname(dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    
    this.initializeSchema();
    this.runMigrations();
  }

  initializeSchema() {
    // Settings table for configuration and database version
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Sessions table with expanded source types
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        source_type TEXT NOT NULL DEFAULT 'rtsp' CHECK (source_type IN (
          'rtsp',           -- IP camera RTSP streams
          'usb_camera',     -- USB webcams and cameras
          'capture_card',   -- Video capture cards
          'http_stream',    -- HTTP/MJPEG/HLS streams
          'rtmp_stream',    -- RTMP live streams
          'screen_capture', -- Desktop/screen recording
          'video_file',     -- File-based video sources
          'upload',         -- Uploaded photos
          'import',         -- Imported photos
          'mqtt'            -- MQTT-triggered capture (legacy)
        )),
        source_config TEXT, -- JSON string for source-specific settings
        rtsp_url TEXT,      -- Legacy field, kept for backward compatibility
        interval_seconds INTEGER NOT NULL,
        duration_seconds INTEGER,
        use_timer BOOLEAN DEFAULT 0,
        active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        started_at DATETIME,
        completed_at DATETIME,
        retention_days INTEGER DEFAULT 7
      )
    `);

    // Snapshots table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER,
        width INTEGER,
        height INTEGER,
        captured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      )
    `);

    // Videos table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS videos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER,
        fps INTEGER NOT NULL,
        duration_seconds REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      )
    `);

    // Create indexes for better performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_snapshots_session_id ON snapshots(session_id);
      CREATE INDEX IF NOT EXISTS idx_snapshots_captured_at ON snapshots(captured_at);
      CREATE INDEX IF NOT EXISTS idx_videos_session_id ON videos(session_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(active);
      CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
    `);
  }

  runMigrations() {
    // Get current database version
    const versionResult = this.db.prepare('SELECT value FROM settings WHERE key = ?').get('db_version');
    const currentVersion = versionResult ? parseInt(versionResult.value) : 0;
    
    // Run migrations if needed
    if (currentVersion < 1) {
      this.migrateToV1();
    }
    
    // Update version
    this.db.prepare(`
      INSERT OR REPLACE INTO settings (key, value) 
      VALUES ('db_version', ?)
    `).run('1');
  }

  migrateToV1() {
    // Initial migration - schema is already created
    console.log('Database migrated to version 1');
  }

  // Session management
  createSession(sessionData) {
    const stmt = this.db.prepare(`
      INSERT INTO sessions (
        id, source_type, source_config, rtsp_url, interval_seconds, 
        duration_seconds, use_timer, active, started_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    return stmt.run(
      sessionData.id,
      sessionData.source_type || 'rtsp',
      sessionData.source_config ? JSON.stringify(sessionData.source_config) : null,
      sessionData.rtsp_url,
      sessionData.interval_seconds,
      sessionData.duration_seconds,
      sessionData.use_timer ? 1 : 0,
      1,
      new Date().toISOString()
    );
  }

  getSession(sessionId) {
    const session = this.db.prepare(`
      SELECT * FROM sessions WHERE id = ?
    `).get(sessionId);
    
    if (session) {
      session.source_config = session.source_config ? JSON.parse(session.source_config) : null;
      session.use_timer = Boolean(session.use_timer);
      session.active = Boolean(session.active);
    }
    
    return session;
  }

  updateSession(sessionId, updates) {
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    
    const stmt = this.db.prepare(`
      UPDATE sessions SET ${fields} WHERE id = ?
    `);
    
    return stmt.run(...values, sessionId);
  }

  deleteSession(sessionId) {
    const stmt = this.db.prepare('DELETE FROM sessions WHERE id = ?');
    return stmt.run(sessionId);
  }

  getAllSessions(limit = 50, offset = 0) {
    const sessions = this.db.prepare(`
      SELECT s.*, 
             COUNT(snap.id) as snapshot_count,
             SUM(snap.file_size) as total_snapshot_size,
             COUNT(v.id) as video_count
      FROM sessions s
      LEFT JOIN snapshots snap ON s.id = snap.session_id
      LEFT JOIN videos v ON s.id = v.session_id
      GROUP BY s.id
      ORDER BY s.created_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);
    
    return sessions.map(session => ({
      ...session,
      source_config: session.source_config ? JSON.parse(session.source_config) : null,
      use_timer: Boolean(session.use_timer),
      active: Boolean(session.active),
      snapshot_count: session.snapshot_count || 0,
      total_snapshot_size: session.total_snapshot_size || 0,
      video_count: session.video_count || 0
    }));
  }

  // Snapshot management
  addSnapshot(sessionId, filePath, metadata = {}) {
    const stmt = this.db.prepare(`
      INSERT INTO snapshots (session_id, file_path, file_size, width, height, captured_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    return stmt.run(
      sessionId,
      filePath,
      metadata.file_size || null,
      metadata.width || null,
      metadata.height || null,
      metadata.captured_at || new Date().toISOString()
    );
  }

  getSnapshots(sessionId) {
    return this.db.prepare(`
      SELECT * FROM snapshots 
      WHERE session_id = ? 
      ORDER BY captured_at ASC
    `).all(sessionId);
  }

  // Video management
  addVideo(sessionId, filePath, fps, metadata = {}) {
    const stmt = this.db.prepare(`
      INSERT INTO videos (session_id, file_path, file_size, fps, duration_seconds)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    return stmt.run(
      sessionId,
      filePath,
      metadata.file_size || null,
      fps,
      metadata.duration_seconds || null
    );
  }

  getVideos(sessionId) {
    return this.db.prepare(`
      SELECT * FROM videos 
      WHERE session_id = ? 
      ORDER BY created_at DESC
    `).all(sessionId);
  }

  // Storage management
  getStorageStats() {
    const stats = this.db.prepare(`
      SELECT 
        COUNT(DISTINCT s.id) as total_sessions,
        COUNT(snap.id) as total_snapshots,
        COUNT(v.id) as total_videos,
        COALESCE(SUM(snap.file_size), 0) as total_snapshot_size,
        COALESCE(SUM(v.file_size), 0) as total_video_size,
        COALESCE(SUM(snap.file_size) + SUM(v.file_size), 0) as total_size
      FROM sessions s
      LEFT JOIN snapshots snap ON s.id = snap.session_id
      LEFT JOIN videos v ON s.id = v.session_id
    `).get();
    
    return stats;
  }

  // Cleanup operations
  getSessionsForCleanup(retentionDays = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    return this.db.prepare(`
      SELECT id FROM sessions 
      WHERE created_at < ? AND active = 0
    `).all(cutoffDate.toISOString());
  }

  deleteOldSessions(retentionDays = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    const stmt = this.db.prepare(`
      DELETE FROM sessions 
      WHERE created_at < ? AND active = 0
    `);
    
    return stmt.run(cutoffDate.toISOString());
  }

  // Settings management
  getSetting(key, defaultValue = null) {
    const result = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return result ? result.value : defaultValue;
  }

  setSetting(key, value) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO settings (key, value) 
      VALUES (?, ?)
    `);
    return stmt.run(key, value);
  }

  // Storage quota management
  checkStorageQuota(sessionId = null) {
    const maxTotalStorage = parseInt(this.getSetting('max_total_storage_mb', '1024')) * 1024 * 1024; // Default 1GB
    const maxSessionStorage = parseInt(this.getSetting('max_session_storage_mb', '100')) * 1024 * 1024; // Default 100MB
    
    const stats = this.getStorageStats();
    
    // Check total storage quota
    if (stats.total_size > maxTotalStorage) {
      return {
        allowed: false,
        reason: 'total_quota_exceeded',
        current: stats.total_size,
        limit: maxTotalStorage,
        message: `Total storage quota exceeded (${Math.round(stats.total_size / 1024 / 1024)}MB / ${Math.round(maxTotalStorage / 1024 / 1024)}MB)`
      };
    }
    
    // Check session storage quota if sessionId provided
    if (sessionId) {
      const sessionStats = this.db.prepare(`
        SELECT 
          COALESCE(SUM(snap.file_size), 0) as session_snapshot_size,
          COALESCE(SUM(v.file_size), 0) as session_video_size
        FROM sessions s
        LEFT JOIN snapshots snap ON s.id = snap.session_id
        LEFT JOIN videos v ON s.id = v.session_id
        WHERE s.id = ?
      `).get(sessionId);
      
      const sessionSize = (sessionStats.session_snapshot_size || 0) + (sessionStats.session_video_size || 0);
      
      if (sessionSize > maxSessionStorage) {
        return {
          allowed: false,
          reason: 'session_quota_exceeded',
          current: sessionSize,
          limit: maxSessionStorage,
          message: `Session storage quota exceeded (${Math.round(sessionSize / 1024 / 1024)}MB / ${Math.round(maxSessionStorage / 1024 / 1024)}MB)`
        };
      }
    }
    
    return {
      allowed: true,
      current: stats.total_size,
      limit: maxTotalStorage,
      message: 'Storage quota OK'
    };
  }

  setStorageQuotas(maxTotalMB, maxSessionMB) {
    this.setSetting('max_total_storage_mb', maxTotalMB.toString());
    this.setSetting('max_session_storage_mb', maxSessionMB.toString());
  }

  getStorageQuotas() {
    return {
      maxTotalMB: parseInt(this.getSetting('max_total_storage_mb', '1024')),
      maxSessionMB: parseInt(this.getSetting('max_session_storage_mb', '100'))
    };
  }

  close() {
    this.db.close();
  }
}

module.exports = DatabaseManager;
