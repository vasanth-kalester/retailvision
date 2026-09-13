import React, { useState, useEffect } from 'react';
import { Activity, Users, Clock, AlertTriangle, TrendingUp, Cpu, Settings, Megaphone, Lock, User, ShoppingBag, Video, AlignLeft } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, ReferenceLine } from 'recharts';

const CHART_DATA = [
  { time: '10:00 AM', queued: 4, processed: 12 },
  { time: '10:45 AM', queued: 2, processed: 14 },
  { time: '11:30 AM', queued: 7, processed: 10 },
  { time: '12:15 PM', queued: 12, processed: 8 },
  { time: '13:00 PM', queued: 5, processed: 15 },
  { time: '13:45 PM', queued: 14, processed: 7 }, // Peak
  { time: '14:30 PM', queued: 6, processed: 13 },
];

export default function QueueIntelligence() {
  const [queueCount, setQueueCount] = useState(0);
  const [surgePredicted, setSurgePredicted] = useState(false);
  const [avgWait, setAvgWait] = useState(1.2);

  useEffect(() => {
    const fetchKPIs = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/queue/status');
        if (res.ok) {
          const data = await res.json();
          setQueueCount(data.checkout_count || 0);
          setSurgePredicted(data.surge_predicted || false);
          setAvgWait(Math.max(0.5, (data.checkout_count || 0) * 0.7)); // Mock wait time calculation
        }
      } catch {}
    };
    fetchKPIs();
    const interval = setInterval(fetchKPIs, 3000);
    return () => clearInterval(interval);
  }, []);

  // Calculate dynamic mock lane data based on real overall queue
  const isCongested = queueCount > 4;
  const lane02Wait = isCongested ? 4.5 : 1.2;

  return (
    <div style={{ paddingBottom: '2rem' }}>
      {/* Top Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--primary-blue-light)', color: 'var(--primary-blue)', padding: '0.4rem 0.75rem', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary-blue)' }} />
            SUBSYSTEM ACTIVE
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Inference Zone: Front-End Register Array
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn-primary" style={{ background: '#f1f5f9', color: 'var(--text-primary)', border: '1px solid var(--border-strong)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Settings size={14} /> Config Thresholds
          </button>
          <button className="btn-primary" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Megaphone size={14} /> Manual Staff Paging
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.5rem', color: 'var(--text-primary)' }}>Queue Intelligence & Checkout Operations</h2>
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Real-time edge computer vision tracking lane queue depths, processing velocity, and dynamic cashier callouts.</p>
      </div>

      {/* KPI Strip */}
      <div className="kpi-strip">
        <div className="kpi-card">
          <div className="kpi-label">Active Counters <User size={14} color="var(--primary-blue)" /></div>
          <div className="kpi-value">4 <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>/ 8 Open</span></div>
          <div className="kpi-subtext" style={{ color: 'var(--primary-blue)', fontWeight: 600 }}>● 50% Line Capacity Active</div>
        </div>
        
        <div className="kpi-card">
          <div className="kpi-label">Queue Depth [Total] <Users size={14} color="var(--text-secondary)" /></div>
          <div className="kpi-value">{queueCount} <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Shoppers Waiting</span></div>
          <div className="kpi-subtext">↗ +3 persons vs last 10m</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Avg Wait Time <Clock size={14} color="var(--text-secondary)" /></div>
          <div className="kpi-value">{avgWait.toFixed(1)} <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>min</span></div>
          <div className="kpi-subtext" style={{ color: avgWait > 3.0 ? 'var(--alert-red)' : 'var(--primary-blue)', fontWeight: 600 }}>Target &lt;3.0 min</div>
        </div>

        <div className="kpi-card" style={{ borderTop: isCongested ? '3px solid var(--alert-red)' : undefined }}>
          <div className="kpi-label" style={{ color: isCongested ? 'var(--alert-red)' : undefined }}>Bottleneck Lane {isCongested && <AlertTriangle size={14} />}</div>
          <div className="kpi-value" style={{ color: isCongested ? 'var(--alert-red)' : undefined }}>{isCongested ? 'Lane 02' : 'None'}</div>
          <div className="kpi-subtext" style={{ color: isCongested ? 'var(--alert-red)' : undefined }}>{isCongested ? `! Exceeds SLA threshold (+1.5m)` : 'All lanes flowing smoothly'}</div>
        </div>

        <div className="kpi-card" style={{ borderTop: surgePredicted ? '3px solid var(--primary-blue)' : undefined, background: surgePredicted ? 'var(--primary-blue-light)' : undefined }}>
          <div className="kpi-label" style={{ color: surgePredicted ? 'var(--primary-blue)' : undefined }}>Peak Forecast <TrendingUp size={14} /></div>
          <div className="kpi-value" style={{ color: surgePredicted ? 'var(--primary-blue)' : undefined }}>{surgePredicted ? 'Rush in 5m' : 'Stable'}</div>
          <div className="kpi-subtext">Active Store Footfall: <strong>128</strong> shoppers browsing.</div>
        </div>
      </div>

      {/* Critical Alert Banner */}
      {isCongested && (
        <div style={{ background: 'var(--alert-red-light)', border: '1px solid var(--alert-red-border)', borderRadius: 8, padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div style={{ background: 'var(--alert-red)', color: 'white', padding: '0.5rem', borderRadius: '50%' }}>
            <AlertTriangle size={24} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--alert-red)' }}>OPERATIONAL DIRECTIVE REQUIRED</span>
              <span style={{ fontSize: '0.7rem', background: 'var(--alert-red)', color: 'white', padding: '0.1rem 0.4rem', borderRadius: 4, fontWeight: 700 }}>Severity: High</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
              <strong>Congestion detected on Counter 02:</strong> 7 shoppers queued for &gt;4.0 minutes (Flow rate dropped to 18 items/min). Store arrival gradient is positive (+14%).
            </p>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--primary-blue)', fontWeight: 600 }}>Action Recommended: Transition Counter 05 from Standby to Active immediately to prevent basket abandonment.</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn-primary" style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-strong)' }}>Acknowledge Only</button>
            <button className="btn-danger">Page Backup Cashier to Register 05</button>
          </div>
        </div>
      )}

      {/* Active Register Array */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Active Register Array <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginLeft: '0.5rem' }}>8 Total Bays</span></h3>
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', fontWeight: 600 }}>
            <span style={{ color: 'var(--primary-blue)' }}>● Normal Flow</span>
            <span style={{ color: 'var(--alert-red)' }}>● Congested</span>
            <span style={{ color: 'var(--text-muted)' }}>● Standby / Offline</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          {/* Lane 01 */}
          <div className="panel" style={{ padding: '1rem', borderTop: '3px solid var(--primary-blue)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 800 }}>Lane 01</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Regular Conveyor</div>
              </div>
              <div style={{ background: 'var(--primary-blue-light)', color: 'var(--primary-blue)', padding: '0.1rem 0.5rem', borderRadius: 4, fontSize: '0.7rem', fontWeight: 700 }}>● NORMAL</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--alert-red)', fontWeight: 700 }}>QUEUE DEPTH</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>3 <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>persons</span></div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--alert-red)', fontWeight: 700 }}>ESTIMATED WAIT</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>1.8 <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>min</span></div>
              </div>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem' }}>
              <span>⏱ 22 items/min</span>
              <span>Cashier: Marco P.</span>
            </div>
          </div>

          {/* Lane 02 */}
          <div className="panel" style={{ padding: '1rem', borderTop: '3px solid var(--alert-red)', background: isCongested ? 'var(--alert-red-light)' : 'white', border: isCongested ? '1px solid var(--alert-red-border)' : undefined }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 800 }}>Lane 02</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Regular Conveyor</div>
              </div>
              <div style={{ background: 'var(--alert-red)', color: 'white', padding: '0.1rem 0.5rem', borderRadius: 4, fontSize: '0.7rem', fontWeight: 700 }}>▲ CONGESTION</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--alert-red)', fontWeight: 700 }}>QUEUE DEPTH</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--alert-red)' }}>{isCongested ? 7 : 2} <span style={{ fontSize: '0.75rem', color: 'var(--alert-red)', fontWeight: 600 }}>persons</span></div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--alert-red)', fontWeight: 700 }}>ESTIMATED WAIT</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--alert-red)' }}>{lane02Wait} <span style={{ fontSize: '0.75rem', color: 'var(--alert-red)', fontWeight: 600 }}>min</span></div>
              </div>
            </div>
            {isCongested && (
               <div style={{ fontSize: '0.7rem', color: 'var(--alert-amber)', background: 'var(--alert-amber-light)', padding: '0.5rem', borderRadius: 4, marginBottom: '0.75rem', fontWeight: 600 }}>
                 ⚠️ Queue &gt;5 persons for 4+ mins. Flow degraded by large cart transaction.
               </div>
            )}
            <div style={{ fontSize: '0.75rem', color: 'var(--alert-red)', fontWeight: 600, display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem' }}>
              <span>↘ 18 items/min</span>
              <span>Cashier: Elena R.</span>
            </div>
            {isCongested && <button className="btn-danger" style={{ width: '100%', marginTop: '0.5rem' }}>Page Relief Cashier</button>}
          </div>

          {/* Lane 03 */}
          <div className="panel" style={{ padding: '1rem', borderTop: '3px solid var(--primary-blue)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 800 }}>Lane 03</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--primary-blue)', fontWeight: 700 }}>&lt;10 Items Express</div>
              </div>
              <div style={{ background: 'var(--primary-blue-light)', color: 'var(--primary-blue)', padding: '0.1rem 0.5rem', borderRadius: 4, fontSize: '0.7rem', fontWeight: 700 }}>● NORMAL</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700 }}>QUEUE DEPTH</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>4 <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>persons</span></div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700 }}>ESTIMATED WAIT</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>1.5 <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>min</span></div>
              </div>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem' }}>
              <span>⏱ 34 items/min</span>
              <span>Cashier: Jason T.</span>
            </div>
          </div>

          {/* Zone 04 (SCO) */}
          <div className="panel" style={{ padding: '1rem', borderTop: '3px solid var(--success-green)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 800 }}>Zone 04</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>SCO Bank A (1-4)</div>
              </div>
              <div style={{ background: 'var(--success-green-light)', color: 'var(--success-green)', padding: '0.1rem 0.5rem', borderRadius: 4, fontSize: '0.7rem', fontWeight: 700 }}>● BALANCED</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700 }}>SHARED LINE</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>4 <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>waiting</span></div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700 }}>KIOSKS ACTIVE</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary-blue)' }}>4 / 4 <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>busy</span></div>
              </div>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem' }}>
              <span>Avg transaction: 1.1m</span>
              <span>Host: David K.</span>
            </div>
          </div>

          {/* Lane 05 */}
          <div className="panel" style={{ padding: '1rem', background: '#f8fafc', border: '1px solid var(--border-strong)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)' }}>Lane 05</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Regular Conveyor</div>
              </div>
              <div style={{ background: '#e2e8f0', color: 'var(--text-secondary)', padding: '0.1rem 0.5rem', borderRadius: 4, fontSize: '0.7rem', fontWeight: 700 }}>STANDBY</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700 }}>HARDWARE READY</div>
                <div style={{ fontSize: '1rem', fontWeight: 800 }}>POS Warmed Up</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700 }}>ASSIGNMENT</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>Float: Sarah M.</div>
              </div>
            </div>
            {isCongested && <button className="btn-primary" style={{ width: '100%', padding: '0.4rem', fontSize: '0.75rem' }}>⏻ Open Register 05 Now</button>}
          </div>
          
           {/* Lane 06 */}
           <div className="panel" style={{ padding: '1rem', background: '#f8fafc', border: '1px dashed var(--border-strong)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)' }}>Lane 06</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Regular Conveyor</div>
              </div>
              <div style={{ background: '#e2e8f0', color: 'var(--text-muted)', padding: '0.1rem 0.5rem', borderRadius: 4, fontSize: '0.7rem', fontWeight: 700 }}>OFF-DUTY</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>NEXT SHIFT</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-muted)' }}>16:00 PM</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>CLEANING STATE</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--success-green)' }}>Sanitized</div>
              </div>
            </div>
            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <Lock size={16} color="var(--border-strong)" />
            </div>
          </div>
        </div>
      </div>

      {/* Chart & Tables Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        <div className="panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <div>
              <h3 className="panel-title">Queue Depth vs Service Throughput</h3>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Tracking shopper build-up against cashier throughput velocity with 5-person breach threshold.</p>
            </div>
            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', fontWeight: 600 }}>
              <span style={{ color: 'var(--primary-blue)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><div style={{ width: 12, height: 2, background: 'var(--primary-blue)' }} /> Total Queued</span>
              <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><div style={{ width: 12, height: 2, background: 'var(--text-secondary)' }} /> Processed/10m</span>
              <span style={{ color: 'var(--border-strong)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><div style={{ width: 12, height: 2, background: 'var(--border-strong)', borderStyle: 'dashed' }} /> Critical Limit</span>
            </div>
          </div>
          <div style={{ height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={CHART_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                <XAxis dataKey="time" stroke="var(--border-strong)" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <YAxis stroke="var(--border-strong)" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid var(--border-light)', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }} />
                <ReferenceLine y={10} stroke="var(--alert-red)" strokeDasharray="3 3" label={{ position: 'top', value: 'SLA THRESHOLD LIMIT (5 QUEUE D / COUNTER)', fill: 'var(--alert-red)', fontSize: 10, fontWeight: 700 }} />
                <Area type="monotone" dataKey="processed" stroke="var(--border-strong)" strokeWidth={2} fillOpacity={0} />
                <Area type="monotone" dataKey="queued" stroke="var(--primary-blue)" strokeWidth={3} fillOpacity={0.1} fill="var(--primary-blue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel" style={{ padding: '1.5rem' }}>
          <h3 className="panel-title">Hourly Wait Time & Congestion Matrix</h3>
          <p style={{ margin: '0.25rem 0 1rem 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Historical 7-day front-end pressure patterns across shopping windows.</p>
          <table className="data-table">
            <thead>
              <tr>
                <th>SHOPPING WINDOW</th>
                <th>09:00 - 11:00</th>
                <th>11:00 - 13:00</th>
                <th>13:00 - 15:00 (CURRENT)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Regular Conveyors</td>
                <td><span style={{ background: 'var(--primary-blue-light)', color: 'var(--primary-blue)', padding: '0.2rem 0.5rem', borderRadius: 4 }}>1.4m</span></td>
                <td><span style={{ background: 'var(--primary-blue-border)', color: 'var(--primary-blue)', padding: '0.2rem 0.5rem', borderRadius: 4 }}>2.6m</span></td>
                <td><span style={{ background: 'var(--alert-red-light)', color: 'var(--alert-red)', padding: '0.2rem 0.5rem', borderRadius: 4, fontWeight: 700 }}>4.2m ⚠️</span></td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Express Lines</td>
                <td><span style={{ background: '#f8fafc', color: 'var(--text-secondary)', padding: '0.2rem 0.5rem', borderRadius: 4 }}>0.8m</span></td>
                <td><span style={{ background: 'var(--primary-blue-light)', color: 'var(--primary-blue)', padding: '0.2rem 0.5rem', borderRadius: 4 }}>1.2m</span></td>
                <td><span style={{ background: 'var(--primary-blue-light)', color: 'var(--primary-blue)', padding: '0.2rem 0.5rem', borderRadius: 4 }}>1.5m</span></td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Self-Checkout (SCO)</td>
                <td><span style={{ background: '#f8fafc', color: 'var(--text-secondary)', padding: '0.2rem 0.5rem', borderRadius: 4 }}>0.5m</span></td>
                <td><span style={{ background: '#f8fafc', color: 'var(--text-secondary)', padding: '0.2rem 0.5rem', borderRadius: 4 }}>0.9m</span></td>
                <td><span style={{ background: 'var(--primary-blue-light)', color: 'var(--primary-blue)', padding: '0.2rem 0.5rem', borderRadius: 4 }}>1.1m</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
