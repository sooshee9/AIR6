import React, { useState, useEffect, useRef, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { getItemMaster, subscribeItemMaster, addItemMaster, updateItemMaster, deleteItemMaster } from '../utils/firestoreServices';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ItemMasterRecord {
  id?: string | number;
  itemName: string;
  itemCode: string;
}

// ─── Design System (matches StockModule) ─────────────────────────────────────
const S = {
  bg: '#F7F8FC', surface: '#FFFFFF', border: '#E4E8F0', borderStrong: '#CBD2E0',
  accent: '#3B5BDB', accentLight: '#EEF2FF',
  success: '#2F9E44',
  danger: '#C92A2A',
  warning: '#E67700',
  textPrimary: '#1A1F36', textSecondary: '#6B7280', textMuted: '#9CA3AF',

  card: { background: '#FFFFFF', border: '1px solid #E4E8F0', borderRadius: 12, padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)' } as React.CSSProperties,
  input: { padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD2E0', fontSize: 14, color: '#1A1F36', background: '#fff', outline: 'none', transition: 'border-color 0.15s', fontFamily: 'inherit', lineHeight: '1.5', width: '100%' } as React.CSSProperties,
  btnSuccess: { background: '#2F9E44', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' } as React.CSSProperties,
  btnGhost: { background: 'transparent', color: '#6B7280', border: '1px solid #E4E8F0', borderRadius: 8, padding: '8px 14px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' } as React.CSSProperties,
  btnDanger: { background: 'transparent', color: '#C92A2A', border: '1px solid #FECACA', borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' } as React.CSSProperties,
  btnEdit: { background: '#EEF2FF', color: '#3B5BDB', border: '1px solid #C5D0FA', borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' } as React.CSSProperties,
  label: { fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 4, display: 'block' },
  th: { padding: '10px 12px', textAlign: 'left' as const, fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.05em', background: '#F7F8FC', borderBottom: '2px solid #E4E8F0', whiteSpace: 'nowrap' as const },
  td: { padding: '10px 12px', fontSize: 14, color: '#1A1F36', borderBottom: '1px solid #F1F3F9', whiteSpace: 'nowrap' as const },
};

// ─── Toast ────────────────────────────────────────────────────────────────────
interface Toast { id: number; msg: string; type: 'success' | 'error' | 'info'; }
let toastId = 0;

function ToastContainer({ toasts }: { toasts: Toast[] }) {
  if (!toasts.length) return null;
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {toasts.map(t => (
        <div key={t.id} style={{ padding: '12px 18px', borderRadius: 10, fontSize: 14, fontWeight: 500, color: '#fff', background: t.type === 'success' ? '#2F9E44' : t.type === 'error' ? '#C92A2A' : '#3B5BDB', boxShadow: '0 4px 16px rgba(0,0,0,0.18)', animation: 'imSlide 0.2s ease', maxWidth: 360, display: 'flex', alignItems: 'center', gap: 8 }}>
          {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'ℹ'} {t.msg}
        </div>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: '1 1 200px' }}>
      <span style={S.label}>{label}</span>
      {children}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ ...S.card, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 110, flex: 1 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: S.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      <span style={{ fontSize: 26, fontWeight: 800, color: color || S.textPrimary, lineHeight: 1.2 }}>{value}</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
const ItemMasterModule: React.FC = () => {
  const [records, setRecords] = useState<ItemMasterRecord[]>([]);
  const [userUid, setUserUid] = useState<string | null>(null);
  const [form, setForm] = useState<ItemMasterRecord>({ itemName: '', itemCode: '' });
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [filterText, setFilterText] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const firestoreUnsubRef = useRef<(() => void) | null>(null);

  const showToast = useCallback((msg: string, type: Toast['type'] = 'info') => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // ─── Auth + Firestore subscription ───────────────────────────────────────
  useEffect(() => {
    const authUnsub = onAuthStateChanged(auth, (u) => {
      const uid = u ? u.uid : null;

      if (!uid) {
        setRecords([]);
        setUserUid(null);
        if (firestoreUnsubRef.current) { try { firestoreUnsubRef.current(); } catch {} firestoreUnsubRef.current = null; }
        return;
      }

      setUserUid(uid);
      if (firestoreUnsubRef.current) { try { firestoreUnsubRef.current(); } catch {} firestoreUnsubRef.current = null; }

      setTimeout(() => {
        try {
          firestoreUnsubRef.current = subscribeItemMaster(uid, (docs) => {
            setRecords(docs.map(d => ({ id: d.id, itemName: d.itemName, itemCode: d.itemCode })));
          });
        } catch {
          getItemMaster(uid)
            .then(items => setRecords(items.map((d: any) => ({ id: d.id, itemName: d.itemName, itemCode: d.itemCode }))))
            .catch(() => setRecords([]));
        }
      }, 100);
    });

    return () => {
      try { authUnsub(); } catch {}
      if (firestoreUnsubRef.current) { try { firestoreUnsubRef.current(); } catch {} firestoreUnsubRef.current = null; }
    };
  }, []);

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.itemName.trim() || !form.itemCode.trim()) {
      showToast('Both Item Name and Item Code are required', 'error');
      return;
    }

    try {
      if (userUid) {
        if (editIdx !== null) {
          const existing = records[editIdx];
          if (existing?.id) {
            await updateItemMaster(userUid, String(existing.id), { itemName: form.itemName, itemCode: form.itemCode });
            showToast('Item updated', 'success');
          }
        } else {
          await addItemMaster(userUid, { itemName: form.itemName, itemCode: form.itemCode });
          showToast('Item added', 'success');
        }
      } else {
        if (editIdx !== null) {
          setRecords(prev => prev.map((rec, i) => i === editIdx ? { ...rec, itemName: form.itemName, itemCode: form.itemCode } : rec));
          showToast('Item updated (local)', 'info');
        } else {
          setRecords(prev => [...prev, { ...form, id: Date.now() }]);
          showToast('Item added (local, not synced)', 'info');
        }
      }
    } catch (err) {
      showToast('Save failed: ' + String((err as any)?.message || err), 'error');
    }

    setForm({ itemName: '', itemCode: '' });
    setEditIdx(null);
  }, [form, editIdx, records, userUid, showToast]);

  const handleEdit = useCallback((idx: number) => {
    setForm(records[idx]);
    setEditIdx(idx);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [records]);

  const handleDelete = useCallback(async (idx: number) => {
    const rec = records[idx];
    try {
      if (userUid && rec?.id) {
        await deleteItemMaster(userUid, String(rec.id));
        showToast('Item deleted', 'success');
      } else {
        setRecords(prev => prev.filter((_, i) => i !== idx));
        showToast('Item deleted (local)', 'success');
      }
    } catch (err) {
      showToast('Delete failed: ' + String((err as any)?.message || err), 'error');
    }
  }, [records, userUid, showToast]);

  // ─── Filtered records ─────────────────────────────────────────────────────
  const filteredRecords = filterText
    ? records.filter(r => [r.itemName, r.itemCode].some(f => String(f || '').toLowerCase().includes(filterText.toLowerCase())))
    : records;

  const isEditing = editIdx !== null;

  return (
    <>
      <style>{`
        @keyframes imSlide { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        .im-btn:hover { opacity: 0.88; }
        .im-row:hover td { background: #F7F8FF !important; }
        .im-input:focus { border-color: #3B5BDB !important; box-shadow: 0 0 0 3px rgba(59,91,219,0.12); }
        .im-ghost:hover { background: #F7F8FC !important; border-color: #CBD2E0 !important; }
        * { box-sizing: border-box; }
      `}</style>

      <ToastContainer toasts={toasts} />

      <div style={{ background: S.bg, minHeight: '100vh', fontFamily: "'Geist', 'DM Sans', system-ui, sans-serif" }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 24px 48px' }}>

          {/* ── Header ───────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: S.textPrimary, letterSpacing: '-0.02em' }}>Item Master</h1>
              <p style={{ margin: '4px 0 0', fontSize: 14, color: S.textSecondary }}>Manage your master list of items and item codes</p>
            </div>
            <span style={{ fontSize: 12, color: userUid ? S.success : S.danger, fontWeight: 600 }}>
              {userUid ? '● Synced' : '● Offline'}
            </span>
          </div>

          {/* ── Stats ────────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
            <StatCard label="Total Items" value={records.length} />
            <StatCard label="Filtered" value={filteredRecords.length} color={S.accent} />
          </div>

          {/* ── Form ─────────────────────────────────────────────────────── */}
          <div style={{ ...S.card, marginBottom: 24 }}>
            <h2 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700, color: S.textPrimary }}>
              {isEditing ? '✎ Edit Item' : '+ New Item'}
            </h2>

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
                <Field label="Item Name">
                  <input
                    className="im-input"
                    type="text"
                    name="itemName"
                    value={form.itemName}
                    onChange={handleChange}
                    placeholder="e.g. Jaw Carrier 01"
                    required
                    style={S.input}
                  />
                </Field>

                <Field label="Item Code">
                  <input
                    className="im-input"
                    type="text"
                    name="itemCode"
                    value={form.itemCode}
                    onChange={handleChange}
                    placeholder="e.g. JW-01"
                    required
                    style={S.input}
                  />
                </Field>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" className="im-btn" style={S.btnSuccess}>
                  {isEditing ? '✓ Update Item' : '✓ Add Item'}
                </button>
                {isEditing && (
                  <button type="button" className="im-btn im-ghost" style={S.btnGhost} onClick={() => { setForm({ itemName: '', itemCode: '' }); setEditIdx(null); }}>
                    Cancel
                  </button>
                )}
                {!isEditing && (
                  <button type="button" className="im-btn im-ghost" style={S.btnGhost} onClick={() => setForm({ itemName: '', itemCode: '' })}>
                    Clear
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* ── Records Table ─────────────────────────────────────────────── */}
          <div style={S.card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: S.textPrimary }}>Item Records</h2>
                <span style={{ fontSize: 12, fontWeight: 600, color: S.textSecondary, background: S.bg, padding: '2px 10px', borderRadius: 20, border: `1px solid ${S.border}` }}>
                  {filteredRecords.length} of {records.length} items
                </span>
              </div>
              <button
                className="im-btn im-ghost"
                style={{ ...S.btnGhost, borderColor: showFilters ? S.accent : S.border, color: showFilters ? S.accent : S.textSecondary }}
                onClick={() => setShowFilters(f => !f)}
              >
                ⚙ Search
              </button>
            </div>

            {showFilters && (
              <div style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8, padding: '14px 16px', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span style={S.label}>Search items</span>
                  <input
                    className="im-input"
                    style={{ ...S.input, minWidth: 260, width: 'auto' }}
                    placeholder="Item name or code…"
                    value={filterText}
                    onChange={e => setFilterText(e.target.value)}
                  />
                </div>
                {filterText && (
                  <button className="im-btn im-ghost" style={{ ...S.btnGhost, color: S.danger, borderColor: '#FECACA' }} onClick={() => setFilterText('')}>✕ Clear</button>
                )}
              </div>
            )}

            <div style={{ overflowX: 'auto', borderRadius: 8, border: `1px solid ${S.border}` }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...S.th, minWidth: 32, textAlign: 'center' }}>#</th>
                    <th style={{ ...S.th, minWidth: 200 }}>Item Name</th>
                    <th style={{ ...S.th, minWidth: 130 }}>Item Code</th>
                    <th style={{ ...S.th, textAlign: 'center', minWidth: 100 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: '40px 0', textAlign: 'center', color: S.textMuted, fontSize: 14 }}>
                        {records.length === 0 ? 'No items yet. Add your first item above.' : 'No items match the search.'}
                      </td>
                    </tr>
                  ) : filteredRecords.map((rec, rowIdx) => {
                    const origIdx = records.indexOf(rec);
                    return (
                      <tr key={rec.id || rowIdx} className="im-row" style={{ background: rowIdx % 2 === 1 ? S.bg : S.surface }}>
                        <td style={{ ...S.td, textAlign: 'center', color: S.textMuted, fontSize: 12 }}>{rowIdx + 1}</td>
                        <td style={{ ...S.td, fontWeight: 500 }}>{rec.itemName}</td>
                        <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 13, color: S.accent, fontWeight: 600 }}>{rec.itemCode}</td>
                        <td style={{ ...S.td, textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                            <button className="im-btn" style={S.btnEdit} onClick={() => handleEdit(origIdx)}>Edit</button>
                            <button className="im-btn" style={{ ...S.btnDanger, padding: '3px 8px' }} onClick={() => handleDelete(origIdx)}>✕</button>
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
    </>
  );
};

export default ItemMasterModule;