'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const src=fs.readFileSync(path.join(__dirname,'../src/lib/chat-call-tones.ts'),'utf8');
const js=ts.transpileModule(src,{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
let started=0,stopped=0,cleared=0,closed=0,intervals=0;
class FakeOscillator{
 frequency={setValueAtTime(){}};
 connect(){}
 disconnect(){}
 start(){started++;}
 stop(){stopped++;}
 onended=null;
}
class FakeAudioContext{
 state='running';currentTime=0;destination={};
 createOscillator(){return new FakeOscillator();}
 createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){}},connect(){},disconnect(){}};}
 resume(){this.state='running';return Promise.resolve();}
 close(){closed++;this.state='closed';return Promise.resolve();}
}
const mod={exports:{}};
const context={module:mod,exports:mod.exports,
 window:{AudioContext:FakeAudioContext,setInterval(){return ++intervals;},
  clearInterval(){cleared++;}}};
vm.runInNewContext(js,context);
const {ChatCallTones,sanitizeCallTonePreferences}=mod.exports;

test('outgoing and incoming tones synthesize audio only while ringing',()=>{
 const e=new ChatCallTones(()=>{});
 e.start('outgoing');assert.equal(started,2);
 e.start('incoming');assert.equal(started,5);
 assert.ok(stopped>=2);assert.ok(cleared>=1);
 e.stop();assert.ok(cleared>=2);
 e.dispose();assert.equal(closed,1);
});
test('disabled tones never create oscillators or repeated timers',()=>{
 const before=started;
 const e=new ChatCallTones(()=>{});
 e.configure({enabled:false,volume:0.7});
 e.start('incoming');
 assert.equal(started,before);
 e.dispose();
});
test('connected, ended and missed chimes are distinct, and muted settings suppress them',()=>{
 const e=new ChatCallTones(()=>{});
 e.unlock();
 let before=started;
 e.playEvent('connected');assert.equal(started-before,2);
 before=started;e.playEvent('ended');assert.equal(started-before,2);
 before=started;e.playEvent('missed');assert.equal(started-before,3);
 e.configure({enabled:true,volume:0});
 before=started;e.playEvent('connected');assert.equal(started,before);
 e.dispose();
});
test('volume settings are safely clamped',()=>{
 assert.equal(sanitizeCallTonePreferences({enabled:true,volume:12}).volume,1);
 assert.equal(sanitizeCallTonePreferences({enabled:false,volume:-8}).volume,0);
 assert.equal(sanitizeCallTonePreferences(null).enabled,true);
});
test('chat lifecycle stops ringtone on answer and cleanup, shows unlock control',()=>{
 const code=fs.readFileSync(path.join(__dirname,'../src/components/chat-calls.tsx'),'utf8');
 for(const feature of [
  "getTones().start('incoming')","getTones().start('outgoing')",
  "tonesRef.current?.stop()","tonesRef.current?.playEvent('connected')",
  "tonesRef.current?.playEvent(row.callee_id===userId",
  "getTones().unlock()","conecta-call-sound-unlock",
  'localStorage.setItem(settingsKey'
 ])assert.ok(code.includes(feature),feature);
});
