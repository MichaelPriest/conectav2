'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Eye, Palette, ShieldCheck, Sparkles } from 'lucide-react';
import { GuardedPage, useAuthProfile } from '@/components/app-shell';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { ProfileVisits } from '@/components/profile-visits';
import { LanguageSelect } from '@/lib/i18n';
import { EmojiButton } from '@/components/emoji-button';
import { DEFAULT_PROFILE_DETAILS, normalizeProfileDetails, type ProfileDetails } from '@/lib/profile-details';

const themes = [
  { id: 'classic', title: 'Conecta clássico', desc: 'Visual original', tone: 'classic' },
  { id: 'orkut', title: 'Orkut retrô', desc: 'Comunidades e nostalgia', tone: 'orkut' },
  { id: 'myspace', title: 'MySpace', desc: 'Expressivo e musical', tone: 'myspace' },
  { id: 'facebook', title: 'Facebook', desc: 'Perfil social clássico', tone: 'facebook' },
  { id: 'instagram', title: 'Instagram', desc: 'Foco visual e fotos', tone: 'instagram' },
  { id: 'creator', title: 'Criador', desc: 'Conteúdo em destaque', tone: 'creator' },
  { id: 'minimal', title: 'Minimalista', desc: 'Leve e discreto', tone: 'minimal' },
  { id: 'aurora', title: 'Aurora', desc: 'Gradientes vivos', tone: 'aurora' },
  { id: 'glass', title: 'Glass UI', desc: 'Camadas translúcidas', tone: 'glass' },
  { id: 'neo', title: 'Neo Editorial', desc: 'Blocos expressivos', tone: 'neo' },
] as const;

const coverThemes: { id: ProfileDetails['cover_theme']; label: string }[] = [
  { id: 'violet', label: 'Violeta' }, { id: 'aqua', label: 'Água' }, { id: 'pink', label: 'Rosa' },
  { id: 'sunset', label: 'Pôr do sol' }, { id: 'midnight', label: 'Noite' }, { id: 'forest', label: 'Floresta' },
  { id: 'ocean', label: 'Oceano' }, { id: 'graphite', label: 'Grafite' }, { id: 'candy', label: 'Candy retrô' },
];

