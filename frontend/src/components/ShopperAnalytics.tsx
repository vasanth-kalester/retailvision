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
    <div className="dashboard-container" style={{ padding: '2rem', minHeight: '100%', display: 'flex', flexDirection: 'column', gap: '2rem', background: '#f8fafc' }}>
      
      {/* Header */}
      <div className="animate-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="text-gradient" style={{ fontSize: '2.2rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>Shopper Analytics & Live Radar</h1>
          <p style={{ color: '#64748b', margin: 0, fontSize: '1.05rem' }}>Real-time spatial tracking, conversion funnels, and path-to-purchase telemetry.</p>
        </div>
        <div className="modern-badge" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1.25rem' }}>
          <div className="radar-dot" style={{ width: 8, height: 8, background: '#3b82f6' }}></div>
          <span>Live Edge Stream Active</span>
        </div>
      </div>

      {/* Conversion Funnel Strip */}
      <div className="glass-panel animate-in stagger-1" style={{ padding: '2rem', display: 'flex', gap: '2rem', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ width: '280px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#0f172a' }}>Conversion Funnel</h3>
          <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0, lineHeight: 1.5 }}>Tracking the percentage of shoppers moving from entry to engaged zones to final checkout.</p>
        </div>
        
        <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: '1.5rem' }}>
          {funnelData.map((step, idx) => (
            <React.Fragment key={step.name}>
              <div style={{ flex: 1, background: '#ffffff', border: `1px solid ${step.color}30`, borderRadius: '12px', padding: '1.5rem', position: 'relative', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: `${step.value}%`, background: `linear-gradient(90deg, ${step.color}15, ${step.color}05)`, zIndex: 0 }}></div>
                <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: '0.5rem' }}>{step.name}</div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
                      {step.count}
                      <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>shoppers</span>
                    </div>
                  </div>
                  <div style={{ background: `${step.color}15`, color: step.color, padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '1rem', fontWeight: 800 }}>
                    {step.value}%
                  </div>
                </div>
              </div>
              {idx < funnelData.length - 1 && (
                <ArrowRight size={28} color="#94a3b8" style={{ flexShrink: 0 }} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Live Store Radar Grid */}
      <div className="animate-in stagger-2" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem', height: '450px' }}>
        
        {/* Radar Canvas */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', position: 'relative', zIndex: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ background: '#eff6ff', padding: '0.5rem', borderRadius: '8px' }}>
                <Radar size={20} color="#3b82f6" />
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>Live Store Radar</h3>
            </div>
            <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.85rem', fontWeight: 600 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#475569' }}><div style={{ width: 10, height: 10, borderRadius: 5, background: '#3b82f6', boxShadow: '0 0 8px rgba(59,130,246,0.4)' }}></div> Shopper</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#475569' }}><div style={{ width: 10, height: 10, borderRadius: 5, background: '#f59e0b', boxShadow: '0 0 8px rgba(245,158,11,0.4)' }}></div> Staff</span>
            </div>
          </div>
          
          <div style={{ flex: 1, position: 'relative', background: '#f1f5f9' }}>
            <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(59, 130, 246, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(59, 130, 246, 0.1) 1px, transparent 1px)', backgroundSize: '40px 40px', backgroundPosition: 'center', zIndex: 0 }}></div>
            
            <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
              {liveAgents.map(a => {
                const color = a.type === 'staff' ? '#f59e0b' : '#3b82f6';
                const cx = Math.max(5, Math.min(95, a.x * 100));
                const cy = Math.max(5, Math.min(95, a.y * 100));
                
                return (
                  <g key={a.id} style={{ transition: 'all 0.5s ease-out' }} transform={`translate(${cx}%, ${cy}%)`}>
                    <circle cx="0" cy="0" r="20" fill={color} opacity="0.1">
                      <animate attributeName="r" values="10; 30" dur="2s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.3; 0" dur="2s" repeatCount="indefinite" />
                    </circle>
                    <circle cx="0" cy="0" r="7" fill={color} stroke="#ffffff" strokeWidth="2" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }} />
                    <text x="14" y="-6" fill="#0f172a" fontSize="12" fontWeight="800" style={{ textShadow: '0 1px 2px #ffffff, 0 -1px 2px #ffffff, 1px 0 2px #ffffff, -1px 0 2px #ffffff' }}>
                      ID:{a.id}
                    </text>
                    <text x="14" y="8" fill="#64748b" fontSize="10" fontWeight="700">
                      {a.zone}
                    </text>
                  </g>
                );
              })}
            </svg>
            
            {liveAgents.length === 0 && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', zIndex: 2 }}>
                <Radar size={56} opacity={0.5} style={{ marginBottom: '1rem', color: '#3b82f6' }} />
                <p style={{ fontWeight: 500, fontSize: '1.1rem' }}>Awaiting tracking telemetry...</p>
              </div>
            )}
          </div>
        </div>

        {/* Active Roster */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(0,0,0,0.05)', background: '#ffffff', borderRadius: '16px 16px 0 0' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>Active Roster</h3>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', background: '#fafafa' }}>
            {liveAgents.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {liveAgents.map(a => (
                  <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', padding: '1rem 1.25rem', borderRadius: '12px', borderLeft: `4px solid ${a.type === 'staff' ? '#f59e0b' : '#3b82f6'}`, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <div>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>Track ID: {a.id}</div>
                      <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>{a.zone}</div>
                    </div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: a.type === 'staff' ? '#d97706' : '#2563eb', background: a.type === 'staff' ? '#fef3c7' : '#eff6ff', padding: '0.3rem 0.75rem', borderRadius: '6px' }}>
                      {a.type}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.95rem', fontWeight: 500 }}>
                No active individuals tracked.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Bottom Grid: Dwell & Trends */}
      <div className="animate-in stagger-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        
        {/* Left: Zone Occupancy */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', padding: '1.75rem', height: 320, background: '#ffffff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{ background: '#d1fae5', padding: '0.5rem', borderRadius: '8px' }}>
              <Map size={20} color="#059669" />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>Zone Occupancy Breakdown</h3>
          </div>
          
          <div style={{ flex: 1 }}>
            {trends.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trends} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" tick={{ fill: '#475569', fontSize: 13, fontWeight: 600 }} axisLine={false} tickLine={false} width={120} />
                  <RechartsTooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', fontWeight: 600, color: '#0f172a' }} />
                  <Bar dataKey="count" name="Shoppers" fill="#10b981" radius={[0, 6, 6, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontWeight: 500 }}>
                Waiting for shoppers to enter monitored zones...
              </div>
            )}
          </div>
        </div>

        {/* Right: Dwell Times */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', padding: '1.75rem', height: 320, background: '#ffffff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{ background: '#fef3c7', padding: '0.5rem', borderRadius: '8px' }}>
              <Clock size={20} color="#d97706" />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>Dwell Time Leaderboard</h3>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingRight: '0.5rem' }}>
            {dwell.length > 0 ? (
              dwell.sort((a, b) => b.avg_duration - a.avg_duration).map((d, i) => {
                const target = 60;
                const percent = Math.min(100, (d.avg_duration / target) * 100);
                
                return (
                  <div key={i} style={{ background: '#f8fafc', borderRadius: '12px', padding: '1.25rem', border: '1px solid #e2e8f0', transition: 'transform 0.2s', cursor: 'default' }} onMouseOver={e => e.currentTarget.style.transform='translateX(4px)'} onMouseOut={e => e.currentTarget.style.transform='translateX(0)'}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <span style={{ color: '#334155', fontWeight: 700, fontSize: '0.95rem' }}>{d.promo_zone}</span>
                      <span style={{ color: '#d97706', fontWeight: 800, fontSize: '1.15rem' }}>{d.avg_duration.toFixed(1)}s</span>
                    </div>
                    <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${percent}%`, background: 'linear-gradient(90deg, #f59e0b, #d97706)', borderRadius: '4px' }}></div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontWeight: 500 }}>
                No dwell events recorded yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
