export type DownloadRelease = {
  version:string;
  downloadUrl:string;
  releaseUrl:string;
  size:number;
  sha256:string|null;
  publishedAt:string|null;
};

const API='https://api.github.com/repos/MichaelPriest/conectav2/releases?per_page=30';
const repo='/MichaelPriest/conectav2/releases/download/';

/** Only allow version-matched APKs from the real GitHub repository Releases. */
export function selectLatestAndroidRelease(input:unknown):DownloadRelease|null{
 if(!Array.isArray(input))return null;
 const found:{version:[number,number,number];release:DownloadRelease}[]=[];
 for(const row of input){
  if(!row||typeof row!=='object')continue;
  const item=row as Record<string,unknown>;
  const tag=typeof item.tag_name==='string'
   ?/^mobile-v(\\d+)\\.(\\d+)\\.(\\d+)$/.exec(item.tag_name):null;
  if(!tag||item.draft===true||!Array.isArray(item.assets))continue;
  const nums=tag.slice(1).map(Number) as [number,number,number];
  if(nums.some(n=>!Number.isSafeInteger(n)))continue;
  const version=tag.slice(1).join('.');
  const expectedName='conecta-v2-android-'+version+'.apk';
  const expectedPath=repo+item.tag_name+'/'+expectedName;
  for(const raw of item.assets){
   if(!raw||typeof raw!=='object')continue;
   const asset=raw as Record<string,unknown>;
   if(asset.name!==expectedName||typeof asset.browser_download_url!=='string'
      ||typeof asset.size!=='number'||asset.size<2000000||asset.size>250000000)continue;
   let url:URL;
   try{url=new URL(asset.browser_download_url);}catch{continue;}
   if(url.protocol!=='https:'||url.hostname!=='github.com'
     ||url.pathname!==expectedPath||url.search||url.hash||url.username||url.password||url.port)continue;
   const notes=typeof item.body==='string'?item.body:'';
   const digest=typeof asset.digest==='string'&&/^sha256:[a-f0-9]{64}$/i.test(asset.digest)
     ?asset.digest.slice(7).toLowerCase():null;
   const noteDigest=/^APK-SHA256:\\s*([a-f0-9]{64})\\s*$/im.exec(notes)?.[1]?.toLowerCase()||null;
   const noteSize=/^APK-SIZE:\\s*(\\d+)\\s*$/im.exec(notes)?.[1]||null;
   if((digest&&noteDigest&&digest!==noteDigest)||(noteSize&&Number(noteSize)!==asset.size))continue;
   found.push({version:nums,release:{
    version,downloadUrl:url.href,
    releaseUrl:'https://github.com/MichaelPriest/conectav2/releases/tag/'+item.tag_name,
    size:asset.size,sha256:digest||noteDigest,
    publishedAt:typeof item.published_at==='string'?item.published_at:null
   }});
  }
 }
 found.sort((a,b)=>{
  for(let i=0;i<3;i++)if(a.version[i]!==b.version[i])
   return b.version[i]-a.version[i];
  return 0;
 });
 return found[0]?.release||null;
}

export async function latestAndroidRelease():Promise<DownloadRelease|null>{
 try{
  const response=await fetch(API,{
   headers:{Accept:'application/vnd.github+json','User-Agent':'Conecta-Web'},
   next:{revalidate:300}
  });
  if(!response.ok)return null;
  return selectLatestAndroidRelease(await response.json());
 }catch{return null;}
}
