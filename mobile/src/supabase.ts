import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {createClient} from '@supabase/supabase-js';
import {AppState} from 'react-native';

// Publishable key is a public app identifier, NEVER a service_role/secret key.
// The existing Supabase RLS, age restrictions and moderation remain authoritative.
export const SUPABASE_URL=process.env.EXPO_PUBLIC_SUPABASE_URL||'https://opdlxxrcdsxqmlhgayfm.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY=process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_nAEGD884flLhsFTNYhxE-A_2yOYNSFI';
// Public/share URLs must always use the primary production site.
export const PUBLIC_SITE_URL='https://conectav2.vercel.app';
// Temporary homologation API origin; not for user-facing links.
export const API_SITE_URL='https://conectav2-validacao.onrender.com';
export const supabase=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{
  auth:{storage:AsyncStorage,autoRefreshToken:true,persistSession:true,
    detectSessionInUrl:false}
});
AppState.addEventListener('change',state=>{
  if(state==='active')supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
