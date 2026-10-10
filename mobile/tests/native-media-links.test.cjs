'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {classifyMediaLink,linksInContent}=require('../src/link-media.ts');
const fs=require('node:fs');
const path=require('node:path');
const source=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('Native feed safely identifies links to approved audio and video providers',()=>{
 const items=[
  ['https://youtu.be/dQw4w9WgXcQ','YouTube'],
  ['https://www.youtube.com/watch?v=dQw4w9WgXcQ','YouTube'],
  ['https://open.spotify.com/track/3n3Ppam7vgaVa1iaRUc9Lp','Spotify'],
  ['https://soundcloud.com/artist/song','SoundCloud'],
  ['https://music.apple.com/br/album/demo/123456','Apple Music'],
  ['https://cdn.example.org/song.mp3','Áudio'],
  ['https://cdn.example.org/video.mp4','Vídeo']
 ];
 for(const [url,provider] of items)assert.equal(classifyMediaLink(url)?.provider,provider,url);
 const media=linksInContent('Veja https://youtu.be/dQw4w9WgXcQ, e https://cdn.example.org/song.mp3!');
 assert.equal(media.length,2);
 assert.equal(media[0].provider,'YouTube');
 assert.equal(media[1].kind,'audio');
});
test('Do not render untrusted schemes, URLs with credentials or lookalike providers',()=>{
 for(const value of [
  'javascript:alert(1)','http://cdn.example.org/song.mp3','https://127.0.0.1/',
  'https://evil.example/open.spotify.com/track/abcdefghijk123',
  'https://open.spotify.com.evil.test/track/3n3Ppam7vgaVa1iaRUc9Lp',
  'https://user:pass@www.youtube.com/watch?v=dQw4w9WgXcQ',
  'https://www.youtube.com/watch?v=short',
  'https://soundcloud.com/pages/login',
  'https://evil.example/?redirect=https://youtu.be/dQw4w9WgXcQ'
 ])assert.equal(classifyMediaLink(value),null,value);
 assert.equal(linksInContent('texto sem links').length,0);
});
test('Linked media loads only after a tap and chat photos have visible retry',()=>{
 const preview=source('src/link-media-ui.tsx');
 const chat=source('src/chat-image.tsx');
 const feed=source('App.tsx');
 const discover=source('src/explore-ui.tsx');
 const bubble=source('src/chat-bubble.tsx');
 assert.match(preview,/onPress=\{play\}/);
 assert.match(preview,/Linking\.openURL\(media\.url\)/);
 assert.match(preview,/active&&media\.kind==='audio'/);
 assert.match(preview,/active&&media\.kind==='video'/);
 assert.match(feed,/<LinkedMediaPreview content=\{post\.content\}/);
 assert.match(discover,/<LinkedMediaPreview content=\{post\.content\}/);
 assert.match(chat,/signedMedia\(path\)/);
 assert.match(chat,/invalidateSignedMedia\(path\)/);
 assert.match(chat,/Tentar novamente/);
 assert.match(chat,/Modal visible=/);
 assert.match(bubble,/<ChatImage path=\{message\.media_path\}/);
});
