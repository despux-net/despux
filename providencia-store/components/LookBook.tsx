import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { LookBookImage } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const INITIAL_IMAGES = [
    "https://github.com/despux-net/divina-providentia/blob/main/PORTADA/PORTA1.jpg?raw=true",
    "https://github.com/despux-net/divina-providentia/blob/main/PORTADA/PORTA2.jpg?raw=true",
    "https://github.com/despux-net/divina-providentia/blob/main/PORTADA/PORTA3.jpg?raw=true",
    "https://github.com/despux-net/divina-providentia/blob/main/PORTADA/PORTA4.jpg?raw=true"
];

export const LookBook: React.FC = () => {
    const { t } = useLanguage();
    const [images, setImages] = useState<LookBookImage[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        fetchImages();
    }, []);

    // Auto-play
    useEffect(() => {
        if (images.length <= 1) return;

        const timer = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % images.length);
        }, 5000); // Change image every 5 seconds

        return () => clearInterval(timer);
    }, [images.length]);

    const fetchImages = async () => {
        const { data, error } = await supabase
            .from('lookbook_images')
            .select('*')
            .order('display_order', { ascending: true });

        if (error || !data || data.length === 0) {
            const fallbackImages: LookBookImage[] = INITIAL_IMAGES.map((url, index) => ({
                id: index,
                image_url: url,
                display_order: index
            }));
            setImages(fallbackImages);
        } else {
            setImages(data);
        }
    };

    const nextImage = () => {
        setCurrentIndex((prev) => (prev + 1) % images.length);
    };

    const prevImage = () => {
        setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    };

    if (images.length === 0) return null;

    return (
        <section className="py-16 bg-white overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between mb-12">
                    <h3 className="text-4xl font-serif font-bold text-gray-900 border-l-4 border-gray-900 pl-6 tracking-tight">
                        {t('lookBookTitle')}
                    </h3>
                </div>

                <div className="relative w-full aspect-[4/3] md:aspect-[21/9] rounded-3xl overflow-hidden shadow-2xl group">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentIndex}
                            initial={{ opacity: 0, scale: 1.1 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 1.5, ease: "easeInOut" }}
                            className="absolute inset-0"
                        >
                            <img
                                src={images[currentIndex].image_url}
                                alt={images[currentIndex].caption || `LookBook ${currentIndex + 1}`}
                                className="w-full h-full object-cover"
                            />
                            {/* Overlay for text legibility */}
                            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent pointer-events-none"></div>
                        </motion.div>
                    </AnimatePresence>

                    {/* Navigation Buttons */}
                    <button
                        onClick={prevImage}
                        className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/40 transition-colors opacity-0 group-hover:opacity-100 duration-300"
                    >
                        <ChevronLeft size={32} />
                    </button>
                    <button
                        onClick={nextImage}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/40 transition-colors opacity-0 group-hover:opacity-100 duration-300"
                    >
                        <ChevronRight size={32} />
                    </button>

                    {/* Indicators */}
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3">
                        {images.map((_, idx) => (
                            <button
                                key={idx}
                                onClick={() => setCurrentIndex(idx)}
                                className={`w-3 h-3 rounded-full transition-all duration-300 ${idx === currentIndex
                                    ? 'bg-white w-8'
                                    : 'bg-white/50 hover:bg-white/80'
                                    }`}
                            />
                        ))}
                    </div>

                    {/* Caption */}
                    <AnimatePresence mode="wait">
                        {images[currentIndex].caption && (
                            <motion.div
                                key={`caption-${currentIndex}`}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                transition={{ delay: 0.5, duration: 0.8 }}
                                className="absolute bottom-12 left-12 right-12 text-center md:text-left z-10"
                            >
                                <p className="text-white font-serif text-2xl md:text-4xl font-light tracking-wide drop-shadow-lg">
                                    "{images[currentIndex].caption}"
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </section>
    );
};
