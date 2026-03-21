import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import HomeView from './components/HomeView';
import WorksView from './components/WorksView';
import AuthView from './components/AuthView';
import ProfileView from './components/ProfileView';
import ProjectRequestView from './components/ProjectRequestView';
import AdminRequestsView from './components/AdminRequestsView';
import BackgroundCanvas from './components/BackgroundCanvas';
import { supabase } from './supabaseClient';
import { User } from '@supabase/supabase-js';
import { Language, TranslationKeys } from './types';
import { TRANSLATIONS } from './constants';

const App: React.FC = () => {
    const [language, setLanguage] = useState<Language>('es');
    const [view, setView] = useState<'home' | 'works' | 'auth' | 'profile' | 'project_request' | 'admin_requests'>('home');
    const [user, setUser] = useState<User | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);

    // Initial load: Force light mode / clear unused storage
    useEffect(() => {
        document.documentElement.classList.remove('dark');
        localStorage.removeItem('theme'); // Clean up legacy
    }, []);

    useEffect(() => {
        // Auth Listener
        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
            setUser(session?.user ?? null);
            if (event === 'SIGNED_IN') {
                // Check if user is admin (example logic)
                // In real app, check a 'roles' table or metadata
                if (session?.user?.email?.toLowerCase() === 'despux@gmail.com') { // Replace with real check
                    setIsAdmin(true);
                }
                setView('home');
            } else if (event === 'SIGNED_OUT') {
                setIsAdmin(false);
                setView('home');
            }
        });

        // Current User Check
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
        });

        // Navigation Event Listener
        const handleNavigate = (e: CustomEvent) => {
            setView(e.detail);
        };
        window.addEventListener('navigate', handleNavigate as EventListener);

        return () => {
            authListener?.subscription.unsubscribe();
            window.removeEventListener('navigate', handleNavigate as EventListener);
        };
    }, []);

    const t: TranslationKeys = TRANSLATIONS[language];

    // Views
    const renderView = () => {
        switch (view) {
            case 'home':
                return <HomeView t={t} onAccess={() => setView('auth')} user={user} />;
            case 'works':
                return <WorksView t={t} isVisible={true} isAdmin={isAdmin} />;
            case 'auth':
                // Pass onBack to go Home if canceled
                return (
                    <AuthView
                        t={t}
                        isVisible={true}
                        onBack={() => setView('home')}
                        isAdmin={isAdmin}
                        setIsAdmin={setIsAdmin}
                    />
                );
            case 'profile':
                return <ProfileView user={user} isVisible={true} />;
            case 'project_request':
                return <ProjectRequestView t={t} user={user} onBack={() => setView('home')} />;
            case 'admin_requests':
                return <AdminRequestsView t={t} onBack={() => setView('home')} />;
            default:
                return <HomeView t={t} onAccess={() => setView('auth')} user={user} />;
        }
    };

    return (
        <div className="flex flex-col w-screen h-screen overflow-hidden bg-transparent transition-colors duration-300">
            {/* Background Canvas (Particles) - Handles its own theme logic inside (forced light) */}
            <BackgroundCanvas theme="light" />

            {/* Header */}
            <Header
                t={t}
                currentLang={language}
                setLanguage={setLanguage}
                currentView={['home', 'works', 'auth', 'profile', 'project_request', 'admin_requests'].includes(view) ? view : 'home'}
                setView={(v) => setView(v)}
                user={user}
            />

            {/* Sliding Main Container */}
            <main className="flex-1 w-full h-full relative overflow-hidden z-10">
                {renderView()}
            </main>
        </div>
    );
};

export default App;