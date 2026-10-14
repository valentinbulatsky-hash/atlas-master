'use client';
import {Users} from 'lucide-react';
import {characterType,type Entity} from '@/lib/model';
import {characterFields} from '@/lib/characters';
import {ImageUpload,Field,Choice} from './ui';
export function CharacterDetailsEditor({entity,onChange,onBusyChange,uploading=false}:{entity:Entity;onChange:(p:Record<string,any>)=>void;onBusyChange:(busy:boolean)=>void;uploading?:boolean}){
 const npc=characterType(entity)==='npc',patch=(p:Record<string,any>)=>onChange(p);
 return <section className={'character-details-editor '+(npc?'npc-details-editor':'')} aria-label="Сведения о персонаже">
  {npc&&<div className="npc-portrait-panel"><h2>Портрет</h2>{entity.payload.cover?<img src={entity.payload.cover} alt={`Портрет: ${entity.title}`}/>:<div className="npc-portrait-placeholder"><Users size={44}/><span>Портрет не добавлен</span></div>}
   <ImageUpload disabled={uploading} label={entity.payload.cover?'Заменить портрет':'Загрузить портрет NPC'} onBusyChange={onBusyChange} onUpload={url=>patch({cover:url})}/>
   {entity.payload.cover&&<button className="plain-button" disabled={uploading} onClick={()=>patch({cover:''})}>Убрать портрет</button>}
  </div>}
  <div className="character-fields"><Field label="Тип персонажа"><Choice label="Тип персонажа" value={characterType(entity)!} onChange={v=>patch({characterType:v})} options={[{value:'pc',label:'Игровой персонаж'},{value:'npc',label:'NPC'}]}/></Field>
   {characterFields(entity).map(({key,label,max})=><Field key={key} label={label}><textarea aria-label={label} rows={npc&&['appearance','distinguishingFeatures','motivation'].includes(key)?4:2} maxLength={max} value={entity.payload[key]??''} onChange={e=>patch({[key]:e.target.value})}/></Field>)}
  </div>
 </section>;
}
export function CharacterDetailsReader({entity,portrait=false}:{entity:Entity;portrait?:boolean}){
 const npc=characterType(entity)==='npc',fields=characterFields(entity).filter(f=>entity.payload[f.key]||(npc&&['appearance','distinguishingFeatures','motivation'].includes(f.key)));
 return <section className={'character-details-reader '+(portrait?'npc-reader-profile':'')}>
  {portrait&&<div className="npc-portrait-panel">{entity.payload.cover?<img src={entity.payload.cover} alt={`Портрет: ${entity.title}`}/>:<div className="npc-portrait-placeholder"><Users size={44}/><span>Портрет не добавлен</span></div>}</div>}
  {!!fields.length&&<dl className="reader-character-notes">{fields.map(({key,label})=><div key={key}><dt>{label}</dt><dd>{entity.payload[key]||'Пока не указано.'}</dd></div>)}</dl>}
 </section>;
}
