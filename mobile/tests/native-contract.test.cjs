'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const app=read('App.tsx'),data=read('src/data.ts'),config=read('src/supabase.ts');
test('Native Android/iOS app is real React Native, not a WebView',()=>{
 const json=JSON.parse(read('app.json'));
 assert.equal(json.expo.android.package,'br.com.conectav2.app');
 assert.equal(json.expo.ios.bundleIdentifier,'br.com.conectav2.app');
 assert.ok(app.includes('from \'react-native\''));
 assert.ok(!app.includes('WebView'));
 assert.ok(!app.includes('iframe'));
});
test('Same Supabase backend and real signed-in data',()=>{
 assert.ok(config.includes('opdlxxrcdsxqmlhgayfm.supabase.co'));
 assert.ok(config.includes('createClient('));
 assert.ok(config.includes('autoRefreshToken:true'));
 // Reject privileged credentials in executable configuration; comments can
 // legitimately explain that service-role secrets must NEVER be used.
 const executable=config.replace(/\/\*[^]*?\*\//g,'')
  .split('\\n').filter(line=>!line.trim().startsWith('//')).join('\\n');
 assert.ok(!/sb_secret_[A-Za-z0-9_]+/.test(executable));
 assert.ok(!/EXPO_PUBLIC_(SERVICE_ROLE|SECRET_KEY)/.test(executable));
 assert.match(executable,/sb_publishable_[A-Za-z0-9_-]+/);
 for(const name of ['loadFeed','loadThreads','loadConnections','loadCommunities','loadNotifications']){
  assert.ok(app.includes(name),name);
 }
});
test('Age declaration and onboarding restrictions cannot be skipped by mobile views',()=>{
 assert.ok(data.includes("from('registration_age_declarations')"));
 assert.ok(data.includes("declared_band!=='18_plus'"));
 assert.ok(app.includes('restricted?<Restricted'));
 assert.ok(app.includes("'/verificar-identidade'"));
 assert.ok(app.includes("'/onboarding'"));
});
test('Publishing does not bypass current server moderation',()=>{
 assert.ok(data.includes("SITE_URL+'/api/moderation/review'"));
 assert.ok(data.includes("Authorization:'Bearer '+session.access_token"));
 assert.ok(data.includes('pending moderation state'));
 assert.ok(!data.includes('moderation_status:\'approved\''));
});
test('Native chat sends real messages and uses secured membership RPC',()=>{
 assert.ok(data.includes("rpc('create_conversation_with_members'"));
 assert.ok(data.includes("from('messages').insert("));
 assert.ok(data.includes("rpc('my_conversation_unread_counts')"));
 assert.ok(app.includes("filter:'conversation_id=eq.'+active"));
});

test('Native gallery and camera publish into the same secure post schema',()=>{
 const media=read('src/media.ts');
 const validation=read('src/media-validation.ts');
 const appConfig=JSON.parse(read('app.json'));
 assert.match(app,/ImagePicker\.launchImageLibraryAsync/);
 assert.match(app,/ImagePicker\.launchCameraAsync/);
 assert.match(app,/publishMediaPost\(/);
 assert.match(media,/storage\.from\('social-media'\)\.upload\(/);
 assert.match(media,/from\('post_media'\)\.insert\(/);
 assert.match(media,/from\('posts'\)\.delete\(/);
 assert.match(media,/storage\.from\('social-media'\)[\s\S]*?\.remove\(/);
 assert.match(media,/requestPostModeration\(/);
 assert.match(validation,/MAX_MEDIA_BYTES/);
 assert.equal(appConfig.expo.plugins[0][0],'expo-image-picker');
 assert.equal(appConfig.expo.plugins[0][1].microphonePermission,false);
});

test('Native comments, bookmarks and inline videos use actual authorized database records',()=>{
 const ui=read('src/ui.tsx');
 const appConfig=JSON.parse(read('app.json'));
 assert.match(data,/from\('post_comments'\)\.insert\(/);
 assert.match(data,/SITE_URL\+'\/api\/moderation\/comment'/);
 assert.match(data,/from\('saved_posts'\)\.insert\(/);
 assert.match(data,/from\('saved_posts'\)\.delete\(/);
 assert.match(app,/loadPostComments\(/);
 assert.match(app,/sendPostComment\(/);
 assert.match(app,/loadSavedPosts\(/);
 assert.match(app,/setSavedPost\(/);
 assert.match(ui,/useVideoPlayer\(url\)/);
 assert.match(ui,/signedMedia\(path\)/);
 assert.ok(appConfig.expo.plugins.some(plugin=>plugin[0]==='expo-video'));
});

test('Native safety reporting uses same RLS-protected web workflow',()=>{
 const ui=read('src/ui.tsx');
 assert.match(data,/from\('safety_reports'\)\.insert\(/);
 assert.match(data,/reporter_id:userId,target_type:targetType,target_id:targetId/);
 assert.match(app,/ReportContent targetType="post"/);
 assert.match(read('src/chat-bubble.tsx'),/ReportContent targetType="message"/);
 assert.match(ui,/Assédio ou intimidação/);
 assert.match(ui,/Exposição de informações pessoais/);
});

test('Native Stories use the same 24h expiry, RLS and moderation as web',()=>{
 const story=read('src/stories.ts'),ui=read('src/story-ui.tsx');
 assert.match(story,/from\('stories'\)/);
 assert.match(story,/\.gt\('expires_at',new Date\(\)\.toISOString\(\)\)/);
 assert.match(story,/storage\.from\('social-media'\)\.upload\(/);
 assert.match(story,/requestContentModeration\('story',data\.id\)/);
 assert.match(story,/from\('stories'\)\.delete\(\)/);
 assert.match(ui,/Date\.parse\(story\.expires_at\)>Date\.now\(\)/);
 assert.match(ui,/launchImageLibraryAsync/);
 assert.match(ui,/requestCameraPermissionsAsync/);
 assert.match(app,/StoryRail userId=/);
});

test('Voice notes stay private and require explicit microphone consent',()=>{
 const voice=read('src/voice.ts'),ui=read('src/voice-ui.tsx');
 const config=JSON.parse(read('app.json'));
 assert.match(voice,/getSession\(\)/);
 assert.match(voice,/session\.user\.id!==userId/);
 assert.match(voice,/from\('messages'\)\.insert\(/);
 assert.match(voice,/media_type:'audio'/);
 assert.match(voice,/storage\.from\('social-media'\)/);
 assert.match(voice,/remove\(\[storage_path\]\)/);
 assert.match(ui,/requestRecordingPermissionsAsync\(\)/);
 assert.match(ui,/useAudioRecorder\(RecordingPresets\.HIGH_QUALITY\)/);
 assert.match(ui,/useAudioPlayer\(url\)/);
 assert.match(app,/VoiceRecorder conversationId=/);
 assert.match(read('src/chat-bubble.tsx'),/AudioMessage path=/);
 const plugin=config.expo.plugins.find(p=>p[0]==='expo-audio');
 assert.ok(plugin);
 assert.equal(plugin[1].enableBackgroundRecording,false);
 assert.equal(plugin[1].enableBackgroundPlayback,false);
});

test('Chat media stays scoped to the signed-in conversation, with upload cleanup',()=>{
 const media=read('src/chat-media.ts');
 assert.match(media,/session\.user\.id!==userId/);
 assert.match(media,/storage\.from\('social-media'\)/);
 assert.match(media,/messages\/\${randomUUID\(\)}/);
 assert.match(media,/media_type:media\.kind/);
 assert.match(media,/from\('messages'\)\.insert\(/);
 assert.match(media,/remove\(\[path\]\)/);
 assert.match(app,/sendChatMedia\(active,userId,chosen\)/);
 assert.match(read('src/chat-bubble.tsx'),/VideoMedia path=\{message\.media_path\}/);
});

test('Profile media uses existing signed Supabase avatar and cover fields',()=>{
 const profile=read('src/profile-media.ts');
 assert.match(profile,/PROFILE_LIMIT=8\*1024\*1024/);
 assert.match(profile,/session\.user\.id!==userId/);
 assert.match(profile,/avatars':'covers'/);
 assert.match(profile,/from\('profiles'\)/);
 assert.match(profile,/from\('profile_details'\)/);
 assert.match(profile,/ImageManipulator\.manipulate/);
 assert.match(profile,/upsert\(\{user_id:userId,cover_path:path\}/);
 assert.match(app,/changeProfilePhoto\(profile\.id,selected,kind\)/);
 assert.match(app,/loadCover\(profile\.id\)/);
});

test('Reels browse the same public moderated video posts as web',()=>{
 const reels=read('src/reels-ui.tsx');
 assert.match(data,/loadPublicReels/);
 assert.match(data,/\.eq\('visibility','public'\)\.eq\('media_type','video'\)/);
 assert.match(reels,/loadPublicReels\(\)/);
 assert.match(reels,/VideoMedia path=\{path\}/);
 assert.match(reels,/setLike\(post\.id,userId,wasLiked\)/);
 assert.match(app,/tab==='reels'/);
});

test('Native chat keeps replies, edits, deletes and emoji reactions under RLS',()=>{
 const bubble=read('src/chat-bubble.tsx');
 const actions=read('src/chat-actions.ts');
 const models=read('src/models.ts');
 assert.match(models,/reply_to:string\|null/);
 assert.match(models,/edited_at:string\|null/);
 assert.match(data,/reply_to:replyTo/);
 assert.match(data,/CHAT_MESSAGE_FIELDS='id,conversation_id,sender_id,content,created_at,media_path,media_type,deleted_at,edited_at,reply_to'/);
 assert.match(data,/\.select\(CHAT_MESSAGE_FIELDS\)/);
 assert.match(actions,/from\('message_reactions'\)/);
 assert.match(actions,/\.eq\('user_id',userId\)/);
 assert.match(actions,/\.eq\('sender_id',userId\)\.is\('deleted_at',null\)/);
 assert.match(actions,/deleted_at:new Date\(\)\.toISOString\(\)/);
 assert.match(actions,/if\(message\.sender_id!==userId/);
 assert.match(bubble,/CHAT_EMOJIS\.map/);
 assert.match(bubble,/deleteChatMessage\(message,userId\)/);
 assert.match(bubble,/editChatMessage\(message,userId,editText\)/);
 assert.match(app,/onReply=\{message=>setReplyTo\(message\)\}/);
 assert.match(app,/sendMessage\(active,userId,compose,replyTo\?\.id\|\|null\)/);
});

test('Chat pagination and server search preserve membership, order and privacy',()=>{
 const search=read('src/chat-search.tsx');
 assert.match(data,/loadOlderChatMessages/);
 assert.match(data,/\.eq\('conversation_id',conversationId\)/);
 assert.match(data,/\.order\('created_at',\{ascending:false\}\)\.order\('id',\{ascending:false\}\)/);
 assert.match(data,/\.is\('deleted_at',null\)/);
 assert.match(data,/\.ilike\('content','%'\+escaped\+'%'\)/);
 assert.match(data,/replace\(\/\[\\\\%_\]\/g/);
 assert.match(app,/mergeChatPages\(previous,loaded,id\)/);
 assert.match(app,/loadOlderChatMessages\(active,messages\[0\]\)/);
 assert.match(app,/inverted/);
 assert.match(app,/ChatSearch conversationId=\{active\}/);
 assert.match(search,/searchChatMessages\(conversationId,query\)/);
});

test('Foreground notification badge reads private unread count and updates after marking read',()=>{
 assert.match(data,/export async function unreadNotificationCount/);
 assert.match(data,/\.select\('id',\{count:'exact',head:true\}\)/);
 assert.match(data,/\.eq\('recipient_id',userId\)\.is\('read_at',null\)/);
 assert.match(app,/conecta-mobile-unread-/);
 assert.match(app,/if\(state==='active'\)void refreshUnread\(id\)/);
 assert.match(app,/onRead:\(\)=>void/);
 assert.match(app,/unreadCount>99\?'99\+':unreadCount/);
});

test('Switching accounts clears unsent native composer media and previous drafts',()=>{
 assert.match(app,/setDraftReady\(false\);setText\(''\);setVisibility\('public'\);setMedia\(\[\]\)/);
 assert.match(app,/conecta-mobile-feed-draft:'\+userId/);
 assert.match(app,/draftRevision\.current/);
 assert.match(app,/AsyncStorage\.removeItem\(draftKey\)/);
});

test('Voice and media replies remain in the selected conversation',()=>{
 const voice=read('src/voice.ts'),audio=read('src/voice-ui.tsx');
 const media=read('src/chat-media.ts');
 assert.match(voice,/media_type:'audio',reply_to:replyTo/);
 assert.match(media,/media_type:media\.kind,reply_to:replyTo/);
 assert.match(audio,/sendVoiceMessage\(conversationId,userId,uri,replyTo\|\|null\)/);
 assert.match(app,/sendChatMedia\(active,userId,chosen,replyTo\?\.id\|\|null\)/);
 assert.match(app,/VoiceRecorder key=\{active\}/);
});
