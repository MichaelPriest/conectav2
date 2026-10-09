import React,{useCallback,useEffect,useState} from 'react';
import {FlatList,Pressable,RefreshControl,Share,Text,View} from 'react-native';
import type {Post} from './models';
import {loadPublicReels,myLikes,setLike} from './data';
import {Action,Avatar,ErrorNotice,Heading,Loading,VideoMedia,styles as s} from './ui';
import {SITE_URL} from './supabase';
import {theme as t,formatDate} from './theme';

const describe=(e:unknown)=>e instanceof Error?e.message:'Não foi possível carregar os vídeos.';

export function ReelsScreen({userId}:{userId:string}){
 const [items,setItems]=useState<Post[]>([]);
 const [likes,setLikes]=useState<Set<string>>(new Set());
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState<string|null>(null);
 const [error,setError]=useState('');
 const refresh=useCallback(async()=>{
  setLoading(true);setError('');
  try{
   const posts=await loadPublicReels();
   setItems(posts);
   setLikes(await myLikes(userId,posts.map(post=>post.id)));
  }catch(e){setError(describe(e));}finally{setLoading(false);}
 },[userId]);
 useEffect(()=>{void refresh();},[refresh]);
 const toggleLike=async(post:Post)=>{
  if(busy)return;
  const wasLiked=likes.has(post.id);
  setBusy(post.id);setError('');
  try{
   await setLike(post.id,userId,wasLiked);
   setLikes(previous=>{
    const next=new Set(previous);
    if(wasLiked)next.delete(post.id);else next.add(post.id);
    return next;
   });
   setItems(previous=>previous.map(item=>item.id===post.id?{
    ...item,post_likes:[{count:Math.max(0,(item.post_likes?.[0]?.count||0)+(wasLiked?-1:1))}]
   }:item));
  }catch(e){setError(describe(e));}finally{setBusy(null);}
 };
 return <FlatList style={s.screen} data={items} keyExtractor={item=>item.id}
  refreshControl={<RefreshControl refreshing={loading} onRefresh={()=>void refresh()} tintColor={t.primary}/>}
  ListHeaderComponent={<View>
   <Heading title="Reels" subtitle="Vídeos públicos da comunidade, no seu controle."/>
   <Text style={[s.muted,{marginBottom:10}]}>A publicação dos vídeos está disponível no Feed.</Text>
   <ErrorNotice text={error}/>
  </View>}
  renderItem={({item})=>{
   const path=item.post_media?.find(x=>x.media_type==='video')?.storage_path||
    (item.media_type==='video'?item.media_path:null);
   if(!path)return null;
   const liked=likes.has(item.id);
   return <View style={s.card}>
    <View style={[s.row,{gap:10}]}>
     <Avatar path={item.profiles?.avatar_path}
      name={item.profiles?.display_name||'Pessoa'} size={42}/>
     <View style={{flex:1}}>
      <Text style={s.primaryText}>{item.profiles?.display_name||'Pessoa do Conecta'}</Text>
      <Text style={s.muted}>@{item.profiles?.handle||'conecta'} · {formatDate(item.created_at)}</Text>
     </View>
    </View>
    <VideoMedia path={path}/>
    {!!item.content&&<Text style={[s.primaryText,{fontWeight:'400',marginVertical:13,lineHeight:21}]}>
     {item.content}
    </Text>}
    <View style={[s.row,{gap:10,flexWrap:'wrap',marginTop:12}]}>
     <Action secondary disabled={busy!==null}
      label={(liked?'♥':'♡')+' '+(item.post_likes?.[0]?.count||0)}
      onPress={()=>void toggleLike(item)}/>
     <Text style={s.muted}>◌ {item.post_comments?.[0]?.count||0} comentários</Text>
     <Pressable accessibilityRole="button" accessibilityLabel="Compartilhar vídeo"
      onPress={()=>{void Share.share({message:SITE_URL+'/post/'+item.id}).catch(e=>setError(describe(e)));}}>
      <Text style={s.secondaryText}>↗ Compartilhar</Text>
     </Pressable>
    </View>
   </View>;
  }}
  ListEmptyComponent={!loading?<View style={s.empty}>
   <Text style={s.primaryText}>Nenhum Reel público disponível</Text>
   <Text style={s.muted}>Compartilhe um vídeo no Feed para participar.</Text>
  </View>:<Loading/>}
  ListFooterComponent={<View style={{height:25}}/>}/>;
}
