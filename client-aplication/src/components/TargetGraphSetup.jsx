import React, { useState, useRef } from 'react';
import neo4j from 'neo4j-driver';
import KGGraph from './KGGraph';
import { NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD } from '../config';

// Khởi tạo driver bên ngoài để dùng chung
const driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));
console.log('Driver TargetGraphSetup khởi tạo:', NEO4J_URI);

const TargetGraphSetup = ({ onGraphChange, hidePreview }) => {
  const [activeTab, setActiveTab] = useState('node');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const fileInputRef = useRef(null);

  // Add Node State
  const [nodeData, setNodeData] = useState({
    label: 'Goal',
    name: '',
    description: '',
    type: 'achieve',
    command: '',
    properties: ''
  });

  // Add Relation State
  const [relData, setRelData] = useState({
    source: '',
    target: '',
    type: 'and',
    properties: ''
  });

  const showStatus = (type, message) => {
    setStatus({ type, message });
    setTimeout(() => setStatus({ type: '', message: '' }), 5000);
  };

  const runQuery = async (query, params = {}) => {
    setLoading(true);
    const session = driver.session();
    try {
      await session.run(query, params);
      showStatus('success', 'Thực thi thành công!');
      if (onGraphChange) {
        onGraphChange();
      }
    } catch (err) {
      console.error('Neo4j Error:', err);
      showStatus('danger', `Lỗi: ${err.message}`);
    } finally {
      await session.close();
      setLoading(false);
    }
  };

  const handleAddNode = async (e) => {
    e.preventDefault();
    if (!nodeData.name) return showStatus('danger', 'Vui lòng nhập tên node');

    // Construct dynamic properties if any
    let props = {
      name: nodeData.name,
      description: nodeData.description
    };

    if (nodeData.label === 'Goal') {
      props.type = nodeData.type;
    }

    if (nodeData.label === 'Task' && nodeData.command) {
      props.command = nodeData.command;
    }

    if (nodeData.properties) {
      try {
        const extraProps = JSON.parse(nodeData.properties);
        props = { ...props, ...extraProps };
      } catch (e) {
        return showStatus('danger', 'Properties phải là định dạng JSON hợp lệ');
      }
    }

    const query = `CREATE (n:${nodeData.label} $props) RETURN n`;
    await runQuery(query, { props });
    setNodeData({
      label: nodeData.label,
      name: '',
      description: '',
      type: 'achieve',
      command: '',
      properties: ''
    });
  };

  const handleAddRelation = async (e) => {
    e.preventDefault();
    if (!relData.source || !relData.target) return showStatus('danger', 'Vui lòng nhập source và target node');

    let props = {};
    if (relData.properties) {
      try {
        props = JSON.parse(relData.properties);
      } catch (e) {
        return showStatus('danger', 'Properties phải là định dạng JSON hợp lệ');
      }
    }

    // We try to match by name first, as it's the most intuitive for users
    const query = `
      MATCH (a), (b)
      WHERE (a.name = $source OR id(a) = toInteger($source)) 
        AND (b.name = $target OR id(b) = toInteger($target))
      CREATE (a)-[r:${relData.type.toUpperCase()} $props]->(b)
      RETURN r
    `;
    await runQuery(query, { source: relData.source, target: relData.target, props });
    setRelData({ source: '', target: '', type: 'and', properties: '' });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const extension = file.name.split('.').pop().toLowerCase();

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target.result;
      let queries = [];

      if (extension === 'md' || extension === 'markdown') {
        const regex = /```(?:cypher|neo4j)?([\s\S]*?)```/gi;
        let match;
        const blocks = [];
        while ((match = regex.exec(content)) !== null) {
          blocks.push(match[1].trim());
        }

        if (blocks.length > 0) {
          queries = blocks
            .join('\n')
            .split(';')
            .map(q => q.trim())
            .filter(q => q.length > 0);
        } else {
          queries = content
            .split(';')
            .map(q => q.trim())
            .filter(q => q.length > 0);
        }
      } else {
        queries = content
          .split(';')
          .map(q => q.trim())
          .filter(q => q.length > 0);
      }

      if (queries.length === 0) {
        showStatus('danger', 'Không tìm thấy câu truy vấn nào hợp lệ trong file.');
        return;
      }

      setLoading(true);
      const session = driver.session();
      try {
        for (const query of queries) {
          await session.run(query);
        }
        showStatus('success', `Đã thực thi ${queries.length} câu truy vấn từ file.`);
        if (onGraphChange) {
          onGraphChange();
        }
      } catch (err) {
        showStatus('danger', `Lỗi khi chạy file: ${err.message}`);
      } finally {
        await session.close();
        setLoading(false);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="glass-panel" style={{ padding: '2rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--text-main)' }}>
          Thiết lập Biểu đồ Mục tiêu
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Tùy chỉnh cấu trúc mục tiêu (Goal Tree) cho Digital Twin của bạn.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
        {[
          { id: 'node', label: 'Thêm Node', icon: '⊕' },
          { id: 'relation', label: 'Thêm Quan hệ', icon: '⇄' },
          { id: 'file', label: 'Truy vấn File', icon: '📄' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '0.5rem 1rem',
              background: activeTab === tab.id ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
              color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-muted)',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s'
            }}
          >
            <span style={{ fontSize: '1.2rem' }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Status Message */}
      {status.message && (
        <div style={{
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          background: status.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          color: status.type === 'success' ? '#10b981' : '#ef4444',
          border: `1px solid ${status.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
          animation: 'fadeIn 0.3s ease'
        }}>
          {status.message}
        </div>
      )}

      <div style={{ flex: 1 }}>
        {/* Add Node Form */}
        {activeTab === 'node' && (
          <form onSubmit={handleAddNode} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="form-group">
              <label>Loại Node</label>
              <select
                value={nodeData.label}
                onChange={(e) => setNodeData({ ...nodeData, label: e.target.value })}
              >
                <option value="Goal">Goal (Mục tiêu)</option>
                <option value="Task">Task (Nhiệm vụ)</option>
              </select>
            </div>
            {nodeData.label === 'Goal' && (
              <div className="form-group">
                <label>Kiểu (Type)</label>
                <select
                  value={nodeData.type}
                  onChange={(e) => setNodeData({ ...nodeData, type: e.target.value })}
                >
                  <option value="achieve">Achieve (Đạt được)</option>
                  <option value="maintain">Maintain (Duy trì)</option>
                  <option value="avoid">Avoid (Tránh)</option>
                </select>
              </div>
            )}
            {nodeData.label === 'Task' && (
              <div className="form-group">
                <label>Lệnh (Command)</label>
                <input
                  type="text"
                  placeholder="VD: heat_water --temp 90"
                  value={nodeData.command}
                  onChange={(e) => setNodeData({ ...nodeData, command: e.target.value })}
                />
              </div>
            )}
            <div className="form-group">
              <label>Tên Node</label>
              <input
                type="text"
                placeholder="VD: Heat Water"
                value={nodeData.name}
                onChange={(e) => setNodeData({ ...nodeData, name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Mô tả</label>
              <textarea
                rows="2"
                placeholder="Mô tả ngắn gọn về node này..."
                value={nodeData.description}
                onChange={(e) => setNodeData({ ...nodeData, description: e.target.value })}
              ></textarea>
            </div>
            <div className="form-group">
              <label>Thuộc tính bổ sung (JSON)</label>
              <input
                type="text"
                placeholder='{"unit": "celsius", "min": 0}'
                value={nodeData.properties}
                onChange={(e) => setNodeData({ ...nodeData, properties: e.target.value })}
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: '1rem' }}>
              {loading ? <div className="loading-spinner"></div> : 'Thêm Node mới'}
            </button>
          </form>
        )}

        {/* Add Relation Form */}
        {activeTab === 'relation' && (
          <form onSubmit={handleAddRelation} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label>Node Gốc (ID hoặc Tên)</label>
                <input
                  type="text"
                  placeholder="Source"
                  value={relData.source}
                  onChange={(e) => setRelData({ ...relData, source: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Node Đích (ID hoặc Tên)</label>
                <input
                  type="text"
                  placeholder="Target"
                  value={relData.target}
                  onChange={(e) => setRelData({ ...relData, target: e.target.value })}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Loại Quan hệ (Logic)</label>
              <select
                value={relData.type}
                onChange={(e) => setRelData({ ...relData, type: e.target.value })}
              >
                <option value="and">AND (Và)</option>
                <option value="or">OR (Hoặc)</option>
                <option value="depends_on">DEPENDS_ON (Phụ thuộc)</option>
                <option value="controls">CONTROLS (Điều khiển)</option>
                <option value="has_capability">HAS_CAPABILITY (Có khả năng)</option>
              </select>
            </div>
            <div className="form-group">
              <label>Thuộc tính Quan hệ (JSON)</label>
              <input
                type="text"
                placeholder='{"weight": 1.0}'
                value={relData.properties}
                onChange={(e) => setRelData({ ...relData, properties: e.target.value })}
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: '1rem' }}>
              {loading ? <div className="loading-spinner"></div> : 'Tạo Liên kết'}
            </button>
          </form>
        )}

        {/* Query File Upload */}
        {activeTab === 'file' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center', justifyContent: 'center', padding: '2rem', border: '2px dashed var(--border-color)', borderRadius: '12px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📁</div>
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ marginBottom: '0.5rem' }}>Tải lên file Cypher / Markdown</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                Hỗ trợ file .cypher, .txt, .md hoặc .markdown chứa các câu lệnh (tự động trích xuất các block ```cypher trong markdown)
              </p>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept=".cypher,.txt,.md,.markdown"
              onChange={handleFileUpload}
            />
            <button
              className="btn btn-primary"
              onClick={() => fileInputRef.current.click()}
              disabled={loading}
            >
              {loading ? <div className="loading-spinner"></div> : 'Chọn File từ máy tính'}
            </button>
          </div>
        )}
      </div>

      <div style={{ marginTop: 'auto', paddingTop: '2rem', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
        Kết nối trực tiếp tới Neo4j Instance: <code style={{ color: 'var(--primary)' }}>{NEO4J_URI}</code>
      </div>

      {!hidePreview && (
        <div style={{ marginTop: '2rem', flex: 1, minHeight: '400px', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--text-main)' }}>Xem trước Biểu đồ</h3>
          <div style={{ height: '350px', width: '100%', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', overflow: 'hidden' }}>
            <KGGraph key={status.message} width={800} height={350} />
          </div>
        </div>
      )}
    </div>
  );
};

export default TargetGraphSetup;
