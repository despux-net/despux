import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { AquaButton } from './AquaButton';
import { Save, User, MapPin, Calendar, FileText } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export const ProfileEditor: React.FC = () => {
    const { user } = useAuth();
    const { t } = useLanguage();
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const [formData, setFormData] = useState({
        full_name: '',
        address: '',
        biography: '',
        date_of_birth: '',
        phone: ''
    });

    useEffect(() => {
        if (!user) return;

        const fetchProfile = async () => {
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();

                if (error && error.code !== 'PGRST116') {
                    throw error;
                }

                if (data) {
                    setFormData({
                        full_name: data.full_name || '',
                        address: data.address || '',
                        biography: data.biography || '',
                        date_of_birth: data.date_of_birth || '',
                        phone: data.phone || ''
                    });
                }
            } catch (error) {
                console.error('Error fetching profile:', error);
            } finally {
                setFetching(false);
            }
        };

        fetchProfile();
    }, [user]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setLoading(true);
        setMessage(null);

        try {
            const { error } = await supabase
                .from('profiles')
                .upsert({
                    id: user.id,
                    ...formData,
                    updated_at: new Date()
                });

            if (error) throw error;
            setMessage({ type: 'success', text: t('profileUpdated') });
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setLoading(false);
        }
    };

    if (fetching) return <div className="p-4 text-center text-gray-500">{t('loadingProfile')}</div>;

    return (
        <div className="space-y-4 animate-fadeIn">
            {message && (
                <div className={`p-3 rounded-lg text-sm border ${message.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                    {message.text}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase mb-1 ml-1">
                        <User size={12} /> {t('labelFullName')}
                    </label>
                    <input
                        type="text"
                        value={formData.full_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                        className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all shadow-inner"
                        placeholder={t('phName')}
                    />
                </div>

                <div>
                    <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase mb-1 ml-1">
                        <MapPin size={12} /> {t('labelAddress')}
                    </label>
                    <textarea
                        value={formData.address}
                        onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                        className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all shadow-inner resize-none h-20"
                        placeholder={t('phAddress')}
                    />
                </div>

                <div>
                    <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase mb-1 ml-1">
                        <Calendar size={12} /> {t('labelBirthDate')}
                    </label>
                    <input
                        type="date"
                        value={formData.date_of_birth}
                        onChange={(e) => setFormData(prev => ({ ...prev, date_of_birth: e.target.value }))}
                        className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all shadow-inner"
                    />
                </div>

                <div>
                    <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase mb-1 ml-1">
                        <FileText size={12} /> {t('labelBio')}
                    </label>
                    <textarea
                        value={formData.biography}
                        onChange={(e) => setFormData(prev => ({ ...prev, biography: e.target.value }))}
                        className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all shadow-inner resize-none h-24"
                        placeholder={t('phBio')}
                    />
                </div>

                <div>
                    <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase mb-1 ml-1">
                        <User size={12} /> {t('labelPhone')}
                    </label>
                    <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                        className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all shadow-inner"
                        placeholder="+52 555..."
                    />
                </div>

                <AquaButton fullWidth type="submit" disabled={loading}>
                    <Save size={16} /> {loading ? t('saving') : t('saveChanges')}
                </AquaButton>
            </form>
        </div>
    );
};
