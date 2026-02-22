import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import bus from '../utils/eventBus';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import {
  getPurchaseOrders, getPurchaseData, subscribeVendorDepts,
  addVendorDept, updateVendorDept, deleteVendorDept,
} from '../utils/firestoreServices';
import { subscribeVSIRRecords } from '../utils/firestoreServices';
import { subscribePsirs } from '../utils/psirService';

// ─── Types ────────────────────────────────────────────────────────────────────

interface VendorDeptItem {
  itemName: string; itemCode: string; materialIssueNo: string; qty: number;
  plannedQty?: number; closingStock?: number | string; indentStatus: string;
  receivedQty: number; okQty: number; reworkQty: number; rejectedQty: number;
  grnNo: string; debitNoteOrQtyReturned: string; remarks: string;
}

interface VendorDeptOrder {
  id?: string; orderPlaceDate: string; materialPurchasePoNo: string;
  oaNo: string; batchNo: string; vendorBatchNo: string; dcNo: string;
  vendorName: string; items: VendorDeptItem[];
}

// ─── Blank templates ──────────────────────────────────────────────────────────

const BLANK_ITEM: VendorDeptItem = {
  itemName: '', itemCode: '', materialIssueNo: '', qty: 0, plannedQty: 0,
  closingStock: '', indentStatus: '', receivedQty: 0, okQty: 0,
  reworkQty: 0, rejectedQty: 0, grnNo: '', debitNoteOrQtyReturned: '', remarks: '',
};

const BLANK_ORDER: VendorDeptOrder = {
  orderPlaceDate: '', materialPurchasePoNo: '', oaNo: '', batchNo: '',
  vendorBatchNo: '', dcNo: '', vendorName: '', items: [],
};

const INDENT_STATUS_OPTIONS = ['Open', 'Closed', 'Partial'];

// ─── Global CSS ───────────────────────────────────────────────────────────────

const GLOBAL_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=JetBrains+Mono:wght@400;500&display=swap');

