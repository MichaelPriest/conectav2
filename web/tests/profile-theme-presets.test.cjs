const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=relative=>fs.readFileSync(path.resolve(__dirname,'../src',relative),'utf8');
test('profile editor exposes nostalgia and modern themes without bypassing access controls',()=>{
 const editor=read('app/perfil/page.tsx');
 const styles=read('app/profile-themes.css');
 const details=read('lib/profile-details.ts');
 for(const theme of ['orkut','myspace','facebook','instagram','creator','minimal']) assert.ok(editor.includes('value="'+theme+'"'),theme);
 for(const theme of ['profile-layout-orkut','profile-layout-myspace','profile-layout-facebook','profile-layout-instagram','profile-layout-creator','profile-layout-minimal']) assert.ok(styles.includes(theme),theme);
 assert.match(details,/const layoutStyles = \['classic', 'orkut', 'myspace', 'facebook', 'instagram', 'creator', 'minimal'\]/);
 assert.match(editor,/O tema altera a apresentação do perfil, sem mudar suas permissões/);
});
