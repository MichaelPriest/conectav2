import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {
 Alert,AppState,FlatList,Image,KeyboardAvoidingView,Linking,Modal,Platform,Pressable,Share,
 RefreshControl,ScrollView,StatusBar as NativeStatusBar,
 StyleSheet,Text,TextInput,View
} from 'react-native';
import {StatusBar} from 'expo-status-bar';
import {SafeAreaProvider,SafeAreaView} from 'react-native-safe-area-context';
import {NavigationBar} from 'expo-navigation-bar';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {User} from '@supabase/supabase-js';
import {SITE_URL,supabase} from './src/supabase';
import type {ChatMessage,ChatReaction,Community,Friendship,Notice,Post,PostComment,Profile,Thread} from './src/models';
import {
 changeConnection,changeMembership,clearMediaCache,loadChatMessages,loadOlderChatMessages,loadCommunities,
 loadConnections,loadFeed,loadNotifications,loadPostComments,loadSavedPosts,loadThreads,markNotifications,myLikes,mySaved,
 publishTextPost,readConversation,sendMessage,sendPostComment,setLike,setSavedPost,startChat,unreadNotificationCount,updateMyProfile,verifyAccess
} from './src/data';
import {Action,Avatar,ErrorNotice,Field,Heading,Loading,Media,ReportContent,VideoMedia,styles as s} from './src/ui';
import {formatDate,theme as t} from './src/theme';
import {StoryRail} from './src/story-ui';
import {VoiceRecorder} from './src/voice-ui';
import {ChatBubble} from './src/chat-bubble';
import {ChatSearch} from './src/chat-search';
import {loadChatReactions} from './src/chat-actions';
import {mergeChatPages,refreshChatReactionPage} from './src/chat-merge';
import {sendChatMedia} from './src/chat-media';
import {changeProfilePhoto,loadCover} from './src/profile-media';
import {ReelsScreen} from './src/reels-ui';
import {normalizeMedia,publishMediaPost} from './src/media';
import {
 Bell,Bookmark,Camera,Clapperboard,Compass,Heart,ImagePlus,MessageCircle,
 MoreHorizontal,Plus,Search,Send,ShieldCheck,Sparkles,UsersRound,Video,
 X,Globe2,LockKeyhole,UserRound,ChevronRight,Pencil,Share2,HeartHandshake
} from 'lucide-react-native';
import {BottomNavigation,Brand,FeedTabs,GradientPanel,RoundIcon,
 SectionEyebrow,SectionHeader} from './src/design';

import type {SelectedMedia} from './src/media';

type Tab='feed'|'reels'|'connections'|'messages'|'communities'|'notifications'|'profile';
const noticeNames:Record<string,string>={
 like:'curtiu sua publicação',comment:'comentou sua publicação',
 friend_request:'enviou um convite',friend_accept:'aceitou sua conexão',
 mention:'mencionou você',community:'interagiu em sua comunidade'
};
const openOfficial=async(path:string)=>{
 const url=SITE_URL+path;
 if(await Linking.canOpenURL(url))await Linking.openURL(url);
};
const errorMessage=(error:unknown)=>error instanceof Error?error.message:
 'Não foi possível concluir a operação. Tente novamente.';

function SignIn({onSignedIn}:{onSignedIn:()=>void}){
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const login=async()=>{
  if(!email.trim()||password.length<8){setError('Informe seu e-mail e senha (mínimo de 8 caracteres).');return;}
  setBusy(true);setError('');
  const {error:authError}=await supabase.auth.signInWithPassword({
   email:email.trim().toLowerCase(),password
  });
  if(authError)setError(authError.message);else onSignedIn();
  setBusy(false);
 };
 return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={a.auth}>
  <View style={a.authArt}><Text style={a.authBrand}>conecta<Text style={{color:'#F6A5C5'}}>✳</Text></Text>
   <Text style={a.authCopy}>Pessoas, ideias e comunidades em um lugar feito para pertencer.</Text>
  </View>
  <View style={a.authCard}>
   <Text style={s.title}>Bem-vindo de volta</Text>
   <Text style={[s.sub,{marginBottom:14}]}>Entre com a mesma conta do Conecta V2.</Text>
   <Field value={email} onChangeText={setEmail} placeholder="Seu e-mail"/>
   <Field value={password} onChangeText={setPassword} placeholder="Sua senha" secureTextEntry/>
   <ErrorNotice text={error}/>
   <Action disabled={busy} label={busy?'Entrando...':'Entrar no Conecta'} onPress={()=>void login()}/>
   <View style={{height:11}}/>
   <Action secondary label="Criar conta com proteção por idade" onPress={()=>void openOfficial('/auth?mode=signup')}/>
   <Text style={[s.muted,{textAlign:'center',marginTop:13}]}>
    O cadastro e a verificação de idade utilizam o processo protegido do Conecta.
   </Text>
  </View>
 </ScrollView>;
}
function Restricted({status,onRetry,onLogout}:{
 status:'onboarding'|'age-check';onRetry:()=>void;onLogout:()=>void
}){
 const isAge=status==='age-check';
 return <View style={[s.screen,{justifyContent:'center'}]}>
  <Text style={{fontSize:42,textAlign:'center'}}>✳</Text>
  <Text style={[s.title,{textAlign:'center',marginTop:14}]}>
   {isAge?'Verificação de idade necessária':'Conclua seu cadastro'}
  </Text>
  <Text style={[s.sub,{textAlign:'center',marginVertical:16}]}>
   {isAge?'Sua conta precisa concluir a verificação de idade para usar os recursos da rede.'
    :'Finalize o perfil e a declaração de idade antes de utilizar o aplicativo.'}
  </Text>
  <Action label={isAge?'Abrir verificação protegida':'Completar cadastro'}
   onPress={()=>void openOfficial(isAge?'/verificar-identidade':'/onboarding')}/>
  <View style={{height:10}}/>
  <Action secondary label="Já concluí — verificar novamente" onPress={onRetry}/>
  <View style={{height:10}}/>
  <Action secondary label="Sair da conta" onPress={onLogout}/>
 </View>;
}

