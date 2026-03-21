import React from 'react';
import { Product } from '../types';
import { AquaButton } from './AquaButton';
import { ShoppingBag, Edit } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface ProductCardProps {
    product: Product;
    onAddToCart: (product: Product) => void;
    isAdmin?: boolean;
    onEdit?: (product: Product) => void;
    onClick?: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart, isAdmin, onEdit, onClick }) => {
    const { t } = useLanguage();

    return (
        <div
            onClick={() => onClick && onClick(product)}
            className={`group relative bg-white/70 backdrop-blur-md border border-white/50 rounded-xl shadow-lg hover:shadow-xl transition-all duration-500 overflow-hidden flex flex-col h-full ${onClick ? 'cursor-pointer' : ''}`}
        >
            <div className="relative h-64 overflow-hidden bg-gray-100">
                <img
                    src={product.image}
                    alt={product.name}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                {isAdmin && onEdit && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onEdit(product); }}
                        className="absolute top-2 right-2 p-2 bg-white/90 rounded-full shadow-lg text-gray-700 hover:text-blue-600 transition-colors z-10"
                        title={t('editProduct')}
                    >
                        <Edit size={16} />
                    </button>
                )}
            </div>

            <div className="p-5 flex flex-col flex-grow">
                <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-serif font-bold text-gray-800 tracking-wide">{product.name}</h3>
                    <span className="text-gray-900 font-bold font-sans text-lg">${product.price.toFixed(2)}</span>
                </div>

                {product.sizes && product.sizes.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1">
                        {product.sizes.map(size => (
                            <span key={size} className="text-[10px] uppercase font-bold px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded">
                                {size}
                            </span>
                        ))}
                    </div>
                )}

                <p className="text-gray-500 text-sm mb-6 flex-grow leading-relaxed line-clamp-3">{product.description}</p>

                <div className="mt-auto pt-4 border-t border-gray-200/50">
                    <div onClick={(e) => e.stopPropagation()}>
                        <AquaButton fullWidth onClick={() => onAddToCart(product)}>
                            <ShoppingBag size={16} /> {t('addToCart')}
                        </AquaButton>
                    </div>
                </div>
            </div>
        </div>
    );
};
