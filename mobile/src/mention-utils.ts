export function activeMention(text:string,position:number):{start:number;query:string}|null{
 const prefix=text.slice(0,Math.max(0,Math.min(position,text.length)));
 const match=prefix.match(/(^|\s)@([a-z0-9_]{1,30})$/i);
 if(!match)return null;
 return {start:prefix.length-match[2].length-1,query:match[2].toLowerCase()};
}
export function replaceMention(
 text:string,position:number,handle:string,maxLength=3000
):string{
 const found=activeMention(text,position);
 if(!found||!/^[a-z0-9_]{3,30}$/i.test(handle))return text;
 const replacement='@'+handle+' ';
 return (text.slice(0,found.start)+replacement+text.slice(position)).slice(0,maxLength);
}
