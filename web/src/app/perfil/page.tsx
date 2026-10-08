'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Save, UserRound, Heart, FileText, Users, ExternalLink, ShieldCheck, Camera } from 'lucide-react';
import { GuardedPage, useAuthProfile } from '@/components/app-shell';
import { supabaseBrowser } from '@/lib/supabase/browser';

export default function Perfil() {
  const auth=useAuthProfile();
  const [name,setName]=useState('');
  const [handle,setHandle]=useState('');
  const [bio,setBio]=useState('');
  const [posts,setPosts]=useState(0);
  const [friends,setFriends]=useState(0);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');

  useEffect(()=>{if(auth.profile){setName(auth.profile.display_name);setHandle(auth.profile.handle);setBio(auth.profile.bio||'');}},[auth.profile]);

  const stats=useCallback(async()=>{
    if(!auth.user)return;
    const db=supabaseBrowser();
    const [p,f]=await Promise.all([
      db.from('posts').select('id',{count:'exact',head:true}).eq('author_id',auth.user.id),
      db.from('friendships').select('id',{count:'exact',head:true}).eq('status','accepted').or('requester_id.eq.'+auth.user.id+',addressee_id.eq.'+auth.user.id)
    ]);
    if(!p.error)setPosts(p.count||0);
    if(!f.error)setFriends(f.count||0);
  },[auth.user]);

  useEffect(()=>{void stats();},[stats]);

  async function submit(e:FormEvent){
    e.preventDefault();
    if(!auth.user||saving)return;
    setSaving(true);setError('');setMessage('');
    const normalized=handle.trim().toLowerCase().replace(/^@/,'');
    if(!/^[a-z0-9_]{3,30}$/.test(normalized)){setError('Usuário inválido: de 3 a 30 letras, números ou _.');setSaving(false);return;}
    const {data,error:upErr}=await supabaseBrowser().from('profiles')
      .update({display_name:name.trim(),handle:normalized,bio:bio.trim(),updated_at:new Date().toISOString()})
      .eq('id',auth.user.id)
      .select('id,display_name,handle,bio,avatar_path')
      .single();
    if(upErr)setError(upErr.message);
    else {auth.setProfile(data);setMessage('Seu perfil foi atualizado.');}
    setSaving(false);
  }

  return <GuardedPage {...auth}>
    <main className="section-page">
      <div className="page-heading"><div><span className="section-eyebrow">SUA IDENTIDADE</span><h1>Meu perfil <span className="wave">✳</span></h1><p>Mostre ao mundo quem você é.</p></div></div>
      <section className="profile-header">
        <span className="avatar avatar-gradient">{auth.profile?.display_name?.[0]?.toUpperCase()||'C'}</span>
        <div><h2>{auth.profile?.display_name}</h2><p>@{auth.profile?.handle}</p><div className="stat-line"><span><strong>{posts}</strong> publicações</span><span><strong>{friends}</strong> amizades</span></div></div>
      </section>
      <section className="panel" style={{marginBottom:22}}>
        <div className="feed-title"><h2><ShieldCheck size={20} color="#825bec" style={{verticalAlign:'middle'}}/> Conecta ID — Segurança e identidade</h2></div>
        <p className="muted">Verificação por câmera, prova de vida e documento quando necessário. O resultado é validado por um serviço especializado, sem armazenar selfies no Conecta.</p>
        <Link href="/verificar-identidade" className="btn btn-outline"><Camera size={18}/> Conhecer a verificação</Link>
      </section>
      <section className="panel profile-form">
        <div className="feed-title"><h2>Editar informações</h2><Link href={'/p/'+(auth.profile?.handle||'')} className="rail-link">Ver perfil público <ExternalLink size={15}/></Link></div>
        <form className="stack" onSubmit={submit}>
          <label className="field-label">Nome de exibição<input className="form-input" maxLength={80} minLength={2} required value={name} onChange={e=>setName(e.target.value)}/></label>
          <label className="field-label">Nome de usuário<input className="form-input" maxLength={30} minLength={3} required value={handle} onChange={e=>setHandle(e.target.value)}/></label>
          <label className="field-label">Sobre você<textarea maxLength={300} value={bio} onChange={e=>setBio(e.target.value)} placeholder="Escreva sua biografia..."/></label>
          {error&&<p className="form-error" role="alert">{error}</p>}
          {message&&<p className="form-success" role="status">{message}</p>}
          <button type="submit" className="btn btn-primary" disabled={saving}><Save size={18}/> {saving?'Salvando...':'Salvar alterações'}</button>
        </form>
      </section>
    </main>
  </GuardedPage>;
}
