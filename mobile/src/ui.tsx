import React,{useEffect,useState} from 'react';
import {ActivityIndicator,Image,Pressable,StyleSheet,Text,TextInput,View} from 'react-native';
import {VideoView,useVideoPlayer} from 'expo-video';
import {reportSafety,signedMedia} from './data';
import {theme as t} from './theme';
export const styles=StyleSheet.create({
 page:{flex:1,backgroundColor:t.bg},
 screen:{flex:1,paddingHorizontal:16},
 title:{fontSize:28,fontWeight:'900',color:t.dark,letterSpacing:-0.8,
  lineHeight:35},
 sub:{fontSize:13,color:t.muted,lineHeight:20,marginTop:4},
 card:{backgroundColor:t.surface,borderRadius:20,padding:17,
  marginVertical:8,borderColor:t.line,borderWidth:1,
  shadowColor:t.shadow,shadowOpacity:0.055,shadowRadius:15,
  shadowOffset:{width:0,height:6},elevation:2},
 row:{flexDirection:'row',alignItems:'center'},
 grow:{flex:1},
 primaryText:{fontSize:14,fontWeight:'800',color:t.dark},
 muted:{fontSize:12,color:t.muted,lineHeight:19},
 badge:{fontSize:10,fontWeight:'800',color:t.primary},
 button:{backgroundColor:t.primary,borderRadius:12,paddingHorizontal:16,
  paddingVertical:12,alignItems:'center',justifyContent:'center',
  minHeight:43,flexDirection:'row',gap:7},
 buttonText:{color:'#FFFFFF',fontSize:13,fontWeight:'800'},
 secondary:{backgroundColor:t.subtle,borderRadius:12,paddingHorizontal:13,
  paddingVertical:10,alignItems:'center',justifyContent:'center',
  minHeight:39,flexDirection:'row',gap:6},
 secondaryText:{fontWeight:'800',color:t.primary,fontSize:12},
 input:{minHeight:46,paddingHorizontal:14,paddingVertical:11,
  borderWidth:1,borderColor:t.line,borderRadius:12,
  backgroundColor:'#FAFAFF',color:t.dark,fontSize:14,marginVertical:7},
 separator:{height:1,backgroundColor:t.line,marginVertical:14},
 header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',
  paddingHorizontal:16,paddingVertical:13,backgroundColor:t.surface,
  borderBottomWidth:1,borderColor:t.line},
 empty:{backgroundColor:t.surface,borderRadius:19,padding:28,
  alignItems:'center',justifyContent:'center',marginTop:20,
  borderColor:t.line,borderWidth:1,minHeight:148}
});

