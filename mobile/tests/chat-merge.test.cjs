'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {mergeChatPages,mergeChatReactionPages,refreshChatReactionPage}=require('../src/chat-merge.ts');

function message(id,conversation_id='thread-1',timestamp='2026-10-09T20:00:00Z',content=id){
 return {id,conversation_id,created_at:timestamp,content};
}
test('Realtime updates replace edited messages without losing older history',()=>{
 const initial=[message('a'),message('b','thread-1','2026-10-09T20:01:00Z')];
 const updated=[message('b','thread-1','2026-10-09T20:01:00Z','edited'),
  message('c','thread-1','2026-10-09T20:02:00Z')];
 assert.deepEqual(mergeChatPages(initial,updated,'thread-1').map(m=>m.content),
  ['a','edited','c']);
});
test('Switching thread never leaks prior messages and matches chronological ordering',()=>{
 const result=mergeChatPages(
  [message('old','other-thread')],
  [message('late','thread-1','2026-10-09T23:00:00Z'),
   message('early','thread-1','2026-10-09T19:00:00Z')],
  'thread-1'
 );
 assert.deepEqual(result.map(m=>m.id),['early','late']);
});
test('Pagination is idempotent when items overlap and keeps tombstones',()=>{
 const deleted=message('b');deleted.deleted_at='2026-10-09T20:05:00Z';
 const result=mergeChatPages([message('a'),message('b')],[deleted,message('a')],'thread-1');
 assert.equal(result.length,2);
 assert.equal(result.find(m=>m.id==='b').deleted_at,deleted.deleted_at);
});
test('Reactions merge by message, sender and emoji independently',()=>{
 const old=[{message_id:'a',user_id:'me',emoji:'❤️',created_at:'1'}];
 const next=[{message_id:'a',user_id:'me',emoji:'❤️',created_at:'2'},
  {message_id:'a',user_id:'other',emoji:'❤️',created_at:'3'},
  {message_id:'a',user_id:'me',emoji:'👍',created_at:'4'}];
 const merged=mergeChatReactionPages(old,next);
 assert.equal(merged.length,3);
 assert.equal(merged.find(r=>r.user_id==='me'&&r.emoji==='❤️').created_at,'2');
});

test('Refreshed page removes deleted emoji reactions without clearing older pages',()=>{
 const current=[
  {message_id:'a',user_id:'me',emoji:'❤️',created_at:'1'},
  {message_id:'old',user_id:'other',emoji:'👍',created_at:'1'}
 ];
 const updated=refreshChatReactionPage(current,[],['a']);
 assert.deepEqual(updated.map(x=>x.message_id),['old']);
});
