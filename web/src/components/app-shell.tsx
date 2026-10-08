'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Bell, Bookmark, Compass, Clapperboard, Home, LogOut, Menu, MessageCircle, Moon, Plus, Search, Settings, Sun, Users, X } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import type { UserProfile } from '@/lib/types';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { ConceptBrand } from '@/components/concept-brand';

const navItems = [
  { label: 'Início', href: '/feed', icon: Home },
  { label: 'Explorar', href: '/explorar', icon: Compass },
  { label: 'Reels', href: '/reels', icon: Clapperboard },
  { label: 'Comunidades', href: '/comunidades', icon: Users },
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
        setUser(authUser);
        setProfile(profileData as UserProfile);
      } catch (e) { if (active) setError(e instanceof Error ? e.message : 'Não foi possível conectar.'); }
      finally { if (active) setLoading(false); }
    }
    void check();
    return () => { active = false; };
  }, [router]);
  return { user, profile, loading, error, setProfile };
}

export function AppShell({ children, profile }: { children: React.ReactNode; profile: UserProfile }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileNav, setMobileNav] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [dark, setDark] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const selected = window.localStorage.getItem('conecta-theme') === 'dark';
    setDark(selected);
    document.documentElement.dataset.theme = selected ? 'dark' : 'light';
  }, []);

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
    async function updateUnread() {
      const { data: { user } } = await supabaseBrowser().auth.getUser();
      if (!user || !active) return;
      const {count} = await supabaseBrowser().from('notifications').select('id', {count: 'exact', head: true}).eq('recipient_id',user.id).is('read_at',null);
      if (active) setUnread(count || 0);
    }
    void updateUnread();
    return () => { active=false; };
  }, [pathname]);

  async function logout() {
    await supabaseBrowser().auth.signOut();
    router.replace('/auth'); router.refresh();
  }

  return <div className="app-layout concept-app">
    <aside className={'sidebar ' + (mobileNav ? 'sidebar-open' : '')}>
      <div className="sidebar-top"><ConceptBrand href="/feed"/><button className="icon-btn close-mobile" type="button" aria-label="Fechar navegação" onClick={() => setMobileNav(false)}><X size={20}/></button></div>
      <div className="sidebar-section-label">MENU PRINCIPAL</div>
      <nav className="nav-links" aria-label="Principal">
        {navItems.map(({label,href,icon:Icon}) => <Link key={href} href={href} onClick={()=>setMobileNav(false)} aria-current={pathname===href?'page':undefined} className={'nav-link '+(pathname===href?'nav-active':'')}>
          <Icon size={20} strokeWidth={1.9}/><span>{label}</span>
          {label==='Notificações' && unread>0 && <span className="concept-nav-count">{unread>99?'99+':unread}</span>}
        </Link>)}
      </nav>
      <div className="concept-sidebar-note">
        <span className="concept-sidebar-note-icon"><Users size={20}/></span>
        <strong>Conexões que importam.</strong>
        <p>Um espaço feito para compartilhar e pertencer.</p>
        <Link href="/comunidades">Conhecer comunidades →</Link>
      </div>
      <div className="sidebar-bottom"><Link href="/perfil" className="sidebar-profile"><span className="avatar avatar-gradient">{profile.display_name[0]?.toUpperCase()||'C'}</span><span className="sidebar-profile-info"><strong>{profile.display_name}</strong><small>@{profile.handle}</small></span></Link><button onClick={logout} className="icon-btn" aria-label="Sair da conta" title="Sair"><LogOut size={19}/></button></div>
    </aside>
    {mobileNav && <button className="mobile-overlay" aria-label="Fechar menu" onClick={() => setMobileNav(false)}/>}
    <div className="workspace">
      <header className="desktop-topbar">
        <form className="searchbox topbar-search" onSubmit={search}><Search size={18}/><input value={searchValue} onChange={e => setSearchValue(e.target.value)} placeholder="Buscar pessoas, comunidades e conteúdos..." aria-label="Buscar no Conecta"/></form>
        <div className="topbar-actions">
          <button onClick={toggleTheme} className="icon-btn" aria-label={dark ? "Usar tema claro" : "Usar tema escuro"} title="Alterar tema">{dark ? <Sun size={19}/> : <Moon size={19}/>}</button>
          <Link href="/notificacoes" className="icon-btn concept-notifications-link" title="Notificações" aria-label={unread>0?unread+' notificações não lidas':'Notificações'}><Bell size={19}/>{unread>0 && <span className="concept-notification-dot"/>}</Link>
          <span className="topbar-divider"/>
          <Link className="topbar-account" href="/perfil"><span className="avatar avatar-gradient avatar-sm">{profile.display_name[0]?.toUpperCase()||"C"}</span><span>{profile.display_name}</span><span className="concept-account-handle">@{profile.handle}</span></Link>
        </div>
      </header>
      <header className="mobile-header"><button className="icon-btn" type="button" onClick={() => setMobileNav(true)} aria-label="Abrir menu"><Menu size={22}/></button><ConceptBrand href="/feed"/><Link className="avatar avatar-gradient avatar-sm" href="/perfil">{profile.display_name[0]?.toUpperCase()||'C'}</Link></header>
      {children}
      <nav className="mobile-bottom-nav" aria-label="Navegação rápida">{mobileItems.map(({label,href,icon:Icon})=><Link aria-label={label} key={href} href={href} aria-current={pathname===href?'page':undefined} className={(pathname===href?'active ':'')+(label==='Publicar'?'concept-mobile-create':'')}><Icon size={22}/><span>{label}</span></Link>)}</nav>
    </div>
  </div>;
}

export function GuardedPage({ children, profile, loading, error }: { children: React.ReactNode; profile: UserProfile | null; loading: boolean; error: string }) {
  if (error) return <div className="center-screen"><div className="status-card"><h2>Não conseguimos abrir a rede</h2><p>{error}</p><Link className="btn btn-primary" href="/">Voltar ao início</Link></div></div>;
  if (loading || !profile) return <div className="center-screen"><div className="loading-ring"/><p className="muted">Carregando sua conta...</p></div>;
  return <AppShell profile={profile}>{children}</AppShell>;
}
