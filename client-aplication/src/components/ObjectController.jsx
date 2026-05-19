import React, { useState, useEffect } from 'react';
import neo4j from 'neo4j-driver';

const NEO4J_URI = 'neo4j+s://7ca01e33.databases.neo4j.io';
const NEO4J_USER = '7ca01e33';
const NEO4J_PASSWORD = '72-s4g7miEWEV_ky_rSMKGIN3RYuJyYbxsR42qnCx0E';

const driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));

/**
 * ObjectController Component
 * Tự động sinh giao diện điều khiển dựa trên Knowledge Graph
 */
const ObjectController = ({ thingId, onAction }) => {
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
        // Truy vấn các mục tiêu (Goal) hoặc nhiệm vụ (Task) liên quan đến thingId này
        // Chúng ta tìm các node có quan hệ với node đại diện cho DT
        const query = `
          MATCH (dt)
          WHERE dt.thingId = $thingId OR dt.name = $thingId OR dt.name CONTAINS $thingId
          MATCH (dt)-[*1..2]-(target)
          WHERE target:Goal OR target:Task
          RETURN DISTINCT target
        `;
        
        console.log('Đang truy vấn mục tiêu cho:', thingId);
        const result = await session.run(query, { thingId });
        
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
  }, [thingId]);

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
      {/* Decorative background element */}
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
              <br/>
              <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Sử dụng "Target Graph Setup" để thiết lập quan hệ.</span>
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem' }}>
            {targets.map(target => (
              <button
                key={target.id}
                className="control-btn"
                onClick={() => onAction && onAction(target)}
                title={target.description || 'Kích hoạt mục tiêu này'}
                style={{
                  height: '110px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: target.type === 'Goal' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                  border: `1px solid ${target.type === 'Goal' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`,
                  borderRadius: '12px',
                  color: 'white',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  padding: '1rem',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {/* Background Glow */}
                <div style={{
                  position: 'absolute',
                  width: '60px',
                  height: '60px',
                  background: target.type === 'Goal' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                  filter: 'blur(20px)',
                  borderRadius: '50%',
                  zIndex: 0
                }}></div>

                <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem', zIndex: 1 }}>
                  {target.type === 'Goal' ? '🎯' : '⚙️'}
                </div>
                
                <span style={{ 
                  fontWeight: 600, 
                  textAlign: 'center', 
                  fontSize: '0.9rem', 
                  zIndex: 1,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}>
                  {target.name}
                </span>
                
                <span style={{ 
                  fontSize: '0.65rem', 
                  opacity: 0.5, 
                  textTransform: 'uppercase', 
                  marginTop: '0.25rem',
                  letterSpacing: '0.05em',
                  zIndex: 1
                }}>
                  {target.type}
                </span>

                {/* Animated Ring on Hover */}
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
          transform: translateY(-4px);
          box-shadow: 0 10px 20px -5px rgba(0, 0, 0, 0.5);
          border-color: rgba(255, 255, 255, 0.3) !important;
        }
        
        .control-btn:active {
          transform: scale(0.95);
        }
        
        .control-btn .btn-ring {
          position: absolute;
          width: 100%;
          height: 100%;
          border: 2px solid transparent;
          border-radius: 12px;
          transition: all 0.3s;
        }
        
        .control-btn:hover .btn-ring {
          border-color: rgba(255, 255, 255, 0.1);
          transform: scale(1.05);
        }
      `}</style>
    </div>
  );
};

export default ObjectController;
