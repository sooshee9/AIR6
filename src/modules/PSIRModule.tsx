import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import bus from '../utils/eventBus';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { addPsir, updatePsir, subscribePsirs, deletePsir } from '../utils/psirService';
import { getItemMaster, getPurchaseData, getStockRecords, getPurchaseOrders } from '../utils/firestoreServices';

// ─── Types ────────────────────────────────────────────────────────────────────
interface PSIRItem {
  itemName: string;
  itemCode: string;
  qtyReceived: number;
  okQty: number;
  rejectQty: number;
  grnNo: string;
  remarks: string;
  poQty?: number;
}

interface PSIR {
  id?: string;
  userId?: string;
  receivedDate: string;
  indentNo: string;
  poNo: string;
  oaNo: string;
  batchNo: string;
  invoiceNo: string;
  supplierName: string;
  items: PSIRItem[];
  createdAt?: any;
  updatedAt?: any;
}

interface PurchaseOrder {
  poNo: string;
  indentNo?: string;
  supplierName?: string;
  orderPlaceDate?: string;
  items?: { poNo?: string; indentNo?: string; itemName?: string; itemCode?: string }[];
  oaNo?: string;
}

// ─── Design System (same tokens as IndentModule) ──────────────────────────────
const S = {
  bg: '#F7F8FC',
  surface: '#FFFFFF',
  border: '#E4E8F0',
  borderStrong: '#CBD2E0',
  accent: '#3B5BDB',
  accentLight: '#EEF2FF',
  success: '#2F9E44',
  successLight: '#EBFBEE',
  danger: '#C92A2A',
  dangerLight: '#FFF5F5',
  warning: '#E67700',
  warningLight: '#FFF9DB',
  textPrimary: '#1A1F36',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',

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
    fontFamily: 'inherit',
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
    display: 'inline-flex' as const,
    alignItems: 'center',
    gap: 6,
    transition: 'background 0.15s',
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
    display: 'inline-flex' as const,
    alignItems: 'center',
    gap: 6,
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
    display: 'inline-flex' as const,
    alignItems: 'center',
    gap: 6,
    transition: 'background 0.15s, border-color 0.15s',
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
    maxWidth: 180,
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
          boxShadow: '0 4px 16px rgba(0,0,0,0.18)', animation: 'psirSlideUp 0.2s ease',
          maxWidth: 360, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'ℹ'} {t.msg}
        </div>
      ))}
    </div>
  );
}

// ─── Small reusable components ────────────────────────────────────────────────
function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, ...style }}>
      <span style={S.label}>{label}</span>
      {children}
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ ...S.card, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 110, flex: 1 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: S.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      <span style={{ fontSize: 26, fontWeight: 800, color: color || S.textPrimary, lineHeight: 1.2 }}>{value}</span>
      {sub && <span style={{ fontSize: 12, color: S.textSecondary }}>{sub}</span>}
    </div>
  );
}

function NumBadge({ value, positive = true }: { value: number; positive?: boolean }) {
  const color = positive ? S.success : S.danger;
  const bg = positive ? S.successLight : S.dangerLight;
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 6,
      fontWeight: 700, fontSize: 13, background: bg, color, minWidth: 36, textAlign: 'center',
    }}>
      {value}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
