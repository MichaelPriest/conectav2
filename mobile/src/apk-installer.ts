import {File,Paths} from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import * as Application from 'expo-application';
import * as IntentLauncher from 'expo-intent-launcher';
import {Platform} from 'react-native';
import {APK_MIME,bytesToHex,safeApkFilename,verifiedInAppDownload} from './apk-installer-policy';
import type {AvailableUpdate} from './version-utils';

export type DownloadProgressState={written:number;total:number};
export type AndroidDownload={
 file:File;version:string;expectedSha256:string;expectedSize:number
};
export type ActiveApkDownload={cancel:()=>void;promise:Promise<AndroidDownload>};

/**
 * Download is user-initiated and stays in the app. The Android installer
 * requires separate confirmation; this function can never silently install.
 *
 * No browser-provided binary is trusted: its path, version, size and SHA-256
 * must match the published GitHub Release asset exactly.
 */
export function beginAndroidApkDownload(
 update:AvailableUpdate,onProgress:(progress:DownloadProgressState)=>void
):ActiveApkDownload{
 if(Platform.OS!=='android'||!verifiedInAppDownload(update))
  throw new Error('Esta versão não permite download verificado pelo aplicativo.');
 const file=new File(Paths.cache,safeApkFilename(update));
 const task=File.createDownloadTask(update.url,file,{
  onProgress:({bytesWritten,totalBytes})=>{
   onProgress({written:bytesWritten,total:totalBytes>0?totalBytes:update.size||0});
  }
 });
 let cancelled=false;
 const promise=(async():Promise<AndroidDownload>=>{
  try{
   const expectedSize=update.size!;
   if(Paths.availableDiskSpace<expectedSize*2+32_000_000)
    throw new Error('Armazenamento insuficiente para baixar e instalar a atualização.');
   if(file.exists)file.delete();
   const downloaded=await task.downloadAsync();
   if(cancelled||!downloaded)throw new Error('Download cancelado.');
   if(downloaded.size!==expectedSize)
    throw new Error('O tamanho do APK recebido não corresponde à versão publicada.');
   const bytes=await downloaded.bytes();
   const actual=bytesToHex(new Uint8Array(
    await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256,bytes)
   ));
   if(actual!==update.sha256)
    throw new Error('A verificação SHA-256 falhou. O pacote não será instalado.');
   return {file:downloaded,version:update.version,
    expectedSha256:update.sha256!,expectedSize};
  }catch(e){
   if(file.exists){
    try{file.delete();}catch{/* Cache cleanup will be retried on next download. */}
   }
   throw e;
  }
 })();
 return {cancel:()=>{
  cancelled=true;
  try{task.cancel();}catch{}
 },promise};
}
/**
 * Share a verified content:// URI with the OS package installer.
 * Android checks the APK's package identity/signature, then asks the user
 * to authorize unknown-app sources and confirm installation.
 */
export async function requestAndroidInstall(packageFile:AndroidDownload):Promise<void>{
 if(Platform.OS!=='android')throw new Error('Instalação de APK disponível somente no Android.');
 const {file,expectedSize,expectedSha256}=packageFile;
 if(!file.exists||file.size!==expectedSize)
  throw new Error('O arquivo APK não está mais disponível. Baixe novamente.');
 // Re-check digest immediately before granting the OS installer access.
 const actual=bytesToHex(new Uint8Array(
  await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256,await file.bytes())
 ));
 if(actual!==expectedSha256)throw new Error('A integridade do APK mudou. Instalação bloqueada.');
 const uri=file.contentUri;
 if(!uri?.startsWith('content://'))
  throw new Error('O Android não conseguiu preparar o arquivo para instalação.');
 await IntentLauncher.startActivityAsync('android.intent.action.VIEW',{
  data:uri,type:APK_MIME,flags:1
 });
}

/**
 * Android 8+ can require explicit approval to install APKs from Conecta.
 * Opens the per-app system setting rather than asking for blanket access.
 */
export async function openAndroidInstallPermissionSettings():Promise<void>{
 if(Platform.OS!=='android')return;
 const id=Application.applicationId;
 if(!id)throw new Error('Identificador do aplicativo indisponível.');
 await IntentLauncher.startActivityAsync('android.settings.MANAGE_UNKNOWN_APP_SOURCES',{
  data:'package:'+id
 });
}
