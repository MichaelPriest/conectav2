import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {Alert,FlatList,Linking,Pressable,RefreshControl,ScrollView,Text,TextInput,View} from 'react-native';
import {ArrowLeft,Bookmark,Check,Compass,Globe2,Heart,MapPin,MessageCircle,Music2,Search,ShieldCheck,UserPlus,UsersRound,Video} from 'lucide-react-native';
import {Action,Avatar,ErrorNotice,Heading,Loading,Media,VideoMedia,styles as s} from './ui';
import {GradientPanel} from './design';
import {LinkedMediaPreview} from './link-media-ui';
import {theme as t,formatDate} from './theme';
import type {Post,Profile,Friendship} from './models';
import {loadNativeExplore,filterDiscovery,loadNativePublicProfile} from './explore';
import type {DiscoverFilter,ExploreData,PublicProfileData} from './explore';
import {changeConnection,setUserBlocked,setLike,setSavedPost,myLikes,mySaved,startChat} from './data';

const detailsMessage=(e:unknown)=>e instanceof Error?e.message:'Não foi possível carregar este conteúdo.';
const FILTERS:DiscoverFilter[]=['Tudo','Pessoas','Comunidades','Publicações','Vídeos'];

function PublicPostCard({post,userId}:{post:Post;userId:string}){
 const [liked,setLiked]=useState(false),[saved,setSaved]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
  let live=true;
  void Promise.all([myLikes(userId,[post.id]),mySaved(userId,[post.id])])
   .then(([likes,saves])=>{if(live){setLiked(likes.has(post.id));setSaved(saves.has(post.id));}})
   .catch(()=>{});
  return()=>{live=false;};
 },[post.id,userId]);
 const toggle=async(kind:'like'|'save')=>{
  if(busy)return;
  setBusy(true);setError('');
  try{
   if(kind==='like'){await setLike(post.id,userId,liked);setLiked(v=>!v);}
   else{await setSavedPost(post.id,userId,saved);setSaved(v=>!v);}
  }catch(e){setError(detailsMessage(e));}
  finally{setBusy(false);}
 };
 return <View style={s.card}>
  <View style={[s.row,{gap:10,marginBottom:10}]}>
   <Avatar name={post.profiles?.display_name||'Conecta'} path={post.profiles?.avatar_path} size={39}/>
   <View style={{flex:1}}>
    <Text style={s.primaryText}>{post.profiles?.display_name||'Comunidade'}</Text>
    <Text style={s.muted}>@{post.profiles?.handle||'conecta'} · {formatDate(post.created_at)}</Text>
   </View>
  </View>
  {!!post.content&&<Text style={{color:t.dark,fontSize:14,lineHeight:21,marginBottom:8}}>{post.content}</Text>}
  {(post.post_media||[]).filter(m=>m.media_type==='image').slice(0,4).map(media=>
   <Media key={media.storage_path} path={media.storage_path} height={207} marginTop={7}/>)}
  {!post.post_media?.length&&post.media_type==='image'&&<Media path={post.media_path} height={207}/>}
  {post.media_type==='video'&&<VideoMedia path={post.media_path}/>}
  <LinkedMediaPreview content={post.content}/>
  <View style={[s.row,{gap:9,marginTop:13}]}>
   <Action secondary disabled={busy} label={liked?'Curtido':'Curtir'}
    leading={<Heart size={15} color={liked?t.pink:t.primary} fill={liked?t.pink:'none'}/>}
    onPress={()=>void toggle('like')}/>
   <Action secondary disabled={busy} label={saved?'Salvo':'Salvar'}
    leading={<Bookmark size={15} color={t.primary}/>}
    onPress={()=>void toggle('save')}/>
  </View>
  <ErrorNotice text={error}/>
 </View>;
}
function PublicProfile({userId,personId,onBack,onConversation}:{
 userId:string;personId:string;onBack:()=>void;onConversation:(id:string)=>void
}){
 const [state,setState]=useState<PublicProfileData|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const refresh=useCallback(async()=>{
  setLoading(true);setError('');
  try{setState(await loadNativePublicProfile(userId,personId));}
  catch(e){setError(detailsMessage(e));}
  finally{setLoading(false);}
 },[userId,personId]);
 useEffect(()=>{void refresh();},[refresh]);
 const updateFriend=async(action:'add'|'accept'|'remove')=>{
  if(!state||busy||state.blocked||state.blockedBy)return;
  setBusy(true);setError('');
  try{
   await changeConnection(userId,personId,action,state.relation||undefined);
   await refresh();
  }catch(e){setError(detailsMessage(e));}
  finally{setBusy(false);}
 };
 const toggleBlock=async()=>{
  if(!state||busy)return;
  setBusy(true);setError('');
  try{await setUserBlocked(userId,personId,state.blocked);await refresh();}
  catch(e){setError(detailsMessage(e));}
  finally{setBusy(false);}
 };
 const friend=state?.relation?.status==='accepted';
 const handle=state?.person.handle||'';
 const site=state?.details?.website;
 const safeSite=(()=>{
  if(!site)return null;
  try{const url=new URL(site);return ['https:','http:'].includes(url.protocol)?url.toString():null;}
  catch{return null;}
 })();
 return <ScrollView style={s.screen} contentContainerStyle={{paddingBottom:38}}>
  <View style={[s.row,{gap:9,marginTop:14,marginBottom:10}]}>
   <Pressable accessibilityRole="button" accessibilityLabel="Voltar ao explorar"
    onPress={onBack} style={[s.secondary,{width:42}]}><ArrowLeft color={t.primary} size={19}/></Pressable>
   <Text style={[s.primaryText,{fontSize:17,flex:1}]}>Perfil público</Text>
  </View>
  {loading?<Loading text="Carregando perfil..."/>:state&&<>
   <View style={[s.card,{padding:0,overflow:'hidden'}]}>
    {state.details?.cover_path?<Media path={state.details.cover_path} height={172} radius={0} marginTop={0}/>:
     <GradientPanel style={{height:172,minHeight:172,borderRadius:0}}>
      <Text style={{color:'#FFF',fontSize:18,fontWeight:'900'}}>Uma história para conhecer ✳</Text>
     </GradientPanel>}
    <View style={{alignItems:'center',padding:17}}>
     <View style={{marginTop:-48,padding:5,backgroundColor:'#FFF',borderRadius:60}}>
      <Avatar name={state.person.display_name} path={state.person.avatar_path} size={84}/>
     </View>
     <Text style={[s.title,{fontSize:23,textAlign:'center',marginTop:7}]}>{state.person.display_name}</Text>
     <Text style={{fontSize:13,fontWeight:'800',color:t.primary}}>@{handle}</Text>
     {!!state.details?.headline&&<Text style={[s.primaryText,{marginTop:9,textAlign:'center'}]}>
      {state.details.headline}
     </Text>}
     {!!state.person.bio&&<Text style={{color:t.dark,fontSize:13,lineHeight:20,
      textAlign:'center',marginTop:8}}>{state.person.bio}</Text>}
     {!!state.details?.city&&<View style={[s.row,{gap:5,marginTop:9}]}>
      <MapPin size={14} color={t.muted}/><Text style={s.muted}>{state.details.city}</Text>
     </View>}
     {!!state.details?.mood_text&&<Text style={[s.muted,{marginTop:8}]}>
      {state.details.favorite_emoji||'💜'} {state.details.mood_text}
     </Text>}
     {state.details?.interests?.length?<View style={[s.row,{flexWrap:'wrap',gap:7,marginTop:12,
      justifyContent:'center'}]}>
      {state.details.interests.map((item,index)=><View key={item+index}
       style={{backgroundColor:t.subtle,borderRadius:10,paddingHorizontal:10,paddingVertical:7}}>
       <Text style={{color:t.primary,fontSize:12,fontWeight:'700'}}>{item}</Text>
      </View>)}
     </View>:null}
     {safeSite&&<Action secondary label="Visitar site"
      leading={<Globe2 size={16} color={t.primary}/>}
      onPress={()=>void Linking.openURL(safeSite)}/>}
     <View style={[s.row,{gap:8,marginTop:16,flexWrap:'wrap',justifyContent:'center'}]}>
      {state.person.id===userId?<Text style={s.muted}>Este é seu perfil.</Text>:
       state.blocked?<Action secondary disabled={busy} label="Desbloquear" onPress={()=>void toggleBlock()}/>:
       state.blockedBy?<Text style={s.muted}>Perfil indisponível para interações.</Text>:<>
        {friend?<>
         <Action disabled={busy} label="Conversar" leading={<MessageCircle color="#FFF" size={16}/>}
          onPress={()=>void (async()=>{
           try{onConversation(await startChat(personId));}
           catch(e){setError(detailsMessage(e));}
          })()}/>
         <Action secondary disabled={busy} label="Desfazer amizade"
          onPress={()=>Alert.alert('Desfazer amizade?','Remover conexão com @'+handle+'?',[
           {text:'Cancelar',style:'cancel'},
           {text:'Desfazer',style:'destructive',onPress:()=>void updateFriend('remove')}
          ])}/>
        </>:state.relation?.status==='pending'?
         <Action secondary disabled={busy}
          label={state.relation.addressee_id===userId?'Aceitar convite':'Cancelar convite'}
          onPress={()=>void updateFriend(state.relation?.addressee_id===userId?'accept':'remove')}/>:
         <Action disabled={busy} label="Conectar" leading={<UserPlus color="#FFF" size={16}/>}
          onPress={()=>void updateFriend('add')}/>}
        <Action secondary disabled={busy} label="Bloquear"
         onPress={()=>Alert.alert('Bloquear @'+handle+'?','Esta pessoa não poderá interagir com você.',[
          {text:'Cancelar',style:'cancel'},
          {text:'Bloquear',style:'destructive',onPress:()=>void toggleBlock()}
         ])}/>
       </>}
     </View>
     {!!state.details?.music_url&&<View style={{marginTop:12}}>
      <Text style={s.muted}>Este perfil compartilhou uma música.</Text>
      <Action secondary label="Abrir música no site" leading={<Music2 color={t.primary} size={16}/>}
       onPress={()=>void Linking.openURL('https://conectav2-validacao.onrender.com/p/'+encodeURIComponent(handle))}/>
     </View>}
    </View>
   </View>
   <Text style={[s.primaryText,{fontSize:19,marginTop:17,marginBottom:7}]}>Publicações públicas</Text>
   {state.blocked||state.blockedBy?<View style={s.empty}>
    <ShieldCheck size={23} color={t.muted}/>
    <Text style={s.muted}>Conteúdo oculto pelas preferências de privacidade.</Text>
   </View>:state.posts.length?
    state.posts.map(post=><PublicPostCard key={post.id} post={post} userId={userId}/>):
    <View style={s.empty}><Text style={s.muted}>Ainda não há publicações públicas.</Text></View>}
  </>}
  <ErrorNotice text={error}/>
 </ScrollView>;
}
export function ExploreScreen({userId,onConversation,onOpenConnections,onOpenCommunity}:{
 userId:string;onConversation:(id:string)=>void;onOpenConnections:()=>void;
 onOpenCommunity:(slug:string)=>void
}){
 const [items,setItems]=useState<ExploreData>({people:[],communities:[],posts:[]});
 const [selected,setSelected]=useState<string|null>(null);
 const [query,setQuery]=useState(''),[filter,setFilter]=useState<DiscoverFilter>('Tudo');
 const [loading,setLoading]=useState(true),[error,setError]=useState('');
 const refresh=useCallback(async()=>{
  setLoading(true);setError('');
  try{setItems(await loadNativeExplore(userId));}
  catch(e){setError(detailsMessage(e));}
  finally{setLoading(false);}
 },[userId]);
 useEffect(()=>{void refresh();},[refresh]);
 const result=useMemo(()=>filterDiscovery(items,query,filter,userId),
  [items,query,filter,userId]);
 if(selected)return <PublicProfile userId={userId} personId={selected}
  onBack={()=>setSelected(null)} onConversation={onConversation}/>;
 return <ScrollView style={s.screen} keyboardShouldPersistTaps="handled"
  refreshControl={<RefreshControl refreshing={loading} onRefresh={()=>void refresh()}/>}
  contentContainerStyle={{paddingBottom:30}}>
  <Heading title="Explorar ✳" subtitle="Pessoas, comunidades e novas histórias do Conecta." eyebrow="descubra"/>
  <View style={[s.row,{backgroundColor:t.surface,borderColor:t.line,
   borderWidth:1,borderRadius:14,paddingHorizontal:12,marginBottom:10,gap:8}]}>
   <Search size={19} color={t.muted}/>
   <TextInput value={query} onChangeText={setQuery} accessibilityLabel="Pesquisar Conecta"
    placeholder="Pessoas, comunidades, publicações..." placeholderTextColor={t.muted}
    style={{flex:1,minHeight:48,fontSize:14,color:t.dark}}/>
  </View>
  <View style={[s.row,{gap:7,flexWrap:'wrap',marginBottom:12}]}>
   {FILTERS.map(item=><Pressable key={item} accessibilityRole="tab"
    accessibilityLabel={'Filtrar '+item} accessibilityState={{selected:item===filter}}
    onPress={()=>setFilter(item)}
    style={[s.secondary,item===filter&&{backgroundColor:t.primary}]}>
    <Text style={[s.secondaryText,item===filter&&{color:'#FFF'}]}>{item}</Text>
   </Pressable>)}
  </View>
  <Action secondary label="Minhas conexões e convites"
   leading={<UsersRound size={17} color={t.primary}/>} onPress={onOpenConnections}/>
  <ErrorNotice text={error}/>
  {loading&&<Loading text="Descobrindo histórias..."/>}
  {result.people.length>0&&<View style={{marginTop:18}}>
   <Text style={[s.primaryText,{fontSize:18,marginBottom:9}]}>Pessoas para conhecer</Text>
   {result.people.slice(0,25).map(person=><Pressable key={person.id}
    accessibilityRole="button" accessibilityLabel={'Ver perfil de '+person.display_name}
    onPress={()=>setSelected(person.id)}
    style={[s.card,{flexDirection:'row',gap:11,alignItems:'center'}]}>
    <Avatar path={person.avatar_path} name={person.display_name} size={47}/>
    <View style={{flex:1}}>
     <Text style={s.primaryText}>{person.display_name}</Text>
     <Text style={{fontSize:12,color:t.primary,fontWeight:'800'}}>@{person.handle}</Text>
     {!!person.bio&&<Text numberOfLines={2} style={[s.muted,{marginTop:4}]}>{person.bio}</Text>}
    </View>
    <UserPlus color={t.primary} size={18}/>
   </Pressable>)}
  </View>}
  {result.communities.length>0&&<View style={{marginTop:17}}>
   <Text style={[s.primaryText,{fontSize:18,marginBottom:9}]}>Comunidades</Text>
   {result.communities.slice(0,20).map(community=><View key={community.id} style={s.card}>
    <View style={[s.row,{gap:10}]}>
     <Avatar name={community.name} path={community.avatar_path} size={45}/>
     <View style={{flex:1}}>
      <Text style={s.primaryText}>{community.name}</Text>
      <Text style={s.muted} numberOfLines={2}>{community.description||'Um novo espaço para conhecer.'}</Text>
     </View>
    </View>
    <View style={{marginTop:9}}>
     <Action secondary label="Ver comunidade"
      onPress={()=>onOpenCommunity(community.slug)}/>
    </View>
   </View>)}
  </View>}
  {result.posts.length>0&&<View style={{marginTop:18}}>
   <Text style={[s.primaryText,{fontSize:18,marginBottom:9}]}>Publicações públicas</Text>
   {result.posts.slice(0,24).map(post=><PublicPostCard key={post.id} post={post} userId={userId}/>)}
  </View>}
  {!loading&&!result.people.length&&!result.communities.length&&!result.posts.length&&
   <View style={s.empty}>
    <Compass size={27} color={t.primary}/>
    <Text style={[s.primaryText,{marginTop:9}]}>Nenhum resultado encontrado</Text>
    <Text style={s.muted}>Tente uma busca diferente.</Text>
   </View>}
 </ScrollView>;
}
