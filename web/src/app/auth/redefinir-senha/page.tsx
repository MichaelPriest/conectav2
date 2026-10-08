'use client';

import {FormEvent,useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {ArrowRight,Eye,EyeOff,LockKeyhole,ShieldCheck} from 'lucide-react';
import {ConceptBrand} from '@/components/concept-brand';
import {configured,supabaseBrowser} from '@/lib/supabase/browser';

export default function NewPassword(){
  const router=useRouter();
  const [checking,setChecking]=useState(true);
  const [valid,setValid]=useState(false);
  const [password,setPassword]=useState('');
  const [confirm,setConfirm]=useState('');
  const [show,setShow]=useState(false);
  const [busy,setBusy]=useState(false);
  const [saved,setSaved]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{
    if(!configured()){setChecking(false);setError('Autenticação temporariamente indisponível.');return;}
    let active=true;
    void supabaseBrowser().auth.getUser().then(({data,error:authError})=>{
      if(!active)return;
      setValid(Boolean(data.user&&!authError));
      setChecking(false);
    }).catch(()=>{if(active){setValid(false);setChecking(false);}});
    return()=>{active=false;};
  },[]);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!valid||busy)return;
    setError('');
    if(password.length<8){setError('A senha deve ter pelo menos 8 caracteres.');return;}
    if(password!==confirm){setError('As senhas não coincidem.');return;}
    setBusy(true);
    const {error:updateError}=await supabaseBrowser().auth.updateUser({password});
    if(updateError)setError(updateError.message);
    else {setSaved(true);void supabaseBrowser().auth.signOut();}
    setBusy(false);
  }
  return <main className="conecta-auth-utility"><section className="conecta-auth-utility-card">
    <ConceptBrand/><div className="conecta-auth-utility-icon"><ShieldCheck size={27}/></div>
    <h1>{saved?'Senha atualizada!':'Criar nova senha'}</h1>
    <p>{saved?'Seu acesso foi protegido. Entre novamente com sua nova senha.':'Escolha uma senha segura para voltar a se conectar.'}</p>
    {checking?<p>Validando o link...</p>:saved?<Link className="btn btn-primary conecta-auth-submit" href="/auth">Entrar no Conecta <ArrowRight size={18}/></Link>:!valid?<div><p className="form-error" role="alert">{error||'O link de recuperação é inválido ou expirou.'}</p><Link className="btn btn-outline" href="/auth/recuperar-senha">Solicitar outro link</Link></div>:
      <form className="conecta-auth-form" onSubmit={submit}>
        <label className="conecta-auth-field"><span>Nova senha</span><div className="conecta-auth-input"><LockKeyhole size={18}/><input type={show?'text':'password'} autoComplete="new-password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Pelo menos 8 caracteres"/><button type="button" className="conecta-auth-password-toggle" onClick={()=>setShow(v=>!v)} aria-label={show?'Ocultar senha':'Mostrar senha'}>{show?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>
        <label className="conecta-auth-field"><span>Confirmar senha</span><div className="conecta-auth-input"><LockKeyhole size={18}/><input type={show?'text':'password'} autoComplete="new-password" minLength={8} required value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Repita sua nova senha"/></div></label>
        {error&&<p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-primary conecta-auth-submit" type="submit" disabled={busy}>{busy?'Salvando...':'Salvar nova senha'}<ArrowRight size={18}/></button>
      </form>}
    <Link href="/auth" className="conecta-auth-utility-back">Voltar ao login</Link>
  </section></main>;
}
