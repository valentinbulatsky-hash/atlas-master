'use client';
import { ARCHIVE_FORMAT, MAX_ARCHIVE_BYTES, validateArchiveMetadata, type CampaignArchive } from '@/lib/campaign-transfer';
import { upload } from './ui';
import type { Entity } from '@/lib/model';

async function transferRequest(method:string,body?:unknown,query=''){
  const response=await fetch('/api/campaign-transfer'+query,{method,headers:{'Content-Type':'application/json','X-Atlas-Request':'1'},...(body?{body:JSON.stringify(body)}:{})});
  const result:any=await response.json();if(!response.ok)throw new Error(result.error??'Не удалось перенести кампанию.');return result;
}
async function hash(bytes:Uint8Array){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as BufferSource))).map(b=>b.toString(16).padStart(2,'0')).join('');}
function base64(bytes:Uint8Array){let text='';for(let i=0;i<bytes.length;i+=16384)text+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(text);}
function decode(asset:CampaignArchive['assets'][number]){
  if(typeof asset.data!=='string'||asset.data.length!==4*Math.ceil(asset.size/3)||!/^[A-Za-z0-9+/]*={0,2}$/.test(asset.data))throw new Error('Повреждены данные вложения.');
  const bytes=Uint8Array.from(atob(asset.data),c=>c.charCodeAt(0));if(bytes.length!==asset.size)throw new Error('Неверный размер вложения.');return bytes;
}
export async function exportCampaign(campaign:Entity,onProgress:(text:string)=>void){
  onProgress('Собираем материалы…');const snapshot=await transferRequest('GET',undefined,'?campaignId='+encodeURIComponent(campaign.id));
  if(snapshot.assets.reduce((n:number,a:any)=>n+a.size,0)>60*1024*1024)throw new Error('Вложения кампании превышают 60 МБ.');
  const metadata:any={format:ARCHIVE_FORMAT,version:1,campaignId:campaign.id,records:snapshot.records,assets:[]};
  const pieces:BlobPart[]=[JSON.stringify({format:ARCHIVE_FORMAT,version:1,exportedAt:new Date().toISOString(),campaignId:campaign.id,records:snapshot.records}).slice(0,-1)+',"assets":['];
  for(let i=0;i<snapshot.assets.length;i++){
    const asset=snapshot.assets[i];onProgress(`Сохраняем вложения: ${i+1} / ${snapshot.assets.length}`);
    const response=await fetch('/api/assets/'+asset.id);if(!response.ok)throw new Error('Не удалось прочитать вложение.');
    const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length!==asset.size)throw new Error('Размер вложения изменился. Повторите сохранение.');
    const meta={...asset,sha256:await hash(bytes)};metadata.assets.push(meta);pieces.push((i?',':'')+JSON.stringify({...meta,data:base64(bytes)}));
  }
  validateArchiveMetadata(metadata);pieces.push(']}');const blob=new Blob(pieces,{type:'application/json'});if(blob.size>MAX_ARCHIVE_BYTES)throw new Error('Файл кампании превышает 100 МБ.');
  const href=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=href;anchor.download=campaign.title.replace(/[\\/:*?"<>|]/g,'-')+'.atlas.json';anchor.click();setTimeout(()=>URL.revokeObjectURL(href),60000);
}
export async function importCampaign(file:File,onProgress:(text:string)=>void):Promise<Entity>{
  if(file.size>MAX_ARCHIVE_BYTES)throw new Error('Файл кампании должен быть не больше 100 МБ.');
  onProgress('Проверяем файл…');let raw:CampaignArchive;try{raw=JSON.parse(await file.text())}catch{throw new Error('Выберите JSON-файл кампании, сохранённый из Атласа мастера.');}
  const metadata=validateArchiveMetadata(raw);
  await transferRequest('POST',{archive:metadata,validateOnly:true});
  const originals=new Map(raw.assets.map(a=>[a.id,a]));
  for(const a of metadata.assets){const bytes=decode(originals.get(a.id)!);if(await hash(bytes)!==a.sha256)throw new Error('Вложение повреждено: контрольная сумма не совпадает.');}
  const uploadedAssets:Record<string,string>={},importId=crypto.randomUUID();
  try{
    for(let i=0;i<metadata.assets.length;i++){
      const a=metadata.assets[i];onProgress(`Загружаем вложения: ${i+1} / ${metadata.assets.length}`);
      const bytes=decode(originals.get(a.id)!);const url=await upload(new File([bytes as BlobPart],a.id,{type:a.mime}),a.mime==='application/pdf'?'pdf':'image');uploadedAssets[a.id]=url.split('/').pop()!;
    }
    onProgress('Создаём кампанию…');const result=await transferRequest('POST',{archive:metadata,uploadedAssets,importId});return result.campaign;
  }catch(error){
    // A lost response must not make an already committed import look like a failure.
    try{const status=await transferRequest('GET',undefined,'?importId='+importId);if(status.campaign)return status.campaign;}catch{}
    try{await transferRequest('DELETE',{assetIds:Object.values(uploadedAssets)});}catch{}
    throw error;
  }
}
