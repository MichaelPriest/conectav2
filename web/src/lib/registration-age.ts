export type DeclaredAgeBand='under_13'|'13_15'|'16_17'|'18_plus';
export const MINIMUM_REGISTRATION_AGE=13;
/** Only a self-declared age range; NEVER a legally attested age. */
export function declaredBandFromDob(iso:string,today:Date=new Date()):DeclaredAgeBand|null{
 if(typeof iso!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(iso))return null;
 const [y,m,d]=iso.split('-').map(Number);
 const dob=new Date(Date.UTC(y,m-1,d));
 if(y<1900||y>today.getFullYear()||dob.getUTCFullYear()!==y||dob.getUTCMonth()+1!==m||dob.getUTCDate()!==d)return null;
 const yNow=today.getFullYear(), mNow=today.getMonth()+1,dNow=today.getDate();
 let age=yNow-y;
 if(mNow<m||(mNow===m&&dNow<d))age--;
 if(age<0||age>120)return null;
 return age<13?'under_13':age<16?'13_15':age<18?'16_17':'18_plus';
}
export function ageBandLabel(band:DeclaredAgeBand):string{
 switch(band){
  case 'under_13':return 'Menor de 13 anos';
  case '13_15':return '13 a 15 anos';
  case '16_17':return '16 a 17 anos';
  case '18_plus':return '18 anos ou mais';
 }
}
export function todayForDateInput(date:Date=new Date()):string{
 return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
}
