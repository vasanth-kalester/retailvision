import React, { useState, useEffect } from 'react';

export default function InventoryDashboard() {
  const [storeInventory, setStoreInventory] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);

  const fetchData = async () => {
    try {
      const [invRes, reqRes, alertRes] = await Promise.all([
        fetch('http://localhost:8000/api/inventory/store/STORE_001'),
        fetch('http://localhost:8000/api/inventory/replenishment/requests?store_id=STORE_001'),
        fetch('http://localhost:8000/api/inventory/warehouse/alerts')
      ]);

      const invData = await invRes.json();
      const reqData = await reqRes.json();
      const alertData = await alertRes.json();

      setStoreInventory(invData.items || []);
      setRequests(reqData.requests || []);
      setAlerts(alertData.alerts || []);
    } catch (error) {
      console.error('Error fetching inventory data:', error);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Poll every 10s
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
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h2>Inventory Monitoring</h2>

      <div style={{ display: 'flex', gap: '20px' }}>
        <div style={{ flex: 1 }}>
          <h3>Store Stock (STORE_001)</h3>
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f0f0f0' }}>
                <th style={{ padding: '8px', border: '1px solid #ccc' }}>SKU</th>
                <th style={{ padding: '8px', border: '1px solid #ccc' }}>On-Hand</th>
              </tr>
            </thead>
            <tbody>
              {storeInventory.map((item, i) => (
                <tr key={i}>
                  <td style={{ padding: '8px', border: '1px solid #ccc' }}>{item.sku}</td>
                  <td style={{ padding: '8px', border: '1px solid #ccc', color: item.on_hand_units < 5 ? 'red' : 'black' }}>
                    {item.on_hand_units}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ flex: 1 }}>
          <h3>Replenishment Requests</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {requests.map((r, i) => (
              <li key={i} style={{ padding: '10px', border: '1px solid #ccc', marginBottom: '10px', borderRadius: '4px' }}>
                <strong>{r.sku}</strong> - Requested: {r.requested_qty} (Status: {r.status})
                {r.status === 'pending' && (
                  <div style={{ marginTop: '10px' }}>
                    <button onClick={() => updateRequestStatus(r._id, 'approved')} style={{ marginRight: '10px', backgroundColor: '#4caf50', color: 'white', border: 'none', padding: '5px 10px', cursor: 'pointer' }}>Approve</button>
                    <button onClick={() => updateRequestStatus(r._id, 'rejected')} style={{ backgroundColor: '#f44336', color: 'white', border: 'none', padding: '5px 10px', cursor: 'pointer' }}>Reject</button>
                  </div>
                )}
              </li>
            ))}
            {requests.length === 0 && <li>No pending requests.</li>}
          </ul>
        </div>

        <div style={{ flex: 1 }}>
          <h3>Warehouse Alerts</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {alerts.map((a, i) => (
              <li key={i} style={{ padding: '10px', border: '1px solid #f44336', backgroundColor: '#ffebee', marginBottom: '10px', borderRadius: '4px' }}>
                <strong>⚠️ {a.sku}</strong> - {a.alert_type.toUpperCase()} (Current units: {a.current_units})
              </li>
            ))}
            {alerts.length === 0 && <li>No warehouse alerts.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