function PostCard({post,userId,liked,saved,onLike,onSave,onComment}:{
 post:Post;userId:string;liked:boolean;saved:boolean;
 onLike:(post:Post)=>void;onSave:(post:Post)=>void;
 onComment:(postId:string)=>void;
}){
 const author=post.profiles?.display_name||'Pessoa do Conecta';
 const count=post.post_likes?.[0]?.count||0;
 const comments=post.post_comments?.[0]?.count||0;
 const [commentsOpen,setCommentsOpen]=useState(false);
 const [commentRows,setCommentRows]=useState<PostComment[]>([]);
 const [commentBody,setCommentBody]=useState('');
 const [replyTo,setReplyTo]=useState<PostComment|null>(null);
 const [sendingComment,setSendingComment]=useState(false);
 const [commentError,setCommentError]=useState('');
 const [loadingComments,setLoadingComments]=useState(false);
 const toggleComments=async()=>{
  if(commentsOpen){setCommentsOpen(false);setReplyTo(null);return;}
  setCommentsOpen(true);setLoadingComments(true);setCommentError('');
  try{setCommentRows(await loadPostComments(post.id));}
  catch(e){setCommentError(errorMessage(e));}finally{setLoadingComments(false);}
 };
 const sendComment=async()=>{
  if(sendingComment||!commentBody.trim()||commentBody.trim().length>1000)return;
  setSendingComment(true);setCommentError('');
  try{
   await sendPostComment(post.id,userId,commentBody,replyTo?.id||null);
   setCommentBody('');setReplyTo(null);
   setCommentRows(await loadPostComments(post.id));
   onComment(post.id);
  }catch(e){setCommentError(errorMessage(e));}
  finally{setSendingComment(false);}
 };
 const images=post.post_media?.length
  ? [...post.post_media].filter(x=>x.media_type==='image')
     .sort((a,b)=>a.position-b.position).map(x=>x.storage_path)
  : post.media_type==='image'&&post.media_path?[post.media_path]:[];
 const videoPath=post.post_media?.find(x=>x.media_type==='video')?.storage_path||
  (post.media_type==='video'?post.media_path:null);
 const visibility=post.visibility==='private'?'🔒 Só eu':post.visibility==='friends'?'♡ Conexões':'◎ Público';
 return <View style={s.card}>
  <View style={[s.row,{gap:11}]}>
   <Avatar path={post.profiles?.avatar_path} name={author} size={43}/>
   <View style={s.grow}>
    <Text style={s.primaryText}>{author}</Text>
    <Text style={s.muted}>@{post.profiles?.handle||'conecta'} · {formatDate(post.created_at)}</Text>
   </View>
   <Text style={s.badge}>{visibility}</Text>
  </View>
  {post.moderation_status==='pending'&&post.author_id===userId&&
   <Text style={[s.badge,{marginTop:10}]}>⌛ Aguardando moderação automática</Text>}
  {post.moderation_status==='rejected'&&post.author_id===userId&&
   <Text style={[s.badge,{marginTop:10,color:t.danger}]}>Publicação não aprovada</Text>}
  <Text style={[s.primaryText,{fontSize:14,fontWeight:'400',lineHeight:22,marginTop:12}]}>
   {post.content}
  </Text>
  {images.map(path=><Media key={path} path={path}/>)}
  {!!videoPath&&<VideoMedia path={videoPath}/>} 
  <View style={s.separator}/>
  <View style={[s.row,{justifyContent:'space-between',flexWrap:'wrap',gap:9}]}>
   <Pressable onPress={()=>onLike(post)} hitSlop={9}>
    <Text style={[s.secondaryText,{color:liked?t.pink:t.primary,fontSize:13}]}>
     {liked?'♥':'♡'} {count} curtidas
    </Text>
   </Pressable>
   <Pressable accessibilityRole="button" accessibilityLabel="Ver comentários"
    accessibilityState={{expanded:commentsOpen}} onPress={()=>void toggleComments()}>
    <Text style={s.secondaryText}>◌ {comments} comentários {commentsOpen?'⌃':'⌄'}</Text>
   </Pressable>
   <Pressable accessibilityRole="button" accessibilityLabel={saved?'Remover dos salvos':'Salvar publicação'}
    accessibilityState={{selected:saved}} onPress={()=>onSave(post)}>
    <Text style={[s.secondaryText,saved&&{color:t.pink}]}>{saved?'▣ Salvo':'▢ Salvar'}</Text>
   </Pressable>
   <Pressable accessibilityRole="button" accessibilityLabel="Compartilhar publicação"
    onPress={()=>void Share.share({message:SITE_URL+'/post/'+encodeURIComponent(post.id)})
     .catch(()=>Alert.alert('Compartilhamento indisponível','Não foi possível abrir o compartilhamento do dispositivo.'))}>
    <Text style={s.secondaryText}>↗ Compartilhar</Text>
   </Pressable>
  </View>
  {post.author_id!==userId&&<ReportContent targetType="post" targetId={post.id} userId={userId}/>}
  {commentsOpen&&<View style={{marginTop:14,gap:10}}>
   <Text style={s.primaryText}>Comentários e respostas</Text>
   <ErrorNotice text={commentError}/>
   {loadingComments?<Loading text="Carregando comentários..."/>:
    commentRows.length===0?<Text style={s.muted}>Seja a primeira pessoa a comentar.</Text>:
    commentRows.filter(item=>!item.parent_id).map(root=><View key={root.id} style={{
     borderLeftWidth:2,borderLeftColor:t.line,paddingLeft:10,gap:6
    }}>
     <View style={[s.row,{gap:7}]}>
      <Avatar path={root.profiles?.avatar_path} name={root.profiles?.display_name||'Pessoa'} size={27}/>
      <Text style={s.primaryText}>{root.profiles?.display_name||'Pessoa'}</Text>
     </View>
     <Text style={{color:t.dark,fontSize:13}}>{root.body}</Text>
     {root.moderation_status!=='approved'&&root.author_id===userId&&
      <Text style={s.muted}>{root.moderation_status==='pending'?'Em análise':'Não aprovado'}</Text>}
     {root.moderation_status==='approved'&&
      <Pressable accessibilityRole="button" onPress={()=>setReplyTo(root)}>
       <Text style={s.secondaryText}>↩ Responder</Text>
      </Pressable>}
     {commentRows.filter(reply=>reply.parent_id===root.id).map(reply=><View key={reply.id}
      style={{marginLeft:15,paddingLeft:9,borderLeftWidth:1,borderColor:t.line,gap:4}}>
      <Text style={s.primaryText}>{reply.profiles?.display_name||'Pessoa'}</Text>
      <Text style={{fontSize:13,color:t.dark}}>{reply.body}</Text>
      {reply.moderation_status!=='approved'&&reply.author_id===userId&&
       <Text style={s.muted}>{reply.moderation_status==='pending'?'Em análise':'Não aprovado'}</Text>}
     </View>)}
    </View>)}
   {replyTo&&<View style={[s.row,{justifyContent:'space-between'}]}>
    <Text style={s.muted}>Respondendo a @{replyTo.profiles?.handle||'pessoa'}</Text>
    <Pressable accessibilityRole="button" onPress={()=>setReplyTo(null)}>
     <Text style={s.secondaryText}>Cancelar</Text>
    </Pressable>
   </View>}
   <Field value={commentBody} onChangeText={setCommentBody}
    placeholder={replyTo?'Escreva sua resposta...':'Escreva seu comentário...'}/>
   <Text style={[s.muted,{textAlign:'right'}]}>{commentBody.trim().length}/1000</Text>
   <Action label={sendingComment?'Enviando...':replyTo?'Enviar resposta':'Comentar'}
    disabled={sendingComment||!commentBody.trim()||commentBody.trim().length>1000}
    onPress={()=>void sendComment()}/>
  </View>}
 </View>;
}
function FeedScreen({userId}:{userId:string}){
 const [posts,setPosts]=useState<Post[]>([]),[liked,setLiked]=useState<Set<string>>(new Set());
 const [saved,setSaved]=useState<Set<string>>(new Set());
 const [feedView,setFeedView]=useState<'all'|'saved'>('all');
 const [text,setText]=useState(''),[visibility,setVisibility]=useState<'public'|'friends'|'private'>('public');
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [more,setMore]=useState(false),[loadingMore,setLoadingMore]=useState(false);
 const [draftReady,setDraftReady]=useState(false);
 const [media,setMedia]=useState<SelectedMedia[]>([]);
 const draftRevision=useRef(0);
 const draftKey='conecta-mobile-feed-draft:'+userId;
 useEffect(()=>{
  let mounted=true;
  // A session can change without remounting the Feed screen.
  // Never expose the previous account's unsent private draft or selected media.
  setDraftReady(false);setText('');setVisibility('public');setMedia([]);
  const revision=++draftRevision.current;
  void AsyncStorage.getItem(draftKey).then(raw=>{
   if(!mounted||revision!==draftRevision.current)return;
   if(raw){
    try{
     const draft=JSON.parse(raw) as {text?:unknown;visibility?:unknown};
     if(typeof draft.text==='string')setText(draft.text.slice(0,3000));
     if(draft.visibility==='public'||draft.visibility==='friends'||draft.visibility==='private')
      setVisibility(draft.visibility);
    }catch{/* Ignore corrupt local drafts. */}
   }
  }).catch(()=>{/* Drafts are optional offline convenience. */})
   .finally(()=>{if(mounted&&revision===draftRevision.current)setDraftReady(true);});
  return()=>{mounted=false;draftRevision.current++;};
 },[draftKey]);
 useEffect(()=>{
  if(!draftReady)return;
  const timer=setTimeout(()=>{
   const value=text?JSON.stringify({text,visibility}):null;
   void (value?AsyncStorage.setItem(draftKey,value):AsyncStorage.removeItem(draftKey))
    .catch(()=>{/* Storage errors must not block posting. */});
  },400);
  return()=>clearTimeout(timer);
 },[draftKey,draftReady,text,visibility]);
 const postLength=text.trim().length;
 const validPost=(postLength>0||media.length>0)&&postLength<=3000;
 const load=useCallback(async(offset=0)=>{
  const result=feedView==='saved'?
   {items:await loadSavedPosts(userId),more:false}:await loadFeed(offset);
  const ids=result.items.map(x=>x.id);
  const [ownLikes,ownSaved]=await Promise.all([myLikes(userId,ids),mySaved(userId,ids)]);
  setPosts(previous=>offset?[...previous.filter(p=>!ids.includes(p.id)),...result.items]:result.items);
  setLiked(previous=>new Set([...(!offset?[]:Array.from(previous)),...Array.from(ownLikes)]));
  setSaved(previous=>new Set([...(!offset?[]:Array.from(previous)),...Array.from(ownSaved)]));
  setMore(result.more);
 },[userId,feedView]);
 const refresh=useCallback(async()=>{
  setLoading(true);setError('');
  try{await load(0);}catch(e){setError(errorMessage(e));}
  finally{setLoading(false);}
 },[load]);
 useEffect(()=>{void refresh();},[refresh]);
 const pick=async(kind:'image'|'video'|'camera')=>{
  if(busy)return;
  setError('');
  try{
   if(kind==='camera'){
    const permission=await ImagePicker.requestCameraPermissionsAsync();
    if(!permission.granted)throw new Error('Permita o uso da câmera para tirar uma foto.');
   }
   const result=kind==='camera'
    ?await ImagePicker.launchCameraAsync({mediaTypes:['images'],quality:1})
    :await ImagePicker.launchImageLibraryAsync({
      mediaTypes:kind==='video'?['videos']:['images'],
      allowsMultipleSelection:kind==='image',selectionLimit:kind==='image'?5:1,
      orderedSelection:true,quality:1
     });
   if(!result.canceled)setMedia(normalizeMedia(result.assets));
  }catch(e){setError(errorMessage(e));}
 };
 const publish=async()=>{
  if(!validPost||busy)return;
  setBusy(true);setError('');
  try{
   if(media.length)await publishMediaPost(userId,text,visibility,media);
   else await publishTextPost(userId,text,visibility);
   setText('');setMedia([]);
   await AsyncStorage.removeItem(draftKey).catch(()=>{});
   await refresh();
   Alert.alert('Publicação enviada','O conteúdo segue as mesmas regras de moderação do site.');
  }catch(e){setError(errorMessage(e));}
  finally{setBusy(false);}
 };
 const toggleLike=async(post:Post)=>{
  if(busy)return;setBusy(true);setError('');
  const wasLiked=liked.has(post.id);
  try{
   await setLike(post.id,userId,wasLiked);
   setLiked(old=>{const next=new Set(old);if(wasLiked)next.delete(post.id);else next.add(post.id);return next;});
   setPosts(old=>old.map(item=>item.id===post.id?
    {...item,post_likes:[{count:Math.max(0,(item.post_likes?.[0]?.count||0)+(wasLiked?-1:1))}]}:item));
  }catch(e){setError(errorMessage(e));}finally{setBusy(false);}
 };
 const toggleSave=async(post:Post)=>{
  if(busy)return;
  setBusy(true);setError('');
  const wasSaved=saved.has(post.id);
  try{
   await setSavedPost(post.id,userId,wasSaved);
   setSaved(previous=>{const next=new Set(previous);
    if(wasSaved)next.delete(post.id);else next.add(post.id);
    return next;
   });
   if(wasSaved&&feedView==='saved')setPosts(previous=>previous.filter(p=>p.id!==post.id));
  }catch(e){setError(errorMessage(e));}finally{setBusy(false);}
 };
 const composer=<View>
  <Heading title="Seu feed" subtitle="Compartilhe histórias e reencontre suas conexões."/>
  <StoryRail userId={userId}/>
  <View style={[s.row,{gap:8,marginBottom:10}]}>
   {([['all','Publicações'],['saved','Salvos']] as const).map(([key,label])=>
    <Pressable key={key} accessibilityRole="tab" accessibilityState={{selected:feedView===key}}
     onPress={()=>setFeedView(key)} style={[s.secondary,feedView===key&&{backgroundColor:t.primary}]}>
     <Text style={[s.secondaryText,feedView===key&&{color:'#FFF'}]}>{label}</Text>
    </Pressable>)}
  </View>
  {feedView==='all'&&<View style={s.card}>
   <Text style={[s.primaryText,{marginBottom:5}]}>No que você está pensando?</Text>
   <Field value={text} onChangeText={setText} placeholder="Conte algo para a sua rede..." multiline/>
    <Text accessibilityLiveRegion="polite" style={[s.muted,{textAlign:'right',marginBottom:10,color:postLength>3000?t.danger:t.muted}]}>{postLength}/3000 caracteres</Text>
   <View style={[s.row,{gap:7,marginBottom:12,flexWrap:'wrap'}]}>
    {(['public','friends','private'] as const).map(v=><Pressable key={v}
     accessibilityRole="radio" accessibilityState={{checked:visibility===v}}
      accessibilityLabel={v==='public'?'Público':v==='friends'?'Conexões':'Só eu'}
      onPress={()=>setVisibility(v)} style={[s.secondary,
       visibility===v&&{backgroundColor:t.primary}]}>
     <Text style={[s.secondaryText,visibility===v&&{color:'#FFF'}]}>
      {v==='public'?'Público':v==='friends'?'Conexões':'Só eu'}
     </Text>
    </Pressable>)}
   </View>
   <View style={[s.row,{gap:8,flexWrap:'wrap',marginBottom:12}]}>
    <Action secondary disabled={busy} label="▧ Fotos" onPress={()=>void pick('image')}/>
    <Action secondary disabled={busy} label="▶ Vídeo" onPress={()=>void pick('video')}/>
    <Action secondary disabled={busy} label="◎ Câmera" onPress={()=>void pick('camera')}/>
   </View>
   {media.length>0&&<View style={{marginBottom:12}}>
    <Text style={[s.primaryText,{marginBottom:8}]}>
     {media.length} {media[0].kind==='video'?'vídeo selecionado':'foto(s) selecionada(s)'}
    </Text>
    <View style={[s.row,{gap:8,flexWrap:'wrap'}]}>
     {media.map((item,index)=><View key={item.uri+'-'+index} style={{alignItems:'center',gap:5}}>
      {item.kind==='image'
       ?<Image source={{uri:item.uri}} style={{height:84,width:84,borderRadius:12}}/>
       :<View style={[s.secondary,{height:84,width:116,justifyContent:'center'}]}>
         <Text style={s.secondaryText}>▶ Vídeo</Text>
        </View>}
      <Pressable accessibilityRole="button" accessibilityLabel={'Remover mídia '+(index+1)}
       onPress={()=>setMedia(previous=>previous.filter((_,i)=>i!==index))}>
       <Text style={s.secondaryText}>Remover ×</Text>
      </Pressable>
     </View>)}
    </View>
   </View>}
   {(text.length>0||media.length>0)&&<Pressable accessibilityRole="button" accessibilityLabel="Descartar rascunho" onPress={()=>{
    setText('');setMedia([]);void AsyncStorage.removeItem(draftKey).catch(()=>{});
   }}><Text style={[s.secondaryText,{marginBottom:12}]}>Descartar rascunho</Text></Pressable>}
   <Action label={busy?'Publicando...':media.length?'Publicar mídia':'Publicar texto'}
    disabled={busy||!validPost} onPress={()=>void publish()}/>
   <Text style={[s.muted,{marginTop:8}]}>
    Até cinco fotos ou um vídeo de até 50 MB. Conteúdo sujeito às regras de moderação do Conecta.
   </Text>
  </View>}
  <ErrorNotice text={error}/>
 </View>;
 return <FlatList style={s.screen} data={posts} keyExtractor={item=>item.id}
  refreshControl={<RefreshControl refreshing={loading} onRefresh={()=>void refresh()} tintColor={t.primary}/>}
  ListHeaderComponent={composer}
  renderItem={({item})=><PostCard post={item} userId={userId}
   liked={liked.has(item.id)} saved={saved.has(item.id)}
   onLike={post=>void toggleLike(post)} onSave={post=>void toggleSave(post)}
   onComment={postId=>setPosts(current=>current.map(p=>p.id===postId?
    {...p,post_comments:[{count:(p.post_comments?.[0]?.count||0)+1}]}:p))}/>}
  ListEmptyComponent={!loading?<View style={s.empty}>
   <Text style={s.primaryText}>{feedView==='saved'?'Nenhuma publicação salva':'Nenhuma publicação ainda'}</Text>
   <Text style={s.muted}>{feedView==='saved'?'Use o botão Salvar nas publicações.':'Novidades da sua rede aparecerão aqui.'}</Text>
  </View>:<Loading/>}
  onEndReachedThreshold={0.4}
  onEndReached={()=>{if(loading||loadingMore||!more||feedView==='saved')return;setLoadingMore(true);
   void load(posts.length).catch(e=>setError(errorMessage(e))).finally(()=>setLoadingMore(false));}}
  ListFooterComponent={loadingMore?<Loading/>:<View style={{height:20}}/>}/>;
}

