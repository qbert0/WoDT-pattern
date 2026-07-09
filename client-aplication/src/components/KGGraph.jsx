import React, { useState, useEffect, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import neo4j from 'neo4j-driver';
import { NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD, NEO4J_QUERY_LIMIT } from '../config';

// Neo4j Configuration
// In a production app, these should come from environment variables
// Thêm port 7687 tường minh và thử các protocol khác nếu vẫn lỗi:
// 1. 'neo4j+s://...' (Mặc định)
// 2. 'neo4j+ssc://...' (Bỏ qua kiểm tra SSL - dùng nếu mạng bị chặn)
// 3. 'bolt+s://...' (Kết nối trực tiếp không qua routing)
let driver;
try {
  driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));
  console.log('Driver Neo4j đã khởi tạo với URI:', NEO4J_URI);
} catch (err) {
  console.error('Lỗi khởi tạo driver:', err);
}

const KGGraph = ({ thingId, goalRootId, width, height }) => {
  const [data, setData] = useState({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const fetchGraph = async () => {
      if (!driver) {
        setError('Driver Neo4j chưa được khởi tạo.');
        setLoading(false);
        return;
      }

      if (!goalRootId) {
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
        // If goalRootId is provided, retrieve the sub-graph for this specific DT.
        // Otherwise, fall back to the default query which fetches all nodes up to a limit.
        const query = goalRootId
          ? `
            MATCH path = (root:Goal {id: $goalRootId})-[:REFINES|DELEGATED_TO|OPERATIONALIZED_BY*0..5]-(m)
            RETURN path
          `
          : `
            MATCH (n)-[r]->(m)
            RETURN n, r, m
            LIMIT ${NEO4J_QUERY_LIMIT}
          `;

        const result = await session.run(query, { goalRootId });

        const nodesMap = new Map();
        const links = [];
        const seenLinks = new Set();

        result.records.forEach(record => {
          if (goalRootId) {
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

            // Process nodes
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

            // Process relationship
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
  }, [thingId, goalRootId]);

  const getNodeColor = (node) => {
    switch (node.type) {
      case 'Agent': return '#f87171'; // Red
      case 'Goal': return '#60a5fa';  // Blue
      case 'Task':
      case 'Action': return '#34d399';  // Green
      case 'DT': return '#a78bfa';    // Purple
      case 'Capability': return '#fbbf24'; // Yellow
      case 'Kettle': return '#a78bfa'; // Purple
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
        nodeCanvasObject={(node, ctx, globalScale) => {
          const label = node.name;
          const fontSize = 12 / globalScale;
          ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;

          // Node Circle
          ctx.beginPath();
          ctx.arc(node.x, node.y, 5, 0, 2 * Math.PI, false);
          ctx.fillStyle = getNodeColor(node);
          ctx.fill();

          // Glow effect
          ctx.shadowColor = getNodeColor(node);
          ctx.shadowBlur = 10;
          ctx.stroke();
          ctx.shadowBlur = 0;

          // Label
          if (globalScale > 1.5) {
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#cbd5e1';
            ctx.fillText(label, node.x, node.y + 10);
          }
        }}
      />

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
