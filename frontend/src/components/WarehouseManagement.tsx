import React, { useState, useEffect } from 'react';
import { PackagePlus, AlertTriangle, Layers, Trash2 } from 'lucide-react';

interface Props {
  onBack?: () => void;
}

export default function WarehouseManagement({ onBack }: Props) {
  const [warehouseInventory, setWarehouseInventory] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [shelves, setShelves] = useState<any[]>([]);
  
  const [newProduct, setNewProduct] = useState({
    sku: '',
    product_name: '',
    total_units: 0,
    safety_stock: 20,
    reorder_point: 25
  });
  const [newShelfName, setNewShelfName] = useState('');

  const fetchData = async () => {
    try {
      const [invRes, alertRes, shelvesRes] = await Promise.all([
        fetch('http://localhost:8000/api/inventory/warehouse'),
        fetch('http://localhost:8000/api/inventory/warehouse/alerts'),
        fetch('http://localhost:8000/api/inventory/warehouse/shelves')
      ]);

      const invData = await invRes.json();
      const alertData = await alertRes.json();
      const shelvesData = await shelvesRes.json();

      setWarehouseInventory(invData.items || []);
      setAlerts(alertData.alerts || []);
      setShelves(shelvesData.shelves || []);
    } catch (error) {
      console.error('Error fetching warehouse data:', error);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('http://localhost:8000/api/inventory/warehouse/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: newProduct.sku,
          product_name: newProduct.product_name,
          total_units: Number(newProduct.total_units),
          safety_stock: Number(newProduct.safety_stock),
          reorder_point: Number(newProduct.reorder_point)
        })
      });
      setNewProduct({ sku: '', product_name: '', total_units: 0, safety_stock: 20, reorder_point: 25 });
      fetchData();
    } catch (error) {
      console.error('Error adding product:', error);
    }
  };

  const handleDeleteProduct = async (sku: string) => {
    if (!window.confirm(`Are you sure you want to delete product ${sku}? This will also unmap any associated shelves.`)) return;
    try {
      await fetch(`http://localhost:8000/api/inventory/warehouse/${sku}`, {
        method: 'DELETE'
      });
      fetchData();
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  };

  const handleAddShelf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShelfName) return;
    try {
      await fetch('http://localhost:8000/api/inventory/warehouse/shelves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shelf_name: newShelfName })
      });
      setNewShelfName('');
      fetchData();
    } catch (error) {
      console.error('Error adding shelf:', error);
    }
  };

  const handleDeleteShelf = async (shelfName: string) => {
    if (!window.confirm(`Are you sure you want to delete shelf ${shelfName}?`)) return;
    try {
      await fetch(`http://localhost:8000/api/inventory/warehouse/shelves/${shelfName}`, {
        method: 'DELETE'
      });
      fetchData();
    } catch (error) {
      console.error('Error deleting shelf:', error);
    }
  };

  const handleMapShelf = async (shelfName: string, sku: string) => {
    try {
      await fetch(`http://localhost:8000/api/inventory/warehouse/shelves/${shelfName}/map`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku: sku })
      });
      fetchData();
    } catch (error) {
      console.error('Error mapping shelf:', error);
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
          <h1 className="header-title">Warehouse Management</h1>
          <p className="header-subtitle">Manage global inventory, shelves, and fulfillment operations</p>
        </div>
      </header>

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        
        {/* Left Column: Alerts, Form & Shelves */}
        <div style={{ flex: '1', minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Alerts Card */}
          <div className="glass-card" style={{ padding: '20px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#f43f5e' }}>
              <AlertTriangle size={20} /> Warehouse Alerts
            </h3>
            <ul style={{ listStyle: 'none', padding: 0, marginTop: '10px' }}>
              {alerts.map((a, i) => (
                <li key={i} style={{ padding: '10px', border: '1px solid rgba(244, 63, 94, 0.5)', backgroundColor: 'rgba(244, 63, 94, 0.1)', marginBottom: '10px', borderRadius: '8px' }}>
                  <strong>{a.sku}</strong> - {a.alert_type.toUpperCase()} (Current units: {a.current_units})
                </li>
              ))}
              {alerts.length === 0 && <li style={{ color: '#94a3b8' }}>No active warehouse alerts.</li>}
            </ul>
          </div>

          {/* Add Product Form */}
          <div className="glass-card" style={{ padding: '20px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
              <PackagePlus size={20} color="#10b981" /> Receive New Inventory
            </h3>
            <form onSubmit={handleAddProduct} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input 
                type="text" 
                placeholder="SKU (e.g., SKU_100)" 
                required 
                value={newProduct.sku}
                onChange={e => setNewProduct({...newProduct, sku: e.target.value})}
                style={{ padding: '10px', borderRadius: '6px', border: '1px solid #334155', background: 'rgba(15, 23, 42, 0.6)', color: '#fff' }}
              />
              <input 
                type="text" 
                placeholder="Product Name" 
                required 
                value={newProduct.product_name}
                onChange={e => setNewProduct({...newProduct, product_name: e.target.value})}
                style={{ padding: '10px', borderRadius: '6px', border: '1px solid #334155', background: 'rgba(15, 23, 42, 0.6)', color: '#fff' }}
              />
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', color: '#94a3b8' }}>Total Units</label>
                  <input 
                    type="number" 
                    required 
                    min="0"
                    value={newProduct.total_units}
                    onChange={e => setNewProduct({...newProduct, total_units: parseInt(e.target.value) || 0})}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #334155', background: 'rgba(15, 23, 42, 0.6)', color: '#fff', marginTop: '4px' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', color: '#94a3b8' }}>Safety Stock</label>
                  <input 
                    type="number" 
                    required 
                    min="0"
                    value={newProduct.safety_stock}
                    onChange={e => setNewProduct({...newProduct, safety_stock: parseInt(e.target.value) || 0})}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #334155', background: 'rgba(15, 23, 42, 0.6)', color: '#fff', marginTop: '4px' }}
                  />
                </div>
              </div>
              <button type="submit" style={{ marginTop: '10px', padding: '12px', backgroundColor: '#6366f1', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                Add to Warehouse
              </button>
            </form>
          </div>
        </div>
        {/* Right Column: Inventory Table */}
        <div className="glass-card" style={{ flex: '2', minWidth: '400px', padding: '20px' }}>
          <h3 style={{ marginBottom: '15px' }}>Current Warehouse Stock</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                  <th style={{ padding: '12px 8px' }}>SKU</th>
                  <th style={{ padding: '12px 8px' }}>Product Name</th>
                  <th style={{ padding: '12px 8px' }}>Total Units</th>
                  <th style={{ padding: '12px 8px' }}>Safety Stock</th>
                  <th style={{ padding: '12px 8px' }}>Reorder Pt.</th>
                  <th style={{ padding: '12px 8px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {warehouseInventory.map((item, i) => {
                  const isLow = item.total_units <= item.reorder_point;
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.5)' }}>
                      <td style={{ padding: '12px 8px', fontWeight: 'bold' }}>{item.sku}</td>
                      <td style={{ padding: '12px 8px' }}>{item.product_name}</td>
                      <td style={{ padding: '12px 8px', color: isLow ? '#f43f5e' : '#10b981', fontWeight: 'bold' }}>
                        {item.total_units}
                      </td>
                      <td style={{ padding: '12px 8px' }}>{item.safety_stock}</td>
                      <td style={{ padding: '12px 8px' }}>{item.reorder_point}</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                        <button 
                          onClick={() => handleDeleteProduct(item.sku)}
                          style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', color: '#f43f5e', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
                        >
                          <Trash2 size={14} /> Remove
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {warehouseInventory.length === 0 && <p style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>No items in warehouse.</p>}
          </div>
        </div>

      </div>
    
      {/* Shelves Management - Full Width Section */}
      <div className="glass-card" style={{ marginTop: '20px', padding: '25px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
            <Layers size={22} color="#8b5cf6" /> Warehouse Shelves & Mapping
          </h3>
          <form onSubmit={handleAddShelf} style={{ display: 'flex', gap: '10px' }}>
            <input 
              type="text" 
              placeholder="Shelf Name (e.g. A1, Rack-B)" 
              required 
              value={newShelfName}
              onChange={e => setNewShelfName(e.target.value)}
              style={{ width: '250px', padding: '10px', borderRadius: '8px', border: '1px solid #475569', background: 'rgba(15, 23, 42, 0.6)', color: '#fff' }}
            />
            <button type="submit" style={{ padding: '10px 20px', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PackagePlus size={16} /> Add Shelf
            </button>
          </form>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
          {shelves.map((shelf, i) => (
            <div key={i} style={{ padding: '20px', border: '1px solid #334155', backgroundColor: 'rgba(15, 23, 42, 0.4)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '15px', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '1.2rem', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={18} color="#8b5cf6" />
                  {shelf.shelf_name}
                </strong>
                <button onClick={() => handleDeleteShelf(shelf.shelf_name)} style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', color: '#f43f5e', cursor: 'pointer', padding: '6px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Trash2 size={16} />
                </button>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Mapped Product SKU</label>
                <select 
                  value={shelf.sku || ""} 
                  onChange={e => handleMapShelf(shelf.shelf_name, e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #475569', background: '#1e293b', color: '#fff', outline: 'none' }}
                >
                  <option value="">-- Empty (Unmapped) --</option>
                  {warehouseInventory.map(item => (
                    <option key={item.sku} value={item.sku}>{item.sku} - {item.product_name}</option>
                  ))}
                </select>
              </div>
              
              {shelf.sku && (
                <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '0.85rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10b981' }} />
                  Active tracking enabled for this product
                </div>
              )}
              {!shelf.sku && (
                <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '0.85rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#64748b' }} />
                  No product assigned
                </div>
              )}
            </div>
          ))}
          {shelves.length === 0 && (
            <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: '#94a3b8', border: '1px dashed #475569', borderRadius: '12px' }}>
              <Layers size={36} color="#475569" style={{ margin: '0 auto 15px' }} />
              <h3>No shelves configured yet</h3>
              <p>Add your first shelf using the form above to start mapping products.</p>
            </div>
          )}
        </div>
      </div>
</div>
  );
}
