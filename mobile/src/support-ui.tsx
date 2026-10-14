import React,{useEffect,useState} from 'react';
import {Alert,Linking,Pressable,ScrollView,Text,View} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {BookOpen,ExternalLink,HeartHandshake,Leaf,MessageCircle,School,ShieldCheck,Users} from 'lucide-react-native';
import {Action,Heading,styles as s} from './ui';
import {theme as t} from './theme';

const CALM_KEY='conecta-calm-mode';
const resources=[
 {name:'Guia de Direitos de Acessibilidade',source:'Ministério dos Direitos Humanos',url:'https://www.gov.br/mdh/pt-br/navegue-por-temas/pessoa-com-deficiencia/publicacoes/guia-pratico-de-direitos-de-acessibilidade'},
 {name:'Atendimento Educacional Especializado (AEE)',source:'Inep / Ministério da Educação',url:'https://www.gov.br/inep/pt-br/acesso-a-informacao/perguntas-frequentes/censo-escolar/educacao-especial/o-que-e-o-atendimento'},
 {name:'Publicações sobre direitos das pessoas com deficiência',source:'Ministério dos Direitos Humanos',url:'https://www.gov.br/mdh/pt-br/navegue-por-temas/pessoa-com-deficiencia/publicacoes'}
] as const;
const topics=[
 {title:'Uma rede de acolhimento',subtitle:'Falar sem julgamentos',text:'Compartilhe o que faz sentido para você. Também está tudo bem só acompanhar as conversas.',Icon:HeartHandshake},
 {title:'Rotinas e estratégias',subtitle:'Trocar experiências',text:'Conte o que ajudou sua família, respeitando que cada pessoa e cada contexto são diferentes.',Icon:Leaf},
 {title:'Escola e inclusão',subtitle:'Informação e diálogo',text:'Converse sobre comunicação com escolas e práticas inclusivas sem expor dados de crianças.',Icon:School},
 {title:'Cuidado de quem cuida',subtitle:'Rede de apoio',text:'Reconheça seu próprio descanso, limites e necessidades. Nenhuma família precisa ser perfeita.',Icon:Users}
] as const;

export function SupportScreen({onCommunity,onConnections}:{onCommunity:()=>void;onConnections:()=>void}){
 const [calm,setCalm]=useState(false),[ready,setReady]=useState(false);
 useEffect(()=>{let alive=true;void AsyncStorage.getItem(CALM_KEY).then(value=>{if(alive){setCalm(value==='1');setReady(true);}}).catch(()=>{if(alive)setReady(true);});return()=>{alive=false;};},[]);
 const toggleCalm=async()=>{
  const next=!calm;setCalm(next);
  try{await AsyncStorage.setItem(CALM_KEY,next?'1':'0');}
  catch{Alert.alert('Preferência não salva','O modo calmo está ativo nesta tela, mas não foi possível guardar a preferência no dispositivo.');}
 };
 const openResource=async(url:string)=>{
  try{await Linking.openURL(url);}catch{Alert.alert('Link indisponível','Não foi possível abrir este recurso neste dispositivo.');}
 };
 return <ScrollView style={s.screen} contentContainerStyle={{paddingBottom:28}}>
  <Heading title="Acolhimento e inclusão" subtitle="Um espaço para mães atípicas, famílias, cuidadores e redes de apoio."/>
  <View style={{backgroundColor:calm?'#F0EFF6':t.primaryDark,borderRadius:23,padding:21,gap:12}}>
   <HeartHandshake color="#FFFFFF" size={30}/>
   <Text style={{fontSize:23,lineHeight:29,fontWeight:'900',color:calm?t.dark:'#FFFFFF'}}>Você não precisa passar por tudo sozinha.</Text>
   <Text style={{fontSize:14,lineHeight:21,color:calm?t.dark:'#F0EAFE'}}>Escuta respeitosa, troca de experiências e informação pública confiável. Não é necessário revelar diagnósticos nem informações pessoais.</Text>
   <Action fullWidth label="Participar da comunidade de apoio" onPress={onCommunity}/>
   <Action fullWidth secondary label="Encontrar conexões" leading={<MessageCircle color={t.primary} size={17}/>} onPress={onConnections}/>
  </View>
  <View style={[s.row,{justifyContent:'space-between',marginTop:20,marginBottom:10}]}>
   <Text style={[s.title,{flex:1,fontSize:20}]}>O que você encontra aqui</Text>
   <Pressable accessibilityRole="switch" accessibilityState={{checked:calm}} accessibilityLabel="Modo calmo, menos estímulos visuais"
    disabled={!ready} onPress={()=>void toggleCalm()}
    style={{paddingHorizontal:12,paddingVertical:9,borderRadius:14,borderWidth:1,borderColor:calm?t.primary:t.line,backgroundColor:calm?t.subtle:'#FFFFFF'}}>
    <Text style={{fontSize:12,fontWeight:'800',color:calm?t.primary:t.dark}}>{calm?'Modo calmo: ligado':'Modo calmo: desligado'}</Text>
   </Pressable>
  </View>
  {calm&&<Text style={[s.muted,{marginBottom:10}]}>Preferência salva neste aparelho. Nesta área, o modo calmo prioriza cartões simples e conteúdo sem movimento decorativo.</Text>}
  {topics.map(({title,subtitle,text,Icon})=><View key={title} style={[s.card,{marginBottom:9,gap:7}]}>
   <View style={[s.row,{gap:9}]}>
    <View style={{backgroundColor:t.subtle,borderRadius:12,padding:9}}><Icon color={t.primary} size={22}/></View>
    <View style={{flex:1}}>
     <Text style={[s.muted,{fontSize:10,fontWeight:'800',textTransform:'uppercase'}]}>{subtitle}</Text>
     <Text style={s.primaryText}>{title}</Text>
    </View>
   </View>
   <Text style={s.sub}>{text}</Text>
  </View>)}
  <View style={s.card}>
   <View style={[s.row,{gap:8,marginBottom:7}]}><BookOpen color={t.primary} size={21}/><Text style={s.title}>Fontes públicas de informação</Text></View>
   <Text style={[s.muted,{marginBottom:8}]}>Informação geral não substitui atendimento profissional ou orientação jurídica individualizada.</Text>
   {resources.map(resource=><Pressable key={resource.url} accessibilityRole="link" onPress={()=>void openResource(resource.url)}
    style={[s.row,{paddingVertical:12,borderTopWidth:1,borderTopColor:t.line,gap:10}]}>
    <View style={{flex:1,gap:3}}><Text style={s.primaryText}>{resource.name}</Text><Text style={s.muted}>{resource.source}</Text></View>
    <ExternalLink color={t.primary} size={18}/>
   </Pressable>)}
  </View>
  <View style={s.card}>
   <View style={[s.row,{gap:8,marginBottom:8}]}><ShieldCheck color={t.primary} size={21}/><Text style={s.title}>Proteja sua privacidade</Text></View>
   <Text style={s.sub}>Evite publicar laudos, documentos, nomes de escolas, horários detalhados ou imagens identificáveis de crianças. Peça autorização antes de compartilhar histórias de terceiros.</Text>
   <Text style={[s.sub,{marginTop:8}]}>Denuncie exposição indevida, capacitismo, golpes ou promessas de tratamento milagroso. O apoio entre pares não substitui serviços de saúde ou públicos.</Text>
  </View>
 </ScrollView>;
}
