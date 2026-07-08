import React, { useState } from 'react';
import {
  DITTO_API_BASE_URL as BASE_URL,
  DITTO_POLICY_SUBJECT,
} from '../config';

const headers = (extra = {}) => ({
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  ...extra,
});

// ---------- Sub-panel: Policy Entries editor ----------
const EntryPanel = ({ policyId, entryLabel, onClose, onSaved }) => {
  const [subjects, setSubjects] = useState(() => JSON.stringify({
    [DITTO_POLICY_SUBJECT]: { type: 'nginx basic auth user' }
  }, null, 2));
  const [resources, setResources] = useState('{\n  "thing:/": { "grant": ["READ","WRITE"], "revoke": [] },\n  "policy:/": { "grant": ["READ","WRITE"], "revoke": [] },\n  "message:/": { "grant": ["READ","WRITE"], "revoke": [] }\n}');
  const [error, setError] = useState(null);

  const save = async () => {
    setError(null);
    try {
      const payload = {
        subjects: JSON.parse(subjects),
        resources: JSON.parse(resources)
      };
      const r = await fetch(`${BASE_URL}/policies/${policyId}/entries/${entryLabel}`, {
        method: 'PUT', headers: headers(), body: JSON.stringify(payload)
      });
      if (!r.ok && r.status !== 201 && r.status !== 204) throw new Error(`HTTP ${r.status}`);
      onSaved && onSaved();
      onClose();
    } catch (e) { setError(e.message); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-panel" style={{ background: 'var(--bg-dark)', maxWidth: 600 }}>
        <div className="modal-header">
          <h3 className="modal-title">Entry: {entryLabel}</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</div>}
        <div className="form-group">
          <label>Subjects (JSON)</label>
          <textarea value={subjects} onChange={e => setSubjects(e.target.value)} rows={5} style={{ fontFamily: 'monospace' }} />
        </div>
        <div className="form-group">
          <label>Resources (JSON)</label>
          <textarea value={resources} onChange={e => setResources(e.target.value)} rows={8} style={{ fontFamily: 'monospace' }} />
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn" style={{ flex: 1, background: 'rgba(255,255,255,0.1)' }} onClick={onClose}>Cancel</button>
          <button className="btn btn-success" style={{ flex: 2 }} onClick={save}>Save Entry</button>
        </div>
      </div>
    </div>
  );
};

