'use client';
import {useEffect,useState} from 'react';
import {Settings2,Palette,FolderOpen,Type,Info,Minus,Plus,RotateCcw,LogOut,Undo2,Redo2,Scissors,Copy,Clipboard,TextSelect} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
import {Switch} from '@/components/ui/switch';
import {ThemeSwitch} from './theme';
import {toast} from 'sonner';

type Action='info'|'open-data-folder'|'quit'|'undo'|'redo'|'cut'|'copy'|'paste'|'select-all'|'zoom-in'|'zoom-out'|'zoom-reset'|'fullscreen';
type DesktopInfo={version:string;dataDirectory:string;zoomFactor:number;fullscreen:boolean};
declare global {interface Window {atlasDesktop?:{execute(action:Action):Promise<DesktopInfo>}}}
let textTarget:HTMLElement|null=null,textRange:Range|null=null,textSelection:{start:number;end:number}|null=null;
function captureSelection(){
  const element=document.activeElement as HTMLElement|null;
  if(!element||element.closest('[data-atlas-settings]'))return;
  if(element.matches('input,textarea')||element.isContentEditable){
    textTarget=element;
    if(element instanceof HTMLInputElement||element instanceof HTMLTextAreaElement){textSelection=element.selectionStart===null?null:{start:element.selectionStart,end:element.selectionEnd??element.selectionStart};textRange=null;}
    else{const selection=window.getSelection();textRange=selection?.rangeCount?selection.getRangeAt(0).cloneRange():null;textSelection=null;}
  }
}
export function useSettingsTextTarget(){useEffect(()=>{
  document.addEventListener('focusin',captureSelection);document.addEventListener('selectionchange',captureSelection);
  return()=>{document.removeEventListener('focusin',captureSelection);document.removeEventListener('selectionchange',captureSelection)};
},[])}
const sections=[{id:'appearance',title:'Оформление',Icon:Palette},{id:'storage',title:'Данные и файлы',Icon:FolderOpen},{id:'editing',title:'Работа с текстом',Icon:Type},{id:'about',title:'О приложении',Icon:Info}];
export default function AppSettings({open,onClose}:{open:boolean;onClose:()=>void}){
  const [section,setSection]=useState('appearance'),[info,setInfo]=useState<DesktopInfo|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{if(!open)return;setError('');if(window.atlasDesktop)void window.atlasDesktop.execute('info').then(setInfo).catch(e=>setError(e.message));},[open]);
  async function action(command:Action){if(!window.atlasDesktop){toast.error('Команда доступна в настольном приложении.');return}setBusy(true);try{setInfo(await window.atlasDesktop.execute(command));setError('')}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
  function edit(command:Action){
    const element=textTarget,range=textRange,selection=textSelection;
    if(!element?.isConnected){toast.info('Сначала откройте текст для редактирования.');return;}
    onClose();
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      element.focus({preventScroll:true});
      if(selection&&(element instanceof HTMLInputElement||element instanceof HTMLTextAreaElement))element.setSelectionRange(selection.start,selection.end);
      else if(range){const selected=window.getSelection();selected?.removeAllRanges();selected?.addRange(range)}
      void action(command);
    }));
  }
  return <Dialog open={open} onOpenChange={value=>!value&&onClose()}><DialogContent className="app-settings" data-atlas-settings>
    <div className="settings-heading"><span className="settings-emblem"><Settings2 size={25}/></span><div><DialogTitle>Настройки приложения</DialogTitle><DialogDescription>Ваш Атлас мастера — так, как удобно вам.</DialogDescription></div></div>
    <div className="settings-layout"><nav className="settings-nav" aria-label="Разделы настроек">{sections.map(({id,title,Icon})=><button key={id} type="button" className={section===id?'selected':''} aria-current={section===id?'page':undefined} onClick={()=>setSection(id)}><Icon size={18}/><span>{title}</span></button>)}</nav>
      <div className="settings-content">
        {section==='appearance'&&<><span className="eyebrow">ВАШЕ ПРОСТРАНСТВО</span><h2>Оформление</h2><p className="settings-intro">Выберите тему и комфортный размер интерфейса.</p><section className="settings-card"><h3>Цветовая тема</h3><ThemeSwitch/></section><section className="settings-card"><div className="settings-row"><div><h3>Масштаб интерфейса</h3><p>Изменяет размер текста, меню и кнопок.</p></div><span className="settings-value">{Math.round((info?.zoomFactor??1)*100)}%</span></div><div className="settings-actions"><Button variant="outline" disabled={busy} aria-label="Уменьшить интерфейс" onClick={()=>void action('zoom-out')}><Minus size={16}/></Button><Button variant="outline" disabled={busy} onClick={()=>void action('zoom-reset')}><RotateCcw size={15}/>Обычный размер</Button><Button variant="outline" disabled={busy} aria-label="Увеличить интерфейс" onClick={()=>void action('zoom-in')}><Plus size={16}/></Button></div></section><section className="settings-card settings-row"><div><h3>Полноэкранный режим</h3><p>Больше места для карт и досок. Быстрая клавиша — F11.</p></div><Switch aria-label="Полноэкранный режим" disabled={busy} checked={info?.fullscreen??false} onCheckedChange={()=>void action('fullscreen')}/></section></>}
        {section==='storage'&&<><span className="eyebrow">ВАШИ МИРЫ</span><h2>Данные и файлы</h2><p className="settings-intro">Материалы и вложения хранятся на этом компьютере.</p><section className="settings-card"><h3>Папка данных</h3><p className="settings-path">{info?.dataDirectory??'Папка профиля Windows'}</p><Button variant="outline" disabled={busy} onClick={()=>void action('open-data-folder')}><FolderOpen size={16}/>Открыть папку данных</Button></section><section className="settings-card"><h3>Перенос и резервная копия</h3><p>На странице кампании выберите сохранение в файл .atlas.json. В него входят материалы, изображения, PDF и внутренние ссылки.</p><p>Для полной копии коллекции закройте приложение и скопируйте всю папку данных на другой носитель. Снимки в папке backups содержат только базу.</p></section></>}
        {section==='editing'&&<><span className="eyebrow">ЗАМЕТКИ МАСТЕРА</span><h2>Работа с текстом</h2><p className="settings-intro">Команда применяется к последнему открытому полю или редактору. Окно настроек закроется, чтобы вернуть к нему фокус.</p><div className="settings-edit-grid">{([{command:'undo',name:'Отменить',keys:'Ctrl + Z',Icon:Undo2},{command:'redo',name:'Повторить',keys:'Ctrl + Y',Icon:Redo2},{command:'cut',name:'Вырезать',keys:'Ctrl + X',Icon:Scissors},{command:'copy',name:'Копировать',keys:'Ctrl + C',Icon:Copy},{command:'paste',name:'Вставить',keys:'Ctrl + V',Icon:Clipboard},{command:'select-all',name:'Выделить всё',keys:'Ctrl + A',Icon:TextSelect}] as const).map(({command,name,keys,Icon})=><button key={command} type="button" onClick={()=>edit(command)}><Icon size={19}/><strong>{name}</strong><small>{keys}</small></button>)}</div></>}
        {section==='about'&&<><span className="eyebrow">МАСТЕРСКАЯ МИРОВ</span><h2>Атлас мастера</h2><p className="settings-intro">Локальный инструмент для ваших кампаний.</p><section className="settings-card"><div className="settings-row"><h3>Версия приложения</h3><span className="settings-value">{info?.version??'0.1.1'}</span></div><p>Статьи, персонажи, карты и связи — в одном пространстве. Регистрация и сервер для локальной работы не требуются.</p></section><section className="settings-card"><h3>Закрытие приложения</h3><p>Перед выходом сохраните изменённые материалы. При несохранённых правках приложение попросит подтверждение.</p><Button variant="outline" disabled={busy} onClick={()=>void action('quit')}><LogOut size={16}/>Выйти из приложения</Button></section></>}
        {error&&<p className="settings-error" role="alert">{error}</p>}
      </div>
    </div><div className="settings-bottom"><span>Локальное пространство мастера</span><Button variant="outline" onClick={onClose}>Готово</Button></div>
  </DialogContent></Dialog>;
}
