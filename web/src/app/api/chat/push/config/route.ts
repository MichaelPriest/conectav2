import {NextResponse} from 'next/server';
import {chatPushPublicKey} from '@/lib/chat-push-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
  const key=chatPushPublicKey();
  return NextResponse.json({enabled:Boolean(key),publicKey:key},
    {headers:{'Cache-Control':'no-store'}});
}
