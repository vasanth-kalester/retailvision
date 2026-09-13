import React, { useState, useEffect, useRef } from 'react';
import { Users, AlertTriangle, CheckCircle, TrendingUp, Clock } from 'lucide-react';

interface QueueStatus {
  checkout_count: number;
  status: 'no_data' | 'clear' | 'low' | 'moderate' | 'high';
  recommendation: string;
  peak_today: number;
  avg_last_minute: number;
  total_served: number;
  camera_active: boolean;
  sparkline: number[];
  alert_threshold: number;
  surge_predicted?: boolean;
}

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  no_data: { bg: 'rgba(51,65,85,0.3)',  border: '#475569', text: '#94a3b8', dot: '#475569' },
  clear:    { bg: 'rgba(16,185,129,0.1)', border: '#10b981', text: '#10b981', dot: '#10b981' },
  low:      { bg: 'rgba(16,185,129,0.08)', border: '#34d399', text: '#34d399', dot: '#34d399' },
  moderate: { bg: 'rgba(245,158,11,0.1)', border: '#f59e0b', text: '#f59e0b', dot: '#f59e0b' },
  high:     { bg: 'rgba(244,63,94,0.1)',  border: '#f43f5e', text: '#f43f5e', dot: '#f43f5e' },
  surge_predicted: { bg: 'rgba(139,92,246,0.1)', border: '#8b5cf6', text: '#8b5cf6', dot: '#8b5cf6' },
};

const SparkLine = ({ data, color }: { data: number[]; color: string }) => {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const W = 200, H = 40, PAD = 4;
  const pts = data.map((v, i) => {
    const x = PAD + (i / (data.length - 1)) * (W - PAD * 2);
    const y = H - PAD - (v / max) * (H - PAD * 2);
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 40 }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity={0.8} />
      <polyline points={`${PAD},${H} ${pts} ${W - PAD},${H}`} fill={color} fillOpacity={0.1} stroke="none" />
    </svg>
  );
};

export default function QueueDashboard() {
  const [status, setStatus] = useState<QueueStatus | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const fetch_status = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/queue/status');
        if (res.ok) setStatus(await res.json());
      } catch {}
    };
    fetch_status();
    intervalRef.current = setInterval(fetch_status, 2000);
    return () => clearInterval(intervalRef.current!);
  }, []);

  if (!status) return null;

  const colors = STATUS_COLORS[status.status] || STATUS_COLORS.no_data;
  const fillPct = Math.min(100, (status.checkout_count / (status.alert_threshold + 3)) * 100);

  return (
    <div className="glass-card" style={{ padding: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Users size={20} color="#6366f1" />
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Queue Intelligence</h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: status.camera_active ? '#10b981' : '#94a3b8' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: status.camera_active ? '#10b981' : '#475569', boxShadow: status.camera_active ? '0 0 6px #10b981' : 'none' }} />
          {status.camera_active ? 'Live' : 'No Camera'}
        </div>
      </div>

      {/* Current Count + Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', padding: '0.875rem', background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 10 }}>
        <div style={{ fontSize: '2.5rem', fontWeight: 800, color: colors.text, lineHeight: 1 }}>
          {status.checkout_count}
        </div>
        <div>
          <div style={{ fontSize: '0.8rem', color: colors.text, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {status.status === 'no_data' ? 'No Data' : status.status === 'high' ? '⚠️ HIGH QUEUE' : status.status.toUpperCase()}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>
            {status.recommendation}
          </div>
        </div>
      </div>

      {/* Queue fill bar */}
      <div style={{ marginBottom: '0.875rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748b', marginBottom: '0.3rem' }}>
          <span>Queue Pressure</span>
          <span>Alert at {status.alert_threshold}</span>
        </div>
        <div style={{ height: 8, borderRadius: 99, background: 'rgba(255,255,255,0.06)' }}>
          <div style={{ height: '100%', width: `${fillPct}%`, borderRadius: 99, background: `linear-gradient(90deg, ${colors.dot}, ${colors.border})`, transition: 'width 0.5s ease' }} />
        </div>
      </div>

      {/* Sparkline */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '0.25rem' }}>Last 30 readings</div>
        <SparkLine data={status.sparkline} color={colors.dot} />
      </div>

      {/* Mini KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
        {[
          { label: 'Peak Today', value: status.peak_today, icon: <TrendingUp size={13} /> },
          { label: 'Avg / min', value: status.avg_last_minute, icon: <Clock size={13} /> },
          { label: 'Served', value: status.total_served, icon: <CheckCircle size={13} /> },
        ].map(({ label, value, icon }) => (
          <div key={label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '0.5rem 0.6rem', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', color: '#6366f1', marginBottom: '0.2rem' }}>{icon}</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#e2e8f0' }}>{value}</div>
            <div style={{ fontSize: '0.65rem', color: '#64748b' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Staffing / Forecast alerts */}
      {status.status === 'high' && (
        <div style={{ marginTop: '0.875rem', padding: '0.75rem', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.4)', borderRadius: 8, display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
          <AlertTriangle size={16} color="#f43f5e" style={{ flexShrink: 0, marginTop: 2 }} />
          <span style={{ fontSize: '0.8rem', color: '#f87171', fontWeight: 600, lineHeight: 1.4 }}>Open additional billing counter now!</span>
        </div>
      )}
      {status.surge_predicted && (
        <div style={{ marginTop: '0.875rem', padding: '0.75rem', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.4)', borderRadius: 8, display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
          <TrendingUp size={16} color="#8b5cf6" style={{ flexShrink: 0, marginTop: 2 }} />
          <span style={{ fontSize: '0.8rem', color: '#a78bfa', fontWeight: 600, lineHeight: 1.4 }}>Surge Forecast: High influx detected. Pre-emptively open Lane 2.</span>
        </div>
      )}
    </div>
  );
}
