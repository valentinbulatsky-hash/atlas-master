'use client';
import {Bold,Italic,Underline,Strikethrough} from 'lucide-react';
import {Switch} from '@/components/ui/switch';
import {markerLabel,markerFonts,MIN_LABEL_SIZE,MAX_LABEL_SIZE,type MapMarker,type MarkerLabel} from '@/lib/world-map';
import {colors} from '@/lib/model';
import {Field} from './ui';
export default function MapLabelEditor({pin,onChange}:{pin:MapMarker;onChange:(label:MarkerLabel)=>void}){
 const label=markerLabel(pin),edit=(patch:MarkerLabel)=>onChange({...label,...patch});
 return <section className="map-label-editor" aria-label="Оформление подписи метки">
  <div className="marker-title-row"><span>Показывать название на карте</span><Switch aria-label="Показывать название на карте" checked={label.visible} onCheckedChange={visible=>edit({visible})}/></div>
  {label.visible&&<>
   {!pin.title.trim()&&<p className="small-muted">Введите название выше, чтобы подпись появилась на карте.</p>}
   <Field label="Расположение подписи"><select aria-label="Расположение подписи" className="text-input" value={label.position} onChange={e=>edit({position:e.target.value as MarkerLabel['position']})}><option value="above">Сверху маркера</option><option value="below">Снизу маркера</option></select></Field>
   <Field label="Шрифт подписи"><select aria-label="Шрифт подписи" className="text-input" value={label.font} onChange={e=>edit({font:e.target.value as MarkerLabel['font']})}>{markerFonts.map(f=><option key={f.value} value={f.value} style={{fontFamily:f.family}}>{f.label}</option>)}</select></Field>
   <div className="label-formatting" role="group" aria-label="Начертание подписи">{([{key:'bold',name:'Жирная подпись',Icon:Bold},{key:'italic',name:'Курсивная подпись',Icon:Italic},{key:'underline',name:'Подчёркнутая подпись',Icon:Underline},{key:'strike',name:'Зачёркнутая подпись',Icon:Strikethrough}] as const).map(({key,name,Icon})=><button type="button" className={'icon-btn '+(label[key]?'active':'')} aria-label={name} title={name} aria-pressed={label[key]} key={key} onClick={()=>edit({[key]:!label[key]})}><Icon size={17}/></button>)}</div>
   <Field label="Размер шрифта, px"><input className="text-input" type="number" aria-label="Размер шрифта подписи" min={MIN_LABEL_SIZE} max={MAX_LABEL_SIZE} value={label.size} onChange={e=>{const value=e.target.valueAsNumber;if(Number.isFinite(value))edit({size:Math.min(MAX_LABEL_SIZE,Math.max(MIN_LABEL_SIZE,value))})}}/></Field>
   <div className="field"><span>Цвет текста</span><div className="marker-colors label-colors"><input type="color" aria-label="Цвет текста подписи" value={label.color} onChange={e=>edit({color:e.target.value})}/>{['#000000','#ffffff',...colors].map(color=><button key={color} type="button" title={color==='#000000'?'Чёрный':color==='#ffffff'?'Белый':color} aria-label={color==='#000000'?'Чёрный текст':color==='#ffffff'?'Белый текст':`Цвет текста ${color}`} aria-pressed={label.color===color} style={{background:color}} onClick={()=>edit({color})}/>)}</div></div>
  </>}
 </section>;
}
