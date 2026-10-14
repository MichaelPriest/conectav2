'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {supabaseBrowser} from '@/lib/supabase/browser';
import {UsersRound,UserRoundPlus,ShieldCheck,Check, X, Search, Link2} from 'lucide-react';

type Person={id:string;handle:string;display_name:string;avatar_path:string|null};
type Family={id:string;requester_id:string;addressee_id:string;relationship_type:string;status:string;requested_by:string};
type Guardian={id:string;child_user_id:string;guardian_user_id:string;relationship_type:string;status:string;requested_by:string};
type RelationshipType='mother'|'father'|'parent'|'child'|'guardian'|'sibling'|'grandparent'|'grandchild'|'spouse'|'partner'|'aunt_uncle'|'niece_nephew'|'cousin'|'other';

const familyOptions:[RelationshipType,string][]=[
 ['mother','Mãe'],['father','Pai'],['parent','Pai/mãe'],['child','Filho(a)'],['guardian','Responsável'],['sibling','Irmão/irmã'],
 ['grandparent','Avô/avó'],['grandchild','Neto(a)'],['spouse','Cônjuge'],['partner','Companheiro(a)'],
 ['aunt_uncle','Tio/tia'],['niece_nephew','Sobrinho(a)'],['cousin','Primo(a)'],['other','Outro parentesco']
];

