'use client';

import {FormEvent,useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowLeft,ArrowRight,CheckCircle2,Heart,HeartHandshake,ShieldCheck,Store,Users} from 'lucide-react';
import {GuardedPage,useAuthProfile} from '@/components/app-shell';
import {supabaseBrowser} from '@/lib/supabase/browser';

type Kind='plus'|'business'|'sponsorship';
type Interest={kind:Kind;status:'pending'|'contacted'|'closed'};
const offers:{kind:Kind;name:string;price:string;description:string;benefits:string[];icon:typeof Heart}[]=[
 {kind:'plus',name:'Conecta Plus',price:'R$ 14,90/mês',description:'Uma forma opcional de apoiar a comunidade.',
  benefits:['Temas e personalizações especiais','Novidades antes do lançamento','Menos anúncios, quando disponível'],icon:Heart},
 {kind:'business',name:'Conecta Negócios',price:'R$ 49,90/mês',description:'Ferramentas futuras para marcas e pequenos negócios.',
  benefits:['Página comercial com identidade própria','Estatísticas e catálogo de serviços','Contato com clientes e comunidades'],icon:Store},
 {kind:'sponsorship',name:'Patrocínios locais',price:'A partir de R$ 150',description:'Parcerias aprovadas e identificadas como publicidade.',
  benefits:['Campanhas com identificação de patrocínio','Sem anúncios em conversas privadas','Análise editorial e de segurança'],icon:Users}
];
const statusLabels={pending:'Solicitação recebida',contacted:'Contato iniciado',closed:'Solicitação encerrada'};

export default function SupportConecta(){
 const auth=useAuthProfile();
 const [kind,setKind]=useState<Kind>('plus');
 const [organization,setOrganization]=useState('');
 const [email,setEmail]=useState('');
 const [note,setNote]=useState('');
 const [agree,setAgree]=useState(false);
 const [sent,setSent]=useState<Interest[]>([]);
 const [loadingEntries,setLoadingEntries]=useState(true);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');

 useEffect(()=>{if(auth.user?.email)setEmail(auth.user.email);},[auth.user?.email]);
 useEffect(()=>{
  if(!auth.user)return;
  let alive=true;
  void supabaseBrowser().from('monetization_interests').select('kind,status')
    .eq('user_id',auth.user.id).then(({data,error:e})=>{
      if(!alive)return;
      if(e)setError('Não foi possível consultar suas solicitações: '+e.message);
      else setSent((data||[]) as Interest[]);
      setLoadingEntries(false);
    });
  return()=>{alive=false;};
 },[auth.user]);

 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  if(!auth.user||saving||!agree)return;
  setError('');setNotice('');
  if(kind!=='plus'&&organization.trim().length<2){setError('Informe a empresa ou organização.');return;}
  if(!email.trim()||email.length>254){setError('Informe um e-mail válido para contato.');return;}
  setSaving(true);
  const {error:e2}=await supabaseBrowser().from('monetization_interests').insert({
   user_id:auth.user.id,kind,
   organization_name:kind==='plus'?null:organization.trim(),
   contact_email:email.trim().toLowerCase(),
   note:note.trim(),contact_consent:true
  });
  if(e2){
   setError(e2.code==='23505'?'Você já registrou interesse nessa modalidade.':e2.message);
  }else{
   setSent(prev=>[...prev,{kind,status:'pending'}]);
   setNotice('Interesse registrado! Esta é uma lista de espera, sem pagamento ou assinatura ativa.');
   setAgree(false);setNote('');setOrganization('');
  }
  setSaving(false);
 }

 const existing=sent.find(item=>item.kind===kind);
 return <GuardedPage profile={auth.profile} loading={auth.loading} error={auth.error}>
  <main className="section-page conecta-money">
   <div className="page-heading"><div>
    <span className="section-eyebrow">COMUNIDADE EM PRIMEIRO LUGAR</span>
    <h1><HeartHandshake size={29}/> Apoie o Conecta</h1>
    <p>Queremos manter a rede gratuita e sustentável. Conheça as propostas e participe da lista de interesse.</p>
   </div><Link href="/feed" className="btn btn-outline"><ArrowLeft size={16}/> Voltar ao feed</Link></div>
   <section className="conecta-money-intro card">
    <div><strong>A rede continua gratuita para todos</strong>
    <p>Publicar, conversar e participar de comunidades não exige assinatura. Nenhuma oferta abaixo está à venda neste momento.</p></div>
    <ShieldCheck size={29} aria-hidden="true"/>
   </section>
   <div className="conecta-money-offers">
    {offers.map(item=>{const Icon=item.icon;const active=kind===item.kind;const registered=sent.find(s=>s.kind===item.kind);
     return <button key={item.kind} type="button" onClick={()=>{setKind(item.kind);setNotice('');setError('');}}
      className={'conecta-money-offer card '+(active?'selected':'')} aria-pressed={active}>
      <span className="conecta-money-offer-icon"><Icon size={21}/></span>
      <span className="conecta-money-offer-title">{item.name}</span>
      <span className="conecta-money-offer-price">{item.price}</span>
      <span className="conecta-money-proposal">Preço sugerido · não disponível para contratação</span>
      <span className="conecta-money-offer-description">{item.description}</span>
      <span className="conecta-money-benefits">{item.benefits.map(b=><span key={b}><CheckCircle2 size={15}/>{b}</span>)}</span>
      {registered&&<span className="conecta-money-registered"><CheckCircle2 size={14}/>{statusLabels[registered.status]}</span>}
     </button>;
    })}
   </div>
   <section className="card conecta-money-form-card" id="interesse">
    <h2>Tenho interesse em {offers.find(item=>item.kind===kind)?.name}</h2>
    <p>Sem pagamento: somente registraremos seu interesse e, com autorização, poderemos entrar em contato pelo e-mail informado.</p>
    {notice&&<p className="form-success" role="status">{notice}</p>}
    {error&&<p className="form-error" role="alert">{error}</p>}
    {loadingEntries?<p className="muted">Verificando solicitações...</p>:existing?
      <div className="conecta-money-done"><CheckCircle2 size={22}/><span>{statusLabels[existing.status]}. Você não precisa enviar novamente.</span></div>:
      <form className="conecta-money-form" onSubmit={submit}>
       {kind!=='plus'&&<label>Empresa ou organização<input className="form-input" type="text" value={organization}
         maxLength={120} minLength={2} required autoComplete="organization" onChange={e=>setOrganization(e.target.value)}/></label>}
       <label>E-mail de contato<input className="form-input" type="email" maxLength={254} required autoComplete="email"
         value={email} onChange={e=>setEmail(e.target.value)}/></label>
       <label>Conte um pouco do seu interesse (opcional)<textarea className="form-input" rows={3} maxLength={600}
         value={note} onChange={e=>setNote(e.target.value)}/></label>
       <label className="conecta-money-consent"><input type="checkbox" checked={agree} required
         onChange={e=>setAgree(e.target.checked)}/>
         <span>Autorizo o contato do Conecta sobre esta proposta. Entendo que posso solicitar exclusão dos meus dados de contato.</span></label>
       <button className="btn btn-primary" type="submit" disabled={saving||!agree}>{saving?'Registrando...':'Registrar interesse'} <ArrowRight size={16}/></button>
      </form>}
    <p className="small-note">Solicitações comerciais restritas a contas com faixa etária adulta declarada. Isso não é comprovação de maioridade nem autorização para anúncios comportamentais. Os dados são usados para retorno sobre a proposta.</p>
   </section>
  </main>
 </GuardedPage>;
}
