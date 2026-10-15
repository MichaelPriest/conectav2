'use client';

import {useState} from 'react';
import {CheckCircle2,Info,LockKeyhole,ShieldCheck} from 'lucide-react';

type MethodItem={
  id:string;
  label:string;
  cost:string;
  status:string;
  verifiesIdentity:boolean;
  verifiesAge:boolean;
  details:string;
  priceDisplay?:string;
};

const statusLabel:Record<string,string>={
  available:'Disponível como pré-triagem',
  configuration_required:'Configuração necessária',
  deferred_first_release:'Adiado nesta primeira versão',
  not_configured:'Não configurado',
  configured_requires_cost_disclosure:'Bloqueado: falta divulgar o custo real',
  ready_with_cost_disclosure:'Pronto após divulgação do custo',
  free_server_verification:'Disponível — análise automática própria do Conecta'
};

const costLabel:Record<string,string>={
  free:'Gratuito',
  no_per_check_fee:'Sem cobrança por consulta',
  provider_billed:'Cobrança do provedor'
};

export function IdentityMethodsPanel({methods,notice}:{methods:MethodItem[];notice:string}){
  const [showDetails,setShowDetails]=useState(true);
  return <section className="panel" style={{marginBottom:20}}>
    <div className="feed-title">
      <h2><ShieldCheck size={20} style={{verticalAlign:'middle'}}/> Métodos do Conecta ID</h2>
      <button className="btn btn-outline" type="button" onClick={()=>setShowDetails(value=>!value)}>
        {showDetails?'Ocultar detalhes':'Ver métodos'}
      </button>
    </div>
    <p>Prioridade para recursos gratuitos. Cada método informa claramente o que consegue verificar — nenhum sinal preliminar é tratado como aprovação oficial.</p>
    {showDetails&&<div style={{display:'grid',gap:12}}>
      {methods.map(method=><article key={method.id} style={{border:'1px solid var(--border-color, #dedee5)',borderRadius:12,padding:14}}>
        <div className="feed-title" style={{alignItems:'flex-start',gap:10}}>
          <strong>{method.label}</strong>
          <span className="small-note">{costLabel[method.cost]||method.cost}</span>
        </div>
        <p className="small-note" style={{margin:'8px 0'}}>{statusLabel[method.status]||method.status}</p>
        <p>{method.details}</p>
        <p className="small-note" style={{marginBottom:0}}>
          Identidade: <strong>{method.verifiesIdentity?'verifica':'não comprova'}</strong> · Idade: <strong>{method.verifiesAge?'verifica':'não comprova'}</strong>
        </p>
        {method.id==='external-identity-provider'&&method.status!=='ready_with_cost_disclosure'&&
          <p className="form-error" style={{marginBottom:0}}><LockKeyhole size={15} style={{verticalAlign:'middle'}}/> Bloqueado até o preço exato por tentativa ser confirmado e exibido antes de qualquer início. Não há cobrança iniciada por esta lista.</p>}
        {method.status==='available'&&<p className="small-note" style={{marginBottom:0}}><CheckCircle2 size={15} style={{verticalAlign:'middle'}}/> Pode ajudar na pré-triagem; não concede selo nem libera recursos restritos.</p>}
        {method.id==='free-document-face'&&<p className="small-note" style={{marginBottom:0}}>A decisão é registrada somente depois dos critérios executados no servidor; a comparação facial não é garantia absoluta contra fraude.</p>}
      </article>)}
    </div>}
    <p className="small-note" style={{marginTop:14}}><Info size={15} style={{verticalAlign:'middle'}}/> {notice}</p>
  </section>;
}
