'use client';
import {useEffect,useState} from 'react';
import {supabaseBrowser} from '@/lib/supabase/browser';
import {DiscreetAdSlot} from '@/components/discreet-ad-slot';

type PublicPost={
 id:string;content:string|null;created_at:string;
 profiles:{display_name:string|null;handle:string|null}|null;
};
/**
 * Dedicated read-only public feed for age-assured adults whose identity
 * remains pending. Restrictive SELECT RLS permits only approved public posts.
 */
export function BasicAdultFeed(){
 const [posts,setPosts]=useState<PublicPost[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 useEffect(()=>{
   let active=true;
   async function load(){
     try{
       const {data,error:failure}=await supabaseBrowser().from('posts')
         .select('id,content,created_at,profiles!posts_author_id_fkey(display_name,handle)')
         .eq('visibility','public').eq('moderation_status','approved')
         .is('community_id',null)
         .order('created_at',{ascending:false}).limit(20);
       if(!active)return;
       if(failure)throw failure;
       setPosts((data||[]) as unknown as PublicPost[]);
     }catch(err){
       if(active)setError(err instanceof Error?err.message:'Não foi possível carregar as publicações públicas.');
     }finally{if(active)setLoading(false);}
   }
   void load();
   return ()=>{active=false;};
 },[]);
 return <main className="section-page" style={{maxWidth:850,margin:'0 auto',padding:'18px 16px'}}>
   <div className="page-heading"><div>
     <span className="section-eyebrow">ACESSO PROGRESSIVO</span>
     <h1>Feed público</h1>
     <p>Você pode acompanhar publicações públicas. Para publicar, comentar ou enviar mensagens, conclua a verificação de identidade.</p>
   </div></div>
   <DiscreetAdSlot format="desktop"/>
   {loading&&<p role="status">Carregando publicações públicas...</p>}
   {error&&<p className="form-error" role="alert">{error}</p>}
   {!loading&&!error&&posts.length===0&&<section className="card" style={{padding:20}}>
     <p>Ainda não há publicações públicas disponíveis para leitura.</p>
   </section>}
   {posts.map(post=><article key={post.id} className="card" style={{padding:20,marginTop:16}}>
     <p style={{fontWeight:600,marginBottom:4}}>
       {post.profiles?.display_name||post.profiles?.handle||'Pessoa no Conecta'}
     </p>
     <p className="small-note">{new Date(post.created_at).toLocaleDateString('pt-BR')}</p>
     <p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{post.content||'Publicação com mídia.'}</p>
   </article>)}
   <div style={{marginTop:20}}><DiscreetAdSlot format="mobile"/></div>
   <p className="small-note">Publicidade de terceiros aparece somente para adultos elegíveis e após autorização explícita. Nenhuma imagem de documento é enviada ao anunciante.</p>
 </main>;
}
