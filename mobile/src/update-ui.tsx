import * as Application from 'expo-application';
import {Alert,ActivityIndicator,AppState,Linking,Modal,Platform,Pressable,ScrollView,Text,View} from 'react-native';
import {StatusBar} from 'expo-status-bar';
import {NavigationBar} from 'expo-navigation-bar';
import {SafeAreaProvider,SafeAreaView} from 'react-native-safe-area-context';
import {ArrowDownToLine,CheckCircle2,RefreshCw,ShieldCheck,Smartphone,X} from 'lucide-react-native';
import React,{useCallback,useEffect,useRef,useState} from 'react';
import {chooseAndroidUpdate,chooseIosUpdate,MOBILE_RELEASES_API,APP_STORE_LOOKUP_API} from './version-utils';
import {beginAndroidApkDownload,requestAndroidInstall,openAndroidInstallPermissionSettings} from './apk-installer';
import {formatSize,progressFraction,verifiedInAppDownload} from './apk-installer-policy';
import {theme as t} from './theme';
import type {AvailableUpdate} from './version-utils';
import type {ActiveApkDownload,AndroidDownload} from './apk-installer';

type Phase='idle'|'checking'|'available'|'downloading'|'ready'|'installing'|'current'|'error';
let manualRequest:(()=>void)|null=null;

/**
 * Consults ONLY public tagged GitHub Releases (Android) or the matching App
 * Store entry (iOS). GitHub Actions ZIP artifacts cannot be OTA installation
 * sources; they expire and are not guaranteed to share a signing certificate.
 */
export async function checkForNativeUpdate():Promise<AvailableUpdate|null>{
 if(Platform.OS!=='android'&&Platform.OS!=='ios')return null;
 if(Platform.OS==='android'&&process.env.EXPO_PUBLIC_CONECTA_DISTRIBUTION==='play')
  return null; // Google Play is the only binary-update channel for Store installs.
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
  if(!response.ok)throw new Error('Não foi possível consultar versões do Conecta.');
  const records=await response.json();
  return ios?chooseIosUpdate(records,installed):chooseAndroidUpdate(records,installed);
 }finally{clearTimeout(timeout);}
}

