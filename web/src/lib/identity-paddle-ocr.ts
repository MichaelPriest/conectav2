/**
 * Private optional PaddleOCR fallback. Never sends biometrics: only the two
 * document images, on a server-to-server authenticated HTTPS connection.
 */
export async function recognizeWithPaddleOcr(images:readonly Buffer[]):Promise<string[]|null>{
  const rawUrl=process.env.CONECTA_PADDLE_OCR_URL?.trim();
  const secret=process.env.CONECTA_PADDLE_OCR_SECRET?.trim();
  if(!rawUrl||!secret)return null; // Feature off until private worker is deployed.
  if(secret.length<24)return null;
  try{
    const url=new URL(rawUrl);
    if(url.protocol!=='https:'&&!(process.env.NODE_ENV!=='production'&&
      url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))return null;
    if(images.length!==2||images.some(img=>img.length<1||img.length>4*1024*1024))return null;
    const response=await fetch(url,{
      method:'POST',cache:'no-store',
      headers:{'Content-Type':'application/json','X-Conecta-OCR-Key':secret},
      body:JSON.stringify({images:images.map(img=>img.toString('base64'))}),
      signal:AbortSignal.timeout(45_000)
    });
    if(!response.ok)return null;
    const result:unknown=await response.json();
    if(!result||typeof result!=='object'||!('texts' in result))return null;
    const texts=(result as {texts:unknown}).texts;
    if(!Array.isArray(texts)||texts.length!==2||
       texts.some(item=>typeof item!=='string'||item.length>16000))return null;
    return texts;
  }catch{
    // OCR unavailability is not a validation pass. Tesseract's result remains
    // authoritative until the extra OCR returns consistent parseable data.
    return null;
  }
}
