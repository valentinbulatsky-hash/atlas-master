import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFile,mkdir,rm} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
await mkdir('.sites-runtime',{recursive:true});
const database=new DatabaseSync(':memory:');database.exec(await readFile('drizzle/0000_medical_tag.sql','utf8'));
const binding={prepare(sql){const statement=database.prepare(sql);let args=[];return {bind(...values){args=values;return this},async all(){return {results:statement.all(...args)}},async first(){return statement.get(...args)??null},async run(){return {meta:{changes:statement.run(...args).changes}}}}},async batch(statements){database.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());database.exec('COMMIT');return results}catch(e){database.exec('ROLLBACK');throw e}}};
const files=new Map();
globalThis.__pdfApiEnv={DB:binding,BUCKET:{async put(key,bytes,metadata){files.set(key,{bytes:new Uint8Array(bytes),metadata})},async get(key){const file=files.get(key);return file?{body:file.bytes}:null},async delete(key){files.delete(key)}}};
globalThis.__pdfApiUser=null;
const outfile=path.resolve('.sites-runtime/pdf-api-check.mjs');
await build({stdin:{contents:`export * as asset from './app/api/assets/route';export * as record from './app/api/entities/route';export * as file from './app/api/assets/[id]/route';`,loader:'ts',resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile,logLevel:'silent',plugins:[{name:'test-runtime',setup(build){build.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'runtime'}));build.onResolve({filter:/^@\/app\/chatgpt-auth$/},()=>({path:'auth',namespace:'runtime'}));build.onLoad({filter:/.*/,namespace:'runtime'},args=>({contents:args.path==='env'?'export const env=globalThis.__pdfApiEnv;':'export async function getChatGPTUser(){return globalThis.__pdfApiUser}',loader:'js'}))}}]});
try{
 const api=await import(pathToFileURL(outfile).href);
 const uploadRequest=(kind,bytes)=>{const form=new FormData();form.set('kind',kind);form.set('file',new File([bytes],'file.pdf'));return new Request('https://atlas.test/api/assets',{method:'POST',headers:{'X-Atlas-Request':'1'},body:form})};
 const bytes=new TextEncoder().encode('%PDF-1.7\nTest upload');
 const originalError=console.error;console.error=()=>{};
 try{
  assert.equal((await api.asset.POST(uploadRequest('pdf',bytes))).status,401);
  globalThis.__pdfApiUser={userId:'owner',email:'owner@test.invalid'};
  assert.equal((await api.asset.POST(uploadRequest('pdf',new TextEncoder().encode('not a pdf')))).status,400);
  assert.equal((await api.asset.POST(uploadRequest('image',bytes))).status,400);
  const uploaded=await (await api.asset.POST(uploadRequest('pdf',bytes))).json();assert.equal(uploaded.mime,'application/pdf');
  const jsonReq=(method,value)=>new Request('https://atlas.test/api/entities',{method,headers:{'X-Atlas-Request':'1','Content-Type':'application/json'},body:JSON.stringify(value)});
  const campaign=(await (await api.record.POST(jsonReq('POST',{kind:'campaign',title:'Test campaign',summary:'',payload:{}}))).json()).entity;
  const png=new Uint8Array([137,80,78,71,13,10,26,10]);const preview=await (await api.asset.POST(uploadRequest('image',png))).json();
  const document={name:'Персонаж.pdf',pdf:uploaded.url,pages:[{src:preview.url,width:1191,height:1684}]};
  const value={kind:'character',campaignId:campaign.id,title:'Test character',summary:'',payload:{characterType:'npc',documents:[document]}};
  const character=(await (await api.record.POST(jsonReq('POST',value))).json()).entity;assert.deepEqual(character.payload.documents,[document]);
  const edited=(await (await api.record.PATCH(jsonReq('PATCH',{...character,payload:{...character.payload,notes:'Added notes'}}))).json()).entity;assert.deepEqual(edited.payload.documents,[document]);
  const fileId=uploaded.url.split('/').pop();const ownFile=await api.file.GET(new Request('https://atlas.test'+uploaded.url),{params:Promise.resolve({id:fileId})});assert.equal(ownFile.headers.get('content-type'),'application/pdf');assert.deepEqual(new Uint8Array(await ownFile.arrayBuffer()),bytes);
  globalThis.__pdfApiUser={userId:'other',email:'other@test.invalid'};
  assert.equal((await api.file.GET(new Request('https://atlas.test'+uploaded.url),{params:Promise.resolve({id:fileId})})).status,404);
  const otherCampaign=(await (await api.record.POST(jsonReq('POST',{kind:'campaign',title:'Other campaign',summary:'',payload:{}}))).json()).entity;
  assert.equal((await api.record.POST(jsonReq('POST',{...value,campaignId:otherCampaign.id}))).status,400);
 }finally{console.error=originalError}
 console.log('PDF API verified: upload signatures, original PDF readback, attachment persistence after edits, and owner isolation.');
}finally{database.close();await rm(outfile);delete globalThis.__pdfApiEnv;delete globalThis.__pdfApiUser}
