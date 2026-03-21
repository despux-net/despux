import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { SiteSettings } from '../types';
import { AquaButton } from './AquaButton';
import { Save, Loader, Globe, Mail, MapPin, Phone } from 'lucide-react';

export const FooterEditor: React.FC = () => {
    const [settings, setSettings] = useState<SiteSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        const { data } = await supabase.from('site_settings').select('*').single();
        if (data) setSettings(data);
        setLoading(false);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!settings) return;

        setSaving(true);
        try {
            // Exclude id from the update payload as it is an identity column
            const { id, updated_at, ...updateData } = settings;

            const { error } = await supabase
                .from('site_settings')
                .update(updateData)
                .eq('id', settings.id);

            if (error) throw error;
            alert('Configuración guardada correctamente');
        } catch (error) {
            console.error('Error saving settings:', error);
            alert('Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-center"><Loader className="animate-spin mx-auto" /></div>;

    // Wait for manual SQL execution fallback
    if (!settings && !loading) {
        return (
            <div className="p-8 text-center border-2 border-dashed border-gray-200 rounded-xl">
                <p className="text-gray-500 mb-4">No se encontró la configuración. Es posible que debas ejecutar el SQL de inicialización.</p>
                <button onClick={fetchSettings} className="text-blue-600 underline text-sm">Reintentar</button>
            </div>
        );
    }

    if (!settings) return null;

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 max-w-2xl mx-auto">
            <h3 className="text-lg font-serif font-bold text-gray-800 mb-6 flex items-center gap-2">
                <Globe size={20} className="text-blue-600" />
                Editar Pie de Página
            </h3>

            <form onSubmit={handleSave} className="space-y-6">
                <div className="space-y-4">
                    <h4 className="text-xs font-bold uppercase text-gray-400 tracking-wider">Información de Contacto</h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="relative">
                            <Mail size={16} className="absolute left-3 top-3 text-gray-400" />
                            <input
                                type="email"
                                value={settings.email}
                                onChange={e => setSettings({ ...settings, email: e.target.value })}
                                placeholder="Correo De Contacto"
                                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                            />
                        </div>
                        <div className="relative">
                            <Phone size={16} className="absolute left-3 top-3 text-gray-400" />
                            <input
                                type="text"
                                value={settings.phone}
                                onChange={e => setSettings({ ...settings, phone: e.target.value })}
                                placeholder="Teléfono"
                                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                            />
                        </div>
                    </div>

                    <div className="relative">
                        <MapPin size={16} className="absolute left-3 top-3 text-gray-400" />
                        <input
                            type="text"
                            value={settings.address}
                            onChange={e => setSettings({ ...settings, address: e.target.value })}
                            placeholder="Dirección Física"
                            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                        />
                    </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-gray-100">
                    <h4 className="text-xs font-bold uppercase text-gray-400 tracking-wider">Redes Sociales (URLs)</h4>

                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <span className="w-24 text-sm font-medium text-gray-600">Facebook</span>
                            <input
                                type="url"
                                value={settings.facebook_url}
                                onChange={e => setSettings({ ...settings, facebook_url: e.target.value })}
                                className="flex-grow px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-100 outline-none text-sm font-mono text-gray-600"
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="w-24 text-sm font-medium text-gray-600">Instagram</span>
                            <input
                                type="url"
                                value={settings.instagram_url}
                                onChange={e => setSettings({ ...settings, instagram_url: e.target.value })}
                                className="flex-grow px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-100 outline-none text-sm font-mono text-gray-600"
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="w-24 text-sm font-medium text-gray-600">Twitter (X)</span>
                            <input
                                type="url"
                                value={settings.twitter_url}
                                onChange={e => setSettings({ ...settings, twitter_url: e.target.value })}
                                className="flex-grow px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-100 outline-none text-sm font-mono text-gray-600"
                            />
                        </div>
                    </div>
                </div>

                <div className="pt-4 flex justify-end">
                    <AquaButton disabled={saving} type="submit">
                        {saving ? <Loader className="animate-spin" size={18} /> : <Save size={18} />}
                        <span className="ml-2">{saving ? 'Guardando...' : 'Guardar Cambios'}</span>
                    </AquaButton>
                </div>
            </form>
        </div>
    );
};
