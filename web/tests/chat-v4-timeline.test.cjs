'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const {runInNewContext}=require('node:vm');

// Exercise the actual production TypeScript module, not a stub of the API.
const source=fs.readFileSync(path.join(__dirname,'../src/lib/chat-timeline.ts'),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};
runInNewContext(js,{module:mod,exports:mod.exports});
const {mergeChatPage,olderChatCursor}=mod.exports;
const row=(id,time,conversation_id='group')=>({id,created_at:time,conversation_id,content:id});

test('realtime refresh preserves earlier pages and newest message ordering',()=>{
 const history=[row('01','2026-10-09T09:00:00Z'),row('02','2026-10-09T09:01:00Z')];
 const result=mergeChatPage(history,[row('03','2026-10-09T09:02:00Z')],'group');
 assert.deepEqual(Array.from(result,m=>m.id),['01','02','03']);
});
test('message edits and tombstones replace existing versions without duplicates',()=>{
 const first=row('01','2026-10-09T09:00:00Z');
 const result=mergeChatPage([first],[{...first,deleted_at:'2026-10-09T09:05:00Z'}],'group');
 assert.equal(result.length,1);assert.ok(result[0].deleted_at);
});
test('in-flight response from another conversation cannot pollute current timeline',()=>{
 const result=mergeChatPage([row('x','2026-10-09T09:00:00Z','other')],[row('y','2026-10-09T09:01:00Z')],'group');
 assert.deepEqual(Array.from(result,m=>m.id),['y']);
});
test('cursor handles equal timestamps by UUID/id ordering',()=>{
 const date='2026-10-09T09:00:00Z';
 const cursor=olderChatCursor([row('bbbb',date),row('aaaa',date),row('cccc','2026-10-09T09:01:00Z')],'group');
 assert.equal(cursor,'created_at.lt.'+date+',and(created_at.eq.'+date+',id.lt.aaaa)');
 assert.equal(olderChatCursor([],'group'),null);
});
