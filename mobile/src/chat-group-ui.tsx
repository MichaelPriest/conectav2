import React,{useCallback,useEffect,useState} from 'react';
import {Alert,Pressable,ScrollView,Text,TextInput,View} from 'react-native';
import {BellOff,Check,ChevronRight,LogOut,Plus,Settings2,ShieldCheck,UserPlus,UsersRound,X} from 'lucide-react-native';
import {Action,Avatar,ErrorNotice,Loading,styles as s} from './ui';
import {theme as t} from './theme';
import type {Profile} from './models';
import {
 acceptedChatFriends,createNativeGroup,getGroupDetails,groupRights,
 inviteGroupFriend,leaveNativeGroup,removeNativeGroupMember,
 renameNativeGroup,setNativeGroupModerator,setNativeGroupPermissions
} from './chat-groups';
import type {GroupDetails} from './chat-groups';

const message=(e:unknown)=>e instanceof Error?e.message:'Não foi possível concluir a operação.';
const section={fontSize:15,fontWeight:'900' as const,color:t.dark};

export function NativeGroupCreator({userId,onCreated,onClose}:{
 userId:string;onCreated:(id:string)=>void;onClose:()=>void;
}){
 const [friends,setFriends]=useState<Profile[]>([]);
 const [selected,setSelected]=useState<string[]>([]);
 const [title,setTitle]=useState('');
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 useEffect(()=>{
  let alive=true;
  void acceptedChatFriends(userId).then(rows=>{if(alive)setFriends(rows);})
   .catch(e=>{if(alive)setError(message(e));})
   .finally(()=>{if(alive)setLoading(false);});
  return()=>{alive=false;};
 },[userId]);
 const submit=async()=>{
  if(busy)return;
  setBusy(true);setError('');
  try{const id=await createNativeGroup(userId,title,selected);onCreated(id);}
  catch(e){setError(message(e));}
  finally{setBusy(false);}
 };
 return <ScrollView keyboardShouldPersistTaps="handled"
  contentContainerStyle={{padding:18,paddingBottom:42,gap:12}}>
  <View style={[s.row,{gap:10,justifyContent:'space-between'}]}>
   <View style={{flex:1}}>
    <Text style={{fontSize:21,fontWeight:'900',color:t.dark}}>Criar grupo</Text>
    <Text style={s.muted}>Reúna suas amizades em uma conversa.</Text>
   </View>
   <Pressable accessibilityRole="button" accessibilityLabel="Cancelar criação do grupo"
    disabled={busy} onPress={onClose}><X size={23} color={t.dark}/></Pressable>
  </View>
  <Text style={section}>Nome do grupo</Text>
  <TextInput value={title} onChangeText={setTitle} placeholder="Ex.: Amigos da música"
   placeholderTextColor={t.muted} maxLength={80} accessibilityLabel="Nome do grupo"
   style={s.input}/>
  <Text style={section}>Selecione ao menos duas amizades</Text>
  <Text style={s.muted}>{selected.length} pessoa(s) selecionada(s)</Text>
  {loading?<Loading text="Buscando amizades..."/>:
   friends.length===0?<View style={s.empty}>
    <Text style={s.primaryText}>Nenhuma amizade disponível</Text>
    <Text style={s.muted}>Aceite conexões para criar uma conversa em grupo.</Text>
   </View>:
   friends.map(person=>{
    const checked=selected.includes(person.id);
    return <Pressable key={person.id} accessibilityRole="checkbox"
     accessibilityLabel={'Adicionar '+person.display_name}
     accessibilityState={{checked}} onPress={()=>setSelected(old=>checked?
      old.filter(id=>id!==person.id):[...old,person.id])}
     style={[s.card,{flexDirection:'row',alignItems:'center',gap:11,marginVertical:2}]}>
     <Avatar path={person.avatar_path} name={person.display_name} size={41}/>
     <View style={{flex:1}}>
      <Text style={s.primaryText}>{person.display_name}</Text>
      <Text style={s.muted}>@{person.handle}</Text>
     </View>
     <View style={{width:23,height:23,borderRadius:7,borderWidth:2,
      borderColor:checked?t.primary:t.line,backgroundColor:checked?t.primary:'#FFFFFF',
      alignItems:'center',justifyContent:'center'}}>
      {checked&&<Check size={16} color="#FFF"/>}
     </View>
    </Pressable>;
   })}
  <ErrorNotice text={error}/>
  <Action fullWidth disabled={busy||loading||title.trim().length<2||selected.length<2}
   label={busy?'Criando...':'Criar conversa em grupo'}
   leading={<UsersRound size={18} color="#FFF"/>} onPress={()=>void submit()}/>
 </ScrollView>;
}

