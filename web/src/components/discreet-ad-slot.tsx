'use client';
import {useEffect,useMemo,useState} from 'react';
import {HeartHandshake,ShieldCheck,X} from 'lucide-react';
import {supabaseBrowser} from '@/lib/supabase/browser';

type Format='desktop'|'mobile';
const formats={
 desktop:{key:'cb662f26f82b4b95fede2e5dc913f911',width:300,height:250},
 mobile:{key:'61dce6924b1bd636ce02c9ae38409b1e',width:320,height:50}
} as const;

/**
 * Only the two supplied, non-intrusive iframe codes are used.
 * An opaque, script-only sandbox prevents popunders, automatic new tabs,
 * parent-app DOM access and top-level redirects by the ad creative.
 * No app metadata, user profiles or JWTs are supplied to the advertiser.
 */
function adFrameHtml(format:Format):string{
 const {key,width,height}=formats[format];
 const opts={key,format:'iframe',width,height,params:{}};
 return '<!doctype html><html><head><meta charset="utf-8"><meta name="referrer" content="origin"/>'+
 '<style>html,body{padding:0;margin:0;overflow:hidden;width:'+width+'px;height:'+height+'px;background:transparent}</style>'+
 '</head><body><script>window.atOptions='+JSON.stringify(opts)+';<\/script>'+
 '<script async src="https://www.highrevenueformat.com/'+key+'/invoke.js"><\/script></body></html>';
}

export function DiscreetAdSlot({format}:{format:Format}){
 const [eligible,setEligible]=useState(false);
 const [consent,setConsent]=useState(false);
 const [userId,setUserId]=useState<string|null>(null);
 const frame=useMemo(()=>adFrameHtml(format),[format]);
 useEffect(()=>{
   let active=true;
   async function verify(){
     try{
       const {data:{session}}=await supabaseBrowser().auth.getSession();
       if(!session?.access_token || !active)return;
       const response=await fetch('/api/ads/eligibility',{
         headers:{Authorization:'Bearer '+session.access_token},
         cache:'no-store'
       });
       if(!response.ok)return;
       const result=(await response.json()) as {eligible?:boolean};
       if(!active || result.eligible!==true)return;
       setUserId(session.user.id);
       setEligible(true);
       try{setConsent(localStorage.getItem('conecta-adsterra-optin:'+session.user.id)==='yes');}catch{}
     }catch{/* Unknown age, unsupported ad provider or network errors: show nothing. */}
   }
   void verify();
   return ()=>{active=false;};
 },[]);
 if(!eligible||!userId)return null;
 function toggle(allow:boolean){
   setConsent(allow);
   try{
     const key='conecta-adsterra-optin:'+userId;
     if(allow)localStorage.setItem(key,'yes');
     else localStorage.removeItem(key);
   }catch{}
 }
 return <section className={'conecta-discreet-ad conecta-discreet-ad-'+format}
   aria-label="Publicidade de terceiros" data-ad-placement={format}>
   {consent?<>
     <div className="conecta-discreet-ad-header">
       <span>Publicidade</span>
       <button type="button" onClick={()=>toggle(false)} title="Desativar anúncios de terceiros"><X size={13}/> Desativar</button>
     </div>
     <iframe title="Publicidade Adsterra" sandbox="allow-scripts"
       loading="lazy" srcDoc={frame}
       referrerPolicy="origin" width={formats[format].width}
       height={formats[format].height}
       style={{display:'block',width:formats[format].width,height:formats[format].height,maxWidth:'100%',margin:'0 auto',border:0}}
       scrolling="no"/>
   </>:<div className="conecta-discreet-ad-consent">
      <HeartHandshake size={19} aria-hidden="true"/>
      <strong>Ajude a manter o Conecta gratuito</strong>
      <p>Um anúncio discreto ajuda a pagar a hospedagem. Se permitir, o anunciante poderá processar dados de navegação segundo sua política.</p>
      <button type="button" className="btn btn-outline" onClick={()=>toggle(true)}>
        <ShieldCheck size={16}/> Permitir publicidade
      </button>
    </div>}
 </section>;
}
