import { env } from 'cloudflare:workers';
import { db,owner,failure,ApiError } from '@/lib/server';
import { assetMime,MAX_ASSET_BYTES } from '@/lib/assets';
export async function POST(req:Request){try{
 const uid=await owner(req);
 if(Number(req.headers.get('content-length')??0)>MAX_ASSET_BYTES+1024*1024)throw new ApiError('Максимальный размер файла — 10 МБ.',413);
 const form=await req.formData();const file=form.get('file');const kind=form.get('kind')==='pdf'?'pdf':'image';
 if(!(file instanceof File)||!file.size||file.size>MAX_ASSET_BYTES)throw new ApiError('Выберите файл до 10 МБ.');
 const bytes=new Uint8Array(await file.arrayBuffer());const mime=assetMime(bytes,kind);
 if(!mime)throw new ApiError(kind==='pdf'?'Выберите корректный PDF-файл.':'Поддерживаются только PNG, JPEG и WebP.');
 if(!env.BUCKET)throw new Error('R2 unavailable');
 const id=crypto.randomUUID(),key=`${uid}/${id}`;
 await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:mime}});
 try{await db().prepare('INSERT INTO assets (id,owner_id,key,mime,size,created_at) VALUES (?,?,?,?,?,?)').bind(id,uid,key,mime,file.size,new Date().toISOString()).run()}
 catch(e){await env.BUCKET.delete(key);throw e}
 return Response.json({url:`/api/assets/${id}`,mime});
}catch(e){return failure(e)}}
