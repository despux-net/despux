import React, { useState } from 'react';
import { TranslationKeys } from '../types';
import { User } from '@supabase/supabase-js';

interface HomeViewProps {
    t: TranslationKeys;
    onAccess: () => void;
    user: User | null;
}

const HomeView: React.FC<HomeViewProps> = ({ t, onAccess, user }) => {
    const [formStatus, setFormStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setFormStatus('submitting');

        const form = e.currentTarget;
        const data = new FormData(form);

        try {
            const response = await fetch("https://formspree.io/f/mnnebelz", {
                method: "POST",
                body: data,
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

    return (
        <div className="w-full h-full flex flex-col no-scrollbar overflow-y-auto overflow-x-hidden">
            {/* Hero Section */}
            <section className="flex-1 flex flex-col justify-center items-center text-center px-5 py-20 min-h-[60vh] relative z-10">
                <h1
                    className="text-4xl md:text-6xl font-bold mb-5 leading-tight max-w-4xl drop-shadow-lg"
                    dangerouslySetInnerHTML={{ __html: t.hero_title }}
                />
                <p className="text-lg md:text-xl text-textMuted max-w-xl mb-12 drop-shadow-md">
                    {t.hero_desc}
                </p>

                {user ? (
                    <div className="mt-8 flex flex-col items-center animate-fade-in-up">
                        <span className="text-primary text-xl font-bold tracking-widest uppercase mb-2">
                            {t.welcome_user}
                        </span>
                        <span className="text-3xl font-bold text-textMain mb-8">
                            {user.user_metadata.full_name || user.email?.split('@')[0]}
                        </span>

                        <button
                            onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'project_request' }))}
                            className="px-8 py-3 bg-bgSurface border border-primary/50 text-textMain font-bold tracking-wider hover:bg-primary hover:text-white transition-all duration-300 rounded shadow-[0_0_15px_rgba(0,102,204,0.2)] hover:shadow-[0_0_25px_rgba(255,255,0,0.5)] flex items-center gap-2"
                        >
                            <span>🚀</span> START NEW PROJECT / QUOTE
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={onAccess}
                        className="mt-8 px-10 py-4 bg-primary text-white font-bold tracking-widest hover:opacity-90 hover:scale-105 transition-all duration-300 rounded shadow-[0_0_20px_rgba(255,255,0,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.6)]"
                    >
                        {t.btn_access}
                    </button>
                )}
            </section>

            {/* Contact Section */}
            <section className="bg-bgSurface py-16 px-10 border-t border-border z-20">
                <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-start">

                    <div className="flex flex-col gap-4">
                        <h3 className="text-3xl font-bold text-textMain">{t.contact_title}</h3>
                        <p className="text-textMuted text-base leading-relaxed">
                            {t.contact_desc}
                        </p>
                    </div>

                    <div className="w-full">
                        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
                            <input
                                type="email"
                                name="email"
                                placeholder={t.input_email}
                                className="w-full bg-bgBody border border-border p-4 text-textMain text-sm rounded focus:outline-none focus:border-primary transition-colors disabled:opacity-50"
                                required
                                disabled={formStatus === 'submitting' || formStatus === 'success'}
                            />
                            <textarea
                                name="message"
                                rows={4}
                                placeholder={t.input_msg}
                                className="w-full bg-bgBody border border-border p-4 text-textMain text-sm rounded focus:outline-none focus:border-primary transition-colors resize-y disabled:opacity-50"
                                required
                                disabled={formStatus === 'submitting' || formStatus === 'success'}
                            />

                            {formStatus === 'success' ? (
                                <div className="p-4 bg-green-500/10 border border-green-500 text-green-500 rounded text-center font-bold animate-fade-in-up">
                                    Message Sent Successfully!
                                </div>
                            ) : (
                                <button
                                    type="submit"
                                    disabled={formStatus === 'submitting'}
                                    className="self-start bg-textMain text-bgSurface font-bold py-3 px-6 rounded-sm hover:opacity-90 hover:scale-105 transition-all transform disabled:opacity-50"
                                >
                                    {formStatus === 'submitting' ? 'Sending...' : t.btn_send}
                                </button>
                            )}

                            {formStatus === 'error' && (
                                <div className="text-red-500 text-sm mt-2">
                                    Something went wrong. Please try again.
                                </div>
                            )}
                        </form>
                    </div>

                </div>
            </section>

            <footer className="py-8 px-10 text-center text-sm text-textMuted bg-bgSurface border-t border-border">
                <div dangerouslySetInnerHTML={{ __html: t.footer_rights }}></div>
                <div className="mt-1 italic opacity-70">{t.footer_dev}</div>
            </footer>
        </div>
    );
};

export default HomeView;