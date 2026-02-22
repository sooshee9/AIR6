import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import bus from '../utils/eventBus';
import { subscribeFirestoreDocs, replaceFirestoreCollection } from '../utils/firestoreSync';
import { getItemMaster, subscribeStockRecords, subscribePurchaseOrders } from '../utils/firestoreServices';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';

// ─── Types ────────────────────────────────────────────────────────────────────
interface IndentItem {
  model: string;
  itemCode: string;
  qty: number;
  indentClosed: boolean;
}
interface Indent {
  indentNo: string;
  date: string;
  indentBy: string;
  oaNo: string;
  items: IndentItem[];
}
interface IndentModuleProps { user?: any; }

// ─── Design System ────────────────────────────────────────────────────────────
const S = {
  bg: '#F7F8FC',
  surface: '#FFFFFF',
  border: '#E4E8F0',
  borderStrong: '#CBD2E0',
  accent: '#3B5BDB',
  accentLight: '#EEF2FF',
  accentHover: '#2F4AC0',
  success: '#2F9E44',
  successLight: '#EBFBEE',
  danger: '#C92A2A',
  dangerLight: '#FFF5F5',
  warning: '#E67700',
  warningLight: '#FFF9DB',
  textPrimary: '#1A1F36',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  numericRight: 'right' as const,

  card: {
    background: '#FFFFFF',
    border: '1px solid #E4E8F0',
    borderRadius: 12,
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
  } as React.CSSProperties,

  input: {
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid #CBD2E0',
    fontSize: 14,
    color: '#1A1F36',
    background: '#fff',
    outline: 'none',
    transition: 'border-color 0.15s',
    fontFamily: 'inherit',
    lineHeight: '1.5',
  } as React.CSSProperties,

  inputDisabled: {
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid #E4E8F0',
    fontSize: 14,
    color: '#6B7280',
    background: '#F7F8FC',
    cursor: 'not-allowed',
  } as React.CSSProperties,

  btnPrimary: {
    background: '#3B5BDB',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '8px 16px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    transition: 'background 0.15s, transform 0.1s',
    fontFamily: 'inherit',
  } as React.CSSProperties,

  btnSuccess: {
    background: '#2F9E44',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '8px 16px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    transition: 'background 0.15s',
    fontFamily: 'inherit',
  } as React.CSSProperties,

  btnDanger: {
    background: 'transparent',
    color: '#C92A2A',
    border: '1px solid #FECACA',
    borderRadius: 6,
    padding: '4px 10px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.15s',
    fontFamily: 'inherit',
  } as React.CSSProperties,

  btnGhost: {
    background: 'transparent',
    color: '#6B7280',
    border: '1px solid #E4E8F0',
    borderRadius: 8,
    padding: '8px 14px',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    transition: 'background 0.15s, border-color 0.15s',
    fontFamily: 'inherit',
  } as React.CSSProperties,

  btnEdit: {
    background: '#EEF2FF',
    color: '#3B5BDB',
    border: '1px solid #C5D0FA',
    borderRadius: 6,
    padding: '4px 10px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.15s',
    fontFamily: 'inherit',
  } as React.CSSProperties,

  label: {
    fontSize: 12,
    fontWeight: 600,
    color: '#6B7280',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    marginBottom: 4,
    display: 'block',
  },

  th: {
    padding: '10px 12px',
    textAlign: 'left' as const,
    fontSize: 11,
    fontWeight: 700,
    color: '#6B7280',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    background: '#F7F8FC',
    borderBottom: '2px solid #E4E8F0',
    whiteSpace: 'nowrap' as const,
  },

  thRight: {
    padding: '10px 12px',
    textAlign: 'right' as const,
    fontSize: 11,
    fontWeight: 700,
    color: '#6B7280',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    background: '#F7F8FC',
    borderBottom: '2px solid #E4E8F0',
    whiteSpace: 'nowrap' as const,
  },

  td: {
    padding: '10px 12px',
    fontSize: 14,
    color: '#1A1F36',
    borderBottom: '1px solid #F1F3F9',
    whiteSpace: 'nowrap' as const,
  },

  tdClip: {
    padding: '10px 12px',
    fontSize: 14,
    color: '#1A1F36',
    borderBottom: '1px solid #F1F3F9',
    maxWidth: 200,
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
    whiteSpace: 'nowrap' as const,
  },

  tdRight: {
    padding: '10px 12px',
    fontSize: 14,
    color: '#1A1F36',
    borderBottom: '1px solid #F1F3F9',
    textAlign: 'right' as const,
    whiteSpace: 'nowrap' as const,
    fontVariantNumeric: 'tabular-nums',
  } as React.CSSProperties,
};

// ─── Toast ────────────────────────────────────────────────────────────────────
interface Toast { id: number; msg: string; type: 'success' | 'error' | 'info'; }
let toastCounter = 0;

