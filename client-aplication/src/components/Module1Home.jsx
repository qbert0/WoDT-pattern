import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const BASE_URL = 'http://35.240.154.27:8080/api/2';
const DEFAULT_AUTH = btoa('ditto:ditto');

const headers = (extra = {}) => ({
  'Authorization': `Basic ${DEFAULT_AUTH}`,
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  ...extra,
});

const Module1Home = () => {
  const [things, setThings] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [namespaceFilter, setNamespaceFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, online, offline
  const [sortBy, setSortBy] = useState('_modified,desc'); // field,direction
  
  // Pagination
  const [cursor, setCursor] = useState(null);
  const [hasNext, setHasNext] = useState(false);

  const navigate = useNavigate();
  const eventSourceRef = useRef(null);

  const fetchThings = async (isLoadMore = false) => {
    setIsLoading(true);
    setError(null);
    try {
      // Build RQL filter
      let rqlParts = [];
      if (searchTerm) {
        rqlParts.push(`like(thingId,"*${searchTerm}*")`);
      }
      if (namespaceFilter) {
        rqlParts.push(`like(thingId,"${namespaceFilter}:*")`);
      }
      // Status filtering is complex in RQL unless we have a specific field. We'll do a basic filter or client-side filter if not possible.
      // For now, let's keep RQL simple.
      let filterQuery = rqlParts.length > 0 ? `filter=${encodeURIComponent(rqlParts.join(' AND '))}` : '';
      
      const sortQuery = `sort=${sortBy}`;
      let optionQuery = 'option=size(25)';
      if (isLoadMore && cursor) {
        optionQuery += `,cursor(${cursor})`;
      }

      const queryParams = [filterQuery, sortQuery, optionQuery].filter(Boolean).join('&');
      
      const r = await fetch(`${BASE_URL}/search/things?${queryParams}`, { headers: headers() });
      if (!r.ok) {
        // Fallback to regular /things if search index is not enabled
        if (r.status === 400 || r.status === 501) {
            console.warn('Search API failed, falling back to /things API');
            const fallbackRes = await fetch(`${BASE_URL}/things`, { headers: headers() });
            if (!fallbackRes.ok) throw new Error(`HTTP ${fallbackRes.status}`);
            const data = await fallbackRes.json();
            setThings(data.items ?? (Array.isArray(data) ? data : []));
            setHasNext(false);
            return;
        }
        throw new Error(`HTTP ${r.status}`);
      }
      
      const data = await r.json();
      const newItems = data.items ?? [];
      
      if (isLoadMore) {
        setThings(prev => [...prev, ...newItems]);
      } else {
        setThings(newItems);
      }
      
      if (data.cursor) {
        setCursor(data.cursor);
        setHasNext(true);
      } else {
        setCursor(null);
        setHasNext(false);
      }
    } catch (e) {
      setError('Failed to fetch Things: ' + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchThings();
  }, [searchTerm, namespaceFilter, sortBy]);

  // Setup SSE
  useEffect(() => {
    // We can subscribe to changes to update the UI
    const setupSSE = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      
      // Standard SSE URL for Ditto
      const sseUrl = `${BASE_URL}/things?live=true`;
      
      // Since EventSource doesn't support custom headers (like Authorization) easily in standard browser API, 
      // we'd need a polyfill or to use WebSockets. 
      // Alternatively, we can use fetch with streams, or just poll.
      // Given the requirement, we will try standard EventSource and assume CORS/Auth is handled via cookies or a proxy, 
      // OR we implement a simple polling interval if EventSource fails.
      // Let's implement a manual polling for "live" feel if SSE fails due to Auth headers.
      
      // For now, let's implement a 10-second polling as a reliable fallback, since we need Auth header.
      const interval = setInterval(() => {
          // Re-fetch only if not actively searching/filtering heavily to avoid flicker
          if (!isLoading) {
              fetchThings();
          }
      }, 10000);
      
      return () => clearInterval(interval);
    };

    const cleanup = setupSSE();
    return cleanup;
  }, [searchTerm, namespaceFilter, sortBy]);

  // Helper to determine status
  const getStatus = (thing) => {
    // If we have a ping feature
    if (thing.features && thing.features.ConnectionStatus?.properties?.status) {
        return thing.features.ConnectionStatus.properties.status.toLowerCase();
    }
    
    // Fallback: check _modified timestamp
    const modifiedStr = thing._modified; // e.g. "2026-05-04T04:02:56Z"
    if (!modifiedStr) return 'unknown';
    
    const modifiedTime = new Date(modifiedStr).getTime();
    const now = new Date().getTime();
    const diffMinutes = (now - modifiedTime) / 1000 / 60;
    
    if (diffMinutes < 5) return 'online';
    return 'offline';
  };

  const getSystemBadge = (thing) => {
      // Logic to check if it belongs to a System. Often represented as a tag or specific attribute.
      if (thing.attributes?.systemId) return thing.attributes.systemId;
      if (thing.attributes?.tags?.includes('System')) return 'System';
      return null;
  };

  const getActivitySummary = (thing) => {
      if (!thing.features) return 'No features available';
      const fKeys = Object.keys(thing.features).filter(k => k !== 'ConnectionStatus');
      if (fKeys.length === 0) return 'Idle';
      return `Active features: ${fKeys.slice(0, 3).join(', ')}${fKeys.length > 3 ? '...' : ''}`;
  };

  const filteredThings = things.filter(thing => {
      if (statusFilter === 'all') return true;
      return getStatus(thing) === statusFilter;
  });

  return (
    <div className="module1-container">
      <div className="header" style={{ marginBottom: '1.5rem' }}>
        <h1>TRANG CHỦ: DANH SÁCH BẢN SAO SỐ</h1>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn" style={{ background: 'rgba(255,255,255,0.1)' }} onClick={() => fetchThings()}>
             ↻ Tải lại
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/create-dt')}>
             + Tạo DT Mới
          </button>
        </div>
      </div>

      {/* Control Bar: Search & Filters */}
      <div className="controls-bar glass-panel" style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap', padding: '1rem' }}>
          <div className="form-group" style={{ flex: '1 1 250px', marginBottom: 0 }}>
              <input 
                  type="text" 
                  placeholder="Tìm kiếm bằng Keyword (thingId)..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
              />
          </div>
          <div className="form-group" style={{ flex: '1 1 200px', marginBottom: 0 }}>
              <input 
                  type="text" 
                  placeholder="Lọc theo Namespace (VD: org.eclipse)..." 
                  value={namespaceFilter}
                  onChange={(e) => setNamespaceFilter(e.target.value)}
              />
          </div>
          <div className="form-group" style={{ flex: '0 0 150px', marginBottom: 0 }}>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">Tất cả trạng thái</option>
                  <option value="online">Online</option>
                  <option value="offline">Offline</option>
                  <option value="unknown">Unknown</option>
              </select>
          </div>
          <div className="form-group" style={{ flex: '0 0 200px', marginBottom: 0 }}>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  <option value="_modified,desc">Cập nhật mới nhất</option>
                  <option value="_modified,asc">Cập nhật cũ nhất</option>
                  <option value="thingId,asc">Tên (A-Z)</option>
                  <option value="thingId,desc">Tên (Z-A)</option>
              </select>
          </div>
      </div>

      {error && <div style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid var(--danger)', color: '#fca5a5', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>{error}</div>}

      {/* DT Cards Grid */}
      {isLoading && things.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Đang tải dữ liệu…</div>
      ) : (
        <>
            <div className="dt-grid">
            {filteredThings.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                Không tìm thấy Digital Twin nào phù hợp.
                </div>
            ) : filteredThings.map(thing => {
                const [namespace, name] = thing.thingId.split(':');
                const displayName = thing.attributes?.label || name;
                const status = getStatus(thing);
                const tags = thing.attributes?.tags || [];
                const systemBadge = getSystemBadge(thing);
                
                return (
                <div 
                    key={thing.thingId} 
                    className="dt-card glass-panel clickable"
                    onClick={() => navigate(`/dt/${encodeURIComponent(thing.thingId)}`)}
                >
                    <div className="dt-card-header">
                        <div>
                            <div className="dt-namespace">{namespace}</div>
                            <div className="dt-title">{displayName}</div>
                            <div className="dt-thingid">{thing.thingId}</div>
                        </div>
                        <div className={`status-indicator status-${status}`} title={`Status: ${status}`}></div>
                    </div>
                    
                    <div className="dt-card-body">
                        <div className="dt-info-row">
                            <span className="label">Hoạt động:</span>
                            <span className="value">{getActivitySummary(thing)}</span>
                        </div>
                        <div className="dt-info-row">
                            <span className="label">Cập nhật:</span>
                            <span className="value">
                                {thing._modified ? new Date(thing._modified).toLocaleString('vi-VN') : 'N/A'}
                            </span>
                        </div>
                    </div>
                    
                    <div className="dt-card-footer">
                        <div className="tags-container">
                            {tags.map((tag, idx) => (
                                <span key={idx} className="tag-pill">{tag}</span>
                            ))}
                        </div>
                        {systemBadge && (
                            <div className="system-badge">System: {systemBadge}</div>
                        )}
                    </div>
                </div>
                );
            })}
            </div>
            
            {hasNext && (
                <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                    <button 
                        className="btn btn-primary" 
                        onClick={() => fetchThings(true)}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Đang tải...' : 'Tải thêm'}
                    </button>
                </div>
            )}
        </>
      )}
    </div>
  );
};

export default Module1Home;
