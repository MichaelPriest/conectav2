const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=relative=>fs.readFileSync(path.resolve(__dirname,'../src',relative),'utf8');
test('profile editor exposes nostalgia and modern themes without bypassing access controls',()=>{
 const editor=read('app/perfil/page.tsx');
 const styles=read('app/profile-themes.css');
 const details=read('lib/profile-details.ts');
 for(const theme of ['orkut','myspace','facebook','instagram','creator','minimal','aurora','glass','neo']) assert.ok(editor.includes('value="'+theme+'"'),theme);
 for(const theme of ['profile-layout-orkut','profile-layout-myspace','profile-layout-facebook','profile-layout-instagram','profile-layout-creator','profile-layout-minimal','profile-layout-aurora','profile-layout-glass','profile-layout-neo']) assert.ok(styles.includes(theme),theme);
 assert.match(details,/const layoutStyles = .*'aurora', 'glass', 'neo'.*\]/);
 assert.match(editor,/O tema altera a apresentação do perfil, sem mudar suas permissões/);
});

test('selected preset skins the whole signed-in interface and loads from saved profile details',()=>{
 const shell=fs.readFileSync(path.resolve(__dirname,'../src/components/app-shell.tsx'),'utf8');
 const styles=fs.readFileSync(path.resolve(__dirname,'../src/app/profile-themes.css'),'utf8');
 assert.match(shell,/from\('profile_details'\)\.select\('layout_style'\)/);
 assert.match(shell,/dataset\.profileTheme = selected/);
 assert.match(shell,/conecta-profile-theme-change/);
 for(const theme of ['orkut','myspace','facebook','instagram','creator','minimal','aurora','glass','neo']){
  assert.ok(styles.includes('html[data-profile-theme="'+theme+'"]'),theme+' global theme');
 }
 for(const surface of ['.sidebar','.desktop-topbar','.mobile-header','.mobile-bottom-nav','.post-card','.composer','.btn-primary']){
  assert.ok(styles.includes(surface),surface+' is themed');
 }
});
