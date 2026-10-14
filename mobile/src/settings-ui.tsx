import React,{useState} from 'react';
import {Modal,Pressable,ScrollView,Text,View} from 'react-native';
import {SafeAreaProvider,SafeAreaView} from 'react-native-safe-area-context';
import {ArrowLeft,LogOut,RefreshCw,ShieldCheck,Smartphone,UserRound} from 'lucide-react-native';
import type {Profile} from './models';
import {NativePermissionsCenter} from './permissions-ui';
import {checkVersionManually} from './update-ui';
import {Action} from './ui';
import {theme as t} from './theme';

export function SettingsScreen({profile,userId,onBack,onLogout}:{
 profile:Profile;userId:string;onBack:()=>void;onLogout:()=>void
}){
 const [permissionsOpen,setPermissionsOpen]=useState(false);
 return <>
  <ScrollView style={{flex:1,backgroundColor:t.bg}}
   contentContainerStyle={{padding:16,paddingBottom:32,gap:14}}>
   <View style={{flexDirection:'row',alignItems:'center',gap:12,marginBottom:3}}>
    <Pressable accessibilityRole="button" accessibilityLabel="Voltar ao perfil"
     onPress={onBack} style={{padding:8,borderRadius:12,backgroundColor:'#FFFFFF',
      borderWidth:1,borderColor:t.line}}>
     <ArrowLeft size={21} color={t.dark}/>
    </Pressable>
    <View style={{flex:1}}>
     <Text style={{fontSize:25,fontWeight:'900',color:t.dark}}>Configurações</Text>
     <Text style={{fontSize:12,color:t.muted,marginTop:2}}>Sua conta, privacidade e aplicativo</Text>
    </View>
   </View>
   <View style={{backgroundColor:'#FFFFFF',borderRadius:20,padding:16,
    borderWidth:1,borderColor:t.line,gap:12}}>
    <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
     <View style={{backgroundColor:t.subtle,padding:11,borderRadius:14}}>
      <UserRound size={22} color={t.primary}/>
     </View>
     <View style={{flex:1}}>
      <Text style={{fontSize:16,fontWeight:'800',color:t.dark}}>Sua conta</Text>
      <Text style={{fontSize:13,color:t.muted,marginTop:3}}>
       {profile.display_name} · @{profile.handle}
      </Text>
     </View>
    </View>
    <Text style={{fontSize:13,lineHeight:19,color:t.muted}}>
     Foto, capa, biografia, temas e música ficam no Perfil. Esta área reúne controles da conta e do aplicativo.
    </Text>
   </View>
   <View style={{backgroundColor:'#FFFFFF',borderRadius:20,padding:16,
    borderWidth:1,borderColor:t.line,gap:10}}>
    <View style={{flexDirection:'row',alignItems:'center',gap:9}}>
     <ShieldCheck size={21} color={t.primary}/>
     <Text style={{fontSize:17,fontWeight:'800',color:t.dark}}>Privacidade e permissões</Text>
    </View>
    <Text style={{fontSize:13,lineHeight:19,color:t.muted}}>
     Consulte permissões de câmera, microfone e notificações, além das informações de privacidade do dispositivo.
    </Text>
    <Action label="Gerenciar permissões e privacidade"
     onPress={()=>setPermissionsOpen(true)}/>
   </View>
   <View style={{backgroundColor:'#FFFFFF',borderRadius:20,padding:16,
    borderWidth:1,borderColor:t.line,gap:10}}>
    <View style={{flexDirection:'row',alignItems:'center',gap:9}}>
     <Smartphone size={21} color={t.primary}/>
     <Text style={{fontSize:17,fontWeight:'800',color:t.dark}}>Aplicativo</Text>
    </View>
    <Text style={{fontSize:13,lineHeight:19,color:t.muted}}>
     Verifique se existe uma versão Alpha mais recente disponível pelo canal oficial do Conecta.
    </Text>
    <Action secondary label="Verificar atualizações"
     leading={<RefreshCw size={16} color={t.primary}/>}
     onPress={()=>void checkVersionManually()}/>
   </View>
   <View style={{backgroundColor:'#FFFFFF',borderRadius:20,padding:16,
    borderWidth:1,borderColor:t.line,gap:10}}>
    <View style={{flexDirection:'row',alignItems:'center',gap:9}}>
     <LogOut size={21} color={t.primary}/>
     <Text style={{fontSize:17,fontWeight:'800',color:t.dark}}>Sessão</Text>
    </View>
    <Text style={{fontSize:13,lineHeight:19,color:t.muted}}>
     Encerre a sessão deste dispositivo. Sua conta e suas publicações não serão excluídas.
    </Text>
    <Action secondary label="Sair deste dispositivo"
     leading={<LogOut size={16} color={t.primary}/>} onPress={onLogout}/>
   </View>
  </ScrollView>
  <Modal visible={permissionsOpen} animationType="slide"
   onRequestClose={()=>setPermissionsOpen(false)}>
   <SafeAreaProvider><SafeAreaView edges={['top','bottom','left','right']}
    style={{flex:1,backgroundColor:t.bg}}>
    <NativePermissionsCenter userId={userId} onClose={()=>setPermissionsOpen(false)}/>
   </SafeAreaView></SafeAreaProvider>
  </Modal>
 </>;
}
