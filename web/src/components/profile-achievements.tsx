'use client';

import { useEffect, useState } from 'react';
import { Award, BookOpen, Heart, Image, Music2, Users, UserRoundCheck, Sparkles } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/browser';

type Achievement = {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  progress: number;
  target: number;
  icon: 'post' | 'friends' | 'profile' | 'interests' | 'music';
};

function AchievementIcon({ type }: { type: Achievement['icon'] }) {
  if (type === 'post') return <BookOpen size={19} />;
  if (type === 'friends') return <Users size={19} />;
  if (type === 'profile') return <Image size={19} />;
  if (type === 'interests') return <Heart size={19} />;
  return <Music2 size={19} />;
}

export function ProfileAchievements({ profileId }: { profileId: string }) {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      const db = supabaseBrowser();
      const [posts, friends, details] = await Promise.all([
        db.from('posts').select('id', { count: 'exact', head: true }).eq('author_id', profileId),
        db.from('friendships').select('id', { count: 'exact', head: true }).eq('status', 'accepted')
          .or('requester_id.eq.' + profileId + ',addressee_id.eq.' + profileId),
        db.from('profile_details').select('interests,music_url,cover_path,headline').eq('user_id', profileId).maybeSingle(),
      ]);
      if (!active) return;
      const failure = posts.error || friends.error || details.error;
      if (failure) {
        setError('Não foi possível carregar as conquistas agora.');
        setLoading(false);
        return;
      }
      const postCount = posts.count || 0;
      const friendCount = friends.count || 0;
      const profile = details.data;
      const profileComplete = Boolean(profile?.headline?.trim() && profile?.cover_path);
      const interestsCount = Array.isArray(profile?.interests) ? profile.interests.length : 0;
      const musicAdded = Boolean(profile?.music_url?.trim());
      const next: Achievement[] = [
        { id: 'first-post', title: 'Primeira história', description: 'Faça sua primeira publicação', unlocked: postCount >= 1, progress: Math.min(postCount, 1), target: 1, icon: 'post' },
        { id: 'ten-posts', title: 'Voz ativa', description: 'Compartilhe 10 publicações', unlocked: postCount >= 10, progress: Math.min(postCount, 10), target: 10, icon: 'post' },
        { id: 'fifty-posts', title: 'Criador constante', description: 'Compartilhe 50 publicações', unlocked: postCount >= 50, progress: Math.min(postCount, 50), target: 50, icon: 'post' },
        { id: 'first-friend', title: 'Primeira conexão', description: 'Conecte-se com alguém', unlocked: friendCount >= 1, progress: Math.min(friendCount, 1), target: 1, icon: 'friends' },
        { id: 'ten-friends', title: 'Rede em crescimento', description: 'Tenha 10 conexões aceitas', unlocked: friendCount >= 10, progress: Math.min(friendCount, 10), target: 10, icon: 'friends' },
        { id: 'profile-custom', title: 'Perfil com personalidade', description: 'Adicione um título e uma capa', unlocked: profileComplete, progress: Number(Boolean(profile?.headline?.trim())) + Number(Boolean(profile?.cover_path)), target: 2, icon: 'profile' },
        { id: 'interests', title: 'Interesses compartilhados', description: 'Adicione pelo menos 3 interesses', unlocked: interestsCount >= 3, progress: Math.min(interestsCount, 3), target: 3, icon: 'interests' },
        { id: 'music', title: 'Trilha sonora', description: 'Adicione música ao seu perfil', unlocked: musicAdded, progress: Number(musicAdded), target: 1, icon: 'music' },
      ];
      setAchievements(next);
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [profileId]);

  const unlocked = achievements.filter(item => item.unlocked).length;
  return <section className="panel conecta-achievements" aria-labelledby="conecta-achievements-title">
    <div className="conecta-achievements-heading">
      <div><span className="section-eyebrow">SUAS CONQUISTAS</span><h2 id="conecta-achievements-title"><Award size={20} /> Conquistas do Conecta</h2></div>
      {!loading && !error && <span className="conecta-achievements-count">{unlocked}/{achievements.length} desbloqueadas</span>}
    </div>
    <p className="small-note">Conquistas calculadas a partir de suas publicações, conexões e informações de perfil. Elas são atualizadas ao abrir esta área.</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    {loading ? <p className="muted">Calculando suas conquistas...</p> : !error && <div className="conecta-achievements-grid">
      {achievements.map(item => <article className={'conecta-achievement '+(item.unlocked?'is-unlocked':'is-locked')} key={item.id}>
        <span className="conecta-achievement-icon">{item.unlocked?<Sparkles size={19}/>:<AchievementIcon type={item.icon}/>}</span>
        <div className="conecta-achievement-copy"><strong>{item.title}</strong><p>{item.description}</p>
          {!item.unlocked && <div className="conecta-achievement-progress" aria-label={'Progresso: '+item.progress+' de '+item.target}>
            <span style={{width: Math.round(item.progress / item.target * 100)+'%'}} />
          </div>}
          <small>{item.unlocked?'Desbloqueada':item.progress+' de '+item.target}</small>
        </div>
      </article>)}
    </div>}
  </section>;
}
