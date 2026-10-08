'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const {prepareHumanBundle}=require('../scripts/prepare-human.cjs');

const project=path.resolve(__dirname,'..');

test('a real browser Human distribution is copied from installed package',()=>{
 const {target,bytes}=prepareHumanBundle(project);
 assert.ok(bytes>=100000);
 assert.ok(fs.existsSync(target));
 assert.equal(fs.statSync(target).size,bytes);
});

test('camera code loads only the first-party Human browser script',()=>{
 const camera=fs.readFileSync(path.join(project,'src/components/human-camera-check.tsx'),'utf8');
 assert.match(camera,/script\.src='\/vendor\/human\.js'/);
 assert.doesNotMatch(camera,/import\s*\(\s*['"]@vladmandic\/human/);
 assert.match(camera,/await loadBrowserHuman\(\)/);
 assert.match(camera,/await navigator\.mediaDevices\.getUserMedia/);
});

test('Human browser package stays pinned',()=>{
 const pkg=JSON.parse(fs.readFileSync(path.join(project,'package.json'),'utf8'));
 assert.equal(pkg.dependencies['@vladmandic/human'],'3.3.6');
});
