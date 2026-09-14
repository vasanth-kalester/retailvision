import { useState, useEffect } from 'react';
import { Camera, AlertTriangle, Package, Activity, TrendingUp, Cpu, Settings, Maximize, Bell, CheckCircle2, Users } from 'lucide-react';
import { AreaChart, Area, XAxis, ResponsiveContainer, Tooltip } from 'recharts';

export default function Overview({ systemStatus }: any) {
  const [footfall, setFootfall] = useState(0);
  const [queueCount, setQueueCount] = useState(0);
  const [stockAlerts, setStockAlerts] = useState<any[]>([]);
  const [securityAlerts, setSecurityAlerts] = useState<any[]>([]);
  const [efficiencyData, setEfficiencyData] = useState<any[]>([]);
  
  // Camera stream logic
  const [liveThumbnail, setLiveThumbnail] = useState<string | null>(null);

  useEffect(() => {
    const fetchKPIs = async () => {
      try {
        const [ff, qc, sa, sec, eff] = await Promise.all([
          fetch('http://localhost:8000/api/metrics/footfall').then(r => r.json()),
          fetch('http://localhost:8000/api/queue/status').then(r => r.json()),
          fetch('http://localhost:8000/api/inventory/warehouse/alerts').then(r => r.json()),
          fetch('http://localhost:8000/api/security/alerts').then(r => r.json()),
          fetch('http://localhost:8000/api/metrics/efficiency').then(r => r.json())
        ]);
        setFootfall(ff.ENTRY || 0);
        setQueueCount(qc.checkout_count || 0);
        setStockAlerts(sa.alerts || []);
        setSecurityAlerts(sec.alerts || []);
        setEfficiencyData(eff || []);
      } catch {}
    };
    fetchKPIs();
    const interval = setInterval(fetchKPIs, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchStream = async () => {
      if (systemStatus?.camera_active) {
        try {
          const snapRes = await fetch('http://localhost:8000/api/test/snapshot?source=3');
          if (snapRes.ok) {
            const data = await snapRes.json();
            setLiveThumbnail(data.snapshot);
          }
        } catch {}
      }
    };
    fetchStream();
    const intv = setInterval(fetchStream, 2000); // 2fps for thumbnail
    return () => clearInterval(intv);
  }, [systemStatus]);

  const emptyShelves = stockAlerts.filter(a => a.alert_type === 'out_of_stock').length;
  const lowStock = stockAlerts.length - emptyShelves;
  const totalIncidents = securityAlerts.length + emptyShelves + (queueCount > 4 ? 1 : 0);

  return (
    <div style={{ paddingBottom: '2rem' }}>
      {/* Top Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--primary-blue-light)', color: 'var(--primary-blue)', padding: '0.4rem 0.75rem', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary-blue)' }} />
            EDGE NODE #04 ACTIVE
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <Cpu size={14} /> Floor Telemetry & Shelf Vision <span style={{ color: 'var(--text-muted)' }}>• Store Sync: Real-time (14ms)</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn-primary" style={{ background: 'white', color: 'var(--text-primary)', border: '1px solid var(--border-strong)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Settings size={14} /> Sensitivity: Standard (0.85)
          </button>
          <button className="btn-primary" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Activity size={14} /> Run Full Store Scan
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="kpi-strip">
        <div className="kpi-card" style={{ borderTop: '3px solid var(--primary-blue)' }}>
          <div className="kpi-label">Store Footfall <Users size={14} color="var(--primary-blue)" /></div>
          <div className="kpi-value">{footfall.toLocaleString()}</div>
          <div className="kpi-subtext" style={{ color: 'var(--primary-blue)', fontWeight: 600 }}>↗ +8.4% <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>vs last Tue</span></div>
        </div>
        
        <div className="kpi-card">
          <div className="kpi-label">Active Shoppers <Users size={14} color="var(--text-secondary)" /></div>
          <div className="kpi-value">128</div>
          <div className="kpi-subtext"><strong>42%</strong> capacity load (300 max)</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Low-Stock Shelves <Package size={14} color="var(--text-secondary)" /></div>
          <div className="kpi-value">{lowStock}</div>
          <div className="kpi-subtext"><strong>9</strong> bays identified<br/>Action planned (Next hour)</div>
        </div>

        <div className="kpi-card" style={{ borderTop: emptyShelves > 0 ? '3px solid var(--alert-red)' : undefined, background: emptyShelves > 0 ? 'var(--alert-red-light)' : undefined }}>
          <div className="kpi-label" style={{ color: emptyShelves > 0 ? 'var(--alert-red)' : undefined }}>Empty Shelves {emptyShelves > 0 && <AlertTriangle size={14} />}</div>
          <div className="kpi-value" style={{ color: emptyShelves > 0 ? 'var(--alert-red)' : undefined }}>{emptyShelves}</div>
          <div className="kpi-subtext" style={{ color: emptyShelves > 0 ? 'var(--alert-red)' : undefined }}>{emptyShelves > 0 ? 'Immediate Action Required' : 'None detected'}</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Checkout Queues <Activity size={14} color="var(--text-secondary)" /></div>
          <div className="kpi-value">{queueCount} <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>shopper{queueCount !== 1 && 's'}</span></div>
          <div className="kpi-subtext"><strong>2.1 min</strong> avg wait • 6 lanes open</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Active Incidents <Bell size={14} color={totalIncidents > 0 ? 'var(--alert-red)' : 'var(--text-secondary)'} /></div>
          <div className="kpi-value">{totalIncidents} <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Unresolved</span></div>
          <div className="kpi-subtext" style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
            {totalIncidents > 0 ? (
               <>
                <span style={{ background: 'var(--alert-red-light)', color: 'var(--alert-red)', padding: '0.1rem 0.4rem', borderRadius: 4, fontWeight: 700 }}>{emptyShelves} High</span>
                <span style={{ background: 'var(--alert-amber-light)', color: 'var(--alert-amber)', padding: '0.1rem 0.4rem', borderRadius: 4, fontWeight: 700 }}>{lowStock} Medium</span>
               </>
            ) : <span style={{ color: 'var(--success-green)' }}>All Clear</span>}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Main Camera Feed Panel */}
          <div className="panel">
            <div className="panel-header" style={{ padding: '0.75rem 1rem' }}>
              <div>
                <h3 className="panel-title"><Camera size={16} color="var(--primary-blue)" /> Cam 04 - Central Grocery & Gondola B</h3>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>1080p @ 30.0 FPS • Local TensorRT Sub-Node • RTSP://edge-lane-04.local</div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn-primary" style={{ background: '#f1f5f9', color: 'var(--text-primary)', border: '1px solid var(--border-strong)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <TrendingUp size={14} /> AI HUD: ON
                </button>
                <button className="btn-primary" style={{ background: '#f1f5f9', color: 'var(--text-primary)', border: '1px solid var(--border-strong)', padding: '0.5rem' }}>
                  <Maximize size={14} />
                </button>
              </div>
            </div>
            
            <div style={{ padding: '1rem', background: '#e2e8f0' }}>
              <div style={{ width: '100%', aspectRatio: '16/9', background: '#000', borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
                {liveThumbnail ? (
                  <img src={`data:image/jpeg;base64,${liveThumbnail}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Live Camera" />
                ) : (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', flexDirection: 'column', gap: '1rem' }}>
                    <Camera size={48} />
                    <span>Camera Stream Offline — Enable in Camera Management</span>
                  </div>
                )}
                <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(0,0,0,0.6)', padding: '0.25rem 0.5rem', borderRadius: 4, color: 'white', fontSize: '0.7rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', animation: 'pulse 2s infinite' }} /> REC • 2026-09-13 14:38:12 UTC
                </div>
                <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.6)', padding: '0.25rem 0.5rem', borderRadius: 4, color: '#38bdf8', fontSize: '0.7rem' }}>
                  NPU-YOLOv10x | 14ms latency
                </div>
              </div>
            </div>

            <div style={{ padding: '1rem', borderTop: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)' }}>STORE FEEDS (4 ACTIVE MONITORED)</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--primary-blue)', fontWeight: 600, cursor: 'pointer' }}>View Matrix (18)</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                {[
                  { id: 'Cam 04', label: 'Aisle 4 Central', sub: emptyShelves > 0 ? `${emptyShelves} Empty Shelf` : 'Normal', alert: emptyShelves > 0 },
                  { id: 'Cam 01', label: 'Entrance Gates', sub: 'Footfall: 42/min', alert: false },
                  { id: 'Cam 07', label: 'Produce & Fresh', sub: '22 shoppers', alert: false },
                  { id: 'Cam 12', label: 'Checkout Counters', sub: `Queue: ${queueCount} wait`, alert: queueCount > 4 }
                ].map(c => (
                  <div key={c.id} style={{ border: `2px solid ${c.alert ? 'var(--alert-red)' : 'var(--border-light)'}`, borderRadius: 6, padding: '0.4rem', background: c.alert ? 'var(--alert-red-light)' : 'white' }}>
                    <div style={{ height: 60, background: '#cbd5e1', borderRadius: 4, marginBottom: '0.4rem', position: 'relative' }}>
                      <span style={{ position: 'absolute', bottom: 4, left: 4, fontSize: '0.6rem', color: 'white', background: 'rgba(0,0,0,0.6)', padding: '0.1rem 0.3rem', borderRadius: 2 }}>{c.id}</span>
                    </div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.label}</div>
                    <div style={{ fontSize: '0.65rem', color: c.alert ? 'var(--alert-red)' : 'var(--text-muted)' }}>{c.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Efficiency Chart */}
          <div className="panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h3 className="panel-title"><TrendingUp size={16} color="var(--primary-blue)" /> Store Restock Response Efficiency (Today)</h3>
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Target: &lt;12 min resolution</span>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Avg Time to Restock</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.25rem' }}>8.4 mins</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--primary-blue)', fontWeight: 600 }}>↓ 2.2 min faster than goal</div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Detection Accuracy</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.25rem' }}>99.2%</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>0.8% false positive</div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Stockouts Prevented</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.25rem' }}>38 items</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>Est. $1,420 recovered</div>
              </div>
            </div>

            <div style={{ height: 120 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={efficiencyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary-blue)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--primary-blue)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" stroke="var(--border-strong)" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                  <Area type="monotone" dataKey="val" stroke="var(--primary-blue)" strokeWidth={3} fillOpacity={1} fill="url(#colorVal)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        {/* Right Column (Incident Stream) */}
        <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="panel-header">
            <h3 className="panel-title"><Bell size={16} /> Incident Stream</h3>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>DETECT → UNDERSTAND → ALERT</span>
          </div>
          
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {['All', 'Shelf Outages', 'Queue Surge', 'Vision Feed'].map((t, i) => (
                <span key={t} style={{ background: i === 0 ? 'var(--primary-blue)' : '#f1f5f9', color: i === 0 ? 'white' : 'var(--text-secondary)', padding: '0.2rem 0.6rem', borderRadius: 4, fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}>
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            {/* Empty Shelf Incident */}
            {emptyShelves > 0 && (
              <div style={{ background: 'white', border: '1px solid var(--border-strong)', borderRadius: 8, padding: '1rem', borderLeft: '4px solid var(--alert-red)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--alert-red)', letterSpacing: '0.05em' }}>● CRITICAL EMPTY SHELF</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Just now</span>
                </div>
                <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.95rem' }}>Almond Milk Unsweetened 1L</h4>
                <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Location: <strong>Aisle 3 • Bay 05 (Dairy & Alternatives)</strong></p>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Cam Confidence: <strong>96.4%</strong></span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>•</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Backroom Stock: <strong style={{ color: 'var(--primary-blue)' }}>48 units</strong></span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn-danger" style={{ flex: 1, padding: '0.4rem' }}>Dispatch Restock Task</button>
                  <button className="btn-primary" style={{ background: 'white', color: 'var(--text-primary)', border: '1px solid var(--border-strong)', padding: '0.4rem' }}>Verify</button>
                </div>
              </div>
            )}

            {/* Queue Surge Incident */}
            {queueCount > 4 && (
              <div style={{ background: 'white', border: '1px solid var(--border-strong)', borderRadius: 8, padding: '1rem', borderLeft: '4px solid var(--primary-blue)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--primary-blue)', letterSpacing: '0.05em' }}>● QUEUE SURGE IMMINENT</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>2 mins ago</span>
                </div>
                <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.95rem' }}>Checkout 02 Queue Length Exceeded</h4>
                <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Current: <strong>{queueCount} Customers Wait</strong> • {Math.round(queueCount * 1.5)} min est. wait time</p>
                <button className="btn-primary" style={{ width: '100%', padding: '0.4rem' }}>Call Cashier Support (Counter 05)</button>
              </div>
            )}

            {/* Loitering / Security Alerts */}
            {securityAlerts.map(alert => (
              <div key={alert.id} style={{ background: 'white', border: '1px solid var(--border-strong)', borderRadius: 8, padding: '1rem', borderLeft: '4px solid var(--alert-amber)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--alert-amber)', letterSpacing: '0.05em' }}>● SUSPICIOUS BEHAVIOR</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Just now</span>
                </div>
                <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.95rem' }}>Extended Dwell Time Detected</h4>
                <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Track ID #{alert.track_id} lingering for &gt;{Math.floor(alert.duration)}s.</p>
                <button className="btn-primary" style={{ width: '100%', padding: '0.4rem', background: 'white', color: 'var(--text-primary)', border: '1px solid var(--border-strong)' }}>Acknowledge & Monitor</button>
              </div>
            ))}

            {totalIncidents === 0 && (
               <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                 <CheckCircle2 size={48} color="var(--success-green)" style={{ opacity: 0.5, marginBottom: '1rem' }} />
                 <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>No Active Incidents</span>
                 <span style={{ fontSize: '0.75rem' }}>All systems operating optimally.</span>
               </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
