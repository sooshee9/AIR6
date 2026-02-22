import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import {
  getItemMaster,
  subscribeInHouseIssues,
  addInHouseIssue,
  updateInHouseIssue,
  deleteInHouseIssue,
  subscribeVSIRRecords,
} from '../utils/firestoreServices';
import { subscribePsirs } from '../utils/psirService';

// ─── Types ────────────────────────────────────────────────────────────────────

interface InHouseIssueItem {
  itemName: string; itemCode: string; transactionType: string;
  batchNo: string; issueQty: number; reqBy: string;
  inStock: number; reqClosed: boolean; receivedDate?: string;
}

interface InHouseIssue {
  id?: string; reqNo: string; reqDate: string; indentNo: string;
  oaNo: string; poNo: string; vendor: string; purchaseBatchNo: string;
  vendorBatchNo: string; issueNo: string; items: InHouseIssueItem[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const REQ_BY_OPTIONS = ['HKG', 'NGR', 'MDD'];
const TX_TYPE_OPTIONS = ['Purchase', 'Vendor', 'Stock'];

const BLANK_ITEM: InHouseIssueItem = {
  itemName: '', itemCode: '', transactionType: 'Purchase', batchNo: '',
  issueQty: 0, reqBy: '', inStock: 0, reqClosed: false,
  receivedDate: new Date().toISOString().slice(0, 10),
};

// ─── Serial generators ────────────────────────────────────────────────────────

function getNextReqNo(issues: InHouseIssue[]): string {
  if (!issues.length) return 'Req-No-01';
  const max = Math.max(...issues.map(i => { const m = i.reqNo?.match(/Req-No-(\d+)/); return m ? parseInt(m[1], 10) : 0; }));
  return `Req-No-${String(max + 1).padStart(2, '0')}`;
}

function getNextIssueNo(issues: InHouseIssue[]): string {
  if (!issues.length) return 'IH-ISS-01';
  const max = Math.max(...issues.map(i => { const m = i.issueNo?.match(/IH-ISS-(\d+)/); return m ? parseInt(m[1], 10) : 0; }));
  return `IH-ISS-${String(max + 1).padStart(2, '0')}`;
}

function blankIssue(issues: InHouseIssue[]): InHouseIssue {
  return {
    reqNo: getNextReqNo(issues), reqDate: '', indentNo: '', oaNo: '', poNo: '',
    vendor: '', purchaseBatchNo: '', vendorBatchNo: '', issueNo: getNextIssueNo(issues), items: [],
  };
}

// ─── Global CSS (same design language as VendorDeptModule / VendorIssueModule) ─

const GLOBAL_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=JetBrains+Mono:wght@400;500&display=swap');

.ihm { font-family:'DM Sans',system-ui,sans-serif; color:#111827; background:#f4f5f9; }
.ihm * { box-sizing:border-box; font-family:inherit; }
.ihm-inner { max-width:1480px; margin:0 auto; padding:24px 28px; }

.ihm-input {
  padding:8px 12px; border-radius:8px; border:1.5px solid #e2e4ea;
  font-size:13.5px; width:100%; transition:border-color 0.15s,box-shadow 0.15s;
  background:#fff; color:#111; line-height:1.5;
}
.ihm-input:focus { outline:none; border-color:#1a237e; box-shadow:0 0 0 3px rgba(26,35,126,0.1); }
.ihm-input-ro { background:#f7f8fb !important; color:#8b95a1 !important; cursor:default; }
.ihm-input-accent { border-color:#1a237e !important; font-weight:500; }
.ihm-select {
  -webkit-appearance:none; appearance:none;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%238b95a1' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat:no-repeat; background-position:right 10px center; padding-right:34px;
}
.ihm-checkbox { display:flex; align-items:center; gap:8px; cursor:pointer; font-size:13px; font-weight:500; color:#374151; user-select:none; }
.ihm-checkbox input[type=checkbox] { width:16px; height:16px; accent-color:#1a237e; cursor:pointer; }

.ihm-btn {
  display:inline-flex; align-items:center; justify-content:center; gap:6px;
  padding:9px 18px; border-radius:8px; border:none; cursor:pointer;
  font-size:13px; font-weight:600; transition:all 0.15s; white-space:nowrap;
}
.ihm-btn:active { transform:scale(0.97); }
.ihm-btn-sm  { padding:7px 14px; font-size:12.5px; border-radius:7px; }
.ihm-btn-xs  { padding:4px 9px; font-size:11.5px; border-radius:6px; }
.ihm-btn-primary { background:#1a237e; color:#fff; }
.ihm-btn-primary:hover { background:#283593; }
.ihm-btn-success { background:#16a34a; color:#fff; }
.ihm-btn-success:hover { background:#15803d; }
.ihm-btn-danger  { background:#ef4444; color:#fff; }
.ihm-btn-danger:hover  { background:#dc2626; }
.ihm-btn-warning { background:#d97706; color:#fff; }
.ihm-btn-warning:hover { background:#b45309; }
.ihm-btn-ghost { background:#fff; color:#374151; border:1.5px solid #e2e4ea; }
.ihm-btn-ghost:hover { background:#f7f8fb; border-color:#c9cdd8; }
.ihm-btn-indigo { background:#4f46e5; color:#fff; }
.ihm-btn-indigo:hover { background:#4338ca; }

.ihm-card { background:#fff; border-radius:12px; border:1px solid #e2e4ea; box-shadow:0 1px 4px rgba(0,0,0,0.05); overflow:hidden; }
.ihm-card-edit { border:2px solid #1a237e !important; box-shadow:0 0 0 4px rgba(26,35,126,0.07),0 4px 20px rgba(0,0,0,0.08) !important; }

.ihm-lbl { font-size:11px; font-weight:700; color:#8b95a1; text-transform:uppercase; letter-spacing:0.07em; margin-bottom:5px; display:block; }
.ihm-sec { font-size:10.5px; font-weight:800; color:#a5b0be; text-transform:uppercase; letter-spacing:0.1em; display:flex; align-items:center; gap:10px; padding:4px 0 12px; }
.ihm-sec::after { content:''; flex:1; height:1px; background:#edf0f5; }

.ihm-stats { display:flex; align-items:center; }
.ihm-stat { text-align:center; padding:4px 28px; }
.ihm-stat:first-child { padding-left:6px; }
.ihm-stat-val { font-size:30px; font-weight:700; line-height:1; letter-spacing:-0.02em; }
.ihm-stat-lbl { font-size:10.5px; font-weight:600; color:#9ca3af; text-transform:uppercase; letter-spacing:0.07em; margin-top:5px; }
.ihm-divider-v { width:1px; background:#e2e4ea; height:46px; flex-shrink:0; }
.ihm-divider-sm { width:1px; height:26px; background:#e2e4ea; }

.ihm-toolbar { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.ihm-rowcount { background:#eef2ff; color:#3730a3; padding:4px 12px; border-radius:20px; font-size:12px; font-weight:600; }

.ihm-fpanel {
  background:#eef2ff; border:1px solid #c7d2fe; border-radius:10px;
  padding:16px 20px; display:flex; align-items:flex-end; gap:14px; flex-wrap:wrap;
  animation:ihmFadeDown 0.18s cubic-bezier(.34,1.56,.64,1);
}
@keyframes ihmFadeDown { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }

.ihm-chip { display:inline-flex; align-items:center; gap:4px; background:#e0e7ff; color:#3730a3; border-radius:20px; padding:4px 11px; font-size:11.5px; font-weight:600; }
.ihm-chip-x { cursor:pointer; opacity:0.5; font-size:14px; line-height:1; margin-left:1px; }
.ihm-chip-x:hover { opacity:1; }

.ihm-refbar { display:flex; align-items:center; gap:12px; flex-wrap:wrap; background:#eef2ff; border:1px solid #c7d2fe; border-radius:10px; padding:14px 18px; margin-bottom:18px; }
.ihm-refbar-meta { font-size:12px; color:#6b7280; display:flex; align-items:center; gap:4px; }
.ihm-refbar-meta strong { color:#111; font-weight:600; }

.ihm-batch-info {
  display:flex; align-items:center; gap:10px;
  background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px;
  padding:8px 14px; font-size:12px; font-family:'JetBrains Mono',monospace;
}
.ihm-batch-info .bi-label { color:#6b7280; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; }
.ihm-batch-info .bi-val { color:#15803d; font-weight:700; font-size:13px; }
.ihm-batch-info .bi-pending { color:#b45309; }

.ihm-itable { width:100%; border-collapse:collapse; font-size:12.5px; }
.ihm-itable th { padding:8px 10px; background:#f4f5f9; color:#5b6474; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid #e2e4ea; text-align:left; }
.ihm-itable th.r { text-align:right; }
.ihm-itable td { padding:9px 10px; border-bottom:1px solid #f0f1f5; vertical-align:middle; }
.ihm-itable td.r { text-align:right; font-variant-numeric:tabular-nums; }
.ihm-itable tr:last-child td { border-bottom:none; }
.ihm-itable tr:hover td { background:#f9faff; }

.ihm-table { width:100%; border-collapse:collapse; table-layout:fixed; font-size:12.5px; }
.ihm-table th { padding:11px 10px; font-size:10.5px; font-weight:700; color:#1a237e; text-transform:uppercase; letter-spacing:0.05em; background:#eef2ff; border-bottom:2px solid #c7d2fe; text-align:left; white-space:nowrap; }
.ihm-table th.r { text-align:right; }
.ihm-table th.div-l { border-left:2px solid #c7d2fe; }
.ihm-table td { padding:10px 10px; border-bottom:1px solid #f0f1f5; vertical-align:middle; }
.ihm-table td.r { text-align:right; font-variant-numeric:tabular-nums; }
.ihm-table td.div-l { border-left:2px solid #eef2ff; }
.ihm-table tr:nth-child(even) td { background:#fafbff; }
.ihm-table tr:hover td { background:#f5f7ff !important; transition:background 0.1s; }

.ellipsis { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:block; }
.mono { font-family:'JetBrains Mono',monospace; font-size:11.5px; }

.badge { display:inline-block; padding:3px 10px; border-radius:20px; font-size:11px; font-weight:700; white-space:nowrap; }
.badge-purchase { background:#e0e7ff; color:#3730a3; }
.badge-vendor   { background:#fef3c7; color:#b45309; }
.badge-stock    { background:#f0fdf4; color:#15803d; }
.badge-other    { background:#f3f4f6; color:#6b7280; }
.badge-closed   { background:#dcfce7; color:#16a34a; }
.badge-open     { background:#fee2e2; color:#ef4444; }
.badge-hkg { background:#e0e7ff; color:#3730a3; }
.badge-ngr { background:#fef3c7; color:#b45309; }
.badge-mdd { background:#f0fdf4; color:#15803d; }

.ihm-empty { padding:52px; text-align:center; color:#9ca3af; }
.ihm-empty-icon { font-size:36px; margin-bottom:12px; opacity:0.45; }

.ihm-toasts { position:fixed; top:22px; right:22px; z-index:9999; display:flex; flex-direction:column; gap:8px; pointer-events:none; }
.ihm-toast { padding:12px 18px; border-radius:10px; font-size:13px; font-weight:500; max-width:360px; box-shadow:0 4px 20px rgba(0,0,0,0.12); pointer-events:all; animation:toastPop 0.24s cubic-bezier(0.34,1.56,0.64,1) both; }
@keyframes toastPop { from{opacity:0;transform:translateX(18px)} to{opacity:1;transform:translateX(0)} }
.toast-s { background:#dcfce7; color:#16a34a; border:1px solid #bbf7d0; }
.toast-e { background:#fee2e2; color:#ef4444; border:1px solid #fecaca; }
.toast-i { background:#eef2ff; color:#3730a3; border:1px solid #c7d2fe; }

input[type=number]::-webkit-inner-spin-button,
input[type=number]::-webkit-outer-spin-button { -webkit-appearance:none; margin:0; }
input[type=number] { -moz-appearance:textfield; }
::-webkit-scrollbar { width:5px; height:5px; }
::-webkit-scrollbar-track { background:#f0f1f5; }
::-webkit-scrollbar-thumb { background:#c7d2fe; border-radius:3px; }
`;

// ─── Toast hook ───────────────────────────────────────────────────────────────

let _tid = 0;
interface Toast { id: number; msg: string; type: 's' | 'e' | 'i' }
const useToast = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = useCallback((msg: string, type: Toast['type'] = 'i') => {
    const id = ++_tid;
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4200);
  }, []);
  return { toasts, show };
};

// ─── CSV export ───────────────────────────────────────────────────────────────

const exportCSV = (rows: Array<InHouseIssue & { _item: InHouseIssueItem }>) => {
  const H = ['#','Req No','Req Date','Issue No','Indent No','OA No','PO No','Vendor',
    'Purchase Batch No','Vendor Batch No','Item Name','Item Code','Tx Type',
    'Batch No','Req By','Issue Qty','In Stock','Received Date','Req Closed'];
  const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [H.map(esc).join(',')];
  rows.forEach((r, i) => lines.push([
    i + 1, r.reqNo, r.reqDate, r.issueNo, r.indentNo, r.oaNo, r.poNo, r.vendor,
    r.purchaseBatchNo, r.vendorBatchNo,
    r._item.itemName, r._item.itemCode, r._item.transactionType,
    r._item.batchNo, r._item.reqBy, r._item.issueQty,
    r._item.inStock, r._item.receivedDate || '', r._item.reqClosed ? 'Yes' : 'No',
  ].map(esc).join(',')));
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url;
  a.download = `inhouse-issues-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  URL.revokeObjectURL(url);
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const Field: React.FC<{ label: string; children: React.ReactNode; style?: React.CSSProperties }> = ({ label, children, style }) => (
  <div style={style}>
    <span className="ihm-lbl">{label}</span>
    {children}
  </div>
);

const TxBadge: React.FC<{ val: string }> = ({ val }) => {
  const cls = val === 'Purchase' ? 'badge-purchase' : val === 'Vendor' ? 'badge-vendor' : val === 'Stock' ? 'badge-stock' : 'badge-other';
  return <span className={`badge ${cls}`}>{val || '—'}</span>;
};

const ReqByBadge: React.FC<{ val: string }> = ({ val }) => {
  const cls = val === 'HKG' ? 'badge-hkg' : val === 'NGR' ? 'badge-ngr' : val === 'MDD' ? 'badge-mdd' : 'badge-other';
  return <span className={`badge ${cls}`}>{val || '—'}</span>;
};

const ClosedBadge: React.FC<{ closed: boolean }> = ({ closed }) => (
  <span className={`badge ${closed ? 'badge-closed' : 'badge-open'}`}>{closed ? 'Closed' : 'Open'}</span>
);

const NumInput: React.FC<{ value: number; onChange: (n: number) => void; placeholder?: string; style?: React.CSSProperties }> = ({ value, onChange, placeholder, style }) => (
  <input type="number" className="ihm-input" min={0}
    style={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right', ...style }}
    value={value || ''} placeholder={placeholder || '0'}
    onChange={e => onChange(Math.max(0, Number(e.target.value)))} />
);

// ─── Main component ───────────────────────────────────────────────────────────

const InHouseIssueModule: React.FC = () => {
  const { toasts, show: toast } = useToast();

  // Inject styles once
  useEffect(() => {
    if (document.getElementById('ihm-css')) return;
    const el = document.createElement('style'); el.id = 'ihm-css'; el.textContent = GLOBAL_STYLES;
    document.head.appendChild(el);
  }, []);

  // ── State ──────────────────────────────────────────────────────────────────
  const [userUid, setUserUid] = useState<string | null>(null);
  const [issues, setIssues] = useState<InHouseIssue[]>([]);
  const [psirData, setPsirData] = useState<any[]>([]);
  const [vsirData, setVsirData] = useState<any[]>([]);
  const [itemMaster, setItemMaster] = useState<{ itemName: string; itemCode: string }[]>([]);
  const [itemNames, setItemNames] = useState<string[]>([]);

  const [newIssue, setNewIssue] = useState<InHouseIssue>(() => blankIssue([]));
  const [itemInput, setItemInput] = useState<InHouseIssueItem>({ ...BLANK_ITEM });
  const [editIssueIdx, setEditIssueIdx] = useState<number | null>(null);
  const [editItemIdx, setEditItemIdx] = useState<number | null>(null);

  // Filter state
  const [filterOpen, setFilterOpen] = useState(false);
  const [fSearch, setFSearch] = useState('');
  const [fTxType, setFTxType] = useState('');
  const [fReqBy, setFReqBy] = useState('');
  const [fClosed, setFClosed] = useState('');
  const [fFrom, setFFrom] = useState('');
  const [fTo, setFTo] = useState('');

  const editRef = useRef<HTMLDivElement>(null);

  // ── Auth ────────────────────────────────────────────────────────────────
  useEffect(() => onAuthStateChanged(auth, u => setUserUid(u?.uid ?? null)), []);

  // ── Subscriptions ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userUid) return;
    const unsubs: (() => void)[] = [];
    try { unsubs.push(subscribeInHouseIssues(userUid, docs => setIssues(docs.map(d => ({ ...d, items: Array.isArray(d.items) ? d.items : [] })) as InHouseIssue[]))); } catch {}
    try { unsubs.push(subscribePsirs(userUid, docs => setPsirData(docs || []))); } catch {}
    try { unsubs.push(subscribeVSIRRecords(userUid, docs => setVsirData(docs || []))); } catch {}
    getItemMaster(userUid).then((im: any) => {
      if (Array.isArray(im) && im.length) { setItemMaster(im); setItemNames(im.map((it: any) => it.itemName).filter(Boolean)); }
    }).catch(() => {});
    return () => unsubs.forEach(u => { try { u(); } catch {} });
  }, [userUid]);

  // ── Load item master from localStorage fallback ──────────────────────────
  useEffect(() => {
    if (itemMaster.length) return;
    try {
      const raw = localStorage.getItem('itemMasterData');
      if (raw) { const p = JSON.parse(raw); if (Array.isArray(p)) { setItemMaster(p); setItemNames(p.map((it: any) => it.itemName).filter(Boolean)); } }
    } catch {}
  }, [itemMaster.length]);

  // ─── Batch lookup helpers ─────────────────────────────────────────────────

  const getPsirBatchesForItem = useCallback((itemCode: string): string[] => {
    if (!itemCode) return [];
    const set = new Set<string>();
    psirData.forEach((p: any) => {
      if (Array.isArray(p.items) && p.items.some((it: any) => it.itemCode === itemCode || it.Code === itemCode)) {
        if (p.batchNo?.trim()) set.add(p.batchNo);
      }
    });
    return [...set].sort();
  }, [psirData]);

  const getVsirBatchesForItem = useCallback((itemCode: string): string[] => {
    if (!itemCode) return [];
    const set = new Set<string>();
    vsirData.forEach((r: any) => {
      if ((r.itemCode === itemCode || r.Code === itemCode) && r.vendorBatchNo?.trim()) set.add(r.vendorBatchNo);
    });
    return [...set].sort();
  }, [vsirData]);

  const getStockQtysForItem = useCallback((itemCode: string): string[] => {
    try {
      const raw = localStorage.getItem('stock-records');
      if (!raw) return [];
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) return [];
      return [...new Set(data.filter((r: any) => r.itemCode === itemCode && r.closingStock > 0).map((r: any) => String(r.closingStock)))];
    } catch { return []; }
  }, []);

  const getPsirOkQty = useCallback((batchNo: string, itemCode: string): number => {
    for (const p of psirData) {
      if (p.batchNo === batchNo && Array.isArray(p.items)) {
        const it = p.items.find((i: any) => i.itemCode === itemCode);
        if (it) return it.okQty || 0;
      }
    }
    return 0;
  }, [psirData]);

  const getVsirOkQty = useCallback((batchNo: string, itemCode: string): number => {
    const r = vsirData.find((v: any) => v.vendorBatchNo === batchNo && v.itemCode === itemCode);
    return r?.okQty || 0;
  }, [vsirData]);

  const getIssuedQty = useCallback((batchNo: string, itemCode: string): number => {
    let total = 0;
    issues.forEach(iss => iss.items.forEach(it => {
      if (it.batchNo === batchNo && it.itemCode === itemCode) total += it.issueQty || 0;
    }));
    return total;
  }, [issues]);

  const getPendingQty = useCallback((batchNo: string, txType: string, itemCode: string): number => {
    const ok = txType === 'Purchase' ? getPsirOkQty(batchNo, itemCode)
      : txType === 'Vendor' ? getVsirOkQty(batchNo, itemCode) : 0;
    return Math.max(0, ok - getIssuedQty(batchNo, itemCode));
  }, [getPsirOkQty, getVsirOkQty, getIssuedQty]);

  // ── Available batches (with pending > 0) ─────────────────────────────────
  const availableBatches = useMemo(() => {
    const { transactionType: tx, itemCode } = itemInput;
    if (!itemCode || !tx) return [];
    if (tx === 'Purchase') return getPsirBatchesForItem(itemCode).filter(b => getPendingQty(b, 'Purchase', itemCode) > 0);
    if (tx === 'Vendor') return getVsirBatchesForItem(itemCode).filter(b => getPendingQty(b, 'Vendor', itemCode) > 0);
    if (tx === 'Stock') return getStockQtysForItem(itemCode);
    return [];
  }, [itemInput.transactionType, itemInput.itemCode, getPsirBatchesForItem, getVsirBatchesForItem, getStockQtysForItem, getPendingQty]); // eslint-disable-line

  // ── Batch info for selected batch ─────────────────────────────────────────
  const batchInfo = useMemo(() => {
    const { batchNo, transactionType: tx, itemCode } = itemInput;
    if (!batchNo || !itemCode) return null;
    if (tx === 'Purchase') {
      const ok = getPsirOkQty(batchNo, itemCode);
      const pending = getPendingQty(batchNo, 'Purchase', itemCode);
      return { ok, pending, label: 'PSIR OK' };
    }
    if (tx === 'Vendor') {
      const ok = getVsirOkQty(batchNo, itemCode);
      const pending = getPendingQty(batchNo, 'Vendor', itemCode);
      return { ok, pending, label: 'VSIR OK' };
    }
    if (tx === 'Stock') return { ok: Number(batchNo), pending: Number(batchNo), label: 'Stock' };
    return null;
  }, [itemInput.batchNo, itemInput.transactionType, itemInput.itemCode, getPsirOkQty, getVsirOkQty, getPendingQty]);

  // ── Auto-fill indentNo/oaNo/poNo from batch selection ────────────────────
  useEffect(() => {
    const { batchNo, transactionType: tx } = itemInput;
    if (!batchNo) return;
    if (tx === 'Purchase') {
      const p = psirData.find((r: any) => r.batchNo === batchNo);
      if (p) setNewIssue(prev => ({ ...prev, indentNo: p.indentNo || prev.indentNo, oaNo: p.oaNo || prev.oaNo, poNo: p.poNo || prev.poNo }));
    } else if (tx === 'Vendor') {
      const v = vsirData.find((r: any) => r.vendorBatchNo === batchNo);
      if (v) setNewIssue(prev => ({ ...prev, indentNo: v.indentNo || prev.indentNo, oaNo: v.oaNo || prev.oaNo, poNo: v.poNo || prev.poNo }));
    }
  }, [itemInput.batchNo, itemInput.transactionType, psirData, vsirData]);

  // ── Auto-fill reqNo from VendorDept DC No when PO changes ────────────────
  useEffect(() => {
    if (!newIssue.poNo) return;
    try {
      const raw = localStorage.getItem('vendorDeptData');
      const dept = raw ? JSON.parse(raw) : [];
      const match = Array.isArray(dept) ? dept.find((o: any) => o.materialPurchasePoNo === newIssue.poNo) : null;
      if (match?.dcNo?.trim()) { setNewIssue(prev => ({ ...prev, reqNo: match.dcNo })); return; }
    } catch {}
  }, [newIssue.poNo]);

  // ── Flat rows ────────────────────────────────────────────────────────────
  type FlatRow = InHouseIssue & { _item: InHouseIssueItem; _issueIdx: number; _itemIdx: number };

  const flatRows = useMemo((): FlatRow[] => {
    const rows: FlatRow[] = [];
    issues.forEach((iss, ii) => {
      if (!iss.items?.length) {
        rows.push({ ...iss, _item: { ...BLANK_ITEM }, _issueIdx: ii, _itemIdx: -1 });
      } else {
        iss.items.forEach((item, ji) => rows.push({ ...iss, _item: item, _issueIdx: ii, _itemIdx: ji }));
      }
    });
    return rows;
  }, [issues]);

  const filtered = useMemo(() => {
    let rows = flatRows;
    if (fSearch.trim()) {
      const t = fSearch.trim().toUpperCase();
      rows = rows.filter(r => [r.reqNo, r.issueNo, r.poNo, r.oaNo, r.vendor, r._item.itemName, r._item.itemCode, r._item.batchNo].some(v => String(v || '').toUpperCase().includes(t)));
    }
    if (fTxType) rows = rows.filter(r => r._item.transactionType === fTxType);
    if (fReqBy) rows = rows.filter(r => r._item.reqBy === fReqBy);
    if (fClosed === 'closed') rows = rows.filter(r => r._item.reqClosed);
    if (fClosed === 'open') rows = rows.filter(r => !r._item.reqClosed);
    if (fFrom) rows = rows.filter(r => r.reqDate >= fFrom);
    if (fTo) rows = rows.filter(r => r.reqDate <= fTo);
    return rows;
  }, [flatRows, fSearch, fTxType, fReqBy, fClosed, fFrom, fTo]);

  const activeFilters = [fSearch, fTxType, fReqBy, fClosed, fFrom, fTo].filter(Boolean).length;

  const stats = useMemo(() => ({
    total: issues.length,
    items: issues.reduce((s, i) => s + i.items.length, 0),
    totalQty: flatRows.reduce((s, r) => s + (r._item.issueQty || 0), 0),
    closed: flatRows.filter(r => r._item.reqClosed && r._itemIdx !== -1).length,
    open: flatRows.filter(r => !r._item.reqClosed && r._itemIdx !== -1).length,
  }), [issues, flatRows]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const clearForm = useCallback(() => {
    setNewIssue(blankIssue(issues)); setItemInput({ ...BLANK_ITEM });
    setEditIssueIdx(null); setEditItemIdx(null);
  }, [issues]);

  const handleSaveItem = useCallback(() => {
    if (!itemInput.itemName || !itemInput.itemCode || !itemInput.reqBy || itemInput.issueQty <= 0) {
      toast('Fill Item Name, Code, Req By and Issue Qty (> 0)', 'e'); return;
    }
    const sorted = (items: InHouseIssueItem[]) =>
      [...items].sort((a, b) => new Date(a.receivedDate || '').getTime() - new Date(b.receivedDate || '').getTime());

    if (editItemIdx !== null) {
      setNewIssue(p => ({ ...p, items: p.items.map((it, i) => i === editItemIdx ? { ...itemInput } : it) }));
      setEditItemIdx(null);
    } else {
      setNewIssue(p => ({ ...p, items: sorted([...p.items, { ...itemInput }]) }));
    }
    setItemInput({ ...BLANK_ITEM });
  }, [itemInput, editItemIdx, toast]);

  const handleAddIssue = useCallback(async () => {
    if (!newIssue.reqDate || !newIssue.reqNo || !newIssue.items.length) {
      toast('Fill Req Date, Req No and add at least one item', 'e'); return;
    }
    if (!userUid) { toast('Please sign in to add issues', 'e'); return; }
    const toSave = { ...newIssue, issueNo: getNextIssueNo(issues) };
    try {
      await addInHouseIssue(userUid, toSave);
      toast('Issue saved ✓', 's'); clearForm();
    } catch { toast('Failed to save — please retry', 'e'); }
  }, [newIssue, issues, userUid, clearForm, toast]);

  const handleUpdateIssue = useCallback(async () => {
    if (editIssueIdx === null || !userUid || !issues[editIssueIdx]?.id) { toast('Cannot update: missing data', 'e'); return; }
    try {
      await updateInHouseIssue(userUid, issues[editIssueIdx].id!, newIssue);
      toast('Issue updated ✓', 's'); clearForm();
    } catch { toast('Update failed — please retry', 'e'); }
  }, [editIssueIdx, userUid, issues, newIssue, clearForm, toast]);

  const handleDeleteIssue = useCallback(async (idx: number) => {
    if (!window.confirm('Delete this issue?')) return;
    const issue = issues[idx];
    if (!userUid || !issue?.id) return;
    try { await deleteInHouseIssue(userUid, issue.id!); toast('Issue deleted', 's'); }
    catch { toast('Delete failed', 'e'); }
  }, [issues, userUid, toast]);

  const handleDeleteItem = useCallback(async (issueIdx: number, itemIdx: number) => {
    if (!window.confirm('Delete this item?')) return;
    const issue = issues[issueIdx];
    if (!userUid || !issue?.id) return;
    const updatedItems = issue.items.filter((_, i) => i !== itemIdx);
    try {
      if (!updatedItems.length) await deleteInHouseIssue(userUid, issue.id!);
      else await updateInHouseIssue(userUid, issue.id!, { ...issue, items: updatedItems });
      toast('Item deleted', 's');
    } catch { toast('Delete failed', 'e'); }
  }, [issues, userUid, toast]);

  const handleEditIssue = useCallback((idx: number) => {
    setNewIssue({ ...issues[idx] }); setItemInput({ ...BLANK_ITEM });
    setEditIssueIdx(idx); setEditItemIdx(null);
    setTimeout(() => editRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }, [issues]);

  const clearFilters = () => { setFSearch(''); setFTxType(''); setFReqBy(''); setFClosed(''); setFFrom(''); setFTo(''); };
  const isEditing = editIssueIdx !== null;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="ihm">
      {/* Toasts */}
      <div className="ihm-toasts">
        {toasts.map(t => <div key={t.id} className={`ihm-toast toast-${t.type}`}>{t.msg}</div>)}
      </div>

      <div className="ihm-inner">

        {/* ── Page header + unified toolbar ─────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700, color: '#1a237e', letterSpacing: '-0.02em' }}>In-House Issues</h1>
            <p style={{ margin: '2px 0 0', fontSize: 12.5, color: '#9ca3af', fontWeight: 500 }}>Material requisition &amp; FIFO issue tracking</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            <div className="ihm-toolbar">
              {/* Filter toggle */}
              <button
                className={`ihm-btn ihm-btn-sm ${activeFilters > 0 ? 'ihm-btn-indigo' : 'ihm-btn-ghost'}`}
                style={{ position: 'relative' }}
                onClick={() => setFilterOpen(p => !p)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" /></svg>
                {activeFilters > 0 ? `Filters (${activeFilters})` : 'Filters'}
                {activeFilters > 0 && (
                  <span style={{ position: 'absolute', top: -7, right: -7, background: '#ef4444', color: '#fff', borderRadius: '50%', width: 17, height: 17, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{activeFilters}</span>
                )}
              </button>

              <div className="ihm-divider-sm" />
              <span className="ihm-rowcount">{filtered.length === flatRows.length ? `${flatRows.length} rows` : `${filtered.length} / ${flatRows.length} rows`}</span>
              <div className="ihm-divider-sm" />

              {/* Export — same row as filters */}
              <button className="ihm-btn ihm-btn-sm ihm-btn-success" onClick={() => exportCSV(filtered as any)} title={`Export ${filtered.length} rows as CSV`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                Export CSV
              </button>
            </div>

            {/* Active chips */}
            {activeFilters > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
                {fSearch && <span className="ihm-chip">🔍 "{fSearch}" <span className="ihm-chip-x" onClick={() => setFSearch('')}>×</span></span>}
                {fTxType && <span className="ihm-chip">{fTxType} <span className="ihm-chip-x" onClick={() => setFTxType('')}>×</span></span>}
                {fReqBy && <span className="ihm-chip">By: {fReqBy} <span className="ihm-chip-x" onClick={() => setFReqBy('')}>×</span></span>}
                {fClosed && <span className="ihm-chip">{fClosed === 'closed' ? 'Closed' : 'Open'} <span className="ihm-chip-x" onClick={() => setFClosed('')}>×</span></span>}
                {fFrom && <span className="ihm-chip">From: {fFrom} <span className="ihm-chip-x" onClick={() => setFFrom('')}>×</span></span>}
                {fTo && <span className="ihm-chip">To: {fTo} <span className="ihm-chip-x" onClick={() => setFTo('')}>×</span></span>}
                <button className="ihm-btn ihm-btn-xs ihm-btn-ghost" onClick={clearFilters}>Clear all</button>
              </div>
            )}
          </div>
        </div>

        {/* ── Filter panel ──────────────────────────────────────────── */}
        {filterOpen && (
          <div className="ihm-fpanel" style={{ marginBottom: 16 }}>
            <Field label="Search">
              <input className="ihm-input" style={{ minWidth: 210 }} autoFocus
                placeholder="Req No, PO, item, batch…"
                value={fSearch} onChange={e => setFSearch(e.target.value)} />
            </Field>
            <Field label="Tx Type">
              <select className="ihm-input ihm-select" style={{ minWidth: 120 }} value={fTxType} onChange={e => setFTxType(e.target.value)}>
                <option value="">All types</option>
                {TX_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Req By">
              <select className="ihm-input ihm-select" style={{ minWidth: 110 }} value={fReqBy} onChange={e => setFReqBy(e.target.value)}>
                <option value="">All</option>
                {REQ_BY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select className="ihm-input ihm-select" style={{ minWidth: 110 }} value={fClosed} onChange={e => setFClosed(e.target.value)}>
                <option value="">All</option>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
              </select>
            </Field>
            <Field label="Date From">
              <input type="date" className="ihm-input" value={fFrom} onChange={e => setFFrom(e.target.value)} />
            </Field>
            <Field label="Date To">
              <input type="date" className="ihm-input" value={fTo} onChange={e => setFTo(e.target.value)} />
            </Field>
            <div style={{ alignSelf: 'flex-end', display: 'flex', gap: 8 }}>
              {activeFilters > 0 && <button className="ihm-btn ihm-btn-sm ihm-btn-ghost" onClick={clearFilters}>Clear all</button>}
              <button className="ihm-btn ihm-btn-sm ihm-btn-ghost" onClick={() => setFilterOpen(false)}>Close</button>
            </div>
          </div>
        )}

        {/* ── Stats bar ─────────────────────────────────────────────── */}
        <div className="ihm-card" style={{ marginBottom: 18, padding: '16px 24px' }}>
          <div className="ihm-stats">
            {[
              { val: stats.total, lbl: 'Requisitions', color: '#1a237e' },
              { val: stats.items, lbl: 'Line Items', color: '#1a237e' },
              { val: stats.totalQty, lbl: 'Total Issued', color: '#4f46e5' },
              { val: stats.open, lbl: 'Open', color: '#ef4444' },
              { val: stats.closed, lbl: 'Closed', color: '#16a34a' },
            ].map((s, i) => (
              <React.Fragment key={s.lbl}>
                {i > 0 && <div className="ihm-divider-v" />}
                <div className="ihm-stat">
                  <div className="ihm-stat-val" style={{ color: s.color }}>{s.val}</div>
                  <div className="ihm-stat-lbl">{s.lbl}</div>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* ── Add / Edit panel ──────────────────────────────────────── */}
        <div ref={editRef} className={`ihm-card ${isEditing ? 'ihm-card-edit' : ''}`} style={{ marginBottom: 20 }}>

          {/* Panel header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 22px', borderBottom: '1px solid #f0f1f5',
            background: isEditing ? '#eef2ff' : '#fafbff',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 17 }}>{isEditing ? '✏️' : '＋'}</span>
              <span style={{ fontWeight: 700, fontSize: 14.5, color: isEditing ? '#1a237e' : '#374151' }}>
                {isEditing ? `Edit Requisition — ${newIssue.reqNo}` : 'New Requisition'}
              </span>
              {isEditing && <span style={{ background: '#c7d2fe', color: '#3730a3', padding: '2px 10px', borderRadius: 20, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.05em' }}>EDIT MODE</span>}
            </div>
            {isEditing && <button className="ihm-btn ihm-btn-sm ihm-btn-ghost" onClick={clearForm}>✕ Discard</button>}
          </div>

          <div style={{ padding: '20px 22px' }}>

            {/* Req header bar */}
            <div className="ihm-refbar">
              <span style={{ fontSize: 10.5, fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>Req No</span>
              <input className="ihm-input ihm-input-ro" readOnly style={{ maxWidth: 160, flex: '0 0 auto' }} value={newIssue.reqNo} placeholder="Auto-generated" />

              <Field label="Req Date ✱" style={{ flex: '0 0 auto' }}>
                <input type="date" className="ihm-input" style={{ width: 160 }}
                  value={newIssue.reqDate} onChange={e => setNewIssue(p => ({ ...p, reqDate: e.target.value }))} />
              </Field>

              {newIssue.issueNo && <span className="ihm-refbar-meta">Issue: <strong style={{ color: '#4f46e5' }}>{newIssue.issueNo}</strong></span>}
              {newIssue.oaNo && <span className="ihm-refbar-meta">OA: <strong>{newIssue.oaNo}</strong></span>}
              {newIssue.poNo && <span className="ihm-refbar-meta">PO: <strong>{newIssue.poNo}</strong></span>}
              {newIssue.indentNo && <span className="ihm-refbar-meta">Indent: <strong>{newIssue.indentNo}</strong></span>}
            </div>

            {/* Item entry */}
            <div style={{ background: '#f8f9fc', borderRadius: 10, border: '1px solid #e2e4ea', padding: '16px 18px', marginBottom: 16 }}>
              <div className="ihm-sec" style={{ paddingTop: 0 }}>
                {editItemIdx !== null ? '✏ Edit Item' : '+ Add Item'}
              </div>

              {/* Row 1: identity + tx type */}
              <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                <Field label="Item Name">
                  {itemNames.length > 0 ? (
                    <select className="ihm-input ihm-select" value={itemInput.itemName}
                      onChange={e => {
                        const v = e.target.value;
                        const found = itemMaster.find(it => it.itemName === v);
                        setItemInput(p => ({ ...p, itemName: v, itemCode: found?.itemCode || '', batchNo: '' }));
                      }}>
                      <option value="">— Select Item —</option>
                      {itemNames.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  ) : (
                    <input className="ihm-input" placeholder="e.g. Jaw Carrier 02"
                      value={itemInput.itemName} onChange={e => setItemInput(p => ({ ...p, itemName: e.target.value }))} />
                  )}
                </Field>
                <Field label="Item Code">
                  <input className="ihm-input" readOnly={itemNames.length > 0}
                    value={itemInput.itemCode} onChange={e => setItemInput(p => ({ ...p, itemCode: e.target.value, batchNo: '' }))} />
                </Field>
                <Field label="Transaction Type">
                  <select className="ihm-input ihm-select" value={itemInput.transactionType}
                    onChange={e => setItemInput(p => ({ ...p, transactionType: e.target.value, batchNo: '' }))}>
                    {TX_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Req By ✱">
                  <select className="ihm-input ihm-select" value={itemInput.reqBy}
                    onChange={e => setItemInput(p => ({ ...p, reqBy: e.target.value }))}>
                    <option value="">— Select —</option>
                    {REQ_BY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </Field>
              </div>

              {/* Row 2: batch + qty */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                <Field label={`Batch No${itemInput.transactionType === 'Stock' ? ' (Stock Qty)' : ' (pending qty > 0)'}`}>
                  <select className="ihm-input ihm-select" value={itemInput.batchNo}
                    onChange={e => setItemInput(p => ({ ...p, batchNo: e.target.value }))}>
                    <option value="">— Select —</option>
                    {availableBatches.length > 0
                      ? availableBatches.map(b => {
                          const pending = itemInput.transactionType !== 'Stock' ? getPendingQty(b, itemInput.transactionType, itemInput.itemCode) : 0;
                          return <option key={b} value={b}>{b}{pending > 0 ? ` (Pending: ${pending})` : ''}</option>;
                        })
                      : <option disabled value="">No batches available</option>
                    }
                  </select>
                </Field>
                <Field label="Issue Qty ✱">
                  <NumInput value={itemInput.issueQty} onChange={n => setItemInput(p => ({ ...p, issueQty: n }))} />
                </Field>
                <Field label="Received Date (FIFO)">
                  <input type="date" className="ihm-input" value={itemInput.receivedDate || ''}
                    onChange={e => setItemInput(p => ({ ...p, receivedDate: e.target.value }))} />
                </Field>
                <Field label="Req Closed">
                  <div style={{ paddingTop: 9 }}>
                    <label className="ihm-checkbox">
                      <input type="checkbox" checked={itemInput.reqClosed}
                        onChange={e => setItemInput(p => ({ ...p, reqClosed: e.target.checked }))} />
                      <span>{itemInput.reqClosed ? 'Yes — closed' : 'No — open'}</span>
                    </label>
                  </div>
                </Field>
              </div>

              {/* Batch info panel (replaces the debug-heavy text input) */}
              {batchInfo && itemInput.batchNo && (
                <div className="ihm-batch-info" style={{ marginBottom: 12 }}>
                  <div>
                    <div className="bi-label">{batchInfo.label} Qty</div>
                    <div className="bi-val">{batchInfo.ok}</div>
                  </div>
                  <div style={{ width: 1, height: 32, background: '#bbf7d0' }} />
                  <div>
                    <div className="bi-label">Already Issued</div>
                    <div className="bi-val">{batchInfo.ok - batchInfo.pending}</div>
                  </div>
                  <div style={{ width: 1, height: 32, background: '#bbf7d0' }} />
                  <div>
                    <div className="bi-label">Pending</div>
                    <div className={`bi-val ${batchInfo.pending === 0 ? 'bi-pending' : ''}`}>{batchInfo.pending}</div>
                  </div>
                  {itemInput.issueQty > batchInfo.pending && batchInfo.pending > 0 && (
                    <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 6, padding: '5px 10px', fontSize: 11.5, color: '#b45309', fontWeight: 600, fontFamily: 'inherit' }}>
                      ⚠ Issue qty exceeds pending ({batchInfo.pending})
                    </div>
                  )}
                </div>
              )}

              {/* Item actions */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="ihm-btn ihm-btn-primary" onClick={handleSaveItem}>
                  {editItemIdx !== null ? '✓ Update Item' : '+ Add Item'}
                </button>
                {editItemIdx !== null && (
                  <button className="ihm-btn ihm-btn-ghost" onClick={() => { setEditItemIdx(null); setItemInput({ ...BLANK_ITEM }); }}>Cancel</button>
                )}
              </div>
            </div>

            {/* Items preview */}
            {newIssue.items.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#8b95a1', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                  Items in this requisition ({newIssue.items.length})
                </div>
                <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #e2e4ea' }}>
                  <table className="ihm-itable">
                    <thead>
                      <tr>
                        <th>Item Name</th><th>Code</th><th>Type</th>
                        <th>Batch</th><th>Req By</th><th className="r">Issue Qty</th>
                        <th>Closed</th><th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {newIssue.items.map((it, ii) => (
                        <tr key={ii}>
                          <td><span className="ellipsis" style={{ maxWidth: 160 }} title={it.itemName}>{it.itemName}</span></td>
                          <td><span className="mono" style={{ color: '#6366f1' }}>{it.itemCode}</span></td>
                          <td><TxBadge val={it.transactionType} /></td>
                          <td><span className="mono" style={{ color: '#6b7280', fontSize: 11 }}>{it.batchNo || '—'}</span></td>
                          <td><ReqByBadge val={it.reqBy} /></td>
                          <td className="r" style={{ fontWeight: 600 }}>{it.issueQty}</td>
                          <td><ClosedBadge closed={it.reqClosed} /></td>
                          <td>
                            <div style={{ display: 'flex', gap: 5 }}>
                              <button className="ihm-btn ihm-btn-xs ihm-btn-warning" onClick={() => { setItemInput(it); setEditItemIdx(ii); }}>Edit</button>
                              <button className="ihm-btn ihm-btn-xs ihm-btn-danger" onClick={() => setNewIssue(p => ({ ...p, items: p.items.filter((_, xi) => xi !== ii) }))}>✕</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Save */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className={`ihm-btn ${isEditing ? 'ihm-btn-primary' : 'ihm-btn-success'}`} style={{ minWidth: 180 }}
                onClick={isEditing ? handleUpdateIssue : handleAddIssue}
                disabled={!userUid}
                title={!userUid ? 'Sign in to save' : undefined}>
                {isEditing ? '✓ Save Changes' : '+ Add Requisition'}
              </button>
              {isEditing && <button className="ihm-btn ihm-btn-ghost" onClick={clearForm}>Discard</button>}
            </div>

          </div>
        </div>

        {/* ── Issues table ──────────────────────────────────────────── */}
        <div className="ihm-card">
          <div style={{ padding: '13px 20px', borderBottom: '1px solid #f0f1f5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#1a237e' }}>Requisitions</span>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>
              {activeFilters > 0 ? `Filtered: ${filtered.length} of ${flatRows.length}` : `${flatRows.length} total rows`}
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="ihm-table">
              <colgroup>
                <col style={{ width: 34 }} /><col style={{ width: 90 }} /><col style={{ width: 82 }} />
                <col style={{ width: 82 }} /><col style={{ width: 72 }} /><col style={{ width: 68 }} />
                <col style={{ width: 68 }} /><col style={{ width: 130 }} /><col style={{ width: 88 }} />
                <col style={{ width: 80 }} /><col style={{ width: 72 }} /><col style={{ width: 55 }} />
                <col style={{ width: 68 }} /><col style={{ width: 75 }} /><col style={{ width: 88 }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="r">#</th>
                  <th>Req No</th><th>Date</th><th>Issue No</th>
                  <th>OA No</th><th>PO No</th><th>Indent No</th>
                  <th className="div-l">Item</th><th>Code</th>
                  <th>Type</th><th>Batch</th>
                  <th className="r div-l">Qty</th>
                  <th>Req By</th><th>Closed</th>
                  <th className="r">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={15}>
                      <div className="ihm-empty">
                        <div className="ihm-empty-icon">📄</div>
                        <div style={{ fontWeight: 600, color: '#374151', marginBottom: 4, fontSize: 14 }}>
                          {activeFilters > 0 ? 'No rows match your filters' : 'No requisitions yet'}
                        </div>
                        <div style={{ fontSize: 12.5 }}>
                          {activeFilters > 0
                            ? <span>Try <span style={{ color: '#4f46e5', cursor: 'pointer', fontWeight: 600 }} onClick={clearFilters}>clearing filters</span></span>
                            : 'Add your first requisition using the form above'}
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : filtered.map((row, ri) => (
                  <tr key={`${row._issueIdx}-${row._itemIdx}`}>
                    <td className="r" style={{ color: '#c4c9d4', fontWeight: 700, fontSize: 11 }}>{ri + 1}</td>
                    <td><span style={{ fontWeight: 600, fontSize: 12, color: '#1a237e' }}>{row.reqNo}</span></td>
                    <td style={{ color: '#6b7280', fontSize: 12 }}>{row.reqDate || '—'}</td>
                    <td><span className="mono" style={{ color: '#4f46e5', fontWeight: 600, fontSize: 11 }}>{row.issueNo}</span></td>
                    <td style={{ color: '#6b7280', fontSize: 12 }}>{row.oaNo || '—'}</td>
                    <td style={{ color: '#6b7280', fontSize: 12 }}>{row.poNo || '—'}</td>
                    <td style={{ color: '#6b7280', fontSize: 12 }}>{row.indentNo || '—'}</td>
                    <td className="div-l">
                      <span className="ellipsis" style={{ maxWidth: 118, fontWeight: 500 }} title={row._item.itemName}>
                        {row._item.itemName || <span style={{ color: '#d1d5db' }}>—</span>}
                      </span>
                    </td>
                    <td><span className="mono" style={{ color: '#6366f1' }}>{row._item.itemCode || '—'}</span></td>
                    <td><TxBadge val={row._item.transactionType} /></td>
                    <td><span className="mono" style={{ color: '#6b7280', fontSize: 11 }}>{row._item.batchNo || '—'}</span></td>
                    <td className="r div-l" style={{ fontWeight: 600 }}>{row._item.issueQty || '—'}</td>
                    <td><ReqByBadge val={row._item.reqBy} /></td>
                    <td><ClosedBadge closed={row._item.reqClosed} /></td>
                    <td className="r">
                      <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end' }}>
                        <button className="ihm-btn ihm-btn-xs ihm-btn-primary" onClick={() => handleEditIssue(row._issueIdx)}>Edit</button>
                        <button className="ihm-btn ihm-btn-xs ihm-btn-danger"
                          onClick={() => row._itemIdx === -1
                            ? handleDeleteIssue(row._issueIdx)
                            : handleDeleteItem(row._issueIdx, row._itemIdx)}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};

export default InHouseIssueModule;