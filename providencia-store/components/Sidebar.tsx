import React, { useState } from 'react';
import { AuthView, CartItem, SidebarView } from '../types';
import { AquaButton } from './AquaButton';
import { User as UserIcon, LogIn, UserPlus, ShoppingCart, X, Check, Edit, Shield, Package } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { ValidationPopup } from './ValidationPopup';
import { ProfileEditor } from './ProfileEditor';
import { OrderHistory } from './OrderHistory';
import { useLanguage } from '../context/LanguageContext';

interface SidebarProps {
    cart: CartItem[];
    onRemoveFromCart: (id: number) => void;
    onCheckout: () => void;
    onOpenAdmin: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    cart,
    onRemoveFromCart,
    onCheckout,
    onOpenAdmin
}) => {
    const { user, signOut } = useAuth();
    const { t } = useLanguage();
    const [view, setView] = useState<AuthView>(AuthView.LOGIN);
    const [currentView, setCurrentView] = useState<SidebarView>(SidebarView.CART);

    // Auth Form State
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState(''); // Only used for metadata if needed
    const [authError, setAuthError] = useState<string | null>(null);
    const [authLoading, setAuthLoading] = useState(false);
    const [showValidationPopup, setShowValidationPopup] = useState(false);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthError(null);
        setAuthLoading(true);

        try {
            if (view === AuthView.LOGIN) {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password
                });
                if (error) throw error;
            } else {
                // Register
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: name
                        }
                    }
                });
                if (error) throw error;

                // Create initial profile with email
                if (data.user) {
                    await supabase.from('profiles').insert({
                        id: data.user.id,
                        full_name: name,
                        email: email
                    });
                }

                // Show validation popup
                setShowValidationPopup(true);
            }
        } catch (error: any) {
            console.error('Auth Error Details:', error);
            setAuthError(error.message || t('authError'));
        } finally {
            setAuthLoading(false);
        }
    };

    const cartTotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);

    return (
        <div className="h-full flex flex-col bg-white/80 backdrop-blur-xl border-l border-white/50 shadow-2xl overflow-hidden relative">
            <ValidationPopup
                isOpen={showValidationPopup}
                onClose={() => setShowValidationPopup(false)}
                email={email}
            />
            {/* Header / Top Bar */}
            <div className="p-6 bg-gradient-to-b from-white to-gray-50 border-b border-gray-200">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-serif text-gray-800">
                        {user ? (currentView === SidebarView.PROFILE ? t('myProfile') : t('myAccount')) : t('welcome')}
                    </h2>
                    {user && (
                        <div className="flex gap-2">
                            {/* Admin Button */}
                            {(user.email?.toLowerCase().trim() === 'despux@gmail.com') && (
                                <button
                                    onClick={onOpenAdmin}
                                    className="p-1.5 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
                                    title={t('adminPanel')}
                                >
                                    <Shield size={14} />
                                </button>
                            )}
                            <AquaButton onClick={() => signOut()} className="!px-3 !py-1 text-xs">
                                {t('logout')}
                            </AquaButton>
                        </div>
                    )}
                </div>
                {/* Profile Tabs if logged in */}
                {user && (
                    <div className="flex gap-4 mt-4 text-sm border-b border-gray-200/50 pb-1">
                        <button
                            onClick={() => setCurrentView(SidebarView.CART)}
                            className={`flex items-center gap-1 pb-1 transition-colors ${currentView === SidebarView.CART ? 'font-bold text-blue-600 border-b-2 border-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <ShoppingCart size={14} /> {t('tabCart')}
                        </button>
                        <button
                            onClick={() => setCurrentView(SidebarView.ORDERS)}
                            className={`flex items-center gap-1 pb-1 transition-colors ${currentView === SidebarView.ORDERS ? 'font-bold text-blue-600 border-b-2 border-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <Package size={14} /> {t('tabOrders')}
                        </button>
                        <button
                            onClick={() => setCurrentView(SidebarView.PROFILE)}
                            className={`flex items-center gap-1 pb-1 transition-colors ${currentView === SidebarView.PROFILE ? 'font-bold text-blue-600 border-b-2 border-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <Edit size={14} /> {t('tabProfile')}
                        </button>
                    </div>
                )}
            </div>

            {/* Content Area - Scrollable */}
            <div className="flex-grow overflow-y-auto p-6 space-y-6">

                {!user ? (
                    // AUTHENTICATION FORMS
                    <div className="space-y-6 animate-fadeIn">
                        <div className="flex justify-center mb-6">
                            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center shadow-inner border border-gray-200">
                                <UserIcon size={32} className="text-gray-400" />
                            </div>
                        </div>

                        <div className="flex rounded-lg bg-gray-200 p-1 mb-6">
                            <button
                                onClick={() => { setView(AuthView.LOGIN); setAuthError(null); }}
                                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${view === AuthView.LOGIN ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                {t('loginTitle')}
                            </button>
                            <button
                                onClick={() => { setView(AuthView.REGISTER); setAuthError(null); }}
                                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${view === AuthView.REGISTER ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                {t('registerTitle')}
                            </button>
                        </div>

                        {authError && (
                            <div className="p-3 bg-red-100 text-red-700 text-xs rounded-lg border border-red-200">
                                {authError}
                            </div>
                        )}

                        <form onSubmit={handleAuth} className="space-y-4">
                            {view === AuthView.REGISTER && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">{t('labelName')}</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all shadow-inner"
                                        placeholder={t('phName')}
                                        required
                                    />
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">{t('labelEmail')}</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all shadow-inner"
                                    placeholder={t('phEmail')}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">{t('labelPassword')}</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all shadow-inner"
                                    placeholder={t('phPassword')}
                                    required
                                />
                            </div>

                            <AquaButton fullWidth type="submit" className="mt-4" disabled={authLoading}>
                                {authLoading ? t('btnProcessing') : (view === AuthView.LOGIN ? <><LogIn size={16} /> {t('btnLogin')}</> : <><UserPlus size={16} /> {t('btnRegister')}</>)}
                            </AquaButton>
                        </form>
                    </div>
                ) : (
                    // LOGGED IN VIEW
                    <>
                        {currentView === SidebarView.PROFILE ? (
                            <ProfileEditor />
                        ) : currentView === SidebarView.ORDERS ? (
                            <OrderHistory />
                        ) : (
                            // CART & USER PROFILE
                            <div className="space-y-6 animate-fadeIn">
                                {/* User Info from Metadata if available */}
                                {user.user_metadata?.full_name && (
                                    <div className="text-center text-gray-600 font-serif mb-2">
                                        {t('hello')}, {user.user_metadata.full_name}
                                    </div>
                                )}

                                <div className="bg-white/50 rounded-xl p-4 border border-white shadow-sm">
                                    <h3 className="text-sm font-bold text-gray-600 mb-3 uppercase tracking-wider border-b border-gray-200 pb-2 flex items-center gap-2">
                                        <ShoppingCart size={14} /> {t('yourCart')}
                                    </h3>

                                    {cart.length === 0 ? (
                                        <p className="text-center text-gray-400 py-8 text-sm italic">{t('cartEmpty')}</p>
                                    ) : (
                                        <ul className="space-y-3">
                                            {cart.map((item) => (
                                                <li key={item.id} className="flex gap-3 items-center bg-white p-2 rounded-lg border border-gray-100 shadow-sm">
                                                    <img src={item.image} alt={item.name} className="w-12 h-12 object-cover rounded-md" />
                                                    <div className="flex-grow min-w-0">
                                                        <p className="text-sm font-bold text-gray-800 truncate">{item.name}</p>
                                                        <p className="text-xs text-gray-500">${item.price.toFixed(2)} x {item.quantity}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => onRemoveFromCart(item.id)}
                                                        className="text-gray-400 hover:text-red-500 transition-colors p-1"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>

                                {cart.length > 0 && (
                                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200 shadow-inner">
                                        <div className="flex justify-between items-end mb-4">
                                            <span className="text-gray-500 text-sm">{t('total')}</span>
                                            <span className="text-2xl font-serif font-bold text-gray-900">${cartTotal.toFixed(2)}</span>
                                        </div>
                                        <AquaButton fullWidth onClick={onCheckout} className="!bg-blue-50">
                                            <Check size={16} /> {t('checkout')}
                                        </AquaButton>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="mt-8 text-center">
                            <p className="text-xs text-gray-400 font-serif">{t('bibleQuote')}</p>
                            <p className="text-[10px] text-gray-300 mt-1 uppercase tracking-widest">{t('bibleVerse')}</p>
                        </div>
                    </>
                )}
            </div>

            {/* Footer decoration */}
            <div className="h-2 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200"></div>
        </div>
    );
};
