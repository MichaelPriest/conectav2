import React,{useCallback,useEffect,useState} from 'react';
import {Linking,Platform,Pressable,ScrollView,Text,View} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {getRecordingPermissionsAsync,requestRecordingPermissionsAsync} from 'expo-audio';
import {Camera,Check,ImagePlus,Mic,ShieldCheck,BellRing,Settings,AlertCircle,X} from 'lucide-react-native';
import {Action,ErrorNotice,Loading,styles as s} from './ui';
import {theme as t} from './theme';
import {
 getNativeNotificationPreference,notificationPermissionGranted,setNativeNotificationPreference
} from './native-notifications';
import {remotePushConfigured,remotePushRegistered} from './remote-push';
type State='granted'|'denied'|'undetermined';
const statusLabel=(value:State)=>value==='granted'?'Permitido':
 value==='denied'?'Bloqueado':'Não solicitado';
const description=(value:State)=>value==='granted'?'Acesso concedido pelo sistema.':
 value==='denied'?'Alteração necessária nas configurações do celular.':
 'Permissão solicitada somente quando você escolher utilizar o recurso.';
export function NativePermissionsCenter({userId,onClose}:{
 userId:string;onClose:()=>void
}){
 const [camera,setCamera]=useState<State>('undetermined');
 const [microphone,setMicrophone]=useState<State>('undetermined');
 const [notifications,setNotifications]=useState<State>('undetermined');
 const [notifyEnabled,setNotifyEnabled]=useState(false);
 const [pushRegistered,setPushRegistered]=useState(false);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const refresh=useCallback(async()=>{
  try{
   const [cam,mic,notice,pref]=await Promise.all([
    ImagePicker.getCameraPermissionsAsync(),getRecordingPermissionsAsync(),
    notificationPermissionGranted(),getNativeNotificationPreference(userId)
   ]);
   setCamera(cam.granted?'granted':cam.canAskAgain?'undetermined':'denied');
   setMicrophone(mic.granted?'granted':mic.canAskAgain?'undetermined':'denied');
   setNotifications(notice?'granted':'undetermined');
   setNotifyEnabled(pref&&notice);
   setPushRegistered(pref&&notice&&await remotePushRegistered(userId));
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível consultar permissões.');}
  finally{setLoading(false);}
 },[userId]);
 useEffect(()=>{void refresh();},[refresh]);
 const permission=async(kind:'camera'|'microphone')=>{
  if(busy)return;
  setBusy(true);setError('');
  try{
   const result=kind==='camera'?
    await ImagePicker.requestCameraPermissionsAsync():
    await requestRecordingPermissionsAsync();
   if(!result.granted)throw new Error(
    'Permissão não concedida. Você pode ajustá-la nas configurações do dispositivo.');
   await refresh();
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível solicitar a permissão.');}
  finally{setBusy(false);}
 };
 const changeNotice=async()=>{
  if(busy)return;
  setBusy(true);setError('');
  try{await setNativeNotificationPreference(userId,!notifyEnabled);await refresh();}
  catch(e){setError(e instanceof Error?e.message:'Não foi possível alterar notificações.');}
  finally{setBusy(false);}
 };
 const panel=(Icon:typeof Camera,title:string,detail:string,state:State,
  onRequest?:()=>void,accessibility?:string)=>{
  return <View style={s.card}>
   <View style={[s.row,{gap:10}]}>
    <View style={{backgroundColor:t.subtle,padding:11,borderRadius:13}}>
     <Icon size={22} color={t.primary}/>
    </View>
    <View style={{flex:1}}>
     <Text style={s.primaryText}>{title}</Text>
     <Text style={s.muted}>{detail}</Text>
    </View>
   </View>
   <View style={[s.row,{gap:7,marginTop:11,justifyContent:'space-between'}]}>
    <Text style={{fontWeight:'800',fontSize:12,
     color:state==='granted'?t.success:state==='denied'?t.danger:t.muted}}>
     {statusLabel(state)}
    </Text>
    {!!onRequest&&state!=='granted'&&<Action secondary disabled={busy}
     label={state==='denied'?'Abrir ajustes':'Autorizar'}
     onPress={state==='denied'?()=>void Linking.openSettings():onRequest}/>}
   </View>
   <Text style={[s.muted,{marginTop:5}]}>{description(state)}</Text>
  </View>;
 };
 return <ScrollView style={s.screen} contentContainerStyle={{paddingBottom:48}}>
  <View style={[s.row,{gap:11,marginTop:19,marginBottom:14}]}>
   <ShieldCheck size={27} color={t.primary}/>
   <View style={{flex:1}}>
    <Text style={{fontSize:22,fontWeight:'900',color:t.dark}}>Permissões e privacidade</Text>
    <Text style={s.muted}>Você decide quando compartilhar dados com o Conecta.</Text>
   </View>
   <Pressable accessibilityRole="button" accessibilityLabel="Fechar permissões"
    onPress={onClose}><X color={t.dark} size={23}/></Pressable>
  </View>
  {loading?<Loading/>:<>
   {panel(Camera,'Câmera','Fotografar ao criar uma publicação ou Story.',camera,
    ()=>void permission('camera'))}
   {panel(Mic,'Microfone','Gravar mensagens de voz enquanto o chat estiver aberto.',
    microphone,()=>void permission('microphone'))}
   <View style={s.card}>
    <View style={[s.row,{gap:10}]}>
     <View style={{backgroundColor:t.subtle,padding:11,borderRadius:13}}>
      <ImagePlus size={22} color={t.primary}/>
     </View>
     <View style={{flex:1}}>
      <Text style={s.primaryText}>Fotos e vídeos</Text>
      <Text style={s.muted}>O seletor do sistema permite escolher mídias específicas.</Text>
     </View>
    </View>
    <Text style={[s.muted,{marginTop:10}]}>
     Não pedimos acesso à galeria inteira ao abrir o aplicativo.
    </Text>
   </View>
   <View style={s.card}>
    <View style={[s.row,{gap:11}]}>
     <BellRing size={23} color={t.primary}/>
     <View style={{flex:1}}>
      <Text style={s.primaryText}>Avisos no sistema</Text>
      <Text style={s.muted}>Por enquanto, mostra interações recebidas com o app aberto.</Text>
      <Text style={{fontSize:11,fontWeight:'800',color:notifications==='granted'?t.success:t.muted}}>
       Permissão do sistema: {notifications==='granted'?'Autorizada':'Não autorizada'}
      </Text>
     </View>
    </View>
    <View style={[s.row,{gap:9,marginTop:13,justifyContent:'space-between'}]}>
     <Text style={{fontSize:12,color:notifyEnabled?t.success:t.muted,fontWeight:'800'}}>
      {notifyEnabled?'Avisos ativados':'Avisos desativados'}
     </Text>
     <Action disabled={busy} secondary={notifyEnabled}
      label={notifyEnabled?'Desativar':'Ativar'}
      onPress={()=>void changeNotice()}/>
    </View>
    <Text style={[s.muted,{marginTop:9}]}>
     {remotePushConfigured()?
      pushRegistered?'Dispositivo registrado para push. A entrega em segundo plano depende das credenciais FCM/APNs e do serviço Expo.':
       'Avisos locais disponíveis. O registro para push ainda não foi concluído; confira a configuração do serviço e a conexão.':
      'Avisos com o app fechado exigem associar o projeto Expo/EAS e configurar FCM/APNs. Os avisos locais seguem disponíveis.'}
    </Text>
   </View>
   <View style={s.card}>
    <Text style={[s.primaryText,{marginBottom:9}]}>Permissões que não solicitamos</Text>
    <Text style={[s.muted,{lineHeight:21}]}>
     Localização precisa, contatos, SMS, histórico de chamadas, acessibilidade do
     aparelho e acesso a todos os arquivos não são necessários para usar o Conecta.
     Chamadas de áudio e vídeo só pedirão câmera/microfone quando forem implementadas.
    </Text>
   </View>
   <ErrorNotice text={error}/>
   <View style={{marginTop:10}}>
    <Action secondary fullWidth label="Configurações do dispositivo"
     leading={<Settings size={16} color={t.primary}/>}
     onPress={()=>void Linking.openSettings()}/>
   </View>
  </>}
 </ScrollView>;
}
