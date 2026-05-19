import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import KGGraph from './KGGraph';
import ObjectController from './ObjectController';

const BASE_URL = 'http://35.240.154.27:8080/api/2';
const DEFAULT_AUTH = btoa('ditto:ditto');

const headers = (extra = {}) => ({
  'Authorization': `Basic ${DEFAULT_AUTH}`,
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  ...extra,
});

const Module2DTStatus = () => {
  const { id } = useParams(); // URL encoded thingId
  const thingId = decodeURIComponent(id);
  const navigate = useNavigate();

  const [thing, setThing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Panel B: Attributes
  const [attributesJson, setAttributesJson] = useState('{}');
  const [editingAttributes, setEditingAttributes] = useState(false);
  const [attrError, setAttrError] = useState(null);

  // Panel C: Features
  const [activeFeature, setActiveFeature] = useState(null);

  // Panel D: Messages
  const [messageSubject, setMessageSubject] = useState('');
  const [messagePayload, setMessagePayload] = useState('{}');
  const [messagesLog, setMessagesLog] = useState([]); // { time, dir, subject, payload }
  const [msgStatus, setMsgStatus] = useState(null);

  // Graph sizing
  const graphContainerRef = useRef(null);
  const [graphSize, setGraphSize] = useState({ width: 300, height: 200 });

  useEffect(() => {
    if (graphContainerRef.current) {
      const { clientWidth, clientHeight } = graphContainerRef.current;
      setGraphSize({ width: clientWidth, height: clientHeight });
    }
  }, [thing]); // Recalculate when data loads

  // Fetch Thing Data
  const fetchThing = async () => {
    try {
      const res = await fetch(`${BASE_URL}/things/${encodeURIComponent(thingId)}`, { headers: headers() });
      if (!res.ok) throw new Error(`HTTP ${res.status} - ${res.statusText}`);
      const data = await res.json();
      setThing(data);
      if (!editingAttributes) {
        setAttributesJson(JSON.stringify(data.attributes || {}, null, 2));
      }
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchThing();
    // Setup Auto-polling for real-time updates
    const interval = setInterval(() => {
      fetchThing();
    }, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, [thingId]);

  // Handle Attribute Save
  const handleSaveAttributes = async () => {
    setAttrError(null);
    try {
      const parsed = JSON.parse(attributesJson);
      const res = await fetch(`${BASE_URL}/things/${encodeURIComponent(thingId)}/attributes`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify(parsed)
      });
      if (!res.ok && res.status !== 204) throw new Error(res.statusText);
      setEditingAttributes(false);
      fetchThing();
    } catch (err) {
      setAttrError(err.message);
    }
  };

  // Handle Send Message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    setMsgStatus(null);
    try {
      const parsed = JSON.parse(messagePayload);
      const url = `${BASE_URL}/things/${encodeURIComponent(thingId)}/inbox/messages/${encodeURIComponent(messageSubject)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(parsed)
      });
      if (!res.ok && res.status !== 202) throw new Error(res.statusText);
      
      setMsgStatus({ type: 'success', text: 'Đã gửi thành công!' });
      setMessagesLog(prev => [{
        time: new Date().toLocaleTimeString(),
        dir: 'OUT',
        subject: messageSubject,
        payload: JSON.stringify(parsed)
      }, ...prev].slice(0, 10)); // keep last 10
      setMessageSubject('');
      setMessagePayload('{}');
    } catch (err) {
      setMsgStatus({ type: 'error', text: err.message });
    }
  };

  // Handle Action from ObjectController
  const handleControllerAction = (target) => {
    setMessageSubject(target.command || target.name);
    // If it's a Task with command, pre-fill. If Goal, maybe just the name.
    if (target.properties && Object.keys(target.properties).length > 0) {
        const { name, description, command, type, ...rest } = target.properties;
        setMessagePayload(JSON.stringify(rest, null, 2));
    } else {
        setMessagePayload('{}');
    }
    
    // Scroll to messages panel
    const msgPanel = document.querySelector('.panel-d');
    if (msgPanel) {
        msgPanel.scrollIntoView({ behavior: 'smooth' });
    }
  };

  if (loading && !thing) {
    return <div style={{ padding: '3rem', textAlign: 'center' }}>Đang tải dữ liệu...</div>;
  }

  if (error && !thing) {
    return <div style={{ padding: '3rem', color: 'var(--danger)' }}>Lỗi: {error}</div>;
  }

  // Helper to generate mock chart data for numerical properties
  const generateMockChartData = (currentValue) => {
    if (typeof currentValue !== 'number') return [];
    // Generate 10 points fluctuating around current value
    return Array.from({ length: 10 }).map((_, i) => ({
      time: `T-${10 - i}`,
      value: currentValue + (Math.random() * 4 - 2)
    }));
  };

  return (
    <div className="module2-container">
      <div className="header" style={{ marginBottom: '1.5rem' }}>
        <div>
            <h1 style={{ display: 'inline-block', marginRight: '1rem' }}>CHI TIẾT DIGITAL TWIN</h1>
            <span className="dt-namespace" style={{ fontSize: '1rem' }}>{thingId}</span>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn" style={{ background: 'rgba(255,255,255,0.1)' }} onClick={() => navigate('/')}>
             ← Quay lại danh sách
          </button>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Panel A: Identifier Info */}
        <div className="glass-panel panel-a" style={{ padding: '1.5rem' }}>
          <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Panel A: Thông tin định danh</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.9rem' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Thing ID:</span>
              <div style={{ wordBreak: 'break-all' }}>{thing.thingId}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Policy ID:</span>
              <div style={{ wordBreak: 'break-all' }}>{thing.policyId}</div>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <span style={{ color: 'var(--text-muted)' }}>Definition (WoT TD URL):</span>
              <div style={{ wordBreak: 'break-all', color: 'var(--primary)' }}>{thing.definition || 'Không có'}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Tạo lúc:</span>
              <div>{thing._created ? new Date(thing._created).toLocaleString() : 'N/A'}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Cập nhật cuối:</span>
              <div>{thing._modified ? new Date(thing._modified).toLocaleString() : 'N/A'}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Revision:</span>
              <div>{thing._revision || 0}</div>
            </div>
          </div>
        </div>

        {/* Panel E: KG Status */}
        <div className="glass-panel panel-e" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3 style={{ margin: 0 }}>Panel E: Trạng thái Knowledge Graph</h3>
              <span style={{ fontSize: '0.6rem', padding: '1px 5px', background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.3)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                <span style={{ width: '4px', height: '4px', background: '#ef4444', borderRadius: '50%', animation: 'pulse 1.5s infinite' }}></span>
                LIVE
              </span>
            </div>
            <button className="btn" style={{ padding: '2px 8px', fontSize: '0.7rem', background: 'rgba(59,130,246,0.2)', color: '#93c5fd' }} onClick={() => navigate('/neo4j')}>Đầy đủ →</button>
          </div>
          <div ref={graphContainerRef} className="graph-container">
              <KGGraph thingId={thingId} width={graphSize.width} height={graphSize.height} />
          </div>
        </div>

        {/* Panel F: Semantic Object Controller */}
        <div className="glass-panel panel-f" style={{ gridColumn: 'span 6', minHeight: '400px' }}>
          <ObjectController thingId={thingId} onAction={handleControllerAction} />
        </div>

        {/* Panel B: Attributes */}
        <div className="glass-panel panel-b" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>Panel B: Attributes</h3>
            {!editingAttributes ? (
              <button className="btn" style={{ padding: '2px 8px', fontSize: '0.8rem', background: 'var(--primary)' }} onClick={() => setEditingAttributes(true)}>Sửa</button>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                 <button className="btn" style={{ padding: '2px 8px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.1)' }} onClick={() => { setEditingAttributes(false); setAttributesJson(JSON.stringify(thing.attributes || {}, null, 2)); setAttrError(null); }}>Hủy</button>
                 <button className="btn" style={{ padding: '2px 8px', fontSize: '0.8rem', background: 'var(--success)' }} onClick={handleSaveAttributes}>Lưu</button>
              </div>
            )}
          </div>
          {attrError && <div style={{ color: 'var(--danger)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>{attrError}</div>}
          
          {editingAttributes ? (
             <textarea 
               value={attributesJson}
               onChange={(e) => setAttributesJson(e.target.value)}
               style={{ width: '100%', height: '250px', fontFamily: 'monospace', fontSize: '0.85rem' }}
             />
          ) : (
             <pre style={{ width: '100%', height: '250px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '4px', fontSize: '0.85rem', color: '#a78bfa' }}>
               {JSON.stringify(thing.attributes || {}, null, 2)}
             </pre>
          )}
        </div>

        {/* Panel C: Features */}
        <div className="glass-panel panel-c" style={{ padding: '1.5rem' }}>
          <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Panel C: Features</h3>
          
          {!thing.features || Object.keys(thing.features).length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>Chưa có tính năng (features) nào.</p>
          ) : (
            <div className="accordion-container" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {Object.entries(thing.features).map(([featureId, featureData]) => {
                const isOpen = activeFeature === featureId;
                const props = featureData.properties || {};
                const desired = featureData.desiredProperties || {};
                
                return (
                  <div key={featureId} className="accordion-item" style={{ border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
                    <div 
                      className="accordion-header" 
                      style={{ padding: '0.75rem 1rem', background: isOpen ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                      onClick={() => setActiveFeature(isOpen ? null : featureId)}
                    >
                      <strong style={{ color: isOpen ? '#93c5fd' : 'var(--text-main)' }}>{featureId}</strong>
                      <span>{isOpen ? '▲' : '▼'}</span>
                    </div>
                    
                    {isOpen && (
                      <div className="accordion-body" style={{ padding: '1rem', background: 'rgba(0,0,0,0.1)' }}>
                         {Object.keys(props).length === 0 ? <p style={{ color: 'var(--text-muted)' }}>Không có properties.</p> : null}
                         
                         <div style={{ display: 'grid', gap: '1rem' }}>
                           {Object.entries(props).map(([propKey, propVal]) => {
                             const desVal = desired[propKey];
                             const hasDesired = desVal !== undefined;
                             const isDesync = hasDesired && propVal !== desVal;
                             const isNumeric = typeof propVal === 'number';
                             
                             return (
                               <div key={propKey} style={{ background: 'rgba(255,255,255,0.02)', padding: '0.75rem', borderRadius: '4px', borderLeft: isDesync ? '3px solid var(--danger)' : '3px solid var(--success)' }}>
                                 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                    <span style={{ fontWeight: 600 }}>{propKey}</span>
                                    {isDesync && <span style={{ fontSize: '0.7rem', color: '#fca5a5', background: 'rgba(239,68,68,0.2)', padding: '2px 6px', borderRadius: '4px' }}>Chưa đồng bộ</span>}
                                 </div>
                                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.85rem' }}>
                                    <div>
                                      <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase' }}>Current Value</div>
                                      <div style={{ fontSize: '1.1rem', color: isDesync ? '#fca5a5' : '#6ee7b7' }}>{JSON.stringify(propVal)}</div>
                                    </div>
                                    {hasDesired && (
                                      <div>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase' }}>Desired Value</div>
                                        <div style={{ fontSize: '1.1rem', color: '#93c5fd' }}>{JSON.stringify(desVal)}</div>
                                      </div>
                                    )}
                                 </div>
                                 
                                 {/* Optional Chart for numerical data */}
                                 {isNumeric && (
                                    <div style={{ height: '120px', marginTop: '1rem' }}>
                                       <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={generateMockChartData(propVal)}>
                                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                          <XAxis dataKey="time" hide />
                                          <YAxis domain={['auto', 'auto']} width={30} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                          <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '4px', color: '#fff' }} />
                                          <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} />
                                        </LineChart>
                                      </ResponsiveContainer>
                                    </div>
                                 )}
                               </div>
                             );
                           })}
                         </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Panel D: Live Messages */}
        <div className="glass-panel panel-d" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Panel D: Live Messages</h3>
          
          <form onSubmit={handleSendMessage} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
            {msgStatus && <div style={{ fontSize: '0.8rem', color: msgStatus.type === 'error' ? 'var(--danger)' : 'var(--success)' }}>{msgStatus.text}</div>}
            <input 
              placeholder="Subject (VD: tempAlert)" 
              value={messageSubject}
              onChange={e => setMessageSubject(e.target.value)}
              required
              style={{ padding: '0.5rem', fontSize: '0.85rem' }}
            />
            <textarea 
              placeholder="Payload (JSON)" 
              value={messagePayload}
              onChange={e => setMessagePayload(e.target.value)}
              required
              rows={3}
              style={{ padding: '0.5rem', fontSize: '0.85rem', fontFamily: 'monospace' }}
            />
            <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-end', fontSize: '0.85rem', padding: '0.4rem 1rem' }}>Gửi Message (INBOX)</button>
          </form>

          <div style={{ flex: 1, borderTop: '1px solid var(--border-color)', paddingTop: '1rem', overflowY: 'auto', maxHeight: '200px' }}>
             <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Lịch sử gần đây</h4>
             {messagesLog.length === 0 ? <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Chưa có tin nhắn nào.</div> : (
               <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                 {messagesLog.map((log, idx) => (
                   <li key={idx} style={{ background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                       <span>{log.dir}</span>
                       <span>{log.time}</span>
                     </div>
                     <div style={{ fontWeight: 600, color: '#93c5fd', margin: '2px 0' }}>{log.subject}</div>
                     <div style={{ fontFamily: 'monospace', color: '#a78bfa', wordBreak: 'break-all' }}>{log.payload}</div>
                   </li>
                 ))}
               </ul>
             )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default Module2DTStatus;
