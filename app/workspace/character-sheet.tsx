'use client';
import { useState } from 'react';
import { FileText, Settings2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Choice } from './ui';
import { DocumentPages } from './document-pages';
import { characterDocuments } from '@/lib/character-documents';
import {characterType,type Entity} from '@/lib/model';
import {CharacterDetailsReader} from './character-details';

export default function CharacterSheet({character,onClose,onEdit}:{character:Entity;onClose:()=>void;onEdit:()=>void}) {
 const [zoom,setZoom]=useState('fit'),[selected,setSelected]=useState('');
 const documents=characterDocuments(character);
 const document=documents.find(doc=>doc.pdf===selected)??documents[0];
 if(!document)return null;
 return <section className="character-sheet">
  <div className="sheet-heading">
   <button className="plain-button" onClick={onClose}><X size={16}/>Закрыть</button>
   <div className="sheet-heading-name"><h1>{character.title}</h1><p>{character.summary}</p></div>
   <Button variant="outline" size="sm" onClick={onEdit}><Settings2 size={16}/>Редактировать</Button>
  </div>
  <div className="sheet-toolbar">
   {documents.length>1?<div className="document-choice"><Choice label="PDF-файл персонажа" value={document.pdf} onChange={setSelected} options={documents.map(doc=>({value:doc.pdf,label:doc.name}))}/></div>:<span className="document-name">{document.name}</span>}
   <div><Choice label="Масштаб листа" value={zoom} onChange={setZoom} options={[{value:'fit',label:'По ширине'},{value:'150',label:'150 %'},{value:'200',label:'200 %'},{value:'300',label:'300 %'},{value:'400',label:'400 %'}]}/>
    <Button asChild variant="outline" size="sm"><a href={document.pdf} target="_blank" rel="noopener noreferrer"><FileText size={16}/>Открыть PDF</a></Button>
   </div>
  </div>
  <DocumentPages document={document} title={character.title} zoom={zoom}/>
  {document.text&&<details className="sheet-transcript"><summary>Текст PDF</summary><p>{document.text}</p></details>}
  <CharacterDetailsReader entity={character} portrait={characterType(character)==='npc'}/>
 </section>;
}
