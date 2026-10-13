const {test,afterEach}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {randomUUID}=require('node:crypto');
const {createStorage}=require('../storage.cjs');
const {handleApi,configureStorage}=require('../server.cjs');
const {searchMaterials,backlinks,materialType,isSession,titleConflict,textDoc,remapArchive,validateArchiveMetadata}=require('../features.cjs');
let storage,directory;
afterEach(()=>{storage?.close();storage=null;if(directory)fs.rmSync(directory,{recursive:true,force:true});directory=null});
async function setup(){directory=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-features-'));storage=await createStorage(directory);configureStorage(storage.database,storage.bucket)}
async function api(method,data,pathname='/api/entities'){const res=await handleApi(new Request('atlas://app'+pathname,{method,headers:{'X-Atlas-Request':'1','Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})}));return {status:res.status,data:await res.json()}}
async function add(kind,title,campaignId=null,payload={},folderId=null){const r=await api('POST',{kind,title,campaignId,payload,folderId,summary:''});assert.equal(r.status,200,JSON.stringify(r.data));return r.data.entity}
function entity(id,title,kind='article',payload={},folderId=null,campaignId='camp'){return {id,title,kind,payload,folderId,campaignId,summary:'',revision:1,createdAt:'2026-10-01T00:00:00Z',updatedAt:'2026-10-01T00:00:00Z'}}
test('campaign search separates the journal and other campaigns, searches content and uses filters and ranking',()=>{
 const folder=entity('f','Север','folder'),sub=entity('sub','Леса','folder',{},'f'),pc=entity('pc','Хакон','character',{characterType:'pc'},'sub');
 const description=entity('a','Легенда','article',{content:textDoc('Хакон ищет лунный камень')},'f');
 const board=entity('b','Схема','board',{nodes:[{data:{title:'Лунный камень',text:'Северный путь'}}]});
 const pdf=entity('pdf','Торстейн','character',{characterType:'pc',documents:[{text:'загадка древних деревьев'}]});
 const session=entity('s','Хакон','article',{entryType:'session',content:textDoc('Лунный камень'),participantIds:['pc'],sessionDate:'2026-10-10'});
 const outside=entity('outside','Хакон','article',{},null,'another');const rows=[description,pc,board,pdf,folder,sub,session,outside];
 assert.deepEqual(searchMaterials(rows,'camp','Хакон').map(h=>h.entity.id),['pc','a']);
 assert.deepEqual(searchMaterials(rows,'camp','лунный камень',{type:'board'}).map(h=>h.entity.id),['b']);
 assert.deepEqual(searchMaterials(rows,'camp','деревьев').map(h=>h.entity.id),['pdf']);
 assert.deepEqual(searchMaterials(rows,'camp','Хакон',{folder:'f'}).map(h=>h.entity.id),['pc','a']);
 assert.deepEqual(searchMaterials(rows,'camp','Хакон',{folder:'f',descendants:false}).map(h=>h.entity.id),['a']);
 assert.deepEqual(searchMaterials(rows,'camp','Хакон',{scope:'sessions'}).map(h=>h.entity.id),['s']);
 assert.equal(searchMaterials(rows,'camp','',{type:'npc'}).length,0);
 const newer={...description,createdAt:'2026-10-12T00:00:00Z'};
 assert.equal(searchMaterials([pc,newer],'camp','',{sort:'created-desc'})[0].entity.id,'a');
 assert.equal(searchMaterials([pc,newer],'camp','',{sort:'created-asc'})[0].entity.id,'pc');
});
test('backlinks include only library materials and exclude every kind of session reference',()=>{
 const target=entity('orm','Орм','character',{characterType:'pc'},'folder');
 const linked=entity('link','Сага','article',{content:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Бард',marks:[{type:'link',attrs:{href:'/?entity=orm'}}]}]}]}});
 const mention=entity('mention','Легенда','article',{content:textDoc('«Орм» знает этот путь. Орм вернулся.')});
 const unrelated=entity('no','Норма','article',{content:textDoc('Нормальный рассказ')});
 const map=entity('map','Карта','map',{pins:[{linkedEntityId:'orm'}]}),board=entity('board','Связи','board',{nodes:[{data:{linkedEntityId:'orm'}}]});
 const folder=entity('folder','Персонажи','folder'),session=entity('session','Сессия','article',{entryType:'session',participantIds:['orm']});
 const sessionMention=entity('session-mention','Сессия с упоминанием','article',{entryType:'session',content:textDoc('Орм вернулся')});
 const sessionLink=entity('session-link','Сессия со ссылкой','article',{entryType:'session',content:linked.payload.content});
 const outside=entity('other','В другом мире','article',{content:textDoc('Орм')},null,'other');
 const result=backlinks(target,[target,linked,mention,unrelated,map,board,folder,session,sessionMention,sessionLink,outside]);
 assert.deepEqual(new Set(result.map(x=>x.entity.id)),new Set(['link','mention','map','board','folder']));
 assert.equal(result.filter(x=>x.entity.id==='mention').length,1);
 const punctuation=entity('x','Узел (древний)');assert.equal(backlinks(punctuation,[punctuation,entity('y','Текст','article',{content:textDoc('Нашли Узел (древний).')})]).length,1);
});
test('duplicate names are blocked atomically by type, campaign and catalog on create, rename and move',async()=>{
 await setup();const camp=await add('campaign','Мир'),other=await add('campaign','Мир'),folder=await add('folder','Север',camp.id);
 const pc=await add('character','Хакон',camp.id,{characterType:'pc'});
 const attempts=await Promise.all([1,2].map(()=>api('POST',{kind:'article',title:'Одновременно',summary:'',campaignId:camp.id,folderId:null,payload:{}})));
 assert.deepEqual(attempts.map(r=>r.status).sort(),[200,409]);
 assert.equal(attempts.find(r=>r.status===409).data.code,'DUPLICATE_TITLE');
 assert.equal((await api('POST',{...pc,id:undefined,title:'  ХАКОН  '})).status,409);
 await add('character','Хакон',camp.id,{characterType:'npc'});await add('article','Хакон',camp.id);await add('character','Хакон',other.id,{characterType:'pc'});
 const second=await add('character','Хакон',camp.id,{characterType:'pc'},folder.id);
 assert.equal((await api('PATCH',{...second,folderId:null})).data.code,'DUPLICATE_TITLE');
 const third=await add('character','Орм',camp.id,{characterType:'pc'});
 assert.equal((await api('PATCH',{...third,title:'Хакон'})).status,409);
 assert.equal((await api('PATCH',{...pc,summary:'Сохранённая правка'})).status,200);
 assert.equal((await api('DELETE',{id:folder.id,revision:folder.revision})).data.code,'DUPLICATE_TITLE');
});
test('session metadata validates PC membership and dates, persists, and remaps participants on campaign import',async()=>{
 await setup();const camp=await add('campaign','Мир'),other=await add('campaign','Другой мир');
 const pc=await add('character','Хакон',camp.id,{characterType:'pc'}),npc=await add('character','Король',camp.id,{characterType:'npc'}),outside=await add('character','Другой',other.id,{characterType:'pc'});
 const data={kind:'article',title:'Сессия 1',summary:'',campaignId:camp.id,folderId:null,payload:{entryType:'session',sessionDate:'2026-10-13',sessionTime:'19:30',participantIds:[pc.id],content:textDoc('Нашли дерево')}};
 for(const id of [npc.id,outside.id])assert.equal((await api('POST',{...data,payload:{...data.payload,participantIds:[id]}})).status,400);
 assert.equal((await api('POST',{...data,payload:{...data.payload,sessionDate:'2026-02-30'}})).status,400);
 assert.equal((await api('POST',{...data,payload:{...data.payload,sessionTime:'24:00'}})).status,400);
 const session=(await api('POST',data)).data.entity;assert.ok(isSession(session));assert.equal(materialType(session),'session');
 await add('article','Сессия 1',camp.id); // The journal and library have separate namespaces.
 const snapshot=(await api('GET',undefined,'/api/campaign-transfer?campaignId='+camp.id)).data;
 const archive={format:'atlas-master-campaign',version:1,campaignId:camp.id,records:snapshot.records,assets:[]};validateArchiveMetadata(archive);
 const importId=randomUUID();const imported=await api('POST',{archive,uploadedAssets:{},importId},'/api/campaign-transfer');assert.equal(imported.status,200,JSON.stringify(imported.data));
 let all=(await api('GET')).data.entities;const copy=all.find(e=>e.campaignId===importId&&isSession(e)),copyPc=all.find(e=>e.campaignId===importId&&e.title==='Хакон');
 assert.deepEqual(copy.payload.participantIds,[copyPc.id]);assert.notEqual(copyPc.id,pc.id);assert.equal(copy.payload.sessionDate,'2026-10-13');
 storage.close();storage=await createStorage(directory);configureStorage(storage.database,storage.bucket);all=(await api('GET')).data.entities;assert.equal(all.find(e=>e.id===session.id).payload.sessionTime,'19:30');
 const npcPc=(await api('PATCH',{...pc,payload:{characterType:'npc'}})).data.entity;const historical=(await api('GET',undefined,'/api/campaign-transfer?campaignId='+camp.id)).data;validateArchiveMetadata({format:'atlas-master-campaign',version:1,campaignId:camp.id,records:historical.records,assets:[]});
 await api('DELETE',{id:pc.id,revision:npcPc.revision});all=(await api('GET')).data.entities;assert.deepEqual(all.find(e=>e.id===session.id).payload.participantIds,[]);
});
test('older databases gain the name index without losing or silently renaming duplicate records',async()=>{
 directory=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-upgrade-'));
 const SQL=await require('sql.js')({locateFile:()=>require.resolve('sql.js/dist/sql-wasm.wasm')}),raw=new SQL.Database();
 raw.run("CREATE TABLE entities(id TEXT PRIMARY KEY,owner_id TEXT,campaign_id TEXT,folder_id TEXT,kind TEXT,title TEXT,summary TEXT,payload TEXT,revision INTEGER,created_at TEXT,updated_at TEXT)");
 const uid='00000000-0000-4000-8000-000000000001';raw.run("INSERT INTO entities VALUES ('camp',?,NULL,NULL,'campaign','Мир','','{}',1,'2026-10-01','2026-10-01')",[uid]);
 for(const id of ['a','b'])raw.run("INSERT INTO entities VALUES (?,?,'camp',NULL,'article','Совпадение','','{}',1,'2026-10-01','2026-10-01')",[id,uid]);
 fs.writeFileSync(path.join(directory,'atlas.sqlite'),Buffer.from(raw.export()));raw.close();
 storage=await createStorage(directory);configureStorage(storage.database,storage.bucket);
 const rows=(await api('GET')).data.entities;assert.equal(rows.length,3);assert.equal(rows.filter(e=>e.title==='Совпадение').length,2);
 assert.equal((await api('PATCH',{...rows.find(e=>e.id==='a'),summary:'Можно редактировать прежнюю запись'})).status,200);
 assert.equal((await api('POST',{kind:'article',campaignId:'camp',folderId:null,title:'Совпадение',summary:'',payload:{}})).status,409);
});
