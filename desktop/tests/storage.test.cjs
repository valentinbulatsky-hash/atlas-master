const {test,afterEach}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {randomUUID,createHash}=require('node:crypto');
const {createStorage}=require('../storage.cjs');
const {configureStorage,handleApi}=require('../server.cjs');
let storage,directory;
async function setup(){directory=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-desktop-test-'));storage=await createStorage(directory);configureStorage(storage.database,storage.bucket);}
afterEach(()=>{if(storage){storage.close();storage=null;}if(directory){fs.rmSync(directory,{recursive:true,force:true});directory=null;}});
async function api(method,pathname='/api/entities',data){
  const req=new Request('atlas://app'+pathname,{method,headers:{'X-Atlas-Request':'1','Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});
  const response=await handleApi(req);return {status:response.status,data:await response.json()};
}
async function create(kind,title,campaignId=null,payload={}){
  const result=await api('POST','/api/entities',{kind,title,summary:'',campaignId,folderId:null,payload});assert.equal(result.status,200,JSON.stringify(result.data));return result.data.entity;
}
async function upload(bytes,mime='image/png'){
  const form=new FormData();form.set('file',new File([bytes],'test-file',{type:mime}));form.set('kind',mime==='application/pdf'?'pdf':'image');
  const response=await handleApi(new Request('atlas://app/api/assets',{method:'POST',headers:{'X-Atlas-Request':'1'},body:form}));
  const data=await response.json();assert.equal(response.status,200,JSON.stringify(data));return data.url;
}
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8i8AAAAASUVORK5CYII=','base64');
test('all material types, revisions, and attachments persist after restart',async()=>{
  await setup();const campaign=await create('campaign','Междуземье');
  const image=await upload(png),pdf=await upload(Buffer.from('%PDF-1.7\nlocal PDF fixture\n%%EOF'),'application/pdf');
  const article=await create('article','История мира',campaign.id,{content:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Текст'}]}]}});
  const character=await create('character','Хакон',campaign.id,{characterType:'pc',cover:image,documents:[{pdf,name:'Лист',pages:[{src:image,width:1,height:1}]}]});
  await create('character','Адрелиан',campaign.id,{characterType:'npc'});
  await create('map','Карта',campaign.id,{image,pins:[{id:'pin',x:.5,y:.5,title:'Узел',description:'',linkedEntityId:article.id}]});
  await create('board','Связи',campaign.id,{nodes:[{id:'node',position:{x:0,y:0},width:240,height:160,data:{title:'Хакон',summary:'',text:'',linkedEntityId:character.id,shape:'rounded',color:'#628eb3',mode:'summary'}}],edges:[]});
  const update=await api('PATCH','/api/entities',{...article,title:'Новая история'});assert.equal(update.status,200);
  assert.equal((await api('PATCH','/api/entities',article)).status,409);
  storage.close();storage=await createStorage(directory);configureStorage(storage.database,storage.bucket);
  const result=await api('GET');assert.equal(result.data.entities.length,6);assert.ok(result.data.entities.some(e=>e.title==='Новая история'));
  const response=await handleApi(new Request('atlas://app'+image));assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.arrayBuffer()),png);
  assert.ok(fs.existsSync(path.join(directory,'atlas.sqlite')));
  assert.equal(fs.readdirSync(path.join(directory,'backups')).length,2);
});
test('campaign import remaps internal links and uploaded files atomically',async()=>{
  await setup();const campaign=await create('campaign','Перенос'),image=await upload(png);
  const article=await create('article','Статья',campaign.id,{cover:image});
  await create('map','Карта',campaign.id,{image,pins:[{id:'p',x:.2,y:.3,title:'Место',description:'',linkedEntityId:article.id}]});
  const exportResult=await api('GET','/api/campaign-transfer?campaignId='+campaign.id);assert.equal(exportResult.status,200);
  const archive={format:'atlas-master-campaign',version:1,campaignId:campaign.id,records:exportResult.data.records,assets:exportResult.data.assets.map(a=>({...a,sha256:createHash('sha256').update(png).digest('hex')}))};
  assert.equal((await api('POST','/api/campaign-transfer',{archive,validateOnly:true})).status,200);
  const newImage=await upload(png),mapping={[archive.assets[0].id]:newImage.split('/').pop()},importId=randomUUID();
  const imported=await api('POST','/api/campaign-transfer',{archive,uploadedAssets:mapping,importId});assert.equal(imported.status,200,JSON.stringify(imported.data));
  const all=(await api('GET')).data.entities,copy=all.filter(e=>e.campaignId===importId);assert.equal(copy.length,2);
  const newArticle=copy.find(e=>e.kind==='article'),map=copy.find(e=>e.kind==='map');assert.notEqual(newArticle.id,article.id);
  assert.equal(map.payload.pins[0].linkedEntityId,newArticle.id);assert.equal(map.payload.image,newImage);
  assert.equal((await api('POST','/api/campaign-transfer',{archive,uploadedAssets:mapping,importId})).data.alreadyImported,true);
  archive.assets[0].sha256='0'.repeat(64);
  const broken=await api('POST','/api/campaign-transfer',{archive,uploadedAssets:mapping,importId:randomUUID()});assert.equal(broken.status,400);
  assert.equal((await api('GET')).data.entities.length,6);
});
test('transaction rollback and disk-write failure leave previous data intact',async()=>{
  await setup();const camp=await create('campaign','Сохранённая');
  await assert.rejects(storage.database.batch([storage.database.prepare('UPDATE entities SET title=? WHERE id=?').bind('Неверная',camp.id),storage.database.prepare('INSERT INTO missing_table VALUES (?)').bind(1)]));
  assert.equal((await api('GET')).data.entities[0].title,'Сохранённая');
  const original=fs.renameSync;fs.renameSync=()=>{throw Object.assign(new Error('Simulated disk failure'),{code:'EACCES'})};
  try{await assert.rejects(storage.database.prepare('UPDATE entities SET title=? WHERE id=?').bind('Не сохранена',camp.id).run());}finally{fs.renameSync=original;}
  assert.equal((await api('GET')).data.entities[0].title,'Сохранённая');
  storage.close();storage=await createStorage(directory);configureStorage(storage.database,storage.bucket);
  assert.equal((await api('GET')).data.entities[0].title,'Сохранённая');
});
test('external callers, forged mutations, bad uploads, and traversal are rejected',async()=>{
  await setup();const outside=await handleApi(new Request('https://evil.example/api/entities'));assert.equal(outside.status,403);
  const forged=await handleApi(new Request('atlas://app/api/entities',{method:'POST',body:'{}'}));assert.equal(forged.status,403);
  await assert.rejects(storage.bucket.get('../../private.txt'));
  const form=new FormData();form.set('file',new File(['<script>bad</script>'],'bad.png',{type:'image/png'}));
  const response=await handleApi(new Request('atlas://app/api/assets',{method:'POST',headers:{'X-Atlas-Request':'1'},body:form}));assert.equal(response.status,400);
});
test('damaged database is reported without overwriting the original file',async()=>{
  directory=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-damaged-'));const file=path.join(directory,'atlas.sqlite');const bytes=Buffer.from('damaged-user-data');fs.writeFileSync(file,bytes);
  await assert.rejects(createStorage(directory));assert.deepEqual(fs.readFileSync(file),bytes);
});
