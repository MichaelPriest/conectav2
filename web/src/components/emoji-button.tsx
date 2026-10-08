'use client';
import {useState} from 'react';
import dynamic from 'next/dynamic';
import {Smile,X} from 'lucide-react';

const EmojiPicker=dynamic(()=>import('emoji-picker-react'),{ssr:false});

export function EmojiButton({onSelect,label='Inserir emoji'}:{onSelect:(emoji:string)=>void;label?:string}){
  const [open,setOpen]=useState(false);
  return <span className="conecta-emoji-wrap">
    <button type="button" aria-expanded={open} aria-label={label} className="conecta-emoji-button" onClick={()=>setOpen(v=>!v)}><Smile size={19}/><span>Emoji</span></button>
    {open&&<div className="conecta-emoji-panel" role="dialog" aria-label="Seletor de emojis">
      <button type="button" aria-label="Fechar emojis" className="conecta-emoji-close" onClick={()=>setOpen(false)}><X size={17}/></button>
      <EmojiPicker height={365} width={320} lazyLoadEmojis onEmojiClick={(item)=>{onSelect(item.emoji);setOpen(false);}}/>
    </div>}
  </span>;
}
