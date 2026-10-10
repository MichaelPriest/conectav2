import Link from 'next/link';
import {
  ArrowRight, ArrowUpRight, AtSign, Bookmark, Camera, Check, ChevronRight,
  Clapperboard, Compass, Heart, HeartHandshake, Image as ImageIcon,
  LockKeyhole, Menu, MessageCircle, MessagesSquare, Mic2, Music2, Smartphone,
  Palette, Play, ShieldCheck, Smile, Sparkles, Star, Users, Video,
} from 'lucide-react';
import { ConceptBrand } from '@/components/concept-brand';

const features = [
 {icon:Camera,title:'Stories por 24 horas',description:'Compartilhe fotos e vídeos com quem você escolher.',path:'/feed',tag:'Seu momento',tone:'violet'},
 {icon:Clapperboard,title:'Reels e vídeos',description:'Crie e descubra vídeos curtos dentro da comunidade.',path:'/reels',tag:'Em movimento',tone:'pink'},
 {icon:MessagesSquare,title:'Chat em toda a rede',description:'Converse sem sair da página, com grupos, fotos, vídeos e áudio.',path:'/mensagens',tag:'Perto de você',tone:'aqua'},
 {icon:AtSign,title:'Marque com @usuário',description:'Chame suas conexões para a conversa e receba notificações.',path:'/feed',tag:'Conexões',tone:'peach'},
 {icon:Palette,title:'Perfil com a sua cara',description:'Capa, foto, status, interesses, música e estilos de layout.',path:'/perfil',tag:'Identidade própria',tone:'pink'},
 {icon:Bookmark,title:'Enquetes e salvos',description:'Participe, responda comentários e guarde o que importa.',path:'/feed',tag:'Compartilhar',tone:'violet'},
] as const;

const communities=[
 {name:'Mães Atípicas · Rede de Apoio',slug:'maes-atipicas-rede-apoio',description:'Acolhimento e troca de experiências.',icon:HeartHandshake,tone:'pink'},
 {name:'Arte & Criatividade',slug:'arte-criatividade',description:'Ideias, ilustrações e projetos.',icon:Palette,tone:'violet'},
 {name:'Música & Playlists',slug:'musica-playlists',description:'Canções para acompanhar histórias.',icon:Music2,tone:'aqua'},
 {name:'Games & Jogadores',slug:'games',description:'Jogos, nostalgia e amizades.',icon:Play,tone:'peach'}
] as const;

const steps=[
 {n:'01',title:'Crie seu espaço',body:'Escolha seu @usuário, personalize seu perfil e conte um pouco sobre você.'},
 {n:'02',title:'Encontre sua comunidade',body:'Explore temas e participe de conversas que combinam com seus interesses.'},
 {n:'03',title:'Construa conexões',body:'Compartilhe momentos, converse com amizades e volte sempre que quiser.'},
] as const;

