'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const {validateGroupCreation,groupRights}=require('../src/chat-group-validation.ts');

const friends=Array.from({length:53},(_,i)=>({
 id:'person-'+i,handle:'p'+i,display_name:'Person '+i,bio:null,avatar_path:null
}));
test('Group creation requires two accepted distinct contacts and a valid title',()=>{
 assert.deepEqual(validateGroupCreation('  Meu grupo  ',
  ['person-0','person-1','person-1','unknown'],friends),{
  title:'Meu grupo',ids:['person-0','person-1']
 });
 assert.throws(()=>validateGroupCreation('A',['person-0','person-1'],friends),/2 a 80/);
 assert.throws(()=>validateGroupCreation('x'.repeat(81),['person-0','person-1'],friends),/2 a 80/);
 assert.throws(()=>validateGroupCreation('Grupo',['person-0','unknown'],friends),/duas amizades/);
 assert.throws(()=>validateGroupCreation('Grupo',friends.slice(0,50).map(x=>x.id),friends),/50 pessoas/);
});
test('Group privileges respect owner, moderator and server-configured flags',()=>{
 const base={created_by:'person-0',permissions:{
  coadmins:['person-1'],coadmins_can_invite:false,coadmins_can_remove:false
 }};
 assert.deepEqual(groupRights(base,'person-0'),{
  owner:true,moderator:false,invite:true,remove:true,rename:true,admins:true
 });
 const mod=groupRights(base,'person-1');
 assert.equal(mod.moderator,true);assert.equal(mod.invite,false);assert.equal(mod.remove,false);
 assert.equal(mod.rename,false);assert.equal(mod.admins,false);
 assert.deepEqual(groupRights(base,'person-2'),{
  owner:false,moderator:false,invite:false,remove:false,rename:false,admins:false
 });
 base.permissions.coadmins_can_invite=true;
 base.permissions.coadmins_can_remove=true;
 assert.equal(groupRights(base,'person-1').invite,true);
 assert.equal(groupRights(base,'person-1').remove,true);
});
test('Native groups use the existing membership-enforcing server RPCs',()=>{
 const groups=read('src/chat-groups.ts'),ui=read('src/chat-group-ui.tsx');
 const app=read('App.tsx'),data=read('src/data.ts');
 for(const rpc of [
  'create_conversation_with_members','toggle_conversation_pin',
  'get_conversation_group_permissions','add_conversation_group_member',
  'rename_conversation_group','leave_conversation_group',
  'remove_conversation_group_member','set_conversation_group_moderator',
  'set_conversation_group_permissions'
 ])assert.ok(groups.includes("'"+rpc+"'"),rpc);
 assert.match(groups,/\.eq\('conversation_id',conversationId\)\.eq\('user_id',userId\)/);
 assert.match(groups,/select\('requester_id,addressee_id'\)\.eq\('status','accepted'\)/);
 assert.match(groups,/from\('conversation_pins'\)/);
 assert.match(groups,/\.update\(\{muted_until:currentlyMuted\?null:/);
 assert.match(data,/muted_until/);
 assert.match(ui,/getGroupDetails\(conversationId,userId\)/);
 assert.match(ui,/rights\.invite/);
 assert.match(ui,/rights\.admins/);
 assert.match(ui,/rights\.remove/);
 assert.match(ui,/canRemove/);
 assert.match(ui,/Alert\.alert\(\s*'Remover do grupo\?'/);
 assert.match(app,/NativeGroupCreator userId=\{userId\}/);
 assert.match(app,/NativeGroupSettings key=\{active\}/);
 assert.match(app,/toggleChatPin\(active,message\)/);
 assert.match(app,/setConversationMuted\(active,userId,muted\)/);
 assert.match(read('src/chat-bubble.tsx'),/accessibilityLabel=\{pinned\?'Desafixar mensagem':'Fixar mensagem'\}/);
});
test('Ephemeral chat typing avoids sharing drafts, and exposes TTL state only',()=>{
 const c=read('src/chat-typing.ts'),app=read('App.tsx');
 assert.match(c,/from\('conversation_typing'\)/);
 assert.match(c,/rpc\('set_chat_typing'/);
 assert.match(c,/Date\.parse\(row\.expires_at\)>now/);
 assert.match(c,/row\.user_id!==userId/);
 assert.match(c,/AppState\.currentState==='active'/);
 assert.doesNotMatch(c,/_content:|_message:compose/);
 assert.match(app,/useNativeChatTyping\(active,userId,compose\)/);
 assert.match(app,/pessoas digitando/);
});
test('Recovery is native, but reset link uses authenticated web recovery callback',()=>{
 const app=read('App.tsx');
 assert.match(app,/supabase\.auth\.resetPasswordForEmail\(address,/);
 assert.match(app,/redirectTo:SITE_URL\+'\/auth\/callback\?next=\/auth\/redefinir-senha'/);
 assert.match(app,/label="Esqueci minha senha"/);
 assert.match(app,/E-mail de recuperação/);
 assert.match(app,/label="Cancelar convite"/);
 assert.match(app,/setUserBlocked\(userId,person\.id,wasBlocked\)/);
 assert.match(read('src/data.ts'),/from\('user_blocks'\)/);
 assert.match(read('src/data.ts'),/blocker_id:userId,blocked_id:targetId/);
});
