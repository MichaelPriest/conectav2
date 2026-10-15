const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const read=relative=>fs.readFileSync(path.resolve(__dirname,'../src',relative),'utf8');

test('sidebar keeps only five everyday destinations visible',()=>{
 const shell=read('components/app-shell.tsx');
 const block=shell.slice(shell.indexOf('const navItems = ['),shell.indexOf('const moreNavItems = ['));
 for(const href of ['/feed','/explorar','/comunidades','/mensagens','/notificacoes']) assert.ok(block.includes(href),href);
 for(const href of ['/reels','/salvos','/acolhimento','/conexoes','/apps','/apoiar','/perfil']) assert.ok(!block.includes(href),href+' should not be a primary shortcut');
});

test('secondary destinations are grouped behind an accessible More toggle',()=>{
 const shell=read('components/app-shell.tsx');
 assert.match(shell,/nav-more-toggle/);
 assert.match(shell,/aria-expanded=\{moreNavOpen\}/);
 assert.match(shell,/aria-controls="conecta-more-nav"/);
 assert.match(shell,/id="conecta-more-nav"[^>]*hidden=\{!moreNavOpen\}/);
 assert.match(shell,/moreNavItems\.some\(item => pathname === item\.href\)/);
 assert.match(shell,/platformRole==='admin'&&<Link href="\/gestao-monetizacao"/);
 assert.match(shell,/label: 'Conecta ID · Validar identidade', href: '\/verificar-identidade'/);
 assert.match(shell,/{platformRole&&<Link href="\/moderacao"/);
});

test('profile stays reachable through the account footer and sidebar styling supports collapsed mode',()=>{
 const shell=read('components/app-shell.tsx');
 const css=read('app/experience.css');
 assert.match(shell,/<Link href="\/perfil" className="sidebar-profile"/);
 assert.match(css,/\.nav-more-links\[hidden\]\{display:none!important\}/);
 assert.match(css,/\.conecta-sidebar-collapsed \.nav-more-toggle/);
});
