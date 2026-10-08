'use client';

import { FormEvent, Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, LockKeyhole, Mail, Sparkles } from 'lucide-react';
import { configured, supabaseBrowser } from '@/lib/supabase/browser';

function AuthForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>(searchParams.get('mode') === 'signup' ? 'signup' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!configured()) { setError('O banco ainda não foi configurado. Consulte o README do projeto.'); return; }
    setBusy(true);
    try {
      const client = supabaseBrowser();
      if (mode === 'signup') {
        const { data, error: authError } = await client.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (authError) throw authError;
        if (data.session) router.replace('/onboarding');
        else setMessage('Confira seu e-mail para confirmar sua conta e depois entre no Conecta.');
      } else {
        const { error: authError } = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw authError;
        router.replace('/feed');
        router.refresh();
      }
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível entrar.'); }
    finally { setBusy(false); }
  }

  return <main className="auth-screen">
    <section className="auth-intro">
      <Link href="/" className="brand brand-light"><span className="brand-mark">c.</span> conecta<span className="brand-dot">.</span></Link>
      <div className="auth-intro-copy"><div className="eyebrow"><Sparkles size={15}/> SUA PRÓXIMA CONEXÃO COMEÇA AQUI</div><h1>Boas conexões<br/>mudam <em>tudo.</em></h1><p>Um lugar para compartilhar ideias, descobrir pessoas e fazer parte de algo maior.</p></div>
      <p className="auth-caption">Sua voz. Seu espaço. Sua comunidade.</p>
    </section>
    <section className="auth-panel">
      <div className="auth-card">
        <h2>{mode === 'login' ? 'Bem-vindo de volta' : 'Vamos criar sua conta'}</h2>
        <p className="muted">{mode === 'login' ? 'Entre e descubra o que está acontecendo.' : 'Comece sua jornada no Conecta.'}</p>
        <div className="auth-switch"><button onClick={() => {setMode('login');setError('');setMessage('');}} className={mode === 'login' ? 'selected' : ''}>Entrar</button><button onClick={() => {setMode('signup');setError('');setMessage('');}} className={mode === 'signup' ? 'selected' : ''}>Cadastrar</button></div>
        <form className="stack" onSubmit={submit}>
          <label className="field-label">E-mail <span className="field-icon"><Mail size={17}/><input type="email" placeholder="voce@exemplo.com" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required/></span></label>
          <label className="field-label">Senha <span className="field-icon"><LockKeyhole size={17}/><input type="password" minLength={6} placeholder="Sua senha" value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode==='signup'?'new-password':'current-password'} required/></span></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          {message && <p className="form-success" role="status">{message}</p>}
          <button className="btn btn-primary btn-block btn-lg" disabled={busy} type="submit">{busy?'Aguarde...':mode==='login'?'Entrar':'Criar conta'} <ArrowRight size={18}/></button>
        </form>
        <p className="fineprint">Ao continuar, você concorda em respeitar as regras das comunidades e a privacidade das pessoas.</p>
      </div>
    </section>
  </main>;
}

export default function AuthPage() { return <Suspense fallback={<main className="auth-screen"><p>Carregando...</p></main>}><AuthForm/></Suspense>; }
