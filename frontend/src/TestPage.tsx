import React, { useState, useRef, useCallback } from 'react';
import { Upload, Film, Activity, Users, Clock, ChevronLeft, Loader, Sparkles, BarChart2, MapPin, Zap } from 'lucide-react';

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
const ZoneBreakdown = ({ zones, totalPersons }: { zones: ZoneEntry[]; totalPersons: number }) => {
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
const TestPage = ({ onBack }: { onBack: () => void }) => {
  const [isDragging, setIsDragging]     = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing]   = useState(false);
  const [progress, setProgress]         = useState(0);
  const [result, setResult]             = useState<AnalysisResult | null>(null);
  const [error, setError]               = useState<string | null>(null);
  const [insightsOpen, setInsightsOpen] = useState(false);

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
      `Detected ${analytics.unique_persons_detected} unique ${analytics.unique_persons_detected === 1 ? 'person' : 'persons'} across ${formatDuration(duration)} of footage (${analytics.frames_analyzed?.toLocaleString() ?? '?'} frames analysed).`
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

  const resetAll = () => {
    abortRef.current?.abort();
    clearInterval(progressInterval.current!);
    setResult(null);
    setSelectedFile(null);
    setProgress(0);
    setError(null);
    setInsightsOpen(false);
    setIsAnalyzing(false);
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

      {/* Upload Zone */}
      {!result && (
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
      {selectedFile && !result && (
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
              ✅ Analysis complete — {result.analytics.frames_analyzed?.toLocaleString() ?? result.video_info.frames_analyzed.toLocaleString()} frames processed
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
              <ZoneBreakdown
                zones={result.analytics.zone_breakdown}
                totalPersons={result.analytics.unique_persons_detected}
              />
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
