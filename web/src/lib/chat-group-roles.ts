export type GroupAccess={
  isOwner:boolean;isCoadmin:boolean;canInvite:boolean;canRemove:boolean;
  canRename:boolean;canManageAdmins:boolean;canTransfer:boolean;
};
export function groupAccess(userId:string|undefined,ownerId:string|undefined,
  coadmins:readonly string[],isGroup:boolean,inviteAllowed:boolean,removeAllowed:boolean):GroupAccess{
  const isOwner=Boolean(isGroup&&userId&&ownerId===userId);
  const isCoadmin=Boolean(isGroup&&userId&&!isOwner&&coadmins.includes(userId));
  return {isOwner,isCoadmin,
    canInvite:isOwner||(isCoadmin&&inviteAllowed),
    canRemove:isOwner||(isCoadmin&&removeAllowed),
    canRename:isOwner,canManageAdmins:isOwner,canTransfer:isOwner};
}
export function canRemoveGroupTarget(access:GroupAccess,
 targetId:string,ownerId:string|undefined,coadmins:readonly string[]):boolean{
  return Boolean(access.canRemove&&targetId&&targetId!==ownerId&&
    (access.isOwner||!coadmins.includes(targetId)));
}
