import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { subscribePsirs } from '../utils/psirService';
import {
  subscribeVSIRRecords, addVSIRRecord, updateVSIRRecord, deleteVSIRRecord,
  subscribeVendorDepts, getItemMaster, getVendorIssues,
  subscribePurchaseData, subscribePurchaseOrders, updateVendorDept,
} from '../utils/firestoreServices';
import bus from '../utils/eventBus';

// ─── Types ────────────────────────────────────────────────────────────────────
interface VSRIRecord {
  id: string;
  receivedDate: string;
  indentNo: string;
  poNo: string;
  oaNo: string;
  purchaseBatchNo: string;
  vendorBatchNo: string;
  dcNo: string;
  invoiceDcNo: string;
  vendorName: string;
  itemName: string;
  itemCode: string;
  qtyReceived: number;
  okQty: number;
  reworkQty: number;
  rejectQty: number;
  grnNo: string;
  remarks: string;
  updatedAt?: string | number | Date;
}

interface VendorDeptItem {
  itemName: string; itemCode: string; materialIssueNo: string; qty: number;
  plannedQty?: number; closingStock?: number | string; indentStatus: string;
  receivedQty: number; okQty: number; reworkQty: number; rejectedQty: number;
  grnNo: string; debitNoteOrQtyReturned: string; remarks: string;
}

type RecordForm = Omit<VSRIRecord, 'id'>;

const EMPTY_FORM: RecordForm = {
  receivedDate: '', indentNo: '', poNo: '', oaNo: '', purchaseBatchNo: '',
  vendorBatchNo: '', dcNo: '', invoiceDcNo: '', vendorName: '',
  itemName: '', itemCode: '', qtyReceived: 0, okQty: 0, reworkQty: 0,
  rejectQty: 0, grnNo: '', remarks: '',
};

