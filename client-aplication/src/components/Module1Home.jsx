import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  LayoutGrid,
  List,
  ChevronRight,
  X,
  Pause,
  Play,
  Boxes,
  Radio,
  AlertCircle,
  ArrowUpRight,
} from 'lucide-react';
import {
  DITTO_API_BASE_URL as BASE_URL,
  HOME_POLL_INTERVAL_MS,
  SEARCH_PAGE_SIZE,
} from '../config';
import TwinVisual, { getDeviceIcon } from './TwinVisual';
import {
  getTwinStatus,
  getTwinMetrics,
  STATUS_LABELS,
  formatMetric,
  formatUpdated,
} from '../utils/twinPresentation';

const headers = { Accept: 'application/json' };

export default function Module1Home() {
  const [things, setThings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [search, setSearch] = useState('');
  const [namespaceFilter, setNamespaceFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('_modified,desc');
  const [hasNext, setHasNext] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [view, setView] = useState('grid');
  const [live, setLive] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const loadRef = useRef(() => {});
  const liveRef = useRef(live);
  liveRef.current = live;

  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchTerm.trim()), 300);
    return () => clearTimeout(timeout);
  }, [searchTerm]);

  useEffect(() => {
    let disposed = false;
    let controller;
    let busy = false;
    let cursor = null;
    let pageCount = 1;
    // Refresh every loaded page so polling does not discard expanded results.
    const load = async (mode = 'refresh') => {
      if (mode === 'poll' && busy) return;
      if (mode === 'more' && (!cursor || busy)) return;
      controller?.abort();
      const requestController = new AbortController();
      controller = requestController;
      busy = true;
      setIsLoading(true);
      try {
        const filters = [];
        if (search)
          filters.push(`like(thingId,${JSON.stringify(`*${search}*`)})`);
        if (namespaceFilter)
          filters.push(
            `like(thingId,${JSON.stringify(`${namespaceFilter}:*`)})`,
          );
        let nextCursor = mode === 'more' ? cursor : null;
        let items = [];
        let fallback = false;
        const pages = mode === 'more' ? 1 : pageCount;
        for (let page = 0; page < pages; page++) {
          const params = new URLSearchParams({
            sort: sortBy,
            option: `size(${SEARCH_PAGE_SIZE})${nextCursor ? `,cursor(${nextCursor})` : ''}`,
          });
          if (filters.length)
            params.set(
              'filter',
              filters.length === 1 ? filters[0] : `and(${filters.join(',')})`,
            );
          const response = await fetch(`${BASE_URL}/search/things?${params}`, {
            headers,
            signal: requestController.signal,
          });
          if (response.status === 400 || response.status === 501) {
            const response = await fetch(`${BASE_URL}/things`, {
              headers,
              signal: requestController.signal,
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            items = (data.items ?? (Array.isArray(data) ? data : [])).filter(
              (thing) =>
                (!search ||
                  thing.thingId.toLowerCase().includes(search.toLowerCase())) &&
                (!namespaceFilter ||
                  thing.thingId.startsWith(`${namespaceFilter}:`)),
            );
            const [field, direction] = sortBy.split(',');
            items.sort(
              (a, b) =>
                String(a[field] || '').localeCompare(String(b[field] || '')) *
                (direction === 'asc' ? 1 : -1),
            );
            nextCursor = null;
            fallback = true;
            break;
          }
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const data = await response.json();
          items.push(...(data.items || []));
          nextCursor = data.cursor || null;
          if (!nextCursor) break;
        }
        if (disposed || requestController.signal.aborted) return;
        setThings((previous) => [
          ...new Map(
            (mode === 'more' && !fallback
              ? [...previous, ...items]
              : items
            ).map((thing) => [thing.thingId, thing]),
          ).values(),
        ]);
        if (mode === 'more' && !fallback) pageCount++;
        cursor = nextCursor;
        setHasNext(Boolean(nextCursor));
        setLastUpdated(new Date());
        setError(null);
      } catch (err) {
        if (!disposed && !requestController.signal.aborted)
          setError(
            `Không tải được bản sao số (${err.message}). Kiểm tra kết nối dịch vụ và thử lại.`,
          );
      } finally {
        if (!disposed && controller === requestController) {
          busy = false;
          setIsLoading(false);
        }
      }
    };
    loadRef.current = load;
    load();
    const interval = setInterval(() => {
      if (liveRef.current && !document.hidden) load('poll');
    }, HOME_POLL_INTERVAL_MS);
    return () => {
      disposed = true;
      controller?.abort();
      clearInterval(interval);
    };
  }, [search, namespaceFilter, sortBy]);

  const counts = things.reduce(
    (result, thing) => {
      result[getTwinStatus(thing)]++;
      return result;
    },
    { online: 0, offline: 0, unknown: 0 },
  );
  const filteredThings = things.filter(
    (thing) => statusFilter === 'all' || getTwinStatus(thing) === statusFilter,
  );
  const activeFilters = Boolean(namespaceFilter || sortBy !== '_modified,desc');
  const resetFilters = () => {
    setSearchTerm('');
    setSearch('');
    setNamespaceFilter('');
    setStatusFilter('all');
    setSortBy('_modified,desc');
  };

  return (
    <div className="twins-page">
      <div className="page-heading">
        <div>
          <h1>
            Digital Twins
            <span className="heading-count">
              {things.length}
              {hasNext ? '+' : ''}
            </span>
          </h1>
          <p>Theo dõi thiết bị. Kết nối với bản sao số của bạn.</p>
        </div>
        <Link className="btn btn-primary" to="/create-dt">
          <Plus size={17} />
          Tạo bản sao số
        </Link>
      </div>

      <section className="fleet-overview" aria-label="Tổng quan kết quả đã tải">
        <div className="overview-identity">
          <TwinVisual compact />
          <div>
            <strong>Thiết bị & bản sao số</strong>
            <span>Dữ liệu từ không gian làm việc của bạn</span>
          </div>
        </div>
        <div className="fleet-stat">
          <span className="status-dot online" />
          <strong>{counts.online}</strong>
          <span>Trực tuyến</span>
        </div>
        <div className="fleet-stat">
          <span className="status-dot offline" />
          <strong>{counts.offline}</strong>
          <span>Ngoại tuyến</span>
        </div>
        <div className="fleet-stat">
          <span className="status-dot unknown" />
          <strong>{counts.unknown}</strong>
          <span>Chưa xác định</span>
        </div>
      </section>

      <section className="twins-workspace" aria-label="Danh sách bản sao số">
        <div className="collection-toolbar">
          <div
            className="status-tabs"
            role="group"
            aria-label="Lọc theo trạng thái"
          >
            {[
              ['all', 'Tất cả', things.length],
              ['online', 'Trực tuyến', counts.online],
              ['offline', 'Ngoại tuyến', counts.offline],
              ['unknown', 'Chưa xác định', counts.unknown],
            ].map(([key, label, count]) => (
              <button
                key={key}
                className={statusFilter === key ? 'is-selected' : ''}
                aria-pressed={statusFilter === key}
                onClick={() => setStatusFilter(key)}
              >
                {label}
                <span>{count}</span>
              </button>
            ))}
          </div>
          <div className={`sync-state${error ? ' has-error' : ''}`}>
            <span
              className={`status-dot ${error ? 'error' : lastUpdated && live ? 'online' : 'unknown'}`}
            />
            <span>
              {error
                ? 'Đồng bộ gián đoạn'
                : !live
                  ? 'Đã tạm dừng'
                  : 'Tự động cập nhật'}
            </span>
            <button
              className="icon-btn"
              onClick={() => {
                setLive((value) => !value);
                if (!live) loadRef.current();
              }}
              aria-label={
                live ? 'Tạm dừng cập nhật tự động' : 'Tiếp tục cập nhật tự động'
              }
              aria-pressed={!live}
              title={`Chu kỳ cập nhật: ${HOME_POLL_INTERVAL_MS / 1000} giây`}
            >
              {live ? <Pause size={13} /> : <Play size={13} />}
            </button>
          </div>
        </div>
        <div className="search-toolbar">
          <div className="search-field">
            <Search size={18} />
            <input
              aria-label="Tìm bản sao số theo Thing ID"
              placeholder="Tìm bản sao số theo Thing ID…"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            {searchTerm && (
              <button
                className="icon-btn"
                aria-label="Xóa tìm kiếm"
                onClick={() => setSearchTerm('')}
              >
                <X size={15} />
              </button>
            )}
          </div>
          <button
            className={`btn filter-button${showFilters || activeFilters ? ' is-selected' : ''}`}
            aria-expanded={showFilters}
            aria-controls="twin-filters"
            onClick={() => setShowFilters((value) => !value)}
          >
            <SlidersHorizontal size={16} />
            <span>Bộ lọc</span>
            {activeFilters && <span className="filter-dot" />}
          </button>
          <button
            className="icon-btn refresh-button"
            aria-label="Tải lại bản sao số"
            disabled={isLoading}
            onClick={() => loadRef.current()}
          >
            <RefreshCw size={17} className={isLoading ? 'is-spinning' : ''} />
          </button>
          <span className="toolbar-divider" />
          <div className="view-switch" role="group" aria-label="Chế độ xem">
            <button
              className={`icon-btn${view === 'grid' ? ' is-selected' : ''}`}
              aria-label="Xem dạng lưới"
              aria-pressed={view === 'grid'}
              onClick={() => setView('grid')}
            >
              <LayoutGrid size={17} />
            </button>
            <button
              className={`icon-btn${view === 'list' ? ' is-selected' : ''}`}
              aria-label="Xem dạng danh sách"
              aria-pressed={view === 'list'}
              onClick={() => setView('list')}
            >
              <List size={18} />
            </button>
          </div>
        </div>
        {showFilters && (
          <div className="filter-panel" id="twin-filters">
            <div>
              <label htmlFor="namespace-filter">Namespace</label>
              <input
                id="namespace-filter"
                placeholder="Ví dụ: smart-home"
                value={namespaceFilter}
                onChange={(event) =>
                  setNamespaceFilter(event.target.value.trim())
                }
              />
            </div>
            <div>
              <label htmlFor="sort-filter">Sắp xếp</label>
              <select
                id="sort-filter"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
              >
                <option value="_modified,desc">Cập nhật mới nhất</option>
                <option value="_modified,asc">Cập nhật cũ nhất</option>
                <option value="thingId,asc">Tên từ A đến Z</option>
                <option value="thingId,desc">Tên từ Z đến A</option>
              </select>
            </div>
            <button className="btn btn-quiet" onClick={resetFilters}>
              Đặt lại bộ lọc
            </button>
          </div>
        )}

        {error && (
          <div className="notice notice-error" role="alert">
            <AlertCircle size={18} />
            <p>
              {error}
              {things.length > 0 &&
                ' Đang hiển thị dữ liệu từ lần đồng bộ trước.'}
            </p>
            <button className="btn" onClick={() => loadRef.current()}>
              Thử lại
            </button>
          </div>
        )}

        <div className="collection-meta">
          <span aria-live="polite">
            {filteredThings.length} bản sao số{hasNext ? ' đã tải' : ''}
            {namespaceFilter && ` trong ${namespaceFilter}`}
          </span>
          <span>
            {lastUpdated
              ? `Đồng bộ lúc ${lastUpdated.toLocaleTimeString('vi-VN')}`
              : 'Đang chờ đồng bộ'}
          </span>
        </div>
        <div aria-busy={isLoading} className="collection-content">
          {isLoading && !lastUpdated ? (
            <div className="twin-grid" aria-label="Đang tải bản sao số">
              {[0, 1, 2].map((key) => (
                <div className="twin-skeleton" key={key}>
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              ))}
            </div>
          ) : filteredThings.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                {searchTerm || namespaceFilter || statusFilter !== 'all' ? (
                  <Search size={27} />
                ) : error ? (
                  <Radio size={27} />
                ) : (
                  <Boxes size={29} />
                )}
              </div>
              <h2>
                {error
                  ? 'Chưa thể tải dữ liệu'
                  : things.length ||
                      searchTerm ||
                      namespaceFilter ||
                      statusFilter !== 'all'
                    ? 'Không có bản sao phù hợp'
                    : 'Bắt đầu với bản sao số đầu tiên'}
              </h2>
              <p>
                {error
                  ? 'Thử tải lại khi dịch vụ đã sẵn sàng.'
                  : searchTerm || namespaceFilter || statusFilter !== 'all'
                    ? 'Thay đổi từ khóa hoặc bộ lọc để xem thêm thiết bị.'
                    : 'Kết nối thiết bị để theo dõi trạng thái và quản lý dữ liệu tại đây.'}
              </p>
              {error ? (
                <button className="btn" onClick={() => loadRef.current()}>
                  <RefreshCw size={16} />
                  Tải lại dữ liệu
                </button>
              ) : searchTerm || namespaceFilter || statusFilter !== 'all' ? (
                <button className="btn" onClick={resetFilters}>
                  Xóa bộ lọc
                </button>
              ) : (
                <Link className="btn btn-primary" to="/create-dt">
                  <Plus size={16} />
                  Tạo bản sao số
                </Link>
              )}
            </div>
          ) : (
            <div className={view === 'grid' ? 'twin-grid' : 'twin-list'}>
              {filteredThings.map((thing) => {
                const [namespace, ...nameParts] = thing.thingId.split(':');
                const name =
                  thing.attributes?.label ||
                  nameParts.join(':') ||
                  thing.thingId;
                const status = getTwinStatus(thing);
                const Icon = getDeviceIcon(thing);
                const tags = Array.isArray(thing.attributes?.tags)
                  ? thing.attributes.tags
                  : [];
                const metrics = getTwinMetrics(thing);
                return (
                  <Link
                    to={`/dt/${encodeURIComponent(thing.thingId)}`}
                    key={thing.thingId}
                    className={`twin-card${view === 'list' ? ' is-list' : ''}`}
                  >
                    <div className="twin-card-top">
                      <span className="namespace-label">{namespace}</span>
                      <span
                        className={`status-badge ${status}`}
                        title={
                          thing.features?.ConnectionStatus?.properties?.status
                            ? 'Trạng thái do thiết bị cung cấp'
                            : 'Ước tính theo cập nhật trong 5 phút gần nhất'
                        }
                      >
                        <span className={`status-dot ${status}`} />
                        {STATUS_LABELS[status]}
                      </span>
                    </div>
                    <div className="twin-card-visual">
                      <TwinVisual thing={thing} />
                      <ArrowUpRight size={18} className="open-twin-icon" />
                    </div>
                    <div className="twin-card-name">
                      <span className="list-device-icon">
                        <Icon size={22} strokeWidth={1.5} />
                      </span>
                      <div>
                        <h2>{name}</h2>
                        <p title={thing.thingId}>{thing.thingId}</p>
                      </div>
                    </div>
                    <div className="twin-metrics">
                      {metrics.map((metric) => (
                        <div key={metric.label}>
                          <span title={metric.label}>{metric.label}</span>
                          <strong>
                            {formatMetric(metric.value)}
                            {metric.value != null && metric.unit && (
                              <small>{metric.unit}</small>
                            )}
                          </strong>
                        </div>
                      ))}
                    </div>
                    <div className="twin-card-footer">
                      <div className="twin-tags">
                        {thing.attributes?.systemId && (
                          <span className="system-badge">
                            {thing.attributes.systemId}
                          </span>
                        )}
                        {tags.slice(0, 2).map((tag, index) => (
                          <span className="tag-pill" key={index}>
                            {String(tag)}
                          </span>
                        ))}
                        {!tags.length && !thing.attributes?.systemId && (
                          <span className="device-kind">
                            {thing.features?.components?.properties?.thingIds
                              ?.length
                              ? 'Hệ thống'
                              : 'Thiết bị'}
                          </span>
                        )}
                      </div>
                      <span className="twin-updated">
                        {formatUpdated(thing._modified)}
                      </span>
                      <ChevronRight size={15} className="list-chevron" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
        {hasNext && (
          <div className="load-more">
            <button
              className="btn"
              disabled={isLoading}
              onClick={() => loadRef.current('more')}
            >
              {isLoading ? 'Đang tải…' : 'Tải thêm bản sao số'}
            </button>
          </div>
        )}
      </section>
      <p className="collection-footnote">
        <Radio size={13} />
        Trạng thái được lấy từ thiết bị hoặc ước tính theo thời điểm cập nhật
        gần nhất.
      </p>
    </div>
  );
}
