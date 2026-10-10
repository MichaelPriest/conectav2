import {useEffect,useRef,useState} from 'react';
import {AppState} from 'react-native';
import {supabase} from './supabase';

type TypingRow={user_id:string;expires_at:string};
/**
 * Privacy: only a boolean typing indicator is sent; never sends draft text.
 * Server RPC enforces conversation membership and its own expiration.
 */
export function useNativeChatTyping(
 conversationId:string|null,userId:string,compose:string
):string[]{
 const [typing,setTyping]=useState<string[]>([]);
 const last=useRef<{id:string|null;sentAt:number;typing:boolean}>({
  id:null,sentAt:0,typing:false
 });
 const write=async(id:string,active:boolean)=>{
  try{await supabase.rpc('set_chat_typing',{_conversation:id,_typing:active});}
  catch{/* Ephemeral typing should never block a message. */}
 };
 useEffect(()=>{
  const prior=last.current;
  const active=Boolean(conversationId&&compose.trim()&&AppState.currentState==='active');
  if(prior.id&&prior.typing&&(!active||prior.id!==conversationId))
   void write(prior.id,false);
  if(!conversationId){
   last.current={id:null,typing:false,sentAt:0};return;
  }
  const now=Date.now();
  if(active&&(prior.id!==conversationId||!prior.typing||now-prior.sentAt>3000))
   void write(conversationId,true);
  last.current={id:conversationId,typing:active,sentAt:active?now:0};
 },[conversationId,compose]);
 useEffect(()=>{
  setTyping([]);
  if(!conversationId)return;
  let alive=true,inFlight=false;
  const refresh=async()=>{
   if(!alive||inFlight||AppState.currentState!=='active')return;
   inFlight=true;
   try{
    const {data,error}=await supabase.from('conversation_typing')
     .select('user_id,expires_at').eq('conversation_id',conversationId);
    if(!alive)return;
    if(error){setTyping([]);return;}
    const now=Date.now();
    setTyping(((data||[]) as TypingRow[]).filter(row=>
     row.user_id!==userId&&Date.parse(row.expires_at)>now)
     .map(row=>row.user_id));
   }catch{if(alive)setTyping([]);}
   finally{inFlight=false;}
  };
  void refresh();
  const timer=setInterval(()=>{void refresh();},3100);
  return()=>{alive=false;clearInterval(timer);setTyping([]);};
 },[conversationId,userId]);
 useEffect(()=>{
  if(!conversationId||!compose.trim())return;
  const timer=setInterval(()=>{
   if(AppState.currentState!=='active')return;
   last.current={id:conversationId,sentAt:Date.now(),typing:true};
   void write(conversationId,true);
  },3500);
  const sub=AppState.addEventListener('change',state=>{
   if(state!=='active'&&last.current.id&&last.current.typing){
    void write(last.current.id,false);
    last.current={id:last.current.id,sentAt:0,typing:false};
   }
  });
  return()=>{clearInterval(timer);sub.remove();};
 },[conversationId,compose.trim().length>0]);
 useEffect(()=>()=>{
  if(last.current.id&&last.current.typing)void write(last.current.id,false);
 },[]);
 return typing;
}
