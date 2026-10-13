'use client';
import { ThemeProvider,useTheme } from 'next-themes';
import { useEffect,useState, type ReactNode } from 'react';
import { Sun,Moon } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Toaster } from 'sonner';
export function AtlasTheme({children}:{children:ReactNode}){return <ThemeProvider attribute="data-theme" defaultTheme="dark" enableSystem={false} storageKey="atlas-theme" disableTransitionOnChange>{children}</ThemeProvider>}
export function ThemeSwitch(){const {resolvedTheme,setTheme}=useTheme();const [mounted,setMounted]=useState(false);useEffect(()=>setMounted(true),[]);const light=mounted&&resolvedTheme==='light';return <label className="theme-switch"><span>{light?<Sun size={17}/>:<Moon size={17}/>}Светлая тема</span><Switch aria-label="Светлая тема" checked={light} disabled={!mounted} onCheckedChange={checked=>setTheme(checked?'light':'dark')}/></label>}
export function ThemeToaster(){const {resolvedTheme}=useTheme();return <Toaster theme={resolvedTheme==='light'?'light':'dark'} richColors position="bottom-right"/>}
