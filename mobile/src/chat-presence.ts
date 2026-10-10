import {useCallback,useEffect,useState} from 'react';
import {AppState} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {supabase} from './supabase';

const ONLINE_WINDOW=90_000;
const POLL_INTERVAL=25_000;
const storageKey=(userId:string)=>'conecta-mobile-online-visible:'+userId;

/** Presence is opt-in; the database's RLS decides which peers can see it. */
export function useNativeChatPresence(userId:string){
 const [enabled,setEnabled]=useState(false);
 const [ready,setReady]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [onlineIds,setOnlineIds]=useState<Set<string>>(new Set());

 useEffect(()=>{
  let alive=true;
  setReady(false);setEnabled(false);setOnlineIds(new Set());
  void AsyncStorage.getItem(storageKey(userId)).then(value=>{
   if(alive)setEnabled(value==='1');
  }).catch(()=>{}).finally(()=>{if(alive)setReady(true);});
  return()=>{alive=false;};
 },[userId]);
 useEffect(()=>{
  if(!ready)return;
  let alive=true,inFlight=false;
  const refresh=async()=>{
   if(!alive||inFlight||AppState.currentState!=='active')return;
   inFlight=true;
   try{
    if(enabled){
     const {error:touchError}=await supabase.rpc('touch_chat_presence');
     if(touchError)throw touchError;
    }
    const cutoff=new Date(Date.now()-ONLINE_WINDOW).toISOString();
    const {data,error:readError}=await supabase.from('chat_user_presence')
     .select('user_id,last_seen_at').gte('last_seen_at',cutoff).limit(400);
    if(readError)throw readError;
    if(alive){
     const now=Date.now();
     setOnlineIds(new Set((data||[]).filter(row=>row.user_id!==userId&&
      Date.parse(row.last_seen_at)>now-ONLINE_WINDOW).map(row=>row.user_id)));
     setError('');
    }
   }catch{
    if(alive){setOnlineIds(new Set());setError('Presença temporariamente indisponível.');}
   }finally{inFlight=false;}
  };
  void refresh();
  const timer=setInterval(()=>{void refresh();},POLL_INTERVAL);
  const sub=AppState.addEventListener('change',state=>{
   if(state==='active')void refresh();
  });
  return()=>{alive=false;clearInterval(timer);sub.remove();};
 },[userId,ready,enabled]);
 const toggle=useCallback(async()=>{
  if(!ready||busy)return;
  setBusy(true);setError('');
  const next=!enabled;
  try{
   if(next){
    const {error}=await supabase.rpc('touch_chat_presence');
    if(error)throw error;
   }else{
    const {error}=await supabase.from('chat_user_presence').delete().eq('user_id',userId);
    if(error)throw error;
   }
   await AsyncStorage.setItem(storageKey(userId),next?'1':'0');
   setEnabled(next);
  }catch{
   setError('Não foi possível alterar sua presença.');
  }finally{setBusy(false);}
 },[ready,busy,enabled,userId]);
 return {ready,enabled,busy,error,onlineIds,toggle};
}
