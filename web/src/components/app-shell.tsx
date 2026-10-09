'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Bell, Bookmark, Compass, Clapperboard, Home, LogOut, Menu, MessageCircle, Moon, Plus, Search, Settings, Sun, Users, X, PanelLeftClose, PanelLeftOpen, HeartHandshake, ShieldCheck } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import type { UserProfile } from '@/lib/types';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { ConceptBrand } from '@/components/concept-brand';
import {useLocale,LanguageSelect} from '@/lib/i18n';
import {ProfileAvatar} from '@/components/profile-avatar';
import {ChatWidget} from '@/components/chat-widget';
import {ChatPresenceProvider} from '@/components/chat-presence';
import {ChatCallsProvider} from '@/components/chat-calls';
import {disableChatPushDevice} from '@/components/chat-push-control';

const navItems = [
  { label: 'Início', href: '/feed', icon: Home },
  { label: 'Explorar', href: '/explorar', icon: Compass },
  { label: 'Reels', href: '/reels', icon: Clapperboard },
  { label: 'Comunidades', href: '/comunidades', icon: Users },
  { label: 'Acolhimento', href: '/acolhimento', icon: HeartHandshake },
  { label: 'Conexões', href: '/conexoes', icon: Users },
  { label: 'Notificações', href: '/notificacoes', icon: Bell },
  { label: 'Mensagens', href: '/mensagens', icon: MessageCircle },
  { label: 'Perfil', href: '/perfil', icon: Settings },
];
const mobileItems = [
  { label: 'Início', href: '/feed', icon: Home },
  { label: 'Explorar', href: '/explorar', icon: Compass },
  { label: 'Publicar', href: '/feed#composer', icon: Plus },
  { label: 'Comunidades', href: '/comunidades', icon: Users },
  { label: 'Perfil', href: '/perfil', icon: Settings },
];

export function useAuthProfile() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function check() {
      try {
        const client = supabaseBrowser();
        const { data: { user: authUser }, error: authError } = await client.auth.getUser();
        if (!active) return;
        if (authError || !authUser) { router.replace('/auth'); return; }
        const { data: profileData, error: profileError } = await client.from('profiles').select('id,handle,display_name,bio,avatar_path').eq('id', authUser.id).maybeSingle();
        if (!active) return;
        if (profileError) throw profileError;
        if (!profileData) { router.replace('/onboarding'); return; }
        const {data:declaration,error:declarationError}=await client.from('registration_age_declarations')
          .select('declared_band').eq('user_id',authUser.id).maybeSingle();
        if(!active)return;
        if(declarationError)throw declarationError;
        if(!declaration){router.replace('/onboarding');return;}
        // A user's own declaration may only RESTRICT access, never grant adult verification.
        // Underage self-declarations stay on Conecta ID while independent age and
        // parental assurance are not yet available. Server-side RLS/triggers
        // also protect content from clients bypassing this navigation.
        if(declaration.declared_band!=='18_plus'&&pathname!=='/verificar-identidade'){
          router.replace('/verificar-identidade');return;
        }
        setUser(authUser);
        setProfile(profileData as UserProfile);
      } catch (e) { if (active) setError(e instanceof Error ? e.message : 'Não foi possível conectar.'); }
      finally { if (active) setLoading(false); }
    }
    void check();
    return () => { active = false; };
  }, [router,pathname]);
  return { user, profile, loading, error, setProfile };
}

