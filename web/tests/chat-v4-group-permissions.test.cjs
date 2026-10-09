'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../src/lib/chat-group-roles.ts'),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};vm.runInNewContext(js,{module:mod,exports:mod.exports});
const {groupAccess,canRemoveGroupTarget}=mod.exports;
test('owner retains exclusive admin delegation, rename and transfer',()=>{
 const p=groupAccess('owner','owner',['mod'],true,false,false);
 assert.equal(p.canTransfer,true);assert.equal(p.canManageAdmins,true);assert.equal(p.canInvite,true);
 assert.equal(canRemoveGroupTarget(p,'mod','owner',['mod']),true);
});
test('coadmin gets only granted member actions and never ownership',()=>{
 const limited=groupAccess('mod','owner',['mod'],true,true,false);
 assert.equal(limited.canInvite,true);assert.equal(limited.canRemove,false);
 assert.equal(limited.canRename,false);assert.equal(limited.canManageAdmins,false);
 const granted=groupAccess('mod','owner',['mod'],true,true,true);
 assert.equal(canRemoveGroupTarget(granted,'member','owner',['mod']),true);
 assert.equal(canRemoveGroupTarget(granted,'owner','owner',['mod']),false);
 assert.equal(canRemoveGroupTarget(granted,'other-mod','owner',['mod','other-mod']),false);
});
test('a regular member, outsider and direct message never receive moderation privileges',()=>{
 for(const p of [
  groupAccess('member','owner',['mod'],true,true,true),
  groupAccess('outsider','owner',['mod'],true,true,true),
  groupAccess('mod','owner',['mod'],false,true,true)
 ])assert.equal(p.canInvite||p.canRemove||p.canTransfer||p.canManageAdmins,false);
});
test('roles disappear immediately when removed from the coadmin list',()=>{
 assert.equal(groupAccess('mod','owner',['mod'],true,true,true).canRemove,true);
 assert.equal(groupAccess('mod','owner',[],true,true,true).canRemove,false);
});
