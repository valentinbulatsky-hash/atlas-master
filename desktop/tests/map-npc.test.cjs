const {test,afterEach}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {randomUUID}=require('node:crypto');
const {createStorage}=require('../storage.cjs'),{configureStorage,handleApi}=require('../server.cjs');
const {markerAppearance,moveMarker,markerShapes,searchMaterials,backlinks,textDoc}=require('../features.cjs');
let storage,directory;
afterEach(()=>{storage?.close();storage=null;if(directory)fs.rmSync(directory,{recursive:true,force:true});directory=null});
async function setup(){directory=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-map-npc-'));storage=await createStorage(directory);configureStorage(storage.database,storage.bucket)}
async function api(method,data,pathname='/api/entities'){const res=await handleApi(new Request('atlas://app'+pathname,{method,headers:{'X-Atlas-Request':'1','Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})}));return {status:res.status,data:await res.json()}}
async function create(kind,title,campaignId=null,payload={}){const r=await api('POST',{kind,title,campaignId,folderId:null,summary:'',payload});assert.equal(r.status,200,JSON.stringify(r.data));return r.data.entity}
test('map pin dragging uses actual zoomed image geometry and remains inside the map',()=>{
 assert.deepEqual(moveMarker({x:.5,y:.5},{x:120,y:-30},{width:600,height:300}),{x:.7,y:.4});
 assert.deepEqual(moveMarker({x:.5,y:.5},{x:120,y:-30},{width:1200,height:600}),{x:.6,y:.45});
 assert.deepEqual(moveMarker({x:.5,y:.5},{x:9999,y:-9999},{width:600,height:300}),{x:1,y:0});
 assert.deepEqual(moveMarker({x:.2,y:.3},{x:20,y:30},{width:0,height:0}),{x:.2,y:.3});
 assert.deepEqual(markerAppearance({id:'old',x:.1,y:.2,title:'',description:''}),{shape:'circle',color:'#ba9158',scale:1});
 assert.equal(markerAppearance({scale:999}).scale,2.2);assert.equal(markerAppearance({scale:-1}).scale,.6);
});
test('all eight marker shapes, empty and repeated labels persist, validate and transfer',async()=>{
 await setup();const camp=await create('campaign','Мир'),target=await create('article','Узел',camp.id);
 const pins=markerShapes.map((s,i)=>({id:'p'+i,x:.1+i*.1,y:.5,title:'',description:'Описание '+s.value,shape:s.value,color:'#628eb3',scale:i===0?.6:2.2,linkedEntityId:target.id}));
 const map=await create('map','Карта',camp.id,{pins});assert.deepEqual(map.payload.pins,pins);
 const repeated=await api('PATCH',{...map,payload:{pins:pins.map(p=>({...p,title:'Одно название'}))}});assert.equal(repeated.status,200);
 for(const patch of [{scale:.5},{scale:2.3},{scale:Infinity},{shape:'unknown'},{color:'red'},{title:'x'.repeat(121)}])assert.equal((await api('PATCH',{...repeated.data.entity,payload:{pins:[{...pins[0],...patch}]}})).status,400);
 assert.equal((await api('PATCH',{...repeated.data.entity,payload:{pins:[pins[0],pins[0]]}})).status,400);
 const metadata=await api('GET',null,'/api/campaign-transfer?campaignId='+camp.id);
 const archive={format:'atlas-master-campaign',version:1,campaignId:camp.id,records:metadata.data.records,assets:[]};
 const importId=randomUUID();const copy=await api('POST',{archive,uploadedAssets:{},importId},'/api/campaign-transfer');assert.equal(copy.status,200,JSON.stringify(copy.data));
 const state=(await api('GET')).data.entities,transferred=state.find(e=>e.campaignId===importId&&e.kind==='map');
 assert.equal(transferred.payload.pins.length,8);assert.equal(transferred.payload.pins[7].shape,'flag');assert.notEqual(transferred.payload.pins[0].linkedEntityId,target.id);
 storage.close();storage=await createStorage(directory);configureStorage(storage.database,storage.bucket);
 assert.equal((await api('GET')).data.entities.find(e=>e.id===map.id).payload.pins[0].title,'Одно название');
});
test('NPC appearance and distinguishing features survive saves, restart, export and search',async()=>{
 await setup();const camp=await create('campaign','Мир');
 const npc=await create('character','Король',camp.id,{characterType:'npc',appearance:'Серебряные волосы',distinguishingFeatures:'Руна путевого узла',motivation:'Спасти мир',role:'Король',notes:'Прежние заметки',content:textDoc('Прежний текст')});
 const updated=await api('PATCH',{...npc,summary:'Описание'});assert.equal(updated.status,200);assert.deepEqual(updated.data.entity.payload,npc.payload);
 const rows=(await api('GET')).data.entities;assert.equal(searchMaterials(rows,camp.id,'серебряные волосы')[0].entity.id,npc.id);
 const article=await create('article','Путевого узла',camp.id);assert.equal(backlinks(article,rows).some(x=>x.entity.id===npc.id),true);
 const exported=await api('GET',null,'/api/campaign-transfer?campaignId='+camp.id);assert.equal(exported.data.records.find(e=>e.id===npc.id).payload.distinguishingFeatures,'Руна путевого узла');
 const archive={format:'atlas-master-campaign',version:1,campaignId:camp.id,records:exported.data.records,assets:[]};
 const importId=randomUUID();assert.equal((await api('POST',{archive,uploadedAssets:{},importId},'/api/campaign-transfer')).status,200);
 const copied=(await api('GET')).data.entities.find(e=>e.campaignId===importId&&e.kind==='character');assert.deepEqual(copied.payload,npc.payload);
 storage.close();storage=await createStorage(directory);configureStorage(storage.database,storage.bucket);
 assert.equal((await api('GET')).data.entities.find(e=>e.id===npc.id).payload.appearance,'Серебряные волосы');
});
test('diamond board blocks retain their size and four vertex handles through persistence',async()=>{
 await setup();const camp=await create('campaign','Мир');
 const nodes=['rectangle','rounded','diamond'].map((shape,i)=>({id:'n'+i,position:{x:i*300,y:50},width:240,height:240,data:{title:shape,summary:'',text:'',shape,color:'#628eb3',mode:'summary'}}));
 const edges=[{id:'edge',source:'n0',target:'n2',sourceHandle:'right',targetHandle:'left',label:'',color:'#628eb3',dashed:false,directed:true}];
 const board=await create('board','Доска',camp.id,{nodes,edges});assert.deepEqual(board.payload.nodes,nodes);assert.deepEqual(board.payload.edges,edges);
 assert.equal((await api('PATCH',{...board,payload:{nodes:[{...nodes[2],data:{...nodes[2].data,shape:'triangle'}}]}})).status,400);
});

test('background transparency defaults to 50 and persists across saves, restart and transfer',async()=>{
 const {backgroundTransparency,backgroundImage}=require('../features.cjs');
 assert.equal(backgroundTransparency(),50);assert.equal(backgroundTransparency({type:'preset',preset:'forest'}),50);
 await setup();const camp=await create('campaign','Настройки фона',null,{background:{type:'preset',preset:'forest',transparency:50}});
 for(const value of [-1,101,'50'])assert.equal((await api('PATCH',{...camp,payload:{background:{type:'preset',preset:'forest',transparency:value}}})).status,400);
 let current=camp;for(const transparency of [0,100,35]){const r=await api('PATCH',{...current,payload:{background:{type:'preset',preset:'parchment',transparency}}});assert.equal(r.status,200);current=r.data.entity;assert.equal(current.payload.background.transparency,transparency)}
 const snapshot=(await api('GET',null,'/api/campaign-transfer?campaignId='+camp.id)).data;
 const copy=await api('POST',{archive:{format:'atlas-master-campaign',version:1,campaignId:camp.id,records:snapshot.records,assets:[]},uploadedAssets:{},importId:randomUUID()},'/api/campaign-transfer');assert.equal(copy.status,200);
 const rows=(await api('GET')).data.entities;assert.equal(rows.filter(e=>e.kind==='campaign').every(e=>e.payload.background.transparency===35),true);
 storage.close();storage=await createStorage(directory);configureStorage(storage.database,storage.bucket);assert.equal((await api('GET')).data.entities.find(e=>e.id===camp.id).payload.background.transparency,35);
 assert.equal(backgroundImage({type:'image',src:'https://example.com/image.png',transparency:50}),'none');
});
test('map label formatting persists, transfers, permits unnamed pins and validates bounds',async()=>{
 const {markerLabel,markerFonts}=require('../features.cjs');assert.equal(markerFonts.length,4);assert.equal(markerLabel({}).visible,false);
 await setup();const camp=await create('campaign','Подписи');
 const label={visible:true,position:'above',font:'classic',size:24,color:'#000000',bold:true,italic:true,underline:true,strike:true};
 const pin={id:'named',x:.4,y:.5,title:'Путевой узел',description:'',label};
 const map=await create('map','Карта',camp.id,{pins:[pin,{...pin,id:'empty',title:''}]});assert.deepEqual(map.payload.pins[0].label,label);
 for(const change of [{position:'left'},{font:'unknown'},{size:9},{size:37},{color:'white'},{visible:'yes'},{bold:1}])assert.equal((await api('PATCH',{...map,payload:{pins:[{...pin,label:{...label,...change}}]}})).status,400);
 let saved=map;for(const font of markerFonts){const r=await api('PATCH',{...saved,payload:{pins:[{...pin,label:{...label,font:font.value,position:'below',size:36,color:'#ffffff'}}]}});assert.equal(r.status,200);saved=r.data.entity;assert.equal(saved.payload.pins[0].label.font,font.value)}
 const snapshot=(await api('GET',null,'/api/campaign-transfer?campaignId='+camp.id)).data,importId=randomUUID();assert.equal((await api('POST',{archive:{format:'atlas-master-campaign',version:1,campaignId:camp.id,records:snapshot.records,assets:[]},uploadedAssets:{},importId},'/api/campaign-transfer')).status,200);
 assert.deepEqual((await api('GET')).data.entities.find(e=>e.campaignId===importId&&e.kind==='map').payload.pins,saved.payload.pins);
 storage.close();storage=await createStorage(directory);configureStorage(storage.database,storage.bucket);assert.deepEqual((await api('GET')).data.entities.find(e=>e.id===map.id).payload.pins,saved.payload.pins);
});
