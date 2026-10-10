import * as Application from 'expo-application';
import {Alert,AppState,Linking,Platform} from 'react-native';
import React,{useEffect,useRef} from 'react';
import {chooseAndroidUpdate,MOBILE_RELEASES_API} from './version-utils';
import type {AvailableUpdate} from './version-utils';

/**
 * This checks published APK releases, NOT expiring GitHub Actions artifacts.
 * A platform-confirmed user action is always required to install a new binary.
 */
export async function checkForNativeUpdate():Promise<AvailableUpdate|null>{
 if(Platform.OS!=='android')return null;
 const installed=Application.nativeApplicationVersion;
 if(!installed)return null;
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),8500);
 try{
  const response=await fetch(MOBILE_RELEASES_API,{
   method:'GET',headers:{Accept:'application/vnd.github+json'},
   signal:controller.signal
  });
  if(!response.ok)throw new Error('Não foi possível consultar o canal de versões.');
  return chooseAndroidUpdate(await response.json(),installed);
 }finally{clearTimeout(timeout);}
}

export async function offerNativeUpdate(update:AvailableUpdate):Promise<void>{
 Alert.alert('Nova versão do Conecta','A versão '+update.version+
  ' está disponível. Sua instalação será confirmada pelo Android.',[
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
 useEffect(()=>{
  if(Platform.OS!=='android')return;
  let alive=true;
  const inspect=async()=>{
   if(running.current)return;
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
 if(Platform.OS!=='android'){
  Alert.alert('Atualizações no iPhone',
   'As futuras versões iOS seguirão a App Store ou TestFlight. A distribuição iOS ainda está em preparação.');
  return;
 }
 try{
  const update=await checkForNativeUpdate();
  if(update)await offerNativeUpdate(update);
  else Alert.alert('Conecta atualizado','Nenhuma versão Android mais nova está publicada no canal oficial.');
 }catch{
  Alert.alert('Verificação indisponível',
   'Não foi possível consultar novas versões agora. Verifique sua conexão e tente novamente.');
 }
}