// ─── Design System ────────────────────────────────────────────────────────────
const S = {
  bg: '#F7F8FC', surface: '#FFFFFF', border: '#E4E8F0', borderStrong: '#CBD2E0',
  accent: '#3B5BDB', accentLight: '#EEF2FF',
  success: '#2F9E44', successLight: '#EBFBEE',
  danger: '#C92A2A', dangerLight: '#FFF5F5',
  warning: '#E67700', warningLight: '#FFF9DB',
  textPrimary: '#1A1F36', textSecondary: '#6B7280', textMuted: '#9CA3AF',

  card: { background: '#FFFFFF', border: '1px solid #E4E8F0', borderRadius: 12, padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)' } as React.CSSProperties,
  input: { padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD2E0', fontSize: 14, color: '#1A1F36', background: '#fff', outline: 'none', transition: 'border-color 0.15s', fontFamily: 'inherit', lineHeight: '1.5' } as React.CSSProperties,
  inputDisabled: { padding: '8px 12px', borderRadius: 8, border: '1px solid #E4E8F0', fontSize: 14, color: '#6B7280', background: '#F7F8FC', cursor: 'not-allowed', fontFamily: 'inherit' } as React.CSSProperties,

  btnPrimary: { background: '#3B5BDB', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'inline-flex' as const, alignItems: 'center', gap: 6, fontFamily: 'inherit' } as React.CSSProperties,
  btnSuccess: { background: '#2F9E44', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'inline-flex' as const, alignItems: 'center', gap: 6, fontFamily: 'inherit' } as React.CSSProperties,
  btnGhost: { background: 'transparent', color: '#6B7280', border: '1px solid #E4E8F0', borderRadius: 8, padding: '8px 14px', fontSize: 14, fontWeight: 500, cursor: 'pointer', display: 'inline-flex' as const, alignItems: 'center', gap: 6, fontFamily: 'inherit' } as React.CSSProperties,
  btnDanger: { background: 'transparent', color: '#C92A2A', border: '1px solid #FECACA', borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' } as React.CSSProperties,
  btnEdit: { background: '#EEF2FF', color: '#3B5BDB', border: '1px solid #C5D0FA', borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' } as React.CSSProperties,

  label: { fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 4, display: 'block' },
  th: { padding: '10px 12px', textAlign: 'left' as const, fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.05em', background: '#F7F8FC', borderBottom: '2px solid #E4E8F0', whiteSpace: 'nowrap' as const },
  thRight: { padding: '10px 12px', textAlign: 'right' as const, fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.05em', background: '#F7F8FC', borderBottom: '2px solid #E4E8F0', whiteSpace: 'nowrap' as const },
  td: { padding: '10px 12px', fontSize: 14, color: '#1A1F36', borderBottom: '1px solid #F1F3F9', whiteSpace: 'nowrap' as const },
  tdClip: { padding: '10px 12px', fontSize: 14, color: '#1A1F36', borderBottom: '1px solid #F1F3F9', maxWidth: 180, overflow: 'hidden' as const, textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const },
  tdRight: { padding: '10px 12px', fontSize: 14, color: '#1A1F36', borderBottom: '1px solid #F1F3F9', textAlign: 'right' as const, whiteSpace: 'nowrap' as const, fontVariantNumeric: 'tabular-nums' } as React.CSSProperties,
};

// ─── Toast ────────────────────────────────────────────────────────────────────
interface Toast { id: number; msg: string; type: 'success' | 'error' | 'info'; }
let toastId = 0;

function ToastContainer({ toasts }: { toasts: Toast[] }) {
  if (!toasts.length) return null;
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {toasts.map(t => (
        <div key={t.id} style={{ padding: '12px 18px', borderRadius: 10, fontSize: 14, fontWeight: 500, color: '#fff', background: t.type === 'success' ? '#2F9E44' : t.type === 'error' ? '#C92A2A' : '#3B5BDB', boxShadow: '0 4px 16px rgba(0,0,0,0.18)', animation: 'vsirSlide 0.2s ease', maxWidth: 360, display: 'flex', alignItems: 'center', gap: 8 }}>
          {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'ℹ'} {t.msg}
        </div>
      ))}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
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

function QtyBadge({ value, warn }: { value: number; warn?: boolean }) {
  const color = warn && value > 0 ? S.danger : value > 0 ? S.success : S.textMuted;
  const bg = warn && value > 0 ? S.dangerLight : value > 0 ? S.successLight : 'transparent';
  return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontWeight: 700, fontSize: 13, background: bg, color, minWidth: 34, textAlign: 'center' }}>{value}</span>;
}

// ─── Main Component ───────────────────────────────────────────────────────────
const VSIRModule: React.FC = () => {
  const [userUid, setUserUid] = useState<string | null>(null);
  const [records, setRecords] = useState<VSRIRecord[]>([]);
  const [itemMaster, setItemMaster] = useState<{ itemName: string; itemCode: string }[]>([]);
  const [vendorDeptOrders, setVendorDeptOrders] = useState<any[]>([]);
  const [vendorIssues, setVendorIssues] = useState<any[]>([]);
  const [purchaseData, setPurchaseData] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [psirData, setPsirData] = useState<any[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [form, setForm] = useState<RecordForm>({ ...EMPTY_FORM });
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [filterVendor, setFilterVendor] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const activeFilterCount = [filterText, filterVendor, filterDateFrom, filterDateTo].filter(Boolean).length;

  // Refs for subscription cleanup and merge guards
  const unsubsRef = useRef<Array<() => void>>([]);
  const justSavedRef = useRef(false);
  const lastSavedIdRef = useRef<string | null>(null);
  const existingCombosRef = useRef<Set<string>>(new Set());

  const showToast = useCallback((msg: string, type: Toast['type'] = 'info') => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // ─── Auth ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setUserUid(u ? u.uid : null));
    return () => unsub();
  }, []);

  // ─── All subscriptions in one place ───────────────────────────────────────
  useEffect(() => {
    unsubsRef.current.forEach(fn => { try { fn(); } catch {} });
    unsubsRef.current = [];

    if (!userUid) { setRecords([]); return; }

    const dedup = (arr: VSRIRecord[]): VSRIRecord[] => {
      const map = new Map<string, VSRIRecord>();
      for (const r of arr) {
        const key = `${String(r.poNo).trim().toLowerCase()}|${String(r.itemCode).trim().toLowerCase()}`;
        const existing = map.get(key);
        if (!existing) { map.set(key, r); continue; }
        const t1 = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
        const t2 = r.updatedAt ? new Date(r.updatedAt).getTime() : 0;
        if (t2 > t1) map.set(key, r);
      }
      return Array.from(map.values());
    };

    const unsubVSIR = subscribeVSIRRecords(userUid, (docs) => {
      const deduped = dedup(docs.map(d => ({ ...d })) as VSRIRecord[]);
      setRecords(prev => {
        if (!prev.length) return deduped;
        const prevMap = new Map(prev.map(r => [r.id, r]));
        const merged = deduped.map(doc => {
          if (justSavedRef.current && lastSavedIdRef.current === doc.id) return doc;
          const p = prevMap.get(doc.id);
          if (!p) return doc;
          return { ...doc, okQty: p.okQty ?? doc.okQty, reworkQty: p.reworkQty ?? doc.reworkQty, rejectQty: p.rejectQty ?? doc.rejectQty, qtyReceived: p.qtyReceived ?? doc.qtyReceived };
        });
        if (justSavedRef.current) { justSavedRef.current = false; lastSavedIdRef.current = null; }
        return merged;
      });
    });

    const unsubVendorDepts = subscribeVendorDepts(userUid, (docs) => setVendorDeptOrders(docs || []));
    const unsubPsirs = subscribePsirs(userUid, (docs) => setPsirData(docs || []));
    const unsubPurchaseData = subscribePurchaseData(userUid, (docs) => setPurchaseData(docs || []));
    const unsubPurchaseOrders = subscribePurchaseOrders(userUid, (docs) => setPurchaseOrders(docs || []));

    // One-time loads
    getItemMaster(userUid).then(items => setItemMaster((items || []) as any[])).catch(() => {});
    getVendorIssues(userUid).then(vi => setVendorIssues(vi || [])).catch(() => {});

    unsubsRef.current = [unsubVSIR, unsubVendorDepts, unsubPsirs, unsubPurchaseData, unsubPurchaseOrders];
    setIsInitialized(true);

    return () => { unsubsRef.current.forEach(fn => { try { fn(); } catch {} }); unsubsRef.current = []; };
  }, [userUid]);

  // ─── Update dedup cache ───────────────────────────────────────────────────
  useEffect(() => {
    existingCombosRef.current = new Set(records.map(r => `${String(r.poNo).trim().toLowerCase()}|${String(r.itemCode).trim().toLowerCase()}`));
  }, [records]);

  // ─── Dispatch vsir.updated ────────────────────────────────────────────────
  useEffect(() => {
    if (!isInitialized) return;
    try { bus.dispatchEvent(new CustomEvent('vsir.updated', { detail: { records } })); } catch {}
  }, [records, isInitialized]);

  // ─── Auto-fill indent from PSIR (existing records) ───────────────────────
  useEffect(() => {
    if (!isInitialized || !records.length || !psirData.length || !userUid) return;
    let changed = false;
    const updated = records.map(rec => {
      if (rec.poNo && (!rec.indentNo || !rec.indentNo.trim())) {
        const match = psirData.find((p: any) => String(p.poNo || '').trim() === String(rec.poNo).trim());
        if (match?.indentNo && match.indentNo !== rec.indentNo) { changed = true; return { ...rec, indentNo: match.indentNo }; }
      }
      return rec;
    });
    if (changed) {
      setRecords(updated);
      updated.forEach(rec => { if (rec.id) updateVSIRRecord(userUid, rec.id, rec).catch(() => {}); });
    }
  }, [isInitialized, psirData]);

  // ─── Sync vendorBatchNo from VendorDept ───────────────────────────────────
  useEffect(() => {
    if (!vendorDeptOrders.length || !records.length || !userUid) return;
    let changed = false;
    const updated = records.map(rec => {
      if (rec.vendorBatchNo || !rec.poNo) return rec;
      const match = vendorDeptOrders.find((vd: any) => String(vd.materialPurchasePoNo || '').trim() === String(rec.poNo).trim());
      if (match?.vendorBatchNo) { changed = true; return { ...rec, vendorBatchNo: match.vendorBatchNo }; }
      return rec;
    });
    if (changed) {
      setRecords(updated);
      updated.forEach(rec => { if (rec.id) updateVSIRRecord(userUid, rec.id, rec).catch(() => {}); });
    }
  }, [vendorDeptOrders, records.length]);

  // ─── Fill missing OA/Batch (once on load) ────────────────────────────────
  useEffect(() => {
    if (!records.length || !userUid) return;
    let changed = false;
    const updated = records.map(rec => {
      if ((!rec.oaNo || !rec.purchaseBatchNo) && rec.poNo) {
        let oaNo = rec.oaNo, batchNo = rec.purchaseBatchNo;
        const psirMatch = psirData.find((p: any) => p.poNo === rec.poNo);
        if (psirMatch) { oaNo = oaNo || psirMatch.oaNo || ''; batchNo = batchNo || psirMatch.batchNo || ''; }
        const deptMatch = vendorDeptOrders.find((v: any) => v.materialPurchasePoNo === rec.poNo);
        if (deptMatch) { oaNo = oaNo || deptMatch.oaNo || ''; batchNo = batchNo || deptMatch.batchNo || ''; }
        const issueMatch = vendorIssues.find((vi: any) => vi.materialPurchasePoNo === rec.poNo);
        if (issueMatch) { oaNo = oaNo || issueMatch.oaNo || ''; batchNo = batchNo || issueMatch.batchNo || ''; }
        if (oaNo !== rec.oaNo || batchNo !== rec.purchaseBatchNo) { changed = true; return { ...rec, oaNo, purchaseBatchNo: batchNo }; }
      }
      return rec;
    });
    if (changed) setRecords(updated);
  }, []); // run once on mount

  // ─── Event bus for vendorDept updates ────────────────────────────────────
  useEffect(() => {
    const handler = () => setRecords(prev => [...prev]);
    try { bus.addEventListener('vendorDept.updated', handler as EventListener); } catch {}
    return () => { try { bus.removeEventListener('vendorDept.updated', handler as EventListener); } catch {}; };
  }, []);

  // ─── Business helpers ─────────────────────────────────────────────────────
  const generateVendorBatchNo = useCallback((): string => {
    const yy = String(new Date().getFullYear()).slice(2);
    let max = 0;
    const pat = new RegExp(`${yy}/V(\\d+)`);
    records.forEach(r => { const m = String(r.vendorBatchNo || '').match(pat); if (m) max = Math.max(max, parseInt(m[1], 10)); });
    vendorDeptOrders.forEach((d: any) => { const m = String(d.vendorBatchNo || '').match(pat); if (m) max = Math.max(max, parseInt(m[1], 10)); });
    return `${yy}/V${max + 1}`;
  }, [records, vendorDeptOrders]);

  const getVendorBatchNoForPO = useCallback((poNo: string): string => {
    if (!poNo) return '';
    const vd = vendorDeptOrders.find((d: any) => d.materialPurchasePoNo === poNo);
    if (vd?.vendorBatchNo) return vd.vendorBatchNo;
    const vi = vendorIssues.find((i: any) => i.materialPurchasePoNo === poNo);
    if (vi?.vendorBatchNo) return vi.vendorBatchNo;
    return '';
  }, [vendorDeptOrders, vendorIssues]);

  // ─── Form change handler ──────────────────────────────────────────────────
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (name === 'itemName') {
      const found = itemMaster.find(i => i.itemName === value);
      setForm(prev => ({ ...prev, itemName: value, itemCode: found ? found.itemCode : '' }));
    } else {
      setForm(prev => ({ ...prev, [name]: type === 'number' ? Number(value) : value }));
    }
  }, [itemMaster]);

  // ─── Auto-fill when PO changes ────────────────────────────────────────────
  useEffect(() => {
    if (!form.poNo) return;
    let oaNo = '', batchNo = '', vendorName = '', indentNo = '';
    const deptMatch = vendorDeptOrders.find((v: any) => v.materialPurchasePoNo === form.poNo);
    if (deptMatch) { oaNo = deptMatch.oaNo || ''; batchNo = deptMatch.batchNo || ''; vendorName = deptMatch.vendorName || ''; }
    const psirMatch = psirData.find((p: any) => String(p.poNo || '').trim() === form.poNo.trim());
    if (psirMatch) { oaNo = oaNo || psirMatch.oaNo || ''; batchNo = batchNo || psirMatch.batchNo || ''; indentNo = psirMatch.indentNo || ''; }
    const issueMatch = vendorIssues.find((vi: any) => vi.materialPurchasePoNo === form.poNo);
    if (issueMatch) { oaNo = oaNo || issueMatch.oaNo || ''; batchNo = batchNo || issueMatch.batchNo || ''; vendorName = vendorName || issueMatch.vendorName || ''; }
    setForm(prev => ({ ...prev, oaNo: oaNo || prev.oaNo, purchaseBatchNo: batchNo || prev.purchaseBatchNo, vendorName: vendorName || prev.vendorName, indentNo: indentNo || prev.indentNo }));
  }, [form.poNo, vendorDeptOrders, psirData, vendorIssues]);

  // ─── Auto-fill when itemCode changes ─────────────────────────────────────
  useEffect(() => {
    if (!form.itemCode) return;
    const source = form.poNo
      ? vendorIssues.find((v: any) => String(v.materialPurchasePoNo).trim() === form.poNo.trim())
      : vendorIssues.find((v: any) => Array.isArray(v.items) && v.items.some((it: any) => String(it.itemCode).trim() === form.itemCode.trim()));
    if (source) {
      setForm(prev => ({ ...prev, receivedDate: prev.receivedDate || source.date || '', poNo: prev.poNo || source.materialPurchasePoNo || '', vendorName: prev.vendorName || source.vendorName || '' }));
    }
  }, [form.itemCode]);

  // ─── Import from PSIR + purchase data ────────────────────────────────────
  // FIX: Now imports from psirData first, falls back to purchase orders/data.
  // Also removed the early-exit guard that blocked import when records > 0;
  // instead we skip only already-existing PO+itemCode combos.
  const runImport = useCallback(async () => {
    if (!userUid) { showToast('User not authenticated', 'error'); return; }

    let count = 0;

    // ── 1. Import from PSIR records ──────────────────────────────────────
    if (psirData.length > 0) {
      for (const psir of psirData) {
        const poNo = String(psir.poNo || '').trim();
        if (!poNo) continue;

        // Each PSIR record may carry its own item fields directly
        const itemName = psir.itemName || psir.item || '';
        const itemCode = psir.itemCode || psir.code || '';

        if (!itemName && !itemCode) {
          // PSIR has nested items array
          const items: any[] = Array.isArray(psir.items) ? psir.items : [];
          for (const item of items) {
            const code = String(item.itemCode || item.code || '').trim();
            const name = item.itemName || item.name || item.model || '';
            const key = `${poNo.toLowerCase()}|${code.toLowerCase()}`;
            if (existingCombosRef.current.has(key)) continue;

            const rec: Omit<VSRIRecord, 'id'> = {
              receivedDate: psir.date || psir.receivedDate || '',
              indentNo: psir.indentNo || '',
              poNo,
              oaNo: psir.oaNo || '',
              purchaseBatchNo: psir.batchNo || psir.purchaseBatchNo || '',
              vendorBatchNo: '',
              dcNo: '',
              invoiceDcNo: psir.invoiceNo || psir.invoiceDcNo || '',
              vendorName: psir.supplierName || psir.vendorName || psir.supplier || '',
              itemName: name,
              itemCode: code,
              qtyReceived: Number(item.qty || item.qtyReceived || 0),
              okQty: 0,
              reworkQty: 0,
              rejectQty: 0,
              grnNo: psir.grnNo || '',
              remarks: '',
            };
            await addVSIRRecord(userUid, rec).then(() => count++).catch(() => {});
          }
        } else {
          // PSIR record has item fields at top level
          const code = String(itemCode).trim();
          const key = `${poNo.toLowerCase()}|${code.toLowerCase()}`;
          if (!existingCombosRef.current.has(key)) {
            const rec: Omit<VSRIRecord, 'id'> = {
              receivedDate: psir.date || psir.receivedDate || '',
              indentNo: psir.indentNo || '',
              poNo,
              oaNo: psir.oaNo || '',
              purchaseBatchNo: psir.batchNo || psir.purchaseBatchNo || '',
              vendorBatchNo: '',
              dcNo: '',
              invoiceDcNo: psir.invoiceNo || psir.invoiceDcNo || '',
              vendorName: psir.supplierName || psir.vendorName || psir.supplier || '',
              itemName,
              itemCode: code,
              qtyReceived: Number(psir.qty || psir.qtyReceived || 0),
              okQty: 0,
              reworkQty: 0,
              rejectQty: 0,
              grnNo: psir.grnNo || '',
              remarks: '',
            };
            await addVSIRRecord(userUid, rec).then(() => count++).catch(() => {});
          }
        }
      }
    }

    // ── 2. Also import from purchase orders (as before) ──────────────────
    const source = purchaseOrders.length > 0 ? purchaseOrders : purchaseData;
    if (source.length > 0) {
      const getPoNo = (o: any) => { for (const k of ['poNo', 'materialPurchasePoNo', 'po_no', 'poNumber']) { if (o[k]) return o[k]; } return undefined; };
      const getItems = (o: any) => { if (Array.isArray(o.items) && o.items.length) return o.items; if (Array.isArray(o.materials) && o.materials.length) return o.materials; return []; };

      for (const order of source) {
        const poNo = getPoNo(order); if (!poNo) continue;
        const items = getItems(order); if (!items.length) continue;
        const vd = vendorDeptOrders.find((v: any) => (v.materialPurchasePoNo || '').trim() === String(poNo).trim());
        for (const item of items) {
          const itemCode = item.itemCode || '';
          const key = `${String(poNo).trim().toLowerCase()}|${String(itemCode).trim().toLowerCase()}`;
          if (existingCombosRef.current.has(key)) continue;
          const rec: Omit<VSRIRecord, 'id'> = {
            receivedDate: '',
            indentNo: '',
            poNo,
            oaNo: vd?.oaNo || '',
            purchaseBatchNo: vd?.batchNo || '',
            vendorBatchNo: '',
            dcNo: '',
            invoiceDcNo: '',
            vendorName: '',
            itemName: item.itemName || item.model || '',
            itemCode,
            qtyReceived: item.qty || 0,
            okQty: 0,
            reworkQty: 0,
            rejectQty: 0,
            grnNo: '',
            remarks: '',
          };
          await addVSIRRecord(userUid, rec).then(() => count++).catch(() => {});
        }
      }
    }

    if (psirData.length === 0 && source.length === 0) {
      showToast('No PSIR or purchase data found to import', 'error');
      return;
    }

    showToast(
      count > 0 ? `✓ Imported ${count} record${count !== 1 ? 's' : ''} from PSIR / Purchase` : 'All records already exist — nothing new to import',
      count > 0 ? 'success' : 'info'
    );
  }, [userUid, psirData, purchaseOrders, purchaseData, vendorDeptOrders, showToast]);

  // ─── Edit ─────────────────────────────────────────────────────────────────
  const handleEdit = useCallback((idx: number) => {
    const rec = records[idx];
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = rec as any;
    if (!rest.vendorBatchNo?.trim() && rest.poNo) {
      rest.vendorBatchNo = getVendorBatchNoForPO(rest.poNo) || '';
    }
    setForm(rest as RecordForm);
    setEditIdx(idx);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [records, getVendorBatchNoForPO]);

  // ─── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.receivedDate || !form.poNo || !form.itemCode || !form.itemName || !form.qtyReceived) {
      showToast('Received Date, PO No, Item, and Qty Received are required', 'error'); return;
    }
    if (!userUid) { showToast('User not authenticated', 'error'); return; }
    setIsSubmitting(true);

    const final: RecordForm = {
      ...form,
      qtyReceived: Number(form.qtyReceived) || 0,
      okQty: Number(form.okQty) || 0,
      reworkQty: Number(form.reworkQty) || 0,
      rejectQty: Number(form.rejectQty) || 0,
    };

    // Vendor batch logic
    if (final.invoiceDcNo && !final.vendorBatchNo?.trim() && final.poNo) {
      final.vendorBatchNo = getVendorBatchNoForPO(final.poNo) || '';
    } else if (!final.invoiceDcNo) {
      final.vendorBatchNo = '';
    }

    try {
      if (editIdx !== null) {
        const rec = records[editIdx];
        if (!rec?.id) throw new Error('Invalid record for update');
        justSavedRef.current = true; lastSavedIdRef.current = rec.id;
        await updateVSIRRecord(userUid, rec.id, { ...rec, ...final, id: rec.id });
        showToast('Record updated successfully', 'success');

        // Sync OK Qty to VendorDept
        if (final.okQty > 0 && final.poNo && final.itemCode) {
          const vd = vendorDeptOrders.find((v: any) => String(v.materialPurchasePoNo || '').trim() === String(final.poNo).trim());
          if (vd?.id) {
            const itemIdx = (vd.items || []).findIndex((it: VendorDeptItem) => String(it.itemCode || '').trim() === String(final.itemCode).trim());
            if (itemIdx >= 0) {
              const updatedItems = [...vd.items];
              updatedItems[itemIdx] = { ...updatedItems[itemIdx], okQty: final.okQty };
              await updateVendorDept(userUid, vd.id, { ...vd, items: updatedItems }).catch(() => {});
              try { bus.dispatchEvent(new CustomEvent('vendorDept.updated', { detail: { updatedRecord: { ...vd, items: updatedItems } } })); } catch {}
            }
          }
        }
      } else {
        justSavedRef.current = true; lastSavedIdRef.current = null;
        await addVSIRRecord(userUid, final);
        showToast('Record added successfully', 'success');
      }
      setForm({ ...EMPTY_FORM });
      setEditIdx(null);
    } catch (e) {
      justSavedRef.current = false; lastSavedIdRef.current = null;
      showToast('Error: ' + String((e as any)?.message || e), 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [form, editIdx, records, userUid, vendorDeptOrders, getVendorBatchNoForPO, showToast]);

  // ─── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = useCallback(async (idx: number) => {
    const rec = records[idx];
    if (!rec?.id || !userUid) { showToast('Cannot delete: missing data', 'error'); return; }
    await deleteVSIRRecord(userUid, rec.id)
      .then(() => { setRecords(prev => prev.filter(r => r.id !== rec.id)); showToast('Record deleted', 'success'); })
      .catch(e => showToast('Delete failed: ' + String((e as any)?.message || e), 'error'));
  }, [records, userUid, showToast]);

  // ─── Memoized data ────────────────────────────────────────────────────────
  const uniqueVendors = useMemo(() => [...new Set(records.map(r => r.vendorName).filter(Boolean))].sort(), [records]);

  const filteredRecords = useMemo(() => records.filter(r => {
    if (filterVendor && r.vendorName !== filterVendor) return false;
    if (filterDateFrom && r.receivedDate < filterDateFrom) return false;
    if (filterDateTo && r.receivedDate > filterDateTo) return false;
    if (filterText) {
      const q = filterText.toLowerCase();
      if (![r.poNo, r.indentNo, r.oaNo, r.vendorName, r.itemName, r.itemCode, r.grnNo, r.vendorBatchNo, r.purchaseBatchNo].some(f => String(f || '').toLowerCase().includes(q))) return false;
    }
    return true;
  }), [records, filterText, filterVendor, filterDateFrom, filterDateTo]);

  const stats = useMemo(() => ({
    total: records.length,
    totalOK: records.reduce((s, r) => s + (Number(r.okQty) || 0), 0),
    totalRework: records.reduce((s, r) => s + (Number(r.reworkQty) || 0), 0),
    totalReject: records.reduce((s, r) => s + (Number(r.rejectQty) || 0), 0),
  }), [records]);

  // ─── CSV export ───────────────────────────────────────────────────────────
  const exportCSV = useCallback(() => {
    const headers = ['Received Date', 'Indent No', 'PO No', 'OA No', 'Purchase Batch No', 'Vendor Batch No', 'DC No', 'Invoice/DC No', 'Vendor Name', 'Item Name', 'Item Code', 'Qty Received', 'OK Qty', 'Rework Qty', 'Reject Qty', 'GRN No', 'Remarks'];
    const today = new Date().toISOString().slice(0, 10);
    const esc = (v: any) => { const s = String(v ?? ''); return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s; };
    const rows = filteredRecords.map(r => [r.receivedDate, r.indentNo, r.poNo, r.oaNo, r.purchaseBatchNo, r.vendorBatchNo || getVendorBatchNoForPO(r.poNo), r.dcNo, r.invoiceDcNo, r.vendorName, r.itemName, r.itemCode, r.qtyReceived, r.okQty, r.reworkQty, r.rejectQty, r.grnNo, r.remarks]);
    const csv = '\uFEFF' + [headers, ...rows].map(row => row.map(esc).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = `VSIR_${today}.csv`; a.click(); URL.revokeObjectURL(url);
    showToast(`Exported ${filteredRecords.length} rows`, 'success');
  }, [filteredRecords, getVendorBatchNoForPO, showToast]);

  // ─── Render ───────────────────────────────────────────────────────────────
  const isEditing = editIdx !== null;
  const availablePOs = useMemo(() => {
    const fromPurchase = [...purchaseOrders.map((p: any) => p.poNo), ...purchaseData.map((p: any) => p.poNo)].filter(Boolean);
    // Also include PO nos from PSIR data
    const fromPsir = psirData.map((p: any) => String(p.poNo || '').trim()).filter(Boolean);
    return [...new Set([...fromPurchase, ...fromPsir])];
  }, [purchaseOrders, purchaseData, psirData]);

  return (
    <>
      <style>{`
        @keyframes vsirSlide { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        .vs-btn:hover { opacity: 0.88; }
        .vs-row:hover td { background: #F7F8FF !important; }
        .vs-input:focus { border-color: #3B5BDB !important; box-shadow: 0 0 0 3px rgba(59,91,219,0.12); }
        .vs-ghost:hover { background: #F7F8FC !important; border-color: #CBD2E0 !important; }
        .vs-danger:hover { background: #FFF5F5 !important; }
        .vs-edit:hover { background: #C5D0FA !important; }
        * { box-sizing: border-box; }
      `}</style>

      <ToastContainer toasts={toasts} />

      <div style={{ background: S.bg, minHeight: '100vh', fontFamily: "'Geist', 'DM Sans', system-ui, sans-serif" }}>
        <div style={{ maxWidth: 1600, margin: '0 auto', padding: '24px 24px 48px' }}>

          {/* ── Header ───────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: S.textPrimary, letterSpacing: '-0.02em' }}>VSIR Module</h1>
              <p style={{ margin: '4px 0 0', fontSize: 14, color: S.textSecondary }}>Vendor Store Inspection Report — track vendor-issued materials</p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="vs-btn vs-ghost"
                style={{ ...S.btnGhost, opacity: !userUid ? 0.5 : 1 }}
                disabled={!userUid}
                onClick={runImport}
                title="Import records from PSIR and Purchase Orders"
              >
                ↓ Import PSIR / POs
              </button>
              <button className="vs-btn vs-ghost" style={S.btnGhost} onClick={exportCSV}>↓ Export CSV</button>
            </div>
          </div>

          {/* ── Stats ────────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
            <StatCard label="Records" value={stats.total} />
            <StatCard label="Total OK" value={stats.totalOK} color={S.success} sub="Accepted" />
            <StatCard label="Rework" value={stats.totalRework} color={stats.totalRework > 0 ? S.warning : S.textMuted} sub="Needs rework" />
            <StatCard label="Rejected" value={stats.totalReject} color={stats.totalReject > 0 ? S.danger : S.textMuted} sub="Rejected" />
            <StatCard label="PSIR Records" value={psirData.length} color={S.accent} sub="Available to import" />
            <StatCard label="User" value={userUid ? '✓' : '✗'} color={userUid ? S.success : S.danger} sub={userUid ? 'Signed in' : 'Not signed in'} />
          </div>

          {/* ── Form ─────────────────────────────────────────────────────── */}
          <div style={{ ...S.card, marginBottom: 24 }}>
            <h2 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700, color: S.textPrimary }}>
              {isEditing ? '✎ Edit Record' : 'New VSIR Record'}
            </h2>

            <form onSubmit={handleSubmit}>
              {/* Row 1: header fields */}
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 16 }}>
                <Field label="Received Date">
                  <input type="date" name="receivedDate" className="vs-input" style={{ ...S.input, width: 160 }} value={form.receivedDate} onChange={handleChange} />
                </Field>
                <Field label="Indent No">
                  <input name="indentNo" className="vs-input" style={{ ...S.input, width: 140 }} placeholder="Auto-filled" value={form.indentNo} onChange={handleChange} />
                </Field>
                <Field label="PO No">
                  {availablePOs.length > 0 ? (
                    <select name="poNo" className="vs-input" style={{ ...S.input, width: 160 }} value={form.poNo} onChange={handleChange}>
                      <option value="">Select PO…</option>
                      {availablePOs.map(po => <option key={po} value={po}>{po}</option>)}
                    </select>
                  ) : (
                    <input name="poNo" className="vs-input" style={{ ...S.input, width: 160 }} placeholder="PO No" value={form.poNo} onChange={handleChange} />
                  )}
                </Field>
                <Field label="OA No">
                  <input name="oaNo" className="vs-input" style={{ ...S.input, width: 120 }} placeholder="Auto-filled" value={form.oaNo} onChange={handleChange} />
                </Field>
                <Field label="Purchase Batch No">
                  <input name="purchaseBatchNo" className="vs-input" style={{ ...S.input, width: 150 }} placeholder="Auto-filled" value={form.purchaseBatchNo} onChange={handleChange} />
                </Field>
                <Field label="Vendor Batch No">
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input name="vendorBatchNo" className="vs-input" style={{ ...S.input, width: 140 }} placeholder="Auto or manual" value={form.vendorBatchNo} onChange={handleChange} />
                    <button type="button" className="vs-btn vs-ghost" style={{ ...S.btnGhost, padding: '8px 10px', fontSize: 13 }} onClick={() => setForm(p => ({ ...p, vendorBatchNo: generateVendorBatchNo() }))}>Auto</button>
                  </div>
                </Field>
                <Field label="DC No">
                  <input name="dcNo" className="vs-input" style={{ ...S.input, width: 120 }} placeholder="DC No" value={form.dcNo} onChange={handleChange} />
                </Field>
                <Field label="Invoice / DC No">
                  <input name="invoiceDcNo" className="vs-input" style={{ ...S.input, width: 150 }} placeholder="Invoice/DC No" value={form.invoiceDcNo} onChange={handleChange} />
                </Field>
                <Field label="Vendor Name">
                  <input name="vendorName" className="vs-input" style={{ ...S.input, minWidth: 180 }} placeholder="Vendor Name" value={form.vendorName} onChange={handleChange} />
                </Field>
              </div>

              {/* Divider */}
              <div style={{ borderTop: `1px dashed ${S.border}`, margin: '0 0 16px' }} />

              {/* Row 2: item fields */}
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 16, alignItems: 'flex-end' }}>
                <Field label="Item Name">
                  {itemMaster.length > 0 ? (
                    <select name="itemName" className="vs-input" style={{ ...S.input, minWidth: 220 }} value={form.itemName} onChange={handleChange}>
                      <option value="">Select item…</option>
                      {[...new Set(itemMaster.map(i => i.itemName))].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  ) : (
                    <input name="itemName" className="vs-input" style={{ ...S.input, minWidth: 200 }} placeholder="Item Name" value={form.itemName} onChange={handleChange} />
                  )}
                </Field>
                <Field label="Item Code">
                  <input className="vs-input" style={{ ...S.inputDisabled, width: 130 }} value={form.itemCode} readOnly placeholder="Auto-filled" />
                </Field>
                <Field label="Qty Received">
                  <input type="number" name="qtyReceived" className="vs-input" style={{ ...S.input, width: 105 }} min={0} placeholder="0" value={form.qtyReceived || ''} onChange={handleChange} />
                </Field>
                <Field label="OK Qty">
                  <input type="number" name="okQty" className="vs-input" style={{ ...S.input, width: 90 }} min={0} placeholder="0" value={form.okQty || ''} onChange={handleChange} />
                </Field>
                <Field label="Rework Qty">
                  <input type="number" name="reworkQty" className="vs-input" style={{ ...S.input, width: 95 }} min={0} placeholder="0" value={form.reworkQty || ''} onChange={handleChange} />
                </Field>
                <Field label="Reject Qty">
                  <input type="number" name="rejectQty" className="vs-input" style={{ ...S.input, width: 90 }} min={0} placeholder="0" value={form.rejectQty || ''} onChange={handleChange} />
                </Field>
                <Field label="GRN No">
                  <input name="grnNo" className="vs-input" style={{ ...S.input, width: 110 }} placeholder="GRN No" value={form.grnNo} onChange={handleChange} />
                </Field>
                <Field label="Remarks">
                  <input name="remarks" className="vs-input" style={{ ...S.input, width: 180 }} placeholder="Optional" value={form.remarks} onChange={handleChange} />
                </Field>
              </div>

              {/* Qty hint */}
              {(Number(form.okQty) + Number(form.reworkQty) + Number(form.rejectQty)) > 0 && (
                <div style={{ padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 14, background: S.accentLight, color: S.textSecondary }}>
                  OK + Rework + Reject = <strong>{Number(form.okQty) + Number(form.reworkQty) + Number(form.rejectQty)}</strong>
                  {Number(form.qtyReceived) > 0 && ` · Qty Received = ${Number(form.qtyReceived)}`}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" className="vs-btn" style={{ ...S.btnSuccess, opacity: isSubmitting ? 0.6 : 1, cursor: isSubmitting ? 'not-allowed' : 'pointer' }} disabled={isSubmitting}>
                  {isSubmitting ? 'Saving…' : isEditing ? '✓ Update Record' : '✓ Add Record'}
                </button>
                {isEditing && (
                  <button type="button" className="vs-btn vs-ghost" style={S.btnGhost} onClick={() => { setForm({ ...EMPTY_FORM }); setEditIdx(null); }}>Cancel</button>
                )}
                {!isEditing && (
                  <button type="button" className="vs-btn vs-ghost" style={S.btnGhost} onClick={() => setForm({ ...EMPTY_FORM })}>Clear</button>
                )}
              </div>
            </form>
          </div>

          {/* ── Records Table ─────────────────────────────────────────────── */}
          <div style={S.card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: S.textPrimary }}>VSIR Records</h2>
                <span style={{ fontSize: 12, fontWeight: 600, color: S.textSecondary, background: S.bg, padding: '2px 10px', borderRadius: 20, border: `1px solid ${S.border}` }}>
                  {filteredRecords.length} of {records.length} rows
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="vs-btn vs-ghost" style={{ ...S.btnGhost, borderColor: showFilters ? S.accent : S.border, color: showFilters ? S.accent : S.textSecondary, position: 'relative' }} onClick={() => setShowFilters(f => !f)}>
                  ⚙ Filters
                  {activeFilterCount > 0 && <span style={{ position: 'absolute', top: -6, right: -6, background: S.accent, color: '#fff', borderRadius: '50%', width: 16, height: 16, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{activeFilterCount}</span>}
                </button>
                <button className="vs-btn vs-ghost" style={S.btnGhost} onClick={exportCSV}>↓ CSV</button>
              </div>
            </div>

            {/* Filters */}
            {showFilters && (
              <div style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: '14px 16px', marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <Field label="Search">
                  <input className="vs-input" style={{ ...S.input, minWidth: 220 }} placeholder="PO, indent, vendor, item…" value={filterText} onChange={e => setFilterText(e.target.value)} />
                </Field>
                <Field label="Vendor">
                  <select className="vs-input" style={{ ...S.input, width: 180 }} value={filterVendor} onChange={e => setFilterVendor(e.target.value)}>
                    <option value="">All vendors</option>
                    {uniqueVendors.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </Field>
                <Field label="Date From">
                  <input type="date" className="vs-input" style={{ ...S.input, width: 150 }} value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
                </Field>
                <Field label="Date To">
                  <input type="date" className="vs-input" style={{ ...S.input, width: 150 }} value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
                </Field>
                {activeFilterCount > 0 && (
                  <button className="vs-btn vs-ghost" style={{ ...S.btnGhost, alignSelf: 'flex-end', color: S.danger, borderColor: '#FECACA' }} onClick={() => { setFilterText(''); setFilterVendor(''); setFilterDateFrom(''); setFilterDateTo(''); }}>
                    ✕ Clear all
                  </button>
                )}
              </div>
            )}

            {/* Table */}
            <div style={{ overflowX: 'auto', borderRadius: 8, border: `1px solid ${S.border}` }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
                <thead>
                  <tr>
                    <th style={{ ...S.th, minWidth: 95 }}>Date</th>
                    <th style={{ ...S.th, minWidth: 105 }}>Indent No</th>
                    <th style={{ ...S.th, minWidth: 105 }}>PO No</th>
                    <th style={{ ...S.th, minWidth: 80 }}>OA No</th>
                    <th style={{ ...S.th, minWidth: 120 }}>Purchase Batch</th>
                    <th style={{ ...S.th, minWidth: 110 }}>Vendor Batch</th>
                    <th style={{ ...S.th, minWidth: 90 }}>DC No</th>
                    <th style={{ ...S.th, minWidth: 110 }}>Invoice/DC</th>
                    <th style={{ ...S.th, minWidth: 140 }}>Vendor</th>
                    <th style={{ width: 2, padding: 0, background: S.borderStrong, borderBottom: `2px solid ${S.borderStrong}` }} />
                    <th style={{ ...S.th, minWidth: 160 }}>Item Name</th>
                    <th style={{ ...S.th, minWidth: 110 }}>Item Code</th>
                    <th style={{ ...S.thRight, minWidth: 80 }}>Qty Recv'd</th>
                    <th style={{ ...S.thRight, minWidth: 68 }}>OK Qty</th>
                    <th style={{ ...S.thRight, minWidth: 75 }}>Rework</th>
                    <th style={{ ...S.thRight, minWidth: 68 }}>Reject</th>
                    <th style={{ width: 2, padding: 0, background: S.borderStrong, borderBottom: `2px solid ${S.borderStrong}` }} />
                    <th style={{ ...S.th, minWidth: 90 }}>GRN No</th>
                    <th style={{ ...S.th, minWidth: 120 }}>Remarks</th>
                    <th style={{ ...S.th, textAlign: 'center', minWidth: 96 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.length === 0 ? (
                    <tr><td colSpan={20} style={{ padding: '40px 0', textAlign: 'center', color: S.textMuted, fontSize: 14 }}>
                      {records.length === 0
                        ? (psirData.length > 0
                          ? `No VSIR records yet. Click "↓ Import PSIR / POs" to import ${psirData.length} PSIR record${psirData.length !== 1 ? 's' : ''}.`
                          : 'No records yet. Add your first entry above or import from PSIR / purchase orders.')
                        : 'No rows match current filters.'}
                    </td></tr>
                  ) : filteredRecords.map((rec, rowIdx) => {
                    const origIdx = records.indexOf(rec);
                    const vb = rec.vendorBatchNo || getVendorBatchNoForPO(rec.poNo);
                    return (
                      <tr key={rec.id} className="vs-row" style={{ background: rowIdx % 2 === 1 ? S.bg : S.surface }}>
                        <td style={S.td}>{rec.receivedDate}</td>
                        <td style={{ ...S.td, fontWeight: 600, color: S.accent }}>{rec.indentNo}</td>
                        <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 13 }}>{rec.poNo}</td>
                        <td style={S.td}>{rec.oaNo}</td>
                        <td style={S.td}>{rec.purchaseBatchNo}</td>
                        <td style={S.td}>{vb}</td>
                        <td style={S.td}>{rec.dcNo}</td>
                        <td style={S.td}>{rec.invoiceDcNo}</td>
                        <td style={S.tdClip} title={rec.vendorName}>{rec.vendorName}</td>
                        <td style={{ padding: 0, background: S.border, width: 2 }} />
                        <td style={S.tdClip} title={rec.itemName}>{rec.itemName}</td>
                        <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 13 }}>{rec.itemCode}</td>
                        <td style={{ ...S.tdRight, fontWeight: 600 }}>{rec.qtyReceived}</td>
                        <td style={S.tdRight}><QtyBadge value={Number(rec.okQty) || 0} /></td>
                        <td style={S.tdRight}><QtyBadge value={Number(rec.reworkQty) || 0} warn={false} /></td>
                        <td style={S.tdRight}><QtyBadge value={Number(rec.rejectQty) || 0} warn={true} /></td>
                        <td style={{ padding: 0, background: S.border, width: 2 }} />
                        <td style={S.td}>{rec.grnNo}</td>
                        <td style={S.tdClip} title={rec.remarks}>{rec.remarks}</td>
                        <td style={{ ...S.td, textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                            <button className="vs-btn vs-edit" style={S.btnEdit} onClick={() => handleEdit(origIdx)}>Edit</button>
                            <button className="vs-btn vs-danger" style={{ ...S.btnDanger, padding: '3px 8px' }} onClick={() => handleDelete(origIdx)}>✕</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredRecords.length > 0 && (
              <div style={{ marginTop: 12, fontSize: 13, color: S.textMuted, textAlign: 'right' }}>
                Showing {filteredRecords.length} of {records.length} rows{activeFilterCount > 0 && ` — ${activeFilterCount} filter${activeFilterCount !== 1 ? 's' : ''} active`}
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
};

export default VSIRModule;