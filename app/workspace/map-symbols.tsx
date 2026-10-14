'use client';
import {Circle,Diamond,Castle,TreePine,House,Anchor,Flag} from 'lucide-react';
import {markerShapes,type MarkerShape} from '@/lib/world-map';
import {SymbolChoice} from './board-symbols';
const icons={circle:Circle,diamond:Diamond,castle:Castle,tree:TreePine,house:House,anchor:Anchor,flag:Flag};
export function MapMarkerSymbol({shape}:{shape:MarkerShape}){
 if(shape==='cave')return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 21 7 9l3 2 5-8 7 18H2Z"/><path d="M9 21v-5a3 3 0 0 1 6 0v5"/></svg>;
 const Icon=icons[shape];return <Icon aria-hidden="true" strokeWidth={1.8} className={shape==='circle'||shape==='diamond'?'map-simple-symbol':''}/>;
}
export function MapShapeChoices({value,onChange}:{value:MarkerShape;onChange:(v:string)=>void}){
 return <SymbolChoice label="Форма метки" value={value} onChange={onChange} columns={4} options={markerShapes.map(s=>({...s,symbol:<MapMarkerSymbol shape={s.value}/>}))}/>;
}