export default function Home(){
 return <main className="conecta-landing-v3">
  <header className="conecta-v3-header">
   <ConceptBrand/>
   <nav className="conecta-v3-nav" aria-label="Conhecer o Conecta">
    <a href="#recursos">Recursos</a><a href="#comunidades">Comunidades</a><a href="#acolhimento">Acolhimento</a><a href="#seu-espaco">Seu espaço</a><Link href="/apps">Baixar app</Link>
   </nav>
   <div className="conecta-v3-header-actions">
    <Link className="conecta-v3-login" href="/auth">Entrar</Link>
    <Link className="btn btn-primary" href="/auth?mode=signup">Criar conta <ArrowRight size={17}/></Link>
   </div>
  </header>

  <section className="conecta-v3-hero">
   <div className="conecta-v3-hero-copy">
    <span className="conecta-v3-kicker"><Sparkles size={15}/> UMA REDE SOCIAL PARA PERTENCER</span>
    <h1>A sua história merece <em>um lugar especial.</em></h1>
    <p>O Conecta reúne o melhor das comunidades, das boas conversas e das redes que marcaram gerações — com Stories, Reels, chat, perfis personalizados e espaço para quem cuida e precisa ser acolhido.</p>
    <div className="conecta-v3-hero-actions">
     <Link href="/auth?mode=signup" className="btn btn-primary btn-lg">Quero fazer parte <ArrowUpRight size={18}/></Link>
     <Link href="/apps" className="conecta-v3-text-link"><Smartphone size={18}/> Baixar aplicativo</Link>
     <a href="#recursos" className="conecta-v3-text-link">Descobrir recursos <ChevronRight size={18}/></a>
    </div>
    <div className="conecta-v3-hero-highlights">
      <span><Check size={16}/> Comunidades por interesse</span>
      <span><Check size={16}/> Seu perfil, seu estilo</span>
      <span><Check size={16}/> Conversas com privacidade</span>
    </div>
   </div>
   <div className="conecta-v3-showcase" role="img" aria-label="Ilustração de interface do Conecta com feed, Stories, comunidades, perfil e chat. Não representa conteúdo de usuários reais.">
    <div className="conecta-v3-orbit conecta-v3-orbit-one"/><div className="conecta-v3-orbit conecta-v3-orbit-two"/>
    <div className="conecta-v3-window">
     <div className="conecta-v3-window-top"><div className="conecta-v3-mini-brand"><span>C</span><b>conecta</b></div><span className="conecta-v3-search"><Compass size={13}/> Buscar pessoas e comunidades</span><span className="conecta-v3-mini-avatar"><Smile size={19}/></span></div>
     <div className="conecta-v3-window-body">
      <aside className="conecta-v3-window-side">
       <span className="active"><Menu size={14}/> Início</span><span><Compass size={14}/> Explorar</span><span><Clapperboard size={14}/> Reels</span><span><Users size={14}/> Comunidades</span><span><MessageCircle size={14}/> Mensagens</span>
      </aside>
      <div className="conecta-v3-window-main">
       <div className="conecta-v3-demo-eyebrow"><Sparkles size={12}/> Seu mundo, suas conexões</div>
       <h3>Seu feed</h3>
       <div className="conecta-v3-story-track">
         <span><i className="violet"><Camera size={19}/></i>Seu story</span>
         <span><i className="pink"><Heart size={19}/></i>Momentos</span>
         <span><i className="aqua"><Music2 size={19}/></i>Música</span>
         <span><i className="peach"><Palette size={19}/></i>Arte</span>
       </div>
       <div className="conecta-v3-demo-composer"><span className="conecta-v3-mini-avatar"><Smile size={18}/></span> No que você está pensando hoje? <AtSign size={16}/></div>
       <div className="conecta-v3-demo-post">
        <div className="conecta-v3-demo-post-heading"><span className="conecta-v3-post-icon"><Sparkles size={15}/></span><span><strong>Encontre a sua comunidade</strong><small>Exemplo de interface · Sem publicações fictícias</small></span></div>
        <div className="conecta-v3-demo-image"><span className="conecta-v3-demo-image-shape shape-one"/><span className="conecta-v3-demo-image-shape shape-two"/><span className="conecta-v3-demo-image-shape shape-three"/><span className="conecta-v3-demo-image-text">Um espaço para<br/>ser você. <span>✳</span></span></div>
        <div className="conecta-v3-demo-social"><span><Heart size={14}/> Curtir</span><span><MessageCircle size={14}/> Comentar</span><span><Bookmark size={14}/> Salvar</span></div>
       </div>
      </div>
     </div>
    </div>
    <div className="conecta-v3-overlay-card conecta-v3-overlay-chat"><span className="conecta-v3-overlay-icon"><MessageCircle size={20}/></span><div><strong>Chat flutuante</strong><small>Suas conversas acompanham você</small></div><span className="conecta-v3-demo-live"/></div>
    <div className="conecta-v3-overlay-card conecta-v3-overlay-profile"><span className="conecta-v3-overlay-icon pink"><Palette size={19}/></span><div><strong>Seu perfil, suas cores</strong><small>Capas, música e recados</small></div></div>
   </div>
  </section>

  <section id="recursos" className="conecta-v3-section conecta-v3-features">
   <div className="conecta-v3-section-head"><div><span className="conecta-v3-kicker"><Sparkles size={15}/> O CONECTA DE HOJE</span><h2>Mais que um feed.<br/><em>Um mundo para compartilhar.</em></h2></div><p>Do primeiro story àquela conversa que vira amizade: descubra as ferramentas que já fazem parte da rede.</p></div>
   <div className="conecta-v3-feature-grid">{features.map(({icon:Icon,title,description,path,tag,tone})=><Link href={path} key={title} className="conecta-v3-feature-card">
    <span className={'conecta-v3-icon '+tone}><Icon size={24}/></span>
    <span className="conecta-v3-card-tag">{tag}</span>
    <h3>{title}</h3><p>{description}</p><span className="conecta-v3-card-more">Conhecer <ArrowUpRight size={16}/></span>
   </Link>)}</div>
  </section>

  <section id="comunidades" className="conecta-v3-section conecta-v3-communities">
   <div className="conecta-v3-section-head"><div><span className="conecta-v3-kicker"><Users size={15}/> COMUNIDADES REAIS</span><h2>Encontre sua turma.<br/><em>Faça parte de algo.</em></h2></div><p>Explore comunidades oficiais já criadas no Conecta. Cada comunidade tem seu próprio espaço, regras e conversas.</p></div>
   <div className="conecta-v3-community-grid">{communities.map(({name,slug,description,icon:Icon,tone})=><Link className={'conecta-v3-community '+tone} key={slug} href={'/comunidades/'+slug}>
    <span className="conecta-v3-community-icon"><Icon size={26}/></span>
    <strong>{name}</strong><p>{description}</p><span>Conhecer comunidade <ArrowUpRight size={16}/></span>
   </Link>)}</div>
   <Link href="/comunidades" className="conecta-v3-text-link">Explorar todas as comunidades <ArrowRight size={17}/></Link>
  </section>

  <section id="acolhimento" className="conecta-v3-support">
   <div className="conecta-v3-support-art" aria-hidden="true"><span className="conecta-v3-support-sun"><HeartHandshake size={78} strokeWidth={1.35}/></span><span className="conecta-v3-support-small support-a"><Heart size={26}/></span><span className="conecta-v3-support-small support-b"><Users size={27}/></span><span className="conecta-v3-support-small support-c"><Sparkles size={24}/></span></div>
   <div className="conecta-v3-support-copy"><span className="conecta-v3-kicker"><HeartHandshake size={15}/> UM ESPAÇO DE ACOLHIMENTO</span><h2>Para mães atípicas,<br/>famílias e redes de cuidado.</h2>
    <p>Porque conexão também é acolher. Criamos um espaço para trocar experiências, conversar sobre inclusão e descobrir fontes de informação — sem exigir que ninguém exponha diagnósticos, laudos ou histórias de crianças.</p>
    <div className="conecta-v3-support-points"><span><Heart size={16}/> Conversas sem julgamentos</span><span><ShieldCheck size={16}/> Orientações de privacidade</span><span><Sparkles size={16}/> Modo calmo, com menos animações</span></div>
    <Link href="/acolhimento" className="btn btn-primary">Conhecer o Acolhimento <ArrowRight size={17}/></Link>
   </div>
  </section>

  <section id="seu-espaco" className="conecta-v3-section conecta-v3-nostalgia">
   <div className="conecta-v3-nostalgia-copy"><span className="conecta-v3-kicker"><Star size={15}/> A INTERNET QUE A GENTE AMAVA</span><h2>O charme das redes clássicas.<br/><em>Do seu jeito, hoje.</em></h2>
    <p>Sente saudade do Orkut, do MSN e do MySpace? No Conecta, a nostalgia ganha nova vida em funcionalidades que já existem.</p>
    <div className="conecta-v3-nostalgia-list">
      <span><Palette size={19}/> Capas e temas de perfil</span>
      <span><Music2 size={19}/> Música e playlists no perfil</span>
      <span><Star size={19}/> Até 8 conexões em destaque</span>
      <span><MessageCircle size={19}/> Mural de recados entre amizades</span>
      <span><Smile size={19}/> Status, interesses e emoji favorito</span>
      <span><ImageIcon size={19}/> Galeria de fotos e vídeos</span>
    </div>
    <Link href="/perfil" className="conecta-v3-text-link">Personalizar meu espaço <ArrowRight size={17}/></Link>
   </div>
   <div className="conecta-v3-profile-example" aria-label="Representação visual de um perfil personalizável; sem dados de pessoas reais">
    <div className="conecta-v3-example-cover"><span>✳</span></div>
    <div className="conecta-v3-example-avatar"><Smile size={32}/></div>
    <div className="conecta-v3-example-details"><span>SEU ESPAÇO CONECTA</span><h3>Uma história só sua ✨</h3><p>Escolha suas cores, suas músicas e o que faz parte de você.</p>
      <div className="conecta-v3-example-chips"><span>#criatividade</span><span>#amizades</span><span>#música</span></div>
      <div className="conecta-v3-example-player"><Play size={16}/><div><strong>Playlist favorita</strong><small>Você escolhe o que compartilhar</small></div><Music2 size={17}/></div>
    </div>
   </div>
  </section>

  <section className="conecta-v3-section conecta-v3-how">
    <div className="conecta-v3-section-head"><div><span className="conecta-v3-kicker"><Compass size={15}/> FAÇA PARTE</span><h2>É sobre encontrar <em>o seu lugar.</em></h2></div></div>
    <div className="conecta-v3-how-grid">{steps.map(item=><div key={item.n}><span>{item.n}</span><h3>{item.title}</h3><p>{item.body}</p></div>)}</div>
    <div className="conecta-v3-safety"><LockKeyhole size={20}/><p>Privacidade e segurança são prioridades em evolução. A verificação confiável de idade, a supervisão de menores e controles adicionais ainda estão em desenvolvimento. O Conecta não oferece criptografia de ponta a ponta no chat.</p></div>
  </section>

  <section className="conecta-v3-final"><div><span><Sparkles size={16}/> A PRÓXIMA HISTÓRIA PODE SER A SUA</span><h2>Uma rede para conversar,<br/>criar e pertencer.</h2><p>Comece pelo seu espaço. O resto nasce das conexões.</p></div><Link href="/auth?mode=signup" className="btn btn-primary btn-lg">Criar minha conta <ArrowUpRight size={18}/></Link></section>
  <footer className="conecta-v3-footer"><ConceptBrand/><div><span>© {new Date().getFullYear()} Conecta · Uma rede social mais humana.</span><span>Imagens de interface ilustrativas; nenhum conteúdo de usuários foi simulado como real.</span></div><div style={{display:'flex',alignItems:'center',gap:20}}><Link href="/apps">Baixar app <Smartphone size={16}/></Link><Link href="/auth">Entrar <ArrowRight size={16}/></Link></div></footer>
 </main>;
}
