import React,{useEffect,useState} from 'react';
import {AppState,Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import {supabase} from './supabase';

const CHANNEL='conecta-social';
const prefKey=(userId:string)=>'conecta-native-notifications:'+userId;
const listeners=new Set<(id:string,enabled:boolean)=>void>();
const recent=new Set<string>();

Notifications.setNotificationHandler({
 handleNotification:async()=>({
  shouldShowBanner:true,shouldShowList:true,
  shouldPlaySound:false,shouldSetBadge:false
 })
});
export async function getNativeNotificationPreference(userId:string):Promise<boolean>{
 return (await AsyncStorage.getItem(prefKey(userId)))==='1';
}
export async function notificationPermissionGranted():Promise<boolean>{
 const status=await Notifications.getPermissionsAsync();
 return status.granted||status.ios?.status===Notifications.IosAuthorizationStatus.PROVISIONAL;
}
async function prepareChannel(){
 if(Platform.OS!=='android')return;
 await Notifications.setNotificationChannelAsync(CHANNEL,{
  name:'Avisos do Conecta',description:'Interações e novas mensagens quando o aplicativo está aberto.',
  importance:Notifications.AndroidImportance.DEFAULT,
  vibrationPattern:[0,170],enableVibrate:true,
  sound:null
 });
}
/** This requests OS notification permission only in response to a deliberate tap. */
export async function setNativeNotificationPreference(userId:string,enabled:boolean):Promise<boolean>{
 const {data:{session}}=await supabase.auth.getSession();
 if(session?.user.id!==userId)throw new Error('Entre novamente para configurar notificações.');
 if(enabled){
  await prepareChannel();
  let granted=await notificationPermissionGranted();
  if(!granted){
   const status=await Notifications.requestPermissionsAsync({
    ios:{allowAlert:true,allowBadge:true,allowSound:false}
   });
   granted=status.granted||status.ios?.status===Notifications.IosAuthorizationStatus.PROVISIONAL;
  }
  if(!granted)throw new Error('Autorize as notificações nas configurações do celular.');
 }
 await AsyncStorage.setItem(prefKey(userId),enabled?'1':'0');
 for(const listener of listeners)listener(userId,enabled);
 return enabled;
}
/**
 * Realtime produces LOCAL notifications only when the app is actively open.
 * This is not background push: FCM/APNs credentials and a secured device-token
 * registration/dispatch service are still required.
 */
export function NativeForegroundNotificationBridge({
 userId,onOpenNotifications
}:{userId:string;onOpenNotifications:()=>void}){
 const [enabled,setEnabled]=useState(false);
 useEffect(()=>{
  let live=true;setEnabled(false);
  void getNativeNotificationPreference(userId).then(value=>{
   if(live)setEnabled(value);
  }).catch(()=>{});
  const receive=(id:string,next:boolean)=>{
   if(id===userId&&live)setEnabled(next);
  };
  listeners.add(receive);
  return()=>{live=false;listeners.delete(receive);};
 },[userId]);
 useEffect(()=>{
  const press=Notifications.addNotificationResponseReceivedListener(response=>{
   const kind=response.notification.request.content.data?.kind;
   if(kind==='native-notice')onOpenNotifications();
  });
  return()=>press.remove();
 },[onOpenNotifications]);
 useEffect(()=>{
  if(!enabled)return;
  let live=true;
  const channel=supabase.channel('conecta-native-foreground-'+userId)
   .on('postgres_changes',{
    event:'INSERT',schema:'public',table:'notifications',
    filter:'recipient_id=eq.'+userId
   },async event=>{
    if(!live||AppState.currentState!=='active')return;
    const payload=event.new as {id?:string;recipient_id?:string};
    if(!payload.id||payload.recipient_id!==userId||recent.has(payload.id))return;
    try{
     if(!await notificationPermissionGranted())return;
     recent.add(payload.id);if(recent.size>80)recent.clear();
     await Notifications.scheduleNotificationAsync({
      content:{
       title:'Conecta',body:'Você recebeu uma nova interação.',
       data:{kind:'native-notice'},
       sound:false
      },
      trigger:null
     });
    }catch{/* Foreground visual notice is best-effort; inbox is authoritative. */}
   }).subscribe();
  return()=>{live=false;void supabase.removeChannel(channel);};
 },[userId,enabled]);
 return null;
}
