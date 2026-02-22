import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import bus from '../utils/eventBus';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import {
  getPurchaseOrders,
  getPurchaseData,
  subscribeVendorDepts,
  addVendorDept,
  updateVendorDept,
  deleteVendorDept,
} from '../utils/firestoreServices';
import { subscribeVSIRRecords } from '../utils/firestoreServices';
import { subscribePsirs } from '../utils/psirService';

// ─── Types ────────────────────────────────────────────────────────────────────

interface VendorDeptItem {
  itemName: string;
  itemCode: string;
  materialIssueNo: string;
  qty: number;
  plannedQty?: number;
  closingStock?: number | string;
  indentStatus: string;
  receivedQty: number;
  okQty: number;
  reworkQty: number;
  rejectedQty: number;
  grnNo: string;
  debitNoteOrQtyReturned: string;
  remarks: string;
}

interface VendorDeptOrder {
  id?: string;
  orderPlaceDate: string;
  materialPurchasePoNo: string;
  oaNo: string;
  batchNo: string;
  vendorBatchNo: string;
  dcNo: string;
  vendorName: string;
  items: VendorDeptItem[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const INDENT_STATUS_OPTIONS = ['Open', 'Closed', 'Partial'];

const BLANK_ITEM: VendorDeptItem = {
  itemName: '', itemCode: '', materialIssueNo: '', qty: 0, plannedQty: 0,
  closingStock: '', indentStatus: '', receivedQty: 0, okQty: 0,
  reworkQty: 0, rejectedQty: 0, grnNo: '', debitNoteOrQtyReturned: '', remarks: '',
};

const BLANK_ORDER: VendorDeptOrder = {
  orderPlaceDate: '', materialPurchasePoNo: '', oaNo: '', batchNo: '',
  vendorBatchNo: '', dcNo: '', vendorName: '', items: [],
};

// ─── Style tokens ─────────────────────────────────────────────────────────────

const FONT_FAMILY = "'Segoe UI', system-ui, -apple-system, sans-serif";

const S = {
  primary: '#1a237e',
  primaryLight: '#e8eaf6',
  success: '#16a34a',
  successLight: '#dcfce7',
  warning: '#b45309',
  warningLight: '#fef3c7',
  danger: '#ef4444',
  dangerLight: '#fee2e2',
  muted: '#6b7280',
  border: '#e5e7eb',
  altRow: '#fafafa',
  font: FONT_FAMILY,

  card: {
    background: '#fff',
    borderRadius: 10,
    border: '1px solid #e5e7eb',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    padding: '20px 24px',
    marginBottom: 20,
  } as React.CSSProperties,

  btn: (variant: 'primary' | 'success' | 'danger' | 'muted' | 'warning') => ({
    padding: '7px 14px',
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    fontFamily: FONT_FAMILY,
    background:
      variant === 'primary' ? S.primary :
      variant === 'success' ? S.success :
      variant === 'danger'  ? S.danger  :
      variant === 'warning' ? S.warning :
      '#6b7280',
    color: '#fff',
  } as React.CSSProperties),

  input: {
    padding: '7px 10px',
    borderRadius: 6,
    border: '1px solid #e5e7eb',
    fontSize: 13,
    fontFamily: FONT_FAMILY,
    outline: 'none',
    background: '#fff',
  } as React.CSSProperties,

  readonlyInput: {
    padding: '7px 10px',
    borderRadius: 6,
    border: '1px solid #e5e7eb',
    fontSize: 13,
    fontFamily: FONT_FAMILY,
    background: '#f9fafb',
    color: '#6b7280',
  } as React.CSSProperties,

  label: {
    fontSize: 11,
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    marginBottom: 3,
    display: 'block',
  },
};

// ─── Toast ────────────────────────────────────────────────────────────────────

interface Toast { id: number; msg: string; type: 'success' | 'error' | 'info' }
let toastId = 0;

const useToast = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = useCallback((msg: string, type: Toast['type'] = 'info') => {
    const id = ++toastId;
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }, []);
  return { toasts, show };
};

const ToastContainer: React.FC<{ toasts: Toast[] }> = ({ toasts }) => (
  <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
    {toasts.map(t => (
      <div key={t.id} style={{
        padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
        background: t.type === 'success' ? S.successLight : t.type === 'error' ? S.dangerLight : S.primaryLight,
        color: t.type === 'success' ? S.success : t.type === 'error' ? S.danger : S.primary,
        border: `1px solid ${t.type === 'success' ? '#bbf7d0' : t.type === 'error' ? '#fecaca' : '#c7d2fe'}`,
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
        maxWidth: 340, animation: 'fadeIn 0.2s ease',
      }}>
        {t.msg}
      </div>
    ))}
  </div>
);

// ─── Sub-components ───────────────────────────────────────────────────────────

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 120 }}>
    <span style={S.label}>{label}</span>
    {children}
  </div>
);

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const bg = status === 'CLOSED' ? S.successLight : status === 'PARTIAL' ? S.warningLight : S.primaryLight;
  const color = status === 'CLOSED' ? S.success : status === 'PARTIAL' ? S.warning : S.primary;
  return (
    <span style={{
      background: bg, color, padding: '3px 10px',
      borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
    }}>
      {status || '—'}
    </span>
  );
};

const StockBadge: React.FC<{ val: number | string }> = ({ val }) => {
  const n = Number(val);
  const isNeg = n < 0;
  return (
    <span style={{
      background: isNeg ? S.dangerLight : S.successLight,
      color: isNeg ? S.danger : S.success,
      padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
    }}>
      {isNeg ? n : n > 0 ? `+${n}` : '0'}
    </span>
  );
};

// ─── Pure helpers (no closures over component state) ─────────────────────────

const norm = (v: any) => (v == null ? '' : String(v).trim().toUpperCase());
const alpha = (v: any) => norm(v).replace(/[^A-Z0-9]/g, '');

const getNumericField = (obj: any, keys: string[]): number | null => {
  for (const k of keys) {
    if (obj?.[k] != null) {
      const n = Number(String(obj[k]).trim());
      if (!isNaN(n)) return n;
    }
  }
  return null;
};

const findNumericField = (obj: any, keys: string[]): { key: string; value: number } | null => {
  for (const k of keys) {
    if (obj?.[k] != null) {
      const n = Number(String(obj[k]).trim());
      if (!isNaN(n)) return { key: k, value: n };
    }
  }
  return null;
};

const CLOSING_KEYS = ['closingStock','closing_stock','ClosingStock','closing','closingQty',
  'closing_qty','Closing','closing stock','Closing Stock','closingstock',
  'closingStockQty','closing_stock_qty','ClosingStockQty','closingstockqty'];
