import { type Entity, plainText, isSession } from './model';
import { titleKey, materialType } from './material-names';
export type SearchSort='relevance'|'created-desc'|'created-asc'|'updated-desc'|'title-asc'|'title-desc'|'session-desc';
export type SearchHit={entity:Entity;score:number;snippet:string;field:string};
export const searchTypes=[{value:'all',label:'Все типы'},{value:'article',label:'Статьи'},{value:'pc',label:'Игровые персонажи'},{value:'npc',label:'NPC'},{value:'map',label:'Карты'},{value:'board',label:'Доски связей'},{value:'folder',label:'Подкаталоги'}];
export const searchSorts=[{value:'relevance',label:'По совпадению'},{value:'created-desc',label:'Сначала новые'},{value:'created-asc',label:'Сначала старые'},{value:'updated-desc',label:'По дате изменения'},{value:'title-asc',label:'Название: А → Я'},{value:'title-desc',label:'Название: Я → А'}];
export function searchKey(text:string){return titleKey(text).replace(/ё/g,'е');}
export function materialText(e:Entity,entities:Entity[]=[]):string{
 const p=e.payload;
 return [e.summary,plainText(p.content),p.role,p.motivation,p.notes,p.sheet?.text,...(p.documents??[]).map((d:any)=>d.text),...(p.nodes??[]).flatMap((n:any)=>[n.data?.title,n.data?.summary,n.data?.text]),...(p.edges??[]).map((n:any)=>n.label),...(p.pins??[]).flatMap((n:any)=>[n.title,n.description]),...(isSession(e)?(p.participantIds??[]).map((id:string)=>entities.find(x=>x.id===id)?.title):[])].filter(Boolean).join(' ').replace(/\s+/gu,' ').trim();
}
export function folderPath(e:Entity,entities:Entity[]):string{
 const parts=[e.title],seen=new Set([e.id]);let id=e.folderId;
 while(id&&!seen.has(id)){seen.add(id);const p=entities.find(x=>x.id===id&&x.kind==='folder'&&x.campaignId===e.campaignId);if(!p)break;parts.unshift(p.title);id=p.folderId;}
 return parts.join(' / ');
}
export function inFolder(e:Entity,id:string,entities:Entity[],descendants=true){
 if(id==='all')return true;if(id==='root')return !e.folderId;if(e.folderId===id)return true;if(!descendants)return false;
 let parent=e.folderId;const seen=new Set<string>();while(parent&&!seen.has(parent)){seen.add(parent);const f=entities.find(x=>x.id===parent&&x.kind==='folder'&&x.campaignId===e.campaignId);if(!f)break;if(f.folderId===id)return true;parent=f.folderId;}return false;
}
export function searchMaterials(entities:Entity[],campaignId:string,query:string,options:{scope?:'library'|'sessions';type?:string;folder?:string;descendants?:boolean;sort?:SearchSort}={}):SearchHit[]{
 const q=searchKey(query),tokens=[...new Set(q.split(/\s+/u).filter(Boolean))],scope=options.scope??'library';
 const hits:SearchHit[]=[];
 for(const e of entities){
  if(e.campaignId!==campaignId||e.kind==='campaign'||isSession(e)!==(scope==='sessions'))continue;
  if(options.type&&options.type!=='all'&&materialType(e)!==options.type)continue;
  if(!inFolder(e,options.folder??'all',entities,options.descendants??true))continue;
  const body=materialText(e,entities),title=searchKey(e.title),summary=searchKey(e.summary),text=searchKey(body),combined=title+' '+text;
  if(tokens.some(token=>!combined.includes(token)))continue;
  const score=!q?0:(title===q?1000:title.startsWith(q)?500:title.includes(q)?250:0)+tokens.reduce((n,t)=>n+(title.includes(t)?100:summary.includes(t)?35:10),0)+(text.includes(q)?20:0);
  const offset=tokens.length?Math.max(0,text.indexOf(tokens.find(t=>text.includes(t))??tokens[0])-45):0;
  const snippet=(offset?'…':'')+body.slice(offset,offset+190)+(body.length>offset+190?'…':'');
  hits.push({entity:e,score,snippet,field:tokens.some(t=>title.includes(t))?'Название':tokens.some(t=>summary.includes(t))?'Описание':q?'Содержание':''});
 }
 const collator=new Intl.Collator('ru',{sensitivity:'base',numeric:true}),sort=options.sort??'relevance';
 return hits.sort((a,b)=>{const ea=a.entity,eb=b.entity;const value=sort==='session-desc'?String(eb.payload.sessionDate??'').concat(eb.payload.sessionTime??'00:00').localeCompare(String(ea.payload.sessionDate??'').concat(ea.payload.sessionTime??'00:00')):sort==='relevance'?b.score-a.score:sort==='created-desc'?eb.createdAt.localeCompare(ea.createdAt):sort==='created-asc'?ea.createdAt.localeCompare(eb.createdAt):sort==='updated-desc'?eb.updatedAt.localeCompare(ea.updatedAt):sort==='title-desc'?collator.compare(eb.title,ea.title):collator.compare(ea.title,eb.title);return value||collator.compare(ea.title,eb.title)||ea.id.localeCompare(eb.id)});
}
function payloadLinks(value:any,target:string):boolean{
 if(!value||typeof value!=='object')return false;
 if(Array.isArray(value))return value.some(x=>payloadLinks(x,target));
 return Object.entries(value).some(([key,v])=>(key==='linkedEntityId'&&v===target)||(key==='href'&&typeof v==='string'&&/^\/?\?entity=/.test(v)&&v.split('=')[1]===target)||(key==='participantIds'&&Array.isArray(v)&&v.includes(target))||(v&&typeof v==='object'&&payloadLinks(v,target)));
}
export function backlinks(target:Entity,entities:Entity[]):{entity:Entity;reason:string}[]{
 const name=searchKey(target.title).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const mention=new RegExp('(?:^|[^\\p{L}\\p{N}_])'+name+'(?=$|[^\\p{L}\\p{N}_])','u');
 return entities.filter(e=>e.id!==target.id&&e.campaignId===target.campaignId&&e.kind!=='campaign').flatMap(e=>{
  const linked=payloadLinks(e.payload,target.id),parent=e.kind==='folder'&&target.folderId===e.id,text=mention.test(searchKey(e.title+' '+materialText(e,entities)));
  return linked||parent||text?[{entity:e,reason:linked?'Внутренняя ссылка':parent?'Содержит материал':'Упоминание названия'}]:[];
 }).sort((a,b)=>a.entity.title.localeCompare(b.entity.title,'ru'));
}
