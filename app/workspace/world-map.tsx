'use client';
import {useEffect,useRef,useState,type PointerEvent as ReactPointerEvent} from 'react';
import {MapPin,Plus,Minus,Maximize2,Trash2,X} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {type Entity,colors} from '@/lib/model';
import {markerAppearance,markerLabel,markerFonts,markerShapes,moveMarker,MIN_MARKER_SCALE,MAX_MARKER_SCALE,MARKER_SIZE,DEFAULT_MARKER_COLOR,type MapMarker} from '@/lib/world-map';
import {ImageUpload,Field,EntityPicker} from './ui';
import MapLabelEditor from './map-label-editor';
import {MapMarkerSymbol,MapShapeChoices} from './map-symbols';
type Drag={type:'pan';clientX:number;clientY:number;x:number;y:number}|{type:'pin';id:string;clientX:number;clientY:number;x:number;y:number;width:number;height:number};
export default function WorldMap({payload,onChange,entities,onOpen,readonly=false,uploading=false,onBusyChange}:{payload:Record<string,any>;onChange:(p:Record<string,any>)=>void;entities:Entity[];onOpen:(id:string)=>void;readonly?:boolean;uploading?:boolean;onBusyChange?:(busy:boolean)=>void}){
 const [zoom,setZoom]=useState(1),[pos,setPos]=useState({x:0,y:0}),[placing,setPlacing]=useState(false),[selected,setSelected]=useState('');
 const [area,setArea]=useState({width:800,height:550}),[natural,setNatural]=useState({width:1,height:1});
 const drag=useRef<Drag|null>(null),imageRef=useRef<HTMLDivElement>(null),areaRef=useRef<HTMLDivElement>(null);
 const pins:MapMarker[]=payload.pins??[],pin=pins.find(p=>p.id===selected),appearance=pin?markerAppearance(pin):null;
 const fit=Math.min(area.width*.9/natural.width,area.height*.9/natural.height);
 useEffect(()=>{const el=areaRef.current;if(!el)return;const observer=new ResizeObserver(()=>setArea({width:Math.max(1,el.clientWidth),height:Math.max(1,el.clientHeight)}));observer.observe(el);return()=>observer.disconnect()},[]);
 useEffect(()=>{drag.current=null;setPlacing(false);if(readonly)setSelected('')},[readonly]);
 const payloadRef=useRef(payload);payloadRef.current=payload;
 const change=(patch:Record<string,any>)=>{if(readonly)return;const next={...payloadRef.current,...patch};payloadRef.current=next;onChange(next)};
 const edit=(id:string,patch:Partial<MapMarker>)=>change({pins:(payloadRef.current.pins??[]).map((p:MapMarker)=>p.id===id?{...p,...patch}:p)});
 const editLabel=(id:string,patch:MapMarker['label'])=>{const current=(payloadRef.current.pins??[]).find((p:MapMarker)=>p.id===id);if(current)edit(id,{label:{...markerLabel(current),...patch}})};
 const reset=()=>{setZoom(1);setPos({x:0,y:0})};
 const pointerMove=(e:ReactPointerEvent<HTMLDivElement>)=>{
  const d=drag.current;if(!d)return;
  if(d.type==='pan')setPos({x:d.x+e.clientX-d.clientX,y:d.y+e.clientY-d.clientY});
  else if(!readonly)edit(d.id,moveMarker(d,{x:e.clientX-d.clientX,y:e.clientY-d.clientY},d));
 };
 return <div className="board-shell world-map" data-map-mode={readonly?'read':'edit'}>
  <div className="canvas-toolbar map-toolbar">
   {!readonly&&<div><ImageUpload disabled={uploading} onBusyChange={onBusyChange} label={payload.image?'Заменить карту':'Загрузить карту'} onUpload={url=>{change({image:url});reset();setSelected('');setPlacing(false)}}/><Button variant={placing?'default':'outline'} size="sm" disabled={!payload.image||pins.length>=100} aria-label="Добавить метку" onClick={()=>setPlacing(!placing)}><MapPin size={15}/>{placing?'Выберите точку':'Добавить метку'}</Button></div>}
   <div><button className="icon-btn" title="Уменьшить" aria-label="Уменьшить карту" disabled={!payload.image} onClick={()=>setZoom(s=>Math.max(.4,s-.2))}><Minus size={17}/></button><button className="icon-btn" title="Увеличить" aria-label="Увеличить карту" disabled={!payload.image} onClick={()=>setZoom(s=>Math.min(4,s+.2))}><Plus size={17}/></button><button className="icon-btn" title="По размеру окна" aria-label="Карта по размеру окна" disabled={!payload.image} onClick={reset}><Maximize2 size={17}/></button></div>
  </div>
  {!readonly&&payload.image&&<p className="map-notice">Нажмите на метку, чтобы изменить её. Перетаскивайте метки по карте. При замене изображения проверьте их расположение.</p>}
  <div className="board-body"><div ref={areaRef} className={'map-area '+(placing?'placing':'')} onPointerDown={e=>{if((e.target as HTMLElement).closest('button,input,label')||placing)return;drag.current={type:'pan',clientX:e.clientX,clientY:e.clientY,x:pos.x,y:pos.y};e.currentTarget.setPointerCapture(e.pointerId)}} onPointerMove={pointerMove} onPointerUp={()=>{drag.current=null}} onPointerCancel={()=>{drag.current=null}}>
   {payload.image?<div ref={imageRef} className="map-image" style={{width:natural.width*fit,height:natural.height*fit,transform:`translate(${pos.x}px,${pos.y}px) scale(${zoom})`}} onClick={e=>{
    if(readonly||!placing||!imageRef.current||pins.length>=100)return;const r=imageRef.current.getBoundingClientRect();const x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;if(x<0||x>1||y<0||y>1)return;
    const id=crypto.randomUUID();change({pins:[...pins,{id,x,y,title:'',description:'',linkedEntityId:null,shape:'circle',color:DEFAULT_MARKER_COLOR,scale:1}]});setSelected(id);setPlacing(false);
   }}><img draggable={false} src={payload.image} alt="Карта мира" onLoad={e=>setNatural({width:e.currentTarget.naturalWidth||1,height:e.currentTarget.naturalHeight||1})}/>{pins.map((p,i)=>{
    const a=markerAppearance(p),label=markerLabel(p),font=markerFonts.find(f=>f.value===label.font)!,name=p.title.trim()||`Метка ${i+1} · ${markerShapes.find(s=>s.value===a.shape)?.label}`;
    return <button key={p.id} data-map-pin={p.id} data-marker-shape={a.shape} aria-label={name} title={name} aria-pressed={selected===p.id} className={'map-marker '+(selected===p.id?'selected':'')+(readonly?' readonly':'')} style={{left:`${p.x*100}%`,top:`${p.y*100}%`,width:MARKER_SIZE*a.scale,height:MARKER_SIZE*a.scale,color:a.color,transform:`translate(-50%,-50%) scale(${1/zoom})`}} onPointerDown={e=>{
     e.stopPropagation();setSelected(p.id);setPlacing(false);if(readonly||!imageRef.current)return;const r=imageRef.current.getBoundingClientRect();drag.current={type:'pin',id:p.id,clientX:e.clientX,clientY:e.clientY,x:p.x,y:p.y,width:r.width,height:r.height};e.currentTarget.setPointerCapture(e.pointerId);
    }} onClick={e=>{e.stopPropagation();setSelected(p.id);setPlacing(false)}}><MapMarkerSymbol shape={a.shape}/>{label.visible&&p.title.trim()&&<span className={`map-marker-label ${label.position}`} style={{fontFamily:font.family,fontSize:label.size,color:label.color,fontWeight:label.bold?700:400,fontStyle:label.italic?'italic':'normal',textDecoration:[label.underline?'underline':'',label.strike?'line-through':''].filter(Boolean).join(' ')||'none'}}>{p.title}</span>}</button>;
   })}</div>:<div className="canvas-empty"><MapPin size={36}/><h3>{readonly?'Карта ещё не добавлена':'Место для вашего мира'}</h3><p>{readonly?'Добавить изображение можно в режиме редактирования.':'Загрузите карту кнопкой над этим окном. PNG, JPEG или WebP, до 10 МБ.'}</p></div>}
   {payload.image&&<span className="canvas-hint">{placing?'Нажмите на карту, чтобы поставить метку':readonly?'Перетаскивайте карту · Нажмите на метку, чтобы прочитать описание':'Перетаскивайте карту или метки'} · {Math.round(zoom*100)}%</span>}
  </div>{pin&&appearance&&<aside className="inspector map-inspector" aria-label={readonly?'Сведения о метке':'Редактор метки'}><div className="inspector-heading"><strong>{readonly?'Метка на карте':'Свойства метки'}</strong><button className="plain-button" aria-label="Закрыть свойства метки" onClick={()=>setSelected('')}><X size={18}/></button></div>
   {readonly?<>{pin.title.trim()&&<h3>{pin.title}</h3>}<div className="map-marker-legend"><span style={{color:appearance.color}}><MapMarkerSymbol shape={appearance.shape}/></span>{markerShapes.find(s=>s.value===appearance.shape)?.label}</div><p className="note-content">{pin.description||'Описание не добавлено.'}</p></>:<>
    <div className="field"><span>Форма</span><MapShapeChoices value={appearance.shape} onChange={shape=>edit(pin.id,{shape:shape as MapMarker['shape']})}/></div>
    <Field label="Название"><input aria-label="Название метки" maxLength={120} className="text-input" value={pin.title} placeholder="Можно оставить пустым" onChange={e=>edit(pin.id,{title:e.target.value})}/></Field>
    <MapLabelEditor key={pin.id} pin={pin} onChange={label=>editLabel(pin.id,label)}/>
    <div className="field"><span>Цвет</span><div className="marker-colors"><input type="color" aria-label="Цвет метки" value={appearance.color} onChange={e=>edit(pin.id,{color:e.target.value})}/>{colors.map(color=><button key={color} aria-label={`Цвет метки ${color}`} aria-pressed={appearance.color===color} style={{background:color}} onClick={()=>edit(pin.id,{color})}/>)}</div></div>
    <Field label={`Размер · ${Math.round(appearance.scale*100)}%`}><input type="range" aria-label="Размер метки" min={MIN_MARKER_SCALE} max={MAX_MARKER_SCALE} step="0.1" value={appearance.scale} onChange={e=>edit(pin.id,{scale:Number(e.target.value)})}/></Field>
    <Field label="Описание"><textarea aria-label="Описание метки" maxLength={2000} rows={5} value={pin.description} onChange={e=>edit(pin.id,{description:e.target.value})}/></Field>
    <EntityPicker entities={entities.filter(e=>e.kind!=='folder')} value={pin.linkedEntityId??undefined} onChange={v=>edit(pin.id,{linkedEntityId:v||null})}/>
   </>}
   {pin.linkedEntityId&&<Button variant="outline" onClick={()=>onOpen(pin.linkedEntityId!)}>Открыть материал</Button>}
   {!readonly&&<Button className="delete-button" variant="ghost" onClick={()=>{change({pins:pins.filter(p=>p.id!==selected)});setSelected('')}}><Trash2 size={16}/>Удалить метку</Button>}
  </aside>}</div>
 </div>;
}
