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


/**
 * São Paulo legacy RG: on landscape copies the birth label/date are often
 * printed next to each other in the middle of one side of the card.
 * Full-card OCR can reorder two-column text. Narrow, overlapping ROIs keep
 * the label and date on the same OCR page while removing unrelated fields.
 *
 * These are only optional, server-side preprocessing candidates. Their
 * coordinates are not accepted from the browser and an unlabelled date is
 * never promoted to a verified date of birth.
 */
export async function prepareBirthDateOcrFocusPanels(image:Buffer):Promise<Buffer[]>{
  const metadata=await sharp(image,{limitInputPixels:20_000_000}).metadata();
  const width=metadata.width||0,height=metadata.height||0;
  if(width<400||height<250)return [];
  const left=Math.floor(width*0.40);
  const top=Math.floor(height*0.20);
  const right=Math.min(width,Math.ceil(width*0.985));
  const bottom=Math.min(height,Math.ceil(height*0.79));
  const otherLeft=Math.floor(width*0.015);
  const otherRight=Math.min(width,Math.ceil(width*0.60));
  const crops=[
    {left,top,width:right-left,height:bottom-top},
    {left:otherLeft,top,width:otherRight-otherLeft,height:bottom-top}
  ];
  const results:Buffer[]=[];
  try{
    for(const crop of crops){
      const pixels=await sharp(image,{limitInputPixels:20_000_000})
        .extract(crop)
        .resize({width:1800,height:1400,fit:'inside'})
        .normalize().sharpen()
        .png().toBuffer();
      results.push(pixels);
    }
    return results;
  }catch(error){
    for(const item of results)item.fill(0);
    throw error;
  }
}
