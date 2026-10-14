export const markerShapes = [
  {value:'circle',label:'Круг'}, {value:'diamond',label:'Ромб'},
  {value:'castle',label:'Замок'}, {value:'tree',label:'Дерево'},
  {value:'house',label:'Дом'}, {value:'anchor',label:'Якорь'},
  {value:'cave',label:'Пещера'}, {value:'flag',label:'Флаг'},
] as const;
export type MarkerShape = typeof markerShapes[number]['value'];
export const MIN_MARKER_SCALE=.6, MAX_MARKER_SCALE=2.2, MARKER_SIZE=32;
export const DEFAULT_MARKER_COLOR='#ba9158';
export type MapMarker={id:string;x:number;y:number;title:string;description:string;linkedEntityId?:string|null;shape?:MarkerShape;color?:string;scale?:number};
export function markerAppearance(pin:MapMarker){
 return {shape:markerShapes.some(s=>s.value===pin.shape)?pin.shape!:'circle' as MarkerShape,
  color:/^#[0-9a-f]{6}$/i.test(pin.color??'')?pin.color!:DEFAULT_MARKER_COLOR,
  scale:typeof pin.scale==='number'&&Number.isFinite(pin.scale)?Math.min(MAX_MARKER_SCALE,Math.max(MIN_MARKER_SCALE,pin.scale)):1};
}
export function moveMarker(start:{x:number;y:number},delta:{x:number;y:number},rect:{width:number;height:number}){
 if(rect.width<=0||rect.height<=0)return {...start};
 return {x:Math.max(0,Math.min(1,start.x+delta.x/rect.width)),y:Math.max(0,Math.min(1,start.y+delta.y/rect.height))};
}
