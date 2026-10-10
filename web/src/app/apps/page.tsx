import type {Metadata} from 'next';
import Link from 'next/link';
import {ArrowDownToLine,ArrowLeft,ArrowRight,CheckCircle2,ExternalLink,
 Info,ShieldCheck,Smartphone,TabletSmartphone} from 'lucide-react';
import {ConceptBrand} from '@/components/concept-brand';
import {latestAndroidRelease} from '@/lib/app-downloads';

export const metadata:Metadata={
 title:'Baixar Conecta | Android e iPhone',
 description:'Baixe a versão Alpha Android do Conecta e acompanhe a futura distribuição para iPhone.'
};
export const revalidate=300;

function fileSize(bytes:number){
 return (bytes/1048576).toLocaleString('pt-BR',{maximumFractionDigits:1})+' MB';
}
export default async function AppsPage(){
 const latest=await latestAndroidRelease();
 return <main className="conecta-apps">
  <header className="conecta-apps-header">
   <ConceptBrand/>
   <nav aria-label="Navegação do Conecta">
    <Link href="/">Início</Link><Link href="/auth">Entrar <ArrowRight size={16}/></Link>
   </nav>
  </header>
  <div className="conecta-apps-main">
   <div className="conecta-apps-intro">
    <span className="conecta-apps-kicker"><Smartphone size={17}/> CONECTA NO SEU CELULAR</span>
    <h1>Leve suas conexões <em>com você.</em></h1>
    <p>Stories, publicações, comunidades e conversas em um aplicativo feito para o seu celular. Veja as versões de testes disponíveis.</p>
   </div>
   <div className="conecta-apps-grid">
    <section className="conecta-apps-card android" aria-labelledby="conecta-android">
     <div className="conecta-apps-icon"><Smartphone size={29}/></div>
     <span className="conecta-apps-platform">ANDROID</span>
     <h2 id="conecta-android">Conecta para Android</h2>
     <p>Baixe o APK Alpha pelo repositório oficial do Conecta, sem precisar da Play Store.</p>
     {latest?<>
      <div className="conecta-apps-release"><CheckCircle2 size={18}/>
       <span>Alpha {latest.version} disponível</span><small>{fileSize(latest.size)}</small>
      </div>
      <a className="conecta-apps-button" href={latest.downloadUrl}
       aria-label={'Baixar Conecta Android Alpha '+latest.version}
       rel="noopener noreferrer"><ArrowDownToLine size={21}/> Baixar APK Android</a>
      <a className="conecta-apps-secondary" href={latest.releaseUrl}
       rel="noopener noreferrer">Ver publicação oficial <ExternalLink size={15}/></a>
      {latest.sha256&&<details className="conecta-apps-checksum">
       <summary>Verificar SHA-256 do arquivo</summary><code>{latest.sha256}</code>
      </details>}
     </>:<>
      <div className="conecta-apps-release unavailable"><Info size={18}/>
       Não foi possível confirmar a versão mais recente agora.
      </div>
      <a className="conecta-apps-button secondary"
       href="https://github.com/MichaelPriest/conectav2/releases"
       rel="noopener noreferrer">Consultar versões oficiais <ExternalLink size={17}/></a>
     </>}
     <div className="conecta-apps-instructions">
      <strong>Como instalar no Android</strong>
      <ol><li>Baixe o APK e abra-o no celular.</li>
       <li>Quando solicitado, permita a instalação desta fonte.</li>
       <li>Confirme a instalação e faça login no Conecta.</li></ol>
      <small>Versão Alpha de testes, assinada com certificado de homologação. Não é uma versão da Play Store.</small>
     </div>
    </section>
    <section className="conecta-apps-card ios" aria-labelledby="conecta-ios">
     <div className="conecta-apps-icon"><TabletSmartphone size={29}/></div>
     <span className="conecta-apps-platform">IPHONE · IOS</span>
     <h2 id="conecta-ios">Conecta para iPhone</h2>
     <p>A versão nativa iOS está em desenvolvimento e validação. Ainda não há instalador público para iPhones físicos.</p>
     <div className="conecta-apps-release unavailable"><Info size={18}/>
      Distribuição para iPhone em preparação
     </div>
     <div className="conecta-apps-instructions">
      <strong>Sobre os testes no iPhone</strong>
      <p>Para instalar em um iPhone físico, precisamos preparar uma build assinada para os aparelhos autorizados, ou disponibilizar uma versão pelo TestFlight.</p>
      <p>Uma versão de simulador iOS não pode ser instalada diretamente em um iPhone.</p>
     </div>
     <Link className="conecta-apps-button secondary" href="/auth">
      Acessar pelo navegador <ArrowRight size={18}/>
     </Link>
    </section>
   </div>
   <aside className="conecta-apps-safety">
    <ShieldCheck size={25}/>
    <div><strong>Instale somente arquivos oficiais</strong>
     <p>O Conecta Alpha ainda está em desenvolvimento. O botão Android usa as publicações oficiais do repositório, com verificação da versão e do endereço do APK.</p>
    </div>
   </aside>
   <Link href="/" className="conecta-apps-back"><ArrowLeft size={17}/> Voltar ao início</Link>
  </div>
  <footer className="conecta-apps-footer">© {new Date().getFullYear()} Conecta · Aplicativos em homologação</footer>
 </main>;
}
