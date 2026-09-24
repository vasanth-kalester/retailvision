import React, { useState } from 'react';
import { Settings, Save, Server, Shield, Bell, HardDrive, RefreshCw } from 'lucide-react';

export default function SettingsPanel() {
  const [activeTab, setActiveTab] = useState<'system'|'ai'|'notifications'>('system');

  return (
    <div style={{ paddingBottom: '2rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ background: 'var(--primary-blue)', color: 'white', padding: '0.5rem', borderRadius: 8 }}>
            <Settings size={20} />
          </div>
          <div>
            <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.25rem', color: 'var(--text-primary)' }}>
              System Settings
            </h2>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Configure your RetailVision deployment and AI models.
            </p>
          </div>
        </div>
        <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Save size={16} /> Save Changes
        </button>
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', flex: 1 }}>
        {/* Settings Navigation */}
        <div className="panel" style={{ width: '250px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <button 
            onClick={() => setActiveTab('system')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderRadius: 8, background: activeTab === 'system' ? 'var(--primary-blue-light)' : 'transparent', border: 'none', color: activeTab === 'system' ? 'var(--primary-blue)' : 'var(--text-primary)', fontWeight: activeTab === 'system' ? 600 : 400, cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left' }}
          >
            <Server size={18} /> General System
          </button>
          <button 
            onClick={() => setActiveTab('ai')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderRadius: 8, background: activeTab === 'ai' ? 'var(--primary-blue-light)' : 'transparent', border: 'none', color: activeTab === 'ai' ? 'var(--primary-blue)' : 'var(--text-primary)', fontWeight: activeTab === 'ai' ? 600 : 400, cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left' }}
          >
            <Shield size={18} /> AI & Privacy
          </button>
          <button 
            onClick={() => setActiveTab('notifications')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderRadius: 8, background: activeTab === 'notifications' ? 'var(--primary-blue-light)' : 'transparent', border: 'none', color: activeTab === 'notifications' ? 'var(--primary-blue)' : 'var(--text-primary)', fontWeight: activeTab === 'notifications' ? 600 : 400, cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left' }}
          >
            <Bell size={18} /> Notifications
          </button>
        </div>

        {/* Settings Content */}
        <div className="panel" style={{ flex: 1, padding: '2rem' }}>
          {activeTab === 'system' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <HardDrive size={18} color="var(--primary-blue)" /> Data Storage
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Telemetry Data Retention (Days)</label>
                    <input type="number" defaultValue={30} style={{ width: '100%', padding: '0.6rem', borderRadius: 6, border: '1px solid var(--border-strong)' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Video Archive Retention (Days)</label>
                    <input type="number" defaultValue={7} style={{ width: '100%', padding: '0.6rem', borderRadius: 6, border: '1px solid var(--border-strong)' }} />
                  </div>
                </div>
              </div>
              <div style={{ height: '1px', background: 'var(--border-light)' }} />
              <div>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <RefreshCw size={18} color="var(--primary-blue)" /> Cloud Synchronization
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <input type="checkbox" defaultChecked id="sync-enabled" style={{ width: 18, height: 18 }} />
                  <label htmlFor="sync-enabled" style={{ fontSize: '0.9rem', color: 'var(--text-primary)', cursor: 'pointer' }}>Enable automated cloud synchronization (Enterprise feature)</label>
                </div>
                <p style={{ margin: '0.5rem 0 0 2rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Metrics and anonymous metadata will be synced to cloud dashboards every 5 minutes.</p>
              </div>
            </div>
          )}

          {activeTab === 'ai' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Shield size={18} color="var(--primary-blue)" /> Privacy Controls
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                  <input type="checkbox" defaultChecked id="blur-faces" style={{ width: 18, height: 18 }} />
                  <label htmlFor="blur-faces" style={{ fontSize: '0.9rem', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600 }}>Enable strict face blurring</label>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <input type="checkbox" defaultChecked id="discard-video" style={{ width: 18, height: 18 }} />
                  <label htmlFor="discard-video" style={{ fontSize: '0.9rem', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600 }}>Discard raw video after inference</label>
                </div>
              </div>
              <div style={{ height: '1px', background: 'var(--border-light)' }} />
              <div>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: 'var(--text-primary)' }}>Vision Model Thresholds</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Person Detection Confidence</label>
                    <input type="range" min="1" max="100" defaultValue="45" style={{ width: '100%' }} />
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', textAlign: 'right' }}>45%</div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Product Recognition Confidence</label>
                    <input type="range" min="1" max="100" defaultValue="60" style={{ width: '100%' }} />
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', textAlign: 'right' }}>60%</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: 'var(--text-primary)' }}>Alert Preferences</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                    <input type="checkbox" defaultChecked style={{ width: 16, height: 16 }} />
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>Email alerts for critical incidents (e.g. Camera offline)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                    <input type="checkbox" defaultChecked style={{ width: 16, height: 16 }} />
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>Daily summary reports via email</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                    <input type="checkbox" style={{ width: 16, height: 16 }} />
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>SMS alerts (Requires enterprise add-on)</span>
                  </label>
                </div>
              </div>
              <div style={{ height: '1px', background: 'var(--border-light)' }} />
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Alert Email Address</label>
                <input type="email" defaultValue="admin@metrosuperstore.com" style={{ width: '100%', maxWidth: '400px', padding: '0.6rem', borderRadius: 6, border: '1px solid var(--border-strong)' }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
