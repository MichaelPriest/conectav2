import React,{useCallback,useEffect,useState} from 'react';
import {Pressable,Text,TextInput,View} from 'react-native';
import {BarChart3,CheckCircle2,Clock3,Plus,Trash2} from 'lucide-react-native';
import {Action,ErrorNotice,styles as s} from './ui';
import {theme as t} from './theme';
import {castPollVote,loadPoll} from './polls';
import type {PollData} from './polls';

const describe=(e:unknown)=>e instanceof Error?e.message:'Não foi possível atualizar a enquete.';
export function PollDraft({question,options,onOptionsChange,days,onDaysChange}:{
 question:string;options:string[];onOptionsChange:(options:string[])=>void;
 days:number;onDaysChange:(days:number)=>void;
}){
 return <View style={{backgroundColor:t.bg,borderRadius:17,padding:14,
  borderWidth:1,borderColor:t.line,gap:9,marginVertical:10}}>
  <View style={[s.row,{gap:7}]}>
   <BarChart3 color={t.primary} size={19}/>
   <Text style={s.primaryText}>Nova enquete</Text>
  </View>
  <Text style={s.muted}>Faça a pergunta no texto da publicação e inclua de 2 a 6 opções.</Text>
  {options.map((option,index)=><View key={index} style={[s.row,{gap:7}]}>
   <Text style={[s.muted,{width:15}]}>{index+1}.</Text>
   <TextInput value={option}
    accessibilityLabel={'Opção '+(index+1)} maxLength={120}
    onChangeText={text=>onOptionsChange(options.map((item,i)=>index===i?text:item))}
    placeholder={'Opção '+(index+1)} placeholderTextColor={t.muted}
    style={[s.input,{flex:1,minHeight:43,marginVertical:2}]}/>
   {options.length>2&&<Pressable accessibilityRole="button"
    accessibilityLabel={'Remover opção '+(index+1)}
    onPress={()=>onOptionsChange(options.filter((_,i)=>i!==index))}>
    <Trash2 color={t.muted} size={18}/>
   </Pressable>}
  </View>)}
  {options.length<6&&<Action secondary label="Adicionar opção"
   leading={<Plus size={16} color={t.primary}/>}
   onPress={()=>onOptionsChange([...options,''])}/>}
  <Text style={[s.primaryText,{marginTop:6}]}>Encerramento da enquete</Text>
  <View style={[s.row,{gap:7,flexWrap:'wrap'}]}>
   {([1,3,7,14] as const).map(day=><Pressable key={day}
    accessibilityRole="radio" accessibilityState={{checked:days===day}}
    onPress={()=>onDaysChange(day)}
    style={[s.secondary,days===day&&{backgroundColor:t.primary}]}>
    <Text style={[s.secondaryText,days===day&&{color:'#FFF'}]}>
     {day} {day===1?'dia':'dias'}
    </Text>
   </Pressable>)}
  </View>
  <Text style={s.muted}>{question.trim().length}/250 caracteres na pergunta</Text>
 </View>;
}
export function PollCard({postId,userId}:{postId:string;userId:string}){
 const [poll,setPoll]=useState<PollData|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const refresh=useCallback(async()=>{
  try{setPoll(await loadPoll(postId,userId));setError('');}
  catch(e){setError(describe(e));}
  finally{setLoading(false);}
 },[postId,userId]);
 useEffect(()=>{void refresh();},[refresh]);
 if(loading)return null;
 if(!poll)return error?<ErrorNotice text={error}/>:null;
 const expired=Date.parse(poll.poll.closes_at)<=Date.now();
 const votes=poll.options.reduce((count,opt)=>count+(poll.totals[opt.id]||0),0);
 const showResults=Boolean(poll.selected)||expired;
 const vote=async(id:string)=>{
  if(busy||poll.selected||expired||poll.options.length<2)return;
  setBusy(true);setError('');
  try{await castPollVote(postId,userId,id);await refresh();}
  catch(e){setError(describe(e));}
  finally{setBusy(false);}
 };
 return <View style={{marginTop:13,borderRadius:16,padding:15,
  borderWidth:1,borderColor:'#DCD6F9',backgroundColor:'#FAF8FF',gap:9}}>
  <View style={[s.row,{gap:7,marginBottom:5}]}>
   <BarChart3 size={18} color={t.primary}/>
   <Text style={[s.primaryText,{fontSize:15,flex:1}]}>{poll.poll.question}</Text>
  </View>
  {poll.options.map(opt=>{
   const count=poll.totals[opt.id]||0;
   const percent=votes?Math.round(count*100/votes):0;
   const mine=poll.selected===opt.id;
   return <Pressable key={opt.id} accessibilityRole="button"
    accessibilityLabel={'Votar em '+opt.label}
    accessibilityState={{disabled:busy||showResults,selected:mine}}
    disabled={busy||showResults}
    onPress={()=>void vote(opt.id)} style={{minHeight:46,overflow:'hidden',
     backgroundColor:'#FFF',borderRadius:11,borderWidth:1,
     borderColor:mine?t.primary:t.line,
     justifyContent:'center',paddingHorizontal:12}}>
    {showResults&&<View style={{position:'absolute',left:0,top:0,bottom:0,
     width:`${percent}%` as `${number}%`,backgroundColor:mine?'#DCD0FF':'#EEE8FF'}}/>}
    <View style={[s.row,{justifyContent:'space-between',gap:6}]}>
     <View style={[s.row,{flex:1,gap:5}]}>
      <Text style={{fontSize:13,color:t.dark,fontWeight:mine?'900':'600'}}>
       {opt.label}
      </Text>
      {mine&&<CheckCircle2 size={15} color={t.primary}/>}
     </View>
     {showResults&&<Text style={{fontSize:12,fontWeight:'800',color:t.primary}}>
      {percent}%
     </Text>}
    </View>
   </Pressable>;
  })}
  <View style={[s.row,{justifyContent:'space-between',gap:8,marginTop:5}]}>
   <Text style={s.muted}>{votes} {votes===1?'voto':'votos'}</Text>
   <View style={[s.row,{gap:5}]}>
    <Clock3 size={13} color={t.muted}/>
    <Text style={s.muted}>{expired?'Enquete encerrada':
     'Até '+new Date(poll.poll.closes_at).toLocaleDateString('pt-BR')}</Text>
   </View>
  </View>
  <ErrorNotice text={error}/>
 </View>;
}