/** Raised by the Profile button; all update UI is controlled at app root. */
export function checkVersionManually():void{
 if(Platform.OS==='android'&&process.env.EXPO_PUBLIC_CONECTA_DISTRIBUTION==='play'){
  void Linking.openURL('https://play.google.com/store/apps/details?id=br.com.conectav2.app')
   .catch(()=>Alert.alert('Google Play indisponível',
    'Não foi possível abrir a página do Conecta na Play Store.'));
  return;
 }
 if(manualRequest)manualRequest();
 else Alert.alert('Verificação indisponível',
  'A interface de atualizações está sendo iniciada. Tente novamente.');
}
export function NativeVersionMonitor(){
 const [phase,setPhase]=useState<Phase>('idle');
 const [visible,setVisible]=useState(false);
 const [update,setUpdate]=useState<AvailableUpdate|null>(null);
 const [progress,setProgress]=useState(0);
 const [downloaded,setDownloaded]=useState<AndroidDownload|null>(null);
 const [error,setError]=useState('');
 const lastChecked=useRef(0),running=useRef(false);
 const notified=useRef<string|null>(null);
 const currentTask=useRef<ActiveApkDownload|null>(null);
 const alive=useRef(true);
 const check=useCallback(async(manual=false)=>{
  if(running.current||currentTask.current)return;
  if(!manual&&Date.now()-lastChecked.current<5*60_000)return;
  running.current=true;lastChecked.current=Date.now();
  if(manual){
   setVisible(true);setPhase('checking');setError('');setProgress(0);
  }
  try{
   const next=await checkForNativeUpdate();
   if(!alive.current)return;
   if(!next){
    if(manual){setUpdate(null);setPhase('current');}
    return;
   }
   if(!manual&&notified.current===next.version)return;
   notified.current=next.version;
   setUpdate(next);setDownloaded(null);setProgress(0);
   setVisible(true);setPhase('available');
  }catch(e){
   if(manual&&alive.current){
    setError(e instanceof Error?e.message:'Não foi possível verificar atualizações.');
    setPhase('error');
   }
  }finally{running.current=false;}
 },[]);
 useEffect(()=>{
  alive.current=true;
  manualRequest=()=>{void check(true);};
  void check(false);
  let previous=AppState.currentState;
  const sub=AppState.addEventListener('change',state=>{
   if(previous!=='active'&&state==='active')void check(false);
   previous=state;
  });
  return()=>{
   alive.current=false;
   sub.remove();
   if(manualRequest)manualRequest=null;
   currentTask.current?.cancel();
  };
 },[check]);
 const close=()=>{
  currentTask.current?.cancel();currentTask.current=null;
  setVisible(false);setPhase('idle');setError('');
  setDownloaded(null);setProgress(0);
 };
 const download=async()=>{
  if(!update||phase==='downloading'||phase==='installing')return;
  if(update.channel==='ios'||!verifiedInAppDownload(update)){
   try{await Linking.openURL(update.url);}catch{
    setError('Não foi possível abrir a publicação oficial do Conecta.');
    setPhase('error');
   }
   return;
  }
  setProgress(0);setError('');setPhase('downloading');
  try{
   const transfer=beginAndroidApkDownload(update,({written,total})=>{
    if(alive.current)setProgress(progressFraction(written,total));
   });
   currentTask.current=transfer;
   const ready=await transfer.promise;
   if(!alive.current||currentTask.current!==transfer)return;
   currentTask.current=null;
   setDownloaded(ready);setProgress(1);setPhase('ready');
  }catch(e){
   if(alive.current&&visible){
    setError(e instanceof Error?e.message:'Falha ao baixar a atualização.');
    setPhase('error');
   }
   currentTask.current=null;
  }
 };
 const install=async()=>{
  if(!downloaded||phase==='installing')return;
  setError('');setPhase('installing');
  try{
   await requestAndroidInstall(downloaded);
   // The package installer can be cancelled by the user. Do not claim
   // successful installation until the OS has restarted the newer app.
   if(alive.current)setPhase('ready');
  }catch(e){
   if(alive.current){
    setError((e instanceof Error?e.message:'Instalador indisponível.')+
     ' Verifique nas configurações se o Android permite instalações desta fonte.');
    setPhase('error');
   }
  }
 };
 const direct=Boolean(update&&verifiedInAppDownload(update));
 const busy=phase==='checking'||phase==='downloading'||phase==='installing';
 const title=phase==='current'?'Você está atualizado':
  phase==='checking'?'Verificando versões':
  phase==='error'?'Atualização indisponível':
  phase==='ready'?'APK verificado':phase==='installing'?'Abrindo o instalador':
  phase==='downloading'?'Baixando atualização':'Nova versão do Conecta';
 const version=Application.nativeApplicationVersion||'desconhecida';
 return <Modal visible={visible} animationType="slide" transparent={false}
  onRequestClose={close}>
  <SafeAreaProvider>
   <SafeAreaView edges={['top','bottom','left','right']}
    style={{flex:1,backgroundColor:'#F9F9FE'}}>
    <StatusBar style="dark" hidden={Platform.OS==='android'}/>
    {Platform.OS==='android'&&<NavigationBar hidden style="light"/>}
    <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',
     borderBottomWidth:1,borderColor:'#E6E6F0',padding:18}}>
     <Text style={{color:t.dark,fontWeight:'900',fontSize:16}}>Atualizações do Conecta</Text>
     <Pressable accessibilityRole="button" accessibilityLabel="Fechar atualizações"
      onPress={close} style={{padding:8}}>
      <X size={23} color={t.dark}/>
     </Pressable>
    </View>
    <ScrollView contentContainerStyle={{padding:23,paddingBottom:50,flexGrow:1}}
     keyboardShouldPersistTaps="handled">
     <View style={{width:65,height:65,borderRadius:20,backgroundColor:'#EEE7FF',
      justifyContent:'center',alignItems:'center',marginBottom:18}}>
      {phase==='current'||phase==='ready'?<CheckCircle2 size={32} color={t.primary}/>:
       phase==='available'||phase==='downloading'?<ArrowDownToLine size={32} color={t.primary}/>:
       <RefreshCw size={32} color={t.primary}/>}
     </View>
     <Text style={{fontSize:25,fontWeight:'900',color:t.dark,marginBottom:9}}>{title}</Text>
     <Text style={{color:t.muted,fontSize:14,lineHeight:21,marginBottom:16}}>
      Versão instalada: {version}
      {update?'\nNova versão: '+update.version:''}
     </Text>
     {phase==='checking'&&<ActivityIndicator size="large" color={t.primary}/>}
     {phase==='current'&&<Text style={{color:t.dark,lineHeight:23}}>
      Não há versão mais recente publicada no canal oficial.
     </Text>}
     {update&&['available','downloading','ready','installing'].includes(phase)&&<>
      <View style={{backgroundColor:'#FFFFFF',borderRadius:16,padding:16,
       borderWidth:1,borderColor:'#E6E6F0',marginBottom:17}}>
       <Text style={{fontSize:15,fontWeight:'900',color:t.dark,marginBottom:7}}>
        O que mudou
       </Text>
       <Text style={{fontSize:13,lineHeight:21,color:t.dark}}>{update.notes}</Text>
       {update.size&&<Text style={{fontSize:12,color:t.muted,marginTop:10}}>
        APK Android · {formatSize(update.size)}
       </Text>}
      </View>
      {phase==='downloading'&&<>
       <View style={{backgroundColor:'#E6DFF5',height:10,borderRadius:6,overflow:'hidden'}}>
        <View style={{width:`${Math.round(progress*100)}%` as `${number}%`,
         height:'100%',backgroundColor:t.primary,borderRadius:6}}/>
       </View>
       <Text style={{color:t.muted,marginTop:8,fontSize:13}}>
        {Math.round(progress*100)}% transferido
       </Text>
      </>}
      {phase==='ready'&&<View style={{flexDirection:'row',alignItems:'center',gap:9,
       backgroundColor:'#F0ECFF',borderRadius:12,padding:13,marginBottom:13}}>
       <ShieldCheck size={20} color={t.primary}/>
       <Text style={{flex:1,color:t.dark,fontSize:13,lineHeight:19}}>
        Download concluído. Tamanho e SHA-256 conferidos.
        O Android verificará a assinatura e solicitará sua confirmação.
       </Text>
      </View>}
      {phase==='available'&&!direct&&update.channel==='android'&&
       <Text style={{fontSize:13,color:t.dark,lineHeight:20,marginBottom:12}}>
        Esta publicação ainda não possui SHA-256 verificável.
        Por segurança, o download será aberto no GitHub.
       </Text>}
      {phase==='available'&&<Pressable accessibilityRole="button"
       accessibilityLabel={direct?'Baixar APK dentro do Conecta':'Abrir versão oficial'}
       onPress={()=>void download()}
       style={{backgroundColor:t.primary,borderRadius:14,padding:16,alignItems:'center'}}>
       <Text style={{fontSize:15,fontWeight:'900',color:'#FFF'}}>
        {direct?'Baixar atualização no aplicativo':
         update.channel==='ios'?'Abrir App Store':'Abrir no GitHub'}
       </Text>
      </Pressable>}
      {phase==='ready'&&<Pressable accessibilityRole="button"
       accessibilityLabel="Solicitar instalação da nova versão"
       onPress={()=>void install()}
       style={{backgroundColor:t.primary,borderRadius:14,padding:16,alignItems:'center'}}>
       <Text style={{fontSize:15,fontWeight:'900',color:'#FFF'}}>Instalar com o Android</Text>
      </Pressable>}
      {phase==='installing'&&<ActivityIndicator color={t.primary} size="large"/>}
     </>}
     {phase==='error'&&<>
      <Text style={{color:t.danger,fontSize:13,lineHeight:21,marginBottom:16}}>{error}</Text>
      {downloaded&&Platform.OS==='android'&&<>
       <Pressable accessibilityRole="button" accessibilityLabel="Abrir permissões de instalação no Android"
        onPress={()=>void openAndroidInstallPermissionSettings().catch(e=>
         setError(e instanceof Error?e.message:'As configurações não puderam ser abertas.'))}
        style={{borderWidth:1,borderColor:t.primary,borderRadius:14,
         padding:14,alignItems:'center',marginBottom:10}}>
        <Text style={{color:t.primary,fontWeight:'800'}}>Permitir instalação pelo Conecta</Text>
       </Pressable>
       <Pressable accessibilityRole="button" accessibilityLabel="Solicitar instalação novamente"
        onPress={()=>void install()}
        style={{backgroundColor:t.primary,borderRadius:14,padding:15,
         alignItems:'center',marginBottom:10}}>
        <Text style={{color:'#FFF',fontWeight:'800'}}>Tentar instalar novamente</Text>
       </Pressable>
      </>}
      <Pressable accessibilityRole="button" accessibilityLabel="Verificar novamente"
       onPress={()=>void check(true)}
       style={{backgroundColor:downloaded?'#EEE7FF':t.primary,
        borderRadius:14,padding:15,alignItems:'center'}}>
       <Text style={{color:downloaded?t.primary:'#FFF',fontWeight:'800'}}>Verificar versões</Text>
      </Pressable>
     </>}
     <View style={{marginTop:25,flexDirection:'row',alignItems:'flex-start',gap:9}}>
      <Smartphone size={18} color={t.muted}/>
      <Text style={{flex:1,color:t.muted,fontSize:12,lineHeight:19}}>
       O Conecta nunca instala APKs silenciosamente. Para atualizar sem
       perder os dados locais, a nova versão precisa ter a mesma assinatura
       Android. Não desinstale a versão atual sem salvar os rascunhos.
      </Text>
     </View>
     {!busy&&<Pressable accessibilityRole="button" onPress={close}
      style={{padding:17,alignItems:'center',marginTop:16}}>
      <Text style={{fontSize:14,fontWeight:'800',color:t.primary}}>Agora não</Text>
     </Pressable>}
    </ScrollView>
   </SafeAreaView>
  </SafeAreaProvider>
 </Modal>;
}
