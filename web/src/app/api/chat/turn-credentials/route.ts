import {createClient} from '@supabase/supabase-js';
import {createHmac} from 'node:crypto';
import {NextResponse} from 'next/server';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const noStore={'Cache-Control':'no-store, max-age=0','Pragma':'no-cache'};

export async function GET(request:Request){
 const auth=request.headers.get('authorization')||'';
 const token=auth.match(/^Bearer\s+(.+)$/i)?.[1];
 if(!token)return NextResponse.json({error:'Autenticação obrigatória.'},{status:401,headers:noStore});

 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)return NextResponse.json({error:'Autenticação indisponível.'},{status:503,headers:noStore});
 const supabase=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const {data:{user},error}=await supabase.auth.getUser(token);
 if(error||!user)return NextResponse.json({error:'Sessão inválida.'},{status:401,headers:noStore});

 const turnUrls=(process.env.TURN_URLS||'').split(',').map(value=>value.trim()).filter(value=>/^turns?:/i.test(value));
 const secret=process.env.TURN_SHARED_SECRET;
 if(!turnUrls.length||!secret)return NextResponse.json({enabled:false,iceServers:[]},{headers:noStore});

 // TURN REST API credentials expire after ten minutes. The shared secret never reaches the browser.
 const expiry=Math.floor(Date.now()/1000)+600;
 const username=`${expiry}:${user.id}`;
 const credential=createHmac('sha1',secret).update(username).digest('base64');
 return NextResponse.json({
  enabled:true,
  ttl:600,
  iceServers:[{urls:turnUrls,username,credential}]
 },{headers:noStore});
}
