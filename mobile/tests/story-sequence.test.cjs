'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {groupedStorySequence,firstUnseenStory,nextStoryInSequence}=
 require('../src/story-sequence.ts');
const base=Date.parse('2026-10-10T14:00:00Z');
function s(id,author,minutes){
 return {id,author_id:author,created_at:new Date(base+minutes*60000).toISOString(),
  expires_at:new Date(base+24*60*60000).toISOString()};
}
test('one bubble per user, all their Stories contiguous and played oldest to newest',()=>{
 const records=[s('b3','bob',6),s('a2','alice',5),s('b2','bob',4),
  s('c1','carlos',3),s('b1','bob',2),s('a1','alice',1)];
 const r=groupedStorySequence(records,'alice',base);
 assert.deepEqual(r.owners,['alice','bob','carlos']);
 assert.deepEqual(r.bubbles.map(v=>v.id),['a1','b1','c1']);
 assert.deepEqual(r.timeline.map(v=>v.id),['a1','a2','b1','b2','b3','c1']);
});
test('opening a person selects first unseen Story in that grouped sequence',()=>{
 const timeline=[s('a1','alice',0),s('a2','alice',1),s('b1','bob',2)];
 assert.equal(firstUnseenStory(timeline,'alice',new Set(['a1'])).id,'a2');
 assert.equal(firstUnseenStory(timeline,'alice',new Set(['a1','a2'])).id,'a1');
 assert.equal(firstUnseenStory(timeline,'bob',new Set()).id,'b1');
});
test('automatic advancement moves across group boundary then closes after last Story',()=>{
 const timeline=[s('a1','alice',0),s('a2','alice',1),s('b1','bob',2)];
 assert.equal(nextStoryInSequence(timeline,'a1',1).id,'a2');
 assert.equal(nextStoryInSequence(timeline,'a2',1).id,'b1');
 assert.equal(nextStoryInSequence(timeline,'b1',1),undefined);
 assert.equal(nextStoryInSequence(timeline,'b1',-1).id,'a2');
});
test('expired Stories never show or interrupt the grouped playback',()=>{
 const expired={...s('old','alice',0),expires_at:new Date(base-1000).toISOString()};
 const valid=s('new','alice',1);
 const r=groupedStorySequence([valid,expired], 'alice',base);
 assert.deepEqual(r.timeline.map(v=>v.id),['new']);
});
