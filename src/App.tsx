import React, { useState } from 'react';

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

const NAV_ITEMS: { key: ModuleKey; label: string }[] = [
  { key: 'purchase',     label: 'Purchase'       },
  { key: 'vendorDept',   label: 'Vendor Dept'    },
  { key: 'vendorIssue',  label: 'Vendor Issue'   },
  { key: 'inHouseIssue', label: 'In-House Issue' },
  { key: 'indent',       label: 'Indent'         },
  { key: 'psir',         label: 'PSIR'           },
  { key: 'vsir',         label: 'VSIR'           },
  { key: 'stock',        label: 'Stock'          },
  { key: 'itemMaster',   label: 'Item Master'    },
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
        .map(([k, v]) => `  ${k}: ${v}`)
        .join('\n');
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

  return (
    <div className="erp-app" style={{ fontFamily: 'Segoe UI, Arial, sans-serif', background: '#f6f8fa', minHeight: '100vh' }}>

      {/* ── Header ── */}
      <header style={{
        background: '#1a237e', color: '#fff',
        padding: '16px 32px 10px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      }}>
        <h1 style={{ margin: '0 0 10px', fontSize: 24, fontWeight: 700, letterSpacing: 0.5, textAlign: 'center' }}>
          Airtech Inventory ERP
        </h1>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, opacity: 0.85 }}>{user.email}</span>
          <SyncStatus />
          <button
            onClick={() => handleHardReset(user.uid)}
            style={headerBtn('#c62828')}
          >
            Hard Reset
          </button>
          <button
            onClick={() => setUser(null)}
            style={headerBtn('rgba(255,255,255,0.15)')}
          >
            Logout
          </button>
        </div>
      </header>

      {/* ── Content ── */}
      <main style={{
        maxWidth: 1200,
        margin: '28px auto 100px',   // 100px bottom clearance for fixed footer
        background: '#fff',
        borderRadius: 10,
        boxShadow: '0 2px 16px rgba(0,0,0,0.07)',
        padding: '28px 32px',
        minHeight: 400,
      }}>
        <ErrorBoundary>
          {renderModule()}
        </ErrorBoundary>
      </main>

      {/* ── Footer Nav ── */}
      <footer style={{
        position: 'fixed', left: 0, bottom: 0, width: '100%',
        background: '#1a237e',
        boxShadow: '0 -2px 8px rgba(0,0,0,0.1)',
        zIndex: 100,
      }}>
        <nav style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 4,
          padding: '8px 16px',
          overflowX: 'auto',
          flexWrap: 'nowrap',
        }}>
          {NAV_ITEMS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveModule(key)}
              style={navBtn(activeModule === key)}
            >
              {label}
            </button>
          ))}
        </nav>
      </footer>
    </div>
  );
}

// ─── Style helpers ────────────────────────────────────────────────────────────

function navBtn(active: boolean): React.CSSProperties {
  return {
    background:    active ? '#3949ab' : 'transparent',
    color:         active ? '#fff' : 'rgba(255,255,255,0.75)',
    border:        active ? '1px solid #5c6bc0' : '1px solid transparent',
    borderRadius:  6,
    padding:       '8px 18px',
    fontWeight:    active ? 600 : 400,
    fontSize:      14,
    cursor:        'pointer',
    whiteSpace:    'nowrap',
    transition:    'all 0.15s',
    letterSpacing: '0.1px',
  };
}

function headerBtn(bg: string): React.CSSProperties {
  return {
    background:   bg,
    color:        '#fff',
    border:       '1px solid rgba(255,255,255,0.2)',
    borderRadius: 6,
    padding:      '6px 14px',
    fontSize:     13,
    fontWeight:   500,
    cursor:       'pointer',
  };
}

export default App;