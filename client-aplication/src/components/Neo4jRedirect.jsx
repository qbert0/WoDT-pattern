import React from 'react';
import { ExternalLink, Network } from 'lucide-react';
import { NEO4J_BROWSER_URL } from '../config';

export default function Neo4jRedirect() {
  return (
    <div className="graph-page">
      <div className="page-heading">
        <div>
          <h1>Đồ thị tri thức</h1>
          <p>Khám phá mục tiêu, tác vụ và quan hệ giữa các bản sao số.</p>
        </div>
      </div>
      <section className="graph-entry glass-panel">
        <div className="graph-illustration" aria-hidden="true">
          <svg viewBox="0 0 500 270" fill="none">
            <path
              d="M115 135L250 67M115 135L250 203M250 67L385 67M250 203L385 203M250 67L250 203"
              stroke="#c5d2e8"
              strokeWidth="1.5"
            />
            <path d="M250 67L385 203" stroke="#c5d2e8" strokeDasharray="5 5" />
            <circle cx="115" cy="135" r="31" fill="#edf2ff" stroke="#8da8f2" />
            <circle
              cx="115"
              cy="135"
              r="10"
              stroke="#315be8"
              strokeWidth="1.5"
            />
            <rect
              x="211"
              y="45"
              width="78"
              height="44"
              rx="22"
              fill="#f0f4ff"
              stroke="#a4b9f4"
            />
            <rect
              x="235"
              y="60"
              width="30"
              height="14"
              rx="7"
              stroke="#315be8"
              strokeWidth="1.5"
            />
            <rect
              x="211"
              y="181"
              width="78"
              height="44"
              rx="22"
              fill="#f0f4ff"
              stroke="#a4b9f4"
            />
            <rect
              x="235"
              y="196"
              width="30"
              height="14"
              rx="7"
              stroke="#315be8"
              strokeWidth="1.5"
            />
            <path
              d="M365 44H405L418 67L405 90H365L352 67Z"
              fill="#eaf7f1"
              stroke="#89bfae"
            />
            <path
              d="M376 67L383 74L396 60"
              stroke="#168267"
              strokeWidth="1.5"
            />
            <path
              d="M365 180H405L418 203L405 226H365L352 203Z"
              fill="#eaf7f1"
              stroke="#89bfae"
            />
            <path
              d="M376 203L383 210L396 196"
              stroke="#168267"
              strokeWidth="1.5"
            />
          </svg>
        </div>
        <div className="graph-entry-copy">
          <Network size={22} />
          <h2>Mở rộng góc nhìn về hệ thống</h2>
          <p>
            Xem các mối liên hệ và chỉnh sửa đồ thị trong Neo4j. Với từng thiết
            bị, bạn có thể xem đồ thị mục tiêu ngay trong trang chi tiết bản sao
            số.
          </p>
          <a
            className="btn btn-primary"
            href={NEO4J_BROWSER_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Mở Neo4j
            <ExternalLink size={15} />
          </a>
          <small>Mở trong thẻ mới</small>
        </div>
      </section>
    </div>
  );
}
