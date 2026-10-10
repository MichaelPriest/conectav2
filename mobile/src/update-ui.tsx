import * as Application from 'expo-application';
import {Alert,AppState,Linking,Platform} from 'react-native';
import React,{useEffect,useRef} from 'react';
import {chooseAndroidUpdate,chooseIosUpdate,MOBILE_RELEASES_API,APP_STORE_LOOKUP_API} from './version-utils';
import type {AvailableUpdate} from './version-utils';

/**
 * This checks published APK releases, NOT expiring GitHub Actions artifacts.
 * A platform-confirmed user action is always required to install a new binary.
 */
export async function checkForNativeUpdate():Promise<AvailableUpdate|null>{
 if(Platform.OS!=='android'&&Platform.OS!=='ios')return null;
 const installed=Application.nativeApplicationVersion;
 if(!installed)return null;
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),8500);
 try{
  const ios=Platform.OS==='ios';
  const response=await fetch(ios?APP_STORE_LOOKUP_API:MOBILE_RELEASES_API,{
   method:'GET',headers:{Accept:ios?'application/json':'application/vnd.github+json'},
   signal:controller.signal
  });
  if(!response.ok)throw new Error('Não foi possível consultar o canal de versões.');
  const records=await response.json();
  return ios?chooseIosUpdate(records,installed):chooseAndroidUpdate(records,installed);
 }finally{clearTimeout(timeout);}
}

export async function offerNativeUpdate(update:AvailableUpdate):Promise<void>{
 Alert.alert('Nova versão do Conecta','A versão '+update.version+
  (Platform.OS==='ios'?' está disponível na App Store.':
   ' está disponível. Sua instalação será confirmada pelo Android.'),[
  {text:'Agora não',style:'cancel'},
  {text:'Atualizar',onPress:()=>{
   void Linking.openURL(update.url).catch(()=>Alert.alert(
    'Não foi possível abrir o download','Verifique sua conexão e tente novamente.'
   ));
  }}
 ]);
}
/** Runs on cold launch and again when returning from Android's background. */
export function NativeVersionMonitor(){
 const notified=useRef<string|null>(null);
 const running=useRef(false);
 const lastChecked=useRef(0);
 useEffect(()=>{
  if(Platform.OS!=='android'&&Platform.OS!=='ios')return;
  let alive=true;
  const inspect=async()=>{
   // Image picker, call UI, and permission dialogs can trigger frequent
   // foreground events. Do not exhaust GitHub's unauthenticated API quota.
   if(running.current||Date.now()-lastChecked.current<5*60_000)return;
   lastChecked.current=Date.now();
   running.current=true;
   try{
    const update=await checkForNativeUpdate();
    if(!alive||!update||notified.current===update.version)return;
    notified.current=update.version;
    await offerNativeUpdate(update);
   }catch{/* Offline, GitHub unavailable, or no public APK: never block access. */}
   finally{running.current=false;}
  };
  void inspect();
  let previous=AppState.currentState;
  const sub=AppState.addEventListener('change',state=>{
   if(previous!=='active'&&state==='active')void inspect();
   previous=state;
  });
  return()=>{alive=false;sub.remove();};
 },[]);
 return null;
}

/** Available in Profile > Check for updates; user-initiated errors are visible. */
export async function checkVersionManually():Promise<void>{
 try{
  const update=await checkForNativeUpdate();
  if(update)await offerNativeUpdate(update);
  else Alert.alert('Nenhuma atualização encontrada',
   Platform.OS==='ios'
    ?'Não há versão mais recente do Conecta na App Store. As versões TestFlight seguem seu próprio canal.'
    :'Nenhuma versão Android mais nova está publicada no canal oficial do Conecta.');
 }catch{
  Alert.alert('Verificação indisponível',
   'Não foi possível consultar novas versões agora. Verifique sua conexão e tente novamente.');
 }
}
