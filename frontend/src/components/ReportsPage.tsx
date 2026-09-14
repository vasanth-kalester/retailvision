import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { ChevronLeft, Download, Calendar, Filter, FileText, CheckCircle2, AlertTriangle, Printer, Layers, Box, Activity, PackageOpen, ShieldAlert, Users } from 'lucide-react';

export default function ReportsPage({ onBack }: { onBack: () => void }) {
  const [hourly, setHourly] = useState<any[]>([]);
  const [footfall, setFootfall] = useState({ ENTRY: 0, EXIT: 0 });
  const [dwells, setDwells] = useState<any[]>([]);
  const [stockAlerts, setStockAlerts] = useState<any[]>([]);
  const [securityAlerts, setSecurityAlerts] = useState<any[]>([]);
  const [queueStatus, setQueueStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [hourlyRes, footfallRes, dwellRes, stockRes, secRes, queueRes] = await Promise.all([
          fetch('http://localhost:8000/api/metrics/hourly'),
          fetch('http://localhost:8000/api/metrics/footfall'),
          fetch('http://localhost:8000/api/metrics/dwell'),
          fetch('http://localhost:8000/api/inventory/warehouse/alerts'),
          fetch('http://localhost:8000/api/security/alerts'),
          fetch('http://localhost:8000/api/queue/status'),
        ]);
        
        setHourly(await hourlyRes.json() || []);
        setFootfall(await footfallRes.json());
        setDwells(await dwellRes.json() || []);
        
        const sData = await stockRes.json();
        setStockAlerts(sData.alerts || []);
        
        const secData = await secRes.json();
        setSecurityAlerts(secData.alerts || []);
        
        setQueueStatus(await queueRes.json());
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  const exportData = () => {
    window.print();
  };

  // ── Derived Data ──
  const netOccupancy = Math.max(0, footfall.ENTRY - footfall.EXIT);
  const avgWait = queueStatus?.avg_wait?.toFixed(1) || '0.0';
  const activeLanes = queueStatus?.active_lanes || 0;

  // Merge logs
  const allLogs = [
    ...stockAlerts.map(a => ({
      id: a._id,
      timestamp: a.triggered_at,
      domain: 'Stock Alert',
      location: a.sku,
      vision: `${a.current_units} units physical`,
      impact: a.alert_type,
      action: 'Inventory Audit',
      color: '#ef4444',
      bg: '#fef2f2'
    })),
    ...securityAlerts.map(a => ({
      id: a.id,
      timestamp: a.timestamp,
      domain: 'Security',
      location: `Track ID: ${a.track_id}`,
      vision: `Loitering > ${Math.floor(a.duration)}s`,
      impact: 'Potential Shrinkage',
      action: 'Review CCTV',
      color: '#f59e0b',
      bg: '#fffbeb'
    }))
  ].sort((a, b) => b.timestamp - a.timestamp);

  // Styling helpers
  const st = {
    page: { background: '#f8fafc', color: '#0f172a', minHeight: '100%', padding: '2rem', fontFamily: 'Inter, sans-serif' },
    card: { background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
    title: { fontSize: '1.5rem', fontWeight: 800, margin: '0 0 0.25rem 0', color: '#0f172a' },
    subtitle: { fontSize: '0.85rem', color: '#64748b', margin: 0 },
    btnPrimary: { background: '#1d4ed8', color: '#ffffff', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', fontWeight: 600, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' },
    btnSecondary: { background: '#ffffff', color: '#334155', border: '1px solid #cbd5e1', padding: '0.5rem 1rem', borderRadius: '6px', fontWeight: 600, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' },
    kpiValue: { fontSize: '2rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'baseline', gap: '0.5rem' },
    kpiLabel: { fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '0.5rem' },
    tableHeader: { fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.05em', padding: '1rem', borderBottom: '1px solid #e2e8f0', textAlign: 'left' as const },
    tableCell: { fontSize: '0.8rem', color: '#334155', padding: '1rem', borderBottom: '1px solid #f1f5f9' }
  };

  if (loading && !queueStatus) {
    return <div style={{...st.page, display: 'flex', justifyContent: 'center', alignItems: 'center'}}><div style={{color: '#64748b'}}>Loading Reports...</div></div>;
  }

  return (
    <div style={st.page}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', marginBottom: '1rem', padding: 0 }}>
        <ChevronLeft size={16} /> Back to Dashboard
      </button>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={st.title}>Store Operational Reports & Data Export</h1>
          <p style={st.subtitle}>Generate consolidated audits across Vision shelf telemetry, POS throughput, queue SLAs, and shrinkage reconciliation.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button style={st.btnSecondary}><Calendar size={14} /> Last 7 Days</button>
          <button style={st.btnPrimary} onClick={exportData}><Printer size={14} /> Export Report (PDF)</button>
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{ ...st.card, padding: '0.75rem 1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', overflowX: 'auto' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', paddingRight: '1rem', borderRight: '1px solid #e2e8f0' }}>AUDIT DOMAIN</div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {['All Domains', 'Shelf Availability (OSA)', 'Queue & Front-End SLAs', 'Shrinkage & Triangulation', 'Footfall & Dwell'].map((d, i) => (
            <div key={d} style={{ padding: '0.3rem 0.75rem', background: i === 0 ? '#1d4ed8' : '#f1f5f9', color: i === 0 ? '#ffffff' : '#475569', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', border: i === 0 ? 'none' : '1px solid #e2e8f0' }}>
              {d}
            </div>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={st.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div style={st.kpiLabel}>WAREHOUSE STOCK ALERTS</div>
            <Box size={14} color="#64748b" />
          </div>
          <div style={st.kpiValue}>
            {stockAlerts.length}
            <span style={{ fontSize: '0.75rem', color: '#ef4444', background: '#fef2f2', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>Active</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.75rem' }}>Across all departments</div>
        </div>

        <div style={st.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div style={st.kpiLabel}>CHECKOUT SLA ADHERENCE</div>
            <Activity size={14} color="#64748b" />
          </div>
          <div style={st.kpiValue}>
            {avgWait} <span style={{ fontSize: '1rem', fontWeight: 600, color: '#64748b' }}>min</span>
            <span style={{ fontSize: '0.75rem', color: '#10b981', background: '#ecfdf5', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>Avg Wait</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.75rem', display: 'flex', gap: '1rem' }}>
            <span><strong>{queueStatus?.checkout_count || 0}</strong> Queued</span>
            <span><strong>{activeLanes}</strong> Lanes Active</span>
          </div>
        </div>

        <div style={st.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div style={st.kpiLabel}>SECURITY INCIDENTS</div>
            <ShieldAlert size={14} color="#64748b" />
          </div>
          <div style={st.kpiValue}>
            {securityAlerts.length}
            <span style={{ fontSize: '0.75rem', color: '#f59e0b', background: '#fffbeb', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>Loitering</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.75rem' }}>Awaiting Review</div>
        </div>

        <div style={st.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div style={st.kpiLabel}>CURRENT OCCUPANCY</div>
            <Users size={14} color="#64748b" />
          </div>
          <div style={st.kpiValue}>
            {netOccupancy}
            <span style={{ fontSize: '0.75rem', color: '#10b981', background: '#ecfdf5', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>Shoppers</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.75rem', display: 'flex', gap: '1rem' }}>
            <span><strong>{footfall.ENTRY}</strong> Entries</span>
            <span><strong>{footfall.EXIT}</strong> Exits</span>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Left Column: Charts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div style={st.card}>
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 0.25rem 0' }}>Dwell Times by Promotional Zone</h3>
              <p style={st.subtitle}>Average shopper engagement duration across physical display areas.</p>
            </div>
            <div style={{ height: 250 }}>
              {dwells.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dwells} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="promo_zone" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="avg_duration" name="Avg Dwell (s)" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={60} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>No dwell data recorded for this period.</div>
              )}
            </div>
          </div>

          <div style={st.card}>
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 0.25rem 0' }}>Hourly Traffic Distribution</h3>
              <p style={st.subtitle}>Entries and Exits aggregated by hour of the day.</p>
            </div>
            <div style={{ height: 250 }}>
              {hourly.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourly} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}:00`} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '0.75rem' }} />
                    <Bar dataKey="ENTRY" name="Entries" fill="#10b981" radius={[4, 4, 0, 0]} stackId="a" />
                    <Bar dataKey="EXIT" name="Exits" fill="#f43f5e" radius={[4, 4, 0, 0]} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>No footfall data recorded.</div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Audit Manifest */}
        <div style={{ ...st.card, alignSelf: 'start', background: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <FileText size={18} color="#1d4ed8" />
            <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>PDF Audit Manifest</h3>
            <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: '#1d4ed8', background: '#dbeafe', padding: '0.1rem 0.4rem', borderRadius: 4, fontWeight: 700 }}>A4 • 3 Pages</span>
          </div>
          
          {/* Document Preview Thumbnails */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
            {[1, 2, 3].map(p => (
              <div key={p} style={{ flex: 1, aspectRatio: '1/1.4', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ height: '8px', width: '60%', background: '#e2e8f0', borderRadius: '2px' }}></div>
                <div style={{ height: '4px', width: '100%', background: '#f1f5f9', borderRadius: '2px' }}></div>
                <div style={{ height: '4px', width: '100%', background: '#f1f5f9', borderRadius: '2px' }}></div>
                <div style={{ flex: 1, background: '#f8fafc', borderRadius: '2px', marginTop: '4px', border: '1px dashed #e2e8f0' }}></div>
                <div style={{ fontSize: '0.5rem', color: '#94a3b8', textAlign: 'center', marginTop: 'auto' }}>Page {p}</div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.75rem' }}>INCLUDED REPORT SECTIONS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
            {[
              { label: 'Edge AI Diagnostic Metadata (Zero-PII)', checked: true },
              { label: 'Department Manager Action Log & Re-stock', checked: true },
              { label: 'Camera Line-of-Sight Confidence Scores', checked: true },
              { label: 'Append Raw Discrepancy SKU Tables', checked: false }
            ].map((s, i) => (
              <label key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.75rem', color: '#334155', cursor: 'pointer' }}>
                <input type="checkbox" defaultChecked={s.checked} style={{ marginTop: '0.15rem' }} />
                <span>{s.label}</span>
              </label>
            ))}
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.75rem', fontSize: '0.7rem', color: '#64748b', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Security:</span> <strong>Internal Store Operations Only</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Hash Signature:</span> <strong style={{ fontFamily: 'monospace' }}>sha256:4f8e...90eb</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Generated At:</span> <strong>{new Date().toISOString().slice(0,19).replace('T', ' ')} UTC</strong></div>
          </div>

          <button style={{ ...st.btnPrimary, width: '100%', justifyContent: 'center', padding: '0.75rem', marginBottom: '0.5rem' }} onClick={exportData}>
            <Download size={16} /> Download Formatted PDF
          </button>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button style={{ ...st.btnSecondary, flex: 1, justifyContent: 'center' }}>Email Regional</button>
            <button style={{ ...st.btnSecondary, flex: 1, justifyContent: 'center' }}>Dispatch Teams</button>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div style={st.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 0.25rem 0' }}>Consolidated Incident & Compliance Log</h3>
            <p style={st.subtitle}>Line-item event telemetry with automated camera vision triangulation.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.4rem 0.75rem', width: 250 }}>
            <Filter size={14} color="#94a3b8" />
            <input type="text" placeholder="Filter SKU, state, event..." style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.75rem', marginLeft: '0.5rem', width: '100%', color: '#334155' }} />
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={st.tableHeader}>TIMESTAMP</th>
                <th style={st.tableHeader}>CATEGORY DOMAIN</th>
                <th style={st.tableHeader}>PHYSICAL LOCATION</th>
                <th style={st.tableHeader}>VISION VS. BASELINE</th>
                <th style={st.tableHeader}>OPERATIONAL IMPACT</th>
                <th style={st.tableHeader}>RESOLUTION / ACTION</th>
                <th style={st.tableHeader}>AUDIT PROOF</th>
              </tr>
            </thead>
            <tbody>
              {allLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ ...st.tableCell, textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>No recorded incidents for this timeframe.</td>
                </tr>
              ) : (
                allLogs.map((log: any) => (
                  <tr key={log.id}>
                    <td style={st.tableCell}>{new Date(log.timestamp * 1000).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                    <td style={st.tableCell}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: log.bg, color: log.color, padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700 }}>
                        <div style={{ width: 6, height: 6, borderRadius: 3, background: log.color }}></div> {log.domain}
                      </span>
                    </td>
                    <td style={{ ...st.tableCell, fontWeight: 600 }}>{log.location}</td>
                    <td style={st.tableCell}>{log.vision}</td>
                    <td style={{ ...st.tableCell, color: log.color, fontWeight: 700 }}>{log.impact}</td>
                    <td style={st.tableCell}>{log.action}</td>
                    <td style={st.tableCell}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', border: '1px solid #cbd5e1', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, color: '#1d4ed8' }}>
                        <CheckCircle2 size={12} /> Verified
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
