const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const read=relative=>fs.readFileSync(path.resolve(__dirname,'../src',relative),'utf8');

test('saved posts page loads only the current user collection',()=>{
 const page=read('app/salvos/page.tsx');
 assert.match(page,/from\('saved_posts'\)/);
 assert.match(page,/select\('post_id'\)\.eq\('user_id',auth\.user\.id\)/);
 assert.match(page,/\.in\('id',ids\)/);
 assert.match(page,/RLS on posts remains the authority for visibility/);
});

test('saved collection preserves bookmark order and signs media using shared helper',()=>{
 const page=read('app/salvos/page.tsx');
 assert.match(page,/const ordered=ids\.map\(id=>byId\.get\(id\)\)/);
 assert.match(page,/hydratePostMedia\(db,ordered\)/);
});

test('navigation exposes the saved collection and bookmark removal updates it',()=>{
 const shell=read('components/app-shell.tsx');
 const card=read('components/post-card.tsx');
 const page=read('app/salvos/page.tsx');
 assert.match(shell,/label: 'Publicações salvas', href: '\/salvos', icon: Bookmark/);
 assert.match(card,/onSavedChange\?\.\(nextSaved\)/);
 assert.match(page,/onSavedChange=\{isSaved=>\{if\(!isSaved\)setPosts/);
 assert.match(page,/Use “Salvar” em uma publicação do feed/);
});
