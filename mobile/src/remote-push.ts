import {Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import {SITE_URL,supabase} from './supabase';

const PROJECT_ID=process.env.EXPO_PUBLIC_EAS_PROJECT_ID||'';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN=/^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]{12,180}\]$/;
const key=(userId:string)=>'conecta-remote-push:'+userId;
const lastSync=new Map<string,number>();

export function remotePushConfigured():boolean{return UUID.test(PROJECT_ID);}
export async function remotePushRegistered(userId:string):Promise<boolean>{
 const token=await AsyncStorage.getItem(key(userId));
 return Boolean(token&&TOKEN.test(token));
}

/** Sender identity is always determined by the backend from this JWT, not from a request body. */
async function callDeviceRoute(method:'POST'|'DELETE',token:string,userId:string):Promise<void>{
 const {data:{session}}=await supabase.auth.getSession();
 if(session?.user.id!==userId||!session.access_token)
  throw new Error('Faça login novamente para configurar notificações remotas.');
 const response=await fetch(SITE_URL+'/api/mobile/push/devices',{
  method,
  headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},
  body:JSON.stringify({token,platform:Platform.OS})
 });
 if(!response.ok)throw new Error('Não foi possível sincronizar avisos remotos. Verifique sua conexão.');
}
/** Does not request OS permission; it must have been granted after an explicit user tap. */
export async function registerRemotePush(userId:string):Promise<boolean>{
 if(!remotePushConfigured()||(Platform.OS!=='ios'&&Platform.OS!=='android'))return false;
 const permission=await Notifications.getPermissionsAsync();
 if(!permission.granted&&permission.ios?.status!==Notifications.IosAuthorizationStatus.PROVISIONAL)
  return false;
 if(Date.now()-(lastSync.get(userId)||0)<24*60*60*1000)return true;
 const result=await Notifications.getExpoPushTokenAsync({projectId:PROJECT_ID});
 if(!TOKEN.test(result.data))throw new Error('Não foi possível identificar o canal de notificações.');
 await callDeviceRoute('POST',result.data,userId);
 await AsyncStorage.setItem(key(userId),result.data);
 lastSync.set(userId,Date.now());
 return true;
}
/** Remove the token under the currently authenticated owner before disabling or logging out. */
export async function unregisterRemotePush(userId:string):Promise<void>{
 const token=await AsyncStorage.getItem(key(userId));
 if(token&&TOKEN.test(token))await callDeviceRoute('DELETE',token,userId);
 await AsyncStorage.removeItem(key(userId));
 lastSync.delete(userId);
}
