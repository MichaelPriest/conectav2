'use client';

import { useEffect, useMemo, useState } from 'react';
import { Award, Bookmark, BookOpen, Heart, MessageCircle, MessageSquare, Search, Sparkles, Trophy, Users, Vote } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/browser';

type Achievement = {
  id: string;
  title: string;
  description: string;
  category: string;
  metric: string;
  target: number;
  progress: number;
  unlocked: boolean;
  unlocked_at: string | null;
};

function AchievementIcon({ metric }: { metric: string }) {
  if (metric === 'posts') return <BookOpen size={19} />;
  if (metric === 'connections') return <Users size={19} />;
  if (metric === 'comments') return <MessageCircle size={19} />;
  if (metric === 'likes') return <Heart size={19} />;
  if (metric === 'stories') return <Sparkles size={19} />;
  if (metric === 'communities') return <Users size={19} />;
  if (metric === 'polls') return <Vote size={19} />;
  if (metric === 'messages') return <MessageSquare size={19} />;
  if (metric === 'saved_posts') return <Bookmark size={19} />;
  return <Trophy size={19} />;
}

export function ProfileAchievements({ profileId }: { profileId: string }) {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('Todas');
  const [showUnlockedOnly, setShowUnlockedOnly] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      const db = supabaseBrowser();
      const { data, error: rpcError } = await db.rpc('get_my_achievements');
      if (!active) return;
      if (rpcError) {
        setError(/get_my_achievements|schema cache|function .* does not exist/i.test(rpcError.message || '')
          ? 'As 100 conquistas ainda não estão disponíveis nesta instância. A migration precisa ser aplicada no banco de homologação.'
          : 'Não foi possível carregar as conquistas agora.');
        setLoading(false);
        return;
      }
      const rows = (data || []) as Achievement[];
      // The RPC only returns awards for the authenticated account. Do not let a
      // profile URL select another person's achievement progress.
      setAchievements(rows.map(item => ({ ...item, progress: Number(item.progress || 0), target: Number(item.target || 1) })));
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [profileId]);

  const categories = useMemo(() => ['Todas', ...Array.from(new Set(achievements.map(item => item.category)))], [achievements]);
  const filtered = useMemo(() => achievements
    .filter(item => category === 'Todas' || item.category === category)
    .filter(item => !showUnlockedOnly || item.unlocked)
    .filter(item => !search.trim() || (item.title + ' ' + item.description + ' ' + item.category).toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR')))
    .sort((a, b) => Number(b.unlocked) - Number(a.unlocked) || a.target - b.target || a.title.localeCompare(b.title, 'pt-BR')),
  [achievements, category, showUnlockedOnly, search]);

  const unlocked = achievements.filter(item => item.unlocked).length;
  return <section className="panel conecta-achievements" aria-labelledby="conecta-achievements-title">
    <div className="conecta-achievements-heading">
      <div><span className="section-eyebrow">DESAFIOS E MARCOS</span><h2 id="conecta-achievements-title"><Award size={20} /> Conquistas do Conecta</h2></div>
      {!loading && !error && <span className="conecta-achievements-count">{unlocked}/100 desbloqueadas</span>}
    </div>
    <p className="small-note">São 100 conquistas calculadas no banco a partir de atividades reais. A conquista exclusiva “Primeiro usuário do Conecta” é atribuída à primeira conta registrada; as demais acompanham sua participação na rede.</p>
    {!loading && !error && <div className="conecta-achievements-toolbar">
      <label className="conecta-achievements-search"><Search size={16}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar conquista..." aria-label="Buscar conquista"/></label>
      <label className="conecta-achievements-filter">Categoria
        <select value={category} onChange={event => setCategory(event.target.value)} aria-label="Filtrar por categoria">
          {categories.map(item => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
      <label className="conecta-achievements-toggle"><input type="checkbox" checked={showUnlockedOnly} onChange={event => setShowUnlockedOnly(event.target.checked)}/> Apenas desbloqueadas</label>
    </div>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {loading ? <p className="muted">Calculando suas conquistas...</p> : !error && <>
      <div className="conecta-achievements-progress-summary" aria-label={unlocked+' de 100 conquistas desbloqueadas'}>
        <span style={{ width: (unlocked / 100 * 100) + '%' }} />
      </div>
      {filtered.length === 0 ? <p className="muted">Nenhuma conquista corresponde a esse filtro.</p> : <div className="conecta-achievements-grid">
        {filtered.map(item => <article className={'conecta-achievement '+(item.unlocked?'is-unlocked':'is-locked')} key={item.id}>
          <span className="conecta-achievement-icon">{item.unlocked?<Sparkles size={19}/>:<AchievementIcon metric={item.metric}/>}</span>
          <div className="conecta-achievement-copy"><strong>{item.title}</strong><p>{item.description}</p>
            {!item.unlocked && <div className="conecta-achievement-progress" aria-label={'Progresso: '+Math.min(item.progress,item.target)+' de '+item.target}>
              <span style={{width: Math.round(Math.min(item.progress,item.target) / item.target * 100)+'%'} } />
            </div>}
            <small>{item.unlocked ? 'Desbloqueada' : Math.min(item.progress,item.target)+' de '+item.target}</small>
          </div>
        </article>)}
      </div>}
      <p className="small-note">Exibindo {filtered.length} de 100 conquistas.</p>
    </>}
  </section>;
}