// ---------- Policy detail view ----------
const PolicyDetail = ({ policyId, onClose }) => {
  const [policy, setPolicy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newLabel, setNewLabel] = useState('');
  const [editEntry, setEditEntry] = useState(null);

  const load = () => {
    setLoading(true);
    fetch(`${BASE_URL}/policies/${policyId}`, { headers: headers() })
      .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then(data => setPolicy(data))
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  };

  React.useEffect(() => { load(); }, []);

  const deleteEntry = async (label) => {
    if (!window.confirm(`Delete entry "${label}"?`)) return;
    try {
      const r = await fetch(`${BASE_URL}/policies/${policyId}/entries/${label}`, {
        method: 'DELETE', headers: headers()
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      load();
    } catch (e) { setError(e.message); }
  };

  return (
    <>
      <div className="modal-overlay">
        <div className="modal-content glass-panel" style={{ background: 'var(--bg-dark)', maxWidth: 680 }}>
          <div className="modal-header">
            <h3 className="modal-title">Policy: {policyId}</h3>
            <button className="close-btn" onClick={onClose}>✕</button>
          </div>
          {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</div>}
          {loading ? <p style={{ color: 'var(--text-muted)' }}>Loading…</p> : policy && (
            <>
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.75rem', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Entries</div>
                {Object.entries(policy.entries || {}).map(([label, entry]) => (
                  <div key={label} className="glass-panel" style={{ padding: '1rem', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: 600, color: '#93c5fd' }}>{label}</span>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => setEditEntry(label)}>Edit</button>
                        <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => deleteEntry(label)}>✕</button>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Subjects: {Object.keys(entry.subjects || {}).join(', ') || 'none'}<br />
                      Resources: {Object.keys(entry.resources || {}).join(', ') || 'none'}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="New entry label…" style={{ flex: 1 }} />
                <button className="btn btn-primary" disabled={!newLabel} onClick={() => { setEditEntry(newLabel); setNewLabel(''); }}>+ Add Entry</button>
              </div>
            </>
          )}
        </div>
      </div>
      {editEntry && (
        <EntryPanel policyId={policyId} entryLabel={editEntry} onClose={() => setEditEntry(null)} onSaved={load} />
      )}
    </>
  );
};

// ---------- Main PolicyManager ----------
const PolicyManager = () => {
  const [policyId, setPolicyId] = useState('');
  const [lookupId, setLookupId] = useState('');
  const [detailPolicy, setDetailPolicy] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createId, setCreateId] = useState('org.digitaltwin:policy_');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const lookup = async (e) => {
    e.preventDefault();
    setError(null); setSuccess(null);
    try {
      const r = await fetch(`${BASE_URL}/policies/${lookupId}`, { headers: headers() });
      if (!r.ok) throw new Error(`HTTP ${r.status} — not found or no permission`);
      setDetailPolicy(lookupId);
    } catch (e) { setError(e.message); }
  };

  const createDefault = async (e) => {
    e.preventDefault();
    setError(null); setSuccess(null);
    try {
      const payload = {
        policyId: createId,
        entries: {
          DEFAULT: {
            subjects: { "nginx:ditto": { type: "nginx basic auth user" } },
            resources: {
              "thing:/": { grant: ["READ", "WRITE"], revoke: [] },
              "policy:/": { grant: ["READ", "WRITE"], revoke: [] },
              "message:/": { grant: ["READ", "WRITE"], revoke: [] }
            }
          }
        }
      };
      const r = await fetch(`${BASE_URL}/policies/${createId}`, {
        method: 'PUT', headers: headers(), body: JSON.stringify(payload)
      });
      if (!r.ok && r.status !== 201 && r.status !== 204) throw new Error(`HTTP ${r.status}`);
      setSuccess(`Policy "${createId}" created/updated successfully.`);
      setIsCreateOpen(false);
    } catch (e) { setError(e.message); }
  };

  const deletePolicy = async (id) => {
    if (!window.confirm(`Delete policy ${id}?`)) return;
    setError(null);
    try {
      const r = await fetch(`${BASE_URL}/policies/${id}`, { method: 'DELETE', headers: headers() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setSuccess(`Policy "${id}" deleted.`);
    } catch (e) { setError(e.message); }
  };

  return (
    <div>
      <div className="header">
        <h1>Policies</h1>
        <button className="btn btn-primary" onClick={() => setIsCreateOpen(true)}>+ Create Policy</button>
      </div>

      {/* API note */}
      <div style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1.5rem', color: '#93c5fd', fontSize: '0.9rem' }}>
        ℹ️ The Ditto API does not provide a "list all policies" endpoint. Enter a known Policy ID below to manage it.
      </div>

      {error && <div style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid var(--danger)', color: '#fca5a5', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>{error}</div>}
      {success && <div style={{ background: 'rgba(16,185,129,0.2)', border: '1px solid var(--success)', color: '#6ee7b7', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>{success}</div>}

      {/* Lookup form */}
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <form onSubmit={lookup} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label>Policy ID to look up / manage</label>
            <input value={lookupId} onChange={e => setLookupId(e.target.value)} placeholder="e.g. org.eclipse.ditto:default" required />
          </div>
          <button type="submit" className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>Open Policy</button>
          <button type="button" className="btn btn-danger" style={{ whiteSpace: 'nowrap' }} onClick={() => deletePolicy(lookupId)} disabled={!lookupId}>Delete</button>
        </form>
      </div>

      {/* Create Policy Modal */}
      {isCreateOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ background: 'var(--bg-dark)', maxWidth: 500 }}>
            <div className="modal-header">
              <h3 className="modal-title">Create Policy</h3>
              <button className="close-btn" onClick={() => setIsCreateOpen(false)}>✕</button>
            </div>
            <form onSubmit={createDefault}>
              <div className="form-group">
                <label>Policy ID</label>
                <input value={createId} onChange={e => setCreateId(e.target.value)} placeholder="namespace:policy_name" required />
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                Creates a policy with a default entry granting READ+WRITE on thing, policy, and message. You can edit entries afterwards.
              </p>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button type="button" className="btn" style={{ flex: 1, background: 'rgba(255,255,255,0.1)' }} onClick={() => setIsCreateOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-success" style={{ flex: 2 }}>Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Policy detail modal */}
      {detailPolicy && <PolicyDetail policyId={detailPolicy} onClose={() => setDetailPolicy(null)} />}
    </div>
  );
};

export default PolicyManager;
