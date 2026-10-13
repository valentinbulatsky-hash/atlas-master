import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { db, owner, failure, ApiError, serialize } from '@/lib/server';
import { titleKey, materialType } from '@/lib/material-names';
import { assetMime } from '@/lib/assets';
import { assetReferences, campaignSnapshot, remapArchive, validateArchiveMetadata } from '@/lib/campaign-transfer';

export const dynamic='force-dynamic';
const uuid=z.string().uuid();
export async function GET(req:Request){try{
  const uid=await owner(req), url=new URL(req.url), importId=url.searchParams.get('importId');
  if(importId){const row=await db().prepare('SELECT * FROM entities WHERE id=? AND owner_id=? AND kind=?').bind(importId,uid,'campaign').first();return Response.json({campaign:row?serialize(row):null},{headers:{'Cache-Control':'no-store'}});}
  const campaignId=url.searchParams.get('campaignId');if(!campaignId)throw new ApiError('Выберите кампанию.');
  const rows=(await db().prepare('SELECT * FROM entities WHERE owner_id=?').bind(uid).all()).results.map(serialize);
  if(!rows.some(r=>r.id===campaignId&&r.kind==='campaign'))throw new ApiError('Кампания не найдена.',404);
  const records=campaignSnapshot(rows,campaignId), wanted=new Set(records.flatMap(r=>[...assetReferences(r.payload)]));
  const owned=(await db().prepare('SELECT id,mime,size FROM assets WHERE owner_id=?').bind(uid).all()).results as any[];
  const assets=[...wanted].map(id=>{const a=owned.find(a=>a.id===id);if(!a)throw new ApiError('Вложение кампании недоступно.');return {id:a.id,mime:a.mime,size:a.size};});
  return Response.json({campaignId,records,assets},{headers:{'Cache-Control':'no-store'}});
}catch(e){return failure(e)}}

export async function POST(req:Request){try{
  const uid=await owner(req);
  if(Number(req.headers.get('content-length')??0)>12*1024*1024)throw new ApiError('Материалы кампании слишком большие.',413);
  const text=await req.text();if(new TextEncoder().encode(text).length>12*1024*1024)throw new ApiError('Материалы кампании слишком большие.',413);
  let input:any;try{input=JSON.parse(text)}catch{throw new ApiError('Некорректный файл кампании.');}
  let archive;try{archive=validateArchiveMetadata(input.archive)}catch(e){throw new ApiError((e as Error).message);}
  const importId=input.validateOnly?null:uuid.parse(input.importId);
  if(importId){const old:any=await db().prepare('SELECT * FROM entities WHERE id=?').bind(importId).first();if(old){if(old.owner_id!==uid||old.kind!=='campaign')throw new ApiError('Конфликт идентификатора импорта.',409);return Response.json({campaign:serialize(old),alreadyImported:true});}}
  const counts:any=await db().prepare('SELECT COUNT(*) AS total,SUM(CASE WHEN kind=? THEN 1 ELSE 0 END) AS campaigns FROM entities WHERE owner_id=?').bind('campaign',uid).first();
  if(Number(counts.total)+archive.records.length>2000||Number(counts.campaigns)>=20)throw new ApiError('Не хватает места: до 20 кампаний и 2000 материалов на аккаунт.');
  if(input.validateOnly)return Response.json({ok:true});
  const mapping=z.record(z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),uuid).parse(input.uploadedAssets);
  if(Object.keys(mapping).length!==archive.assets.length||new Set(Object.values(mapping)).size!==archive.assets.length)throw new ApiError('Набор вложений не совпадает с файлом.');
  if(!env.BUCKET)throw new Error('R2 unavailable');
  const ownedAssets=(await db().prepare('SELECT id,key,mime,size FROM assets WHERE owner_id=?').bind(uid).all()).results as any[];
  for(const a of archive.assets){
    const row=ownedAssets.find(row=>row.id===mapping[a.id]);
    if(!row||row.mime!==a.mime||row.size!==a.size)throw new ApiError('Вложение не загружено или повреждено.');
    const object=await env.BUCKET.get(row.key);if(!object)throw new ApiError('Вложение недоступно.');
    const bytes=new Uint8Array(await object.arrayBuffer());
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
    if(digest!==a.sha256||assetMime(bytes,a.mime==='application/pdf'?'pdf':'image')!==a.mime)throw new ApiError('Вложение повреждено.');
  }
  const records=remapArchive(archive,importId!,mapping), now=new Date().toISOString();
  // Bounded JSON parameters avoid per-row query and parameter limits while keeping the whole import atomic.
  const chunks:string[]=[];let group:string[]=[],size=2;
  for(const r of records){const text=JSON.stringify({id:r.id,campaignId:r.campaignId,folderId:r.folderId,kind:r.kind,title:r.title,nameKey:titleKey(r.title),materialType:materialType(r),summary:r.summary,payload:JSON.stringify(r.payload)}),bytes=new TextEncoder().encode(text).length;if(group.length&&size+bytes+1>1024*1024){chunks.push('['+group.join(',')+']');group=[];size=2;}group.push(text);size+=bytes+1;}
  if(group.length)chunks.push('['+group.join(',')+']');
  await db().batch(chunks.map(chunk=>db().prepare("INSERT INTO entities (id,owner_id,campaign_id,folder_id,kind,title,summary,payload,name_key,material_type,revision,created_at,updated_at) SELECT json_extract(value,'$.id'),?,json_extract(value,'$.campaignId'),json_extract(value,'$.folderId'),json_extract(value,'$.kind'),json_extract(value,'$.title'),json_extract(value,'$.summary'),json_extract(value,'$.payload'),json_extract(value,'$.nameKey'),json_extract(value,'$.materialType'),1,?,? FROM json_each(?)").bind(uid,now,now,chunk)));
  const row=await db().prepare('SELECT * FROM entities WHERE id=? AND owner_id=?').bind(importId,uid).first();
  return Response.json({campaign:serialize(row),imported:records.length});
}catch(e){return failure(e)}}

// Remove only unattached files uploaded by a failed import, never files in use.
export async function DELETE(req:Request){try{
  const uid=await owner(req), input=z.object({assetIds:z.array(uuid).max(300)}).parse(await req.json());
  const rows=(await db().prepare('SELECT payload FROM entities WHERE owner_id=?').bind(uid).all()).results as any[];
  const used=new Set(rows.flatMap(r=>[...assetReferences(JSON.parse(r.payload))]));
  for(const id of new Set(input.assetIds)){if(used.has(id))continue;const a:any=await db().prepare('SELECT * FROM assets WHERE id=? AND owner_id=?').bind(id,uid).first();if(a){await env.BUCKET?.delete(a.key);await db().prepare('DELETE FROM assets WHERE id=? AND owner_id=?').bind(id,uid).run();}}
  return Response.json({ok:true});
}catch(e){return failure(e)}}
