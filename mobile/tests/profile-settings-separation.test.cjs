const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('Profile contains identity, publications and profile personalization rather than account settings',()=>{
 const app=read('App.tsx');
 const profile=app.slice(app.indexOf('function ProfileScreen('),app.indexOf('export default function App()'));
 assert.match(profile,/Meu perfil/);
 assert.match(profile,/Minhas publicações/);
 assert.match(profile,/Personalizar perfil, temas e música/);
 assert.doesNotMatch(profile,/Permissões e privacidade|Verificar atualizações|Sair deste dispositivo|Minha conta/);
});

test('Settings is a real app destination and owns account controls',()=>{
 const app=read('App.tsx');
 const settings=read('src/settings-ui.tsx');
 assert.match(app,/type Tab=.*'settings'/);
 assert.match(app,/if\(tab==='settings'\)return <SettingsScreen/);
 assert.match(app,/text:'Configurações',onPress:\(\)=>navigate\('settings'\)/);
 assert.match(settings,/Gerenciar permissões e privacidade/);
 assert.match(settings,/Verificar atualizações/);
 assert.match(settings,/Sair deste dispositivo/);
 assert.match(settings,/NativePermissionsCenter userId=\{userId\}/);
});

test('Bottom navigation uses a person icon for Profile rather than a settings gear',()=>{
 const design=read('src/design.tsx');
 assert.match(design,/\{key:'profile',label:'Perfil',Icon:UserRound\}/);
});
