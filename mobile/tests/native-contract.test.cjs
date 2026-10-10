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
 // Image picker must NOT strip RECORD_AUDIO required for voice notes.
 assert.notEqual(appConfig.expo.plugins[0][1].microphonePermission,false);
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
 assert.match(app,/VoiceRecorder key=\{active\} conversationId=/);
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
 assert.match(app,/sendChatMedia\(active,userId,chosen,replyTo\?\.id\|\|null\)/);
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
 assert.match(read('src/design.tsx'),/badge>99\?'99\+':badge/);
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

test('Full-screen Android is inset-aware and provides real app icons',()=>{
 const packageJson=JSON.parse(read('package.json'));
 const conf=JSON.parse(read('app.json')).expo;
 assert.equal(packageJson.dependencies['react-native-safe-area-context'],'~5.7.0');
 assert.equal(packageJson.dependencies['expo-navigation-bar'],'~57.0.3');
 assert.equal(conf.android.edgeToEdgeEnabled,true);
 assert.ok(conf.android.adaptiveIcon.foregroundImage);
 assert.ok(conf.icon);
 assert.ok(conf.splash.image);
 for(const icon of [conf.icon,conf.android.adaptiveIcon.foregroundImage,conf.splash.image]){
  const png=fs.readFileSync(path.join(root,icon));
  assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  assert.ok(png.length>4000);
 }
 assert.match(app,/SafeAreaProvider/);
 assert.match(app,/edges=\{\['top','bottom','left','right'\]\}/);
 assert.match(app,/NavigationBar hidden/);
 assert.match(app,/StatusBar style="dark" hidden=\{Platform\.OS==='android'\}/);
});
test('Native visual identity matches Conecta website and uses real icon tabs',()=>{
 const design=read('src/design.tsx'),tokens=read('src/theme.ts');
 assert.match(tokens,/#8055F5/i);
 assert.match(tokens,/#F9F9FE/i);
 assert.match(design,/nativeTabs/);
 assert.match(design,/Criar publicação/);
 assert.match(design,/BottomNavigation/);
 assert.match(app,/GradientPanel/);
 assert.match(app,/FeedTabs selected=/);
 assert.match(app,/Modal visible=\{composerOpen\}/);
 assert.match(app,/BottomNavigation tab=\{tab\}/);
});

test('Community directory opens native pages and uses membership-guarded posts',()=>{
 const community=read('src/community.ts');
 const validation=read('src/community-validation.ts');
 const media=read('src/media.ts');
 assert.match(data,/from\('communities'\)\.select\('id,owner_id,slug,name,description,rules/);
 assert.match(community,/from\('posts'\)\.select\(POST_FIELDS\)/);
 assert.match(community,/\.eq\('community_id',communityId\)/);
 assert.match(community,/from\('community_members'\)/);
 assert.match(community,/ensureCommunityMembership\(userId,communityId\)/);
 assert.match(community,/visibility:'public'/);
 assert.match(community,/owner_id:userId/);
 assert.match(validation,/validateCommunityDraft/);
 assert.match(media,/community_id:communityId/);
 assert.match(media,/ensureCommunityMembership\(userId,communityId\)/);
 assert.match(app,/CommunityDetailScreen community=\{selected\}/);
 assert.match(app,/setSelected\(item\)/);
 assert.match(app,/createCommunity\(userId,newName,newSlug,newDescription,newRules\)/);
 assert.match(app,/publishCommunityText\(userId,community\.id,content\)/);
 assert.match(app,/publishMediaPost\(userId,content,'public',media,community\.id\)/);
});
test('Polls share the website schema with vote limits and server result counting',()=>{
 const polls=read('src/polls.ts'),form=read('src/poll-ui.tsx');
 const validation=read('src/poll-validation.ts');
 assert.match(polls,/from\('post_polls'\)\.insert\(/);
 assert.match(polls,/from\('post_poll_options'\)\.insert\(/);
 assert.match(polls,/from\('post_poll_votes'\)\.insert\(/);
 assert.match(polls,/rpc\('poll_results',\{target_post:postId\}\)/);
 assert.match(polls,/await ensureCommunityMembership\(userId,communityId\)/);
 assert.match(polls,/await requestPostModeration\(data\.id\)/);
 assert.match(validation,/validatePollDraft/);
 assert.match(form,/castPollVote\(postId,userId,id\)/);
 assert.match(form,/poll\.selected/);
 assert.match(app,/PollCard postId=\{post\.id\}/);
 assert.match(app,/publishPollPost\(userId,text,visibility,pollOptions,pollDays\)/);
 assert.match(app,/publishPollPost\(userId,content,'public',pollOptions,pollDays,community\.id\)/);
});
test('Native @mentions are authorized, debounced and sanitize username suggestions',()=>{
 const mentions=read('src/mentions.tsx'),utils=read('src/mention-utils.ts');
 assert.match(mentions,/from\('profiles'\)/);
 assert.match(mentions,/\.ilike\('handle',query\+'%'\)\.limit\(6\)/);
 assert.match(mentions,/setTimeout\(async\(\)=>/);
 assert.match(mentions,/activeMention\(value,cursor\)/);
 assert.match(mentions,/replaceMention\(value,cursor,person\.handle,maxLength\)/);
 assert.match(utils,/\(\^\|\\s\)@/);
 assert.match(app,/MentionInput value=\{text\}/);
 assert.match(app,/MentionInput value=\{content\}/);
 assert.match(app,/MentionInput value=\{commentBody\}/);
 assert.match(app,/MentionInput value=\{compose\}/);
});
test('Post deletion remains author-only and cleans signed user-owned uploads',()=>{
 assert.match(data,/deleteOwnPost\(post:Post,userId:string\)/);
 assert.match(data,/post\.author_id!==userId/);
 assert.match(data,/\.eq\('author_id',userId\)\.select\('id'\)/);
 assert.match(data,/path\.startsWith\(userId\+'\/'\)/);
 assert.match(data,/storage\.from\('social-media'\)\.remove\(paths\)/);
 assert.match(app,/accessibilityLabel="Excluir publicação"/);
 assert.match(app,/deleteOwnPost\(post,userId\)/);
});
