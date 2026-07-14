import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DITTO_API_BASE_URL as BASE_URL,
  DIGITAL_TWIN_CREATE_BASE_URL,
  DITTO_POLICY_SUBJECT,
  SEARCH_PAGE_SIZE,
} from '../config';
import {
  mergeCompositionIntoPayload,
  normalizeThingCatalog,
} from '../utils/digitalTwinComposition';

const headers = (extra = {}) => ({
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  ...extra,
});

// Templates cho Policy
const POLICY_TEMPLATES = {
  'default': {
    "entries": {
      "owner": {
        "subjects": { [DITTO_POLICY_SUBJECT]: { "type": "nginx basic auth user" } },
        "resources": {
          "thing:/": { "grant": ["READ","WRITE"], "revoke": [] },
          "policy:/": { "grant": ["READ","WRITE"], "revoke": [] },
          "message:/": { "grant": ["READ","WRITE"], "revoke": [] }
        }
      }
    }
  },
  'read-only': {
    "entries": {
      "viewer": {
        "subjects": { [DITTO_POLICY_SUBJECT]: { "type": "nginx basic auth user" } },
        "resources": {
          "thing:/": { "grant": ["READ"], "revoke": ["WRITE"] },
          "policy:/": { "grant": ["READ"], "revoke": ["WRITE"] },
          "message:/": { "grant": ["READ"], "revoke": ["WRITE"] }
        }
      }
    }
  }
};

