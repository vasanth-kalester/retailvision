import React, { useState, useEffect } from 'react';
import { MapPin, Box, Plus, Trash2, ArrowRight } from 'lucide-react';

interface Product {
  sku: string;
  product_name: string;
}

export default function ZoneManagement() {
  const [zones, setZones] = useState<string[]>([]);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [zoneProducts, setZoneProducts] = useState<Record<string, string[]>>({});
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [newProductSku, setNewProductSku] = useState<string>('');
  const [newZoneName, setNewZoneName] = useState<string>('');

  useEffect(() => {
    fetchZones();
    fetchZoneProducts();
    fetchInventory();
  }, []);

  const fetchZones = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/zones');
      const data = await res.json();
      setZones(data.zones || []);
      if (data.zones && data.zones.length > 0) {
        setSelectedZone(data.zones[0]);
      }
    } catch (e) { console.error(e); }
  };

  const fetchZoneProducts = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/zones/products');
      const data = await res.json();
      setZoneProducts(data || {});
    } catch (e) { console.error(e); }
  };

  const fetchInventory = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/inventory/warehouse');
      const data = await res.json();
      setAllProducts(data.items || []);
    } catch (e) { console.error(e); }
  };

  const assignProduct = async () => {
    if (!selectedZone || !newProductSku) return;
    try {
      const res = await fetch('http://localhost:8000/api/zones/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zoneName: selectedZone, sku: newProductSku })
      });
      if (res.ok) {
        fetchZoneProducts();
        setNewProductSku('');
      }
    } catch (e) { console.error(e); }
  };

  const removeProduct = async (sku: string) => {
    if (!selectedZone) return;
    try {
      const res = await fetch(`http://localhost:8000/api/zones/products/${encodeURIComponent(selectedZone)}/${encodeURIComponent(sku)}`, {
        method: 'DELETE'
      });
      if (res.ok) fetchZoneProducts();
    } catch (e) { console.error(e); }
  };

  const currentZoneProducts = selectedZone ? (zoneProducts[selectedZone] || []) : [];

  const handleAddZone = () => {
    if (newZoneName.trim() && !zones.includes(newZoneName.trim())) {
      const added = newZoneName.trim();
      setZones([...zones, added]);
      setNewZoneName('');
      if (!selectedZone) setSelectedZone(added);
    }
  };

  const handleRemoveZone = (zoneToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newZones = zones.filter(z => z !== zoneToRemove);
    setZones(newZones);
    if (selectedZone === zoneToRemove) {
      setSelectedZone(newZones.length > 0 ? newZones[0] : null);
    }
  };

  return (
    <div style={{ paddingBottom: '2rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ background: 'var(--primary-blue)', color: 'white', padding: '0.5rem', borderRadius: 8 }}>
          <MapPin size={20} />
        </div>
        <div>
          <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.25rem', color: 'var(--text-primary)' }}>
            Zone Management
          </h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Map your physical store zones to specific product lines.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.5rem', flex: 1 }}>
        
        {/* Left Panel: Zone Selector */}
        <div className="panel" style={{ padding: '1rem' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Store Zones
          </h3>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <input 
              type="text" 
              value={newZoneName}
              onChange={(e) => setNewZoneName(e.target.value)}
              placeholder="New zone name..."
              style={{ flex: 1, padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border-strong)', fontSize: '0.85rem' }}
            />
            <button 
              className="btn-primary" 
              onClick={handleAddZone}
              disabled={!newZoneName.trim()}
              style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: newZoneName.trim() ? 1 : 0.5 }}
            >
              <Plus size={16} />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {zones.map(zone => (
              <button 
                key={zone}
                onClick={() => setSelectedZone(zone)}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.75rem 1rem', borderRadius: 8, cursor: 'pointer',
                  background: selectedZone === zone ? 'var(--primary-blue-light)' : 'transparent',
                  border: `1px solid ${selectedZone === zone ? 'var(--primary-blue)' : 'var(--border-light)'}`,
                  color: selectedZone === zone ? 'var(--primary-blue)' : 'var(--text-primary)',
                  fontWeight: selectedZone === zone ? 600 : 400,
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <MapPin size={16} />
                  {zone}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  {selectedZone === zone && <ArrowRight size={16} style={{ marginRight: '0.25rem' }} />}
                  <div 
                    onClick={(e) => handleRemoveZone(zone, e)}
                    style={{ color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.25rem', borderRadius: '4px' }}
                    title="Remove zone"
                  >
                    <Trash2 size={14} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right Panel: Product Management */}
        <div className="panel" style={{ padding: '1.5rem' }}>
          {selectedZone ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-light)' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                  Products in {selectedZone}
                </h3>
                
                {/* Assign Product Form */}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <select 
                    value={newProductSku}
                    onChange={(e) => setNewProductSku(e.target.value)}
                    style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border-strong)', fontSize: '0.85rem' }}
                  >
                    <option value="">-- Select Product --</option>
                    {allProducts.filter(p => !currentZoneProducts.includes(p.sku)).map(p => (
                      <option key={p.sku} value={p.sku}>{p.product_name} ({p.sku})</option>
                    ))}
                  </select>
                  <button 
                    className="btn-primary" 
                    onClick={assignProduct}
                    disabled={!newProductSku}
                    style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', opacity: newProductSku ? 1 : 0.5 }}
                  >
                    <Plus size={14} /> Assign
                  </button>
                </div>
              </div>

              {currentZoneProducts.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                  {currentZoneProducts.map(sku => {
                    const product = allProducts.find(p => p.sku === sku);
                    return (
                      <div key={sku} style={{ padding: '1rem', border: '1px solid var(--border-light)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ width: 36, height: 36, background: '#e2e8f0', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Box size={18} color="#64748b" />
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{product ? product.product_name : 'Unknown Product'}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{sku}</div>
                          </div>
                        </div>
                        <button 
                          onClick={() => removeProduct(sku)}
                          style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.5rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          title="Remove product"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)', background: '#f8fafc', borderRadius: 8, border: '1px dashed var(--border-strong)' }}>
                  <MapPin size={32} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                  <p style={{ margin: 0 }}>No products currently assigned to this zone.</p>
                  <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', opacity: 0.7 }}>Use the dropdown above to add products.</p>
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
              Select a zone from the left panel to manage its products.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
