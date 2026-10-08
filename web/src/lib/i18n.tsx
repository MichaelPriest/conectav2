'use client';
import {createContext,useContext,useEffect,useState} from 'react';
export const localeNames={
 'pt-BR':'Português (Brasil)','en':'English','es':'Español','fr':'Français',
 'de':'Deutsch','it':'Italiano','zh-CN':'简体中文','hi':'हिन्दी',
 'ar':'العربية','ja':'日本語'
} as const;
export type Locale=keyof typeof localeNames;
type MessageKey='home'|'explore'|'reels'|'communities'|'connections'|'notifications'|'messages'|'profile'|'post'|'search'|'discover'|'noteTitle'|'noteBody'|'logout'|'light'|'dark'|'language'|'login'|'signup'|'email'|'password'|'yourName'|'forgot'|'welcomeBack'|'joinUs'|'welcomeSubtitle'|'signupSubtitle'|'submitLogin'|'submitSignup'|'busy'|'heroTitle'|'heroSubtitle'|'returnHome'|'feed'|'settings'|'save'|'community';
const pt:Record<MessageKey,string>={
 home:'Início',explore:'Explorar',reels:'Reels',communities:'Comunidades',
 connections:'Conexões',notifications:'Notificações',messages:'Mensagens',
 profile:'Perfil',post:'Publicar',search:'Buscar pessoas, comunidades e conteúdos...',
 discover:'Conhecer comunidades →',noteTitle:'Conexões que importam.',noteBody:'Um espaço feito para compartilhar e pertencer.',
 logout:'Sair da conta',light:'Usar tema claro',dark:'Usar tema escuro',language:'Idioma',
 login:'Entrar',signup:'Criar conta',email:'E-mail',password:'Senha',yourName:'Seu nome',
 forgot:'Esqueceu sua senha?',welcomeBack:'Que bom ter você de volta!',joinUs:'Sua história começa agora.',
 welcomeSubtitle:'Entre para reencontrar suas pessoas e suas comunidades.',
 signupSubtitle:'Crie sua conta e venha compartilhar o que te inspira.',
 submitLogin:'Entrar no Conecta',submitSignup:'Criar minha conta',busy:'Aguarde...',
 heroTitle:'Boas histórias começam aqui.',heroSubtitle:'Conecte-se com pessoas, descubra novas ideias e encontre seu lugar em comunidades que inspiram.',
 returnHome:'Voltar ao início',feed:'Feed',settings:'Configurações',save:'Salvar',community:'Comunidade'
};
const translations:Record<Locale,Partial<Record<MessageKey,string>>>={
 'pt-BR':pt,
 en:{home:'Home',explore:'Explore',reels:'Reels',communities:'Communities',connections:'Connections',notifications:'Notifications',messages:'Messages',profile:'Profile',post:'Create',search:'Search people, communities and posts...',discover:'Explore communities →',noteTitle:'Connections that matter.',noteBody:'A space to share and belong.',logout:'Log out',light:'Light mode',dark:'Dark mode',language:'Language',login:'Log in',signup:'Sign up',email:'Email',password:'Password',yourName:'Your name',forgot:'Forgot your password?',welcomeBack:'Welcome back!',joinUs:'Your story begins here.',welcomeSubtitle:'Sign in to reconnect with people and communities.',signupSubtitle:'Create your account and share what inspires you.',submitLogin:'Log in to Conecta',submitSignup:'Create my account',busy:'Please wait...',heroTitle:'Great stories begin here.',heroSubtitle:'Connect with people, discover ideas, and find your place.',returnHome:'Back to home',feed:'Feed',settings:'Settings',save:'Save',community:'Community'},
 es:{home:'Inicio',explore:'Explorar',reels:'Reels',communities:'Comunidades',connections:'Conexiones',notifications:'Notificaciones',messages:'Mensajes',profile:'Perfil',post:'Publicar',search:'Buscar personas, comunidades y publicaciones...',discover:'Descubrir comunidades →',noteTitle:'Conexiones que importan.',noteBody:'Un espacio para compartir y pertenecer.',logout:'Cerrar sesión',light:'Tema claro',dark:'Tema oscuro',language:'Idioma',login:'Entrar',signup:'Crear cuenta',email:'Correo electrónico',password:'Contraseña',yourName:'Tu nombre',forgot:'¿Olvidaste tu contraseña?',welcomeBack:'¡Qué bueno verte de nuevo!',joinUs:'Tu historia comienza aquí.',welcomeSubtitle:'Entra para reencontrar tus personas y comunidades.',signupSubtitle:'Crea tu cuenta y comparte lo que te inspira.',submitLogin:'Entrar en Conecta',submitSignup:'Crear mi cuenta',busy:'Espera...',heroTitle:'Las grandes historias comienzan aquí.',heroSubtitle:'Conecta con personas, descubre ideas y encuentra tu lugar.',returnHome:'Volver al inicio',settings:'Configuración',save:'Guardar'},
 fr:{home:'Accueil',explore:'Explorer',reels:'Reels',communities:'Communautés',connections:'Relations',notifications:'Notifications',messages:'Messages',profile:'Profil',post:'Publier',search:'Rechercher des personnes et communautés...',discover:'Explorer les communautés →',noteTitle:'Des liens qui comptent.',noteBody:'Un espace pour partager et appartenir.',logout:'Déconnexion',light:'Mode clair',dark:'Mode sombre',language:'Langue',login:'Connexion',signup:'Créer un compte',email:'E-mail',password:'Mot de passe',yourName:'Votre nom',forgot:'Mot de passe oublié ?',welcomeBack:'Heureux de vous revoir !',joinUs:'Votre histoire commence ici.',welcomeSubtitle:'Retrouvez vos proches et vos communautés.',signupSubtitle:'Créez un compte et partagez vos passions.',submitLogin:'Se connecter à Conecta',submitSignup:'Créer mon compte',busy:'Patientez...',heroTitle:'Les belles histoires commencent ici.',heroSubtitle:'Rencontrez des personnes, découvrez des idées.',returnHome:'Retour à l’accueil',save:'Enregistrer'},
 de:{home:'Startseite',explore:'Entdecken',reels:'Reels',communities:'Communitys',connections:'Kontakte',notifications:'Benachrichtigungen',messages:'Nachrichten',profile:'Profil',post:'Beitrag',search:'Personen und Communitys suchen...',discover:'Communitys entdecken →',noteTitle:'Verbindungen, die zählen.',noteBody:'Ein Ort zum Teilen und Dazugehören.',logout:'Abmelden',light:'Hell',dark:'Dunkel',language:'Sprache',login:'Anmelden',signup:'Registrieren',email:'E-Mail',password:'Passwort',yourName:'Dein Name',forgot:'Passwort vergessen?',welcomeBack:'Willkommen zurück!',joinUs:'Deine Geschichte beginnt hier.',welcomeSubtitle:'Verbinde dich wieder mit Menschen und Gruppen.',signupSubtitle:'Erstelle ein Konto und teile deine Interessen.',submitLogin:'Bei Conecta anmelden',submitSignup:'Konto erstellen',busy:'Bitte warten...',heroTitle:'Hier beginnen gute Geschichten.',heroSubtitle:'Menschen kennenlernen und Ideen entdecken.',returnHome:'Zur Startseite',save:'Speichern'},
 it:{home:'Home',explore:'Esplora',reels:'Reels',communities:'Community',connections:'Connessioni',notifications:'Notifiche',messages:'Messaggi',profile:'Profilo',post:'Pubblica',search:'Cerca persone e community...',discover:'Esplora le community →',noteTitle:'Connessioni importanti.',noteBody:'Uno spazio per condividere e appartenere.',logout:'Esci',light:'Tema chiaro',dark:'Tema scuro',language:'Lingua',login:'Accedi',signup:'Crea account',email:'E-mail',password:'Password',yourName:'Il tuo nome',forgot:'Password dimenticata?',welcomeBack:'Bentornato!',joinUs:'La tua storia inizia qui.',welcomeSubtitle:'Ritrova le persone e le community.',signupSubtitle:'Crea il tuo account e condividi le tue passioni.',submitLogin:'Accedi a Conecta',submitSignup:'Crea il mio account',busy:'Attendi...',heroTitle:'Le belle storie iniziano qui.',heroSubtitle:'Connettiti con persone e scopri nuove idee.',returnHome:'Torna alla home',save:'Salva'},
 'zh-CN':{home:'首页',explore:'发现',reels:'短视频',communities:'社区',connections:'好友',notifications:'通知',messages:'消息',profile:'个人主页',post:'发布',search:'搜索用户、社区和内容...',discover:'探索社区 →',noteTitle:'珍贵的连接。',noteBody:'一个分享和归属的空间。',logout:'退出登录',light:'浅色模式',dark:'深色模式',language:'语言',login:'登录',signup:'注册',email:'邮箱',password:'密码',yourName:'你的名字',forgot:'忘记密码？',welcomeBack:'欢迎回来！',joinUs:'你的故事从这里开始。',welcomeSubtitle:'与好友和社区重新连接。',signupSubtitle:'创建账号，分享你的热爱。',submitLogin:'登录 Conecta',submitSignup:'创建账号',busy:'请稍候...',heroTitle:'精彩故事从这里开始。',heroSubtitle:'结识朋友，发现新创意。',returnHome:'返回首页',save:'保存'},
 hi:{home:'होम',explore:'खोजें',reels:'रील्स',communities:'समुदाय',connections:'संबंध',notifications:'सूचनाएँ',messages:'संदेश',profile:'प्रोफ़ाइल',post:'पोस्ट करें',search:'लोग और समुदाय खोजें...',discover:'समुदाय देखें →',noteTitle:'मायने रखने वाले रिश्ते।',noteBody:'साझा करने और जुड़ने की जगह।',logout:'लॉग आउट',light:'लाइट मोड',dark:'डार्क मोड',language:'भाषा',login:'लॉग इन',signup:'खाता बनाएँ',email:'ईमेल',password:'पासवर्ड',yourName:'आपका नाम',forgot:'पासवर्ड भूल गए?',welcomeBack:'वापसी पर स्वागत है!',joinUs:'आपकी कहानी यहीं शुरू होती है।',welcomeSubtitle:'अपने दोस्तों और समुदायों से जुड़ें।',signupSubtitle:'खाता बनाएँ और अपनी पसंद साझा करें।',submitLogin:'Conecta में लॉग इन करें',submitSignup:'मेरा खाता बनाएँ',busy:'कृपया प्रतीक्षा करें...',heroTitle:'अच्छी कहानियाँ यहाँ शुरू होती हैं।',heroSubtitle:'लोगों से जुड़ें और नए विचार खोजें।',returnHome:'होम पर लौटें',save:'सहेजें'},
 ar:{home:'الرئيسية',explore:'استكشف',reels:'ريلز',communities:'المجتمعات',connections:'الروابط',notifications:'الإشعارات',messages:'الرسائل',profile:'الملف الشخصي',post:'نشر',search:'البحث عن أشخاص ومجتمعات...',discover:'استكشف المجتمعات ←',noteTitle:'روابط مهمة.',noteBody:'مساحة للمشاركة والانتماء.',logout:'تسجيل الخروج',light:'الوضع الفاتح',dark:'الوضع الداكن',language:'اللغة',login:'تسجيل الدخول',signup:'إنشاء حساب',email:'البريد الإلكتروني',password:'كلمة المرور',yourName:'اسمك',forgot:'نسيت كلمة المرور؟',welcomeBack:'مرحبًا بعودتك!',joinUs:'قصتك تبدأ هنا.',welcomeSubtitle:'تواصل مجددًا مع الأصدقاء والمجتمعات.',signupSubtitle:'أنشئ حسابك وشارك اهتماماتك.',submitLogin:'الدخول إلى Conecta',submitSignup:'إنشاء حسابي',busy:'يرجى الانتظار...',heroTitle:'تبدأ القصص الجميلة هنا.',heroSubtitle:'تواصل مع الناس واكتشف أفكارًا جديدة.',returnHome:'العودة للرئيسية',save:'حفظ'},
 ja:{home:'ホーム',explore:'見つける',reels:'リール',communities:'コミュニティ',connections:'つながり',notifications:'通知',messages:'メッセージ',profile:'プロフィール',post:'投稿',search:'人やコミュニティを検索...',discover:'コミュニティを探す →',noteTitle:'大切なつながり。',noteBody:'共有できる居場所。',logout:'ログアウト',light:'ライトモード',dark:'ダークモード',language:'言語',login:'ログイン',signup:'アカウント作成',email:'メール',password:'パスワード',yourName:'お名前',forgot:'パスワードを忘れた場合',welcomeBack:'おかえりなさい！',joinUs:'あなたの物語はここから。',welcomeSubtitle:'友だちやコミュニティと再びつながろう。',signupSubtitle:'アカウントを作って好きなことを共有しよう。',submitLogin:'Conectaにログイン',submitSignup:'アカウントを作成',busy:'お待ちください...',heroTitle:'素敵な物語はここから始まる。',heroSubtitle:'人とつながり、新しいアイデアを見つけよう。',returnHome:'ホームに戻る',save:'保存'}
};
type LocaleContextType={locale:Locale;setLocale:(locale:Locale)=>void;t:(key:MessageKey)=>string};
const context=createContext<LocaleContextType>({locale:'pt-BR',setLocale:()=>{},t:(key)=>pt[key]});
function validLocale(value:string|null):Locale|null{
 return value && Object.prototype.hasOwnProperty.call(localeNames,value)?value as Locale:null;
}
export function LocaleProvider({children}:{children:React.ReactNode}){
 const [locale,setLocaleState]=useState<Locale>('pt-BR');
 useEffect(()=>{
   try{const saved=validLocale(localStorage.getItem('conecta-locale'));
     const browser=validLocale(navigator.language)||validLocale(navigator.language.split('-')[0]);
     const l=saved||browser||'pt-BR';setLocaleState(l);
   }catch{}
 },[]);
 function setLocale(next:Locale){
   setLocaleState(next);
   try{localStorage.setItem('conecta-locale',next);}catch{}
 }
 useEffect(()=>{
   document.documentElement.lang=locale;
   document.documentElement.dir=locale==='ar'?'rtl':'ltr';
 },[locale]);
 return <context.Provider value={{locale,setLocale,t:key=>translations[locale][key]||pt[key]}}>{children}</context.Provider>;
}
export function useLocale(){return useContext(context);}
export function LanguageSelect({compact=false}:{compact?:boolean}){
 const {locale,setLocale,t}=useLocale();
 return <label className={'conecta-lang-select '+(compact?'compact':'')}>
   <span>{t('language')}</span>
   <select aria-label={t('language')} value={locale} onChange={e=>setLocale(e.target.value as Locale)}>
     {Object.entries(localeNames).map(([code,label])=><option key={code} value={code}>{label}</option>)}
   </select>
 </label>;
}
