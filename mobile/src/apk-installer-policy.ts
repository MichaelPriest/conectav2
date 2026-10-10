import type {AvailableUpdate} from './version-utils.ts';
import {trustedAndroidApk,versionParts} from './version-utils';

export const MAX_APK_BYTES=250_000_000;
export const MIN_APK_BYTES=2_000_000;
export const APK_MIME='application/vnd.android.package-archive';

export function verifiedInAppDownload(update:AvailableUpdate):boolean{
 return update.channel==='android'&&Boolean(versionParts(update.version))&&
  trustedAndroidApk(update.url)&&
  typeof update.sha256==='string'&&/^[a-f0-9]{64}$/.test(update.sha256)&&
  typeof update.size==='number'&&Number.isSafeInteger(update.size)&&
  update.size>=MIN_APK_BYTES&&update.size<=MAX_APK_BYTES;
}
export function safeApkFilename(update:AvailableUpdate):string{
 if(!verifiedInAppDownload(update))throw new Error('Pacote sem assinatura de integridade verificável.');
 return 'conecta-v2-android-'+update.version+'.apk';
}
export function bytesToHex(bytes:Uint8Array):string{
 return Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('');
}
export function formatSize(bytes:number):string{
 return (bytes/(1024*1024)).toFixed(1)+' MB';
}
export function progressFraction(written:number,total:number):number{
 if(!Number.isFinite(written)||!Number.isFinite(total)||total<=0)return 0;
 return Math.max(0,Math.min(1,written/total));
}
