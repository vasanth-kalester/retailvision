import React, { useState, useEffect } from 'react';
import { Store, Inbox } from 'lucide-react';

interface Props {
  onBack?: () => void;
}

export default function StoreManagement({ onBack }: Props) {
  const [storeInventory, setStoreInventory] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);

  const fetchData = async () => {
    try {
      const [invRes, reqRes] = await Promise.all([
        fetch('http://localhost:8000/api/inventory/store/STORE_001'),
        fetch('http://localhost:8000/api/inventory/replenishment/requests?store_id=STORE_001')
      ]);

      const invData = await invRes.json();
      const reqData = await reqRes.json();

      setStoreInventory(invData.items || []);
      setRequests(reqData.requests || []);
    } catch (error) {
      console.error('Error fetching store data:', error);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const updateRequestStatus = async (id: string, status: string) => {
    try {
      await fetch(`http://localhost:8000/api/inventory/replenishment/requests/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      fetchData();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  return (
    <div className="dashboard-container" style={{ padding: '20px', color: '#e2e8f0' }}>
      <header className="dashboard-header" style={{ marginBottom: '20px' }}>
        
        {onBack && (
          <button 
            onClick={onBack}
            style={{ marginBottom: '15px', padding: '8px 16px', backgroundColor: '#334155', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            ← Back to Dashboard
          </button>
        )}
        <div>
          <h1 className="header-title">Store Management</h1>
          <p className="header-subtitle">Local Inventory for STORE_001</p>
        </div>
      </header>

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        
        {/* Left Column: Store Stock */}
        <div className="glass-card" style={{ flex: '1', minWidth: '400px', padding: '20px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
            <Store size={20} color="#6366f1" /> Current Store Stock
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                  <th style={{ padding: '12px 8px' }}>SKU</th>
                  <th style={{ padding: '12px 8px' }}>On-Hand</th>
                </tr>
              </thead>
              <tbody>
                {storeInventory.map((item, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.5)' }}>
                    <td style={{ padding: '12px 8px', fontWeight: 'bold' }}>{item.sku}</td>
                    <td style={{ padding: '12px 8px', color: item.on_hand_units < 5 ? '#f43f5e' : '#10b981', fontWeight: 'bold' }}>
                      {item.on_hand_units}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {storeInventory.length === 0 && <p style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>No items in store inventory.</p>}
          </div>
        </div>

        {/* Right Column: Replenishment Requests */}
        <div className="glass-card" style={{ flex: '1', minWidth: '400px', padding: '20px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
            <Inbox size={20} color="#f59e0b" /> Replenishment Requests
          </h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {requests.map((r, i) => (
              <li key={i} style={{ padding: '15px', border: '1px solid #334155', backgroundColor: 'rgba(15, 23, 42, 0.4)', marginBottom: '10px', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <strong style={{ fontSize: '1.1em' }}>{r.sku}</strong>
                  <span style={{ 
                    padding: '4px 8px', 
                    borderRadius: '4px', 
                    fontSize: '0.8em',
                    backgroundColor: r.status === 'pending' ? 'rgba(245, 158, 11, 0.2)' : 
                                   r.status === 'approved' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(148, 163, 184, 0.2)',
                    color: r.status === 'pending' ? '#f59e0b' : 
                           r.status === 'approved' ? '#10b981' : '#94a3b8'
                  }}>
                    {r.status.toUpperCase()}
                  </span>
                </div>
                <div style={{ color: '#94a3b8', fontSize: '0.9em', marginBottom: '10px' }}>
                  Requested Quantity: <span style={{ color: '#fff', fontWeight: 'bold' }}>{r.requested_qty}</span>
                </div>
                {r.status === 'pending' && (
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button 
                      onClick={() => updateRequestStatus(r._id, 'approved')} 
                      style={{ flex: 1, backgroundColor: '#10b981', color: 'white', border: 'none', padding: '8px', borderRadius: '4px', cursor: 'pointer' }}
                    >Approve</button>
                    <button 
                      onClick={() => updateRequestStatus(r._id, 'rejected')} 
                      style={{ flex: 1, backgroundColor: '#f43f5e', color: 'white', border: 'none', padding: '8px', borderRadius: '4px', cursor: 'pointer' }}
                    >Reject</button>
                  </div>
                )}
              </li>
            ))}
            {requests.length === 0 && <li style={{ color: '#94a3b8' }}>No pending requests.</li>}
          </ul>
        </div>

      </div>
    </div>
  );
}
