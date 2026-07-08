import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DITTO_API_BASE_URL as BASE_URL,
  DITTO_AUTHORIZATION,
  DITTO_POLICY_SUBJECT,
} from '../config';

const headers = (extra = {}) => ({
  'Authorization': DITTO_AUTHORIZATION,
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

  const handleTestConnection = () => {
    // Mocking connection test for UI
    setTestConnStatus('loading');
    setTimeout(() => {
      setTestConnStatus('success');
    }, 1000);
  };

  const nextStep = () => {
    if (step === 1 && (!namespace || !thingName)) {
      setError("Vui lòng nhập Namespace và Thing Name hợp lệ.");
      return;
    }
    if (step === 2 && defType === 'json') {
      try {
        JSON.parse(defJson);
      } catch (e) {
        setError("JSON Payload không hợp lệ. Vui lòng kiểm tra lại cú pháp.");
        return;
      }
    }
    setError(null);
    setStep(prev => Math.min(prev + 1, 4));
  };
  
  const prevStep = () => setStep(prev => Math.max(prev - 1, 1));

  const buildFinalPayload = () => {
    let payload = {
      policyId: policyId
    };
    if (defType === 'url') {
      if (defUrl) payload.definition = defUrl;
      payload.attributes = {};
      payload.features = {};
    } else if (defType === 'json') {
       try {
         const parsed = JSON.parse(defJson);
         payload = { ...parsed, policyId: policyId };
       } catch (e) {
         payload.attributes = {};
         payload.features = {};
       }
    }
    return payload;
  };

  const handleCreate = async () => {
    setLoading(true);
    setError(null);
    try {
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
      const thingRes = await fetch(`${BASE_URL}/things/${encodeURIComponent(thingId)}`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify(payload)
      });
      
      if (!thingRes.ok && thingRes.status !== 201 && thingRes.status !== 204) {
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
{`PUT /api/2/things/${thingId}

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
            <button className="btn btn-primary" onClick={nextStep}>
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
