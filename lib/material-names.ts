import { type Entity, characterType, isSession } from './model';
export type NamedMaterial=Pick<Entity,'id'|'campaignId'|'folderId'|'kind'|'title'|'payload'>;
export function titleKey(title:string){return title.normalize('NFKC').trim().replace(/\s+/gu,' ').toLocaleLowerCase('ru');}
export function materialType(e:Pick<Entity,'kind'|'payload'>){return isSession(e)?'session':e.kind==='character'?characterType(e as Entity)!:e.kind;}
export function sameNameScope(a:NamedMaterial,b:NamedMaterial){return a.kind!=='campaign'&&b.kind!=='campaign'&&a.campaignId===b.campaignId&&(a.folderId??null)===(b.folderId??null)&&materialType(a)===materialType(b)&&titleKey(a.title)===titleKey(b.title);}
export function titleConflict<T extends NamedMaterial>(candidate:NamedMaterial,entities:T[]){return entities.find(e=>e.id!==candidate.id&&sameNameScope(candidate,e));}
export function unchangedNameScope(a:NamedMaterial,b:NamedMaterial){return a.campaignId===b.campaignId&&(a.folderId??null)===(b.folderId??null)&&materialType(a)===materialType(b)&&titleKey(a.title)===titleKey(b.title);}
