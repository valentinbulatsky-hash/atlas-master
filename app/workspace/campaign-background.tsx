'use client';
import { useState } from 'react';
import { ImagePlus, Monitor, Smartphone, Check } from 'lucide-react';
import { Dialog,DialogContent,DialogTitle,DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { backgroundImage,backgroundPresets,type CampaignBackground } from '@/lib/campaign-background';
import type { Entity } from '@/lib/model';
import { api,upload } from './ui';
import { toast } from 'sonner';

export default function CampaignBackgroundDialog({campaign,onClose,onSaved}:{campaign:Entity;onClose:()=>void;onSaved:(e:Entity)=>void}){
  const [value,setValue]=useState<CampaignBackground>(campaign.payload.background??{type:'preset',preset:'none'}),[busy,setBusy]=useState(false);
  const image=backgroundImage(value),custom=value.type==='image';
  const save=async()=>{setBusy(true);try{const {entity}=await api('PATCH',{...campaign,payload:{...campaign.payload,background:value}});onSaved(entity);onClose();toast.success('Фон кампании сохранён')}catch(e){toast.error((e as Error).message)}finally{setBusy(false)}};
  return <Dialog open onOpenChange={open=>!open&&!busy&&onClose()}><DialogContent className="background-dialog"><DialogTitle>Фон кампании</DialogTitle><DialogDescription>Выберите фон для «{campaign.title}» и посмотрите, как он выглядит на разных экранах.</DialogDescription>
    <div className="background-presets" role="group" aria-label="Стандартные фоны">{backgroundPresets.map(p=><button disabled={busy} key={p.id} className={value.type==='preset'&&value.preset===p.id?'selected':''} aria-pressed={value.type==='preset'&&value.preset===p.id} onClick={()=>setValue({type:'preset',preset:p.id})}><span style={{backgroundImage:p.image}}>{value.type==='preset'&&value.preset===p.id&&<Check size={18}/>}</span>{p.name}</button>)}</div>
    <label className={'upload-button background-upload '+(busy?'disabled':'')}><ImagePlus size={17}/>{busy?'Подождите…':custom?'Заменить свой фон':'Загрузить свой фон'}<input type="file" accept="image/jpeg,image/png" disabled={busy} onChange={async e=>{const file=e.target.files?.[0];if(!file)return;setBusy(true);try{if(!['image/jpeg','image/png'].includes(file.type))throw new Error('Выберите JPEG или PNG.');const src=await upload(file);setValue({type:'image',src})}catch(err){toast.error((err as Error).message)}finally{setBusy(false);e.target.value=''}}}/></label><p className="small-muted">JPEG или PNG, до 10 МБ. Изображение заполняет экран и обрезается по краям.</p>
    <div className="background-previews">{(['desktop','mobile'] as const).map(device=><div key={device} className={'background-preview '+device}><div className="preview-caption">{device==='desktop'?<Monitor size={16}/>:<Smartphone size={16}/>} {device==='desktop'?'Версия для ПК':'Мобильная версия'}</div><div className="preview-screen" style={{backgroundImage:image}}><div className="preview-scrim"/><div className="preview-topbar">Атлас мастера</div>{device==='desktop'&&<div className="preview-sidebar"><span/><span/><span/><span/></div>}<div className="preview-content"><strong>{campaign.title}</strong><div className="preview-card">Материалы кампании<div/><div/></div></div></div></div>)}</div>
    <div className="dialog-actions"><Button variant="outline" disabled={busy} onClick={onClose}>Отмена</Button><Button disabled={busy} onClick={()=>void save()}>{busy?'Сохраняем…':'Применить фон'}</Button></div>
  </DialogContent></Dialog>;
}
