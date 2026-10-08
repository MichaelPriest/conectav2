'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Bell, Compass, Home, LogOut, Menu, MessageCircle, Moon, Search, Settings, Sun, Users, X } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import type { UserProfile } from '@/lib/types';
import { supabaseBrowser } from '@/lib/supabase/browser';

const navItems = [
  { label: 'Início', href: '/feed', icon: Home },
  { label: 'Explorar', href: '/explorar', icon: Compass },
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

  async function logout() {
    await supabaseBrowser().auth.signOut();
    router.replace('/auth'); router.refresh();
  }

  return <div className="app-layout">
    <aside className={'sidebar ' + (mobileNav ? 'sidebar-open' : '')}>
      <div className="sidebar-top"><Link href="/feed" className="brand"><span className="brand-mark">c.</span> conecta<span className="brand-dot">.</span></Link><button className="icon-btn close-mobile" type="button" aria-label="Fechar navegação" onClick={() => setMobileNav(false)}><X size={20}/></button></div>
      <div className="sidebar-section-label">MENU PRINCIPAL</div>
      <nav className="nav-links" aria-label="Principal">{navItems.map(({label, href, icon: Icon}) =>
        <Link key={href} href={href} onClick={() => setMobileNav(false)} className={'nav-link '+(pathname===href?'nav-active':'')}><Icon size={21}/><span>{label}</span>{pathname===href&&<i className="nav-indicator"/>}</Link>)}
      </nav>
      <div className="sidebar-section-label">EM BREVE</div>
      <div className="nav-links"><div className="nav-link nav-disabled"><MessageCircle size={21}/> Mensagens <span className="soon-dot">•</span></div><div className="nav-link nav-disabled"><Bell size={21}/> Notificações <span className="soon-dot">•</span></div></div>
      <div className="sidebar-bottom"><Link href="/perfil" className="sidebar-profile"><span className="avatar avatar-gradient">{profile.display_name[0]?.toUpperCase()||'C'}</span><span className="sidebar-profile-info"><strong>{profile.display_name}</strong><small>@{profile.handle}</small></span></Link><button onClick={logout} className="icon-btn" aria-label="Sair da conta" title="Sair"><LogOut size={19}/></button></div>
    </aside>
    {mobileNav && <button className="mobile-overlay" aria-label="Fechar menu" onClick={() => setMobileNav(false)}/>}
    <div className="workspace">
      <header className="desktop-topbar">
        <form className="searchbox topbar-search" onSubmit={search}><Search size={18}/><input value={searchValue} onChange={e => setSearchValue(e.target.value)} placeholder="Buscar pessoas, comunidades e publicações..." aria-label="Buscar no Conecta"/></form>
        <div className="topbar-actions">
          <button onClick={toggleTheme} className="icon-btn" aria-label={dark ? "Usar tema claro" : "Usar tema escuro"} title="Alterar tema">{dark ? <Sun size={20}/> : <Moon size={20}/>}</button>
          <span className="topbar-divider"/>
          <Link className="topbar-account" href="/perfil"><span className="avatar avatar-gradient avatar-sm">{profile.display_name[0]?.toUpperCase()||"C"}</span><span>{profile.display_name}</span></Link>
        </div>
      </header>
      <header className="mobile-header"><button className="icon-btn" type="button" onClick={() => setMobileNav(true)} aria-label="Abrir menu"><Menu size={22}/></button><Link href="/feed" className="brand"><span className="brand-mark">c.</span> conecta<span className="brand-dot">.</span></Link><Link className="avatar avatar-gradient avatar-sm" href="/perfil">{profile.display_name[0]?.toUpperCase()||'C'}</Link></header>
      {children}
      <nav className="mobile-bottom-nav" aria-label="Navegação rápida">{navItems.map(({label,href,icon:Icon})=><Link aria-label={label} key={href} href={href} className={pathname===href?'active':''}><Icon size={22}/></Link>)}</nav>
    </div>
  </div>;
}

export function GuardedPage({ children, profile, loading, error }: { children: React.ReactNode; profile: UserProfile | null; loading: boolean; error: string }) {
  if (error) return <div className="center-screen"><div className="status-card"><h2>Não conseguimos abrir a rede</h2><p>{error}</p><Link className="btn btn-primary" href="/">Voltar ao início</Link></div></div>;
  if (loading || !profile) return <div className="center-screen"><div className="loading-ring"/><p className="muted">Carregando sua conta...</p></div>;
  return <AppShell profile={profile}>{children}</AppShell>;
}