function ConnectionsScreen({userId,onConversation}:{
 userId:string;onConversation:(conversationId:string)=>void
}){
 const [links,setLinks]=useState<Friendship[]>([]),[people,setPeople]=useState<Profile[]>([]);
 const [query,setQuery]=useState(''),[filter,setFilter]=useState<'friends'|'received'|'discover'>('friends');
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const refresh=useCallback(async()=>{
  setLoading(true);setError('');
  try{
   const data=await loadConnections(userId);setLinks(data.friends);setPeople(data.people);
  }catch(e){setError(errorMessage(e));}finally{setLoading(false);}
 },[userId]);
 useEffect(()=>{void refresh();},[refresh]);
 const visible=useMemo(()=>people.filter(p=>{
  if(p.id===userId||!(p.display_name+' '+p.handle).toLowerCase().includes(query.toLowerCase()))return false;
  const rel=links.find(x=>x.requester_id===p.id||x.addressee_id===p.id);
  return filter==='friends'?rel?.status==='accepted':
   filter==='received'?rel?.status==='pending'&&rel.addressee_id===userId:!rel;
 }),[people,links,filter,query,userId]);
 const act=async(person:Profile,kind:'add'|'accept'|'remove'|'chat')=>{
  if(busy)return;setBusy(true);setError('');
  try{
   if(kind==='chat')onConversation(await startChat(person.id));
   else{
    const relation=links.find(x=>x.requester_id===person.id||x.addressee_id===person.id);
    await changeConnection(userId,person.id,kind,relation);await refresh();
   }
  }catch(e){setError(errorMessage(e));}finally{setBusy(false);}
 };
 return <FlatList style={s.screen} data={visible} keyExtractor={x=>x.id}
  refreshControl={<RefreshControl refreshing={loading} onRefresh={()=>void refresh()}/>}
  ListHeaderComponent={<View><Heading title="Conexões" subtitle="Pessoas que tornam a rede mais próxima."/>
   <Field value={query} onChangeText={setQuery} placeholder="Buscar nome ou @usuário"/>
   <View style={[s.row,{gap:7,marginVertical:8}]}>
    {([['friends','Minhas'],['received','Convites'],['discover','Descobrir']] as const)
     .map(([id,label])=><Pressable key={id} onPress={()=>setFilter(id)} style={[s.secondary,
      filter===id&&{backgroundColor:t.primary}]}><Text style={[s.secondaryText,
      filter===id&&{color:'#FFF'}]}>{label}</Text></Pressable>)}
   </View><ErrorNotice text={error}/></View>}
  renderItem={({item})=><View style={s.card}>
   <View style={[s.row,{gap:12}]}>
    <Avatar path={item.avatar_path} name={item.display_name} size={50}/>
    <View style={s.grow}><Text style={s.primaryText}>{item.display_name}</Text>
     <Text style={s.muted}>@{item.handle}</Text>
     {!!item.bio&&<Text numberOfLines={2} style={s.muted}>{item.bio}</Text>}
    </View>
   </View>
   <View style={[s.row,{marginTop:12,gap:7,flexWrap:'wrap'}]}>
    {filter==='friends'?<>
     <Action disabled={busy} label="Conversar" onPress={()=>void act(item,'chat')}/>
     <Action disabled={busy} secondary label="Desfazer" onPress={()=>void act(item,'remove')}/>
    </>:filter==='received'?<>
     <Action disabled={busy} label="Aceitar" onPress={()=>void act(item,'accept')}/>
     <Action disabled={busy} secondary label="Recusar" onPress={()=>void act(item,'remove')}/>
    </>:<Action disabled={busy} label="Conectar" onPress={()=>void act(item,'add')}/>}
   </View>
  </View>}
  ListEmptyComponent={!loading?<View style={s.empty}><Text style={s.muted}>Nenhuma conexão nesta categoria.</Text></View>:<Loading/>}
  ListFooterComponent={<View style={{height:25}}/>}/>;
}

