import React, { useState, useEffect } from 'react';
import { Box, ScanSearch, MapPin, AlertTriangle, Video, EyeOff, LayoutTemplate, Layers, CheckCircle, RefreshCcw, Camera } from 'lucide-react';

export default function ShelfMonitoring() {
  const [stockAlerts, setStockAlerts] = useState<any[]>([]);

  useEffect(() => {
    const fetchKPIs = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/inventory/warehouse/alerts');
        if (res.ok) setStockAlerts((await res.json()).alerts || []);
      } catch {}
    };
    fetchKPIs();
  }, []);

  const emptyShelves = stockAlerts.filter(a => a.alert_type === 'out_of_stock').length;
  const lowStock = stockAlerts.length - emptyShelves;

  return (
    <div style={{ paddingBottom: '2rem' }}>
      {/* Top Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ background: 'var(--primary-blue)', color: 'white', padding: '0.5rem', borderRadius: 8 }}>
            <Box size={20} />
          </div>
          <div>
            <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.25rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              Shelf Monitoring & Planogram Telemetry
              <span style={{ fontSize: '0.65rem', background: 'var(--bg-app)', color: 'var(--text-secondary)', padding: '0.2rem 0.5rem', borderRadius: 4, border: '1px solid var(--border-strong)' }}>Deterministic Coordinate Mode</span>
            </h2>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Planogram 3D spatial mapping active: AI evaluates geometric shelf slots & volume heuristics instead of raw pixel categorization.</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: 'var(--bg-panel)', padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <RefreshCcw size={16} color="var(--primary-blue)" />
          <div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: '0.05em' }}>POS SYNC INTERVAL</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>30s (Real-time Drain Mode)</div>
          </div>
        </div>
        <div style={{ background: 'var(--bg-panel)', padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <LayoutTemplate size={16} color="var(--primary-blue)" />
          <div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: '0.05em' }}>PLANOGRAM MAPPING</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>48/48 Bays Calibrated</div>
          </div>
        </div>
        <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><ScanSearch size={16} /> Run Bay Sweep</button>
      </div>

      {/* KPI Strip */}
      <div className="kpi-strip">
        <div className="kpi-card" style={{ borderTop: '3px solid var(--primary-blue)' }}>
          <div className="kpi-label">Monitored Bays <LayoutTemplate size={14} color="var(--primary-blue)" /></div>
          <div className="kpi-value">48</div>
          <div className="kpi-subtext" style={{ background: '#f1f5f9', display: 'inline-block', padding: '0.1rem 0.4rem', borderRadius: 4, marginTop: '0.4rem', fontWeight: 600, color: 'var(--text-secondary)' }}>6 Aisle Sectors</div>
        </div>
        
        <div className="kpi-card">
          <div className="kpi-label">Nominal Fill Rate <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary-blue)' }} /></div>
          <div className="kpi-value">37</div>
          <div className="kpi-subtext" style={{ color: 'var(--primary-blue)', fontWeight: 600 }}>77.1% Total</div>
        </div>

        <div className="kpi-card" style={{ borderTop: lowStock > 0 ? '3px solid var(--alert-amber)' : undefined }}>
          <div className="kpi-label" style={{ color: lowStock > 0 ? 'var(--alert-amber)' : undefined }}>Low Stock Warning {lowStock > 0 && <AlertTriangle size={14} />}</div>
          <div className="kpi-value" style={{ color: lowStock > 0 ? 'var(--alert-amber)' : undefined }}>{lowStock}</div>
          <div className="kpi-subtext" style={{ background: 'var(--alert-amber-light)', color: 'var(--alert-amber)', display: 'inline-block', padding: '0.1rem 0.4rem', borderRadius: 4, marginTop: '0.4rem', fontWeight: 700 }}>Threshold &lt;40%</div>
        </div>

        <div className="kpi-card" style={{ borderTop: emptyShelves > 0 ? '3px solid var(--alert-red)' : undefined }}>
          <div className="kpi-label" style={{ color: emptyShelves > 0 ? 'var(--alert-red)' : undefined }}>Out of Stock (Zero) {emptyShelves > 0 && <AlertTriangle size={14} />}</div>
          <div className="kpi-value" style={{ color: emptyShelves > 0 ? 'var(--alert-red)' : undefined }}>{emptyShelves}</div>
          <div className="kpi-subtext" style={{ background: emptyShelves > 0 ? 'var(--alert-red-light)' : 'var(--bg-app)', color: emptyShelves > 0 ? 'var(--alert-red)' : 'var(--text-secondary)', display: 'inline-block', padding: '0.1rem 0.4rem', borderRadius: 4, marginTop: '0.4rem', fontWeight: 700 }}>{emptyShelves > 0 ? 'Action Needed' : 'Nominal'}</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Camera Blind Spots <EyeOff size={14} color="var(--text-secondary)" /></div>
          <div className="kpi-value">2</div>
          <div className="kpi-subtext">Pillar Obstructed</div>
        </div>
      </div>

      <div className="panel" style={{ padding: '1rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: '#f8fafc', padding: '0.4rem 0.75rem', borderRadius: 6, border: '1px solid var(--border-light)' }}>
          <MapPin size={14} color="var(--text-muted)" /> <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>ZONE:</span>
          <select style={{ border: 'none', background: 'transparent', fontSize: '0.8rem', outline: 'none' }}><option>Aisle 3 - Dairy & Plant-Based</option></select>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: '#f8fafc', padding: '0.4rem 0.75rem', borderRadius: 6, border: '1px solid var(--border-light)' }}>
          <LayoutTemplate size={14} color="var(--text-muted)" /> <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>BAY:</span>
          <select style={{ border: 'none', background: 'transparent', fontSize: '0.8rem', outline: 'none' }}><option>Bay A-03 (Refrigerated)</option></select>
        </div>

        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', fontWeight: 600, marginLeft: '1rem' }}>
          <span style={{ color: 'var(--primary-blue)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><div style={{ width: 8, height: 8, background: 'var(--primary-blue)', borderRadius: 2 }} /> Nominal (37)</span>
          <span style={{ color: 'var(--alert-amber)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><div style={{ width: 8, height: 8, background: 'var(--alert-amber)', borderRadius: 2 }} /> Low Stock ({lowStock})</span>
          <span style={{ color: 'var(--alert-red)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><div style={{ width: 8, height: 8, background: 'var(--alert-red)', borderRadius: 2 }} /> Empty ({emptyShelves})</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr', gap: '1.5rem' }}>
        {/* Left: Coordinate Matrix */}
        <div className="panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '2rem' }}>
            <div style={{ background: 'var(--primary-blue-light)', color: 'var(--primary-blue)', padding: '0.75rem', borderRadius: 8 }}><LayoutTemplate size={20} /></div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Shelf Bay A-03 • Digital Twin Coordinate Matrix <span style={{ fontSize: '0.7rem', background: '#f1f5f9', padding: '0.2rem 0.4rem', borderRadius: 4, marginLeft: '0.5rem' }}>Aisle 3 West</span></h3>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Camera 04 Overhead (4K/30fps) • 32 Coordinates Mapped • Coordinate Hash: <span style={{ color: 'var(--primary-blue)', fontWeight: 600 }}>#PLG-AISLE3-BAY03-V4</span></p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {[
              { tier: 'TIER 3 • WAIST LEVEL (PRIMARY GRAB SHELF)', z: '95CM', cap: '192 units', occ: '52%', slots: [
                { id: 'P01', name: 'Almond Milk', current: 0, max: 24, status: 'empty' },
                { id: 'P02', name: 'Vanilla Oats', current: 4, max: 24, status: 'low' },
                { id: 'P03', name: 'Org Yogurt', current: 21, max: 24, status: 'nominal' },
                { id: 'P04', name: 'Greek 0%', current: 19, max: 24, status: 'nominal' },
                { id: 'P05', name: 'Greek Honey', current: 20, max: 24, status: 'nominal' },
                { id: 'P06', name: 'Kefir Plain', current: 18, max: 24, status: 'nominal' },
                { id: 'P07', name: 'Skyr Van.', current: 22, max: 24, status: 'nominal' },
              ]},
              { tier: 'TIER 2 • EYE LEVEL (HIGH VELOCITY ZONE)', z: '140CM', cap: '160 units', occ: '61%', slots: [
                { id: 'P01', name: 'Oat Barista', current: 16, max: 20, status: 'nominal' },
                { id: 'P02', name: 'Soy Milk', current: 14, max: 20, status: 'nominal' },
                { id: 'P03', name: 'Organic Oats', current: 8, max: 20, status: 'low' },
                { id: 'P04', name: 'Coconut', current: 15, max: 20, status: 'nominal' },
                { id: 'P05', name: 'Cashew', current: 5, max: 20, status: 'low' },
                { id: 'P06', name: 'Rice Milk', current: 17, max: 20, status: 'nominal' },
                { id: 'P07', name: 'Cold Brew', current: 16, max: 20, status: 'nominal' },
              ]}
            ].map(tier => (
              <div key={tier.tier}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                  <span>{tier.tier} • Z: {tier.z}</span>
                  <span>Capacity: {tier.cap} • Occupancy: {tier.occ}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '0.75rem' }}>
                  {tier.slots.map(slot => (
                    <div key={slot.id} style={{ 
                      padding: '0.75rem 0.5rem', 
                      borderRadius: 6, 
                      border: `1px solid ${slot.status === 'empty' ? 'var(--alert-red)' : slot.status === 'low' ? 'var(--alert-amber)' : 'var(--border-strong)'}`,
                      background: slot.status === 'empty' ? 'var(--alert-red-light)' : slot.status === 'low' ? 'var(--alert-amber-light)' : '#f8fafc',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '0.2rem', display: 'flex', justifyContent: 'space-between' }}>
                        {slot.id} <div style={{ width: 6, height: 6, borderRadius: '50%', background: slot.status === 'empty' ? 'var(--alert-red)' : slot.status === 'low' ? 'var(--alert-amber)' : 'var(--primary-blue)' }} />
                      </div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{slot.name}</div>
                      <div style={{ fontSize: '0.85rem', color: slot.status === 'empty' ? 'var(--alert-red)' : 'var(--primary-blue)', fontWeight: 800, margin: '0.25rem 0' }}>{slot.current}/{slot.max}</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>({Math.round(slot.current/slot.max*100)}%)</div>
                    </div>
                  ))}
                  <div style={{ padding: '0.75rem 0.5rem', borderRadius: 6, border: '1px dashed var(--border-strong)', background: '#f1f5f9', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                    <EyeOff size={16} style={{ marginBottom: '0.25rem' }} />
                    <span style={{ fontSize: '0.6rem', fontWeight: 600 }}>Pillar Blind Spot</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Diagnostics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="panel" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}><Video size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> SPATIAL CAM 04</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>30.0 FPS • 1080p</div>
            </div>
            <div style={{ width: '100%', aspectRatio: '16/9', background: '#e2e8f0', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-strong)' }}>
              <Camera size={32} color="var(--text-muted)" />
            </div>
          </div>

          <div className="panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>SLOT DIAGNOSTIC TELEMETRY</span>
              <span style={{ background: 'var(--alert-red-light)', color: 'var(--alert-red)', padding: '0.1rem 0.4rem', borderRadius: 4, fontSize: '0.7rem', fontWeight: 700 }}>EMPTY</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--primary-blue)', fontWeight: 600, marginBottom: '0.25rem' }}>Shelf Bay A-03 | Tier 3 → Position 01</div>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>Unsweetened Almond Milk 1L</h4>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>SKU: #44102 • Facing: 4 Rows Deep: 6</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700 }}>AI Detected Count</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>0 / 24</div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700 }}>Fill Percentage</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--alert-red)' }}>0% Fill</div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700 }}>POS Sales Velocity</div>
                <div style={{ fontSize: '1rem', fontWeight: 700 }}>3.8 units / hr</div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700 }}>Last Scan Time</div>
                <div style={{ fontSize: '1rem', fontWeight: 700 }}>14:22:15</div>
              </div>
            </div>

            <div style={{ background: 'var(--primary-blue-light)', padding: '1rem', borderRadius: 8, fontSize: '0.8rem', color: 'var(--primary-blue)', display: 'flex', gap: '0.5rem', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <CheckCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              <span><strong>Audited via Cam 04:</strong> Line of sight 98%. Planogram coordinates verify empty space in 4 distinct front row depths.</span>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn-primary" style={{ flex: 1 }}>▶ Dispatch Restock</button>
              <button className="btn-primary" style={{ background: 'white', color: 'var(--text-primary)', border: '1px solid var(--border-strong)' }}><EyeOff size={16} /> Audit</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
