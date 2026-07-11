import React, { useState, useEffect } from 'react';
import neo4j from 'neo4j-driver';
import { NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD } from '../config';

const driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));


const ObjectController = ({ thingId, goalRootId, onAction, onOpenSetup }) => {
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTargets = async () => {
      if (!thingId) return;

      setLoading(true);
      setError(null);
      const session = driver.session();
      try {
        let finalGoalRootId = goalRootId;
        if (!finalGoalRootId) {
          const idStr = thingId.toLowerCase();
          if (idStr.includes('kettle')) {
            finalGoalRootId = 'G_KETTLE_ROOT';
          } else if (idStr.includes('grinder')) {
            finalGoalRootId = 'G_GRINDER_ROOT';
          } else if (idStr.includes('coffee') || idStr.includes('system')) {
            finalGoalRootId = 'G_SYSTEM_ROOT';
          }
        }

        if (!finalGoalRootId) {
          setTargets([]);
          setLoading(false);
          return;
        }


        const query = `
          MATCH (root:Goal {id: $goalRootId})-[:REFINES*0..]->(target:Goal)
          RETURN DISTINCT target
        `;

        console.log('Đang truy vấn mục tiêu cho:', thingId, 'với root:', finalGoalRootId);
        const result = await session.run(query, { goalRootId: finalGoalRootId });

        const foundTargets = result.records.map(record => {
          const node = record.get('target');
          return {
            id: node.identity.toString(),
            name: node.properties.name || node.properties.id || 'Unnamed Target',
            type: node.labels[0],
            command: node.properties.command || '',
            description: node.properties.description || '',
            properties: node.properties
          };
        });

        console.log('Đã tìm thấy các mục tiêu:', foundTargets);
        setTargets(foundTargets);
      } catch (err) {
        console.error('Neo4j Fetch Targets Error:', err);
        setError(err.message);
      } finally {
        await session.close();
        setLoading(false);
      }
    };

    fetchTargets();
  }, [thingId, goalRootId]);

  return (
    <div className="glass-panel" style={{
      padding: '1.5rem',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'rgba(30, 41, 59, 0.4)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      position: 'relative',
      overflow: 'hidden'
    }}>

      <div style={{
        position: 'absolute',
        top: '-50px',
        right: '-50px',
        width: '150px',
        height: '150px',
        background: 'radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 70%)',
        borderRadius: '50%',
        pointerEvents: 'none'
      }}></div>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid var(--border-color)',
        paddingBottom: '0.75rem',
        marginBottom: '1.25rem'
      }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.1rem', fontWeight: 600 }}>
          <div style={{
            width: '32px',
            height: '32px',
            background: 'rgba(59, 130, 246, 0.2)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#60a5fa'
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="6" width="20" height="12" rx="2"></rect>
              <path d="M6 12h4"></path>
              <path d="M14 12h4"></path>
            </svg>
          </div>
          BỘ ĐIỀU KHIỂN THÔNG MINH
        </h3>
        {loading && <div className="loading-spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }}></div>}
      </div>

      {error && (
        <div style={{
          padding: '0.75rem',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          color: '#fca5a5',
          borderRadius: '6px',
          fontSize: '0.85rem',
          marginBottom: '1rem'
        }}>
          ⚠️ {error}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
        {!loading && targets.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '3rem 1rem',
            color: 'var(--text-muted)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem'
          }}>
            <div style={{ fontSize: '2.5rem', opacity: 0.5 }}>🧭</div>
            <p style={{ fontSize: '0.9rem' }}>
              Chưa tìm thấy mục tiêu Semantic nào trong đồ thị liên quan đến thực thể này.
              <br />
              {onOpenSetup && (
                <button
                  onClick={onOpenSetup}
                  className="btn"
                  style={{ fontSize: '0.8rem', marginTop: '0.75rem', background: 'rgba(59, 130, 246, 0.2)', color: '#93c5fd' }}
                >
                  ⚙ Thiết lập Biểu đồ Mục tiêu
                </button>
              )}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {targets.map(target => (
              <button
                key={target.id}
                className="control-btn"
                onClick={() => onAction && onAction(target)}
                title={target.description || 'Kích hoạt mục tiêu này'}
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: '1rem',
                  background: target.type === 'Goal' ? 'rgba(59, 130, 246, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                  border: `1px solid ${target.type === 'Goal' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)'}`,
                  borderRadius: '10px',
                  color: 'white',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  padding: '0.75rem 1.25rem',
                  position: 'relative',
                  overflow: 'hidden',
                  width: '100%',
                  textAlign: 'left'
                }}
              >

                <div style={{
                  position: 'absolute',
                  width: '60px',
                  height: '60px',
                  background: target.type === 'Goal' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                  filter: 'blur(20px)',
                  borderRadius: '50%',
                  zIndex: 0
                }}></div>

                <div style={{ fontSize: '1.5rem', zIndex: 1, display: 'flex', alignItems: 'center' }}>
                  {target.type === 'Goal' ? '🎯' : '⚙️'}
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', zIndex: 1, overflow: 'hidden' }}>
                  <span style={{
                    fontWeight: 600,
                    fontSize: '0.95rem',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden'
                  }}>
                    {target.name}
                  </span>
                  {target.description && (
                    <span style={{
                      fontSize: '0.75rem',
                      opacity: 0.6,
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                      marginTop: '2px'
                    }}>
                      {target.description}
                    </span>
                  )}
                </div>

                <span style={{
                  fontSize: '0.65rem',
                  opacity: 0.7,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  zIndex: 1,
                  background: target.type === 'Goal' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontWeight: 600,
                  border: `1px solid ${target.type === 'Goal' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`
                }}>
                  {target.type}
                </span>


                <div className="btn-ring"></div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{
        marginTop: '1.25rem',
        paddingTop: '1rem',
        borderTop: '1px solid var(--border-color)',
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        <div style={{ width: '6px', height: '6px', background: '#3b82f6', borderRadius: '50%' }}></div>
        Tự động cấu hình theo đồ thị tri thức
      </div>

      <style>{`
        .control-btn:hover {
          background: rgba(255, 255, 255, 0.05) !important;
          transform: translateX(4px);
          box-shadow: 3px 6px 15px -3px rgba(0, 0, 0, 0.4);
          border-color: rgba(255, 255, 255, 0.3) !important;
        }
        
        .control-btn:active {
          transform: scale(0.98);
        }
        
        .control-btn .btn-ring {
          position: absolute;
          width: 100%;
          height: 100%;
          border: 2px solid transparent;
          border-radius: 10px;
          transition: all 0.3s;
        }
        
        .control-btn:hover .btn-ring {
          border-color: rgba(255, 255, 255, 0.1);
          transform: scale(1.02);
        }
      `}</style>
    </div>
  );
};

export default ObjectController;
