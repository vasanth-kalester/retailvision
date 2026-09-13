import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, X, CheckCircle, Package } from 'lucide-react';

interface Alert {
  id: string;
  type: 'queue' | 'stock' | 'security' | 'info';
  title: string;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  timestamp: number;
  resolved?: boolean;
}

const SEVERITY_STYLES: Record<string, { bg: string; border: string; icon: string }> = {
  critical:{ bg: 'rgba(225,29,72,0.15)', border: 'rgba(225,29,72,0.5)', icon: '#e11d48' },
  high:    { bg: 'rgba(244,63,94,0.08)',  border: 'rgba(244,63,94,0.35)',  icon: '#f43f5e' },
  medium:  { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.35)', icon: '#f59e0b' },
  low:     { bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.35)', icon: '#818cf8' },
};

function timeSince(ts: number) {
  const s = Math.floor((Date.now() / 1000) - ts);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function AlertsPanel() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const buildAlerts = async () => {
      const newAlerts: Alert[] = [];

      // ── Queue alert ─────────────────────────────────────────────────────
      try {
        const qRes = await fetch('http://localhost:8000/api/queue/status');
        if (qRes.ok) {
          const q = await qRes.json();
          if (q.status === 'high') {
            newAlerts.push({
              id: 'queue-high',
              type: 'queue',
              title: 'High Queue Alert',
              message: `${q.checkout_count} customers waiting at checkout. Open an additional billing counter.`,
              severity: 'high',
              timestamp: Date.now() / 1000,
            });
          } else if (q.status === 'moderate') {
            newAlerts.push({
              id: 'queue-moderate',
              type: 'queue',
              title: 'Queue Building Up',
              message: `${q.checkout_count} customers in queue. Monitor closely.`,
              severity: 'medium',
              timestamp: Date.now() / 1000,
            });
          }
        }
      } catch {}

      // ── Stock alerts ────────────────────────────────────────────────────
      try {
        const stockRes = await fetch('http://localhost:8000/api/inventory/warehouse/alerts');
        if (stockRes.ok) {
          const data = await stockRes.json();
          (data.alerts || []).slice(0, 5).forEach((a: any, i: number) => {
            newAlerts.push({
              id: `stock-${a._id || i}`,
              type: 'stock',
              title: `Low Stock: ${a.sku}`,
              message: `${a.alert_type.toUpperCase()} — only ${a.current_units} units remaining in warehouse.`,
              severity: a.alert_type === 'out_of_stock' ? 'high' : 'medium',
              timestamp: a.triggered_at || Date.now() / 1000,
            });
          });
        }
      } catch {}

      // ── Security alerts ──────────────────────────────────────────────────
      try {
        const secRes = await fetch('http://localhost:8000/api/security/alerts');
        if (secRes.ok) {
          const data = await secRes.json();
          (data.alerts || []).forEach((a: any) => {
            newAlerts.push({
              id: a.id,
              type: 'security',
              title: 'Suspicious Behavior',
              message: `ID ${a.track_id} has been loitering for >${Math.floor(a.duration)}s.`,
              severity: 'critical',
              timestamp: a.timestamp,
            });
          });
        }
      } catch {}

      // Merge: keep resolved state from previous alerts
      setAlerts(prev => {
        const resolvedIds = new Set(prev.filter(a => a.resolved).map(a => a.id));
        return newAlerts.map(a => ({ ...a, resolved: resolvedIds.has(a.id) }));
      });
    };

    buildAlerts();
    const interval = setInterval(buildAlerts, 5000);
    return () => clearInterval(interval);
  }, []);

  const resolve = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, resolved: true } : a));
  };

  const active = alerts.filter(a => !a.resolved);
  const resolved = alerts.filter(a => a.resolved);

  return (
    <div className="glass-card" style={{ padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <AlertTriangle size={20} color="#f59e0b" />
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Live Alerts</h3>
        </div>
        {active.length > 0 && (
          <span style={{ background: 'rgba(244,63,94,0.15)', color: '#f43f5e', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 99, padding: '0.2rem 0.6rem', fontSize: '0.75rem', fontWeight: 700 }}>
            {active.length} active
          </span>
        )}
      </div>

      {active.length === 0 && (
        <div style={{ textAlign: 'center', padding: '1.5rem 0', color: '#475569' }}>
          <CheckCircle size={28} color="#10b981" style={{ margin: '0 auto 0.5rem' }} />
          <p style={{ fontSize: '0.875rem', color: '#10b981', margin: 0 }}>All clear — no active alerts</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {active.map(alert => {
          const s = SEVERITY_STYLES[alert.severity];
          return (
            <div key={alert.id} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 10, padding: '0.75rem 0.9rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div style={{ flexShrink: 0, marginTop: 2 }}>
                {alert.type === 'stock' ? <Package size={16} color={s.icon} /> : 
                 alert.type === 'security' ? <AlertTriangle size={16} color={s.icon} strokeWidth={2.5} /> :
                 <AlertTriangle size={16} color={s.icon} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '0.2rem' }}>{alert.title}</div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', lineHeight: 1.4 }}>{alert.message}</div>
                <div style={{ fontSize: '0.65rem', color: '#475569', marginTop: '0.3rem' }}>{timeSince(alert.timestamp)}</div>
              </div>
              <button
                onClick={() => resolve(alert.id)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.15rem', flexShrink: 0, lineHeight: 1 }}
                title="Dismiss"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>

      {resolved.length > 0 && (
        <div style={{ marginTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.75rem' }}>
          <p style={{ fontSize: '0.7rem', color: '#475569', margin: '0 0 0.4rem' }}>Resolved ({resolved.length})</p>
          {resolved.map(a => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0', opacity: 0.5 }}>
              <CheckCircle size={12} color="#10b981" />
              <span style={{ fontSize: '0.75rem', color: '#64748b', textDecoration: 'line-through' }}>{a.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
