import React, { useState, useRef, useCallback } from 'react';
import { Upload, Film, Activity, Users, Clock, ChevronLeft, Loader, Sparkles, BarChart2, MapPin, Zap, Settings } from 'lucide-react';
import ZoneConfigurator, { type Zone } from './components/ZoneConfigurator';

interface VideoInfo {
  filename: string;
  total_frames: number;
  fps: number;
  duration_sec: number;
  frames_analyzed: number;
  resolution?: string;
}

interface TrafficPoint {
  time_sec: number;
  count: number;
}

interface ZoneEntry {
  zone: string;
  unique_visitors: number;
}

interface AnalyticsResult {
  unique_persons_detected: number;
  active_tracks_at_end: number;
  dwell_events: number;
  peak_concurrent_persons: number;
  avg_persons_per_minute: number;
  traffic_curve: TrafficPoint[];
  zone_breakdown: ZoneEntry[];
}

interface AnalysisResult {
  status: string;
  video_info: VideoInfo;
  analytics: AnalyticsResult;
  heatmap_b64: string;
  keyframes: string[];
  video_frames?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Image Sequence Player (Bypasses all codec issues)
// ─────────────────────────────────────────────────────────────────────────────
const ImageSequencePlayer = ({ frames, fps = 5 }: { frames: string[], fps?: number }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  React.useEffect(() => {
    if (!isPlaying || !frames || frames.length === 0) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % frames.length);
    }, 1000 / fps);
    return () => clearInterval(interval);
  }, [isPlaying, frames, fps]);

  if (!frames || frames.length === 0) return null;

  return (
    <div style={{ position: 'relative', width: '100%', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--surface-border)', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)' }}>
      <img
        src={`data:image/jpeg;base64,${frames[currentIndex]}`}
        alt="AI Analyzed Frame"
        style={{ width: '100%', display: 'block', backgroundColor: '#000' }}
      />
      <div style={{ position: 'absolute', bottom: 10, left: 10, display: 'flex', gap: '0.5rem', background: 'rgba(0,0,0,0.6)', padding: '0.4rem 0.8rem', borderRadius: 8, backdropFilter: 'blur(4px)' }}>
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
        >
          {isPlaying ? '⏸ Pause' : '▶ Play'}
        </button>
        <span style={{ color: '#fff', fontSize: '0.8rem', opacity: 0.8 }}>
          {currentIndex + 1} / {frames.length}
        </span>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Mini bar chart (pure SVG, no library needed)
// ─────────────────────────────────────────────────────────────────────────────
const TrafficChart = ({ data }: { data: TrafficPoint[] }) => {
  if (!data || data.length === 0) {
    return <div className="empty-state" style={{ height: 120 }}><span>No traffic data</span></div>;
  }
  const maxCount = Math.max(...data.map(d => d.count), 1);
  const W = 560, H = 130, PAD = { top: 10, right: 10, bottom: 28, left: 28 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const barW = Math.max(4, chartW / data.length - 3);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60), s = sec % 60;
    return m > 0 ? `${m}m${s > 0 ? s + 's' : ''}` : `${s}s`;
  };

  // Show at most 6 x-axis labels
  const labelStep = Math.max(1, Math.floor(data.length / 6));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map(pct => {
        const y = PAD.top + chartH * (1 - pct);
        return (
          <g key={pct}>
            <line x1={PAD.left} y1={y} x2={PAD.left + chartW} y2={y}
              stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
            <text x={PAD.left - 4} y={y + 4} textAnchor="end"
              fill="rgba(255,255,255,0.35)" fontSize={9}>
              {Math.round(maxCount * pct)}
            </text>
          </g>
        );
      })}

      {/* Bars */}
      {data.map((d, i) => {
        const x = PAD.left + i * (chartW / data.length);
        const barH = (d.count / maxCount) * chartH;
        const y = PAD.top + chartH - barH;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH}
              fill="url(#barGrad)" rx={2} opacity={0.85} />
            {i % labelStep === 0 && (
              <text x={x + barW / 2} y={H - 4} textAnchor="middle"
                fill="rgba(255,255,255,0.4)" fontSize={8}>
                {formatTime(d.time_sec)}
              </text>
            )}
          </g>
        );
      })}

      <defs>
        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#4f46e5" />
        </linearGradient>
      </defs>
    </svg>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Zone breakdown mini table
