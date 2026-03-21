import React, { useState } from 'react';
import { Language, TranslationKeys } from '../types';
import { User } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';

interface HeaderProps {
    t: TranslationKeys;
    currentLang: Language;
    setLanguage: (lang: Language) => void;
    currentView: 'home' | 'works' | 'auth' | 'profile' | 'project_request' | 'admin_requests';
    setView: (view: 'home' | 'works' | 'auth' | 'profile' | 'project_request' | 'admin_requests') => void;
    user: User | null;
}

const Header: React.FC<HeaderProps> = ({ t, currentLang, setLanguage, currentView, setView, user }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        setView('home');
    };

    const navItems = [
        { id: 'home', label: t.auth_back_home || 'Home' },
        { id: 'works', label: t.nav_works },
    ];

    return (
        <header className="relative w-full px-6 md:px-10 py-4 flex flex-col md:flex-row justify-between items-center border-b border-border bg-bgSurface z-50 shrink-0 transition-colors duration-300 shadow-sm">
            {/* Left: Branding */}
            <div className="flex flex-col items-center md:items-start mb-4 md:mb-0">
                <a
                    href="#"
                    onClick={(e) => { e.preventDefault(); setView('home'); }}
                    className="text-2xl font-extrabold tracking-[2px] uppercase text-textMain hover:opacity-80 transition-opacity"
                >
                    DESPUX <span className="text-primary">ENGINEERING</span>
                </a>
                <span className="text-xs font-medium text-textMuted tracking-widest mt-0.5 block">
                    Ing. Marcos Despujos
                </span>
            </div>

            {/* Right: Navigation & Actions */}
            <div className="flex flex-col-reverse md:flex-row items-center gap-6">

                {/* Navigation Links */}
                <nav className="flex items-center gap-6 text-sm font-medium">
                    {/* Tools Dropdown */}
                    <div className="relative group">
                        <button className="flex items-center gap-1 font-semibold text-textMain uppercase tracking-wider hover:text-primary transition-colors py-2">
                            {t.nav_tools}
                            <span className="text-[10px] ml-1">▼</span>
                        </button>
                        {/* Dropdown Content */}
                        <div className="absolute top-full right-0 mt-2 w-56 bg-bgSurface border border-border rounded shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform translate-y-[-5px] group-hover:translate-y-0 z-50">
                            <a href="https://www.despux.net/tuberia" target="_blank" rel="noreferrer" className="block px-5 py-3 text-textMuted hover:bg-black/5 hover:text-textMain hover:border-l-2 hover:border-primary transition-all text-sm">
                                {t.nav_calc}
                            </a>
                            <a href="https://www.despux.net/gear" target="_blank" rel="noreferrer" className="block px-5 py-3 text-textMuted hover:bg-black/5 hover:text-textMain hover:border-l-2 hover:border-primary transition-all text-sm">
                                {t.nav_gears}
                            </a>
                            <a href="https://www.despux.net/cad" target="_blank" rel="noreferrer" className="block px-5 py-3 text-textMuted hover:bg-black/5 hover:text-textMain hover:border-l-2 hover:border-primary transition-all text-sm">
                                {t.nav_cad}
                            </a>
                        </div>
                    </div>

                    {/* Standard Links */}
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setView(item.id as any)}
                            className={`transition-colors duration-200 tracking-wide uppercase ${currentView === item.id ? 'text-primary font-bold' : 'text-textMain hover:text-primary'
                                }`}
                        >
                            {item.label}
                        </button>
                    ))}
                </nav>

                <div className="h-6 w-px bg-border hidden md:block"></div>

                {/* Actions: Theme, Lang, User */}
                <div className="flex items-center gap-4">
                    {/* Language Toggles (Simplified) */}
                    <div className="flex gap-2">
                        {(['es', 'en', 'de'] as Language[]).map((lang) => (
                            <button
                                key={lang}
                                onClick={() => setLanguage(lang)}
                                className={`text-xs font-bold uppercase px-2 py-1 rounded transition-colors ${currentLang === lang
                                    ? 'bg-primary text-white shadow-md'
                                    : 'text-textMuted hover:text-textMain hover:bg-black/5'
                                    }`}
                            >
                                {lang}
                            </button>
                        ))}
                    </div>

                    {/* User Menu */}
                    {user ? (
                        <div className="relative ml-2">
                            <button
                                onClick={() => setIsMenuOpen(!isMenuOpen)}
                                className="flex items-center gap-2 hover:bg-black/5 pl-2 pr-3 py-1.5 rounded-full border border-transparent hover:border-border transition-all"
                            >
                                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-purple-500 flex items-center justify-center text-xs font-bold text-white shadow-md">
                                    {user.email?.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-xs font-medium text-textMain hidden sm:block max-w-[100px] truncate">
                                    {user.user_metadata?.full_name || user.email?.split('@')[0]}
                                </span>
                            </button>

                            {/* Dropdown */}
                            {isMenuOpen && (
                                <div className="absolute right-0 mt-2 w-48 bg-bgSurface border border-border rounded-lg shadow-xl py-1 animate-fade-in-up z-50">
                                    <div className="px-4 py-3 border-b border-border bg-bgBody/30">
                                        <p className="text-[10px] text-textMuted uppercase tracking-wider font-bold">Signed in as</p>
                                        <p className="text-xs font-medium text-textMain truncate mt-0.5">{user.email}</p>
                                    </div>
                                    <button
                                        onClick={() => { setView('profile'); setIsMenuOpen(false); }}
                                        className="w-full text-left px-4 py-2.5 text-sm text-textMain hover:bg-primary/10 hover:text-primary transition-colors flex items-center gap-2"
                                    >
                                        <span>👤</span> {t.nav_profile || 'My Profile'}
                                    </button>

                                    {/* Admin Dashboard Link - Only for admin */}
                                    {user.email?.toLowerCase() === 'despux@gmail.com' && (
                                        <button
                                            onClick={() => {
                                                console.log("Navigating to admin_requests");
                                                setView('admin_requests');
                                                setIsMenuOpen(false);
                                            }}
                                            className="w-full text-left px-4 py-2.5 text-sm text-primary hover:bg-primary/10 transition-colors flex items-center gap-2 font-bold"
                                        >
                                            <span>⚡</span> Admin Requests
                                        </button>
                                    )}

                                    <button
                                        onClick={handleLogout}
                                        className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-500/10 transition-colors flex items-center gap-2"
                                    >
                                        <span>🚪</span> {t.nav_logout || 'Sign Out'}
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <button
                            onClick={() => setView('auth')}
                            className="ml-2 px-6 py-2 bg-textMain text-bgSurface text-sm font-bold rounded shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
                        >
                            {t.btn_access || 'LOGIN'}
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;