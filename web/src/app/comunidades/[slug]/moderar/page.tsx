'use client';
import {FormEvent,useCallback,useEffect,useState} from 'react';
import {useParams} from 'next/navigation';
import Link from 'next/link';
import {ArrowLeft,Check,ShieldAlert,ShieldCheck,Trash2,Users,X} from 'lucide-react';
import {GuardedPage,useAuthProfile} from '@/components/app-shell';
import {ProfileAvatar} from '@/components/profile-avatar';
import {supabaseBrowser} from '@/lib/supabase/browser';

type Post={id:string;author_id:string;content:string;moderation_status:string;created_at:string;profiles:{display_name:string;handle:string;avatar_path:string|null}|null};
type Member={user_id:string};
type Person={id:string;display_name:string;handle:string;avatar_path:string|null};
type Staff={user_id:string;role:string};
type Report={id:string;post_id:string;reason:string;created_at:string};
export default function ModerationPanel(){
 const auth=useAuthProfile(),params=useParams<{slug:string}>();
 const [community,setCommunity]=useState<{id:string;name:string;owner_id:string|null}|null>(null);
 const [authorized,setAuthorized]=useState(false),[admin,setAdmin]=useState(false),[owner,setOwner]=useState(false);
 const [mode,setMode]=useState('automatic'),[blockedTerms,setBlockedTerms]=useState('');
 const [queue,setQueue]=useState<Post[]>([]),[staff,setStaff]=useState<Staff[]>([]);
 const [reports,setReports]=useState<Report[]>([]),[members,setMembers]=useState<Person[]>([]);
 const [user,setUser]=useState(''),[role,setRole]=useState('moderator');
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const load=useCallback(async()=>{
   if(!auth.user||!params.slug)return;
   setLoading(true);setError('');
   const db=supabaseBrowser();
   const {data:c,error:e}=await db.from('communities').select('id,name,owner_id').eq('slug',params.slug).maybeSingle();
   if(e||!c){setError(e?.message||'Comunidade não encontrada.');setLoading(false);return;}
   setCommunity(c);
   const {data:s}=await db.from('community_staff').select('user_id,role').eq('community_id',c.id);
   const own=c.owner_id===auth.user.id;const isAdmin=own||Boolean(s?.some(x=>x.user_id===auth.user!.id&&x.role==='admin'));
   const isMod=isAdmin||Boolean(s?.some(x=>x.user_id===auth.user!.id));
   setOwner(own);setAdmin(isAdmin);setAuthorized(isMod);
   if(!isMod){setLoading(false);return;}
   const [settings,posts,complaints,part]=await Promise.all([
     db.from('community_settings').select('review_mode,blocked_terms').eq('community_id',c.id).maybeSingle(),
     db.from('posts').select('id,author_id,content,moderation_status,created_at,profiles!posts_author_id_fkey(display_name,handle,avatar_path)')
       .eq('community_id',c.id).eq('moderation_status','pending').order('created_at',{ascending:true}).limit(100),
     db.from('community_reports').select('id,post_id,reason,created_at').eq('community_id',c.id)
       .order('created_at',{ascending:false}).limit(40),
     db.from('community_members').select('user_id').eq('community_id',c.id).limit(200)
   ]);
   if(settings.data){setMode(settings.data.review_mode);setBlockedTerms((settings.data.blocked_terms||[]).join(', '));}
   setQueue((posts.data||[]) as unknown as Post[]);setReports(complaints.data||[]);
   setStaff(s||[]);
   const ids=(part.data||[]).map((m:Member)=>m.user_id);
   if(ids.length){
     const {data:p}=await db.from('profiles').select('id,handle,display_name,avatar_path').in('id',ids);
     setMembers((p||[]) as Person[]);
   }else setMembers([]);
   if(posts.error||complaints.error||settings.error)
      setError(posts.error?.message||complaints.error?.message||settings.error?.message||'Erro ao consultar moderação.');
   setLoading(false);
 },[auth.user,params.slug]);
 useEffect(()=>{void load();},[load]);
 async function review(id:string,action:'approve'|'reject'){
   if(busy)return;setBusy(true);setError('');setNotice('');
   const {error:e}=await supabaseBrowser().rpc('review_community_post',{pid:id,decision:action,rationale:''});
   if(e)setError(e.message);else{setNotice(action==='approve'?'Publicação aprovada.':'Publicação rejeitada.');await load();}
   setBusy(false);
 }
 async function saveSettings(e:FormEvent){
   e.preventDefault();if(!community||!admin||busy)return;
   setBusy(true);setError('');
   const terms=[...new Set(blockedTerms.split(',').map(x=>x.trim()).filter(Boolean))].slice(0,30);
   const {error:e}=await supabaseBrowser().rpc('set_community_moderation',{cid:community.id,mode,terms});
   if(e)setError(e.message);else{setNotice('Configuração de moderação atualizada.');await load();}
   setBusy(false);
 }
 async function assign(e:FormEvent){
   e.preventDefault();if(!community||!owner||busy)return;
   const p=members.find(m=>m.handle===user);
   if(!p){setError('Escolha um participante da comunidade.');return;}
   setBusy(true);setError('');
   const {error:e}=await supabaseBrowser().rpc('manage_community_staff',{cid:community.id,subject:p.id,new_role:role==='none'?null:role});
   if(e)setError(e.message);else{setNotice('Cargo atualizado.');await load();}
   setBusy(false);
 }
 async function ban(id:string){
   if(!community||!confirm('Remover este membro da comunidade?'))return;
   setBusy(true);setError('');
   const {error:e}=await supabaseBrowser().rpc('moderate_community_member',{cid:community.id,subject:id,decision:'ban',rationale:'Removido pela equipe da comunidade'});
   if(e)setError(e.message);else{setNotice('Membro removido.');await load();}
   setBusy(false);
 }
 return <GuardedPage {...auth}><main className="section-page">
    <Link href={'/comunidades/'+params.slug} className="rail-link"><ArrowLeft size={17}/> Voltar à comunidade</Link>
    <div className="page-heading"><div><span className="section-eyebrow">EQUIPE DA COMUNIDADE</span>
      <h1><ShieldCheck size={27}/> Moderação e administração</h1>
      <p>{community?.name||'Comunidade'} · Publicações pendentes, denúncias e equipe.</p></div></div>
    {error&&<p className="form-error" role="alert">{error}</p>}
    {notice&&<p className="form-success">{notice}</p>}
    {loading?<p>Carregando moderação...</p>:!authorized?
       <section className="panel"><ShieldAlert size={25}/><h2>Somente equipe autorizada</h2><p>O proprietário, os administradores e os moderadores podem acessar esta área.</p></section>:
       <div className="conecta-moderation-layout">
        <section className="panel">
         <h2>Fila de aprovação ({queue.length})</h2>
         {queue.length===0?<p className="small-note">Nenhuma publicação aguardando decisão.</p>:
          queue.map(p=><article className="conecta-moderation-item" key={p.id}>
            <ProfileAvatar person={p.profiles} size="small"/><div><strong>@{p.profiles?.handle||'usuário'}</strong>
             <small>{new Date(p.created_at).toLocaleString('pt-BR')}</small><p>{p.content||'[Publicação com mídia]'}</p>
             <div className="row" style={{gap:8}}><button type="button" className="btn btn-primary" disabled={busy} onClick={()=>void review(p.id,'approve')}><Check size={16}/> Aprovar</button>
               <button type="button" className="btn btn-outline" disabled={busy} onClick={()=>void review(p.id,'reject')}><X size={16}/> Rejeitar</button></div>
            </div>
          </article>)}
        </section>
        <div className="stack">
         {admin&&<form className="panel stack" onSubmit={saveSettings}>
            <h2>Regras automáticas</h2>
            <label className="field-label">Modo de aprovação<select className="form-input" value={mode} onChange={e=>setMode(e.target.value)}>
             <option value="automatic">Automático — sinalizar spam e termos proibidos</option>
             <option value="all">Revisar todas as publicações</option>
            </select></label>
            <label className="field-label">Expressões para revisão (separadas por vírgulas)
             <textarea className="form-input" rows={3} maxLength={2000} value={blockedTerms} onChange={e=>setBlockedTerms(e.target.value)}
               placeholder="spam, golpes, expressões específicas..."/></label>
            <p className="small-note">Regras simples colocam publicações suspeitas em revisão. A IA multilíngue ainda depende de serviço de inferência e não está sendo executada.</p>
            <button className="btn btn-primary" type="submit" disabled={busy}>Salvar regras</button>
         </form>}
         {owner&&<form className="panel stack" onSubmit={assign}>
           <h2><Users size={18}/> Administradores e moderadores</h2>
           <label className="field-label">Participante<select value={user} required className="form-input" onChange={e=>setUser(e.target.value)}>
             <option value="">Escolher participante</option>{members.filter(m=>m.id!==auth.user?.id).map(m=><option key={m.id} value={m.handle}>{m.display_name} (@{m.handle})</option>)}
           </select></label>
           <label className="field-label">Cargo<select value={role} className="form-input" onChange={e=>setRole(e.target.value)}>
             <option value="moderator">Moderador</option><option value="admin">Administrador</option><option value="none">Remover cargo</option>
           </select></label>
           <button className="btn btn-primary" type="submit" disabled={!user||busy}>Atualizar cargo</button>
           <p className="small-note">{staff.length} pessoas na equipe delegada.</p>
         </form>}
         <section className="panel"><h2>Denúncias recentes ({reports.length})</h2>
           {reports.length===0?<p className="small-note">Nenhuma denúncia recebida.</p>:
             reports.map(report=><article key={report.id} className="conecta-moderation-report">
               <p>{report.reason}</p><small>{new Date(report.created_at).toLocaleDateString('pt-BR')}</small>
               <Link href={'/post/'+report.post_id}>Ver publicação</Link>
             </article>)}
         </section>
         <section className="panel"><h2>Gerenciar participantes</h2>
           <div className="conecta-moderation-members">{members.map(p=><div key={p.id}>
             <ProfileAvatar person={p} size="small"/><Link href={'/p/'+p.handle}>{p.display_name}</Link>
             {p.id!==auth.user?.id&&<button className="icon-btn" type="button" disabled={busy} title="Remover membro" onClick={()=>void ban(p.id)}><Trash2 size={16}/></button>}
           </div>)}</div>
         </section>
        </div>
       </div>}
  </main></GuardedPage>;
}
