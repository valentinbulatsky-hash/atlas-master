'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const initSqlJs=require('sql.js');
async function createStorage(directory){
  fs.mkdirSync(directory,{recursive:true});
  const databaseFile=path.join(directory,'atlas.sqlite');
  const SQL=await initSqlJs({locateFile:()=>require.resolve('sql.js/dist/sql-wasm.wasm')});
  let raw=new SQL.Database(fs.existsSync(databaseFile)?fs.readFileSync(databaseFile):undefined);
  let savedBytes;
  raw.run(`CREATE TABLE IF NOT EXISTS assets (id TEXT PRIMARY KEY NOT NULL,owner_id TEXT NOT NULL,key TEXT NOT NULL,mime TEXT NOT NULL,size INTEGER NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS entities (id TEXT PRIMARY KEY NOT NULL,owner_id TEXT NOT NULL,campaign_id TEXT,folder_id TEXT,kind TEXT NOT NULL,title TEXT NOT NULL,summary TEXT NOT NULL DEFAULT '',payload TEXT NOT NULL DEFAULT '{}',revision INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS entities_owner ON entities(owner_id);
    CREATE INDEX IF NOT EXISTS entities_campaign ON entities(owner_id,campaign_id);`);
  // Add a name index without renaming or removing legacy materials.
  const columns=new Set(raw.exec('PRAGMA table_info(entities)')[0].values.map(r=>r[1]));
  for(const column of ['name_key','material_type'])if(!columns.has(column))raw.run('ALTER TABLE entities ADD COLUMN '+column+' TEXT');
  const legacy=raw.exec('SELECT id,title,kind,payload FROM entities WHERE name_key IS NULL OR material_type IS NULL');
  if(legacy.length)for(const [id,title,kind,json] of legacy[0].values){
    const payload=JSON.parse(json),key=title.normalize('NFKC').trim().replace(/\s+/gu,' ').toLocaleLowerCase('ru');
    const type=kind==='character'?(payload.characterType==='pc'?'pc':'npc'):kind==='article'&&payload.entryType==='session'?'session':kind;
    raw.run('UPDATE entities SET name_key=?,material_type=? WHERE id=?',[key,type,id]);
  }
  raw.run('CREATE INDEX IF NOT EXISTS entities_names ON entities(owner_id,campaign_id,folder_id,material_type,name_key)');
  function persist(){
    const temporary=databaseFile+'.'+randomUUID()+'.tmp';
    const fd=fs.openSync(temporary,'wx');
    const bytes=Buffer.from(raw.export());
    try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
    try{fs.renameSync(temporary,databaseFile);savedBytes=bytes;}catch(e){fs.rmSync(temporary,{force:true});throw e;}
  }
  function execute(sql,values=[],write=false){
    const statement=raw.prepare(sql);
    try{statement.bind(values);const results=[];while(statement.step())results.push(statement.getAsObject());return {results,meta:{changes:write?raw.getRowsModified():0}};}finally{statement.free();}
  }
  function prepared(sql,values=[]){return {
    sql,values,
    bind(...args){return prepared(sql,args)},
    async all(){return execute(sql,values)},
    async first(){return execute(sql,values).results[0]??null},
    async run(){return database.batch([this]).then(rows=>rows[0])},
  }}
  const database={prepare:prepared,async batch(statements){
    raw.run('BEGIN');let committed=false;
    try{const results=statements.map(s=>execute(s.sql,s.values,true));raw.run('COMMIT');committed=true;persist();return results;}
    catch(e){if(committed){raw.close();raw=new SQL.Database(savedBytes);}else raw.run('ROLLBACK');throw e;}
  }};
  // Never replace a damaged database with an empty one. Opening failures propagate.
  persist();
  const filesDirectory=path.join(directory,'files');fs.mkdirSync(filesDirectory,{recursive:true});
  function objectPath(key){if(!/^[a-f0-9-]{36}\/[a-f0-9-]{36}$/.test(key))throw new Error('Invalid file key');return path.join(filesDirectory,...key.split('/'));}
  const bucket={
    async put(key,bytes){const file=objectPath(key);fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.'+randomUUID()+'.tmp';try{fs.writeFileSync(tmp,bytes,{flag:'wx'});fs.renameSync(tmp,file);}finally{fs.rmSync(tmp,{force:true});}},
    async get(key){const file=objectPath(key);try{const bytes=fs.readFileSync(file);return {body:new Uint8Array(bytes),async arrayBuffer(){return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)}};}catch(e){if(e.code==='ENOENT')return null;throw e;}},
    async delete(key){fs.rmSync(objectPath(key),{force:true})},
  };
  function snapshot(){
    const backupDirectory=path.join(directory,'backups');fs.mkdirSync(backupDirectory,{recursive:true});
    const name=new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID()+'.sqlite';fs.copyFileSync(databaseFile,path.join(backupDirectory,name));
    const files=fs.readdirSync(backupDirectory).filter(n=>n.endsWith('.sqlite')).sort().reverse();for(const file of files.slice(7))fs.unlinkSync(path.join(backupDirectory,file));
  }
  snapshot();
  return {database,bucket,directory,databaseFile,snapshot,close(){persist();raw.close()}};
}
module.exports={createStorage};