// ─────────────────────────────────────────────────────────────────────────────
const ZoneBreakdown = ({ zones }: { zones: ZoneEntry[] }) => {
  if (!zones || zones.length === 0) {
    return <div className="empty-state" style={{ height: 80 }}><span>No zone data detected</span></div>;
  }
  const maxV = Math.max(...zones.map(z => z.unique_visitors), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {zones.map(z => {
        const pct = Math.round((z.unique_visitors / maxV) * 100);
        return (
          <div key={z.zone}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{z.zone}</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#a5b4fc' }}>{z.unique_visitors} visitors</span>
            </div>
            <div style={{ height: 6, borderRadius: 99, background: 'rgba(255,255,255,0.07)' }}>
              <div style={{ height: '100%', width: `${pct}%`, borderRadius: 99, background: 'linear-gradient(90deg,#6366f1,#8b5cf6)', transition: 'width 0.6s ease' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
type InputMode = 'file' | 'stream' | 'usb';

const TestPage = ({ onBack }: { onBack: () => void }) => {
  const [isDragging, setIsDragging]     = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing]   = useState(false);
  const [progress, setProgress]         = useState(0);
  const [result, setResult]             = useState<AnalysisResult | null>(null);
  const [error, setError]               = useState<string | null>(null);
  const [insightsOpen, setInsightsOpen] = useState(true);
  const [customZones, setCustomZones] = useState<Zone[]>([]);
  const [showZoneConfig, setShowZoneConfig] = useState(false);
  const [configSource, setConfigSource] = useState<string>('0');

  const [inputMode, setInputMode]       = useState<InputMode>('file');
  const [streamUrl, setStreamUrl]       = useState('');
  const [cameraIndex, setCameraIndex]   = useState<string>('0');
  const [isStreaming, setIsStreaming]   = useState(false);
  const [streamFrames, setStreamFrames] = useState<{original: string | null, processed: string | null, heatmap: string | null}>({original: null, processed: null, heatmap: null});
  const [streamError, setStreamError]   = useState<string | null>(null);
  const [liveKpis, setLiveKpis] = useState<{total_persons: number; shoppers: number; staff: number; queue_count: number; session_unique: number; zone_counts: Record<string, number>} | null>(null);
  const [detectedCameras, setDetectedCameras] = useState<{index: number, label: string}[] | null>(null);
  const [detectingCameras, setDetectingCameras] = useState(false);
  const wsRef                           = useRef<WebSocket | null>(null);

  const fileInputRef     = useRef<HTMLInputElement>(null);
  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef         = useRef<AbortController | null>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) setSelectedFile(file);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const analyze = async () => {
    if (!selectedFile) return;

    // Cancel any previous in-flight request
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setIsAnalyzing(true);
    setError(null);
    setResult(null);
    setProgress(4);

    // Smooth fake progress: crawls to 88% while waiting for server
    progressInterval.current = setInterval(() => {
      setProgress(prev => {
        if (prev >= 88) return prev;
        // Slows down as it approaches 88
        const step = Math.max(0.3, (88 - prev) * 0.04);
        return Math.min(88, prev + step);
      });
    }, 600);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      if (customZones.length > 0) formData.append('zones', JSON.stringify(customZones));

      const res = await fetch('http://localhost:8000/api/test/analyze-video', {
        method: 'POST',
        body: formData,
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        let detail = 'Server error';
        try { detail = (await res.json()).detail ?? detail; } catch {}
        throw new Error(detail);
      }

      const data: AnalysisResult = await res.json();

      clearInterval(progressInterval.current!);
      setProgress(100);
      setTimeout(() => {
        setResult(data);
        setIsAnalyzing(false);
      }, 350);
      return; // skip finally setIsAnalyzing below
    } catch (err: any) {
      clearInterval(progressInterval.current!);
      if (err.name !== 'AbortError') {
        setError(err.message || 'Failed to analyze video.');
      }
    }
    setIsAnalyzing(false);
  };

  const cancelAnalysis = () => {
    abortRef.current?.abort();
    clearInterval(progressInterval.current!);
    setIsAnalyzing(false);
    setProgress(0);
  };

  const generateInsights = (r: AnalysisResult) => {
    const insights: string[] = [];
    const { analytics, video_info } = r;
    const duration = video_info.duration_sec;

    insights.push(
      `Detected ${analytics.unique_persons_detected} unique ${analytics.unique_persons_detected === 1 ? 'person' : 'persons'} across ${formatDuration(duration)} of footage (${video_info.frames_analyzed.toLocaleString()} frames analysed).`
    );

    if (analytics.peak_concurrent_persons > 0) {
      insights.push(`Peak concurrent occupancy was ${analytics.peak_concurrent_persons} person${analytics.peak_concurrent_persons > 1 ? 's' : ''} — use this to plan staffing thresholds.`);
    }

    if (analytics.avg_persons_per_minute > 0) {
      const level = analytics.avg_persons_per_minute > 5 ? 'High' : analytics.avg_persons_per_minute > 2 ? 'Moderate' : 'Low';
      insights.push(`${level} traffic density: ~${analytics.avg_persons_per_minute} persons/min. ${level === 'High' ? 'Consider queue management or additional staff during peak windows.' : 'Consider promotional tactics to boost traffic in low-density periods.'}`);
    }

    if (analytics.active_tracks_at_end > 0) {
      insights.push(`${analytics.active_tracks_at_end} track${analytics.active_tracks_at_end > 1 ? 's' : ''} still active at clip end — provide a longer recording for complete dwell data.`);
    }

    const topZone = analytics.zone_breakdown?.sort((a, b) => b.unique_visitors - a.unique_visitors)[0];
    if (topZone) {
      insights.push(`"${topZone.zone}" was the busiest area with ${topZone.unique_visitors} unique visitor${topZone.unique_visitors > 1 ? 's' : ''} — strong signal for display placement.`);
    }

    return insights;
  };

  const startStream = (source: string) => {
    if (wsRef.current) wsRef.current.close();
    setError(null);
    setIsStreaming(true);
    setStreamFrames({original: null, processed: null, heatmap: null});
    
    const ws = new WebSocket(`ws://localhost:8000/api/test/stream?source=${encodeURIComponent(source)}&zones=${encodeURIComponent(JSON.stringify(customZones))}`);
    wsRef.current = ws;
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.error) {
          setError(data.error);
          stopStream();
        } else {
          setStreamFrames({
            original: data.original,
            processed: data.processed,
            heatmap: data.heatmap
          });
          if (data.kpis) setLiveKpis(data.kpis);
        }
      } catch (e) {}
    };
    
    ws.onerror = () => {
      setError('Stream connection error');
      stopStream();
    };
    
    ws.onclose = () => {
      setIsStreaming(false);
    };
  };

  const stopStream = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsStreaming(false);
  };

  const resetAll = () => {
    abortRef.current?.abort();
    clearInterval(progressInterval.current!);
    stopStream();
    setResult(null);
    setSelectedFile(null);
    setProgress(0);
    setError(null);
    
    setIsAnalyzing(false);
    setStreamFrames({original: null, processed: null, heatmap: null});
  };

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-left">
          <button className="back-btn" onClick={onBack}>
            <ChevronLeft size={18} />
          </button>
          <div>
            <h1 className="header-title">Upload &amp; Test Footage</h1>
            <p className="header-subtitle">Analyse pre-recorded video with the Shopper Analytics Engine</p>
          </div>
        </div>
        <div className="header-right">
          {result && (
            <button
              className="insights-btn"
              onClick={() => setInsightsOpen(v => !v)}
            >
              <Sparkles size={14} />
              {insightsOpen ? 'Hide Insights' : 'AI Insights'}
            </button>
          )}
          <div className="offline-badge">
            <Film size={13} />
            Offline Mode
          </div>
        </div>
      </header>

      {/* AI Insights Panel */}
      {insightsOpen && result && (
        <div className="insights-panel" style={{ marginBottom: '1.75rem' }}>
          <h3>
            <Sparkles size={16} color="#8b5cf6" />
            AI-Generated Insights
          </h3>
          {generateInsights(result).map((insight, i) => (
            <div key={i} className="insight-item">
              <div className="insight-dot" />
              <span>{insight}</span>
            </div>
          ))}
        </div>
      )}

      {showZoneConfig && <ZoneConfigurator source={configSource} onSave={(zones) => { setCustomZones(zones); setShowZoneConfig(false); }} onCancel={() => setShowZoneConfig(false)} />}
      {/* Mode Selector */}
      {!result && !isStreaming && (
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', justifyContent: 'center' }}>
          <button 
            onClick={() => setInputMode('file')}
            style={{ padding: '0.5rem 1rem', borderRadius: 99, border: `1px solid ${inputMode === 'file' ? '#6366f1' : 'rgba(255,255,255,0.1)'}`, background: inputMode === 'file' ? 'rgba(99,102,241,0.15)' : 'transparent', color: inputMode === 'file' ? '#a5b4fc' : 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s' }}
          >
            Video File
          </button>
          <button 
            onClick={() => setInputMode('stream')}
            style={{ padding: '0.5rem 1rem', borderRadius: 99, border: `1px solid ${inputMode === 'stream' ? '#6366f1' : 'rgba(255,255,255,0.1)'}`, background: inputMode === 'stream' ? 'rgba(99,102,241,0.15)' : 'transparent', color: inputMode === 'stream' ? '#a5b4fc' : 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s' }}
          >
            Stream URL
          </button>
          <button 
            onClick={() => setInputMode('usb')}
            style={{ padding: '0.5rem 1rem', borderRadius: 99, border: `1px solid ${inputMode === 'usb' ? '#6366f1' : 'rgba(255,255,255,0.1)'}`, background: inputMode === 'usb' ? 'rgba(99,102,241,0.15)' : 'transparent', color: inputMode === 'usb' ? '#a5b4fc' : 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s' }}
          >
            USB Webcam
          </button>
        </div>
      )}

      {/* Upload Zone */}
      {!result && !isStreaming && inputMode === 'file' && (
        <div
          className={`glass-card upload-zone ${isDragging ? 'dragging' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => !selectedFile && !isAnalyzing && fileInputRef.current?.click()}
          style={{ cursor: selectedFile || isAnalyzing ? 'default' : 'pointer', marginBottom: '1.5rem', textAlign: 'center' }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          {!selectedFile ? (
            <div className="upload-placeholder">
              <div className="upload-icon-wrap">
                <Upload size={36} color="#6366f1" />
              </div>
              <h3 className="upload-title">Drop your video here</h3>
              <p className="upload-sub">Supports .mp4, .avi, .mov, .mkv, .webm — or click to browse</p>
            </div>
          ) : (
            <div className="file-preview">
              <Film size={36} color="#8b5cf6" />
              <div style={{ marginLeft: '1rem', textAlign: 'left' }}>
                <p style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{selectedFile.name}</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.2rem' }}>{formatBytes(selectedFile.size)}</p>
              </div>
              {!isAnalyzing && (
                <button
                  className="change-file-btn"
                  onClick={(e) => { e.stopPropagation(); resetAll(); }}
                >
                  Change
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Analyze Button & Progress */}
      {selectedFile && !result && !isStreaming && inputMode === 'file' && (
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          {isAnalyzing ? (
            <div className="glass-card" style={{ padding: '2.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <Loader size={20} color="#6366f1" className="spin" />
                <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>AI Engine is processing your video…</span>
              </div>
              <div className="progress-bar-track">
                <div className="progress-bar-fill" style={{ width: `${progress}%`, transition: 'width 0.5s ease' }} />
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.875rem' }}>
                {Math.round(progress)}% Complete — YOLO tracking + heatmap generation in progress
              </p>
              <button
                onClick={cancelAnalysis}
                style={{ marginTop: '1rem', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '0.4rem 1rem', color: 'var(--text-secondary)', fontSize: '0.8rem', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <div>
              <button className="analyze-btn" onClick={analyze}>
                <Activity size={18} />
                Run Analysis
              </button>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.875rem' }}>
                The engine will detect persons, track movement, generate a heatmap, and analyse zone traffic.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Stream URL Input */}
      {!result && !isStreaming && inputMode === 'stream' && (
        <div className="glass-card" style={{ marginBottom: '1.5rem', textAlign: 'center', padding: '2.5rem' }}>
          <Activity size={36} color="#6366f1" style={{ margin: '0 auto 1rem' }} />
          <h3>Connect to IP Camera Stream</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>Enter the network stream URL (e.g. from an IP Webcam app)</p>
          <input 
            type="text" 
            value={streamUrl} 
            onChange={(e) => setStreamUrl(e.target.value)} 
            placeholder="http://192.168.1.10:8080/video"
            style={{ width: '80%', maxWidth: '400px', padding: '0.85rem', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', marginBottom: '1.5rem', outline: 'none' }}
          />
          <br/>
          <button className="analyze-btn" onClick={() => startStream(streamUrl)} disabled={!streamUrl}>
            <button className="analyze-btn" onClick={() => { setConfigSource(streamUrl); setShowZoneConfig(true); }} disabled={!streamUrl} style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc', marginRight: '1rem', boxShadow: 'none' }}>
              <Settings size={18} />
              Configure Zones
            </button>
            <Activity size={18} />
            Start Stream
          </button>
        </div>
      )}

      {/* USB Webcam Input */}
      {!result && !isStreaming && inputMode === 'usb' && (
        <div className="glass-card" style={{ marginBottom: '1.5rem', textAlign: 'center', padding: '2.5rem' }}>
          <Activity size={36} color="#6366f1" style={{ margin: '0 auto 1rem' }} />
          <h3>USB / DroidCam Analysis</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>Auto-detect your DroidCam or USB camera below.</p>

          {detectingCameras && (
            <p style={{ color: '#a5b4fc', marginBottom: '1rem' }}>🔍 Scanning for cameras…</p>
          )}

          {!detectingCameras && detectedCameras === null && (
            <button
              className="analyze-btn"
              onClick={async () => {
                setDetectingCameras(true);
                setDetectedCameras(null);
                try {
                  const res = await fetch('http://localhost:8000/api/test/list-cameras');
                  const data = await res.json();
                  setDetectedCameras(data.cameras || []);
                  if (data.cameras && data.cameras.length > 0) {
                    setCameraIndex(String(data.cameras[0].index));
                  }
                } catch {
                  setDetectedCameras([]);
                } finally {
                  setDetectingCameras(false);
                }
              }}
              style={{ marginBottom: '1.5rem', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.4)', color: '#a5b4fc', boxShadow: 'none' }}
            >
              🔍 Auto-Detect Cameras
            </button>
          )}

          {!detectingCameras && detectedCameras !== null && (
            <div style={{ marginBottom: '1.5rem' }}>
              {detectedCameras.length === 0 ? (
                <p style={{ color: '#f43f5e', marginBottom: '1rem' }}>❌ No readable cameras found. Make sure DroidCam is open and connected via USB.</p>
              ) : (
                <>
                  <p style={{ color: '#10b981', fontSize: '0.85rem', marginBottom: '0.75rem' }}>✅ Found {detectedCameras.length} camera(s):</p>
                  <select
                    value={cameraIndex}
                    onChange={(e) => setCameraIndex(e.target.value)}
                    style={{ padding: '0.75rem 1rem', borderRadius: 8, border: '1px solid rgba(99,102,241,0.4)', background: '#1e293b', color: '#fff', fontSize: '0.9rem', marginBottom: '1rem', width: '220px' }}
                  >
                    {detectedCameras.map(cam => (
                      <option key={cam.index} value={String(cam.index)}>{cam.label} (index {cam.index})</option>
                    ))}
                  </select>
                </>
              )}
              <br/>
              <button
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline', marginBottom: '1rem' }}
                onClick={async () => {
                  setDetectedCameras(null);
                  setDetectingCameras(true);
                  try {
                    const res = await fetch('http://localhost:8000/api/test/list-cameras');
                    const data = await res.json();
                    setDetectedCameras(data.cameras || []);
                    if (data.cameras && data.cameras.length > 0) {
                      setCameraIndex(String(data.cameras[0].index));
                    }
                  } catch {
                    setDetectedCameras([]);
                  } finally {
                    setDetectingCameras(false);
                  }
                }}
              >↻ Re-scan</button>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', flexWrap: 'wrap' }}>
            <button className="analyze-btn" onClick={() => { setConfigSource(cameraIndex); setShowZoneConfig(true); }} style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc', boxShadow: 'none' }}>
              <Settings size={18} />
              Configure Zones
            </button>
            <button className="analyze-btn" onClick={() => { setStreamError(null); startStream(cameraIndex); }} disabled={detectedCameras !== null && detectedCameras.length === 0}>
              <Activity size={18} />
              Start Camera
            </button>
          </div>
        </div>
      )}

      {/* Streaming Active View */}
      {isStreaming && (
        <div className="glass-card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 10px #ef4444', animation: 'pulse 2s infinite' }} /> 
              LIVE: Processing Stream
            </h3>
            <button className="analyze-btn" onClick={stopStream} style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', color: '#f43f5e', padding: '0.5rem 1rem', fontSize: '0.8rem', boxShadow: 'none' }}>
              Stop Stream
            </button>
          </div>
          {error && (
            <div style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.4)', borderRadius: 10, padding: '0.875rem 1.25rem', marginBottom: '1.25rem', color: '#f87171', fontSize: '0.875rem' }}>
              ❌ <strong>Camera Error:</strong> {error}
            </div>
          )}

          {/* Live KPI Strip */}
          {liveKpis && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
              {[
                { label: 'In Frame', value: liveKpis.total_persons, color: '#6366f1' },
                { label: 'Shoppers', value: liveKpis.shoppers, color: '#10b981' },
                { label: 'Staff', value: liveKpis.staff, color: '#8b5cf6' },
                { label: 'Queue', value: liveKpis.queue_count, color: liveKpis.queue_count >= 5 ? '#f43f5e' : '#f59e0b' },
                { label: 'Session IDs', value: liveKpis.session_unique, color: '#94a3b8' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(51,65,85,0.5)', borderRadius: 10, padding: '0.6rem 0.75rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
                  <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Zone Breakdown Strip */}
          {liveKpis?.zone_counts && Object.keys(liveKpis.zone_counts).length > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              {Object.entries(liveKpis.zone_counts).map(([zone, count]) => (
                <div key={zone} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.25rem 0.75rem', background: count > 0 ? 'rgba(99,102,241,0.15)' : 'rgba(15,23,42,0.4)', border: `1px solid ${count > 0 ? 'rgba(99,102,241,0.4)' : 'rgba(51,65,85,0.4)'}`, borderRadius: 99, fontSize: '0.75rem', color: count > 0 ? '#a5b4fc' : '#475569' }}>
                  <span>{zone}</span>
                  <strong>{count}</strong>
                </div>
              ))}
            </div>
          )}

          {/* Queue staffing alert */}
          {liveKpis && liveKpis.queue_count >= 5 && (
            <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.4)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#f87171', fontWeight: 600, fontSize: '0.875rem' }}>
              ⚠️ High queue detected ({liveKpis.queue_count} customers) — Open an additional billing counter immediately!
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
            <div className="video-player-container">
              <h3>Original Feed</h3>
              {streamFrames.original ? (
                <img src={`data:image/jpeg;base64,${streamFrames.original}`} alt="Original Stream" style={{ width: '100%', borderRadius: 12, border: '1px solid var(--surface-border)' }} />
              ) : (
                <div style={{ background: '#000', borderRadius: 12, padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem', height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Connecting...</div>
              )}
            </div>
            <div className="video-player-container">
              <h3><Sparkles size={16} color="#8b5cf6" /> Analyzed Output</h3>
              {streamFrames.processed ? (
                <img src={`data:image/jpeg;base64,${streamFrames.processed}`} alt="Processed Stream" style={{ width: '100%', borderRadius: 12, border: '1px solid var(--surface-border)' }} />
              ) : (
                <div style={{ background: '#000', borderRadius: 12, padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem', height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Waiting...</div>
              )}
            </div>
            <div className="video-player-container">
              <h3><Activity size={16} color="#f43f5e" /> Live Heatmap</h3>
              {streamFrames.heatmap ? (
                <img src={`data:image/jpeg;base64,${streamFrames.heatmap}`} alt="Heatmap Stream" style={{ width: '100%', borderRadius: 12, border: '1px solid var(--surface-border)' }} />
              ) : (
                <div style={{ background: '#000', borderRadius: 12, padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem', height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Generating...</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="glass-card" style={{ borderColor: 'rgba(244,63,94,0.3)', background: 'rgba(244,63,94,0.05)', padding: '1.5rem', marginBottom: '1.5rem', color: '#f43f5e' }}>
          ⚠️ {error}
          <button onClick={resetAll} style={{ marginLeft: '1rem', background: 'transparent', border: '1px solid rgba(244,63,94,0.4)', borderRadius: 8, padding: '0.3rem 0.8rem', color: '#f43f5e', fontSize: '0.8rem', cursor: 'pointer' }}>
            Try Again
          </button>
        </div>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Controls row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              ✅ Analysis complete — {result.video_info.frames_analyzed.toLocaleString()} frames processed
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                className="analyze-btn"
                onClick={resetAll}
                style={{ background: 'rgba(255,255,255,0.06)', boxShadow: 'none', border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.85rem', padding: '0.6rem 1.25rem' }}
              >
                ← Analyse Another
              </button>
            </div>
          </div>

          {/* Video Info Bar */}
          <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
            <div className="video-info-row">
              <div className="video-info-item">
                <p>File</p>
                <p>{result.video_info.filename}</p>
              </div>
              <div className="video-info-item">
                <p>Duration</p>
                <p>{formatDuration(result.video_info.duration_sec)}</p>
              </div>
              <div className="video-info-item">
                <p>Source FPS</p>
                <p>{result.video_info.fps} fps</p>
              </div>
              <div className="video-info-item">
                <p>Resolution</p>
                <p>{result.video_info.resolution ?? '—'}</p>
              </div>
              <div className="video-info-item">
                <p>Frames Analysed</p>
                <p>{result.video_info.frames_analyzed.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* KPI Cards — row 1 */}
          <div className="kpi-grid" style={{ marginBottom: '1rem' }}>
            <div className="glass-card">
              <div className="kpi-header">
                <span>Unique Persons</span>
                <Users className="kpi-icon" size={28} color="#6366f1" />
              </div>
              <div className="kpi-value">{result.analytics.unique_persons_detected}</div>
            </div>
            <div className="glass-card">
              <div className="kpi-header">
                <span>Peak Concurrent</span>
                <Zap className="kpi-icon" size={28} color="#f59e0b" />
              </div>
              <div className="kpi-value">{result.analytics.peak_concurrent_persons}</div>
            </div>
            <div className="glass-card">
              <div className="kpi-header">
                <span>Avg Persons / Min</span>
                <Activity className="kpi-icon" size={28} color="#10b981" />
              </div>
              <div className="kpi-value">{result.analytics.avg_persons_per_minute}</div>
            </div>
            <div className="glass-card">
              <div className="kpi-header">
                <span>Active Tracks at End</span>
                <Clock className="kpi-icon" size={28} color="#8b5cf6" />
              </div>
              <div className="kpi-value">{result.analytics.active_tracks_at_end}</div>
            </div>
          </div>

          {/* Traffic Timeline + Zone Breakdown */}
          <div className="charts-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="glass-card">
              <div className="chart-header">
                <h2 className="chart-title">
                  <BarChart2 size={16} color="#6366f1" style={{ marginRight: 6, verticalAlign: 'middle' }} />
                  Traffic Timeline
                </h2>
                <p className="chart-subtitle">Peak concurrent persons per 10-second window</p>
              </div>
              <TrafficChart data={result.analytics.traffic_curve} />
            </div>

            <div className="glass-card">
              <div className="chart-header">
                <h2 className="chart-title">
                  <MapPin size={16} color="#8b5cf6" style={{ marginRight: 6, verticalAlign: 'middle' }} />
                  Zone Breakdown
                </h2>
                <p className="chart-subtitle">Unique visitors detected per operational zone</p>
              </div>
                  <ZoneBreakdown zones={result.analytics.zone_breakdown} />
            </div>
          </div>

          {/* Side-by-Side Video Players */}
          {result && selectedFile && (
            <div className="video-comparison-grid" style={{ marginBottom: '1.5rem' }}>
              <div className="video-player-container">
                <h3>Original Upload</h3>
                <video
                  src={URL.createObjectURL(selectedFile)}
                  controls
                  muted
                  playsInline
                  onError={(e) => {
                    const target = e.target as HTMLVideoElement;
                    target.style.display = 'none';
                    if (target.nextElementSibling) {
                      (target.nextElementSibling as HTMLElement).style.display = 'flex';
                    }
                  }}
                />
                <div style={{ display: 'none', background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: '2rem', textAlign: 'center', height: '100%', alignItems: 'center', justifyContent: 'center', border: '1px dashed rgba(255,255,255,0.1)' }}>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    ⚠️ Your browser cannot natively play this original file format (e.g. .mkv or .avi).
                    <br/><br/>
                    The AI Engine successfully processed it though. See the tracked output.
                  </p>
                </div>
              </div>
              <div className="video-player-container">
                <h3><Sparkles size={16} color="#8b5cf6" /> AI Analyzed Output</h3>
                {result.video_frames && result.video_frames.length > 0 ? (
                  <ImageSequencePlayer frames={result.video_frames} fps={5} />
                ) : (
                  <div style={{ background: '#000', borderRadius: 12, padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    No frames returned.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Heatmap + Keyframes */}
          <div className="charts-grid">
            <div className="glass-card">
              <div className="chart-header">
                <h2 className="chart-title">Thermal Heatmap</h2>
                <p className="chart-subtitle">Accumulated spatial density with Gaussian smoothing</p>
              </div>
              <img
                src={`data:image/jpeg;base64,${result.heatmap_b64}`}
                alt="Heatmap"
                style={{ width: '100%', borderRadius: '10px', border: '1px solid var(--surface-border)' }}
              />
            </div>

            <div className="glass-card">
              <div className="chart-header">
                <h2 className="chart-title">Keyframes</h2>
                <p className="chart-subtitle">AI-annotated sample frames from the video</p>
              </div>
              <div className="keyframe-grid">
                {result.keyframes.map((kf, idx) => (
                  <img
                    key={idx}
                    src={`data:image/jpeg;base64,${kf}`}
                    alt={`Keyframe ${idx + 1}`}
                    className="keyframe-img"
                  />
                ))}
                {result.keyframes.length === 0 && (
                  <div className="empty-state" style={{ gridColumn: 'span 2', height: '120px' }}>
                    <span>No keyframes captured. Try a longer video.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TestPage;
