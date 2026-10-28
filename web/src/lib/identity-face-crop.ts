import sharp from 'sharp';

type ImageSize={width:number;height:number};
type CropBounds={left:number;top:number;width:number;height:number};

/**
 * The detector runs on a bounded preview to keep inference affordable.
 * Convert its face rectangle back into the oriented, full-resolution upload.
 * All geometry is server-derived; never trust client-supplied boxes.
 */
export function originalFaceCropBounds(
  faceBox:readonly number[],
  analysis:ImageSize,
  original:ImageSize,
  padding=0.35
):CropBounds{
  if(faceBox.length<4||faceBox.slice(0,4).some(v=>!Number.isFinite(v))||
     !Number.isInteger(analysis.width)||!Number.isInteger(analysis.height)||
     !Number.isInteger(original.width)||!Number.isInteger(original.height)||
     analysis.width<1||analysis.height<1||original.width<1||original.height<1||
     !Number.isFinite(padding)||padding<0||padding>0.5)
    throw new Error('Coordenadas faciais inválidas.');
  const [x,y,w,h]=faceBox;
  if(w<=0||h<=0||x<-w*0.5||y<-h*0.5||
     x>analysis.width||y>analysis.height)
    throw new Error('Rosto fora dos limites da imagem.');
  const xScale=original.width/analysis.width;
  const yScale=original.height/analysis.height;
  const left=Math.max(0,Math.floor((x-w*padding)*xScale));
  const top=Math.max(0,Math.floor((y-h*padding)*yScale));
  const right=Math.min(original.width,Math.ceil((x+w*(1+padding))*xScale));
  const bottom=Math.min(original.height,Math.ceil((y+h*(1+padding))*yScale));
  if(right-left<24||bottom-top<24)
    throw new Error('Rosto pequeno demais para recorte seguro.');
  return {left,top,width:right-left,height:bottom-top};
}

/**
 * Crop BEFORE resizing. Upscaling a face from an already downscaled document
 * cannot restore portrait detail, particularly for photos printed on old RGs.
 * EXIF rotation and sRGB conversion match the initial preview normalization.
 * No original, intermediate or cropped image is persisted.
 */
export async function cropFaceAtOriginalResolution(
  uploadedImage:Buffer,
  detectorBox:readonly number[],
  detectorImageSize:ImageSize
):Promise<{pixels:Buffer;nativeFaceWidth:number;nativeFaceHeight:number}>{
  const oriented=await sharp(uploadedImage,{limitInputPixels:20_000_000})
    .rotate().removeAlpha().toColourspace('srgb').png().toBuffer({resolveWithObject:true});
  try{
    const original={width:oriented.info.width,height:oriented.info.height};
    const bounds=originalFaceCropBounds(detectorBox,detectorImageSize,original);
    const cropped=await sharp(oriented.data,{limitInputPixels:20_000_000})
      .extract(bounds)
      .resize({width:512,height:512,fit:'contain',background:{r:255,g:255,b:255}})
      .normalize().sharpen()
      .removeAlpha().toColourspace('srgb')
      .raw().toBuffer({resolveWithObject:true});
    if(cropped.info.width!==512||cropped.info.height!==512||cropped.info.channels!==3){
      cropped.data.fill(0);
      throw new Error('Não foi possível normalizar o recorte facial.');
    }
    return {
      pixels:cropped.data,
      nativeFaceWidth:Math.round(detectorBox[2]*original.width/detectorImageSize.width),
      nativeFaceHeight:Math.round(detectorBox[3]*original.height/detectorImageSize.height)
    };
  }finally{
    oriented.data.fill(0);
  }
}
