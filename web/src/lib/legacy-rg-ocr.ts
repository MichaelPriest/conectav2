/** Local OCR preflight for legacy Brazilian RG.
 * Never promote document text to verified identity/age.
 * No raw OCR text or date of birth may be sent to a server.
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
/** Only accepts dates immediately after a birth label; never infer from an issue date. */
export function inspectLegacyRgOcr(raw:string,today:Date=new Date()):LegacyRgPreflight{
 if(typeof raw!=='string'||!raw.trim())return {status:'unreadable',message:'Nenhum texto legível foi encontrado nas imagens.'};
 const text=raw.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase()
   .replace(/\r/g,'\n').replace(/\t/g,' ').replace(/[ ]{2,}/g,' ');
 const birthLabels=/(?:\bDATA\s*(?:DE\s*)?NASCIMENTO\b|\bNASCIMENTO\b|\bDT\.?\s*NASC(?:IMENTO)?\b)/g;
 const datePattern=/(?:^|[^\d])(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{4})(?!\d)/g;
 const found:string[]=[];
 for(const match of text.matchAll(birthLabels)){
  // Only a small region following the label can contain the referenced DOB.
  // Stop at another label or line with known issue/validity terms.
  const nearby=text.slice((match.index||0)+match[0].length,(match.index||0)+match[0].length+74);
  const clipped=nearby.split(/(?:DATA\s*(?:DE\s*)?EXPEDICAO|EXPEDICAO|VALIDADE|EMISSAO|ORGAO\s*EMISSOR)/)[0];
  const local=[...clipped.matchAll(datePattern)];
  if(local.length>1)continue; // Ambiguous date on the same section.
  if(local.length===1){
   const iso=isoDateFromBrazilian(local[0][1]);
   if(iso)found.push(iso);
  }
 }
 const unique=[...new Set(found)];
 if(unique.length!==1)return {status:'date-uncertain',message:'Não foi possível identificar uma única data de nascimento com segurança. Confira a nitidez do RG; não use este resultado para comprovar idade.'};
 const band=ageBand(unique[0],today);
 if(!band)return {status:'date-uncertain',message:'A data de nascimento lida não é plausível. A verificação permanece pendente.'};
 return {status:'age-indicative',band,message:'O OCR identificou uma possível faixa etária no RG antigo. O resultado não comprova autenticidade, titularidade nem maioridade.'};
}
