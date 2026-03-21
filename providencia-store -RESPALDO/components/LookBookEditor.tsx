import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { LookBookImage } from '../types';
import { Trash2, Plus, Image as ImageIcon, Save } from 'lucide-react';
import { AquaButton } from './AquaButton';

export const LookBookEditor: React.FC = () => {
    const [images, setImages] = useState<LookBookImage[]>([]);
    const [loading, setLoading] = useState(false);

    // New Image state
    const [newUrl, setNewUrl] = useState('');
    const [newCaption, setNewCaption] = useState('');
    const [newOrder, setNewOrder] = useState(0);

    useEffect(() => {
        fetchImages();
    }, []);

    const fetchImages = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('lookbook_images')
            .select('*')
            .order('display_order', { ascending: true });

        if (data) {
            setImages(data);
            // Auto-increment order suggestion
            const maxOrder = Math.max(...data.map(i => i.display_order), -1);
            setNewOrder(maxOrder + 1);
        }
        setLoading(false);
    };

    const handleAdd = async () => {
        if (!newUrl) return alert("Ingresa una URL de imagen");

        try {
            const { error } = await supabase
                .from('lookbook_images')
                .insert({
                    image_url: newUrl,
                    caption: newCaption,
                    display_order: newOrder
                });

            if (error) throw error;

            setNewUrl('');
            setNewCaption('');
            fetchImages(); // Refresh
        } catch (err) {
            console.error("Error adding image:", err);
            alert("Error al guardar imagen. Verifica permisos o consola.");
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("¿Eliminar esta imagen del LookBook?")) return;

        try {
            const { error } = await supabase
                .from('lookbook_images')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setImages(prev => prev.filter(img => img.id !== id));
        } catch (err) {
            console.error("Error deleting image:", err);
            alert("Error al eliminar.");
        }
    };

    return (
        <div className="space-y-8 p-6 bg-white rounded-xl shadow-sm border border-gray-200">
            <div>
                <h2 className="text-xl font-serif font-bold text-gray-800">Editor LookBook</h2>
                <p className="text-sm text-gray-500">Gestiona las imágenes de la galería inferior.</p>
            </div>

            {/* Add New */}
            <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 space-y-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <Plus size={14} /> Agregar Nueva Imagen
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-600">URL Imagen</label>
                        <input
                            value={newUrl}
                            onChange={(e) => setNewUrl(e.target.value)}
                            placeholder="https://..."
                            className="w-full p-2 border rounded-lg text-sm bg-white"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-600">Orden</label>
                        <input
                            type="number"
                            value={newOrder}
                            onChange={(e) => setNewOrder(Number(e.target.value))}
                            className="w-full p-2 border rounded-lg text-sm bg-white"
                        />
                    </div>
                    <div className="col-span-full space-y-1">
                        <label className="text-xs font-bold text-gray-600">Leyenda (Opcional)</label>
                        <input
                            value={newCaption}
                            onChange={(e) => setNewCaption(e.target.value)}
                            placeholder="Descripción..."
                            className="w-full p-2 border rounded-lg text-sm bg-white"
                        />
                    </div>
                </div>
                <div className="flex justify-end">
                    <AquaButton onClick={handleAdd}>Guardar Imagen</AquaButton>
                </div>

                {/* Preview */}
                {newUrl && (
                    <div className="mt-4 p-2 border bg-white rounded-lg inline-block">
                        <p className="text-xs text-center mb-1 text-gray-400">Vista Previa</p>
                        <img src={newUrl} alt="Preview" className="h-32 w-auto object-cover rounded" onError={(e) => (e.currentTarget.style.display = 'none')} />
                    </div>
                )}
            </div>

            {/* List */}
            <div className="space-y-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <ImageIcon size={14} /> Imágenes Actuales ({images.length})
                </h3>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {loading ? <p className="text-sm text-gray-500">Cargando...</p> : images.map(img => (
                        <div key={img.id} className="group relative bg-white border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                            <div className="aspect-[2/3] bg-gray-100">
                                <img src={img.image_url} alt={img.caption} className="w-full h-full object-cover" />
                            </div>
                            <div className="p-3 bg-white border-t relative">
                                <p className="text-xs font-bold text-gray-700 truncate">{img.caption || 'Sin leyenda'}</p>
                                <p className="text-xs text-gray-400">Orden: {img.display_order}</p>
                            </div>

                            {/* Actions Overlay */}
                            <div className="absolute inset-x-0 top-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity flex justify-end bg-gradient-to-b from-black/20 to-transparent">
                                <button
                                    onClick={() => handleDelete(img.id)}
                                    className="p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-sm"
                                    title="Eliminar"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