.vdm { font-family:'DM Sans',system-ui,sans-serif; color:#111827; background:#f4f5f9; }
.vdm * { box-sizing:border-box; font-family:inherit; }
.vdm-inner { max-width:1480px; margin:0 auto; padding:24px 28px; }

/* ── Inputs ── */
.vdm-input {
  padding:8px 12px; border-radius:8px; border:1.5px solid #e2e4ea;
  font-size:13.5px; width:100%; transition:border-color 0.15s,box-shadow 0.15s;
  background:#fff; color:#111; line-height:1.5; font-weight:400;
}
.vdm-input:focus { outline:none; border-color:#1a237e; box-shadow:0 0 0 3px rgba(26,35,126,0.1); }
.vdm-input-ro { background:#f7f8fb !important; color:#8b95a1 !important; cursor:default; }
.vdm-input-accent { border-color:#1a237e !important; font-weight:500; }
.vdm-select {
  -webkit-appearance:none; appearance:none;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%238b95a1' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat:no-repeat; background-position:right 10px center; padding-right:34px;
}

/* ── Buttons ── */
.vdm-btn {
  display:inline-flex; align-items:center; justify-content:center; gap:6px;
  padding:9px 18px; border-radius:8px; border:none; cursor:pointer;
  font-size:13px; font-weight:600; transition:all 0.15s; white-space:nowrap; letter-spacing:0.01em;
  line-height:1;
}
.vdm-btn:active { transform:scale(0.97); }
.vdm-btn-sm  { padding:7px 14px; font-size:12.5px; border-radius:7px; }
.vdm-btn-xs  { padding:4px 9px;  font-size:11.5px; border-radius:6px; }
.vdm-btn-primary { background:#1a237e; color:#fff; }
.vdm-btn-primary:hover { background:#283593; }
.vdm-btn-success { background:#16a34a; color:#fff; }
.vdm-btn-success:hover { background:#15803d; }
.vdm-btn-danger  { background:#ef4444; color:#fff; }
.vdm-btn-danger:hover  { background:#dc2626; }
.vdm-btn-warning { background:#d97706; color:#fff; }
.vdm-btn-warning:hover { background:#b45309; }
.vdm-btn-ghost { background:#fff; color:#374151; border:1.5px solid #e2e4ea; }
.vdm-btn-ghost:hover { background:#f7f8fb; border-color:#c9cdd8; }
.vdm-btn-indigo { background:#4f46e5; color:#fff; }
.vdm-btn-indigo:hover { background:#4338ca; }

/* ── Cards ── */
.vdm-card { background:#fff; border-radius:12px; border:1px solid #e2e4ea; box-shadow:0 1px 4px rgba(0,0,0,0.05); overflow:hidden; }
.vdm-card-edit { border:2px solid #1a237e !important; box-shadow:0 0 0 4px rgba(26,35,126,0.07),0 4px 20px rgba(0,0,0,0.08) !important; }

/* ── Labels ── */
.vdm-lbl { font-size:11px; font-weight:700; color:#8b95a1; text-transform:uppercase; letter-spacing:0.07em; margin-bottom:5px; display:block; }

/* ── Section label ── */
.vdm-sec {
  font-size:10.5px; font-weight:800; color:#a5b0be; text-transform:uppercase; letter-spacing:0.1em;
  display:flex; align-items:center; gap:10px; padding:4px 0 12px;
}
.vdm-sec::after { content:''; flex:1; height:1px; background:#edf0f5; }

/* ── Stats ── */
.vdm-stats { display:flex; align-items:center; }
.vdm-stat { text-align:center; padding:4px 28px; }
.vdm-stat:first-child { padding-left:6px; }
.vdm-stat-val { font-size:30px; font-weight:700; line-height:1; letter-spacing:-0.02em; }
.vdm-stat-lbl { font-size:10.5px; font-weight:600; color:#9ca3af; text-transform:uppercase; letter-spacing:0.07em; margin-top:5px; }
.vdm-divider-v { width:1px; background:#e2e4ea; height:46px; flex-shrink:0; }

/* ── Toolbar ── */
.vdm-toolbar { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.vdm-divider-sm { width:1px; height:26px; background:#e2e4ea; }

/* ── Filter panel ── */
.vdm-fpanel {
  background:#eef2ff; border:1px solid #c7d2fe; border-radius:10px;
  padding:16px 20px; display:flex; align-items:flex-end; gap:14px; flex-wrap:wrap;
  animation:vdmFadeDown 0.18s cubic-bezier(.34,1.56,.64,1);
}
@keyframes vdmFadeDown { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }

/* ── Active filter chips ── */
.vdm-chip {
  display:inline-flex; align-items:center; gap:4px; background:#e0e7ff; color:#3730a3;
  border-radius:20px; padding:4px 11px; font-size:11.5px; font-weight:600;
}
.vdm-chip-x { cursor:pointer; opacity:0.5; font-size:14px; line-height:1; margin-left:1px; }
.vdm-chip-x:hover { opacity:1; }
.vdm-rowcount { background:#eef2ff; color:#3730a3; padding:4px 12px; border-radius:20px; font-size:12px; font-weight:600; }

/* ── PO bar ── */
.vdm-pobar {
  display:flex; align-items:center; gap:12px; flex-wrap:wrap;
  background:#eef2ff; border:1px solid #c7d2fe; border-radius:10px; padding:14px 18px; margin-bottom:18px;
}
.vdm-pobar-meta { font-size:12px; color:#6b7280; display:flex; align-items:center; gap:4px; }
.vdm-pobar-meta strong { color:#111; font-weight:600; }

/* ── Items mini table ── */
.vdm-itable { width:100%; border-collapse:collapse; font-size:12.5px; }
.vdm-itable th { padding:8px 10px; background:#f4f5f9; color:#5b6474; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid #e2e4ea; text-align:left; }
.vdm-itable th.r { text-align:right; }
.vdm-itable td { padding:9px 10px; border-bottom:1px solid #f0f1f5; vertical-align:middle; }
.vdm-itable td.r { text-align:right; font-variant-numeric:tabular-nums; }
.vdm-itable tr:last-child td { border-bottom:none; }
.vdm-itable tr:hover td { background:#f9faff; }

/* ── Main table ── */
.vdm-table { width:100%; border-collapse:collapse; table-layout:fixed; font-size:12.5px; }
.vdm-table th {
  padding:11px 10px; font-size:10.5px; font-weight:700; color:#1a237e;
  text-transform:uppercase; letter-spacing:0.05em;
  background:#eef2ff; border-bottom:2px solid #c7d2fe; text-align:left; white-space:nowrap;
}
.vdm-table th.r { text-align:right; }
.vdm-table th.div-l { border-left:2px solid #c7d2fe; }
.vdm-table td { padding:10px 10px; border-bottom:1px solid #f0f1f5; vertical-align:middle; }
.vdm-table td.r { text-align:right; font-variant-numeric:tabular-nums; }
.vdm-table td.div-l { border-left:2px solid #eef2ff; }
.vdm-table tr:nth-child(even) td { background:#fafbff; }
.vdm-table tr:hover td { background:#f5f7ff !important; transition:background 0.1s; }

/* ── Utility ── */
.ellipsis { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:block; }
.mono { font-family:'JetBrains Mono',monospace; font-size:11.5px; }
.badge { display:inline-block; padding:3px 10px; border-radius:20px; font-size:11px; font-weight:700; white-space:nowrap; }
.badge-open    { background:#e0e7ff; color:#3730a3; }
.badge-closed  { background:#dcfce7; color:#16a34a; }
.badge-partial { background:#fef3c7; color:#b45309; }
.badge-none    { background:#f3f4f6; color:#9ca3af; }
.stk { display:inline-block; padding:3px 9px; border-radius:6px; font-size:11.5px; font-weight:700; }
.stk-pos  { background:#dcfce7; color:#16a34a; }
.stk-neg  { background:#fee2e2; color:#ef4444; }
.stk-zero { background:#f3f4f6; color:#9ca3af; }
.vdm-empty { padding:52px; text-align:center; color:#9ca3af; }
.vdm-empty-icon { font-size:36px; margin-bottom:12px; opacity:0.45; }

/* ── Toasts ── */
.vdm-toasts { position:fixed; top:22px; right:22px; z-index:9999; display:flex; flex-direction:column; gap:8px; pointer-events:none; }
.vdm-toast {
  padding:12px 18px; border-radius:10px; font-size:13px; font-weight:500; max-width:360px;
  box-shadow:0 4px 20px rgba(0,0,0,0.12); pointer-events:all;
  animation:toastPop 0.24s cubic-bezier(0.34,1.56,0.64,1) both;
}
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

// ─── Pure helpers ─────────────────────────────────────────────────────────────

const norm = (v: any) => (v == null ? '' : String(v).trim().toUpperCase());
const alpha = (v: any) => norm(v).replace(/[^A-Z0-9]/g, '');

const getNumericField = (obj: any, keys: string[]): number | null => {
  for (const k of keys) { if (obj?.[k] != null) { const n = Number(String(obj[k]).trim()); if (!isNaN(n)) return n; } }
  return null;
};

const findNumericField = (obj: any, keys: string[]): { key: string; value: number } | null => {
  for (const k of keys) { if (obj?.[k] != null) { const n = Number(String(obj[k]).trim()); if (!isNaN(n)) return { key: k, value: n }; } }
  return null;
};

const CLOSING_KEYS = ['closingStock','closing_stock','ClosingStock','closing','closingQty',
  'closing_qty','Closing','closing stock','Closing Stock','closingstock','closingStockQty'];
const STOCK_QTY_KEYS = ['stockQty','stock_qty','stock','StockQty','currentStock'];
const PURCHASE_STORE_KEYS = ['purchaseActualQtyInStore','purchase_actual_qty_in_store','purchaseActualQty','purchase_actual_qty'];

const chooseBestStock = (cands: any[]): any | null => {
  if (!cands?.length) return null;
  let best: any = null, bv = Number.NEGATIVE_INFINITY;
  for (const s of cands) {
    const c = findNumericField(s, CLOSING_KEYS);
    const cv = c ? c.value : (getNumericField(s, STOCK_QTY_KEYS) || 0) + (getNumericField(s, PURCHASE_STORE_KEYS) || 0);
    if (best === null || cv > bv || (cv === bv && (s.id || 0) > (best.id || 0))) { best = s; bv = cv; }
  }
  return best;
};

const matchStock = (stocks: any[], itemCode?: string, itemName?: string): any | null => {
  if (!stocks?.length || (!itemCode && !itemName)) return null;
  const lu = [itemCode, itemName].filter(Boolean).join(' ');
  const t = norm(lu), ta = alpha(lu);
  const cn = norm(itemCode || ''), nn = norm(itemName || '');
  const try2 = (fn: (s: any) => boolean) => { const m = stocks.filter(fn); return m.length ? chooseBestStock(m) : null; };
  return (
    (cn && try2(s => norm(s.itemCode || s.ItemCode || s.code || s.Code || s.item_code) === cn)) ||
    (nn && try2(s => norm(s.itemName || s.ItemName || s.name || s.Name) === nn)) ||
    try2(s => [s.itemCode, s.ItemCode, s.code, s.Code, s.itemName, s.ItemName, s.name, s.Name, s.sku].some(c => alpha(c) === ta || norm(c) === t)) ||
    try2(s => Object.values(s).some((v: any) => { try { const a = alpha(v), n = norm(v); return a.includes(ta) || ta.includes(a) || n.includes(t) || t.includes(n); } catch { return false; } })) ||
    null
  );
};

const computeStock = (rec: any): number | string => {
  if (!rec) return '';
  const c = findNumericField(rec, CLOSING_KEYS);
  if (c) return c.value;
  return (getNumericField(rec, STOCK_QTY_KEYS) || 0) + (getNumericField(rec, PURCHASE_STORE_KEYS) || 0);
};

const getPurchaseQty = (poNo: any, itemCode: any, pos: any[], pd: any[]): number => {
  try {
    if (!poNo || !itemCode) return 0;
    const tp = norm(poNo), tc = norm(itemCode);
    const po = pos?.find((p: any) => norm(p.poNo) === tp);
    if (po) {
      if (Array.isArray(po.items)) { const m = po.items.find((it: any) => norm(it.itemCode || it.Code) === tc); if (m) return Number(m.poQty ?? m.originalIndentQty ?? m.qty ?? m.purchaseQty ?? 0); }
      else if (norm(po.itemCode || po.Code) === tc) return Number(po.purchaseQty ?? po.qty ?? 0);
    }
    const pm = pd?.find((it: any) => (norm(it.poNo) === tp || norm(it.indentNo) === tp) && norm(it.itemCode || it.Code) === tc);
    return pm ? Number(pm.poQty ?? pm.originalIndentQty ?? pm.qty ?? pm.purchaseQty ?? 0) : 0;
  } catch { return 0; }
};

const getIndentStatus = (poNo: any, itemCode: any, indentNo: any, pd: any[], pos: any[]): string => {
  try {
    const tp = norm(poNo), tc = norm(itemCode), ti = norm(indentNo);
    const pf = pd?.find((it: any) => (norm(it.poNo) === tp || norm(it.indentNo) === ti) && norm(it.itemCode || it.Code) === tc);
    if (pf?.indentStatus) return String(pf.indentStatus);
    const po = pos?.find((p: any) => norm(p.poNo) === tp || norm(p.poNo || p.indentNo) === tp);
    if (po) {
      if (Array.isArray(po.items)) { const m = po.items.find((it: any) => norm(it.itemCode || it.Code) === tc); if (m?.indentStatus) return String(m.indentStatus); }
      else if (po.itemCode && norm(po.itemCode) === tc && po.indentStatus) return String(po.indentStatus);
    }
  } catch {}
  return '';
};

const getSupplierFromPO = (poNo: any, pos: any[], pd: any[]): string =>
  String(pos?.find((p: any) => norm(p.poNo) === norm(poNo))?.supplierName || pd?.find((p: any) => norm(p.poNo) === norm(poNo))?.supplierName || '').trim();

const getVendorBatchFromVSIR = (poNo: any, vsir: any[]): string => {
  if (!poNo || !vsir?.length) return '';
  return vsir.find((r: any) => String(r.poNo || '').trim() === String(poNo).trim() && r.vendorBatchNo?.trim())?.vendorBatchNo || '';
};

const getPSIRByPO = (poNo: any, psir: any[]): any =>
  psir?.find((r: any) => String(r.poNo || '').trim() === String(poNo || '').trim()) || null;

// ─── CSV export ───────────────────────────────────────────────────────────────

const exportCSV = (rows: any[]) => {
  const H = ['#','PO No','OA No','Vendor','Date','Batch No','Vendor Batch','DC No',
    'Item Name','Item Code','Issue No','PO Qty','Planned Qty','Rcvd','OK','Rework','Rejected','GRN No','Stock','Status','Remarks'];
  const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [H.map(esc).join(',')];
  rows.forEach((r, i) => lines.push([
    i + 1, r.materialPurchasePoNo, r.oaNo, r.vendorName, r.orderPlaceDate,
    r.batchNo, r.vendorBatchNo, r.dcNo,
    r._item.itemName, r._item.itemCode, r._item.materialIssueNo,
    r._poQty, r._item.plannedQty ?? '', r._item.receivedQty,
    r._item.okQty, r._item.reworkQty, r._item.rejectedQty,
    r._item.grnNo, r._stock, r._status, r._item.remarks,
  ].map(esc).join(',')));
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url;
  a.download = `vendor-dept-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  URL.revokeObjectURL(url);
};

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

// ─── Sub-components ───────────────────────────────────────────────────────────

const Field: React.FC<{ label: string; children: React.ReactNode; style?: React.CSSProperties }> = ({ label, children, style }) => (
  <div style={style}>
    <span className="vdm-lbl">{label}</span>
    {children}
  </div>
);

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const s = (status || '').toUpperCase();
  const cls = s === 'CLOSED' ? 'badge-closed' : s === 'PARTIAL' ? 'badge-partial' : s === 'OPEN' ? 'badge-open' : 'badge-none';
  return <span className={`badge ${cls}`}>{s || '—'}</span>;
};

const StockBadge: React.FC<{ val: number | string }> = ({ val }) => {
  if (val === '' || val == null) return <span className="stk stk-zero">—</span>;
  const n = Number(val);
  const cls = n < 0 ? 'stk-neg' : n > 0 ? 'stk-pos' : 'stk-zero';
  return <span className={`stk ${cls}`}>{n > 0 ? `+${n}` : n}</span>;
};

const NumInput: React.FC<{ value: number; onChange: (n: number) => void; placeholder?: string }> = ({ value, onChange, placeholder }) => (
  <input type="number" className="vdm-input" min={0}
    style={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}
    value={value || ''} placeholder={placeholder || '0'}
    onChange={e => onChange(Math.max(0, Number(e.target.value)))} />
);

// ─── Main component ───────────────────────────────────────────────────────────

const VendorDeptModule: React.FC = () => {
  const { toasts, show: toast } = useToast();

  // Inject styles once
  useEffect(() => {
    if (document.getElementById('vdm-css')) return;
    const el = document.createElement('style');
    el.id = 'vdm-css'; el.textContent = GLOBAL_STYLES;
    document.head.appendChild(el);
  }, []);

  // ── Data state ──────────────────────────────────────────────────────────
  const [userUid, setUserUid] = useState<string | null>(null);
  const [orders, setOrders] = useState<VendorDeptOrder[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [purchaseData, setPurchaseData] = useState<any[]>([]);
  const [vsirRecords, setVsirRecords] = useState<any[]>([]);
  const [psirData, setPsirData] = useState<any[]>([]);
  const [stockRecords, setStockRecords] = useState<any[]>([]);
  const [purchasePOs, setPurchasePOs] = useState<string[]>([]);

  // ── Form state ──────────────────────────────────────────────────────────
  const [newOrder, setNewOrder] = useState<VendorDeptOrder>({ ...BLANK_ORDER });
  const [itemInput, setItemInput] = useState<VendorDeptItem>({ ...BLANK_ITEM });
  const [editOrderIdx, setEditOrderIdx] = useState<number | null>(null);
  const [editItemIdx, setEditItemIdx] = useState<number | null>(null);

  // ── Filter state ────────────────────────────────────────────────────────
  const [filterOpen, setFilterOpen] = useState(false);
  const [fSearch, setFSearch] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fFrom, setFFrom] = useState('');
  const [fTo, setFTo] = useState('');

  const editRef = useRef<HTMLDivElement>(null);

  // ── Auth ────────────────────────────────────────────────────────────────
  useEffect(() => onAuthStateChanged(auth, u => setUserUid(u?.uid ?? null)), []);

  // ── Subscriptions ────────────────────────────────────────────────────────
  useEffect(() => { if (!userUid) return; return subscribeVendorDepts(userUid, setOrders); }, [userUid]);
  useEffect(() => { if (!userUid) return; return subscribeVSIRRecords(userUid, setVsirRecords); }, [userUid]);
  useEffect(() => { if (!userUid) return; return subscribePsirs(userUid, setPsirData); }, [userUid]);

  useEffect(() => {
    if (!userUid) return;
    Promise.all([getPurchaseOrders(userUid), getPurchaseData(userUid)])
      .then(([po, pd]) => {
        if (Array.isArray(po)) setPurchaseOrders(po);
        if (Array.isArray(pd)) setPurchaseData(pd);
      }).catch(() => {});
  }, [userUid]);

  // ── Stock ────────────────────────────────────────────────────────────────
  const reloadStock = useCallback(() => {
    try { const r = localStorage.getItem('stock-records'); if (r) setStockRecords(JSON.parse(r)); } catch {}
  }, []);

  useEffect(() => {
    reloadStock();
    const sh = (e: StorageEvent) => { if (e.key === 'stock-records') reloadStock(); };
    const bh = () => reloadStock();
    window.addEventListener('storage', sh);
    bus.addEventListener('stock.updated', bh as EventListener);
    return () => { window.removeEventListener('storage', sh); bus.removeEventListener('stock.updated', bh as EventListener); };
  }, [reloadStock]);

  // ── Derive PO list ───────────────────────────────────────────────────────
  useEffect(() => {
    const src = purchaseOrders.length > 0 ? purchaseOrders : purchaseData;
    const list = [...new Set(src.map((o: any) => o.poNo).filter(Boolean))] as string[];
    setPurchasePOs(list);
    if (list.length && !newOrder.materialPurchasePoNo)
      setNewOrder(p => ({ ...p, materialPurchasePoNo: list[list.length - 1] }));
  }, [purchaseOrders, purchaseData]); // eslint-disable-line

  // ── VSIR → orders sync ──────────────────────────────────────────────────
  useEffect(() => {
    if (!vsirRecords.length) return;
    setOrders(prev => prev.map(o => {
      let upd = { ...o };
      if (!o.vendorBatchNo?.trim()) {
        const vbn = getVendorBatchFromVSIR(o.materialPurchasePoNo, vsirRecords);
        if (vbn) upd.vendorBatchNo = vbn;
      }
      let changed = false;
      const items = o.items.map(it => {
        const v = vsirRecords.find(r => norm(r.poNo) === norm(o.materialPurchasePoNo) && norm(r.itemCode) === norm(it.itemCode));
        if (!v) return it;
        const nr = v.qtyReceived || 0, no = v.okQty || 0, nrw = v.reworkQty || 0, nrj = v.rejectQty || 0, ng = v.grnNo || '';
        if (nr !== it.receivedQty || no !== it.okQty || nrw !== it.reworkQty || nrj !== it.rejectedQty || ng !== it.grnNo) {
          changed = true;
          return { ...it, receivedQty: nr, okQty: no, reworkQty: nrw, rejectedQty: nrj, grnNo: ng };
        }
        return it;
      });
      if (changed) { upd.items = items; bus.dispatchEvent(new CustomEvent('vendorDept.updated', { detail: { source: 'vsir-sync' } })); }
      return changed || upd.vendorBatchNo !== o.vendorBatchNo ? upd : o;
    }));
  }, [vsirRecords]);

  // ── PSIR → batchNo backfill ──────────────────────────────────────────────
  useEffect(() => {
    if (!psirData.length) return;
    setOrders(prev => prev.map(o => {
      if (o.batchNo?.trim()) return o;
      const p = psirData.find((r: any) => r.poNo === o.materialPurchasePoNo);
      return p?.batchNo ? { ...o, batchNo: p.batchNo } : o;
    }));
  }, [psirData]);

  // ── Auto-import new POs ──────────────────────────────────────────────────
  useEffect(() => {
    if (!userUid || !purchaseOrders.length) return;
    const existing = new Set(orders.map(o => norm(o.materialPurchasePoNo)));
    const grouped: Record<string, any[]> = {};
    purchaseOrders.forEach((e: any) => { if (!e.poNo) return; const k = norm(e.poNo); (grouped[k] = grouped[k] || []).push(e); });
    Object.entries(grouped).forEach(([nPo, group]) => {
      if (existing.has(nPo)) return;
      const first = group[0];
      const pr = psirData.find((p: any) => norm(p.poNo) === nPo);
      const vr = vsirRecords.find((v: any) => norm(v.poNo) === nPo);
      addVendorDept(userUid, {
        orderPlaceDate: first.orderPlaceDate || '', materialPurchasePoNo: first.poNo,
        oaNo: first.oaNo || '', batchNo: pr?.batchNo || '', vendorBatchNo: vr?.vendorBatchNo || '',
        dcNo: '', vendorName: '',
        items: group.map((item: any) => ({
          itemName: item.itemName || item.model || '', itemCode: item.itemCode || '', materialIssueNo: '',
          qty: item.qty || 0, indentStatus: (item.indentStatus || '').toUpperCase(),
          receivedQty: 0, okQty: item.okQty || 0, reworkQty: item.reworkQty || 0,
          rejectedQty: item.rejectedQty || 0, grnNo: item.grnNo || '',
          debitNoteOrQtyReturned: item.debitNoteOrQtyReturned || '', remarks: item.remarks || '',
        })),
      }).catch(() => {});
    });
  }, [purchaseOrders, userUid]); // eslint-disable-line

  // ── Form auto-fill on PO change ──────────────────────────────────────────
  useEffect(() => {
    const poNo = newOrder.materialPurchasePoNo;
    if (!poNo) return;
    const ex = orders.find(o => o.materialPurchasePoNo === poNo);
    const pr = getPSIRByPO(poNo, psirData);
    const vbn = getVendorBatchFromVSIR(poNo, vsirRecords);
    const supplier = !newOrder.vendorName && editOrderIdx === null ? getSupplierFromPO(poNo, purchaseOrders, purchaseData) : '';
    setNewOrder(prev => ({
      ...prev,
      orderPlaceDate: ex?.orderPlaceDate || pr?.receivedDate || prev.orderPlaceDate,
      oaNo: ex?.oaNo || pr?.oaNo || prev.oaNo,
      batchNo: ex?.batchNo || pr?.batchNo || prev.batchNo,
      vendorBatchNo: vbn || ex?.vendorBatchNo || prev.vendorBatchNo,
      ...(supplier ? { vendorName: supplier } : {}),
    }));
  }, [newOrder.materialPurchasePoNo, vsirRecords, psirData]); // eslint-disable-line

  // ── Item auto-fill from VSIR ─────────────────────────────────────────────
  useEffect(() => {
    if (!newOrder.materialPurchasePoNo || !itemInput.itemCode) return;
    const v = vsirRecords.find(r => norm(r.poNo) === norm(newOrder.materialPurchasePoNo) && norm(r.itemCode) === norm(itemInput.itemCode));
    if (!v) return;
    setItemInput(p => ({ ...p, receivedQty: v.qtyReceived || 0, okQty: v.okQty || v.qtyReceived || 0, reworkQty: v.reworkQty || 0, rejectedQty: v.rejectQty || 0, grnNo: v.grnNo || '' }));
  }, [newOrder.materialPurchasePoNo, itemInput.itemCode, vsirRecords]);

  // ── Item qty from purchase ───────────────────────────────────────────────
  useEffect(() => {
    if (!newOrder.materialPurchasePoNo || !itemInput.itemCode) return;
    setItemInput(p => ({ ...p, qty: getPurchaseQty(newOrder.materialPurchasePoNo, itemInput.itemCode, purchaseOrders, purchaseData) }));
  }, [newOrder.materialPurchasePoNo, itemInput.itemCode, purchaseOrders, purchaseData]);

  // ── Bus events ───────────────────────────────────────────────────────────
  useEffect(() => {
    const fn = () => setVsirRecords(p => [...p]);
    bus.addEventListener('vsir.updated', fn as EventListener);
    bus.addEventListener('vsir.records.synced', fn as EventListener);
    return () => { bus.removeEventListener('vsir.updated', fn as EventListener); bus.removeEventListener('vsir.records.synced', fn as EventListener); };
  }, []);

  // ── Derived memos ────────────────────────────────────────────────────────
  const stockMap = useMemo(() => {
    const m = new Map<string, number | string>();
    orders.forEach(o => o.items.forEach(it => {
      const k = `${it.itemCode}::${it.itemName}`;
      if (!m.has(k)) m.set(k, computeStock(matchStock(stockRecords, it.itemCode, it.itemName)));
    }));
    return m;
  }, [stockRecords, orders]);

  const getStock = useCallback((code?: string, name?: string): number | string => {
    const k = `${code}::${name}`;
    return stockMap.has(k) ? stockMap.get(k)! : computeStock(matchStock(stockRecords, code, name));
  }, [stockMap, stockRecords]);

  const statusMap = useMemo(() => {
    const m = new Map<string, string>();
    orders.forEach(o => o.items.forEach(it => {
      const k = `${o.materialPurchasePoNo}::${it.itemCode}::${it.materialIssueNo}`;
      if (!m.has(k)) m.set(k, (getIndentStatus(o.materialPurchasePoNo, it.itemCode, it.materialIssueNo, purchaseData, purchaseOrders) || it.indentStatus || '').toUpperCase());
    }));
    return m;
  }, [orders, purchaseData, purchaseOrders]);

  const poQtyMap = useMemo(() => {
    const m = new Map<string, number>();
    orders.forEach(o => o.items.forEach(it => {
      const k = `${o.materialPurchasePoNo}::${it.itemCode}`;
      if (!m.has(k)) m.set(k, Math.abs(getPurchaseQty(o.materialPurchasePoNo, it.itemCode, purchaseOrders, purchaseData)));
    }));
    return m;
  }, [orders, purchaseOrders, purchaseData]);

  type FlatRow = VendorDeptOrder & { _oi: number; _item: VendorDeptItem; _ii: number; _poQty: number; _stock: number | string; _status: string };

  const flatRows = useMemo((): FlatRow[] => {
    const rows: FlatRow[] = [];
    orders.forEach((o, oi) => {
      if (!o.items.length) {
        rows.push({ ...o, _oi: oi, _item: { ...BLANK_ITEM }, _ii: -1, _poQty: 0, _stock: '', _status: '' });
      } else {
        o.items.forEach((it, ii) => rows.push({
          ...o, _oi: oi, _item: it, _ii: ii,
          _poQty: poQtyMap.get(`${o.materialPurchasePoNo}::${it.itemCode}`) ?? 0,
          _stock: stockMap.get(`${it.itemCode}::${it.itemName}`) ?? getStock(it.itemCode, it.itemName),
          _status: statusMap.get(`${o.materialPurchasePoNo}::${it.itemCode}::${it.materialIssueNo}`) ?? '',
        }));
      }
    });
    return rows;
  }, [orders, poQtyMap, stockMap, statusMap, getStock]);

  const filtered = useMemo(() => {
    let rows = flatRows;
    if (fSearch.trim()) {
      const t = fSearch.trim().toUpperCase();
      rows = rows.filter(r => [r.materialPurchasePoNo, r.vendorName, r._item.itemName, r._item.itemCode, r.oaNo, r._item.grnNo].some(v => norm(v).includes(t)));
    }
    if (fStatus) rows = rows.filter(r => r._status === fStatus.toUpperCase());
    if (fFrom) rows = rows.filter(r => r.orderPlaceDate >= fFrom);
    if (fTo) rows = rows.filter(r => r.orderPlaceDate <= fTo);
    return rows;
  }, [flatRows, fSearch, fStatus, fFrom, fTo]);

  const activeFilters = [fSearch, fStatus, fFrom, fTo].filter(Boolean).length;

  const stats = useMemo(() => ({
    total: orders.length,
    items: orders.reduce((s, o) => s + o.items.length, 0),
    pending: orders.filter(o => o.items.some(it => !it.receivedQty)).length,
    received: flatRows.reduce((s, r) => s + (r._item.receivedQty || 0), 0),
    rejected: flatRows.reduce((s, r) => s + (r._item.rejectedQty || 0), 0),
  }), [orders, flatRows]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const clearForm = useCallback(() => {
    setNewOrder({ ...BLANK_ORDER }); setItemInput({ ...BLANK_ITEM });
    setEditOrderIdx(null); setEditItemIdx(null);
  }, []);

  const handleSaveItem = useCallback(() => {
    if (!itemInput.itemName || !itemInput.itemCode || !itemInput.materialIssueNo || itemInput.qty <= 0) {
      toast('Please fill Item Name, Code, Issue No and Qty (> 0)', 'e'); return;
    }
    const enriched = { ...itemInput, plannedQty: itemInput.qty, closingStock: getStock(itemInput.itemCode, itemInput.itemName) };
    if (editItemIdx !== null) {
      setNewOrder(p => ({ ...p, items: p.items.map((it, i) => i === editItemIdx ? enriched : it) }));
      setEditItemIdx(null);
    } else {
      setNewOrder(p => ({ ...p, items: [...p.items, enriched] }));
    }
    setItemInput({ ...BLANK_ITEM });
  }, [itemInput, editItemIdx, getStock, toast]);

  const handleAddOrder = useCallback(async () => {
    if (!newOrder.orderPlaceDate || !newOrder.materialPurchasePoNo || !newOrder.vendorName || !newOrder.items.length || !newOrder.dcNo) {
      toast('Please fill: Date, PO No, Vendor Name, DC No, and add at least one item', 'e'); return;
    }
    if (!newOrder.oaNo) { toast('OA No not yet populated — re-select the PO No', 'e'); return; }
    if (!newOrder.batchNo) { toast('Batch No not yet populated — re-select the PO No', 'e'); return; }
    if (!userUid) { toast('Not authenticated', 'e'); return; }
    const vbn = newOrder.vendorBatchNo || getVendorBatchFromVSIR(newOrder.materialPurchasePoNo, vsirRecords);
    try {
      await addVendorDept(userUid, { ...newOrder, vendorBatchNo: vbn });
      bus.dispatchEvent(new CustomEvent('vendorDept.updated', { detail: {} }));
      toast('Order saved successfully ✓', 's'); clearForm();
    } catch { toast('Failed to save order — please retry', 'e'); }
  }, [newOrder, vsirRecords, userUid, clearForm, toast]);

  const handleUpdateOrder = useCallback(async () => {
    if (editOrderIdx === null || !userUid || !orders[editOrderIdx]?.id) { toast('Cannot update: missing data', 'e'); return; }
    const { id, ...data } = newOrder;
    try {
      await updateVendorDept(userUid, orders[editOrderIdx].id!, data);
      bus.dispatchEvent(new CustomEvent('vendorDept.updated', { detail: {} }));
      toast('Order updated successfully ✓', 's'); clearForm();
    } catch { toast('Failed to update order — please retry', 'e'); }
  }, [editOrderIdx, userUid, orders, newOrder, clearForm, toast]);

  const handleDeleteOrder = useCallback(async (idx: number) => {
    if (!userUid || !orders[idx]?.id) return;
    if (!window.confirm('Delete this entire order?')) return;
    try { await deleteVendorDept(userUid, orders[idx].id!); toast('Order deleted', 's'); }
    catch { toast('Failed to delete order', 'e'); }
  }, [userUid, orders, toast]);

  const handleDeleteItem = useCallback(async (oi: number, ii: number) => {
    if (!userUid || !orders[oi]?.id) return;
    if (!window.confirm('Delete this item?')) return;
    const upd = { ...orders[oi], items: orders[oi].items.filter((_, i) => i !== ii) };
    try {
      if (!upd.items.length) await deleteVendorDept(userUid, orders[oi].id!);
      else { const { id, ...d } = upd; await updateVendorDept(userUid, orders[oi].id!, d); }
      toast('Item deleted', 's');
    } catch { toast('Failed to delete item', 'e'); }
  }, [userUid, orders, toast]);

  const handleEditOrder = useCallback((idx: number) => {
    const o = JSON.parse(JSON.stringify(orders[idx]));
    if (!o.vendorBatchNo?.trim()) { const vbn = getVendorBatchFromVSIR(o.materialPurchasePoNo, vsirRecords); if (vbn) o.vendorBatchNo = vbn; }
    setNewOrder(o); setItemInput({ ...BLANK_ITEM }); setEditOrderIdx(idx); setEditItemIdx(null);
    setTimeout(() => editRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }, [orders, vsirRecords]);

  const handleManualSync = useCallback(() => {
    if (!orders.length) { toast('No orders to sync', 'i'); return; }
    let changed = false;
    const updated = orders.map(o => ({
      ...o, items: o.items.map(it => {
        const q = getPurchaseQty(o.materialPurchasePoNo, it.itemCode, purchaseOrders, purchaseData);
        if (q > 0 && !it.qty) { changed = true; return { ...it, qty: q }; } return it;
      }),
    }));
    if (changed) setOrders(updated);
    toast(changed ? 'Sync complete — empty quantities filled' : 'All quantities already populated', 'i');
  }, [orders, purchaseOrders, purchaseData, toast]);

  const clearFilters = () => { setFSearch(''); setFStatus(''); setFFrom(''); setFTo(''); };
  const isEditing = editOrderIdx !== null;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="vdm">
      {/* Toasts */}
      <div className="vdm-toasts">
        {toasts.map(t => <div key={t.id} className={`vdm-toast toast-${t.type}`}>{t.msg}</div>)}
      </div>

      <div className="vdm-inner">

        {/* ── Page header + unified toolbar ────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700, color: '#1a237e', letterSpacing: '-0.02em' }}>Vendor Dept</h1>
            <p style={{ margin: '2px 0 0', fontSize: 12.5, color: '#9ca3af', fontWeight: 500 }}>Purchase order tracking &amp; vendor management</p>
          </div>

          {/* Unified toolbar — filters + row count + sync + export all in one bar */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            <div className="vdm-toolbar">
              {/* Filter toggle btn with badge */}
              <button
                className={`vdm-btn vdm-btn-sm ${activeFilters > 0 ? 'vdm-btn-indigo' : 'vdm-btn-ghost'}`}
                style={{ position: 'relative' }}
                onClick={() => setFilterOpen(p => !p)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg>
                {activeFilters > 0 ? `Filters (${activeFilters})` : 'Filters'}
                {activeFilters > 0 && (
                  <span style={{ position: 'absolute', top: -7, right: -7, background: '#ef4444', color: '#fff', borderRadius: '50%', width: 17, height: 17, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{activeFilters}</span>
                )}
              </button>

              <div className="vdm-divider-sm" />

              {/* Row count pill */}
              <span className="vdm-rowcount">
                {filtered.length === flatRows.length ? `${flatRows.length} rows` : `${filtered.length} / ${flatRows.length} rows`}
              </span>

              <div className="vdm-divider-sm" />

              {/* Sync */}
              <button className="vdm-btn vdm-btn-sm vdm-btn-ghost" onClick={handleManualSync} title="Fill empty quantities from purchase data">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15"/></svg>
                Sync
              </button>

              {/* Export — same row as filters */}
              <button className="vdm-btn vdm-btn-sm vdm-btn-success" onClick={() => exportCSV(filtered)} title={`Export ${filtered.length} rows as CSV`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Export CSV
              </button>
            </div>

            {/* Active filter chips below toolbar */}
            {activeFilters > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
                {fSearch && <span className="vdm-chip">🔍 "{fSearch}" <span className="vdm-chip-x" onClick={() => setFSearch('')}>×</span></span>}
                {fStatus && <span className="vdm-chip">Status: {fStatus} <span className="vdm-chip-x" onClick={() => setFStatus('')}>×</span></span>}
                {fFrom && <span className="vdm-chip">From: {fFrom} <span className="vdm-chip-x" onClick={() => setFFrom('')}>×</span></span>}
                {fTo && <span className="vdm-chip">To: {fTo} <span className="vdm-chip-x" onClick={() => setFTo('')}>×</span></span>}
                <button className="vdm-btn vdm-btn-xs vdm-btn-ghost" onClick={clearFilters}>Clear all</button>
              </div>
            )}
          </div>
        </div>

        {/* ── Filter panel (inline, animated) ──────────────────────────── */}
        {filterOpen && (
          <div className="vdm-fpanel" style={{ marginBottom: 16 }}>
            <Field label="Search">
              <input className="vdm-input" style={{ minWidth: 210 }} autoFocus
                placeholder="PO No, vendor, item name, GRN…"
                value={fSearch} onChange={e => setFSearch(e.target.value)} />
            </Field>
            <Field label="Indent Status">
              <select className="vdm-input vdm-select" style={{ minWidth: 130 }} value={fStatus} onChange={e => setFStatus(e.target.value)}>
                <option value="">All statuses</option>
                {INDENT_STATUS_OPTIONS.map(s => <option key={s} value={s.toUpperCase()}>{s}</option>)}
              </select>
            </Field>
            <Field label="Date From">
              <input type="date" className="vdm-input" value={fFrom} onChange={e => setFFrom(e.target.value)} />
            </Field>
            <Field label="Date To">
              <input type="date" className="vdm-input" value={fTo} onChange={e => setFTo(e.target.value)} />
            </Field>
            <div style={{ alignSelf: 'flex-end', display: 'flex', gap: 8 }}>
              {activeFilters > 0 && <button className="vdm-btn vdm-btn-sm vdm-btn-ghost" onClick={clearFilters}>Clear all</button>}
              <button className="vdm-btn vdm-btn-sm vdm-btn-ghost" onClick={() => setFilterOpen(false)}>Close</button>
            </div>
          </div>
        )}

        {/* ── Stats bar ────────────────────────────────────────────────── */}
        <div className="vdm-card" style={{ marginBottom: 18, padding: '16px 24px' }}>
          <div className="vdm-stats">
            {[
              { val: stats.total, lbl: 'Orders', color: '#1a237e' },
              { val: stats.items, lbl: 'Line Items', color: '#1a237e' },
              { val: stats.pending, lbl: 'Pending', color: '#d97706' },
              { val: stats.received, lbl: 'Total Received', color: '#16a34a' },
              { val: stats.rejected, lbl: 'Total Rejected', color: stats.rejected > 0 ? '#ef4444' : '#9ca3af' },
            ].map((s, i) => (
              <React.Fragment key={s.lbl}>
                {i > 0 && <div className="vdm-divider-v" />}
                <div className="vdm-stat">
                  <div className="vdm-stat-val" style={{ color: s.color }}>{s.val}</div>
                  <div className="vdm-stat-lbl">{s.lbl}</div>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* ── Edit / Add panel ─────────────────────────────────────────── */}
        <div ref={editRef} className={`vdm-card ${isEditing ? 'vdm-card-edit' : ''}`} style={{ marginBottom: 20 }}>

          {/* Panel header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 22px', borderBottom: '1px solid #f0f1f5',
            background: isEditing ? '#eef2ff' : '#fafbff',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 17 }}>{isEditing ? '✏️' : '＋'}</span>
              <span style={{ fontWeight: 700, fontSize: 14.5, color: isEditing ? '#1a237e' : '#374151' }}>
                {isEditing ? `Edit Order  —  PO ${newOrder.materialPurchasePoNo}` : 'New Order'}
              </span>
              {isEditing && (
                <span style={{ background: '#c7d2fe', color: '#3730a3', padding: '2px 10px', borderRadius: 20, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.05em' }}>EDIT MODE</span>
              )}
            </div>
            {isEditing && <button className="vdm-btn vdm-btn-sm vdm-btn-ghost" onClick={clearForm}>✕ Discard</button>}
          </div>

          <div style={{ padding: '20px 22px' }}>

            {/* PO selector bar */}
            <div className="vdm-pobar">
              <span style={{ fontSize: 10.5, fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>PO No</span>
              <select className="vdm-input vdm-select" style={{ maxWidth: 200, flex: '0 0 auto' }}
                value={newOrder.materialPurchasePoNo}
                onChange={e => setNewOrder(p => ({ ...p, materialPurchasePoNo: e.target.value }))}>
                <option value="">— Select PO No —</option>
                {purchasePOs.map(po => <option key={po} value={po}>{po}</option>)}
              </select>
              {newOrder.orderPlaceDate && <span className="vdm-pobar-meta">📅 <strong>{newOrder.orderPlaceDate}</strong></span>}
              {newOrder.oaNo && <span className="vdm-pobar-meta">OA: <strong>{newOrder.oaNo}</strong></span>}
              {newOrder.batchNo && <span className="vdm-pobar-meta">Batch: <strong>{newOrder.batchNo}</strong></span>}
            </div>

            {/* Order detail fields */}
            <div className="vdm-sec">Order Details</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 14, marginBottom: 20 }}>
              <Field label="Vendor Name ✱">
                <input className="vdm-input vdm-input-accent" placeholder="e.g. Acme Components"
                  value={newOrder.vendorName} onChange={e => setNewOrder(p => ({ ...p, vendorName: e.target.value }))} />
              </Field>
              <Field label="DC No ✱">
                <input className="vdm-input vdm-input-accent" placeholder="Delivery Challan No"
                  value={newOrder.dcNo} onChange={e => setNewOrder(p => ({ ...p, dcNo: e.target.value }))} />
              </Field>
              <Field label="Vendor Batch No">
                <input className="vdm-input" placeholder="Auto-filled from VSIR"
                  value={newOrder.vendorBatchNo} onChange={e => setNewOrder(p => ({ ...p, vendorBatchNo: e.target.value }))} />
              </Field>
            </div>

            {/* Item entry */}
            <div style={{ background: '#f8f9fc', borderRadius: 10, border: '1px solid #e2e4ea', padding: '16px 18px', marginBottom: 16 }}>
              <div className="vdm-sec" style={{ paddingTop: 0 }}>
                {editItemIdx !== null ? '✏ Edit Item' : '+ Add Item'}
              </div>

              {/* Row 1: identity */}
              <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                <Field label="Item Name">
                  <input className="vdm-input" placeholder="e.g. Jaw Carrier 02"
                    value={itemInput.itemName} onChange={e => setItemInput(p => ({ ...p, itemName: e.target.value }))} />
                </Field>
                <Field label="Item Code">
                  <input className="vdm-input" placeholder="e.g. JW-02"
                    value={itemInput.itemCode} onChange={e => setItemInput(p => ({ ...p, itemCode: e.target.value }))} />
                </Field>
                <Field label="Material Issue No">
                  <input className="vdm-input" value={itemInput.materialIssueNo}
                    onChange={e => setItemInput(p => ({ ...p, materialIssueNo: e.target.value }))} />
                </Field>
                <Field label="Indent Status">
                  <select className="vdm-input vdm-select" value={itemInput.indentStatus}
                    onChange={e => setItemInput(p => ({ ...p, indentStatus: e.target.value }))}>
                    <option value="">— Select —</option>
                    {INDENT_STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </Field>
              </div>

              {/* Row 2: quantities */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 12, marginBottom: 12 }}>
                {(['qty', 'receivedQty', 'okQty', 'reworkQty', 'rejectedQty'] as const).map(k => {
                  const labels: Record<string, string> = { qty: 'Qty ✱', receivedQty: 'Received', okQty: 'OK', reworkQty: 'Rework', rejectedQty: 'Rejected' };
                  return (
                    <Field key={k} label={labels[k]}>
                      <NumInput value={itemInput[k] as number} onChange={n => setItemInput(p => ({ ...p, [k]: n }))} />
                    </Field>
                  );
                })}
                <Field label="GRN No">
                  <input className="vdm-input" value={itemInput.grnNo} onChange={e => setItemInput(p => ({ ...p, grnNo: e.target.value }))} />
                </Field>
                <Field label="Debit / Returned">
                  <input className="vdm-input" value={itemInput.debitNoteOrQtyReturned} onChange={e => setItemInput(p => ({ ...p, debitNoteOrQtyReturned: e.target.value }))} />
                </Field>
              </div>

              {/* Row 3: remarks + action */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <Field label="Remarks" style={{ flex: '1 1 200px' }}>
                  <input className="vdm-input" value={itemInput.remarks} onChange={e => setItemInput(p => ({ ...p, remarks: e.target.value }))} />
                </Field>
                <div style={{ display: 'flex', gap: 8, paddingBottom: 1 }}>
                  <button className="vdm-btn vdm-btn-primary" onClick={handleSaveItem}>
                    {editItemIdx !== null ? '✓ Update Item' : '+ Add Item'}
                  </button>
                  {editItemIdx !== null && (
                    <button className="vdm-btn vdm-btn-ghost" onClick={() => { setEditItemIdx(null); setItemInput({ ...BLANK_ITEM }); }}>Cancel</button>
                  )}
                </div>
              </div>
            </div>

            {/* Items preview */}
            {newOrder.items.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#8b95a1', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                  Items in this order ({newOrder.items.length})
                </div>
                <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #e2e4ea' }}>
                  <table className="vdm-itable">
                    <thead>
                      <tr>
                        {['Item Name', 'Code', 'Issue No', 'Qty', 'Status', 'Rcvd', 'OK', 'Rework', 'Rejected', 'GRN', ''].map((h, i) => (
                          <th key={i} className={i >= 5 && i <= 9 ? 'r' : ''}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {newOrder.items.map((it, ii) => (
                        <tr key={ii}>
                          <td><span className="ellipsis" style={{ maxWidth: 150 }} title={it.itemName}>{it.itemName}</span></td>
                          <td><span className="mono" style={{ color: '#6366f1' }}>{it.itemCode}</span></td>
                          <td style={{ color: '#6b7280' }}>{it.materialIssueNo || '—'}</td>
                          <td className="r" style={{ fontWeight: 600 }}>{it.qty}</td>
                          <td><StatusBadge status={it.indentStatus} /></td>
                          <td className="r">{it.receivedQty || '—'}</td>
                          <td className="r" style={{ color: '#16a34a', fontWeight: 600 }}>{it.okQty || '—'}</td>
                          <td className="r" style={{ color: '#d97706' }}>{it.reworkQty || '—'}</td>
                          <td className="r" style={{ color: '#ef4444' }}>{it.rejectedQty || '—'}</td>
                          <td><span className="mono">{it.grnNo || '—'}</span></td>
                          <td>
                            <div style={{ display: 'flex', gap: 5 }}>
                              <button className="vdm-btn vdm-btn-xs vdm-btn-warning" onClick={() => { setItemInput(it); setEditItemIdx(ii); }}>Edit</button>
                              <button className="vdm-btn vdm-btn-xs vdm-btn-danger" onClick={() => setNewOrder(p => ({ ...p, items: p.items.filter((_, xi) => xi !== ii) }))}>✕</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Save order */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className={`vdm-btn ${isEditing ? 'vdm-btn-primary' : 'vdm-btn-success'}`} style={{ minWidth: 160 }}
                onClick={isEditing ? handleUpdateOrder : handleAddOrder}>
                {isEditing ? '✓ Save Changes' : '+ Add Order'}
              </button>
              {isEditing && <button className="vdm-btn vdm-btn-ghost" onClick={clearForm}>Discard</button>}
            </div>

          </div>
        </div>

        {/* ── Orders table ──────────────────────────────────────────────── */}
        <div className="vdm-card">
          <div style={{ padding: '13px 20px', borderBottom: '1px solid #f0f1f5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#1a237e' }}>Orders</span>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>
              {activeFilters > 0 ? `Filtered: ${filtered.length} of ${flatRows.length}` : `${flatRows.length} total rows`}
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="vdm-table">
              <colgroup>
                <col style={{ width: 34 }} /><col style={{ width: 130 }} /><col style={{ width: 88 }} />
                <col style={{ width: 98 }} /><col style={{ width: 82 }} /><col style={{ width: 108 }} />
                <col style={{ width: 62 }} /><col style={{ width: 62 }} /><col style={{ width: 58 }} />
                <col style={{ width: 52 }} /><col style={{ width: 58 }} /><col style={{ width: 62 }} />
                <col style={{ width: 78 }} /><col style={{ width: 60 }} /><col style={{ width: 88 }} />
                <col style={{ width: 88 }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="r">#</th>
                  <th>Item</th>
                  <th>Code</th>
                  <th>PO No</th>
                  <th>OA No</th>
                  <th>Vendor</th>
                  <th className="r">PO Qty</th>
                  <th className="r div-l">Planned</th>
                  <th className="r">Rcvd</th>
                  <th className="r">OK</th>
                  <th className="r">Rework</th>
                  <th className="r div-l">Rejected</th>
                  <th>GRN No</th>
                  <th className="r">Stock</th>
                  <th>Status</th>
                  <th className="r">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={16}>
                      <div className="vdm-empty">
                        <div className="vdm-empty-icon">📦</div>
                        <div style={{ fontWeight: 600, color: '#374151', marginBottom: 4, fontSize: 14 }}>
                          {activeFilters > 0 ? 'No rows match your filters' : 'No orders yet'}
                        </div>
                        <div style={{ fontSize: 12.5 }}>
                          {activeFilters > 0
                            ? <span>Try <span style={{ color: '#4f46e5', cursor: 'pointer', fontWeight: 600 }} onClick={clearFilters}>clearing filters</span> to see all orders</span>
                            : 'Add your first order using the form above'}
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : filtered.map((row, ri) => {
                  const empty = row._ii === -1;
                  return (
                    <tr key={`${row._oi}-${row._ii}`}>
                      <td className="r" style={{ color: '#c4c9d4', fontWeight: 700, fontSize: 11 }}>{ri + 1}</td>
                      <td>
                        <span className="ellipsis" style={{ maxWidth: 118, fontWeight: 500 }} title={row._item.itemName}>
                          {row._item.itemName || <span style={{ color: '#d1d5db' }}>—</span>}
                        </span>
                      </td>
                      <td><span className="mono" style={{ color: '#6366f1' }}>{row._item.itemCode || '—'}</span></td>
                      <td><span style={{ fontWeight: 600, fontSize: 12.5, color: '#1a237e' }}>{row.materialPurchasePoNo}</span></td>
                      <td style={{ color: '#6b7280', fontSize: 12 }}>{row.oaNo || '—'}</td>
                      <td>
                        <span className="ellipsis" style={{ maxWidth: 96 }} title={row.vendorName}>
                          {row.vendorName || <span style={{ color: '#d1d5db' }}>—</span>}
                        </span>
                      </td>
                      <td className="r" style={{ fontWeight: 600 }}>{empty ? '—' : row._poQty || '—'}</td>
                      <td className="r div-l" style={{ color: '#6b7280' }}>{row._item.plannedQty ?? '—'}</td>
                      <td className="r">{row._item.receivedQty || '—'}</td>
                      <td className="r" style={{ color: '#16a34a', fontWeight: 600 }}>{row._item.okQty || '—'}</td>
                      <td className="r" style={{ color: '#d97706' }}>{row._item.reworkQty || '—'}</td>
                      <td className="r div-l" style={{ color: '#ef4444', fontWeight: 600 }}>{row._item.rejectedQty || '—'}</td>
                      <td><span className="mono" style={{ color: '#6b7280', fontSize: 11 }}>{row._item.grnNo || '—'}</span></td>
                      <td className="r"><StockBadge val={row._stock} /></td>
                      <td><StatusBadge status={row._status} /></td>
                      <td className="r">
                        <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end' }}>
                          <button className="vdm-btn vdm-btn-xs vdm-btn-primary" onClick={() => handleEditOrder(row._oi)}>Edit</button>
                          <button className="vdm-btn vdm-btn-xs vdm-btn-danger"
                            onClick={() => empty ? handleDeleteOrder(row._oi) : handleDeleteItem(row._oi, row._ii)}>✕</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};

export default VendorDeptModule;