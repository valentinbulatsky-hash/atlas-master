// End-to-end checks with a real renderer and temporary, synthetic campaign data.
const {app}=require('electron');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-features-ui-'));
app.setPath('appData',directory);
const reports=path.join(__dirname,'../test-output');fs.mkdirSync(reports,{recursive:true});
const report=path.join(reports,'features-smoke.json');fs.rmSync(report,{force:true});
const timer=setTimeout(()=>{fs.writeFileSync(report,JSON.stringify({ok:false,error:'UI test timed out'}));app.exit(1)},100000);
app.on('browser-window-created',(_event,window)=>{
 window.webContents.once('did-finish-load',async()=>{
  try{
   await window.webContents.executeJavaScript(`(async()=>{
    const create=async(kind,title,campaignId=null,payload={},folderId=null)=>{const r=await fetch('/api/entities',{method:'POST',headers:{'Content-Type':'application/json','X-Atlas-Request':'1'},body:JSON.stringify({kind,title,campaignId,payload,folderId,summary:''})});const data=await r.json();if(!r.ok)throw new Error(data.error);return data.entity};
    const doc=text=>({type:'doc',content:[{type:'paragraph',content:[{type:'text',text}]}]});
    const other=await create('campaign','Чужая кампания');await create('article','Чужой секрет',other.id,{content:doc('Чужая история')});await create('character','Посторонний герой',other.id,{characterType:'pc'});
    const campaign=await create('campaign','Проверка новых функций');const folder=await create('folder','Север',campaign.id);const pc=await create('character','Адрелиан',campaign.id,{characterType:'pc'},folder.id);await create('character','Король Нуату',campaign.id,{characterType:'npc'});
    await create('article','История узла',campaign.id,{content:doc('Адрелиан изучает дерево. Здесь есть следы странников.')},folder.id);
    await create('article','Первая сессия',campaign.id,{entryType:'session',sessionDate:'2026-10-13',sessionTime:'19:30',participantIds:[pc.id],content:doc('Журнальный секрет. Адрелиан участвовал в путешествии.')});
   })()`);
   const loaded=new Promise(resolve=>window.webContents.once('did-finish-load',resolve));window.webContents.reload();await loaded;
   const result=await window.webContents.executeJavaScript(`(async()=>{
    const wait=async(test,label)=>{for(let i=0;i<120;i++){if(test())return;await new Promise(r=>setTimeout(r,60))}throw new Error(label+'; page: '+document.body.textContent.slice(-1400))};
    const textButton=(label,root=document)=>[...root.querySelectorAll('button')].find(b=>b.textContent.trim()===label);
    const fill=(el,value)=>{if(!el)throw new Error('Input missing');Object.getOwnPropertyDescriptor(el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));};
    const search=async value=>{const el=document.querySelector('input[aria-label="Поиск в библиотеке кампании"]');el.focus();fill(el,value);await new Promise(r=>setTimeout(r,120));el.form.requestSubmit();await wait(()=>document.querySelector('[data-search-scope="library"]'),'Search page missing');await new Promise(r=>setTimeout(r,100));};
    await wait(()=>[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Открыть последнюю кампанию')),'Home did not load');[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Открыть последнюю кампанию')).click();
    await wait(()=>document.querySelector('input[aria-label="Поиск в библиотеке кампании"]'),'Sidebar search missing');
    const sidebarJournal=document.querySelector('[data-session-nav]');
    if(!sidebarJournal||document.querySelector('.topbar [data-session-nav]')||document.querySelector('.journal-top-link'))throw new Error('Journal navigation has wrong location');
    if(!document.querySelector('[data-sidebar="sidebar"]')?.contains(sidebarJournal))throw new Error('Journal is outside the sidebar');
    const homeJournal=document.querySelector('.campaign-journal-button');if(!homeJournal)throw new Error('Campaign home journal button missing');homeJournal.click();
    await wait(()=>document.querySelector('[data-search-scope="sessions"]'),'Home journal did not open');
    document.querySelector('[data-breadcrumb-campaign]').click();await wait(()=>document.querySelector('.campaign-journal-button'),'Campaign breadcrumb did not return to overview');
    const input=document.querySelector('input[aria-label="Поиск в библиотеке кампании"]');input.focus();fill(input,'Адрелиан');
    await wait(()=>document.querySelectorAll('.sidebar-search-matches>button').length>=3,'Search suggestions missing');
    const sidebar=document.querySelector('[data-sidebar="sidebar"]')??document.querySelector('[data-slot="sidebar-container"]');if(!sidebar?.contains(document.querySelector('.sidebar-search-matches')))throw new Error('Suggestions are outside the sidebar');
    [...document.querySelectorAll('.sidebar-search-matches>button')].find(b=>b.querySelector('strong')?.textContent==='Адрелиан').click();
    await wait(()=>document.querySelector('.document-heading h1')?.textContent==='Адрелиан','Suggested material did not open');
    const menu=document.querySelector('.backlinks-menu');menu.querySelector('summary').click();await wait(()=>menu.open,'Backlink menu did not expand');
    if(!menu.textContent.includes('История узла')||!menu.textContent.includes('Статья')||!menu.textContent.includes('Подкаталог'))throw new Error('Backlink source types missing');
    if(menu.textContent.includes('Первая сессия')||menu.textContent.includes('Запись сессии'))throw new Error('Session appeared in material backlinks');
    [...menu.querySelectorAll('button')].find(b=>b.textContent.includes('История узла')).click();await wait(()=>document.querySelector('.document-heading h1')?.textContent==='История узла','Backlink did not navigate');
    const folderCrumb=document.querySelector('[data-breadcrumb-folder]');if(!folderCrumb||folderCrumb.textContent!=='Север')throw new Error('Catalog breadcrumb missing');folderCrumb.click();
    await wait(()=>document.querySelector('.page-heading h1')?.textContent==='Север','Catalog breadcrumb did not open catalog');
    document.querySelector('[data-breadcrumb-section]').click();await wait(()=>document.querySelector('.page-heading h1')?.textContent==='Материалы','Section breadcrumb did not open section');
    if(document.querySelector('[data-breadcrumb-folder]'))throw new Error('Section breadcrumb retained catalog filter');
    await search('Журнальный секрет');if(document.querySelectorAll('.search-result-card').length)throw new Error('Journal leaked into library search');
    await search('Чужой секрет');if(document.querySelectorAll('.search-result-card').length)throw new Error('Other campaign leaked into search');
    await search('Адрелиан');if(document.querySelectorAll('.search-result-card').length!==2)throw new Error('Expected title and content matches');
    const choose=async(label,value)=>{const trigger=document.querySelector('[aria-label="'+label+'"]');trigger.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));await wait(()=>[...document.querySelectorAll('[role="option"]')].some(e=>e.textContent.trim()===value),'Filter options missing');[...document.querySelectorAll('[role="option"]')].find(e=>e.textContent.trim()===value).click();await new Promise(r=>setTimeout(r,120));};
    await choose('Тип результата поиска','Статьи');if(document.querySelectorAll('.search-result-card').length!==1||!document.querySelector('.search-result-card').textContent.includes('История узла'))throw new Error('Type filter failed');
    await choose('Каталог результатов поиска','Север');if(document.querySelectorAll('.search-result-card').length!==1)throw new Error('Catalog filter failed');
    document.querySelector('[data-session-nav]').click();await wait(()=>document.querySelector('[data-search-scope="sessions"]'),'Journal missing');
    if(document.querySelectorAll('.search-result-card').length!==1)throw new Error('Journal contains library entries');
    textButton('Добавить сессию').click();await wait(()=>document.querySelector('.dialog-form .session-fields'),'Session creation missing');
    const form=document.querySelector('.dialog-form');if(form.textContent.includes('Король Нуату')||form.textContent.includes('Посторонний герой')||!form.textContent.includes('Адрелиан'))throw new Error('Participants are not campaign PCs');
    form.querySelector('.participant-choices input').click();fill(form.querySelector('input[placeholder="Название материала"]'),'Первая сессия');form.requestSubmit();
    await wait(()=>document.body.textContent.includes('Название уже используется'),'Duplicate warning missing');textButton('Понятно').click();
    await wait(()=>document.querySelector('.dialog-form'),'Creation form did not remain');fill(document.querySelector('.dialog-form input[placeholder="Название материала"]'),'Тестовая сессия UI');document.querySelector('.dialog-form').requestSubmit();
    await wait(()=>document.querySelector('.title-input')?.value==='Тестовая сессия UI','Session editor missing');
    if(!document.querySelector('.prose-editor [contenteditable="true"]')&&!document.querySelector('.prose-editor[contenteditable="true"]'))throw new Error('Article editor missing');
    fill(document.querySelector('textarea[aria-label="Краткое описание"]'),'Заметка для поиска в журнале');await wait(()=>document.querySelector('.save-actions .unsaved'),'Editor did not become dirty');
    document.querySelector('[data-session-nav]').click();await wait(()=>document.body.textContent.includes('Есть несохранённые изменения'),'Unsaved warning missing');textButton('Вернуться').click();
    await wait(()=>!document.querySelector('[role="alertdialog"]'),'Unsaved dialog did not close');
    document.querySelector('[data-breadcrumb-campaign]').click();await wait(()=>document.body.textContent.includes('Есть несохранённые изменения'),'Campaign breadcrumb discarded unsaved edits');textButton('Вернуться').click();
    await wait(()=>!document.querySelector('[role="alertdialog"]'),'Campaign breadcrumb dialog did not close');
    document.querySelector('[data-breadcrumb-section]').click();await wait(()=>document.body.textContent.includes('Есть несохранённые изменения'),'Section breadcrumb discarded unsaved edits');textButton('Вернуться').click();
    await wait(()=>!document.querySelector('[role="alertdialog"]'),'Section breadcrumb dialog did not close');
    textButton('Сохранить',document.querySelector('.save-actions')).click();await wait(()=>document.querySelector('.save-actions .saved'),'Save did not finish');
    const state=await (await fetch('/api/entities')).json(),saved=state.entities.find(e=>e.title==='Тестовая сессия UI');if(!saved||saved.payload.participantIds.length!==1||!saved.payload.sessionDate||saved.payload.entryType!=='session'||saved.summary!=='Заметка для поиска в журнале')throw new Error('Session metadata not saved');
    textButton('К чтению').click();await wait(()=>document.querySelector('.session-metadata'),'Session reading metadata missing');
    document.querySelector('[data-session-nav]').click();await wait(()=>document.querySelector('input[aria-label="Поиск в журнале сессий"]'),'Journal search missing');fill(document.querySelector('input[aria-label="Поиск в журнале сессий"]'),'Заметка для поиска');await wait(()=>document.querySelectorAll('.search-result-card').length===1,'Journal search failed');
    return {ok:true,sidebarJournal:true,breadcrumbNavigation:true,sessionBacklinksExcluded:true,sidebarSuggestions:true,backlinks:true,campaignIsolation:true,journalIsolation:true,searchFilters:true,duplicateWarning:true,sessionCreation:true,sessionPersistence:true,unsavedWarning:true,journalSearch:true};
   })()`);
   fs.writeFileSync(report,JSON.stringify(result,null,2));clearTimeout(timer);app.exit(0);
  }catch(error){fs.writeFileSync(report,JSON.stringify({ok:false,error:error.stack??String(error)},null,2));clearTimeout(timer);app.exit(1)}
 });
});
require('../main.cjs');
