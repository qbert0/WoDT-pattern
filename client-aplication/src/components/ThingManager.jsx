import React, { useState, useEffect } from 'react';
import { DITTO_API_BASE_URL as BASE_URL, DITTO_AUTHORIZATION } from '../config';

const headers = (extra = {}) => ({
  'Authorization': DITTO_AUTHORIZATION,
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  ...extra,
});

// ---------- Sub-panel: Attributes ----------
const AttributePanel = ({ thingId, onClose }) => {
  const [attrs, setAttrs] = useState('{}');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${BASE_URL}/things/${thingId}/attributes`, { headers: headers() })
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(data => setAttrs(JSON.stringify(data, null, 2)))
      .catch(() => setAttrs('{}'))
      .finally(() => setLoading(false));
  }, [thingId]);

  const save = async () => {
    setError(null);
    try {
      const parsed = JSON.parse(attrs);
      const r = await fetch(`${BASE_URL}/things/${thingId}/attributes`, {
        method: 'PUT', headers: headers(), body: JSON.stringify(parsed)
      });
      if (!r.ok && r.status !== 204) throw new Error(r.statusText);
      onClose();
    } catch (e) { setError(e.message); }
  };

  const deleteAttr = async (path) => {
    await fetch(`${BASE_URL}/things/${thingId}/attributes/${path}`, {
      method: 'DELETE', headers: headers()
    });
    setAttrs(prev => {
      try {
        const obj = JSON.parse(prev);
        delete obj[path];
        return JSON.stringify(obj, null, 2);
      } catch { return prev; }
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-panel" style={{ background: 'var(--bg-dark)', maxWidth: 540 }}>
        <div className="modal-header">
          <h3 className="modal-title">Attributes — {thingId}</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</div>}
        {loading ? <p style={{ color: 'var(--text-muted)' }}>Loading…</p> : (
          <>
            <div className="form-group">
              <label>Attributes JSON (PUT all)</label>
              <textarea name="attrs" value={attrs} onChange={e => setAttrs(e.target.value)} rows={10} style={{ fontFamily: 'monospace' }} />
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn" style={{ flex: 1, background: 'rgba(255,255,255,0.1)' }} onClick={onClose}>Cancel</button>
              <button className="btn btn-success" style={{ flex: 2 }} onClick={save}>Save Attributes</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ---------- Sub-panel: Features ----------
const FeaturePanel = ({ thingId, onClose }) => {
  const [features, setFeatures] = useState('{}');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${BASE_URL}/things/${thingId}/features`, { headers: headers() })
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(data => setFeatures(JSON.stringify(data, null, 2)))
      .catch(() => setFeatures('{}'))
      .finally(() => setLoading(false));
  }, [thingId]);

  const save = async () => {
    setError(null);
    try {
      const parsed = JSON.parse(features);
      const r = await fetch(`${BASE_URL}/things/${thingId}/features`, {
        method: 'PUT', headers: headers(), body: JSON.stringify(parsed)
      });
      if (!r.ok && r.status !== 204) throw new Error(r.statusText);
      onClose();
    } catch (e) { setError(e.message); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-panel" style={{ background: 'var(--bg-dark)', maxWidth: 600 }}>
        <div className="modal-header">
          <h3 className="modal-title">Features — {thingId}</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</div>}
        {loading ? <p style={{ color: 'var(--text-muted)' }}>Loading…</p> : (
          <>
            <div className="form-group">
              <label>Features JSON (PUT all)</label>
              <textarea value={features} onChange={e => setFeatures(e.target.value)} rows={14} style={{ fontFamily: 'monospace' }} />
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn" style={{ flex: 1, background: 'rgba(255,255,255,0.1)' }} onClick={onClose}>Cancel</button>
              <button className="btn btn-success" style={{ flex: 2 }} onClick={save}>Save Features</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ---------- Sub-panel: Send Message ----------
const MessagePanel = ({ thingId, onClose }) => {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('{}');
  const [featureId, setFeatureId] = useState('');
  const [direction, setDirection] = useState('inbox');
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);

  const send = async (e) => {
    e.preventDefault();
    setError(null);
    setStatus(null);
    try {
      const url = featureId
        ? `${BASE_URL}/things/${thingId}/features/${featureId}/${direction}/messages/${subject}`
        : `${BASE_URL}/things/${thingId}/${direction}/messages/${subject}`;
      const r = await fetch(url, {
        method: 'POST',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body
      });
      setStatus(`HTTP ${r.status} — ${r.ok ? 'Message sent' : 'Failed: ' + r.statusText}`);
    } catch (e) { setError(e.message); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-panel" style={{ background: 'var(--bg-dark)', maxWidth: 540 }}>
        <div className="modal-header">
          <h3 className="modal-title">Send Message — {thingId}</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</div>}
        {status && <div style={{ color: 'var(--success)', marginBottom: '1rem' }}>{status}</div>}
        <form onSubmit={send}>
          <div className="form-group">
            <label>Direction</label>
            <select value={direction} onChange={e => setDirection(e.target.value)}>
              <option value="inbox">inbox (TO thing)</option>
              <option value="outbox">outbox (FROM thing)</option>
            </select>
          </div>
          <div className="form-group">
            <label>Message Subject</label>
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. heatUp" required />
          </div>
          <div className="form-group">
            <label>Feature ID (optional)</label>
            <input value={featureId} onChange={e => setFeatureId(e.target.value)} placeholder="e.g. temperature" />
          </div>
          <div className="form-group">
            <label>Body (JSON)</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={5} style={{ fontFamily: 'monospace' }} />
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button type="button" className="btn" style={{ flex: 1, background: 'rgba(255,255,255,0.1)' }} onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>Send Message</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ---------- Main ThingManager ----------
const ThingManager = () => {
  const [things, setThings] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [subPanel, setSubPanel] = useState(null); // { type: 'attrs'|'features'|'messages', thingId }
  const [formData, setFormData] = useState({
    thingId: '', policyId: 'org.eclipse.ditto:default', definition: '', attributes: '{}'
  });

  const fetchThings = async () => {
    setIsLoading(true); setError(null);
    try {
      const r = await fetch(`${BASE_URL}/things`, { headers: headers() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setThings(data.items ?? (Array.isArray(data) ? data : []));
    } catch (e) { setError('Failed to fetch Things: ' + e.message); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { fetchThings(); }, []);

  const handleInputChange = e => setFormData(p => ({ ...p, [e.target.name]: e.target.value }));

  const submitThing = async (e) => {
    e.preventDefault(); setError(null);
    try {
      const { thingId, policyId, definition, attributes } = formData;
      const attrsParsed = attributes ? JSON.parse(attributes) : undefined;
      if (modalMode === 'add' && !thingId) throw new Error('Thing ID required');

      let payload = { policyId };
      if (definition) payload.definition = definition;
      if (attrsParsed && Object.keys(attrsParsed).length) payload.attributes = attrsParsed;

      // Use POST (auto-ID) not applicable since user specifies ID → use PUT
      const url = `${BASE_URL}/things/${thingId}`;
      const r = await fetch(url, { method: 'PUT', headers: headers(), body: JSON.stringify(payload) });
      if (!r.ok && r.status !== 201 && r.status !== 204) throw new Error(`HTTP ${r.status} — ${r.statusText}`);
      setIsModalOpen(false);
      fetchThings();
    } catch (e) { setError(e.message); }
  };

  const deleteThing = async (thingId) => {
    if (!window.confirm(`Delete ${thingId}?`)) return;
    try {
      const r = await fetch(`${BASE_URL}/things/${thingId}`, { method: 'DELETE', headers: headers() });
      if (!r.ok) throw new Error('Delete failed');
      fetchThings();
    } catch (e) { setError(e.message); }
  };

  const openAddModal = () => {
    setFormData({ thingId: 'org.digitaltwin:device_', policyId: 'org.eclipse.ditto:default', definition: '', attributes: '{}' });
    setModalMode('add'); setIsModalOpen(true);
  };

  const openEditModal = (thing) => {
    setFormData({
      thingId: thing.thingId,
      policyId: thing.policyId || '',
      definition: thing.definition || '',
      attributes: JSON.stringify(thing.attributes || {}, null, 2)
    });
    setModalMode('edit'); setIsModalOpen(true);
  };

  return (
    <div>
      <div className="header">
        <h1>Digital Twins (Things)</h1>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn" style={{ background: 'rgba(255,255,255,0.1)' }} onClick={fetchThings}>↻ Refresh</button>
          <button className="btn btn-primary" onClick={openAddModal}>+ Create Thing</button>
        </div>
      </div>

      {error && <div style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid var(--danger)', color: '#fca5a5', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>{error}</div>}

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading…</div>
      ) : (
        <div className="card-grid">
          {things.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              No Things found. Create your first Digital Twin!
            </div>
          ) : things.map(thing => (
            <div key={thing.thingId} className="dt-card glass-panel">
              <div style={{ marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--primary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>thingId</div>
                <div className="dt-title" style={{ fontSize: '1rem' }}>{thing.thingId}</div>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {thing.policyId && <span><b>Policy:</b> {thing.policyId}</span>}
                {thing.definition && <span><b>Definition:</b> {thing.definition}</span>}
                {thing.attributes && <span><b>Attributes:</b> {Object.keys(thing.attributes).join(', ')}</span>}
              </div>

              {/* Sub-actions */}
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                {[['Attributes', 'attrs'], ['Features', 'features'], ['Message', 'messages']].map(([label, type]) => (
                  <button key={type} className="btn" style={{ fontSize: '0.78rem', padding: '4px 10px', background: 'rgba(59,130,246,0.15)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.3)' }}
                    onClick={() => setSubPanel({ type, thingId: thing.thingId })}>
                    {label}
                  </button>
                ))}
              </div>

              <div className="dt-actions" style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => openEditModal(thing)}>Edit</button>
                <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => deleteThing(thing.thingId)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ background: 'var(--bg-dark)' }}>
            <div className="modal-header">
              <h3 className="modal-title">{modalMode === 'add' ? 'Create Thing' : 'Update Thing'}</h3>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}>✕</button>
            </div>
            {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</div>}
            <form onSubmit={submitThing}>
              <div className="form-group">
                <label>Thing ID <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>(namespace:name)</span></label>
                <input type="text" name="thingId" value={formData.thingId} onChange={handleInputChange} placeholder="e.g. org.example:myDevice" disabled={modalMode === 'edit'} required />
              </div>
              <div className="form-group">
                <label>Policy ID</label>
                <input type="text" name="policyId" value={formData.policyId} onChange={handleInputChange} placeholder="e.g. org.eclipse.ditto:default" required />
              </div>
              <div className="form-group">
                <label>Definition <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>(optional WoT/TM URL)</span></label>
                <input type="text" name="definition" value={formData.definition} onChange={handleInputChange} placeholder="e.g. https://example.com/thing-model.json" />
              </div>
              <div className="form-group">
                <label>Attributes <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>(JSON object)</span></label>
                <textarea name="attributes" value={formData.attributes} onChange={handleInputChange} rows={5} style={{ fontFamily: 'monospace' }} />
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn" style={{ flex: 1, background: 'rgba(255,255,255,0.1)' }} onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-success" style={{ flex: 2 }}>{modalMode === 'add' ? 'Create' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sub-panels */}
      {subPanel?.type === 'attrs' && <AttributePanel thingId={subPanel.thingId} onClose={() => setSubPanel(null)} />}
      {subPanel?.type === 'features' && <FeaturePanel thingId={subPanel.thingId} onClose={() => setSubPanel(null)} />}
      {subPanel?.type === 'messages' && <MessagePanel thingId={subPanel.thingId} onClose={() => setSubPanel(null)} />}
    </div>
  );
};

export default ThingManager;
