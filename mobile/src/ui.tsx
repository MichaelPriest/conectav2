import React,{useEffect,useState} from 'react';
import {ActivityIndicator,Image,Pressable,StyleSheet,Text,TextInput,View} from 'react-native';
import {VideoView,useVideoPlayer} from 'expo-video';
import {signedMedia} from './data';
import {theme as t} from './theme';
export const styles=StyleSheet.create({
 page:{flex:1,backgroundColor:t.bg},screen:{flex:1,paddingHorizontal:18},
 title:{fontSize:28,fontWeight:'900',color:t.dark,letterSpacing:-0.9},
 sub:{fontSize:13,color:t.muted,lineHeight:19,marginTop:5},
 card:{backgroundColor:t.surface,borderRadius:22,padding:17,
  marginVertical:8,borderColor:t.line,borderWidth:1,elevation:2},
 row:{flexDirection:'row',alignItems:'center'},
 grow:{flex:1},
 primaryText:{fontSize:15,fontWeight:'800',color:t.dark},
 muted:{fontSize:12,color:t.muted,lineHeight:18},
 badge:{fontSize:10,fontWeight:'800',color:t.primary},
 button:{backgroundColor:t.primary,borderRadius:13,paddingHorizontal:16,
  paddingVertical:12,alignItems:'center',justifyContent:'center'},
 buttonText:{color:'#FFF',fontSize:13,fontWeight:'800'},
 secondary:{backgroundColor:t.subtle,borderRadius:12,paddingHorizontal:12,paddingVertical:10,
  alignItems:'center'},
 secondaryText:{fontWeight:'800',color:t.primary,fontSize:12},
 input:{minHeight:46,paddingHorizontal:14,paddingVertical:10,borderWidth:1,borderColor:t.line,
  borderRadius:13,backgroundColor:'#FFF',color:t.dark,fontSize:14,marginVertical:7},
 separator:{height:1,backgroundColor:t.line,marginVertical:12},
 header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',
  paddingHorizontal:18,paddingVertical:13,backgroundColor:t.surface,
  borderBottomWidth:1,borderColor:t.line},
 empty:{backgroundColor:t.surface,borderRadius:19,padding:28,alignItems:'center',marginTop:20},
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
export function Media({path,height=185}:{path:string|null|undefined;height?:number}){
 const [url,setUrl]=useState<string|null>(null);
 useEffect(()=>{let active=true;setUrl(null);void signedMedia(path).then(u=>{if(active)setUrl(u);});
 return()=>{active=false;};},[path]);
 if(!url)return null;
 return <Image accessibilityLabel="Mídia da publicação" accessibilityRole="image" source={{uri:url}} resizeMode="cover"
 style={{width:'100%',height,borderRadius:15,marginTop:12}}/>;
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
export function Action({label,onPress,secondary=false,disabled=false}:{
 label:string;onPress:()=>void;secondary?:boolean;disabled?:boolean
}){
 return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled}} disabled={disabled} onPress={onPress}
 style={[secondary?styles.secondary:styles.button,disabled&&{opacity:0.5}]}>
  <Text style={secondary?styles.secondaryText:styles.buttonText}>{label}</Text>
 </Pressable>;
}
export function Field({value,onChangeText,placeholder,multiline=false,secureTextEntry=false}:{
 value:string;onChangeText:(next:string)=>void;placeholder:string;
 multiline?:boolean;secureTextEntry?:boolean
}){
 return <TextInput accessibilityLabel={placeholder} value={value} onChangeText={onChangeText} placeholder={placeholder}
 placeholderTextColor="#9288A2" multiline={multiline} secureTextEntry={secureTextEntry}
 style={[styles.input,multiline&&{minHeight:100,textAlignVertical:'top'}]}
 autoCapitalize={secureTextEntry?'none':'sentences'}/>;
}
export function Loading({text='Carregando...'}:{text?:string}){
 return <View style={{alignItems:'center',padding:25,gap:12}}><ActivityIndicator size="small" color={t.primary}/><Text style={styles.muted}>{text}</Text></View>;
}
export function ErrorNotice({text}:{text:string}){
 if(!text)return null;
 return <Text accessibilityRole="alert" style={{padding:11,backgroundColor:'#FFF0F3',
  color:t.danger,borderRadius:11,marginVertical:7,fontSize:12}}>{text}</Text>;
}
export function Heading({title,subtitle}:{title:string;subtitle:string}){
 return <View style={{paddingVertical:17}}><Text style={styles.title}>{title}</Text>
 <Text style={styles.sub}>{subtitle}</Text></View>;
}
