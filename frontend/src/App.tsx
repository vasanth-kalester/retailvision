import React, { useState, useEffect } from 'react';
import { ShieldCheck, Activity, Users, Box, Video, Settings, LayoutGrid, AlertTriangle, FileText, Bot, X, Cloud, CloudOff, RefreshCcw, MapPin } from 'lucide-react';
import Overview from './components/Overview';
import QueueIntelligence from './components/QueueIntelligence';
import ShelfMonitoring from './components/ShelfMonitoring';
import PosInventory from './components/PosInventory';
import CopilotPanel from './components/CopilotPanel';
import CameraManagement from './components/CameraManagement';
import AlertsPanel from './components/AlertsPanel';
import ReportsPage from './components/ReportsPage';
import ShopperAnalytics from './components/ShopperAnalytics';
import ZoneManagement from './components/ZoneManagement';

interface SystemStatus { camera_active: boolean; db_connected: boolean; edge_ai_ready: boolean; }

const App = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'shelf' | 'analytics' | 'queue' | 'pos' | 'alerts' | 'reports' | 'cameras' | 'zones' | 'settings'>('overview');
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [cloudSync, setCloudSync] = useState<any>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const [sysRes, syncRes] = await Promise.all([
          fetch('http://localhost:8000/api/metrics/system-status'),
          fetch('http://localhost:8000/api/cloud/sync-status')
        ]);
        if (sysRes.ok) setSystemStatus(await sysRes.json());
        if (syncRes.ok) setCloudSync(await syncRes.json());
      } catch {}
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleForceSync = async () => {
    try {
      await fetch('http://localhost:8000/api/cloud/force-sync', { method: 'POST' });
    } catch {}
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'overview': return <Overview systemStatus={systemStatus} />;
      case 'queue': return <QueueIntelligence />;
      case 'shelf': return <ShelfMonitoring />;
      case 'pos': return <PosInventory />;
      case 'cameras': return <CameraManagement />;
      case 'zones': return <ZoneManagement />;
      case 'analytics': return <ShopperAnalytics />;
      case 'alerts': return <AlertsPanel />;
      case 'reports': return <ReportsPage onBack={() => setActiveTab('overview')} />;
      default: return (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
          <h2>Module Under Construction</h2>
          <p>The {activeTab} module is being updated for RetailVision v2.4.</p>
        </div>
      );
    }
  };

  return (
    <div className="app-container">
      {/* ── Left Sidebar ──────────────────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <Box size={22} color="#2563eb" />
            RetailVision
          </div>
          <div className="enterprise-badge">v2.4 Enterprise</div>
        </div>

        <div className="content-scroll" style={{ padding: '1rem 0.5rem' }}>
          <div className="sidebar-section">
            <h4 className="sidebar-label">Intelligence Suite</h4>
            {[
              { id: 'overview', icon: <LayoutGrid size={18} />, label: 'Overview' },
              { id: 'shelf', icon: <Box size={18} />, label: 'Shelf Monitoring' },
              { id: 'analytics', icon: <Users size={18} />, label: 'Shopper Analytics' },
              { id: 'queue', icon: <Activity size={18} />, label: 'Queue Intelligence' },
              { id: 'pos', icon: <Database size={18} />, label: 'POS & Inventory' },
              { id: 'alerts', icon: <AlertTriangle size={18} />, label: 'Alerts' },
              { id: 'reports', icon: <FileText size={18} />, label: 'Reports' },
            ].map(item => (
              <button key={item.id} className={`nav-item ${activeTab === item.id ? 'active' : ''}`} onClick={() => setActiveTab(item.id as any)}>
                {item.icon} <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge && <span style={{ background: '#e11d48', color: 'white', fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: 10, fontWeight: 700 }}>{item.badge}</span>}
              </button>
            ))}
          </div>

          <div className="sidebar-section">
            <h4 className="sidebar-label">Infrastructure</h4>
            {[
              { id: 'cameras', icon: <Video size={18} />, label: 'Camera Management' },
              { id: 'zones', icon: <MapPin size={18} />, label: 'Zone Management' },
              { id: 'settings', icon: <Settings size={18} />, label: 'Settings' },
            ].map(item => (
              <button key={item.id} className={`nav-item ${activeTab === item.id ? 'active' : ''}`} onClick={() => setActiveTab(item.id as any)}>
                {item.icon} {item.label}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* ── Main Area ─────────────────────────────────────────────────────────── */}
      <div className="main-area">
        {/* Topbar */}
        <header className="topbar">
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Metro Superstore #104</span>
            <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Grand Avenue</span>
          </div>
          
          <div className="topbar-divider" />
          
          <div className="topbar-metric">
            <span className="topbar-metric-value" style={{ color: systemStatus?.camera_active ? '#2563eb' : '#94a3b8' }}>18/18</span>
            <span className="topbar-metric-label">Streams Online</span>
          </div>
          <div className="topbar-metric">
            <span className="topbar-metric-value">14ms</span>
            <span className="topbar-metric-label">Edge Latency</span>
          </div>
          <div className="topbar-metric">
            <span className="topbar-metric-value">99.8%</span>
            <span className="topbar-metric-label">Vision FPS</span>
          </div>

          <div className="topbar-divider" />

          {/* Cloud Sync Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }} onClick={handleForceSync} title="Click to force sync">
            {cloudSync?.enabled ? (
              <Cloud size={16} color="#2563eb" />
            ) : (
              <CloudOff size={16} color="#94a3b8" />
            )}
            <div className="topbar-metric">
              <span className="topbar-metric-value" style={{ color: cloudSync?.enabled ? '#2563eb' : '#94a3b8', fontSize: '0.75rem' }}>
                {cloudSync?.enabled ? (cloudSync?.last_sync_human ? new Date(cloudSync.last_sync_human).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Pending') : 'Offline'}
              </span>
              <span className="topbar-metric-label">Cloud Sync</span>
            </div>
          </div>

          <div className="privacy-badge">
            <ShieldCheck size={16} />
            <span>Privacy Protected: Frame → Edge AI → Metadata</span>
          </div>
          
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#cbd5e1', marginLeft: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#475569', fontSize: '0.9rem' }}>
            SC
          </div>
        </header>

        {/* Content */}
        <div className="content-scroll">
          {renderContent()}
        </div>
      </div>

      {/* ── Copilot Floating Widget ───────────────────────────────────────────── */}
      <button className="copilot-fab" onClick={() => setCopilotOpen(!copilotOpen)}>
        {copilotOpen ? <X size={24} /> : <Bot size={24} />}
      </button>

      <div className={`copilot-widget ${!copilotOpen ? 'closed' : ''}`}>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <CopilotPanel onClose={() => setCopilotOpen(false)} />
        </div>
      </div>
    </div>
  );
};

// Simple stub for Database icon missing from lucide import
const Database = (props: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>
);

export default App;
