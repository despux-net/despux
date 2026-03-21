import React, { useState } from 'react';
import { Product } from '../types';
import { X, Save, Upload } from 'lucide-react';
import { AquaButton } from './AquaButton';
import { supabase } from '../lib/supabase';

interface ProductEditorProps {
    product: Product;
    onClose: () => void;
    onSave: () => void;
}

export const ProductEditor: React.FC<ProductEditorProps> = ({ product, onClose, onSave }) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: product.name,
        description: product.description,
        price: product.price,
        image: product.image,
        category: product.category,
        sizes: product.sizes ? product.sizes.join(', ') : ''
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const updates = {
                name: formData.name,
                description: formData.description,
                price: parseFloat(formData.price.toString()),
                image: formData.image,
                category: formData.category,
                sizes: formData.sizes.split(',').map(s => s.trim()).filter(s => s)
            };

            const { error } = await supabase
                .from('products')
                .update(updates)
                .eq('id', product.id);

            if (error) throw error;

            onSave();
            onClose();
        } catch (error) {
            console.error("Error updating product:", error);
            alert("Error al actualizar el producto");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-scaleIn">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-800">Editar Producto</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre</label>
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-100 outline-none"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Precio</label>
                            <input
                                type="number"
                                step="0.01"
                                name="price"
                                value={formData.price}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-100 outline-none"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Categoría</label>
                            <select
                                name="category"
                                value={formData.category}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-100 outline-none"
                            >
                                <option value="Gorras">Gorras</option>
                                <option value="Camisetas">Camisetas</option>
                                <option value="Accesorios">Accesorios</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Talles (separados por coma)</label>
                        <input
                            type="text"
                            name="sizes"
                            value={formData.sizes}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-100 outline-none"
                            placeholder="S, M, L, XL"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">URL Imagen</label>
                        <input
                            type="url"
                            name="image"
                            value={formData.image}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-100 outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Descripción</label>
                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            rows={3}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-100 outline-none resize-none"
                        />
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-500 hover:text-gray-700 font-medium"
                        >
                            Cancelar
                        </button>
                        <AquaButton type="submit" disabled={loading}>
                            <Save size={16} className="mr-2" />
                            {loading ? 'Guardando...' : 'Guardar Cambios'}
                        </AquaButton>
                    </div>
                </form>
            </div>
        </div>
    );
};
