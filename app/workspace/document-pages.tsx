'use client';
import type { CharacterDocument } from '@/lib/character-documents';
export function DocumentPages({document:doc,title,zoom='fit'}:{document:CharacterDocument;title:string;zoom?:string}){
 return <div className="sheet-pages-viewport" tabIndex={0} aria-label={`Страницы PDF: ${doc.name}`}>
  <div className="sheet-pages" style={zoom==='fit'?undefined:{width:zoom+'%',maxWidth:'none'}}>
   {doc.pages.map((page,i)=><figure key={page.src}>
    <img src={page.src} width={page.width} height={page.height} alt={`${title} — ${doc.name}, страница ${i+1}`} loading={i===0?'eager':'lazy'}/>
    <figcaption>Страница {i+1} из {doc.pages.length}</figcaption>
   </figure>)}
  </div>
 </div>;
}
