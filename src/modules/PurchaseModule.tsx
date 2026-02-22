import React, { useEffect, useState, useMemo } from "react";
import bus from '../utils/eventBus';
import { subscribeFirestoreDocs, replaceFirestoreCollection } from '../utils/firestoreSync';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PurchaseEntry {
  orderPlaceDate: string;
  poNo: string;
  supplierName: string;
  itemName: string;
  itemCode: string;
  indentNo: string;
  indentDate?: string;
  indentBy: string;
  oaNo: string;
  originalIndentQty: number;
  purchaseQty: number;
  currentStock: number;
  indentStatus: string;
  receivedQty: number;
  okQty: number;
  rejectedQty: number;
  grnNo: string;
  debitNoteOrQtyReturned: string;
  remarks: string;
}

interface PurchaseModuleProps {
  user?: any;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const INDENT_STATUS_OPTIONS = ["Open", "Closed", "Partial"];

const EMPTY_ENTRY: PurchaseEntry = {
  orderPlaceDate: "", poNo: "", supplierName: "", itemName: "", itemCode: "",
  indentNo: "", indentBy: "", oaNo: "", originalIndentQty: 0, purchaseQty: 0,
  currentStock: 0, indentStatus: "Open", receivedQty: 0, okQty: 0,
  rejectedQty: 0, grnNo: "", debitNoteOrQtyReturned: "", remarks: "",
};

// ─── Inline styles ────────────────────────────────────────────────────────────
// Uses system font stack — works without any external font loading.
// Designed to sit inside App.tsx <main> (which already has white bg + padding).

const S = {
  root:       { fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif", color: '#1a1a2e' } as React.CSSProperties,

  // Header row
  topRow:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 } as React.CSSProperties,
  title:      { fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.3px', color: '#111827' } as React.CSSProperties,
  topBtns:    { display: 'flex', gap: 8 } as React.CSSProperties,

  // Stats bar
  statsRow:   { display: 'flex', gap: 12, flexWrap: 'wrap' as const, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 18px', marginBottom: 20 } as React.CSSProperties,
  stat:       { minWidth: 72, textAlign: 'center' as const } as React.CSSProperties,
  statVal:    { fontSize: 22, fontWeight: 700, lineHeight: 1.1 } as React.CSSProperties,
  statLabel:  { fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '0.6px', marginTop: 2 } as React.CSSProperties,
  statDiv:    { width: 1, background: '#e5e7eb', alignSelf: 'stretch' as const } as React.CSSProperties,

  // Form card
  formCard:   { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '18px 20px', marginBottom: 20 } as React.CSSProperties,
  formTitle:  { fontSize: 14, fontWeight: 600, color: '#374151', margin: '0 0 14px' } as React.CSSProperties,
  grid:       { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10 } as React.CSSProperties,
  label:      { display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: '0.4px' } as React.CSSProperties,
  input:      { width: '100%', boxSizing: 'border-box' as const, padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, outline: 'none', background: '#fff', fontFamily: 'inherit' } as React.CSSProperties,
  inputErr:   { borderColor: '#ef4444', background: '#fef2f2' } as React.CSSProperties,
  select:     { width: '100%', boxSizing: 'border-box' as const, padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, background: '#fff', fontFamily: 'inherit', outline: 'none' } as React.CSSProperties,
  formBtns:   { marginTop: 14, display: 'flex', gap: 8 } as React.CSSProperties,

  // Table card
  tableCard:  { border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' } as React.CSSProperties,
  table:      { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 } as React.CSSProperties,
  th:         { padding: '9px 11px', textAlign: 'left' as const, fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.5px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', whiteSpace: 'nowrap' as const } as React.CSSProperties,
  td:         { padding: '10px 11px', borderBottom: '1px solid #f1f3f7', verticalAlign: 'middle' as const } as React.CSSProperties,

  // Buttons
  btnPrimary: { padding: '8px 16px', background: '#1a237e', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' } as React.CSSProperties,
  btnOutline: { padding: '8px 16px', background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: 6, fontWeight: 500, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' } as React.CSSProperties,
  btnSm:      (color: string) => ({ padding: '4px 10px', background: 'transparent', color, border: `1px solid ${color}33`, borderRadius: 5, fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' } as React.CSSProperties),

  // Notice
  notice:     (type: 'success' | 'warn' | 'error') => {
    const c = { success: ['#16a34a','#f0fdf4','#bbf7d0'], warn: ['#b45309','#fffbeb','#fde68a'], error: ['#dc2626','#fef2f2','#fecaca'] }[type];
    return { padding: '9px 13px', borderRadius: 7, border: `1px solid ${c[2]}`, background: c[1], color: c[0], fontSize: 13, fontWeight: 500, marginBottom: 16 } as React.CSSProperties;
  },

  emptyState: { padding: '48px 0', textAlign: 'center' as const, color: '#9ca3af' } as React.CSSProperties,
  divider:    { height: 1, background: '#e5e7eb', margin: '16px 0' } as React.CSSProperties,
};

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, [string, string]> = {
  Open:    ['#b45309', '#fef3c7'],
  Closed:  ['#16a34a', '#dcfce7'],
  Partial: ['#2563eb', '#dbeafe'],
};

const StatusBadge = ({ status }: { status: string }) => {
  const [color, bg] = STATUS_COLORS[status] || ['#6b7280', '#f3f4f6'];
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, color, background: bg }}>
      {status}
    </span>
  );
};

// ─── Stock badge ──────────────────────────────────────────────────────────────

const StockBadge = ({ value, isShort }: { value: number; isShort: boolean }) => (
  <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 6, fontWeight: 700, fontSize: 13, color: '#fff', background: isShort || value <= 0 ? '#ef4444' : '#16a34a', minWidth: 32, textAlign: 'center' }}>
    {value === 0 ? '—' : value}
  </span>
);

// ─── Field helpers ────────────────────────────────────────────────────────────

const Field = ({ label, name, value, onChange, type = 'text', required = false }: {
  label: string; name: string; value: any; onChange: any; type?: string; required?: boolean;
}) => (
  <div>
    <label style={S.label}>{label}{required && <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>}</label>
    <input type={type} name={name} value={value ?? ''} onChange={onChange}
      style={{ ...S.input, ...(required && !value ? S.inputErr : {}) }} />
  </div>
);

const SelectField = ({ label, name, value, onChange, options, required = false }: {
  label: string; name: string; value: any; onChange: any; options: string[]; required?: boolean;
}) => (
  <div>
    <label style={S.label}>{label}{required && <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>}</label>
    <select name={name} value={value ?? ''} onChange={onChange} style={S.select}>
      <option value="">Select…</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  </div>
);

// ─── Component ────────────────────────────────────────────────────────────────

const PurchaseModule: React.FC<PurchaseModuleProps> = ({ user }) => {
  const [uid] = useState<string>(user?.uid || 'default-user');

  const [entries,           setEntries]           = useState<PurchaseEntry[]>([]);
  const [openIndentItems,   setOpenIndentItems]   = useState<any[]>([]);
  const [closedIndentItems, setClosedIndentItems] = useState<any[]>([]);
  const [stockRecords,      setStockRecords]      = useState<any[]>([]);
  const [indentData,        setIndentData]        = useState<any[]>([]);
  const [itemMasterData,    setItemMasterData]    = useState<any[]>([]);
  const [psirData,          setPsirData]          = useState<any[]>([]);
  const [itemNames,         setItemNames]         = useState<string[]>([]);

  const [newEntry,    setNewEntry]    = useState<PurchaseEntry>(EMPTY_ENTRY);
  const [editIndex,   setEditIndex]   = useState<number | null>(null);
  const [editEntry,   setEditEntry]   = useState<PurchaseEntry | null>(null);
  const [notice,      setNotice]      = useState<{ type: 'success' | 'warn' | 'error'; msg: string } | null>(null);
  const [importing,   setImporting]   = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  // ─── Firestore subscriptions ────────────────────────────────────────────
  useEffect(() => {
    const unsubs = [
      subscribeFirestoreDocs(uid, 'openIndentItems',   d => setOpenIndentItems(d)),
      subscribeFirestoreDocs(uid, 'closedIndentItems', d => setClosedIndentItems(d)),
      subscribeFirestoreDocs(uid, 'stockRecords',      d => setStockRecords(d)),
      subscribeFirestoreDocs(uid, 'indentData',        d => setIndentData(d)),
      subscribeFirestoreDocs(uid, 'itemMaster',        d => setItemMasterData(d)),
      subscribeFirestoreDocs(uid, 'psirData',          d => setPsirData(d)),
      subscribeFirestoreDocs(uid, 'purchaseData',      docs => {
        if (!docs?.length) { setEntries([]); return; }
        try {
          const migrated = docs.map((e: any) => ({
            ...e,
            originalIndentQty: e.originalIndentQty ?? e.qty ?? 0,
            purchaseQty:       e.purchaseQty       ?? e.poQty ?? e.qty ?? 0,
            currentStock:      e.currentStock      ?? e.inStock ?? 0,
            okQty:             e.okQty             ?? 0,
            receivedQty:       e.receivedQty       ?? 0,
            rejectedQty:       e.rejectedQty       ?? 0,
          }));
          setEntries(deduplicateEntries(migrated));
        } catch { setEntries([]); }
      }),
    ];
    return () => unsubs.forEach(u => u());
  }, [uid]);

  useEffect(() => {
    if (Array.isArray(itemMasterData))
      setItemNames(itemMasterData.map((i: any) => i.itemName).filter(Boolean));
  }, [itemMasterData]);

  // ─── Pure helpers ──────────────────────────────────────────────────────
  const norm = (v: any): string => { try { return v == null ? '' : String(v).trim().toUpperCase(); } catch { return ''; } };
  const makeKey = (a: any, b: any) => `${norm(a)}|${norm(b)}`;

  const tryParse = (v: any): number => {
    if (v == null || v === '') return 0;
    if (typeof v === 'number' && !isNaN(v)) return v;
    const m = String(v).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
    return m ? parseFloat(m[0]) || 0 : 0;
  };

  const getStockFromIndent = (item: any): number => {
    if (!item) return 0;
    for (const f of ['stock','Stock','currentStock','Current Stock','availableStock','Available','available','instock','inStock','balance','Balance','qty1']) {
      if (f in item) { const p = tryParse(item[f]); if (p) return p; }
    }
    for (const f of ['quantity','Quantity','qty','Qty']) {
      if (f in item) { const p = tryParse(item[f]); if (p) return p; }
    }
    if ('qty' in item && 'issued' in item) { const b = tryParse(item.qty) - tryParse(item.issued); if (b >= 0) return b; }
    return 0;
  };

  const getIndentQty = (item: any): number => {
    for (const f of ['qty','indentQty','quantity','Quantity','requestedQty','requiredQty','Qty','qty1']) {
      if (item[f] != null && item[f] !== '') { const n = Number(item[f]); if (!isNaN(n)) return n; }
    }
    return 0;
  };

  const getStatusFromIndent = (item: any): string => {
    if (openIndentItems.some((o: any)   => o.indentNo === item.indentNo && (o.itemCode === item.itemCode || o.Code === item.itemCode))) return "Open";
    if (closedIndentItems.some((c: any) => c.indentNo === item.indentNo && (c.itemCode === item.itemCode || c.Code === item.itemCode))) return "Closed";
    return "Open";
  };

  // ─── useMemo live-stock map ────────────────────────────────────────────
  // Computed once per data-change; render does O(1) lookup — eliminates the
  // green→red flicker caused by calling getLiveStockInfo() during render when
  // indent arrays are still loading.
  const liveStockMap = useMemo(() => {
    const map = new Map<string, { display: number; isShort: boolean; status: string }>();

    const computeDisplay = (indentItem: any, normCode: string, itemIndentNo: string): { display: number; isShort: boolean } => {
      for (const f of ['availableForThisIndent','allocatedAvailable','qty1','available']) {
        if (indentItem[f] != null) { const av = Number(indentItem[f]); if (!isNaN(av)) return { display: av, isShort: false }; }
      }
      let tI = -1, tJ = -1;
      outer:
      for (let i = 0; i < indentData.length; i++) {
        const ind = indentData[i];
        if (!ind?.items || norm(ind.indentNo) !== itemIndentNo) continue;
        for (let j = 0; j < ind.items.length; j++) {
          const it = ind.items[j];
          if (!it) continue;
          if (norm(it.itemCode) === normCode || norm(it.Code || it.Item || '') === normCode) { tI = i; tJ = j; break outer; }
        }
      }
      let cumQty = 0;
      if (tI >= 0) {
        for (let i = 0; i <= tI; i++) {
          const ind = indentData[i];
          if (!ind?.items) continue;
          const limit = i === tI ? tJ + 1 : ind.items.length;
          for (let j = 0; j < limit; j++) {
            const it = ind.items[j];
            if (it && (norm(it.itemCode) === normCode || norm(it.Code || it.Item || '') === normCode)) cumQty += Number(it.qty) || 0;
          }
        }
      }
      if (!cumQty) { const fb = getIndentQty(indentItem) || Number(indentItem.qty) || 0; if (fb) cumQty = fb; }
      const sr       = stockRecords.find((s: any) => norm(s.itemCode) === normCode);
      const closing  = sr && !isNaN(Number(sr.closingStock)) ? Number(sr.closingStock) : 0;
      const display  = cumQty > 0 ? (cumQty > closing ? cumQty - closing : cumQty) : closing;
      return { display, isShort: cumQty > closing };
    };

    for (const item of [...openIndentItems, ...closedIndentItems]) {
      if (!item?.indentNo) continue;
      const itemIndentNo = norm(item.indentNo);
      const status       = openIndentItems.includes(item) ? 'Open' : 'Closed';
      const codes        = [norm(item.itemCode), norm(item.Code)].filter(Boolean);
      for (const code of (codes.length ? codes : [''])) {
        const key = `${itemIndentNo}|${code}`;
        if (map.has(key)) continue;
        try { map.set(key, { ...computeDisplay(item, code, itemIndentNo), status }); }
        catch  { map.set(key, { display: getStockFromIndent(item), isShort: false, status }); }
      }
    }
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openIndentItems, closedIndentItems, indentData, stockRecords]);

  const getLiveInfo = (e: Pick<PurchaseEntry, 'indentNo' | 'itemCode' | 'currentStock'>) => {
    const hit = liveStockMap.get(makeKey(e.indentNo, e.itemCode)) ?? liveStockMap.get(`${norm(e.indentNo)}|`);
    return hit ? { display: hit.display, isShort: hit.isShort } : { display: e.currentStock || 0, isShort: false };
  };

  const getLiveStock = (e: Pick<PurchaseEntry, 'indentNo' | 'itemCode' | 'currentStock'>) => getLiveInfo(e).display;

  // ─── Deduplication ────────────────────────────────────────────────────
  const deduplicateEntries = (list: PurchaseEntry[]): PurchaseEntry[] => {
    if (!Array.isArray(list)) return [];
    const seen = new Set<string>();
    return list.filter(e => { const k = makeKey(e.indentNo, e.itemCode); if (seen.has(k)) return false; seen.add(k); return true; });
  };

  // ─── Persist ──────────────────────────────────────────────────────────
  const persistEntries = (data: PurchaseEntry[]): PurchaseEntry[] => {
    const deduped = deduplicateEntries(data);
    replaceFirestoreCollection(uid, 'purchaseData',   deduped).catch(console.error);
    replaceFirestoreCollection(uid, 'purchaseOrders', deduped).catch(console.error);
    try { bus.dispatchEvent(new CustomEvent('purchaseOrders.updated', { detail: deduped })); } catch {}
    return deduped;
  };

  // ─── Import ───────────────────────────────────────────────────────────
  const handleImportIndents = async () => {
    const allItems = [...openIndentItems, ...closedIndentItems];
    if (!allItems.length) { setNotice({ type: 'warn', msg: 'No indent items found. Make sure indent data is loaded first.' }); return; }
    setImporting(true);
    try {
      let created = 0, updated = 0;
      const existingMap = new Map(entries.map(e => [makeKey(e.indentNo, e.itemCode), e]));
      const result = [...entries];

      for (const item of allItems) {
        if (!item.indentNo) continue;
        const key          = makeKey(item.indentNo, item.itemCode || '');
        const stock        = getStockFromIndent(item);
        const indentQty    = getIndentQty(item);
        const indentStatus = getStatusFromIndent(item);
        const liveHit      = liveStockMap.get(key) ?? liveStockMap.get(`${norm(item.indentNo)}|`);
        const liveStock    = liveHit?.display ?? stock;

        if (existingMap.has(key)) {
          const idx = result.findIndex(e => makeKey(e.indentNo, e.itemCode) === key);
          if (idx >= 0) {
            // Preserve user-entered fields: poNo, supplierName, orderPlaceDate, grnNo
            result[idx] = { ...result[idx], originalIndentQty: indentQty, currentStock: stock, indentStatus, oaNo: item.oaNo || item.OA || result[idx].oaNo, purchaseQty: indentStatus === 'Open' ? stock : 0 };
            updated++;
          }
        } else {
          result.push({
            ...EMPTY_ENTRY,
            itemName: item.model || item.itemName || item.Item || item.description || '',
            itemCode: item.itemCode || item.Code || '',
            indentNo: item.indentNo || '',
            indentDate: item.date || item.indentDate || '',
            indentBy: item.indentBy || '',
            oaNo: item.oaNo || item.OA || '',
            originalIndentQty: indentQty,
            currentStock: stock,
            indentStatus,
            purchaseQty: indentStatus === 'Open' ? liveStock : 0,
          });
          created++;
        }
      }
      const saved = persistEntries(result);
      setEntries(saved);
      setNotice({ type: 'success', msg: `Synced: ${created} new rows, ${updated} updated.` });
    } catch (err) {
      console.error('[PurchaseModule] Import error:', err);
      setNotice({ type: 'error', msg: 'Sync failed. Check console for details.' });
    } finally {
      setImporting(false);
    }
  };

  // ─── PSIR sync ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!entries.length || !psirData.length) return;
    let changed = false;
    const updated = entries.map(e => {
      const psir = psirData.find((p: any) => p.poNo === e.poNo && Array.isArray(p.items));
      if (!psir) return e;
      const it = psir.items.find((i: any) => i.itemCode === e.itemCode);
      if (!it) return e;
      const r = it.qtyReceived || 0, ok = it.okQty || 0, rej = it.rejectQty || 0;
      if (r !== e.receivedQty || ok !== e.okQty || rej !== e.rejectedQty) { changed = true; return { ...e, receivedQty: r, okQty: ok, rejectedQty: rej }; }
      return e;
    });
    if (changed) { setEntries(updated); persistEntries(updated); }
  }, [psirData]);

  useEffect(() => {
    if (!newEntry.poNo || !newEntry.itemCode) return;
    const psir = psirData.find((p: any) => p.poNo === newEntry.poNo && Array.isArray(p.items) && p.items.some((i: any) => i.itemCode === newEntry.itemCode));
    if (!psir) return;
    const it = psir.items.find((i: any) => i.itemCode === newEntry.itemCode);
    if (it) setNewEntry(prev => ({ ...prev, receivedQty: it.qtyReceived || 0, okQty: it.okQty || 0, rejectedQty: it.rejectQty || 0 }));
  }, [newEntry.poNo, newEntry.itemCode]);

  // ─── Indent event sync ────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: any) => {
      const openItems: any[]   = e?.detail?.openItems   || [];
      const closedItems: any[] = e?.detail?.closedItems || [];
      const sMap = new Map<string, string>(), stMap = new Map<string, number>();
      const process = (item: any, status: string) => {
        if (!item?.indentNo) return;
        [makeKey(item.indentNo, item.itemCode || ''), makeKey(item.indentNo, item.Code || '')].forEach(k => { sMap.set(k, status); stMap.set(k, getStockFromIndent(item)); });
      };
      openItems.forEach((i: any)   => process(i, 'Open'));
      closedItems.forEach((i: any) => process(i, 'Closed'));
      setEntries(prev => {
        let dirty = false;
        const updated = prev.map(e => {
          const k = makeKey(e.indentNo, e.itemCode);
          const ns = sMap.get(k), nst = stMap.get(k);
          if (!ns && nst === undefined) return e;
          const u = { ...e };
          if (ns && ns !== e.indentStatus)       { u.indentStatus  = ns;  dirty = true; }
          if (nst !== undefined && nst !== e.currentStock) { u.currentStock = nst; dirty = true; }
          const desired = (ns ?? u.indentStatus) === 'Open' ? (nst ?? u.currentStock) : 0;
          if (u.purchaseQty !== desired)          { u.purchaseQty  = desired; dirty = true; }
          return dirty ? u : e;
        });
        if (!dirty) return prev;
        persistEntries(updated);
        return updated;
      });
    };
    bus.addEventListener('indents.updated', handler as EventListener);
    return () => bus.removeEventListener('indents.updated', handler as EventListener);
  }, []);

  // ─── Handlers ─────────────────────────────────────────────────────────
  const isQtyField  = (n: string) => n.includes('Qty') || n === 'originalIndentQty' || n === 'currentStock';
  const applyChange = (prev: PurchaseEntry, name: string, value: string): PurchaseEntry => ({
    ...prev, [name]: isQtyField(name) ? Math.max(0, Number(value)) : value,
  });

  const handleNewChange  = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setNewEntry(prev  => applyChange(prev,        e.target.name, e.target.value));
  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setEditEntry(prev => prev ? applyChange(prev, e.target.name, e.target.value) : prev);

  const handleAddEntry = () => {
    if (!newEntry.poNo || !newEntry.supplierName) { setNotice({ type: 'warn', msg: 'PO No and Supplier Name are required.' }); return; }
    const live = getLiveStock(newEntry);
    const saved = persistEntries([...entries, { ...newEntry, purchaseQty: newEntry.indentStatus === 'Open' ? live : 0 }]);
    setEntries(saved); setNewEntry(EMPTY_ENTRY); setShowAddForm(false);
    setNotice({ type: 'success', msg: 'Entry added.' });
  };

  const handleEdit = (i: number) => {
    setEditIndex(i); setEditEntry({ ...entries[i] });
    setTimeout(() => document.getElementById('purchase-edit-panel')?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const handleSaveEdit = () => {
    if (!editEntry || editIndex === null) return;
    if (!editEntry.poNo || !editEntry.supplierName) { setNotice({ type: 'warn', msg: 'PO No and Supplier Name are required.' }); return; }
    const live = getLiveStock(editEntry);
    const updated = [...entries];
    updated[editIndex] = { ...editEntry, purchaseQty: editEntry.indentStatus === 'Open' ? live : 0 };
    setEntries(persistEntries(updated)); setEditIndex(null); setEditEntry(null);
    setNotice({ type: 'success', msg: 'Entry updated.' });
  };

  const handleDelete = (i: number) => {
    if (!window.confirm('Delete this entry?')) return;
    const updated = entries.filter((_, j) => j !== i);
    setEntries(updated); persistEntries(updated);
    setNotice({ type: 'success', msg: 'Entry deleted.' });
  };

  const handleCancelEdit = () => { setEditIndex(null); setEditEntry(null); };

  // ─── Summary stats ─────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:  entries.length,
    open:   entries.filter(e => e.indentStatus === 'Open').length,
    closed: entries.filter(e => e.indentStatus === 'Closed').length,
    noPo:   entries.filter(e => !e.poNo).length,
    indentItems: openIndentItems.length + closedIndentItems.length,
  }), [entries, openIndentItems, closedIndentItems]);

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <div style={S.root}>

      {/* Top row */}
      <div style={S.topRow}>
        <h2 style={S.title}>Purchase Orders</h2>
        <div style={S.topBtns}>
          <button onClick={handleImportIndents} disabled={importing} style={{ ...S.btnOutline, ...(importing ? { opacity: 0.6, cursor: 'not-allowed' } : {}) }}>
            {importing ? 'Syncing…' : '↓ Sync from Indents'}
          </button>
          <button onClick={() => { setShowAddForm(p => !p); setEditIndex(null); setEditEntry(null); }} style={S.btnPrimary}>
            {showAddForm ? '✕ Cancel' : '+ Add Entry'}
          </button>
        </div>
      </div>

      {/* Notice */}
      {notice && <div style={S.notice(notice.type)}>{notice.msg}</div>}

      {/* Stats */}
      <div style={S.statsRow}>
        <div style={S.stat}>
          <div style={S.statVal}>{stats.total}</div>
          <div style={S.statLabel}>Total</div>
        </div>
        <div style={S.statDiv} />
        <div style={S.stat}>
          <div style={{ ...S.statVal, color: '#b45309' }}>{stats.open}</div>
          <div style={S.statLabel}>Open</div>
        </div>
        <div style={S.statDiv} />
        <div style={S.stat}>
          <div style={{ ...S.statVal, color: '#16a34a' }}>{stats.closed}</div>
          <div style={S.statLabel}>Closed</div>
        </div>
        {stats.noPo > 0 && <>
          <div style={S.statDiv} />
          <div style={S.stat}>
            <div style={{ ...S.statVal, color: '#ef4444' }}>{stats.noPo}</div>
            <div style={S.statLabel}>No PO No</div>
          </div>
        </>}
        <div style={{ ...S.statDiv, marginLeft: 'auto' }} />
        <div style={S.stat}>
          <div style={{ ...S.statVal, color: '#6b7280', fontSize: 16 }}>{stats.indentItems}</div>
          <div style={S.statLabel}>Indent Items</div>
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div style={S.formCard}>
          <p style={S.formTitle}>New Purchase Entry</p>
          <div style={S.grid}>
            <Field label="Order Date"     name="orderPlaceDate"    value={newEntry.orderPlaceDate}    onChange={handleNewChange} type="date" />
            <Field label="PO No"          name="poNo"              value={newEntry.poNo}              onChange={handleNewChange} required />
            <Field label="Supplier"       name="supplierName"      value={newEntry.supplierName}      onChange={handleNewChange} required />
            <div>
              <label style={S.label}>Item Name</label>
              <select name="itemName" value={newEntry.itemName} onChange={handleNewChange} style={S.select}>
                <option value="">Select…</option>
                {itemNames.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <Field label="Item Code"      name="itemCode"          value={newEntry.itemCode}          onChange={handleNewChange} />
            <Field label="Indent No"      name="indentNo"          value={newEntry.indentNo}          onChange={handleNewChange} />
            <Field label="Original Qty"   name="originalIndentQty" value={newEntry.originalIndentQty || ''} onChange={handleNewChange} type="number" />
            <Field label="PO Qty"         name="purchaseQty"       value={newEntry.purchaseQty       || ''} onChange={handleNewChange} type="number" />
            <Field label="Stock"          name="currentStock"      value={newEntry.currentStock      || ''} onChange={handleNewChange} type="number" />
            <SelectField label="Status"   name="indentStatus"      value={newEntry.indentStatus}      onChange={handleNewChange} options={INDENT_STATUS_OPTIONS} />
            <Field label="OA No"          name="oaNo"              value={newEntry.oaNo}              onChange={handleNewChange} />
            <Field label="GRN No"         name="grnNo"             value={newEntry.grnNo}             onChange={handleNewChange} />
            <Field label="Remarks"        name="remarks"           value={newEntry.remarks}           onChange={handleNewChange} />
          </div>
          <div style={S.formBtns}>
            <button onClick={handleAddEntry} style={S.btnPrimary}>Add Entry</button>
            <button onClick={() => { setShowAddForm(false); setNewEntry(EMPTY_ENTRY); }} style={S.btnOutline}>Cancel</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={S.tableCard}>
        {entries.length === 0 ? (
          <div style={S.emptyState}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
            <div style={{ fontWeight: 600, marginBottom: 4, color: '#374151' }}>No purchase orders yet</div>
            <div style={{ fontSize: 13 }}>Click "Sync from Indents" to pull data from indent module,<br />or use "+ Add Entry" to create manually.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ ...S.table, tableLayout: 'fixed', minWidth: 1100 }}>

              {/* Explicit column widths — prevents browser from collapsing narrow columns */}
              <colgroup>
                <col style={{ width: 36  }} />  {/* # */}
                <col style={{ width: 120 }} />  {/* Item */}
                <col style={{ width: 80  }} />  {/* Code */}
                <col style={{ width: 90  }} />  {/* Indent No */}
                <col style={{ width: 70  }} />  {/* OA No */}
                <col style={{ width: 96  }} />  {/* Order Date */}
                <col style={{ width: 90  }} />  {/* PO No */}
                <col style={{ width: 110 }} />  {/* Supplier */}
                <col style={{ width: 64  }} />  {/* Orig Qty */}
                <col style={{ width: 60  }} />  {/* PO Qty */}
                <col style={{ width: 72  }} />  {/* Stock */}
                <col style={{ width: 76  }} />  {/* Status */}
                <col style={{ width: 52  }} />  {/* Recv */}
                <col style={{ width: 44  }} />  {/* OK */}
                <col style={{ width: 44  }} />  {/* Rej */}
                <col style={{ width: 70  }} />  {/* GRN No */}
                <col />                          {/* Remarks — fills remaining */}
                <col style={{ width: 88  }} />  {/* Actions */}
              </colgroup>

              <thead>
                <tr>
                  {/* Group headers with subtle dividers */}
                  <th style={S.th}>#</th>

                  {/* Item info */}
                  <th style={{ ...S.th, borderLeft: '2px solid #e5e7eb' }}>Item</th>
                  <th style={S.th}>Code</th>
                  <th style={S.th}>Indent No</th>
                  <th style={S.th}>OA No</th>

                  {/* Order info */}
                  <th style={{ ...S.th, borderLeft: '2px solid #e5e7eb' }}>Order Date</th>
                  <th style={S.th}>PO No</th>
                  <th style={S.th}>Supplier</th>

                  {/* Qty / stock */}
                  <th style={{ ...S.th, borderLeft: '2px solid #e5e7eb', textAlign: 'right' }}>Orig Qty</th>
                  <th style={{ ...S.th, textAlign: 'right' }}>PO Qty</th>
                  <th style={{ ...S.th, textAlign: 'center' }}>Stock</th>
                  <th style={S.th}>Status</th>

                  {/* Receipt */}
                  <th style={{ ...S.th, borderLeft: '2px solid #e5e7eb', textAlign: 'right' }}>Recv</th>
                  <th style={{ ...S.th, textAlign: 'right' }}>OK</th>
                  <th style={{ ...S.th, textAlign: 'right' }}>Rej</th>

                  {/* Misc */}
                  <th style={{ ...S.th, borderLeft: '2px solid #e5e7eb' }}>GRN No</th>
                  <th style={S.th}>Remarks</th>
                  <th style={{ ...S.th, textAlign: 'center' }}></th>
                </tr>
              </thead>

              <tbody>
                {entries.map((e, i) => {
                  const { display: liveStock, isShort } = getLiveInfo(e);
                  const isEditing = i === editIndex;
                  const row: React.CSSProperties = { background: isEditing ? '#eff6ff' : i % 2 === 0 ? '#fff' : '#fafafa' };
                  const tdR: React.CSSProperties = { ...S.td, textAlign: 'right' };
                  const tdMono: React.CSSProperties = { ...S.td, fontFamily: 'ui-monospace, monospace', fontSize: 12 };
                  const divBorder: React.CSSProperties = { borderLeft: '2px solid #f1f3f7' };

                  return (
                    <tr key={i} style={row}>
                      {/* # */}
                      <td style={{ ...S.td, color: '#9ca3af', fontSize: 11, textAlign: 'center' }}>{i + 1}</td>

                      {/* Item info */}
                      <td style={{ ...S.td, fontWeight: 600, ...divBorder, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.itemName}>{e.itemName || '—'}</td>
                      <td style={{ ...tdMono, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.itemCode || '—'}</td>
                      <td style={{ ...tdMono, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.indentNo || '—'}</td>
                      <td style={{ ...S.td, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.oaNo || '—'}</td>

                      {/* Order info */}
                      <td style={{ ...S.td, ...divBorder, color: e.orderPlaceDate ? '#374151' : '#d1d5db', whiteSpace: 'nowrap' }}>{e.orderPlaceDate || 'Not set'}</td>
                      <td style={{ ...S.td, fontWeight: e.poNo ? 600 : 400, color: e.poNo ? '#374151' : '#ef4444', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.poNo || 'Not set'}</td>
                      <td style={{ ...S.td, color: e.supplierName ? '#374151' : '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.supplierName}>{e.supplierName || 'Not set'}</td>

                      {/* Qty / stock */}
                      <td style={{ ...tdR, ...divBorder }}>{e.originalIndentQty || '—'}</td>
                      <td style={tdR}>{e.indentStatus === 'Open' ? Math.abs(liveStock) : 0}</td>
                      <td style={{ ...S.td, textAlign: 'center' }}><StockBadge value={liveStock} isShort={isShort} /></td>
                      <td style={S.td}><StatusBadge status={e.indentStatus} /></td>

                      {/* Receipt */}
                      <td style={{ ...tdR, ...divBorder }}>{e.receivedQty}</td>
                      <td style={tdR}>{e.okQty}</td>
                      <td style={tdR}>{e.rejectedQty}</td>

                      {/* Misc */}
                      <td style={{ ...tdMono, ...divBorder, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.grnNo || '—'}</td>
                      <td style={{ ...S.td, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: '#6b7280' }} title={e.remarks || ''}>{e.remarks || '—'}</td>
                      <td style={{ ...S.td, textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button onClick={() => handleEdit(i)}   style={{ ...S.btnSm('#2563eb'), marginRight: 4 }}>Edit</button>
                        <button onClick={() => handleDelete(i)} style={S.btnSm('#ef4444')}>Del</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Panel */}
      {editEntry && (
        <div id="purchase-edit-panel" style={{ ...S.formCard, marginTop: 20, borderColor: '#3b82f6', borderWidth: 2 }}>
          <p style={{ ...S.formTitle, color: '#2563eb' }}>
            Editing — {editEntry.itemName || `Row ${(editIndex ?? 0) + 1}`}
          </p>
          <div style={S.grid}>
            <Field label="Order Date"     name="orderPlaceDate"    value={editEntry.orderPlaceDate}    onChange={handleEditChange} type="date" />
            <Field label="PO No"          name="poNo"              value={editEntry.poNo}              onChange={handleEditChange} required />
            <Field label="Supplier"       name="supplierName"      value={editEntry.supplierName}      onChange={handleEditChange} required />
            <div>
              <label style={S.label}>Item Name</label>
              <select name="itemName" value={editEntry.itemName} onChange={handleEditChange} style={S.select}>
                <option value="">Select…</option>
                {itemNames.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <Field label="Original Qty"   name="originalIndentQty" value={editEntry.originalIndentQty || ''} onChange={handleEditChange} type="number" />
            <Field label="PO Qty"         name="purchaseQty"       value={editEntry.purchaseQty       || ''} onChange={handleEditChange} type="number" />
            <Field label="Stock"          name="currentStock"      value={editEntry.currentStock      || ''} onChange={handleEditChange} type="number" />
            <SelectField label="Status"   name="indentStatus"      value={editEntry.indentStatus}      onChange={handleEditChange} options={INDENT_STATUS_OPTIONS} />
            <Field label="OA No"          name="oaNo"              value={editEntry.oaNo}              onChange={handleEditChange} />
            <Field label="GRN No"         name="grnNo"             value={editEntry.grnNo}             onChange={handleEditChange} />
            <Field label="Remarks"        name="remarks"           value={editEntry.remarks}           onChange={handleEditChange} />
          </div>
          <div style={S.divider} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleSaveEdit}    disabled={!editEntry.poNo || !editEntry.supplierName} style={{ ...S.btnPrimary, ...(!editEntry.poNo || !editEntry.supplierName ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}>Save Changes</button>
            <button onClick={handleCancelEdit}  style={S.btnOutline}>Cancel</button>
          </div>
          {(!editEntry.poNo || !editEntry.supplierName) && <p style={{ color: '#ef4444', fontSize: 12, margin: '8px 0 0' }}>PO No and Supplier Name are required.</p>}
        </div>
      )}

    </div>
  );
};

export default PurchaseModule;