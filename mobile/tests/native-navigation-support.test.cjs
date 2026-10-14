'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('Android immersive mode can be exited without losing app navigation',()=>{
 const app=read('App.tsx');
 assert.match(app,/BackHandler/);
 assert.match(app,/const \[fullscreen,setFullscreen\]=useState\(Platform\.OS==='android'\)/);
 assert.match(app,/NavigationBarApi\.setVisibilityAsync\(fullscreen\?'hidden':'visible'\)/);
 assert.match(app,/hidden=\{Platform\.OS==='android'&&fullscreen\}/);
 assert.match(app,/Icon=\{ArrowLeft\} label="Voltar à tela anterior"/);
 assert.match(app,/label=\{fullscreen\?'Sair da tela cheia':'Ativar tela cheia'\}/);
 assert.match(app,/\(!user\|\|restricted\|\|!profile\)&&<Pressable/);
 assert.doesNotMatch(app,/<NavigationBar hidden style="light"\/>/);
 assert.match(app,/if\(canGoBack\)\{goBack\(\);return true;\}/);
 assert.match(app,/if\(fullscreen\)\{setFullscreen\(false\);return true;\}/);
});

test('Native support area offers inclusion resources and persists calm-mode preference',()=>{
 const app=read('App.tsx'),support=read('src/support-ui.tsx');
 assert.match(app,/import \{SupportScreen\} from '\.\/src\/support-ui'/);
 assert.match(app,/onCommunity=\{\(\)=>\{setCommunitySlugRoute\('maes-atipicas-rede-apoio'\);setTab\('communities'\);\}\}/);
 assert.match(app,/onPress:\(\)=>navigate\('support'\)/);
 assert.match(support,/AsyncStorage\.getItem\(CALM_KEY\)/);
 assert.match(support,/AsyncStorage\.setItem\(CALM_KEY,next\?'1':'0'\)/);
 assert.match(support,/backgroundColor:calm\?'#F0EFF6':t\.primaryDark/);
 assert.match(support,/https:\/\/www\.gov\.br\/mdh/);
 assert.match(support,/https:\/\/www\.gov\.br\/inep/);
 assert.match(support,/Evite publicar laudos, documentos/);
 assert.match(support,/onCommunity,onConnections/);
});
