import React,{useEffect,useRef,useState} from 'react';
import {Pressable,Text,TextInput,View,type StyleProp,type TextStyle} from 'react-native';
import {AtSign} from 'lucide-react-native';
import {supabase} from './supabase';
import {theme as t} from './theme';
import {styles as s} from './ui';

type MentionPerson={id:string;handle:string;display_name:string};
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
export function MentionInput({value,onChangeText,placeholder,maxLength=3000,
 multiline=true,style,accessibilityLabel}:{
 value:string;onChangeText:(next:string)=>void;placeholder:string;
 maxLength?:number;multiline?:boolean;style?:StyleProp<TextStyle>;
 accessibilityLabel?:string;
}){
 const input=useRef<TextInput|null>(null);
 const [cursor,setCursor]=useState(value.length);
 const [people,setPeople]=useState<MentionPerson[]>([]);
 const mention=activeMention(value,cursor);
 const query=mention?.query||'';
 useEffect(()=>{
  let alive=true;
  if(!mention||query.length<2){setPeople([]);return()=>{alive=false;};}
  const wait=setTimeout(async()=>{
   try{
    const {data,error}=await supabase.from('profiles')
     .select('id,handle,display_name')
     .ilike('handle',query+'%').limit(6);
    if(alive)setPeople(error?[]:(data||[]) as MentionPerson[]);
   }catch{if(alive)setPeople([]);}
  },220);
  return()=>{alive=false;clearTimeout(wait);};
 },[query,Boolean(mention)]);
 const choose=(person:MentionPerson)=>{
  const next=replaceMention(value,cursor,person.handle,maxLength);
  onChangeText(next);setCursor(next.length);setPeople([]);
  input.current?.focus();
 };
 return <View style={{flex:1,minWidth:0}}>
  <TextInput ref={input} accessibilityLabel={accessibilityLabel||placeholder}
   value={value} onChangeText={text=>{onChangeText(text);setCursor(text.length);}}
   onSelectionChange={event=>setCursor(event.nativeEvent.selection.start)}
   placeholder={placeholder} placeholderTextColor={t.muted}
   maxLength={maxLength} multiline={multiline}
   style={style||[s.input,multiline&&{minHeight:95,textAlignVertical:'top'}]}/>
  {people.length>0&&mention&&<View accessibilityRole="list"
   style={{padding:9,borderWidth:1,borderColor:'#DED5FE',
    backgroundColor:t.surface,borderRadius:12,marginVertical:5,gap:3}}>
   <View style={[s.row,{gap:5,marginBottom:4}]}>
    <AtSign size={15} color={t.primary}/>
    <Text style={s.muted}>Marcar pessoa</Text>
   </View>
   {people.map(person=><Pressable key={person.id}
    accessibilityRole="button" accessibilityLabel={'Marcar '+person.handle}
    onPress={()=>choose(person)}
    style={{paddingVertical:9,paddingHorizontal:8,borderRadius:10,
     borderBottomWidth:1,borderBottomColor:t.line}}>
    <Text style={[s.primaryText,{color:t.primary}]}>@{person.handle}</Text>
    <Text style={s.muted} numberOfLines={1}>{person.display_name}</Text>
   </Pressable>)}
  </View>}
 </View>;
}
