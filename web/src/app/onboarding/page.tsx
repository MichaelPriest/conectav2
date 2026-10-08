'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, AtSign, UserRound } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/browser';

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    async function check() {
      try {
        const db = supabaseBrowser();
        const { data: { user } } = await db.auth.getUser();
        if (!active) return;
        if (!user) { router.replace('/auth'); return; }
        if(user.user_metadata?.display_name)setName(String(user.user_metadata.display_name).slice(0,80));
        const { data } = await db.from('profiles').select('id').eq('id', user.id).maybeSingle();
        if (data) { router.replace('/feed'); return; }
        setReady(true);
      } catch (err) { if(active) setError(err instanceof Error ? err.message : 'Erro de configuração.'); }
    }
    void check();
    return () => {active = false;};
  }, [router]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true); setError('');
    const normalized = handle.trim().toLowerCase().replace(/^@/,'');
    if (!/^[a-z0-9_]{3,30}$/.test(normalized)) {setError('Use 3 a 30 letras minúsculas, números ou _.');setSaving(false);return;}
    try {
      const db = supabaseBrowser();
      const { data: { user }, error: authError } = await db.auth.getUser();
      if (authError || !user) throw new Error('Sua sessão expirou. Entre novamente.');
      const { error: dbError } = await db.from('profiles').insert({id:user.id, handle:normalized, display_name:name.trim()});
      if (dbError) throw dbError;
      router.replace('/feed'); router.refresh();
    } catch (err) {setError(err instanceof Error ? err.message : 'Não foi possível salvar o perfil.');}
    finally {setSaving(false);}
  }

  return <main className="center-screen"><section className="onboarding-card"><span className="brand"><span className="brand-mark">c.</span> conecta<span className="brand-dot">.</span></span><div className="eyebrow">ÚLTIMO PASSO</div><h1>Como podemos chamar você?</h1><p className="muted">Crie seu perfil para começar a participar.</p>
    <form className="stack" onSubmit={submit}>
      <label className="field-label">Nome de exibição <span className="field-icon"><UserRound size={17}/><input value={name} onChange={e=>setName(e.target.value)} placeholder="Seu nome" minLength={2} maxLength={80} required disabled={!ready}/></span></label>
      <label className="field-label">Usuário <span className="field-icon"><AtSign size={17}/><input value={handle} onChange={e=>setHandle(e.target.value)} placeholder="seu_usuario" minLength={3} maxLength={30} required disabled={!ready}/></span></label>
      {error && <p role="alert" className="form-error">{error}</p>}
      <button className="btn btn-primary btn-lg btn-block" disabled={!ready||saving} type="submit">{saving?'Salvando...':'Entrar no Conecta'} <ArrowRight size={18}/></button>
    </form></section></main>;
}
