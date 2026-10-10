/**
 * Installer update policy for Conecta's PUBLIC GitHub Releases.
 *
 * GitHub Actions artifacts expire and may require authentication; never use
 * Actions artifacts as automatic-update downloads. Only a published, versioned
 * release APK under our repository may be offered to an Android device.
 */
export type ReleaseAsset={name:string;browser_download_url:string;size?:number};
export type MobileRelease={
 tag_name:string;draft:boolean;prerelease?:boolean;published_at?:string|null;
 assets:ReleaseAsset[];html_url?:string
};
export type AvailableUpdate={version:string;url:string;notes:string};

export function versionParts(value:string):{major:number;minor:number;patch:number;pre:string|null}|null{
 const match=/^v?(\d+)\.(\d+)\.(\d+)(?:-([a-z0-9.-]+))?(?:\+[a-z0-9.-]+)?$/i.exec(value.trim());
 if(!match)return null;
 const nums=match.slice(1,4).map(Number);
 if(nums.some(n=>!Number.isSafeInteger(n)||n<0))return null;
 return {major:nums[0],minor:nums[1],patch:nums[2],pre:match[4]||null};
}
/** Simple semver ordering including prereleases; avoids lexicographic 0.10 < 0.9. */
export function compareVersions(left:string,right:string):number{
 const a=versionParts(left),b=versionParts(right);
 if(!a||!b)return 0;
 for(const key of ['major','minor','patch'] as const){
  if(a[key]!==b[key])return a[key]>b[key]?1:-1;
 }
 if(a.pre===null&&b.pre!==null)return 1;
 if(a.pre!==null&&b.pre===null)return -1;
 if(a.pre===null&&b.pre===null)return 0;
 const aa=a.pre!.split('.'),bb=b.pre!.split('.');
 for(let i=0;i<Math.max(aa.length,bb.length);i++){
  if(i===aa.length)return -1;
  if(i===bb.length)return 1;
  const x=aa[i],y=bb[i];
  const nx=/^\d+$/.test(x),ny=/^\d+$/.test(y);
  if(nx&&ny){const diff=Number(x)-Number(y);if(diff)return diff>0?1:-1;}
  else if(nx!==ny)return nx?-1:1;
  else if(x!==y)return x>y?1:-1;
 }
 return 0;
}
const PREFIX='https://github.com/MichaelPriest/conectav2/releases/download/';
export function trustedAndroidApk(url:string):boolean{
 try{
  const parsed=new URL(url);
  return parsed.protocol==='https:'&&parsed.hostname==='github.com'&&
   !parsed.username&&!parsed.password&&!parsed.port&&!parsed.search&&!parsed.hash&&
   parsed.pathname.startsWith('/MichaelPriest/conectav2/releases/download/')&&
   parsed.pathname.toLowerCase().endsWith('.apk')&&
   !parsed.pathname.includes('..');
 }catch{return false;}
}
export function chooseAndroidUpdate(
 releases:unknown,installedVersion:string
):AvailableUpdate|null{
 if(!Array.isArray(releases)||!versionParts(installedVersion))return null;
 let best:AvailableUpdate|null=null;
 for(const item of releases){
  if(!item||typeof item!=='object')continue;
  const release=item as Partial<MobileRelease>;
  if(release.draft||typeof release.tag_name!=='string'||!Array.isArray(release.assets))continue;
  const tag=/^mobile-v(\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?)$/i.exec(release.tag_name);
  if(!tag||!versionParts(tag[1])||compareVersions(tag[1],installedVersion)<=0)continue;
  const asset=release.assets.find(a=>a&&typeof a.name==='string'&&
   /^conecta-v2-android-[a-z0-9.-]+\.apk$/i.test(a.name)&&
   typeof a.browser_download_url==='string'&&trustedAndroidApk(a.browser_download_url)&&
   // An actual Android binary, not a placeholder or suspiciously small file.
   typeof a.size==='number'&&a.size>=2_000_000);
  if(!asset)continue;
  if(!best||compareVersions(tag[1],best.version)>0){
   best={version:tag[1],url:asset.browser_download_url,
    notes:'Uma nova versão instalável do Conecta está disponível.'};
  }
 }
 return best;
}

export type AppleStoreApp={
 bundleId:string;version:string;trackViewUrl:string;
};
export const APP_STORE_LOOKUP_API=
 'https://itunes.apple.com/lookup?bundleId=br.com.conectav2.app&country=br';
export function chooseIosUpdate(data:unknown,installedVersion:string):AvailableUpdate|null{
 if(!data||typeof data!=='object'||!versionParts(installedVersion))return null;
 const rows=(data as {results?:unknown}).results;
 if(!Array.isArray(rows))return null;
 for(const row of rows){
  if(!row||typeof row!=='object')continue;
  const app=row as Partial<AppleStoreApp>;
  if(app.bundleId!=='br.com.conectav2.app'||
     typeof app.version!=='string'||typeof app.trackViewUrl!=='string'||
     compareVersions(app.version,installedVersion)<=0)continue;
  try{
   const url=new URL(app.trackViewUrl);
   if(url.protocol!=='https:'||url.hostname!=='apps.apple.com'||
      !/\/id\d+/.test(url.pathname)||url.username||url.password)return null;
   return {version:app.version,url:app.trackViewUrl,
    notes:'Uma nova versão do Conecta está disponível na App Store.'};
  }catch{return null;}
 }
 return null;
}

export const MOBILE_RELEASES_API='https://api.github.com/repos/MichaelPriest/conectav2/releases?per_page=30';
