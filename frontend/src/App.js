import React, { useState, useRef, useEffect } from 'react';
import { Play, Square, Download, Settings, CheckCircle, XCircle } from 'lucide-react';

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
  
  const wsRef = useRef(null);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8 text-center">
          RTSP Timelapse Creator
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                  download
                  className="block w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-center transition-colors"
                >
                  <Download className="w-5 h-5 inline mr-2" />
                  Download Video
                </a>
              )}
            </div>
          </div>

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
