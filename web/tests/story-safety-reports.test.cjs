'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');

test('active approved Stories can be reported without allowing reports on own or expired Stories',()=>{
 const migration=read('../supabase/migrations/20261012_conecta_story_safety_reports.sql');
 assert.match(migration,/target_type in \('message','post','story'\)/i);
 assert.match(migration,/new\.target_type='story'[\s\S]*s\.author_id<>new\.reporter_id[\s\S]*s\.moderation_status='approved'[\s\S]*s\.expires_at>now\(\)/i);
 assert.match(migration,/target_type='story'[\s\S]*s\.author_id<>\(select auth\.uid\(\)\)[\s\S]*s\.moderation_status='approved'[\s\S]*s\.expires_at>now\(\)/i);
 assert.match(migration,/new\.reporter_id is distinct from \(select auth\.uid\(\)\)/i);
});

test('Story report button is only offered for another user\'s Story and submits to safety_reports',()=>{
 const rail=read('src/components/story-rail.tsx');
 const button=read('src/components/report-content-button.tsx');
 assert.match(rail,/ReportContentButton/);
 assert.match(rail,/selected\.author_id!==userId/);
 assert.match(rail,/targetType="story"/);
 assert.match(button,/targetType:'message'\|'post'\|'story'/);
 assert.match(button,/target_type:targetType,target_id:targetId/);
});
