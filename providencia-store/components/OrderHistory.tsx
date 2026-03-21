import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Order } from '../types';
import { Package, Smartphone, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { TranslationKey } from '../lib/translations';

export const OrderHistory: React.FC = () => {
    const { user } = useAuth();
    const { t } = useLanguage();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;

        const fetchOrders = async () => {
            const { data, error } = await supabase
                .from('orders')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching orders:', error);
            } else {
                setOrders(data || []);
            }
            setLoading(false);
        };

        fetchOrders();
    }, [user]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return 'text-green-600 bg-green-50 border-green-200';
            case 'processing': return 'text-blue-600 bg-blue-50 border-blue-200';
            case 'cancelled': return 'text-red-600 bg-red-50 border-red-200';
            default: return 'text-yellow-600 bg-yellow-50 border-yellow-200';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed': return <CheckCircle size={16} />;
            case 'processing': return <Package size={16} />;
            case 'cancelled': return <XCircle size={16} />;
            default: return <Clock size={16} />;
        }
    };

    const getStatusText = (status: string) => {
        const key = `status${status.charAt(0).toUpperCase() + status.slice(1)}` as TranslationKey;
        // Fallback if key doesn't exist (though strictly typed usually, here dynamic)
        try {
            return t(key);
        } catch {
            return status;
        }
    };

    if (loading) {
        return <div className="text-center py-8 text-gray-400">{t('loadingOrders')}</div>;
    }

    if (orders.length === 0) {
        return (
            <div className="text-center py-12 px-6 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                <Package size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500 font-medium">{t('noOrders')}</p>
                <p className="text-sm text-gray-400 mt-1">{t('noOrdersSubtitle')}</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-fadeIn">
            <h3 className="text-lg font-serif font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Package className="text-providencia-gold" /> {t('myOrders')}
            </h3>

            {orders.map((order) => (
                <div key={order.id} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-3">
                        <div>
                            <p className="text-xs text-gray-400 font-mono">#{order.id.slice(0, 8)}</p>
                            <p className="text-sm text-gray-500">
                                {new Date(order.created_at).toLocaleDateString()}
                            </p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1 border ${getStatusColor(order.status)}`}>
                            {getStatusIcon(order.status)}
                            {getStatusText(order.status)}
                        </span>
                    </div>

                    <div className="flex justify-between items-end border-t border-gray-50 pt-3">
                        <span className="text-sm text-gray-500">{t('total')}</span>
                        <span className="text-lg font-bold text-gray-900">${order.total_amount.toFixed(2)}</span>
                    </div>
                </div>
            ))}
        </div>
    );
};
