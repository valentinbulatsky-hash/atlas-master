// Real Windows renderer checks for themes, board geometry, map pins and NPC profiles.
const {app}=require('electron');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-editor-ui-'));app.setPath('appData',directory);
const output=path.join(__dirname,'../test-output');fs.mkdirSync(output,{recursive:true});
const report=path.join(output,'editor-smoke.json');fs.rmSync(report,{force:true});
const timer=setTimeout(()=>{fs.writeFileSync(report,JSON.stringify({ok:false,error:'Editor UI test timed out'}));app.exit(1)},180000);
app.on('browser-window-created',(_event,window)=>{
 window.setSize(1400,1000);
 window.webContents.once('did-finish-load',async()=>{
  const run=code=>window.webContents.executeJavaScript(code);
  const reload=async id=>{await run(`history.replaceState(null,'','?entity='+${JSON.stringify(id)})`);const ready=new Promise(r=>window.webContents.once('did-finish-load',r));window.webContents.reload();await ready;await helpers()};
  const helpers=()=>run(`window.__editorTest={
   wait:async(test,label)=>{for(let i=0;i<150;i++){if(test())return;await new Promise(r=>setTimeout(r,70))}throw new Error(label+'; '+document.body.textContent.slice(-1000))},
   button:(label,root=document)=>[...root.querySelectorAll('button')].find(b=>b.textContent.trim()===label),
   fill:(el,value)=>{if(!el)throw new Error('Missing input');Object.getOwnPropertyDescriptor(el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(el,String(value));el.dispatchEvent(new Event('input',{bubbles:true}))},
   pause:()=>new Promise(r=>setTimeout(r,150)),
   upload:(el,data)=>{const raw=atob(data.split(',')[1]),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0)),transfer=new DataTransfer();transfer.items.add(new File([bytes],'fixture.png',{type:'image/png'}));el.files=transfer.files;el.dispatchEvent(new Event('change',{bubbles:true}))}
  };void 0;`);
  const capture=async(label,selector)=>{
   const box=await run(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:Math.max(0,Math.floor(r.left)),y:Math.max(0,Math.floor(r.top)),width:Math.min(1100,Math.floor(r.width)),height:Math.min(650,Math.floor(r.height),window.innerHeight-Math.max(0,Math.floor(r.top)))}})()`);
   if(box.height>0){const shot=await window.webContents.capturePage(box);console.log('ATLAS_UI_SHOT_'+label+'='+shot.toJPEG(65).toString('base64'))}
  };
  const drag=async point=>{
   window.webContents.sendInputEvent({type:'mouseMove',x:point.x,y:point.y});
   window.webContents.sendInputEvent({type:'mouseDown',x:point.x,y:point.y,button:'left',clickCount:1});
   await new Promise(r=>setTimeout(r,100));
   window.webContents.sendInputEvent({type:'mouseMove',x:point.x+60,y:point.y+25,modifiers:['leftButtonDown']});
   await new Promise(r=>setTimeout(r,200));
   window.webContents.sendInputEvent({type:'mouseUp',x:point.x+60,y:point.y+25,button:'left',clickCount:1});
   await new Promise(r=>setTimeout(r,150));
  };
  try{
   const seed=await run(`(async()=>{
    const doc=text=>({type:'doc',content:[{type:'paragraph',content:[{type:'text',text}]}]});
    const create=async(kind,title,campaignId=null,payload={})=>{const r=await fetch('/api/entities',{method:'POST',headers:{'Content-Type':'application/json','X-Atlas-Request':'1'},body:JSON.stringify({kind,title,campaignId,folderId:null,summary:'Текст описания для проверки читаемости',payload})});const d=await r.json();if(!r.ok)throw new Error(d.error);return d.entity};
    const campaign=await create('campaign','Проверка интерфейса 0.1.3',null,{background:{type:'preset',preset:'none'}});
    const article=await create('article','Контраст текста',campaign.id,{content:doc('Читаемый текст статьи и описание кампании.')});
    const board=await create('board','Формы блоков',campaign.id,{nodes:[{id:'block',position:{x:0,y:0},data:{title:'Путевой узел',summary:'Краткое описание блока',text:'Содержание заметки',shape:'rectangle',color:'#628eb3',mode:'summary'}}],edges:[]});
    const map=await create('map','Карта для проверки',campaign.id,{pins:[],content:doc('Описание карты остаётся под изображением.')});
    const npc=await create('character','Проверочный NPC',campaign.id,{characterType:'npc',motivation:'Старая цель',notes:'Прежние заметки мастера',role:'Странник',content:doc('Основной текст персонажа сохраняется.')});
    const canvas=document.createElement('canvas');canvas.width=600;canvas.height=400;const ctx=canvas.getContext('2d');ctx.fillStyle='#eadcc0';ctx.fillRect(0,0,600,400);ctx.fillStyle='#779c75';ctx.beginPath();ctx.ellipse(220,185,165,125,.3,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#6b9caf';ctx.lineWidth=25;ctx.beginPath();ctx.moveTo(50,330);ctx.bezierCurveTo(240,300,360,100,580,70);ctx.stroke();const mapImage=canvas.toDataURL('image/png');
    canvas.width=200;canvas.height=250;ctx.fillStyle='#273c50';ctx.fillRect(0,0,200,250);ctx.fillStyle='#c9a875';ctx.beginPath();ctx.arc(100,85,46,0,Math.PI*2);ctx.fill();ctx.fillStyle='#638b92';ctx.beginPath();ctx.ellipse(100,225,80,85,0,0,Math.PI*2);ctx.fill();const portrait=canvas.toDataURL('image/png');
    return {campaign,article,board,map,npc,mapImage,portrait};
   })()`);
   // Check both themes across every preset; transparent text must also pass against
   // the worst possible image under the actual theme scrim.
   const contrastResults=[];
   for(const preset of ['none','parchment','forest','stars','stone']){
    await run(`(async()=>{const s=await(await fetch('/api/entities')).json(),c=s.entities.find(e=>e.id===${JSON.stringify(seed.campaign.id)});const r=await fetch('/api/entities',{method:'PATCH',headers:{'Content-Type':'application/json','X-Atlas-Request':'1'},body:JSON.stringify({...c,payload:{...c.payload,background:{type:'preset',preset:${JSON.stringify(preset)}}}})});if(!r.ok)throw new Error('Preset patch failed')})()`);
    await reload(seed.article.id);
    for(const theme of ['light','dark']){
     const result=await run(`(async()=>{
      const {wait,pause}=window.__editorTest;await wait(()=>document.querySelector('.document-heading h1')?.textContent==='Контраст текста','Article missing');
      if(document.documentElement.dataset.theme!==${JSON.stringify(theme)})document.querySelector('[aria-label="Светлая тема"]').click();await wait(()=>document.documentElement.dataset.theme===${JSON.stringify(theme)},'Theme did not change');await pause();
      const rgb=value=>{if(value.startsWith('#')){const s=value.slice(1);return [0,2,4].map(i=>parseInt(s.slice(i,i+2),16)).concat(s.length===8?parseInt(s.slice(6),16)/255:1)}return (value.match(/[\\d.]+/g)||[]).map(Number)};
      const lum=c=>c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
      const ratio=(a,b)=>{const x=lum(a),y=lum(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
      const backgrounds=el=>{for(let n=el;n;n=n.parentElement){const s=getComputedStyle(n);if(n.classList.contains('campaign-surface')){const rgba=rgb(s.getPropertyValue('--campaign-scrim').trim()),a=rgba[3]??1;return [0,255].map(v=>rgba.slice(0,3).map(x=>x*a+v*(1-a)))}const c=rgb(s.backgroundColor);if(c.length&&(!c[3]||c[3]===1)&&s.backgroundColor!=='rgba(0, 0, 0, 0)')return[c];}return[rgb(getComputedStyle(document.body).backgroundColor)]};
      const check=selector=>{const el=document.querySelector(selector);if(!el)throw new Error('Contrast element missing: '+selector);const fg=rgb(getComputedStyle(el).color),r=Math.min(...backgrounds(el).map(bg=>ratio(fg,bg)));if(r<4.5)throw new Error('Low contrast '+selector+' '+r+' '+document.documentElement.dataset.theme);return r};
      const reading=[check('.document-heading h1'),check('.document-heading p'),check('.prose-editor p'),check('[data-sidebar="menu-button"] span')];
      document.querySelector('[data-breadcrumb-campaign]').click();await wait(()=>document.querySelector('.campaign-journal-button'),'Campaign overview missing');
      const overview=[check('.page-heading h1'),check('.page-heading p'),check('.material-card h3'),check('.material-card p'),check('.card-meta')];
      return Math.min(...reading,...overview);
     })()`);contrastResults.push({preset,theme,minimum:result});
     await reload(seed.article.id);
    }
   }
   await reload(seed.board.id);
   await run(`(async()=>{const {wait,button,pause}=window.__editorTest;await wait(()=>document.querySelector('.atlas-node'),'Board missing');button('Редактировать').click();await wait(()=>document.querySelector('.detail .react-flow__node-atlas'),'Board editor missing');document.querySelector('.react-flow__node-atlas').click();await wait(()=>document.querySelector('.board-inspector'),'Node inspector missing');
    const node=document.querySelector('.atlas-node'),size=node.getBoundingClientRect();
    document.querySelector('.board-inspector [aria-label="Скруглённый блок"]').click();await wait(()=>node.dataset.nodeShape==='rounded','Rounded shape did not apply');if(Number(node.querySelector('rect').getAttribute('rx'))<=0)throw new Error('Rounded outline stayed square');
    const rounded=node.getBoundingClientRect();if(Math.abs(rounded.width-size.width)>1||Math.abs(rounded.height-size.height)>1)throw new Error('Shape switch changed default size');
    document.querySelector('.board-inspector [aria-label="Прямоугольник"]').click();await wait(()=>node.dataset.nodeShape==='rectangle','Rectangle did not apply');if(Number(node.querySelector('rect').getAttribute('rx'))!==0)throw new Error('Rectangle is rounded');
    document.querySelector('.board-inspector [aria-label="Ромб"]').click();await wait(()=>node.dataset.nodeShape==='diamond','Diamond did not apply');await pause();if(!node.querySelector('polygon'))throw new Error('Diamond outline missing');
    const r=node.getBoundingClientRect(),vertices={left:[r.left,r.top+r.height/2],right:[r.right,r.top+r.height/2],top:[r.left+r.width/2,r.top],bottom:[r.left+r.width/2,r.bottom]};
    for(const [side,[x,y]]of Object.entries(vertices)){const h=node.querySelector('[data-handleid="'+side+'"]')?.getBoundingClientRect();if(!h||Math.abs(h.left+h.width/2-x)>3||Math.abs(h.top+h.height/2-y)>3)throw new Error('Diamond handle misses vertex '+side)}
    button('Сохранить',document.querySelector('.save-actions')).click();await wait(()=>document.querySelector('.save-actions .saved'),'Board save failed');
    const list=await(await fetch('/api/entities')).json(),saved=list.entities.find(e=>e.id===${JSON.stringify(seed.board.id)});if(saved.payload.nodes[0].data.shape!=='diamond')throw new Error('Diamond not persisted');
   })()`);
   await capture('board','.board-shell');
   await reload(seed.map.id);
   await run(`(async()=>{const {wait,button,upload,pause}=window.__editorTest;await wait(()=>document.querySelector('.world-map'),'Map reader missing');if(document.querySelector('.world-map input'))throw new Error('Map reader has edit controls');button('Редактировать').click();await wait(()=>document.querySelector('.world-map[data-map-mode="edit"]'),'Map editor missing');
    const uploads=document.querySelectorAll('.world-map input[type="file"]');if(uploads.length!==1||document.querySelector('.world-map .canvas-empty input'))throw new Error('Duplicate map upload control');upload(uploads[0],${JSON.stringify(seed.mapImage)});await wait(()=>document.querySelector('.map-image img')?.complete,'Toolbar image upload failed');await pause();
    document.querySelector('[aria-label="Добавить метку"]').click();let image=document.querySelector('.map-image'),r=image.getBoundingClientRect();image.dispatchEvent(new MouseEvent('click',{clientX:r.left+r.width*.3,clientY:r.top+r.height*.45,bubbles:true}));await wait(()=>document.querySelectorAll('.map-marker').length===1,'First marker missing');
    const fill=window.__editorTest.fill;fill(document.querySelector('[aria-label="Описание метки"]'),'Переправа на реке');
    for(const [label,value]of [['Круг','circle'],['Ромб','diamond'],['Замок','castle'],['Дерево','tree'],['Дом','house'],['Якорь','anchor'],['Пещера','cave'],['Флаг','flag']]){document.querySelector('.map-inspector [aria-label="'+label+'"]').click();await wait(()=>document.querySelector('.map-marker').dataset.markerShape===value,'Marker shape failed '+value)}
    document.querySelector('.map-inspector [aria-label="Замок"]').click();fill(document.querySelector('[aria-label="Цвет метки"]'),'#bc553a');fill(document.querySelector('[aria-label="Размер метки"]'),'2.2');await pause();if(document.querySelector('.map-marker').getBoundingClientRect().width<69)throw new Error('Marker size slider failed');
    fill(document.querySelector('[aria-label="Размер метки"]'),'.6');await pause();if(document.querySelector('.map-marker').getBoundingClientRect().width>21)throw new Error('Minimum marker size failed');fill(document.querySelector('[aria-label="Размер метки"]'),'1.3');
    document.querySelector('[aria-label="Добавить метку"]').click();image=document.querySelector('.map-image');r=image.getBoundingClientRect();image.dispatchEvent(new MouseEvent('click',{clientX:r.left+r.width*.7,clientY:r.top+r.height*.65,bubbles:true}));await wait(()=>document.querySelectorAll('.map-marker').length===2,'Second unnamed marker missing');await pause();
   })()`);
   const before=await run(`(()=>{const p=document.querySelectorAll('.map-marker')[1],r=p.getBoundingClientRect();return{id:p.dataset.mapPin,left:p.style.left,top:p.style.top,x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)}})()`);
   await drag(before);
   await run(`(async()=>{const {wait,button}=window.__editorTest;await wait(()=>document.querySelector('[data-map-pin="'+${JSON.stringify(before.id)}+'"]').style.left!==${JSON.stringify(before.left)},'Marker dragging failed');button('Сохранить',document.querySelector('.save-actions')).click();await wait(()=>document.querySelector('.save-actions .saved'),'Map save failed');
    const state=await(await fetch('/api/entities')).json(),map=state.entities.find(e=>e.id===${JSON.stringify(seed.map.id)});if(map.payload.pins.length!==2||map.payload.pins.some(p=>p.title!==''))throw new Error('Empty titles not retained');if(map.payload.pins[0].shape!=='castle'||map.payload.pins[0].color!=='#bc553a'||map.payload.pins[0].scale!==1.3)throw new Error('Marker properties not saved');
    button('К чтению').click();await wait(()=>document.querySelector('.world-map[data-map-mode="read"]'),'Map did not return to reading');document.querySelector('.map-marker').click();await wait(()=>document.querySelector('.map-inspector .note-content')?.textContent==='Переправа на реке','Marker reading missing');if(document.querySelector('.world-map input'))throw new Error('Marker can be edited while reading');
   })()`);
   await capture('map','.world-map');
   const readonlyPoint=await run(`(()=>{const p=document.querySelector('.map-marker'),r=p.getBoundingClientRect();return {left:p.style.left,top:p.style.top,x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)}})()`);await drag(readonlyPoint);
   await run(`if(document.querySelector('.map-marker').style.left!==${JSON.stringify(readonlyPoint.left)}||document.querySelector('.map-marker').style.top!==${JSON.stringify(readonlyPoint.top)})throw new Error('Readonly marker moved')`);
   await reload(seed.npc.id);
   await run(`(async()=>{const {wait,button,fill,upload}=window.__editorTest;await wait(()=>document.querySelector('.document-heading h1')?.textContent==='Проверочный NPC','NPC missing');button('Редактировать').click();await wait(()=>document.querySelector('.npc-details-editor'),'NPC fields missing');
    if(document.querySelector('[aria-label="Цели и мотивация"]').value!=='Старая цель')throw new Error('Existing motivation lost');if(document.querySelector('[aria-label="Заметки мастера"]').value!=='Прежние заметки мастера')throw new Error('Existing notes lost');
    fill(document.querySelector('[aria-label="Внешность"]'),'Серебристые волосы и зелёный плащ');fill(document.querySelector('[aria-label="Отличительные особенности"]'),'Шрам на левой щеке');fill(document.querySelector('[aria-label="Цели и мотивация"]'),'Защитить поселение');upload(document.querySelector('.npc-portrait-panel input[type="file"]'),${JSON.stringify(seed.portrait)});
    await wait(()=>document.querySelector('.npc-portrait-panel img')?.complete,'NPC portrait upload failed');await wait(()=>!button('Сохранить',document.querySelector('.save-actions')).disabled,'NPC upload did not finish');button('Сохранить',document.querySelector('.save-actions')).click();await wait(()=>document.querySelector('.save-actions .saved'),'NPC save failed');
    const state=await(await fetch('/api/entities')).json(),npc=state.entities.find(e=>e.id===${JSON.stringify(seed.npc.id)});if(npc.payload.appearance!=='Серебристые волосы и зелёный плащ'||npc.payload.distinguishingFeatures!=='Шрам на левой щеке'||npc.payload.motivation!=='Защитить поселение'||!npc.payload.cover||npc.payload.notes!=='Прежние заметки мастера')throw new Error('NPC data lost');
    button('К чтению').click();await wait(()=>document.querySelector('.npc-reader-profile img'),'NPC portrait not visible in reading');if(!document.querySelector('.reader-character-notes').textContent.includes('Шрам на левой щеке')||!document.querySelector('.prose-editor').textContent.includes('Основной текст персонажа сохраняется.'))throw new Error('NPC reading or rich text missing');
    fill(document.querySelector('[aria-label="Поиск в библиотеке кампании"]'),'Серебристые');await wait(()=>document.querySelector('.sidebar-search-matches strong')?.textContent==='Проверочный NPC','New NPC fields not searchable');
   })()`);
   await run(`(async()=>{const {wait,button}=window.__editorTest;button('Редактировать').click();await wait(()=>document.querySelector('.properties .delete-button'),'NPC properties missing');document.querySelector('.properties .delete-button').click();await wait(()=>document.querySelector('[role="alertdialog"]'),'Delete warning missing');const b=button('Удалить',document.querySelector('[role="alertdialog"]')),s=getComputedStyle(b),rgb=v=>(v.match(/[\\d.]+/g)||[]).map(Number),lum=c=>c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);const a=lum(rgb(s.color)),z=lum(rgb(s.backgroundColor));if((Math.max(a,z)+.05)/(Math.min(a,z)+.05)<4.5)throw new Error('Low destructive button contrast');button('Оставить',document.querySelector('[role="alertdialog"]')).click();await wait(()=>!document.querySelector('[role="alertdialog"]'),'Delete cancel failed');button('К чтению').click();await wait(()=>document.querySelector('.npc-reader-profile'),'NPC reading did not return');})()`);
   await capture('npc','.material-reading');
   fs.writeFileSync(report,JSON.stringify({ok:true,themeContrast:contrastResults,defaultRoundedShape:true,diamondVertexHandles:true,mapUpload:true,eightMarkerShapes:true,blankMarkerTitles:true,markerSlider:true,markerDrag:true,readonlyMap:true,npcFields:true,npcPortrait:true,existingNpcTextPreserved:true},null,2));clearTimeout(timer);app.exit(0);
  }catch(error){fs.writeFileSync(report,JSON.stringify({ok:false,error:error.stack??String(error)},null,2));clearTimeout(timer);app.exit(1)}
 });
});
require('../main.cjs');
