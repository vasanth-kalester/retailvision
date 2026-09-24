import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  ChevronLeft, Film, Upload, Activity, Users, Zap,
  BarChart2, MapPin, Sparkles, Loader, Play, X, CheckCircle,
  TrendingUp, Eye, Cpu, Package
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface ZoneEntry   { zone: string; unique_visitors: number; }
interface TrafficPt   { time_sec: number; count: number; }
interface EventEntry  { time: string; message: string; }
interface Analytics {
  unique_persons_detected: number;
  peak_concurrent_persons: number;
  avg_persons_per_minute:  number;
  traffic_curve:           TrafficPt[];
  zone_breakdown:          ZoneEntry[];
  inventory_gaps?:         number;
  insights?:               string[];
}
interface VideoInfo {
  filename: string; duration_sec: number; fps: number;
  total_frames: number; frames_analyzed: number; resolution: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Animated Counter hook
// ─────────────────────────────────────────────────────────────────────────────
const useAnimatedCounter = (target: number, duration = 700) => {
  const [display, setDisplay] = useState(0);
  const raf = useRef<number>(0);
  const prev = useRef(0);
  useEffect(() => {
    const start = performance.now();
    const from  = prev.current;
    prev.current = target;
    const animate = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (target - from) * eased));
      if (t < 1) raf.current = requestAnimationFrame(animate);
    };
    raf.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf.current);
  }, [target]);
  return display;
};