function ChatScreen({userId,initialId}:{userId:string;initialId:string|null}){
 const [threads,setThreads]=useState<Thread[]>([]);
 const [active,setActive]=useState<string|null>(initialId);
 const [messages,setMessages]=useState<ChatMessage[]>([]);
 const [reactions,setReactions]=useState<ChatReaction[]>([]);
 const [replyTo,setReplyTo]=useState<ChatMessage|null>(null);
 const [searchOpen,setSearchOpen]=useState(false);
 const activeRef=useRef<string|null>(active);
 const historyInitialized=useRef(false);
 const [hasOlder,setHasOlder]=useState(false);
 const [loadingOlder,setLoadingOlder]=useState(false);
 const [compose,setCompose]=useState(''),[busy,setBusy]=useState(false);
 const messageLength=compose.trim().length;
 const validMessage=messageLength>0&&messageLength<=4000;
 const [loading,setLoading]=useState(true),[error,setError]=useState('');
 const loadInbox=useCallback(async()=>{
  try{setThreads(await loadThreads(userId));setError('');}
  catch(e){setError(errorMessage(e));}finally{setLoading(false);}
 },[userId]);
 const loadMessages=useCallback(async(id:string)=>{
  try{
   const loaded=await loadChatMessages(id);
   const loadedReactions=await loadChatReactions(loaded);
   if(activeRef.current!==id)return;
   setMessages(previous=>mergeChatPages(previous,loaded,id));
   setReactions(previous=>refreshChatReactionPage(previous,loadedReactions,loaded.map(m=>m.id)));
   if(!historyInitialized.current){
    historyInitialized.current=true;setHasOlder(loaded.length===60);
   }
   await readConversation(id,userId);
  }catch(e){if(activeRef.current===id)setError(errorMessage(e));}
 },[userId]);
 const loadOlder=async()=>{
  if(!active||loadingOlder||!hasOlder||messages.length===0)return;
  setLoadingOlder(true);setError('');
  try{
   const older=await loadOlderChatMessages(active,messages[0]);
   const olderReactions=await loadChatReactions(older);
   if(activeRef.current!==active)return;
   setMessages(previous=>mergeChatPages(previous,older,active));
   setReactions(previous=>refreshChatReactionPage(previous,olderReactions,older.map(m=>m.id)));
   setHasOlder(older.length===60);
  }catch(e){if(activeRef.current===active)setError(errorMessage(e));}
  finally{setLoadingOlder(false);}
 };
 useEffect(()=>{setActive(initialId);},[initialId]);
 useEffect(()=>{
  void loadInbox();
  const channel=supabase.channel('conecta-mobile-inbox-'+userId)
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'conversation_members',
    filter:'user_id=eq.'+userId},()=>{void loadInbox();})
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},
    ()=>{void loadInbox();}).subscribe();
  const timer=setInterval(()=>{void loadInbox();},30000);
  return()=>{clearInterval(timer);void supabase.removeChannel(channel);};
 },[loadInbox,userId]);
 useEffect(()=>{
  activeRef.current=active;
  historyInitialized.current=false;
  setHasOlder(false);
  if(!active)return;
  setMessages([]);setReactions([]);setReplyTo(null);setSearchOpen(false);void loadMessages(active);
  const channel=supabase.channel('conecta-mobile-thread-'+active)
    .on('postgres_changes',{event:'*',schema:'public',table:'messages',
     filter:'conversation_id=eq.'+active},()=>{void loadMessages(active);})
    .on('postgres_changes',{event:'*',schema:'public',table:'message_reactions'},
     ()=>{void loadMessages(active);}).subscribe();
  const timer=setInterval(()=>{void loadMessages(active);},18000);
  return()=>{clearInterval(timer);void supabase.removeChannel(channel);};
 },[active,loadMessages]);
 const send=async()=>{
  if(!active||!validMessage||busy)return;
  setBusy(true);setError('');
  try{await sendMessage(active,userId,compose,replyTo?.id||null);
   setCompose('');setReplyTo(null);await loadMessages(active);await loadInbox();}
  catch(e){setError(errorMessage(e));}finally{setBusy(false);}
 };
 const attach=async(kind:'image'|'video')=>{
  if(!active||busy)return;
  setError('');
  try{
   const result=await ImagePicker.launchImageLibraryAsync({
    mediaTypes:kind==='image'?['images']:['videos'],
    allowsMultipleSelection:false,quality:1
   });
   if(result.canceled)return;
   const chosen=normalizeMedia(result.assets)[0];
   setBusy(true);
   await sendChatMedia(active,userId,chosen,replyTo?.id||null);
   setReplyTo(null);
   await Promise.all([loadMessages(active),loadInbox()]);
  }catch(e){setError(errorMessage(e));}
  finally{setBusy(false);}
 };
 const selected=threads.find(t=>t.id===active);
 if(active)return <KeyboardAvoidingView style={{flex:1}}
  behavior={Platform.OS==='ios'?'padding':undefined} keyboardVerticalOffset={12}>
  <View style={[s.header,{justifyContent:'flex-start',gap:14}]}>
   <Pressable accessibilityRole="button" accessibilityLabel="Voltar para conversas" onPress={()=>setActive(null)} hitSlop={12}><Text style={{color:t.primary,fontSize:21}}>‹</Text></Pressable>
   <Avatar path={selected?.other?.avatar_path} name={selected?.title||'Conversa'} size={36}/>
   <View style={s.grow}><Text numberOfLines={1} style={s.primaryText}>{selected?.title||'Conversa'}</Text>
    <Text style={s.muted}>{selected?.group?'Grupo do Conecta':'Chat privado e seguro'}</Text></View>
   <Pressable accessibilityRole="button" accessibilityLabel="Pesquisar mensagens"
    accessibilityState={{expanded:searchOpen}} onPress={()=>setSearchOpen(open=>!open)}>
    <Text style={{fontSize:22,color:t.primary}}>⌕</Text>
   </Pressable>
  </View>
  {searchOpen&&<ChatSearch conversationId={active}
   onReply={message=>setReplyTo(message)} onClose={()=>setSearchOpen(false)}/>}
  <ErrorNotice text={error}/>
  <FlatList style={{flex:1,paddingHorizontal:12}} inverted
   data={[...messages].reverse()} keyExtractor={m=>m.id}
   contentContainerStyle={{paddingVertical:15}}
   renderItem={({item})=><ChatBubble message={item} userId={userId}
    quoted={messages.find(m=>m.id===item.reply_to)||null}
    reactions={reactions.filter(reaction=>reaction.message_id===item.id)}
    onReply={message=>setReplyTo(message)}
    onChanged={async()=>{await loadMessages(active);await loadInbox();}}/>}
   ListFooterComponent={hasOlder?<View style={{marginVertical:15,alignItems:'center'}}>
    <Action secondary disabled={loadingOlder} label={loadingOlder?'Carregando...':'Carregar mensagens antigas'}
     onPress={()=>void loadOlder()}/>
   </View>:null}
   ListEmptyComponent={<Loading text="Esta conversa ainda não tem mensagens."/>}/>
  <View style={{backgroundColor:'white',padding:12,borderTopWidth:1,borderTopColor:t.line}}>
   {replyTo&&<View style={[s.row,{justifyContent:'space-between',gap:8,marginBottom:7}]}>
    <Text style={[s.muted,{flex:1}]} numberOfLines={2}>↩ Respondendo: {replyTo.content||'Mídia compartilhada'}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Cancelar resposta"
     onPress={()=>setReplyTo(null)}><Text style={s.secondaryText}>✕</Text></Pressable>
   </View>}
   <Text accessibilityLiveRegion="polite" style={[s.muted,{textAlign:'right',marginBottom:5,color:messageLength>4000?t.danger:t.muted}]}>{messageLength}/4000</Text>
   <View style={[s.row,{gap:8,flexWrap:'wrap',marginBottom:9}]}>
    <Action secondary disabled={busy} label="▧ Foto" onPress={()=>void attach('image')}/>
    <Action secondary disabled={busy} label="▶ Vídeo" onPress={()=>void attach('video')}/>
   </View>
   <VoiceRecorder key={active} conversationId={active} userId={userId}
    replyTo={replyTo?.id||null}
    onSent={()=>{setReplyTo(null);void loadMessages(active);void loadInbox();}}/>
   <View style={[s.row,{gap:8}]}>
    <TextInput accessibilityLabel="Sua mensagem" value={compose} onChangeText={setCompose} multiline
     placeholder="Sua mensagem..." placeholderTextColor={t.muted} style={[s.input,{flex:1,maxHeight:120,marginVertical:0}]}/>
    <Action label={busy?'...':'Enviar'} disabled={busy||!validMessage} onPress={()=>void send()}/>
   </View>
  </View>
 </KeyboardAvoidingView>;
 return <FlatList style={s.screen} data={threads} keyExtractor={t=>t.id}
  refreshControl={<RefreshControl refreshing={loading} onRefresh={()=>void loadInbox()}/>}
  ListHeaderComponent={<View><Heading title="Mensagens" subtitle="Converse em privado com suas conexões."/>
    <ErrorNotice text={error}/></View>}
  renderItem={({item})=><Pressable style={s.card} onPress={()=>setActive(item.id)}>
   <View style={[s.row,{gap:12}]}>
    <Avatar path={item.other?.avatar_path} name={item.title} size={48}/>
    <View style={s.grow}>
     <Text style={s.primaryText}>{item.group?'♧ ':''}{item.title}</Text>
     <Text style={s.muted} numberOfLines={1}>{item.last}</Text>
    </View>
    {item.unread>0&&<View style={a.count}><Text style={{color:'white',fontSize:11,fontWeight:'800'}}>{item.unread}</Text></View>}
   </View>
  </Pressable>}
  ListEmptyComponent={!loading?<View style={s.empty}><Text style={s.primaryText}>Suas conversas aparecerão aqui.</Text>
    <Text style={[s.muted,{marginTop:7,textAlign:'center'}]}>Abra Pessoas e escolha Conversar para iniciar uma conversa.</Text>
  </View>:<Loading/>}/>;
}

