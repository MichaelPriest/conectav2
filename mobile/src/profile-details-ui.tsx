import React,{useCallback,useEffect,useState} from 'react';
import {ActivityIndicator,Pressable,ScrollView,Text,TextInput,View} from 'react-native';
import {Check,Music2,Palette,Save,Settings2,Smile,X} from 'lucide-react-native';
import {Action,ErrorNotice,styles as s} from './ui';
import {theme as t} from './theme';
import {loadOwnProfileDetails,saveOwnProfileDetails,PROFILE_THEMES,PROFILE_LAYOUTS} from './profile-details';
import type {ProfileDetails} from './profile-details';

const labels:Record<string,string>={
 violet:'Violeta',aqua:'Azul',pink:'Rosa',sunset:'Pôr do sol',midnight:'Noite',
 classic:'Clássico',myspace:'MySpace',minimal:'Minimalista'
};
export function ProfileDetailsEditor({userId,onClose,onSaved}:{
 userId:string;onClose:()=>void;onSaved:()=>void
}){
 const [draft,setDraft]=useState<ProfileDetails|null>(null);
 const [interests,setInterests]=useState('');
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 useEffect(()=>{
  let live=true;setLoading(true);
  void loadOwnProfileDetails(userId).then(value=>{
   if(live){setDraft(value);setInterests(value.interests.join(', '));}
  }).catch(e=>{if(live)setError(e instanceof Error?e.message:'Não foi possível carregar detalhes.');})
   .finally(()=>{if(live)setLoading(false);});
  return()=>{live=false;};
 },[userId]);
 const edit=(key:keyof ProfileDetails,value:string)=>{
  setDraft(old=>old?{...old,[key]:value}:old);
 };
 const save=async()=>{
  if(!draft||busy)return;
  setBusy(true);setError('');
  try{
   const value={...draft,interests:interests.split(',').map(x=>x.trim()).filter(Boolean)};
   await saveOwnProfileDetails(userId,value);onSaved();onClose();
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível salvar seu perfil.');}
  finally{setBusy(false);}
 };
 const field=(key:'headline'|'city'|'website'|'music_url'|'mood_text'|'favorite_emoji',
   title:string,placeholder:string,maxLength:number)=>{
  if(!draft)return null;
  return <View style={{marginTop:9}}>
   <Text style={s.primaryText}>{title}</Text>
   <TextInput value={draft[key]} onChangeText={value=>edit(key,value)}
    placeholder={placeholder} placeholderTextColor={t.muted}
    maxLength={maxLength} accessibilityLabel={title}
    autoCapitalize={key==='website'||key==='music_url'?'none':'sentences'}
    keyboardType={key==='website'||key==='music_url'?'url':'default'}
    style={s.input}/>
  </View>;
 };
 return <ScrollView keyboardShouldPersistTaps="handled"
  contentContainerStyle={{padding:18,paddingBottom:45}}>
  <View style={[s.row,{gap:9,marginBottom:13}]}>
   <View style={{backgroundColor:t.subtle,borderRadius:14,padding:11}}>
    <Palette size={23} color={t.primary}/>
   </View>
   <View style={{flex:1}}>
    <Text style={{fontSize:20,fontWeight:'900',color:t.dark}}>Personalizar perfil</Text>
    <Text style={s.muted}>Do clássico ao MySpace, no estilo Conecta.</Text>
   </View>
   <Pressable accessibilityRole="button" accessibilityLabel="Fechar personalização"
    onPress={onClose}><X color={t.dark} size={22}/></Pressable>
  </View>
  {loading?<ActivityIndicator color={t.primary}/>:draft&&<>
   {field('headline','Frase de apresentação','Como você quer ser conhecido?',140)}
   {field('city','Cidade','Sua cidade (opcional)',120)}
   {field('mood_text','Status / humor','Como você está hoje?',160)}
   {field('favorite_emoji','Emoji favorito','💜',16)}
   <View style={{marginTop:9}}>
    <Text style={s.primaryText}>Interesses</Text>
    <TextInput value={interests} onChangeText={setInterests}
     placeholder="Música, arte, tecnologia..." placeholderTextColor={t.muted}
     accessibilityLabel="Interesses separados por vírgula" multiline
     style={[s.input,{minHeight:72,textAlignVertical:'top'}]}/>
    <Text style={s.muted}>Até 12 interesses, separados por vírgula.</Text>
   </View>
   {field('website','Site pessoal','https://...',400)}
   {field('music_url','Link da música','https://...',400)}
   <View style={{marginTop:13}}>
    <Text style={[s.primaryText,{fontSize:16,marginBottom:9}]}>Tema de capa</Text>
    <View style={[s.row,{gap:8,flexWrap:'wrap'}]}>
     {PROFILE_THEMES.map(value=><Pressable key={value}
      accessibilityRole="radio" accessibilityState={{checked:draft.cover_theme===value}}
      onPress={()=>edit('cover_theme',value)}
      style={[s.secondary,draft.cover_theme===value&&{backgroundColor:t.primary}]}>
      {draft.cover_theme===value&&<Check size={14} color="#FFF"/>}
      <Text style={[s.secondaryText,draft.cover_theme===value&&{color:'#FFF'}]}>
       {labels[value]}
      </Text>
     </Pressable>)}
    </View>
   </View>
   <View style={{marginTop:17}}>
    <Text style={[s.primaryText,{fontSize:16,marginBottom:9}]}>Layout do perfil</Text>
    <View style={[s.row,{gap:8,flexWrap:'wrap'}]}>
     {PROFILE_LAYOUTS.map(value=><Pressable key={value}
      accessibilityRole="radio" accessibilityState={{checked:draft.layout_style===value}}
      onPress={()=>edit('layout_style',value)}
      style={[s.secondary,draft.layout_style===value&&{backgroundColor:t.primary}]}>
      {draft.layout_style===value&&<Check size={14} color="#FFF"/>}
      <Text style={[s.secondaryText,draft.layout_style===value&&{color:'#FFF'}]}>
       {labels[value]}
      </Text>
     </Pressable>)}
    </View>
   </View>
   <ErrorNotice text={error}/>
   <View style={{marginTop:19}}>
    <Action fullWidth disabled={busy} label={busy?'Salvando...':'Salvar personalização'}
     leading={<Save size={17} color="#FFF"/>} onPress={()=>void save()}/>
   </View>
   <Text style={[s.muted,{marginTop:9}]}>
    Música e links abrem somente ao tocar; o Conecta não reproduz áudio sozinho.
   </Text>
  </>}
  {!draft&&!loading&&<ErrorNotice text={error}/>}
 </ScrollView>;
}
