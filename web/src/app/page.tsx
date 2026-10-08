import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Bell, Compass, Heart, Image as ImageIcon, MessageCircle, MoreHorizontal, Plus, Search, Send, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { ConceptBrand } from '@/components/concept-brand';
import { conceptPillars, conceptValues } from '@/components/concept-icons';

const sampleCommunity = [
  {name:'Viagens e aventuras',tone:'aqua'},
  {name:'Vida saudável',tone:'violet'},
  {name:'Arte e criatividade',tone:'pink'},
];
export default function Home() {
  return <main className="concept-home">
    <div className="concept-home-aura concept-aura-first"/>
    <div className="concept-home-aura concept-aura-second"/>
    <header className="concept-home-header">
      <div className="concept-brand-stack"><ConceptBrand/><span>Uma rede social mais humana.</span></div>
      <div className="concept-home-header-links"><Link href="/auth">Entrar</Link><Link className="btn btn-primary" href="/auth?mode=signup">Criar conta <ArrowRight size={16}/></Link></div>
    </header>
    <div className="concept-home-intro">
      <div>
        <p>Pessoas. Ideias. Comunidades.<br/>O que te move, te conecta.</p>
        <div className="concept-home-pillars">{conceptPillars.map(({icon:Icon,title,color})=><div className="concept-home-pillar" key={title}><span className={'concept-round-icon '+color}><Icon size={22}/></span><span>{title}</span></div>)}</div>
      </div>
      <h1>Gente real.<br/>Conversas reais.<br/><span>Um mundo mais conectado.</span></h1>
    </div>
    <section className="concept-stage" aria-label="Prévia ilustrativa do design aprovado">
      <div className="concept-phone concept-welcome-device">
        <div className="concept-device-status">9:41 <span>●●● ▰</span></div>
        <div className="concept-welcome-screen">
          <div className="concept-welcome-photo"/>
          <div className="concept-welcome-content">
            <div className="concept-welcome-logo"><ConceptBrand light/><small>Uma rede social mais humana.</small></div>
            <div className="concept-welcome-actions"><h2>Boas histórias<br/>começam aqui.</h2><p>Conecte-se com pessoas, comunidades e ideias que fazem sentido na sua vida.</p>
              <Link href="/auth?mode=signup" className="btn btn-primary btn-block">Criar conta <ArrowRight size={17}/></Link>
              <Link href="/auth" className="btn btn-contrast btn-block">Entrar</Link>
            </div>
          </div>
        </div>
      </div>
      <div className="concept-laptop">
        <div className="concept-laptop-screen">
          <div className="concept-laptop-toolbar">
            <ConceptBrand/>
            <span className="concept-fake-search"><Search size={13}/> Buscar pessoas, comunidades, conteúdos...</span>
            <div className="concept-fake-toolbar"><Bell size={16}/><span className="avatar avatar-gradient avatar-sm">C</span></div>
          </div>
          <div className="concept-laptop-app">
            <div className="concept-laptop-sidebar">
              <span className="active"><Compass size={15}/> Início</span>
              <span><Search size={15}/> Explorar</span>
              <span><Users size={15}/> Comunidades</span>
              <span><Bell size={15}/> Notificações</span>
              <span><MessageCircle size={15}/> Mensagens</span>
              <span><ShieldCheck size={15}/> Perfil</span>
            </div>
            <div className="concept-laptop-feed">
              <h2>Seu feed</h2><p>Novas histórias, pessoas e ideias para um mundo mais conectado.</p>
              <div className="concept-laptop-composer"><div className="concept-fake-composer"><span className="avatar avatar-gradient avatar-sm">C</span><span>No que você está pensando hoje?</span></div>
                <div className="concept-fake-tools"><span><ImageIcon size={13}/> Foto</span><span><MessageCircle size={13}/> Vídeo</span><span><Heart size={13}/> Sentimento</span><span className="fake-publish">Publicar</span></div>
              </div>
              <div className="concept-laptop-post">
                <div className="concept-laptop-author"><span className="avatar avatar-gradient avatar-sm">C</span><div><b>Uma nova história</b><small>Prévia visual · Público</small></div><MoreHorizontal size={15}/></div>
                <p>Mais um dia especial descobrindo tudo o que nos inspira. 💜</p>
                <div className="concept-scenic-grid"><div className="concept-scenic-main"/><div className="concept-scenic-sub1"/><div className="concept-scenic-sub2"/></div>
                <div className="concept-fake-stats"><span><Heart size={13}/> Curtir</span><span><MessageCircle size={13}/> Comentar</span><span><Send size={13}/> Compartilhar</span></div>
              </div>
            </div>
            <div className="concept-laptop-rail">
              <div className="concept-laptop-promo"><h3>Boas novas por aqui</h3><p>Mais pessoas, mais histórias, mais conexões reais.</p><div className="concept-friends-photo"/></div>
              <div className="concept-laptop-featured"><h3>Comunidades em destaque</h3>{sampleCommunity.map((c,i)=><div key={c.name}><span className={'concept-featured-ico '+c.tone}><Users size={13}/></span><span>{c.name}</span><small>Participar</small></div>)}</div>
            </div>
          </div>
        </div>
        <div className="concept-laptop-base"/>
      </div>
      <div className="concept-phone concept-explore-device">
        <div className="concept-device-status">9:41 <span>●●● ▰</span></div>
        <div className="concept-mobile-preview"><h2>Explorar <Search size={16}/></h2><div className="concept-preview-filters"><span className="active">Tudo</span><span>Pessoas</span><span>Comunidades</span></div><div className="concept-explore-mosaic"><div className="landscape"><span>Lugares incríveis</span></div><div className="plants"><span>Rotina que faz bem</span></div><div className="portrait"><span>Novas conexões</span></div><div className="pets"><span>Amizade de quatro patas</span></div></div><div className="concept-mobile-nav"><Compass size={16}/><Search size={16}/><Plus size={18}/><Users size={16}/><Heart size={16}/></div></div>
      </div>
      <div className="concept-phone concept-communities-device">
        <div className="concept-device-status">9:41 <span>●●● ▰</span></div>
        <div className="concept-mobile-preview"><h2>Comunidades</h2><div className="concept-preview-search"><Search size={13}/> Buscar comunidades...</div><div className="concept-preview-filters"><span className="active">Todas</span><span>Natureza</span><span>Tecnologia</span></div><div className="concept-mobile-community-list">{sampleCommunity.map((c,i)=><div key={c.name}><span className={'concept-featured-ico '+c.tone}><Users size={17}/></span><div><b>{c.name}</b><small>Conecte-se com quem compartilha seus interesses.</small></div><span className="concept-join-demo">Ver</span></div>)}</div><div className="concept-mobile-nav"><Compass size={16}/><Search size={16}/><Plus size={18}/><Users size={16}/><Heart size={16}/></div></div>
      </div>
    </section>
    <section className="concept-home-bottom">
      {conceptValues.map(({title,description,icon:Icon,color})=><article className="concept-value" key={title}><span className={'concept-round-icon '+color}><Icon size={23}/></span><div><h2>{title}</h2><p>{description}</p></div></article>)}
    </section>
    <section className="concept-home-cta"><div><span><Sparkles size={16}/> O seu lugar é aqui</span><h2>Boas histórias começam com uma conexão.</h2></div><Link href="/auth?mode=signup" className="btn btn-primary btn-lg">Criar minha conta <ArrowUpRight size={18}/></Link></section>
    <footer className="concept-home-footer"><ConceptBrand/><span>© {new Date().getFullYear()} Conecta · Prévia ilustrativa da experiência visual; os conteúdos exibidos são exemplos de interface.</span></footer>
  </main>;
}