export function NativeGroupSettings({conversationId,userId,onClose,onLeft,onUpdated}:{
 conversationId:string;userId:string;onClose:()=>void;
 onLeft:()=>void;onUpdated:()=>void;
}){
 const [details,setDetails]=useState<GroupDetails|null>(null);
 const [friends,setFriends]=useState<Profile[]>([]);
 const [title,setTitle]=useState('');
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const refresh=useCallback(async()=>{
  const [group,contacts]=await Promise.all([
   getGroupDetails(conversationId,userId),acceptedChatFriends(userId)
  ]);
  setDetails(group);setFriends(contacts);setTitle(group.title);
 },[conversationId,userId]);
 useEffect(()=>{
  let alive=true;
  setDetails(null);setLoading(true);
  void refresh().catch(e=>{if(alive)setError(message(e));})
   .finally(()=>{if(alive)setLoading(false);});
  return()=>{alive=false;};
 },[refresh]);
 const perform=async(action:()=>Promise<void>,leave=false)=>{
  if(busy)return;
  setBusy(true);setError('');
  try{
   await action();
   if(leave){onLeft();return;}
   await refresh();onUpdated();
  }catch(e){setError(message(e));}
  finally{setBusy(false);}
 };
 if(loading)return <View style={{padding:24}}><Loading text="Carregando configurações do grupo..."/></View>;
 if(!details)return <View style={{padding:18}}>
  <ErrorNotice text={error||'Não foi possível consultar este grupo.'}/>
  <Action secondary label="Voltar" onPress={onClose}/>
 </View>;
 const rights=groupRights(details,userId);
 const available=friends.filter(p=>!details.members.some(m=>m.id===p.id));
 const askRemove=(person:Profile)=>Alert.alert(
  'Remover do grupo?',person.display_name+' perderá acesso às novas mensagens.',[
   {text:'Cancelar',style:'cancel'},
   {text:'Remover',style:'destructive',onPress:()=>void perform(()=>
    removeNativeGroupMember(conversationId,person.id))}
  ]);
 return <ScrollView keyboardShouldPersistTaps="handled"
  contentContainerStyle={{padding:18,paddingBottom:42,gap:10}}>
  <View style={[s.row,{justifyContent:'space-between',marginBottom:7}]}>
   <View style={{flex:1}}>
    <Text style={{fontSize:21,fontWeight:'900',color:t.dark}}>Administrar grupo</Text>
    <Text style={s.muted}>{details.members.length} participantes</Text>
   </View>
   <Pressable accessibilityRole="button" accessibilityLabel="Fechar configurações do grupo"
    onPress={onClose}><X size={23} color={t.dark}/></Pressable>
  </View>
  {rights.rename&&<View style={s.card}>
   <Text style={section}>Nome do grupo</Text>
   <TextInput value={title} onChangeText={setTitle} maxLength={80}
    accessibilityLabel="Editar nome do grupo" style={s.input}/>
   <Action secondary disabled={busy||title.trim().length<2}
    label="Salvar nome" onPress={()=>void perform(()=>
     renameNativeGroup(conversationId,title))}/>
  </View>}
  {rights.invite&&<View style={s.card}>
   <Text style={[section,{marginBottom:9}]}>Adicionar amizades</Text>
   {available.length===0?<Text style={s.muted}>Todas as amizades já estão no grupo.</Text>:
    available.map(person=><View key={person.id} style={[s.row,{gap:9,paddingVertical:9}]}>
     <Avatar path={person.avatar_path} name={person.display_name} size={36}/>
     <View style={{flex:1}}>
      <Text style={s.primaryText}>{person.display_name}</Text>
      <Text style={s.muted}>@{person.handle}</Text>
     </View>
     <Pressable accessibilityRole="button" accessibilityLabel={'Convidar '+person.display_name}
      disabled={busy} onPress={()=>void perform(()=>inviteGroupFriend(conversationId,person.id))}
      style={[s.secondary,{padding:9}]}>
      <UserPlus size={20} color={t.primary}/>
     </Pressable>
    </View>)}
  </View>}
  <View style={s.card}>
   <Text style={[section,{marginBottom:10}]}>Participantes</Text>
   {details.members.map(person=>{
    const owner=person.id===details.created_by,me=person.id===userId;
    const admin=details.permissions.coadmins.includes(person.id);
    const canRemove=rights.remove&&!owner&&!me&&
     (rights.owner||!admin);
    return <View key={person.id} style={[s.row,{gap:8,paddingVertical:9}]}>
     <Avatar path={person.avatar_path} name={person.display_name} size={36}/>
     <View style={{flex:1}}>
      <Text style={s.primaryText}>{person.display_name}{me?' (você)':''}</Text>
      <Text style={s.muted}>@{person.handle}
       {owner?' · Proprietário':admin?' · Administrador':''}
      </Text>
     </View>
     {rights.admins&&!owner&&<Pressable accessibilityRole="button"
      accessibilityLabel={(admin?'Revogar administrador de ':'Promover administrador ')+person.display_name}
      disabled={busy} onPress={()=>void perform(()=>setNativeGroupModerator(
       conversationId,person.id,!admin))}
      style={{padding:8}}>
      <ShieldCheck size={20} color={admin?t.primary:t.muted}/>
     </Pressable>}
     {canRemove&&<Pressable accessibilityRole="button"
      accessibilityLabel={'Remover '+person.display_name+' do grupo'}
      disabled={busy} onPress={()=>askRemove(person)}
      style={{padding:8}}>
      <X size={20} color={t.danger}/>
     </Pressable>}
    </View>;
   })}
  </View>
  {rights.owner&&<View style={s.card}>
   <Text style={[section,{marginBottom:10}]}>Permissões dos administradores</Text>
   {([
    {key:'invite' as const,label:'Podem convidar amizades',
     checked:details.permissions.coadmins_can_invite},
    {key:'remove' as const,label:'Podem remover participantes',
     checked:details.permissions.coadmins_can_remove}
   ]).map(setting=><Pressable key={setting.key} accessibilityRole="checkbox"
    accessibilityState={{checked:setting.checked}} disabled={busy}
    onPress={()=>void perform(()=>setNativeGroupPermissions(
     conversationId,
     setting.key==='invite'?!setting.checked:details.permissions.coadmins_can_invite,
     setting.key==='remove'?!setting.checked:details.permissions.coadmins_can_remove
    ))}
    style={[s.row,{justifyContent:'space-between',paddingVertical:12}]}>
    <Text style={s.primaryText}>{setting.label}</Text>
    <View style={{backgroundColor:setting.checked?t.primary:t.line,
     borderRadius:7,width:25,height:25,alignItems:'center',justifyContent:'center'}}>
     {setting.checked&&<Check size={18} color="#FFF"/>}
    </View>
   </Pressable>)}
  </View>}
  {!rights.owner&&<Action secondary disabled={busy}
   label="Sair do grupo" leading={<LogOut size={17} color={t.primary}/>}
   onPress={()=>Alert.alert('Sair do grupo?','Você deixará de receber novas mensagens.',[
    {text:'Cancelar',style:'cancel'},
    {text:'Sair',style:'destructive',onPress:()=>void perform(()=>
     leaveNativeGroup(conversationId),true)}
   ])}/>}
  <ErrorNotice text={error}/>
 </ScrollView>;
}
