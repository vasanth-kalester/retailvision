import React, { useState, useRef, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';

interface Point {
  x: number;
  y: number;
}

export interface Zone {
  name: string;
  poly: [number, number][]; // normalized 0-1 coordinates
}

interface ZoneConfiguratorProps {
  source: string; // the video source (file name or stream url or 0)
  onSave: (zones: Zone[]) => void;
  onCancel: () => void;
}

export default function ZoneConfigurator({ source, onSave, onCancel }: ZoneConfiguratorProps) {
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [zones, setZones] = useState<Zone[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [currentPoint, setCurrentPoint] = useState<Point | null>(null);
  
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // Fetch snapshot
    const fetchSnapshot = async () => {
      try {
        const res = await fetch(`http://localhost:8000/api/test/snapshot?source=${encodeURIComponent(source)}`);
        if (!res.ok) throw new Error("Could not get snapshot");
        const data = await res.json();
        setSnapshotUrl(`data:image/jpeg;base64,${data.snapshot}`);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchSnapshot();
  }, [source]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setStartPoint({ x, y });
    setCurrentPoint({ x, y });
    setIsDrawing(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    setCurrentPoint({ x, y });
  };

  const handleMouseUp = () => {
    if (!isDrawing || !startPoint || !currentPoint) return;
    setIsDrawing(false);
    
    const x1 = Math.min(startPoint.x, currentPoint.x);
    const y1 = Math.min(startPoint.y, currentPoint.y);
    const x2 = Math.max(startPoint.x, currentPoint.x);
    const y2 = Math.max(startPoint.y, currentPoint.y);
    
    // Minimum size check
    if (x2 - x1 < 0.05 || y2 - y1 < 0.05) {
       setStartPoint(null);
       setCurrentPoint(null);
       return;
    }
    
    const newZoneName = prompt("Enter shelf/product name for this zone:", `Zone ${zones.length + 1}`);
    if (newZoneName) {
      setZones([...zones, {
        name: newZoneName,
        poly: [
          [x1, y1],
          [x2, y1],
          [x2, y2],
          [x1, y2]
        ]
      }]);
    }
    setStartPoint(null);
    setCurrentPoint(null);
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '20px', width: '90%', maxWidth: '1000px', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, color: '#fff' }}>Configure Analytics Zones</h2>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X /></button>
        </div>
        
        {loading ? (
          <div style={{ color: '#fff', textAlign: 'center', padding: '50px' }}>Capturing snapshot...</div>
        ) : snapshotUrl ? (
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <div 
              style={{ position: 'relative', flex: 1, minWidth: '400px', cursor: 'crosshair', userSelect: 'none' }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <img ref={imgRef} src={snapshotUrl} alt="Snapshot" style={{ width: '100%', display: 'block', borderRadius: '8px' }} draggable={false} />
              
              {/* Render existing zones */}
              {zones.map((z, i) => {
                const x = z.poly[0][0] * 100;
                const y = z.poly[0][1] * 100;
                const w = (z.poly[2][0] - z.poly[0][0]) * 100;
                const h = (z.poly[2][1] - z.poly[0][1]) * 100;
                return (
                  <div key={i} style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%`, border: '2px solid #10b981', backgroundColor: 'rgba(16, 185, 129, 0.2)', pointerEvents: 'none' }}>
                    <span style={{ backgroundColor: '#10b981', color: '#fff', fontSize: '12px', padding: '2px 4px', position: 'absolute', top: -20, left: -2, whiteSpace: 'nowrap', borderRadius: '4px' }}>{z.name}</span>
                  </div>
                )
              })}
              
              {/* Render currently drawing zone */}
              {isDrawing && startPoint && currentPoint && (
                <div style={{ 
                  position: 'absolute', 
                  left: `${Math.min(startPoint.x, currentPoint.x) * 100}%`, 
                  top: `${Math.min(startPoint.y, currentPoint.y) * 100}%`, 
                  width: `${Math.abs(currentPoint.x - startPoint.x) * 100}%`, 
                  height: `${Math.abs(currentPoint.y - startPoint.y) * 100}%`, 
                  border: '2px dashed #6366f1', 
                  backgroundColor: 'rgba(99, 102, 241, 0.2)', 
                  pointerEvents: 'none' 
                }} />
              )}
            </div>
            
            <div style={{ width: '250px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
               <h4 style={{ color: '#fff', margin: 0 }}>Defined Zones</h4>
               <p style={{ color: '#94a3b8', fontSize: '12px' }}>Click and drag on the image to define a new zone.</p>
               <ul style={{ listStyle: 'none', padding: 0, margin: 0, flex: 1, overflowY: 'auto' }}>
                 {zones.map((z, i) => (
                   <li key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#334155', padding: '8px 12px', borderRadius: '6px', marginBottom: '8px', color: '#fff', fontSize: '14px' }}>
                     {z.name}
                     <button onClick={() => setZones(zones.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: '#f43f5e', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                       <Trash2 size={16} />
                     </button>
                   </li>
                 ))}
                 {zones.length === 0 && <li style={{ color: '#64748b', fontSize: '14px' }}>No zones defined.</li>}
               </ul>
               <button onClick={() => onSave(zones)} style={{ backgroundColor: '#6366f1', color: '#fff', border: 'none', padding: '12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Save Zones</button>
            </div>
          </div>
        ) : (
          <div style={{ color: '#f43f5e', textAlign: 'center', padding: '50px' }}>Failed to load snapshot. Make sure the camera is available.</div>
        )}
      </div>
    </div>
  );
}
