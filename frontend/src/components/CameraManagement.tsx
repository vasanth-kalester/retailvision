import React, { useState, useEffect, useRef } from 'react';
import { Video, Activity, Eye, EyeOff, Camera, MapPin, Zap } from 'lucide-react';

export default function CameraManagement() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamFrames, setStreamFrames] = useState<{ original: string | null; processed: string | null }>({ original: null, processed: null });
  const [showAnalysis, setShowAnalysis] = useState(true);
  const [availableZones, setAvailableZones] = useState<string[]>([]);
  const [cameraMappings, setCameraMappings] = useState<Record<string, string>>({});
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    fetch('http://localhost:8000/api/zones')
      .then(res => res.json())
      .then(data => setAvailableZones(data.zones || []))
      .catch(console.error);
    
    fetch('http://localhost:8000/api/cameras/mapping')
      .then(res => res.json())
      .then(data => setCameraMappings(data || {}))
      .catch(console.error);
  }, []);

  const handleZoneChange = (cameraId: string, zoneName: string) => {
    setCameraMappings(prev => ({ ...prev, [cameraId]: zoneName }));
    fetch('http://localhost:8000/api/cameras/mapping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cameraId, zoneName })
    }).catch(console.error);
  };

  const startStream = () => {
    if (wsRef.current) wsRef.current.close();
    
    const ws = new WebSocket(`ws://localhost:8000/api/test/stream?source=0`);
    wsRef.current = ws;
    setIsStreaming(true);
    setStreamFrames({ original: null, processed: null });

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.error) {
          console.error(data.error);
          return;
        }
        setStreamFrames({
          original: data.original,
          processed: data.processed,
        });
      } catch (e) {
        console.error("Failed to parse websocket message", e);
      }
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

  useEffect(() => {
    return () => stopStream();
  }, []);

  return (
    <div style={{ paddingBottom: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ background: 'var(--primary-blue)', color: 'white', padding: '0.5rem', borderRadius: 8 }}>
            <Video size={20} />
          </div>
          <div>
            <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.25rem', color: 'var(--text-primary)' }}>
              Camera Management
            </h2>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Live edge streams and active computer vision feeds.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button 
            className="btn-primary" 
            style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: isStreaming ? 'var(--alert-red)' : 'var(--primary-blue)' }}
            onClick={isStreaming ? stopStream : startStream}
          >
            <Activity size={14} /> {isStreaming ? 'Stop All Feeds' : 'Start Camera Feeds'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        
        {/* Camera 1 */}
        <div className="panel" style={{ padding: '1rem', borderTop: '3px solid var(--primary-blue)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ margin: '0 0 0.2rem 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Camera size={16} color="var(--primary-blue)" /> Cam 01: Entrance
              </h3>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                <MapPin size={10} />
                <select 
                  value={cameraMappings['3'] || ''} 
                  onChange={(e) => handleZoneChange('3', e.target.value)}
                  style={{ background: 'transparent', border: '1px solid var(--border-light)', borderRadius: '4px', fontSize: '0.7rem', color: 'var(--text-secondary)', padding: '0.1rem 0.2rem', outline: 'none' }}
                >
                  <option value="">Default Zones</option>
                  {availableZones.map(z => <option key={z} value={z}>{z}</option>)}
                </select>
              </div>
            </div>
            
            {/* Toggle switch for Analysis */}
            <button 
              onClick={() => setShowAnalysis(!showAnalysis)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem',
                background: showAnalysis ? 'var(--primary-blue-light)' : '#f1f5f9',
                color: showAnalysis ? 'var(--primary-blue)' : 'var(--text-secondary)',
                border: `1px solid ${showAnalysis ? 'var(--primary-blue)' : 'var(--border-strong)'}`,
                borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer'
              }}
            >
              {showAnalysis ? <Eye size={14} /> : <EyeOff size={14} />}
              {showAnalysis ? 'Analysis ON' : 'Analysis OFF'}
            </button>
          </div>

          <div style={{ width: '100%', aspectRatio: '16/9', background: '#000', borderRadius: 8, overflow: 'hidden', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isStreaming ? (
              (showAnalysis ? streamFrames.processed : streamFrames.original) ? (
                <img 
                  src={`data:image/jpeg;base64,${showAnalysis ? streamFrames.processed : streamFrames.original}`} 
                  alt="Live Stream" 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />
              ) : (
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Buffering feed...</div>
              )
            ) : (
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Feed Offline</div>
            )}
            
            {isStreaming && (
              <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(0,0,0,0.6)', padding: '0.2rem 0.6rem', borderRadius: 4, backdropFilter: 'blur(4px)' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', animation: 'pulse 2s infinite' }} />
                <span style={{ color: 'white', fontSize: '0.7rem', fontWeight: 600 }}>LIVE</span>
              </div>
            )}
            {isStreaming && showAnalysis && (
              <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--primary-blue)', padding: '0.2rem 0.6rem', borderRadius: 4 }}>
                <Zap size={12} color="white" />
                <span style={{ color: 'white', fontSize: '0.7rem', fontWeight: 700 }}>AI ACTIVE</span>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-light)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <span>Resolution: 1080p</span>
            <span>FPS: 30</span>
            <span>Latency: 14ms</span>
          </div>
        </div>



      </div>
    </div>
  );
}