const Module3CreateWizard = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Step 1 Data
  const [namespace, setNamespace] = useState('org.eclipse.ditto');
  const [thingName, setThingName] = useState('');
  const [protocol, setProtocol] = useState('mqtt');
  const [testConnStatus, setTestConnStatus] = useState(null); // 'success' | 'error' | null

  // Step 2 Data
  const [defType, setDefType] = useState('json'); // 'url' | 'json'
  const [defUrl, setDefUrl] = useState('');
  const [goalAgentId, setGoalAgentId] = useState('');
  const [goalAgentTouched, setGoalAgentTouched] = useState(false);
  const [goalAgentAvailability, setGoalAgentAvailability] = useState(null);
  const [goalAgentChecking, setGoalAgentChecking] = useState(false);
  const [goalAgentCheckError, setGoalAgentCheckError] = useState(null);
  const [thingCatalog, setThingCatalog] = useState({ thingIds: [] });
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogLoadAttempted, setCatalogLoadAttempted] = useState(false);
  const [catalogError, setCatalogError] = useState(null);
  const [selectedComponentThingIds, setSelectedComponentThingIds] = useState([]);
  const [defJson, setDefJson] = useState(`{
  "definition": "com.acme:coffeebrewer:0.1.0",
  "attributes": {
    "manufacturer": "ACME demo corp.",
    "location": "Berlin, main floor",
    "serialno": "42",
    "model": "Speaking coffee machine"
  },
  "features": {
    "coffee-brewer": {
      "definition": [
        "com.acme:coffeebrewer:0.1.0"
      ],
      "properties": {
        "brewed-coffees": 0
      }
    },
    "water-tank": {
      "properties": {
        "configuration": {
          "smartMode": true,
          "brewingTemp": 87,
          "tempToHold": 44,
          "timeoutSeconds": 6000
        },
        "status": {
          "waterAmount": 731,
          "temperature": 44
        }
      }
    }
  }
}`);

  // Step 3 Data
  const [policyId, setPolicyId] = useState('org.eclipse.ditto:default');
  const [policyTemplate, setPolicyTemplate] = useState('default');

  const thingId = `${namespace}:${thingName}`;

  const loadThingCatalog = useCallback(async ({ showLoading = true } = {}) => {
    if (showLoading) setCatalogLoading(true);
    setCatalogLoadAttempted(true);
    setCatalogError(null);

    try {
      let things = [];
      let cursor = null;
      const visitedCursors = new Set();
      let shouldUseFallback = false;

      do {
        const options = [`size(${SEARCH_PAGE_SIZE})`];
        if (cursor) options.push(`cursor(${cursor})`);
        const params = new URLSearchParams({ option: options.join(',') });
        const response = await fetch(`${BASE_URL}/search/things?${params}`, { headers: headers() });

        if (!response.ok) {
          if (!cursor && [400, 404, 501].includes(response.status)) {
            shouldUseFallback = true;
            break;
          }
          throw new Error(`Search API trả về HTTP ${response.status}`);
        }

        const data = await response.json();
        things = [...things, ...(Array.isArray(data?.items) ? data.items : [])];

        const nextCursor = typeof data?.cursor === 'string' ? data.cursor.trim() : '';
        if (!nextCursor || visitedCursors.has(nextCursor)) {
          cursor = null;
        } else {
          visitedCursors.add(nextCursor);
          cursor = nextCursor;
        }
      } while (cursor);

      if (shouldUseFallback) {
        const response = await fetch(`${BASE_URL}/things`, { headers: headers() });
        if (!response.ok) throw new Error(`Things API trả về HTTP ${response.status}`);

        const data = await response.json();
        things = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
      }

      const catalog = normalizeThingCatalog(things, thingId);
      setThingCatalog(catalog);
      setSelectedComponentThingIds(current => (
        current.filter(selectedThingId => catalog.thingIds.includes(selectedThingId))
      ));
      return catalog;
    } catch (catalogFetchError) {
      setThingCatalog({ thingIds: [] });
      setCatalogError(`Không thể tải danh sách Digital Twin: ${catalogFetchError.message}`);
      return null;
    } finally {
      if (showLoading) setCatalogLoading(false);
    }
  }, [thingId]);

  useEffect(() => {
    setThingCatalog({ thingIds: [] });
    setCatalogLoadAttempted(false);
  }, [thingId]);

  useEffect(() => {
    if (step === 2 && !catalogLoading && !catalogLoadAttempted) {
      loadThingCatalog();
    }
  }, [catalogLoadAttempted, catalogLoading, loadThingCatalog, step]);

  const normalizedGoalAgentId = goalAgentId.trim();
  const displayedGoalAgentAvailability = goalAgentAvailability?.goalAgentId === normalizedGoalAgentId
    ? goalAgentAvailability
    : null;
  const availableComponentThingIds = thingCatalog.thingIds.filter(
    existingThingId => !selectedComponentThingIds.includes(existingThingId)
  );

  const checkGoalAgentAvailability = useCallback(async (rawGoalAgentId = goalAgentId) => {
    const normalizedValue = rawGoalAgentId.trim();
    if (!normalizedValue) {
      setGoalAgentAvailability(null);
      return { goalAgentId: '', available: false, conflictingThingId: null, required: true };
    }

    setGoalAgentChecking(true);
    setGoalAgentCheckError(null);
    try {
      const params = new URLSearchParams({ goalAgentId: normalizedValue });
      const response = await fetch(
        `${DIGITAL_TWIN_CREATE_BASE_URL}/goal-agent-availability?${params}`,
        { headers: headers() }
      );
      if (!response.ok) throw new Error(`Ambassador trả về HTTP ${response.status}`);

      const data = await response.json();
      const result = {
        goalAgentId: normalizedValue,
        available: data.available === true,
        conflictingThingId: typeof data.conflictingThingId === 'string'
          ? data.conflictingThingId
          : null,
      };
      setGoalAgentAvailability(result);
      return result;
    } catch (availabilityError) {
      setGoalAgentAvailability(null);
      setGoalAgentCheckError(`Không thể kiểm tra Goal Agent ID: ${availabilityError.message}`);
      return null;
    } finally {
      setGoalAgentChecking(false);
    }
  }, [goalAgentId]);

  const handleTestConnection = () => {
    // Mocking connection test for UI
    setTestConnStatus('loading');
    setTimeout(() => {
      setTestConnStatus('success');
    }, 1000);
  };

  const nextStep = async () => {
    if (step === 1 && (!namespace || !thingName)) {
      setError("Vui lòng nhập Namespace và Thing Name hợp lệ.");
      return;
    }
    if (step === 2) {
      setGoalAgentTouched(true);

      if (!normalizedGoalAgentId) {
        setError('Vui lòng nhập Goal Agent ID.');
        return;
      }
      const availability = displayedGoalAgentAvailability
        ?? await checkGoalAgentAvailability(normalizedGoalAgentId);
      if (!availability) {
        setError('Không thể xác minh Goal Agent ID qua ambassador. Vui lòng thử lại.');
        return;
      }
      if (!availability.available) {
        setError(`Goal Agent ID đã được sử dụng bởi Digital Twin "${availability.conflictingThingId}".`);
        return;
      }
      if (defType === 'json') {
        try {
          const parsed = JSON.parse(defJson);
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error('JSON root must be an object');
          }
        } catch (e) {
          setError("JSON Payload không hợp lệ. Vui lòng nhập một JSON object hợp lệ.");
          return;
        }
      }

      setGoalAgentId(normalizedGoalAgentId);
    }
    setError(null);
    setStep(prev => Math.min(prev + 1, 4));
  };
  
  const prevStep = () => setStep(prev => Math.max(prev - 1, 1));

  const buildFinalPayload = () => {
    let basePayload = {
      policyId: policyId
    };
    if (defType === 'url') {
      if (defUrl) basePayload.definition = defUrl;
    } else if (defType === 'json') {
       try {
         const parsed = JSON.parse(defJson);
         basePayload = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
           ? { ...parsed, policyId: policyId }
           : { policyId: policyId };
       } catch (e) {
         basePayload = { policyId: policyId };
       }
    }
    return mergeCompositionIntoPayload(basePayload, {
      goalAgentId,
      thingIds: selectedComponentThingIds,
    });
  };

  const handleCreate = async () => {
    setLoading(true);
    setError(null);
    try {
      if (selectedComponentThingIds.length > 0) {
        const latestCatalog = await loadThingCatalog({ showLoading: false });
        if (!latestCatalog) {
          setStep(2);
          throw new Error('Không thể tải lại danh sách Digital Twin thành phần. Vui lòng thử lại.');
        }

        const unavailableComponents = selectedComponentThingIds.filter(
          selectedThingId => !latestCatalog.thingIds.includes(selectedThingId)
        );
        if (unavailableComponents.length > 0) {
          setStep(2);
          throw new Error(`Digital Twin thành phần không còn tồn tại: ${unavailableComponents.join(', ')}.`);
        }
      }

      // 1. Create Policy first if it's not the default one or if we want to enforce it.
      // We will try to create the policy. If it exists, it might return 204 or 409 depending on exact endpoint.
      // Often PUT /policies/{id} updates/creates.
      const polRes = await fetch(`${BASE_URL}/policies/${encodeURIComponent(policyId)}`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify(POLICY_TEMPLATES[policyTemplate] || POLICY_TEMPLATES['default'])
      });
      if (!polRes.ok && polRes.status !== 201 && polRes.status !== 204) {
        // If it fails due to existing or permission, we log but continue as they might be using an existing policy
        console.warn('Policy creation warning:', polRes.statusText);
      }

      // 2. Create Thing
      const payload = buildFinalPayload();
      const thingRes = await fetch(`${DIGITAL_TWIN_CREATE_BASE_URL}/${encodeURIComponent(thingId)}`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify(payload)
      });
      
      if (!thingRes.ok && thingRes.status !== 201 && thingRes.status !== 204) {
        if (thingRes.status === 409) {
          const conflict = await thingRes.json().catch(() => null);
          throw new Error(conflict?.message || `Digital Twin "${thingId}" đã tồn tại.`);
        }
        throw new Error(`Tạo Thing thất bại: ${thingRes.statusText}`);
      }

      // 3. (Optional) Create Connection - Skipped in this MVP as it requires admin access and complex payload.
      
      navigate(`/dt/${encodeURIComponent(thingId)}`);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="module3-container" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="header" style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <h1>KHỞI TẠO DIGITAL TWIN MỚI</h1>
      </div>

      {/* Progress Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '15px', left: '0', right: '0', height: '2px', background: 'var(--border-color)', zIndex: 0 }}></div>
        <div style={{ position: 'absolute', top: '15px', left: '0', width: `${(step - 1) * 33.33}%`, height: '2px', background: 'var(--primary)', transition: 'width 0.3s ease', zIndex: 1 }}></div>
        
        {[1, 2, 3, 4].map(num => (
          <div key={num} style={{ 
            width: '32px', height: '32px', borderRadius: '50%', 
            background: step >= num ? 'var(--primary)' : 'var(--bg-dark)', 
            border: step >= num ? '2px solid var(--primary)' : '2px solid var(--border-color)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2,
            fontWeight: 600, color: step >= num ? '#fff' : 'var(--text-muted)'
          }}>
            {num}
          </div>
        ))}
      </div>

      <div className="glass-panel" style={{ padding: '2rem' }}>
        {error && <div style={{ color: '#fca5a5', background: 'rgba(239,68,68,0.2)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid var(--danger)' }}>{error}</div>}
        
        {/* Step 1: Identity & Connection */}
        {step === 1 && (
          <div className="step-content">
            <h2 style={{ marginBottom: '1.5rem' }}>Bước 1: Định danh & Kết nối</h2>
            <div className="form-group">
              <label>Namespace</label>
              <input type="text" value={namespace} onChange={e => setNamespace(e.target.value)} placeholder="VD: org.eclipse.ditto" />
            </div>
            <div className="form-group">
              <label>Tên thiết bị (Thing Name)</label>
              <input type="text" value={thingName} onChange={e => setThingName(e.target.value)} placeholder="VD: sensor-01" />
            </div>
            <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', marginBottom: '1.5rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Thing ID dự kiến: </span>
              <strong style={{ color: 'var(--primary)', fontSize: '1.2rem' }}>{thingName ? `${namespace}:${thingName}` : '(Chưa nhập)'}</strong>
            </div>

            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Thiết lập kết nối (Telemetry)</h3>
            <div className="form-group">
              <label>Giao thức</label>
              <select value={protocol} onChange={e => setProtocol(e.target.value)}>
                <option value="mqtt">MQTT</option>
                <option value="amqp">AMQP 1.0</option>
                <option value="http">HTTP Push</option>
                <option value="kafka">Kafka</option>
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem' }}>
              {testConnStatus === 'loading' && <span style={{ color: 'var(--text-muted)' }}>Đang kiểm tra...</span>}
              {testConnStatus === 'success' && <span style={{ color: 'var(--success)' }}>✓ Kết nối thành công</span>}
              <button className="btn" style={{ background: 'rgba(255,255,255,0.1)' }} onClick={handleTestConnection}>Test Connection</button>
            </div>
          </div>
        )}

        {/* Step 2: Thing Description */}
        {step === 2 && (
          <div className="step-content">
            <h2 style={{ marginBottom: '1.5rem' }}>Bước 2: Thing Description (WoT)</h2>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
               <button className={`btn ${defType === 'url' ? 'btn-primary' : ''}`} style={{ flex: 1, background: defType === 'url' ? 'var(--primary)' : 'rgba(255,255,255,0.1)' }} onClick={() => setDefType('url')}>Sử dụng URL</button>
               <button className={`btn ${defType === 'json' ? 'btn-primary' : ''}`} style={{ flex: 1, background: defType === 'json' ? 'var(--primary)' : 'rgba(255,255,255,0.1)' }} onClick={() => setDefType('json')}>Nhập JSON-LD</button>
            </div>
            
            {defType === 'url' ? (
              <div className="form-group">
                <label>URL của Thing Description</label>
                <input type="text" value={defUrl} onChange={e => setDefUrl(e.target.value)} placeholder="https://raw.githubusercontent.com/.../td.json" />
              </div>
            ) : (
              <div className="form-group">
                <label>Nội dung JSON-LD</label>
                <textarea rows={10} value={defJson} onChange={e => setDefJson(e.target.value)} style={{ fontFamily: 'monospace', fontSize: '0.85rem' }} />
              </div>
            )}

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Cấu trúc Digital Twin</h3>
              <div className="form-group">
                <label>Goal Agent ID <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input
                  type="text"
                  value={goalAgentId}
                  onChange={event => {
                    setGoalAgentId(event.target.value);
                    setGoalAgentTouched(true);
                    setGoalAgentAvailability(null);
                    setGoalAgentCheckError(null);
                  }}
                  onBlur={() => {
                    setGoalAgentTouched(true);
                    if (goalAgentId.trim()) checkGoalAgentAvailability();
                  }}
                  placeholder="VD: G_GRINDER_ROOT"
                  disabled={goalAgentChecking}
                />
                {goalAgentTouched && !normalizedGoalAgentId && (
                  <small style={{ color: '#fca5a5', display: 'block', marginTop: '0.5rem' }}>
                    Goal Agent ID là bắt buộc.
                  </small>
                )}
                {displayedGoalAgentAvailability && !displayedGoalAgentAvailability.available && (
                  <small style={{ color: '#fca5a5', display: 'block', marginTop: '0.5rem' }}>
                    ID này đã được sử dụng bởi {displayedGoalAgentAvailability.conflictingThingId}.
                  </small>
                )}
                {displayedGoalAgentAvailability?.available && (
                  <small style={{ color: 'var(--success)', display: 'block', marginTop: '0.5rem' }}>
                    Goal Agent ID có thể sử dụng.
                  </small>
                )}
                {goalAgentChecking && (
                  <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '0.5rem' }}>
                    Đang kiểm tra với ambassador…
                  </small>
                )}
                {goalAgentCheckError && (
                  <small style={{ color: '#fca5a5', display: 'block', marginTop: '0.5rem' }}>
                    {goalAgentCheckError}
                  </small>
                )}
              </div>

              <div className="form-group">
                <label>Digital Twin thành phần (không bắt buộc)</label>
                {catalogLoading ? (
                  <div style={{ color: 'var(--text-muted)', padding: '0.75rem 0' }}>Đang tải danh sách Digital Twin…</div>
                ) : catalogError ? (
                  <div style={{ padding: '0.75rem', border: '1px solid var(--danger)', borderRadius: '6px', background: 'rgba(239,68,68,0.1)' }}>
                    <div style={{ color: '#fca5a5', marginBottom: '0.75rem' }}>{catalogError}</div>
                    <button type="button" className="btn" style={{ background: 'rgba(255,255,255,0.1)' }} onClick={() => loadThingCatalog()}>
                      ↻ Thử tải lại
                    </button>
                  </div>
                ) : (
                  <>
                    <select
                      value=""
                      onChange={event => {
                        const selectedThingId = event.target.value;
                        if (selectedThingId) {
                          setSelectedComponentThingIds(current => [...current, selectedThingId]);
                        }
                      }}
                      disabled={availableComponentThingIds.length === 0}
                    >
                      <option value="">
                        {availableComponentThingIds.length > 0
                          ? 'Chọn một Digital Twin để thêm…'
                          : 'Không còn Digital Twin khả dụng'}
                      </option>
                      {availableComponentThingIds.map(componentThingId => (
                        <option key={componentThingId} value={componentThingId}>{componentThingId}</option>
                      ))}
                    </select>

                    {thingCatalog.thingIds.length === 0 && (
                      <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '0.5rem' }}>
                        Chưa có Digital Twin nào có thể chọn làm thành phần.
                      </small>
                    )}

                    {selectedComponentThingIds.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
                        {selectedComponentThingIds.map(componentThingId => (
                          <span key={componentThingId} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 0.65rem', borderRadius: '999px', background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.45)', color: '#bfdbfe', maxWidth: '100%' }}>
                            <span style={{ wordBreak: 'break-all' }}>{componentThingId}</span>
                            <button
                              type="button"
                              aria-label={`Xóa ${componentThingId}`}
                              onClick={() => setSelectedComponentThingIds(current => (
                                current.filter(selectedThingId => selectedThingId !== componentThingId)
                              ))}
                              style={{ border: 0, background: 'transparent', color: '#fca5a5', cursor: 'pointer', fontSize: '1rem' }}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Policy */}
        {step === 3 && (
          <div className="step-content">
            <h2 style={{ marginBottom: '1.5rem' }}>Bước 3: Phân quyền (Policy)</h2>
            <div className="form-group">
              <label>Policy ID</label>
              <input type="text" value={policyId} onChange={e => setPolicyId(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Template Phân Quyền</label>
              <select value={policyTemplate} onChange={e => setPolicyTemplate(e.target.value)}>
                <option value="default">Mặc định (Full Access cho auth user)</option>
                <option value="read-only">Chỉ xem (Read-Only Viewer)</option>
              </select>
            </div>
            
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '4px' }}>
               <h4 style={{ color: 'var(--text-muted)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Preview Policy JSON:</h4>
               <pre style={{ color: '#a78bfa', fontSize: '0.8rem', overflowX: 'auto' }}>
                 {JSON.stringify(POLICY_TEMPLATES[policyTemplate], null, 2)}
               </pre>
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <div className="step-content">
            <h2 style={{ marginBottom: '1.5rem' }}>Bước 4: Xác nhận và Khởi tạo</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Kiểm tra lại payload sẽ gửi đến Ditto API để tạo Thing:</p>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '6px', border: '1px solid var(--border-color)', marginBottom: '2rem' }}>
              <pre style={{ color: '#6ee7b7', fontSize: '0.85rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
{`PUT /api/digital-twins/${thingId}

${JSON.stringify(buildFinalPayload(), null, 2)}`}
              </pre>
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
          <button className="btn" style={{ background: step === 1 ? 'transparent' : 'rgba(255,255,255,0.1)', opacity: step === 1 ? 0 : 1 }} onClick={prevStep} disabled={step === 1 || loading}>
            ← Quay lại
          </button>
          
          {step < 4 ? (
            <button
              className="btn btn-primary"
              onClick={nextStep}
              disabled={loading || (step === 2 && goalAgentChecking)}
            >
              Tiếp tục →
            </button>
          ) : (
            <button className="btn btn-success" onClick={handleCreate} disabled={loading}>
              {loading ? 'Đang tạo...' : '✓ Tạo Digital Twin'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Module3CreateWizard;
