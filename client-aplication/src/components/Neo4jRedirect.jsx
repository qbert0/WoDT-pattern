import React from 'react';
import { NEO4J_BROWSER_URL } from '../config';

const Neo4jRedirect = () => {
  const handleRedirect = () => {
    window.open(NEO4J_BROWSER_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', maxWidth: '600px', margin: '0 auto', marginTop: '4rem' }}>
      <h2 style={{ fontSize: '1.8rem', marginBottom: '1rem', color: 'var(--text-main)' }}>Neo4j Knowledge Graph Integration</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', lineHeight: '1.6' }}>
        Load your Digital Twin data into the Neo4j Knowledge Graph. This will redirect you to the specialized Neo4j graph application where you can visualize and manage your KG effectively.
      </p>
      
      <button className="btn btn-primary" onClick={handleRedirect} style={{ padding: '0.75rem 2rem', fontSize: '1.1rem' }}>
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
          <polyline points="15 3 21 3 21 9"></polyline>
          <line x1="10" y1="14" x2="21" y2="3"></line>
        </svg>
        Load KG to Neo4j
      </button>
    </div>
  );
};

export default Neo4jRedirect;
