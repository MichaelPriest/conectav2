import React,{useCallback,useEffect,useState} from 'react';
import {Alert,Modal,Pressable,ScrollView,Text,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Check,ChevronLeft,ShieldCheck,Trash2,UsersRound,X} from 'lucide-react-native';
import type {Community} from './models';
import {supabase} from './supabase';
import {Action,ErrorNotice,Field,Loading,styles as s} from './ui';
import {theme as t} from './theme';

type PendingPost={id:string;author_id:string;content:string|null;created_at:string;profiles:{handle:string;display_name:string;avatar_path:string|null}|null};
type Member={id:string;handle:string;display_name:string;avatar_path:string|null};
type Staff={user_id:string;role:string};
type Report={id:string;post_id:string;reason:string;created_at:string};

export function CommunityModerationScreen({community,userId,onClose}:{community:Community;userId:string;onClose:()=>void}){
 const [owner,setOwner]=useState(community.owner_id===userId);
 const [admin,setAdmin]=useState(community.owner_id===userId);
 const [authorized,setAuthorized]=useState(community.owner_id===userId);
 const [mode,setMode]=useState<'automatic'|'all'>('automatic');
 const [terms,setTerms]=useState('');
 const [queue,setQueue]=useState<PendingPost[]>([]);
 const [staff,setStaff]=useState<Staff[]>([]);
 const [members,setMembers]=useState<Member[]>([]);
 const [reports,setReports]=useState<Report[]>([]);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const load=useCallback(async()=>{
  setLoading(true);setError('');
  try{
   const {data:{session}}=await supabase.auth.getSession();
   if(session?.user.id!==userId)throw new Error('Sua sessão expirou. Entre novamente.');
   const own=community.owner_id===userId;
   const {data:team,error:teamError}=await supabase.from('community_staff').select('user_id,role').eq('community_id',community.id);
   if(teamError)throw teamError;
   const roles=(team||[]) as Staff[];
   const isAdmin=own||roles.some(person=>person.user_id===userId&&person.role==='admin');
   const isMod=isAdmin||roles.some(person=>person.user_id===userId);
   setOwner(own);setAdmin(isAdmin);setAuthorized(isMod);setStaff(roles);
   if(!isMod){setQueue([]);setMembers([]);setReports([]);setLoading(false);return;}
   const [settings,posts,complaints]=await Promise.all([
    supabase.from('community_settings').select('review_mode,blocked_terms').eq('community_id',community.id).maybeSingle(),
    supabase.from('posts').select('id,author_id,content,created_at,profiles!posts_author_id_fkey(handle,display_name,avatar_path)').eq('community_id',community.id).eq('moderation_status','pending').order('created_at',{ascending:true}).limit(100),
    supabase.from('community_reports').select('id,post_id,reason,created_at').eq('community_id',community.id).order('created_at',{ascending:false}).limit(40)
   ]);
   if(settings.error)throw settings.error;
   if(posts.error)throw posts.error;
   if(complaints.error)throw complaints.error;
   if(settings.data){setMode(settings.data.review_mode==='all'?'all':'automatic');setTerms(Array.isArray(settings.data.blocked_terms)?settings.data.blocked_terms.join(', '):'');}
   setQueue((posts.data||[]) as unknown as PendingPost[]);setReports((complaints.data||[]) as Report[]);
   // Do not silently hide members after Supabase's page-size limit.
   const memberIds:string[]=[];
   for(let offset=0;;offset+=200){
    const {data:page,error:e}=await supabase.from('community_members').select('user_id').eq('community_id',community.id).order('user_id').range(offset,offset+199);
    if(e)throw e;
    const rows=page||[];
    memberIds.push(...rows.map(x=>x.user_id));
    if(rows.length<200)break;
   }
   const ids=[...new Set(memberIds)];
   const profiles:Member[]=[];
   for(let offset=0;offset<ids.length;offset+=200){
    const batch=ids.slice(offset,offset+200);
    const {data:p,error:e}=await supabase.from('profiles').select('id,handle,display_name,avatar_path').in('id',batch);
    if(e)throw e;
    profiles.push(...((p||[]) as Member[]));
   }
   setMembers(profiles);
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível carregar a moderação.');}
  finally{setLoading(false);}
 },[community.id,community.owner_id,userId]);
 useEffect(()=>{void load();},[load]);
 const review=async(id:string,decision:'approve'|'reject')=>{
  if(busy)return;setBusy(true);setError('');setNotice('');
  try{const {error:e}=await supabase.rpc('review_community_post',{pid:id,decision,rationale:''});if(e)throw e;setNotice(decision==='approve'?'Publicação aprovada.':'Publicação rejeitada.');await load();}
  catch(e){setError(e instanceof Error?e.message:'Não foi possível revisar a publicação.');}
  finally{setBusy(false);}
 };
 const saveSettings=async()=>{
  if(!admin||busy)return;setBusy(true);setError('');setNotice('');
  try{const normalized=[...new Set(terms.split(',').map(x=>x.trim()).filter(Boolean))].slice(0,30);
   const {error:e}=await supabase.rpc('set_community_moderation',{cid:community.id,mode,terms:normalized});if(e)throw e;
   setNotice('Configuração de moderação salva.');await load();
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível salvar as regras.');}
  finally{setBusy(false);}
 };
 const changeRole=(person:Member,newRole:'admin'|'moderator'|null)=>{
  if(!owner||person.id===userId||busy)return;
  const label=newRole==='admin'?'administrador':newRole==='moderator'?'moderador':'remover cargo';
  Alert.alert('Alterar equipe',`Deseja ${label} para @${person.handle}?`,[
   {text:'Cancelar',style:'cancel'},
   {text:'Confirmar',onPress:()=>{void (async()=>{
    setBusy(true);setError('');setNotice('');
    try{const {error:e}=await supabase.rpc('manage_community_staff',{cid:community.id,subject:person.id,new_role:newRole});if(e)throw e;setNotice('Equipe atualizada.');await load();}
    catch(e){setError(e instanceof Error?e.message:'Não foi possível alterar o cargo.');}
    finally{setBusy(false);}
   })();}}
  ]);
 };
 const ban=(person:Member)=>{
  if(!authorized||person.id===userId||busy)return;
  Alert.alert('Remover participante',`Remover @${person.handle} desta comunidade?`,[
   {text:'Cancelar',style:'cancel'},
   {text:'Remover',style:'destructive',onPress:()=>{void (async()=>{
    setBusy(true);setError('');setNotice('');
    try{const {error:e}=await supabase.rpc('moderate_community_member',{cid:community.id,subject:person.id,decision:'ban',rationale:'Removido pela equipe da comunidade'});if(e)throw e;setNotice('Participante removido.');await load();}
    catch(e){setError(e instanceof Error?e.message:'Não foi possível remover o participante.');}
    finally{setBusy(false);}
   })();}}
  ]);
 };
 return <Modal visible animationType="slide" onRequestClose={onClose}>
  <SafeAreaView edges={['top','bottom','left','right']} style={s.page}>
   <View style={[s.header,{justifyContent:'space-between'}]}>
    <Pressable accessibilityRole="button" accessibilityLabel="Voltar da administração" onPress={onClose}><ChevronLeft size={24} color={t.dark}/></Pressable>
    <Text style={{fontSize:17,fontWeight:'900',color:t.dark,flex:1}}>Administração</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Fechar administração" onPress={onClose}><X size={22} color={t.dark}/></Pressable>
   </View>
   <ScrollView contentContainerStyle={{padding:16,paddingBottom:40,gap:10}}>
    <View style={s.card}>
     <View style={[s.row,{gap:8}]}><ShieldCheck color={t.primary} size={22}/><Text style={s.title}>{community.name}</Text></View>
     <Text style={s.sub}>Fila de aprovação, denúncias e equipe da comunidade.</Text>
    </View>
    <ErrorNotice text={error}/>{!!notice&&<Text accessibilityRole="alert" style={{color:'#26734D',fontWeight:'700'}}>{notice}</Text>}
    {loading?<Loading text="Carregando controles de moderação..."/>:!authorized?
     <View style={s.card}><Text style={s.primaryText}>Acesso restrito</Text><Text style={s.sub}>Somente o proprietário, administradores e moderadores podem administrar esta comunidade.</Text></View>:
     <>
      <View style={s.card}>
       <Text style={[s.title,{marginBottom:8}]}>Fila de aprovação ({queue.length})</Text>
       {!queue.length?<Text style={s.muted}>Nenhuma publicação pendente.</Text>:queue.map(post=><View key={post.id} style={{borderTopWidth:1,borderTopColor:t.line,paddingVertical:12,gap:7}}>
        <Text style={s.primaryText}>@{post.profiles?.handle||'usuário'} · {new Date(post.created_at).toLocaleString('pt-BR')}</Text>
        <Text style={s.sub}>{post.content||'[Publicação com mídia]'}</Text>
        <View style={[s.row,{gap:8}]}><Action disabled={busy} label="Aprovar" leading={<Check size={16} color="#FFF"/>} onPress={()=>void review(post.id,'approve')}/><Action disabled={busy} secondary label="Rejeitar" onPress={()=>void review(post.id,'reject')}/></View>
       </View>)}
      </View>
      {admin&&<View style={s.card}>
       <Text style={[s.title,{marginBottom:8}]}>Regras automáticas</Text>
       <Text style={s.primaryText}>Modo de revisão</Text>
       <View style={[s.row,{gap:8,marginTop:8,marginBottom:12}]}>
        <Action secondary={mode!=='automatic'} label="Automático" onPress={()=>setMode('automatic')}/>
        <Action secondary={mode!=='all'} label="Revisar tudo" onPress={()=>setMode('all')}/>
       </View>
       <Text style={s.primaryText}>Termos para revisão (separados por vírgulas)</Text>
       <Field value={terms} onChangeText={setTerms} multiline maxLength={2000} placeholder="spam, golpes, termos específicos..."/>
       <Action disabled={busy} label="Salvar regras" onPress={()=>void saveSettings()}/>
      </View>}
      <View style={s.card}>
       <View style={[s.row,{gap:8,marginBottom:8}]}><UsersRound color={t.primary} size={21}/><Text style={s.title}>Participantes ({members.length})</Text></View>
       {!members.length?<Text style={s.muted}>Nenhum participante encontrado.</Text>:members.map(person=>{
        const role=staff.find(x=>x.user_id===person.id)?.role;
        return <View key={person.id} style={{borderTopWidth:1,borderTopColor:t.line,paddingVertical:11,gap:6}}>
         <Text style={s.primaryText}>{person.display_name} · @{person.handle}{role?' · '+role:''}</Text>
         {owner&&person.id!==userId&&<View style={[s.row,{gap:6,flexWrap:'wrap'}]}>
          <Action secondary disabled={busy} label="Tornar moderador" onPress={()=>changeRole(person,'moderator')}/>
          <Action secondary disabled={busy} label="Tornar admin" onPress={()=>changeRole(person,'admin')}/>
          {!!role&&<Action secondary disabled={busy} label="Remover cargo" onPress={()=>changeRole(person,null)}/>}
         </View>}
         {person.id!==userId&&<Action secondary disabled={busy} label="Remover da comunidade" leading={<Trash2 size={15} color={t.primary}/>} onPress={()=>ban(person)}/>}
        </View>;
       })}
      </View>
      <View style={s.card}>
       <Text style={[s.title,{marginBottom:8}]}>Denúncias recentes ({reports.length})</Text>
       {!reports.length?<Text style={s.muted}>Nenhuma denúncia registrada.</Text>:reports.map(report=><View key={report.id} style={{borderTopWidth:1,borderTopColor:t.line,paddingVertical:10,gap:4}}>
        <Text style={s.primaryText}>{report.reason||'Denúncia sem motivo informado'}</Text>
        <Text style={s.muted}>{new Date(report.created_at).toLocaleString('pt-BR')}</Text>
       </View>)}
      </View>
     </>}
   </ScrollView>
  </SafeAreaView>
 </Modal>;
}
