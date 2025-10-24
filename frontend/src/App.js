import React, { useState, useRef, useEffect } from 'react';
import { Play, Square, Download, Settings, CheckCircle, XCircle, Upload, FolderOpen, Image, Wifi, Database, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:3002';

function App() {
  const [url, setUrl] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [snapshots, setSnapshots] = useState([]);
  const [interval, setInterval] = useState(5);
  const [duration, setDuration] = useState(60);
  const [useTimer, setUseTimer] = useState(false);
  const [fps, setFps] = useState(30);
  const [processing, setProcessing] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [testing, setTesting] = useState(false);
  
  // Photo upload/import states
  const [activeTab, setActiveTab] = useState('rtsp');
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [networkPath, setNetworkPath] = useState('');
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  
  // MQTT states
  const [mqttBrokerUrl, setMqttBrokerUrl] = useState('');
  const [mqttTopic, setMqttTopic] = useState('');
  const [mqttUsername, setMqttUsername] = useState('');
  const [mqttPassword, setMqttPassword] = useState('');
  const [mqttRtspUrl, setMqttRtspUrl] = useState('');
  const [mqttConnected, setMqttConnected] = useState(false);
  const [mqttLastMessage, setMqttLastMessage] = useState('');
  const [mqttTesting, setMqttTesting] = useState(false);
  
  // Sessions management states
  const [sessions, setSessions] = useState([]);
  const [storageStats, setStorageStats] = useState(null);
  const [loadingSessions, setLoadingSessions] = useState(false);
  
  const wsRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    wsRef.current = new WebSocket(WS_URL);
    
    wsRef.current.onopen = () => console.log('WebSocket connected');

    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'snapshot':
          if (data.sessionId === sessionId) {
            setSnapshots(prev => [...prev, {
              url: `${API_URL}${data.snapshot}`,
              timestamp: Date.now()
            }]);
          }
          break;
        case 'capture-complete':
          if (data.sessionId === sessionId) {
            setIsCapturing(false);
          }
          break;
        case 'timelapse-ready':
          if (data.sessionId === sessionId) {
            setVideoUrl(`${API_URL}${data.videoUrl}`);
            setProcessing(false);
          }
          break;
        case 'error':
          alert(`Error: ${data.message}`);
          break;
        case 'mqtt-connected':
          if (data.sessionId === sessionId) {
            setMqttConnected(true);
          }
          break;
        case 'mqtt-disconnected':
          if (data.sessionId === sessionId) {
            setMqttConnected(false);
          }
          break;
        case 'mqtt-message':
          if (data.sessionId === sessionId) {
            setMqttLastMessage(data.message);
          }
          break;
        case 'mqtt-error':
          if (data.sessionId === sessionId) {
            alert(`MQTT Error: ${data.message}`);
            setMqttConnected(false);
          }
          break;
        default:
          break;
      }
    };

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [sessionId]);

  const testConnection = async () => {
    setTesting(true);
    setConnectionStatus(null);

    try {
      const response = await fetch(`${API_URL}/api/test-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      const data = await response.json();
      setConnectionStatus(data.success ? 'success' : 'error');
    } catch (error) {
      setConnectionStatus('error');
    } finally {
      setTesting(false);
    }
  };

  const startCapture = async () => {
    try {
      const response = await fetch(`${API_URL}/api/start-capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, interval, duration, useTimer })
      });

      const data = await response.json();
      
      if (data.success) {
        setSessionId(data.sessionId);
        setIsCapturing(true);
        setSnapshots([]);
        setVideoUrl('');
      } else {
        alert('Failed to start capture');
      }
    } catch (error) {
      alert('Error starting capture: ' + error.message);
    }
  };

  const stopCapture = async () => {
    try {
      const response = await fetch(`${API_URL}/api/stop-capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });

      const data = await response.json();
      if (data.success) setIsCapturing(false);
    } catch (error) {
      alert('Error stopping capture: ' + error.message);
    }
  };

  const generateTimelapse = async () => {
    if (snapshots.length < 2) {
      alert('Need at least 2 snapshots to create a timelapse');
      return;
    }

    setProcessing(true);

    try {
      const response = await fetch(`${API_URL}/api/generate-timelapse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, fps })
      });

      const data = await response.json();
      
      if (!data.success) {
        alert('Failed to generate timelapse');
        setProcessing(false);
      }
    } catch (error) {
      alert('Error generating timelapse: ' + error.message);
      setProcessing(false);
    }
  };

  // Photo upload functions
  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;
    
    setUploading(true);
    const formData = new FormData();
    formData.append('sessionId', sessionId || uuidv4());
    
    Array.from(files).forEach(file => {
      formData.append('photos', file);
    });

    try {
      const response = await fetch(`${API_URL}/api/upload-photos`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      
      if (data.success) {
        setSessionId(data.sessionId);
        setUploadedFiles(prev => [...prev, ...data.uploadedFiles]);
        setSnapshots(prev => [...prev, ...data.uploadedFiles.map(file => ({
          url: `${API_URL}${file.path}`,
          timestamp: Date.now()
        }))]);
      } else {
        alert('Upload failed: ' + data.message);
      }
    } catch (error) {
      alert('Error uploading files: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleImportFromPath = async () => {
    if (!networkPath.trim()) {
      alert('Please enter a network path');
      return;
    }

    setImporting(true);
    try {
      const response = await fetch(`${API_URL}/api/import-from-path`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          networkPath: networkPath.trim(),
          sessionId: sessionId || uuidv4()
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setSessionId(data.sessionId);
        setUploadedFiles(prev => [...prev, ...data.importedFiles]);
        setSnapshots(prev => [...prev, ...data.importedFiles.map(file => ({
          url: `${API_URL}${file.path}`,
          timestamp: Date.now()
        }))]);
        setNetworkPath('');
      } else {
        alert('Import failed: ' + data.message);
      }
    } catch (error) {
      alert('Error importing from path: ' + error.message);
    } finally {
      setImporting(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files);
    }
  };

  // MQTT functions
  const startMqttCapture = async () => {
    if (!mqttBrokerUrl || !mqttTopic || !mqttRtspUrl) {
      alert('Please enter broker URL, topic, and RTSP URL');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/start-mqtt-capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brokerUrl: mqttBrokerUrl,
          topic: mqttTopic,
          username: mqttUsername || undefined,
          password: mqttPassword || undefined,
          rtspUrl: mqttRtspUrl,
          sessionId: sessionId || uuidv4()
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setSessionId(data.sessionId);
        setMqttTesting(true);
        // Connection status will be updated via WebSocket
      } else {
        alert('Failed to start MQTT capture: ' + data.message);
      }
    } catch (error) {
      alert('Error starting MQTT capture: ' + error.message);
    }
  };

  const stopMqttCapture = async () => {
    try {
      const response = await fetch(`${API_URL}/api/stop-mqtt-capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });

      const data = await response.json();
      if (data.success) {
        setMqttConnected(false);
        setMqttTesting(false);
      }
    } catch (error) {
      alert('Error stopping MQTT capture: ' + error.message);
    }
  };

  // Sessions management functions
  const loadSessions = async () => {
    setLoadingSessions(true);
    try {
      const response = await fetch(`${API_URL}/api/sessions`);
      const data = await response.json();
      
      if (data.success) {
        setSessions(data.sessions);
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setLoadingSessions(false);
    }
  };

  const loadStorageStats = async () => {
    try {
      const response = await fetch(`${API_URL}/api/storage-stats`);
      const data = await response.json();
      
      if (data.success) {
        setStorageStats(data.stats);
      }
    } catch (error) {
      console.error('Error loading storage stats:', error);
    }
  };

  const deleteSession = async (sessionId) => {
    if (!window.confirm('Are you sure you want to delete this session? This will permanently delete all snapshots and videos.')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/session/${sessionId}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      if (data.success) {
        await loadSessions();
        await loadStorageStats();
        alert('Session deleted successfully');
      } else {
        alert('Failed to delete session: ' + data.message);
      }
    } catch (error) {
      alert('Error deleting session: ' + error.message);
    }
  };

  const runCleanup = async () => {
    if (!window.confirm('Run cleanup to delete old sessions and orphaned files?')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/cleanup/run`, {
        method: 'POST'
      });

      const data = await response.json();
      if (data.success) {
        await loadSessions();
        await loadStorageStats();
        alert('Cleanup completed successfully');
      } else {
        alert('Cleanup failed: ' + data.message);
      }
    } catch (error) {
      alert('Error running cleanup: ' + error.message);
    }
  };

  // Load sessions and stats when sessions tab is selected
  useEffect(() => {
    if (activeTab === 'sessions') {
      loadSessions();
      loadStorageStats();
    }
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8 text-center">
          RTSP Timelapse Creator
        </h1>

        {/* Tab Navigation */}
        <div className="flex justify-center mb-8">
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-1 border border-white/20">
            <button
              onClick={() => setActiveTab('rtsp')}
              className={`px-6 py-2 rounded-md transition-colors ${
                activeTab === 'rtsp' 
                  ? 'bg-purple-600 text-white' 
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              <Settings className="w-4 h-4 inline mr-2" />
              RTSP Stream
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`px-6 py-2 rounded-md transition-colors ${
                activeTab === 'upload' 
                  ? 'bg-purple-600 text-white' 
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              <Upload className="w-4 h-4 inline mr-2" />
              Upload Photos
            </button>
            <button
              onClick={() => setActiveTab('import')}
              className={`px-6 py-2 rounded-md transition-colors ${
                activeTab === 'import' 
                  ? 'bg-purple-600 text-white' 
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              <FolderOpen className="w-4 h-4 inline mr-2" />
              Import from Path
            </button>
            <button
              onClick={() => setActiveTab('mqtt')}
              className={`px-6 py-2 rounded-md transition-colors ${
                activeTab === 'mqtt' 
                  ? 'bg-purple-600 text-white' 
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              <Wifi className="w-4 h-4 inline mr-2" />
              MQTT Trigger
            </button>
            <button
              onClick={() => setActiveTab('sessions')}
              className={`px-6 py-2 rounded-md transition-colors ${
                activeTab === 'sessions' 
                  ? 'bg-purple-600 text-white' 
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              <Database className="w-4 h-4 inline mr-2" />
              Sessions
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* RTSP Tab Content */}
          {activeTab === 'rtsp' && (
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Stream Configuration
              </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  RTSP URL (include credentials in URL if needed)
                </label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="rtsp://username:password@example.com:554/stream"
                  className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Format: rtsp://[username:password@]host[:port]/path
                </p>
              </div>

              <button
                onClick={testConnection}
                disabled={!url || testing}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                {testing ? 'Testing...' : 'Test Connection'}
                {connectionStatus === 'success' && <CheckCircle className="w-5 h-5 text-green-400" />}
                {connectionStatus === 'error' && <XCircle className="w-5 h-5 text-red-400" />}
              </button>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Snapshot Interval (seconds)
                </label>
                <input
                  type="number"
                  value={interval}
                  onChange={(e) => setInterval(Math.max(1, parseInt(e.target.value) || 1))}
                  min="1"
                  className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={useTimer}
                  onChange={(e) => setUseTimer(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <label className="text-sm font-medium text-white">Use Timer</label>
              </div>

              {useTimer && (
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Duration (seconds)
                  </label>
                  <input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(Math.max(0, parseInt(e.target.value) || 0))}
                    min="0"
                    className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-white mb-2">Timelapse FPS</label>
                <input
                  type="number"
                  value={fps}
                  onChange={(e) => setFps(Math.max(1, Math.min(60, parseInt(e.target.value) || 30)))}
                  min="1"
                  max="60"
                  className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex gap-2">
                {!isCapturing ? (
                  <button
                    onClick={startCapture}
                    disabled={!url || connectionStatus !== 'success'}
                    className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors"
                  >
                    <Play className="w-5 h-5" />
                    Start Capture
                  </button>
                ) : (
                  <button
                    onClick={stopCapture}
                    className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors"
                  >
                    <Square className="w-5 h-5" />
                    Stop Capture
                  </button>
                )}
              </div>

              <div className="text-center text-white">
                <p className="text-sm">Snapshots captured: {snapshots.length}</p>
              </div>

              <button
                onClick={generateTimelapse}
                disabled={snapshots.length < 2 || processing || isCapturing}
                className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
              >
                {processing ? 'Processing...' : 'Generate Timelapse'}
              </button>

              {videoUrl && (
                <a
                  href={videoUrl}
                  download={`timelapse-${sessionId || 'video'}.mp4`}
                  className="block w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-center transition-colors"
                >
                  <Download className="w-5 h-5 inline mr-2" />
                  Download Video
                </a>
              )}
            </div>
            </div>
          )}

          {/* Upload Photos Tab Content */}
          {activeTab === 'upload' && (
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Upload Photos
              </h2>

              <div className="space-y-4">
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    dragActive 
                      ? 'border-purple-400 bg-purple-500/20' 
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-white mb-2">Drag and drop photos here, or click to select</p>
                  <p className="text-sm text-gray-400">Supports JPEG, PNG, GIF (max 10MB each)</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white rounded-lg"
                  >
                    {uploading ? 'Uploading...' : 'Select Photos'}
                  </button>
                </div>

                {uploadedFiles.length > 0 && (
                  <div>
                    <h3 className="text-white mb-2">Uploaded Photos ({uploadedFiles.length})</h3>
                    <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto">
                      {uploadedFiles.map((file, index) => (
                        <img
                          key={index}
                          src={`${API_URL}${file.thumbnail}`}
                          alt="Uploaded photo"
                          className="w-full aspect-video object-cover rounded border border-white/20"
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-center text-white">
                  <p className="text-sm">Total photos: {snapshots.length}</p>
                </div>

                <button
                  onClick={generateTimelapse}
                  disabled={snapshots.length < 2 || processing}
                  className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
                >
                  {processing ? 'Processing...' : 'Generate Timelapse'}
                </button>

                {videoUrl && (
                  <a
                    href={videoUrl}
                    download={`timelapse-${sessionId || 'video'}.mp4`}
                    className="block w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-center transition-colors"
                  >
                    <Download className="w-5 h-5 inline mr-2" />
                    Download Video
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Import from Path Tab Content */}
          {activeTab === 'import' && (
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <FolderOpen className="w-5 h-5" />
                Import from Network Path
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Network Path
                  </label>
                  <input
                    type="text"
                    value={networkPath}
                    onChange={(e) => setNetworkPath(e.target.value)}
                    placeholder="/path/to/photos or \\server\share\photos"
                    className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Enter the full path to a directory containing image files
                  </p>
                </div>

                <button
                  onClick={handleImportFromPath}
                  disabled={!networkPath.trim() || importing}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  {importing ? 'Importing...' : 'Import Photos'}
                </button>

                {uploadedFiles.length > 0 && (
                  <div>
                    <h3 className="text-white mb-2">Imported Photos ({uploadedFiles.length})</h3>
                    <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto">
                      {uploadedFiles.map((file, index) => (
                        <img
                          key={index}
                          src={`${API_URL}${file.thumbnail}`}
                          alt="Imported photo"
                          className="w-full aspect-video object-cover rounded border border-white/20"
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-center text-white">
                  <p className="text-sm">Total photos: {snapshots.length}</p>
                </div>

                <button
                  onClick={generateTimelapse}
                  disabled={snapshots.length < 2 || processing}
                  className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
                >
                  {processing ? 'Processing...' : 'Generate Timelapse'}
                </button>

                {videoUrl && (
                  <a
                    href={videoUrl}
                    download={`timelapse-${sessionId || 'video'}.mp4`}
                    className="block w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-center transition-colors"
                  >
                    <Download className="w-5 h-5 inline mr-2" />
                    Download Video
                  </a>
                )}
              </div>
            </div>
          )}

          {/* MQTT Tab Content */}
          {activeTab === 'mqtt' && (
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Wifi className="w-5 h-5" />
                MQTT Trigger Configuration
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    MQTT Broker URL
                  </label>
                  <input
                    type="text"
                    value={mqttBrokerUrl}
                    onChange={(e) => setMqttBrokerUrl(e.target.value)}
                    placeholder="mqtt://broker.example.com:1883"
                    className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Topic
                  </label>
                  <input
                    type="text"
                    value={mqttTopic}
                    onChange={(e) => setMqttTopic(e.target.value)}
                    placeholder="sensor/trigger"
                    className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    RTSP Stream URL
                  </label>
                  <input
                    type="text"
                    value={mqttRtspUrl}
                    onChange={(e) => setMqttRtspUrl(e.target.value)}
                    placeholder="rtsp://username:password@camera.example.com:554/stream"
                    className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    The video stream to capture from when MQTT trigger fires
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Username (optional)
                    </label>
                    <input
                      type="text"
                      value={mqttUsername}
                      onChange={(e) => setMqttUsername(e.target.value)}
                      placeholder="mqtt_user"
                      className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Password (optional)
                    </label>
                    <input
                      type="password"
                      value={mqttPassword}
                      onChange={(e) => setMqttPassword(e.target.value)}
                      placeholder="password"
                      className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                  <h3 className="text-blue-300 font-semibold mb-2">How it works:</h3>
                  <p className="text-sm text-blue-200">
                    The system will capture a photo from the specified RTSP stream when the MQTT message changes from '1' to '0' on the specified topic.
                    This is useful for motion sensors, door triggers, or other binary sensors that need to trigger camera captures.
                  </p>
                </div>

                <div className="flex gap-2">
                  {!mqttConnected ? (
                    <button
                      onClick={startMqttCapture}
                      disabled={!mqttBrokerUrl || !mqttTopic || !mqttRtspUrl || mqttTesting}
                      className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors"
                    >
                      <Wifi className="w-5 h-5" />
                      {mqttTesting ? 'Connecting...' : 'Start MQTT Capture'}
                    </button>
                  ) : (
                    <button
                      onClick={stopMqttCapture}
                      className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors"
                    >
                      <Square className="w-5 h-5" />
                      Stop MQTT Capture
                    </button>
                  )}
                </div>

                {mqttConnected && (
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-green-300 mb-2">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-semibold">Connected to MQTT Broker</span>
                    </div>
                    <p className="text-sm text-green-200">
                      Listening on topic: <code className="bg-green-500/20 px-1 rounded">{mqttTopic}</code>
                    </p>
                    {mqttLastMessage && (
                      <p className="text-sm text-green-200 mt-1">
                        Last message: <code className="bg-green-500/20 px-1 rounded">{mqttLastMessage}</code>
                      </p>
                    )}
                  </div>
                )}

                <div className="text-center text-white">
                  <p className="text-sm">Snapshots captured: {snapshots.length}</p>
                </div>

                <button
                  onClick={generateTimelapse}
                  disabled={snapshots.length < 2 || processing}
                  className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
                >
                  {processing ? 'Processing...' : 'Generate Timelapse'}
                </button>

                {videoUrl && (
                  <a
                    href={videoUrl}
                    download={`timelapse-${sessionId || 'video'}.mp4`}
                    className="block w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-center transition-colors"
                  >
                    <Download className="w-5 h-5 inline mr-2" />
                    Download Video
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Sessions Management Tab Content */}
          {activeTab === 'sessions' && (
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Database className="w-5 h-5" />
                Sessions Management
              </h2>

              <div className="space-y-6">
                {/* Storage Stats */}
                {storageStats && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                    <h3 className="text-blue-300 font-semibold mb-3">Storage Statistics</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-blue-200">Total Sessions:</span>
                        <span className="text-white ml-2">{storageStats.total_sessions}</span>
                      </div>
                      <div>
                        <span className="text-blue-200">Total Snapshots:</span>
                        <span className="text-white ml-2">{storageStats.total_snapshots}</span>
                      </div>
                      <div>
                        <span className="text-blue-200">Total Videos:</span>
                        <span className="text-white ml-2">{storageStats.total_videos}</span>
                      </div>
                      <div>
                        <span className="text-blue-200">Storage Used:</span>
                        <span className="text-white ml-2">
                          {Math.round(storageStats.total_size / 1024 / 1024)}MB
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Cleanup Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={runCleanup}
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg flex items-center gap-2 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Run Cleanup
                  </button>
                  <button
                    onClick={() => { loadSessions(); loadStorageStats(); }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
                  >
                    Refresh
                  </button>
                </div>

                {/* Sessions List */}
                <div>
                  <h3 className="text-white font-semibold mb-3">All Sessions</h3>
                  
                  {loadingSessions ? (
                    <div className="text-center text-gray-400 py-8">
                      Loading sessions...
                    </div>
                  ) : sessions.length === 0 ? (
                    <div className="text-center text-gray-400 py-8">
                      No sessions found
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {sessions.map((session) => (
                        <div key={session.id} className="bg-white/5 border border-white/10 rounded-lg p-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-white font-medium">
                                  {session.source_type.toUpperCase()} Session
                                </span>
                                {session.active && (
                                  <span className="bg-green-500 text-white text-xs px-2 py-1 rounded">
                                    Active
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-gray-300 space-y-1">
                                <div>ID: {session.id.substring(0, 8)}...</div>
                                <div>Created: {new Date(session.created_at).toLocaleString()}</div>
                                <div>Snapshots: {session.snapshot_count}</div>
                                <div>Videos: {session.video_count}</div>
                                <div>Size: {Math.round((session.total_snapshot_size || 0) / 1024 / 1024)}MB</div>
                              </div>
                            </div>
                            <button
                              onClick={() => deleteSession(session.id)}
                              className="ml-4 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded flex items-center gap-1 transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <h2 className="text-xl font-semibold text-white mb-4">Preview</h2>
            
            <div className="space-y-4">
              <div className="bg-black rounded-lg overflow-hidden aspect-video flex items-center justify-center">
                {videoUrl ? (
                  <video src={videoUrl} controls className="w-full h-full" />
                ) : snapshots.length > 0 ? (
                  <img
                    src={snapshots[snapshots.length - 1].url}
                    alt="Latest snapshot"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <p className="text-gray-400">No preview available</p>
                )}
              </div>

              {snapshots.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-white mb-2">
                    Recent Snapshots ({snapshots.length} total)
                  </h3>
                  <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto">
                    {snapshots.slice(-12).reverse().map((snap) => (
                      <img
                        key={snap.timestamp}
                        src={snap.url}
                        alt="Snapshot"
                        className="w-full aspect-video object-cover rounded border border-white/20"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