function CommunityScreen({userId}:{userId:string}){
 const [items,setItems]=useState<Community[]>([]),[joined,setJoined]=useState<Set<string>>(new Set());
 const [query,setQuery]=useState(''),[busy,setBusy]=useState<string|null>(null);
 const [error,setError]=useState(''),[loading,setLoading]=useState(true);
 const load=useCallback(async()=>{
  setLoading(true);
  try{const result=await loadCommunities(userId);setItems(result.items);setJoined(result.joined);setError('');}
  catch(e){setError(errorMessage(e));}finally{setLoading(false);}
 },[userId]);
 useEffect(()=>{void load();},[load]);
 const filtered=items.filter(x=>(x.name+' '+(x.description||'')).toLowerCase().includes(query.toLowerCase().trim()));
 const toggle=async(c:Community)=>{
  setBusy(c.id);setError('');
  try{
   await changeMembership(userId,c.id,joined.has(c.id));
   setJoined(previous=>{
    const result=new Set(previous);if(result.has(c.id))result.delete(c.id);else result.add(c.id);return result;
   });
  }catch(e){setError(errorMessage(e));}finally{setBusy(null);}
 };
 return <FlatList style={s.screen} data={filtered} keyExtractor={x=>x.id}
  refreshControl={<RefreshControl refreshing={loading} onRefresh={()=>void load()}/>}
  ListHeaderComponent={<View><Heading title="Comunidades" subtitle="Descubra pessoas com os mesmos interesses."/>
   <Field value={query} onChangeText={setQuery} placeholder="Buscar comunidades"/>
   <ErrorNotice text={error}/></View>}
  renderItem={({item})=><View style={s.card}>
   <View style={[a.communityCover,{marginBottom:12}]}>
    <Text style={{fontSize:26}}>✳</Text><Text style={{color:'#FFF',fontWeight:'800',fontSize:12}}>CONECTA COMUNIDADES</Text>
   </View>
   <Text style={s.primaryText}>{item.name} {item.is_official?'✦':''}</Text>
   <Text style={[s.muted,{marginVertical:9}]}>{item.description||'Uma comunidade para compartilhar ideias.'}</Text>
   <View style={[s.row,{gap:8}]}>
    <Action label={joined.has(item.id)?'Participando ✓':'Participar'} secondary={joined.has(item.id)}
     disabled={busy!==null} onPress={()=>void toggle(item)}/>
    <Action secondary label="Explorar ↗" onPress={()=>void openOfficial('/comunidades/'+item.slug)}/>
   </View>
  </View>}
  ListEmptyComponent={!loading?<View style={s.empty}><Text style={s.muted}>Nenhuma comunidade encontrada.</Text></View>:<Loading/>}/>;
}