const STOCK_QTY_KEYS = ['stockQty','stock_qty','stock','StockQty','currentStock'];
const PURCHASE_QTY_IN_STORE_KEYS = ['purchaseActualQtyInStore','purchase_actual_qty_in_store',
  'purchaseActualQty','purchase_actual_qty'];

const chooseBestStock = (candidates: any[]): any | null => {
  if (!candidates?.length) return null;
  let best: any = null, bestVal = Number.NEGATIVE_INFINITY;
  for (const s of candidates) {
    const c = findNumericField(s, CLOSING_KEYS);
    const closing = c ? c.value : null;
    const stockQty = getNumericField(s, STOCK_QTY_KEYS) || 0;
    const pQty = getNumericField(s, PURCHASE_QTY_IN_STORE_KEYS) || 0;
    const computed = closing !== null ? closing : stockQty + pQty;
    if (best === null || computed > bestVal || (computed === bestVal && (s.id || 0) > (best.id || 0))) {
      best = s; bestVal = computed;
    }
  }
  return best;
};

const matchStock = (stocks: any[], itemCode?: string, itemName?: string): any | null => {
  if (!itemCode && !itemName) return null;
  const lookup = [itemCode, itemName].filter(Boolean).join(' ');
  const t = norm(lookup), ta = alpha(lookup);
  const cNorm = norm(itemCode || ''), nNorm = norm(itemName || '');

  const tryMatch = (fn: (s: any) => boolean) => {
    const m = stocks.filter(fn);
    return m.length ? chooseBestStock(m) : null;
  };

  return (
    (cNorm && tryMatch(s => norm(s.itemCode || s.ItemCode || s.code || s.Code || s.item_code) === cNorm)) ||
    (nNorm && tryMatch(s => norm(s.itemName || s.ItemName || s.name || s.Name) === nNorm)) ||
    tryMatch(s => [s.itemCode, s.ItemCode, s.code, s.Code, s.item_code,
      s.itemName, s.ItemName, s.name, s.Name, s.sku, s.SKU].some(c => alpha(c) === ta || norm(c) === t)) ||
    tryMatch(s => Object.values(s).some((v: any) => {
      try { const a2 = alpha(v), n2 = norm(v); return a2.includes(ta) || ta.includes(a2) || n2.includes(t) || t.includes(n2); }
      catch { return false; }
    })) ||
    null
  );
};

const computeClosingStock = (stockRecord: any): number | string => {
  if (!stockRecord) return '';
  const c = findNumericField(stockRecord, CLOSING_KEYS);
  if (c) return c.value;
  const sq = getNumericField(stockRecord, STOCK_QTY_KEYS) || 0;
  const pq = getNumericField(stockRecord, PURCHASE_QTY_IN_STORE_KEYS) || 0;
  return sq + pq;
};

const getPurchaseQty = (
  poNo: string | undefined,
  itemCode: string | undefined,
  purchaseOrders: any[],
  purchaseData: any[],
): number => {
  try {
    if (!poNo || !itemCode) return 0;
    const tPo = norm(poNo), tCode = norm(itemCode);

    const searchPO = (arr: any[]) => {
      const po = arr.find((p: any) => norm(p.poNo) === tPo);
      if (!po) return null;
      if (Array.isArray(po.items)) {
        const m = po.items.find((it: any) => norm(it.itemCode || it.Code) === tCode);
        if (m) return Number(m.poQty ?? m.originalIndentQty ?? m.qty ?? m.purchaseQty ?? 0);
      } else if (norm(po.itemCode || po.Code) === tCode) {
        return Number(po.purchaseQty ?? po.qty ?? po.originalIndentQty ?? 0);
      }
      return null;
    };

    const searchFlat = (arr: any[]) => {
      const m = arr.find((it: any) =>
        (norm(it.poNo) === tPo || norm(it.indentNo) === tPo) && norm(it.itemCode || it.Code) === tCode,
      );
      return m ? Number(m.poQty ?? m.originalIndentQty ?? m.qty ?? m.purchaseQty ?? 0) : null;
    };

    return searchPO(purchaseOrders) ?? searchFlat(purchaseData) ?? 0;
  } catch {
    return 0;
  }
};

const getIndentStatusFromPurchase = (
  poNo: any, itemCode: any, indentNo: any,
  purchaseData: any[], purchaseOrders: any[],
): string => {
  try {
    const tPo = norm(poNo), tCode = norm(itemCode), tIndent = norm(indentNo);

    const fromFlat = purchaseData?.find((it: any) =>
      (norm(it.poNo) === tPo || norm(it.indentNo) === tIndent) && norm(it.itemCode || it.Code) === tCode,
    );
    if (fromFlat?.indentStatus) return String(fromFlat.indentStatus);

    const po = purchaseOrders?.find((p: any) => norm(p.poNo) === tPo || norm(p.poNo || p.indentNo) === tPo);
    if (po) {
      if (Array.isArray(po.items)) {
        const m = po.items.find((it: any) => norm(it.itemCode || it.Code) === tCode);
        if (m?.indentStatus) return String(m.indentStatus);
      } else if (po.itemCode && norm(po.itemCode) === tCode && po.indentStatus) {
        return String(po.indentStatus);
      }
    }
  } catch { /**/ }
  return '';
};

const getSupplierNameFromPO = (poNo: any, purchaseOrders: any[], purchaseData: any[]): string => {
  if (!poNo) return '';
  const t = norm(poNo);
  const po = purchaseOrders?.find((p: any) => norm(p.poNo) === t);
  if (po?.supplierName) return String(po.supplierName).trim();
  const pd = purchaseData?.find((p: any) => norm(p.poNo) === t);
  if (pd?.supplierName) return String(pd.supplierName).trim();
  return '';
};

const getVendorBatchNoFromVSIR = (poNo: any, vsirRecords: any[]): string => {
  if (!poNo || !vsirRecords?.length) return '';
  const t = String(poNo).trim();
  const m = vsirRecords.find((r: any) => String(r.poNo || '').trim() === t && r.vendorBatchNo?.trim());
  return m?.vendorBatchNo || '';
};

const getPSIRDataByPO = (poNo: string | undefined, psirData: any[]): any => {
  if (!poNo || !psirData?.length) return null;
  return psirData.find((r: any) => String(r.poNo || '').trim() === String(poNo).trim()) || null;
};

// ─── CSV Export ───────────────────────────────────────────────────────────────

