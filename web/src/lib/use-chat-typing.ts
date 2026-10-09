'use client';
import {useEffect,useRef,useState} from 'react';
import {supabaseBrowser} from '@/lib/supabase/browser';

/**
 * Ephemeral presence, no message content leaves the browser.
 * The Supabase RPC checks chat membership and enforces 7-second TTL.
 * Only active, focused composers refresh; no global polling.
 */
export function useChatTyping(conversationId:string|null,userId:string|undefined,text:string,enabled=true){
 const [typingIds,setTypingIds]=useState<string[]>([]);
 const previous=useRef({conversationId:null as string|null,wasTyping:false,lastSent:0});
 useEffect(()=>{
  setTypingIds([]);
  if(!conversationId||!userId||!enabled)return;
  let alive=true;
  const refresh=async()=>{
   if(!alive||document.hidden)return;
   const {data,error}=await supabaseBrowser().from('conversation_typing')
    .select('user_id,expires_at').eq('conversation_id',conversationId);
   if(!alive)return;
   if(error){setTypingIds([]);return;}
   const now=Date.now();
   setTypingIds((data||[]).filter(r=>r.user_id!==userId&&Date.parse(r.expires_at)>now)
    .map(r=>r.user_id));
  };
  void refresh();
  const timer=window.setInterval(()=>{void refresh();},3100);
  return()=>{alive=false;window.clearInterval(timer);};
 },[conversationId,userId,enabled]);

 useEffect(()=>{
  if(!conversationId||!userId||!enabled){
   const last=previous.current;
   if(last.conversationId&&last.wasTyping){
    void supabaseBrowser().rpc('set_chat_typing',{_conversation:last.conversationId,_typing:false});
   }
   previous.current={conversationId:null,wasTyping:false,lastSent:0};
   return;
  }
  const typing=Boolean(text.trim())&&!document.hidden&&document.hasFocus();
  const old=previous.current;
  const switched=old.conversationId!==conversationId;
  if(switched&&old.wasTyping&&old.conversationId){
   void supabaseBrowser().rpc('set_chat_typing',{_conversation:old.conversationId,_typing:false});
  }
  const now=Date.now();
  if(switched||old.wasTyping!==typing||(typing&&now-old.lastSent>3200)){
   if(typing||old.wasTyping){
    void supabaseBrowser().rpc('set_chat_typing',{_conversation:conversationId,_typing:typing});
   }
   previous.current={conversationId,wasTyping:typing,lastSent:now};
  }
 },[conversationId,userId,text,enabled]);

 useEffect(()=>{
  if(!conversationId||!userId||!enabled||!text.trim())return;
  const timer=window.setInterval(()=>{
   if(document.hidden||!document.hasFocus())return;
   void supabaseBrowser().rpc('set_chat_typing',{_conversation:conversationId,_typing:true});
   previous.current={conversationId,wasTyping:true,lastSent:Date.now()};
  },3500);
  return()=>window.clearInterval(timer);
 },[conversationId,userId,text,enabled]);

 useEffect(()=>()=>{const last=previous.current;
  if(last.conversationId&&last.wasTyping){
   void supabaseBrowser().rpc('set_chat_typing',{_conversation:last.conversationId,_typing:false});
  }
 },[]);
 return typingIds;
}