function ToastContainer({ toasts }: { toasts: Toast[] }) {
  if (toasts.length === 0) return null;
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          padding: '12px 18px', borderRadius: 10, fontSize: 14, fontWeight: 500, color: '#fff',
          background: t.type === 'success' ? '#2F9E44' : t.type === 'error' ? '#C92A2A' : '#3B5BDB',
          boxShadow: '0 4px 16px rgba(0,0,0,0.18)', animation: 'slideUp 0.2s ease',
          maxWidth: 340, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'ℹ'} {t.msg}
        </div>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <span style={S.label}>{label}</span>
      {children}
    </div>
  );
}

function StatusBadge({ closed }: { closed: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 10px', borderRadius: 20,
      fontSize: 12, fontWeight: 700, letterSpacing: '0.03em',
      background: closed ? S.successLight : S.dangerLight,
      color: closed ? S.success : S.danger,
      border: `1px solid ${closed ? '#A9E6B8' : '#FECACA'}`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: closed ? S.success : S.danger }} />
      {closed ? 'CLOSED' : 'OPEN'}
    </span>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ ...S.card, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120, flex: 1 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: S.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      <span style={{ fontSize: 26, fontWeight: 800, color: color || S.textPrimary, lineHeight: 1.2 }}>{value}</span>
      {sub && <span style={{ fontSize: 12, color: S.textSecondary }}>{sub}</span>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
const IndentModule: React.FC<IndentModuleProps> = ({ user }) => {
  const [uid] = useState<string>(user?.uid || 'default-user');

  const [indents, setIndents] = useState<Indent[]>([]);
  const [itemMaster, setItemMaster] = useState<{ itemName: string; itemCode: string }[]>([]);
  const [stockRecords, setStockRecords] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const showToast = useCallback((msg: string, type: Toast['type'] = 'info') => {
    const id = ++toastCounter;
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const [showFilters, setShowFilters] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'OPEN' | 'CLOSED'>('ALL');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const activeFilterCount = [filterText, filterStatus !== 'ALL', filterDateFrom, filterDateTo].filter(Boolean).length;

  const [newIndent, setNewIndent] = useState<Indent>({ indentNo: '', date: '', indentBy: '', oaNo: '', items: [] });
  const [itemInput, setItemInput] = useState<IndentItem>({ model: '', itemCode: '', qty: 0, indentClosed: false });
  const [editIdx, setEditIdx] = useState<number | null>(null);

  const unsubRefs = useRef<Array<() => void>>([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        getItemMaster(u.uid)
          .then(items => setItemMaster((items || []) as any[]))
          .catch(() => setItemMaster([]));

        const unsubIndents = subscribeFirestoreDocs(u.uid, 'indentData', (docs) => {
          setIndents(docs.map(doc => ({
            indentNo: doc.indentNo,
            date: doc.date,
            indentBy: doc.indentBy,
            oaNo: doc.oaNo,
            items: Array.isArray(doc.items) ? doc.items : [],
          })));
        });

        const unsubStock = subscribeStockRecords(u.uid, (docs) => setStockRecords(docs || []));
        const unsubPO = subscribePurchaseOrders(u.uid, (docs) => setPurchaseOrders(docs || []));

        unsubRefs.current = [unsubIndents, unsubStock, unsubPO];
      } else {
        setItemMaster([]); setIndents([]); setStockRecords([]); setPurchaseOrders([]);
      }
    });

    return () => {
      try { unsub(); } catch {}
      unsubRefs.current.forEach(fn => { try { fn(); } catch {} });
    };
  }, []);

  // ─── Stock map (memoized) ──────────────────────────────────────────────────
  const stockMap = useMemo<Map<string, number>>(() => {
    const map = new Map<string, number>();
    const norm = (v: any) => String(v ?? '').trim().toUpperCase();
    const alpha = (v: any) => norm(v).replace(/[^A-Z0-9]/g, '');

    for (const s of stockRecords) {
      const candidates = [s.itemCode, s.ItemCode, s.code, s.Code, s.item_code, s.itemName, s.ItemName, s.name, s.Name, s.sku, s.SKU];
      const key = candidates.map(norm).find(c => c) || '';
      if (!key) continue;

      const closingKeys = ['closingStock','closing_stock','ClosingStock','closing','closingQty','closing_qty','Closing','closing stock','Closing Stock'];
      let val: number | null = null;
      for (const k of closingKeys) {
        if (s[k] != null && !isNaN(Number(s[k]))) { val = Number(s[k]); break; }
      }
      if (val === null) {
        const sq = Number(s.stockQty || s.stock_qty || s.stock || s.StockQty || s.currentStock || 0);
        const po = Number(s.purStoreOkQty || s.PurStoreOkQty || 0);
        const vo = Number(s.vendorOkQty || s.VendorOkQty || 0);
        const ih = Number(s.inHouseIssuedQty || s.InHouseIssuedQty || 0);
        val = sq + po + vo - ih;
      }
      map.set(key, val);
      const ak = alpha(key);
      if (ak && !map.has('~' + ak)) map.set('~' + ak, val);
    }
    return map;
  }, [stockRecords]);

  const getStock = useCallback((itemCode: string): number => {
    if (!itemCode) return 0;
    const norm = (v: any) => String(v ?? '').trim().toUpperCase();
    const alpha = (v: any) => norm(v).replace(/[^A-Z0-9]/g, '');
    const key = norm(itemCode);
    if (stockMap.has(key)) return stockMap.get(key)!;
    const ak = '~' + alpha(itemCode);
    if (stockMap.has(ak)) return stockMap.get(ak)!;
    return 0;
  }, [stockMap]);

  // ─── PO map ───────────────────────────────────────────────────────────────
  const poMap = useMemo<Map<string, number>>(() => {
    const map = new Map<string, number>();
    for (const po of purchaseOrders) {
      if (!Array.isArray(po.items)) continue;
      for (const item of po.items) {
        const code = String(item.itemCode || '').trim().toUpperCase();
        if (!code) continue;
        map.set(code, (map.get(code) || 0) + (Number(item.qty) || 0));
      }
    }
    return map;
  }, [purchaseOrders]);

  const getPOQuantity = useCallback((itemCode: string) => {
    return poMap.get(String(itemCode).trim().toUpperCase()) || 0;
  }, [poMap]);

  // ─── Indent analysis ──────────────────────────────────────────────────────
  // ✅ ROOT CAUSE FIX: Firestore returns docs in insertion order.
  // If S-8/25-02 was saved after S-8/25-01, the array may arrive as [02, 01].
  // We must sort ascending by serial number BEFORE iterating cumulativeAllocated,
  // otherwise Prev Qty is 0 for 01 and 30 for 02 — exactly backwards.
  const indentAnalysisRows = useMemo(() => {
    const rows: Array<{
      indentNo: string; date: string; indentBy: string; oaNo: string;
      model: string; itemCode: string; qty: number;
      totalStock: number; previousIndentsQty: number; poQuantity: number;
      availableForThisIndent: number; allocatedAvailable: number; isClosed: boolean;
    }> = [];

    // Sort ascending by trailing serial number: S-8/25-01 → S-8/25-02 → …
    const sortedIndents = [...indents].sort((a, b) => {
      const parse = (no: string) => {
        const m = no.match(/(\d+)$/);
        return m ? parseInt(m[1], 10) : 0;
      };
      return parse(a.indentNo) - parse(b.indentNo);
    });

    // Cumulative ALLOCATED qty per normalised item code
    const cumulativeAllocated = new Map<string, number>();

    for (const indent of sortedIndents) {
      for (const item of indent.items) {
        // Normalise code for consistent map lookups
        const code = String(item.itemCode || '').trim().toUpperCase();
        const totalStock = getStock(code) || getStock(item.itemCode);
        const poQuantity = getPOQuantity(code) || getPOQuantity(item.itemCode);

        const previousIndentsQty = cumulativeAllocated.get(code) || 0;

        // Stock left BEFORE this indent consumes anything
        const availableBefore = totalStock - previousIndentsQty;

        // CLOSED = enough stock to fully satisfy this indent
        const isClosed = availableBefore >= (Number(item.qty) || 0);

        // Actual amount allocated = min(what's available, what's requested) — never < 0
        const allocatedAvailable = Math.min(Math.max(0, availableBefore), Number(item.qty) || 0);

        // Net after this indent (negative = shortfall shown in red)
        const availableForThisIndent =
          (totalStock + poQuantity) - previousIndentsQty - (Number(item.qty) || 0);

        rows.push({
          indentNo:  indent.indentNo,
          date:      indent.date,
          indentBy:  indent.indentBy,
          oaNo:      indent.oaNo,
          model:     item.model,
          itemCode:  item.itemCode,   // original for display
          qty:       Number(item.qty) || 0,
          totalStock,
          previousIndentsQty,
          poQuantity,
          availableForThisIndent,
          allocatedAvailable,
          isClosed,
        });

        // Accumulate ALLOCATED (not requested) — partial open indents still
        // consume partial stock, reducing availability for later indents
        cumulativeAllocated.set(code, previousIndentsQty + allocatedAvailable);
      }
    }

    return rows;
  }, [indents, getStock, getPOQuantity]);

  // O(1) helpers derived from memoized rows
  const getAllocatedStock = useCallback((itemCode: string) => {
    return indentAnalysisRows
      .filter(r => r.itemCode === itemCode)
      .reduce((sum, r) => sum + r.allocatedAvailable, 0);
  }, [indentAnalysisRows]);

  const getRemainingStock = useCallback((itemCode: string) => {
    const totalStock = getStock(itemCode);
    const poQty = getPOQuantity(itemCode);
    const allocated = getAllocatedStock(itemCode);
    let available = totalStock + poQty - allocated;
    for (const item of newIndent.items) {
      if (item.itemCode === itemCode) {
        const alloc = Math.min(Math.max(0, available), Number(item.qty) || 0);
        available -= alloc;
      }
    }
    return available;
  }, [getStock, getPOQuantity, getAllocatedStock, newIndent.items]);

  // ─── Indent numbering ─────────────────────────────────────────────────────
  const getNextIndentNo = useCallback((currentIndents: Indent[] = indents) => {
    const base = 'S-8/25-';
    if (currentIndents.length === 0) return base + '01';
    const lastSerial = Math.max(...currentIndents.map(i => {
      const match = i.indentNo.match(/S-8\/25-(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    }));
    return base + String(lastSerial + 1).padStart(2, '0');
  }, [indents]);

  useEffect(() => {
    setNewIndent(prev => prev.indentNo ? prev : { ...prev, indentNo: getNextIndentNo() });
  }, [indents]);

  const getNextOANo = useCallback((indentByValue: string, currentOANo: string = ''): string => {
    if (!indentByValue) return '';
    if (currentOANo.trim() === 'Stock') {
      const nums = indents
        .filter(i => i.indentBy === indentByValue && /Stock\s+(\d+)/i.test(i.oaNo))
        .map(i => parseInt(i.oaNo.match(/Stock\s+(\d+)/i)![1], 10));
      const max = nums.length > 0 ? Math.max(...nums) : 0;
      return 'Stock ' + String(max + 1).padStart(2, '0');
    }
    const relNums = indents
      .filter(i => i.indentBy === indentByValue && /Stock\s+(\d+)/i.test(i.oaNo))
      .map(i => parseInt(i.oaNo.match(/Stock\s+(\d+)/i)![1], 10));
    if (relNums.length === 0) return '';
    return 'Stock ' + String(Math.max(...relNums) + 1).padStart(2, '0');
  }, [indents]);

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleChange = useCallback((e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'itemName') {
      const found = itemMaster.find(i => i.itemName === value);
      setItemInput(prev => ({ ...prev, model: value, itemCode: found ? found.itemCode : '' }));
    }
  }, [itemMaster]);

  const handleAddItem = useCallback(() => {
    if (!itemInput.model || !itemInput.itemCode || isNaN(Number(itemInput.qty)) || Number(itemInput.qty) <= 0) {
      showToast('Please fill in Item Name, Item Code, and a valid Quantity', 'error');
      return;
    }
    if (editIdx !== null) {
      setNewIndent(prev => ({ ...prev, items: prev.items.map((item, idx) => idx === editIdx ? itemInput : item) }));
      setEditIdx(null);
      showToast('Item updated', 'success');
    } else {
      setNewIndent(prev => ({ ...prev, items: [...prev.items, itemInput] }));
    }
    setItemInput({ model: '', itemCode: '', qty: 0, indentClosed: false });
  }, [itemInput, editIdx, showToast]);

  const handleAddIndent = useCallback(() => {
    if (!newIndent.date || !newIndent.indentBy || !newIndent.oaNo) {
      showToast('Please fill in Date, Indent By, and OA NO fields', 'error');
      return;
    }
    if (newIndent.items.length === 0) {
      showToast('Please add at least one item', 'error');
      return;
    }

    const indentNo = getNextIndentNo();
    const updated = [...indents.filter(i => i.indentNo !== indentNo), { ...newIndent, indentNo }];

    setIndents(updated);
    replaceFirestoreCollection(uid, 'indentData', updated).then(() => {
      showToast(`Indent ${indentNo} saved successfully`, 'success');
    }).catch(() => {
      showToast('Failed to save indent. Please try again.', 'error');
    });

    setNewIndent({ indentNo: getNextIndentNo(updated), date: '', indentBy: '', oaNo: '', items: [] });
    setItemInput({ model: '', itemCode: '', qty: 0, indentClosed: false });
  }, [newIndent, indents, uid, getNextIndentNo, showToast]);

  // ─── Publish open/closed items ────────────────────────────────────────────
  useEffect(() => {
    if (indents.length === 0 && stockRecords.length === 0) return;
    const openItems: any[] = [];
    const closedItems: any[] = [];

    indentAnalysisRows.forEach(row => {
      const payload = {
        model: row.model, itemCode: row.itemCode, qty: row.qty,
        indentClosed: row.isClosed, indentNo: row.indentNo,
        date: row.date, indentBy: row.indentBy, oaNo: row.oaNo,
        stock: row.totalStock, availableForThisIndent: row.availableForThisIndent,
        qty1: row.allocatedAvailable, Item: row.model, Code: row.itemCode,
      };
      (row.isClosed ? closedItems : openItems).push(payload);
    });

    replaceFirestoreCollection(uid, 'openIndentItems', openItems).catch(() => {});
    replaceFirestoreCollection(uid, 'closedIndentItems', closedItems).catch(() => {});
    try { bus.dispatchEvent(new CustomEvent('indents.updated', { detail: { openItems, closedItems } })); } catch {}
  }, [indentAnalysisRows, uid]);

  useEffect(() => {
    const handler = () => setIndents(prev => [...prev]);
    try { bus.addEventListener('stock.updated', handler as EventListener); } catch {}
    return () => { try { bus.removeEventListener('stock.updated', handler as EventListener); } catch {} };
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key && ['stock-records', 'indentData', 'purchaseOrders'].includes(e.key))
        setIndents(prev => [...prev]);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // ─── Export CSV ───────────────────────────────────────────────────────────
  const exportToCSV = useCallback(() => {
    const headers = [
      'Date','Indent No','Model','Item Code','Qty','Indent By','OA NO',
      'Total Stock','Previous Indents Qty','PO Quantity',
      'Available for This Indent','Allocated Available',
      'Remaining Stock','Allocated Stock','Status',
    ];
    const today = new Date().toISOString().slice(0, 10);
    const rows = filteredRows.map(r => [
      r.date, r.indentNo, r.model, r.itemCode, r.qty, r.indentBy, r.oaNo,
      r.totalStock, r.previousIndentsQty, r.poQuantity,
      r.availableForThisIndent, r.allocatedAvailable,
      getRemainingStock(r.itemCode), getAllocatedStock(r.itemCode),
      r.isClosed ? 'CLOSED' : 'OPEN',
    ]);
    const escape = (v: any) => { const s = String(v ?? ''); return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s; };
    const csv = '\uFEFF' + [headers, ...rows].map(row => row.map(escape).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `Indents_${today}.csv`; a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${filteredRows.length} rows`, 'success');
  }, [indentAnalysisRows, getRemainingStock, getAllocatedStock, showToast]);

  // ─── Filtered rows ────────────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    return indentAnalysisRows.filter(r => {
      if (filterStatus !== 'ALL') {
        if (filterStatus === 'CLOSED' && !r.isClosed) return false;
        if (filterStatus === 'OPEN' && r.isClosed) return false;
      }
      if (filterDateFrom && r.date < filterDateFrom) return false;
      if (filterDateTo && r.date > filterDateTo) return false;
      if (filterText) {
        const q = filterText.toLowerCase();
        if (![r.model, r.itemCode, r.indentNo, r.indentBy, r.oaNo].some(f => String(f).toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [indentAnalysisRows, filterStatus, filterDateFrom, filterDateTo, filterText]);

  // ─── Stats ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = indentAnalysisRows.length;
    const closed = indentAnalysisRows.filter(r => r.isClosed).length;
    return { total, closed, open: total - closed, totalIndents: new Set(indentAnalysisRows.map(r => r.indentNo)).size };
  }, [indentAnalysisRows]);

  const pendingStats = useMemo(() => {
    const insufficient = newIndent.items.filter(i => Number(i.qty) > getStock(i.itemCode)).length;
    return { insufficient, total: newIndent.items.length };
  }, [newIndent.items, getStock]);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes slideUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        .im-btn:hover { opacity: 0.88; }
        .im-row:hover td { background: #F7F8FF !important; }
        .im-input:focus { border-color: #3B5BDB !important; box-shadow: 0 0 0 3px rgba(59,91,219,0.12); }
        .im-ghost:hover { background: #F7F8FC !important; border-color: #CBD2E0 !important; }
        .im-danger-btn:hover { background: #FFF5F5 !important; }
        .im-edit-btn:hover { background: #C5D0FA !important; }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width:6px; height:6px; }
        ::-webkit-scrollbar-track { background: #F1F3F9; border-radius:3px; }
        ::-webkit-scrollbar-thumb { background: #CBD2E0; border-radius:3px; }
      `}</style>

      <ToastContainer toasts={toasts} />

      <div style={{ background: S.bg, minHeight: '100vh', fontFamily: "'Geist', 'DM Sans', system-ui, sans-serif" }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 24px 48px' }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: S.textPrimary, letterSpacing: '-0.02em' }}>
                Indent Management
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: 14, color: S.textSecondary }}>
                Track and manage material indents with live stock analysis
              </p>
            </div>
            <button className="im-btn im-ghost" style={{ ...S.btnGhost }} onClick={exportToCSV}>
              ↓ Export CSV
            </button>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
            <StatCard label="Total Indents" value={stats.totalIndents} />
            <StatCard label="Total Lines" value={stats.total} />
            <StatCard label="Open Lines" value={stats.open} color={S.danger} sub="Awaiting stock" />
            <StatCard label="Closed Lines" value={stats.closed} color={S.success} sub="Fulfilled" />
            <StatCard label="Item Master" value={itemMaster.length} color={itemMaster.length === 0 ? S.warning : S.textPrimary} sub={itemMaster.length === 0 ? 'Loading…' : 'items loaded'} />
            <StatCard label="Stock Records" value={stockRecords.length} color={stockRecords.length === 0 ? S.warning : S.textPrimary} sub={stockRecords.length === 0 ? 'Loading…' : 'records loaded'} />
          </div>

          {/* Create Indent Form */}
          <div style={{ ...S.card, marginBottom: 24 }}>
            <h2 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700, color: S.textPrimary }}>New Indent</h2>

            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
              <Field label="Indent No">
                <input className="im-input" style={{ ...S.inputDisabled, width: 140 }} value={newIndent.indentNo || getNextIndentNo()} disabled />
              </Field>
              <Field label="Date">
                <input type="date" className="im-input" style={{ ...S.input, width: 160 }} value={newIndent.date} onChange={e => setNewIndent(p => ({ ...p, date: e.target.value }))} />
              </Field>
              <Field label="Indent By">
                <select className="im-input" style={{ ...S.input, width: 140 }} value={newIndent.indentBy}
                  onChange={e => { const v = e.target.value; setNewIndent(p => ({ ...p, indentBy: v, oaNo: getNextOANo(v) })); }}>
                  <option value="">Select…</option>
                  <option value="HKG">HKG</option>
                  <option value="NGR">NGR</option>
                  <option value="MDD">MDD</option>
                </select>
              </Field>
              <Field label="OA No">
                <div style={{ display: 'flex', gap: 6 }}>
                  <input className="im-input" style={{ ...S.input, width: 160 }} placeholder="e.g. OA-1234" value={newIndent.oaNo}
                    onChange={e => setNewIndent(p => ({ ...p, oaNo: e.target.value }))}
                    onBlur={() => {
                      if (newIndent.oaNo.trim().toLowerCase() === 'stock' && newIndent.indentBy) {
                        const f = getNextOANo(newIndent.indentBy, newIndent.oaNo);
                        if (f) setNewIndent(p => ({ ...p, oaNo: f }));
                      }
                    }}
                  />
                  <button className="im-btn" style={{ ...S.btnGhost, padding: '8px 12px', fontSize: 13 }} title="Auto-generate Stock OA No"
                    onClick={() => {
                      if (!newIndent.indentBy) { showToast('Select Indent By first', 'error'); return; }
                      const f = getNextOANo(newIndent.indentBy, 'Stock');
                      if (f) setNewIndent(p => ({ ...p, oaNo: f }));
                    }}>Auto</button>
                </div>
              </Field>
            </div>

            <div style={{ borderTop: `1px dashed ${S.border}`, margin: '0 0 20px' }} />

            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <Field label="Item Name">
                <select name="itemName" className="im-input"
                  style={{ ...S.input, minWidth: 260, borderColor: itemMaster.length === 0 ? S.warning : S.borderStrong }}
                  value={itemInput.model} onChange={handleChange}>
                  <option value="">{itemMaster.length === 0 ? 'Loading item master…' : 'Select item…'}</option>
                  {itemMaster.map(item => (
                    <option key={item.itemCode} value={item.itemName}>{item.itemName} — {item.itemCode}</option>
                  ))}
                </select>
              </Field>
              <Field label="Item Code">
                <input className="im-input" style={{ ...S.inputDisabled, width: 140 }} value={itemInput.itemCode} readOnly placeholder="Auto-filled" />
              </Field>
              <Field label="Quantity">
                <input type="number" className="im-input" style={{ ...S.input, width: 100 }} placeholder="0"
                  value={itemInput.qty === 0 ? '' : itemInput.qty}
                  onChange={e => setItemInput(p => ({ ...p, qty: e.target.value === '' ? 0 : Number(e.target.value) }))}
                  min={1} />
              </Field>
              {itemInput.itemCode && (
                <div style={{
                  padding: '8px 12px', borderRadius: 8, fontSize: 13,
                  background: getStock(itemInput.itemCode) > 0 ? S.successLight : S.dangerLight,
                  color: getStock(itemInput.itemCode) > 0 ? S.success : S.danger,
                  fontWeight: 600, alignSelf: 'flex-end',
                }}>
                  Stock: {getStock(itemInput.itemCode)}
                </div>
              )}
              <div style={{ alignSelf: 'flex-end' }}>
                <button className="im-btn" style={{ ...S.btnPrimary, background: editIdx !== null ? '#7048E8' : S.accent }} onClick={handleAddItem}>
                  {editIdx !== null ? '✎ Update Item' : '+ Add Item'}
                </button>
              </div>
            </div>

            {newIndent.items.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{
                  padding: '12px 16px', background: pendingStats.insufficient > 0 ? S.warningLight : S.successLight,
                  border: `1px solid ${pendingStats.insufficient > 0 ? '#FFE066' : '#A9E6B8'}`,
                  borderRadius: 8, marginBottom: 12, display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center',
                }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: S.textPrimary }}>{newIndent.items.length} item{newIndent.items.length !== 1 ? 's' : ''} queued</span>
                  {pendingStats.insufficient > 0
                    ? <span style={{ fontSize: 13, color: S.warning, fontWeight: 600 }}>⚠ {pendingStats.insufficient} item{pendingStats.insufficient !== 1 ? 's' : ''} with insufficient stock</span>
                    : <span style={{ fontSize: 13, color: S.success, fontWeight: 600 }}>✓ All items have sufficient stock</span>}
                </div>

                <div style={{ overflowX: 'auto', borderRadius: 8, border: `1px solid ${S.border}` }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ ...S.th, minWidth: 180 }}>Item Name</th>
                        <th style={{ ...S.th, minWidth: 110 }}>Item Code</th>
                        <th style={{ ...S.thRight, minWidth: 60 }}>Qty</th>
                        <th style={{ ...S.thRight, minWidth: 80 }}>Available</th>
                        <th style={{ ...S.thRight, minWidth: 90 }}>Remaining</th>
                        <th style={{ ...S.th, textAlign: 'center', minWidth: 80 }}>Status</th>
                        <th style={{ ...S.th, textAlign: 'center', minWidth: 100 }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {newIndent.items.map((item, idx) => {
                        const avail = getStock(item.itemCode);
                        const insufficient = Number(item.qty) > avail;
                        let cumulativePending = 0;
                        for (let i = 0; i <= idx; i++) cumulativePending += Number(newIndent.items[i].qty) || 0;
                        const remaining = avail - getAllocatedStock(item.itemCode) - cumulativePending;
                        return (
                          <tr key={idx} className="im-row" style={{ background: insufficient ? '#FFF9F9' : 'inherit' }}>
                            <td style={S.tdClip} title={item.model}>{item.model}</td>
                            <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 13 }}>{item.itemCode}</td>
                            <td style={{ ...S.tdRight, fontWeight: 600 }}>{item.qty}</td>
                            <td style={{ ...S.tdRight, color: insufficient ? S.danger : S.success, fontWeight: 600 }}>{avail}</td>
                            <td style={{ ...S.tdRight, color: remaining >= 0 ? S.success : S.danger, fontWeight: 600 }}>{remaining}</td>
                            <td style={{ ...S.td, textAlign: 'center' }}>
                              {insufficient ? <span style={{ fontSize: 12, color: S.warning, fontWeight: 700 }}>⚠ LOW</span>
                                           : <span style={{ fontSize: 12, color: S.success, fontWeight: 700 }}>✓ OK</span>}
                            </td>
                            <td style={{ ...S.td, textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                                <button className="im-btn im-edit-btn" style={S.btnEdit}
                                  onClick={() => { setItemInput(newIndent.items[idx]); setEditIdx(idx); }}>Edit</button>
                                <button className="im-btn im-danger-btn" style={S.btnDanger}
                                  onClick={() => setNewIndent(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }))}>✕</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
                  <button className="im-btn" style={{ ...S.btnSuccess, opacity: newIndent.items.length === 0 ? 0.5 : 1, cursor: newIndent.items.length === 0 ? 'not-allowed' : 'pointer' }}
                    onClick={handleAddIndent} disabled={newIndent.items.length === 0}>✓ Save Indent</button>
                  <button className="im-btn im-ghost" style={S.btnGhost}
                    onClick={() => { setNewIndent({ indentNo: getNextIndentNo(), date: '', indentBy: '', oaNo: '', items: [] }); setItemInput({ model: '', itemCode: '', qty: 0, indentClosed: false }); setEditIdx(null); }}>Clear</button>
                </div>
              </div>
            )}

            {newIndent.items.length === 0 && (
              <div style={{ marginTop: 16 }}>
                <button className="im-btn" style={{ ...S.btnSuccess, opacity: 0.4, cursor: 'not-allowed' }} disabled>✓ Save Indent</button>
              </div>
            )}
          </div>

          {/* Indent Records Table */}
          <div style={S.card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: S.textPrimary }}>Indent Records</h2>
                <span style={{ fontSize: 12, fontWeight: 600, color: S.textSecondary, background: S.bg, padding: '2px 10px', borderRadius: 20, border: `1px solid ${S.border}` }}>
                  {filteredRows.length} of {indentAnalysisRows.length} rows
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="im-btn im-ghost"
                  style={{ ...S.btnGhost, borderColor: showFilters ? S.accent : S.border, color: showFilters ? S.accent : S.textSecondary, position: 'relative' }}
                  onClick={() => setShowFilters(f => !f)}>
                  ⚙ Filters
                  {activeFilterCount > 0 && (
                    <span style={{ position: 'absolute', top: -6, right: -6, background: S.accent, color: '#fff', borderRadius: '50%', width: 16, height: 16, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{activeFilterCount}</span>
                  )}
                </button>
                <button className="im-btn im-ghost" style={S.btnGhost} onClick={exportToCSV}>↓ CSV</button>
              </div>
            </div>

            {showFilters && (
              <div style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: '14px 16px', marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <Field label="Search">
                  <input className="im-input" style={{ ...S.input, minWidth: 220 }} placeholder="Item, code, indent no, OA…" value={filterText} onChange={e => setFilterText(e.target.value)} />
                </Field>
                <Field label="Status">
                  <select className="im-input" style={{ ...S.input, width: 130 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}>
                    <option value="ALL">All</option>
                    <option value="OPEN">Open</option>
                    <option value="CLOSED">Closed</option>
                  </select>
                </Field>
                <Field label="Date From">
                  <input type="date" className="im-input" style={{ ...S.input, width: 150 }} value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
                </Field>
                <Field label="Date To">
                  <input type="date" className="im-input" style={{ ...S.input, width: 150 }} value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
                </Field>
                {activeFilterCount > 0 && (
                  <button className="im-btn im-ghost" style={{ ...S.btnGhost, alignSelf: 'flex-end', color: S.danger, borderColor: '#FECACA' }}
                    onClick={() => { setFilterText(''); setFilterStatus('ALL'); setFilterDateFrom(''); setFilterDateTo(''); }}>✕ Clear all</button>
                )}
              </div>
            )}

            <div style={{ overflowX: 'auto', borderRadius: 8, border: `1px solid ${S.border}` }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...S.th, minWidth: 95 }}>Date</th>
                    <th style={{ ...S.th, minWidth: 115 }}>Indent No</th>
                    <th style={{ ...S.th, minWidth: 180 }}>Item Name</th>
                    <th style={{ ...S.th, minWidth: 110 }}>Item Code</th>
                    <th style={{ ...S.thRight, minWidth: 55 }}>Qty</th>
                    <th style={{ ...S.th, minWidth: 52 }}>By</th>
                    <th style={{ ...S.th, minWidth: 90 }}>OA No</th>
                    <th style={{ width: 2, padding: 0, background: S.borderStrong, borderBottom: `2px solid ${S.borderStrong}` }} />
                    <th style={{ ...S.thRight, minWidth: 95 }}>Total Stock</th>
                    <th style={{ ...S.thRight, minWidth: 80 }}>Prev Qty</th>
                    <th style={{ ...S.thRight, minWidth: 68 }}>PO Qty</th>
                    <th style={{ width: 2, padding: 0, background: S.borderStrong, borderBottom: `2px solid ${S.borderStrong}` }} />
                    <th style={{ ...S.thRight, minWidth: 95 }}>Available</th>
                    <th style={{ ...S.th, textAlign: 'center', minWidth: 94 }}>Status</th>
                    <th style={{ ...S.th, textAlign: 'center', minWidth: 48 }}>Del</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={15} style={{ padding: '40px 0', textAlign: 'center', color: S.textMuted, fontSize: 14 }}>
                        {indentAnalysisRows.length === 0 ? 'No indent records yet. Create your first indent above.' : 'No rows match the current filters.'}
                      </td>
                    </tr>
                  ) : filteredRows.map((r, rowIdx) => {
                    const availBadgeColor = r.availableForThisIndent >= 0 ? S.success : S.danger;
                    const availBg = r.availableForThisIndent >= 0 ? S.successLight : S.dangerLight;
                    const origIndentIndex = indents.findIndex(i => i.indentNo === r.indentNo);
                    const origItemIndex = origIndentIndex >= 0
                      ? indents[origIndentIndex].items.findIndex(i => i.itemCode === r.itemCode && i.model === r.model && i.qty === r.qty)
                      : -1;

                    return (
                      <tr key={rowIdx} className="im-row" style={{ background: rowIdx % 2 === 1 ? S.bg : S.surface }}>
                        <td style={S.td}>{r.date}</td>
                        <td style={{ ...S.td, fontWeight: 600, color: S.accent, whiteSpace: 'nowrap' }}>{r.indentNo}</td>
                        <td style={S.tdClip} title={r.model}>{r.model}</td>
                        <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 13 }}>{r.itemCode}</td>
                        <td style={{ ...S.tdRight, fontWeight: 700 }}>{r.qty}</td>
                        <td style={S.td}>{r.indentBy}</td>
                        <td style={S.td}>{r.oaNo}</td>
                        <td style={{ padding: 0, background: S.border, width: 2 }} />
                        <td style={{ ...S.tdRight, color: S.textSecondary }}>{r.totalStock}</td>
                        <td style={{ ...S.tdRight, color: S.textSecondary }}>{r.previousIndentsQty}</td>
                        <td style={{ ...S.tdRight, color: r.poQuantity > 0 ? S.accent : S.textSecondary }}>{r.poQuantity}</td>
                        <td style={{ padding: 0, background: S.border, width: 2 }} />
                        <td style={S.tdRight}>
                          <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 6, fontWeight: 700, fontSize: 13, background: availBg, color: availBadgeColor, minWidth: 44, textAlign: 'right' }}>
                            {r.availableForThisIndent}
                          </span>
                        </td>
                        <td style={{ ...S.td, textAlign: 'center' }}>
                          <StatusBadge closed={r.isClosed} />
                        </td>
                        <td style={{ ...S.td, textAlign: 'center' }}>
                          <button className="im-btn im-danger-btn" style={{ ...S.btnDanger, padding: '3px 8px' }}
                            onClick={() => {
                              if (origIndentIndex < 0 || origItemIndex < 0) return;
                              const updated = indents
                                .map((ind, idx) => idx !== origIndentIndex ? ind : { ...ind, items: ind.items.filter((_, i) => i !== origItemIndex) })
                                .filter(ind => ind.items.length > 0);
                              setIndents(updated);
                              replaceFirestoreCollection(uid, 'indentData', updated)
                                .then(() => showToast('Item removed', 'success'))
                                .catch(() => showToast('Failed to save changes', 'error'));
                            }}
                            title="Delete this line">✕</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredRows.length > 0 && (
              <div style={{ marginTop: 12, fontSize: 13, color: S.textMuted, textAlign: 'right' }}>
                Showing {filteredRows.length} of {indentAnalysisRows.length} rows
                {activeFilterCount > 0 && ` — ${activeFilterCount} filter${activeFilterCount !== 1 ? 's' : ''} active`}
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
};

export default IndentModule;