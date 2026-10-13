export type Kind='campaign'|'folder'|'article'|'character'|'board'|'map';
export type Entity={id:string;campaignId:string|null;folderId:string|null;kind:Kind;title:string;summary:string;payload:Record<string,any>;revision:number;createdAt:string;updatedAt:string};
export const labels:Record<Kind,string>={campaign:'Кампания',folder:'Каталог',article:'Статья',character:'Персонаж',board:'Доска связей',map:'Карта'};
export const colors=['#ba9158','#628eb3','#9a7fbd','#5ca494','#c57577','#c6aa60'];
export const emptyDoc={type:'doc',content:[{type:'paragraph'}]};
export function textDoc(t:string){return {type:'doc',content:t.split('\n').map(text=>({type:'paragraph',...(text?{content:[{type:'text',text}]}:{})}))};}
export function plainText(v:any):string{if(!v)return ''; if(typeof v==='string')return v; if(Array.isArray(v))return v.map(plainText).join(' ');return [v.text??'',v.content?plainText(v.content):''].join(' ')}
export function safeHref(h:string){return /^https?:\/\//i.test(h)||/^\/?\?entity=[a-zA-Z0-9_-]+$/.test(h)}

export function characterType(e:Entity):'pc'|'npc'|null{return e.kind==='character'?(e.payload.characterType==='pc'?'pc':'npc'):null;}
export function isSession(e:Pick<Entity,'kind'|'payload'>):boolean{return e.kind==='article'&&e.payload.entryType==='session';}
export function materialLabel(e:Entity):string{return isSession(e)?'Запись сессии':e.kind==='character'?(characterType(e)==='pc'?'Игровой персонаж':'NPC'):e.kind==='folder'?'Подкаталог':labels[e.kind];}
export function matchesSection(e:Entity,section:string):boolean{if(section==='sessions')return isSession(e);if(isSession(e))return false;if(section==='pc'||section==='npc')return characterType(e)===section;return section==='all'?e.kind==='article':section==='overview'||e.kind===section;}
