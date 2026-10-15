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
 const normalized=value.toUpperCase().replace(/[OQ]/g,'0').replace(/[IL|]/g,'1');
 const parts=normalized.split(/[.\/-\s]+/);
 if(parts.length!==3||parts[0].length>2||parts[1].length>2||parts[2].length!==4||
    parts.some(part=>!/^\d+$/.test(part)))return null;
 const day=Number(parts[0]),month=Number(parts[1]),year=Number(parts[2]);
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
type DateCandidate={iso:string;start:number;end:number};
type LabelCandidate={start:number;end:number};
/**
 * Extract only dates associated with an explicit birth label.
 * OCR often returns columns out of visual order, places the date before its
 * label, or confuses O/0 and I/1. Handle these cases without falling back to
 * an unrelated issue/expiry date.
 */
export function extractBirthDateFromOcr(raw:string):string|null{
 if(typeof raw!=='string'||!raw.trim())return null;
 const text=raw.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase()
   .replace(/[\u200B-\u200D\uFEFF]/g,' ')
   .replace(/\r/g,'\n').replace(/\t/g,' ').replace(/[ ]{2,}/g,' ');
 // Include abbreviations and common OCR splits such as "NASCIM ENTO",
 // "NASCIMEN TO", "NAS ASCIMENT" and "DT. NASC".
 const birthLabels=/(?:\bDATA\s*(?:DE\s*)?(?:NASCIMENTO|NASCIM\s*ENTO|NASCIMEN\s*TO)\b|\bDT\.?\s*NASC(?:IMENTO|IM\s*ENTO|IMEN\s*TO)?\b|\bNASC(?:IMENTO|IM\s*ENTO|IMEN\s*TO|\.)\b|\bNAS\s+ASCIMENT[O0]?\b|\bASCIMENT[O0]?\b)/g;
 const glyph='[0-9OQIL|]';
 const datePattern=new RegExp('(?:^|[^0-9A-Z])('+glyph+'{1,2}\\s*[./-]\\s*'+glyph+'{1,2}\\s*[./-]\\s*'+glyph+'{4}|'+glyph+'{1,2}\\s+'+glyph+'{1,2}\\s+'+glyph+'{4})(?![0-9A-Z])','g');
 const dates:DateCandidate[]=[];
 for(const match of text.matchAll(datePattern)){
  const value=match[1];
  const start=(match.index||0)+match[0].indexOf(value);
  const iso=isoDateFromBrazilian(value);
  if(iso)dates.push({iso,start,end:start+value.length});
 }
 const labels:LabelCandidate[]=[...text.matchAll(birthLabels)].map(match=>({
   start:match.index||0,
   end:(match.index||0)+match[0].length
 }));
 if(!labels.length||!dates.length)return null;

 // A date following an issue/expiry label belongs to that field, even if OCR
 // reorders the page and prints NASCIMENTO after it. Do not relabel that date
 // as birth date unless a birth label occurs between the two.
 const issueFieldPattern=/(?:\\bDATA\\s*(?:DE\\s*)?EXPEDICAO\\b|\\bEXPEDICAO\\b|\\bVALIDADE\\b|\\bEMISSAO\\b)/g;
 const issueFields:LabelCandidate[]=[...text.matchAll(issueFieldPattern)].map(match=>({
   start:match.index||0,
   end:(match.index||0)+match[0].length
 }));
 const belongsToIssueField=(date:DateCandidate)=>{
   const prior=issueFields
     .filter(field=>field.end<=date.start&&date.start-field.end<=140)
     .sort((a,b)=>b.end-a.end)[0];
   if(!prior)return false;
   return !labels.some(label=>label.start>=prior.end&&label.end<=date.start);
 };

 // These marks reliably begin other printed fields. NATURALIDADE is purposely
 // not a boundary: on some legacy RG layouts OCR emits it between the DOB
 // label and its date because it reads the columns out of order.
 const otherField=/\b(?:DATA\s*(?:DE\s*)?EXPEDICAO|EXPEDICAO|VALIDADE|EMISSAO|REGISTRO|CATEGORIA|NACIONALIDADE|ORGAO\s*EMISSOR|CPF|FILIACAO)\b/;
 const found:string[]=[];
 let ambiguous=false;
 for(const label of labels){
  const associated=dates.filter(date=>{
   if(belongsToIssueField(date))return false;
   const distance=date.end<=label.start?label.start-date.end:
      date.start>=label.end?date.start-label.end:0;
   if(distance>220)return false;
   const between=date.end<=label.start?text.slice(date.end,label.start):
      date.start>=label.end?text.slice(label.end,date.start):'';
   return !otherField.test(between);
  });
  if(associated.length>1){ambiguous=true;continue;}
  if(associated.length===1)found.push(associated[0].iso);
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
