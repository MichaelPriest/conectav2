'use client';
import {Plus,Trash2,BarChart3} from 'lucide-react';
export function PollDraft({question,options,onOptionsChange,days,onDaysChange}:{question:string;options:string[];onOptionsChange:(v:string[])=>void;days:number;onDaysChange:(v:number)=>void}){
 return <section className="conecta-poll-draft">
  <strong><BarChart3 size={17} style={{verticalAlign:'middle'}}/> Nova enquete</strong>
  <p className="small-note">Digite a pergunta no texto da publicação e adicione de 2 a 6 opções.</p>
  <div className="conecta-poll-options">{options.map((option,i)=><label className="conecta-poll-option" key={i}><span>{i+1}.</span><input maxLength={120} required value={option} placeholder={'Opção '+(i+1)} onChange={e=>onOptionsChange(options.map((x,j)=>i===j?e.target.value:x))}/>{options.length>2&&<button type="button" aria-label={'Remover opção '+(i+1)} onClick={()=>onOptionsChange(options.filter((_,j)=>j!==i))}><Trash2 size={15}/></button>}</label>)}</div>
  <div className="row" style={{gap:12,justifyContent:'space-between',flexWrap:'wrap'}}>
   <button type="button" className="btn btn-outline" onClick={()=>onOptionsChange([...options,''])} disabled={options.length>=6}><Plus size={16}/> Outra opção</button>
   <label className="small-note">Encerramento <select aria-label="Prazo da enquete" value={days} onChange={e=>onDaysChange(Number(e.target.value))}>{[1,3,7,14].map(d=><option key={d} value={d}>{d} {d===1?'dia':'dias'}</option>)}</select></label>
  </div>
 </section>;
}
export function validatePoll(question:string,options:string[]){
 if(question.trim().length<5||question.trim().length>250)throw new Error('A pergunta deve ter entre 5 e 250 caracteres.');
 if(options.length<2||options.length>6||options.some(o=>!o.trim()||o.trim().length>120))throw new Error('Informe de 2 a 6 opções válidas.');
 if(new Set(options.map(x=>x.trim().toLowerCase())).size!==options.length)throw new Error('As opções devem ser diferentes.');
}
