import React,{useState} from 'react';
import {Alert,Pressable,Text,TextInput,View} from 'react-native';
import type {ChatMessage,ChatReaction} from './models';
import {CHAT_EMOJIS,deleteChatMessage,editChatMessage,setChatReaction} from './chat-actions';
import {AudioMessage} from './voice-ui';
import {ErrorNotice,Media,ReportContent,VideoMedia,styles as s} from './ui';
import {theme as t} from './theme';

type Props={
 message:ChatMessage;userId:string;quoted:ChatMessage|null;reactions:ChatReaction[];
 onReply:(message:ChatMessage)=>void;onChanged:()=>Promise<void>;
};

export function ChatBubble({message,userId,quoted,reactions,onReply,onChanged}:Props){
 const own=message.sender_id===userId;
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [editing,setEditing]=useState(false),[editText,setEditText]=useState('');
 const [emojiOpen,setEmojiOpen]=useState(false);
 const change=async(operation:()=>Promise<void>)=>{
  if(busy)return;
  setBusy(true);setError('');
  try{await operation();await onChanged();}
  catch(e){setError(e instanceof Error?e.message:'Não foi possível alterar a mensagem.');}
  finally{setBusy(false);}
 };
 const confirmDelete=()=>{
  if(busy)return;
  Alert.alert('Apagar mensagem','Apagar para todas as pessoas desta conversa?',[
   {text:'Cancelar',style:'cancel'},
   {text:'Apagar',style:'destructive',onPress:()=>{
    void change(()=>deleteChatMessage(message,userId));
   }}
  ]);
 };
 const saveEdit=()=>{
  if(!editText.trim()||editText.trim().length>4000)return;
  void change(async()=>{
   await editChatMessage(message,userId,editText);
   setEditing(false);
  });
 };
 const react=(emoji:string)=>{
  const has=reactions.some(r=>r.emoji===emoji&&r.user_id===userId);
  void change(()=>setChatReaction(message,userId,emoji,has));
  setEmojiOpen(false);
 };
 const textColor=own?'#FFF':t.dark;
 const secondaryColor=own?'#E9DFFB':t.muted;
 return <View style={{
  alignSelf:own?'flex-end':'flex-start',maxWidth:'90%',
  borderRadius:17,padding:11,marginVertical:4,borderWidth:1,
  backgroundColor:own?t.primary:t.surface,borderColor:own?t.primary:t.line
 }}>
  {message.reply_to&&!message.deleted_at&&<View
   style={{borderLeftWidth:3,borderLeftColor:own?'#CEBCFC':t.primary,paddingLeft:8,marginBottom:7}}>
   <Text numberOfLines={2} style={{fontSize:12,color:secondaryColor}}>
    ↩ {quoted?(quoted.deleted_at?'Mensagem apagada':quoted.content||'Anexo compartilhado'):
     'Mensagem anterior'}
   </Text>
  </View>}
  {editing?<View style={{gap:6}}>
   <TextInput accessibilityLabel="Editar mensagem" value={editText} onChangeText={setEditText}
    maxLength={4000} multiline autoFocus
    style={[s.input,{minWidth:190,maxHeight:150,backgroundColor:'#FFF'}]}/>
   <View style={[s.row,{gap:11,justifyContent:'flex-end'}]}>
    <Pressable accessibilityRole="button" onPress={()=>setEditing(false)}>
     <Text style={{color:secondaryColor,fontWeight:'700'}}>Cancelar</Text>
    </Pressable>
    <Pressable accessibilityRole="button" disabled={busy||!editText.trim()}
     onPress={saveEdit}><Text style={{color:secondaryColor,fontWeight:'800'}}>Salvar</Text></Pressable>
   </View>
  </View>:<Text style={{color:textColor,fontSize:14,lineHeight:20}}>
   {message.deleted_at?'Mensagem apagada':message.content||
    (message.media_path?'Mídia compartilhada':'')}
  </Text>}
  {!message.deleted_at&&message.media_path&&message.media_type?.startsWith('image')&&
   <Media path={message.media_path} height={175}/>}
  {!message.deleted_at&&message.media_path&&message.media_type==='video'&&
   <VideoMedia path={message.media_path}/>}
  {!message.deleted_at&&message.media_path&&message.media_type==='audio'&&
   <AudioMessage path={message.media_path}/>}
  <Text style={{alignSelf:'flex-end',color:secondaryColor,marginTop:5,fontSize:10}}>
   {new Date(message.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}
   {message.edited_at&&!message.deleted_at?' · editada':''}
  </Text>
  {!message.deleted_at&&<View style={[s.row,{gap:10,marginTop:8,flexWrap:'wrap'}]}>
   <Pressable accessibilityRole="button" accessibilityLabel="Responder mensagem"
    disabled={busy} onPress={()=>onReply(message)}>
    <Text style={{fontSize:12,color:secondaryColor,fontWeight:'700'}}>↩ Responder</Text>
   </Pressable>
   <Pressable accessibilityRole="button" accessibilityLabel="Reagir à mensagem"
    disabled={busy} onPress={()=>setEmojiOpen(current=>!current)}>
    <Text style={{fontSize:12,color:secondaryColor,fontWeight:'700'}}>☺ Reagir</Text>
   </Pressable>
   {own&&!!message.content&&<Pressable accessibilityRole="button" accessibilityLabel="Editar mensagem"
    disabled={busy} onPress={()=>{setEditText(message.content);setEditing(true);}}>
    <Text style={{fontSize:12,color:secondaryColor,fontWeight:'700'}}>Editar</Text>
   </Pressable>}
   {own&&<Pressable accessibilityRole="button" accessibilityLabel="Apagar mensagem"
    disabled={busy} onPress={confirmDelete}>
    <Text style={{fontSize:12,color:secondaryColor,fontWeight:'700'}}>Apagar</Text>
   </Pressable>}
  </View>}
  {emojiOpen&&!message.deleted_at&&<View style={[s.row,{gap:10,marginTop:8,flexWrap:'wrap'}]}>
   {CHAT_EMOJIS.map(emoji=><Pressable key={emoji} accessibilityRole="button"
    accessibilityLabel={'Reagir com '+emoji} disabled={busy} onPress={()=>react(emoji)}>
    <Text style={{fontSize:21}}>{emoji}</Text>
   </Pressable>)}
  </View>}
  {reactions.length>0&&!message.deleted_at&&<View style={[s.row,{gap:7,marginTop:8,flexWrap:'wrap'}]}>
   {CHAT_EMOJIS.filter(emoji=>reactions.some(r=>r.emoji===emoji)).map(emoji=>{
    const mine=reactions.some(r=>r.emoji===emoji&&r.user_id===userId);
    return <Pressable key={emoji} accessibilityRole="button" disabled={busy}
     accessibilityLabel={'Reação '+emoji}
     accessibilityState={{selected:mine}} onPress={()=>react(emoji)}
     style={{paddingVertical:4,paddingHorizontal:7,borderRadius:13,
      backgroundColor:mine?t.pink:t.subtle}}>
     <Text style={{color:mine?'white':t.primary,fontSize:12}}>
      {emoji} {reactions.filter(r=>r.emoji===emoji).length}
     </Text>
    </Pressable>;
   })}
  </View>}
  {!own&&!message.deleted_at&&<ReportContent targetType="message"
   targetId={message.id} userId={userId}/>}
  <ErrorNotice text={error}/>
 </View>;
}
