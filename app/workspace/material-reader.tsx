'use client';
import { Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type Entity, materialLabel, isSession, characterType } from '@/lib/model';
import { characterDocuments } from '@/lib/character-documents';
import { SessionMetadata } from './session-journal';
import { RichEditor } from './rich-editor';
import Board from './board';
import {CharacterDetailsReader} from './character-details';
import WorldMap from './world-map';
import { DocumentPages } from './document-pages';

export default function MaterialReader({entity,entities,onClose,onEdit,onOpen,onNote}:{entity:Entity;entities:Entity[];onClose:()=>void;onEdit:()=>void;onOpen:(id:string)=>void;onNote:(title:string,text:string)=>void}){
  return <div className="detail material-reading"><div className="detail-top"><button className="plain-button" onClick={onClose}><X size={16}/>Закрыть</button><Button size="sm" variant="outline" onClick={onEdit}><Pencil size={16}/>Редактировать</Button></div>
    <div className="document-heading"><span className="eyebrow">{materialLabel(entity)}</span><h1>{entity.title}</h1>{entity.summary&&<p>{entity.summary}</p>}</div>
    {isSession(entity)&&<SessionMetadata entity={entity} entities={entities} onOpen={onOpen}/>}
    {entity.payload.cover&&entity.kind!=='map'&&characterType(entity)!=='npc'&&<img className="document-cover" src={entity.payload.cover} alt={`Обложка: ${entity.title}`}/>}
    {entity.kind==='character'&&<CharacterDetailsReader entity={entity} portrait={characterType(entity)==='npc'}/>}
    {entity.kind==='board'&&<Board readonly payload={entity.payload} onChange={()=>{}} entities={entities} onOpen={onOpen} onNote={onNote}/>}
    {entity.kind==='map'&&<WorldMap readonly payload={entity.payload} onChange={()=>{}} entities={entities} onOpen={onOpen}/>}
    {entity.payload.content&&<div className="material-reading-content">{entity.kind==='map'&&<h2>Описание</h2>}<RichEditor key={entity.id+':'+entity.revision} readonly value={entity.payload.content} entities={entities} onOpen={onOpen}/></div>}
    {characterDocuments(entity).map(document=><section key={document.pdf} className="reader-document"><h2>{document.name}</h2><a href={document.pdf} target="_blank" rel="noopener noreferrer">Открыть PDF</a><DocumentPages document={document} title={entity.title}/></section>)}
    {!entity.payload.content&&!['board','map','folder'].includes(entity.kind)&&!characterDocuments(entity).length&&<p className="reading-empty">Содержание пока не добавлено.</p>}
  </div>;
}