const exportCSV = (rows: Array<VendorDeptOrder & { _item: VendorDeptItem; _poQty: number; _stock: number | string; _status: string }>) => {
  const headers = ['#','PO No','OA No','Vendor','Order Date','Batch No','Vendor Batch No','DC No',
    'Item Name','Item Code','Material Issue No','PO Qty','Planned Qty','Received Qty',
    'OK Qty','Rework Qty','Rejected Qty','GRN No','Closing Stock','Indent Status','Remarks'];
  const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [headers.map(escape).join(',')];
  rows.forEach((r, i) => {
    lines.push([
      i + 1, r.materialPurchasePoNo, r.oaNo, r.vendorName, r.orderPlaceDate,
      r.batchNo, r.vendorBatchNo, r.dcNo,
      r._item.itemName, r._item.itemCode, r._item.materialIssueNo,
      r._poQty, r._item.plannedQty ?? '', r._item.receivedQty,
      r._item.okQty, r._item.reworkQty, r._item.rejectedQty,
      r._item.grnNo, r._stock, r._status, r._item.remarks,
    ].map(escape).join(','));
  });
  const bom = '\uFEFF';
  const blob = new Blob([bom + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vendor-dept-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

// ─── Main Component ───────────────────────────────────────────────────────────

const VendorDeptModule: React.FC = () => {
  const { toasts, show: toast } = useToast();

  const [userUid, setUserUid] = useState<string | null>(null);
  const [orders, setOrders] = useState<VendorDeptOrder[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [purchaseData, setPurchaseData] = useState<any[]>([]);
  const [vsirRecords, setVsirRecords] = useState<any[]>([]);
  const [psirData, setPsirData] = useState<any[]>([]);
  const [stockRecords, setStockRecords] = useState<any[]>([]);
  const [purchasePOs, setPurchasePOs] = useState<string[]>([]);

  const [newOrder, setNewOrder] = useState<VendorDeptOrder>({ ...BLANK_ORDER });
  const [itemInput, setItemInput] = useState<VendorDeptItem>({ ...BLANK_ITEM });
  const [editOrderIdx, setEditOrderIdx] = useState<number | null>(null);
  const [editItemIdx, setEditItemIdx] = useState<number | null>(null);

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  const editPanelRef = useRef<HTMLDivElement>(null);

  // ── Auth ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setUserUid(u?.uid ?? null));
    return unsub;
  }, []);

  // ── Firestore subscriptions ───────────────────────────────────────────────

  useEffect(() => {
    if (!userUid) return;
    return subscribeVendorDepts(userUid, docs => setOrders(docs));
  }, [userUid]);

  useEffect(() => {
    if (!userUid) return;
    return subscribeVSIRRecords(userUid, docs => setVsirRecords(docs));
  }, [userUid]);

  useEffect(() => {
    if (!userUid) return;
    return subscribePsirs(userUid, docs => setPsirData(docs));
  }, [userUid]);

  // ── Load purchase data ────────────────────────────────────────────────────

  useEffect(() => {
    if (!userUid) return;
    Promise.all([getPurchaseOrders(userUid), getPurchaseData(userUid)])
      .then(([po, pd]) => {
        if (Array.isArray(po)) setPurchaseOrders(po);
        if (Array.isArray(pd)) setPurchaseData(pd);
      })
      .catch(() => { /* silent */ });
  }, [userUid]);

  // ── Load stock records from localStorage ─────────────────────────────────

  const reloadStock = useCallback(() => {
    try {
      const raw = localStorage.getItem('stock-records');
      if (raw) setStockRecords(JSON.parse(raw));
    } catch { /**/ }
  }, []);

  useEffect(() => {
    reloadStock();
    const storageHandler = (e: StorageEvent) => { if (e.key === 'stock-records') reloadStock(); };
    const busHandler = () => reloadStock();
    window.addEventListener('storage', storageHandler);
    bus.addEventListener('stock.updated', busHandler as EventListener);
    return () => {
      window.removeEventListener('storage', storageHandler);
      bus.removeEventListener('stock.updated', busHandler as EventListener);
    };
  }, [reloadStock]);

  // ── Derive PO list ────────────────────────────────────────────────────────

  useEffect(() => {
    const src = purchaseOrders.length > 0 ? purchaseOrders : purchaseData;
    const list = [...new Set(src.map((o: any) => o.poNo).filter(Boolean))] as string[];
    setPurchasePOs(list);
    if (list.length > 0 && !newOrder.materialPurchasePoNo) {
      setNewOrder(prev => ({ ...prev, materialPurchasePoNo: list[list.length - 1] }));
    }
  }, [purchaseOrders, purchaseData]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync vendorBatchNo from VSIR ──────────────────────────────────────────

  useEffect(() => {
    if (!vsirRecords.length) return;
    setOrders(prev => prev.map(o => {
      if (!o.vendorBatchNo?.trim()) {
        const vbn = getVendorBatchNoFromVSIR(o.materialPurchasePoNo, vsirRecords);
        return vbn ? { ...o, vendorBatchNo: vbn } : o;
      }
      return o;
    }));
  }, [vsirRecords]);

  // ── Sync VSIR quantities to existing orders ───────────────────────────────

  useEffect(() => {
    if (!orders.length || !vsirRecords.length) return;
    let changed = false;
    const updated = orders.map(order => {
      const items = order.items.map(item => {
        const v = vsirRecords.find(r =>
          norm(r.poNo) === norm(order.materialPurchasePoNo) &&
          norm(r.itemCode) === norm(item.itemCode),
        );
        if (!v) return item;
        const newR = v.qtyReceived || 0, newO = v.okQty || 0;
        const newRw = v.reworkQty || 0, newRj = v.rejectQty || 0;
        const newG = v.grnNo || '';
        if (newR !== item.receivedQty || newO !== item.okQty || newRw !== item.reworkQty
          || newRj !== item.rejectedQty || newG !== item.grnNo) {
          changed = true;
          return { ...item, receivedQty: newR, okQty: newO, reworkQty: newRw, rejectedQty: newRj, grnNo: newG };
        }
        return item;
      });
      return { ...order, items };
    });
    if (changed) {
      setOrders(updated);
      bus.dispatchEvent(new CustomEvent('vendorDept.updated', { detail: { source: 'vsir-sync' } }));
    }
  }, [vsirRecords]); // orders intentionally excluded to avoid loop

  // ── Backfill batchNo from PSIR ────────────────────────────────────────────

  useEffect(() => {
    if (!psirData.length || !orders.length) return;
    setOrders(prev => prev.map(o => {
      if (o.batchNo?.trim()) return o;
      const p = psirData.find((r: any) => r.poNo === o.materialPurchasePoNo);
      return (p?.batchNo) ? { ...o, batchNo: p.batchNo } : o;
    }));
  }, [psirData]); // orders intentionally excluded

  // ── Auto-import from purchaseOrders (new POs only) ────────────────────────

  useEffect(() => {
    if (!userUid || !purchaseOrders.length) return;
    const existingPOs = new Set(orders.map(o => norm(o.materialPurchasePoNo)));

    const grouped: Record<string, any[]> = {};
    purchaseOrders.forEach((e: any) => {
      if (!e.poNo) return;
      const k = norm(e.poNo);
      (grouped[k] = grouped[k] || []).push(e);
    });

    Object.entries(grouped).forEach(([normPo, group]) => {
      if (existingPOs.has(normPo)) return;
      const first = group[0];
      const psirRec = psirData.find((p: any) => norm(p.poNo) === normPo);
      const vsirRec = vsirRecords.find((v: any) => norm(v.poNo) === normPo);
      const orderToSave: VendorDeptOrder = {
        orderPlaceDate: first.orderPlaceDate || '',
        materialPurchasePoNo: first.poNo,
        oaNo: first.oaNo || '',
        batchNo: psirRec?.batchNo || '',
        vendorBatchNo: vsirRec?.vendorBatchNo || '',
        dcNo: '',
        vendorName: '',
        items: group.map((item: any) => ({
          itemName: item.itemName || item.model || '',
          itemCode: item.itemCode || '',
          materialIssueNo: '',
          qty: item.qty || 0,
          indentStatus: (item.indentStatus || '').toUpperCase(),
          receivedQty: 0, okQty: item.okQty || 0,
          reworkQty: item.reworkQty || 0, rejectedQty: item.rejectedQty || 0,
          grnNo: item.grnNo || '', debitNoteOrQtyReturned: item.debitNoteOrQtyReturned || '',
          remarks: item.remarks || '',
        })),
      };
      addVendorDept(userUid, orderToSave).catch(() => { /* silent */ });
    });
  }, [purchaseOrders, userUid]); // psirData/vsirRecords/orders intentionally excluded

  // ── Auto-fill form when PO changes ───────────────────────────────────────

  useEffect(() => {
    const poNo = newOrder.materialPurchasePoNo;
    if (!poNo) return;

    const existing = orders.find(o => o.materialPurchasePoNo === poNo);
    const psirRec = getPSIRDataByPO(poNo, psirData);
    const vbn = getVendorBatchNoFromVSIR(poNo, vsirRecords);
    const supplier = !newOrder.vendorName && editOrderIdx === null
      ? getSupplierNameFromPO(poNo, purchaseOrders, purchaseData)
      : newOrder.vendorName;

    setNewOrder(prev => ({
      ...prev,
      orderPlaceDate: existing?.orderPlaceDate || psirRec?.receivedDate || prev.orderPlaceDate,
      oaNo: existing?.oaNo || psirRec?.oaNo || prev.oaNo,
      batchNo: existing?.batchNo || psirRec?.batchNo || prev.batchNo,
      vendorBatchNo: vbn || existing?.vendorBatchNo || prev.vendorBatchNo,
      vendorName: supplier || prev.vendorName,
    }));
  }, [newOrder.materialPurchasePoNo, vsirRecords, psirData]); // others intentionally excluded

  // ── Auto-fill item quantities from VSIR ──────────────────────────────────

  useEffect(() => {
    if (!newOrder.materialPurchasePoNo || !itemInput.itemCode) return;
    const v = vsirRecords.find(r =>
      norm(r.poNo) === norm(newOrder.materialPurchasePoNo) &&
      norm(r.itemCode) === norm(itemInput.itemCode),
    );
    if (!v) return;
    setItemInput(prev => ({
      ...prev,
      receivedQty: v.qtyReceived || 0,
      okQty: v.okQty || v.qtyReceived || 0,
      reworkQty: v.reworkQty || 0,
      rejectedQty: v.rejectQty || 0,
      grnNo: v.grnNo || '',
    }));
  }, [newOrder.materialPurchasePoNo, itemInput.itemCode, vsirRecords]);

  // ── Auto-fill item qty from purchase ─────────────────────────────────────

  useEffect(() => {
    if (!newOrder.materialPurchasePoNo || !itemInput.itemCode) return;
    const q = getPurchaseQty(newOrder.materialPurchasePoNo, itemInput.itemCode, purchaseOrders, purchaseData);
    setItemInput(prev => ({ ...prev, qty: q }));
  }, [newOrder.materialPurchasePoNo, itemInput.itemCode, purchaseOrders, purchaseData]);

  // ── Auto-fill item from PSIR ──────────────────────────────────────────────

  useEffect(() => {
    if (!newOrder.materialPurchasePoNo || !itemInput.itemCode) return;
    for (const psir of psirData) {
      if (psir.poNo !== newOrder.materialPurchasePoNo || !Array.isArray(psir.items)) continue;
      const m = psir.items.find((it: any) => it.itemCode === itemInput.itemCode);
      if (!m) continue;
      const status = getIndentStatusFromPurchase(
        newOrder.materialPurchasePoNo, m.itemCode, m.indentNo || psir.indentNo || '',
        purchaseData, purchaseOrders,
      );
      setItemInput(prev => ({
        ...prev,
        indentStatus: status ? (status.toUpperCase ? status.toUpperCase() : status) : prev.indentStatus,
        okQty: m.okQty || prev.okQty,
        rejectedQty: m.rejectQty || prev.rejectedQty,
        grnNo: m.grnNo || psir.grnNo || prev.grnNo,
      }));
      break;
    }
  }, [newOrder.materialPurchasePoNo, itemInput.itemCode]); // others intentionally excluded

  // ── Listen for event bus updates ──────────────────────────────────────────

  useEffect(() => {
    const onVSIR = () => setVsirRecords(prev => [...prev]); // trigger re-eval
    bus.addEventListener('vsir.updated', onVSIR as EventListener);
    bus.addEventListener('vsir.records.synced', onVSIR as EventListener);
    return () => {
      bus.removeEventListener('vsir.updated', onVSIR as EventListener);
      bus.removeEventListener('vsir.records.synced', onVSIR as EventListener);
    };
  }, []);

  // ── Memoized derived data ─────────────────────────────────────────────────

  // stockMap: itemCode (or itemName) → computed closing stock
  const stockMap = useMemo(() => {
    const map = new Map<string, number | string>();
    orders.forEach(o => o.items.forEach(it => {
      const key = `${it.itemCode}::${it.itemName}`;
      if (!map.has(key)) {
        const rec = matchStock(stockRecords, it.itemCode, it.itemName);
        map.set(key, computeClosingStock(rec));
      }
    }));
    return map;
  }, [stockRecords, orders]);

  const getClosingStock = useCallback((itemCode?: string, itemName?: string): number | string => {
    const key = `${itemCode}::${itemName}`;
    if (stockMap.has(key)) return stockMap.get(key)!;
    const rec = matchStock(stockRecords, itemCode, itemName);
    return computeClosingStock(rec);
  }, [stockMap, stockRecords]);

  // indentStatusMap: `${poNo}::${itemCode}::${materialIssueNo}` → status string
  const indentStatusMap = useMemo(() => {
    const map = new Map<string, string>();
    orders.forEach(o => o.items.forEach(it => {
      const key = `${o.materialPurchasePoNo}::${it.itemCode}::${it.materialIssueNo}`;
      if (!map.has(key)) {
        const s = getIndentStatusFromPurchase(o.materialPurchasePoNo, it.itemCode, it.materialIssueNo, purchaseData, purchaseOrders);
        map.set(key, (s || it.indentStatus || '').toUpperCase());
      }
    }));
    return map;
  }, [orders, purchaseData, purchaseOrders]);

  // poQtyMap: `${poNo}::${itemCode}` → qty
  const poQtyMap = useMemo(() => {
    const map = new Map<string, number>();
    orders.forEach(o => o.items.forEach(it => {
      const key = `${o.materialPurchasePoNo}::${it.itemCode}`;
      if (!map.has(key)) {
        map.set(key, Math.abs(getPurchaseQty(o.materialPurchasePoNo, it.itemCode, purchaseOrders, purchaseData)));
      }
    }));
    return map;
  }, [orders, purchaseOrders, purchaseData]);

  // ── Flat rows for table/filter ────────────────────────────────────────────

  type FlatRow = VendorDeptOrder & {
    _orderIdx: number;
    _item: VendorDeptItem;
    _itemIdx: number;
    _poQty: number;
    _stock: number | string;
    _status: string;
  };

  const flatRows = useMemo((): FlatRow[] => {
    const rows: FlatRow[] = [];
    orders.forEach((o, oi) => {
      if (!o.items.length) {
        rows.push({ ...o, _orderIdx: oi, _item: { ...BLANK_ITEM }, _itemIdx: -1, _poQty: 0, _stock: '', _status: '' });
      } else {
        o.items.forEach((it, ii) => {
          rows.push({
            ...o,
            _orderIdx: oi,
            _item: it,
            _itemIdx: ii,
            _poQty: poQtyMap.get(`${o.materialPurchasePoNo}::${it.itemCode}`) ?? 0,
            _stock: stockMap.get(`${it.itemCode}::${it.itemName}`) ?? getClosingStock(it.itemCode, it.itemName),
            _status: indentStatusMap.get(`${o.materialPurchasePoNo}::${it.itemCode}::${it.materialIssueNo}`) ?? '',
          });
        });
      }
    });
    return rows;
  }, [orders, poQtyMap, stockMap, indentStatusMap, getClosingStock]);

  // ── Filter logic ──────────────────────────────────────────────────────────

  const filteredRows = useMemo(() => {
    let rows = flatRows;
    if (searchText.trim()) {
      const t = searchText.trim().toUpperCase();
      rows = rows.filter(r =>
        norm(r.materialPurchasePoNo).includes(t) || norm(r.vendorName).includes(t) ||
        norm(r._item.itemName).includes(t) || norm(r._item.itemCode).includes(t) ||
        norm(r.oaNo).includes(t) || norm(r._item.grnNo).includes(t),
      );
    }
    if (filterStatus) {
      rows = rows.filter(r => r._status === filterStatus.toUpperCase());
    }
    if (filterFrom) rows = rows.filter(r => r.orderPlaceDate >= filterFrom);
    if (filterTo)   rows = rows.filter(r => r.orderPlaceDate <= filterTo);
    return rows;
  }, [flatRows, searchText, filterStatus, filterFrom, filterTo]);

  const activeFilterCount = [searchText, filterStatus, filterFrom, filterTo].filter(Boolean).length;

  // ── Stats ─────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total = orders.length;
    const totalItems = orders.reduce((s, o) => s + o.items.length, 0);
    const totalReceived = flatRows.reduce((s, r) => s + (r._item.receivedQty || 0), 0);
    const totalRejected = flatRows.reduce((s, r) => s + (r._item.rejectedQty || 0), 0);
    return { total, totalItems, totalReceived, totalRejected };
  }, [orders, flatRows]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const clearForm = useCallback(() => {
    setNewOrder({ ...BLANK_ORDER });
    setItemInput({ ...BLANK_ITEM });
    setEditOrderIdx(null);
    setEditItemIdx(null);
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleAddItem = useCallback(() => {
    if (!itemInput.itemName || !itemInput.itemCode || !itemInput.materialIssueNo || itemInput.qty <= 0) return;
    const enriched = { ...itemInput, plannedQty: itemInput.qty, closingStock: getClosingStock(itemInput.itemCode, itemInput.itemName) };
    setNewOrder(prev => ({ ...prev, items: [...prev.items, enriched] }));
    setItemInput({ ...BLANK_ITEM });
  }, [itemInput, getClosingStock]);

  const handleSaveItem = useCallback(() => {
    if (editItemIdx !== null) {
      setNewOrder(prev => ({
        ...prev,
        items: prev.items.map((it, i) => i === editItemIdx
          ? { ...itemInput, plannedQty: itemInput.qty, closingStock: getClosingStock(itemInput.itemCode, itemInput.itemName) }
          : it,
        ),
      }));
      setEditItemIdx(null);
      setItemInput({ ...BLANK_ITEM });
    } else {
      handleAddItem();
    }
  }, [editItemIdx, itemInput, getClosingStock, handleAddItem]);

  const handleAddOrder = useCallback(async () => {
    if (!newOrder.orderPlaceDate || !newOrder.materialPurchasePoNo || !newOrder.vendorName || !newOrder.items.length || !newOrder.dcNo) {
      toast('Please fill all required fields (Date, PO No, Vendor, DC No, and at least one item)', 'error');
      return;
    }
    if (!newOrder.oaNo) { toast('OA NO not populated. Select the PO No again.', 'error'); return; }
    if (!newOrder.batchNo) { toast('Batch No not populated. Select the PO No again.', 'error'); return; }

    const vbn = newOrder.vendorBatchNo || getVendorBatchNoFromVSIR(newOrder.materialPurchasePoNo, vsirRecords);
    const orderToSave = { ...newOrder, vendorBatchNo: vbn };

    if (!userUid) { toast('User not authenticated', 'error'); return; }
    try {
      await addVendorDept(userUid, orderToSave);
      bus.dispatchEvent(new CustomEvent('vendorDept.updated', { detail: { vendorDeptData: [orderToSave] } }));
      toast('Order saved successfully', 'success');
      clearForm();
    } catch {
      toast('Error saving order. Please try again.', 'error');
    }
  }, [newOrder, vsirRecords, userUid, clearForm, toast]);

  const handleUpdateOrder = useCallback(async () => {
    if (editOrderIdx === null || !userUid || !orders[editOrderIdx]?.id) {
      toast('Cannot update: missing order ID or user.', 'error');
      return;
    }
    const docId = orders[editOrderIdx].id!;
    const { id, ...updateData } = newOrder;
    try {
      await updateVendorDept(userUid, docId, updateData);
      bus.dispatchEvent(new CustomEvent('vendorDept.updated', { detail: {} }));
      toast('Order updated successfully', 'success');
      clearForm();
    } catch {
      toast('Error updating order. Please try again.', 'error');
    }
  }, [editOrderIdx, userUid, orders, newOrder, clearForm, toast]);

  const handleDeleteOrder = useCallback(async (idx: number) => {
    if (!userUid || !orders[idx]?.id) { toast('Cannot delete: missing data.', 'error'); return; }
    if (!window.confirm('Delete this order?')) return;
    try {
      await deleteVendorDept(userUid, orders[idx].id!);
      toast('Order deleted', 'success');
    } catch {
      toast('Error deleting order.', 'error');
    }
  }, [userUid, orders, toast]);

  const handleDeleteItem = useCallback(async (orderIdx: number, itemIdx: number) => {
    if (!userUid || !orders[orderIdx]?.id) { toast('Cannot delete: missing data.', 'error'); return; }
    if (!window.confirm('Delete this item?')) return;
    const docId = orders[orderIdx].id!;
    const updatedOrder = { ...orders[orderIdx], items: orders[orderIdx].items.filter((_, i) => i !== itemIdx) };
    try {
      if (!updatedOrder.items.length) {
        await deleteVendorDept(userUid, docId);
      } else {
        const { id, ...data } = updatedOrder;
        await updateVendorDept(userUid, docId, data);
      }
      toast('Item deleted', 'success');
    } catch {
      toast('Error deleting item.', 'error');
    }
  }, [userUid, orders, toast]);

  const handleEditOrder = useCallback((idx: number) => {
    const o = JSON.parse(JSON.stringify(orders[idx]));
    if (!o.vendorBatchNo?.trim()) {
      const vbn = getVendorBatchNoFromVSIR(o.materialPurchasePoNo, vsirRecords);
      if (vbn) o.vendorBatchNo = vbn;
    }
    setNewOrder(o);
    setItemInput({ ...BLANK_ITEM });
    setEditOrderIdx(idx);
    setEditItemIdx(null);
    setTimeout(() => editPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }, [orders, vsirRecords]);

  const handleManualSync = useCallback(() => {
    if (!orders.length) return;
    let changed = false;
    const updated = orders.map(o => ({
      ...o,
      items: o.items.map(it => {
        const q = getPurchaseQty(o.materialPurchasePoNo, it.itemCode, purchaseOrders, purchaseData);
        if (q > 0 && it.qty === 0) { changed = true; return { ...it, qty: q }; }
        return it;
      }),
    }));
    if (changed) setOrders(updated);
    toast(changed ? 'Sync complete — empty quantities filled' : 'All quantities already set', 'info');
  }, [orders, purchaseOrders, purchaseData, toast]);

  // ─── Render ─────────────────────────────────────────────────────────────

  const isEditing = editOrderIdx !== null;

  return (
    <div style={{ fontFamily: S.font, color: '#111827', padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        input:focus, select:focus { outline: none; border-color: ${S.primary} !important; box-shadow: 0 0 0 3px ${S.primaryLight}; }
        tr.stripe-alt { background: ${S.altRow}; }
        .td-ellipsis { max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .edit-panel-card { border: 2px solid ${S.primary} !important; }
      `}</style>
      <ToastContainer toasts={toasts} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: S.primary }}>Vendor Dept</h1>
          <span style={{ fontSize: 12, color: S.muted }}>Purchase order tracking &amp; vendor management</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={S.btn('muted')} onClick={handleManualSync}>↻ Sync</button>
          <button style={S.btn('success')} onClick={() => exportCSV(filteredRows as any)}>⬇ Export CSV</button>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{
        ...S.card, padding: '14px 24px', display: 'flex', gap: 0,
        marginBottom: 20, borderRadius: 10,
      }}>
        {[
          { label: 'Orders', value: stats.total },
          { label: 'Line Items', value: stats.totalItems },
          { label: 'Total Received', value: stats.totalReceived },
          { label: 'Total Rejected', value: stats.totalRejected, color: stats.totalRejected > 0 ? S.danger : undefined },
        ].map((s, i) => (
          <React.Fragment key={s.label}>
            {i > 0 && <div style={{ width: 1, background: S.border, margin: '0 24px' }} />}
            <div style={{ textAlign: 'center', minWidth: 80 }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: s.color || S.primary, lineHeight: 1.1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: S.muted, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
            </div>
          </React.Fragment>
        ))}
      </div>

      {/* Edit / Add panel */}
      <div ref={editPanelRef} style={{ ...S.card, ...(isEditing ? { borderColor: S.primary, borderWidth: 2 } : {}) }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: S.primary }}>
            {isEditing ? '✏️ Edit Order' : '+ New Order'}
          </h3>
          {isEditing && (
            <button style={S.btn('muted')} onClick={clearForm}>Cancel</button>
          )}
        </div>

        {/* PO selector */}
        <div style={{ marginBottom: 16 }}>
          <label style={S.label}>Material Purchase PO No</label>
          <select
            value={newOrder.materialPurchasePoNo}
            onChange={e => setNewOrder(prev => ({ ...prev, materialPurchasePoNo: e.target.value }))}
            style={{ ...S.input, minWidth: 200 }}
          >
            <option value="">Select PO No</option>
            {purchasePOs.map(po => <option key={po} value={po}>{po}</option>)}
          </select>
        </div>

        {/* Order-level fields */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 16 }}>
          <Field label="Order Place Date">
            <input style={S.readonlyInput} value={newOrder.orderPlaceDate} readOnly />
          </Field>
          <Field label="OA No">
            <input style={S.readonlyInput} value={newOrder.oaNo} readOnly />
          </Field>
          <Field label="Batch No">
            <input style={S.readonlyInput} value={newOrder.batchNo} readOnly />
          </Field>
          <Field label="Vendor Batch No">
            <input
              style={S.input}
              placeholder="Auto-filled from VSIR"
              value={newOrder.vendorBatchNo}
              onChange={e => setNewOrder(prev => ({ ...prev, vendorBatchNo: e.target.value }))}
            />
          </Field>
          <Field label="Vendor Name *">
            <input
              style={{ ...S.input, borderColor: S.primary, fontWeight: 600, minWidth: 200 }}
              placeholder="Enter vendor name"
              value={newOrder.vendorName}
              onChange={e => setNewOrder(prev => ({ ...prev, vendorName: e.target.value }))}
            />
          </Field>
          <Field label="DC No *">
            <input
              style={{ ...S.input, borderColor: S.primary, fontWeight: 600 }}
              placeholder="Enter DC No"
              value={newOrder.dcNo}
              onChange={e => setNewOrder(prev => ({ ...prev, dcNo: e.target.value }))}
            />
          </Field>
        </div>

        {/* Item entry */}
        <div style={{ background: '#f9fafb', borderRadius: 8, border: `1px solid ${S.border}`, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: S.muted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {editItemIdx !== null ? 'Edit Item' : 'Add Item'}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            <Field label="Item Name">
              <input style={{ ...S.input, minWidth: 160 }} value={itemInput.itemName}
                onChange={e => setItemInput(p => ({ ...p, itemName: e.target.value }))} />
            </Field>
            <Field label="Item Code">
              <input style={S.input} value={itemInput.itemCode}
                onChange={e => setItemInput(p => ({ ...p, itemCode: e.target.value }))} />
            </Field>
            <Field label="Material Issue No">
              <input style={S.input} value={itemInput.materialIssueNo}
                onChange={e => setItemInput(p => ({ ...p, materialIssueNo: e.target.value }))} />
            </Field>
            <Field label="Qty">
              <input type="number" min="0" style={{ ...S.input, width: 70 }} value={itemInput.qty || ''}
                onChange={e => setItemInput(p => ({ ...p, qty: Math.max(0, Number(e.target.value)) }))} />
            </Field>
            <Field label="Indent Status">
              <select style={{ ...S.input }} value={itemInput.indentStatus}
                onChange={e => setItemInput(p => ({ ...p, indentStatus: e.target.value }))}>
                <option value="">—</option>
                {INDENT_STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            {(['receivedQty', 'okQty', 'reworkQty', 'rejectedQty'] as const).map(k => (
              <Field key={k} label={k.replace(/Qty$/, ' Qty').replace(/([A-Z])/g, ' $1').trim()}>
                <input type="number" min="0" style={{ ...S.input, width: 80 }} value={itemInput[k] || ''}
                  onChange={e => setItemInput(p => ({ ...p, [k]: Math.max(0, Number(e.target.value)) }))} />
              </Field>
            ))}
            <Field label="GRN No">
              <input style={S.input} value={itemInput.grnNo}
                onChange={e => setItemInput(p => ({ ...p, grnNo: e.target.value }))} />
            </Field>
            <Field label="Debit Note / Qty Returned">
              <input style={{ ...S.input, minWidth: 150 }} value={itemInput.debitNoteOrQtyReturned}
                onChange={e => setItemInput(p => ({ ...p, debitNoteOrQtyReturned: e.target.value }))} />
            </Field>
            <Field label="Remarks">
              <input style={{ ...S.input, minWidth: 150 }} value={itemInput.remarks}
                onChange={e => setItemInput(p => ({ ...p, remarks: e.target.value }))} />
            </Field>
          </div>
          <button style={S.btn('primary')} onClick={handleSaveItem}>
            {editItemIdx !== null ? '✓ Update Item' : '+ Add Item'}
          </button>
          {editItemIdx !== null && (
            <button style={{ ...S.btn('muted'), marginLeft: 8 }}
              onClick={() => { setEditItemIdx(null); setItemInput({ ...BLANK_ITEM }); }}>
              Cancel
            </button>
          )}
        </div>

        {/* Items in current order */}
        {newOrder.items.length > 0 && (
          <div style={{ marginBottom: 16, overflowX: 'auto' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: S.muted, marginBottom: 8, textTransform: 'uppercase' }}>
              Items in this order ({newOrder.items.length})
            </div>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
              <colgroup>
                <col style={{ width: 140 }} /><col style={{ width: 90 }} />
                <col style={{ width: 90 }} /><col style={{ width: 55 }} />
                <col style={{ width: 70 }} /><col style={{ width: 55 }} />
                <col style={{ width: 55 }} /><col style={{ width: 60 }} />
                <col style={{ width: 65 }} /><col style={{ width: 70 }} />
              </colgroup>
              <thead>
                <tr style={{ background: S.primaryLight, color: S.primary }}>
                  {['Item Name','Code','Issue No','Qty','Status','Rcvd','OK','Rework','Rejected','Actions'].map(h => (
                    <th key={h} style={{ padding: '7px 8px', textAlign: h === 'Actions' || h === 'Qty' || h === 'Rcvd' || h === 'OK' || h === 'Rework' || h === 'Rejected' ? 'center' : 'left', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {newOrder.items.map((item, ii) => (
                  <tr key={ii} className={ii % 2 === 1 ? 'stripe-alt' : ''} style={{ borderBottom: `1px solid ${S.border}` }}>
                    <td className="td-ellipsis" style={{ padding: '6px 8px' }} title={item.itemName}>{item.itemName}</td>
                    <td style={{ padding: '6px 8px' }}>{item.itemCode}</td>
                    <td style={{ padding: '6px 8px' }}>{item.materialIssueNo}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{item.qty}</td>
                    <td style={{ padding: '6px 8px' }}><StatusBadge status={item.indentStatus?.toUpperCase?.()} /></td>
                    {(['receivedQty','okQty','reworkQty','rejectedQty'] as const).map(k => (
                      <td key={k} style={{ padding: '6px 8px', textAlign: 'right' }}>{item[k] || '—'}</td>
                    ))}
                    <td style={{ padding: '6px 8px', textAlign: 'center', display: 'flex', gap: 4 }}>
                      <button style={{ ...S.btn('warning'), padding: '3px 8px', fontSize: 11 }}
                        onClick={() => { setItemInput(item); setEditItemIdx(ii); }}>Edit</button>
                      <button style={{ ...S.btn('danger'), padding: '3px 8px', fontSize: 11 }}
                        onClick={() => setNewOrder(p => ({ ...p, items: p.items.filter((_, xi) => xi !== ii) }))}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <button style={S.btn('primary')} onClick={isEditing ? handleUpdateOrder : handleAddOrder}>
          {isEditing ? '✓ Save Changes' : '+ Add Order'}
        </button>
      </div>

      {/* Filter bar */}
      <div style={{ ...S.card, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            style={{ ...S.btn(activeFilterCount > 0 ? 'primary' : 'muted'), position: 'relative' }}
            onClick={() => setShowFilters(p => !p)}
          >
            ⚙ Filters
            {activeFilterCount > 0 && (
              <span style={{
                position: 'absolute', top: -6, right: -6,
                background: S.danger, color: '#fff', borderRadius: '50%',
                width: 16, height: 16, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
              }}>{activeFilterCount}</span>
            )}
          </button>

          {showFilters && (
            <>
              <Field label="Search">
                <input style={{ ...S.input, minWidth: 200 }} placeholder="PO, vendor, item…"
                  value={searchText} onChange={e => setSearchText(e.target.value)} />
              </Field>
              <Field label="Status">
                <select style={S.input} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                  <option value="">All</option>
                  {INDENT_STATUS_OPTIONS.map(o => <option key={o} value={o.toUpperCase()}>{o}</option>)}
                </select>
              </Field>
              <Field label="Date From">
                <input type="date" style={S.input} value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
              </Field>
              <Field label="Date To">
                <input type="date" style={S.input} value={filterTo} onChange={e => setFilterTo(e.target.value)} />
              </Field>
              {activeFilterCount > 0 && (
                <button style={{ ...S.btn('muted'), alignSelf: 'flex-end' }}
                  onClick={() => { setSearchText(''); setFilterStatus(''); setFilterFrom(''); setFilterTo(''); }}>
                  Clear
                </button>
              )}
            </>
          )}

          <span style={{ marginLeft: 'auto', fontSize: 12, color: S.muted }}>
            {filteredRows.length} of {flatRows.length} rows
          </span>
        </div>
      </div>

      {/* Orders table */}
      <div style={{ ...S.card, padding: 0, overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12, tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 36 }} />
            <col style={{ width: 120 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 100 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 65 }} />
            <col style={{ width: 65 }} />
            <col style={{ width: 60 }} />
            <col style={{ width: 55 }} />
            <col style={{ width: 60 }} />
            <col style={{ width: 65 }} />
            <col style={{ width: 80 }} />
            <col style={{ width: 60 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 80 }} />
          </colgroup>
          <thead>
            <tr style={{ background: S.primaryLight, borderBottom: `2px solid ${S.primary}` }}>
              {[
                { label: '#', right: true },
                { label: 'Item', left: true },
                { label: 'Code', left: true },
                { label: 'PO No', left: true },
                { label: 'OA No', left: true },
                { label: 'Vendor' },
                { label: 'PO Qty', right: true },
                { label: 'Planned', right: true, divider: true },
                { label: 'Rcvd', right: true },
                { label: 'OK', right: true },
                { label: 'Rework', right: true },
                { label: 'Rejected', right: true, divider: true },
                { label: 'GRN', left: true },
                { label: 'Stock', right: true },
                { label: 'Status', left: true },
                { label: 'Actions', right: true },
              ].map((h, i) => (
                <th key={i} style={{
                  padding: '10px 8px',
                  textAlign: h.right ? 'right' : 'left',
                  fontSize: 11, fontWeight: 700, color: S.primary,
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                  borderLeft: h.divider ? `2px solid #c7d2fe` : undefined,
                  whiteSpace: 'nowrap',
                }}>
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={16} style={{ padding: 32, textAlign: 'center', color: S.muted, fontSize: 13 }}>
                  No orders found{activeFilterCount > 0 ? ' matching filters' : ''}
                </td>
              </tr>
            )}
            {filteredRows.map((row, ri) => {
              const isEmpty = row._itemIdx === -1;
              const bgColor = ri % 2 === 0 ? '#fff' : S.altRow;
              return (
                <tr key={`${row._orderIdx}-${row._itemIdx}`}
                  style={{ borderBottom: `1px solid ${S.border}`, background: bgColor }}>
                  <td style={{ padding: '8px', textAlign: 'right', color: S.muted, fontWeight: 600 }}>{ri + 1}</td>

                  <td style={{ padding: '8px' }}>
                    <span className="td-ellipsis" style={{ display: 'block' }} title={row._item.itemName}>
                      {row._item.itemName || '—'}
                    </span>
                  </td>
                  <td style={{ padding: '8px', color: S.muted, fontFamily: 'monospace', fontSize: 11 }}>{row._item.itemCode || '—'}</td>
                  <td style={{ padding: '8px', fontWeight: 600 }}>{row.materialPurchasePoNo}</td>
                  <td style={{ padding: '8px' }}>{row.oaNo || '—'}</td>
                  <td style={{ padding: '8px' }}>
                    <span className="td-ellipsis" style={{ display: 'block' }} title={row.vendorName}>{row.vendorName || '—'}</span>
                  </td>

                  <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600 }}>{isEmpty ? '—' : row._poQty || '—'}</td>
                  <td style={{ padding: '8px', textAlign: 'right', borderLeft: `2px solid #e0e7ff` }}>{row._item.plannedQty ?? '—'}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{row._item.receivedQty || '—'}</td>
                  <td style={{ padding: '8px', textAlign: 'right', color: S.success, fontWeight: 600 }}>{row._item.okQty || '—'}</td>
                  <td style={{ padding: '8px', textAlign: 'right', color: S.warning }}>{row._item.reworkQty || '—'}</td>
                  <td style={{ padding: '8px', textAlign: 'right', color: S.danger, borderLeft: `2px solid #e0e7ff` }}>{row._item.rejectedQty || '—'}</td>

                  <td style={{ padding: '8px', fontFamily: 'monospace', fontSize: 11 }}>{row._item.grnNo || '—'}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>
                    {row._stock !== '' ? <StockBadge val={row._stock} /> : '—'}
                  </td>
                  <td style={{ padding: '8px' }}>
                    {row._status ? <StatusBadge status={row._status} /> : <span style={{ color: S.muted }}>—</span>}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <button style={{ ...S.btn('primary'), padding: '3px 8px', fontSize: 11 }}
                        onClick={() => handleEditOrder(row._orderIdx)}>Edit</button>
                      <button style={{ ...S.btn('danger'), padding: '3px 8px', fontSize: 11 }}
                        onClick={() => isEmpty
                          ? handleDeleteOrder(row._orderIdx)
                          : handleDeleteItem(row._orderIdx, row._itemIdx)}>×</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default VendorDeptModule;