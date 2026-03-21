import React, { useState } from 'react';
import { TranslationKeys } from '../types';
import { supabase } from '../supabaseClient';
import Modal from './Modal';

interface AuthViewProps {
    t: TranslationKeys;
    isVisible: boolean;
    onBack: () => void;
    isAdmin: boolean;
    setIsAdmin: (isAdmin: boolean) => void;
}

const AuthView: React.FC<AuthViewProps> = ({ t, isVisible, onBack, isAdmin, setIsAdmin }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);

    const [mfaChallengeId, setMfaChallengeId] = useState('');
    const [mfaFactorId, setMfaFactorId] = useState('');
    const [showMfaInput, setShowMfaInput] = useState(false);
    const [mfaCode, setMfaCode] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log("--- START LOGIN ---");
        console.log("isAdmin Request:", isAdmin);
        setLoading(true);

        try {
            // 1. Sign in with password
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            console.log("Password Login Successful:", data.user?.id);

            // 2. If Admin Mode requested, check MFA
            if (isAdmin) {
                console.log(">>> ADMIN MODE CHECK <<<");

                // Refresh session to ensure we see the latest factors
                const { error: refreshError } = await supabase.auth.refreshSession();
                if (refreshError) console.warn("Session Refresh Warning:", refreshError);

                const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
                console.log("Factors API Response:", factors, factorsError);

                if (factorsError) {
                    alert("Security Error (ListFactors): " + factorsError.message);
                    throw factorsError;
                }

                const totpFactor = factors?.totp?.find(f => f.status === 'verified');
                console.log("Verified Factor Found:", totpFactor);

                if (!totpFactor) {
                    console.warn("No verified TOTP factor found.");

                    const userWantsSetup = confirm(
                        "⚠️ ADMIN ACCESS DENIED\n\n" +
                        "No verified Two-Factor Authentication (2FA) found for this account.\n\n" +
                        "You must set up Google Authenticator in your Profile to access Admin Mode.\n\n" +
                        "Click OK to go to your Profile now, or Cancel to log in as a regular user."
                    );

                    setIsAdmin(false);

                    if (userWantsSetup) {
                        // Ideally we would navigate to profile, but onBack goes to home.
                        // The user needs to click "Profile" manually after this.
                        onBack();
                        setTimeout(() => alert("Please click on 'My Profile' and then 'Setup Google Authenticator'."), 500);
                    } else {
                        onBack();
                    }
                    return;
                }

                // 3. Challenge MFA
                console.log("Challenging Factor ID:", totpFactor.id);
                const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
                    factorId: totpFactor.id
                });

                if (challengeError) {
                    alert("MFA Challenge Error: " + challengeError.message);
                    throw challengeError;
                }

                console.log("Challenge Created:", challengeData);
                setMfaChallengeId(challengeData.id);
                setMfaFactorId(totpFactor.id); // Store the factor ID for verification
                setMfaCode('');
                setShowMfaInput(true); // Show the code input screen
                return; // STOP HERE -> Wait for user to input code
            }

            // Normal login (not admin)
            console.log("Regular User Login");
            onBack();
        } catch (error: any) {
            console.error("Login Exception:", error.message);
            alert("Login Error: " + error.message);
        } finally {
            // Only turn off loading if NOT waiting for MFA input
            if (!showMfaInput) setLoading(false);
        }
    };

    const verifyMfa = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log("Verifying MFA Code...", mfaCode);
        console.log("Using Factor ID:", mfaFactorId);
        console.log("Using Challenge ID:", mfaChallengeId);
        setLoading(true);

        try {
            // 4. Verify MFA Code
            const { data, error } = await supabase.auth.mfa.verify({
                factorId: mfaFactorId,
                challengeId: mfaChallengeId, // verify takes factorId and challengeId matches
                code: mfaCode
            });

            // NOTE: The verify API arguments are a bit tricky in some versions of the client.
            // Usually it's { factorId, challengeId, code } OR { sessionid... }
            // Let's rely on standard method.

            if (error) throw error;

            console.log("MFA Verified Success:", data);
            onBack(); // Go home as verified admin
        } catch (error: any) {
            console.error("MFA Verify Error:", error.message);
            alert("Invalid Code: " + error.message);
            setLoading(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: name,
                    },
                },
            });

            if (error) throw error;
            console.log("Registration Successful:", data);
            setShowModal(true);
        } catch (error: any) {
            console.error("Registration Error:", error.message);
            alert("Registration Error: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`w-full h-full flex flex-col items-center justify-center p-4 transition-all duration-700 ease-out ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <Modal
                isOpen={showModal}
                title={t.auth_register_title}
                message={t.auth_reg_success}
                onClose={() => setShowModal(false)}
            />
            <div className="w-full max-w-md bg-bgSurface border border-border rounded-lg p-8 shadow-2xl backdrop-blur-md">
                <h2 className="text-3xl font-bold text-center mb-6 text-textMain">
                    {isLogin ? t.auth_login_title : t.auth_register_title}
                </h2>

                <form onSubmit={isLogin ? handleLogin : handleRegister} className="flex flex-col gap-4">
                    {showMfaInput ? (
                        <div className="animate-fade-in-up">
                            <p className="text-center text-textMuted text-sm mb-4">
                                Enter the code from your Authenticator App to access Admin Mode.
                            </p>
                            <div className="flex flex-col gap-4">
                                <input
                                    type="text"
                                    placeholder="000000"
                                    value={mfaCode}
                                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    className="w-full text-center text-3xl tracking-[0.5em] bg-bgBody border border-primary text-primary font-mono py-4 rounded focus:outline-none shadow-[0_0_15px_rgba(255,255,0,0.2)]"
                                    autoFocus
                                />
                                <button
                                    onClick={verifyMfa}
                                    disabled={mfaCode.length !== 6 || loading}
                                    className="mt-2 bg-primary text-white font-bold py-3 rounded hover:opacity-90 transition-colors duration-300 disabled:opacity-50"
                                >
                                    {loading ? 'Verifying...' : 'VERIFY ACCESS'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {!isLogin && (
                                <div>
                                    <label className="block text-xs uppercase tracking-wider text-textMuted mb-1">{t.auth_name}</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full bg-bgBody border border-border rounded px-4 py-2 text-textMain focus:outline-none focus:border-primary transition-colors"
                                        required
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-xs uppercase tracking-wider text-textMuted mb-1">{t.auth_email}</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-bgBody border border-border rounded px-4 py-2 text-textMain focus:outline-none focus:border-primary transition-colors"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs uppercase tracking-wider text-textMuted mb-1">{t.auth_pass}</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-bgBody border border-border rounded px-4 py-2 text-textMain focus:outline-none focus:border-primary transition-colors"
                                    required
                                />
                            </div>

                            {isLogin && (
                                <div className="flex items-center gap-2 mt-2">
                                    <input
                                        type="checkbox"
                                        id="adminToggle"
                                        checked={isAdmin}
                                        onChange={(e) => setIsAdmin(e.target.checked)}
                                        className="accent-primary w-4 h-4 cursor-pointer"
                                    />
                                    <label htmlFor="adminToggle" className="text-sm text-textMuted cursor-pointer select-none">
                                        {t.auth_admin_mode}
                                    </label>
                                </div>
                            )}

                            <button
                                type="submit"
                                className="mt-4 bg-primary text-white font-bold py-3 rounded hover:opacity-90 transition-colors duration-300"
                            >
                                {isLogin ? t.auth_btn_login : t.auth_btn_register}
                            </button>
                        </>
                    )}
                </form>

                <div className="mt-6 text-center space-y-2">
                    <button
                        onClick={() => setIsLogin(!isLogin)}
                        className="text-sm text-textMuted hover:text-textMain transition-colors block w-full"
                    >
                        {isLogin ? t.auth_switch_to_register : t.auth_switch_to_login}
                    </button>

                    <button
                        onClick={onBack}
                        className="text-xs text-textMuted/60 hover:text-textMain transition-colors border-t border-border pt-4 w-full"
                    >
                        {t.auth_back_home}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AuthView;
