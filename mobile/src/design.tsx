import React from 'react';
import {Pressable,StyleSheet,Text,View,type ViewStyle} from 'react-native';
import Svg,{Circle,Defs,LinearGradient,Rect,Stop} from 'react-native-svg';
import {
 Bell,Bookmark,Clapperboard,Compass,Heart,Home,MessageCircle,
 Plus,Search,Settings,Sparkles,UsersRound,
 type LucideIcon
} from 'lucide-react-native';
import {theme as t} from './theme';

export const uiTokens={
 space:{xs:4,sm:8,md:12,lg:16,xl:20,xxl:28},
 radius:{sm:12,md:16,lg:20,xl:24,pill:999},
 shadow:{shadowColor:'#33305C',shadowOpacity:0.065,shadowRadius:17,
  shadowOffset:{width:0,height:7},elevation:2}
} as const;

export function GradientPanel({children,style}:{
 children:React.ReactNode;style?:ViewStyle;
}){
 return <View style={[design.gradient,style]}>
  <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}
   viewBox="0 0 400 215" preserveAspectRatio="xMidYMid slice" accessible={false}>
   <Defs>
    <LinearGradient id="conecta-panel" x1="0" y1="0" x2="1" y2="1">
     <Stop offset="0" stopColor="#8E65FF"/>
     <Stop offset="0.58" stopColor="#6E5DEA"/>
     <Stop offset="1" stopColor="#3AAFD4"/>
    </LinearGradient>
   </Defs>
   <Rect width="400" height="215" fill="url(#conecta-panel)"/>
   <Circle cx="365" cy="-5" r="131" fill="#FFFFFF" fillOpacity="0.11"/>
   <Circle cx="340" cy="184" r="108" fill="#FFFFFF" fillOpacity="0.075"/>
   <Circle cx="92" cy="249" r="128" fill="#FBAACD" fillOpacity="0.15"/>
  </Svg>
  {children}
 </View>;
}

export function Brand({compact=false,light=false}:{
 compact?:boolean;light?:boolean;
}){
 return <View style={design.brand}>
  <View style={[design.brandSymbol,compact&&{height:30,width:30,borderRadius:10}]}>
   <Svg width="100%" height="100%" viewBox="0 0 38 38"
    style={StyleSheet.absoluteFill} accessible={false}>
    <Defs><LinearGradient id="logo" x1="0" y1="0" x2="1" y2="1">
     <Stop offset="0" stopColor="#8C58FF"/><Stop offset="1" stopColor="#49CCF5"/>
    </LinearGradient></Defs>
    <Rect x="0" y="0" width="38" height="38" rx="12" fill="url(#logo)"/>
   </Svg>
   <Sparkles color="#FFFFFF" size={compact?18:22} strokeWidth={2.4}/>
  </View>
  <Text style={[design.brandText,compact&&{fontSize:23},
    light&&{color:'#FFFFFF'}]}>conecta<Text style={{color:t.pink}}>.</Text></Text>
 </View>;
}

export function RoundIcon({Icon,onPress,label,badge=0,active=false,compact=false}:{
 Icon:LucideIcon;onPress:()=>void;label:string;badge?:number;active?:boolean;
 compact?:boolean;
}){
 return <Pressable accessibilityRole="button" accessibilityLabel={label}
  onPress={onPress} hitSlop={7}
  style={[design.roundIcon,compact&&{width:34,height:34,borderRadius:11},
   active&&{backgroundColor:t.subtle,borderColor:'#D9C9FE'}]}>
  <Icon size={compact?18:21} strokeWidth={1.9} color={active?t.primary:t.dark}/>
  {badge>0&&<View style={design.badge}>
   <Text style={design.badgeText}>{badge>99?'99+':badge}</Text>
  </View>}
 </Pressable>;
}

type TabItem={key:string;label:string;Icon:LucideIcon};
export const nativeTabs:TabItem[]=[
 {key:'feed',label:'Início',Icon:Home},
 {key:'connections',label:'Explorar',Icon:Compass},
 {key:'create',label:'Publicar',Icon:Plus},
 {key:'communities',label:'Grupos',Icon:UsersRound},
 {key:'profile',label:'Perfil',Icon:Settings}
];
export function BottomNavigation({tab,onNavigate}:{
 tab:string;onNavigate:(key:string)=>void;
}){
 return <View style={design.nav} accessibilityRole="tablist">
  {nativeTabs.map(({key,label,Icon})=>{
   const selected=key===tab&&key!=='create';
   if(key==='create')return <Pressable key={key} accessibilityRole="button"
    accessibilityLabel="Criar publicação" onPress={()=>onNavigate(key)}
    style={design.createTab}>
    <View style={design.createSymbol}>
     <Plus color="#FFFFFF" size={27} strokeWidth={2.4}/>
    </View>
    <Text style={design.createLabel}>Publicar</Text>
   </Pressable>;
   return <Pressable key={key} accessibilityRole="tab"
    accessibilityLabel={label} accessibilityState={{selected}}
    onPress={()=>onNavigate(key)} style={design.navItem}>
    <View style={[design.navIcon,selected&&design.navIconActive]}>
     <Icon size={22} color={selected?t.primary:'#909AB0'}
      strokeWidth={selected?2.4:1.9} fill={selected&&key==='feed'?t.subtle:'none'}/>
    </View>
    <Text numberOfLines={1} style={[design.navLabel,selected&&design.navLabelActive]}>
     {label}
    </Text>
   </Pressable>;
  })}
 </View>;
}

