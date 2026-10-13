import { z } from 'zod';
import { entityInput, checkPayload } from './validation';
import type { Entity } from './model';

export const ARCHIVE_FORMAT = 'atlas-master-campaign';
export const MAX_ARCHIVE_BYTES = 100 * 1024 * 1024;
export const MAX_RECORD_BYTES = 8 * 1024 * 1024;
export const MAX_TRANSFER_RECORDS = 500;
export const MAX_TRANSFER_ASSETS = 300;
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
const recordSchema = entityInput.extend({ id, campaignId: id.nullable(), folderId: id.nullable() });
export const archiveMetadataSchema = z.object({
  format: z.literal(ARCHIVE_FORMAT), version: z.literal(1), campaignId: id,
  records: z.array(recordSchema).min(1).max(MAX_TRANSFER_RECORDS),
  assets: z.array(z.object({id, mime: z.enum(['image/png','image/jpeg','image/webp','application/pdf']), size: z.number().int().positive().max(10*1024*1024), sha256: z.string().regex(/^[a-f0-9]{64}$/)})).max(MAX_TRANSFER_ASSETS),
});
export type ArchiveMetadata = z.infer<typeof archiveMetadataSchema>;
export type CampaignArchive = Omit<ArchiveMetadata,'assets'> & { exportedAt: string; assets: (ArchiveMetadata['assets'][number] & {data: string})[] };
export function assetReferences(value: unknown): Set<string> {
  const result = new Set<string>();
  function walk(v: any) { if (!v || typeof v !== 'object') return; for (const [key, x] of Object.entries(v)) { if (['src','image','cover','pdf'].includes(key) && typeof x === 'string' && /^\/api\/assets\/[a-zA-Z0-9_-]+$/.test(x)) result.add(x.split('/').pop()!); if (x && typeof x === 'object') walk(x); } }
  walk(value); return result;
}
export function entityReferences(value: unknown): Set<string> {
  const result = new Set<string>();
  function walk(v: any) { if (!v || typeof v !== 'object') return; for (const [key, x] of Object.entries(v)) { if (key === 'linkedEntityId' && typeof x === 'string' && x) result.add(x); if (key === 'href' && typeof x === 'string' && /^\/?\?entity=/.test(x)) result.add(x.split('=')[1]); if (x && typeof x === 'object') walk(x); } }
  walk(value); return result;
}
export function validateArchiveMetadata(raw: unknown): ArchiveMetadata {
  const parsed = archiveMetadataSchema.safeParse(raw);
  if (!parsed.success) throw new Error('Некорректный файл кампании или неподдерживаемая версия.');
  const archive = parsed.data;
  if (new TextEncoder().encode(JSON.stringify(archive.records)).length > MAX_RECORD_BYTES) throw new Error('Текст материалов в файле превышает 8 МБ.');
  const records = new Map(archive.records.map(r => [r.id,r]));
  if (records.size !== archive.records.length || new Set(archive.assets.map(a=>a.id)).size !== archive.assets.length) throw new Error('В файле повторяются идентификаторы.');
  const campaigns = archive.records.filter(r => r.kind === 'campaign');
  if (campaigns.length !== 1 || campaigns[0].id !== archive.campaignId || campaigns[0].campaignId !== null || campaigns[0].folderId !== null) throw new Error('В файле должна быть одна кампания.');
  const assetIds = new Set(archive.assets.map(a=>a.id));
  if (archive.assets.reduce((n,a)=>n+a.size,0)>60*1024*1024) throw new Error('Вложения кампании превышают 60 МБ.');
  for (const r of archive.records) {
    if (r.summary.length > (r.kind === 'campaign' ? 2000 : 500)) throw new Error('Краткое описание слишком длинное.');
    if (r.kind !== 'campaign' && r.campaignId !== archive.campaignId) throw new Error('Материал относится к другой кампании.');
    checkPayload(r.payload);
    for (const ref of entityReferences(r.payload)) if (!records.has(ref)) throw new Error('В файле отсутствует связанный материал.');
    for (const ref of assetReferences(r.payload)) if (!assetIds.has(ref)) throw new Error('В файле отсутствует изображение или PDF.');
    let parent = r.folderId, depth = r.kind === 'folder' ? 1 : 0; const seen = new Set([r.id]);
    while (parent) { const folder = records.get(parent); if (!folder || folder.kind !== 'folder' || seen.has(parent)) throw new Error('Некорректная структура каталогов.'); seen.add(parent); if (++depth > 5) throw new Error('В файле более пяти уровней каталогов.'); parent = folder.folderId; }
  }
  return archive;
}
export function campaignSnapshot(entities: Entity[], campaignId: string): Entity[] {
  const campaign = entities.find(e=>e.id===campaignId && e.kind==='campaign');
  if (!campaign) throw new Error('Кампания не найдена.');
  const byId = new Map(entities.map(e=>[e.id,e]));
  const selected = new Map(entities.filter(e=>e.id===campaignId || e.campaignId===campaignId).map(e=>[e.id,e]));
  // Include linked materials from other campaigns as copies in the exported campaign.
  for (const record of selected.values()) {
    for (const ref of entityReferences(record.payload)) {
      if (selected.has(ref)) continue;
      const linked = byId.get(ref);
      if (!linked) throw new Error('Удалён связанный материал. Уберите недействующую ссылку перед сохранением кампании.');
      if (linked.kind==='campaign') throw new Error('Ссылка ведёт на другую кампанию. Замените её ссылкой на конкретный материал.');
      selected.set(ref,{...linked,campaignId,folderId:null});
    }
  }
  if (selected.size>MAX_TRANSFER_RECORDS) throw new Error('В один файл можно сохранить до 500 материалов.');
  return [...selected.values()];
}
export function remapArchive(archive: ArchiveMetadata, newCampaignId: string, assets: Record<string,string>, uuid:()=>string = ()=>crypto.randomUUID()) {
  const ids = new Map(archive.records.map(r=>[r.id,r.id===archive.campaignId?newCampaignId:uuid()]));
  function rewrite(value:any):any {
    if (Array.isArray(value)) return value.map(rewrite);
    if (!value || typeof value!=='object') return value;
    const result:Record<string,any>={};
    for (const [key,v] of Object.entries(value)) {
      if (key==='linkedEntityId' && typeof v==='string' && v) result[key]=ids.get(v)!;
      else if (key==='href' && typeof v==='string' && /^\/?\?entity=/.test(v)) result[key]='/?entity='+ids.get(v.split('=')[1]);
      else if (['src','image','cover','pdf'].includes(key) && typeof v==='string' && v.startsWith('/api/assets/')) result[key]='/api/assets/'+assets[v.split('/').pop()!];
      else if (!['__proto__','constructor','prototype'].includes(key)) result[key]=rewrite(v);
    }
    return result;
  }
  return archive.records.map(r=>({...r,id:ids.get(r.id)!,campaignId:r.kind==='campaign'?null:newCampaignId,folderId:r.folderId?ids.get(r.folderId)!:null,payload:rewrite(r.payload)}));
}
