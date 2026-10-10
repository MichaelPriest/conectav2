import {NextRequest,NextResponse} from 'next/server';
import {nativePushContext,nativePushRequestAllowed,nativePushTokenHash,validNativeDevice} from '@/lib/mobile-push-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>NextResponse.json(data,{
 status,headers:{'Cache-Control':'no-store'}
});
export async function POST(request:NextRequest){
 if(!nativePushRequestAllowed(request))return json({error:'Origem inválida.'},403);
 if(Number(request.headers.get('content-length')||0)>2048)return json({error:'Corpo inválido.'},413);
 const ctx=await nativePushContext(request);
 if(!ctx)return json({error:'Sessão ou verificação etária inválida.'},401);
 const device=validNativeDevice(await request.json().catch(()=>null));
 if(!device)return json({error:'Identificação do dispositivo inválida.'},400);
 const token_hash=nativePushTokenHash(device.token);
 const {data:owned,error:countError}=await ctx.admin.from('mobile_push_devices')
  .select('token_hash').eq('user_id',ctx.user.id).limit(6);
 if(countError)return json({error:'Não foi possível consultar seus dispositivos.'},503);
 if((owned||[]).length>=5&&!owned?.some(row=>row.token_hash===token_hash))
  return json({error:'Limite de cinco dispositivos por conta.'},429);
 const {error}=await ctx.admin.from('mobile_push_devices').upsert({
  token_hash,user_id:ctx.user.id,expo_push_token:device.token,
  platform:device.platform,updated_at:new Date().toISOString()
 },{onConflict:'token_hash'});
 if(error)return json({error:'Falha ao registrar dispositivo.'},503);
 return json({enabled:true});
}
export async function DELETE(request:NextRequest){
 if(!nativePushRequestAllowed(request))return json({error:'Origem inválida.'},403);
 if(Number(request.headers.get('content-length')||0)>2048)return json({error:'Corpo inválido.'},413);
 const ctx=await nativePushContext(request);
 if(!ctx)return json({error:'Sessão inválida.'},401);
 const device=validNativeDevice(await request.json().catch(()=>null));
 if(!device)return json({error:'Identificação do dispositivo inválida.'},400);
 const {error}=await ctx.admin.from('mobile_push_devices').delete()
  .eq('token_hash',nativePushTokenHash(device.token)).eq('user_id',ctx.user.id);
 if(error)return json({error:'Falha ao remover dispositivo.'},503);
 return json({enabled:false});
}
