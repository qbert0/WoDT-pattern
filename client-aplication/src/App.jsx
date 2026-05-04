import React, { useState } from 'react';
import ThingManager from './components/ThingManager';
import PolicyManager from './components/PolicyManager';
import ConnectionManager from './components/ConnectionManager';
import Neo4jRedirect from './components/Neo4jRedirect';

function App() {
  const [activeTab, setActiveTab] = useState('dts'); // 'dts', 'policies', 'connections', 'neo4j'

  return (
    <div className="app-container">
      <nav className="sidebar glass-panel">
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '2rem', background: 'linear-gradient(to right, #60a5fa, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Ditto Studio
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button 
              className={`btn ${activeTab === 'dts' ? 'btn-primary' : ''}`}
              style={{ justifyContent: 'flex-start', background: activeTab === 'dts' ? 'var(--primary)' : 'transparent', color: activeTab === 'dts' ? 'white' : 'var(--text-muted)' }}
              onClick={() => setActiveTab('dts')}
            >
              Digital Twins
            </button>
            <button 
              className={`btn ${activeTab === 'policies' ? 'btn-primary' : ''}`}
              style={{ justifyContent: 'flex-start', background: activeTab === 'policies' ? 'var(--primary)' : 'transparent', color: activeTab === 'policies' ? 'white' : 'var(--text-muted)' }}
              onClick={() => setActiveTab('policies')}
            >
              Policies
            </button>
            <button 
              className={`btn ${activeTab === 'connections' ? 'btn-primary' : ''}`}
              style={{ justifyContent: 'flex-start', background: activeTab === 'connections' ? 'var(--primary)' : 'transparent', color: activeTab === 'connections' ? 'white' : 'var(--text-muted)' }}
              onClick={() => setActiveTab('connections')}
            >
              Connections
            </button>
            <hr style={{ borderColor: 'var(--border-color)', margin: '1rem 0', opacity: 0.5 }} />
            <button 
              className={`btn ${activeTab === 'neo4j' ? 'btn-primary' : ''}`}
              style={{ justifyContent: 'flex-start', background: activeTab === 'neo4j' ? 'var(--primary)' : 'transparent', color: activeTab === 'neo4j' ? 'white' : 'var(--text-muted)' }}
              onClick={() => setActiveTab('neo4j')}
            >
              Neo4j Integration
            </button>
          </div>
        </div>
      </nav>

      <main className="main-content">
        {activeTab === 'dts' && <ThingManager />}
        {activeTab === 'policies' && <PolicyManager />}
        {activeTab === 'connections' && <ConnectionManager />}
        {activeTab === 'neo4j' && <Neo4jRedirect />}
      </main>
    </div>
  );
}

export default App;
