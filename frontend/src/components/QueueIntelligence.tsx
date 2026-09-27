import React, { useState, useEffect } from 'react';
import { Activity, Users, Clock, AlertTriangle, TrendingUp, Cpu, Settings, Megaphone, Lock, User, ShoppingBag, Video, AlignLeft } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, ReferenceLine } from 'recharts';



export default function QueueIntelligence() {
  const [queueCount, setQueueCount] = useState(0);
  const [surgePredicted, setSurgePredicted] = useState(false);
  const [avgWait, setAvgWait] = useState(1.2);
  const [lanes, setLanes] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [activeLanesCount, setActiveLanesCount] = useState(0);
  const [laneOverrides, setLaneOverrides] = useState<Record<string, string>>({});
  const [demoSimulateWait, setDemoSimulateWait] = useState(false);
  const [simulatedWait, setSimulatedWait] = useState(1.0);

  useEffect(() => {
    let interval: any;
    if (demoSimulateWait) {
      interval = setInterval(() => {
        setSimulatedWait(prev => {
          let next = prev + 0.1;
          if (next > 2.05) next = 1.0;
          return parseFloat(next.toFixed(1));
        });
      }, 1000); // 1 sec interval
    } else {
      setSimulatedWait(1.0);
    }
    return () => clearInterval(interval);
  }, [demoSimulateWait]);

  const toggleLaneStatus = (laneId: string, currentStatus: string) => {
    setLaneOverrides(prev => {
      const newOverrides = { ...prev };
      if (currentStatus === 'STANDBY') {
        newOverrides[laneId] = 'NORMAL';
      } else {
        newOverrides[laneId] = 'STANDBY';
      }
      return newOverrides;
    });
  };

  useEffect(() => {
    const fetchKPIs = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/queue/status');
        if (res.ok) {
          const data = await res.json();
          setQueueCount(data.checkout_count || 0);
          setSurgePredicted(data.surge_predicted || false);
          setAvgWait(data.avg_wait || 0);
          setLanes(data.lanes || []);
          setChartData(data.chart_data || []);
          setActiveLanesCount(data.active_lanes || 0);
        }
      } catch {}
    };
    fetchKPIs();
    const interval = setInterval(fetchKPIs, 3000);
    return () => clearInterval(interval);
  }, []);

  const congestedLane = lanes.find(l => l.status === 'CONGESTED');

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
          <button 
            className="btn-primary" 
            onClick={() => setDemoSimulateWait(!demoSimulateWait)}
            style={{ background: demoSimulateWait ? 'var(--primary-blue)' : '#f1f5f9', color: demoSimulateWait ? 'white' : 'var(--text-primary)', border: '1px solid var(--border-strong)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}
          >
            <Clock size={14} /> {demoSimulateWait ? 'Stop Wait Sim' : 'Simulate Wait'}
          </button>
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
          <div className="kpi-value">{activeLanesCount} <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>/ 8 Open</span></div>
          <div className="kpi-subtext" style={{ color: 'var(--primary-blue)', fontWeight: 600 }}>● 50% Line Capacity Active</div>
        </div>
        
        <div className="kpi-card">
          <div className="kpi-label">Queue Depth [Total] <Users size={14} color="var(--text-secondary)" /></div>
          <div className="kpi-value">{queueCount} <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Shoppers Waiting</span></div>
          <div className="kpi-subtext">↗ +3 persons vs last 10m</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Avg Wait Time <Clock size={14} color="var(--text-secondary)" /></div>
          <div className="kpi-value">{(demoSimulateWait ? simulatedWait : avgWait).toFixed(1)} <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>min</span></div>
          <div className="kpi-subtext" style={{ color: (demoSimulateWait ? simulatedWait : avgWait) > 3.0 ? 'var(--alert-red)' : 'var(--primary-blue)', fontWeight: 600 }}>Target &lt;3.0 min</div>
        </div>

        <div className="kpi-card" style={{ borderTop: congestedLane ? '3px solid var(--alert-red)' : undefined }}>
          <div className="kpi-label" style={{ color: congestedLane ? 'var(--alert-red)' : undefined }}>Bottleneck Lane {congestedLane && <AlertTriangle size={14} />}</div>
          <div className="kpi-value" style={{ color: congestedLane ? 'var(--alert-red)' : undefined }}>{congestedLane ? congestedLane.id : 'None'}</div>
          <div className="kpi-subtext" style={{ color: congestedLane ? 'var(--alert-red)' : undefined }}>{congestedLane ? `! Exceeds SLA threshold` : 'All lanes flowing smoothly'}</div>
        </div>

        <div className="kpi-card" style={{ borderTop: surgePredicted ? '3px solid var(--primary-blue)' : undefined, background: surgePredicted ? 'var(--primary-blue-light)' : undefined }}>
          <div className="kpi-label" style={{ color: surgePredicted ? 'var(--primary-blue)' : undefined }}>Peak Forecast <TrendingUp size={14} /></div>
          <div className="kpi-value" style={{ color: surgePredicted ? 'var(--primary-blue)' : undefined }}>{surgePredicted ? 'Rush in 5m' : 'Stable'}</div>
          <div className="kpi-subtext">Active Store Footfall: <strong>128</strong> shoppers browsing.</div>
        </div>
      </div>

      {/* Critical Alert Banner */}
      {congestedLane && (
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
              <strong>Congestion detected on {congestedLane.id}:</strong> {congestedLane.queue_depth} shoppers queued for {congestedLane.estimated_wait} minutes.
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
          {lanes.map((laneData, idx) => {
            const laneStatus = laneOverrides[laneData.id] || laneData.status;
            const lane = { ...laneData, status: laneStatus };
            if (laneStatus === 'STANDBY') {
               lane.queue_depth = 0;
               lane.estimated_wait = 0;
            } else if (demoSimulateWait) {
               lane.estimated_wait = simulatedWait;
            }

            const isStandby = lane.status === 'STANDBY';
            const isCong = lane.status === 'CONGESTED';
            const isBal = lane.status === 'BALANCED';
            const borderColor = isStandby ? 'var(--border-strong)' : isCong ? 'var(--alert-red)' : isBal ? 'var(--success-green)' : 'var(--primary-blue)';
            const badgeBg = isStandby ? '#e2e8f0' : isCong ? 'var(--alert-red)' : isBal ? 'var(--success-green-light)' : 'var(--primary-blue-light)';
            const badgeCol = isStandby ? 'var(--text-secondary)' : isCong ? 'white' : isBal ? 'var(--success-green)' : 'var(--primary-blue)';

            return (
              <div key={idx} className="panel" style={{ padding: '1rem', borderTop: `3px solid ${borderColor}`, background: isCong ? 'var(--alert-red-light)' : isStandby ? '#f8fafc' : 'white', border: isCong ? '1px solid var(--alert-red-border)' : isStandby ? '1px solid var(--border-strong)' : undefined }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: isStandby ? 'var(--text-muted)' : 'inherit' }}>{lane.id}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{lane.type}</div>
                  </div>
                  <div style={{ background: badgeBg, color: badgeCol, padding: '0.1rem 0.5rem', borderRadius: 4, fontSize: '0.7rem', fontWeight: 700 }}>
                    {isCong ? '▲ CONGESTION' : isBal ? '● BALANCED' : isStandby ? 'STANDBY' : '● NORMAL'}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: isCong ? 'var(--alert-red)' : 'var(--text-secondary)', fontWeight: 700 }}>QUEUE DEPTH</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: isCong ? 'var(--alert-red)' : isStandby ? 'var(--text-muted)' : 'inherit' }}>{lane.queue_depth} <span style={{ fontSize: '0.75rem', color: isCong ? 'var(--alert-red)' : 'var(--text-secondary)', fontWeight: 600 }}>persons</span></div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: isCong ? 'var(--alert-red)' : 'var(--text-secondary)', fontWeight: 700 }}>WAIT TIME</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: isCong ? 'var(--alert-red)' : isStandby ? 'var(--text-muted)' : 'inherit' }}>{Number(lane.estimated_wait).toFixed(1)} <span style={{ fontSize: '0.75rem', color: isCong ? 'var(--alert-red)' : 'var(--text-secondary)', fontWeight: 600 }}>min</span></div>
                  </div>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem' }}>
                  <span>{isStandby ? 'Offline' : `⏱ ${lane.items_per_min} items/min`}</span>
                  <span>Cashier: {lane.cashier}</span>
                </div>
                <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                  {isCong && <button className="btn-danger" style={{ flex: 1 }}>Page Relief Cashier</button>}
                  <button 
                    onClick={() => toggleLaneStatus(laneData.id, laneStatus)} 
                    style={{ 
                      flex: isCong ? undefined : 1,
                      padding: '0.4rem', 
                      borderRadius: '4px', 
                      border: isStandby ? '1px solid var(--primary-blue)' : '1px solid var(--border-strong)', 
                      background: isStandby ? 'transparent' : '#f1f5f9', 
                      color: isStandby ? 'var(--primary-blue)' : 'var(--text-secondary)', 
                      fontWeight: 600, 
                      fontSize: '0.75rem', 
                      cursor: 'pointer' 
                    }}
                  >
                    {isStandby ? 'Enable Bay' : 'Disable Bay'}
                  </button>
                </div>
              </div>
            );
          })}
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
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorQueued" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--alert-red)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--alert-red)" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorProcessed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary-blue)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--primary-blue)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-light)" />
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Area type="monotone" dataKey="processed" stroke="var(--primary-blue)" strokeWidth={2} fillOpacity={1} fill="url(#colorProcessed)" name="Throughput / min" />
                <Area type="monotone" dataKey="queued" stroke="var(--alert-red)" strokeWidth={2} fillOpacity={1} fill="url(#colorQueued)" name="Avg Queue Depth" />
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