export function SectionEyebrow({children}:{
 children:React.ReactNode;
}){
 return <Text style={design.eyebrow}>{children}</Text>;
}
export function SectionHeader({title,description,Icon,action,onAction}:{
 title:string;description?:string;Icon?:LucideIcon;action?:string;onAction?:()=>void;
}){
 return <View style={design.sectionHeader}>
  <View style={{flex:1,gap:3}}>
   <View style={{flexDirection:'row',alignItems:'center',gap:7}}>
    {Icon&&<Icon size={20} strokeWidth={2} color={t.primary}/>}
    <Text style={design.sectionTitle}>{title}</Text>
   </View>
   {!!description&&<Text style={design.sectionDescription}>{description}</Text>}
  </View>
  {!!action&&!!onAction&&<Pressable accessibilityRole="button" onPress={onAction}>
   <Text style={design.actionLink}>{action}</Text>
  </Pressable>}
 </View>;
}

export function FeedTabs({selected,onSelect}:{
 selected:'all'|'saved';onSelect:(value:'all'|'saved')=>void;
}){
 return <View style={design.feedTabs} accessibilityRole="tablist">
  {([
   {key:'all',label:'Para você',Icon:Heart},
   {key:'saved',label:'Salvos',Icon:Bookmark}
  ] as const).map(({key,label,Icon})=><Pressable key={key} accessibilityRole="tab"
   accessibilityLabel={label} accessibilityState={{selected:selected===key}}
   style={[design.feedTab,selected===key&&design.feedTabSelected]}
   onPress={()=>onSelect(key)}>
   <Icon size={17} strokeWidth={2} color={selected===key?t.primary:t.muted}/>
   <Text style={[design.feedTabLabel,selected===key&&{color:t.primary}]}>
    {label}
   </Text>
  </Pressable>)}
 </View>;
}

const design=StyleSheet.create({
 gradient:{borderRadius:23,overflow:'hidden',padding:21,minHeight:144,
  justifyContent:'center',backgroundColor:t.primary},
 brand:{flexDirection:'row',alignItems:'center',gap:7},
 brandSymbol:{height:38,width:38,borderRadius:12,overflow:'hidden',
  justifyContent:'center',alignItems:'center'},
 brandText:{fontWeight:'900',fontSize:26,color:t.dark,letterSpacing:-1.3},
 roundIcon:{width:40,height:40,borderWidth:1,borderColor:t.line,
  borderRadius:13,backgroundColor:'#FFFFFF',justifyContent:'center',
  alignItems:'center'},
 badge:{position:'absolute',top:-7,right:-6,minWidth:18,height:18,
  borderRadius:9,paddingHorizontal:3,justifyContent:'center',alignItems:'center',
  backgroundColor:t.pink,borderWidth:2,borderColor:'#FFFFFF'},
 badgeText:{fontSize:9,fontWeight:'800',color:'#FFFFFF'},
 nav:{backgroundColor:'#FFFFFF',borderTopWidth:1,borderTopColor:t.line,
  flexDirection:'row',alignItems:'center',justifyContent:'space-around',
  minHeight:69,paddingHorizontal:5,paddingBottom:4},
 navItem:{flex:1,minWidth:0,alignItems:'center',justifyContent:'center',
  paddingVertical:7,gap:2},
 navIcon:{height:32,minWidth:46,justifyContent:'center',alignItems:'center',
  borderRadius:12},
 navIconActive:{backgroundColor:t.subtle},
 navLabel:{fontSize:10,fontWeight:'600',color:'#909AB0'},
 navLabelActive:{fontWeight:'800',color:t.primary},
 createTab:{flex:1,minWidth:0,alignItems:'center',justifyContent:'center',gap:2,
  paddingVertical:3},
 createSymbol:{width:49,height:49,borderRadius:17,backgroundColor:t.primary,
  alignItems:'center',justifyContent:'center',marginTop:-17,
  borderWidth:4,borderColor:'#FFFFFF',shadowColor:t.primary,
  shadowOpacity:0.24,shadowRadius:9,shadowOffset:{width:0,height:4},elevation:4},
 createLabel:{fontSize:10,fontWeight:'800',color:t.primary},
 eyebrow:{fontSize:10,letterSpacing:1.2,fontWeight:'800',color:t.primary},
 sectionHeader:{flexDirection:'row',alignItems:'center',
  justifyContent:'space-between',gap:12,marginTop:14,marginBottom:10},
 sectionTitle:{fontSize:19,fontWeight:'800',letterSpacing:-0.55,color:t.dark},
 sectionDescription:{color:t.muted,fontSize:12,lineHeight:18},
 actionLink:{fontSize:12,color:t.primary,fontWeight:'800'},
 feedTabs:{flexDirection:'row',gap:16,borderBottomWidth:1,
  borderBottomColor:t.line,marginTop:8,marginBottom:8},
 feedTab:{paddingHorizontal:6,paddingVertical:13,
  flexDirection:'row',alignItems:'center',gap:7,borderBottomWidth:2,
  borderBottomColor:'transparent'},
 feedTabSelected:{borderBottomColor:t.primary},
 feedTabLabel:{fontSize:13,fontWeight:'700',color:t.muted}
});
