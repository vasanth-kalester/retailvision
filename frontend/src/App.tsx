import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { Users, Activity, Clock, ArrowUpRight, ArrowDownRight, FlaskConical, Sparkles } from 'lucide-react';
import TestPage from './TestPage';

// Interfaces for our API data
interface FootfallData {
  ENTRY: number;
  EXIT: number;
}

interface TrendData {
  timestamp: number;
  zone_name: string;
  occupancy_count: number;
}

interface DwellData {
  promo_zone: string;
  avg_duration: number;
  visitor_count: number;
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e'];

const App = () => {
  const [page, setPage] = useState<'dashboard' | 'test'>('dashboard');
  const [footfall, setFootfall] = useState<FootfallData>({ ENTRY: 0, EXIT: 0 });
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [dwells, setDwells] = useState<DwellData[]>([]);
  const [insightsOpen, setInsightsOpen] = useState(false);

  // Poll the API every 3 seconds
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [footfallRes, trendsRes, dwellRes] = await Promise.all([
          fetch('http://localhost:8000/api/metrics/footfall').then(res => res.json()),
          fetch('http://localhost:8000/api/metrics/trends').then(res => res.json()),
          fetch('http://localhost:8000/api/metrics/dwell').then(res => res.json())
        ]);
        setFootfall(footfallRes);
        setTrends(trendsRes);
        setDwells(dwellRes);
      } catch (err) {
        console.error('Failed to fetch metrics', err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  if (page === 'test') return <TestPage onBack={() => setPage('dashboard')} />;

  // Format timestamp for charts
  const formatTime = (ts: number) => {
    const date = new Date(ts * 1000);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  // Group trends by timestamp for Recharts AreaChart
  const processTrendData = () => {
    if (!trends.length) return [];
    const timeMap = new Map();
    trends.forEach(t => {
      const timeStr = formatTime(t.timestamp);
      if (!timeMap.has(timeStr)) timeMap.set(timeStr, { time: timeStr });
      const entry = timeMap.get(timeStr);
      entry[t.zone_name] = t.occupancy_count;
    });
    return Array.from(timeMap.values());
  };

  const chartData = processTrendData();
  const currentOccupancy = footfall.ENTRY - footfall.EXIT;
  const conversionRate = footfall.ENTRY > 0 ? Math.round((footfall.EXIT / footfall.ENTRY) * 100) : 0;
  const avgDwell = dwells.length > 0
    ? Math.round(dwells.reduce((acc, curr) => acc + curr.avg_duration, 0) / dwells.length)
    : 0;

  // Generate textual insights from live data
  const generateInsights = () => {
    const insights = [];
    if (footfall.ENTRY > 0) {
      insights.push(`${footfall.ENTRY} shoppers entered the store, with ${footfall.EXIT} exits — current live occupancy is approximately ${Math.max(0, currentOccupancy)}.`);
    }
    if (avgDwell > 0) {
      const sentiment = avgDwell > 30 ? 'strong promotional engagement' : 'moderate engagement';
      insights.push(`Average promotional dwell time is ${avgDwell}s, indicating ${sentiment} across displayed endcaps.`);
    }
    if (dwells.length > 0) {
      const topZone = [...dwells].sort((a, b) => b.avg_duration - a.avg_duration)[0];
      insights.push(`"${topZone.promo_zone}" is the highest-performing promo zone with ${Math.round(topZone.avg_duration)}s avg dwell — consider restocking or expanding this display.`);
    }
    if (conversionRate > 0) {
      insights.push(`Exit-to-entry ratio: ${conversionRate}%. ${conversionRate > 70 ? 'High flow-through — store layout is driving effective conversion.' : 'Room to improve conversion through better zone placement.'}`);
    }
    if (chartData.length >= 2) {
      insights.push(`Zone occupancy trends are being recorded every 15 minutes — use this data to optimise staff scheduling and shelf restocking windows.`);
    }
    if (insights.length === 0) {
      insights.push('No live data yet. Ensure the edge camera feed is running and the analytics engine is processing frames.');
      insights.push('Once data flows in, AI-generated insights will appear here to help you take action.');
    }
    return insights;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: 'rgba(8, 15, 30, 0.95)', border: '1px solid rgba(99,130,255,0.2)', padding: '12px 16px', borderRadius: '12px', backdropFilter: 'blur(8px)' }}>
          <p style={{ color: '#94a3b8', marginBottom: '8px', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color, fontSize: '0.875rem', fontWeight: 600 }}>
              {entry.name}: <span style={{ color: '#e2e8f0' }}>{entry.value} shoppers</span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-left">
          <div>
            <h1 className="header-title">Retail Intelligence</h1>
            <p className="header-subtitle">Shopper Analytics — Edge AI Platform</p>
          </div>
        </div>

        <div className="header-right">
          {/* Navigation Tabs */}
          <div className="nav-tabs">
            <button
              className={`nav-tab ${page === 'dashboard' ? 'active' : ''}`}
              onClick={() => setPage('dashboard')}
            >
              📊 Live Dashboard
            </button>
            <button
              className={`nav-tab ${(page as string) === 'test' ? 'active' : ''}`}
              onClick={() => setPage('test')}
            >
              <FlaskConical size={14} />
              Upload & Test Footage
            </button>
          </div>

          {/* Generate Insights Button */}
          <button
            className="insights-btn"
            onClick={() => setInsightsOpen(v => !v)}
          >
            <Sparkles size={14} />
            {insightsOpen ? 'Hide Insights' : 'Generate Insights'}
          </button>

          <div className="live-indicator">
            <div className="pulse-dot"></div>
            Live Edge Feed
          </div>
        </div>
      </header>

      {/* AI Insights Panel */}
      {insightsOpen && (
        <div className="insights-panel" style={{ marginBottom: '1.75rem' }}>
          <h3>
            <Sparkles size={16} color="#8b5cf6" />
            AI-Generated Insights
          </h3>
          {generateInsights().map((insight, i) => (
            <div key={i} className="insight-item">
              <div className="insight-dot" />
              <span>{insight}</span>
            </div>
          ))}
        </div>
      )}

      {/* KPIs */}
      <div className="kpi-grid">
        <div className="glass-card">
          <div className="kpi-header">
            <span>Total Entries</span>
            <Users className="kpi-icon" size={28} color="#6366f1" />
          </div>
          <div className="kpi-value">{footfall.ENTRY}</div>
          <div className="kpi-trend positive">
            <ArrowUpRight size={14} /> <span>Live tracking active</span>
          </div>
        </div>

        <div className="glass-card">
          <div className="kpi-header">
            <span>Total Exits</span>
            <Activity className="kpi-icon" size={28} color="#f43f5e" />
          </div>
          <div className="kpi-value">{footfall.EXIT}</div>
          <div className="kpi-trend negative">
            <ArrowDownRight size={14} /> <span>Real-time conversion</span>
          </div>
        </div>

        <div className="glass-card">
          <div className="kpi-header">
            <span>Avg Promo Dwell</span>
            <Clock className="kpi-icon" size={28} color="#10b981" />
          </div>
          <div className="kpi-value">{avgDwell}s</div>
          <div className="kpi-trend positive">
            <ArrowUpRight size={14} /> <span>Across all endcaps</span>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="charts-grid">
        <div className="glass-card">
          <div className="chart-header">
            <h2 className="chart-title">Zone Occupancy Trends</h2>
            <p className="chart-subtitle">15-minute rolling aggregations</p>
          </div>
          <div className="chart-container">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    {COLORS.map((color, i) => (
                      <linearGradient key={`color-${i}`} id={`fill-${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={color} stopOpacity={0.5}/>
                        <stop offset="95%" stopColor={color} stopOpacity={0.02}/>
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,130,255,0.06)" vertical={false} />
                  <XAxis dataKey="time" stroke="#334155" tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis stroke="#334155" tick={{ fill: '#64748b', fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  {Object.keys(chartData[0] || {})
                    .filter(key => key !== 'time')
                    .map((zone, idx) => (
                      <Area
                        key={zone}
                        type="monotone"
                        dataKey={zone}
                        stroke={COLORS[idx % COLORS.length]}
                        strokeWidth={2}
                        fillOpacity={1}
                        fill={`url(#fill-${idx % COLORS.length})`}
                      />
                    ))}
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state">
                <span style={{ fontSize: '1.5rem' }}>📡</span>
                <span>Waiting for zone data aggregations…</span>
              </div>
            )}
          </div>
        </div>

        <div className="glass-card">
          <div className="chart-header">
            <h2 className="chart-title">Dwell Times</h2>
            <p className="chart-subtitle">Average duration per display</p>
          </div>
          <div className="chart-container">
            {dwells.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dwells} layout="vertical" margin={{ top: 0, right: 0, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,130,255,0.06)" horizontal={false} />
                  <XAxis type="number" stroke="#334155" tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis dataKey="promo_zone" type="category" stroke="#334155" tick={{ fill: '#64748b', fontSize: 11 }} width={80} />
                  <Tooltip
                    cursor={{ fill: 'rgba(99,102,241,0.06)' }}
                    contentStyle={{ background: 'rgba(8,15,30,0.95)', border: '1px solid rgba(99,130,255,0.2)', borderRadius: '12px', color: '#e2e8f0' }}
                  />
                  <Bar dataKey="avg_duration" name="Seconds" radius={[0, 6, 6, 0]}>
                    {dwells.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
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
    </div>
  );
};

export default App;
