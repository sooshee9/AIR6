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
          display: flex; align-items: center; gap: 12px; text-decoration: none;
          flex-shrink: 0;
        }
        .erp-brand-icon {
          width: 38px; height: 38px; border-radius: 10px;
          background: linear-gradient(160deg, #1565C0 0%, #0d47a1 100%);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4), 0 0 0 1px rgba(66,165,245,0.3);
          flex-shrink: 0;
          font-family: 'Cinzel', Georgia, serif;
          font-weight: 900;
          font-size: 18px;
          color: #fff;
          letter-spacing: -0.02em;
          text-shadow: 0 1px 4px rgba(0,0,0,0.4);
          user-select: none;
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

        /* The white card wrapper — DO NOT set overflow:hidden here */
        .erp-content {
          background: #fff;
          border-radius: 14px;
          border: 1px solid #E4E8F0;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.04);
          min-height: 500px;
          overflow: visible;
        }

        /*
         * KEY FIX: every module renders its own outer div with minHeight:'100vh'.
         * Override that here so it doesn't create extra scroll space inside the card.
         */
        .erp-content > * {
          min-height: unset !important;
        }

        /* ── Footer Nav ── */
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

        .erp-nav {
          display: flex; justify-content: center; align-items: center;
          gap: 4px; padding: 10px 16px;
          overflow-x: auto; flex-wrap: nowrap;
          scrollbar-width: none;
        }
        .erp-nav::-webkit-scrollbar { display: none; }

        .erp-nav-btn {
          display: flex; flex-direction: column; align-items: center; gap: 4px;
          padding: 8px 16px; border-radius: 10px;
          border: 1px solid transparent;
          background: transparent;
          color: rgba(255,255,255,0.6);
          font-family: 'Inter', sans-serif;
          font-size: 12px; font-weight: 500;
          cursor: pointer; white-space: nowrap;
          transition: all 0.15s; flex-shrink: 0;
          min-width: 68px;
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

          {/* Brand */}
          <div className="erp-brand">
            {/* Letter "A" icon — no broken image dependency */}
            <div className="erp-brand-icon">A</div>
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

        {/* ── Scrollable body between header and footer ── */}
        <div className="erp-body">
          <main className="erp-main">
            <div className="erp-content">
              <ErrorBoundary>
                {renderModule()}
              </ErrorBoundary>
            </div>
          </main>
        </div>

        {/* ── Footer Nav ── */}
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