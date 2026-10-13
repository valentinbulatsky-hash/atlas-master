import type { Entity } from './model';
export type PdfPage={src:string;width:number;height:number};
export type CharacterDocument={pdf:string;name:string;pages:PdfPage[];text?:string};
export function characterDocuments(character:Entity):CharacterDocument[]{
 if(character.kind!=='character')return [];
 const sheet=character.payload.sheet;
 return [...(sheet?[{...sheet,name:sheet.name||'Лист персонажа'}]:[]),...(character.payload.documents??[])];
}