const PSIRModule: React.FC = () => {
  const [psirs, setPsirs] = useState<PSIR[]>([]);
  const [itemMaster, setItemMaster] = useState<{ itemName: string; itemCode: string }[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [purchaseData, setPurchaseData] = useState<any[]>([]);
  const [, setStockRecords] = useState<any[]>([]);
  const [userUid, setUserUid] = useState<string | null>(null);
  const [processedPOs, setProcessedPOs] = useState<Set<string>>(new Set());
  const [deletedPOKeys, setDeletedPOKeys] = useState<Set<string>>(new Set());
  const [editPSIRIdx, setEditPSIRIdx] = useState<number | null>(null);
  const [editItemIdx, setEditItemIdx] = useState<number | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const activeFilterCount = [filterText, filterSupplier, filterDateFrom, filterDateTo].filter(Boolean).length;

  const [newPSIR, setNewPSIR] = useState<PSIR>({
    receivedDate: '', indentNo: '', poNo: '', oaNo: '',
    batchNo: '', invoiceNo: '', supplierName: '', items: [],
  });

  const [itemInput, setItemInput] = useState<PSIRItem>({
    itemName: '', itemCode: '', qtyReceived: 0, okQty: 0, rejectQty: 0, grnNo: '', remarks: '',
  });

  const unsubRef = useRef<(() => void) | null>(null);
  const psirRepairRef = useRef(false);

  const showToast = useCallback((msg: string, type: Toast['type'] = 'info') => {
    const id = ++toastCounter;
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // ─── Auth ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUserUid(u ? u.uid : null));
    return () => unsub();
  }, []);

  // ─── PSIR subscription ────────────────────────────────────────────────────
  useEffect(() => {
    if (!userUid) { setPsirs([]); return; }

    if (unsubRef.current) { try { unsubRef.current(); } catch {} }

    unsubRef.current = subscribePsirs(userUid, (docs) => {
      const normalized = docs.map((d: any) => ({ ...d, items: Array.isArray(d.items) ? d.items : [] })) as PSIR[];
      setPsirs(normalized);
      const existingPOs = new Set(normalized.map(p => p.poNo).filter(Boolean));
      const existingIndents = new Set(normalized.map(p => `INDENT::${p.indentNo}`).filter(id => id !== 'INDENT::'));
      setProcessedPOs(new Set([...existingPOs, ...existingIndents]));
    });

    return () => { if (unsubRef.current) { try { unsubRef.current(); } catch {} unsubRef.current = null; } };
  }, [userUid]);

  // ─── Load static data ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!userUid) return;
    Promise.all([
      getItemMaster(userUid),
      getPurchaseData(userUid),
      getStockRecords(userUid),
      getPurchaseOrders(userUid),
    ]).then(([im, pd, sr, po]) => {
      if (Array.isArray(im)) setItemMaster(im as any);
      if (Array.isArray(pd)) setPurchaseData(pd);
      if (Array.isArray(sr)) setStockRecords(sr);
      if (Array.isArray(po)) {
        setPurchaseOrders(po as any as PurchaseOrder[]);
        if (po.length > 0 && !newPSIR.poNo) {
          const latest: any = po[po.length - 1];
          setNewPSIR(prev => ({
            ...prev,
            poNo: latest.poNo || '',
            supplierName: latest.supplierName || '',
            indentNo: latest.indentNo || '',
          }));
        }
      }
    }).catch(() => {});
  }, [userUid]);

  // ─── Auto-fill from PO selection ──────────────────────────────────────────
  useEffect(() => {
    if (!newPSIR.poNo) return;
    const ordersToSearch = purchaseOrders.length > 0 ? purchaseOrders : purchaseData;
    const matchingPO = ordersToSearch.find(po => po.poNo === newPSIR.poNo);
    if (!matchingPO) return;

    setNewPSIR(prev => ({
      ...prev,
      indentNo: matchingPO.indentNo || prev.indentNo,
      oaNo: (matchingPO as any).oaNo || prev.oaNo,
      supplierName: matchingPO.supplierName || prev.supplierName,
    }));

    if (matchingPO.items && matchingPO.items.length > 0) {
      const first = matchingPO.items[0] as any;
      setItemInput(prev => ({
        ...prev,
        itemName: first.itemName || first.Item || prev.itemName,
        itemCode: first.itemCode || first.Code || prev.itemCode,
      }));
    }
  }, [newPSIR.poNo, purchaseOrders, purchaseData]);

  // ─── Auto-fill item code from item name ───────────────────────────────────
  useEffect(() => {
    if (itemInput.itemName && itemMaster.length > 0) {
      const matched = itemMaster.find(i => i.itemName === itemInput.itemName);
      if (matched && matched.itemCode !== itemInput.itemCode) {
        setItemInput(prev => ({ ...prev, itemCode: matched.itemCode }));
      }
    }
  }, [itemInput.itemName, itemMaster]);

  // ─── Auto batch no on invoice entry ───────────────────────────────────────
  useEffect(() => {
    if (newPSIR.invoiceNo && !newPSIR.batchNo) {
      setNewPSIR(prev => ({ ...prev, batchNo: getNextBatchNo() }));
    }
  }, [newPSIR.invoiceNo, psirs]);

  // ─── One-time repair of mismatched qtyReceived ───────────────────────────
  useEffect(() => {
    if (psirRepairRef.current || !psirs.length || !userUid) return;
    psirRepairRef.current = true;

    let restoredCount = 0;
    const repaired = psirs.map(psir => ({
      ...psir,
      items: (psir.items || []).map((item: any) => {
        try {
          const details = getPOQtyMatchDetails(psir.poNo, psir.indentNo, item.itemCode);
          const matched = details?.matchedEntry;
          if (!matched) return item;
          const purchaseQty = Number(matched.purchaseQty ?? matched.poQty ?? 0) || 0;
          const originalQty = Number(matched.originalIndentQty ?? matched.originalQty ?? matched.qty ?? 0) || 0;
          if (purchaseQty > 0 && originalQty > 0 && Number(item.qtyReceived || 0) === purchaseQty && originalQty !== purchaseQty) {
            restoredCount++;
            return { ...item, qtyReceived: originalQty };
          }
        } catch {}
        return item;
      }),
    }));

    if (restoredCount > 0) {
      setPsirs(repaired);
      Promise.all(repaired.map(async (p: any) => {
        if (p?.id) await updatePsir(p.id, { items: p.items }).catch(() => {});
      })).catch(() => {});
    }
  }, [psirs, userUid]);

  // ─── Clean up orphaned PSIRs ──────────────────────────────────────────────
  useEffect(() => {
    const ordersToCheck = purchaseOrders.length > 0 ? purchaseOrders : purchaseData;
    if (!userUid || !psirs.length || !ordersToCheck.length) return;

    const existingKeys = new Set<string>();
    ordersToCheck.forEach(o => {
      if (o.poNo) existingKeys.add(String(o.poNo).trim());
      if (o.indentNo) existingKeys.add(`INDENT::${String(o.indentNo).trim()}`);
    });

    const orphaned = psirs
      .filter(p => {
        const poNo = String(p.poNo || '').trim();
        const indentNo = String(p.indentNo || '').trim();
        const key = poNo || `INDENT::${indentNo}`;
        return !existingKeys.has(key) && !existingKeys.has(poNo) && !existingKeys.has(`INDENT::${indentNo}`);
      })
      .map(p => (p as any).id)
      .filter(Boolean);

    if (!orphaned.length) return;

    Promise.all(orphaned.map((id: string) => deletePsir(id))).then(() => {
      setPsirs(prev => prev.filter(p => !(p as any).id || !orphaned.includes((p as any).id)));
    }).catch(() => {});
  }, [userUid, psirs, purchaseOrders, purchaseData]);

  // ─── Event bus listeners ──────────────────────────────────────────────────
  useEffect(() => {
    const handler = () => {
      setPsirs(prev => prev.map(p => ({ ...p, items: Array.isArray(p.items) ? [...p.items] : p.items })));
    };
    try {
      bus.addEventListener('purchaseOrders.updated', handler as EventListener);
      bus.addEventListener('purchaseData.updated', handler as EventListener);
    } catch {}
    return () => {
      try {
        bus.removeEventListener('purchaseOrders.updated', handler as EventListener);
        bus.removeEventListener('purchaseData.updated', handler as EventListener);
      } catch {}
    };
  }, []);

  // ─── Business logic helpers ───────────────────────────────────────────────
  const getNextBatchNo = useCallback((): string => {
    const yearSuffix = String(new Date().getFullYear()).slice(-2);
    const nums = psirs
      .map(p => p.batchNo)
      .filter(b => b && b.includes('P'))
      .map(b => { const m = b.match(/P(\d+)/); return m ? parseInt(m[1], 10) : 0; })
      .filter(n => n > 0);
    const max = nums.length > 0 ? Math.max(...nums) : 0;
    return `${yearSuffix}/P${max + 1}`;
  }, [psirs]);

  const getPOQtyFor = useCallback((poNo: string | undefined, indentNo: string | undefined, itemCode: string | undefined): number => {
    try {
      const norm = (v: any) => v == null ? '' : String(v).trim().toUpperCase();
      const targetCode = norm(itemCode), targetPo = norm(poNo), targetIndent = norm(indentNo);
      const candidateCodes = (e: any) => [e.itemCode, e.Code, e.CodeNo, e.Item].map(norm);
      const extractQty = (e: any) => Number(e.purchaseQty ?? e.poQty ?? e.qty ?? e.originalIndentQty ?? 0) || 0;

      const mergedMap = new Map<string, any>();
      const mergeKey = (e: any) => `${norm(e.poNo)}|${norm(e.indentNo)}|${norm(e.itemCode||e.Code||e.Item||'')}`;
      purchaseOrders.forEach(e => mergedMap.set(mergeKey(e), e));
      purchaseData.forEach(e => mergedMap.set(mergeKey(e), e));
      const arr = Array.from(mergedMap.values());

      const byPoCode = arr.find(e => targetPo && norm(e.poNo) === targetPo && candidateCodes(e).includes(targetCode));
      if (byPoCode) return extractQty(byPoCode);
      const byIndentCode = arr.find(e => norm(e.indentNo) === targetIndent && candidateCodes(e).includes(targetCode));
      if (byIndentCode) return extractQty(byIndentCode);
      const byCode = arr.find(e => candidateCodes(e).includes(targetCode));
      if (byCode) return extractQty(byCode);
      return 0;
    } catch { return 0; }
  }, [purchaseOrders, purchaseData]);

  // Same as getPOQtyFor but returns match details for supplier lookup etc.
  const getPOQtyMatchDetails = useCallback((poNo: string | undefined, indentNo: string | undefined, itemCode: string | undefined) => {
    const details: any = { matched: false, matchedEntry: null, qty: 0 };
    try {
      const norm = (v: any) => v == null ? '' : String(v).trim().toUpperCase();
      const targetCode = norm(itemCode), targetPo = norm(poNo), targetIndent = norm(indentNo);
      const candidateCodes = (e: any) => [e.itemCode, e.Code, e.CodeNo, e.Item].map(norm);
      const extractQty = (e: any) => Number(e.purchaseQty ?? e.poQty ?? e.qty ?? e.originalIndentQty ?? 0) || 0;
      const mergedMap = new Map<string, any>();
      const mergeKey = (e: any) => `${norm(e.poNo)}|${norm(e.indentNo)}|${norm(e.itemCode||e.Code||e.Item||'')}`;
      purchaseOrders.forEach(e => mergedMap.set(mergeKey(e), e));
      purchaseData.forEach(e => mergedMap.set(mergeKey(e), e));
      const arr = Array.from(mergedMap.values());

      const byPoCode = arr.find(e => targetPo && norm(e.poNo) === targetPo && candidateCodes(e).includes(targetCode));
      if (byPoCode) { details.matched = true; details.matchedEntry = byPoCode; details.qty = extractQty(byPoCode); return details; }
      const byIndentCode = arr.find(e => norm(e.indentNo) === targetIndent && candidateCodes(e).includes(targetCode));
      if (byIndentCode) { details.matched = true; details.matchedEntry = byIndentCode; details.qty = extractQty(byIndentCode); return details; }
      const byCode = arr.find(e => candidateCodes(e).includes(targetCode));
      if (byCode) { details.matched = true; details.matchedEntry = byCode; details.qty = extractQty(byCode); return details; }
    } catch {}
    return details;
  }, [purchaseOrders, purchaseData]);

  // ─── Import all POs ───────────────────────────────────────────────────────
  const importAllPurchaseOrdersToPSIR = useCallback((forceImport = false) => {
    const ordersToImport = purchaseOrders.length > 0 ? purchaseOrders : purchaseData;
    if (!ordersToImport.length) { showToast('No purchase orders found to import', 'error'); return; }
    if (!userUid) { showToast('User not authenticated', 'error'); return; }

    let importedCount = 0;
    const newPSIRs: PSIR[] = [];

    ordersToImport.forEach((order: any) => {
      const poNo = String(order.poNo || '').trim();
      const indentNo = String(order.indentNo || '').trim();
      if (!poNo) return;

      const oaNoFromPurchase = purchaseData.find((p: any) =>
        (poNo && String(p.poNo || '').trim() === poNo) || (indentNo && String(p.indentNo || '').trim() === indentNo)
      )?.oaNo || '';

      const orderKey = poNo;
      if (!forceImport && processedPOs.has(orderKey)) return;
      if (deletedPOKeys.has(orderKey)) return;

      const existingIdx = psirs.findIndex(p => String(p.poNo || '').trim() === poNo);

      let itemsFromPO: PSIRItem[] = [];
      if (Array.isArray(order.items) && order.items.length > 0) {
        itemsFromPO = order.items.map((it: any) => {
          const code = it.itemCode || it.Code || '';
          return { itemName: it.itemName || it.Item || it.model || '', itemCode: code, qtyReceived: 0, okQty: 0, rejectQty: 0, grnNo: '', remarks: '', poQty: getPOQtyFor(poNo, indentNo, code) };
        });
      } else {
        const topName = order.itemName || order.Item || order.model || '';
        const topCode = order.itemCode || order.Code || order.CodeNo || '';
        if (topName || topCode) {
          itemsFromPO = [{ itemName: topName, itemCode: topCode, qtyReceived: 0, okQty: 0, rejectQty: 0, grnNo: '', remarks: '', poQty: getPOQtyFor(poNo, indentNo, topCode) }];
        } else {
          const matched = purchaseData.filter((p: any) => (poNo && String(p.poNo || '').trim() === poNo) || (indentNo && String(p.indentNo || '').trim() === indentNo));
          if (matched.length > 0) {
            if (!order.supplierName && matched[0].supplierName) order.supplierName = matched[0].supplierName;
            itemsFromPO = matched.map((p: any) => { const code = p.itemCode || p.Code || p.CodeNo || ''; return { itemName: p.itemName || p.Item || p.model || '', itemCode: code, qtyReceived: 0, okQty: 0, rejectQty: 0, grnNo: '', remarks: '', poQty: getPOQtyFor(poNo, indentNo, code) }; });
          } else {
            itemsFromPO = [{ itemName: '', itemCode: '', qtyReceived: 0, okQty: 0, rejectQty: 0, grnNo: '', remarks: '' }];
          }
        }
      }

      if (existingIdx !== -1) {
        const existing = psirs[existingIdx];
        const newRec = { ...existing };
        let updated = false;
        if (!newRec.supplierName && order.supplierName) { newRec.supplierName = order.supplierName; updated = true; }
        if (!newRec.oaNo && oaNoFromPurchase) { newRec.oaNo = oaNoFromPurchase; updated = true; }
        if (!newRec.items?.length && itemsFromPO.length) { newRec.items = itemsFromPO; updated = true; }
        if (updated) {
          setPsirs(prev => prev.map((p, i) => i === existingIdx ? newRec : p));
          if (userUid && (newRec as any).id) updatePsir((newRec as any).id, newRec).catch(() => {});
          importedCount++;
          setProcessedPOs(prev => new Set([...prev, orderKey]));
        }
      } else {
        newPSIRs.push({ receivedDate: new Date().toISOString().slice(0, 10), indentNo, poNo, oaNo: oaNoFromPurchase || '', batchNo: '', invoiceNo: '', supplierName: order.supplierName || '', items: itemsFromPO });
        importedCount++;
        setProcessedPOs(prev => new Set([...prev, orderKey]));
      }
    });

    if (importedCount > 0) {
      setPsirs(prev => {
        const updated = [...prev, ...newPSIRs];
        newPSIRs.forEach(psir => { if (userUid) addPsir(userUid, psir).catch(() => {}); });
        try { bus.dispatchEvent(new CustomEvent('psir.updated', { detail: { psirs: updated } })); } catch {}
        return updated;
      });
      showToast(`✓ Imported ${importedCount} purchase order${importedCount !== 1 ? 's' : ''} to PSIR`, 'success');
    } else {
      showToast('No new purchase orders to import — all already processed', 'info');
    }
  }, [purchaseOrders, purchaseData, processedPOs, deletedPOKeys, psirs, userUid, getPOQtyFor, showToast]);

  // ─── Item handlers ────────────────────────────────────────────────────────
  const handleItemInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const newValue = type === 'number' ? (value === '' ? 0 : Number(value)) : value;
    setItemInput(prev => ({ ...prev, [name]: newValue }));
  }, []);

  const validateItemQty = (input: PSIRItem): boolean => {
    let qty = Number(input.qtyReceived) || 0;
    const ok = Number(input.okQty) || 0;
    const rej = Number(input.rejectQty) || 0;
    if (qty <= 0) qty = ok + rej;
    if (qty !== ok + rej) { showToast('Qty Received must equal OK Qty + Reject Qty', 'error'); return false; }
    return true;
  };

  const handleAddItem = useCallback(() => {
    if (!itemInput.itemName || !itemInput.itemCode) { showToast('Item Name and Item Code are required', 'error'); return; }
    if (!validateItemQty(itemInput)) return;
    let qty = Number(itemInput.qtyReceived) || 0;
    if (qty <= 0) qty = (Number(itemInput.okQty) || 0) + (Number(itemInput.rejectQty) || 0);
    const poQ = getPOQtyFor(newPSIR.poNo, newPSIR.indentNo, itemInput.itemCode);
    if (editItemIdx !== null) {
      setNewPSIR(prev => ({ ...prev, items: prev.items.map((it, i) => i === editItemIdx ? { ...itemInput, qtyReceived: qty, poQty: poQ } : it) }));
      setEditItemIdx(null);
    } else {
      setNewPSIR(prev => ({ ...prev, items: [...prev.items, { ...itemInput, qtyReceived: qty, poQty: poQ }] }));
    }
    setItemInput({ itemName: '', itemCode: '', qtyReceived: 0, okQty: 0, rejectQty: 0, grnNo: '', remarks: '' });
  }, [itemInput, editItemIdx, newPSIR, getPOQtyFor, showToast]);

  // ─── PSIR save / update ───────────────────────────────────────────────────
  const handleAddPSIR = useCallback(() => {
    if (!newPSIR.receivedDate || !newPSIR.indentNo || !newPSIR.poNo || !newPSIR.invoiceNo || !newPSIR.supplierName || !newPSIR.items.length) {
      showToast('All header fields and at least one item are required', 'error'); return;
    }
    if (!userUid) { showToast('User not authenticated', 'error'); return; }

    const toSave = { ...newPSIR, batchNo: newPSIR.batchNo.trim() || getNextBatchNo(), items: newPSIR.items.map(it => ({ ...it, poQty: getPOQtyFor(newPSIR.poNo, newPSIR.indentNo, it.itemCode) })) };
    addPsir(userUid, toSave).then(() => showToast('PSIR saved successfully', 'success')).catch(e => showToast('Error saving PSIR: ' + String(e), 'error'));

    setNewPSIR({ receivedDate: '', indentNo: '', poNo: '', oaNo: '', batchNo: '', invoiceNo: '', supplierName: '', items: [] });
    setItemInput({ itemName: '', itemCode: '', qtyReceived: 0, okQty: 0, rejectQty: 0, grnNo: '', remarks: '' });
    setEditPSIRIdx(null);
  }, [newPSIR, userUid, getNextBatchNo, getPOQtyFor, showToast]);

  const handleUpdatePSIR = useCallback(() => {
    if (editPSIRIdx === null) return;
    if (!newPSIR.receivedDate || !newPSIR.indentNo || !newPSIR.poNo || !newPSIR.invoiceNo || !newPSIR.supplierName || !newPSIR.items.length) {
      showToast('All header fields and at least one item are required', 'error'); return;
    }
    const target = psirs[editPSIRIdx];
    const docId = target && (target as any).id;
    if (!userUid || !docId) { showToast('Cannot save: missing user or record ID', 'error'); return; }

    const toSave = { ...newPSIR, batchNo: newPSIR.batchNo.trim() || getNextBatchNo(), items: newPSIR.items.map(it => ({ ...it, qtyReceived: Number(it.qtyReceived) || 0, okQty: Number(it.okQty) || 0, rejectQty: Number(it.rejectQty) || 0, poQty: getPOQtyFor(newPSIR.poNo, newPSIR.indentNo, it.itemCode) })) };

    setPsirs(prev => prev.map((p, i) => i === editPSIRIdx ? { ...p, ...toSave, id: (p as any).id } : p));
    updatePsir(docId, toSave).then(() => showToast('PSIR updated successfully', 'success')).catch(e => showToast('Firestore update failed: ' + String(e), 'error'));
    try { bus.dispatchEvent(new CustomEvent('psir.updated', { detail: { psirs } })); } catch {}

    setNewPSIR({ receivedDate: '', indentNo: '', poNo: '', oaNo: '', batchNo: '', invoiceNo: '', supplierName: '', items: [] });
    setItemInput({ itemName: '', itemCode: '', qtyReceived: 0, okQty: 0, rejectQty: 0, grnNo: '', remarks: '' });
    setEditPSIRIdx(null);
  }, [editPSIRIdx, newPSIR, psirs, userUid, getNextBatchNo, getPOQtyFor, showToast]);

  // ─── Delete item ──────────────────────────────────────────────────────────
  const handleDeleteItem = useCallback(async (psirIdx: number, itemIdx: number) => {
    const target = psirs[psirIdx];
    if (!target || !userUid) { showToast('Cannot delete: missing data or auth', 'error'); return; }
    const psirId = (target as any).id;
    if (!psirId) { showToast('Cannot delete: record has no ID', 'error'); return; }

    const updatedTarget = { ...target, items: target.items.filter((_, i) => i !== itemIdx) };
    const isDeleting = updatedTarget.items.length === 0;

    try {
      if (isDeleting) {
        await deletePsir(psirId);
        const poNo = String(target.poNo || '').trim();
        const indentNo = String(target.indentNo || '').trim();
        setDeletedPOKeys(prev => new Set([...prev, poNo || `INDENT::${indentNo}`]));
      } else {
        await updatePsir(psirId, updatedTarget);
      }
      setPsirs(prev => {
        const updated = prev.map((p, i) => i !== psirIdx ? p : updatedTarget).filter(p => p.items.length > 0);
        try { bus.dispatchEvent(new CustomEvent('psir.updated', { detail: { psirs: updated } })); } catch {}
        return updated;
      });
      showToast(isDeleting ? 'PSIR record deleted' : 'Item removed', 'success');
    } catch (e) {
      showToast('Delete failed: ' + String((e as any)?.message || e), 'error');
    }
  }, [psirs, userUid, showToast]);

  // ─── Flattened rows (memoized) ────────────────────────────────────────────
  const allRows = useMemo(() => {
    return psirs.flatMap((psir, psirIdx) =>
      (psir.items || []).map((item, itemIdx) => ({
        psirIdx, itemIdx, psir,
        poQty: Math.abs(getPOQtyFor(psir.poNo, psir.indentNo, item.itemCode)),
        item,
      }))
    );
  }, [psirs, getPOQtyFor]);

  // ─── Filtered rows ────────────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    return allRows.filter(r => {
      if (filterSupplier && r.psir.supplierName !== filterSupplier) return false;
      if (filterDateFrom && r.psir.receivedDate < filterDateFrom) return false;
      if (filterDateTo && r.psir.receivedDate > filterDateTo) return false;
      if (filterText) {
        const q = filterText.toLowerCase();
        const fields = [r.psir.indentNo, r.psir.poNo, r.psir.oaNo, r.psir.batchNo, r.psir.invoiceNo, r.psir.supplierName, r.item.itemName, r.item.itemCode, r.item.grnNo];
        if (!fields.some(f => String(f || '').toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [allRows, filterText, filterSupplier, filterDateFrom, filterDateTo]);

  // ─── Unique suppliers for filter dropdown ─────────────────────────────────
  const uniqueSuppliers = useMemo(() => [...new Set(psirs.map(p => p.supplierName).filter(Boolean))].sort(), [psirs]);

  // ─── Stats ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalOK = allRows.reduce((s, r) => s + (Number(r.item.okQty) || 0), 0);
    const totalRej = allRows.reduce((s, r) => s + (Number(r.item.rejectQty) || 0), 0);
    return { psirCount: psirs.length, lineCount: allRows.length, totalOK, totalRej };
  }, [allRows, psirs]);

  // ─── CSV export ───────────────────────────────────────────────────────────
  const exportToCSV = useCallback(() => {
    const headers = ['Received Date', 'Indent No', 'OA No', 'PO No', 'Batch No', 'Invoice No', 'Supplier Name', 'Item Name', 'Item Code', 'PO Qty', 'Qty Received', 'OK Qty', 'Reject Qty', 'GRN No', 'Remarks'];
    const today = new Date().toISOString().slice(0, 10);
    const escape = (v: any) => { const s = String(v ?? ''); return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s; };
    const rows = filteredRows.map(r => [r.psir.receivedDate, r.psir.indentNo, r.psir.oaNo, r.psir.poNo, r.psir.batchNo, r.psir.invoiceNo, r.psir.supplierName, r.item.itemName, r.item.itemCode, r.poQty, r.item.qtyReceived, r.item.okQty, r.item.rejectQty, r.item.grnNo, r.item.remarks]);
    const csv = '\uFEFF' + [headers, ...rows].map(row => row.map(escape).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `PSIR_${today}.csv`; a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${filteredRows.length} rows`, 'success');
  }, [filteredRows, showToast]);

  // ─── Render ───────────────────────────────────────────────────────────────
  const isEditing = editPSIRIdx !== null;

  return (
    <>
      <style>{`
        @keyframes psirSlideUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        .ps-btn:hover { opacity: 0.88; }
        .ps-row:hover td { background: #F7F8FF !important; }
        .ps-input:focus { border-color: #3B5BDB !important; box-shadow: 0 0 0 3px rgba(59,91,219,0.12); }
        .ps-ghost:hover { background: #F7F8FC !important; border-color: #CBD2E0 !important; }
        .ps-danger:hover { background: #FFF5F5 !important; }
        .ps-edit:hover { background: #C5D0FA !important; }
        * { box-sizing: border-box; }
      `}</style>

      <ToastContainer toasts={toasts} />

      <div style={{ background: S.bg, minHeight: '100vh', fontFamily: "'Geist', 'DM Sans', system-ui, sans-serif" }}>
        <div style={{ maxWidth: 1500, margin: '0 auto', padding: '24px 24px 48px' }}>

          {/* ── Header ───────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: S.textPrimary, letterSpacing: '-0.02em' }}>
                PSIR Module
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: 14, color: S.textSecondary }}>
                Purchase Store Inspection Report — receive, inspect and record stock
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="ps-btn ps-ghost"
                style={{ ...S.btnGhost, opacity: (!purchaseOrders.length && !purchaseData.length) || !userUid ? 0.5 : 1 }}
                disabled={(!purchaseOrders.length && !purchaseData.length) || !userUid}
                onClick={() => importAllPurchaseOrdersToPSIR(true)}
              >
                ↓ Import POs
              </button>
              <button className="ps-btn" style={S.btnGhost} onClick={exportToCSV}>
                ↓ Export CSV
              </button>
            </div>
          </div>

          {/* ── Stats bar ─────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
            <StatCard label="PSIR Records" value={stats.psirCount} />
            <StatCard label="Total Lines" value={stats.lineCount} />
            <StatCard label="Total OK Qty" value={stats.totalOK} color={S.success} sub="Accepted" />
            <StatCard label="Total Reject" value={stats.totalRej} color={stats.totalRej > 0 ? S.danger : S.textMuted} sub="Rejected" />
            <StatCard label="POs Loaded" value={purchaseOrders.length} color={purchaseOrders.length === 0 ? S.warning : S.textPrimary} sub={purchaseOrders.length === 0 ? 'Loading…' : 'orders'} />
            <StatCard label="Processed" value={processedPOs.size} color={S.accent} sub="PO keys" />
            <StatCard label="User" value={userUid ? '✓' : '✗'} color={userUid ? S.success : S.danger} sub={userUid ? 'Authenticated' : 'Not signed in'} />
          </div>

          {/* ── Create / Edit PSIR Form ────────────────────────────────────── */}
          <div style={{ ...S.card, marginBottom: 24 }}>
            <h2 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700, color: S.textPrimary }}>
              {isEditing ? '✎ Edit PSIR' : 'New PSIR'}
            </h2>

            {/* Header fields */}
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
              <Field label="Received Date">
                <input type="date" className="ps-input" style={{ ...S.input, width: 160 }}
                  value={newPSIR.receivedDate}
                  onChange={e => setNewPSIR(p => ({ ...p, receivedDate: e.target.value }))} />
              </Field>
              <Field label="Indent No">
                <input className="ps-input" style={{ ...S.input, width: 140 }} placeholder="e.g. S-8/25-01"
                  value={newPSIR.indentNo}
                  onChange={e => setNewPSIR(p => ({ ...p, indentNo: e.target.value }))} />
              </Field>
              <Field label="OA No">
                <input className="ps-input" style={{ ...S.input, width: 130 }} placeholder="OA No"
                  value={newPSIR.oaNo}
                  onChange={e => setNewPSIR(p => ({ ...p, oaNo: e.target.value }))} />
              </Field>
              <Field label="PO No">
                {purchaseOrders.length > 0 ? (
                  <select className="ps-input" style={{ ...S.input, width: 160 }}
                    value={newPSIR.poNo}
                    onChange={e => setNewPSIR(p => ({ ...p, poNo: e.target.value }))}>
                    <option value="">Select PO…</option>
                    {purchaseOrders.map(po => (
                      <option key={po.poNo} value={po.poNo}>{po.poNo}</option>
                    ))}
                  </select>
                ) : (
                  <input className="ps-input" style={{ ...S.input, width: 160 }} placeholder="PO No"
                    value={newPSIR.poNo}
                    onChange={e => setNewPSIR(p => ({ ...p, poNo: e.target.value }))} />
                )}
              </Field>
              <Field label="Batch No">
                <div style={{ display: 'flex', gap: 6 }}>
                  <input className="ps-input" style={{ ...S.input, width: 130 }} placeholder="Auto"
                    value={newPSIR.batchNo}
                    onChange={e => setNewPSIR(p => ({ ...p, batchNo: e.target.value }))} />
                  <button className="ps-btn" style={{ ...S.btnGhost, padding: '8px 10px', fontSize: 13 }}
                    onClick={() => setNewPSIR(p => ({ ...p, batchNo: getNextBatchNo() }))}>
                    Auto
                  </button>
                </div>
              </Field>
              <Field label="Invoice No">
                <input className="ps-input" style={{ ...S.input, width: 140 }} placeholder="Invoice No"
                  value={newPSIR.invoiceNo}
                  onChange={e => setNewPSIR(p => ({ ...p, invoiceNo: e.target.value }))} />
              </Field>
              <Field label="Supplier Name">
                <input className="ps-input" style={{ ...S.input, minWidth: 180 }} placeholder="Supplier"
                  value={newPSIR.supplierName}
                  onChange={e => setNewPSIR(p => ({ ...p, supplierName: e.target.value }))} />
              </Field>
            </div>

            {/* Divider */}
            <div style={{ borderTop: `1px dashed ${S.border}`, margin: '0 0 20px' }} />

            {/* Item entry */}
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
              <Field label="Item Name">
                {itemMaster.length > 0 ? (
                  <select name="itemName" className="ps-input" style={{ ...S.input, minWidth: 220 }}
                    value={itemInput.itemName} onChange={handleItemInputChange}>
                    <option value="">Select item…</option>
                    {[...new Set(itemMaster.map(i => i.itemName))].map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                ) : (
                  <input name="itemName" className="ps-input" style={{ ...S.input, minWidth: 200 }}
                    placeholder="Item Name" value={itemInput.itemName} onChange={handleItemInputChange} />
                )}
              </Field>
              <Field label="Item Code">
                <input className="ps-input" style={{ ...S.inputDisabled, width: 130 }}
                  placeholder="Auto-filled" value={itemInput.itemCode} readOnly />
              </Field>
              <Field label="Qty Received">
                <input type="number" name="qtyReceived" className="ps-input" style={{ ...S.input, width: 100 }}
                  placeholder="0" min={0} value={itemInput.qtyReceived || ''}
                  onChange={handleItemInputChange} />
              </Field>
              <Field label="OK Qty">
                <input type="number" name="okQty" className="ps-input" style={{ ...S.input, width: 90 }}
                  placeholder="0" min={0} value={itemInput.okQty || ''}
                  onChange={handleItemInputChange} />
              </Field>
              <Field label="Reject Qty">
                <input type="number" name="rejectQty" className="ps-input" style={{ ...S.input, width: 90 }}
                  placeholder="0" min={0} value={itemInput.rejectQty || ''}
                  onChange={handleItemInputChange} />
              </Field>
              <Field label="GRN No">
                <input name="grnNo" className="ps-input" style={{ ...S.input, width: 110 }}
                  placeholder="GRN No" value={itemInput.grnNo} onChange={handleItemInputChange} />
              </Field>
              <Field label="Remarks">
                <input name="remarks" className="ps-input" style={{ ...S.input, width: 160 }}
                  placeholder="Optional" value={itemInput.remarks} onChange={handleItemInputChange} />
              </Field>
              <div style={{ alignSelf: 'flex-end' }}>
                <button className="ps-btn" style={{
                  ...S.btnPrimary,
                  background: editItemIdx !== null ? '#7048E8' : S.accent,
                }} onClick={handleAddItem}>
                  {editItemIdx !== null ? '✎ Update Item' : '+ Add Item'}
                </button>
              </div>
            </div>

            {/* Qty validation hint */}
            {(Number(itemInput.okQty) + Number(itemInput.rejectQty)) > 0 && (
              <div style={{
                padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 12,
                background: (Number(itemInput.qtyReceived) || (Number(itemInput.okQty) + Number(itemInput.rejectQty))) === (Number(itemInput.okQty) + Number(itemInput.rejectQty)) ? S.successLight : S.warningLight,
                color: S.textSecondary,
              }}>
                OK + Reject = <strong>{Number(itemInput.okQty) + Number(itemInput.rejectQty)}</strong>
                {Number(itemInput.qtyReceived) > 0 && ` · Qty Received = ${Number(itemInput.qtyReceived)}`}
              </div>
            )}

            {/* Current items table */}
            {newPSIR.items.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ overflowX: 'auto', borderRadius: 8, border: `1px solid ${S.border}` }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
                    <thead>
                      <tr>
                        <th style={{ ...S.th, minWidth: 160 }}>Item Name</th>
                        <th style={{ ...S.th, minWidth: 110 }}>Item Code</th>
                        <th style={{ ...S.thRight, minWidth: 70 }}>PO Qty</th>
                        <th style={{ ...S.thRight, minWidth: 80 }}>Qty Recv'd</th>
                        <th style={{ ...S.thRight, minWidth: 70 }}>OK Qty</th>
                        <th style={{ ...S.thRight, minWidth: 80 }}>Rej Qty</th>
                        <th style={{ ...S.th, minWidth: 90 }}>GRN No</th>
                        <th style={{ ...S.th, minWidth: 120 }}>Remarks</th>
                        <th style={{ ...S.th, textAlign: 'center', minWidth: 100 }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {newPSIR.items.map((item, idx) => {
                        const poQty = Math.abs(getPOQtyFor(newPSIR.poNo, newPSIR.indentNo, item.itemCode));
                        return (
                          <tr key={idx} className="ps-row" style={{ background: idx % 2 === 1 ? S.bg : S.surface }}>
                            <td style={S.tdClip} title={item.itemName}>{item.itemName}</td>
                            <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 13 }}>{item.itemCode}</td>
                            <td style={S.tdRight}>{poQty}</td>
                            <td style={{ ...S.tdRight, fontWeight: 600 }}>{item.qtyReceived}</td>
                            <td style={{ ...S.tdRight, color: S.success, fontWeight: 600 }}>{item.okQty}</td>
                            <td style={{ ...S.tdRight, color: item.rejectQty > 0 ? S.danger : S.textMuted, fontWeight: 600 }}>{item.rejectQty}</td>
                            <td style={S.td}>{item.grnNo}</td>
                            <td style={S.tdClip} title={item.remarks}>{item.remarks}</td>
                            <td style={{ ...S.td, textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                                <button className="ps-btn ps-edit" style={S.btnEdit}
                                  onClick={() => { setItemInput({ ...item }); setEditItemIdx(idx); }}>
                                  Edit
                                </button>
                                <button className="ps-btn ps-danger" style={S.btnDanger}
                                  onClick={() => setNewPSIR(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }))}>
                                  ✕
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Save / Cancel buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="ps-btn" style={{
                ...S.btnSuccess,
                opacity: !newPSIR.items.length ? 0.4 : 1,
                cursor: !newPSIR.items.length ? 'not-allowed' : 'pointer',
              }}
                disabled={!newPSIR.items.length}
                onClick={isEditing ? handleUpdatePSIR : handleAddPSIR}>
                {isEditing ? '✓ Update PSIR' : '✓ Save PSIR'}
              </button>
              {isEditing && (
                <button className="ps-btn ps-ghost" style={S.btnGhost} onClick={() => {
                  setNewPSIR({ receivedDate: '', indentNo: '', poNo: '', oaNo: '', batchNo: '', invoiceNo: '', supplierName: '', items: [] });
                  setItemInput({ itemName: '', itemCode: '', qtyReceived: 0, okQty: 0, rejectQty: 0, grnNo: '', remarks: '' });
                  setEditPSIRIdx(null); setEditItemIdx(null);
                }}>
                  Cancel
                </button>
              )}
            </div>
          </div>

          {/* ── PSIR Records ───────────────────────────────────────────────── */}
          <div style={S.card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: S.textPrimary }}>PSIR Records</h2>
                <span style={{ fontSize: 12, fontWeight: 600, color: S.textSecondary, background: S.bg, padding: '2px 10px', borderRadius: 20, border: `1px solid ${S.border}` }}>
                  {filteredRows.length} of {allRows.length} rows
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="ps-btn ps-ghost" style={{
                  ...S.btnGhost,
                  borderColor: showFilters ? S.accent : S.border,
                  color: showFilters ? S.accent : S.textSecondary,
                  position: 'relative',
                }} onClick={() => setShowFilters(f => !f)}>
                  ⚙ Filters
                  {activeFilterCount > 0 && (
                    <span style={{ position: 'absolute', top: -6, right: -6, background: S.accent, color: '#fff', borderRadius: '50%', width: 16, height: 16, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {activeFilterCount}
                    </span>
                  )}
                </button>
                <button className="ps-btn ps-ghost" style={S.btnGhost} onClick={exportToCSV}>↓ CSV</button>
              </div>
            </div>

            {/* Filter bar */}
            {showFilters && (
              <div style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: '14px 16px', marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <Field label="Search">
                  <input className="ps-input" style={{ ...S.input, minWidth: 220 }}
                    placeholder="PO, indent, supplier, item…"
                    value={filterText} onChange={e => setFilterText(e.target.value)} />
                </Field>
                <Field label="Supplier">
                  <select className="ps-input" style={{ ...S.input, width: 180 }}
                    value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)}>
                    <option value="">All suppliers</option>
                    {uniqueSuppliers.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Date From">
                  <input type="date" className="ps-input" style={{ ...S.input, width: 150 }}
                    value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
                </Field>
                <Field label="Date To">
                  <input type="date" className="ps-input" style={{ ...S.input, width: 150 }}
                    value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
                </Field>
                {activeFilterCount > 0 && (
                  <button className="ps-btn ps-ghost" style={{ ...S.btnGhost, alignSelf: 'flex-end', color: S.danger, borderColor: '#FECACA' }}
                    onClick={() => { setFilterText(''); setFilterSupplier(''); setFilterDateFrom(''); setFilterDateTo(''); }}>
                    ✕ Clear all
                  </button>
                )}
              </div>
            )}

            {/* Records table */}
            <div style={{ overflowX: 'auto', borderRadius: 8, border: `1px solid ${S.border}` }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
                <thead>
                  <tr>
                    <th style={{ ...S.th, minWidth: 95 }}>Date</th>
                    <th style={{ ...S.th, minWidth: 110 }}>Indent No</th>
                    <th style={{ ...S.th, minWidth: 80 }}>OA No</th>
                    <th style={{ ...S.th, minWidth: 110 }}>PO No</th>
                    <th style={{ ...S.th, minWidth: 90 }}>Batch No</th>
                    <th style={{ ...S.th, minWidth: 100 }}>Invoice No</th>
                    <th style={{ ...S.th, minWidth: 150 }}>Supplier</th>
                    <th style={{ width: 2, padding: 0, background: S.borderStrong, borderBottom: `2px solid ${S.borderStrong}` }} />
                    <th style={{ ...S.th, minWidth: 160 }}>Item Name</th>
                    <th style={{ ...S.th, minWidth: 110 }}>Item Code</th>
                    <th style={{ ...S.thRight, minWidth: 65 }}>PO Qty</th>
                    <th style={{ ...S.thRight, minWidth: 80 }}>Qty Recv'd</th>
                    <th style={{ ...S.thRight, minWidth: 70 }}>OK Qty</th>
                    <th style={{ ...S.thRight, minWidth: 75 }}>Rej Qty</th>
                    <th style={{ width: 2, padding: 0, background: S.borderStrong, borderBottom: `2px solid ${S.borderStrong}` }} />
                    <th style={{ ...S.th, minWidth: 90 }}>GRN No</th>
                    <th style={{ ...S.th, minWidth: 120 }}>Remarks</th>
                    <th style={{ ...S.th, textAlign: 'center', minWidth: 100 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={18} style={{ padding: '40px 0', textAlign: 'center', color: S.textMuted, fontSize: 14 }}>
                        {allRows.length === 0
                          ? 'No PSIR records yet. Create your first record above or import purchase orders.'
                          : 'No rows match the current filters.'}
                      </td>
                    </tr>
                  ) : filteredRows.map((r, rowIdx) => (
                    <tr key={`${r.psirIdx}-${r.itemIdx}`} className="ps-row" style={{ background: rowIdx % 2 === 1 ? S.bg : S.surface }}>
                      <td style={S.td}>{r.psir.receivedDate}</td>
                      <td style={{ ...S.td, fontWeight: 600, color: S.accent }}>{r.psir.indentNo}</td>
                      <td style={S.td}>{r.psir.oaNo}</td>
                      <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 13 }}>{r.psir.poNo}</td>
                      <td style={S.td}>{r.psir.batchNo}</td>
                      <td style={S.td}>{r.psir.invoiceNo}</td>
                      <td style={S.tdClip} title={r.psir.supplierName}>{r.psir.supplierName}</td>
                      <td style={{ padding: 0, background: S.border, width: 2 }} />
                      <td style={S.tdClip} title={r.item.itemName}>{r.item.itemName}</td>
                      <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 13 }}>{r.item.itemCode}</td>
                      <td style={S.tdRight}>{r.poQty}</td>
                      <td style={{ ...S.tdRight, fontWeight: 600 }}>{r.item.qtyReceived}</td>
                      <td style={{ ...S.tdRight }}>
                        <NumBadge value={Number(r.item.okQty) || 0} positive={true} />
                      </td>
                      <td style={{ ...S.tdRight }}>
                        {Number(r.item.rejectQty) > 0
                          ? <NumBadge value={Number(r.item.rejectQty)} positive={false} />
                          : <span style={{ color: S.textMuted }}>0</span>}
                      </td>
                      <td style={{ padding: 0, background: S.border, width: 2 }} />
                      <td style={S.td}>{r.item.grnNo}</td>
                      <td style={S.tdClip} title={r.item.remarks}>{r.item.remarks}</td>
                      <td style={{ ...S.td, textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                          <button className="ps-btn ps-edit" style={S.btnEdit}
                            onClick={() => {
                              setNewPSIR({ ...r.psir, items: r.psir.items.map(i => ({ ...i })) });
                              setEditPSIRIdx(r.psirIdx);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}>
                            Edit
                          </button>
                          <button className="ps-btn ps-danger" style={{ ...S.btnDanger, padding: '3px 8px' }}
                            onClick={() => handleDeleteItem(r.psirIdx, r.itemIdx)}
                            title="Delete this line">
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredRows.length > 0 && (
              <div style={{ marginTop: 12, fontSize: 13, color: S.textMuted, textAlign: 'right' }}>
                Showing {filteredRows.length} of {allRows.length} rows
                {activeFilterCount > 0 && ` — ${activeFilterCount} filter${activeFilterCount !== 1 ? 's' : ''} active`}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default PSIRModule;