function NotificationsScreen({userId,onRead}:{userId:string;onRead:()=>void}){
 const [items,setItems]=useState<Notice[]>([]),[loading,setLoading]=useState(true);
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[onlyUnread,setOnlyUnread]=useState(false);
 const load=useCallback(async()=>{
  setLoading(true);
  try{setItems(await loadNotifications(userId));setError('');}
  catch(e){setError(errorMessage(e));}finally{setLoading(false);}
 },[userId]);
 useEffect(()=>{
  void load();
  const channel=supabase.channel('conecta-mobile-notifications-'+userId)
   .on('postgres_changes',{event:'*',schema:'public',table:'notifications',
    filter:'recipient_id=eq.'+userId},()=>{void load();}).subscribe();
  return()=>{void supabase.removeChannel(channel);};
 },[userId,load]);
 const mark=async(id?:string)=>{
  setBusy(true);
  try{await markNotifications(userId,id);await load();onRead();}catch(e){setError(errorMessage(e));}
  finally{setBusy(false);}
 };
 const unread=items.filter(n=>!n.read_at).length;
 return <FlatList style={s.screen} data={onlyUnread?items.filter(n=>!n.read_at):items}
  keyExtractor={x=>x.id}
  refreshControl={<RefreshControl refreshing={loading} onRefresh={()=>void load()}/>}
  ListHeaderComponent={<View><Heading title="Notificações" subtitle="Tudo que importa em suas conexões."/>
   <View style={[s.row,{justifyContent:'space-between',marginBottom:10}]}>
    <Action label={onlyUnread?'Mostrar todas':'Não lidas: '+unread} secondary onPress={()=>setOnlyUnread(x=>!x)}/>
    <Action label="Marcar como lidas" secondary disabled={busy||unread===0} onPress={()=>void mark()}/>
   </View><ErrorNotice text={error}/></View>}
  renderItem={({item})=><View style={[s.card,!item.read_at&&{borderColor:'#D8C9EF',borderWidth:2}]}>
   <Text style={s.primaryText}>{item.profiles?.display_name||'Alguém'} <Text style={{fontWeight:'400'}}>
    {noticeNames[item.kind]||'interagiu com você'}</Text></Text>
   <Text style={[s.muted,{marginTop:5}]}>{formatDate(item.created_at)}</Text>
   <View style={[s.row,{gap:10,marginTop:10}]}>
    {item.kind==='friend_request'||item.kind==='friend_accept'?
     <Action secondary label="Ver conexões ↗" onPress={()=>void openOfficial('/conexoes')}/>:
     item.entity_id?<Action secondary label="Ver publicação ↗" onPress={()=>void openOfficial('/post/'+item.entity_id)}/>:null}
    {!item.read_at&&<Action secondary disabled={busy} label="Marcar lida" onPress={()=>void mark(item.id)}/>}
   </View>
  </View>}
  ListEmptyComponent={!loading?<View style={s.empty}><Text style={s.muted}>Tudo em dia por aqui.</Text></View>:<Loading/>}/>;
}