// ─────────────────────────────────────────────────────────────────────────────
// KPI Card
// ─────────────────────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, icon, color, sub }: {
  label: string; value: number; icon: React.ReactNode; color: string; sub?: string;
}) => {
  const display = useAnimatedCounter(value);
  return (
    <div style={{
      background: 'var(--bg-panel)', border: `1px solid var(--border-light)`,
      borderRadius: 16, padding: '1.25rem',
      display: 'flex', flexDirection: 'column', gap: '0.5rem',
      boxShadow: `0 4px 12px rgba(0,0,0,0.05)`,
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <span style={{ fontSize:'0.7rem', fontWeight:600, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.08em' }}>{label}</span>
        <div style={{ color }}>{icon}</div>
      </div>
      <div style={{ fontSize:'2.4rem', fontWeight:800, color, lineHeight:1, fontVariantNumeric:'tabular-nums' }}>
        {display}
      </div>
      {sub && <div style={{ fontSize:'0.7rem', color:'var(--text-muted)' }}>{sub}</div>}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Zone Bar
// ─────────────────────────────────────────────────────────────────────────────
const ZoneBar = ({ zone, count, max }: { zone: string; count: number; max: number }) => {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div style={{ marginBottom:'0.75rem' }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'0.3rem' }}>
        <span style={{ fontSize:'0.8rem', color:'var(--text-secondary)' }}>{zone}</span>
        <span style={{ fontSize:'0.8rem', fontWeight:700, color:'var(--primary-blue)' }}>{count} visitors</span>
      </div>
      <div style={{ height:8, borderRadius:99, background:'var(--border-light)', overflow:'hidden' }}>
        <div style={{
          height:'100%', width:`${pct}%`, borderRadius:99,
          background:'var(--primary-blue)',
          transition:'width 0.8s cubic-bezier(0.4,0,0.2,1)',
        }} />
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Traffic sparkline
// ─────────────────────────────────────────────────────────────────────────────
const Sparkline = ({ data }: { data: TrafficPt[] }) => {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data.map(d => d.count), 1);
  const W = 320, H = 60;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - (d.count / max) * H;
    return `${x},${y}`;
  }).join(' ');
  const area = `0,${H} ${pts} ${W},${H}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:60, display:'block' }}>
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary-blue)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="var(--primary-blue)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#sparkGrad)" />
      <polyline points={pts} fill="none" stroke="var(--primary-blue)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Frame panel
// ─────────────────────────────────────────────────────────────────────────────
const FramePanel = ({ b64, label, sublabel, badge }: {
  b64: string | null; label: string; sublabel: string; badge?: React.ReactNode;
}) => (
  <div style={{
    flex:1, minWidth:0,
    background:'var(--bg-panel)', borderRadius:14,
    border:'1px solid var(--border-light)', overflow:'hidden',
    boxShadow:'0 4px 12px rgba(0,0,0,0.05)',
  }}>
    <div style={{ padding:'0.6rem 1rem', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid var(--border-light)' }}>
      <div>
        <div style={{ fontWeight:700, fontSize:'0.85rem', color:'var(--text-primary)' }}>{label}</div>
        <div style={{ fontSize:'0.7rem', color:'var(--text-secondary)' }}>{sublabel}</div>
      </div>
      {badge}
    </div>
    {b64 ? (
      <img src={`data:image/jpeg;base64,${b64}`} alt={label}
        style={{ width:'100%', display:'block', aspectRatio:'16/9', objectFit:'cover', backgroundColor:'var(--bg-app)',
          transition:'opacity 0.15s ease, transform 0.1s ease',
        }} />
    ) : (
      <div style={{ aspectRatio:'16/9', background:'var(--bg-app)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'0.5rem' }}>
        <Loader size={24} color="var(--text-muted)" style={{ animation:'spin 1s linear infinite' }} />
        <span style={{ color:'var(--text-secondary)', fontSize:'0.8rem' }}>Waiting for feed…</span>
      </div>
    )}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Clip Card
// ─────────────────────────────────────────────────────────────────────────────
const ClipCard = ({ file, selected, onClick, onRemove }: {
  file: File; selected: boolean; onClick: () => void; onRemove: () => void;
}) => {
  const size = file.size < 1024*1024
    ? `${(file.size/1024).toFixed(1)} KB`
    : `${(file.size/1024/1024).toFixed(1)} MB`;
  const ext = file.name.split('.').pop()?.toUpperCase() ?? 'VID';
  return (
    <div onClick={onClick} style={{
      padding:'0.85rem 1rem', borderRadius:12,
      border:`1.5px solid ${selected ? 'var(--primary-blue)' : 'var(--border-light)'}`,
      background: selected ? 'var(--primary-blue-light)' : 'var(--bg-panel)',
      cursor:'pointer', display:'flex', alignItems:'center', gap:'0.85rem',
      transition:'all 0.2s', boxShadow: selected ? '0 4px 12px rgba(37,99,235,0.15)' : 'none',
    }}>
      <div style={{ width:42, height:42, borderRadius:10, background: selected ? 'rgba(37,99,235,0.15)' : 'var(--bg-app)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2, flexShrink:0 }}>
        <Film size={18} color={selected ? 'var(--primary-blue)' : 'var(--text-muted)'} />
        <span style={{ fontSize:'0.5rem', fontWeight:700, color: selected ? 'var(--primary-blue)' : 'var(--text-muted)' }}>{ext}</span>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight:600, fontSize:'0.8rem', color: selected ? 'var(--primary-blue)' : 'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{file.name}</div>
        <div style={{ fontSize:'0.7rem', color:'var(--text-secondary)', marginTop:2 }}>{size}</div>
      </div>
      {selected && <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--primary-blue)', flexShrink:0, boxShadow:'0 0 6px rgba(37,99,235,0.5)' }} />}
      <button onClick={e=>{ e.stopPropagation(); onRemove(); }} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-secondary)', padding:4, flexShrink:0, lineHeight:1 }}>
        <X size={14} />
      </button>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
const DemoPage = ({ onBack, onGoToDashboard }: { onBack: () => void; onGoToDashboard: () => void }) => {
  const [clips,      setClips]      = useState<File[]>([]);
  const [activeClip, setActiveClip] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const [productZonesStr, setProductZonesStr] = useState<string>('[\n  {"name": "Shelf 1", "poly": [[0.05, 0.2], [0.95, 0.2], [0.95, 0.9], [0.05, 0.9]]}\n]');
  const fileInputRef                 = useRef<HTMLInputElement>(null);

  type Stage = 'idle' | 'uploading' | 'analyzing' | 'complete' | 'error';
  const [stage,      setStage]      = useState<Stage>('idle');
  const [progress,   setProgress]   = useState(0);
  const [origB64,    setOrigB64]    = useState<string|null>(null);
  const [procB64,    setProcB64]    = useState<string|null>(null);
  const [heatmapB64, setHeatmapB64] = useState<string|null>(null);
  const [analytics,  setAnalytics]  = useState<Analytics>({
    unique_persons_detected:0, peak_concurrent_persons:0, avg_persons_per_minute:0,
    traffic_curve:[], zone_breakdown:[],
  });
  const [events,     setEvents]     = useState<EventEntry[]>([]);
  const [keyframes,  setKeyframes]  = useState<string[]>([]);
  const [videoInfo,  setVideoInfo]  = useState<VideoInfo|null>(null);
  const [errorMsg,   setErrorMsg]   = useState('');
  const wsRef                        = useRef<WebSocket|null>(null);
  const eventLogRef                  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (eventLogRef.current) eventLogRef.current.scrollTop = eventLogRef.current.scrollHeight;
  }, [events]);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const allowed = ['.mp4','.avi','.mov','.mkv','.webm'];
    const valid = Array.from(files).filter(f => allowed.some(ext => f.name.toLowerCase().endsWith(ext)));
    setClips(prev => {
      const existing = new Set(prev.map(f => f.name));
      const fresh = valid.filter(f => !existing.has(f.name));
      return [...prev, ...fresh];
    });
  };

  const removeClip = (idx: number) => {
    setClips(prev => {
      const next = prev.filter((_, i) => i !== idx);
      if (activeClip >= next.length) setActiveClip(Math.max(0, next.length - 1));
      return next;
    });
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false); addFiles(e.dataTransfer.files);
  }, []);

  const resetDemo = useCallback(() => {
    wsRef.current?.close();
    setStage('idle'); setProgress(0);
    setOrigB64(null); setProcB64(null); setHeatmapB64(null);
    setEvents([]); setKeyframes([]); setVideoInfo(null); setErrorMsg('');
    setAnalytics({ unique_persons_detected:0, peak_concurrent_persons:0, avg_persons_per_minute:0, traffic_curve:[], zone_breakdown:[] });
  }, []);

  const startAnalysis = async () => {
    const file = clips[activeClip];
    if (!file) return;
    wsRef.current?.close();
    setStage('uploading'); setProgress(0);
    setOrigB64(null); setProcB64(null); setHeatmapB64(null);
    setEvents([]); setKeyframes([]); setVideoInfo(null); setErrorMsg('');
    setAnalytics({ unique_persons_detected:0, peak_concurrent_persons:0, avg_persons_per_minute:0, traffic_curve:[], zone_breakdown:[] });

    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('product_zones', productZonesStr);
      const res = await fetch('http://localhost:8000/api/test/demo/upload', { method:'POST', body:fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail:'Upload failed' }));
        throw new Error(err.detail ?? 'Upload failed');
      }
      const { session_id } = await res.json();
      setStage('analyzing');

      const ws = new WebSocket(`ws://localhost:8000/api/test/demo/stream/${session_id}`);
      wsRef.current = ws;

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'error') { setErrorMsg(msg.message); setStage('error'); return; }
          if (msg.type === 'progress') {
            setProgress(msg.progress ?? 0);
            if (msg.original)  setOrigB64(msg.original);
            if (msg.processed) setProcB64(msg.processed);
            if (msg.heatmap)   setHeatmapB64(msg.heatmap);
            if (msg.analytics) setAnalytics(msg.analytics);
            if (msg.events?.length) {
              const now = new Date();
              const ts  = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
              setEvents(prev => [...prev, ...msg.events.map((e: any) => ({ time:ts, message:e.message }))].slice(-80));
            }
          }
          if (msg.type === 'complete') {
            setProgress(1);
            if (msg.analytics) setAnalytics(msg.analytics);
            if (msg.heatmap)   setHeatmapB64(msg.heatmap);
            if (msg.keyframes) setKeyframes(msg.keyframes);
            if (msg.video_info) setVideoInfo(msg.video_info);
            const now = new Date();
            const ts  = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
            setEvents(prev => [...prev, { time:ts, message:'✅ Analysis complete — data saved to dashboard' }]);
            setStage('complete');
          }
        } catch {}
      };
      ws.onerror = () => { setErrorMsg('WebSocket error. Is the backend running on :8000?'); setStage('error'); };
    } catch (e: any) {
      setErrorMsg(e.message ?? 'Unexpected error'); setStage('error');
    }
  };

  const stopAnalysis = () => { wsRef.current?.close(); setStage('idle'); };
  const isRunning    = stage === 'uploading' || stage === 'analyzing';
  const maxZone      = analytics.zone_breakdown.length
    ? Math.max(...analytics.zone_breakdown.map(z => z.unique_visitors)) : 1;

  return (
    <div style={{ padding:'1.5rem 2rem', maxWidth:1400, margin:'0 auto', fontFamily:'inherit' }}>
      {/* ── Header ── */}
      <div style={{ display:'flex', alignItems:'center', gap:'1rem', marginBottom:'2rem' }}>
        <button onClick={onBack} style={{ background:'var(--bg-panel)', border:'1px solid var(--border-light)', borderRadius:10, padding:'0.5rem 0.75rem', color:'var(--text-secondary)', cursor:'pointer', display:'flex', alignItems:'center', gap:'0.4rem', fontSize:'0.85rem', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <ChevronLeft size={16} /> Back
        </button>
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
            <h1 style={{ fontSize:'1.5rem', fontWeight:800, margin:0, color:'var(--text-primary)' }}>
              🎬 Live Demo Mode
            </h1>
            <span style={{ background:'var(--primary-blue-light)', border:'1px solid var(--primary-blue-border)', color:'var(--primary-blue)', fontSize:'0.7rem', fontWeight:700, padding:'0.25rem 0.65rem', borderRadius:99, letterSpacing:'0.08em', textTransform:'uppercase' }}>
              Jury Presentation
            </span>
          </div>
          <p style={{ margin:'0.25rem 0 0', color:'var(--text-secondary)', fontSize:'0.85rem' }}>
            Upload supermarket footage → AI analyses frame-by-frame → dashboard updates live
          </p>
        </div>
        {stage === 'complete' && (
          <button onClick={onGoToDashboard} style={{ background:'var(--primary-blue)', border:'none', borderRadius:10, padding:'0.65rem 1.25rem', color:'#fff', fontWeight:700, fontSize:'0.85rem', cursor:'pointer', display:'flex', alignItems:'center', gap:'0.5rem', boxShadow:'0 4px 12px rgba(37,99,235,0.3)' }}>
            <Activity size={16} /> View Full Dashboard →
          </button>
        )}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'300px 1fr', gap:'1.5rem', alignItems:'start' }}>
        {/* ── LEFT: Clip Library ── */}
        <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
          {/* Drop zone */}
          <div onDragOver={e=>{ e.preventDefault(); setIsDragging(true); }} onDragLeave={()=>setIsDragging(false)} onDrop={handleDrop}
            onClick={()=>!isRunning&&fileInputRef.current?.click()}
            style={{ border:`2px dashed ${isDragging?'var(--primary-blue)':'var(--border-strong)'}`, borderRadius:14, padding:'1.5rem 1rem', textAlign:'center', cursor:isRunning?'default':'pointer', background:isDragging?'var(--primary-blue-light)':'var(--bg-panel)', transition:'all 0.2s' }}>
            <input ref={fileInputRef} type="file" accept="video/*" multiple style={{ display:'none' }} onChange={e=>addFiles(e.target.files)} />
            <Upload size={28} color={isDragging?'var(--primary-blue)':'var(--text-muted)'} style={{ margin:'0 auto 0.6rem' }} />
            <div style={{ fontSize:'0.8rem', color:'var(--text-secondary)', lineHeight:1.5 }}>
              {isDragging ? <span style={{ color:'var(--primary-blue)', fontWeight:600 }}>Drop to add clips</span>
                : <>Drop video clips here<br/><span style={{ color:'var(--text-muted)' }}>or click to browse</span></>}
            </div>
          </div>

          {/* Clip list */}
          <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
            <div style={{ fontSize:'0.7rem', fontWeight:700, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.08em', paddingLeft:'0.25rem' }}>
              {clips.length > 0 ? `${clips.length} Clip${clips.length>1?'s':''} Loaded` : 'No Clips Yet'}
            </div>
            {clips.length === 0 && (
              <div style={{ padding:'1.5rem', textAlign:'center', color:'var(--text-secondary)', fontSize:'0.8rem', border:'1px solid var(--border-light)', borderRadius:10, background:'var(--bg-panel)' }}>
                Add your supermarket footage to begin
              </div>
            )}
            {clips.map((clip, i) => (
              <ClipCard key={`${clip.name}-${i}`} file={clip} selected={activeClip===i&&!isRunning}
                onClick={()=>{ if (!isRunning) { setActiveClip(i); resetDemo(); } }}
                onRemove={()=>removeClip(i)} />
            ))}
          </div>

          {/* Product Mapping Config */}
          {clips.length > 0 && stage === 'idle' && (
            <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem', marginTop: '0.5rem' }}>
              <div style={{ fontSize:'0.7rem', fontWeight:700, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.08em', paddingLeft:'0.25rem' }}>
                Product Mapping (JSON coordinates)
              </div>
              <textarea 
                value={productZonesStr}
                onChange={(e) => setProductZonesStr(e.target.value)}
                style={{ width:'100%', height:'80px', background:'var(--bg-app)', border:'1px solid var(--border-light)', borderRadius:12, padding:'0.75rem', color:'var(--text-primary)', fontSize:'0.75rem', fontFamily:'monospace', resize:'vertical' }}
                placeholder='[{"name": "Shelf 1", "poly": [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]]}]'
              />
            </div>
          )}

          {/* Action buttons */}
          {clips.length > 0 && (
            <div>
              {stage==='idle' && (
                <button onClick={startAnalysis} style={{ width:'100%', padding:'0.85rem', borderRadius:12, border:'none', background:'var(--primary-blue)', color:'#fff', fontWeight:700, fontSize:'0.9rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.6rem', boxShadow:'0 4px 12px rgba(37,99,235,0.3)' }}>
                  <Play size={18} fill="#fff" /> Start AI Analysis
                </button>
              )}
              {isRunning && (
                <button onClick={stopAnalysis} style={{ width:'100%', padding:'0.85rem', borderRadius:12, border:'1px solid var(--alert-red-border)', background:'var(--alert-red-light)', color:'var(--alert-red)', fontWeight:700, fontSize:'0.9rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.6rem' }}>
                  <X size={18} /> Stop Analysis
                </button>
              )}
              {(stage==='complete'||stage==='error') && (
                <button onClick={resetDemo} style={{ width:'100%', padding:'0.85rem', borderRadius:12, border:'1px solid var(--border-strong)', background:'var(--bg-panel)', color:'var(--text-secondary)', fontWeight:600, fontSize:'0.85rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.6rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <Film size={16} /> Analyze Another Clip
                </button>
              )}
            </div>
          )}

          {/* Status */}
          {stage==='uploading' && (
            <div style={{ padding:'1rem', background:'var(--primary-blue-light)', border:'1px solid var(--primary-blue-border)', borderRadius:12, textAlign:'center', fontSize:'0.82rem', color:'var(--primary-blue)' }}>
              <Loader size={16} style={{ display:'inline', marginRight:6, verticalAlign:'middle', animation:'spin 1s linear infinite' }} />
              Uploading clip to analysis engine…
            </div>
          )}
          {stage==='error' && (
            <div style={{ padding:'1rem', background:'var(--alert-red-light)', border:'1px solid var(--alert-red-border)', borderRadius:12, fontSize:'0.8rem', color:'var(--alert-red)' }}>
              ❌ {errorMsg}
            </div>
          )}
          {stage==='complete' && videoInfo && (
            <div style={{ padding:'1rem', background:'var(--success-green-light)', border:'1px solid rgba(5, 150, 105, 0.2)', borderRadius:12, fontSize:'0.78rem', color:'var(--success-green)', lineHeight:1.7 }}>
              <div style={{ fontWeight:700, marginBottom:'0.4rem' }}>✅ Analysis Complete</div>
              <div>📹 {videoInfo.filename}</div>
              <div>⏱ {videoInfo.duration_sec}s · {videoInfo.fps} fps · {videoInfo.resolution}</div>
              <div>🔬 {videoInfo.frames_analyzed} frames analyzed</div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Analysis View ── */}
        <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
          {/* Empty / Ready state */}
          {stage==='idle' && clips.length===0 && (
            <div style={{ padding:'4rem 2rem', textAlign:'center', border:'1px dashed var(--border-strong)', borderRadius:16, background:'var(--bg-panel)' }}>
              <Film size={52} color="var(--text-muted)" style={{ margin:'0 auto 1rem' }} />
              <h2 style={{ fontSize:'1.2rem', fontWeight:700, color:'var(--text-primary)', marginBottom:'0.5rem' }}>No footage loaded</h2>
              <p style={{ color:'var(--text-secondary)', fontSize:'0.875rem' }}>Add your supermarket video clips from the left panel to begin.</p>
            </div>
          )}
          {stage==='idle' && clips.length>0 && (
            <div style={{ padding:'3rem 2rem', textAlign:'center', border:'1px dashed var(--primary-blue-border)', borderRadius:16, background:'var(--primary-blue-light)' }}>
              <Play size={48} color="var(--primary-blue)" style={{ margin:'0 auto 1rem' }} />
              <h2 style={{ fontSize:'1.2rem', fontWeight:700, color:'var(--primary-blue)', marginBottom:'0.5rem' }}>Ready to Analyze</h2>
              <p style={{ color:'var(--text-secondary)', fontSize:'0.875rem' }}>
                <strong style={{ color:'var(--text-primary)' }}>{clips[activeClip]?.name}</strong> is queued.<br/>
                Press <strong style={{ color:'var(--text-primary)' }}>Start AI Analysis</strong> to begin.
              </p>
            </div>
          )}

          {/* Progress bar */}
          {isRunning && (
            <div style={{ background:'var(--bg-panel)', border:'1px solid var(--border-light)', borderRadius:12, padding:'1rem 1.25rem', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'0.5rem', alignItems:'center' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', fontSize:'0.82rem', color:'var(--primary-blue)', fontWeight:600 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--alert-red)', boxShadow:'0 0 8px var(--alert-red)', animation:'pulse 1.5s infinite' }} />
                  {stage==='uploading' ? 'UPLOADING CLIP…' : '🔴 AI ANALYZING LIVE'}
                </div>
                <span style={{ fontVariantNumeric:'tabular-nums', fontSize:'0.8rem', color:'var(--primary-blue)', fontWeight:700 }}>
                  {Math.round(progress*100)}%
                </span>
              </div>
              <div style={{ height:6, borderRadius:99, background:'var(--border-light)' }}>
                <div style={{ height:'100%', width:`${progress*100}%`, borderRadius:99, background:'var(--primary-blue)', transition:'width 0.5s ease' }} />
              </div>
            </div>
          )}

          {/* KPI Cards */}
          {(isRunning||stage==='complete') && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'0.85rem' }}>
              <KpiCard label="Unique Persons" value={analytics.unique_persons_detected} color="#6366f1" icon={<Users size={20} />} sub="detected in footage" />
              <KpiCard label="Peak Concurrent" value={analytics.peak_concurrent_persons} color="#f59e0b" icon={<Zap size={20} />} sub="max at one time" />
              <KpiCard label="Avg / Minute" value={analytics.avg_persons_per_minute} color="#10b981" icon={<TrendingUp size={20} />} sub="shoppers per minute" />
              <KpiCard label="Shelf Gaps" value={analytics.inventory_gaps || 0} color="#ef4444" icon={<Package size={20} />} sub="out of stock spots" />
            </div>
          )}

          {/* Side-by-side frames */}
          {(isRunning||stage==='complete') && (
            <div style={{ display:'flex', gap:'1rem' }}>
              <FramePanel b64={origB64} label="Original Footage" sublabel="Raw supermarket feed"
                badge={<span style={{ fontSize:'0.65rem', background:'var(--bg-app)', border:'1px solid var(--border-light)', padding:'0.2rem 0.5rem', borderRadius:6, color:'var(--text-secondary)' }}>RAW</span>} />
              <FramePanel b64={procB64} label="AI Annotated Output" sublabel="YOLO11 · Person tracking · Zones"
                badge={<span style={{ fontSize:'0.65rem', background:'var(--primary-blue-light)', border:'1px solid var(--primary-blue-border)', padding:'0.2rem 0.5rem', borderRadius:6, color:'var(--primary-blue)', display:'flex', alignItems:'center', gap:4 }}>
                  <Sparkles size={10} /> AI</span>} />
            </div>
          )}

          {/* Zone + Events */}
          {(isRunning||stage==='complete') && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
              {/* Zone breakdown */}
              <div style={{ background:'var(--bg-panel)', border:'1px solid var(--border-light)', borderRadius:14, padding:'1.1rem 1.25rem', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'1rem' }}>
                  <MapPin size={16} color="var(--primary-blue)" />
                  <span style={{ fontWeight:700, fontSize:'0.85rem', color:'var(--text-primary)' }}>Zone Activity</span>
                </div>
                {analytics.zone_breakdown.length===0
                  ? <div style={{ color:'var(--text-secondary)', fontSize:'0.8rem' }}>Detecting zones…</div>
                  : analytics.zone_breakdown.map(z => <ZoneBar key={z.zone} zone={z.zone} count={z.unique_visitors} max={maxZone} />)
                }
                {analytics.traffic_curve.length >= 2 && (
                  <div style={{ marginTop:'0.75rem', borderTop:'1px solid var(--border-light)', paddingTop:'0.75rem' }}>
                    <div style={{ fontSize:'0.7rem', color:'var(--text-secondary)', marginBottom:'0.3rem', display:'flex', alignItems:'center', gap:4 }}>
                      <BarChart2 size={11} /> Traffic Timeline
                    </div>
                    <Sparkline data={analytics.traffic_curve} />
                  </div>
                )}
              </div>

              {/* Event log */}
              <div style={{ background:'var(--bg-panel)', border:'1px solid var(--border-light)', borderRadius:14, padding:'1.1rem 1.25rem', display:'flex', flexDirection:'column', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.75rem' }}>
                  <Activity size={16} color="var(--success-green)" />
                  <span style={{ fontWeight:700, fontSize:'0.85rem', color:'var(--text-primary)' }}>Live Event Feed</span>
                  {isRunning && (
                    <span style={{ marginLeft:'auto', fontSize:'0.65rem', color:'var(--success-green)', fontWeight:600, display:'flex', alignItems:'center', gap:3 }}>
                      <div style={{ width:5, height:5, borderRadius:'50%', background:'var(--success-green)', animation:'pulse 1.5s infinite' }} /> LIVE
                    </span>
                  )}
                </div>
                <div ref={eventLogRef} style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:'0.35rem', maxHeight:220 }}>
                  {events.length===0
                    ? <div style={{ color:'var(--text-secondary)', fontSize:'0.8rem' }}>Listening for detections…</div>
                    : events.map((ev,i) => (
                        <div key={i} style={{ display:'flex', gap:'0.6rem', fontSize:'0.78rem', padding:'0.3rem 0.5rem', borderRadius:6, background:'var(--bg-app)', border:'1px solid var(--border-light)', lineHeight:1.4 }}>
                          <span style={{ color:'var(--text-muted)', fontFamily:'monospace', flexShrink:0 }}>{ev.time}</span>
                          <span style={{ color:'var(--text-primary)' }}>{ev.message}</span>
                        </div>
                      ))
                  }
                </div>
              </div>
            </div>
          )}

          {/* Heatmap */}
          {heatmapB64 && (
            <div style={{ background:'var(--bg-panel)', border:'1px solid var(--border-light)', borderRadius:14, padding:'1.1rem 1.25rem', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.75rem' }}>
                <Cpu size={16} color="var(--alert-red)" />
                <span style={{ fontWeight:700, fontSize:'0.85rem', color:'var(--text-primary)' }}>Thermal Heatmap</span>
                <span style={{ marginLeft:'auto', fontSize:'0.7rem', color:'var(--text-secondary)' }}>Gaussian-smoothed foot traffic density</span>
              </div>
              <img src={`data:image/jpeg;base64,${heatmapB64}`} alt="Heatmap" style={{ width:'100%', borderRadius:10, display:'block', border: '1px solid var(--border-light)' }} />
            </div>
          )}

          {/* AI Insights */}
          {stage==='complete' && analytics.insights && analytics.insights.length>0 && (
            <div style={{ background:'var(--primary-blue-light)', border:'1px solid var(--primary-blue-border)', borderRadius:14, padding:'1.25rem' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'1rem' }}>
                <Sparkles size={18} color="var(--primary-blue)" />
                <span style={{ fontWeight:700, fontSize:'0.9rem', color:'var(--text-primary)' }}>AI-Generated Business Insights</span>
              </div>
              {analytics.insights.map((ins,i) => (
                <div key={i} style={{ display:'flex', gap:'0.75rem', padding:'0.75rem', borderRadius:10, background:'var(--bg-panel)', border:'1px solid var(--border-light)', marginBottom:'0.5rem', alignItems:'flex-start', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <CheckCircle size={15} color="var(--primary-blue)" style={{ flexShrink:0, marginTop:2 }} />
                  <span style={{ fontSize:'0.875rem', color:'var(--text-secondary)', lineHeight:1.6 }}>{ins}</span>
                </div>
              ))}
            </div>
          )}

          {/* Keyframes */}
          {stage==='complete' && keyframes.length>0 && (
            <div style={{ background:'var(--bg-panel)', border:'1px solid var(--border-light)', borderRadius:14, padding:'1.1rem 1.25rem', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.75rem' }}>
                <Eye size={16} color="var(--primary-blue)" />
                <span style={{ fontWeight:700, fontSize:'0.85rem', color:'var(--text-primary)' }}>Annotated Keyframes</span>
                <span style={{ marginLeft:'auto', fontSize:'0.7rem', color:'var(--text-secondary)' }}>{keyframes.length} frames</span>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'0.5rem' }}>
                {keyframes.map((kf,i) => (
                  <img key={i} src={`data:image/jpeg;base64,${kf}`} alt={`Frame ${i+1}`}
                    style={{ width:'100%', borderRadius:8, border:'1px solid var(--border-light)', display:'block' }} />
                ))}
              </div>
            </div>
          )}

          {/* CTA */}
          {stage==='complete' && (
            <div style={{ display:'flex', gap:'1rem', justifyContent:'center', padding:'0.5rem 0' }}>
              <button onClick={onGoToDashboard} style={{ padding:'0.9rem 2rem', borderRadius:12, border:'none', background:'var(--primary-blue)', color:'#fff', fontWeight:700, fontSize:'0.95rem', cursor:'pointer', display:'flex', alignItems:'center', gap:'0.6rem', boxShadow:'0 4px 12px rgba(37,99,235,0.3)' }}>
                <Activity size={18} /> View Full Dashboard →
              </button>
              <button onClick={resetDemo} style={{ padding:'0.9rem 2rem', borderRadius:12, border:'1px solid var(--border-strong)', background:'var(--bg-panel)', color:'var(--text-secondary)', fontWeight:600, fontSize:'0.85rem', cursor:'pointer', display:'flex', alignItems:'center', gap:'0.6rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <Film size={16} /> Analyze Another
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin  { to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
};

export default DemoPage;
