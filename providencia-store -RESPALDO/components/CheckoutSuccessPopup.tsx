import React from 'react';
import { CheckCircle, X, Package } from 'lucide-react';
import { AquaButton } from './AquaButton';
import { useLanguage } from '../context/LanguageContext';

interface CheckoutSuccessPopupProps {
    isOpen: boolean;
    onClose: () => void;
}

export const CheckoutSuccessPopup: React.FC<CheckoutSuccessPopupProps> = ({ isOpen, onClose }) => {
    const { t } = useLanguage();
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scaleIn relative">
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <X size={20} />
                </button>

                <div className="p-8 text-center">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle size={40} className="text-green-600" />
                    </div>

                    <h3 className="text-2xl font-serif font-bold text-gray-900 mb-2">
                        {t('orderPlaced')}
                    </h3>

                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6">
                        <p className="text-gray-700 text-sm">
                            {t('orderManaging')}
                        </p>
                    </div>

                    <p className="text-gray-500 text-sm mb-8">
                        {t('checkOrderStatus')} <span className="font-bold text-gray-700">{t('ordersSection')}</span> {t('ofYourAccount')}
                    </p>

                    <AquaButton onClick={onClose} fullWidth>
                        <Package size={18} className="mr-2" />
                        {t('viewMyOrders')}
                    </AquaButton>
                </div>
            </div>
        </div>
    );
};
