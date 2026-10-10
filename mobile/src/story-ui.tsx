import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {Alert,AppState,Image,Modal,Platform,Pressable,ScrollView,Text,TextInput,View} from 'react-native';
import {StatusBar} from 'expo-status-bar';
import {NavigationBar} from 'expo-navigation-bar';
import {SafeAreaProvider,SafeAreaView} from 'react-native-safe-area-context';
import {ChevronLeft,ChevronRight,ExternalLink,Plus,X} from 'lucide-react-native';
import {VideoView,useVideoPlayer} from 'expo-video';
import * as ImagePicker from 'expo-image-picker';
import type {Story,Post} from './models';
import type {SelectedMedia} from './media-validation';
import {normalizeMedia} from './media-validation';
import {loadActiveStories,publishStory,removeStory} from './stories';
import {loadPermittedPost,signedMedia} from './data';
import {Avatar,Action,ErrorNotice,Loading,Media,VideoMedia,styles as s} from './ui';
import {theme as t,formatDate} from './theme';

const permissions:{label:string;value:'public'|'friends'|'private'}[]=[
 {label:'Conexões',value:'friends'},{label:'Público',value:'public'},{label:'Só eu',value:'private'}
];
const describe=(e:unknown)=>e instanceof Error?e.message:'Não foi possível concluir esta ação.';
/** Native video playback with progress and an end event (no fake player). */
function StoryVideo({path,onEnd,onProgress}:{
 path:string;onEnd:()=>void;onProgress:(fraction:number)=>void;
}){
 const [url,setUrl]=useState<string|null>(null);
 useEffect(()=>{let current=true;setUrl(null);
  void signedMedia(path).then(uri=>{if(current)setUrl(uri);});
  return()=>{current=false;};
 },[path]);
 return url?<PlayingStoryVideo key={url} url={url} onEnd={onEnd}
  onProgress={onProgress}/>:<Loading text="Carregando vídeo protegido..."/>;
}
function PlayingStoryVideo({url,onEnd,onProgress}:{
 url:string;onEnd:()=>void;onProgress:(fraction:number)=>void;
}){
 const player=useVideoPlayer(url);
 useEffect(()=>{player.play();return()=>player.pause();},[player]);
 useEffect(()=>{
  const listener=player.addListener('playToEnd',onEnd);
  const interval=setInterval(()=>{
   if(player.duration>0)onProgress(Math.min(1,player.currentTime/player.duration));
  },250);
  return()=>{listener.remove();clearInterval(interval);};
 },[player,onEnd,onProgress]);
 return <VideoView player={player} nativeControls={false} contentFit="contain"
  style={{width:'100%',height:420}}/>;
}


