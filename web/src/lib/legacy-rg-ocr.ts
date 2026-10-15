/** Local OCR preflight for legacy Brazilian RG.
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
/** Extract a DOB only when it is associated with a birth label in OCR text.
 * Tolerates line breaks, common punctuation variants, and OCR-spaced dates,
 * while refusing multiple dates in the same birth-field region.
 */
export function extractBirthDateFromOcr(raw:string):string|null{
 if(typeof raw!=='string'||!raw.trim())return null;
 const dob=extractBirthDateFromOcr(raw);
 if(!dob)return {status:'date-uncertain',message:'Não foi possível identificar uma única data de nascimento com segurança. Confira a nitidez do RG; não use este resultado para comprovar idade.'};
 const band=ageBand(dob,today);
 if(!band)return {status:'date-uncertain',message:'A data de nascimento lida não é plausível. A verificação permanece pendente.'};
 return {status:'age-indicative',band,message:'O OCR identificou uma possível faixa etária no RG antigo. O resultado não comprova autenticidade, titularidade nem maioridade.'};
}
