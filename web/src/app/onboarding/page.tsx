'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, AtSign, UserRound } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/browser';
import {declaredBandFromDob,ageBandLabel,todayForDateInput} from '@/lib/registration-age';
import type {DeclaredAgeBand} from '@/lib/registration-age';

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [existingProfile, setExistingProfile] = useState(false);
  const [claimedBand, setClaimedBand] = useState<DeclaredAgeBand|null>(null);
  const [birthDate, setBirthDate] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    let active = true;
    async function check() {
      try {
        const db = supabaseBrowser();
        const { data: { user } } = await db.auth.getUser();
        if (!active) return;
        if (!user) { router.replace('/auth'); return; }
        if(user.user_metadata?.display_name)setName(String(user.user_metadata.display_name).slice(0,80));
        const {data:profile,error:profileError} = await db.from('profiles')
          .select('id,handle,display_name').eq('id',user.id).maybeSingle();
        if(profileError)throw profileError;
        const {data:age,error:ageError} = await db.from('registration_age_declarations')
          .select('declared_band').eq('user_id',user.id).maybeSingle();
        if(ageError)throw ageError;
        if(profile && age?.declared_band){
          router.replace(age.declared_band==='18_plus'?'/verificar-identidade':'/verificar-identidade');
          return;
        }
        setExistingProfile(Boolean(profile));
        if(profile){setName(profile.display_name);setHandle(profile.handle);}
        const hint=user.user_metadata?.declared_age_band;
        if(hint==='13_15'||hint==='16_17'||hint==='18_plus')setClaimedBand(hint);
        setReady(true);
      } catch (err) { if(active) setError(err instanceof Error ? err.message : 'Erro de configuração.'); }
    }
    void check();
    return () => {active = false;};
  }, [router]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true); setError('');
    const normalized = handle.trim().toLowerCase().replace(/^@/,'');
    if (!existingProfile && !/^[a-z0-9_]{3,30}$/.test(normalized)) {
      setError('Use 3 a 30 letras minúsculas, números ou _.');setSaving(false);return;
    }
    const band=claimedBand??declaredBandFromDob(birthDate);
    if(!band){setError('Informe uma data de nascimento válida para continuar.');setSaving(false);return;}
    if(band==='under_13'){setError('O Conecta não permite cadastro autônomo de menores de 13 anos.');setSaving(false);return;}
    if(!confirmed){setError('Confirme a faixa etária antes de continuar.');setSaving(false);return;}
    try {
      const db = supabaseBrowser();
      const { data: { user }, error: authError } = await db.auth.getUser();
      if (authError || !user) throw new Error('Sua sessão expirou. Entre novamente.');
      if(!existingProfile){
        const {error:dbError} = await db.from('profiles').insert({
          id:user.id,handle:normalized,display_name:name.trim()
        });
        if(dbError)throw dbError;
        setExistingProfile(true);
      }
      // Database RLS allows exactly one immutable age-band statement per user.
      // This never changes identity_verifications or produces a trusted 18+ decision.
      const {error:ageError}=await db.from('registration_age_declarations')
        .insert({user_id:user.id,declared_band:band});
      if(ageError){
        if(ageError.code==='23505'){router.replace('/verificar-identidade');router.refresh();return;}
        throw ageError;
      }
      router.replace('/verificar-identidade');router.refresh();
    } catch (err) {setError(err instanceof Error ? err.message : 'Não foi possível salvar o perfil.');}
    finally {setSaving(false);}
  }

  return <main className="center-screen"><section className="onboarding-card"><span className="brand"><span className="brand-mark">c.</span> conecta<span className="brand-dot">.</span></span><div className="eyebrow">CADASTRO · SEGURANÇA</div><h1>{existingProfile?'Complete sua proteção por idade':'Crie seu perfil com segurança'}</h1>
    <p className="muted">A idade inicial é declarada por você. Identidade, maioridade e vínculo de responsável só serão considerados confirmados após verificação confiável.</p>
    <form className="stack" onSubmit={submit}>
      {!existingProfile&&<>
        <label className="field-label">Nome de exibição <span className="field-icon"><UserRound size={17}/><input value={name} onChange={e=>setName(e.target.value)} placeholder="Seu nome" minLength={2} maxLength={80} required disabled={!ready}/></span></label>
        <label className="field-label">Usuário <span className="field-icon"><AtSign size={17}/><input value={handle} onChange={e=>setHandle(e.target.value)} placeholder="seu_usuario" minLength={3} maxLength={30} required disabled={!ready}/></span></label>
      </>}
      {claimedBand?
        <p className="small-note"><strong>Faixa etária declarada no cadastro: {ageBandLabel(claimedBand)}.</strong>
        {' '}Essa informação não é comprovação oficial. <button type="button" className="btn btn-outline"
          onClick={()=>{setClaimedBand(null);setConfirmed(false);}} disabled={!ready}>Corrigir faixa etária</button></p>:
        <label className="field-label">Data de nascimento (não será armazenada)
          <input className="form-input" type="date" value={birthDate} max={todayForDateInput()}
            onChange={e=>setBirthDate(e.target.value)} disabled={!ready} required/></label>}
      <label className="human-agree"><input type="checkbox" checked={confirmed}
        onChange={e=>setConfirmed(e.target.checked)} required disabled={!ready}/>
        Confirmo a faixa etária informada e entendo que o Conecta ID precisará de validação documental adicional.
        Contas adolescentes permanecem com proteções e responsável pendente de verificação.</label>
      <p className="small-note">Apenas a faixa etária declarada será registrada, sem guardar data de nascimento, selfie ou documentos neste cadastro.</p>
      {error && <p role="alert" className="form-error">{error}</p>}
      <button className="btn btn-primary btn-lg btn-block" disabled={!ready||saving} type="submit">{saving?'Salvando...':'Continuar para Conecta ID'} <ArrowRight size={18}/></button>
    </form></section></main>;
}
