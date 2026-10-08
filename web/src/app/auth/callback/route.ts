import {NextRequest,NextResponse} from 'next/server';
import {createServerClient} from '@supabase/ssr';

const allowedDestinations=new Set(['/onboarding','/auth/redefinir-senha']);

export async function GET(request:NextRequest){
  const url=new URL(request.url);
  const code=url.searchParams.get('code');
  const next=url.searchParams.get('next');
  const destination=next&&allowedDestinations.has(next)?next:'/onboarding';
  const fallback=new URL('/auth?error=confirmation',url.origin);
  if(!code)return NextResponse.redirect(fallback);

  const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!supabaseUrl||!publishableKey)return NextResponse.redirect(fallback);

  const response=NextResponse.redirect(new URL(destination,url.origin));
  const supabase=createServerClient(supabaseUrl,publishableKey,{
    cookies:{
      getAll(){return request.cookies.getAll();},
      setAll(cookies){cookies.forEach(({name,value,options})=>response.cookies.set(name,value,options));}
    }
  });
  const {error}=await supabase.auth.exchangeCodeForSession(code);
  if(error)return NextResponse.redirect(fallback);
  return response;
}