function ProfileScreen({profile,onUpdate,onLogout}:{
 profile:Profile;onUpdate:(p:Profile)=>void;onLogout:()=>void
}){
 const [name,setName]=useState(profile.display_name),[bio,setBio]=useState(profile.bio||'');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [coverPath,setCoverPath]=useState<string|null>(null);
 useEffect(()=>{
  let alive=true;
  void loadCover(profile.id).then(path=>{if(alive)setCoverPath(path);})
   .catch(e=>{if(alive)setError(errorMessage(e));});
  return()=>{alive=false;};
 },[profile.id]);
 const pickProfilePhoto=async(kind:'avatar'|'cover')=>{
  if(busy)return;
  setError('');
  try{
   const result=await ImagePicker.launchImageLibraryAsync({
    mediaTypes:['images'],allowsMultipleSelection:false,quality:1
   });
   if(result.canceled)return;
   const selected=normalizeMedia(result.assets)[0];
   setBusy(true);
   const outcome=await changeProfilePhoto(profile.id,selected,kind);
   clearMediaCache();
   if(outcome.profile)onUpdate(outcome.profile);
   if(kind==='cover')setCoverPath(outcome.path);
   Alert.alert('Imagem atualizada',kind==='avatar'?'Sua foto aparece no Conecta.':'Sua capa foi atualizada.');
  }catch(e){setError(errorMessage(e));}
  finally{setBusy(false);}
 };
 const save=async()=>{
  setBusy(true);setError('');
  try{onUpdate(await updateMyProfile(profile.id,name,bio));
   Alert.alert('Perfil atualizado','As alterações já estão disponíveis no site e no aplicativo.');
  }catch(e){setError(errorMessage(e));}finally{setBusy(false);}
 };
 return <ScrollView style={s.screen} contentContainerStyle={{paddingBottom:28}}>
  <Heading title="Meu perfil" subtitle="Seu espaço, suas histórias e sua identidade."/>
  <View style={[s.card,{alignItems:'center',paddingVertical:19}]}>
   <View style={{width:'100%',borderRadius:16,overflow:'hidden',marginBottom:12}}>
    {coverPath?<Media path={coverPath} height={140}/>:
     <View style={[a.communityCover,{height:140,justifyContent:'center'}]}>
      <Text style={{color:'#FFF',fontWeight:'900',fontSize:24}}>conecta ✳</Text>
     </View>}
   </View>
   <Avatar name={profile.display_name} path={profile.avatar_path} size={86}/>
   <Text style={[s.title,{marginTop:12,fontSize:22}]}>{profile.display_name}</Text>
   <Text style={s.muted}>@{profile.handle}</Text>
   <View style={[s.row,{gap:7,marginTop:13,flexWrap:'wrap',justifyContent:'center'}]}>
    <Action secondary disabled={busy} label="Alterar foto" onPress={()=>void pickProfilePhoto('avatar')}/>
    <Action secondary disabled={busy} label="Alterar capa" onPress={()=>void pickProfilePhoto('cover')}/>
   </View>
   <Text style={[s.muted,{marginTop:8}]}>Fotos JPG, PNG ou WebP de até 8 MB.</Text>
  </View>
  <View style={s.card}>
   <Text style={s.primaryText}>Nome de exibição</Text>
   <Field value={name} onChangeText={setName} placeholder="Seu nome"/>
   <Text style={[s.primaryText,{marginTop:8}]}>Biografia</Text>
   <Field value={bio} onChangeText={setBio} placeholder="Conte algo sobre você..." multiline/>
   <ErrorNotice text={error}/>
   <Action disabled={busy} label={busy?'Salvando...':'Salvar perfil'} onPress={()=>void save()}/>
   <Text style={[s.muted,{marginTop:10}]}>Detalhes avançados de personalização continuam disponíveis no site.</Text>
  </View>
  <View style={s.card}>
   <Text style={[s.primaryText,{marginBottom:10}]}>Minha conta</Text>
   <Action secondary label="Abrir perfil completo ↗" onPress={()=>void openOfficial('/perfil')}/>
   <View style={{height:8}}/>
   <Action secondary label="Privacidade e segurança ↗" onPress={()=>void openOfficial('/configuracoes')}/>
   <View style={{height:8}}/>
   <Action secondary label="Sair deste dispositivo" onPress={onLogout}/>
  </View>
 </ScrollView>;
}

