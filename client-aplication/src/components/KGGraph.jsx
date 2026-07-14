import React, { useState, useEffect, useMemo, useRef } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import neo4j from 'neo4j-driver';
import { NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD, NEO4J_QUERY_LIMIT } from '../config';


let driver;
try {
  driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));
  console.log('Driver Neo4j đã khởi tạo với URI:', NEO4J_URI);
} catch (err) {
  console.error('Lỗi khởi tạo driver:', err);
}

const KGGraph = ({ thingId, goalAgentId, width, height }) => {
  const [data, setData] = useState({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [localRefreshKey, setLocalRefreshKey] = useState(0);
  const [showControlPanel, setShowControlPanel] = useState(false);
  const [activeTab, setActiveTab] = useState('add-node'); // 'add-node' | 'add-link' | 'import-file'
  const [submitting, setSubmitting] = useState(false);
  const [formStatus, setFormStatus] = useState({ type: '', message: '' });
  const fileInputRef = useRef(null);

  const [nodeData, setNodeData] = useState({
    label: 'Goal',
    name: '',
    description: '',
    type: 'achieve',
    command: '',
    createRelation: false,
    targetNodeId: '',
    relType: 'REFINES',
    refinesType: 'AND',
    direction: 'new-to-target',
    dependsOnType: 'ACHIEVED',
    dependsOnDescription: '',
    sourceParameter: '',
    targetParameter: '',
    factor: 1.0,
    offset: 0.0
  });

  const [linkData, setLinkData] = useState({
    sourceNodeId: '',
    targetNodeId: '',
    relType: 'REFINES',
    refinesType: 'AND',
    dependsOnType: 'ACHIEVED',
    dependsOnDescription: '',
    sourceParameter: '',
    targetParameter: '',
    factor: 1.0,
    offset: 0.0
  });

  const [selectedElement, setSelectedElement] = useState(null);
  const [editNodeData, setEditNodeData] = useState({
    name: '',
    description: '',
    type: 'achieve',
    command: ''
  });
  const [editLinkType, setEditLinkType] = useState('REFINES');
  const [editLinkRefinesType, setEditLinkRefinesType] = useState('AND');
  const [editLinkDependsOnType, setEditLinkDependsOnType] = useState('ACHIEVED');
  const [editLinkDescription, setEditLinkDescription] = useState('');
  const [editLinkSourceParam, setEditLinkSourceParam] = useState('');
  const [editLinkTargetParam, setEditLinkTargetParam] = useState('');
  const [editLinkFactor, setEditLinkFactor] = useState(1.0);
  const [editLinkOffset, setEditLinkOffset] = useState(0.0);

  useEffect(() => {
    if (selectedElement) {
      if (selectedElement.type === 'node') {
        const props = selectedElement.data.properties || {};
        setEditNodeData({
          name: selectedElement.data.name || '',
          description: props.description || '',
          type: props.type || 'achieve',
          command: props.command || ''
        });
      } else if (selectedElement.type === 'link') {
        setEditLinkType(selectedElement.data.label || 'REFINES');
        const props = selectedElement.data.properties || {};
        setEditLinkRefinesType(props.type || 'AND');
        setEditLinkDependsOnType(props.type || 'ACHIEVED');
        setEditLinkDescription(props.description || '');
        setEditLinkSourceParam(props.sourceParameter || '');
        setEditLinkTargetParam(props.targetParameter || '');
        setEditLinkFactor(props.factor !== undefined ? props.factor : 1.0);
        setEditLinkOffset(props.offset !== undefined ? props.offset : 0.0);
      }
    }
  }, [selectedElement]);

  const handleAddNode = async (e) => {
    e.preventDefault();
    if (!nodeData.name) {
      setFormStatus({ type: 'danger', message: 'Vui lòng nhập tên node.' });
      return;
    }
    if (data.nodes.length > 0 && !nodeData.targetNodeId) {
      setFormStatus({ type: 'danger', message: 'Bắt buộc phải chọn node liên kết trong KG của nó.' });
      return;
    }
    setSubmitting(true);
    setFormStatus({ type: '', message: '' });
    const session = driver.session();
    try {
      const props = {
        id: nodeData.name.toLowerCase().replace(/\s+/g, '-'),
        name: nodeData.name,
        description: nodeData.description
      };
      if (nodeData.label === 'Goal') {
        props.type = nodeData.type;
      }
      if (nodeData.label === 'Task' && nodeData.command) {
        props.command = nodeData.command;
      }

      const createNodeQuery = `CREATE (n:${nodeData.label} $props) RETURN n`;
      const result = await session.run(createNodeQuery, { props });
      const newNode = result.records[0].get('n');
      const newNodeId = newNode.identity.toString();

      if (data.nodes.length > 0 && nodeData.targetNodeId) {
        let createRelQuery;
        let relProps = {};
        if (nodeData.relType === 'REFINES') {
          relProps = { type: nodeData.refinesType };
        } else if (nodeData.relType === 'DEPENDS_ON') {
          relProps = {
            type: nodeData.dependsOnType,
            description: nodeData.dependsOnDescription
          };
          if (nodeData.dependsOnType === 'PARAMETER') {
            relProps.sourceParameter = nodeData.sourceParameter;
            relProps.targetParameter = nodeData.targetParameter;
            relProps.factor = parseFloat(nodeData.factor) || 0.0;
            relProps.offset = parseFloat(nodeData.offset) || 0.0;
          }
        }
        if (nodeData.direction === 'new-to-target') {
          createRelQuery = `
            MATCH (a), (b)
            WHERE id(a) = toInteger($sourceId) AND id(b) = toInteger($targetId)
            CREATE (a)-[r:${nodeData.relType.toUpperCase()} $relProps]->(b)
            RETURN r
          `;
        } else {
          createRelQuery = `
            MATCH (a), (b)
            WHERE id(a) = toInteger($sourceId) AND id(b) = toInteger($targetId)
            CREATE (b)-[r:${nodeData.relType.toUpperCase()} $relProps]->(a)
            RETURN r
          `;
        }
        await session.run(createRelQuery, {
          sourceId: newNodeId,
          targetId: nodeData.targetNodeId,
          relProps
        });
      }

      setFormStatus({ type: 'success', message: 'Thêm node thành công!' });
      setNodeData({
        label: 'Goal',
        name: '',
        description: '',
        type: 'achieve',
        command: '',
        createRelation: false,
        targetNodeId: '',
        relType: 'REFINES',
        refinesType: 'AND',
        direction: 'new-to-target',
        dependsOnType: 'ACHIEVED',
        dependsOnDescription: '',
        sourceParameter: '',
        targetParameter: '',
        factor: 1.0,
        offset: 0.0
      });
      setLocalRefreshKey(prev => prev + 1);
    } catch (err) {
      console.error('Lỗi thêm node:', err);
      setFormStatus({ type: 'danger', message: `Lỗi: ${err.message}` });
    } finally {
      await session.close();
      setSubmitting(false);
    }
  };

  const handleCreateLink = async (e) => {
    e.preventDefault();
    if (!linkData.sourceNodeId || !linkData.targetNodeId) {
      setFormStatus({ type: 'danger', message: 'Vui lòng chọn đầy đủ node nguồn và đích.' });
      return;
    }
    if (linkData.sourceNodeId === linkData.targetNodeId) {
      setFormStatus({ type: 'danger', message: 'Node nguồn và đích không được trùng nhau.' });
      return;
    }
    setSubmitting(true);
    setFormStatus({ type: '', message: '' });
    const session = driver.session();
    try {
      let relProps = {};
      if (linkData.relType === 'REFINES') {
        relProps = { type: linkData.refinesType };
      } else if (linkData.relType === 'DEPENDS_ON') {
        relProps = {
          type: linkData.dependsOnType,
          description: linkData.dependsOnDescription
        };
        if (linkData.dependsOnType === 'PARAMETER') {
          relProps.sourceParameter = linkData.sourceParameter;
          relProps.targetParameter = linkData.targetParameter;
          relProps.factor = parseFloat(linkData.factor) || 0.0;
          relProps.offset = parseFloat(linkData.offset) || 0.0;
        }
      }
      const query = `
        MATCH (a), (b)
        WHERE id(a) = toInteger($sourceId) AND id(b) = toInteger($targetId)
        CREATE (a)-[r:${linkData.relType.toUpperCase()} $relProps]->(b)
        RETURN r
      `;
      await session.run(query, {
        sourceId: linkData.sourceNodeId,
        targetId: linkData.targetNodeId,
        relProps
      });
      setFormStatus({ type: 'success', message: 'Tạo liên kết thành công!' });
      setLinkData({
        sourceNodeId: '',
        targetNodeId: '',
        relType: 'REFINES',
        refinesType: 'AND',
        dependsOnType: 'ACHIEVED',
        dependsOnDescription: '',
        sourceParameter: '',
        targetParameter: '',
        factor: 1.0,
        offset: 0.0
      });
      setLocalRefreshKey(prev => prev + 1);
    } catch (err) {
      console.error('Lỗi tạo liên kết:', err);
      setFormStatus({ type: 'danger', message: `Lỗi: ${err.message}` });
    } finally {
      await session.close();
      setSubmitting(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSubmitting(true);
    setFormStatus({ type: '', message: '' });

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
        setFormStatus({ type: 'danger', message: 'Không tìm thấy câu truy vấn nào hợp lệ trong file.' });
        setSubmitting(false);
        return;
      }

      const session = driver.session();
      try {
        for (const query of queries) {
          await session.run(query);
        }
        setFormStatus({ type: 'success', message: `Thực thi thành công ${queries.length} câu truy vấn từ file!` });
        setLocalRefreshKey(prev => prev + 1);
      } catch (err) {
        setFormStatus({ type: 'danger', message: `Lỗi: ${err.message}` });
      } finally {
        await session.close();
        setSubmitting(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  const handleUpdateNode = async (e) => {
    e.preventDefault();
    if (!selectedElement || selectedElement.type !== 'node') return;
    setSubmitting(true);
    setFormStatus({ type: '', message: '' });
    const session = driver.session();
    try {
      const nodeId = selectedElement.data.id;
      const props = {
        name: editNodeData.name,
        description: editNodeData.description
      };
      if (selectedElement.data.type === 'Goal') {
        props.type = editNodeData.type;
      }
      if (selectedElement.data.type === 'Task' && editNodeData.command) {
        props.command = editNodeData.command;
      }

      const query = `
        MATCH (n)
        WHERE id(n) = toInteger($nodeId)
        SET n += $props
        RETURN n
      `;
      await session.run(query, { nodeId, props });
      setFormStatus({ type: 'success', message: 'Cập nhật node thành công!' });
      
      // Update selectedElement state locally so the UI updates
      setSelectedElement({
        ...selectedElement,
        data: {
          ...selectedElement.data,
          name: editNodeData.name,
          properties: {
            ...selectedElement.data.properties,
            ...props
          }
        }
      });
      
      setLocalRefreshKey(prev => prev + 1);
    } catch (err) {
      console.error('Lỗi cập nhật node:', err);
      setFormStatus({ type: 'danger', message: `Lỗi: ${err.message}` });
    } finally {
      await session.close();
      setSubmitting(false);
    }
  };

  const handleDeleteNode = async () => {
    if (!selectedElement || selectedElement.type !== 'node') return;
    if (!window.confirm(`Bạn có chắc chắn muốn xóa node "${selectedElement.data.name}" và tất cả liên kết liên quan?`)) return;
    setSubmitting(true);
    setFormStatus({ type: '', message: '' });
    const session = driver.session();
    try {
      const nodeId = selectedElement.data.id;
      const query = `
        MATCH (n)
        WHERE id(n) = toInteger($nodeId)
        DETACH DELETE n
      `;
      await session.run(query, { nodeId });
      setFormStatus({ type: 'success', message: 'Xóa node thành công!' });
      setSelectedElement(null);
      setLocalRefreshKey(prev => prev + 1);
    } catch (err) {
      console.error('Lỗi xóa node:', err);
      setFormStatus({ type: 'danger', message: `Lỗi: ${err.message}` });
    } finally {
      await session.close();
      setSubmitting(false);
    }
  };

  const handleDeleteLink = async () => {
    if (!selectedElement || selectedElement.type !== 'link') return;
    if (!window.confirm(`Bạn có chắc chắn muốn xóa liên kết giữa "${selectedElement.data.sourceName}" và "${selectedElement.data.targetName}"?`)) return;
    setSubmitting(true);
    setFormStatus({ type: '', message: '' });
    const session = driver.session();
    try {
      const { sourceId, targetId, label } = selectedElement.data;
      const query = `
        MATCH (a)-[r:${label}]->(b)
        WHERE id(a) = toInteger($sourceId) AND id(b) = toInteger($targetId)
        DELETE r
      `;
      await session.run(query, { sourceId, targetId });
      setFormStatus({ type: 'success', message: 'Xóa liên kết thành công!' });
      setSelectedElement(null);
      setLocalRefreshKey(prev => prev + 1);
    } catch (err) {
      console.error('Lỗi xóa liên kết:', err);
      setFormStatus({ type: 'danger', message: `Lỗi: ${err.message}` });
    } finally {
      await session.close();
      setSubmitting(false);
    }
  };

  const handleUpdateLink = async (e) => {
    e.preventDefault();
    if (!selectedElement || selectedElement.type !== 'link') return;
    if (editLinkType === selectedElement.data.label) {
      setFormStatus({ type: 'danger', message: 'Vui lòng chọn loại liên kết khác để thay đổi.' });
      return;
    }
    setSubmitting(true);
    setFormStatus({ type: '', message: '' });
    const session = driver.session();
    try {
      const { sourceId, targetId, label } = selectedElement.data;
      let relProps = {};
      if (editLinkType === 'REFINES') {
        relProps = { type: editLinkRefinesType };
      } else if (editLinkType === 'DEPENDS_ON') {
        relProps = {
          type: editLinkDependsOnType,
          description: editLinkDescription
        };
        if (editLinkDependsOnType === 'PARAMETER') {
          relProps.sourceParameter = editLinkSourceParam;
          relProps.targetParameter = editLinkTargetParam;
          relProps.factor = parseFloat(editLinkFactor) || 0.0;
          relProps.offset = parseFloat(editLinkOffset) || 0.0;
        }
      }
      const query = `
        MATCH (a)-[r:${label}]->(b)
        WHERE id(a) = toInteger($sourceId) AND id(b) = toInteger($targetId)
        CREATE (a)-[r2:${editLinkType.toUpperCase()}]->(b)
        SET r2 = $relProps
        DELETE r
      `;
      await session.run(query, { sourceId, targetId, relProps });
      setFormStatus({ type: 'success', message: 'Cập nhật liên kết thành công!' });
      
      setSelectedElement({
        ...selectedElement,
        data: {
          ...selectedElement.data,
          label: editLinkType.toUpperCase()
        }
      });
      
      setLocalRefreshKey(prev => prev + 1);
    } catch (err) {
      console.error('Lỗi cập nhật liên kết:', err);
      setFormStatus({ type: 'danger', message: `Lỗi: ${err.message}` });
    } finally {
      await session.close();
      setSubmitting(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const fetchGraph = async () => {
      if (!driver) {
        setError('Driver Neo4j chưa được khởi tạo.');
        setLoading(false);
        return;
      }

      if (!goalAgentId) {
        if (isMounted) {
          setData({ nodes: [], links: [] });
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setError(null);
      const session = driver.session();

      try {

        const query = goalAgentId
          ? `
            MATCH path = (agent:Agent {id: $goalAgentId})-[*0..5]-(m)
            RETURN path
          `
          : `
            MATCH (n)-[r]->(m)
            RETURN n, r, m
            LIMIT ${NEO4J_QUERY_LIMIT}
          `;

        const result = await session.run(query, { goalAgentId });

        const nodesMap = new Map();
        const links = [];
        const seenLinks = new Set();

        result.records.forEach(record => {
          if (goalAgentId) {
            const path = record.get('path');
            if (path) {
              const startNode = path.start;
              const endNode = path.end;

              [startNode, endNode].forEach(node => {
                if (node && !nodesMap.has(node.identity.toString())) {
                  const props = node.properties;
                  nodesMap.set(node.identity.toString(), {
                    id: node.identity.toString(),
                    name: props.name || props.id || node.labels[0] || 'Unknown',
                    type: node.labels[0] || 'Node',
                    properties: props,
                    val: node.labels[0] === 'Agent' ? 15 : (node.labels[0] === 'Goal' ? 12 : 8)
                  });
                }
              });

              path.segments.forEach(segment => {
                const n = segment.start;
                const m = segment.end;
                const r = segment.relationship;

                const linkKey = `${r.start.toString()}-${r.end.toString()}-${r.type}`;
                if (!seenLinks.has(linkKey)) {
                  seenLinks.add(linkKey);
                  links.push({
                    source: r.start.toString(),
                    target: r.end.toString(),
                    label: r.type,
                    properties: r.properties
                  });
                }
              });
            }
          } else {
            const n = record.get('n');
            const m = record.get('m');
            const r = record.get('r');


            [n, m].forEach(node => {
              if (node && !nodesMap.has(node.identity.toString())) {
                const props = node.properties;
                nodesMap.set(node.identity.toString(), {
                  id: node.identity.toString(),
                  name: props.name || props.id || node.labels[0] || 'Unknown',
                  type: node.labels[0] || 'Node',
                  properties: props,
                  val: node.labels[0] === 'Agent' ? 15 : (node.labels[0] === 'Goal' ? 12 : 8)
                });
              }
            });


            if (r) {
              const linkKey = `${r.start.toString()}-${r.end.toString()}-${r.type}`;
              if (!seenLinks.has(linkKey)) {
                seenLinks.add(linkKey);
                links.push({
                  source: r.start.toString(),
                  target: r.end.toString(),
                  label: r.type,
                  properties: r.properties
                });
              }
            }
          }
        });

        if (isMounted) {
          setData({
            nodes: Array.from(nodesMap.values()),
            links: links
          });
          setError(null);
        }
      } catch (err) {
        console.error('Neo4j Fetch Error:', err);
        if (isMounted) {
          setError(`Không thể kết nối Neo4j: ${err.message}`);
        }
      } finally {
        await session.close();
        if (isMounted) setLoading(false);
      }
    };

    fetchGraph();

    return () => {
      isMounted = false;
    };
  }, [thingId, goalAgentId, localRefreshKey]);

  const getNodeColor = (node) => {
    switch (node.type) {
      case 'Agent': return '#f87171';
      case 'Goal': return '#60a5fa';
      case 'Task':
      case 'Action': return '#34d399';
      case 'DT': return '#a78bfa';
      case 'Capability': return '#fbbf24';
      case 'Kettle': return '#a78bfa';
      default: return '#94a3b8';
    }
  };

  if (loading) {
    return (
      <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        <div className="loading-spinner"></div>
        <span style={{ marginLeft: '10px' }}>Đang tải dữ liệu thực từ Neo4j...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ width, height, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem', textAlign: 'center' }}>
        <div style={{ color: 'var(--danger)', marginBottom: '1rem' }}>⚠️ {error}</div>
        <button
          className="btn"
          style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.1)' }}
          onClick={() => window.location.reload()}
        >
          Thử lại
        </button>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', borderRadius: '8px' }}>
      <ForceGraph2D
        graphData={data}
        width={width}
        height={height}
        onNodeClick={(node) => {
          setSelectedElement({ type: 'node', data: node });
          setActiveTab('edit-delete');
          setShowControlPanel(true);
        }}
        onLinkClick={(link) => {
          const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
          const targetId = typeof link.target === 'object' ? link.target.id : link.target;
          const sourceNode = data.nodes.find(n => n.id === sourceId);
          const targetNode = data.nodes.find(n => n.id === targetId);
          setSelectedElement({
            type: 'link',
            data: {
              sourceId,
              targetId,
              label: link.label,
              sourceName: sourceNode ? sourceNode.name : sourceId,
              targetName: targetNode ? targetNode.name : targetId,
              properties: link.properties || {}
            }
          });
          setActiveTab('edit-delete');
          setShowControlPanel(true);
        }}
        nodeLabel={(node) => {
          const props = Object.entries(node.properties)
            .map(([k, v]) => `<div><b>${k}:</b> ${v}</div>`)
            .join('');
          return `<div style="background: rgba(15, 23, 42, 0.9); padding: 8px; border-radius: 4px; border: 1px solid var(--border-color); font-size: 11px;">
                        <div style="color: ${getNodeColor(node)}; font-weight: bold; margin-bottom: 4px;">${node.type}: ${node.name}</div>
                        ${props}
                    </div>`;
        }}
        nodeColor={getNodeColor}
        nodeRelSize={6}
        linkDirectionalArrowLength={3.5}
        linkDirectionalArrowRelPos={1}
        linkCurvature={0.25}
        linkColor={() => 'rgba(255, 255, 255, 0.2)'}
        linkWidth={1.5}
        linkLabel={(link) => {
          const typeStr = link.properties?.type ? ` (${link.properties.type})` : '';
          return `<div style="background: rgba(15, 23, 42, 0.9); padding: 6px 10px; border-radius: 4px; border: 1px solid var(--border-color); font-size: 11px; color: #fff;">
                    <b>Liên kết:</b> <span style="color: #a78bfa; font-weight: bold;">${link.label}${typeStr}</span>
                  </div>`;
        }}
        linkCanvasObjectMode={() => 'after'}
        linkCanvasObject={(link, ctx, globalScale) => {
          const start = link.source;
          const end = link.target;


          if (typeof start !== 'object' || typeof end !== 'object') return;


          const textPos = {
            x: start.x + (end.x - start.x) * 0.5,
            y: start.y + (end.y - start.y) * 0.5
          };

          const typeStr = link.properties?.type ? ` (${link.properties.type})` : '';
          const label = `${link.label}${typeStr}`;


          if (globalScale < 1.2) return;

          const fontSize = 8 / globalScale;
          ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;


          const textWidth = ctx.measureText(label).width;
          const paddingX = 4 / globalScale;
          const paddingY = 2 / globalScale;
          const bgW = textWidth + paddingX;
          const bgH = fontSize + paddingY;

          ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
          ctx.fillRect(textPos.x - bgW / 2, textPos.y - bgH / 2, bgW, bgH);


          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#94a3b8';
          ctx.fillText(label, textPos.x, textPos.y);
        }}
        nodeCanvasObject={(node, ctx, globalScale) => {
          const label = node.name;
          const fontSize = 12 / globalScale;
          ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;


          ctx.beginPath();
          ctx.arc(node.x, node.y, 5, 0, 2 * Math.PI, false);
          ctx.fillStyle = getNodeColor(node);
          ctx.fill();


          ctx.shadowColor = getNodeColor(node);
          ctx.shadowBlur = 10;
          ctx.stroke();
          ctx.shadowBlur = 0;


          if (globalScale > 1.5) {
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#cbd5e1';
            ctx.fillText(label, node.x, node.y + 10);
          }
        }}
      />

      {/* Control Panel Toggle Button */}
      <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 10 }}>
        <button
          className="btn btn-primary"
          onClick={() => {
            setShowControlPanel(!showControlPanel);
            setFormStatus({ type: '', message: '' });
          }}
          style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '5px' }}
        >
          {showControlPanel ? '✕ Đóng Thao tác' : '⚙️ Thao tác đồ thị'}
        </button>
      </div>

      {/* Collapsible Control Panel */}
      {showControlPanel && (
        <div className="glass-panel" style={{
          position: 'absolute',
          top: '45px',
          left: '10px',
          width: '320px',
          maxHeight: 'calc(100% - 60px)',
          overflowY: 'auto',
          zIndex: 10,
          padding: '12px',
          fontSize: '0.85rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px', gap: '10px' }}>
            <button
              onClick={() => { setActiveTab('add-node'); setFormStatus({ type: '', message: '' }); }}
              style={{
                background: 'transparent',
                border: 'none',
                color: activeTab === 'add-node' ? '#60a5fa' : '#94a3b8',
                fontWeight: activeTab === 'add-node' ? '600' : '400',
                cursor: 'pointer',
                padding: '2px 5px',
                borderBottom: activeTab === 'add-node' ? '2px solid #60a5fa' : 'none'
              }}
            >
              Thêm Node
            </button>
            <button
              onClick={() => { setActiveTab('add-link'); setFormStatus({ type: '', message: '' }); }}
              style={{
                background: 'transparent',
                border: 'none',
                color: activeTab === 'add-link' ? '#60a5fa' : '#94a3b8',
                fontWeight: activeTab === 'add-link' ? '600' : '400',
                cursor: 'pointer',
                padding: '2px 5px',
                borderBottom: activeTab === 'add-link' ? '2px solid #60a5fa' : 'none'
              }}
            >
              Tạo liên kết
            </button>
            <button
              onClick={() => { setActiveTab('import-file'); setFormStatus({ type: '', message: '' }); }}
              style={{
                background: 'transparent',
                border: 'none',
                color: activeTab === 'import-file' ? '#60a5fa' : '#94a3b8',
                fontWeight: activeTab === 'import-file' ? '600' : '400',
                cursor: 'pointer',
                padding: '2px 5px',
                borderBottom: activeTab === 'import-file' ? '2px solid #60a5fa' : 'none'
              }}
            >
              Nhập File
            </button>
            <button
              onClick={() => { setActiveTab('edit-delete'); setFormStatus({ type: '', message: '' }); }}
              style={{
                background: 'transparent',
                border: 'none',
                color: activeTab === 'edit-delete' ? '#60a5fa' : '#94a3b8',
                fontWeight: activeTab === 'edit-delete' ? '600' : '400',
                cursor: 'pointer',
                padding: '2px 5px',
                borderBottom: activeTab === 'edit-delete' ? '2px solid #60a5fa' : 'none'
              }}
            >
              Sửa/Xóa
            </button>
          </div>

          {/* Form Status Message */}
          {formStatus.message && (
            <div style={{
              padding: '6px 10px',
              borderRadius: '4px',
              backgroundColor: formStatus.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
              border: `1px solid ${formStatus.type === 'success' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
              color: formStatus.type === 'success' ? '#34d399' : '#f87171',
              fontSize: '0.8rem'
            }}>
              {formStatus.message}
            </div>
          )}

          {activeTab === 'add-node' ? (
            <form onSubmit={handleAddNode} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '2px', color: '#94a3b8', fontSize: '0.75rem' }}>Loại Node (Label)</label>
                <select
                  value={nodeData.label}
                  onChange={(e) => setNodeData({ ...nodeData, label: e.target.value })}
                  style={{ padding: '4px 8px', fontSize: '0.8rem', height: '30px' }}
                >
                  <option value="Goal">Goal</option>
                  <option value="Agent">Agent</option>
                  <option value="Task">Task</option>
                  <option value="Action">Action</option>
                  <option value="Capability">Capability</option>
                  <option value="DT">DT</option>
                  <option value="Kettle">Kettle</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '2px', color: '#94a3b8', fontSize: '0.75rem' }}>Tên Node *</label>
                <input
                  type="text"
                  placeholder="Nhập tên node..."
                  value={nodeData.name}
                  onChange={(e) => setNodeData({ ...nodeData, name: e.target.value })}
                  style={{ padding: '4px 8px', fontSize: '0.8rem', height: '30px' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '2px', color: '#94a3b8', fontSize: '0.75rem' }}>Mô tả</label>
                <textarea
                  placeholder="Nhập mô tả..."
                  value={nodeData.description}
                  onChange={(e) => setNodeData({ ...nodeData, description: e.target.value })}
                  style={{ padding: '4px 8px', fontSize: '0.8rem', height: '50px', resize: 'vertical' }}
                />
              </div>

              {nodeData.label === 'Goal' && (
                <div>
                  <label style={{ display: 'block', marginBottom: '2px', color: '#94a3b8', fontSize: '0.75rem' }}>Loại mục tiêu (Goal Type)</label>
                  <select
                    value={nodeData.type}
                    onChange={(e) => setNodeData({ ...nodeData, type: e.target.value })}
                    style={{ padding: '4px 8px', fontSize: '0.8rem', height: '30px' }}
                  >
                    <option value="achieve">achieve</option>
                    <option value="maintain">maintain</option>
                  </select>
                </div>
              )}

              {nodeData.label === 'Task' && (
                <div>
                  <label style={{ display: 'block', marginBottom: '2px', color: '#94a3b8', fontSize: '0.75rem' }}>Lệnh thực thi (Command)</label>
                  <input
                    type="text"
                    placeholder="Lệnh chạy task..."
                    value={nodeData.command}
                    onChange={(e) => setNodeData({ ...nodeData, command: e.target.value })}
                    style={{ padding: '4px 8px', fontSize: '0.8rem', height: '30px' }}
                  />
                </div>
              )}

              {data.nodes.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: '2px solid rgba(255,255,255,0.1)', paddingLeft: '8px', marginLeft: '4px', marginTop: '6px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '2px', color: '#94a3b8', fontSize: '0.75rem' }}>Chọn Node liên kết *</label>
                    <select
                      value={nodeData.targetNodeId}
                      onChange={(e) => setNodeData({ ...nodeData, targetNodeId: e.target.value })}
                      style={{ padding: '4px 8px', fontSize: '0.8rem', height: '30px' }}
                      required
                    >
                      <option value="">-- Chọn node trên đồ thị --</option>
                      {data.nodes.map(n => (
                        <option key={n.id} value={n.id}>{n.type}: {n.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '2px', color: '#94a3b8', fontSize: '0.75rem' }}>Loại liên kết</label>
                    <select
                      value={nodeData.relType}
                      onChange={(e) => setNodeData({ ...nodeData, relType: e.target.value })}
                      style={{ padding: '4px 8px', fontSize: '0.8rem', height: '30px' }}
                    >
                      <option value="REFINES">REFINES</option>
                      <option value="DELEGATED_TO">DELEGATED_TO</option>
                      <option value="OPERATIONALIZED_BY">OPERATIONALIZED_BY</option>
                      <option value="DEPENDS_ON">DEPENDS_ON</option>
                    </select>
                  </div>

                  {nodeData.relType === 'REFINES' && (
                    <div>
                      <label style={{ display: 'block', marginBottom: '2px', color: '#94a3b8', fontSize: '0.75rem' }}>Loại phân rã (Type)</label>
                      <select
                        value={nodeData.refinesType}
                        onChange={(e) => setNodeData({ ...nodeData, refinesType: e.target.value })}
                        style={{ padding: '4px 8px', fontSize: '0.8rem', height: '30px' }}
                      >
                        <option value="AND">AND</option>
                        <option value="OR">OR</option>
                      </select>
                    </div>
                  )}

                  {nodeData.relType === 'DEPENDS_ON' && (
                    <>
                      <div>
                        <label style={{ display: 'block', marginBottom: '2px', color: '#94a3b8', fontSize: '0.75rem' }}>Loại phụ thuộc (Type)</label>
                        <select
                          value={nodeData.dependsOnType}
                          onChange={(e) => setNodeData({ ...nodeData, dependsOnType: e.target.value })}
                          style={{ padding: '4px 8px', fontSize: '0.8rem', height: '30px' }}
                        >
                          <option value="ACHIEVED">ACHIEVED</option>
                          <option value="PARAMETER">PARAMETER</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '2px', color: '#94a3b8', fontSize: '0.75rem' }}>Mô tả phụ thuộc</label>
                        <textarea
                          placeholder="Mô tả phụ thuộc..."
                          value={nodeData.dependsOnDescription}
                          onChange={(e) => setNodeData({ ...nodeData, dependsOnDescription: e.target.value })}
                          style={{ padding: '4px 8px', fontSize: '0.8rem', height: '40px', resize: 'vertical' }}
                        />
                      </div>
                      {nodeData.dependsOnType === 'PARAMETER' && (
                        <>
                          <div>
                            <label style={{ display: 'block', marginBottom: '2px', color: '#94a3b8', fontSize: '0.75rem' }}>Source Parameter</label>
                            <input
                              type="text"
                              placeholder="Ví dụ: amount"
                              value={nodeData.sourceParameter}
                              onChange={(e) => setNodeData({ ...nodeData, sourceParameter: e.target.value })}
                              style={{ padding: '4px 8px', fontSize: '0.8rem', height: '30px' }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', marginBottom: '2px', color: '#94a3b8', fontSize: '0.75rem' }}>Target Parameter</label>
                            <input
                              type="text"
                              placeholder="Ví dụ: volume"
                              value={nodeData.targetParameter}
                              onChange={(e) => setNodeData({ ...nodeData, targetParameter: e.target.value })}
                              style={{ padding: '4px 8px', fontSize: '0.8rem', height: '30px' }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', marginBottom: '2px', color: '#94a3b8', fontSize: '0.75rem' }}>Factor</label>
                            <input
                              type="number"
                              step="any"
                              value={nodeData.factor}
                              onChange={(e) => setNodeData({ ...nodeData, factor: e.target.value })}
                              style={{ padding: '4px 8px', fontSize: '0.8rem', height: '30px' }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', marginBottom: '2px', color: '#94a3b8', fontSize: '0.75rem' }}>Offset</label>
                            <input
                              type="number"
                              step="any"
                              value={nodeData.offset}
                              onChange={(e) => setNodeData({ ...nodeData, offset: e.target.value })}
                              style={{ padding: '4px 8px', fontSize: '0.8rem', height: '30px' }}
                            />
                          </div>
                        </>
                      )}
                    </>
                  )}

                  <div>
                    <label style={{ display: 'block', marginBottom: '2px', color: '#94a3b8', fontSize: '0.75rem' }}>Chiều liên kết</label>
                    <select
                      value={nodeData.direction}
                      onChange={(e) => setNodeData({ ...nodeData, direction: e.target.value })}
                      style={{ padding: '4px 8px', fontSize: '0.8rem', height: '30px' }}
                    >
                      <option value="new-to-target">Node mới → Node được chọn</option>
                      <option value="target-to-new">Node được chọn → Node mới</option>
                    </select>
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="btn btn-success"
                disabled={submitting}
                style={{ fontSize: '0.8rem', padding: '6px 12px', marginTop: '4px' }}
              >
                {submitting ? 'Đang thêm...' : 'Lưu Node'}
              </button>
            </form>
          ) : activeTab === 'add-link' ? (
            <form onSubmit={handleCreateLink} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '2px', color: '#94a3b8', fontSize: '0.75rem' }}>Node Nguồn (Source)</label>
                <select
                  value={linkData.sourceNodeId}
                  onChange={(e) => setLinkData({ ...linkData, sourceNodeId: e.target.value })}
                  style={{ padding: '4px 8px', fontSize: '0.8rem', height: '30px' }}
                >
                  <option value="">-- Chọn node nguồn --</option>
                  {data.nodes.map(n => (
                    <option key={n.id} value={n.id}>{n.type}: {n.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '2px', color: '#94a3b8', fontSize: '0.75rem' }}>Chiều liên kết</label>
                <div style={{ textAlign: 'center', color: '#a78bfa', fontSize: '1.2rem', padding: '2px 0' }}>↓</div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '2px', color: '#94a3b8', fontSize: '0.75rem' }}>Node Đích (Target)</label>
                <select
                  value={linkData.targetNodeId}
                  onChange={(e) => setLinkData({ ...linkData, targetNodeId: e.target.value })}
                  style={{ padding: '4px 8px', fontSize: '0.8rem', height: '30px' }}
                >
                  <option value="">-- Chọn node đích --</option>
                  {data.nodes.map(n => (
                    <option key={n.id} value={n.id}>{n.type}: {n.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '2px', color: '#94a3b8', fontSize: '0.75rem' }}>Loại liên kết</label>
                <select
                  value={linkData.relType}
                  onChange={(e) => setLinkData({ ...linkData, relType: e.target.value })}
                  style={{ padding: '4px 8px', fontSize: '0.8rem', height: '30px' }}
                >
                  <option value="REFINES">REFINES</option>
                  <option value="DELEGATED_TO">DELEGATED_TO</option>
                  <option value="OPERATIONALIZED_BY">OPERATIONALIZED_BY</option>
                  <option value="DEPENDS_ON">DEPENDS_ON</option>
                </select>
              </div>

              {linkData.relType === 'REFINES' && (
                <div>
                  <label style={{ display: 'block', marginBottom: '2px', color: '#94a3b8', fontSize: '0.75rem' }}>Loại phân rã (Type)</label>
                  <select
                    value={linkData.refinesType}
                    onChange={(e) => setLinkData({ ...linkData, refinesType: e.target.value })}
                    style={{ padding: '4px 8px', fontSize: '0.8rem', height: '30px' }}
                  >
                    <option value="AND">AND</option>
                    <option value="OR">OR</option>
                  </select>
                </div>
              )}

              {linkData.relType === 'DEPENDS_ON' && (
                <>
                  <div>
                    <label style={{ display: 'block', marginBottom: '2px', color: '#94a3b8', fontSize: '0.75rem' }}>Loại phụ thuộc (Type)</label>
                    <select
                      value={linkData.dependsOnType}
                      onChange={(e) => setLinkData({ ...linkData, dependsOnType: e.target.value })}
                      style={{ padding: '4px 8px', fontSize: '0.8rem', height: '30px' }}
                    >
                      <option value="ACHIEVED">ACHIEVED</option>
                      <option value="PARAMETER">PARAMETER</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '2px', color: '#94a3b8', fontSize: '0.75rem' }}>Mô tả phụ thuộc</label>
                    <textarea
                      placeholder="Mô tả phụ thuộc..."
                      value={linkData.dependsOnDescription}
                      onChange={(e) => setLinkData({ ...linkData, dependsOnDescription: e.target.value })}
                      style={{ padding: '4px 8px', fontSize: '0.8rem', height: '40px', resize: 'vertical' }}
                    />
                  </div>
                  {linkData.dependsOnType === 'PARAMETER' && (
                    <>
                      <div>
                        <label style={{ display: 'block', marginBottom: '2px', color: '#94a3b8', fontSize: '0.75rem' }}>Source Parameter</label>
                        <input
                          type="text"
                          placeholder="Ví dụ: amount"
                          value={linkData.sourceParameter}
                          onChange={(e) => setLinkData({ ...linkData, sourceParameter: e.target.value })}
                          style={{ padding: '4px 8px', fontSize: '0.8rem', height: '30px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '2px', color: '#94a3b8', fontSize: '0.75rem' }}>Target Parameter</label>
                        <input
                          type="text"
                          placeholder="Ví dụ: volume"
                          value={linkData.targetParameter}
                          onChange={(e) => setLinkData({ ...linkData, targetParameter: e.target.value })}
                          style={{ padding: '4px 8px', fontSize: '0.8rem', height: '30px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '2px', color: '#94a3b8', fontSize: '0.75rem' }}>Factor</label>
                        <input
                          type="number"
                          step="any"
                          value={linkData.factor}
                          onChange={(e) => setLinkData({ ...linkData, factor: e.target.value })}
                          style={{ padding: '4px 8px', fontSize: '0.8rem', height: '30px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '2px', color: '#94a3b8', fontSize: '0.75rem' }}>Offset</label>
                        <input
                          type="number"
                          step="any"
                          value={linkData.offset}
                          onChange={(e) => setLinkData({ ...linkData, offset: e.target.value })}
                          style={{ padding: '4px 8px', fontSize: '0.8rem', height: '30px' }}
                        />
                      </div>
                    </>
                  )}
                </>
              )}

              <button
                type="submit"
                className="btn btn-success"
                disabled={submitting}
                style={{ fontSize: '0.8rem', padding: '6px 12px', marginTop: '4px' }}
              >
                {submitting ? 'Đang tạo...' : 'Tạo Liên Kết'}
              </button>
            </form>
          ) : activeTab === 'import-file' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: '1.4' }}>
                Chọn file chứa các câu truy vấn Cypher (chấp nhận định dạng <b>.cypher, .txt, .md, .markdown</b>). Hệ thống sẽ tự động tách các câu lệnh ngăn cách bằng dấu chấm phẩy (;) và thực thi.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".cypher,.txt,.md,.markdown"
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={submitting}
                  onClick={() => fileInputRef.current && fileInputRef.current.click()}
                  style={{ fontSize: '0.8rem', padding: '8px 12px', width: '100%', gap: '5px' }}
                >
                  {submitting ? 'Đang xử lý...' : 'Chọn file và Nhập 📁'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {!selectedElement ? (
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: '1.5', textAlign: 'center', padding: '10px 5px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    💡 <b>Mẹo:</b> Click vào một Node hoặc Liên kết trên đồ thị để chỉnh sửa hoặc xóa.
                  </div>
                  
                  <div style={{ textAlign: 'left' }}>
                    <label style={{ display: 'block', marginBottom: '2px', color: '#cbd5e1', fontSize: '0.75rem' }}>Chọn Node từ danh sách:</label>
                    <select
                      value=""
                      onChange={(e) => {
                        const node = data.nodes.find(n => n.id === e.target.value);
                        if (node) setSelectedElement({ type: 'node', data: node });
                      }}
                      style={{ padding: '4px 8px', fontSize: '0.8rem', height: '30px' }}
                    >
                      <option value="">-- Chọn Node cần chỉnh sửa --</option>
                      {data.nodes.map(n => (
                        <option key={n.id} value={n.id}>{n.type}: {n.name}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ textAlign: 'left' }}>
                    <label style={{ display: 'block', marginBottom: '2px', color: '#cbd5e1', fontSize: '0.75rem' }}>Chọn Liên kết từ danh sách:</label>
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value === "") return;
                        const link = data.links[parseInt(e.target.value)];
                        if (link) {
                          const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                          const targetId = typeof link.target === 'object' ? link.target.id : link.target;
                          const sourceNode = data.nodes.find(n => n.id === sourceId);
                          const targetNode = data.nodes.find(n => n.id === targetId);
                          setSelectedElement({
                            type: 'link',
                            data: {
                              sourceId,
                              targetId,
                              label: link.label,
                              sourceName: sourceNode ? sourceNode.name : sourceId,
                              targetName: targetNode ? targetNode.name : targetId,
                              properties: link.properties || {}
                            }
                          });
                        }
                      }}
                      style={{ padding: '4px 8px', fontSize: '0.8rem', height: '30px' }}
                    >
                      <option value="">-- Chọn Liên kết cần chỉnh sửa --</option>
                      {data.links.map((link, idx) => {
                        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
                        const sourceNode = data.nodes.find(n => n.id === sourceId);
                        const targetNode = data.nodes.find(n => n.id === targetId);
                        const sourceName = sourceNode ? sourceNode.name : sourceId;
                        const targetName = targetNode ? targetNode.name : targetId;
                        return (
                          <option key={idx} value={idx}>
                            {sourceName} → {targetName} ({link.label})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              ) : selectedElement.type === 'node' ? (
                <form onSubmit={handleUpdateNode} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontWeight: '600', color: '#60a5fa', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px' }}>
                    Đang sửa Node ({selectedElement.data.type})
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '2px', color: '#94a3b8', fontSize: '0.75rem' }}>Tên Node *</label>
                    <input
                      type="text"
                      value={editNodeData.name}
                      onChange={(e) => setEditNodeData({ ...editNodeData, name: e.target.value })}
                      style={{ padding: '4px 8px', fontSize: '0.8rem', height: '30px' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '2px', color: '#94a3b8', fontSize: '0.75rem' }}>Mô tả</label>
                    <textarea
                      value={editNodeData.description}
                      onChange={(e) => setEditNodeData({ ...editNodeData, description: e.target.value })}
                      style={{ padding: '4px 8px', fontSize: '0.8rem', height: '60px', resize: 'vertical' }}
                    />
                  </div>
                  {selectedElement.data.type === 'Goal' && (
                    <div>
                      <label style={{ display: 'block', marginBottom: '2px', color: '#94a3b8', fontSize: '0.75rem' }}>Loại mục tiêu</label>
                      <select
                        value={editNodeData.type}
                        onChange={(e) => setEditNodeData({ ...editNodeData, type: e.target.value })}
                        style={{ padding: '4px 8px', fontSize: '0.8rem', height: '30px' }}
                      >
                        <option value="achieve">achieve</option>
                        <option value="maintain">maintain</option>
                      </select>
                    </div>
                  )}
                  {selectedElement.data.type === 'Task' && (
                    <div>
                      <label style={{ display: 'block', marginBottom: '2px', color: '#94a3b8', fontSize: '0.75rem' }}>Lệnh thực thi</label>
                      <input
                        type="text"
                        value={editNodeData.command}
                        onChange={(e) => setEditNodeData({ ...editNodeData, command: e.target.value })}
                        style={{ padding: '4px 8px', fontSize: '0.8rem', height: '30px' }}
                      />
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                    <button
                      type="submit"
                      className="btn btn-success"
                      disabled={submitting}
                      style={{ flex: 1, fontSize: '0.8rem', padding: '6px 12px' }}
                    >
                      Lưu
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      disabled={submitting}
                      onClick={handleDeleteNode}
                      style={{ flex: 1, fontSize: '0.8rem', padding: '6px 12px' }}
                    >
                      Xóa Node
                    </button>
                  </div>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setSelectedElement(null)}
                    style={{ fontSize: '0.75rem', padding: '4px 8px', background: 'rgba(255,255,255,0.05)', marginTop: '4px' }}
                  >
                    Hủy chọn
                  </button>
                </form>
              ) : (
                <form onSubmit={handleUpdateLink} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontWeight: '600', color: '#a78bfa', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px' }}>
                    Đang chọn liên kết
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                    <div><b>Nguồn:</b> {selectedElement.data.sourceName}</div>
                    <div><b>Đích:</b> {selectedElement.data.targetName}</div>
                    <div><b>Loại hiện tại:</b> <span style={{ color: '#a78bfa', fontWeight: 'bold' }}>{selectedElement.data.label}</span></div>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '2px', color: '#94a3b8', fontSize: '0.75rem' }}>Loại liên kết mới</label>
                    <select
                      value={editLinkType}
                      onChange={(e) => setEditLinkType(e.target.value)}
                      style={{ padding: '4px 8px', fontSize: '0.8rem', height: '30px' }}
                    >
                      <option value="REFINES">REFINES</option>
                      <option value="DELEGATED_TO">DELEGATED_TO</option>
                      <option value="OPERATIONALIZED_BY">OPERATIONALIZED_BY</option>
                      <option value="DEPENDS_ON">DEPENDS_ON</option>
                    </select>
                  </div>
                  {editLinkType === 'REFINES' && (
                    <div>
                      <label style={{ display: 'block', marginBottom: '2px', color: '#94a3b8', fontSize: '0.75rem' }}>Loại phân rã (Type)</label>
                      <select
                        value={editLinkRefinesType}
                        onChange={(e) => setEditLinkRefinesType(e.target.value)}
                        style={{ padding: '4px 8px', fontSize: '0.8rem', height: '30px' }}
                      >
                        <option value="AND">AND</option>
                        <option value="OR">OR</option>
                      </select>
                    </div>
                  )}
                  {editLinkType === 'DEPENDS_ON' && (
                    <>
                      <div>
                        <label style={{ display: 'block', marginBottom: '2px', color: '#94a3b8', fontSize: '0.75rem' }}>Loại phụ thuộc (Type)</label>
                        <select
                          value={editLinkDependsOnType}
                          onChange={(e) => setEditLinkDependsOnType(e.target.value)}
                          style={{ padding: '4px 8px', fontSize: '0.8rem', height: '30px' }}
                        >
                          <option value="ACHIEVED">ACHIEVED</option>
                          <option value="PARAMETER">PARAMETER</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '2px', color: '#94a3b8', fontSize: '0.75rem' }}>Mô tả phụ thuộc</label>
                        <textarea
                          placeholder="Mô tả phụ thuộc..."
                          value={editLinkDescription}
                          onChange={(e) => setEditLinkDescription(e.target.value)}
                          style={{ padding: '4px 8px', fontSize: '0.8rem', height: '40px', resize: 'vertical' }}
                        />
                      </div>
                      {editLinkDependsOnType === 'PARAMETER' && (
                        <>
                          <div>
                            <label style={{ display: 'block', marginBottom: '2px', color: '#94a3b8', fontSize: '0.75rem' }}>Source Parameter</label>
                            <input
                              type="text"
                              placeholder="Ví dụ: amount"
                              value={editLinkSourceParam}
                              onChange={(e) => setEditLinkSourceParam(e.target.value)}
                              style={{ padding: '4px 8px', fontSize: '0.8rem', height: '30px' }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', marginBottom: '2px', color: '#94a3b8', fontSize: '0.75rem' }}>Target Parameter</label>
                            <input
                              type="text"
                              placeholder="Ví dụ: volume"
                              value={editLinkTargetParam}
                              onChange={(e) => setEditLinkTargetParam(e.target.value)}
                              style={{ padding: '4px 8px', fontSize: '0.8rem', height: '30px' }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', marginBottom: '2px', color: '#94a3b8', fontSize: '0.75rem' }}>Factor</label>
                            <input
                              type="number"
                              step="any"
                              value={editLinkFactor}
                              onChange={(e) => setEditLinkFactor(e.target.value)}
                              style={{ padding: '4px 8px', fontSize: '0.8rem', height: '30px' }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', marginBottom: '2px', color: '#94a3b8', fontSize: '0.75rem' }}>Offset</label>
                            <input
                              type="number"
                              step="any"
                              value={editLinkOffset}
                              onChange={(e) => setEditLinkOffset(e.target.value)}
                              style={{ padding: '4px 8px', fontSize: '0.8rem', height: '30px' }}
                            />
                          </div>
                        </>
                      )}
                    </>
                  )}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                    <button
                      type="submit"
                      className="btn btn-success"
                      disabled={submitting}
                      style={{ flex: 1, fontSize: '0.8rem', padding: '6px 12px' }}
                    >
                      Cập nhật
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      disabled={submitting}
                      onClick={handleDeleteLink}
                      style={{ flex: 1, fontSize: '0.8rem', padding: '6px 12px' }}
                    >
                      Xóa liên kết
                    </button>
                  </div>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setSelectedElement(null)}
                    style={{ fontSize: '0.75rem', padding: '4px 8px', background: 'rgba(255,255,255,0.05)', marginTop: '4px' }}
                  >
                    Hủy chọn
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div style={{ position: 'absolute', bottom: '10px', left: '10px', background: 'rgba(0,0,0,0.5)', padding: '8px', borderRadius: '4px', fontSize: '10px', display: 'flex', flexDirection: 'column', gap: '4px', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(4px)', pointerEvents: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f87171' }}></div>
          <span>Agent</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#60a5fa' }}></div>
          <span>Goal</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34d399' }}></div>
          <span>Task / Action</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#a78bfa' }}></div>
          <span>DT / Kettle</span>
        </div>
      </div>

      <div style={{ position: 'absolute', top: '10px', right: '10px', fontSize: '9px', color: 'rgba(255,255,255,0.4)', pointerEvents: 'none' }}>
        Neo4j: {NEO4J_URI}
      </div>
    </div>
  );
};

export default KGGraph;
