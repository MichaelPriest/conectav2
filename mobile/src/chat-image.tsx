import React,{useCallback,useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Image,Modal,Pressable,Text,View} from 'react-native';
import {invalidateSignedMedia,signedMedia} from './data';
import {theme as t} from './theme';

/** Private message image URLs are signed only for authorized Supabase sessions.
 * Never construct public bucket URLs or bypass conversation membership RLS. */
export function ChatImage({path}:{path:string}){
 const [url,setUrl]=useState<string|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [expanded,setExpanded]=useState(false);
 const retried=useRef(false);
 const sequence=useRef(0);
 const load=useCallback(async(fresh=false)=>{
  const current=++sequence.current;
  setLoading(true);setError('');
  if(fresh)invalidateSignedMedia(path);
  try{
   const signed=await signedMedia(path);
   if(sequence.current!==current)return;
   if(!signed){
    setUrl(null);
    setError('Imagem não disponível. Confira sua conexão e tente novamente.');
   }else setUrl(signed);
  }catch{
   if(sequence.current!==current)return;
   setUrl(null);setError('Não foi possível acessar a foto desta conversa.');
  }finally{if(sequence.current===current)setLoading(false);}
 },[path]);
 useEffect(()=>{
  retried.current=false;setExpanded(false);
  void load();
  return()=>{sequence.current++;};
 },[load]);
 const failed=()=>{
  if(!retried.current){
   retried.current=true;void load(true);return;
  }
  setUrl(null);setLoading(false);
  setError('O arquivo não carregou. Toque em tentar novamente.');
 };
 return <View style={{minWidth:170,marginTop:9}}>
  {loading&&<View style={{height:125,justifyContent:'center',alignItems:'center'}}>
   <ActivityIndicator color={t.primary}/>
   <Text style={{fontSize:11,color:t.muted,marginTop:6}}>Carregando foto...</Text>
  </View>}
  {!!url&&<Pressable onPress={()=>setExpanded(true)} accessibilityRole="button"
   accessibilityLabel="Abrir imagem da conversa" style={loading&&{opacity:0}}>
   <Image source={{uri:url}} resizeMode="cover" onError={failed}
    onLoadEnd={()=>setLoading(false)}
    style={{width:'100%',height:185,minWidth:170,borderRadius:12}}/>
  </Pressable>}
  {!!error&&<View style={{gap:6,marginTop:7}}>
   <Text accessibilityRole="alert" style={{fontSize:11,color:t.danger}}>{error}</Text>
   <Pressable accessibilityRole="button" onPress={()=>{retried.current=false;void load(true);}}
    style={{padding:9,borderRadius:10,backgroundColor:t.subtle}}>
    <Text style={{color:t.primary,fontWeight:'800',fontSize:12}}>Tentar novamente</Text>
   </Pressable>
  </View>}
  <Modal visible={expanded&&!!url} transparent animationType="fade"
   onRequestClose={()=>setExpanded(false)}>
   <View style={{flex:1,backgroundColor:'#101018',padding:15,justifyContent:'center'}}>
    <Pressable accessibilityRole="button" accessibilityLabel="Fechar imagem"
     onPress={()=>setExpanded(false)} style={{alignSelf:'flex-end',padding:13}}>
     <Text style={{color:'#FFF',fontWeight:'800'}}>✕ Fechar</Text>
    </Pressable>
    {!!url&&<Image source={{uri:url}} resizeMode="contain" onError={failed}
     style={{flex:1,width:'100%'}}/>}
   </View>
  </Modal>
 </View>;
}