export default function App(){
 const [user,setUser]=useState<User|null>(null);
 const [profile,setProfile]=useState<Profile|null>(null);
 const [restricted,setRestricted]=useState<'onboarding'|'age-check'|null>(null);
 const [booting,setBooting]=useState(true),[error,setError]=useState('');
 const [tab,setTab]=useState<Tab>('feed');
 const [chatId,setChatId]=useState<string|null>(null);
 const [composeRequest,setComposeRequest]=useState(0);
 const [unreadCount,setUnreadCount]=useState(0);
 const refreshUnread=useCallback(async(userId:string)=>{
  try{setUnreadCount(await unreadNotificationCount(userId));}
  catch{/* Notification badge is optional; do not interrupt sign-in. */}
 },[]);
 const verify=useCallback(async()=>{
  try{
   const {data,error:authError}=await supabase.auth.getUser();
   if(authError||!data.user){
    setUser(null);setProfile(null);setRestricted(null);setBooting(false);return;
   }
   const next=await verifyAccess(data.user.id);
   setUser(data.user);setProfile(next.profile);
   setRestricted(next.status==='ok'?null:next.status);setError('');
  }catch(e){setError(errorMessage(e));}
  finally{setBooting(false);}
 },[]);
 useEffect(()=>{
  void verify();
  const {data:{subscription}}=supabase.auth.onAuthStateChange(event=>{
   if(event==='SIGNED_IN'||event==='SIGNED_OUT'||event==='USER_UPDATED'){
    // Avoid await inside auth callback to prevent locking Supabase auth internals.
    setTimeout(()=>{void verify();},0);
   }
  });
  const app=AppState.addEventListener('change',state=>{
   if(state==='active')void verify();
  });
  return()=>{subscription.unsubscribe();app.remove();};
 },[verify]);
 useEffect(()=>{
  if(!user||restricted){setUnreadCount(0);return;}
  const id=user.id;
  void refreshUnread(id);
  const channel=supabase.channel('conecta-mobile-unread-'+id)
   .on('postgres_changes',{event:'*',schema:'public',table:'notifications',
    filter:'recipient_id=eq.'+id},()=>{void refreshUnread(id);}).subscribe();
  const app=AppState.addEventListener('change',state=>{
   if(state==='active')void refreshUnread(id);
  });
  return()=>{app.remove();void supabase.removeChannel(channel);};
 },[user?.id,restricted,refreshUnread]);
 const logout=async()=>{
  await supabase.auth.signOut();clearMediaCache();setTab('feed');setChatId(null);
  setUnreadCount(0);setUser(null);setProfile(null);setRestricted(null);
 };
 const openConversation=(id:string)=>{setChatId(id);setTab('messages');};
 const navigate=(key:string)=>{
  if(key==='create'){
   setChatId(null);setTab('feed');setComposeRequest(previous=>previous+1);
   return;
  }
  if(key==='feed'||key==='connections'||key==='communities'||
     key==='profile'||key==='messages'||key==='reels'||key==='notifications'){
   setChatId(null);setTab(key);
  }
 };
 const render=()=>{
  if(!user||!profile)return null;
  if(tab==='feed')return <FeedScreen userId={user.id} profile={profile} composeRequest={composeRequest}/>;
  if(tab==='reels')return <ReelsScreen userId={user.id}/>;
  if(tab==='connections')return <ConnectionsScreen userId={user.id} onConversation={openConversation}/>;
  if(tab==='messages')return <ChatScreen userId={user.id} initialId={chatId}/>;
  if(tab==='communities')return <CommunityScreen userId={user.id}/>;
  if(tab==='notifications')return <NotificationsScreen userId={user.id} onRead={()=>void refreshUnread(user.id)}/>;
  return <ProfileScreen profile={profile} onUpdate={setProfile} onLogout={()=>void logout()}/>;
 };
 return <SafeAreaProvider>
  <SafeAreaView edges={['top','bottom','left','right']} style={s.page}>
  <StatusBar style="dark" hidden={Platform.OS==='android'}/>
  {Platform.OS==='android'&&<NavigationBar hidden style="light"/>}
  {booting?<View style={{flex:1,justifyContent:'center'}}><Loading text="Preparando seu Conecta..."/></View>:
   !user?<SignIn onSignedIn={()=>void verify()}/>:
   restricted?<Restricted status={restricted}
    onRetry={()=>void verify()} onLogout={()=>void logout()}/>:
   !profile?<View style={{flex:1,justifyContent:'center'}}>
    <ErrorNotice text={error||'Não foi possível carregar seu perfil.'}/>
    <Action label="Tentar novamente" onPress={()=>void verify()}/>
    <Action secondary label="Sair" onPress={()=>void logout()}/>
   </View>:
   <>
    <View style={[s.header,{paddingVertical:10,gap:9}]}>
     <Pressable accessibilityRole="button" accessibilityLabel="Ir para o início"
      onPress={()=>navigate('feed')} style={{flexShrink:1}}>
      <Brand compact/>
     </Pressable>
     <View style={[s.row,{gap:7,flexShrink:0}]}>
      <RoundIcon Icon={Search} label="Explorar pessoas" onPress={()=>navigate('connections')}
       active={tab==='connections'}/>
      <RoundIcon Icon={Clapperboard} label="Reels" onPress={()=>navigate('reels')}
       active={tab==='reels'}/>
      <RoundIcon Icon={MessageCircle} label="Conversas" onPress={()=>navigate('messages')}
       active={tab==='messages'}/>
      <RoundIcon Icon={Bell} label={unreadCount>0?
       unreadCount+' notificações não lidas':'Notificações'}
       badge={unreadCount} onPress={()=>navigate('notifications')}
       active={tab==='notifications'}/>
     </View>
    </View>
    {render()}
    <BottomNavigation tab={tab} onNavigate={navigate}/>
   </>}
  {Platform.OS!=='android'&&
   <NativeStatusBar barStyle="dark-content" backgroundColor={t.surface}/>}
 </SafeAreaView>
 </SafeAreaProvider>;
}
const a=StyleSheet.create({
 auth:{flexGrow:1,backgroundColor:t.bg,justifyContent:'center',padding:20},
 authArt:{backgroundColor:t.primaryDark,padding:30,borderRadius:28,
  minHeight:170,justifyContent:'center',marginBottom:-22},
 authBrand:{fontSize:37,fontWeight:'900',color:'#FFF',letterSpacing:-1.6},
 authCopy:{fontSize:14,lineHeight:22,color:'#ECE3FF',marginTop:8,maxWidth:270},
 authCard:{backgroundColor:'#FFF',borderRadius:24,padding:22,
  borderWidth:1,borderColor:t.line,elevation:3},
 bubble:{borderRadius:17,padding:11,maxWidth:'86%',marginVertical:4,borderWidth:1},
 count:{backgroundColor:t.primary,minWidth:23,height:23,borderRadius:13,
  alignItems:'center',justifyContent:'center'},
 communityCover:{height:105,borderRadius:16,backgroundColor:t.primaryDark,
  justifyContent:'center',alignItems:'center',gap:6},
 nav:{flexDirection:'row',backgroundColor:t.surface,borderTopWidth:1,borderColor:t.line,
  paddingTop:8,paddingBottom:Platform.OS==='android'?7:4},
 navItem:{flex:1,alignItems:'center',paddingVertical:6,borderRadius:14},
 navSelected:{backgroundColor:t.subtle},
 navIcon:{fontSize:22,color:t.muted,height:28},
 navText:{fontSize:10,fontWeight:'700',color:t.muted}
});
