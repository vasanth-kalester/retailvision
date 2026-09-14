import React, { useState, useEffect } from 'react';
import { Users, Activity, Crosshair, ArrowRight, Map, Clock, ShoppingCart, Radar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

export default function ShopperAnalytics() {
  const [footfall, setFootfall] = useState({ ENTRY: 0, EXIT: 0 });
  const [trends, setTrends] = useState<any[]>([]);
  const [dwell, setDwell] = useState<any[]>([]);
  const [queueStatus, setQueueStatus] = useState<any>(null);
  const [liveAgents, setLiveAgents] = useState<any[]>([]);

  useEffect(() => {
    let ws: WebSocket;
    let isSubscribed = true;

    const connectWs = () => {
      ws = new WebSocket('ws://localhost:8000/api/test/stream');
      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.live_agents && isSubscribed) {
            setLiveAgents(data.live_agents);
          }
        } catch (err) {}
      };
      ws.onclose = () => {
        if (isSubscribed) setTimeout(connectWs, 3000);
      };
    };
    connectWs();

    const fetchMetrics = async () => {
      try {
        const [footRes, trendsRes, dwellRes, queueRes] = await Promise.all([
          fetch('http://localhost:8000/api/metrics/footfall'),
          fetch('http://localhost:8000/api/metrics/trends'),
          fetch('http://localhost:8000/api/metrics/dwell'),
          fetch('http://localhost:8000/api/queue/status')
        ]);
        
        if (!isSubscribed) return;
        setFootfall(await footRes.json());
        const tData = await trendsRes.json();
        setTrends(Array.isArray(tData) ? tData : Object.entries(tData).map(([k,v]) => ({ name: k, count: v })));
        setDwell(await dwellRes.json() || []);
        setQueueStatus(await queueRes.json());
      } catch (err) {}
    };
    
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    
    return () => {
      isSubscribed = false;
      clearInterval(interval);
      if (ws) ws.close();
    };
  }, []);

  const totalEntries = footfall.ENTRY || 0;
  const checkoutCount = queueStatus?.checkout_count || 0;
  const zoneEngagement = trends.reduce((acc, curr) => acc + (curr.count || curr.visitor_count || curr.occupancy || 0), 0);
  
  const funnelData = [
    { name: 'Store Entry', value: totalEntries > 0 ? 100 : 0, count: totalEntries, color: '#3b82f6' },
    { name: 'Zone Engagement', value: totalEntries > 0 ? Math.min(100, Math.round((zoneEngagement / totalEntries) * 100)) : 0, count: zoneEngagement, color: '#10b981' },
    { name: 'Checkout Queue', value: totalEntries > 0 ? Math.min(100, Math.round((checkoutCount / totalEntries) * 100)) : 0, count: checkoutCount, color: '#f59e0b' }
  ];

  return (
    <div className="dashboard-container" style={{ padding: '2rem', color: '#e2e8f0', minHeight: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, margin: '0 0 0.4rem 0', color: '#ffffff' }}>Shopper Analytics & Live Radar</h1>
          <p style={{ color: '#94a3b8', margin: 0 }}>Real-time spatial tracking, conversion funnels, and path-to-purchase telemetry.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '0.5rem 1rem', borderRadius: '8px' }}>
          <Activity size={16} color="#3b82f6" />
          <span style={{ color: '#3b82f6', fontWeight: 600, fontSize: '0.9rem' }}>Live Edge Stream Active</span>
        </div>
      </div>

      {/* Conversion Funnel Strip */}
      <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', gap: '2rem', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ width: '250px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#ffffff' }}>Conversion Funnel</h3>
          <p style={{ color: '#64748b', fontSize: '0.8rem', margin: 0, lineHeight: 1.4 }}>Tracking the percentage of shoppers moving from entry to engaged zones to final checkout.</p>
        </div>
        
        <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: '1rem' }}>
          {funnelData.map((step, idx) => (
            <React.Fragment key={step.name}>
              <div style={{ flex: 1, background: 'rgba(15, 23, 42, 0.4)', border: `1px solid ${step.color}40`, borderRadius: '8px', padding: '1.2rem', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: `${step.value}%`, background: `${step.color}15`, zIndex: 0 }}></div>
                <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: '0.5rem' }}>{step.name}</div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
                      {step.count}
                      <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>shoppers</span>
                    </div>
                  </div>
                  <div style={{ background: `${step.color}20`, color: step.color, padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 700 }}>
                    {step.value}%
                  </div>
                </div>
              </div>
              {idx < funnelData.length - 1 && (
                <ArrowRight size={24} color="#475569" style={{ flexShrink: 0 }} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Live Store Radar Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', height: '400px' }}>
        
        {/* Radar Canvas */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15, 23, 42, 0.4)', position: 'relative', zIndex: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Radar size={18} color="#06b6d4" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>Live Store Radar</h3>
            </div>
            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', fontWeight: 600 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#cbd5e1' }}><div style={{ width: 8, height: 8, borderRadius: 4, background: '#06b6d4', boxShadow: '0 0 8px #06b6d4' }}></div> Shopper</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#cbd5e1' }}><div style={{ width: 8, height: 8, borderRadius: 4, background: '#f59e0b', boxShadow: '0 0 8px #f59e0b' }}></div> Staff</span>
            </div>
          </div>
          
          <div style={{ flex: 1, position: 'relative', background: '#020617' }}>
            <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(6, 182, 212, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(6, 182, 212, 0.05) 1px, transparent 1px)', backgroundSize: '40px 40px', backgroundPosition: 'center', zIndex: 0 }}></div>
            
            <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
              {liveAgents.map(a => {
                const color = a.type === 'staff' ? '#f59e0b' : '#06b6d4';
                // Convert normalized 0-1 coords to percentages. Adjust slightly to keep dots within bounds.
                const cx = Math.max(5, Math.min(95, a.x * 100));
                const cy = Math.max(5, Math.min(95, a.y * 100));
                
                return (
                  <g key={a.id} style={{ transition: 'all 0.5s ease-out' }} transform={`translate(${cx}%, ${cy}%)`}>
                    {/* SVG doesn't support percentage translate well across browsers if width isn't fixed, but standard browsers handle it if done via CSS transform */}
                    <circle cx="0" cy="0" r="16" fill="none" stroke={color} strokeWidth="1" opacity="0.4">
                      <animate attributeName="r" values="6; 24" dur="2s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.8; 0" dur="2s" repeatCount="indefinite" />
                    </circle>
                    <circle cx="0" cy="0" r="6" fill={color} />
                    <text x="12" y="-6" fill="#f1f5f9" fontSize="11" fontWeight="700" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                      ID:{a.id}
                    </text>
                    <text x="12" y="8" fill="#94a3b8" fontSize="9" fontWeight="600" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                      {a.zone}
                    </text>
                  </g>
                );
              })}
            </svg>
            
            {liveAgents.length === 0 && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#475569', zIndex: 2 }}>
                <Radar size={48} opacity={0.3} style={{ marginBottom: '1rem' }} />
                <p>Awaiting tracking telemetry...</p>
              </div>
            )}
          </div>
        </div>

        {/* Active Roster */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>Active Roster</h3>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
            {liveAgents.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {liveAgents.map(a => (
                  <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15, 23, 42, 0.4)', padding: '0.75rem 1rem', borderRadius: '8px', borderLeft: `3px solid ${a.type === 'staff' ? '#f59e0b' : '#06b6d4'}` }}>
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f1f5f9' }}>Track ID: {a.id}</div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{a.zone}</div>
                    </div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: a.type === 'staff' ? '#f59e0b' : '#06b6d4', background: a.type === 'staff' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(6, 182, 212, 0.1)', padding: '0.2rem 0.6rem', borderRadius: '4px' }}>
                      {a.type}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: '0.85rem' }}>
                No active individuals tracked.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Bottom Grid: Dwell & Trends */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        
        {/* Left: Zone Occupancy */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', padding: '1.5rem', height: 300 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <Map size={18} color="#10b981" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>Zone Occupancy Breakdown</h3>
          </div>
          
          <div style={{ flex: 1 }}>
            {trends.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trends} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis type="number" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" tick={{ fill: '#cbd5e1', fontSize: 12, fontWeight: 500 }} axisLine={false} tickLine={false} width={100} />
                  <RechartsTooltip cursor={{ fill: 'rgba(255,255,255,0.02)' }} contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }} />
                  <Bar dataKey="count" name="Shoppers" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                Waiting for shoppers to enter monitored zones...
              </div>
            )}
          </div>
        </div>

        {/* Right: Dwell Times */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', padding: '1.5rem', height: 300 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <Clock size={18} color="#f59e0b" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>Dwell Time Leaderboard</h3>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', paddingRight: '0.5rem' }}>
            {dwell.length > 0 ? (
              dwell.sort((a, b) => b.avg_duration - a.avg_duration).map((d, i) => {
                const target = 60;
                const percent = Math.min(100, (d.avg_duration / target) * 100);
                
                return (
                  <div key={i} style={{ background: 'rgba(15, 23, 42, 0.4)', borderRadius: '8px', padding: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '0.9rem' }}>{d.promo_zone}</span>
                      <span style={{ color: '#f59e0b', fontWeight: 800, fontSize: '1.1rem' }}>{d.avg_duration.toFixed(1)}s</span>
                    </div>
                    <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${percent}%`, background: '#f59e0b', borderRadius: '3px' }}></div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                No dwell events recorded yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
