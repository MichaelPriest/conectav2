'use client';

import {FormEvent,useState} from 'react';
import Link from 'next/link';
import {ArrowLeft,ArrowRight,Mail,ShieldCheck} from 'lucide-react';
import {ConceptBrand} from '@/components/concept-brand';
import {configured,supabaseBrowser} from '@/lib/supabase/browser';

export default function RecoverPassword(){
  const [email,setEmail]=useState('');
  const [busy,setBusy]=useState(false);
  const [sent,setSent]=useState(false);
  const [error,setError]=useState('');
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(busy)return;
    setBusy(true);setError('');
    try{
      if(!configured())throw new Error('Autenticação temporariamente indisponível.');
      const {error:resetError}=await supabaseBrowser().auth.resetPasswordForEmail(email.trim(),{
        redirectTo:`${window.location.origin}/auth/callback?next=/auth/redefinir-senha`
      });
      if(resetError)throw resetError;
      setSent(true);
    }catch(err){setError(err instanceof Error?err.message:'Não foi possível enviar o link.');}
    finally{setBusy(false);}
  }
  return <main className="conecta-auth-utility"><section className="conecta-auth-utility-card">
    <ConceptBrand/>
    <div className="conecta-auth-utility-icon"><ShieldCheck size={27}/></div>
    <h1>{sent?'Verifique seu e-mail':'Recupere seu acesso'}</h1>
    <p>{sent?'Se a conta existir, você receberá um link para redefinir sua senha. Confira também a caixa de spam.':'Vamos enviar um link seguro para você criar uma nova senha.'}</p>
    {!sent&&<form className="conecta-auth-form" onSubmit={submit}>
      <label className="conecta-auth-field"><span>E-mail cadastrado</span><div className="conecta-auth-input"><Mail size={18}/><input type="email" autoComplete="email" required placeholder="seuemail@exemplo.com" value={email} onChange={e=>setEmail(e.target.value)}/></div></label>
      {error&&<p className="form-error" role="alert">{error}</p>}
      <button className="btn btn-primary conecta-auth-submit" type="submit" disabled={busy}>{busy?'Enviando...':'Enviar link de recuperação'}<ArrowRight size={18}/></button>
    </form>}
    <Link href="/auth" className="conecta-auth-utility-back"><ArrowLeft size={17}/> Voltar ao login</Link>
  </section></main>;
}