export function AppShell({ children, profile }: { children: React.ReactNode; profile: UserProfile }) {
  const pathname = usePathname();
  const router = useRouter();
  const {t}=useLocale();
  const [mobileNav, setMobileNav] = useState(false);
  const [sidebarCollapsed,setSidebarCollapsed]=useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [dark, setDark] = useState(false);
  const [unread, setUnread] = useState(0);
  const [platformRole,setPlatformRole]=useState(false);

  useEffect(() => {
    const selected = window.localStorage.getItem('conecta-theme') === 'dark';
    setDark(selected);
    document.documentElement.dataset.theme = selected ? 'dark' : 'light';
    setSidebarCollapsed(window.localStorage.getItem('conecta-sidebar-collapsed')==='1');
    document.documentElement.dataset.calmMode=window.localStorage.getItem('conecta-calm-mode')==='1'?'1':'0';
  }, []);

  function toggleSidebar(){
    setSidebarCollapsed(prev=>{const value=!prev;window.localStorage.setItem('conecta-sidebar-collapsed',value?'1':'0');return value;});
  }

  function toggleTheme() {
    setDark(previous => {
      const selected = !previous;
      window.localStorage.setItem('conecta-theme', selected ? 'dark' : 'light');
      document.documentElement.dataset.theme = selected ? 'dark' : 'light';
      return selected;
    });
  }

  function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push('/explorar?q=' + encodeURIComponent(searchValue.trim()));
  }

  useEffect(() => {
    let active = true;
    const db = supabaseBrowser();
    let channel: ReturnType<typeof db.channel> | null = null;
    async function updateUnread() {
      const { data: { user } } = await db.auth.getUser();
      if (!user || !active) return;
      const {count,error:e} = await db.from('notifications').select('id', {count:'exact',head:true})
        .eq('recipient_id',user.id).is('read_at',null);
      if (active && !e) setUnread(count || 0);
    }
    async function subscribe() {
      const {data:{user}} = await db.auth.getUser();
      if (!active || !user) return;
      channel = db.channel('conecta-shell-notifications-'+user.id)
        .on('postgres_changes',{schema:'public',table:'notifications',event:'*',filter:'recipient_id=eq.'+user.id},
          ()=>{void updateUnread();}).subscribe();
      void updateUnread();
    }
    void subscribe();
    const onFocus=()=>{void updateUnread();};
    window.addEventListener('focus',onFocus);
    const timer=window.setInterval(()=>{if(!document.hidden)void updateUnread();},30000);
    return ()=>{
      active=false;
      window.removeEventListener('focus',onFocus);
      window.clearInterval(timer);
      if(channel)void db.removeChannel(channel);
    };
  }, [pathname]);

  useEffect(()=>{
    let live=true;
    void supabaseBrowser().from('platform_moderators').select('role')
      .eq('user_id',profile.id).maybeSingle().then(({data,error})=>{
       if(live)setPlatformRole(!error&&Boolean(data?.role));
      });
    return()=>{live=false;};
  },[profile.id]);

  async function logout() {
    try{await disableChatPushDevice();}catch{/* Prevent cross-account notifications even if push API is unavailable. */}
    await supabaseBrowser().auth.signOut();
    router.replace('/auth'); router.refresh();
  }

  return <ChatPresenceProvider userId={profile.id}><ChatCallsProvider userId={profile.id}><div className={"app-layout concept-app "+(sidebarCollapsed?"conecta-sidebar-collapsed":"")}>
    <aside className={'sidebar ' + (mobileNav ? 'sidebar-open' : '')}>
      <div className="sidebar-top"><ConceptBrand href="/feed"/><button type="button" className="icon-btn conecta-sidebar-toggle" onClick={toggleSidebar} aria-label={sidebarCollapsed?"Expandir menu lateral":"Recolher menu lateral"} title={sidebarCollapsed?"Expandir menu lateral":"Recolher menu lateral"} aria-expanded={!sidebarCollapsed}>{sidebarCollapsed?<PanelLeftOpen size={20}/>:<PanelLeftClose size={20}/>}</button><button className="icon-btn close-mobile" type="button" aria-label="Fechar navegação" onClick={() => setMobileNav(false)}><X size={20}/></button></div>
      <div className="sidebar-section-label">MENU · {t('language')}</div>
      <nav className="nav-links" aria-label="Principal">
        {navItems.map(({label,href,icon:Icon}) => <Link key={href} href={href} title={t(({'Início':'home','Explorar':'explore','Reels':'reels','Comunidades':'communities','Acolhimento':'support','Conexões':'connections','Notificações':'notifications','Mensagens':'messages','Perfil':'profile','Publicar':'post'} as Record<string, Parameters<typeof t>[0]>)[label]||'home')} onClick={()=>setMobileNav(false)} aria-current={pathname===href?'page':undefined} className={'nav-link '+(pathname===href?'nav-active':'')}>
          <Icon size={20} strokeWidth={1.9}/><span>{t(({'Início':'home','Explorar':'explore','Reels':'reels','Comunidades':'communities','Acolhimento':'support','Conexões':'connections','Notificações':'notifications','Mensagens':'messages','Perfil':'profile','Publicar':'post'} as Record<string, Parameters<typeof t>[0]>)[label]||'home')}</span>
          {label==='Notificações' && unread>0 && <span className="concept-nav-count">{unread>99?'99+':unread}</span>}
        </Link>)}
        {platformRole&&<Link href="/moderacao" title="Moderação da plataforma" onClick={()=>setMobileNav(false)}
          aria-current={pathname==='/moderacao'?'page':undefined}
          className={'nav-link '+(pathname==='/moderacao'?'nav-active':'')}>
          <ShieldCheck size={20} strokeWidth={1.9}/><span>Moderação</span>
        </Link>}
      </nav>
      <div className="concept-sidebar-note">
        <span className="concept-sidebar-note-icon"><Users size={20}/></span>
        <strong>{t('noteTitle')}</strong>
        <p>{t('noteBody')}</p>
        <Link href="/comunidades">{t('discover')}</Link>
      </div>
      <div className="conecta-sidebar-language"><LanguageSelect compact/></div><div className="sidebar-bottom"><Link href="/perfil" className="sidebar-profile"><ProfileAvatar person={profile}/><span className="sidebar-profile-info"><strong>{profile.display_name}</strong><small>@{profile.handle}</small></span></Link><button onClick={logout} className="icon-btn" aria-label="Sair da conta" title={t('logout')}><LogOut size={19}/></button></div>
    </aside>
    {mobileNav && <button className="mobile-overlay" aria-label="Fechar menu" onClick={() => setMobileNav(false)}/>}
    <div className="workspace">
      <header className="desktop-topbar"><button type="button" className="icon-btn conecta-topbar-sidebar-toggle" onClick={toggleSidebar} aria-label={sidebarCollapsed?"Expandir sidebar":"Recolher sidebar"} title={sidebarCollapsed?"Expandir sidebar":"Recolher sidebar"}>{sidebarCollapsed?<PanelLeftOpen size={20}/>:<PanelLeftClose size={20}/>}</button>
        <form className="searchbox topbar-search" onSubmit={search}><Search size={18}/><input value={searchValue} onChange={e => setSearchValue(e.target.value)} placeholder={t('search')} aria-label="Buscar no Conecta"/></form>
        <div className="topbar-actions">
          <button onClick={toggleTheme} className="icon-btn" aria-label={dark?t('light'):t('dark')} title="Alterar tema">{dark ? <Sun size={19}/> : <Moon size={19}/>}</button>
          <Link href="/notificacoes" className="icon-btn concept-notifications-link" title="Notificações" aria-label={unread>0?unread+' notificações não lidas':'Notificações'}><Bell size={19}/>{unread>0 && <span className="concept-notification-dot"/>}</Link>
          <span className="topbar-divider"/>
          <Link className="topbar-account" href="/perfil"><ProfileAvatar person={profile} size="small"/><span>{profile.display_name}</span><span className="concept-account-handle">@{profile.handle}</span></Link>
        </div>
      </header>
      <header className="mobile-header"><button className="icon-btn" type="button" onClick={() => setMobileNav(true)} aria-label="Abrir menu"><Menu size={22}/></button><ConceptBrand href="/feed"/><Link href="/perfil"><ProfileAvatar person={profile} size="small"/></Link></header>
      {children}
      <ChatWidget userId={profile.id}/>
      <nav className="mobile-bottom-nav" aria-label="Navegação rápida">{mobileItems.map(({label,href,icon:Icon})=><Link aria-label={label} key={href} href={href} aria-current={pathname===href?'page':undefined} className={(pathname===href?'active ':'')+(label==='Publicar'?'concept-mobile-create':'')}><Icon size={22}/><span>{label}</span></Link>)}</nav>
    </div>
  </div></ChatCallsProvider></ChatPresenceProvider>;
}

export function GuardedPage({ children, profile, loading, error }: { children: React.ReactNode; profile: UserProfile | null; loading: boolean; error: string }) {
  if (error) return <div className="center-screen"><div className="status-card"><h2>Não conseguimos abrir a rede</h2><p>{error}</p><Link className="btn btn-primary" href="/">Voltar ao início</Link></div></div>;
  if (loading || !profile) return <div className="center-screen"><div className="loading-ring"/><p className="muted">Carregando sua conta...</p></div>;
  return <AppShell profile={profile}>{children}</AppShell>;
}
