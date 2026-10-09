'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {AtSign} from 'lucide-react';
import {supabaseBrowser} from '@/lib/supabase/browser';

type Person={id:string;handle:string;display_name:string};
type Props={
 value:string;onChange:(value:string)=>void;placeholder?:string;rows?:number;
 maxLength?:number;required?:boolean;disabled?:boolean;className?:string;
 as?:'input'|'textarea';label?:string;
};
function currentMention(text:string,position:number){
 const before=text.slice(0,position);
 const match=before.match(/(^|\s)@([a-z0-9_]{1,30})$/i);
 return match?{start:before.length-match[2].length-1,query:match[2].toLowerCase()}:null;
}
export function MentionInput({value,onChange,placeholder,rows=3,maxLength=3000,required=false,disabled=false,className='',as='textarea',label}:Props){
 const ref=useRef<HTMLInputElement|HTMLTextAreaElement|null>(null);
 const [cursor,setCursor]=useState(0),[matches,setMatches]=useState<Person[]>([]);
 const [active,setActive]=useState(0);
 const mention=currentMention(value,cursor);
 const query=mention?.query||'';
 useEffect(()=>{
   let alive=true;
   if(!mention||query.length<2){setMatches([]);return()=>{alive=false;};}
   const timer=window.setTimeout(async()=>{
     const db=supabaseBrowser();
     const {data,error}=await db.from('profiles').select('id,handle,display_name')
       .ilike('handle',query.replace(/[%\\]/g,'')+'%').limit(6);
     if(alive)setMatches(error?[]:(data||[]));
   },200);
   return()=>{alive=false;window.clearTimeout(timer);};
 },[query,Boolean(mention)]);
 function choose(person:Person){
   const position=ref.current?.selectionStart??cursor;
   const found=currentMention(value,position);
   if(!found)return;
   const replacement='@'+person.handle+' ';
   const next=value.slice(0,found.start)+replacement+value.slice(position);
   onChange(next.slice(0,maxLength));
   setMatches([]);setActive(0);
   const nextCaret=found.start+replacement.length;
   requestAnimationFrame(()=>{ref.current?.focus();ref.current?.setSelectionRange(nextCaret,nextCaret);setCursor(nextCaret);});
 }
 const props={
   value,placeholder,maxLength,required,disabled,className,
   'aria-label':label||placeholder||'Texto com marcações',
   onChange:(e:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>)=>{onChange(e.target.value);setCursor(e.target.selectionStart??e.target.value.length);setActive(0);},
   onClick:(e:React.MouseEvent<HTMLInputElement|HTMLTextAreaElement>)=>setCursor(e.currentTarget.selectionStart??0),
   onKeyUp:(e:React.KeyboardEvent<HTMLInputElement|HTMLTextAreaElement>)=>setCursor(e.currentTarget.selectionStart??0),
   onKeyDown:(e:React.KeyboardEvent<HTMLInputElement|HTMLTextAreaElement>)=>{
     if(!matches.length||!currentMention(value,e.currentTarget.selectionStart??0))return;
     if(e.key==='ArrowDown'){e.preventDefault();setActive(i=>(i+1)%matches.length);}
     if(e.key==='ArrowUp'){e.preventDefault();setActive(i=>(i-1+matches.length)%matches.length);}
     if(e.key==='Enter'&&as==='textarea' || e.key==='Tab'&&matches.length){
       e.preventDefault();choose(matches[active]||matches[0]);
     }
     if(e.key==='Escape')setMatches([]);
   }
 };
 return <div className="conecta-mention-wrap">
   {as==='input'?<input {...props} ref={r=>{ref.current=r;}}/>:<textarea {...props} rows={rows} ref={r=>{ref.current=r;}}/>}
   {matches.length>0&&mention&&<div className="conecta-mention-suggestions" role="listbox" aria-label="Sugestões de usuários">
     <div className="conecta-mention-hint"><AtSign size={13}/> Marcar usuário</div>
     {matches.map((person,i)=><button key={person.id} type="button" role="option"
       aria-selected={i===active} className={i===active?'selected':''}
       onMouseDown={e=>e.preventDefault()} onClick={()=>choose(person)}>
       <strong>@{person.handle}</strong><span>{person.display_name}</span>
     </button>)}
   </div>}
 </div>;
}

export function MentionText({text}:{text:string}){
 const parts=text.split(/(@[a-z0-9_]{3,30})/gi);
 return <>{parts.map((part,i)=>/^@[a-z0-9_]{3,30}$/i.test(part)
   ?<Link key={i} className="conecta-mention-link" href={'/p/'+part.slice(1).toLowerCase()}>{part}</Link>
   :<span key={i}>{part}</span>)}</>;
}
