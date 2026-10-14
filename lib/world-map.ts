export const markerShapes = [
  {value:'circle',label:'Круг'}, {value:'diamond',label:'Ромб'},
  {value:'castle',label:'Замок'}, {value:'tree',label:'Дерево'},
  {value:'house',label:'Дом'}, {value:'anchor',label:'Якорь'},
  {value:'cave',label:'Пещера'}, {value:'flag',label:'Флаг'},
] as const;
export type MarkerShape = typeof markerShapes[number]['value'];
export const MIN_MARKER_SCALE=.6, MAX_MARKER_SCALE=2.2, MARKER_SIZE=32;
export const DEFAULT_MARKER_COLOR='#ba9158';
export const markerFonts = [
 {value:'serif',label:'Книжный',family:'Georgia, "Times New Roman", serif'},
 {value:'sans',label:'Простой',family:'Arial, Helvetica, sans-serif'},
 {value:'classic',label:'Летописный',family:'"Palatino Linotype", "Book Antiqua", Palatino, serif'},
 {value:'mono',label:'Моноширинный',family:'Consolas, "Courier New", monospace'},
] as const;
export const MIN_LABEL_SIZE=10, MAX_LABEL_SIZE=36;
export type MarkerLabel={visible?:boolean;position?:'above'|'below';font?:typeof markerFonts[number]['value'];size?:number;color?:string;bold?:boolean;italic?:boolean;underline?:boolean;strike?:boolean};
export type MapMarker={id:string;x:number;y:number;title:string;description:string;linkedEntityId?:string|null;shape?:MarkerShape;color?:string;scale?:number;label?:MarkerLabel};
export function markerLabel(pin:MapMarker){
 const l=pin.label??{};
 return {visible:l.visible??false,position:l.position==='above'?'above' as const:'below' as const,
  font:markerFonts.some(f=>f.value===l.font)?l.font!:'serif' as const,
  size:typeof l.size==='number'&&Number.isFinite(l.size)?Math.min(MAX_LABEL_SIZE,Math.max(MIN_LABEL_SIZE,l.size)):16,
  color:/^#[0-9a-f]{6}$/i.test(l.color??'')?l.color!:'#ffffff',
  bold:l.bold??false,italic:l.italic??false,underline:l.underline??false,strike:l.strike??false};
}
export function markerAppearance(pin:MapMarker){
 return {shape:markerShapes.some(s=>s.value===pin.shape)?pin.shape!:'circle' as MarkerShape,
  color:/^#[0-9a-f]{6}$/i.test(pin.color??'')?pin.color!:DEFAULT_MARKER_COLOR,
  scale:typeof pin.scale==='number'&&Number.isFinite(pin.scale)?Math.min(MAX_MARKER_SCALE,Math.max(MIN_MARKER_SCALE,pin.scale)):1};
}
export function moveMarker(start:{x:number;y:number},delta:{x:number;y:number},rect:{width:number;height:number}){
 if(rect.width<=0||rect.height<=0)return {...start};
 return {x:Math.max(0,Math.min(1,start.x+delta.x/rect.width)),y:Math.max(0,Math.min(1,start.y+delta.y/rect.height))};
}
