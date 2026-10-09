'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {BookOpen,HeartHandshake,ShieldCheck,Users,Leaf,ExternalLink,MessageCircle,School,HandHeart} from 'lucide-react';
import {GuardedPage,useAuthProfile} from '@/components/app-shell';

const topics=[
 {title:'Uma rede de acolhimento',subtitle:'Falar sem julgamentos',text:'Compartilhe o que faz sentido para você. Também está tudo bem só acompanhar as conversas.',icon:HeartHandshake},
 {title:'Rotinas e estratégias',subtitle:'Trocar experiências',text:'Conte o que ajudou sua família, respeitando que cada pessoa e cada contexto são diferentes.',icon:Leaf},
 {title:'Escola e inclusão',subtitle:'Informação e diálogo',text:'Converse sobre comunicação com escolas, adaptações e práticas inclusivas sem expor dados de crianças.',icon:School},
 {title:'Cuidado de quem cuida',subtitle:'Rede de apoio',text:'Reconheça seu próprio descanso, limites e necessidades. Nenhuma família precisa ser perfeita.',icon:HandHeart}
] as const;
const resources=[
 {name:'Guia de Direitos de Acessibilidade',source:'Ministério dos Direitos Humanos',url:'https://www.gov.br/mdh/pt-br/navegue-por-temas/pessoa-com-deficiencia/publicacoes/guia-pratico-de-direitos-de-acessibilidade'},
 {name:'Entenda o Atendimento Educacional Especializado (AEE)',source:'Inep / Ministério da Educação',url:'https://www.gov.br/inep/pt-br/acesso-a-informacao/perguntas-frequentes/censo-escolar/educacao-especial/o-que-e-o-atendimento'},
 {name:'Publicações sobre direitos das pessoas com deficiência',source:'Ministério dos Direitos Humanos',url:'https://www.gov.br/mdh/pt-br/navegue-por-temas/pessoa-com-deficiencia/publicacoes'}
] as const;
export default function AcolhimentoPage(){
 const auth=useAuthProfile();
 const [calm,setCalm]=useState(false);
 useEffect(()=>{try{setCalm(localStorage.getItem('conecta-calm-mode')==='1');}catch{}},[]);
 function toggleCalm(){
   const next=!calm;setCalm(next);
   document.documentElement.dataset.calmMode=next?'1':'0';
   try{localStorage.setItem('conecta-calm-mode',next?'1':'0');}catch{}
 }
 return <GuardedPage {...auth}><main className="section-page conecta-support-page">
   <section className="conecta-support-hero">
     <span className="section-eyebrow">COMUNIDADE, PERTENCIMENTO E INCLUSÃO</span>
     <h1>Um espaço para mães atípicas e redes de cuidado</h1>
     <p>Escuta respeitosa, troca de experiências e informações confiáveis. Aberto a mães, familiares, cuidadores e pessoas que apoiam a inclusão — sem exigir que você revele diagnósticos ou informações pessoais.</p>
     <div className="conecta-support-hero-actions">
       <Link className="btn btn-primary" href="/comunidades/maes-atipicas-rede-apoio"><Users size={18}/> Participar da comunidade</Link>
       <Link className="btn btn-outline" href="/conexoes"><MessageCircle size={18}/> Encontrar conexões</Link>
     </div>
   </section>
   <div className="conecta-support-intro-row">
     <div><h2>O que você encontra aqui</h2><p>Temas para começar conversas reais e construir vínculos de apoio.</p></div>
     <label className="conecta-support-calm"><input type="checkbox" checked={calm} onChange={toggleCalm}/> Modo calmo (menos animações)</label>
   </div>
   <div className="conecta-support-cards">{topics.map(({title,subtitle,text,icon:Icon})=>
     <article key={title} className="panel conecta-support-card"><Icon size={24}/><span className="section-eyebrow">{subtitle}</span><h3>{title}</h3><p>{text}</p></article>)}</div>
   <div className="conecta-support-bottom">
     <section className="panel"><h2><BookOpen size={20}/> Fontes públicas de informação</h2>
       <p className="small-note">Links oficiais para consulta. Informação geral não substitui atendimento profissional ou orientação jurídica individualizada.</p>
       <div className="conecta-support-resources">{resources.map(resource=><a key={resource.url} href={resource.url} rel="noopener noreferrer" target="_blank">
         <strong>{resource.name}</strong><small>{resource.source}</small><ExternalLink size={17}/></a>)}</div>
     </section>
     <section className="panel"><h2><ShieldCheck size={20}/> Proteja sua privacidade</h2>
       <p>Não publique laudos, documentos, nomes de escolas, horários detalhados ou imagens identificáveis de crianças. Peça autorização antes de compartilhar histórias de terceiros.</p>
       <p>Denuncie exposição indevida, capacitismo, golpes ou promessas de tratamento milagroso. O apoio entre pares não substitui assistência de saúde ou serviços públicos.</p>
       <Link href="/comunidades/maes-atipicas-rede-apoio" className="rail-link">Ver regras da comunidade →</Link>
     </section>
   </div>
 </main></GuardedPage>;
}
