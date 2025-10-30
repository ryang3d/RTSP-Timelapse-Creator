import React, { useState, useRef, useEffect } from 'react';
import { Play, Square, Download, Settings, CheckCircle, XCircle, Upload, FolderOpen, Wifi, Database, Trash2, Camera, Monitor, Globe, Radio, ChevronDown, Clock, Zap } from 'lucide-react';
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
  const [outputFormat, setOutputFormat] = useState('mp4');
  const [processing, setProcessing] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [generatedFormat, setGeneratedFormat] = useState('mp4');
  const [sessionId, setSessionId] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [testing, setTesting] = useState(false);
  
  // Photo upload/import states
  const [activeTab, setActiveTab] = useState('rtsp');
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [networkPath, setNetworkPath] = useState('');
  const [childDirectories, setChildDirectories] = useState([]);
  const [selectedChildDirectory, setSelectedChildDirectory] = useState('');
  const [loadingDirectories, setLoadingDirectories] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // New navigation states
  const [selectedSource, setSelectedSource] = useState('rtsp');
  const [selectedTrigger, setSelectedTrigger] = useState('timed');
  const [sourceDropdownOpen, setSourceDropdownOpen] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  
  // MQTT states
  const [mqttBrokerUrl, setMqttBrokerUrl] = useState('');
  const [mqttPort, setMqttPort] = useState(1883);
  const [mqttTopic, setMqttTopic] = useState('');
  const [mqttUsername, setMqttUsername] = useState('');
  const [mqttPassword, setMqttPassword] = useState('');
  const [mqttRtspUrl, setMqttRtspUrl] = useState('');
  const [mqttUseSharedUrl, setMqttUseSharedUrl] = useState(false);
  const [mqttConnected, setMqttConnected] = useState(false);
  const [mqttLastMessage, setMqttLastMessage] = useState('');
  const [mqttTesting, setMqttTesting] = useState(false);
  const [mqttConnectionStatus, setMqttConnectionStatus] = useState(null);
  const [testingMqttConnection, setTestingMqttConnection] = useState(false);

  // NEW: Universal source states
  const [usbDevicePath, setUsbDevicePath] = useState('/dev/video0');
  const [usbResolution, setUsbResolution] = useState('1920x1080');
  const [usbFormat, setUsbFormat] = useState('mjpeg');
  const [usbFps, setUsbFps] = useState(30);

  const [captureCardDevicePath, setCaptureCardDevicePath] = useState('/dev/video1');
  const [captureCardResolution, setCaptureCardResolution] = useState('1920x1080');
  const [captureCardFormat, setCaptureCardFormat] = useState('yuyv');
  const [captureCardFps, setCaptureCardFps] = useState(30);

  const [httpStreamUrl, setHttpStreamUrl] = useState('');
  const [httpStreamFormat, setHttpStreamFormat] = useState('mjpeg');

  const [rtmpStreamUrl, setRtmpStreamUrl] = useState('');

  const [screenDisplay, setScreenDisplay] = useState(':0.0');
  const [screenRegion, setScreenRegion] = useState('');

  // Device enumeration states
  const [availableDevices, setAvailableDevices] = useState(null);
  const [loadingDevices, setLoadingDevices] = useState(false);

  // MQTT source selection
  const [mqttHttpUrl, setMqttHttpUrl] = useState('');
  const [mqttRtmpUrl, setMqttRtmpUrl] = useState('');
  const [mqttUsbDevice, setMqttUsbDevice] = useState('/dev/video0');
  const [mqttCaptureCardDevice, setMqttCaptureCardDevice] = useState('/dev/video1');
  const [mqttScreenDisplay, setMqttScreenDisplay] = useState(':0.0');
  
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
            setGeneratedFormat(data.format || 'mp4');
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
    const sourceConfig = {};

    // Build source configuration based on active tab
    switch (activeTab) {
      case 'rtsp':
        sourceConfig.rtspUrl = url;
        break;
      case 'video_devices':
        sourceConfig.devicePath = usbDevicePath;
        sourceConfig.resolution = usbResolution;
        sourceConfig.format = usbFormat;
        sourceConfig.fps = usbFps;
        break;
      case 'http':
        sourceConfig.httpUrl = httpStreamUrl;
        sourceConfig.streamFormat = httpStreamFormat;
        break;
      case 'rtmp':
        sourceConfig.rtmpUrl = rtmpStreamUrl;
        break;
      case 'screen':
        sourceConfig.display = screenDisplay;
        sourceConfig.region = screenRegion;
        break;
      default:
        alert('Unsupported source type');
        return;
    }

    try {
      const response = await fetch(`${API_URL}/api/start-capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceType: activeTab === 'rtsp' ? 'rtsp' :
                      activeTab === 'video_devices' ? 'usb_camera' :
                      activeTab === 'http' ? 'http_stream' :
                      activeTab === 'rtmp' ? 'rtmp_stream' :
                      activeTab === 'screen' ? 'screen_capture' : 'rtsp',
          sourceConfig,
          interval,
          duration,
          useTimer
        })
      });

      const data = await response.json();

      if (data.success) {
        setSessionId(data.sessionId);
        setIsCapturing(true);
        setSnapshots([]);
        setVideoUrl('');
      } else {
        alert('Failed to start capture: ' + data.message);
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
        body: JSON.stringify({ sessionId, fps, format: outputFormat })
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

  const loadChildDirectories = async (parentPath) => {
    setLoadingDirectories(true);
    try {
      const response = await fetch(`${API_URL}/api/list-child-directories?parentPath=${encodeURIComponent(parentPath || '')}`);
      const data = await response.json();

      if (data.success) {
        // If we get a defaultParentPath and current path is empty, use it
        if (data.defaultParentPath && !parentPath) {
          setNetworkPath(data.defaultParentPath);
          setChildDirectories(data.childDirectories || []);
        } else {
          setChildDirectories(data.childDirectories || []);
          if (data.parentPath) {
            setNetworkPath(data.parentPath);
          }
        }
        setSelectedChildDirectory('');
      } else {
        alert('Failed to load child directories: ' + data.message);
        setChildDirectories([]);
      }
    } catch (error) {
      alert('Error loading child directories: ' + error.message);
      setChildDirectories([]);
    } finally {
      setLoadingDirectories(false);
    }
  };

  const handleImportFromPath = async () => {
    if (!networkPath.trim()) {
      alert('Please enter a parent directory path');
      return;
    }

    if (!selectedChildDirectory) {
      alert('Please select a child directory');
      return;
    }

    setImporting(true);
    try {
      const response = await fetch(`${API_URL}/api/import-from-path`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentPath: networkPath.trim(),
          childDirectory: selectedChildDirectory,
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
        setSelectedChildDirectory('');
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
  const testMqttConnection = async () => {
    const rtspUrlToTest = mqttUseSharedUrl ? url : mqttRtspUrl;
    
    if (!rtspUrlToTest) {
      alert('Please enter an RTSP URL');
      return;
    }

    setTestingMqttConnection(true);
    setMqttConnectionStatus(null);

    try {
      const response = await fetch(`${API_URL}/api/test-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: rtspUrlToTest })
      });

      const data = await response.json();
      setMqttConnectionStatus(data.success ? 'success' : 'error');
    } catch (error) {
      setMqttConnectionStatus('error');
    } finally {
      setTestingMqttConnection(false);
    }
  };

  const startMqttCapture = async () => {
    if (!mqttBrokerUrl || !mqttTopic) {
      alert('Please enter broker URL and topic');
      return;
    }

    // Ensure broker URL has protocol prefix
    let brokerUrl = mqttBrokerUrl.trim();
    if (!brokerUrl.startsWith('mqtt://') && !brokerUrl.startsWith('mqtts://') && !brokerUrl.startsWith('ws://') && !brokerUrl.startsWith('wss://')) {
      brokerUrl = 'mqtt://' + brokerUrl;
    }

    // Build source configuration based on selected source
    const sourceConfig = {};
    let sourceType = selectedSource;

    switch (selectedSource) {
      case 'rtsp':
        sourceConfig.rtspUrl = mqttUseSharedUrl ? url : mqttRtspUrl;
        if (!sourceConfig.rtspUrl) {
          alert('Please enter RTSP URL');
          return;
        }
        break;
      case 'video_devices':
        sourceConfig.devicePath = mqttUsbDevice;
        sourceConfig.resolution = '1920x1080';
        sourceConfig.format = 'mjpeg';
        sourceConfig.fps = 30;
        sourceType = 'usb_camera';
        break;
      case 'http':
        sourceConfig.httpUrl = mqttHttpUrl;
        sourceConfig.streamFormat = 'mjpeg';
        if (!sourceConfig.httpUrl) {
          alert('Please enter HTTP stream URL');
          return;
        }
        sourceType = 'http_stream';
        break;
      case 'rtmp':
        sourceConfig.rtmpUrl = mqttRtmpUrl;
        if (!sourceConfig.rtmpUrl) {
          alert('Please enter RTMP stream URL');
          return;
        }
        sourceType = 'rtmp_stream';
        break;
      case 'screen':
        sourceConfig.display = mqttScreenDisplay;
        sourceConfig.region = '';
        sourceType = 'screen_capture';
        break;
      default:
        alert('Unsupported MQTT source type');
        return;
    }

    try {
      const response = await fetch(`${API_URL}/api/start-mqtt-capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brokerUrl: brokerUrl,
          port: mqttPort,
          topic: mqttTopic,
          username: mqttUsername || undefined,
          password: mqttPassword || undefined,
          sourceType: sourceType,
          sourceConfig: sourceConfig,
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

  const resumeSession = async (session) => {
    try {
      // Fetch session details including snapshots
      const response = await fetch(`${API_URL}/api/session/${session.id}`);
      const data = await response.json();
      
      if (data.success) {
        // Set session ID
        setSessionId(session.id);
        
        // Load snapshots
        const snapshotUrls = data.session.snapshots.map(snap => ({
          url: `${API_URL}${snap.file_path}`,
          timestamp: new Date(snap.captured_at).getTime(),
          capturedAt: new Date(snap.captured_at).toLocaleString()
        }));
        setSnapshots(snapshotUrls);
        
        // Check if there's a video
        const videoPath = `/videos/timelapse-${session.id}.mp4`;
        try {
          const videoCheck = await fetch(`${API_URL}${videoPath}`, { method: 'HEAD' });
          if (videoCheck.ok) {
            setVideoUrl(`${API_URL}${videoPath}`);
          } else {
            setVideoUrl('');
          }
        } catch {
          setVideoUrl('');
        }
        
        // Switch to appropriate tab based on source type
        switch (session.source_type) {
          case 'rtsp':
            setActiveTab('rtsp');
            if (session.rtsp_url) {
              setUrl(session.rtsp_url);
            }
            // If session is active, show stop button so user can stop it
            setIsCapturing(session.active ? true : false);
            break;
          case 'upload':
            setActiveTab('upload');
            setUploadedFiles(data.session.snapshots.map(snap => ({
              path: snap.file_path,
              thumbnail: snap.file_path,
              size: snap.file_size
            })));
            break;
          case 'import':
            setActiveTab('import');
            setUploadedFiles(data.session.snapshots.map(snap => ({
              path: snap.file_path,
              thumbnail: snap.file_path,
              size: snap.file_size
            })));
            break;
          case 'mqtt':
            setActiveTab('mqtt');
            // If MQTT session is active, show it as connected
            setMqttConnected(session.active ? true : false);
            setMqttTesting(session.active ? true : false);
            break;
          default:
            setActiveTab('rtsp');
        }
        
        alert(`Resumed session ${session.id.substring(0, 8)}... with ${snapshotUrls.length} snapshots`);
      } else {
        alert('Failed to load session: ' + data.message);
      }
    } catch (error) {
      alert('Error resuming session: ' + error.message);
    }
  };

  const stopSession = async (sessionId) => {
    if (!window.confirm('Are you sure you want to stop this session? This will end the active capture.')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/stop-capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });

      const data = await response.json();
      if (data.success) {
        await loadSessions();
        await loadStorageStats();
        alert('Session stopped successfully');
      } else {
        alert('Failed to stop session: ' + data.message);
      }
    } catch (error) {
      alert('Error stopping session: ' + error.message);
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
    if (showSessions) {
      loadSessions();
      loadStorageStats();
    }
  }, [showSessions]);

  // Load default parent directory when import tab is selected
  useEffect(() => {
    if (selectedSource === 'import') {
      loadChildDirectories('');
    }
  }, [selectedSource]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load available devices when relevant tabs are selected
  useEffect(() => {
    if (['video_devices', 'screen', 'mqtt'].includes(activeTab) || ['video_devices', 'screen'].includes(selectedSource)) {
      loadAvailableDevices();
    }
  }, [activeTab, selectedSource]);

  // Load available devices
  const loadAvailableDevices = async () => {
    setLoadingDevices(true);
    try {
      const response = await fetch(`${API_URL}/api/list-devices`);
      const data = await response.json();

      if (data.success) {
        setAvailableDevices(data.devices);
      }
    } catch (error) {
      console.error('Error loading devices:', error);
    } finally {
      setLoadingDevices(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-slate-100 mb-8 text-center">
          📹 Timelapse Creator
        </h1>

        {/* New Navigation */}
        <div className="flex justify-center mb-8 relative z-50">
          <div className="bg-slate-800/50 backdrop-blur-lg rounded-lg p-1 border border-slate-700 flex gap-2">
            {/* Input Sources Dropdown */}
            <div className="relative">
              <button
                onClick={() => setSourceDropdownOpen(!sourceDropdownOpen)}
                className="px-4 py-2 rounded-md transition-colors whitespace-nowrap bg-slate-600 text-slate-100 flex items-center gap-2"
              >
                {selectedSource === 'rtsp' && <><Settings className="w-4 h-4" /> RTSP Stream</>}
                {selectedSource === 'video_devices' && <><Camera className="w-4 h-4" /> Video Devices</>}
                {selectedSource === 'http' && <><Globe className="w-4 h-4" /> HTTP Stream</>}
                {selectedSource === 'rtmp' && <><Radio className="w-4 h-4" /> RTMP Stream</>}
                {selectedSource === 'screen' && <><Monitor className="w-4 h-4" /> Screen Capture</>}
                {selectedSource === 'upload' && <><Upload className="w-4 h-4" /> Upload Photos</>}
                {selectedSource === 'import' && <><FolderOpen className="w-4 h-4" /> Import from Path</>}
                <ChevronDown className="w-4 h-4" />
              </button>

              {sourceDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 bg-slate-700 rounded-lg border border-slate-600 min-w-full z-50">
                  <button
                    onClick={() => { setSelectedSource('rtsp'); setSourceDropdownOpen(false); }}
                    className="w-full px-4 py-2 text-left hover:bg-slate-600 text-slate-100 flex items-center gap-2 first:rounded-t-lg"
                  >
                    <Settings className="w-4 h-4" />
                    RTSP Stream
                  </button>
                  <button
                    onClick={() => { setSelectedSource('video_devices'); setSourceDropdownOpen(false); }}
                    className="w-full px-4 py-2 text-left hover:bg-slate-600 text-slate-100 flex items-center gap-2"
                  >
                    <Camera className="w-4 h-4" />
                    Video Devices
                  </button>
                  <button
                    onClick={() => { setSelectedSource('http'); setSourceDropdownOpen(false); }}
                    className="w-full px-4 py-2 text-left hover:bg-slate-600 text-slate-100 flex items-center gap-2"
                  >
                    <Globe className="w-4 h-4" />
                    HTTP Stream
                  </button>
                  <button
                    onClick={() => { setSelectedSource('rtmp'); setSourceDropdownOpen(false); }}
                    className="w-full px-4 py-2 text-left hover:bg-slate-600 text-slate-100 flex items-center gap-2"
                  >
                    <Radio className="w-4 h-4" />
                    RTMP Stream
                  </button>
                  <button
                    onClick={() => { setSelectedSource('screen'); setSourceDropdownOpen(false); }}
                    className="w-full px-4 py-2 text-left hover:bg-slate-600 text-slate-100 flex items-center gap-2"
                  >
                    <Monitor className="w-4 h-4" />
                    Screen Capture
                  </button>
                  <button
                    onClick={() => { setSelectedSource('upload'); setSourceDropdownOpen(false); }}
                    className="w-full px-4 py-2 text-left hover:bg-slate-600 text-slate-100 flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Photos
                  </button>
                  <button
                    onClick={() => { setSelectedSource('import'); setSourceDropdownOpen(false); }}
                    className="w-full px-4 py-2 text-left hover:bg-slate-600 text-slate-100 flex items-center gap-2 last:rounded-b-lg"
                  >
                    <FolderOpen className="w-4 h-4" />
                    Import from Path
                  </button>
                </div>
              )}
            </div>

            {/* Trigger Type Selector - Only show for live sources */}
            {(selectedSource === 'rtsp' || selectedSource === 'video_devices' || selectedSource === 'http' || selectedSource === 'rtmp' || selectedSource === 'screen') && (
              <div className="flex bg-slate-700/50 rounded-md p-1">
                <button
                  onClick={() => setSelectedTrigger('timed')}
                  className={`px-3 py-1 rounded transition-colors flex items-center gap-1 ${
                    selectedTrigger === 'timed'
                      ? 'bg-slate-600 text-slate-100'
                      : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  <Clock className="w-3 h-3" />
                  Timed
                </button>
                <button
                  onClick={() => setSelectedTrigger('mqtt')}
                  className={`px-3 py-1 rounded transition-colors flex items-center gap-1 ${
                    selectedTrigger === 'mqtt'
                      ? 'bg-slate-600 text-slate-100'
                      : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  <Zap className="w-3 h-3" />
                  MQTT
                </button>
              </div>
            )}

            {/* Static tabs for non-live sources */}
            <button
              onClick={() => setShowSessions(!showSessions)}
              className={`px-4 py-2 rounded-md transition-colors whitespace-nowrap ${
                showSessions
                  ? 'bg-slate-600 text-slate-100'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              <Database className="w-4 h-4 inline mr-2" />
              Sessions
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Live Source Content - Combined with trigger type */}
          {!showSessions && (selectedSource === 'video_devices' || (activeTab === 'video_devices' && selectedTrigger === 'timed')) && selectedTrigger === 'timed' && (
            <div className="bg-slate-800/50 backdrop-blur-lg rounded-xl p-6 border border-slate-700">
              <h2 className="text-xl font-semibold text-slate-100 mb-4 flex items-center gap-2">
                <Camera className="w-5 h-5" />
                Video Device Configuration
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-100 mb-2">
                    Video Device
                  </label>
                  <select
                    value={usbDevicePath}
                    onChange={(e) => setUsbDevicePath(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-500"
                  >
                    {loadingDevices ? (
                      <option>Loading devices...</option>
                    ) : availableDevices?.usbCameras?.length > 0 || availableDevices?.captureCards?.length > 0 ? (
                      <>
                        {availableDevices.usbCameras?.map((device) => (
                          <option key={device.path} value={device.path}>
                            {device.name} (Camera)
                          </option>
                        ))}
                        {availableDevices.captureCards?.map((device) => (
                          <option key={device.path} value={device.path}>
                            {device.name} (Capture Card)
                          </option>
                        ))}
                      </>
                    ) : (
                      <>
                        <option value="/dev/video0">/dev/video0 (Default)</option>
                        <option value="/dev/video1">/dev/video1 (Default)</option>
                      </>
                    )}
                  </select>
                  <p className="text-xs text-slate-400 mt-1">
                    Select any available video device (USB cameras, webcams, capture cards, etc.)
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-100 mb-2">
                      Resolution
                    </label>
                    <select
                      value={usbResolution}
                      onChange={(e) => setUsbResolution(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-500"
                    >
                      <option value="640x480">640x480 (VGA)</option>
                      <option value="720x480">720x480 (NTSC)</option>
                      <option value="720x576">720x576 (PAL)</option>
                      <option value="1280x720">1280x720 (HD)</option>
                      <option value="1920x1080">1920x1080 (Full HD)</option>
                      <option value="3840x2160">3840x2160 (4K)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-100 mb-2">
                      Format
                    </label>
                    <select
                      value={usbFormat}
                      onChange={(e) => setUsbFormat(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-500"
                    >
                      <option value="mjpeg">MJPEG</option>
                      <option value="yuyv">YUYV</option>
                      <option value="h264">H.264</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-100 mb-2">
                    FPS
                  </label>
                  <input
                    type="number"
                    value={usbFps}
                    onChange={(e) => setUsbFps(Math.max(1, parseInt(e.target.value) || 30))}
                    min="1"
                    max="60"
                    className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-500"
                  />
                </div>

                <div className="flex gap-2">
                  {!isCapturing ? (
                    <button
                      onClick={startCapture}
                      className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors"
                    >
                      <Play className="w-5 h-5" />
                      Start Video Capture
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

                <div className="grid grid-cols-2 gap-4">
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
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">Output Format</label>
                    <select
                      value={outputFormat}
                      onChange={(e) => setOutputFormat(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-800 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="mp4">MP4 Video</option>
                      <option value="gif">GIF Animation</option>
                    </select>
                  </div>
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

                {videoUrl && sessionId && (
                  <a
                    href={`${API_URL}/api/download/video/${sessionId}`}
                    className="block w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-center transition-colors"
                  >
                    <Download className="w-5 h-5 inline mr-2" />
                    Download Video
                  </a>
                )}
              </div>
            </div>
          )}

          {/* HTTP Stream Tab Content - Timed */}
          {!showSessions && selectedSource === 'http' && selectedTrigger === 'timed' && (
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Globe className="w-5 h-5" />
                HTTP Stream Configuration
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Stream URL
                  </label>
                  <input
                    type="text"
                    value={httpStreamUrl}
                    onChange={(e) => setHttpStreamUrl(e.target.value)}
                    placeholder="http://camera.example.com/mjpeg"
                    className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Stream Format
                  </label>
                  <select
                    value={httpStreamFormat}
                    onChange={(e) => setHttpStreamFormat(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="mjpeg">MJPEG</option>
                    <option value="hls">HLS (m3u8)</option>
                    <option value="dash">DASH</option>
                  </select>
                </div>

                <div className="flex gap-2">
                  {!isCapturing ? (
                    <button
                      onClick={startCapture}
                      disabled={!httpStreamUrl}
                      className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors"
                    >
                      <Play className="w-5 h-5" />
                      Start HTTP Capture
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

                <div className="grid grid-cols-2 gap-4">
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
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">Output Format</label>
                    <select
                      value={outputFormat}
                      onChange={(e) => setOutputFormat(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-800 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="mp4">MP4 Video</option>
                      <option value="gif">GIF Animation</option>
                    </select>
                  </div>
                </div>

                <div className="text-center text-slate-100">
                  <p className="text-sm">Snapshots captured: {snapshots.length}</p>
                </div>

                <button
                  onClick={generateTimelapse}
                  disabled={snapshots.length < 2 || processing || isCapturing}
                  className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
                >
                  {processing ? 'Processing...' : 'Generate Timelapse'}
                </button>

                {videoUrl && sessionId && (
                  <a
                    href={`${API_URL}/api/download/video/${sessionId}`}
                    className="block w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-center transition-colors"
                  >
                    <Download className="w-5 h-5 inline mr-2" />
                    Download Video
                  </a>
                )}
              </div>
            </div>
          )}

          {/* RTMP Stream Tab Content - Timed */}
          {!showSessions && selectedSource === 'rtmp' && selectedTrigger === 'timed' && (
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Radio className="w-5 h-5" />
                RTMP Stream Configuration
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    RTMP URL
                  </label>
                  <input
                    type="text"
                    value={rtmpStreamUrl}
                    onChange={(e) => setRtmpStreamUrl(e.target.value)}
                    placeholder="rtmp://server/app/stream"
                    className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="flex gap-2">
                  {!isCapturing ? (
                    <button
                      onClick={startCapture}
                      disabled={!rtmpStreamUrl}
                      className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors"
                    >
                      <Play className="w-5 h-5" />
                      Start RTMP Capture
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

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-100 mb-2">Timelapse FPS</label>
                    <input
                      type="number"
                      value={fps}
                      onChange={(e) => setFps(Math.max(1, Math.min(60, parseInt(e.target.value) || 30)))}
                      min="1"
                      max="60"
                      className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-100 mb-2">Output Format</label>
                    <select
                      value={outputFormat}
                      onChange={(e) => setOutputFormat(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-500"
                    >
                      <option value="mp4">MP4 Video</option>
                      <option value="gif">GIF Animation</option>
                    </select>
                  </div>
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

                {videoUrl && sessionId && (
                  <a
                    href={`${API_URL}/api/download/video/${sessionId}`}
                    className="block w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-center transition-colors"
                  >
                    <Download className="w-5 h-5 inline mr-2" />
                    Download Video
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Screen Capture Tab Content - Timed */}
          {!showSessions && selectedSource === 'screen' && selectedTrigger === 'timed' && (
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Monitor className="w-5 h-5" />
                Screen Capture Configuration
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Display
                  </label>
                  <select
                    value={screenDisplay}
                    onChange={(e) => setScreenDisplay(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {availableDevices?.screens?.length > 0 ? (
                      availableDevices.screens.map((screen) => (
                        <option key={screen.display} value={screen.display}>
                          {screen.name}
                        </option>
                      ))
                    ) : (
                      <option value=":0.0">:0.0 (Primary Display)</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Region (optional)
                  </label>
                  <input
                    type="text"
                    value={screenRegion}
                    onChange={(e) => setScreenRegion(e.target.value)}
                    placeholder="1920x1080+0+0"
                    className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Format: WIDTHxHEIGHT+X+Y (leave empty for full screen)
                  </p>
                </div>

                <div className="flex gap-2">
                  {!isCapturing ? (
                    <button
                      onClick={startCapture}
                      className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors"
                    >
                      <Play className="w-5 h-5" />
                      Start Screen Capture
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

                <div className="grid grid-cols-2 gap-4">
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
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">Output Format</label>
                    <select
                      value={outputFormat}
                      onChange={(e) => setOutputFormat(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-800 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="mp4">MP4 Video</option>
                      <option value="gif">GIF Animation</option>
                    </select>
                  </div>
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

                {videoUrl && sessionId && (
                  <a
                    href={`${API_URL}/api/download/video/${sessionId}`}
                    className="block w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-center transition-colors"
                  >
                    <Download className="w-5 h-5 inline mr-2" />
                    Download Video
                  </a>
                )}
              </div>
            </div>
          )}

          {/* RTSP Tab Content - Timed */}
          {!showSessions && selectedSource === 'rtsp' && selectedTrigger === 'timed' && (
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

              <div className="grid grid-cols-2 gap-4">
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
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Output Format</label>
                  <select
                    value={outputFormat}
                    onChange={(e) => setOutputFormat(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="mp4">MP4 Video</option>
                    <option value="gif">GIF Animation</option>
                  </select>
                </div>
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

              {videoUrl && sessionId && (
                <a
                  href={`${API_URL}/api/download/video/${sessionId}`}
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
          {!showSessions && selectedSource === 'upload' && (
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
                          alt={`Uploaded photo ${index + 1}`}
                          className="w-full aspect-video object-cover rounded border border-white/20"
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
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
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">Output Format</label>
                    <select
                      value={outputFormat}
                      onChange={(e) => setOutputFormat(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-800 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="mp4">MP4 Video</option>
                      <option value="gif">GIF Animation</option>
                    </select>
                  </div>
                </div>

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

                {videoUrl && sessionId && (
                  <a
                    href={`${API_URL}/api/download/video/${sessionId}`}
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
          {!showSessions && selectedSource === 'import' && (
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <FolderOpen className="w-5 h-5" />
                Import from Directory
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Parent Directory Path
                  </label>
                  <input
                    type="text"
                    value={networkPath}
                    onChange={(e) => {
                      setNetworkPath(e.target.value);
                      loadChildDirectories(e.target.value);
                    }}
                    placeholder="/path/to/parent/directory"
                    className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Enter the parent directory path. If IMPORT_PARENT_PATH is set in environment, it will auto-populate.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Child Directory
                  </label>
                  <select
                    value={selectedChildDirectory}
                    onChange={(e) => setSelectedChildDirectory(e.target.value)}
                    disabled={loadingDirectories || childDirectories.length === 0}
                    className="w-full px-4 py-2 bg-gray-800 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                  >
                    <option value="">
                      {loadingDirectories ? 'Loading directories...' : 'Select a child directory'}
                    </option>
                    {childDirectories.map((dir) => (
                      <option key={dir} value={dir}>
                        {dir}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    Select the child directory containing your image files
                  </p>
                </div>

                <button
                  onClick={handleImportFromPath}
                  disabled={!networkPath.trim() || !selectedChildDirectory || importing}
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
                          alt={`Imported photo ${index + 1}`}
                          className="w-full aspect-video object-cover rounded border border-white/20"
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
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
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">Output Format</label>
                    <select
                      value={outputFormat}
                      onChange={(e) => setOutputFormat(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-800 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="mp4">MP4 Video</option>
                      <option value="gif">GIF Animation</option>
                    </select>
                  </div>
                </div>

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

                {videoUrl && sessionId && (
                  <a
                    href={`${API_URL}/api/download/video/${sessionId}`}
                    className="block w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-center transition-colors"
                  >
                    <Download className="w-5 h-5 inline mr-2" />
                    Download Video
                  </a>
                )}
              </div>
            </div>
          )}

          {/* MQTT Tab Content - For MQTT trigger */}
          {!showSessions && selectedTrigger === 'mqtt' && (selectedSource === 'rtsp' || selectedSource === 'video_devices' || selectedSource === 'http' || selectedSource === 'rtmp' || selectedSource === 'screen') && (
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Wifi className="w-5 h-5" />
                MQTT Trigger Configuration - {selectedSource.replace('_', ' ').toUpperCase()}
              </h2>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-100 mb-2">
                      MQTT Broker URL
                    </label>
                    <input
                      type="text"
                      value={mqttBrokerUrl}
                      onChange={(e) => setMqttBrokerUrl(e.target.value)}
                      placeholder="broker.example.com"
                      className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-100 mb-2">
                      Port
                    </label>
                    <input
                      type="number"
                      value={mqttPort}
                      onChange={(e) => setMqttPort(Math.max(1, Math.min(65535, parseInt(e.target.value) || 1883)))}
                      min="1"
                      max="65535"
                      placeholder="1883"
                      className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500"
                    />
                  </div>
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


                {/* Dynamic source configuration based on selected type */}
                {selectedSource === 'rtsp' && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        checked={mqttUseSharedUrl}
                        onChange={(e) => setMqttUseSharedUrl(e.target.checked)}
                        className="w-4 h-4 rounded"
                      />
                      <label className="text-sm font-medium text-white">Use RTSP URL from Stream tab</label>
                    </div>
                    <label className="block text-sm font-medium text-white mb-2">
                      RTSP Stream URL
                    </label>
                    <input
                      type="text"
                      value={mqttUseSharedUrl ? url : mqttRtspUrl}
                      onChange={(e) => setMqttRtspUrl(e.target.value)}
                      disabled={mqttUseSharedUrl}
                      placeholder="rtsp://username:password@camera.example.com:554/stream"
                      className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                )}

                {selectedSource === 'video_devices' && (
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Video Device
                    </label>
                    <select
                      value={mqttUsbDevice}
                      onChange={(e) => setMqttUsbDevice(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-800 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      {availableDevices?.usbCameras?.length > 0 || availableDevices?.captureCards?.length > 0 ? (
                        <>
                          {availableDevices.usbCameras?.map((device) => (
                            <option key={device.path} value={device.path}>
                              {device.name} (Camera)
                            </option>
                          ))}
                          {availableDevices.captureCards?.map((device) => (
                            <option key={device.path} value={device.path}>
                              {device.name} (Capture Card)
                            </option>
                          ))}
                        </>
                      ) : (
                        <>
                          <option value="/dev/video0">/dev/video0 (Default)</option>
                          <option value="/dev/video1">/dev/video1 (Default)</option>
                        </>
                      )}
                    </select>
                  </div>
                )}

                {selectedSource === 'http' && (
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      HTTP Stream URL
                    </label>
                    <input
                      type="text"
                      value={mqttHttpUrl}
                      onChange={(e) => setMqttHttpUrl(e.target.value)}
                      placeholder="http://camera.example.com/mjpeg"
                      className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                )}

                {selectedSource === 'rtmp' && (
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      RTMP Stream URL
                    </label>
                    <input
                      type="text"
                      value={mqttRtmpUrl}
                      onChange={(e) => setMqttRtmpUrl(e.target.value)}
                      placeholder="rtmp://server/app/stream"
                      className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                )}

                {selectedSource === 'screen' && (
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Display
                    </label>
                    <select
                      value={mqttScreenDisplay}
                      onChange={(e) => setMqttScreenDisplay(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-800 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      {availableDevices?.screens?.length > 0 ? (
                        availableDevices.screens.map((screen) => (
                          <option key={screen.display} value={screen.display}>
                            {screen.name}
                          </option>
                        ))
                      ) : (
                        <option value=":0.0">:0.0 (Primary Display)</option>
                      )}
                    </select>
                  </div>
                )}

                {/* Test connection button for the selected source */}
                {(selectedSource === 'rtsp' || selectedSource === 'http') && (
                  <button
                    onClick={testMqttConnection}
                    disabled={testingMqttConnection || (selectedSource === 'rtsp' && !mqttUseSharedUrl && !mqttRtspUrl) || (selectedSource === 'rtsp' && mqttUseSharedUrl && !url) || (selectedSource === 'http' && !mqttHttpUrl)}
                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors"
                  >
                    {testingMqttConnection ? 'Testing...' : `Test ${selectedSource.toUpperCase()} Connection`}
                    {mqttConnectionStatus === 'success' && <CheckCircle className="w-5 h-5 text-green-400" />}
                    {mqttConnectionStatus === 'error' && <XCircle className="w-5 h-5 text-red-400" />}
                  </button>
                )}

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
                    The system will capture a photo from the selected video source when the MQTT message changes from '1' to '0' on the specified topic.
                    This works with any live video source: RTSP streams, USB cameras, capture cards, HTTP streams, RTMP streams, or screen capture.
                  </p>
                </div>

                <div className="flex gap-2">
                  {!mqttConnected ? (
                    <button
                      onClick={startMqttCapture}
                      disabled={!mqttBrokerUrl || !mqttTopic || mqttTesting}
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
                    <p className="text-sm text-green-200 mt-1">
                      Source: <code className="bg-green-500/20 px-1 rounded">{selectedSource.replace('_', ' ').toUpperCase()}</code>
                    </p>
                    {mqttLastMessage && (
                      <p className="text-sm text-green-200 mt-1">
                        Last message: <code className="bg-green-500/20 px-1 rounded">{mqttLastMessage}</code>
                      </p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
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
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">Output Format</label>
                    <select
                      value={outputFormat}
                      onChange={(e) => setOutputFormat(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-800 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="mp4">MP4 Video</option>
                      <option value="gif">GIF Animation</option>
                    </select>
                  </div>
                </div>

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

                {videoUrl && sessionId && (
                  <a
                    href={`${API_URL}/api/download/video/${sessionId}`}
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
          {showSessions && (
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 col-span-full">
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

                {/* Active Sessions Notice */}
                {sessions.filter(s => s.active).length > 0 && (
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-green-300 mb-2">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-semibold">
                        {sessions.filter(s => s.active).length} Active Session(s)
                      </span>
                    </div>
                    <p className="text-sm text-green-200">
                      You have active capture sessions running. Resume them to stop capturing or generate timelapses.
                    </p>
                  </div>
                )}

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
                                <div>Source: {session.source_type}</div>
                                <div>Snapshots: {session.snapshot_count}</div>
                                <div>Videos: {session.video_count}</div>
                                <div>Size: {Math.round((session.total_snapshot_size || 0) / 1024 / 1024)}MB</div>
                              </div>
                            </div>
                            <div className="ml-4 flex gap-2">
                              {session.active && (
                                <button
                                  onClick={() => stopSession(session.id)}
                                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded flex items-center gap-1 transition-colors"
                                >
                                  <Square className="w-3 h-3" />
                                  Stop
                                </button>
                              )}
                              <button
                                onClick={() => resumeSession(session)}
                                className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded flex items-center gap-1 transition-colors"
                              >
                                <Play className="w-3 h-3" />
                                {session.active ? 'Resume' : 'Open'}
                              </button>
                              {session.video_count > 0 && (
                                <a
                                  href={`${API_URL}/api/download/video/${session.id}`}
                                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded flex items-center gap-1 transition-colors"
                                >
                                  <Download className="w-3 h-3" />
                                  Download Video
                                </a>
                              )}
                              {session.snapshot_count > 0 && (
                                <a
                                  href={`${API_URL}/api/download/photos/${session.id}`}
                                  className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded flex items-center gap-1 transition-colors"
                                >
                                  <Download className="w-3 h-3" />
                                  Download Photos
                                </a>
                              )}
                              <button
                                onClick={() => deleteSession(session.id)}
                                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded flex items-center gap-1 transition-colors"
                              >
                                <Trash2 className="w-3 h-3" />
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {!showSessions && (
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
                    Recent Snapshots ({snapshots.length} total) - Ordered by capture time
                  </h3>
                  <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto">
                    {snapshots.slice(-12).reverse().map((snap) => (
                      <div key={snap.timestamp} className="relative group">
                        <img
                          src={snap.url}
                          alt="Snapshot"
                          className="w-full aspect-video object-cover rounded border border-white/20"
                        />
                        {snap.capturedAt && (
                          <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-1 rounded-b opacity-0 group-hover:opacity-100 transition-opacity">
                            {snap.capturedAt}
                          </div>
                        )}
                        {/* Download button overlay */}
                        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              const filename = snap.url.split('/').pop();
                              const link = document.createElement('a');
                              link.href = `${API_URL}/api/download/photo/${sessionId}/${filename}`;
                              link.download = filename;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white p-1 rounded-full shadow-lg"
                            title="Download this photo"
                          >
                            <Download className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Download all photos button */}
                  <div className="mt-4 flex justify-center">
                    <a
                      href={`${API_URL}/api/download/photos/${sessionId}`}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Download All Photos (ZIP)
                    </a>
                  </div>
                </div>
              )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-8 text-center text-slate-400 text-sm">
        <p>
          Dreamt up by{' '}
          <a
            href="https://rg3d.me"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-300 hover:text-slate-200 transition-colors"
          >
            rg3d.me
          </a>
        </p>
      </footer>
    </div>
  );
}

export default App;
