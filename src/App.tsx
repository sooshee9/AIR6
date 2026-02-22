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

const ICON_B64 = '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';

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
        html, body { height: 100%; }

        .erp-app {
          font-family: 'Inter', system-ui, sans-serif;
          background: #F0F2F8;
          min-height: 100vh;
          -webkit-font-smoothing: antialiased;
        }

        /* ── Header ── */
        .erp-header {
          position: sticky; top: 0; z-index: 200;
          background: linear-gradient(90deg, #071525 0%, #0f2540 50%, #071525 100%);
          border-bottom: 1px solid rgba(21,101,192,0.3);
          box-shadow: 0 2px 20px rgba(0,0,0,0.35), 0 0 40px rgba(21,101,192,0.08);
          padding: 0 24px;
          height: 64px;
          display: flex; align-items: center; justify-content: space-between;
          gap: 16px;
        }

        /* shimmer top line */
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
          background: linear-gradient(160deg, #fff 0%, #eef4ff 100%);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3), 0 0 0 1px rgba(21,101,192,0.2);
          flex-shrink: 0;
          position: relative; overflow: hidden;
        }
        .erp-brand-icon::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 50%;
          background: linear-gradient(to bottom, rgba(255,255,255,0.6), transparent);
          z-index: 2;
        }
        .erp-brand-icon img { width: 28px; height: 28px; object-fit: contain; position: relative; z-index: 1; }

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

        /* breadcrumb */
        .erp-breadcrumb {
          display: flex; align-items: center; gap: 6px;
          font-size: 12px; color: rgba(180,210,245,0.5);
          flex: 1; justify-content: center;
        }
        .erp-breadcrumb-sep { opacity: 0.35; }
        .erp-breadcrumb-active {
          color: rgba(180,210,245,0.85); font-weight: 500;
        }

        /* header right */
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
        .erp-user-email { font-size: 12px; color: rgba(200,220,255,0.6); max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

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

        /* ── Main ── */
        .erp-main {
          max-width: 1400px;
          margin: 24px auto 100px;
          padding: 0 20px;
        }

        .erp-content {
          background: #fff;
          border-radius: 14px;
          border: 1px solid #E4E8F0;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.04);
          min-height: 500px;
          overflow: hidden;
        }

        /* ── Footer Nav ── */
        .erp-footer {
          position: fixed; left: 0; bottom: 0; width: 100%;
          background: linear-gradient(90deg, #071525 0%, #0f2540 50%, #071525 100%);
          border-top: 1px solid rgba(21,101,192,0.25);
          box-shadow: 0 -4px 24px rgba(0,0,0,0.4);
          z-index: 200;
        }
        .erp-footer::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(21,101,192,0.5), transparent);
        }

        .erp-nav {
          display: flex; justify-content: center; align-items: center;
          gap: 2px; padding: 8px 12px;
          overflow-x: auto; flex-wrap: nowrap;
          scrollbar-width: none;
        }
        .erp-nav::-webkit-scrollbar { display: none; }

        .erp-nav-btn {
          display: flex; flex-direction: column; align-items: center; gap: 2px;
          padding: 6px 14px; border-radius: 8px;
          border: 1px solid transparent;
          background: transparent;
          color: rgba(255,255,255,0.5);
          font-family: 'Inter', sans-serif;
          font-size: 11px; font-weight: 400;
          cursor: pointer; white-space: nowrap;
          transition: all 0.15s; flex-shrink: 0;
        }
        .erp-nav-btn .nav-icon { font-size: 14px; line-height: 1; }
        .erp-nav-btn .nav-label { line-height: 1; }

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
            <div className="erp-brand-icon">
              <img src={`data:image/png;base64,${ICON_B64}`} alt="Airtech" />
            </div>
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

        {/* ── Main Content ── */}
        <main className="erp-main">
          <div className="erp-content">
            <ErrorBoundary>
              {renderModule()}
            </ErrorBoundary>
          </div>
        </main>

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