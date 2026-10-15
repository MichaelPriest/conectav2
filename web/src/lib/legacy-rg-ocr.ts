/** Local/server-side OCR parsing for legacy Brazilian RG.
 * Never promote document text to verified identity/age.
 * Raw OCR text and full birth dates must never be persisted or returned.
 */
export type LegacyRgBand='under_13'|'13_15'|'16_17'|'18_plus';
export type LegacyRgPreflight={
 status:'age-indicative'|'date-uncertain'|'unreadable';
 band?:LegacyRgBand;
 message:string;
};
function isoDateFromBrazilian(value:string):string|null{
 const match=value.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
 if(!match)return null;
 const day=Number(match[1]),month=Number(match[2]),year=Number(match[3]);
 if(year<1900||year>2100)return null;
 const d=new Date(Date.UTC(year,month-1,day,12));
 if(d.getUTCFullYear()!==year||d.getUTCMonth()+1!==month||d.getUTCDate()!==day)return null;
 return [String(year),String(month).padStart(2,'0'),String(day).padStart(2,'0')].join('-');
}
function ageBand(iso:string,today:Date):LegacyRgBand|null{
 const [y,m,d]=iso.split('-').map(Number);
 let years=today.getFullYear()-y;
 if(today.getMonth()+1<m||(today.getMonth()+1===m&&today.getDate()<d))years--;
 if(years<0||years>120)return null;
 return years<13?'under_13':years<16?'13_15':years<18?'16_17':'18_plus';
}
/** Extract only dates associated with a birth label; never infer from issue date. */
export function extractBirthDateFromOcr(raw:string):string|null{
 if(typeof raw!=='string'||!raw.trim())return null;
 const text=raw.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase()
   .replace(/\r/g,'\n').replace(/\t/g,' ').replace(/[ ]{2,}/g,' ');
 // Older São Paulo RG OCR often fragments "DATA DE NASCIMENTO" into
 // pieces such as "DATA DE NTO NAS ASCIMENT". Accept the distinctive
 // truncated birth-label fragments, but still require a date in that field.
 const birthLabels=/(?:\bDATA\s*(?:DE\s*)?NASCIMENTO\b|\bNASCIMENTO\b|\bDT\.?\s*NASC(?:IMENTO)?\b|\bNAS\s+ASCIMENT[O0]?\b|\bASCIMENT[O0]?\b)/g;
 const datePattern=/(?:^|[^\d])(\d{1,2}\s*[./-]\s*\d{1,2}\s*[./-]\s*\d{4}|\d{1,2}\s+\d{1,2}\s+\d{4})(?!\d)/g;
 const found:string[]=[];
 let ambiguous=false;
 for(const match of text.matchAll(birthLabels)){
  const start=(match.index||0)+match[0].length;
  const region=text.slice(start,start+180).split(/(?:DATA\s*(?:DE\s*)?EXPEDICAO|EXPEDICAO|VALIDADE|EMISSAO|REGISTRO|CATEGORIA|NACIONALIDADE|ORGAO\s*EMISSOR|CPF|FILIACAO)/)[0];
  const dates=[...region.matchAll(datePattern)];
  if(dates.length>1){ambiguous=true;continue;}
  if(dates.length!==1)continue;
  const rawDate=dates[0][1].replace(/\s*([./-])\s*/g,'$1').replace(/\s+/g,'/').replace(/[.]/g,'/').replace(/-/g,'/');
  const iso=isoDateFromBrazilian(rawDate);
  if(iso)found.push(iso);
 }
 const unique=[...new Set(found)];
 return !ambiguous&&unique.length===1?unique[0]:null;
}
/** Returns only an indicative age band; no DOB or raw OCR text is returned. */
export function inspectLegacyRgOcr(raw:string,today:Date=new Date()):LegacyRgPreflight{
 if(typeof raw!=='string'||!raw.trim())return {status:'unreadable',message:'Nenhum texto legível foi encontrado nas imagens.'};
 const dob=extractBirthDateFromOcr(raw);
 if(!dob)return {status:'date-uncertain',message:'Não foi possível identificar uma única data de nascimento com segurança. Confira a nitidez do RG; não use este resultado para comprovar idade.'};
 const band=ageBand(dob,today);
 if(!band)return {status:'date-uncertain',message:'A data de nascimento lida não é plausível. A verificação permanece pendente.'};
 return {status:'age-indicative',band,message:'O OCR identificou uma possível faixa etária no RG antigo. O resultado não comprova autenticidade, titularidade nem maioridade.'};
}
