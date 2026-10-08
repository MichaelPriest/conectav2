'use client';

import { FormEvent, Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Eye, EyeOff, Heart, LockKeyhole, Mail, Sparkles, UserRound } from 'lucide-react';
import { ConceptBrand } from '@/components/concept-brand';
import { configured, supabaseBrowser } from '@/lib/supabase/browser';
import {useLocale,LanguageSelect} from '@/lib/i18n';

function AuthForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const {t}=useLocale();
  const [mode, setMode] = useState<'login'|'signup'>(searchParams.get('mode')==='signup'?'signup':'login');
  const [name,setName] = useState('');
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [showPassword,setShowPassword] = useState(false);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');
  const [error,setError] = useState('');

  function selectMode(next:'login'|'signup') {
    setMode(next);setError('');setMessage('');
    window.history.replaceState({},'',next==='signup'?'/auth?mode=signup':'/auth');
  }

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(busy)return;
    setError('');setMessage('');
    if(!configured()){setError('Conexão com o Conecta indisponível. Tente novamente em instantes.');return;}
    if(mode==='signup'&&name.trim().length<2){setError('Digite seu nome para continuar.');return;}
    if(password.length<8){setError('Use uma senha com pelo menos 8 caracteres.');return;}
    setBusy(true);
    try{
      const db=supabaseBrowser();
      if(mode==='signup'){
        const {data,error:signError}=await db.auth.signUp({
          email:email.trim().toLowerCase(),password,
          options:{
            emailRedirectTo:`${window.location.origin}/auth/callback?next=/onboarding`,
            data:{display_name:name.trim()}
          }
        });
        if(signError)throw signError;
        if(data.session){router.replace('/onboarding');router.refresh();}
        else setMessage('Confira seu e-mail para confirmar a conta. Depois, entre no Conecta.');
      }else{
        const {error:loginError}=await db.auth.signInWithPassword({
          email:email.trim().toLowerCase(),password
        });
        if(loginError)throw loginError;
        router.replace('/feed');router.refresh();
      }
    }catch(err){setError(err instanceof Error?err.message:'Não foi possível continuar.');}
    finally{setBusy(false);}
  }

  return <main className="conecta-auth">
    <section className="conecta-auth-hero" aria-label="Bem-vindo ao Conecta">
      <div className="conecta-auth-hero-content">
        <div className="conecta-auth-brand"><ConceptBrand light/><span>Uma rede social mais humana.</span></div>
        <div className="conecta-auth-hero-copy">
          <div className="conecta-auth-label"><Sparkles size={15}/> PESSOAS. IDEIAS. COMUNIDADES.</div>
          <h1>{t('heroTitle')}</h1>
          <p>{t('heroSubtitle')}</p>
          <div className="conecta-auth-social"><span><Heart size={18}/> Conexões reais</span><span>✦ Seu espaço, seu jeito</span></div>
        </div>
        <div className="conecta-auth-hero-footer">Conecta · Um mundo mais próximo de você.</div>
      </div>
    </section>

    <section className="conecta-auth-form-wrap">
      <div className="conecta-auth-panel">
        <div className="conecta-auth-mobile-brand"><ConceptBrand/></div><div className="conecta-auth-lang"><LanguageSelect compact/></div>
        <div className="conecta-auth-kicker"><span className="conecta-auth-kicker-icon"><Heart size={16}/></span> Seu lugar é aqui</div>
        <h2>{mode==='login'?t('welcomeBack'):t('joinUs')}</h2>
        <p className="conecta-auth-description">{mode==='login'?t('welcomeSubtitle'):t('signupSubtitle')}</p>
        <div className="conecta-auth-tabs" role="group" aria-label="Escolha entrar ou criar conta">
          <button type="button" className={mode==='login'?'selected':''} aria-pressed={mode==='login'} onClick={()=>selectMode('login')}>{t('login')}</button>
          <button type="button" className={mode==='signup'?'selected':''} aria-pressed={mode==='signup'} onClick={()=>selectMode('signup')}>{t('signup')}</button>
        </div>
        <form className="conecta-auth-form" onSubmit={submit}>
          {mode==='signup'&&<label className="conecta-auth-field"><span>{t('yourName')}</span><div className="conecta-auth-input"><UserRound size={18}/><input value={name} onChange={e=>setName(e.target.value)} type="text" autoComplete="name" placeholder="Como podemos chamar você?" minLength={2} maxLength={80} required/></div></label>}
          <label className="conecta-auth-field"><span>{t('email')}</span><div className="conecta-auth-input"><Mail size={18}/><input value={email} onChange={e=>setEmail(e.target.value)} type="email" autoComplete="email" placeholder="seuemail@exemplo.com" required/></div></label>
          <label className="conecta-auth-field"><span>{t('password')}</span><div className="conecta-auth-input"><LockKeyhole size={18}/><input value={password} onChange={e=>setPassword(e.target.value)} type={showPassword?'text':'password'} autoComplete={mode==='signup'?'new-password':'current-password'} placeholder={mode==='signup'?'Crie uma senha com 8 caracteres':'Digite sua senha'} minLength={8} required/><button type="button" className="conecta-auth-password-toggle" aria-label={showPassword?'Ocultar senha':'Mostrar senha'} onClick={()=>setShowPassword(v=>!v)}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>
          {mode==='login'&&<div className="conecta-auth-form-options"><Link href="/auth/recuperar-senha">{t('forgot')}</Link></div>}
          {searchParams.get('error')==='confirmation'&&<p className="form-error" role="alert">O link expirou ou não pôde ser confirmado. Solicite um novo link.</p>}
          {error&&<p className="form-error" role="alert">{error}</p>}
          {message&&<p className="form-success" role="status">{message}</p>}
          <button className="btn btn-primary conecta-auth-submit" type="submit" disabled={busy}>{busy?t('busy'):mode==='login'?t('submitLogin'):t('submitSignup')} <ArrowRight size={18}/></button>
        </form>
        <div className="conecta-auth-bottom">
          {mode==='login'?<>Ainda não faz parte? <button type="button" onClick={()=>selectMode('signup')}>Crie sua conta</button></>:<>Já faz parte? <button type="button" onClick={()=>selectMode('login')}>Entre na sua conta</button></>}
        </div>
        <p className="conecta-auth-terms">Uma rede feita para conversas positivas, respeito e privacidade.</p>
        <Link className="conecta-auth-back" href="/">← Voltar ao início</Link>
      </div>
    </section>
  </main>;
}
export default function AuthPage(){
  return <Suspense fallback={<main className="center-screen"><div className="loading-ring"/><p>Carregando Conecta...</p></main>}><AuthForm/></Suspense>;
}