export function Avatar({path,name,size=44}:{path?:string|null;name:string;size?:number}){
 const [url,setUrl]=useState<string|null>(null);
 useEffect(()=>{let active=true;setUrl(null);void signedMedia(path).then(u=>{if(active)setUrl(u);});
 return()=>{active=false;};},[path]);
 const box={width:size,height:size,borderRadius:size/2};
 if(url)return <Image accessibilityLabel={name} accessibilityRole="image" source={{uri:url}} style={box}/>;
 return <View style={[box,{backgroundColor:t.subtle,alignItems:'center',
  justifyContent:'center',borderWidth:1,borderColor:t.line}]}>
  <Text style={{color:t.primary,fontWeight:'900',fontSize:size*0.34}}>{(name||'?').slice(0,2).toUpperCase()}</Text>
 </View>;
}
export function Media({path,height=185,width='100%',radius=15,marginTop=12}:{
 path:string|null|undefined;height?:number;width?:'100%'|'48%';
 radius?:number;marginTop?:number;
}){
 const [url,setUrl]=useState<string|null>(null);
 useEffect(()=>{let active=true;setUrl(null);void signedMedia(path).then(u=>{if(active)setUrl(u);});
 return()=>{active=false;};},[path]);
 if(!url)return null;
 return <Image accessibilityLabel="Mídia da publicação" accessibilityRole="image" source={{uri:url}} resizeMode="cover"
 style={{width,height,borderRadius:radius,marginTop}}/>;
}
function InlineVideo({url,height}:{url:string;height:number}){
 const player=useVideoPlayer(url);
 return <VideoView player={player} nativeControls fullscreenOptions={{enable:true}}
  style={{width:'100%',height,borderRadius:14,marginTop:10}}/>;
}
export function VideoMedia({path}:{path:string|null|undefined}){
 const [url,setUrl]=useState<string|null>(null);
 const [activated,setActivated]=useState(false);
 useEffect(()=>{
  let active=true;setUrl(null);setActivated(false);
  void signedMedia(path).then(value=>{if(active)setUrl(value);});
  return()=>{active=false;};
 },[path]);
 if(!path)return null;
 return <View style={{marginTop:10}}>
  {!activated?<Action secondary label="▶ Assistir vídeo" onPress={()=>setActivated(true)}/>:
   url?<InlineVideo url={url} height={240}/>:
    <Text style={styles.muted}>Não foi possível carregar o vídeo autorizado.</Text>}
 </View>;
}
export function Action({label,onPress,secondary=false,disabled=false,leading,fullWidth=false}:{
 label:string;onPress:()=>void;secondary?:boolean;disabled?:boolean;
 leading?:React.ReactNode;fullWidth?:boolean;
}){
 return <Pressable accessibilityRole="button" accessibilityLabel={label}
  accessibilityState={{disabled}} disabled={disabled} onPress={onPress}
  style={[secondary?styles.secondary:styles.button,
   fullWidth&&{alignSelf:'stretch'},disabled&&{opacity:0.5}]}>
  {leading}
  <Text style={secondary?styles.secondaryText:styles.buttonText}>{label}</Text>
 </Pressable>;
}
export function Field({value,onChangeText,placeholder,multiline=false,
 secureTextEntry=false,maxLength,autoCapitalize}:{
 value:string;onChangeText:(next:string)=>void;placeholder:string;
 multiline?:boolean;secureTextEntry?:boolean;maxLength?:number;
 autoCapitalize?:'none'|'sentences'|'words'|'characters';
}){
 return <TextInput accessibilityLabel={placeholder} value={value}
 onChangeText={onChangeText} placeholder={placeholder} maxLength={maxLength}
 placeholderTextColor="#9288A2" multiline={multiline} secureTextEntry={secureTextEntry}
 style={[styles.input,multiline&&{minHeight:100,textAlignVertical:'top'}]}
 autoCapitalize={autoCapitalize||(secureTextEntry?'none':'sentences')}/>;
}
export function Loading({text='Carregando...'}:{text?:string}){
 return <View style={{alignItems:'center',padding:25,gap:12}}><ActivityIndicator size="small" color={t.primary}/><Text style={styles.muted}>{text}</Text></View>;
}
export function ErrorNotice({text}:{text:string}){
 if(!text)return null;
 return <Text accessibilityRole="alert" style={{padding:11,backgroundColor:'#FFF1F5',
  color:t.danger,borderRadius:11,marginVertical:7,fontSize:12}}>{text}</Text>;
}
export function Heading({title,subtitle,eyebrow}:{title:string;subtitle:string;eyebrow?:string}){
 return <View style={{paddingTop:24,paddingBottom:16}}>
  {!!eyebrow&&<Text style={{fontSize:10,fontWeight:'900',letterSpacing:1.6,
   color:t.primary,marginBottom:4}}>{eyebrow.toUpperCase()}</Text>}
  <Text style={styles.title}>{title}</Text>
  <Text style={styles.sub}>{subtitle}</Text>
 </View>;
}

const REPORT_REASONS=[
 'Assédio ou intimidação','Discriminação ou capacitismo',
 'Exposição de informações pessoais','Conteúdo sexual inadequado',
 'Golpe, spam ou fraude','Outro risco à segurança'
] as const;
export function ReportContent({targetType,targetId,userId}:{
 targetType:'post'|'message';targetId:string;userId:string;
}){
 const [open,setOpen]=useState(false);
 const [reason,setReason]=useState<string>(REPORT_REASONS[0]);
 const [details,setDetails]=useState('');
 const [sent,setSent]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const submit=async()=>{
  if(busy||sent)return;
  setBusy(true);setError('');
  try{
   await reportSafety(userId,targetType,targetId,reason,details);
   setSent(true);setOpen(false);setDetails('');
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível enviar sua denúncia.');}
  finally{setBusy(false);}
 };
 if(sent)return <Text accessibilityRole="text" style={styles.muted}>✓ Denúncia recebida</Text>;
 return <View style={{marginTop:8}}>
  <Pressable accessibilityRole="button"
   accessibilityLabel={targetType==='message'?'Denunciar mensagem':'Denunciar publicação'}
   accessibilityState={{expanded:open}} onPress={()=>{setOpen(x=>!x);setError('');}}>
   <Text style={styles.secondaryText}>⚑ Denunciar</Text>
  </Pressable>
  {open&&<View style={{padding:12,marginTop:8,backgroundColor:t.subtle,borderRadius:12,gap:8}}>
   <Text style={styles.primaryText}>Enviar denúncia</Text>
   <Text style={styles.muted}>A pessoa denunciada não recebe aviso. Nossa equipe analisará o conteúdo.</Text>
   {REPORT_REASONS.map(item=><Pressable key={item} accessibilityRole="radio"
    accessibilityState={{checked:reason===item}} onPress={()=>setReason(item)}
    style={[styles.secondary,reason===item&&{backgroundColor:t.primary}]}>
    <Text style={[styles.secondaryText,reason===item&&{color:'white'}]}>{item}</Text>
   </Pressable>)}
   <TextInput style={styles.input} value={details} onChangeText={setDetails}
    accessibilityLabel="Informações adicionais" multiline maxLength={350}
    placeholder="Detalhes opcionais, sem dados pessoais de crianças"/>
   <ErrorNotice text={error}/>
   <Action disabled={busy} label={busy?'Enviando...':'Enviar denúncia'} onPress={()=>void submit()}/>
   <Action secondary label="Cancelar" onPress={()=>setOpen(false)}/>
  </View>}
 </View>;
}
