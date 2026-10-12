'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.resolve(__dirname,'../src/components/post-card.tsx'),'utf8');
const production='https://conectav2.vercel.app';
test('Shared post URLs always use the primary production host',()=>{
 assert.ok(source.includes(production+'/post/${encodeURIComponent(post.id)}'));
 assert.ok(!source.includes('window.location.origin}/post/'));
 assert.ok(!source.includes('conectav2-validacao.onrender.com'));
});

const shell=fs.readFileSync(path.resolve(__dirname,'../src/components/app-shell.tsx'),'utf8');
test('public web navigation never exposes homologation or obsolete Vercel aliases',()=>{
 assert.ok(!shell.includes('conectav2-validacao.onrender.com'));
 assert.ok(!shell.includes('conectav2-michael-raimundos-projects.vercel.app'));
});