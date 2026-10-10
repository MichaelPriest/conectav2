import type {Profile} from './models';

/** Mirror Web group constraints before calling the membership-enforced server RPC. */
export function validateGroupCreation(title:string,selectedIds:string[],friends:Profile[]){
 const clean=title.trim();
 if(clean.length<2||clean.length>80)throw new Error('Nome do grupo: de 2 a 80 caracteres.');
 const allowed=new Set(friends.map(x=>x.id));
 const ids=[...new Set(selectedIds)].filter(id=>allowed.has(id));
 if(ids.length<2)throw new Error('Selecione pelo menos duas amizades aceitas.');
 if(ids.length>49)throw new Error('O grupo pode ter até 50 pessoas, incluindo você.');
 return {title:clean,ids};
}
export type GroupAccessRules={
 created_by:string;
 permissions:{coadmins:string[];coadmins_can_invite:boolean;coadmins_can_remove:boolean}
};
export function groupRights(details:GroupAccessRules,userId:string){
 const owner=details.created_by===userId;
 const moderator=!owner&&details.permissions.coadmins.includes(userId);
 return {owner,moderator,
  invite:owner||(moderator&&details.permissions.coadmins_can_invite),
  remove:owner||(moderator&&details.permissions.coadmins_can_remove),
  rename:owner,admins:owner};
}
