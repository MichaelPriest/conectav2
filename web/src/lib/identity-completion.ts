/**
 * Trusted *registration flow* state, not identity/age verification.
 * Declared bands are untrusted age self-statements already stored under RLS.
 * This function NEVER grants restricted features, badges, ads or age attestations.
 */
export type RegistrationCompletion =
 | 'profile_required'
 | 'age_declaration_required'
 | 'identity_verification_pending'
 | 'teen_guardian_pending'
 | 'teen_protection_pending';
export function completionFromRecords(
  hasProfile:boolean, ageBand:string|null|undefined, hasVerifiedGuardianAssociation=false
):RegistrationCompletion{
 if(!hasProfile)return 'profile_required';
 if(!ageBand)return 'age_declaration_required';
 if(ageBand==='18_plus')return 'identity_verification_pending';
 if(!hasVerifiedGuardianAssociation)return 'teen_guardian_pending';
 return 'teen_protection_pending';
}
export function completionResult(state:RegistrationCompletion){
 const messages:Record<RegistrationCompletion,string>={
  profile_required:'Complete seu perfil para continuar.',
  age_declaration_required:'Informe sua faixa etaria no cadastro antes de continuar.',
  identity_verification_pending:'Perfil e faixa etária cadastrados. Para entrar na rede, conclua a verificação confiável do Conecta ID; a autodeclaração não libera o acesso.',
  teen_guardian_pending:'Cadastro de menor pendente: associe esta conta a um pai, mãe ou responsável com conta Conecta e maioridade confirmada. A associação precisa ser aceita pela outra conta.',
  teen_protection_pending:'Responsável associado. A conta continua protegida até concluir a aferição confiável de idade e as demais verificações necessárias.'
 };
 return {
  state, message:messages[state],
  canFinishBasic:false,
  next:state==='profile_required'||state==='age_declaration_required'?'/onboarding':null,
  identityVerified:false, ageVerified:false,
  ageAssurance:'unknown' as const,
  ageDeclarationTrusted:false,
  adultRestrictedAccess:false,
  minorProtectionsRequired:true,
  grantsAdultPrivileges:false, adsAllowed:false
 } as const;
}
