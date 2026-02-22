import { useState } from 'react';

import LoginPage from './LoginPage';
import SyncStatus from './components/SyncStatus';
import { ErrorBoundary } from './components/ErrorBoundary';

import IndentModule from './modules/IndentModule';
import PurchaseModule from './modules/PurchaseModule';
import VendorDeptModule from './modules/VendorDeptModule';
import VendorIssueModule from './modules/VendorIssueModule';
import InHouseIssueModule from './modules/InHouseIssueModule';
import PSIRModule from './modules/PSIRModule';
import VSIRModule from './modules/VSIRModule';
import StockModule from './modules/StockModule';
import ItemMasterModule from './modules/ItemMasterModule';

import { useUserRole } from './hooks/useUserRole';
import { useUserDataSync } from './hooks/useUserDataSync';
import { hardResetAllData, verifyDataCleared, forceCleanupAllData } from './utils/firestoreServices';

import './App.css';

// ─── Logo (embedded, no external dependency) ─────────────────────────────────
const LOGO_DATA_URL = 'data:image/png;base64,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';

// ─── Types ────────────────────────────────────────────────────────────────────
type ModuleKey =
  | 'purchase' | 'indent' | 'vendorDept' | 'vendorIssue'
  | 'inHouseIssue' | 'psir' | 'vsir' | 'stock' | 'itemMaster';

const NAV_ITEMS: { key: ModuleKey; label: string; icon: string }[] = [
  { key: 'purchase',     label: 'Purchase',       icon: '🛒' },
  { key: 'vendorDept',   label: 'Vendor Dept',    icon: '🏭' },
  { key: 'vendorIssue',  label: 'Vendor Issue',   icon: '📦' },
  { key: 'inHouseIssue', label: 'In-House Issue', icon: '🔧' },
  { key: 'indent',       label: 'Indent',         icon: '📋' },
  { key: 'psir',         label: 'PSIR',           icon: '✅' },
  { key: 'vsir',         label: 'VSIR',           icon: '🔍' },
  { key: 'stock',        label: 'Stock',          icon: '📊' },
  { key: 'itemMaster',   label: 'Item Master',    icon: '🗂️' },
];

// ─── Hard Reset ───────────────────────────────────────────────────────────────
async function handleHardReset(uid: string) {
  if (!window.confirm('⚠️ This will permanently delete ALL data except Item Master. Continue?')) return;
  try {
    await hardResetAllData(uid);
    let verification = await verifyDataCleared(uid);
    if (!verification.allClear) {
      await forceCleanupAllData(uid);
      verification = await verifyDataCleared(uid);
    }
    if (verification.allClear) {
      alert('✅ All data deleted successfully. Refreshing…');
    } else {
      const remaining = Object.entries(verification.results)
        .map(([k, v]) => `  ${k}: ${v}`).join('\n');
      alert(`⚠️ Some data could not be deleted:\n${remaining}\n\nRefreshing anyway…`);
    }
    window.location.reload();
  } catch (err) {
    console.error('[App] Hard reset failed:', err);
    alert('❌ Hard reset failed. Check console for details.');
  }
}