export function StoryRail({userId,onOpenPost}:{
 userId:string;onOpenPost?:(postId:string)=>void
}){
 const [stories,setStories]=useState<Story[]>([]);
 const [selected,setSelected]=useState<Story|null>(null);
 const [sharedPost,setSharedPost]=useState<Post|null>(null);
 const [sharedLoading,setSharedLoading]=useState(false);
 const [progress,setProgress]=useState(0);
 const [paused,setPaused]=useState(false);
 const [seen,setSeen]=useState<Set<string>>(new Set());
 const [file,setFile]=useState<SelectedMedia|null>(null);
 const [caption,setCaption]=useState('');
 const [visibility,setVisibility]=useState<'public'|'friends'|'private'>('friends');
 const [editing,setEditing]=useState(false);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const refresh=useCallback(async()=>{
  try{setStories(await loadActiveStories());setError('');}
  catch(e){setError(describe(e));}finally{setLoading(false);}
 },[]);
 useEffect(()=>{
  void refresh();
  const sub=AppState.addEventListener('change',state=>{if(state==='active')void refresh();});
  const timer=setInterval(()=>{if(AppState.currentState==='active')void refresh();},60000);
  return()=>{sub.remove();clearInterval(timer);};
 },[refresh]);

 const timeline=useMemo(()=>{
  const groups=new Map<string,Story[]>();
  for(const story of stories){
   if(Date.parse(story.expires_at)<=Date.now())continue;
   const values=groups.get(story.author_id)||[];
   values.push(story);groups.set(story.author_id,values);
  }
  return [...groups.entries()].sort(([a],[b])=>
    a===userId?-1:b===userId?1:0).flatMap(([,values])=>
     values.sort((a,b)=>a.created_at.localeCompare(b.created_at)));
 },[stories,userId]);
 const bubbles=useMemo(()=>{
  const group=new Map<string,Story>();
  for(const story of timeline)if(!group.has(story.author_id))group.set(story.author_id,story);
  return [...group.values()];
 },[timeline]);
 const selectedIndex=selected?timeline.findIndex(story=>story.id===selected.id):-1;
 const groupItems=selected?timeline.filter(story=>story.author_id===selected.author_id):[];
 const groupIndex=selected?groupItems.findIndex(story=>story.id===selected.id):-1;
 const open=useCallback((story:Story)=>{
  if(Date.parse(story.expires_at)<=Date.now()){void refresh();return;}
  setSelected(story);setSharedPost(null);setProgress(0);setPaused(false);
  setSeen(current=>new Set(current).add(story.id));
 },[refresh]);
 const close=useCallback(()=>{setSelected(null);setSharedPost(null);},[]);
 const advance=useCallback((step:1|-1)=>{
  const target=timeline[selectedIndex+step];
  if(target)open(target);else close();
 },[timeline,selectedIndex,open,close]);
 const next=useCallback(()=>advance(1),[advance]);
 const trackVideo=useCallback((fraction:number)=>setProgress(fraction),[]);
 useEffect(()=>{
  const id=selected?.shared_post_id;
  if(!id){setSharedPost(null);setSharedLoading(false);return;}
  let active=true;setSharedLoading(true);setSharedPost(null);
  void loadPermittedPost(id,userId).then(post=>{
   if(active&&post?.visibility==='public'&&post.moderation_status==='approved')
    setSharedPost(post);
  }).catch(e=>{if(active)setError(describe(e));}).finally(()=>{
   if(active)setSharedLoading(false);
  });
  return()=>{active=false;};
 },[selected?.id,selected?.shared_post_id,userId]);
 useEffect(()=>{
  if(!selected||paused||selected.media_type==='video')return;
  const started=Date.now()-progress*6500;
  const timer=setInterval(()=>{
   const fraction=Math.min(1,(Date.now()-started)/6500);
   setProgress(fraction);
   if(fraction>=1)next();
  },130);
  return()=>clearInterval(timer);
  // Playback progress resets only when opening a different Story.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[selected?.id,paused,next]);
 const pick=async(mode:'image'|'video'|'camera')=>{
  setError('');
  try{
   if(mode==='camera'){
    const permission=await ImagePicker.requestCameraPermissionsAsync();
    if(!permission.granted)throw new Error('Autorize a câmera para capturar o Story.');
   }
   const response=mode==='camera'
    ?await ImagePicker.launchCameraAsync({mediaTypes:['images'],quality:1}):
    await ImagePicker.launchImageLibraryAsync({
     mediaTypes:mode==='video'?['videos']:['images'],allowsMultipleSelection:false,quality:1
    });
   if(response.canceled)return;
   const asset=normalizeMedia(response.assets)[0];
   setFile(asset);setEditing(true);
  }catch(e){setError(describe(e));}
 };
 const publish=async()=>{
  if(!file||busy||caption.trim().length>300)return;
  setBusy(true);setError('');
  try{
   await publishStory(userId,file,caption,visibility);
   setFile(null);setCaption('');setVisibility('friends');setEditing(false);
   await refresh();
   Alert.alert('Story enviado','Seu Story ficará disponível por até 24 horas, sujeito à moderação.');
  }catch(e){setError(describe(e));}
  finally{setBusy(false);}
 };
 const deleteSelected=()=>{
  if(!selected||selected.author_id!==userId||busy)return;
  const story=selected;
  Alert.alert('Excluir Story?','Esta ação não pode ser desfeita.',[
   {text:'Cancelar',style:'cancel'},
   {text:'Excluir',style:'destructive',onPress:()=>{void (async()=>{
    setBusy(true);setError('');
    try{await removeStory(userId,story);close();await refresh();}
    catch(e){setError(describe(e));}
    finally{setBusy(false);}
   })();}}
  ]);
 };
 return <View style={[s.card,{padding:13}]}>
  <View style={[s.row,{justifyContent:'space-between',marginBottom:11}]}>
   <View><Text style={s.primaryText}>✳ Stories</Text>
    <Text style={s.muted}>Momentos que duram até 24 horas</Text></View>
   <Action secondary label="Atualizar" onPress={()=>void refresh()}/>
  </View>
  <ScrollView horizontal showsHorizontalScrollIndicator={false}
   contentContainerStyle={{alignItems:'center',gap:11,paddingBottom:6}}>
   <Pressable accessibilityRole="button" accessibilityLabel="Criar Story"
    onPress={()=>{setEditing(x=>!x);setError('');}}
    style={{width:72,alignItems:'center',gap:4}}>
    <View style={{borderWidth:2,borderColor:t.pink,borderRadius:40,padding:4}}>
     <View style={{backgroundColor:t.subtle,borderRadius:30,width:47,height:47,
      justifyContent:'center',alignItems:'center'}}>
      <Plus size={27} color={t.primary} strokeWidth={2.3}/>
     </View>
    </View>
    <Text numberOfLines={1} style={s.muted}>Seu Story</Text>
   </Pressable>
   {bubbles.map(story=><Pressable key={story.id} accessibilityRole="button"
    accessibilityLabel={'Ver Story de '+(story.profiles?.display_name||'pessoa')}
    onPress={()=>open(story)}
    style={{width:75,alignItems:'center',gap:4}}>
    <View style={{borderWidth:2,borderColor:seen.has(story.id)?t.line:t.pink,borderRadius:40,padding:3}}>
     <Avatar path={story.profiles?.avatar_path} name={story.profiles?.display_name||'Pessoa'} size={49}/>
    </View>
    <Text numberOfLines={1} style={s.muted}>{story.author_id===userId?'Você':story.profiles?.display_name||'Pessoa'}</Text>
    {story.moderation_status!=='approved'&&<Text style={[s.muted,{color:t.primary}]}>Em análise</Text>}
   </Pressable>)}
   {!loading&&stories.length===0&&<Text style={s.muted}>Nenhum Story ativo</Text>}
  </ScrollView>
  {editing&&<View style={{marginTop:12,borderTopColor:t.line,borderTopWidth:1,paddingTop:12,gap:8}}>
   <Text style={s.primaryText}>Compartilhar um momento</Text>
   <View style={[s.row,{gap:7,flexWrap:'wrap'}]}>
    <Action secondary disabled={busy} label="Foto" onPress={()=>void pick('image')}/>
    <Action secondary disabled={busy} label="Vídeo" onPress={()=>void pick('video')}/>
    <Action secondary disabled={busy} label="Câmera" onPress={()=>void pick('camera')}/>
   </View>
   {file&&<>
    {file.kind==='image'?<Image source={{uri:file.uri}}
      style={{width:'100%',height:195,borderRadius:14}} resizeMode="contain"/>:
     <Text style={s.secondaryText}>▶ Vídeo selecionado — reprodução disponível após publicar</Text>}
    <TextInput accessibilityLabel="Legenda do Story" value={caption} onChangeText={setCaption}
     maxLength={300} placeholder="Legenda opcional (até 300 caracteres)"
     placeholderTextColor={t.muted} multiline style={s.input}/>
    <Text style={[s.muted,{textAlign:'right'}]}>{caption.length}/300</Text>
    <View style={[s.row,{gap:6,flexWrap:'wrap'}]}>
     {permissions.map(p=><Pressable key={p.value} accessibilityRole="radio"
      accessibilityState={{checked:visibility===p.value}} onPress={()=>setVisibility(p.value)}
      style={[s.secondary,visibility===p.value&&{backgroundColor:t.primary}]}>
      <Text style={[s.secondaryText,visibility===p.value&&{color:'#FFF'}]}>{p.label}</Text>
     </Pressable>)}
    </View>
    <Action disabled={busy||caption.trim().length>300}
     label={busy?'Publicando...':'Publicar Story'} onPress={()=>void publish()}/>
   </>}
   <Action secondary disabled={busy} label="Cancelar" onPress={()=>{setEditing(false);setFile(null);setCaption('');}}/>
  </View>}
  <ErrorNotice text={error}/>
  <Modal visible={Boolean(selected)} animationType="slide"
   onRequestClose={()=>setSelected(null)}>
   <SafeAreaProvider>
    <SafeAreaView edges={['top','bottom','left','right']}
     style={{flex:1,backgroundColor:t.dark,paddingTop:12,paddingHorizontal:16,paddingBottom:22}}>
     <StatusBar style="light" hidden={Platform.OS==='android'}/>
     {Platform.OS==='android'&&<NavigationBar hidden style="dark"/>}
    <View style={[s.row,{gap:10,marginBottom:16}]}>
     <Avatar path={selected?.profiles?.avatar_path} name={selected?.profiles?.display_name||'Pessoa'} size={43}/>
     <View style={{flex:1}}>
      <Text style={{color:'#FFF',fontWeight:'800'}}>{selected?.profiles?.display_name||'Story'}</Text>
      <Text style={{color:'#E0D4F5',fontSize:12}}>{selected?formatDate(selected.created_at):''}</Text>
     </View>
     <Pressable accessibilityRole="button" accessibilityLabel="Fechar Story"
      onPress={()=>setSelected(null)}><X color="#FFF" size={25}/></Pressable>
    </View>
    {selected?.media_type==='image'?
     <Media path={selected.media_path} height={420}/>:
     selected?.media_type==='video'?<VideoMedia path={selected.media_path}/>:null}
    {!!selected?.caption&&<Text style={{color:'#FFF',fontSize:17,marginTop:20,textAlign:'center'}}>
     {selected.caption}
    </Text>}
    {selected?.author_id===userId&&<View style={{marginTop:24}}>
     <Action secondary disabled={busy} label={busy?'Excluindo...':'Excluir meu Story'}
      onPress={deleteSelected}/>
    </View>}
    {selected?.moderation_status!=='approved'&&selected?.author_id===userId&&
     <Text style={{color:'#F4C6D5',fontSize:12,marginTop:14,textAlign:'center'}}>
      Conteúdo em análise e visível somente conforme permissões da moderação.
     </Text>}
    </SafeAreaView>
   </SafeAreaProvider>
  </Modal>
 </View>;
}
