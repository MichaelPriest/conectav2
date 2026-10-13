'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, History, Trash2, Users } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/browser';

type Visitor = {
  id: string;
  viewer_id: string;
  last_viewed_at: string;
  view_count: number;
  profiles: { handle: string; display_name: string; avatar_path: string | null } | null;
  avatarUrl?: string | null;
};

export function ProfileVisits({ profileId }: { profileId: string }) {
  const [enabled, setEnabled] = useState(false);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const db = supabaseBrowser();
    const { data: setting, error: settingError } = await db.from('profile_details')
      .select('profile_views_enabled').eq('user_id', profileId).maybeSingle();
    if (settingError) {
      setError('Não foi possível carregar a configuração do histórico de visitas.');
      setLoading(false);
      return;
    }
    const active = setting?.profile_views_enabled === true;
    setEnabled(active);
    if (!active) {
      setVisitors([]);
      setLoading(false);
      return;
    }
    const { data, error: visitsError } = await db.from('profile_visits')
      .select('id,viewer_id,last_viewed_at,view_count,profiles!profile_visits_viewer_id_fkey(handle,display_name,avatar_path)')
      .eq('profile_id', profileId).order('last_viewed_at', { ascending: false }).limit(50);
    if (visitsError) {
      setError('Não foi possível carregar as visitas. Confira se a migração do histórico foi aplicada.');
      setLoading(false);
      return;
    }
    const rows = (data || []) as unknown as Visitor[];
    const decorated = await Promise.all(rows.map(async visitor => {
      if (!visitor.profiles?.avatar_path) return { ...visitor, avatarUrl: null };
      const { data: avatar } = await db.storage.from('social-media').createSignedUrl(visitor.profiles.avatar_path, 3600);
      return { ...visitor, avatarUrl: avatar?.signedUrl || null };
    }));
    setVisitors(decorated);
    setLoading(false);
  }, [profileId]);

  useEffect(() => { void load(); }, [load]);

  async function toggle() {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    const next = !enabled;
    const db = supabaseBrowser();
    const { error: saveError } = await db.from('profile_details')
      .upsert({ user_id: profileId, profile_views_enabled: next }, { onConflict: 'user_id' });
    if (saveError) {
      setError('Não foi possível salvar a preferência. Confira se a migração foi aplicada.');
    } else {
      setEnabled(next);
      if (!next) setVisitors([]);
      setNotice(next
        ? 'Histórico ativado. As próximas visitas serão registradas, exceto quando houver bloqueio.'
        : 'Histórico desativado. Novas visitas não serão registradas e a lista foi ocultada.');
      await load();
    }
    setBusy(false);
  }

  async function clearHistory() {
    if (busy || visitors.length === 0) return;
    setBusy(true); setError(''); setNotice('');
    const db = supabaseBrowser();
    const { error: deleteError } = await db.from('profile_visits').delete().eq('profile_id', profileId);
    if (deleteError) setError('Não foi possível limpar o histórico.');
    else { setVisitors([]); setNotice('Histórico de visitas apagado.'); }
    setBusy(false);
  }

  return <section className="panel conecta-profile-visits" aria-labelledby="conecta-profile-visits-title">
    <div className="conecta-profile-visits-heading">
      <div><span className="section-eyebrow">PRIVACIDADE E CONEXÕES</span><h2 id="conecta-profile-visits-title"><History size={20}/> Quem visitou meu perfil</h2></div>
      <button type="button" className="btn btn-outline" disabled={busy || loading} onClick={() => void toggle()}>
        {enabled ? <EyeOff size={16}/> : <Eye size={16}/>} {enabled ? 'Desativar' : 'Ativar histórico'}
      </button>
    </div>
    <p className="small-note">O histórico começa desativado. Quando ativado, registra visitas autenticadas de outras pessoas, exceto visitas próprias e relações bloqueadas. Só você pode consultar sua lista.</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    {notice && <p className="form-success" role="status">{notice}</p>}
    {!enabled ? <div className="conecta-profile-visits-empty"><EyeOff size={22}/><p>O histórico está desativado. Ative se quiser registrar visitas futuras.</p></div>
      : loading ? <p className="muted">Carregando histórico...</p>
      : visitors.length === 0 ? <div className="conecta-profile-visits-empty"><Users size={22}/><p>Nenhuma visita registrada desde que você ativou o histórico.</p></div>
      : <><div className="conecta-profile-visitors">{visitors.map(visitor => <article className="conecta-profile-visitor" key={visitor.id}>
        <Link href={'/p/'+encodeURIComponent(visitor.profiles?.handle || '')} className="conecta-profile-visitor-avatar" aria-label={'Abrir perfil de '+(visitor.profiles?.display_name || 'visitante')}>
          {visitor.avatarUrl ? <img src={visitor.avatarUrl} alt=""/> : <span>{visitor.profiles?.display_name?.[0]?.toUpperCase() || '?'}</span>}
        </Link>
        <div className="conecta-profile-visitor-info"><Link href={'/p/'+encodeURIComponent(visitor.profiles?.handle || '')}><strong>{visitor.profiles?.display_name || 'Perfil indisponível'}</strong></Link><span>@{visitor.profiles?.handle || 'indisponível'}</span><small>{new Date(visitor.last_viewed_at).toLocaleString('pt-BR')} · {visitor.view_count} {visitor.view_count === 1 ? 'visita' : 'visitas'}</small></div>
      </article>)}</div>
      <button type="button" className="btn btn-outline" disabled={busy} onClick={() => void clearHistory()}><Trash2 size={16}/> Apagar histórico</button></>}
  </section>;
}
