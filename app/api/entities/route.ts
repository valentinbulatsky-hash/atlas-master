import { db, owner, failure, ApiError, serialize } from '@/lib/server';
import { entityInput,checkPayload } from '@/lib/validation';
import { isSession,characterType,type Entity } from '@/lib/model';
import { titleKey,materialType,titleConflict,unchangedNameScope } from '@/lib/material-names';
export const dynamic='force-dynamic';
const duplicate=()=>new ApiError('В этом каталоге уже есть материал этого типа с таким названием. Измените название или выберите другой каталог.',409,'DUPLICATE_TITLE');
export async function GET(req:Request){try{const uid=await owner(req);const r=await db().prepare('SELECT * FROM entities WHERE owner_id=? ORDER BY updated_at DESC').bind(uid).all();return Response.json({entities:r.results.map(serialize)},{headers:{'Cache-Control':'no-store'}})}catch(e){return failure(e)}}
async function write(req:Request,update:boolean){try{
 const uid=await owner(req),raw=await req.text();if(raw.length>220000)throw new ApiError('Запись слишком большая.',413);
 let body;try{body=JSON.parse(raw)}catch{throw new ApiError('Некорректный запрос.')}
 const parsed=entityInput.safeParse(body);if(!parsed.success)throw new ApiError('Проверьте название, дату, время, длину полей и настройки материала.');
 const v=parsed.data;try{checkPayload(v.payload)}catch(e){throw new ApiError((e as Error).message)}
 const rows=(await db().prepare('SELECT * FROM entities WHERE owner_id=?').bind(uid).all()).results as any[];
 const all:Entity[]=rows.map(serialize),old=update?all.find(r=>r.id===v.id):null;
 if(update&&!old)throw new ApiError('Материал не найден.',404);
 if(old&&(old.kind!==v.kind||old.campaignId!==(v.campaignId??null)||isSession(old)!==isSession(v)))throw new ApiError('Тип и кампания материала не меняются.');
 if(update&&old!.revision!==v.revision)throw new ApiError('Материал изменён в другой вкладке. Скопируйте свои правки и загрузите актуальную версию.',409);
 if(!update&&(rows.length>=2000||(v.kind==='campaign'&&rows.filter(r=>r.kind==='campaign').length>=20)))throw new ApiError('Достигнут лимит записей первой версии.');
 if(v.kind==='campaign'){v.campaignId=null;v.folderId=null;}else if(!all.some(r=>r.id===v.campaignId&&r.kind==='campaign'))throw new ApiError('Кампания не найдена.');
 if(v.payload.entryType&&v.kind!=='article')throw new ApiError('Запись сессии должна использовать редактор статьи.');
 if(isSession(v)){
  v.folderId=null;if(!v.payload.sessionDate)throw new ApiError('Укажите дату сессии.');v.payload.participantIds??=[];
  const previous=new Set<string>(old?.payload.participantIds??[]);
  for(const id of v.payload.participantIds){const pc=all.find(e=>e.id===id&&e.campaignId===v.campaignId&&characterType(e)==='pc');if(!pc&&!previous.has(id))throw new ApiError('Участников можно выбрать только из игровых персонажей этой кампании.');}
 }else if(v.payload.participantIds||v.payload.sessionDate||v.payload.sessionTime)throw new ApiError('Дата, время и участники доступны в журнале сессий.');
 if(v.summary.length>(v.kind==='campaign'?2000:500))throw new ApiError('Краткое описание материала — не более 500 символов.');
 if(v.folderId){let p=all.find(r=>r.id===v.folderId&&r.kind==='folder'&&r.campaignId===v.campaignId);if(!p)throw new ApiError('Каталог не найден.');let depth=v.kind==='folder'?1:0;const seen=new Set([v.id]);while(p){if(seen.has(p.id))throw new ApiError('Каталог нельзя переместить внутрь самого себя.');seen.add(p.id);if(++depth>5)throw new ApiError('Разрешено не более пяти уровней каталогов.');p=all.find(r=>r.id===p!.folderId);}
  if(v.kind==='folder'&&v.id){const descendants=(pid:string):number=>{const cs=all.filter(r=>r.kind==='folder'&&r.folderId===pid);return cs.length?1+Math.max(...cs.map(c=>descendants(c.id))):0};if(depth+descendants(v.id)>5)throw new ApiError('Дочерние каталоги превышают пять уровней.');}}
 const candidate={...v,id:v.id??'',campaignId:v.campaignId??null,folderId:v.folderId??null};
 const checkName=v.kind!=='campaign'&&!(old&&unchangedNameScope(old,candidate));
 if(checkName&&titleConflict(candidate,all))throw duplicate();
 const known=new Set(rows.map(r=>r.id)),existingRefs=new Set<string>(),existingAssets=new Set<string>();
 function collect(value:any,refs:Set<string>,assets:Set<string>){if(!value||typeof value!=='object')return;for(const [k,val] of Object.entries(value)){if(k==='linkedEntityId'&&typeof val==='string'&&val)refs.add(val);if(k==='participantIds'&&Array.isArray(val))for(const id of val)refs.add(id);if(k==='href'&&typeof val==='string'&&/^\/?\?entity=/.test(val))refs.add(val.split('=')[1]);if(['src','cover','image','pdf'].includes(k)&&typeof val==='string'&&val.startsWith('/api/assets/'))assets.add(val.split('/').pop()!);if(val&&typeof val==='object')collect(val,refs,assets)}}
 if(old)collect(old.payload,existingRefs,existingAssets);
 const refs=new Set<string>(),assetIds=new Set<string>();collect(v.payload,refs,assetIds);
 if([...refs].some(id=>!known.has(id)&&!existingRefs.has(id)))throw new ApiError('Связанный материал недоступен.');
 const ownAssets=(await db().prepare('SELECT id FROM assets WHERE owner_id=?').bind(uid).all()).results.map((a:any)=>a.id);
 if([...assetIds].some(id=>!ownAssets.includes(id)&&!existingAssets.has(id)))throw new ApiError('Изображение недоступно.');
 const payload=JSON.stringify(v.payload),now=new Date().toISOString(),id=update?v.id!:crypto.randomUUID(),key=titleKey(v.title),type=materialType(v);
 // Conditional writes make the duplicate check atomic, including concurrent creates.
 const clash=`clash.owner_id=? AND clash.campaign_id IS ? AND clash.folder_id IS ? AND (clash.name_key=? OR (clash.name_key IS NULL AND clash.title=?)) AND COALESCE(clash.material_type,CASE WHEN clash.kind='character' THEN CASE WHEN json_extract(clash.payload,'$.characterType')='pc' THEN 'pc' ELSE 'npc' END WHEN clash.kind='article' AND json_extract(clash.payload,'$.entryType')='session' THEN 'session' ELSE clash.kind END)=?`;
 const args=[uid,v.campaignId??null,v.folderId??null,key,v.title,type];
 if(update){
  const r=await db().prepare('UPDATE entities SET title=?,summary=?,folder_id=?,payload=?,name_key=?,material_type=?,updated_at=?,revision=revision+1 WHERE id=? AND owner_id=? AND revision=?'+(checkName?' AND NOT EXISTS (SELECT 1 FROM entities clash WHERE clash.id<>? AND '+clash+')':''))
   .bind(v.title,v.summary,v.folderId??null,payload,key,type,now,id,uid,v.revision!,...(checkName?[id,...args]:[])).run();
  if(!r.meta.changes){const latest:any=await db().prepare('SELECT revision FROM entities WHERE id=? AND owner_id=?').bind(id,uid).first();if(checkName&&latest?.revision===v.revision)throw duplicate();throw new ApiError('Материал изменён в другой вкладке. Скопируйте свои правки и загрузите актуальную версию.',409);}
 }else{
  const r=await db().prepare('INSERT INTO entities (id,owner_id,campaign_id,folder_id,kind,title,summary,payload,name_key,material_type,revision,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,?,?,1,?,?'+(checkName?' WHERE NOT EXISTS (SELECT 1 FROM entities clash WHERE '+clash+')':''))
   .bind(id,uid,v.campaignId??null,v.folderId??null,v.kind,v.title,v.summary,payload,key,type,now,now,...(checkName?args:[])).run();if(!r.meta.changes)throw duplicate();
 }
 const row=await db().prepare('SELECT * FROM entities WHERE id=? AND owner_id=?').bind(id,uid).first();return Response.json({entity:serialize(row)});
}catch(e){return failure(e)}}
export async function POST(req:Request){return write(req,false)}
export async function PATCH(req:Request){return write(req,true)}
export async function DELETE(req:Request){try{
 const uid=await owner(req),{id,revision}=await req.json() as {id:string;revision:number};
 const row:any=await db().prepare('SELECT * FROM entities WHERE id=? AND owner_id=?').bind(id,uid).first();if(!row)throw new ApiError('Материал не найден.',404);if(row.revision!==revision)throw new ApiError('Запись изменилась. Обновите список перед удалением.',409);
 const writes:any[]=[];
 if(row.kind==='campaign')writes.push(db().prepare('DELETE FROM entities WHERE campaign_id=? AND owner_id=? AND EXISTS (SELECT 1 FROM entities WHERE id=? AND owner_id=? AND revision=?)').bind(id,uid,id,uid,revision));
 else if(row.kind==='folder'){
  const all=(await db().prepare('SELECT * FROM entities WHERE owner_id=?').bind(uid).all()).results.map(serialize),moved=all.filter(e=>e.folderId===id).map(e=>({...e,folderId:row.folder_id})),destination=all.filter(e=>e.folderId!==id&&e.id!==id).concat(moved);
  if(moved.some(e=>titleConflict(e,destination)))throw new ApiError('Удаление каталога создаст одинаковые названия на уровне выше. Сначала переименуйте или переместите эти материалы.',409,'DUPLICATE_TITLE');
  writes.push(db().prepare('UPDATE entities SET folder_id=?,revision=revision+1 WHERE folder_id=? AND owner_id=? AND EXISTS (SELECT 1 FROM entities WHERE id=? AND owner_id=? AND revision=?)').bind(row.folder_id,id,uid,id,uid,revision));
 }else if(row.kind==='character'){
  const sessions=(await db().prepare("SELECT * FROM entities WHERE owner_id=? AND campaign_id=? AND kind='article'").bind(uid,row.campaign_id).all()).results.map(serialize).filter(e=>isSession(e)&&(e.payload.participantIds??[]).includes(id));
  for(const session of sessions)writes.push(db().prepare('UPDATE entities SET payload=?,revision=revision+1,updated_at=? WHERE id=? AND owner_id=? AND EXISTS (SELECT 1 FROM entities WHERE id=? AND owner_id=? AND revision=?)').bind(JSON.stringify({...session.payload,participantIds:session.payload.participantIds.filter((x:string)=>x!==id)}),new Date().toISOString(),session.id,uid,id,uid,revision));
 }
 writes.push(db().prepare('DELETE FROM entities WHERE id=? AND owner_id=? AND revision=?').bind(id,uid,revision));
 const results=await db().batch(writes);if(!results.at(-1)?.meta.changes)throw new ApiError('Запись изменилась. Обновите список перед удалением.',409);
 return Response.json({ok:true});
}catch(e){return failure(e)}}