// ─── App ──────────────────────────────────────────────────────────────────────
function App() {
  const [activeModule, setActiveModule] = useState<ModuleKey>('purchase');
  const [user, setUser] = useState<any>(null);

  useUserRole(user);
  useUserDataSync(user);

  if (!user) return <LoginPage onLogin={setUser} />;

  const renderModule = () => {
    switch (activeModule) {
      case 'purchase':     return <PurchaseModule user={user} />;
      case 'indent':       return <IndentModule user={user} />;
      case 'vendorDept':   return <VendorDeptModule />;
      case 'vendorIssue':  return <VendorIssueModule />;
      case 'inHouseIssue': return <InHouseIssueModule />;
      case 'psir':         return <PSIRModule />;
      case 'vsir':         return <VSIRModule />;
      case 'stock':        return <StockModule />;
      case 'itemMaster':   return <ItemMasterModule />;
    }
  };

  const activeLabel = NAV_ITEMS.find(n => n.key === activeModule)?.label ?? '';

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=Inter:wght@300;400;500;600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; overflow: hidden; }

        .erp-app {
          font-family: 'Inter', system-ui, sans-serif;
          background: #F0F2F8;
          height: 100vh;
          display: flex;
          flex-direction: column;
          -webkit-font-smoothing: antialiased;
          overflow: hidden;
        }

        /* ── Header ── */
        .erp-header {
          flex-shrink: 0;
          position: relative;
          z-index: 200;
          background: linear-gradient(90deg, #071525 0%, #0f2540 50%, #071525 100%);
          border-bottom: 1px solid rgba(21,101,192,0.3);
          box-shadow: 0 2px 20px rgba(0,0,0,0.35), 0 0 40px rgba(21,101,192,0.08);
          padding: 0 24px;
          height: 64px;
          display: flex; align-items: center; justify-content: space-between;
          gap: 16px;
        }

        .erp-header::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, #0d47a1, #1565C0, #42a5f5, #1565C0, #0d47a1);
          background-size: 200% 100%;
          animation: headerShimmer 3s linear infinite;
        }

        .erp-brand {
          display: flex; align-items: center; gap: 12px;
          flex-shrink: 0;
        }
        /* Logo image replaces the old letter/anchor icon */
        .erp-brand-logo {
          width: 40px; height: 40px; border-radius: 10px;
          object-fit: cover;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4), 0 0 0 1px rgba(66,165,245,0.25);
          flex-shrink: 0;
        }

        .erp-brand-text { display: flex; flex-direction: column; gap: 1px; }
        .erp-brand-name {
          font-family: 'Cinzel', serif;
          font-weight: 900; font-size: 15px; letter-spacing: 0.1em;
          color: #1565C0;
          text-shadow: 0 0 20px rgba(21,101,192,0.5);
          line-height: 1;
        }
        .erp-brand-name .erp-suffix { color: #42a5f5; font-weight: 700; }
        .erp-brand-sub {
          font-size: 9.5px; font-weight: 400; letter-spacing: 0.14em;
          text-transform: uppercase; color: rgba(180,210,245,0.45);
          line-height: 1;
        }

        .erp-breadcrumb {
          display: flex; align-items: center; gap: 6px;
          font-size: 12px; color: rgba(180,210,245,0.5);
          flex: 1; justify-content: center;
        }
        .erp-breadcrumb-sep { opacity: 0.35; }
        .erp-breadcrumb-active { color: rgba(180,210,245,0.85); font-weight: 500; }

        .erp-header-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

        .erp-user-pill {
          display: flex; align-items: center; gap: 6px;
          padding: 4px 10px; border-radius: 20px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.08);
        }
        .erp-user-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #4caf50;
          box-shadow: 0 0 6px rgba(76,175,80,0.7);
        }
        .erp-user-email {
          font-size: 12px; color: rgba(200,220,255,0.6);
          max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }

        .erp-hbtn {
          display: flex; align-items: center; gap: 5px;
          padding: 6px 12px; border-radius: 7px;
          font-family: 'Inter', sans-serif;
          font-size: 12px; font-weight: 500; cursor: pointer;
          border: 1px solid transparent;
          transition: all 0.15s;
        }
        .erp-hbtn-reset {
          background: rgba(198,40,40,0.12);
          border-color: rgba(198,40,40,0.25);
          color: #ef9a9a;
        }
        .erp-hbtn-reset:hover { background: rgba(198,40,40,0.22); color: #ffcdd2; }
        .erp-hbtn-logout {
          background: rgba(255,255,255,0.07);
          border-color: rgba(255,255,255,0.12);
          color: rgba(200,220,255,0.65);
        }
        .erp-hbtn-logout:hover { background: rgba(255,255,255,0.12); color: #fff; }

        /* ── Scrollable Body ── */
        .erp-body {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          scrollbar-width: thin;
          scrollbar-color: rgba(21,101,192,0.3) transparent;
        }
        .erp-body::-webkit-scrollbar { width: 6px; }
        .erp-body::-webkit-scrollbar-track { background: transparent; }
        .erp-body::-webkit-scrollbar-thumb {
          background: rgba(21,101,192,0.3); border-radius: 3px;
        }
        .erp-body::-webkit-scrollbar-thumb:hover { background: rgba(21,101,192,0.5); }

        /* ── Main ── */
        .erp-main {
          max-width: 1400px;
          margin: 24px auto;
          padding: 0 20px 24px;
        }

        .erp-content {
          background: #fff;
          border-radius: 14px;
          border: 1px solid #E4E8F0;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.04);
          min-height: 500px;
          overflow: visible;
        }
        .erp-content > * { min-height: unset !important; }

        /* ── Footer — SINGLE nav row only, no duplicate pills ── */
        .erp-footer {
          flex-shrink: 0;
          position: relative;
          z-index: 200;
          background: linear-gradient(90deg, #071525 0%, #0f2540 50%, #071525 100%);
          border-top: 1px solid rgba(21,101,192,0.25);
          box-shadow: 0 -4px 24px rgba(0,0,0,0.4);
        }
        .erp-footer::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(21,101,192,0.5), transparent);
        }

        /* Single icon+label nav — no second pill row */
        .erp-nav {
          display: flex; justify-content: center; align-items: center;
          gap: 4px; padding: 8px 16px;
          overflow-x: auto; flex-wrap: nowrap;
          scrollbar-width: none;
        }
        .erp-nav::-webkit-scrollbar { display: none; }

        .erp-nav-btn {
          display: flex; flex-direction: column; align-items: center; gap: 4px;
          padding: 8px 14px; border-radius: 10px;
          border: 1px solid transparent;
          background: transparent;
          color: rgba(255,255,255,0.6);
          font-family: 'Inter', sans-serif;
          font-size: 11px; font-weight: 500;
          cursor: pointer; white-space: nowrap;
          transition: all 0.15s; flex-shrink: 0;
          min-width: 64px;
        }
        .erp-nav-btn .nav-icon { font-size: 20px; line-height: 1; }
        .erp-nav-btn .nav-label { line-height: 1; letter-spacing: 0.01em; }

        .erp-nav-btn:hover {
          color: rgba(255,255,255,0.8);
          background: rgba(255,255,255,0.06);
        }
        .erp-nav-btn.active {
          background: rgba(21,101,192,0.18);
          border-color: rgba(21,101,192,0.35);
          color: #42a5f5;
          font-weight: 600;
          box-shadow: 0 0 12px rgba(21,101,192,0.2);
        }
        .erp-nav-btn.active .nav-icon { filter: drop-shadow(0 0 4px rgba(66,165,245,0.6)); }

        @keyframes headerShimmer {
          from { background-position: 200% 0; } to { background-position: -200% 0; }
        }
      `}</style>

      <div className="erp-app">

        {/* ── Header ── */}
        <header className="erp-header">

          {/* Brand: app logo image (no anchor, no plain "A") */}
          <div className="erp-brand">
            <img
              src={LOGO_DATA_URL}
              alt="Airtech ERP"
              className="erp-brand-logo"
            />
            <div className="erp-brand-text">
              <div className="erp-brand-name">AIRTECH&nbsp;<span className="erp-suffix">ERP</span></div>
              <div className="erp-brand-sub">Inventory Management</div>
            </div>
          </div>

          {/* Breadcrumb */}
          <div className="erp-breadcrumb">
            <span>Airtech ERP</span>
            <span className="erp-breadcrumb-sep">›</span>
            <span className="erp-breadcrumb-active">{activeLabel}</span>
          </div>

          {/* Right side */}
          <div className="erp-header-right">
            <SyncStatus />
            <div className="erp-user-pill">
              <div className="erp-user-dot"></div>
              <span className="erp-user-email">{user.email}</span>
            </div>
            <button className="erp-hbtn erp-hbtn-reset" onClick={() => handleHardReset(user.uid)}>
              ⚠ Reset
            </button>
            <button className="erp-hbtn erp-hbtn-logout" onClick={() => setUser(null)}>
              ⏻ Logout
            </button>
          </div>
        </header>

        {/* ── Scrollable body ── */}
        <div className="erp-body">
          <main className="erp-main">
            <div className="erp-content">
              <ErrorBoundary>
                {renderModule()}
              </ErrorBoundary>
            </div>
          </main>
        </div>

        {/* ── Footer: SINGLE nav row (icon + label) — no duplicate pill row ── */}
        <footer className="erp-footer">
          <nav className="erp-nav">
            {NAV_ITEMS.map(({ key, label, icon }) => (
              <button
                key={key}
                className={`erp-nav-btn${activeModule === key ? ' active' : ''}`}
                onClick={() => setActiveModule(key)}
              >
                <span className="nav-icon">{icon}</span>
                <span className="nav-label">{label}</span>
              </button>
            ))}
          </nav>
        </footer>

      </div>
    </>
  );
}

export default App;