export function FamilyRelationships({userId}:{userId:string}){
 const [people,setPeople]=useState<Person[]>([]),[family,setFamily]=useState<Family[]>([]),[guardians,setGuardians]=useState<Guardian[]>([]);
 const [query,setQuery]=useState(''),[target,setTarget]=useState(''),[kind,setKind]=useState<RelationshipType>('parent');
 const [mode,setMode]=useState<'family'|'guardian'>('family'),[guardianRole,setGuardianRole]=useState<'i_am_guardian'|'they_are_guardian'>('they_are_guardian');
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');

 const load=useCallback(async()=>{
  setLoading(true);setError('');
  try{
   const [relationResponse,profileResponse]=await Promise.all([
    fetch('/api/relationships/family',{credentials:'same-origin',cache:'no-store'}),
    supabaseBrowser().from('profiles').select('id,handle,display_name,avatar_path').order('display_name').limit(500)
   ]);
   const payload=await relationResponse.json();
   if(!relationResponse.ok)throw new Error(payload.error||'Não foi possível carregar os parentescos.');
   if(profileResponse.error)throw new Error('Não foi possível pesquisar contas do Conecta.');
   setFamily(payload.family||[]);setGuardians(payload.guardians||[]);setPeople((profileResponse.data||[]) as Person[]);
  }catch(e){setError(e instanceof Error?e.message:'Falha ao carregar relacionamentos.');}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{void load();},[load]);

 const matches=useMemo(()=>{
  const q=query.trim().replace(/^@/,'').toLocaleLowerCase('pt-BR');
  return people.filter(p=>p.id!==userId&&q&&(p.handle+' '+p.display_name).toLocaleLowerCase('pt-BR').includes(q)).slice(0,8);
 },[people,query,userId]);
 const person=(id:string)=>people.find(p=>p.id===id);
 async function send(action:string,extra:Record<string,string>={}){
  setBusy(true);setError('');setNotice('');
  try{
   const response=await fetch('/api/relationships/family',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...extra})});
   const payload=await response.json();
   if(!response.ok)throw new Error(payload.error||'Não foi possível concluir a ação.');
   setNotice(payload.message||'Relacionamento atualizado.');setTarget('');setQuery('');
   await load();
  }catch(e){setError(e instanceof Error?e.message:'Falha ao atualizar relacionamento.');}
  finally{setBusy(false);}
 }
 function counterpart(row:Family){return row.requester_id===userId?row.addressee_id:row.requester_id;}
 function guardianCounterpart(row:Guardian){return row.child_user_id===userId?row.guardian_user_id:row.child_user_id;}
 function display(id:string){const p=person(id);return p?(p.display_name+' (@'+p.handle+')'):'Conta Conecta';}
 return <section className="panel stack" aria-labelledby="family-relationships-title">
  <div className="feed-title"><h2 id="family-relationships-title"><UsersRound size={20}/> Família e responsáveis</h2><span className="small-note">Privado por padrão</span></div>
  <p className="small-note">Adicione parentes e convide um pai, mãe ou responsável para associar as contas. O vínculo só é confirmado após a outra conta aceitar; isso, por si só, não comprova parentesco legal.</p>
  <div className="stack">
   <label className="field-label">Buscar pessoa por nome ou @usuário
    <div className="searchbox"><Search size={16}/><input value={query} onChange={e=>{setQuery(e.target.value);setTarget('');}} placeholder="Digite o nome ou @usuário"/></div>
   </label>
   {matches.length>0&&<div className="stack" role="listbox" aria-label="Resultados da busca">{matches.map(p=><button key={p.id} type="button" className="btn btn-outline" style={{justifyContent:'flex-start'}} onClick={()=>{setTarget(p.id);setQuery(p.display_name+' (@'+p.handle+')');}}>{p.display_name} <span className="small-note">@{p.handle}</span></button>)}</div>}
   {target&&<div className="stack">
    <label className="field-label">Tipo de vínculo
     <select className="form-input" value={kind} onChange={e=>setKind(e.target.value as RelationshipType)}>{familyOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
    </label>
    <div className="conecta-profile-tabs" role="group" aria-label="Tipo de associação">
     <button type="button" className={mode==='family'?'active':''} onClick={()=>setMode('family')}>Parentesco</button>
     <button type="button" className={mode==='guardian'?'active':''} onClick={()=>setMode('guardian')}>Responsável de menor</button>
    </div>
    {mode==='guardian'&&<label className="field-label">Quem é o responsável?
      <select className="form-input" value={guardianRole} onChange={e=>setGuardianRole(e.target.value as typeof guardianRole)}>
       <option value="they_are_guardian">A pessoa selecionada é meu responsável</option>
       <option value="i_am_guardian">Eu sou responsável pela pessoa selecionada</option>
      </select>
    </label>}
    <button className="btn btn-primary" type="button" disabled={busy} onClick={()=>mode==='family'
      ?void send('family_invite',{targetUserId:target,relationshipType:kind})
      :void send('guardian_invite',{
        childUserId:guardianRole==='i_am_guardian'?target:userId,
        guardianUserId:guardianRole==='i_am_guardian'?userId:target,
        relationshipType:kind==='parent'?'parent':kind==='guardian'?'legal_guardian':'caregiver'
      })}><UserRoundPlus size={16}/>{busy?'Enviando...':mode==='family'?'Convidar como parente':'Convidar para associação de responsável'}</button>
   </div>}
  </div>
  {error&&<p className="form-error" role="alert">{error}</p>}
  {notice&&<p className="small-note" role="status">{notice}</p>}
  {loading?<p className="small-note">Carregando vínculos...</p>:<>
   <div className="stack">
    <h3><Link2 size={16}/> Parentescos</h3>
    {family.length===0?<p className="small-note">Ainda não há parentescos cadastrados.</p>:family.map(row=>{
      const incoming=row.addressee_id===userId&&row.status==='pending';
      return <div key={row.id} className="row" style={{justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
       <div><strong>{display(counterpart(row))}</strong><div className="small-note">{familyOptions.find(([v])=>v===row.relationship_type)?.[1]||row.relationship_type} · {row.status==='accepted'?'confirmado':row.status==='pending'?'pendente':row.status==='rejected'?'recusado':'removido'}</div></div>
       <div className="row" style={{gap:8,flexWrap:'wrap'}}>
        {incoming&&<><button className="btn btn-primary" type="button" disabled={busy} onClick={()=>void send('family_respond',{relationshipId:row.id,decision:'accept'})}><Check size={15}/> Aceitar</button><button className="btn btn-outline" type="button" disabled={busy} onClick={()=>void send('family_respond',{relationshipId:row.id,decision:'reject'})}><X size={15}/> Recusar</button></>}
        {(row.status==='accepted'||row.status==='pending')&&<button className="btn btn-outline" type="button" disabled={busy} onClick={()=>void send('family_revoke',{relationshipId:row.id})}>Remover</button>}
       </div>
      </div>;
    })}
   </div>
   <div className="stack">
    <h3><ShieldCheck size={16}/> Associações de responsável</h3>
    {guardians.length===0?<p className="small-note">Para menores, a conta precisa ser associada a um pai, mãe ou responsável com conta Conecta e maioridade confirmada.</p>:guardians.map(row=>{
      const incoming=row.requested_by!==userId&&row.status==='pending';
      return <div key={row.id} className="row" style={{justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
       <div><strong>{display(guardianCounterpart(row))}</strong><div className="small-note">{row.child_user_id===userId?'Responsável da sua conta':'Você é responsável por esta conta'} · {row.status==='accepted'?'associação confirmada':row.status==='pending'?'aguardando aceite':row.status==='rejected'?'recusada':'revogada'}</div></div>
       <div className="row" style={{gap:8,flexWrap:'wrap'}}>
        {incoming&&<><button className="btn btn-primary" type="button" disabled={busy} onClick={()=>void send('guardian_respond',{relationshipId:row.id,decision:'accept'})}><Check size={15}/> Aceitar</button><button className="btn btn-outline" type="button" disabled={busy} onClick={()=>void send('guardian_respond',{relationshipId:row.id,decision:'reject'})}><X size={15}/> Recusar</button></>}
        {row.status==='accepted'&&<button className="btn btn-outline" type="button" disabled={busy} onClick={()=>void send('guardian_revoke',{relationshipId:row.id})}>Revogar</button>}
       </div>
      </div>;
    })}
   </div>
  </>}
 </section>;
}
