import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import {
  Boxes,
  Plus,
  ShieldCheck,
  Cable,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
  Menu,
  X,
} from 'lucide-react';
import Module1Home from './components/Module1Home';
import Module2DTStatus from './components/Module2DTStatus';
import Module3CreateWizard from './components/Module3CreateWizard';
import PolicyManager from './components/PolicyManager';
import ConnectionManager from './components/ConnectionManager';
import Neo4jRedirect from './components/Neo4jRedirect';

const navigation = [
  { path: '/', label: 'Digital Twins', icon: Boxes },
  { path: '/create-dt', label: 'Tạo bản sao số', icon: Plus },
  { path: '/policies', label: 'Phân quyền', icon: ShieldCheck },
  { path: '/connections', label: 'Kết nối', icon: Cable },
  { path: '/neo4j', label: 'Đồ thị tri thức', icon: Network },
];

function App() {
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const sidebarRef = useRef(null);
  useEffect(() => {
    if (!mobileOpen) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const sidebar = sidebarRef.current;
    const focusable = () =>
      [...sidebar.querySelectorAll('a, button')].filter(
        (element) => element.getClientRects().length,
      );
    focusable()[0]?.focus();
    const handleKey = (event) => {
      if (event.key === 'Escape') setMobileOpen(false);
      if (event.key !== 'Tab') return;
      const elements = focusable();
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const handleResize = () => {
      if (window.innerWidth > 560) setMobileOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('resize', handleResize);
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus();
    };
  }, [mobileOpen]);
  const active = navigation.find((item) =>
    item.path === '/'
      ? pathname === '/' || pathname.startsWith('/dt/')
      : pathname.startsWith(item.path),
  );

  return (
    <div
      className={`app-container${collapsed ? ' sidebar-collapsed' : ''}${mobileOpen ? ' mobile-nav-open' : ''}`}
    >
      <a className="skip-link" href="#main-content">
        Đến nội dung chính
      </a>
      {mobileOpen && (
        <button
          className="nav-backdrop"
          aria-label="Đóng điều hướng"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside ref={sidebarRef} className="sidebar" id="workspace-navigation">
        <Link
          to="/"
          className="brand"
          aria-label="Ditto Studio, trang chủ"
          onClick={() => setMobileOpen(false)}
        >
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
          </span>
          <span className="brand-copy">
            ditto<span>studio</span>
          </span>
        </Link>
        <div className="workspace-label">
          <span className="workspace-symbol">W</span>
          <span>
            WoDT Lab<small>Không gian làm việc</small>
          </span>
        </div>
        <nav className="nav-links" aria-label="Điều hướng chính">
          {navigation.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              className={`nav-link${active?.path === path ? ' is-active' : ''}`}
              aria-current={active?.path === path ? 'page' : undefined}
              title={label}
              onClick={() => setMobileOpen(false)}
            >
              <Icon size={19} strokeWidth={1.7} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="lab-note">
            <span className="twin-mini-mark" aria-hidden="true">
              ◇
            </span>
            <span>
              Thế giới thực.
              <br />
              Kết nối số.
            </span>
          </div>
          <button
            className="sidebar-toggle"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? 'Mở rộng điều hướng' : 'Thu gọn điều hướng'}
            aria-expanded={!collapsed}
          >
            {collapsed ? (
              <PanelLeftOpen size={18} />
            ) : (
              <PanelLeftClose size={18} />
            )}
            <span>Thu gọn</span>
          </button>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="workspace-topbar">
          <button
            className="icon-btn mobile-menu"
            aria-label={mobileOpen ? 'Đóng điều hướng' : 'Mở điều hướng'}
            aria-expanded={mobileOpen}
            aria-controls="workspace-navigation"
            onClick={() => setMobileOpen((value) => !value)}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="breadcrumb">
            <span>Không gian làm việc</span>
            <ChevronRight size={14} />
            <span>{active?.label || 'Digital Twins'}</span>
            {pathname.startsWith('/dt/') && (
              <>
                <ChevronRight size={14} />
                <span>Chi tiết</span>
              </>
            )}
          </div>
          <span className="project-label">
            <span className="project-dot" />
            WoDT Lab
          </span>
        </header>
        <main className="main-content" id="main-content">
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
    </div>
  );
}

export default App;
