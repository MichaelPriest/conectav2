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

test('Story reports retain the reported author and are identifiable in the moderation queue',()=>{
 const migration=read('../supabase/migrations/20261012_conecta_story_safety_reports.sql');
 const page=read('src/app/moderacao/page.tsx');
 assert.match(migration,/select s\.caption,s\.media_type,s\.author_id into content_to_record,media_to_record,offender/i);
 assert.match(migration,/new\.reported_author_id:=offender/i);
 assert.match(page,/target_type:'post'\|'message'\|'story'/);
 assert.match(page,/target_type==='story'\?'Story'/);
 assert.match(page,/target_type==='story'\?'Denúncia de Story'/);
});

test('duplicate and unavailable-content report errors are shown without leaking database details',()=>{
 const button=read('src/components/report-content-button.tsx');
 assert.match(button,/code==='23505'\?'Você já denunciou esse conteúdo\.'/);
 assert.match(button,/code==='23503'\?'Esse conteúdo não está mais disponível para denúncia\.'/);
 assert.match(button,/Não foi possível enviar a denúncia\. Tente novamente\./);
 const intake=read('../supabase/migrations/20261009_conecta_safety_reports_and_community_rls_fix.sql');
 assert.match(intake,/unique_safety_report unique\(reporter_id,target_type,target_id\)/i);
});
