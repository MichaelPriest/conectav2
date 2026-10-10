import React,{useEffect,useState} from 'react';
import {Image,Modal,Platform,Pressable,ScrollView,Text,useWindowDimensions,View} from 'react-native';
import {StatusBar} from 'expo-status-bar';
import {NavigationBar} from 'expo-navigation-bar';
import {SafeAreaProvider,SafeAreaView} from 'react-native-safe-area-context';
import {ChevronLeft,ChevronRight,Maximize2,Minimize2,X} from 'lucide-react-native';
import {signedMedia} from './data';
import {Media} from './ui';

export function MediaGallery({paths}:{paths:string[]}){
 const {width,height}=useWindowDimensions();
 const [active,setActive]=useState<number|null>(null);
 const [url,setUrl]=useState<string|null>(null),[zoomed,setZoomed]=useState(false);
 useEffect(()=>{
  let alive=true;setUrl(null);setZoomed(false);
  if(active!==null&&paths[active])
   void signedMedia(paths[active]).then(value=>{if(alive)setUrl(value);});
  return()=>{alive=false;};
 },[active,paths.join('|')]);
 const change=(offset:number)=>{
  if(active===null)return;
  setActive(Math.max(0,Math.min(paths.length-1,active+offset)));
 };
 const close=()=>{setActive(null);setUrl(null);setZoomed(false);};
 const list=paths.filter(Boolean);
 if(!list.length)return null;
 return <View style={{flexDirection:'row',flexWrap:'wrap',
  justifyContent:'space-between',marginTop:7}}>
  {list.map((path,index)=><Media key={path+index} path={path}
   height={list.length===1?270:171} width={list.length===1?'100%':'48%'}
   radius={13} marginTop={7} onPress={()=>setActive(index)}/>)}
  <Modal visible={active!==null} animationType="fade" onRequestClose={close}>
   <SafeAreaProvider>
    <SafeAreaView edges={['top','bottom','left','right']}
     style={{flex:1,backgroundColor:'#0C1020'}}>
     <StatusBar style="light" hidden={Platform.OS==='android'}/>
     {Platform.OS==='android'&&<NavigationBar hidden style="dark"/>}
     <View style={{flexDirection:'row',justifyContent:'space-between',
      alignItems:'center',paddingHorizontal:18,paddingTop:12,paddingBottom:13}}>
      <Text style={{color:'#FFFFFF',fontWeight:'800',fontSize:15}}>
       {active===null?'Galeria':(active+1)+' de '+list.length}
      </Text>
      <Pressable onPress={close} accessibilityRole="button"
       accessibilityLabel="Fechar imagem">
       <X size={26} color="#FFFFFF"/>
      </Pressable>
     </View>
     <ScrollView maximumZoomScale={3} minimumZoomScale={1}
      contentContainerStyle={{flexGrow:1,justifyContent:'center',alignItems:'center'}}
      horizontal={zoomed} showsHorizontalScrollIndicator={zoomed}
      showsVerticalScrollIndicator={false}>
      {url?<Image source={{uri:url}} resizeMode="contain"
       accessibilityLabel="Imagem ampliada da publicação"
       style={{width:zoomed?width*1.6:width,
        height:Math.max(250,height*0.67)}}/>:
       <Text style={{color:'#D7D6E4'}}>Carregando imagem autorizada...</Text>}
     </ScrollView>
     <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-around',
      paddingBottom:23,paddingTop:15,gap:15,paddingHorizontal:15}}>
      <Pressable accessibilityRole="button" accessibilityLabel="Imagem anterior"
       disabled={active===0} onPress={()=>change(-1)}
       style={{padding:10,opacity:active===0?0.3:1}}>
       <ChevronLeft size={30} color="#FFFFFF"/>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={zoomed?'Reduzir imagem':'Ampliar imagem'}
       onPress={()=>setZoomed(old=>!old)} style={{padding:10}}>
       {zoomed?<Minimize2 size={24} color="#FFFFFF"/>:
        <Maximize2 size={24} color="#FFFFFF"/>}
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Próxima imagem"
       disabled={active===list.length-1} onPress={()=>change(1)}
       style={{padding:10,opacity:active===list.length-1?0.3:1}}>
       <ChevronRight size={30} color="#FFFFFF"/>
      </Pressable>
     </View>
    </SafeAreaView>
   </SafeAreaProvider>
  </Modal>
 </View>;
}
