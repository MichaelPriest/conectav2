#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const here=dirname(fileURLToPath(import.meta.url));
const ref=process.env.SUPABASE_PROJECT_REF || 'opdlxxrcdsxqmlhgayfm';
const token=process.env.SUPABASE_ACCESS_TOKEN;
const apply=process.argv.includes('--apply');
if(!token){console.error('Defina SUPABASE_ACCESS_TOKEN no ambiente.');process.exit(2);}
if(ref!=='opdlxxrcdsxqmlhgayfm' && process.env.ALLOW_OTHER_PROJECT!=='yes'){console.error('Ref incorreta: projeto Conecta protegido.');process.exit(2);}
if(!/^[a-z0-9]{20}$/.test(ref)){console.error('Ref inválida.');process.exit(2);}
const manifest=JSON.parse(await readFile(join(here,'manifest.json'),'utf8'));
const desired={};
for(const [kind,item] of Object.entries(manifest)){
 desired['mailer_subjects_'+kind]=item.subject;
 desired['mailer_templates_'+kind+'_content']=await readFile(join(here,item.file),'utf8');
}
const endpoint='https://api.supabase.com/v1/projects/'+ref+'/config/auth';
async function api(method,body){
 const r=await fetch(endpoint,{method,headers:{Authorization:'Bearer '+token,Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 if(!r.ok)throw new Error('Supabase Management API retornou HTTP '+r.status);
 return r.json();
}
try{
 const current=await api('GET');
 const changed=Object.keys(desired).filter(k=>current[k]!==desired[k]);
 console.log(changed.length?'Campos a atualizar: '+changed.length:'Templates sincronizados.');
 if(!apply){console.log('Sem alterações. Use --apply para atualizar.');process.exit(0);}
 if(!changed.length)process.exit(0);
 await api('PATCH',Object.fromEntries(changed.map(k=>[k,desired[k]])));
 const after=await api('GET');
 const missing=Object.keys(desired).filter(k=>after[k]!==desired[k]);
 if(missing.length)throw new Error('Verificação pós-aplicação falhou em '+missing.length+' campos.');
 console.log('Publicação e verificação concluídas para '+ref+'.');
}catch(e){console.error('Erro: '+(e instanceof Error?e.message:String(e)));process.exit(1);}
