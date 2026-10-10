import React,{useEffect,useState} from 'react';
import {Pressable,ScrollView,Text,TextInput,View} from 'react-native';
import type {ChatMessage} from './models';
import {searchChatMessages} from './data';
import {Action,ErrorNotice,styles as s} from './ui';
import {theme as t} from './theme';

/** Search the server, not a partial local cache of recent messages. */
export function ChatSearch({conversationId,onReply,onClose}:{
 conversationId:string;onReply:(message:ChatMessage)=>void;onClose:()=>void;
}){
 const [query,setQuery]=useState('');
 const [results,setResults]=useState<ChatMessage[]>([]);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 useEffect(()=>{
  setQuery('');setResults([]);setError('');
 },[conversationId]);
 const search=async()=>{
  if(loading)return;
  setLoading(true);setError('');setResults([]);
  try{
   const hits=await searchChatMessages(conversationId,query);
   setResults(hits);
  }catch(e){
   setError(e instanceof Error?e.message:'A pesquisa não pôde ser concluída.');
  }finally{setLoading(false);}
 };
 return <View style={{
  paddingHorizontal:13,paddingVertical:12,backgroundColor:t.surface,
  borderBottomColor:t.line,borderBottomWidth:1,gap:6,maxHeight:280
 }}>
  <View style={[s.row,{gap:8}]}>
   <TextInput value={query} onChangeText={setQuery}
    accessibilityLabel="Pesquisar mensagens desta conversa"
    placeholder="Buscar mensagens..." placeholderTextColor={t.muted}
    style={[s.input,{flex:1,marginVertical:0}]}
    maxLength={100} autoCapitalize="none"
    onSubmitEditing={()=>void search()}/>
   <Action secondary disabled={loading||query.trim().length<2}
    label={loading?'...':'Buscar'} onPress={()=>void search()}/>
   <Pressable accessibilityRole="button" accessibilityLabel="Fechar busca"
    onPress={onClose}><Text style={[s.secondaryText,{fontSize:18}]}>✕</Text></Pressable>
  </View>
  <ErrorNotice text={error}/>
  <ScrollView keyboardShouldPersistTaps="handled">
   {results.map(message=><Pressable key={message.id} accessibilityRole="button"
    accessibilityLabel="Responder ao resultado da busca"
    style={{padding:11,borderBottomWidth:1,borderColor:t.line}}
    onPress={()=>{onReply(message);onClose();}}>
    <Text style={s.primaryText} numberOfLines={3}>{message.content}</Text>
    <Text style={s.muted}>
     {new Date(message.created_at).toLocaleString('pt-BR')} · Responder
    </Text>
   </Pressable>)}
   {!loading&&!error&&results.length===0&&<Text style={[s.muted,{paddingVertical:10}]}>
    Pesquise no histórico. Os resultados encontrados podem ser respondidos diretamente.
   </Text>}
  </ScrollView>
 </View>;
}
