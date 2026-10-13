'use client';
import { Download, Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
export default function CampaignActions({onExport,onImport,busy,status}:{onExport?:()=>void;onImport:(file:File)=>void;busy:boolean;status:string}){
  return <div className="campaign-file-actions">{onExport&&<Button variant="outline" disabled={busy} onClick={onExport}><Download size={16}/>Сохранить кампанию</Button>}<label className={'upload-button '+(busy?'disabled':'')}><Upload size={16}/>Загрузить кампанию<input type="file" accept=".json,application/json" disabled={busy} onChange={e=>{const file=e.target.files?.[0];if(file)onImport(file);e.target.value=''}}/></label>{status&&<span className="transfer-status" role="status"><Loader2 size={15} className="spin"/>{status}</span>}</div>;
}
