import { useState, useEffect } from 'react';
import { Database, AlertTriangle, CheckCircle2, TrendingUp, PackageOpen, ServerCrash, RefreshCcw, LayoutTemplate, Video, PackagePlus, Layers, Trash2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Cell, Legend } from 'recharts';


export default function PosInventory() {
  const [stockAlerts, setStockAlerts] = useState<any[]>([]);
  const [warehouseInventory, setWarehouseInventory] = useState<any[]>([]);
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
      const [invRes, shelvesRes, alertsRes] = await Promise.all([
        fetch('http://localhost:8000/api/inventory/warehouse'),
        fetch('http://localhost:8000/api/inventory/warehouse/shelves'),
        fetch('http://localhost:8000/api/inventory/warehouse/alerts').catch(() => null)
      ]);
      const invData = await invRes.json();
      const shelvesData = await shelvesRes.json();
      setWarehouseInventory(invData.items || []);
      setShelves(shelvesData.shelves || []);
      if (alertsRes && alertsRes.ok) {
        const alertsData = await alertsRes.json();
        setStockAlerts(alertsData.alerts || []);
      }
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
    <div style={{ paddingBottom: '2rem' }}>
      {/* Top Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--primary-blue-light)', color: 'var(--primary-blue)', padding: '0.4rem 0.75rem', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary-blue)' }} />
            REAL-TIME SYNTHESIS PIPELINE
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Pipeline Sync: Latency 82ms • Sub-second Triangulation
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn-primary" style={{ background: '#f1f5f9', color: 'var(--text-primary)', border: '1px solid var(--border-strong)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <RefreshCcw size={14} /> Reconciled: 4,892 SKUs
          </button>
          <button className="btn-primary" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <RefreshCcw size={14} /> Force Run Cycle
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.5rem', color: 'var(--text-primary)' }}>POS & Inventory Triangulation</h2>
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Autonomous alignment of computer-vision shelf telemetry with real-time checkout streams and SAP/Oracle ERP stock levels to eliminate ghost inventory and preserve operating margins.</p>
      </div>

      {/* KPI Strip */}
      <div className="kpi-strip">
        <div className="kpi-card" style={{ borderTop: '3px solid var(--alert-red)' }}>
          <div className="kpi-label" style={{ color: 'var(--alert-red)' }}>Phantom Stock Discrepancies <ServerCrash size={14} color="var(--alert-red)" /></div>
          <div className="kpi-value" style={{ color: 'var(--alert-red)' }}>{stockAlerts.length} <span style={{ fontSize: '0.9rem', color: 'var(--alert-red)', fontWeight: 600 }}>Active SKUs</span></div>
          <div className="kpi-subtext" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
            {stockAlerts.length > 0 ? (
              <span style={{ color: 'var(--alert-red)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.2rem' }}><AlertTriangle size={12}/> Discrepancies Detected</span>
            ) : (
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>All Clear</span>
            )}
          </div>
        </div>
        
        <div className="kpi-card" style={{ borderTop: '3px solid var(--primary-blue)' }}>
          <div className="kpi-label">Rapid Depletion Velocity <TrendingUp size={14} color="var(--primary-blue)" /></div>
          <div className="kpi-value">0 <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Critical Lines</span></div>
          <div className="kpi-subtext" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Normal Velocity</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">High Dwell / Low Conversion <LayoutTemplate size={14} color="var(--text-secondary)" /></div>
          <div className="kpi-value">0 <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Display Endcaps</span></div>
          <div className="kpi-subtext" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>No Action Needed</span>
          </div>
        </div>

        <div className="kpi-card" style={{ borderTop: '3px solid var(--success-green)' }}>
          <div className="kpi-label">Triangulation Confidence <CheckCircle2 size={14} color="var(--success-green)" /></div>
          <div className="kpi-value">{stockAlerts.length === 0 ? '100%' : '98.4%'} <span style={{ fontSize: '0.9rem', color: 'var(--primary-blue)', fontWeight: 600 }}>Real-time</span></div>
          <div className="kpi-subtext" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
            <span style={{ color: 'var(--success-green)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.2rem' }}><CheckCircle2 size={12}/> Automated Recon</span>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Cycle Count Repl.</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', alignItems: 'center', letterSpacing: '0.05em' }}>
        REAL-TIME CORE ARCHITECTURE FLOW <span style={{ flex: 1 }} /> Formula: DETECT + RECORD + RECONCILE → ACTION
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        {['DETECT (Computer Vision)\n18 RTSP Feeds @ 30 FPS', 'RECORD (POS Checkout Stream)\nWebSocket Queue & Basket...', 'RECONCILE (Warehouse ERP)\nSAP/Oracle Periodic Batch...', 'OPERATIONAL ACTION\nAudits, Tasks & Pricing Rev...'].map((s, i) => (
          <div key={i} style={{ background: 'var(--primary-blue-light)', border: '1px solid var(--primary-blue-border)', borderRadius: 8, padding: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <div style={{ width: 32, height: 32, background: 'var(--primary-blue)', color: 'white', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>0{i+1}</div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary-blue)', whiteSpace: 'pre-line' }}>{s}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        {/* Left Column: Action Matrix & Charts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div className="panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <div>
                <h3 className="panel-title">Unified Action Matrix</h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Triangulated triggers prioritized by operational severity</p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {['Phantom Stock (3)', 'Velocity Depletion (5)', 'High Dwell/Low Sale (2)', 'Audit Ledger'].map((t, i) => (
                   <span key={t} style={{ background: i === 0 ? 'var(--primary-blue-light)' : '#f8fafc', color: i === 0 ? 'var(--primary-blue)' : 'var(--text-secondary)', padding: '0.4rem 0.75rem', borderRadius: 6, fontSize: '0.7rem', fontWeight: 700, border: `1px solid ${i === 0 ? 'var(--primary-blue-border)' : 'var(--border-light)'}`, cursor: 'pointer' }}>{t}</span>
                ))}
              </div>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 50 }}></th>
                  <th>ITEM &amp; LOCATION</th>
                  <th style={{ textAlign: 'center' }}>ERP COUNT</th>
                  <th style={{ textAlign: 'center' }}>CV SHELF COUNT</th>
                  <th style={{ textAlign: 'center' }}>POS SOLD (3H)</th>
                  <th>CONDITION</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {stockAlerts.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No active discrepancies detected.</td>
                  </tr>
                ) : (
                  stockAlerts.map((alert: any) => (
                    <tr key={alert._id}>
                      <td><div style={{ background: 'var(--primary-blue-light)', color: 'var(--primary-blue)', padding: '0.2rem 0.4rem', borderRadius: 4, fontSize: '0.7rem', fontWeight: 800, textAlign: 'center' }}>-</div></td>
                      <td>
                        <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>{alert.sku}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Alert ID: {alert._id.slice(-6)}</div>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 800 }}>-</td>
                      <td style={{ textAlign: 'center', fontWeight: 800, color: 'var(--alert-red)' }}>{alert.current_units}</td>
                      <td style={{ textAlign: 'center', fontWeight: 800 }}>-</td>
                      <td><span style={{ background: 'var(--alert-red-light)', color: 'var(--alert-red)', padding: '0.2rem 0.5rem', borderRadius: 4, fontSize: '0.7rem', fontWeight: 700 }}>● {alert.alert_type}</span></td>
                      <td><button className="btn-primary">Trigger Audit</button></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h3 className="panel-title">Hourly Triangulated Run-Rates</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>All Aisles Cumulative • Window 08:00 - 15:00</span>
            </div>
            
            <div style={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Insufficient telemetry data to calculate run-rates.
            </div>
          </div>
        </div>

        {/* Right Column: Deep Dive */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="panel" style={{ padding: '1.5rem' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>PRODUCT DEEP-DIVE TELEMETRY</span>
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
              Select a discrepancy from the matrix to view deep-dive telemetry.
            </div>
          </div>
        </div>
      </div>

      {/* Warehouse Management & Operations */}
      <div style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid var(--border-light)' }}>
        <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.5rem', color: 'var(--text-primary)' }}>Warehouse Management &amp; Operations</h2>
        <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Manage global inventory, shelves, and fulfillment operations</p>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
          {/* Add Product Form */}
          <div className="panel" style={{ padding: '1.5rem' }}>
            <h3 className="panel-title" style={{ marginBottom: '1rem' }}>
              <PackagePlus size={16} color="var(--success-green)" /> Receive New Inventory
            </h3>
            <form onSubmit={handleAddProduct} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input 
                type="text" placeholder="SKU (e.g., SKU_100)" required 
                value={newProduct.sku} onChange={e => setNewProduct({...newProduct, sku: e.target.value})}
                style={{ padding: '0.75rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--bg-app)', color: 'var(--text-primary)' }}
              />
              <input 
                type="text" placeholder="Product Name" required 
                value={newProduct.product_name} onChange={e => setNewProduct({...newProduct, product_name: e.target.value})}
                style={{ padding: '0.75rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--bg-app)', color: 'var(--text-primary)' }}
              />
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Total Units</label>
                  <input type="number" required min="0"
                    value={newProduct.total_units} onChange={e => setNewProduct({...newProduct, total_units: parseInt(e.target.value) || 0})}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--bg-app)', marginTop: '0.25rem' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Safety Stock</label>
                  <input type="number" required min="0"
                    value={newProduct.safety_stock} onChange={e => setNewProduct({...newProduct, safety_stock: parseInt(e.target.value) || 0})}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--bg-app)', marginTop: '0.25rem' }}
                  />
                </div>
              </div>
              <button type="submit" className="btn-primary" style={{ marginTop: '0.5rem', background: 'var(--success-green)' }}>
                Add to Warehouse
              </button>
            </form>
          </div>

          {/* Current Stock Table */}
          <div className="panel" style={{ padding: '1.5rem' }}>
            <h3 className="panel-title" style={{ marginBottom: '1rem' }}>Current Warehouse Stock</h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Product Name</th>
                    <th>Total Units</th>
                    <th>Safety Stock</th>
                    <th>Reorder Pt.</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {warehouseInventory.map((item, i) => {
                    const isLow = item.total_units <= item.reorder_point;
                    return (
                      <tr key={i}>
                        <td style={{ fontWeight: 800 }}>{item.sku}</td>
                        <td>{item.product_name}</td>
                        <td style={{ color: isLow ? 'var(--alert-red)' : 'var(--success-green)', fontWeight: 800 }}>
                          {item.total_units}
                        </td>
                        <td>{item.safety_stock}</td>
                        <td>{item.reorder_point}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button onClick={() => handleDeleteProduct(item.sku)} className="btn-primary" style={{ background: 'var(--alert-red-light)', color: 'var(--alert-red)', padding: '0.25rem 0.5rem', border: '1px solid var(--alert-red-border)' }}>
                            <Trash2 size={14} style={{ verticalAlign: 'middle' }} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {warehouseInventory.length === 0 && <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No items in warehouse.</p>}
            </div>
          </div>
        </div>

        {/* Shelves & Mapping */}
        <div className="panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 className="panel-title">
              <Layers size={18} color="var(--primary-blue)" /> Warehouse Shelves & Mapping
            </h3>
            <form onSubmit={handleAddShelf} style={{ display: 'flex', gap: '0.75rem' }}>
              <input type="text" placeholder="Shelf Name (e.g. A1)" required 
                value={newShelfName} onChange={e => setNewShelfName(e.target.value)}
                style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--bg-app)', outline: 'none' }}
              />
              <button type="submit" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <PackagePlus size={14} /> Add Shelf
              </button>
            </form>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
            {shelves.map((shelf, i) => (
              <div key={i} style={{ padding: '1rem', border: '1px solid var(--border-light)', background: '#f8fafc', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Layers size={14} color="var(--primary-blue)" /> {shelf.shelf_name}
                  </strong>
                  <button onClick={() => handleDeleteShelf(shelf.shelf_name)} style={{ background: 'var(--alert-red-light)', border: 'none', color: 'var(--alert-red)', cursor: 'pointer', padding: '0.25rem', borderRadius: 4 }}>
                    <Trash2 size={14} />
                  </button>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Mapped Product SKU</label>
                  <select 
                    value={shelf.sku || ""} onChange={e => handleMapShelf(shelf.shelf_name, e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'white', color: 'var(--text-primary)', outline: 'none', fontSize: '0.8rem' }}
                  >
                    <option value="">-- Empty (Unmapped) --</option>
                    {warehouseInventory.map(item => (
                      <option key={item.sku} value={item.sku}>{item.sku} - {item.product_name}</option>
                    ))}
                  </select>
                </div>
                
                {shelf.sku ? (
                  <div style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid var(--border-light)', fontSize: '0.75rem', color: 'var(--success-green)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--success-green)' }} /> Active tracking enabled
                  </div>
                ) : (
                  <div style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid var(--border-light)', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--text-muted)' }} /> No product assigned
                  </div>
                )}
              </div>
            ))}
            {shelves.length === 0 && (
              <div style={{ gridColumn: '1 / -1', padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-strong)', borderRadius: 8 }}>
                <Layers size={24} color="var(--border-strong)" style={{ margin: '0 auto 0.5rem' }} />
                <h4 style={{ margin: 0 }}>No shelves configured</h4>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
