import { env } from './local-env';
export function db(){if(!env.DB)throw new Error('Локальная база недоступна');return env.DB;}
export class ApiError extends Error{constructor(message:string,public status=400,public code?:string){super(message)}}
export async function owner(req:Request){
  const url=new URL(req.url);
  if(!(url.protocol==='atlas:'&&url.hostname==='app'&&!url.port&&!url.username&&!url.password))throw new ApiError('Недопустимый источник запроса.',403);
  if(!['GET','HEAD'].includes(req.method)&&req.headers.get('x-atlas-request')!=='1')throw new ApiError('Недопустимый запрос.',403);
  return '00000000-0000-4000-8000-000000000001';
}
export function failure(e:unknown){console.error(e);return Response.json({...(e instanceof ApiError&&e.code?{code:e.code}:{}),error:e instanceof ApiError?e.message:'Не удалось сохранить локальные данные. Проверьте свободное место на диске.'},{status:e instanceof ApiError?e.status:503});}
export function serialize(r:any){return {id:r.id,campaignId:r.campaign_id,folderId:r.folder_id,kind:r.kind,title:r.title,summary:r.summary,payload:JSON.parse(r.payload),revision:r.revision,createdAt:r.created_at,updatedAt:r.updated_at};}
