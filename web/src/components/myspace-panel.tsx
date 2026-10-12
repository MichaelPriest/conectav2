'use client';
import {FormEvent,useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {Heart,MessageSquare,Send,Star,Trash2} from 'lucide-react';
import {ProfileAvatar} from '@/components/profile-avatar';
import {supabaseBrowser} from '@/lib/supabase/browser';
type Person={id:string;display_name:string;handle:string;avatar_path:string|null};
type Favorite={profile_id:string;friend_id:string;position:number};
type Recado={id:string;profile_id:string;author_id:string;body:string;created_at:string};
type Testimonial={id:string;profile_id:string;author_id:string;body:string;status:'pending'|'published';created_at:string};
export function MySpacePanel({profileId,viewerId,isSelf=false}:{profileId:string;viewerId:string;isSelf?:boolean}){
 const [favorites,setFavorites]=useState<Favorite[]>([]),[friends,setFriends]=useState<Person[]>([]),[authors,setAuthors]=useState<Person[]>([]);
 const [recados,setRecados]=useState<Recado[]>([]),[message,setMessage]=useState('');
 const [testimonials,setTestimonials]=useState<Testimonial[]>([]),[testimonialDraft,setTestimonialDraft]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[connected,setConnected]=useState(false);
 const load=useCallback(async()=>{
   const db=supabaseBrowser();
   const [f,links,rec,test]=await Promise.all([
     db.from('profile_favorites').select('profile_id,friend_id,position').eq('profile_id',profileId).order('position'),
     db.from('friendships').select('requester_id,addressee_id').eq('status','accepted')
       .or('requester_id.eq.'+profileId+',addressee_id.eq.'+profileId),
     db.from('profile_guestbook').select('id,profile_id,author_id,body,created_at').eq('profile_id',profileId).order('created_at',{ascending:false}).limit(35),
     db.from('profile_testimonials').select('id,profile_id,author_id,body,status,created_at').eq('profile_id',profileId).order('created_at',{ascending:false}).limit(35)
   ]);
   if(f.error||links.error||rec.error||test.error)setError(f.error?.message||links.error?.message||rec.error?.message||test.error?.message||'Falha ao carregar o mural.');
   const ids=(links.data||[]).map(r=>r.requester_id===profileId?r.addressee_id:r.requester_id);
   setConnected(isSelf||ids.includes(viewerId));
   const unique=[...new Set([...ids,...(f.data||[]).map(x=>x.friend_id),...(rec.data||[]).map(x=>x.author_id),...(test.data||[]).map(x=>x.author_id)])];
   const people=unique.length?await db.from('profiles').select('id,display_name,handle,avatar_path').in('id',unique):{data:[],error:null};
   const personList=(people.data||[]) as Person[];
   setAuthors(personList);setFriends(personList.filter(p=>ids.includes(p.id)));
   setFavorites(f.data||[]);setRecados(rec.data||[]);setTestimonials((test.data||[]) as Testimonial[]);
 },[profileId,viewerId,isSelf]);
 useEffect(()=>{void load();},[load]);
 async function feature(friend:Person){
   if(!isSelf||busy)return;setBusy(true);setError('');
   const match=favorites.find(x=>x.friend_id===friend.id);
   const next=[1,2,3,4,5,6,7,8].find(p=>!favorites.some(x=>x.position===p));
   if(!match&&!next){setError('Até oito Conexões podem ser destacadas.');setBusy(false);return;}
   const db=supabaseBrowser();
   const {error:e}=match
    ?await db.from('profile_favorites').delete().eq('profile_id',profileId).eq('friend_id',friend.id)
    :await db.from('profile_favorites').insert({profile_id:profileId,friend_id:friend.id,position:next});
   if(e)setError(e.message);else await load();
   setBusy(false);
 }
 async function addRecado(event:FormEvent){
   event.preventDefault();if(!connected||isSelf||!message.trim()||busy)return;
   setBusy(true);setError('');
   const {error:e}=await supabaseBrowser().from('profile_guestbook').insert({profile_id:profileId,author_id:viewerId,body:message.trim()});
   if(e)setError(e.message);else{setMessage('');await load();}
   setBusy(false);
 }
 async function addTestimonial(event:FormEvent){
   event.preventDefault();
   if(!connected||isSelf||!testimonialDraft.trim()||busy||testimonials.some(t=>t.author_id===viewerId))return;
   setBusy(true);setError('');
   const {error:e}=await supabaseBrowser().from('profile_testimonials').insert({
     profile_id:profileId,author_id:viewerId,body:testimonialDraft.trim(),status:'pending'
   });
   if(e)setError(e.code==='23505'?'Você já enviou um depoimento para esta pessoa.':'Não foi possível enviar o depoimento: '+e.message);
   else{setTestimonialDraft('');await load();}
   setBusy(false);
 }
 async function approveTestimonial(id:string){
   if(!isSelf||busy)return;setBusy(true);setError('');
   const {error:e}=await supabaseBrowser().from('profile_testimonials').update({status:'published'}).eq('id',id);
   if(e)setError('Não foi possível publicar o depoimento: '+e.message);else await load();
   setBusy(false);
 }
 async function eraseTestimonial(id:string){
   if(busy)return;setBusy(true);setError('');
   const {error:e}=await supabaseBrowser().from('profile_testimonials').delete().eq('id',id);
   if(e)setError('Não foi possível excluir o depoimento: '+e.message);else await load();
   setBusy(false);
 }
 async function erase(id:string){
   if(busy)return;setBusy(true);
   const {error:e}=await supabaseBrowser().from('profile_guestbook').delete().eq('id',id);
   if(e)setError(e.message);else await load();
   setBusy(false);
 }
 const pinned=favorites.map(f=>authors.find(p=>p.id===f.friend_id)).filter((p):p is Person=>!!p);
 return <div className="conecta-myspace-panel">
  <section className="panel">
    <div className="feed-title"><h2><Star size={18}/> Conexões em destaque</h2><span className="small-note">{pinned.length}/8</span></div>
    {pinned.length?<div className="conecta-myspace-friends">{pinned.map(p=><Link key={p.id} href={'/p/'+p.handle}>
      <ProfileAvatar person={p} size="large"/><strong>{p.display_name}</strong></Link>)}</div>:
      <p className="small-note">Ninguém em destaque ainda.</p>}
    {isSelf&&friends.length>0&&<details className="conecta-myspace-manage"><summary>Escolher suas Conexões favoritas</summary>
      <div>{friends.map(p=><button key={p.id} className="btn btn-outline" type="button" disabled={busy}
       onClick={()=>void feature(p)}><Heart size={14}/>{p.display_name}{favorites.some(f=>f.friend_id===p.id)?' ✓':''}</button>)}</div>
    </details>}
  </section>
  <section className="panel">
    <div className="feed-title"><h2><MessageSquare size={18}/> Mural de recados</h2></div>
    <p className="small-note">Os recados são compartilhados com Conexões aceitas, não com desconhecidos.</p>
    {connected&&!isSelf&&<form className="conecta-guestbook-form" onSubmit={addRecado}>
      <textarea className="form-input" rows={3} maxLength={800} required value={message}
        onChange={e=>setMessage(e.target.value)} placeholder="Deixe um recado para esta Conexão..."/>
      <button type="submit" className="btn btn-primary" disabled={busy||!message.trim()}><Send size={15}/> Enviar recado</button>
    </form>}
    {error&&<p className="form-error" role="alert">{error}</p>}
    {recados.length?<div className="conecta-guestbook-list">{recados.map(r=>{
     const person=authors.find(p=>p.id===r.author_id);
     return <article className="conecta-guestbook-entry" key={r.id}><ProfileAvatar person={person} size="small"/>
       <div><strong>{person?.display_name||'Conexão'}</strong><small>{new Date(r.created_at).toLocaleDateString('pt-BR')}</small><p>{r.body}</p></div>
       {(isSelf||r.author_id===viewerId)&&<button type="button" disabled={busy} onClick={()=>void erase(r.id)} aria-label="Excluir recado"><Trash2 size={16}/></button>}
     </article>})}</div>:<p className="small-note">Sem recados por enquanto.</p>}
  </section>
  <section className="panel">
    <div className="feed-title"><h2><Heart size={18}/> Depoimentos</h2><span className="small-note">{testimonials.filter(t=>t.status==='published').length} publicados</span></div>
    <p className="small-note">Inspirado no Orkut: só Conexões aceitas podem enviar. O depoimento só aparece publicamente depois que a pessoa do perfil aprovar.</p>
    {connected&&!isSelf&&!testimonials.some(t=>t.author_id===viewerId)&&<form className="conecta-guestbook-form" onSubmit={addTestimonial}>
      <textarea className="form-input" rows={3} maxLength={800} minLength={3} required value={testimonialDraft}
        onChange={e=>setTestimonialDraft(e.target.value)} placeholder="Escreva um depoimento respeitoso sobre esta Conexão..."/>
      <button type="submit" className="btn btn-primary" disabled={busy||testimonialDraft.trim().length<3}><Send size={15}/> Enviar para aprovação</button>
    </form>}
    {testimonials.length?<div className="conecta-guestbook-list">{testimonials.map(item=>{
      const person=authors.find(p=>p.id===item.author_id);
      return <article className="conecta-guestbook-entry" key={item.id}><ProfileAvatar person={person} size="small"/>
        <div><strong>{person?.display_name||'Conexão'}</strong><small>{new Date(item.created_at).toLocaleDateString('pt-BR')} · {item.status==='published'?'Publicado':'Aguardando aprovação'}</small><p>{item.body}</p>
          {isSelf&&item.status==='pending'&&<button type="button" className="btn btn-outline" disabled={busy} onClick={()=>void approveTestimonial(item.id)}>Aprovar e publicar</button>}
        </div>
        {(isSelf||item.author_id===viewerId)&&<button type="button" disabled={busy} onClick={()=>void eraseTestimonial(item.id)} aria-label="Excluir depoimento"><Trash2 size={16}/></button>}
      </article>;
    })}</div>:<p className="small-note">Ainda não há depoimentos.</p>}
  </section>
 </div>;
}
