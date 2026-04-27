// StockModule — KEY FIX: vendorIssuedTotal is NO LONGER deducted from purStoreOkQty
//
// WHY IT WAS WRONG:
//   Old formula: purStoreOkQty = PSIR_OK - inHousePurchase - vendorIssuedTotal
//   Problem: the moment any PO was imported into Vendor Issue module (even automatically,
//   before any physical issue action), vendorIssuedTotal increased and immediately
//   reduced purStoreOkQty and closingStock in Stock module.
//
// CORRECT LOGIC:
//   purStoreOkQty = PSIR_OK - inHousePurchase    ← vendor issued NOT subtracted here
//   vendorQty     = vendorDeptTotal - vendorIssuedTotal  ← vendor flow tracked separately
//   vendorOkQty   = vendorDeptOkQty - inHouseVendor
//   vendorIssuedQty = vendorIssuedTotal - vsirReceived   ← net still at vendor
//   closingStock  = stockQty + purStoreOkQty + vendorOkQty - inHouseStockOnly
//
//   Items sent to vendor are in "vendorQty" column, NOT deducted from store stock.
//   They only affect stock AFTER returning via VSIR → vendorOkQty.

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import bus from '../utils/eventBus';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import {
  subscribeStockRecords, addStockRecord, updateStockRecord, deleteStockRecord,
  subscribePurchaseOrders, subscribeVendorIssues, subscribeVendorDepts,
  subscribeVSIRRecords, getItemMaster,
} from '../utils/firestoreServices';
import { subscribePsirs } from '../utils/psirService';

interface StockRecord {
  id: string | number;
  itemName: string; itemCode: string; batchNo: string; stockQty: number;
  indentQty: number; purchaseQty: number; vendorQty: number;
  purStoreOkQty: number; vendorOkQty: number; inHouseIssuedQty: number;
  vendorIssuedQty: number; closingStock: number;
}
type RecordForm = Omit<StockRecord, 'id'>;
const EMPTY_FORM: RecordForm = {
  itemName:'',itemCode:'',batchNo:'',stockQty:0,indentQty:0,purchaseQty:0,
  vendorQty:0,purStoreOkQty:0,vendorOkQty:0,inHouseIssuedQty:0,vendorIssuedQty:0,closingStock:0,
};

