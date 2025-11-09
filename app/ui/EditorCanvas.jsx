"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

function getSpec(library, type){ return library.find(l=>l.type===type); }

export default function EditorCanvas({
  library, items, nets, activeTool, layer, selectedId, setSelectedId,
  onDropped, onMoveItem, onRotateItem, onDeleteItem, onCreateNet
}){
  const svgRef = useRef(null);
  const wrapperRef = useRef(null);
  const [view, setView] = useState({ x: -400, y: -300, w: 1200, h: 800 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({mx:0,my:0, vx:0, vy:0});
  const [dragging, setDragging] = useState(null); // {id, dx, dy}
  const [wireFrom, setWireFrom] = useState(null); // {itemId, padId}
  const [selectBox, setSelectBox] = useState(null); // {x,y,w,h}

  const grid = useMemo(()=>({ size: 20 }),[]);

  const screenToSvg = useCallback((clientX, clientY)=>{
    const svg = svgRef.current;
    if (!svg) return {x:0,y:0};
    const pt = svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const { x, y } = pt.matrixTransform(svg.getScreenCTM().inverse());
    return { x, y };
  },[]);

  const handleDrop = (e)=>{
    e.preventDefault();
    const type = e.dataTransfer.getData('text/plain');
    const { x, y } = screenToSvg(e.clientX, e.clientY);
    const snapX = Math.round(x / grid.size) * grid.size;
    const snapY = Math.round(y / grid.size) * grid.size;
    onDropped(type, {x:snapX, y:snapY});
  };

  const onDragOver = (e)=>{ e.preventDefault(); e.dataTransfer.dropEffect='copy'; };

  const startPan = (e)=>{
    if (activeTool!=="pan") return;
    setIsPanning(true);
    panStart.current = { mx: e.clientX, my: e.clientY, vx: view.x, vy: view.y };
  };
  const doPan = (e)=>{
    if (!isPanning) return;
    const dx = e.clientX - panStart.current.mx;
    const dy = e.clientY - panStart.current.my;
    setView(v=>({ ...v, x: panStart.current.vx - dx, y: panStart.current.vy - dy }));
  };
  const endPan = ()=> setIsPanning(false);

  const wheelZoom = (e)=>{
    if (!svgRef.current) return;
    e.preventDefault();
    const { x:cx, y:cy } = screenToSvg(e.clientX, e.clientY);
    const zoomFactor = e.deltaY < 0 ? 0.9 : 1.1;
    setView(v=>{
      const newW = v.w * zoomFactor;
      const newH = v.h * zoomFactor;
      const nx = cx - (cx - v.x) * (newW / v.w);
      const ny = cy - (cy - v.y) * (newH / v.h);
      return { x:nx, y:ny, w:newW, h:newH };
    });
  };

  const startDragItem = (e, item)=>{
    if (activeTool!=="select") return;
    const { x, y } = screenToSvg(e.clientX, e.clientY);
    setDragging({ id: item.id, dx: x - item.x, dy: y - item.y });
    setSelectedId(item.id);
  };
  const doDragItem = (e)=>{
    if (!dragging) return;
    const { x, y } = screenToSvg(e.clientX, e.clientY);
    const nx = Math.round((x - dragging.dx)/grid.size)*grid.size;
    const ny = Math.round((y - dragging.dy)/grid.size)*grid.size;
    onMoveItem(dragging.id, nx, ny);
  };
  const endDragItem = ()=> setDragging(null);

  const onCanvasClick = (e)=>{
    if (activeTool==='select') setSelectedId(null);
  };

  const onPadClick = (e, itemId, padId)=>{
    e.stopPropagation();
    if (activeTool!=="wire") return;
    if (!wireFrom){ setWireFrom({itemId, padId}); return; }
    if (wireFrom.itemId===itemId && wireFrom.padId===padId){ setWireFrom(null); return; }
    onCreateNet(wireFrom, {itemId, padId}, layer);
    setWireFrom(null);
  };

  const keyHandler = useCallback((e)=>{
    if (e.key==='Delete' && selectedId){ onDeleteItem(selectedId); }
    if ((e.key==='r'||e.key==='R') && selectedId){ onRotateItem(selectedId); }
  },[selectedId, onDeleteItem, onRotateItem]);
  useEffect(()=>{
    window.addEventListener('keydown', keyHandler);
    return ()=> window.removeEventListener('keydown', keyHandler);
  },[keyHandler]);

  const viewBox = `${view.x} ${view.y} ${view.w} ${view.h}`;

  const renderGrid = ()=>{
    const lines = [];
    const step = grid.size;
    const x0 = Math.floor((view.x - 2000)/step)*step;
    const x1 = Math.ceil((view.x + view.w + 2000)/step)*step;
    const y0 = Math.floor((view.y - 2000)/step)*step;
    const y1 = Math.ceil((view.y + view.h + 2000)/step)*step;
    for (let x=x0; x<=x1; x+=step){ lines.push(<line key={`vx${x}`} x1={x} x2={x} y1={y0} y2={y1} />); }
    for (let y=y0; y<=y1; y+=step){ lines.push(<line key={`hz${y}`} x1={x0} x2={x1} y1={y} y2={y} />); }
    return <g className="grid">{lines}</g>;
  };

  const renderItem = (item)=>{
    const spec = getSpec(library, item.type);
    const rot = item.rot || 0;
    return (
      <g key={item.id} transform={`translate(${item.x},${item.y}) rotate(${rot})`} onMouseDown={(e)=>startDragItem(e,item)} style={{cursor: activeTool==='select'? 'move':'default'}}>
        {/* Body */}
        {item.type==='resistor' && (
          <g>
            <line x1={-30} y1={0} x2={-12} y2={0} stroke="#f59e0b" strokeWidth={4} />
            <rect x={-12} y={-8} width={24} height={16} rx={4} fill="#f59e0b" />
            <line x1={12} y1={0} x2={30} y2={0} stroke="#f59e0b" strokeWidth={4} />
          </g>
        )}
        {item.type==='capacitor' && (
          <g>
            <line x1={-20} y1={0} x2={-2} y2={0} stroke="#22c55e" strokeWidth={4} />
            <line x1={2} y1={-8} x2={2} y2={8} stroke="#22c55e" strokeWidth={4} />
            <line x1={-2} y1={-8} x2={-2} y2={8} stroke="#22c55e" strokeWidth={4} />
            <line x1={2} y1={0} x2={20} y2={0} stroke="#22c55e" strokeWidth={4} />
          </g>
        )}
        {item.type==='ic' && (
          <g>
            <rect x={-45} y={-25} width={90} height={50} rx={6} fill="#374151" stroke="#4b5563" />
          </g>
        )}
        {item.type==='header' && (
          <g>
            <rect x={-6} y={-32} width={12} height={64} rx={2} fill="#0ea5e9" />
          </g>
        )}
        {/* Pads */}
        {spec.pads.map(p=> (
          <g key={p.id} transform={`translate(${p.x},${p.y})`}>
            <circle className="pad" r={5} fill="#ef4444" stroke="#7f1d1d" onClick={(e)=>onPadClick(e,item.id,p.id)} />
          </g>
        ))}
        {/* Selection outline */}
        {selectedId===item.id && (
          <rect x={-spec.w/2-6} y={-spec.h/2-6} width={spec.w+12} height={spec.h+12} fill="none" stroke="#3b82f6" strokeDasharray="4 3" />
        )}
      </g>
    );
  };

  const getPadWorld = (item, padId)=>{
    const spec = getSpec(library, item.type);
    const pad = spec.pads.find(p=>p.id===padId);
    // apply rotation
    const rad = (item.rot||0) * Math.PI/180;
    const rx = pad.x * Math.cos(rad) - pad.y * Math.sin(rad);
    const ry = pad.x * Math.sin(rad) + pad.y * Math.cos(rad);
    return { x: item.x + rx, y: item.y + ry };
  };

  const renderNets = ()=>{
    return nets.map(n=>{
      const aItem = items.find(i=>i.id===n.a.itemId);
      const bItem = items.find(i=>i.id===n.b.itemId);
      if (!aItem || !bItem) return null;
      const ap = getPadWorld(aItem, n.a.padId);
      const bp = getPadWorld(bItem, n.b.padId);
      const color = n.layer==='top'? '#38bdf8' : '#f472b6';
      return <line key={n.id} x1={ap.x} y1={ap.y} x2={bp.x} y2={bp.y} stroke={color} strokeWidth={2.5} />
    });
  };

  const startSelectBox = (e)=>{
    if (activeTool!=="select") return;
    const { x, y } = screenToSvg(e.clientX, e.clientY);
    setSelectBox({ x, y, w:0, h:0 });
  };
  const doSelectBox = (e)=>{
    if (!selectBox) return;
    const { x, y } = screenToSvg(e.clientX, e.clientY);
    setSelectBox(prev=>({ ...prev, w: x - prev.x, h: y - prev.y }));
  };
  const endSelectBox = ()=> setSelectBox(null);

  return (
    <svg
      ref={svgRef}
      className="canvas"
      onDragOver={onDragOver}
      onDrop={handleDrop}
      onMouseDown={(e)=>{ startPan(e); startSelectBox(e); onCanvasClick(e); }}
      onMouseMove={(e)=>{ doPan(e); doDragItem(e); doSelectBox(e); }}
      onMouseUp={()=>{ endPan(); endDragItem(); endSelectBox(); }}
      onWheel={wheelZoom}
      viewBox={viewBox}
    >
      {renderGrid()}
      {/* origin cross */}
      <g>
        <line x1={-1000} y1={0} x2={1000} y2={0} stroke="#111827" />
        <line x1={0} y1={-1000} x2={0} y2={1000} stroke="#111827" />
      </g>

      {renderNets()}
      {items.map(renderItem)}

      {/* wire preview */}
      {activeTool==='wire' && wireFrom && (
        <WirePreview wireFrom={wireFrom} items={items} library={library} svgRef={svgRef} />
      )}

      {/* selection box */}
      {selectBox && (
        <rect className="selection-box" x={Math.min(selectBox.x, selectBox.x+selectBox.w)} y={Math.min(selectBox.y, selectBox.y+selectBox.h)} width={Math.abs(selectBox.w)} height={Math.abs(selectBox.h)} />
      )}
    </svg>
  );
}

function WirePreview({ wireFrom, items, library, svgRef }){
  const [mouse, setMouse] = useState({x:0,y:0});
  useEffect(()=>{
    const move = (e)=>{
      if (!svgRef.current) return;
      const pt = svgRef.current.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      const { x, y } = pt.matrixTransform(svgRef.current.getScreenCTM().inverse());
      setMouse({x,y});
    };
    window.addEventListener('mousemove', move);
    return ()=> window.removeEventListener('mousemove', move);
  },[svgRef]);
  const aItem = items.find(i=>i.id===wireFrom.itemId);
  if (!aItem) return null;
  const spec = getSpec(library, aItem.type);
  const pad = spec.pads.find(p=>p.id===wireFrom.padId);
  const rad = (aItem.rot||0)*Math.PI/180;
  const ax = aItem.x + (pad.x*Math.cos(rad) - pad.y*Math.sin(rad));
  const ay = aItem.y + (pad.x*Math.sin(rad) + pad.y*Math.cos(rad));
  return <line x1={ax} y1={ay} x2={mouse.x} y2={mouse.y} stroke="#fde047" strokeWidth={2.5} strokeDasharray="6 4" />
}
