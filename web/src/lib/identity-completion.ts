/**
 * Trusted *registration flow* state, not identity/age verification.
 * Declared bands are untrusted age self-statements already stored under RLS.
 * This function NEVER grants restricted features, badges, ads or age attestations.
 */
export type RegistrationCompletion =
 | 'profile_required'
 | 'age_declaration_required'
 | 'adult_basic_ready'
 | 'teen_protection_pending';
export function completionFromRecords(
  hasProfile:boolean, ageBand:string|null|undefined
):RegistrationCompletion{
 if(!hasProfile)return 'profile_required';
 if(!ageBand)return 'age_declaration_required';
 if(ageBand==='18_plus')return 'adult_basic_ready';
 return 'teen_protection_pending';
}
export function completionResult(state:RegistrationCompletion){
 const messages:Record<RegistrationCompletion,string>={
  profile_required:'Complete seu perfil para continuar.',
  age_declaration_required:'Informe sua faixa etaria no cadastro antes de continuar.',
  adult_basic_ready:'Cadastro basico pronto. Identidade civil e maioridade NAO verificadas.',
  teen_protection_pending:'Cadastro protegido. A liberacao de recursos depende de afericao de idade e, quando aplicavel, vinculo do responsavel.'
 };
 return {
  state, message:messages[state],
  canFinishBasic:state==='adult_basic_ready',
  next:state==='adult_basic_ready'?'/feed':state==='profile_required'||state==='age_declaration_required'?'/onboarding':null,
  identityVerified:false, ageVerified:false,
  grantsAdultPrivileges:false, adsAllowed:false
 } as const;
}
