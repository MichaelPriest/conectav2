/** Same community validation contract used by the Conecta website. */
export function communitySlug(value:string):string{
 return value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60);
}
export function validateCommunityDraft(name:string,slug:string,description:string,rules:string){
 const trimmed=name.trim(),normalized=slug.trim().toLowerCase();
 if(trimmed.length<3||trimmed.length>100)throw new Error('O nome deve ter de 3 a 100 caracteres.');
 if(!/^[a-z0-9-]{3,60}$/.test(normalized))
  throw new Error('O endereço deve ter de 3 a 60 letras minúsculas, números ou hífens.');
 if(description.trim().length>3000||rules.trim().length>5000)
  throw new Error('Reduza a descrição ou as regras da comunidade.');
 return {name:trimmed,slug:normalized,description:description.trim(),rules:rules.trim()};
}
