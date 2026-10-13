'use client';
import { useState } from 'react';
import { ArrowLeft, Check, FileText, Link2, Search, Unlink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { type Entity, materialLabel } from '@/lib/model';
import { categoryMaterials, linkCategories } from '@/lib/board';

export function MaterialBrowser({ entities, value, onChange }: { entities: Entity[]; value: string; onChange: (id: string) => void }) {
  const [category, setCategory] = useState('');
  const [query, setQuery] = useState('');
  const materials = categoryMaterials(entities, category, query);
  return <div className="board-material-browser">
    <Button variant="outline" onClick={() => onChange('')} aria-pressed={!value}><Unlink size={15}/>Без ссылки — свободный блок{!value && <Check size={15}/>}</Button>
    {!category ? <div className="board-link-categories">{linkCategories.map(c => <button key={c.value} onClick={() => { setCategory(c.value); setQuery(''); }}>
      <span>{c.label}</span><small>{categoryMaterials(entities, c.value).length}</small>
    </button>)}</div> : <>
      <button className="plain-button board-category-back" onClick={() => setCategory('')}><ArrowLeft size={16}/>Все категории</button>
      <strong>{linkCategories.find(c => c.value === category)?.label}</strong>
      <div className="search-input"><Search size={16}/><input aria-label="Поиск в выбранной категории" placeholder="Найти по названию…" value={query} onChange={e => setQuery(e.target.value)}/></div>
      <div className="board-link-results" aria-label="Материалы выбранной категории">
        {materials.map(e => <button key={e.id} aria-pressed={value === e.id} className={value === e.id ? 'selected' : ''} onClick={() => onChange(e.id)}>
          {e.payload.cover ? <img src={e.payload.cover} alt=""/> : <FileText size={20}/>}
          <span><strong>{e.title}</strong><small>{materialLabel(e)}{e.campaignId ? ` · ${entities.find(c => c.id === e.campaignId)?.title ?? 'Кампания'}` : ''}</small></span>
          {value === e.id && <Check size={16}/>}
        </button>)}
        {!materials.length && <p className="small-muted">{query ? 'Материал не найден. Попробуйте другое название.' : 'В этой категории пока нет материалов.'}</p>}
      </div>
    </>}
  </div>;
}

export function BoardLinkPicker({ entities, value, onChange }: { entities: Entity[]; value?: string | null; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const linked = entities.find(e => e.id === value);
  return <div className="field board-link-picker"><span>Ссылка</span>
    <div className="board-link-current"><Link2 size={16}/><span>{linked?.title ?? (value ? 'Материал удалён' : 'Без ссылки')}</span>
      {value && <button aria-label="Убрать ссылку" title="Убрать ссылку" onClick={() => onChange('')}><Unlink size={16}/></button>}
    </div>
    <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button variant="outline">{value ? 'Изменить ссылку' : 'Выбрать ссылку'}</Button></DialogTrigger><DialogContent className="board-link-dialog">
      <DialogTitle>Ссылка на материал</DialogTitle><DialogDescription>Выберите категорию, затем нажмите на нужный материал.</DialogDescription>
      <MaterialBrowser key={String(open)} entities={entities} value={value ?? ''} onChange={id => { onChange(id); setOpen(false); }}/>
    </DialogContent></Dialog>
  </div>;
}
