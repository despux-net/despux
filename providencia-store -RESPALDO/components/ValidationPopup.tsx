import React from 'react';
import { Mail, CheckCircle, X } from 'lucide-react';
import { AquaButton } from './AquaButton';
import { useLanguage } from '../context/LanguageContext';

interface ValidationPopupProps {
    isOpen: boolean;
    onClose: () => void;
    email: string;
}

export const ValidationPopup: React.FC<ValidationPopupProps> = ({ isOpen, onClose, email }) => {
    const { t } = useLanguage();
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100">
                <div className="bg-gradient-to-r from-blue-50 to-white p-6 border-b border-gray-100 flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-blue-100 text-blue-500 rounded-full flex items-center justify-center mb-4 shadow-sm">
                        <Mail size={32} />
                    </div>
                    <h3 className="text-2xl font-serif font-bold text-gray-800">{t('verifyEmailTitle')}</h3>
                    <p className="text-gray-500 text-sm mt-2">
                        {t('verifyEmailSent')}
                    </p>
                    <p className="font-semibold text-gray-700 mt-1 bg-gray-100 px-3 py-1 rounded-full text-sm">
                        {email}
                    </p>
                </div>

                <div className="p-6 space-y-4">
                    <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-100">
                        <CheckCircle className="text-green-500 mt-0.5" size={20} />
                        <p className="text-sm text-gray-600">
                            {t('verifyEmailCheck')}
                        </p>
                    </div>

                    <AquaButton fullWidth onClick={onClose}>
                        {t('understood')}
                    </AquaButton>
                </div>

                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <X size={20} />
                </button>
            </div>
        </div>
    );
};
