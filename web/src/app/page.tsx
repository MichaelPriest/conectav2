import Link from 'next/link';
import { ArrowUpRight, Heart, MessageCircle, Users, Sparkles, ShieldCheck } from 'lucide-react';

export default function Home() {
  return (
    <main className="landing">
      <header className="landing-nav">
        <Link href="/" className="brand"><span className="brand-mark">c.</span> conecta<span className="brand-dot">.</span></Link>
        <Link href="/auth" className="btn btn-outline">Entrar <ArrowUpRight size={16}/></Link>
      </header>
      <section className="landing-content">
        <div className="eyebrow"><Sparkles size={15}/> CONEXÕES QUE IMPORTAM</div>
        <h1>Um espaço para ser <em>você.</em><br/> E encontrar sua <em>tribo.</em></h1>
        <p>Compartilhe seu mundo, participe de comunidades e faça novas conexões. Uma rede social mais humana, do seu jeito.</p>
        <div className="landing-actions">
          <Link className="btn btn-primary btn-lg" href="/auth?mode=signup">Criar minha conta <ArrowUpRight size={18}/></Link>
          <Link className="btn btn-glass btn-lg" href="/auth">Já tenho conta</Link>
        </div>
        <div className="landing-features">
          <span><Heart size={17}/> Compartilhe momentos</span>
          <span><Users size={17}/> Encontre comunidades</span>
          <span><MessageCircle size={17}/> Converse de verdade</span>
          <span><ShieldCheck size={17}/> Controle sua privacidade</span>
        </div>
      </section>
      <div className="landing-art" aria-hidden="true"><span>conecta</span><span>conecta</span><span>conecta</span></div>
      <footer className="landing-footer">© {new Date().getFullYear()} Conecta · Feito para conexões reais</footer>
    </main>
  );
}
