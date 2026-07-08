import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Module1Home from './components/Module1Home';
import Module2DTStatus from './components/Module2DTStatus';
import Module3CreateWizard from './components/Module3CreateWizard';
import PolicyManager from './components/PolicyManager';
import ConnectionManager from './components/ConnectionManager';
import Neo4jRedirect from './components/Neo4jRedirect';

function App() {
  const location = useLocation();
  const currentPath = location.pathname;

  // Helper to check active state based on path prefix
  const isActive = (path) => {
    if (path === '/') return currentPath === '/' || currentPath.startsWith('/dt/');
    if (path === '/create-dt') return currentPath === '/create-dt';
    return currentPath.startsWith(path);
  };

  return (
    <div className="app-container">
      <nav className="sidebar glass-panel">
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '2rem', background: 'linear-gradient(to right, #60a5fa, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Ditto Studio
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <Link
              to="/"
              className={`btn ${isActive('/') ? 'btn-primary' : ''}`}
              style={{ justifyContent: 'flex-start', background: isActive('/') ? 'var(--primary)' : 'transparent', color: isActive('/') ? 'white' : 'var(--text-muted)', textDecoration: 'none' }}
            >
              Digital Twins
            </Link>
            <Link
              to="/create-dt"
              className={`btn ${isActive('/create-dt') ? 'btn-primary' : ''}`}
              style={{ justifyContent: 'flex-start', background: isActive('/create-dt') ? 'var(--primary)' : 'transparent', color: isActive('/create-dt') ? 'white' : 'var(--text-muted)', textDecoration: 'none' }}
            >
              Khởi tạo DT Mới
            </Link>
            <Link
              to="/policies"
              className={`btn ${isActive('/policies') ? 'btn-primary' : ''}`}
              style={{ justifyContent: 'flex-start', background: isActive('/policies') ? 'var(--primary)' : 'transparent', color: isActive('/policies') ? 'white' : 'var(--text-muted)', textDecoration: 'none' }}
            >
              Policies
            </Link>
            <Link
              to="/connections"
              className={`btn ${isActive('/connections') ? 'btn-primary' : ''}`}
              style={{ justifyContent: 'flex-start', background: isActive('/connections') ? 'var(--primary)' : 'transparent', color: isActive('/connections') ? 'white' : 'var(--text-muted)', textDecoration: 'none' }}
            >
              Connections
            </Link>
            <hr style={{ borderColor: 'var(--border-color)', margin: '1rem 0', opacity: 0.5 }} />
            <Link
              to="/neo4j"
              className={`btn ${isActive('/neo4j') ? 'btn-primary' : ''}`}
              style={{ justifyContent: 'flex-start', background: isActive('/neo4j') ? 'var(--primary)' : 'transparent', color: isActive('/neo4j') ? 'white' : 'var(--text-muted)', textDecoration: 'none' }}
            >
              Neo4j Integration
            </Link>
          </div>
        </div>
      </nav>

      <main className="main-content">
        <Routes>
          <Route path="/" element={<Module1Home />} />
          <Route path="/dt/:id" element={<Module2DTStatus />} />
          <Route path="/create-dt" element={<Module3CreateWizard />} />
          <Route path="/policies" element={<PolicyManager />} />
          <Route path="/connections" element={<ConnectionManager />} />
          <Route path="/neo4j" element={<Neo4jRedirect />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
