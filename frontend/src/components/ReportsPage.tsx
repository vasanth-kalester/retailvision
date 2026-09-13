import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { BarChart2, ChevronLeft, Download, Calendar } from 'lucide-react';

interface HourlyData {
  hour: string;
  ENTRY: number;
  EXIT: number;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: 'rgba(8,15,30,0.95)', border: '1px solid rgba(99,130,255,0.2)', padding: '10px 14px', borderRadius: 10, backdropFilter: 'blur(8px)' }}>
        <p style={{ color: '#94a3b8', marginBottom: 6, fontSize: '0.75rem' }}>{`Hour: ${label}:00`}</p>
        {payload.map((entry: any, i: number) => (
          <p key={i} style={{ color: entry.color, fontSize: '0.8rem', fontWeight: 600, margin: '2px 0' }}>
            {entry.name}: <span style={{ color: '#e2e8f0' }}>{entry.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function ReportsPage({ onBack }: { onBack: () => void }) {
  const [hourly, setHourly] = useState<HourlyData[]>([]);
  const [queueHistory, setQueueHistory] = useState<{ t: number; count: number }[]>([]);
  const [footfall, setFootfall] = useState({ ENTRY: 0, EXIT: 0 });
  const [dwells, setDwells] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [hourlyRes, queueRes, footfallRes, dwellRes] = await Promise.all([
          fetch('http://localhost:8000/api/metrics/hourly'),
          fetch('http://localhost:8000/api/queue/history'),
          fetch('http://localhost:8000/api/metrics/footfall'),
          fetch('http://localhost:8000/api/metrics/dwell'),
        ]);
        const hourlyData = await hourlyRes.json();
        const queueData = await queueRes.json();
        const footfallData = await footfallRes.json();
        const dwellData = await dwellRes.json();

        setHourly(hourlyData || []);
        setQueueHistory((queueData.history || []).map((e: any) => ({ ...e, time: new Date(e.t * 1000).toLocaleTimeString() })));
        setFootfall(footfallData);
        setDwells(dwellData);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };
    load();
  }, []);

  const totalEntry = footfall.ENTRY;
  const totalExit = footfall.EXIT;
  const netOccupancy = Math.max(0, totalEntry - totalExit);
  const peakHour = hourly.reduce((best, h) => (h.ENTRY > (best?.ENTRY ?? 0) ? h : best), hourly[0]);

  const exportData = () => {
    const data = { footfall, hourly, dwells, exported_at: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `retail_report_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-left">
          <button className="back-btn" onClick={onBack}><ChevronLeft size={18} /></button>
          <div>
            <h1 className="header-title">Analytics Reports</h1>
            <p className="header-subtitle">Daily & session summaries — Edge AI powered, works offline</p>
          </div>
        </div>
        <div className="header-right">
          <button className="insights-btn" onClick={exportData}>
            <Download size={14} />
            Export JSON
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: '#94a3b8', padding: '0.4rem 0.8rem', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(51,65,85,0.5)', borderRadius: 99 }}>
            <Calendar size={13} />
            {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
          </div>
        </div>
      </header>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8' }}>
          <BarChart2 size={40} style={{ margin: '0 auto 1rem', opacity: 0.4 }} />
          <p>Loading analytics data…</p>
        </div>
      ) : (
        <>
          {/* Summary KPI strip */}
          <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
            {[
              { label: 'Total Entries', value: totalEntry, color: '#6366f1' },
              { label: 'Total Exits', value: totalExit, color: '#f43f5e' },
              { label: 'Current Occupancy', value: netOccupancy, color: '#10b981' },
              { label: 'Peak Hour', value: peakHour ? `${peakHour.hour}:00 (${peakHour.ENTRY})` : '—', color: '#f59e0b' },
            ].map(({ label, value, color }) => (
              <div key={label} className="glass-card">
                <div className="kpi-header"><span>{label}</span></div>
                <div className="kpi-value" style={{ color }}>{value}</div>
              </div>
            ))}
          </div>

          <div className="charts-grid">
            {/* Hourly Footfall Chart */}
            <div className="glass-card" style={{ gridColumn: '1 / -1' }}>
              <div className="chart-header">
                <h2 className="chart-title">Hourly Footfall — Today</h2>
                <p className="chart-subtitle">Entries and exits per hour (local time)</p>
              </div>
              <div className="chart-container">
                {hourly.some(h => h.ENTRY > 0 || h.EXIT > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hourly} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,130,255,0.06)" vertical={false} />
                      <XAxis dataKey="hour" stroke="#334155" tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={v => `${v}h`} />
                      <YAxis stroke="#334155" tick={{ fill: '#64748b', fontSize: 11 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '0.8rem', color: '#94a3b8' }} />
                      <Bar dataKey="ENTRY" name="Entries" fill="#6366f1" radius={[4, 4, 0, 0]} opacity={0.85} />
                      <Bar dataKey="EXIT" name="Exits" fill="#f43f5e" radius={[4, 4, 0, 0]} opacity={0.85} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="empty-state">
                    <span style={{ fontSize: '1.5rem' }}>📡</span>
                    <span>No footfall data yet. Start the live camera stream to begin recording.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Queue History Chart */}
            <div className="glass-card">
              <div className="chart-header">
                <h2 className="chart-title">Queue History</h2>
                <p className="chart-subtitle">Checkout queue size over session</p>
              </div>
              <div className="chart-container">
                {queueHistory.length > 2 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={queueHistory} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,130,255,0.06)" vertical={false} />
                      <XAxis dataKey="time" stroke="#334155" tick={{ fill: '#64748b', fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis stroke="#334155" tick={{ fill: '#64748b', fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: 'rgba(8,15,30,0.95)', border: '1px solid rgba(99,130,255,0.2)', borderRadius: 10, color: '#e2e8f0' }} />
                      <Line type="monotone" dataKey="count" name="Queue Length" stroke="#f59e0b" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="empty-state">
                    <span style={{ fontSize: '1.5rem' }}>🎥</span>
                    <span>Queue data appears once camera stream is running.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Dwell Time Chart */}
            <div className="glass-card">
              <div className="chart-header">
                <h2 className="chart-title">Dwell Times by Zone</h2>
                <p className="chart-subtitle">Average seconds per promotional display</p>
              </div>
              <div className="chart-container">
                {dwells.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dwells} layout="vertical" margin={{ top: 5, right: 10, left: 20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,130,255,0.06)" horizontal={false} />
                      <XAxis type="number" stroke="#334155" tick={{ fill: '#64748b', fontSize: 11 }} />
                      <YAxis dataKey="promo_zone" type="category" stroke="#334155" tick={{ fill: '#64748b', fontSize: 11 }} width={100} />
                      <Tooltip contentStyle={{ background: 'rgba(8,15,30,0.95)', border: '1px solid rgba(99,130,255,0.2)', borderRadius: 10, color: '#e2e8f0' }} />
                      <Bar dataKey="avg_duration" name="Avg Dwell (s)" fill="#10b981" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="empty-state">
                    <span style={{ fontSize: '1.5rem' }}>⏱️</span>
                    <span>No dwell events recorded yet.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
