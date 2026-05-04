import React, { useState, useEffect } from 'react';

const BASE_URL = 'http://35.240.154.27:8080/api/2';
// /api/2/connections bypasses nginx htpasswd (no auth_basic in nginx.conf)
// and goes directly to Ditto gateway → requires Ditto internal devops credentials
const DEVOPS_AUTH = btoa('devops:foobar');

const headers = (extra = {}) => ({
  'Authorization': `Basic ${DEVOPS_AUTH}`,
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  ...extra,
});

const STATUS_COLOR = (s) => ({
  open: 'var(--success)', closed: 'var(--danger)', failed: '#f59e0b'
})[s] ?? 'var(--text-muted)';

// ---------- Connection Detail/Info Viewer ----------
const ConnectionInfoPanel = ({ connId, onClose }) => {
  const [tab, setTab] = useState('status'); // status | metrics | logs
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cmdInput, setCmdInput] = useState('OPEN');
  const [cmdResult, setCmdResult] = useState(null);

  const loadTab = async (t) => {
    setTab(t); setData(null); setLoading(true);
    try {
      const r = await fetch(`${BASE_URL}/connections/${connId}/${t}`, { headers: headers() });
      const json = r.ok ? await r.json() : { error: `HTTP ${r.status}` };
      setData(json);
    } catch (e) { setData({ error: e.message }); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadTab('status'); }, [connId]);

  const sendCommand = async () => {
    setCmdResult(null);
    try {
      const r = await fetch(`${BASE_URL}/connections/${connId}/command`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ targetActorSelection: '/system/sharding/connection', headers: {}, piggybackCommand: { type: `connectivity.commands:${cmdInput.toLowerCase()}Connection` } })
      });
      setCmdResult(`HTTP ${r.status} — ${r.ok ? 'Command sent' : r.statusText}`);
    } catch (e) { setCmdResult(`Error: ${e.message}`); }
  };

  const TABS = [['status', 'Status'], ['metrics', 'Metrics'], ['logs', 'Logs']];

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-panel" style={{ background: 'var(--bg-dark)', maxWidth: 680 }}>
        <div className="modal-header">
          <h3 className="modal-title">Connection: {connId}</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          {TABS.map(([key, label]) => (
            <button key={key} className="btn" onClick={() => loadTab(key)}
              style={{ padding: '6px 14px', fontSize: '0.85rem', background: tab === key ? 'var(--primary)' : 'rgba(255,255,255,0.08)', color: tab === key ? '#fff' : 'var(--text-muted)' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? <p style={{ color: 'var(--text-muted)' }}>Loading…</p> : (
          <pre style={{ background: 'rgba(0,0,0,0.4)', borderRadius: '8px', padding: '1rem', maxHeight: '280px', overflow: 'auto', color: '#c7d2fe', fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(data, null, 2)}
          </pre>
        )}

        {/* Send Command */}
        <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
          <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Send Command</div>
          {cmdResult && <div style={{ color: 'var(--success)', marginBottom: '0.5rem', fontSize: '0.85rem' }}>{cmdResult}</div>}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <select value={cmdInput} onChange={e => setCmdInput(e.target.value)} style={{ flex: 1 }}>
              <option value="open">OPEN</option>
              <option value="close">CLOSE</option>
              <option value="enableConnectionLogs">ENABLE LOGS</option>
              <option value="disableConnectionLogs">DISABLE LOGS</option>
              <option value="resetConnectionMetrics">RESET METRICS</option>
            </select>
            <button className="btn btn-primary" onClick={sendCommand}>Send</button>
          </div>
        </div>

        <button className="btn" style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.1)', width: '100%' }} onClick={onClose}>Close</button>
      </div>
    </div>
  );
};

// ---------- Create/Edit Connection Modal ----------
const ConnectionForm = ({ existing, onClose, onSaved }) => {
  const isEdit = !!existing;
  const [form, setForm] = useState(existing ? {
    id: existing.id,
    name: existing.name || '',
    connectionType: existing.connectionType || 'mqtt',
    connectionStatus: existing.connectionStatus || 'open',
    uri: existing.uri || '',
    sources: JSON.stringify(existing.sources || [], null, 2),
    targets: JSON.stringify(existing.targets || [], null, 2)
  } : {
    id: 'mqtt-connection-1',
    name: 'MQTT Integration',
    connectionType: 'mqtt',
    connectionStatus: 'open',
    uri: 'tcp://mqtt-broker:1883',
    sources: '[\n  {\n    "addresses": ["dt/+/telemetry"],\n    "authorizationContext": ["nginx:ditto"],\n    "qos": 0,\n    "filters": []\n  }\n]',
    targets: '[\n  {\n    "address": "dt/{{thing:id}}/commands",\n    "topics": ["_/_/things/twin/events", "_/_/things/live/messages"],\n    "authorizationContext": ["nginx:ditto"],\n    "qos": 0\n  }\n]'
  });
  const [error, setError] = useState(null);

  const h = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault(); setError(null);
    try {
      const payload = {
        id: form.id, name: form.name, connectionType: form.connectionType,
        connectionStatus: form.connectionStatus, uri: form.uri,
        sources: JSON.parse(form.sources || '[]'),
        targets: JSON.parse(form.targets || '[]')
      };
      // Ditto: POST to /connections (new), PUT to /connections/{id} (update)
      const url = isEdit ? `${BASE_URL}/connections/${form.id}` : `${BASE_URL}/connections`;
      const method = isEdit ? 'PUT' : 'POST';
      if (!isEdit) delete payload.id; // for POST, id can be set in body or auto-assigned
      if (!isEdit) payload.id = form.id; // actually include id so it's deterministic

      const r = await fetch(url, { method, headers: headers(), body: JSON.stringify(payload) });
      if (!r.ok && r.status !== 201 && r.status !== 204) throw new Error(`HTTP ${r.status} — ${r.statusText}`);
      onSaved();
      onClose();
    } catch (e) { setError(e.message); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-panel" style={{ background: 'var(--bg-dark)', maxWidth: 620 }}>
        <div className="modal-header">
          <h3 className="modal-title">{isEdit ? 'Edit Connection' : 'Create Connection'}</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</div>}
        <form onSubmit={submit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Connection ID</label>
              <input name="id" value={form.id} onChange={h} disabled={isEdit} required />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Name</label>
              <input name="name" value={form.name} onChange={h} required />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem', marginTop: '1rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Type</label>
              <select name="connectionType" value={form.connectionType} onChange={h}>
                <option value="mqtt">MQTT 3.1.1</option>
                <option value="mqtt-5">MQTT 5</option>
                <option value="amqp-10">AMQP 1.0</option>
                <option value="amqp-091">AMQP 0.9.1</option>
                <option value="http-push">HTTP Push</option>
                <option value="kafka">Kafka</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>URI</label>
              <input name="uri" value={form.uri} onChange={h} placeholder="tcp://host:port" required />
            </div>
          </div>
          <div style={{ marginTop: '1rem' }}>
            <div className="form-group">
              <label>Sources <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>(JSON array)</span></label>
              <textarea name="sources" value={form.sources} onChange={h} rows={5} style={{ fontFamily: 'monospace' }} />
            </div>
            <div className="form-group">
              <label>Targets <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>(JSON array)</span></label>
              <textarea name="targets" value={form.targets} onChange={h} rows={5} style={{ fontFamily: 'monospace' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button type="button" className="btn" style={{ flex: 1, background: 'rgba(255,255,255,0.1)' }} onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-success" style={{ flex: 2 }}>{isEdit ? 'Save' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ---------- Main ConnectionManager ----------
const ConnectionManager = () => {
  const [connections, setConnections] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [infoPanel, setInfoPanel] = useState(null);   // connId
  const [formPanel, setFormPanel] = useState(null);   // null | 'create' | {existing}

  const fetchConnections = async () => {
    setIsLoading(true); setError(null);
    try {
      const r = await fetch(`${BASE_URL}/connections`, { headers: headers() });
      if (!r.ok) throw new Error(`HTTP ${r.status} — ${r.statusText}`);
      const data = await r.json();
      setConnections(Array.isArray(data) ? data : (data.items ?? []));
    } catch (e) { setError('Failed to fetch Connections: ' + e.message); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { fetchConnections(); }, []);

  const deleteConnection = async (id) => {
    if (!window.confirm(`Delete connection ${id}?`)) return;
    try {
      const r = await fetch(`${BASE_URL}/connections/${id}`, { method: 'DELETE', headers: headers() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      fetchConnections();
    } catch (e) { setError(e.message); }
  };

  const TYPE_BADGE_COLOR = { mqtt: '#6366f1', 'mqtt-5': '#8b5cf6', 'amqp-10': '#0891b2', 'http-push': '#0d9488', kafka: '#ea580c' };

  return (
    <div>
      <div className="header">
        <h1>Connections</h1>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn" style={{ background: 'rgba(255,255,255,0.1)' }} onClick={fetchConnections}>↻ Refresh</button>
          <button className="btn btn-primary" onClick={() => setFormPanel('create')}>+ Create Connection</button>
        </div>
      </div>

      {/* Architecture note */}
      <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: '8px', padding: '0.65rem 1rem', marginBottom: '1.25rem', color: '#93c5fd', fontSize: '0.82rem' }}>
        ℹ️ <b>/api/2/connections</b> bypasses nginx auth và dùng Ditto devops credentials (<code>devops:foobar</code>). Xem <code>nginx.conf</code> để biết thêm.
      </div>

      {error && <div style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid var(--danger)', color: '#fca5a5', padding: '1rem', borderRadius: '8px', marginBottom: '1.25rem' }}>{error}</div>}

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading…</div>
      ) : (
        <div className="card-grid">
          {connections.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              No Connections found. Create your first integration.
            </div>
          ) : connections.map(conn => (
            <div key={conn.id} className="dt-card glass-panel" style={{ borderLeft: `4px solid ${STATUS_COLOR(conn.connectionStatus)}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <div>
                  <div className="dt-title" style={{ fontSize: '1rem' }}>{conn.name || conn.id}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{conn.id}</div>
                </div>
                <span style={{ fontSize: '0.75rem', background: `${STATUS_COLOR(conn.connectionStatus)}22`, color: STATUS_COLOR(conn.connectionStatus), padding: '4px 8px', borderRadius: '12px', whiteSpace: 'nowrap' }}>
                  {conn.connectionStatus ?? '?'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '6px', background: `${TYPE_BADGE_COLOR[conn.connectionType] ?? '#475569'}33`, color: TYPE_BADGE_COLOR[conn.connectionType] ?? 'var(--text-muted)' }}>
                  {conn.connectionType}
                </span>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.83rem', wordBreak: 'break-all', marginBottom: '0.5rem' }}>
                {conn.uri}
              </div>

              {/* Quick info row */}
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'flex', gap: '1rem' }}>
                <span>Sources: {(conn.sources || []).length}</span>
                <span>Targets: {(conn.targets || []).length}</span>
              </div>

              <div className="dt-actions" style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
                <button className="btn" style={{ flex: 1, fontSize: '0.82rem', background: 'rgba(99,102,241,0.2)', color: '#a5b4fc' }} onClick={() => setInfoPanel(conn.id)}>Status/Logs</button>
                <button className="btn btn-primary" style={{ flex: 1, fontSize: '0.82rem' }} onClick={() => setFormPanel(conn)}>Edit</button>
                <button className="btn btn-danger" style={{ flex: 1, fontSize: '0.82rem' }} onClick={() => deleteConnection(conn.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {formPanel && (
        <ConnectionForm
          existing={formPanel === 'create' ? null : formPanel}
          onClose={() => setFormPanel(null)}
          onSaved={fetchConnections}
        />
      )}
      {infoPanel && <ConnectionInfoPanel connId={infoPanel} onClose={() => setInfoPanel(null)} />}
    </div>
  );
};

export default ConnectionManager;
