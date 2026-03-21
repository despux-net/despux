import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { SiteSettings } from '../types';
import { Facebook, Instagram, Twitter, MapPin, Mail, Phone, Heart } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export const Footer: React.FC = () => {
    const { t } = useLanguage();
    const [settings, setSettings] = useState<SiteSettings | null>(null);

    useEffect(() => {
        const fetchSettings = async () => {
            const { data, error } = await supabase
                .from('site_settings')
                .select('*')
                .single();

            if (!error && data) {
                setSettings(data);
            }
        };

        fetchSettings();
    }, []);

    const [formStatus, setFormStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setFormStatus('submitting');

        const form = e.currentTarget;
        const formData = new FormData(form);

        try {
            const response = await fetch('https://formspree.io/f/mjgbodyd', {
                method: 'POST',
                body: formData,
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (response.ok) {
                setFormStatus('success');
                form.reset();
            } else {
                setFormStatus('error');
            }
        } catch (error) {
            setFormStatus('error');
        }
    };

    // Placeholder data if no DB data yet (or table missing)
    const displaySettings = settings || {
        address: 'Calle Principal 123, Ciudad',
        email: 'contacto@divinaprovidentia.com',
        phone: '+58 123 456 789',
        facebook_url: '#',
        instagram_url: '#',
        twitter_url: '#'
    };

    return (
        <footer className="bg-gray-900 text-white pt-16 pb-8 border-t border-gray-800">
            <div className="container mx-auto px-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 mb-12">
                    {/* Brand Section */}
                    <div className="space-y-4 lg:col-span-3">
                        <h2 className="text-2xl font-serif font-bold tracking-wider text-white">
                            DIVINA PROVIDENTIA
                        </h2>
                        <p className="text-gray-400 text-sm leading-relaxed">
                            {t('footerBrand')}
                        </p>
                    </div>

                    {/* Contact Info */}
                    <div className="space-y-4 lg:col-span-3">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">{t('footerContact')}</h3>
                        <div className="space-y-3">
                            <div className="flex items-start gap-3 text-gray-400 hover:text-white transition-colors">
                                <MapPin size={18} className="mt-1 flex-shrink-0" />
                                <span className="text-sm">{displaySettings.address}</span>
                            </div>
                            <div className="flex items-center gap-3 text-gray-400 hover:text-white transition-colors">
                                <Mail size={18} />
                                <a href={`mailto:${displaySettings.email}`} className="text-sm">{displaySettings.email}</a>
                            </div>
                            <div className="flex items-center gap-3 text-gray-400 hover:text-white transition-colors">
                                <Phone size={18} />
                                <span className="text-sm">{displaySettings.phone}</span>
                            </div>
                        </div>
                    </div>

                    {/* Social Media */}
                    <div className="space-y-4 lg:col-span-2">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">{t('footerFollow')}</h3>
                        <div className="flex gap-4 flex-wrap">
                            <a href={displaySettings.facebook_url} target="_blank" rel="noopener noreferrer"
                                className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 hover:bg-white hover:text-gray-900 transition-all transform hover:-translate-y-1">
                                <Facebook size={20} />
                            </a>
                            <a href={displaySettings.instagram_url} target="_blank" rel="noopener noreferrer"
                                className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 hover:bg-white hover:text-gray-900 transition-all transform hover:-translate-y-1">
                                <Instagram size={20} />
                            </a>
                            <a href={displaySettings.twitter_url} target="_blank" rel="noopener noreferrer"
                                className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 hover:bg-white hover:text-gray-900 transition-all transform hover:-translate-y-1">
                                <Twitter size={20} />
                            </a>
                        </div>
                    </div>

                    {/* Contact Drawer/Form - Light & Friendly Theme */}
                    <div className="lg:col-span-4 bg-white p-6 rounded-lg shadow-xl relative overflow-hidden group">
                        {/* Decorative background element */}
                        <div className="absolute top-0 right-0 w-24 h-24 bg-providencia-gold/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>

                        <h3 className="text-lg font-serif font-bold text-gray-800 mb-1 relative z-10">{t('footerFormTitle')}</h3>
                        <p className="text-xs text-gray-500 mb-4 relative z-10">{t('footerFormSubtitle')}</p>

                        {formStatus === 'success' ? (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center animate-fade-in py-10">
                                <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3">
                                    <Heart size={24} className="text-green-600" fill="currentColor" />
                                </div>
                                <div className="text-green-800 text-lg font-medium mb-1">{t('footerSuccessTitle')}</div>
                                <p className="text-gray-600 text-sm mb-4">{t('footerSuccessMsg')}</p>
                                <button
                                    onClick={() => setFormStatus('idle')}
                                    className="text-sm font-medium text-providencia-gold hover:text-yellow-700 underline transition-colors"
                                >
                                    {t('footerSendAnother')}
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-3 relative z-10">
                                <div className="grid grid-cols-2 gap-3">
                                    <input
                                        type="text"
                                        name="name"
                                        placeholder={t('footerNamePlaceholder')}
                                        required
                                        className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-providencia-gold focus:ring-1 focus:ring-providencia-gold transition-all hover:bg-white"
                                    />
                                    <input
                                        type="email"
                                        name="email"
                                        placeholder={t('footerEmailPlaceholder')}
                                        required
                                        className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-providencia-gold focus:ring-1 focus:ring-providencia-gold transition-all hover:bg-white"
                                    />
                                </div>
                                <div>
                                    <textarea
                                        name="message"
                                        placeholder={t('footerMessagePlaceholder')}
                                        required
                                        rows={2}
                                        className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-providencia-gold focus:ring-1 focus:ring-providencia-gold transition-all hover:bg-white resize-none"
                                    ></textarea>
                                </div>
                                <button
                                    type="submit"
                                    disabled={formStatus === 'submitting'}
                                    className="w-full bg-providencia-gold hover:bg-yellow-600 text-white font-medium py-2 px-4 rounded shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
                                >
                                    {formStatus === 'submitting' ? t('footerSending') : t('footerSendButton')}
                                </button>
                                {formStatus === 'error' && (
                                    <p className="text-red-500 text-xs text-center mt-1">{t('footerErrorMsg')}</p>
                                )}
                            </form>
                        )}
                    </div>
                </div>

                <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-xs text-gray-500 font-sans">
                        © {new Date().getFullYear()} Divina Providentia. {t('footerRights')}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                        <span>{t('madeWith')}</span>
                        <Heart size={12} className="text-red-900" fill="currentColor" />
                        <span>{t('forGlory')}</span>
                    </div>
                </div>
            </div>
        </footer>
    );
};
