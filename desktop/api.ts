import { env } from './local-env';
import * as entities from '../app/api/entities/route';
import * as assets from '../app/api/assets/route';
import * as asset from '../app/api/assets/[id]/route';
import * as transfer from '../app/api/campaign-transfer/route';
export function configureStorage(database:any,bucket:any){env.DB=database;env.BUCKET=bucket;}
export async function handleApi(req:Request){
  const url=new URL(req.url),pathname=url.pathname;
  if(!(url.protocol==='atlas:'&&url.hostname==='app'&&!url.port&&!url.username&&!url.password))return Response.json({error:'Недопустимый источник.'},{status:403});
  if(pathname==='/api/entities'){
    const f=entities[req.method as 'GET'|'POST'|'PATCH'|'DELETE'];if(f)return f(req);
  }
  if(pathname==='/api/assets'&&req.method==='POST')return assets.POST(req);
  if(/^\/api\/assets\/[a-f0-9-]{36}$/.test(pathname)&&req.method==='GET')return asset.GET(req,{params:Promise.resolve({id:pathname.split('/').pop()!})});
  if(pathname==='/api/campaign-transfer'){
    const f=transfer[req.method as 'GET'|'POST'|'DELETE'];if(f)return f(req);
  }
  return Response.json({error:'Запрос не поддерживается.'},{status:404});
}
