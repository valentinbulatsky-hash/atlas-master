import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
export function db(){if(!env.DB)throw new Error('Хранилище временно недоступно');return env.DB;}
export class ApiError extends Error{constructor(message:string,public status=400){super(message)}}
export async function owner(req:Request){const u=await getChatGPTUser();if(!u)throw new ApiError('Войдите в аккаунт, чтобы открыть материалы.',401);if(req.method!=='GET'&&req.method!=='HEAD'){const site=req.headers.get('sec-fetch-site');if(site==='cross-site')throw new ApiError('Запрос с другого сайта запрещён.',403);if(!req.headers.get('x-atlas-request'))throw new ApiError('Неверный запрос.',403);}return u.userId;}
export function failure(e:unknown){console.error(e);return Response.json({error:e instanceof ApiError?e.message:'Не удалось обратиться к хранилищу. Данные в редакторе сохранены на экране.'},{status:e instanceof ApiError?e.status:503});}
export function serialize(r:any){return {id:r.id,campaignId:r.campaign_id,folderId:r.folder_id,kind:r.kind,title:r.title,summary:r.summary,payload:JSON.parse(r.payload),revision:r.revision,createdAt:r.created_at,updatedAt:r.updated_at};}
