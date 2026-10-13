'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { upload } from './ui';
import type { CharacterDocument } from '@/lib/character-documents';
import { MAX_ASSET_BYTES } from '@/lib/assets';

async function readPdf(file:File,onProgress:(message:string)=>void):Promise<CharacterDocument>{
 if(!file.size||file.size>MAX_ASSET_BYTES)throw new Error('PDF должен быть не больше 10 МБ.');
 const data=new Uint8Array(await file.arrayBuffer());
 if(new TextDecoder().decode(data.slice(0,5))!=='%PDF-')throw new Error('Выберите корректный PDF-файл.');
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const {default:workerUrl}=await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url');
 pdfjs.GlobalWorkerOptions.workerSrc=workerUrl;
 const task=pdfjs.getDocument({data,cMapUrl:'/pdfjs/cmaps/',cMapPacked:true,standardFontDataUrl:'/pdfjs/standard_fonts/',wasmUrl:'/pdfjs/wasm/'});
 try{
  const pdf=await task.promise;
  if(pdf.numPages>50)throw new Error('Можно прикрепить PDF до 50 страниц.');
  const pages:CharacterDocument['pages']=[];let text='';
  for(let number=1;number<=pdf.numPages;number++){
   onProgress(`Страница ${number} из ${pdf.numPages}`);
   const page=await pdf.getPage(number);
   const size=page.getViewport({scale:1});
   const viewport=page.getViewport({scale:Math.min(2,2400/size.width,3200/size.height)});
   const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
   try{
    await page.render({canvas,viewport,background:'#ffffff'}).promise;
    const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Не удалось подготовить страницу PDF.')),'image/webp',.96));
    const src=await upload(new File([blob],`page-${number}.webp`,{type:blob.type}));
    pages.push({src,width:canvas.width,height:canvas.height});
    if(text.length<12000){const content=await page.getTextContent();text+=(content.items.map(item=>'str' in item?item.str:'').join(' ')+'\n\n');text=text.slice(0,12000)}
   }finally{canvas.width=0;canvas.height=0;page.cleanup()}
  }
  onProgress('Сохраняем PDF…');
  const url=await upload(file,'pdf');
  return {pdf:url,name:file.name.slice(0,200),pages,text};
 }catch(err){
  if((err as Error).name==='PasswordException')throw new Error('PDF защищён паролем. Прикрепите файл без пароля.');
  if((err as Error).name==='InvalidPDFException')throw new Error('PDF повреждён или не поддерживается. Выберите другой файл.');
  throw err;
 }finally{await task.destroy()}
}

export function PdfUpload({onUpload,onBusyChange,disabled=false}:{onUpload:(doc:CharacterDocument)=>void;onBusyChange:(busy:boolean)=>void;disabled?:boolean}){
 const [busy,setBusy]=useState(false),[progress,setProgress]=useState('');
 return <label className={'upload-button '+(busy||disabled?'disabled':'')}>
  <input type="file" accept="application/pdf,.pdf" aria-label="Прикрепить PDF к персонажу" disabled={busy||disabled} onChange={async e=>{
   const input=e.currentTarget,file=input.files?.[0];if(!file)return;
   setBusy(true);onBusyChange(true);setProgress('Открываем PDF…');
   try{onUpload(await readPdf(file,setProgress));toast.success('PDF подготовлен. Нажмите «Сохранить», чтобы прикрепить его к персонажу.')}
   catch(err){toast.error((err as Error).message)}
   finally{setBusy(false);onBusyChange(false);input.value=''}
  }}/><span role="status" aria-live="polite">{busy?progress:'Прикрепить PDF'}</span>
 </label>;
}
