import Modal from './Modal';
import { getThingGoalAnchor } from '../../../goal_model/goals';
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import KGGraph from './KGGraph';
import ObjectController from './ObjectController';
import TargetGraphSetup from './TargetGraphSetup';
import { ArrowLeft, Layers, Database, Send, Maximize2, Code } from 'lucide-react';
import { getTwinStatus, STATUS_LABELS } from '../utils/twinPresentation';
import {
  DITTO_API_BASE_URL as BASE_URL,
  STATUS_POLL_INTERVAL_MS,
} from '../config';

const headers = (extra = {}) => ({
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  ...extra,
});

const Module2DTStatus = () => {
  const { id } = useParams();
  const thingId = decodeURIComponent(id);
  const navigate = useNavigate();

  const [thing, setThing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [section, setSection] = useState('overview');
  const [dataView, setDataView] = useState('visual');
  const [featureHistory, setFeatureHistory] = useState({});

  // Thuộc tính
  const [attributesJson, setAttributesJson] = useState('{}');
  const [editingAttributes, setEditingAttributes] = useState(false);
  const editingAttributesRef = useRef(false);
  editingAttributesRef.current = editingAttributes;
  const [attrError, setAttrError] = useState(null);

  // Tính năng & dữ liệu
  const [activeFeature, setActiveFeature] = useState(null);

  // Panel D: Messages
  const [messageSubject, setMessageSubject] = useState('');
  const [messagePayload, setMessagePayload] = useState('{}');
  const [messagesLog, setMessagesLog] = useState([]); // { time, dir, subject, payload }
  const [msgStatus, setMsgStatus] = useState(null);

  // Graph sizing
  const graphContainerRef = useRef(null);
  const [graphSize, setGraphSize] = useState({ width: 300, height: 200 });
  const [graphRefreshKey, setGraphRefreshKey] = useState(0);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showFullGraphModal, setShowFullGraphModal] = useState(false);
  const fullGraphDialogRef = useRef(null);
  const fullGraphContainerRef = useRef(null);
  const [fullGraphSize, setFullGraphSize] = useState({ width: 0, height: 0 });
  const [componentGoalAgentIds, setComponentGoalAgentIds] = useState([]);

  useEffect(() => {
    if (!showFullGraphModal) return;
    const dialog = fullGraphDialogRef.current;
    const container = fullGraphContainerRef.current;
    if (!dialog || !container) return;

    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';

    const updateSize = () => {
      const { clientWidth: width, clientHeight: height } = container;
      setFullGraphSize(previous => previous.width === width && previous.height === height
        ? previous : { width, height });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);

    return () => {
      observer.disconnect();
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [showFullGraphModal]);

  useEffect(() => {
    if (!thing) return;
    const componentThingIds = thing?.features?.components?.properties?.thingIds || [];
    if (componentThingIds.length === 0) {
      setComponentGoalAgentIds(prev => prev.length === 0 ? prev : []);
      return;
    }

    let isMounted = true;
    const fetchComponentAgents = async () => {
      try {
        const promises = componentThingIds.map(async (compId) => {
          const res = await fetch(`${BASE_URL}/things/${encodeURIComponent(compId)}`, { headers: headers() });
          if (!res.ok) return null;
          const data = await res.json();
          return getThingGoalAnchor(data);
        });
        const results = await Promise.all(promises);
        const validAgentIds = results.filter(Boolean);
        if (isMounted) {
          setComponentGoalAgentIds(prev => {
            if (prev.length === validAgentIds.length && prev.every((id, idx) => id === validAgentIds[idx])) {
              return prev;
            }
            return validAgentIds;
          });
        }
      } catch (err) {
        console.error("Lỗi khi tải goalAgentId của DT thành phần:", err);
      }
    };

    fetchComponentAgents();
    return () => {
      isMounted = false;
    };
  }, [thing]);

  useEffect(() => {
    const container = graphContainerRef.current;
    if (!container || section !== 'overview') return;
    const updateSize = () => {
      const { clientWidth: width, clientHeight: height } = container;
      if (width && height) setGraphSize(previous => previous.width === width && previous.height === height ? previous : { width, height });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [Boolean(thing), section]);

  // Fetch Thing Data
  const fetchThing = async () => {
    try {
      const res = await fetch(`${BASE_URL}/things/${encodeURIComponent(thingId)}`, { headers: headers() });
      if (!res.ok) throw new Error(`HTTP ${res.status} - ${res.statusText}`);
      const data = await res.json();
      setThing(data);
      const time = new Date().toLocaleTimeString('vi-VN');
      setFeatureHistory(previous => {
        const next = { ...previous };
        for (const [feature, featureData] of Object.entries(data.features || {})) {
          for (const [property, value] of Object.entries(featureData.properties || {})) {
            if (typeof value !== 'number') continue;
            const key = `${feature}/${property}`;
            next[key] = [...(previous[key] || []), { time, value }].slice(-30);
          }
        }
        return next;
      });
      if (!editingAttributesRef.current) {
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
    setFeatureHistory({});
    fetchThing();
    // Setup Auto-polling for real-time updates
    const interval = setInterval(() => {
      fetchThing();
    }, STATUS_POLL_INTERVAL_MS);
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
      const url =
  `${BASE_URL}/things/${encodeURIComponent(thingId)}` +
  `/inbox/messages/${encodeURIComponent(messageSubject)}` +
  `?channel=live&timeout=10`;
      const res = await fetch(url, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(parsed)
      });
      if (!res.ok && res.status !== 202) throw new Error(res.statusText);

      setMsgStatus({ type: 'success', text: 'Lệnh đã được chuyển tiếp. Theo dõi dữ liệu thiết bị để xác nhận kết quả.' });
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

    setSection('messages');
  };

  if (loading && !thing) {
    return <div style={{ padding: '3rem', textAlign: 'center' }}>Đang tải dữ liệu...</div>;
  }

  if (error && !thing) {
    return <div style={{ padding: '3rem', color: 'var(--danger)' }}>Lỗi: {error}</div>;
  }

  const status = getTwinStatus(thing);

  return (
    <div className="module2-container">
      <div className="page-heading detail-heading">
        <div className="detail-heading-main"><button className="icon-btn" aria-label="Quay lại danh sách bản sao số" onClick={() => navigate('/')}><ArrowLeft size={18} /></button><div><h1>{thing.attributes?.label || thingId.split(':').slice(1).join(':') || thingId}</h1><p>{thingId}</p></div></div>
        <span className={`status-badge ${status}`}><span className={`status-dot ${status}`} />{STATUS_LABELS[status]}</span>
      </div>
      {error && <div className="notice notice-error" role="alert">Không cập nhật được dữ liệu: {error}. Đang hiển thị dữ liệu gần nhất.</div>}
      <div className="detail-tabs" role="group" aria-label="Nội dung bản sao số">
        {[['overview', 'Tổng quan', Layers], ['data', 'Dữ liệu thiết bị', Database], ['messages', 'Gửi lệnh', Send]].map(([key, label, Icon]) => <button key={key} className={section === key ? 'is-selected' : ''} aria-pressed={section === key} onClick={() => setSection(key)}><Icon size={16} />{label}</button>)}
      </div>

      {section === 'data' && (
        <div className="device-data-toolbar">
          <p>{dataView === 'json' ? 'Toàn bộ dữ liệu hiện tại đã đồng bộ của bản sao số.' : 'Theo dõi thuộc tính và các giá trị của thiết bị.'}</p>
          <div className="device-data-view" role="group" aria-label="Cách hiển thị dữ liệu thiết bị">
            <button type="button" className={dataView === 'visual' ? 'is-selected' : ''} aria-pressed={dataView === 'visual'} onClick={() => setDataView('visual')}><Layers size={15} />Trực quan</button>
            <button type="button" className={dataView === 'json' ? 'is-selected' : ''} aria-pressed={dataView === 'json'} onClick={() => setDataView('json')}><Code size={16} />JSON</button>
          </div>
        </div>
      )}

      <div className="dashboard-grid">
        {/* Panel A: Identifier Info */}
        <div className="glass-panel panel-a" hidden={section !== 'overview'} style={{ padding: '1.5rem' }}>
          <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Thông tin bản sao số</h3>
          <div className="detail-properties">
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Thing ID:</span>
              <div style={{ wordBreak: 'break-all' }}>{thing.thingId}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Policy ID:</span>
              <div style={{ wordBreak: 'break-all' }}>{thing.policyId || 'Chưa thiết lập'}</div>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <span style={{ color: 'var(--text-muted)' }}>Definition (WoT TD URL):</span>
              <div style={{ wordBreak: 'break-all', color: 'var(--primary)' }}>{thing.definition || 'Không có'}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Tạo lúc:</span>
              <div>{thing._created ? new Date(thing._created).toLocaleString('vi-VN') : 'Chưa có dữ liệu'}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Cập nhật cuối:</span>
              <div>{thing._modified ? new Date(thing._modified).toLocaleString('vi-VN') : 'Chưa có dữ liệu'}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Phiên bản:</span>
              <div>{thing._revision || 0}</div>
            </div>
          </div>
        </div>

        {/* Panel E: KG Status */}
        <div className="glass-panel panel-e" hidden={section !== 'overview'} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3 style={{ margin: 0 }}>Đồ thị mục tiêu</h3>
            </div>
            <button className="btn" style={{ padding: '2px 8px', fontSize: '0.7rem', background: 'rgba(59,130,246,0.2)', color: '#315be8' }} onClick={() => setShowFullGraphModal(true)}><Maximize2 size={12} /> Mở rộng</button>
          </div>
          <div ref={graphContainerRef} className="graph-container">
            {(() => {
              const isLargeDT = !!thing?.features?.components?.properties?.thingIds?.length;
              return (
                <KGGraph 
                  key={graphRefreshKey} 
                  thingId={thingId} 
                  goalRootId={thing?.attributes?.goalRootId}
                  goalAgentId={thing?.attributes?.goalAgentId}
                  componentGoalAgentIds={componentGoalAgentIds}
                  isLarge={isLargeDT} 
                  width={graphSize.width} 
                  height={graphSize.height} 
                />
              );
            })()}
          </div>
        </div>


        <div className="glass-panel panel-f" hidden={section !== 'overview'}>
          <ObjectController 
            thingId={thingId} 
            goalRootId={thing?.attributes?.goalRootId}
            goalAgentId={thing?.attributes?.goalAgentId}
            onAction={handleControllerAction} 
            onOpenSetup={() => setShowSetupModal(true)} 
          />
        </div>


        <section className="glass-panel device-json-panel" hidden={section !== 'data' || dataView !== 'json'} aria-labelledby="device-json-title">
          <div className="device-json-heading">
            <h3 id="device-json-title">Dữ liệu JSON hiện tại</h3>
            <span>Chỉ xem</span>
          </div>
          {editingAttributes && <p className="device-json-note">Các thay đổi thuộc tính chưa lưu chưa xuất hiện trong dữ liệu này.</p>}
          <pre className="device-json-code" tabIndex={0} aria-label="Toàn bộ dữ liệu thiết bị dạng JSON"><code>{JSON.stringify(thing, null, 2)}</code></pre>
        </section>

        <div className="glass-panel panel-b" hidden={section !== 'data' || dataView !== 'visual'} style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>Thuộc tính</h3>
            {!editingAttributes ? (
              <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => setEditingAttributes(true)}>Sửa</button>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn" style={{ padding: '2px 8px', fontSize: '0.8rem', background: 'var(--surface-subtle)' }} onClick={() => { setEditingAttributes(false); setAttributesJson(JSON.stringify(thing.attributes || {}, null, 2)); setAttrError(null); }}>Hủy</button>
                <button className="btn btn-success" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={handleSaveAttributes}>Lưu</button>
              </div>
            )}
          </div>
          {attrError && <div style={{ color: 'var(--danger)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>{attrError}</div>}

          {editingAttributes ? (
            <textarea
              aria-label="Nội dung thuộc tính JSON"
              value={attributesJson}
              onChange={(e) => setAttributesJson(e.target.value)}
              style={{ width: '100%', height: '250px', fontFamily: 'monospace', fontSize: '0.85rem' }}
            />
          ) : (
            <pre style={{ width: '100%', height: '250px', overflowY: 'auto', background: 'rgba(229, 235, 245, 0.42)', padding: '1rem', borderRadius: '4px', fontSize: '0.85rem', color: '#7160ae' }}>
              {JSON.stringify(thing.attributes || {}, null, 2)}
            </pre>
          )}
        </div>


        <div className="glass-panel panel-c" hidden={section !== 'data' || dataView !== 'visual'} style={{ padding: '1.5rem' }}>
          <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Tính năng & dữ liệu</h3>
          <p className="feature-history-note">Biểu đồ ghi nhận tối đa 30 lần cập nhật trong phiên này.</p>

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
                    <button
                      type="button"
                      className="feature-toggle"
                      aria-expanded={isOpen}
                      onClick={() => setActiveFeature(isOpen ? null : featureId)}
                    >
                      <strong style={{ color: isOpen ? '#315be8' : 'var(--text-main)' }}>{featureId}</strong>
                      <span aria-hidden="true">{isOpen ? '−' : '+'}</span>
                    </button>

                    {isOpen && (
                      <div className="accordion-body" style={{ padding: '1rem', background: 'rgba(229, 235, 245, 0.42)' }}>
                        {Object.keys(props).length === 0 ? <p style={{ color: 'var(--text-muted)' }}>Không có properties.</p> : null}

                        <div style={{ display: 'grid', gap: '1rem' }}>
                          {Object.entries(props).map(([propKey, propVal]) => {
                            const desVal = desired[propKey];
                            const hasDesired = desVal !== undefined;
                            const isDesync = hasDesired && propVal !== desVal;
                            const isNumeric = typeof propVal === 'number';

                            return (
                              <div key={propKey} style={{ background: 'rgba(232, 238, 248, 0.4)', padding: '0.75rem', borderRadius: '4px', borderLeft: isDesync ? '3px solid var(--danger)' : '3px solid var(--success)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                  <span style={{ fontWeight: 600 }}>{propKey}</span>
                                  {isDesync && <span style={{ fontSize: '0.7rem', color: '#ba374b', background: 'rgba(239,68,68,0.2)', padding: '2px 6px', borderRadius: '4px' }}>Chưa đồng bộ</span>}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.85rem' }}>
                                  <div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'none' }}>Giá trị hiện tại</div>
                                    <div style={{ fontSize: '1.1rem', color: isDesync ? '#ba374b' : '#14755d' }}>{JSON.stringify(propVal)}</div>
                                  </div>
                                  {hasDesired && (
                                    <div>
                                      <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'none' }}>Giá trị mong muốn</div>
                                      <div style={{ fontSize: '1.1rem', color: '#315be8' }}>{JSON.stringify(desVal)}</div>
                                    </div>
                                  )}
                                </div>


                                {isNumeric && featureHistory[`${featureId}/${propKey}`]?.length > 1 && (
                                  <div style={{ height: '120px', marginTop: '1rem' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                      <LineChart data={featureHistory[`${featureId}/${propKey}`] || []}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(81, 107, 145, 0.18)" />
                                        <XAxis dataKey="time" hide />
                                        <YAxis domain={['auto', 'auto']} width={30} tick={{ fontSize: 10, fill: '#5f6e83' }} />
                                        <Tooltip labelStyle={{ color: 'var(--text-muted)' }} contentStyle={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-main)', fontSize: '.72rem' }} />
                                        <Line name="Giá trị" type="monotone" dataKey="value" stroke="#315be8" strokeWidth={2} dot={false} isAnimationActive={false} />
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


        <div className="glass-panel panel-d" hidden={section !== 'messages'} style={{ gridColumn: 'span 12', padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Gửi lệnh đến thiết bị</h3>

          <form onSubmit={handleSendMessage} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
            {msgStatus && <div role="status" style={{ fontSize: '0.8rem', color: msgStatus.type === 'error' ? 'var(--danger)' : 'var(--success)' }}>{msgStatus.text}</div>}
            <input
              aria-label="Tên lệnh"
              placeholder="Tên lệnh (ví dụ: set_temperature)"
              value={messageSubject}
              onChange={e => setMessageSubject(e.target.value)}
              required
              style={{ padding: '0.5rem', fontSize: '0.85rem' }}
            />
            <textarea
              aria-label="Nội dung lệnh JSON"
              placeholder="Nội dung lệnh (JSON)"
              value={messagePayload}
              onChange={e => setMessagePayload(e.target.value)}
              required
              rows={3}
              style={{ padding: '0.5rem', fontSize: '0.85rem', fontFamily: 'monospace' }}
            />
            <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-end', fontSize: '0.85rem', padding: '0.4rem 1rem' }}>Gửi lệnh</button>
          </form>

          <div style={{ flex: 1, borderTop: '1px solid var(--border-color)', paddingTop: '1rem', overflowY: 'auto', maxHeight: '200px' }}>
            <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Lịch sử gần đây</h4>
            {messagesLog.length === 0 ? <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Các lệnh đã gửi trong phiên này sẽ xuất hiện ở đây.</div> : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {messagesLog.map((log, idx) => (
                  <li key={idx} style={{ background: 'rgba(232, 238, 248, 0.4)', padding: '0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                      <span>{log.dir}</span>
                      <span>{log.time}</span>
                    </div>
                    <div style={{ fontWeight: 600, color: '#315be8', margin: '2px 0' }}>{log.subject}</div>
                    <div style={{ fontFamily: 'monospace', color: '#7160ae', wordBreak: 'break-all' }}>{log.payload}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

      </div>

      {showSetupModal && (
        <Modal title="Thiết lập đồ thị mục tiêu" onClose={() => setShowSetupModal(false)}>
          <div className="modal-content glass-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '850px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Thiết lập Biểu đồ Mục tiêu</h2>
              <button className="close-btn" onClick={() => setShowSetupModal(false)} style={{ fontSize: '1.5rem', background: 'transparent' }}>&times;</button>
            </div>
            <div style={{ maxHeight: '75vh', overflowY: 'auto', paddingRight: '0.5rem' }}>
              <TargetGraphSetup hidePreview={true} onGraphChange={() => setGraphRefreshKey(prev => prev + 1)} />
            </div>
          </div>
        </Modal>
      )}

      {showFullGraphModal && createPortal(
          <dialog
            ref={fullGraphDialogRef}
            className="full-graph-dialog"
            aria-labelledby="full-graph-title"
            onCancel={(event) => {
              event.preventDefault();
              setShowFullGraphModal(false);
            }}
          >
            <div className="modal-header">
              <h2 id="full-graph-title" className="modal-title">Biểu đồ mục tiêu đầy đủ - {thingId}</h2>
              <button type="button" className="close-btn" autoFocus aria-label="Đóng đồ thị toàn màn hình" onClick={() => setShowFullGraphModal(false)} style={{ fontSize: '1.5rem', background: 'transparent' }}>&times;</button>
            </div>
            <div ref={fullGraphContainerRef} className="full-graph-canvas">
              {fullGraphSize.width > 0 && fullGraphSize.height > 0 && (() => {
                const isLargeDT = !!thing?.features?.components?.properties?.thingIds?.length;
                return (
                  <KGGraph 
                    key={graphRefreshKey} 
                    thingId={thingId} 
                    goalRootId={thing?.attributes?.goalRootId}
                    goalAgentId={thing?.attributes?.goalAgentId}
                    componentGoalAgentIds={componentGoalAgentIds}
                    isLarge={isLargeDT} 
                    width={fullGraphSize.width}
                    height={fullGraphSize.height}
                  />
                );
              })()}
            </div>
          </dialog>,
          document.body
      )}
    </div>
  );
};

export default Module2DTStatus;
