import sharp from 'sharp';

/**
 * Fallback preprocessing for an old Brazilian RG. Split the already-oriented
 * image into two overlapping landscape regions, so the birth-date field does
 * not compete with the rest of the printed document during Tesseract OCR.
 * Only transient buffers are returned; no text or document is stored.
 */
export async function prepareBirthDateOcrRegions(image:Buffer):Promise<Buffer[]>{
  const metadata=await sharp(image,{limitInputPixels:20_000_000}).metadata();
  const width=metadata.width||0,height=metadata.height||0;
  if(width<400||height<250)return [];
  const mid=Math.floor(width*0.35);
  const regions=[
    {left:0,top:0,width:width-mid,height},
    {left:mid,top:0,width:width-mid,height}
  ];
  const results:Buffer[]=[];
  try{
    for(const region of regions){
      const normalized=await sharp(image,{limitInputPixels:20_000_000})
        .extract(region)
        .resize({width:2200,height:1800,fit:'inside'})
        .greyscale().normalize().sharpen().png().toBuffer();
      results.push(normalized);
    }
    return results;
  }catch(error){
    for(const item of results)item.fill(0);
    throw error;
  }
}
