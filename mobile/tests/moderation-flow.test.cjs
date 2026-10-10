'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');

test('Conecta mobile returns actual moderation status after creating posts and comments',()=>{
 const data=read('src/data.ts');
 const feed=read('App.tsx');
 assert.match(data,/export async function ownPostModerationStatus/);
 assert.match(data,/\.select\('moderation_status,moderation_reason'\)/);
 assert.match(data,/export async function requestContentModeration/);
 assert.match(data,/return \{status:'pending',reason:'Serviço de análise indisponível/);
 assert.match(data,/return latest\?\.moderation_status==='approved'/);
 assert.match(feed,/const verdict=await ownPostModerationStatus\(id\)/);
 assert.match(feed,/Publicação em análise/);
 assert.match(feed,/Verificar análise novamente/);
 assert.match(feed,/requestPostModeration\(post\.id\)/);
 assert.match(feed,/const moderation=await sendPostComment/);
 assert.match(feed,/Comentário em análise/);
});
test('Review requests never approve a post based on a client-side response or bypass RLS',()=>{
 const data=read('src/data.ts');
 assert.match(data,/\.from\('posts'\)/);
 assert.match(data,/\.from\('post_comments'\)/);
 assert.match(data,/return safeModerationFeedback\(await response\.json\(\)\)/);
 assert.doesNotMatch(data,/service_role|SUPABASE_SERVICE_ROLE_KEY/);
});
