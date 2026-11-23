import {
  getThingGoalAnchor,
  goalAnchorCandidates,
  GOAL_TARGETS_QUERY,
} from '../../../goal_model/goals';
import React, { useState, useEffect } from 'react';
import neo4j from 'neo4j-driver';
import { Target, Settings2, ChevronRight } from 'lucide-react';
import { NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD } from '../config';

const driver = neo4j.driver(
  NEO4J_URI,
  neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD),
);

const ObjectController = ({
  thingId,
  goalRootId,
  goalAgentId,
  onAction,
  onOpenSetup,
}) => {
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const fetchTargets = async () => {
      if (!thingId) return;

      setLoading(true);
      setError(null);
      const session = driver.session();
      try {
        const anchorId = getThingGoalAnchor({
          thingId,
          attributes: { goalRootId, goalAgentId },
        });
        if (!anchorId) {
          setTargets([]);
          setLoading(false);
          return;
        }
        const query = GOAL_TARGETS_QUERY;
        const params = { anchorGroups: [goalAnchorCandidates(anchorId)] };

        console.log(
          'Đang truy vấn mục tiêu cho:',
          thingId,
          'với query:',
          query,
          'params:',
          params,
        );
        const result = await session.run(query, params);

        const foundTargets = result.records.map((record) => {
          const node = record.get('target');
          return {
            id: node.identity.toString(),
            name:
              node.properties.name || node.properties.id || 'Unnamed Target',
            type: node.labels[0],
            command: node.properties.command || '',
            description: node.properties.description || '',
            properties: node.properties,
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
  }, [thingId, goalRootId, goalAgentId, retryKey]);

  return (
    <div className="controller">
      <div className="controller-header">
        <h3>
          <Target size={18} />
          Mục tiêu & điều khiển
        </h3>
        {onOpenSetup && (
          <button
            className="icon-btn"
            aria-label="Thiết lập đồ thị mục tiêu"
            onClick={onOpenSetup}
          >
            <Settings2 size={17} />
          </button>
        )}
        {loading && (
          <div className="loading-spinner" aria-label="Đang tải mục tiêu" />
        )}
      </div>
      {error && (
        <div className="controller-empty" role="status">
          <p>Không tải được mục tiêu. Kiểm tra kết nối dữ liệu và thử lại.</p>
          <button
            className="btn"
            onClick={() => setRetryKey((value) => value + 1)}
          >
            Tải lại mục tiêu
          </button>
          <details className="controller-error-details">
            <summary>Chi tiết lỗi</summary>
            <p>{error}</p>
          </details>
        </div>
      )}
      {!loading && !error && targets.length === 0 && (
        <div className="controller-empty">
          <p>
            Chưa có mục tiêu cho bản sao số này. Thêm mục tiêu để thiết lập các
            thao tác điều khiển.
          </p>
          {onOpenSetup && (
            <button className="btn" onClick={onOpenSetup}>
              <Settings2 size={15} />
              Thiết lập mục tiêu
            </button>
          )}
        </div>
      )}
      <div className="controller-targets">
        {targets.map((target) => (
          <button
            key={target.id}
            className="control-btn"
            onClick={() => onAction?.(target)}
            title={target.description || 'Chuẩn bị lệnh cho mục tiêu này'}
          >
            <Target size={19} />
            <span className="control-btn-copy">
              <strong>{target.name}</strong>
              {target.description && <small>{target.description}</small>}
            </span>
            <span className="control-target-type">{target.type}</span>
            <ChevronRight size={15} />
          </button>
        ))}
      </div>
      <p className="controller-note">
        Chọn mục tiêu để chuẩn bị lệnh. Kiểm tra nội dung trước khi gửi.
      </p>
    </div>
  );
};

export default ObjectController;
