'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const {normalizeDetails,validateDetails,INITIAL_DETAILS}=require('../src/profile-details-validation.ts');

test('Profile personalization uses the existing Web defaults',()=>{
 assert.equal(normalizeDetails(null).cover_theme,'violet');
 assert.equal(normalizeDetails(null).layout_style,'classic');
 assert.equal(normalizeDetails(null).favorite_emoji,'💜');
 const normalized=normalizeDetails({cover_theme:'unknown',layout_style:'invalid',
  headline:22,interests:['arte',3,'música']});
 assert.equal(normalized.cover_theme,'violet');
 assert.equal(normalized.layout_style,'classic');
 assert.equal(normalized.headline,'');
 assert.deepEqual(normalized.interests,['arte','música']);
});
test('Profile forms normalize nullable URLs, emoji, interests and protect malicious schemes',()=>{
 const valid=validateDetails({...INITIAL_DETAILS,website:' https://conecta.example.com/p ',
  music_url:'https://open.spotify.com/track/123',
  interests:[' música ','Música',' tecnologia ']});
 assert.equal(valid.website,'https://conecta.example.com/p');
 assert.equal(valid.music_url,'https://open.spotify.com/track/123');
 assert.deepEqual(valid.interests,['música','Música','tecnologia']);
 assert.equal(validateDetails(INITIAL_DETAILS).website,null);
 for(const address of ['javascript:alert(1)','file:///etc/passwd','data:text/html,evil',
  'https://user:pass@evil.com']){
  assert.throws(()=>validateDetails({...INITIAL_DETAILS,website:address}),/link/);
 }
 assert.throws(()=>validateDetails({...INITIAL_DETAILS,headline:'a'.repeat(141)}),/limite/);
 assert.throws(()=>validateDetails({...INITIAL_DETAILS,interests:['x'.repeat(33)]}),/interesses/);
 assert.throws(()=>validateDetails({...INITIAL_DETAILS,interests:Array.from({length:13},(_,i)=>''+i)}),/interesses/);
});
test('Native profile details cannot edit another profile or reset cover_path',()=>{
 const src=read('src/profile-details.ts');
 assert.match(src,/session\?\.user\.id!==userId/);
 assert.match(src,/from\('profile_details'\)/);
 assert.match(src,/onConflict:'user_id'/);
 assert.match(src,/upsert\(\{user_id:userId,\.\.\.payload\}/);
 assert.doesNotMatch(src,/update\(\{cover_path:null/);
 const ui=read('src/profile-details-ui.tsx');
 assert.match(ui,/Salvar personalização/);
 assert.match(ui,/PROFILE_THEMES/);
 assert.match(ui,/PROFILE_LAYOUTS/);
 assert.match(read('App.tsx'),/ProfileDetailsEditor userId=\{profile\.id\}/);
});
test('Explore is global, block-aware, approved-only and native',()=>{
 const app=read('App.tsx');
 const explore=read('src/explore.ts'),ui=read('src/explore-ui.tsx');
 assert.match(explore,/loadNativeExplore\(userId:string\)/);
 assert.match(explore,/\.eq\('moderation_status','approved'\)/);
 assert.match(explore,/\.eq\('visibility','public'\)/);
 assert.match(explore,/from\('user_blocks'\)/);
 assert.match(explore,/!hidden\.has\(p\.author_id\)/);
 assert.match(explore,/loadNativePublicProfile\(userId:string,personId:string\)/);
 assert.match(ui,/Pessoas para conhecer/);
 assert.match(ui,/Publicações públicas/);
 assert.match(ui,/Minhas conexões e convites/);
 assert.match(ui,/onOpenCommunity\(community\.slug\)/);
 assert.match(app,/initialSlug=\{communitySlugRoute\}/);
 assert.match(ui,/startChat\(personId\)/);
 assert.match(ui,/toggleBlock/);
 assert.match(app,/ExploreScreen userId=\{user\.id\}/);
});
test('Permissions do not request location, contacts or microphone at launch',()=>{
 const config=JSON.parse(read('app.json')).expo;
 const exp=require('../app.config.js').expo;
 const permissionUi=read('src/permissions-ui.tsx');
 const notice=read('src/native-notifications.tsx');
 const app=read('App.tsx');
 const pkg=JSON.parse(read('package.json'));
 assert.ok(pkg.dependencies['expo-notifications']);
 assert.equal(config.plugins.some(p=>Array.isArray(p)&&p[0]==='expo-notifications'),true);
 assert.equal(config.plugins.find(p=>Array.isArray(p)&&p[0]==='expo-image-picker')[1].microphonePermission,false);
 assert.equal(config.plugins.find(p=>Array.isArray(p)&&p[0]==='expo-audio')[1].enableBackgroundRecording,false);
 assert.ok(config.ios.infoPlist.NSCameraUsageDescription);
 assert.ok(config.ios.infoPlist.NSMicrophoneUsageDescription);
 assert.ok(config.ios.infoPlist.NSPhotoLibraryUsageDescription);
 const blocked=config.android.blockedPermissions;
 for(const perm of ['ACCESS_FINE_LOCATION','ACCESS_BACKGROUND_LOCATION','READ_CONTACTS',
  'READ_SMS','READ_CALL_LOG','SCHEDULE_EXACT_ALARM','SYSTEM_ALERT_WINDOW']){
  assert.ok(blocked.includes('android.permission.'+perm),'Explicitly block '+perm);
  assert.ok(!exp.android.permissions.includes('android.permission.'+perm),
   'Never grant '+perm);
 }
 assert.equal(config.android.allowBackup,false);
 assert.equal(config.android.usesCleartextTraffic,false);
 assert.match(permissionUi,/requestCameraPermissionsAsync\(\)/);
 assert.match(permissionUi,/requestRecordingPermissionsAsync\(\)/);
 assert.match(permissionUi,/setNativeNotificationPreference\(userId,!notifyEnabled\)/);
 assert.match(permissionUi,/Linking\.openSettings\(\)/);
 assert.match(notice,/getNativeNotificationPreference/);
 assert.match(notice,/Notifications\.requestPermissionsAsync/);
 assert.match(notice,/AppState\.currentState!=='active'/);
 assert.match(notice,/recipient_id=eq\.'\+userId/);
 assert.match(notice,/sound:false/);
 assert.doesNotMatch(notice,/getExpoPushTokenAsync/);
 assert.match(app,/NativeForegroundNotificationBridge userId=\{user\.id\}/);
 assert.match(app,/NativePermissionsCenter userId=\{profile\.id\}/);
});

test('Deep links accept only official Conecta hosts and UUID post identifiers',()=>{
 const {parseConectaLink}=require('../src/deep-link.ts');
 const id='f2bc906a-4cb1-4797-872e-5bdca1234567';
 assert.deepEqual(parseConectaLink('conecta://post/'+id),{type:'post',id});
 assert.deepEqual(parseConectaLink('conecta:///post/'+id),{type:'post',id});
 assert.deepEqual(parseConectaLink('https://conectav2-validacao.onrender.com/post/'+id),
  {type:'post',id});
 assert.deepEqual(parseConectaLink('conecta://notifications'),{type:'notifications'});
 assert.deepEqual(parseConectaLink('https://conectav2-validacao.onrender.com/notificacoes'),{
  type:'notifications'
 });
 for(const bad of [
  'https://conectav2-validacao.onrender.com.attacker.net/post/'+id,
  'https://other.example.com/post/'+id,
  'http://conectav2-validacao.onrender.com/post/'+id,
  'conecta://post/%2e%2e/notifications',
  'conecta://post/any-user-supplied',
  'conecta://post/'+id+'?redirect=https://example.com',
  'javascript:alert(1)'
 ])assert.equal(parseConectaLink(bad),null,bad);
});
test('Native image gallery and post details do not open external browsers',()=>{
 const src=read('App.tsx');
 const gallery=read('src/media-gallery.tsx');
 const data=read('src/data.ts');
 assert.match(src,/MediaGallery paths=\{images\}/);
 assert.match(src,/PostDetailScreen postId=\{viewPostId\}/);
 assert.match(src,/parseConectaLink\(url\)/);
 assert.match(src,/onPost=\{setViewPostId\}/);
 assert.match(src,/onConnections=\{\(\)=>/);
 assert.match(gallery,/Modal visible=\{active!==null\}/);
 assert.match(gallery,/signedMedia\(paths\[active\]\)/);
 assert.match(gallery,/accessibilityLabel="Próxima imagem"/);
 assert.match(gallery,/setZoomed\(old=>!old\)/);
 assert.match(data,/loadPermittedPost\(postId:string,userId:string\)/);
 assert.match(data,/post\.author_id!==userId&&post\.moderation_status!=='approved'/);
});