export default function SettingsPage() {
  const auth = useAuthProfile();
  const [details, setDetails] = useState<ProfileDetails>(DEFAULT_PROFILE_DETAILS);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!auth.user) return;
    let active = true;
    void (async () => {
      const { data, error: loadError } = await supabaseBrowser().from('profile_details')
        .select('headline,city,website,music_url,interests,favorite_emoji,cover_theme,mood_text,layout_style')
        .eq('user_id', auth.user!.id).maybeSingle();
      if (!active) return;
      if (loadError) setError('Não foi possível carregar suas preferências.');
      else setDetails(normalizeProfileDetails(data));
      setReady(true);
    })();
    return () => { active = false; };
  }, [auth.user]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!auth.user || saving || !ready) return;
    setSaving(true); setError(''); setNotice('');
    const db = supabaseBrowser();
    const settings = {
      layout_style: details.layout_style,
      cover_theme: details.cover_theme,
      favorite_emoji: details.favorite_emoji,
      updated_at: new Date().toISOString(),
    };
    try {
      const { data, error: updateError } = await db.from('profile_details')
        .update(settings).eq('user_id', auth.user.id).select('user_id').maybeSingle();
      if (updateError) throw updateError;
      if (!data) {
        const { error: insertError } = await db.from('profile_details').upsert({
          user_id: auth.user.id, ...DEFAULT_PROFILE_DETAILS, ...settings,
        }, { onConflict: 'user_id' });
        if (insertError) throw insertError;
      }
      window.dispatchEvent(new CustomEvent('conecta-profile-theme-change', { detail: details.layout_style }));
      setNotice('Preferências salvas. O tema será aplicado em toda a interface do Conecta.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar suas preferências.');
    } finally { setSaving(false); }
  }

  return <GuardedPage {...auth}><main className="section-page conecta-profile-page">
    <div className="page-heading">
      <div><span className="section-eyebrow">SUA CONTA</span><h1>Configurações</h1><p>Gerencie aparência, idioma e privacidade em um só lugar.</p></div>
      <Link href="/perfil" className="btn btn-outline"><ArrowLeft size={17}/> Voltar ao perfil</Link>
    </div>

    <form className="stack" onSubmit={save}>
      <section className="panel stack">
        <div className="feed-title"><h2><Palette size={20}/> Aparência da rede</h2><span className="small-note">10 temas</span></div>
        <p className="small-note">O tema escolhido altera a interface completa — navegação, feed, formulários e ações — e não apenas a página do perfil.</p>
        <div className="theme-preview-grid">
          {themes.map(theme => <button type="button" key={theme.id}
            className={'theme-preview-card theme-preview-'+theme.tone+(details.layout_style===theme.id?' is-selected':'')}
            aria-pressed={details.layout_style===theme.id}
            onClick={() => setDetails(current => ({ ...current, layout_style: theme.id }))}>
            <span className="theme-preview-window"><span className="theme-preview-top"><i/><i/><i/></span><span className="theme-preview-body"><span className="theme-preview-sidebar"><i/><i/><i/><i/></span><span className="theme-preview-feed"><i className="theme-preview-composer"/><i className="theme-preview-post"><b/><em/><em/><em/></i><i className="theme-preview-post short"><b/><em/><em/></i></span><span className="theme-preview-rail"><i/><i/></span></span></span>
            <span className="theme-preview-label"><strong>{theme.title}</strong><small>{theme.desc}</small></span>
            {details.layout_style===theme.id&&<span className="theme-preview-current"><Check size={13}/> Selecionado</span>}
          </button>)}
        </div>
        <label className="field-label">Cor padrão da capa do perfil
          <select className="form-input" value={details.cover_theme} onChange={e => setDetails(current => ({ ...current, cover_theme: e.target.value as ProfileDetails['cover_theme'] }))}>
            {coverThemes.map(theme => <option key={theme.id} value={theme.id}>{theme.label}</option>)}
          </select>
        </label>
        <div className="conecta-profile-emoji"><span>Emoji de assinatura do perfil: <strong>{details.favorite_emoji}</strong></span><EmojiButton label="Escolher emoji de assinatura" onSelect={emoji => setDetails(current => ({ ...current, favorite_emoji: emoji }))}/></div>
        <button className="btn btn-primary" type="submit" disabled={!ready || saving}><Sparkles size={17}/>{saving ? 'Salvando...' : 'Salvar aparência'}</button>
      </section>
      <section className="panel stack">
        <h2>Idioma</h2>
        <p className="small-note">Escolha o idioma da interface.</p>
        <LanguageSelect />
      </section>
    </form>

    <section className="panel stack">
      <div className="feed-title"><h2><ShieldCheck size={20}/> Segurança e identidade</h2></div>
      <p className="small-note">A verificação de identidade fica nas configurações da conta, separada das informações públicas do perfil.</p>
      <div><Link href="/verificar-identidade" className="btn btn-outline"><ShieldCheck size={17}/> Abrir Conecta ID</Link></div>
    </section>

    {auth.user && <ProfileVisits profileId={auth.user.id} />}
    <section className="panel stack">
      <h2><Eye size={20}/> Privacidade do perfil</h2>
      <p className="small-note">O histórico de visitas é opcional, começa desativado e só pode ser consultado pelo dono do perfil. Bloqueios continuam impedindo o registro entre as contas envolvidas.</p>
      <p className="small-note">Informações como cidade, interesses, música e apresentação são editadas no <Link href="/perfil">seu perfil</Link>.</p>
    </section>
    {error && <p className="form-error" role="alert">{error}</p>}
    {notice && <p className="form-success" role="status">{notice}</p>}
  </main></GuardedPage>;
}
