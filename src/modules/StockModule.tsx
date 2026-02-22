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

function CalligraphicHeader({synced}:{synced:boolean}) {
  return (
    <div style={{background:'linear-gradient(135deg,#1a1200 0%,#2d1f00 40%,#1a1200 100%)',borderRadius:16,padding:'28px 36px',marginBottom:28,position:'relative',overflow:'hidden',boxShadow:'0 8px 32px rgba(0,0,0,0.35),inset 0 1px 0 rgba(212,175,55,0.3)'}}>
      <div style={{position:'absolute',top:10,left:12,fontSize:22,color:'rgba(212,175,55,0.5)',fontFamily:'serif'}}>✦</div>
      <div style={{position:'absolute',top:10,right:12,fontSize:22,color:'rgba(212,175,55,0.5)',fontFamily:'serif'}}>✦</div>
      <div style={{position:'absolute',bottom:10,left:12,fontSize:22,color:'rgba(212,175,55,0.5)',fontFamily:'serif'}}>✦</div>
      <div style={{position:'absolute',bottom:10,right:12,fontSize:22,color:'rgba(212,175,55,0.5)',fontFamily:'serif'}}>✦</div>
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:14}}>
        <div style={{flex:1,height:1,background:'linear-gradient(90deg,transparent,rgba(212,175,55,0.6),transparent)'}}/>
        <span style={{color:'rgba(212,175,55,0.7)',fontSize:16,fontFamily:'Georgia,serif'}}>✠</span>
        <div style={{flex:1,height:1,background:'linear-gradient(90deg,transparent,rgba(212,175,55,0.6),transparent)'}}/>
      </div>
      <div style={{textAlign:'center',marginBottom:6}}>
        <div style={{fontFamily:'"Palatino Linotype","Book Antiqua",Palatino,serif',fontSize:38,fontWeight:400,color:'#D4AF37',letterSpacing:'0.08em',textShadow:'0 2px 12px rgba(212,175,55,0.4)',lineHeight:1.1,fontStyle:'italic'}}>
          ✦ AIRTECH ERP ✦
        </div>
        <div style={{fontFamily:'"Palatino Linotype","Book Antiqua",Palatino,serif',fontSize:15,fontWeight:400,color:'rgba(212,175,55,0.75)',letterSpacing:'0.35em',textTransform:'uppercase',marginTop:6}}>
          Inventory Management
        </div>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:12,marginTop:14}}>
        <div style={{flex:1,height:1,background:'linear-gradient(90deg,transparent,rgba(212,175,55,0.6),transparent)'}}/>
        <span style={{color:'rgba(212,175,55,0.7)',fontSize:12,fontFamily:'Georgia,serif',letterSpacing:'0.2em'}}>· STOCK MODULE ·</span>
        <div style={{flex:1,height:1,background:'linear-gradient(90deg,transparent,rgba(212,175,55,0.6),transparent)'}}/>
      </div>
      <div style={{position:'absolute',top:16,right:48,fontSize:11,fontWeight:700,color:synced?'#6ee7a0':'#f87171',letterSpacing:'0.08em'}}>
        {synced?'● SYNCED':'● OFFLINE'}
      </div>
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
  const [showFilters,setShowFilters]=useState(false);
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

  // ── Maps ──────────────────────────────────────────────────────────────────

  // Raw total sent to vendor via Vendor Issue module
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

  // Total returned from vendor via VSIR (ok+rework+reject)
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

  // Net qty still outstanding at vendor (not yet returned)
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

  // Items at vendor dept waiting to be sent for work
  const getVendorQty=useCallback((c:string)=>
    Math.max(0,(vendorDeptMap.qty.get(String(c).trim())||0)-getVendorIssuedQtyTotal(c)),
  [vendorDeptMap,getVendorIssuedQtyTotal]);

  // Vendor-returned ok qty minus what's been re-issued internally (Vendor type)
  const getVendorOkQty=useCallback((c:string)=>
    Math.max(0,getVendorDeptOkQtyTotal(c)-getInHouseQtyByTxType(c,'Vendor')),
  [getVendorDeptOkQtyTotal,getInHouseQtyByTxType]);

  // ★ FIX: Store stock received (PSIR) minus issued from store (Purchase type)
  //   vendorIssuedTotal intentionally NOT subtracted — those items are at vendor,
  //   tracked in vendorQty. They only return to stock via VSIR → vendorOkQty.
  const getPurStoreOkQty=useCallback((itemName:string,itemCode?:string)=>
    Math.max(0,
      getPSIROkQtyTotal(itemName,itemCode)               // received into store via PSIR
      - getInHouseQtyByTxType(itemCode||'','Purchase')   // issued from store (Purchase type)
      // ← NO vendorIssuedTotal deduction here
    ),
  [getPSIROkQtyTotal,getInHouseQtyByTxType]);

  const computeClosingStock=useCallback((itemName:string,itemCode:string,stockQty:number)=>
    (Number(stockQty)||0)
    +getPurStoreOkQty(itemName,itemCode)   // store ok qty
    +getVendorOkQty(itemCode)              // vendor-returned ok qty
    -getInHouseStockOnly(itemName,itemCode), // stock-type in-house issues
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
    if(name==='itemName'){
      const found=itemMasterState.find(item=>item.itemCode===value);
      setForm(prev=>({...prev,itemName:found?found.itemName:'',itemCode:found?found.itemCode:''}));
    }else{
      setForm(prev=>({...prev,[name]:type==='number'?Number(value):value}));
    }
  },[itemMasterState]);

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
    setForm({...EMPTY_FORM});
  },[form,editIdx,records,userUid,getIndentQtyTotal,getPurchaseQtyTotal,getVendorQty,
     getPurStoreOkQty,getVendorOkQty,getInHouseIssuedQtyByItemName,getAdjustedVendorIssuedQty,
     computeClosingStock,showToast]);

  const handleEdit=useCallback((idx:number)=>{
    setForm({...records[idx]});setEditIdx(idx);window.scrollTo({top:0,behavior:'smooth'});
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
        *{box-sizing:border-box;}
      `}</style>
      <ToastContainer toasts={toasts}/>

      <div style={{background:S.bg,fontFamily:"'Geist','DM Sans',system-ui,sans-serif"}}>
        <div style={{maxWidth:1600,margin:'0 auto',padding:'24px 24px 32px'}}>

          <CalligraphicHeader synced={!!userUid}/>

          <div style={{display:'flex',gap:14,marginBottom:24,flexWrap:'wrap'}}>
            <StatCard label="Stock Items" value={records.length}/>
            <StatCard label="Item Master" value={itemMasterState.length} sub="available" color={itemMasterState.length===0?S.warning:S.textPrimary}/>
            <StatCard label="PSIRs" value={psirsState.length} sub="loaded"/>
            <StatCard label="Vendor Depts" value={vendorDeptState.length} sub="loaded"/>
            <StatCard label="In-House Issues" value={inHouseIssuesState.length} sub="loaded"/>
            <StatCard label="Total Closing" value={totalClosing} color={totalClosing<0?S.danger:S.success} sub="across all items"/>
          </div>

          <div style={{...S.card,marginBottom:24}}>
            <h2 style={{margin:'0 0 20px',fontSize:16,fontWeight:700,color:S.textPrimary}}>
              {isEditing?'✎ Edit Stock Record':'New Stock Record'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div style={{display:'flex',gap:14,flexWrap:'wrap',marginBottom:16}}>
                <Field label="Item Name" style={{flex:'1 1 220px'}}>
                  <select name="itemName" className="sk-input"
                    style={{...S.input,borderColor:itemMasterState.length===0?S.warning:S.borderStrong}}
                    value={form.itemCode} onChange={handleChange}>
                    <option value="">{itemMasterState.length===0?'Item Master not loaded…':'Select item…'}</option>
                    {itemMasterState.map(item=><option key={item.id||item.itemCode} value={item.itemCode}>{item.itemName}</option>)}
                  </select>
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
                {isEditing&&<button type="button" className="sk-btn sk-ghost" style={S.btnGhost}
                  onClick={()=>{setForm({...EMPTY_FORM});setEditIdx(null);}}>Cancel</button>}
                {!isEditing&&<button type="button" className="sk-btn sk-ghost" style={S.btnGhost}
                  onClick={()=>setForm({...EMPTY_FORM})}>Clear</button>}
              </div>
            </form>
          </div>

          <div style={S.card}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:10}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <h2 style={{margin:0,fontSize:16,fontWeight:700,color:S.textPrimary}}>Stock Records</h2>
                <span style={{fontSize:12,fontWeight:600,color:S.textSecondary,background:S.bg,padding:'2px 10px',borderRadius:20,border:`1px solid ${S.border}`}}>
                  {filteredRecords.length} of {records.length} items
                </span>
              </div>
              <button className="sk-btn sk-ghost"
                style={{...S.btnGhost,borderColor:showFilters?S.accent:S.border,color:showFilters?S.accent:S.textSecondary}}
                onClick={()=>setShowFilters(f=>!f)}>Search</button>
            </div>

            {showFilters&&(
              <div style={{background:S.bg,border:`1px solid ${S.border}`,borderRadius:8,padding:'14px 16px',marginBottom:16,display:'flex',gap:12,alignItems:'flex-end'}}>
                <Field label="Search items">
                  <input className="sk-input" style={{...S.input,minWidth:260}}
                    placeholder="Item name, code, batch no…" value={filterText}
                    onChange={e=>setFilterText(e.target.value)}/>
                </Field>
                {filterText&&<button className="sk-btn sk-ghost"
                  style={{...S.btnGhost,alignSelf:'flex-end',color:S.danger,borderColor:'#FECACA'}}
                  onClick={()=>setFilterText('')}>✕ Clear</button>}
              </div>
            )}

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