const S = {
  bg:'#F7F8FC',surface:'#FFFFFF',border:'#E4E8F0',borderStrong:'#CBD2E0',
  accent:'#3B5BDB',accentLight:'#EEF2FF',
  success:'#2F9E44',danger:'#C92A2A',warning:'#E67700',
  textPrimary:'#1A1F36',textSecondary:'#6B7280',textMuted:'#9CA3AF',
  card:{background:'#FFFFFF',border:'1px solid #E4E8F0',borderRadius:12,padding:'24px',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'} as React.CSSProperties,
  input:{padding:'8px 12px',borderRadius:8,border:'1px solid #CBD2E0',fontSize:14,color:'#1A1F36',background:'#fff',outline:'none',transition:'border-color 0.15s',fontFamily:'inherit',lineHeight:'1.5'} as React.CSSProperties,
  inputDisabled:{padding:'8px 12px',borderRadius:8,border:'1px solid #E4E8F0',fontSize:14,color:'#6B7280',background:'#F7F8FC',cursor:'not-allowed',fontFamily:'inherit'} as React.CSSProperties,
  btnSuccess:{background:'#2F9E44',color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit'} as React.CSSProperties,
  btnGhost:{background:'transparent',color:'#6B7280',border:'1px solid #E4E8F0',borderRadius:8,padding:'8px 14px',fontSize:14,fontWeight:500,cursor:'pointer',fontFamily:'inherit'} as React.CSSProperties,
  btnDanger:{background:'transparent',color:'#C92A2A',border:'1px solid #FECACA',borderRadius:6,padding:'4px 10px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'} as React.CSSProperties,
  btnEdit:{background:'#EEF2FF',color:'#3B5BDB',border:'1px solid #C5D0FA',borderRadius:6,padding:'4px 10px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'} as React.CSSProperties,
  label:{fontSize:12,fontWeight:600,color:'#6B7280',textTransform:'uppercase' as const,letterSpacing:'0.05em',marginBottom:4,display:'block'},
  th:{padding:'10px 12px',textAlign:'left' as const,fontSize:11,fontWeight:700,color:'#6B7280',textTransform:'uppercase' as const,letterSpacing:'0.05em',background:'#F7F8FC',borderBottom:'2px solid #E4E8F0',whiteSpace:'nowrap' as const},
  thRight:{padding:'10px 12px',textAlign:'right' as const,fontSize:11,fontWeight:700,color:'#6B7280',textTransform:'uppercase' as const,letterSpacing:'0.05em',background:'#F7F8FC',borderBottom:'2px solid #E4E8F0',whiteSpace:'nowrap' as const},
  td:{padding:'10px 12px',fontSize:14,color:'#1A1F36',borderBottom:'1px solid #F1F3F9',whiteSpace:'nowrap' as const},
  tdClip:{padding:'10px 12px',fontSize:14,color:'#1A1F36',borderBottom:'1px solid #F1F3F9',maxWidth:180,overflow:'hidden' as const,textOverflow:'ellipsis' as const,whiteSpace:'nowrap' as const},
  tdRight:{padding:'10px 12px',fontSize:14,color:'#1A1F36',borderBottom:'1px solid #F1F3F9',textAlign:'right' as const,fontVariantNumeric:'tabular-nums'} as React.CSSProperties,
};

interface Toast { id:number; msg:string; type:'success'|'error'|'info'; }
let toastId = 0;

function ToastContainer({ toasts }: { toasts: Toast[] }) {
  if (!toasts.length) return null;
  return (
    <div style={{position:'fixed',bottom:24,right:24,zIndex:9999,display:'flex',flexDirection:'column',gap:8}}>
      {toasts.map(t => (
        <div key={t.id} style={{padding:'12px 18px',borderRadius:10,fontSize:14,fontWeight:500,color:'#fff',
          background:t.type==='success'?'#2F9E44':t.type==='error'?'#C92A2A':'#3B5BDB',
          boxShadow:'0 4px 16px rgba(0,0,0,0.18)',animation:'stockSlide 0.2s ease',maxWidth:360,display:'flex',alignItems:'center',gap:8}}>
          {t.type==='success'?'✓':t.type==='error'?'✕':'ℹ'} {t.msg}
        </div>
      ))}
    </div>
  );
}

function Field({label,children,style}:{label:string;children:React.ReactNode;style?:React.CSSProperties}) {
  return (
    <div style={{display:'flex',flexDirection:'column',minWidth:0,...style}}>
      <span style={S.label}>{label}</span>
      {children}
    </div>
  );
}

function StatCard({label,value,sub,color}:{label:string;value:string|number;sub?:string;color?:string}) {
  return (
    <div style={{...S.card,padding:'16px 20px',display:'flex',flexDirection:'column',gap:4,minWidth:110,flex:1}}>
      <span style={{fontSize:11,fontWeight:700,color:S.textMuted,textTransform:'uppercase',letterSpacing:'0.06em'}}>{label}</span>
      <span style={{fontSize:26,fontWeight:800,color:color||S.textPrimary,lineHeight:1.2}}>{value}</span>
      {sub&&<span style={{fontSize:12,color:S.textSecondary}}>{sub}</span>}
    </div>
  );
}


const StockModule: React.FC = () => {
  const [form,setForm]=useState<RecordForm>({...EMPTY_FORM});
  const [records,setRecords]=useState<StockRecord[]>([]);
  const [userUid,setUserUid]=useState<string|null>(null);
  const [editIdx,setEditIdx]=useState<number|null>(null);
  const [toasts,setToasts]=useState<Toast[]>([]);
  const [psirsState,setPsirsState]=useState<any[]>([]);
  const [vendorIssuesState,setVendorIssuesState]=useState<any[]>([]);
  const [inHouseIssuesState,setInHouseIssuesState]=useState<any[]>([]);
  const [vendorDeptState,setVendorDeptState]=useState<any[]>([]);
  const [purchaseOrdersState,setPurchaseOrdersState]=useState<any[]>([]);
  const [indentState,setIndentState]=useState<any[]>([]);
  const [vsirRecordsState,setVsirRecordsState]=useState<any[]>([]);
  const [itemMasterState,setItemMasterState]=useState<any[]>([]);
  const [draftPsirItems,setDraftPsirItems]=useState<any[]>([]);
  const [filterText,setFilterText]=useState('');

  // ── NEW: Item search state for the form dropdown ──────────────────────────
  const [itemSearch,setItemSearch]=useState('');
  const [showItemDropdown,setShowItemDropdown]=useState(false);

  const unsubsRef=useRef<Array<()=>void>>([]);

  const showToast=useCallback((msg:string,type:Toast['type']='info')=>{
    const id=++toastId;
    setToasts(prev=>[...prev,{id,msg,type}]);
    setTimeout(()=>setToasts(prev=>prev.filter(t=>t.id!==id)),4000);
  },[]);

  useEffect(()=>{
    const unsub=onAuthStateChanged(auth,u=>setUserUid(u?u.uid:null));
    return ()=>unsub();
  },[]);

  useEffect(()=>{
    unsubsRef.current.forEach(fn=>{try{fn();}catch{}});
    unsubsRef.current=[];
    if(!userUid){
      setRecords([]);setPsirsState([]);setVendorIssuesState([]);
      setInHouseIssuesState([]);setVendorDeptState([]);setPurchaseOrdersState([]);
      setIndentState([]);setVsirRecordsState([]);setItemMasterState([]);
      return;
    }
    const subs:Array<()=>void>=[];
    const trySub=(fn:()=>(()=>void)|undefined)=>{try{const u=fn();if(u)subs.push(u);}catch{}};
    trySub(()=>subscribeStockRecords(userUid,(docs:any[])=>{
      setRecords(docs.map(d=>({
        id:d.id,itemName:d.itemName||'',itemCode:d.itemCode||'',batchNo:d.batchNo||'',
        stockQty:Number(d.stockQty)||0,indentQty:Number(d.indentQty)||0,
        purchaseQty:Number(d.purchaseQty)||0,vendorQty:Number(d.vendorQty)||0,
        purStoreOkQty:Number(d.purStoreOkQty)||0,vendorOkQty:Number(d.vendorOkQty)||0,
        inHouseIssuedQty:Number(d.inHouseIssuedQty)||0,vendorIssuedQty:Number(d.vendorIssuedQty)||0,
        closingStock:Number(d.closingStock)||0,
      }as StockRecord)));
    }));
    trySub(()=>subscribePsirs(userUid,docs=>setPsirsState(docs)));
    trySub(()=>subscribeVendorIssues(userUid,docs=>setVendorIssuesState(docs)));
    trySub(()=>subscribeVendorDepts(userUid,docs=>setVendorDeptState(docs)));
    trySub(()=>subscribePurchaseOrders(userUid,docs=>setPurchaseOrdersState(docs)));
    trySub(()=>subscribeVSIRRecords(userUid,docs=>setVsirRecordsState(docs)));
    try{const u=onSnapshot(collection(db,'users',userUid,'inHouseIssues'),snap=>setInHouseIssuesState(snap.docs.map(d=>({id:d.id,...(d.data() as any)}))));subs.push(u);}catch{}
    try{const u=onSnapshot(collection(db,'users',userUid,'indentData'),snap=>setIndentState(snap.docs.map(d=>({id:d.id,...(d.data() as any)}))));subs.push(u);}catch{}
    getItemMaster(userUid).then(items=>setItemMasterState((items||[])as any[])).catch(()=>setItemMasterState([]));
    unsubsRef.current=subs;
    return ()=>{unsubsRef.current.forEach(fn=>{try{fn();}catch{}});unsubsRef.current=[];};
  },[userUid]);

  useEffect(()=>{
    const handler=(ev:Event)=>{
      try{const det=(ev as CustomEvent).detail||{};if(det.draftItem)setDraftPsirItems(prev=>[...prev,det.draftItem]);else if(det.psirs)setDraftPsirItems([]);}catch{}
      setRecords(prev=>[...prev]);
    };
    try{bus.addEventListener('psir.updated',handler as EventListener);}catch{}
    return ()=>{try{bus.removeEventListener('psir.updated',handler as EventListener);}catch{};};
  },[]);

  useEffect(()=>{try{bus.dispatchEvent(new CustomEvent('stock.updated',{detail:{records}}));}catch{}},[records]);

  const normalize=useCallback((s:any)=>s==null?'':String(s).trim().toLowerCase(),[]);

  // ── Filtered items for searchable dropdown ────────────────────────────────
  const filteredItemOptions=useMemo(()=>{
    if(!itemSearch.trim())return itemMasterState;
    const q=itemSearch.trim().toLowerCase();
    return itemMasterState.filter(item=>
      (item.itemName||'').toLowerCase().includes(q)||
      (item.itemCode||'').toLowerCase().includes(q)
    );
  },[itemMasterState,itemSearch]);

  // ── Maps ──────────────────────────────────────────────────────────────────

  const vendorIssuedMap=useMemo(()=>{
    const m=new Map<string,number>();
    for(const issue of vendorIssuesState){
      if(!Array.isArray(issue.items))continue;
      for(const item of issue.items){
        const qty=Number(item.qty)||0;
        if(!qty)continue;
        const k=String(item.itemCode||'').trim();
        if(k)m.set(k,(m.get(k)||0)+qty);
      }
    }
    return m;
  },[vendorIssuesState]);

  const getVendorIssuedQtyTotal=useCallback((c:string)=>vendorIssuedMap.get(String(c).trim())||0,[vendorIssuedMap]);

  const vsirReceivedMap=useMemo(()=>{
    const m=new Map<string,number>();
    for(const r of vsirRecordsState){
      const k=String(r.itemCode||'').trim();
      const qty=(Number(r.okQty)||0)+(Number(r.reworkQty)||0)+(Number(r.rejectQty)||0);
      if(k&&qty)m.set(k,(m.get(k)||0)+qty);
    }
    return m;
  },[vsirRecordsState]);

  const getVSIRReceivedQtyTotal=useCallback((c:string)=>vsirReceivedMap.get(String(c).trim())||0,[vsirReceivedMap]);

  const getAdjustedVendorIssuedQty=useCallback((c:string)=>
    Math.max(0,getVendorIssuedQtyTotal(c)-getVSIRReceivedQtyTotal(c)),
  [getVendorIssuedQtyTotal,getVSIRReceivedQtyTotal]);

  const vendorDeptMap=useMemo(()=>{
    const qty=new Map<string,number>(),ok=new Map<string,number>();
    for(const order of vendorDeptState){
      if(!Array.isArray(order.items))continue;
      for(const item of order.items){
        const k=String(item.itemCode||'').trim();
        if(typeof item.qty==='number')qty.set(k,(qty.get(k)||0)+item.qty);
        if(typeof item.okQty==='number')ok.set(k,(ok.get(k)||0)+item.okQty);
      }
    }
    return{qty,ok};
  },[vendorDeptState]);

  const purchaseQtyMap=useMemo(()=>{
    const m=new Map<string,number>();
    for(const entry of purchaseOrdersState){
      if(Array.isArray(entry.items)){for(const item of entry.items){if(typeof item.qty==='number'){const k=String(item.itemCode||'').trim();m.set(k,(m.get(k)||0)+item.qty);}}}
      else if(entry.itemCode&&typeof entry.qty==='number'){const k=String(entry.itemCode).trim();m.set(k,(m.get(k)||0)+entry.qty);}
    }
    return m;
  },[purchaseOrdersState]);

  const indentQtyMap=useMemo(()=>{
    const m=new Map<string,number>();
    for(const indent of indentState){
      if(!Array.isArray(indent.items))continue;
      for(const item of indent.items){if(item.itemCode&&typeof item.qty==='number'){const k=String(item.itemCode).trim();m.set(k,(m.get(k)||0)+item.qty);}}
    }
    return m;
  },[indentState]);

  const psirOkMap=useMemo(()=>{
    const m=new Map<string,number>();
    const add=(nk:string,ck:string,v:number)=>{if(nk)m.set('name:'+nk,(m.get('name:'+nk)||0)+v);if(ck)m.set('code:'+ck,(m.get('code:'+ck)||0)+v);};
    const proc=(item:any)=>{
      const name=normalize(item.itemName||item.Item||'');
      const code=normalize(item.itemCode||item.Code||item.CodeNo||'');
      const ok=(item.okQty!=null&&Number(item.okQty)>0)?Number(item.okQty):(Number(item.qtyReceived)||0);
      add(name,code,ok);
    };
    for(const psir of psirsState){if(Array.isArray(psir.items))psir.items.forEach(proc);}
    draftPsirItems.forEach(proc);
    return m;
  },[psirsState,draftPsirItems,normalize]);

  const inHouseMap=useMemo(()=>{
    const m=new Map<string,number>();
    for(const issue of inHouseIssuesState){
      if(!Array.isArray(issue.items))continue;
      for(const item of issue.items){
        const code=normalize(item.itemCode||'');
        const name=normalize(item.itemName||'');
        const txType=item.transactionType||'';
        const qty=Number(item.issueQty||item.qty||0);
        if(!qty)continue;
        m.set(`code:${code}:type:${txType}`,(m.get(`code:${code}:type:${txType}`)||0)+qty);
        m.set(`code:${code}:type:*`,(m.get(`code:${code}:type:*`)||0)+qty);
        m.set(`name:${name}`,(m.get(`name:${name}`)||0)+qty);
        m.set(`name:${name}:code:${code}`,(m.get(`name:${name}:code:${code}`)||0)+qty);
        if(txType==='Stock')m.set(`stock:name:${name}:code:${code}`,(m.get(`stock:name:${name}:code:${code}`)||0)+qty);
      }
    }
    return m;
  },[inHouseIssuesState,normalize]);

  // ── Getters ───────────────────────────────────────────────────────────────

  const getVendorDeptOkQtyTotal=useCallback((c:string)=>vendorDeptMap.ok.get(String(c).trim())||0,[vendorDeptMap]);
  const getPurchaseQtyTotal=useCallback((c:string)=>purchaseQtyMap.get(String(c).trim())||0,[purchaseQtyMap]);
  const getIndentQtyTotal=useCallback((c:string)=>indentQtyMap.get(String(c).trim())||0,[indentQtyMap]);

  const getPSIROkQtyTotal=useCallback((itemName:string,itemCode?:string)=>
    Math.max(psirOkMap.get('name:'+normalize(itemName))||0,psirOkMap.get('code:'+normalize(itemCode))||0),
  [psirOkMap,normalize]);

  const getInHouseQtyByTxType=useCallback((c:string,tx:string)=>
    inHouseMap.get(tx==='*'?`code:${normalize(c)}:type:*`:`code:${normalize(c)}:type:${tx}`)||0,
  [inHouseMap,normalize]);

  const getInHouseIssuedQtyByItemName=useCallback((itemName:string,itemCode?:string)=>
    Math.max(inHouseMap.get(`name:${normalize(itemName)}`)||0,inHouseMap.get(`code:${normalize(itemCode)}:type:*`)||0),
  [inHouseMap,normalize]);

  const getInHouseStockOnly=useCallback((itemName:string,itemCode?:string)=>
    inHouseMap.get(`stock:name:${normalize(itemName)}:code:${normalize(itemCode)}`)||0,
  [inHouseMap,normalize]);

  // ── Column calculations ───────────────────────────────────────────────────

  const getVendorQty=useCallback((c:string)=>
    Math.max(0,(vendorDeptMap.qty.get(String(c).trim())||0)-getVendorIssuedQtyTotal(c)),
  [vendorDeptMap,getVendorIssuedQtyTotal]);

  const getVendorOkQty=useCallback((c:string)=>
    Math.max(0,getVendorDeptOkQtyTotal(c)-getInHouseQtyByTxType(c,'Vendor')),
  [getVendorDeptOkQtyTotal,getInHouseQtyByTxType]);

  const getPurStoreOkQty=useCallback((itemName:string,itemCode?:string)=>
    Math.max(0,
      getPSIROkQtyTotal(itemName,itemCode)
      - getInHouseQtyByTxType(itemCode||'','Purchase')
    ),
  [getPSIROkQtyTotal,getInHouseQtyByTxType]);

  const computeClosingStock=useCallback((itemName:string,itemCode:string,stockQty:number)=>
    (Number(stockQty)||0)
    +getPurStoreOkQty(itemName,itemCode)
    +getVendorOkQty(itemCode)
    -getInHouseStockOnly(itemName,itemCode),
  [getPurStoreOkQty,getVendorOkQty,getInHouseStockOnly]);

  // ── Live preview ──────────────────────────────────────────────────────────

  const liveCalc=useMemo(()=>{
    const{itemName,itemCode,stockQty}=form;
    if(!itemName&&!itemCode)return null;
    return{
      indentQty:       getIndentQtyTotal(itemCode),
      purchaseQty:     getPurchaseQtyTotal(itemCode),
      vendorQty:       getVendorQty(itemCode),
      purStoreOkQty:   getPurStoreOkQty(itemName,itemCode),
      vendorOkQty:     getVendorOkQty(itemCode),
      inHouseIssuedQty:getInHouseIssuedQtyByItemName(itemName,itemCode),
      vendorIssuedQty: getAdjustedVendorIssuedQty(itemCode),
      closingStock:    computeClosingStock(itemName,itemCode,stockQty),
    };
  },[form,getIndentQtyTotal,getPurchaseQtyTotal,getVendorQty,getPurStoreOkQty,
     getVendorOkQty,getInHouseIssuedQtyByItemName,getAdjustedVendorIssuedQty,computeClosingStock]);

  const filteredRecords=useMemo(()=>{
    if(!filterText)return records;
    const q=filterText.toLowerCase();
    return records.filter(r=>[r.itemName,r.itemCode,r.batchNo].some(f=>String(f||'').toLowerCase().includes(q)));
  },[records,filterText]);

  const totalClosing=useMemo(()=>
    records.reduce((s,r)=>s+computeClosingStock(r.itemName,r.itemCode,r.stockQty),0),
  [records,computeClosingStock]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleChange=useCallback((e:React.ChangeEvent<HTMLInputElement|HTMLSelectElement>)=>{
    const{name,value,type}=e.target;
    setForm(prev=>({...prev,[name]:type==='number'?Number(value):value}));
  },[]);

  // Select item from dropdown
  const handleSelectItem=useCallback((item:any)=>{
    setForm(prev=>({...prev,itemName:item.itemName||'',itemCode:item.itemCode||''}));
    setItemSearch(item.itemName||'');
    setShowItemDropdown(false);
  },[]);

  const resetForm=useCallback(()=>{
    setForm({...EMPTY_FORM});
    setItemSearch('');
    setEditIdx(null);
  },[]);

  const handleSubmit=useCallback(async(e:React.FormEvent)=>{
    e.preventDefault();
    if(!form.itemName){showToast('Item Name is required','error');return;}
    const autoRecord:RecordForm={
      ...form,
      indentQty:       getIndentQtyTotal(form.itemCode),
      purchaseQty:     getPurchaseQtyTotal(form.itemCode),
      vendorQty:       getVendorQty(form.itemCode),
      purStoreOkQty:   getPurStoreOkQty(form.itemName,form.itemCode),
      vendorOkQty:     getVendorOkQty(form.itemCode),
      inHouseIssuedQty:getInHouseIssuedQtyByItemName(form.itemName,form.itemCode),
      vendorIssuedQty: getAdjustedVendorIssuedQty(form.itemCode),
      closingStock:    computeClosingStock(form.itemName,form.itemCode,form.stockQty),
    };
    if(editIdx!==null){
      const existing=records[editIdx];
      if(userUid&&typeof(existing as any).id==='string'){
        await updateStockRecord(userUid,String((existing as any).id),autoRecord)
          .then(()=>{setRecords(prev=>prev.map((r,i)=>i===editIdx?{...autoRecord,id:r.id}:r));showToast('Record updated','success');})
          .catch(err=>showToast('Update failed: '+String((err as any)?.message||err),'error'));
      }else{
        setRecords(prev=>prev.map((r,i)=>i===editIdx?{...autoRecord,id:r.id}:r));
        showToast('Record updated (local)','success');
      }
      setEditIdx(null);
    }else{
      if(userUid){
        await addStockRecord(userUid,autoRecord)
          .then((newId:any)=>{setRecords(prev=>[...prev,{...autoRecord,id:newId}as any]);showToast('Record added','success');})
          .catch(err=>{showToast('Add failed: '+String((err as any)?.message||err),'error');setRecords(prev=>[...prev,{...autoRecord,id:Date.now()}]);});
      }else{
        setRecords(prev=>[...prev,{...autoRecord,id:Date.now()}]);
        showToast('Record added (local)','info');
      }
    }
    resetForm();
  },[form,editIdx,records,userUid,getIndentQtyTotal,getPurchaseQtyTotal,getVendorQty,
     getPurStoreOkQty,getVendorOkQty,getInHouseIssuedQtyByItemName,getAdjustedVendorIssuedQty,
     computeClosingStock,showToast,resetForm]);

  const handleEdit=useCallback((idx:number)=>{
    setForm({...records[idx]});
    setItemSearch(records[idx].itemName||'');
    setEditIdx(idx);
    window.scrollTo({top:0,behavior:'smooth'});
  },[records]);

  const handleDelete=useCallback(async(idx:number)=>{
    const rec=records[idx];
    if(userUid&&typeof(rec as any).id==='string'){
      await deleteStockRecord(userUid,String((rec as any).id))
        .then(()=>showToast('Record deleted','success'))
        .catch(err=>showToast('Delete failed: '+String((err as any)?.message||err),'error'));
    }else{
      setRecords(prev=>prev.filter((_,i)=>i!==idx));
      showToast('Record deleted (local)','success');
    }
  },[records,userUid,showToast]);

  const isEditing=editIdx!==null;

  return (
    <>
      <style>{`
        @keyframes stockSlide{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}
        .sk-btn:hover{opacity:0.88;} .sk-row:hover td{background:#F7F8FF!important;}
        .sk-input:focus{border-color:#3B5BDB!important;box-shadow:0 0 0 3px rgba(59,91,219,0.12);}
        .sk-ghost:hover{background:#F7F8FC!important;border-color:#CBD2E0!important;}
        .sk-dd-item:hover{background:#EEF2FF!important;}
        *{box-sizing:border-box;}
      `}</style>
      <ToastContainer toasts={toasts}/>

      <div style={{background:S.bg,fontFamily:"'Geist','DM Sans',system-ui,sans-serif"}}>
        <div style={{maxWidth:1600,margin:'0 auto',padding:'24px 24px 32px'}}>

          {/* ── Stat Cards ─────────────────────────────────────────────────── */}
          <div style={{display:'flex',gap:14,marginBottom:24,flexWrap:'wrap'}}>
            <StatCard label="Stock Items" value={records.length}/>
            <StatCard label="Item Master" value={itemMasterState.length} sub="available" color={itemMasterState.length===0?S.warning:S.textPrimary}/>
            <StatCard label="PSIRs" value={psirsState.length} sub="loaded"/>
            <StatCard label="Vendor Depts" value={vendorDeptState.length} sub="loaded"/>
            <StatCard label="In-House Issues" value={inHouseIssuesState.length} sub="loaded"/>
            <StatCard label="Total Closing" value={totalClosing} color={totalClosing<0?S.danger:S.success} sub="across all items"/>
          </div>

          {/* ── New / Edit Stock Record Form ───────────────────────────────── */}
          <div style={{...S.card,marginBottom:24}}>
            <h2 style={{margin:'0 0 20px',fontSize:16,fontWeight:700,color:S.textPrimary}}>
              {isEditing?'✎ Edit Stock Record':'New Stock Record'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div style={{display:'flex',gap:14,flexWrap:'wrap',marginBottom:16}}>

                {/* ── Searchable Item Name dropdown ──────────────────────── */}
                <Field label="Item Name" style={{flex:'1 1 260px'}}>
                  <div style={{position:'relative'}}>
                    <div style={{position:'relative',display:'flex',alignItems:'center'}}>
                      <input
                        className="sk-input"
                        style={{
                          ...S.input,
                          width:'100%',
                          paddingRight:32,
                          borderColor:itemMasterState.length===0?S.warning:showItemDropdown?S.accent:S.borderStrong,
                          boxShadow:showItemDropdown?`0 0 0 3px rgba(59,91,219,0.12)`:'none',
                        }}
                        placeholder={
                          itemMasterState.length===0
                            ?'Item Master not loaded…'
                            :'Search item name or code…'
                        }
                        value={itemSearch}
                        autoComplete="off"
                        onChange={e=>{
                          setItemSearch(e.target.value);
                          setShowItemDropdown(true);
                          // If user clears the search, clear the form selection too
                          if(!e.target.value){
                            setForm(prev=>({...prev,itemName:'',itemCode:''}));
                          }
                        }}
                        onFocus={()=>setShowItemDropdown(true)}
                        onBlur={()=>setTimeout(()=>setShowItemDropdown(false),160)}
                      />
                      {/* Search icon / clear button */}
                      <span style={{
                        position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',
                        color:S.textMuted,fontSize:13,pointerEvents:itemSearch?'auto':'none',cursor:itemSearch?'pointer':'default',
                      }}
                        onMouseDown={e=>{e.preventDefault();setItemSearch('');setForm(prev=>({...prev,itemName:'',itemCode:''}));setShowItemDropdown(true);}}
                      >
                        {itemSearch?'✕':'⌕'}
                      </span>
                    </div>

                    {/* Dropdown list */}
                    {showItemDropdown&&(
                      <div style={{
                        position:'absolute',top:'calc(100% + 4px)',left:0,right:0,zIndex:1000,
                        background:'#fff',border:`1px solid ${S.borderStrong}`,
                        borderRadius:10,boxShadow:'0 8px 24px rgba(0,0,0,0.13)',
                        maxHeight:240,overflowY:'auto',
                      }}>
                        {filteredItemOptions.length===0?(
                          <div style={{padding:'12px 14px',fontSize:13,color:S.textMuted,textAlign:'center'}}>
                            {itemMasterState.length===0?'Item Master not loaded':'No items match'}
                          </div>
                        ):filteredItemOptions.map(item=>(
                          <div
                            key={item.id||item.itemCode}
                            className="sk-dd-item"
                            onMouseDown={e=>{e.preventDefault();handleSelectItem(item);}}
                            style={{
                              padding:'9px 14px',fontSize:14,cursor:'pointer',
                              display:'flex',alignItems:'center',justifyContent:'space-between',
                              borderBottom:`1px solid ${S.border}`,transition:'background 0.1s',
                              background: form.itemCode===item.itemCode ? S.accentLight : '#fff',
                            }}
                          >
                            <span style={{fontWeight:600,color:S.textPrimary}}>{item.itemName}</span>
                            <span style={{fontSize:12,color:S.textMuted,fontFamily:'monospace',marginLeft:10,flexShrink:0}}>{item.itemCode}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Field>

                <Field label="Item Code">
                  <input style={{...S.inputDisabled,width:130}} value={form.itemCode} readOnly placeholder="Auto-filled"/>
                </Field>
                <Field label="Batch No">
                  <input name="batchNo" className="sk-input" style={{...S.input,width:130}}
                    placeholder="Optional" value={form.batchNo} onChange={handleChange}/>
                </Field>
                <Field label="Opening Stock Qty">
                  <input type="number" name="stockQty" className="sk-input" style={{...S.input,width:120}}
                    placeholder="0" min={0} value={form.stockQty||''} onChange={handleChange}/>
                </Field>
                <Field label="In-House Issued Qty">
                  <input style={{...S.inputDisabled,width:130}} value={liveCalc?.inHouseIssuedQty??0} readOnly/>
                </Field>
                <Field label="Vendor Issued Qty">
                  <input style={{...S.inputDisabled,width:120}} value={liveCalc?.vendorIssuedQty??0} readOnly/>
                </Field>
              </div>

              {liveCalc&&(
                <div style={{background:S.bg,border:`1px solid ${S.border}`,borderRadius:10,padding:'16px 20px',marginBottom:16}}>
                  <div style={{fontSize:12,fontWeight:700,color:S.textMuted,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:12}}>
                    Auto-computed fields
                  </div>
                  <div style={{display:'flex',gap:20,flexWrap:'wrap'}}>
                    {[
                      {label:'Indent Qty',      value:liveCalc.indentQty},
                      {label:'Purchase Qty',    value:liveCalc.purchaseQty},
                      {label:'Vendor Qty',      value:liveCalc.vendorQty,     hint:'VendorDept − Issued'},
                      {label:'Pur Store OK Qty',value:liveCalc.purStoreOkQty, hint:'PSIR − InHouse(Purchase)', accent:true},
                      {label:'Vendor OK Qty',   value:liveCalc.vendorOkQty,   accent:true},
                      {label:'Closing Stock',   value:liveCalc.closingStock,  closing:true},
                    ].map(f=>(
                      <div key={f.label} style={{display:'flex',flexDirection:'column',gap:2,minWidth:100}}>
                        <span style={{...S.label,marginBottom:2}}>{f.label}</span>
                        {f.hint&&<span style={{fontSize:10,color:S.textMuted,marginBottom:2}}>{f.hint}</span>}
                        <span style={{
                          fontSize:f.closing?22:18,fontWeight:800,
                          color:f.closing?(liveCalc.closingStock<0?S.danger:S.success):f.accent?S.accent:S.textPrimary,
                          fontVariantNumeric:'tabular-nums',
                        }}>{f.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{display:'flex',gap:10}}>
                <button type="submit" className="sk-btn" style={S.btnSuccess}>
                  {isEditing?'✓ Update Record':'✓ Add Record'}
                </button>
                {isEditing&&(
                  <button type="button" className="sk-btn sk-ghost" style={S.btnGhost}
                    onClick={resetForm}>Cancel</button>
                )}
                {!isEditing&&(
                  <button type="button" className="sk-btn sk-ghost" style={S.btnGhost}
                    onClick={resetForm}>Clear</button>
                )}
              </div>
            </form>
          </div>

          {/* ── Stock Records Table ────────────────────────────────────────── */}
          <div style={S.card}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:10}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <h2 style={{margin:0,fontSize:16,fontWeight:700,color:S.textPrimary}}>Stock Records</h2>
                <span style={{fontSize:12,fontWeight:600,color:S.textSecondary,background:S.bg,padding:'2px 10px',borderRadius:20,border:`1px solid ${S.border}`}}>
                  {filteredRecords.length} of {records.length} items
                </span>
              </div>

              {/* ── Always-visible search bar ────────────────────────────── */}
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{position:'relative',display:'flex',alignItems:'center'}}>
                  <span style={{
                    position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',
                    fontSize:14,color:S.textMuted,pointerEvents:'none',
                  }}>⌕</span>
                  <input
                    className="sk-input"
                    style={{
                      ...S.input,
                      paddingLeft:30,
                      paddingRight:filterText?30:12,
                      minWidth:260,
                    }}
                    placeholder="Search by name, code, batch…"
                    value={filterText}
                    onChange={e=>setFilterText(e.target.value)}
                  />
                  {filterText&&(
                    <span
                      style={{
                        position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',
                        fontSize:13,color:S.textMuted,cursor:'pointer',
                      }}
                      onClick={()=>setFilterText('')}
                    >✕</span>
                  )}
                </div>
              </div>
            </div>

            <div style={{overflowX:'auto',borderRadius:8,border:`1px solid ${S.border}`}}>
              <table style={{width:'100%',borderCollapse:'collapse',tableLayout:'auto'}}>
                <thead>
                  <tr>
                    <th style={{...S.th,minWidth:32,textAlign:'center'}}>#</th>
                    <th style={{...S.th,minWidth:160}}>Item Name</th>
                    <th style={{...S.th,minWidth:110}}>Item Code</th>
                    <th style={{...S.th,minWidth:100}}>Batch No</th>
                    <th style={{...S.thRight,minWidth:90}}>Opening Stock</th>
                    <th style={{width:2,padding:0,background:S.borderStrong,borderBottom:`2px solid ${S.borderStrong}`}}/>
                    <th style={{...S.thRight,minWidth:80}}>Indent Qty</th>
                    <th style={{...S.thRight,minWidth:88}}>Purchase Qty</th>
                    <th style={{...S.thRight,minWidth:80}}>Vendor Qty</th>
                    <th style={{width:2,padding:0,background:S.borderStrong,borderBottom:`2px solid ${S.borderStrong}`}}/>
                    <th style={{...S.thRight,minWidth:110}}>Pur Store OK</th>
                    <th style={{...S.thRight,minWidth:96}}>Vendor OK</th>
                    <th style={{width:2,padding:0,background:S.borderStrong,borderBottom:`2px solid ${S.borderStrong}`}}/>
                    <th style={{...S.thRight,minWidth:110}}>In-House Issued</th>
                    <th style={{...S.thRight,minWidth:100}}>Vendor Issued</th>
                    <th style={{width:2,padding:0,background:S.borderStrong,borderBottom:`2px solid ${S.borderStrong}`}}/>
                    <th style={{...S.thRight,minWidth:100}}>Closing Stock</th>
                    <th style={{...S.th,textAlign:'center',minWidth:96}}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.length===0?(
                    <tr><td colSpan={18} style={{padding:'40px 0',textAlign:'center',color:S.textMuted,fontSize:14}}>
                      {records.length===0?'No stock records yet. Add your first item above.':'No items match the search.'}
                    </td></tr>
                  ):filteredRecords.map((rec,rowIdx)=>{
                    const origIdx=records.indexOf(rec);
                    const indentQty=     getIndentQtyTotal(rec.itemCode);
                    const purchaseQty=   getPurchaseQtyTotal(rec.itemCode);
                    const vendorQty=     getVendorQty(rec.itemCode);
                    const purStoreOkQty= getPurStoreOkQty(rec.itemName,rec.itemCode);
                    const vendorOkQty=   getVendorOkQty(rec.itemCode);
                    const inHouseIssued= getInHouseIssuedQtyByItemName(rec.itemName,rec.itemCode);
                    const vendorIssued=  getAdjustedVendorIssuedQty(rec.itemCode);
                    const closing=       computeClosingStock(rec.itemName,rec.itemCode,rec.stockQty);
                    return(
                      <tr key={rec.id} className="sk-row" style={{background:rowIdx%2===1?S.bg:S.surface}}>
                        <td style={{...S.td,textAlign:'center',color:S.textMuted,fontSize:12}}>{rowIdx+1}</td>
                        <td style={S.tdClip} title={rec.itemName}>{rec.itemName}</td>
                        <td style={{...S.td,fontFamily:'monospace',fontSize:13}}>{rec.itemCode}</td>
                        <td style={S.td}>{rec.batchNo}</td>
                        <td style={{...S.tdRight,fontWeight:600}}>{rec.stockQty}</td>
                        <td style={{padding:0,background:S.border,width:2}}/>
                        <td style={S.tdRight}>{indentQty}</td>
                        <td style={S.tdRight}>{purchaseQty}</td>
                        <td style={S.tdRight}>{vendorQty}</td>
                        <td style={{padding:0,background:S.border,width:2}}/>
                        <td style={{...S.tdRight,color:S.accent,fontWeight:600}}>{purStoreOkQty}</td>
                        <td style={{...S.tdRight,color:S.accent,fontWeight:600}}>{vendorOkQty}</td>
                        <td style={{padding:0,background:S.border,width:2}}/>
                        <td style={S.tdRight}>{inHouseIssued}</td>
                        <td style={S.tdRight}>{vendorIssued}</td>
                        <td style={{padding:0,background:S.border,width:2}}/>
                        <td style={{...S.tdRight,fontWeight:800,fontSize:15,color:closing<0?S.danger:S.success}}>{closing}</td>
                        <td style={{...S.td,textAlign:'center'}}>
                          <div style={{display:'flex',gap:4,justifyContent:'center'}}>
                            <button className="sk-btn" style={S.btnEdit} onClick={()=>handleEdit(origIdx)}>Edit</button>
                            <button className="sk-btn" style={{...S.btnDanger,padding:'3px 8px'}} onClick={()=>handleDelete(origIdx)}>✕</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {filteredRecords.length>0&&(
                  <tfoot>
                    <tr style={{background:S.accentLight}}>
                      <td colSpan={16} style={{...S.td,fontWeight:700,color:S.textSecondary,fontSize:12,textTransform:'uppercase',letterSpacing:'0.05em'}}>
                        Total ({filteredRecords.length} items)
                      </td>
                      <td style={{padding:0,background:S.borderStrong,width:2}}/>
                      <td style={{...S.tdRight,fontWeight:800,color:totalClosing<0?S.danger:S.success,fontSize:15}}>{totalClosing}</td>
                      <td style={S.td}/>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

        </div>
      </div>
    </>
  );
};

export default StockModule;