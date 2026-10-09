import type {ImagePickerAsset} from 'expo-image-picker';

export type SelectedMedia={
 uri:string;mimeType:string;extension:string;kind:'image'|'video';size?:number;
};
const MAX_BYTES=50*1024*1024;
const MIME_EXT:Record<string,string>={
 'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif',
 'image/heic':'heic','image/heif':'heif',
 'video/mp4':'mp4','video/quicktime':'mov','video/webm':'webm','video/x-m4v':'m4v'
};
const EXT_MIME:Record<string,string>=Object.fromEntries(
 Object.entries(MIME_EXT).map(([mime,ext])=>[ext,mime])
);
EXT_MIME.jpeg='image/jpeg';

export function normalizeMedia(assets:ImagePickerAsset[]):SelectedMedia[]{
 if(assets.length===0)throw new Error('Selecione pelo menos uma foto ou vídeo.');
 if(assets.length>5)throw new Error('Você pode adicionar até cinco fotos.');
 const files=assets.map(asset=>{
  const ext=asset.fileName?.split('.').pop()?.toLowerCase()||'';
  const suppliedMime=asset.mimeType?.toLowerCase();
  const mimeType=(suppliedMime==='image/jpg'?'image/jpeg':suppliedMime)||
   EXT_MIME[ext];
  const extension=mimeType?MIME_EXT[mimeType]:undefined;
  if(!extension||!(asset.type==='image'||asset.type==='video')||
    (asset.type==='image')!==mimeType.startsWith('image/'))
   throw new Error('Formato de mídia não aceito. Use JPG, PNG, WEBP, GIF, HEIC, MP4 ou MOV.');
  if(asset.fileSize!==undefined&&(asset.fileSize<=0||asset.fileSize>MAX_BYTES))
   throw new Error('Cada mídia precisa ter no máximo 50 MB.');
  return {uri:asset.uri,mimeType,extension,kind:asset.type,size:asset.fileSize} as SelectedMedia;
 });
 if(files.some(x=>x.kind==='video')&&files.length!==1)
  throw new Error('Publique um vídeo por vez, sem misturar com fotos.');
 return files;
}

