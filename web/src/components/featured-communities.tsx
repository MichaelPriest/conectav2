'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Heart, Sparkles, Users } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/browser';

type Community = {
  id: string;
  slug: string;
  name: string;
  description: string;
};
const swatches = ['violet','aqua','pink','peach'];

export function FeaturedCommunities() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    const db = supabaseBrowser();
    void db.from('communities').select('id,slug,name,description')
      .order('created_at', { ascending: false }).limit(4)
      .then(({data,error}) => {
        if (!active) return;
        if (error) setLoadError(true);
        else setCommunities((data || []) as Community[]);
      });
    return () => { active = false; };
  }, []);

  return <aside className="concept-rail" aria-label="Descubra comunidades">
    <section className="concept-promo">
      <div className="concept-promo-text">
        <span className="concept-promo-eyebrow"><Heart size={14} /> Gente de verdade</span>
        <h2>Boas novas<br/>por aqui</h2>
        <p>Mais pessoas, mais histórias, mais conexões reais.</p>
      </div>
      <div className="concept-promo-photo" role="img" aria-label="Amigos reunidos e sorrindo" />
      <span className="concept-promo-heart" aria-hidden="true">♡</span>
    </section>
    <section className="concept-community-list card">
      <div className="concept-rail-heading">
        <h2>Comunidades em destaque</h2>
        <Link href="/comunidades">Ver todas <ArrowRight size={15}/></Link>
      </div>
      {loadError ? <p className="small-note">Não foi possível carregar as comunidades.</p> :
       communities.length === 0 ?
        <div className="concept-community-empty"><span className="concept-community-icon violet"><Users size={21}/></span>
          <strong>As primeiras comunidades começam aqui.</strong>
          <p>Crie um espaço para pessoas com os mesmos interesses.</p>
          <Link href="/comunidades" className="btn btn-outline">Criar comunidade</Link>
        </div> :
        <div className="concept-community-items">
          {communities.map((community, index) => <div key={community.id} className="concept-community-item">
            <span className={'concept-community-icon '+swatches[index % swatches.length]}><Users size={21}/></span>
            <div className="concept-community-copy">
              <strong>{community.name}</strong>
              <span>{community.description || 'Participe dessa conversa.'}</span>
            </div>
            <Link href={'/comunidades/'+community.slug} className="concept-join">Ver</Link>
          </div>)}
        </div>}
    </section>
    <section className="conecta-ad-placeholder" aria-label="Espaço reservado para publicidade">
      <span>ESPAÇO PUBLICITÁRIO RESERVADO</span>
      <strong>Uma marca pode fazer parte desta conversa.</strong>
      <p>Não há anúncio ativo. Futura publicidade terá identificação clara e critérios de proteção por idade.</p>
    </section>
    <div className="concept-rail-bottom">
      <Sparkles size={15}/><span>O que te move, te conecta.</span>
    </div>
  </aside>;
}
