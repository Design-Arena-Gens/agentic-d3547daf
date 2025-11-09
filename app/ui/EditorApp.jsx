"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import EditorCanvas from './EditorCanvas';

const LIBRARY = [
  { type: 'resistor', name: 'Resistor', w: 60, h: 16, pads: [{x:-30,y:0,id:'A'},{x:30,y:0,id:'B'}] },
  { type: 'capacitor', name: 'Capacitor', w: 40, h: 22, pads: [{x:-20,y:0,id:'A'},{x:20,y:0,id:'B'}] },
  { type: 'ic', name: 'IC (8-pin)', w: 90, h: 50, pads: [
    {x:-45,y:-20,id:'1'},{x:-45,y:-6,id:'2'},{x:-45,y:6,id:'3'},{x:-45,y:20,id:'4'},
    {x:45,y:-20,id:'5'},{x:45,y:-6,id:'6'},{x:45,y:6,id:'7'},{x:45,y:20,id:'8'}
  ] },
  { type: 'header', name: 'Header (4)', w: 12, h: 64, pads: [
    {x:0,y:-24,id:'1'},{x:0,y:-8,id:'2'},{x:0,y:8,id:'3'},{x:0,y:24,id:'4'}
  ] }
];

function encodeState(state){
  try { return btoa(unescape(encodeURIComponent(JSON.stringify(state)))); } catch { return ''; }
}
function decodeState(s){
  try { return JSON.parse(decodeURIComponent(escape(atob(s)))); } catch { return null; }
}

export default function EditorApp(){
  const [items, setItems] = useState([]); // {id,type,x,y,rot}
  const [nets, setNets] = useState([]);   // {id, a:{itemId,padId}, b:{itemId,padId}, layer}
  const [activeTool, setActiveTool] = useState('select'); // select | wire | pan
  const [layer, setLayer] = useState('top');
  const [selectedId, setSelectedId] = useState(null);
  const [designName, setDesignName] = useState('Untitled Board');

  // load from URL or localStorage
  useEffect(()=>{
    const url = new URL(window.location.href);
    const dataParam = url.searchParams.get('data');
    if (dataParam){
      const state = decodeState(dataParam);
      if (state){ setItems(state.items||[]); setNets(state.nets||[]); setDesignName(state.designName||'Shared Board'); return; }
    }
    const raw = localStorage.getItem('fluxai-lite');
    if (raw){ try { const s = JSON.parse(raw); setItems(s.items||[]); setNets(s.nets||[]); setDesignName(s.designName||'Untitled Board'); } catch {} }
  },[]);

  // persist
  useEffect(()=>{
    const state = { items, nets, designName };
    localStorage.setItem('fluxai-lite', JSON.stringify(state));
  },[items, nets, designName]);

  const addItem = useCallback((type, x, y)=>{
    const spec = LIBRARY.find(l=>l.type===type);
    if (!spec) return;
    const id = `itm_${crypto.randomUUID()}`;
    setItems(prev=>[...prev, { id, type, x, y, rot:0 }]);
  },[]);

  const updateItem = useCallback((id, updater)=>{
    setItems(prev=>prev.map(it=>it.id===id? {...it, ...updater} : it));
  },[]);

  const removeItem = useCallback((id)=>{
    setItems(prev=>prev.filter(it=>it.id!==id));
    setNets(prev=>prev.filter(n=> n.a.itemId!==id && n.b.itemId!==id ));
    if (selectedId===id) setSelectedId(null);
  },[selectedId]);

  const startShare = useCallback(()=>{
    const state = { items, nets, designName };
    const encoded = encodeState(state);
    const url = `${window.location.origin}?data=${encoded}`;
    navigator.clipboard.writeText(url);
    alert('Share URL copied to clipboard');
  },[items,nets,designName]);

  const onDropped = useCallback((type, canvasPoint)=>{
    addItem(type, canvasPoint.x, canvasPoint.y);
  },[addItem]);

  const libDragStart = (e, type)=>{
    e.dataTransfer.setData('text/plain', type);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const libraryCards = LIBRARY.map(l=> (
    <div key={l.type} className="card" draggable onDragStart={(e)=>libDragStart(e,l.type)}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{fontWeight:600}}>{l.name}</div>
        <span className="badge">{l.type}</span>
      </div>
    </div>
  ));

  return (
    <div className="fullscreen">
      <div className="topbar">
        <div className="app-title">Flux.ai Lite</div>
        <div className="badge">PCB Editor</div>
        <div className="spacer" />
        <input className="input" style={{width:240}} value={designName} onChange={e=>setDesignName(e.target.value)} />
        <button className="btn" onClick={startShare}>Share</button>
        <button className="btn" onClick={()=>{ setItems([]); setNets([]); }}>New</button>
      </div>
      <div className="main">
        <aside className="sidebar">
          <h3>Library</h3>
          <div className="list">{libraryCards}</div>
        </aside>
        <div className="canvas-wrap">
          <div className="toolbar">
            <button className="btn" onClick={()=>setActiveTool('select')} style={{borderColor: activeTool==='select'? '#3b82f6':'#263043'}}>Select</button>
            <button className="btn" onClick={()=>setActiveTool('wire')} style={{borderColor: activeTool==='wire'? '#3b82f6':'#263043'}}>Wire</button>
            <button className="btn" onClick={()=>setActiveTool('pan')} style={{borderColor: activeTool==='pan'? '#3b82f6':'#263043'}}>Pan</button>
            <div className="layer-toggle">
              <select className="input" value={layer} onChange={e=>setLayer(e.target.value)}>
                <option value="top">Top</option>
                <option value="bottom">Bottom</option>
              </select>
            </div>
          </div>
          <EditorCanvas
            library={LIBRARY}
            items={items}
            nets={nets}
            activeTool={activeTool}
            layer={layer}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            onDropped={onDropped}
            onMoveItem={(id,x,y)=>updateItem(id,{x,y})}
            onRotateItem={(id)=>updateItem(id,({rot=0})=>({rot: (rot+90)%360}))}
            onDeleteItem={removeItem}
            onCreateNet={(a,b,layerName)=> setNets(prev=>[...prev,{ id:`net_${crypto.randomUUID()}`, a, b, layer:layerName }])}
          />
        </div>
        <aside className="rightbar">
          <h3>Properties</h3>
          <div className="prop">
            <div style={{color:'var(--subtext)', marginBottom:6}}>Selection</div>
            {selectedId ? (
              <div>
                <div>ID: {selectedId}</div>
                <div style={{marginTop:8, display:'flex', gap:8}}>
                  <button className="btn" onClick={()=>updateItem(selectedId,({rot=0})=>({rot:(rot+90)%360}))}>Rotate 90?</button>
                  <button className="btn" onClick={()=>removeItem(selectedId)}>Delete</button>
                </div>
              </div>
            ): <div>No selection</div>}
          </div>
          <div className="prop">
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <div style={{color:'var(--subtext)'}}>Nets</div>
              <div className="badge">{nets.length}</div>
            </div>
            <div style={{maxHeight:200, overflow:'auto', marginTop:8, fontSize:13, color:'#94a3b8'}}>
              {nets.map(n=> (
                <div key={n.id} style={{padding:'4px 0', borderBottom:'1px dashed #1f2937'}}>
                  {n.id.slice(0,10)} ? {n.a.itemId}:{n.a.padId} ? {n.b.itemId}:{n.b.padId} ? {n.layer}
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
