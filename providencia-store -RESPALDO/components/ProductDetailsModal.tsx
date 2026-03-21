import React, { useState, useRef, useEffect } from 'react';
import { Product } from '../types';
import { AquaButton } from './AquaButton';
import { ShoppingBag, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface ProductDetailsModalProps {
    product: Product | null;
    isOpen: boolean;
    onClose: () => void;
    onAddToCart: (product: Product) => void;
}

export const ProductDetailsModal: React.FC<ProductDetailsModalProps> = ({ product, isOpen, onClose, onAddToCart }) => {
    const { t } = useLanguage();
    const [isHovering, setIsHovering] = useState(false);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const imageContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            // Reset hover state when opening a new product
            setIsHovering(false);
        } else {
            document.body.style.overflow = 'auto';
        }
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, [isOpen]);

    if (!isOpen || !product) return null;

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!imageContainerRef.current) return;

        const { left, top, width, height } = imageContainerRef.current.getBoundingClientRect();
        const x = ((e.clientX - left) / width) * 100;
        const y = ((e.clientY - top) / height) * 100;

        setMousePosition({ x, y });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal Container */}
            <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row animate-in fade-in zoom-in duration-300">
                {/* Close Button - Mobile: Top Right, Desktop: Absolute Top Right of Container */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-20 p-2 bg-black/10 hover:bg-black/20 rounded-full transition-colors text-gray-800"
                >
                    <X size={24} />
                </button>

                {/* Left: Image with Zoom */}
                <div className="w-full md:w-1/2 bg-gray-100 relative h-64 md:h-[500px] overflow-hidden group">
                    {/* 
                        Zoom Logic:
                        We have two layers: 
                        1. The normal image (visible when not hovering).
                        2. The zoomed image (visible when hovering).
                        
                        Or simpler single-element approach:
                        Scale the image and translate it based on mouse position.
                     */}

                    <div
                        ref={imageContainerRef}
                        className="w-full h-full relative cursor-zoom-in"
                        onMouseEnter={() => setIsHovering(true)}
                        onMouseLeave={() => setIsHovering(false)}
                        onMouseMove={handleMouseMove}
                    >
                        <img
                            src={product.image}
                            alt={product.name}
                            className={`w-full h-full object-contain transition-transform duration-200 ease-out origin-center
                                ${isHovering ? 'scale-[2.5]' : 'scale-100'}
                            `}
                            style={isHovering ? {
                                transformOrigin: `${mousePosition.x}% ${mousePosition.y}%`
                            } : undefined}
                        />
                    </div>

                    {/* Hint for Zoom */}
                    <div className={`absolute bottom-4 right-4 bg-white/80 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-gray-600 pointer-events-none transition-opacity duration-300 ${isHovering ? 'opacity-0' : 'opacity-100'}`}>
                        {t('hoverZoom')}
                    </div>
                </div>

                {/* Right: Details */}
                <div className="w-full md:w-1/2 p-8 flex flex-col justify-center bg-white/80 backdrop-blur overflow-y-auto max-h-[50vh] md:max-h-full">
                    <div className="mb-2">
                        <span className="text-sm font-bold tracking-widest text-blue-600 uppercase border-b-2 border-blue-600 pb-1">
                            {product.category}
                        </span>
                    </div>

                    <h2 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 mb-4">{product.name}</h2>

                    <div className="text-2xl font-sans font-bold text-gray-900 mb-6">
                        ${product.price.toFixed(2)}
                    </div>

                    <p className="text-gray-600 leading-relaxed mb-8 text-lg">
                        {product.description}
                    </p>

                    {product.sizes && product.sizes.length > 0 && (
                        <div className="mb-8">
                            <h4 className="font-bold text-gray-900 mb-3 text-sm uppercase tracking-wide">{t('availableSizes')}</h4>
                            <div className="flex gap-2">
                                {product.sizes.map(size => (
                                    <span key={size} className="px-4 py-2 border border-gray-300 text-gray-700 font-bold rounded-lg hover:border-gray-900 transition-colors cursor-default">
                                        {size}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="mt-auto pt-6 border-t border-gray-100">
                        <AquaButton onClick={() => onAddToCart(product)} fullWidth>
                            <ShoppingBag className="mr-2" size={20} />
                            {t('addToCart')}
                        </AquaButton>
                    </div>
                </div>
            </div>
        </div>
    );
};
