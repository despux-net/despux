import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { LookBookImage } from '../types';
import { useLanguage } from '../context/LanguageContext';

const INITIAL_IMAGES = [
    "https://github.com/despux-net/divina-providentia/blob/main/PORTADA/PORTA1.jpg?raw=true",
    "https://github.com/despux-net/divina-providentia/blob/main/PORTADA/PORTA2.jpg?raw=true",
    "https://github.com/despux-net/divina-providentia/blob/main/PORTADA/PORTA3.jpg?raw=true",
    "https://github.com/despux-net/divina-providentia/blob/main/PORTADA/PORTA4.jpg?raw=true"
];

export const LookBook: React.FC = () => {
    const { t } = useLanguage();
    const [images, setImages] = useState<LookBookImage[]>([]);
    const sectionRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        fetchImages();

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                }
            },
            {
                threshold: 0.1
            }
        );

        if (sectionRef.current) {
            observer.observe(sectionRef.current);
        }

        return () => {
            if (sectionRef.current) {
                observer.unobserve(sectionRef.current);
            }
        };
    }, []);

    const fetchImages = async () => {
        const { data, error } = await supabase
            .from('lookbook_images')
            .select('*')
            .order('display_order', { ascending: true });

        if (error || !data || data.length === 0) {
            // Fallback to initial images if DB is empty or error (e.g. table doesn't exist yet)
            const fallbackImages: LookBookImage[] = INITIAL_IMAGES.map((url, index) => ({
                id: index, // temporary ID
                image_url: url,
                display_order: index
            }));
            setImages(fallbackImages);
        } else {
            setImages(data);
        }
    };

    return (
        <section
            ref={sectionRef}
            className={`
                relative w-full overflow-hidden py-16 bg-white
                transition-opacity duration-1000 ease-out
                ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}
            `}
        >
            <div className="flex items-center justify-between mb-8 px-6">
                <h3 className="text-3xl font-serif font-bold text-gray-900 border-l-4 border-gray-900 pl-4 tracking-tight">
                    {t('lookBookTitle')}
                </h3>
            </div>

            {/* Faded edges container */}
            <div className="relative w-full overflow-x-auto pb-6 hide-scrollbar group">
                {/* Blur Gradients */}
                <div className="absolute top-0 left-0 bottom-6 w-12 md:w-32 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none"></div>
                <div className="absolute top-0 right-0 bottom-6 w-12 md:w-32 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none"></div>

                <div className="flex gap-6 px-6 md:px-12 w-max mx-auto min-w-full justify-center">
                    {images.map((img, index) => (
                        <div
                            key={img.id}
                            className={`
                                relative w-[300px] h-[450px] md:w-[400px] md:h-[600px] flex-shrink-0 
                                rounded-lg overflow-hidden shadow-xl
                                transform transition-all duration-700 ease-out
                                hover:shadow-2xl hover:scale-[1.02]
                                ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'}
                            `}
                            style={{ transitionDelay: `${index * 150}ms` }}
                        >
                            <img
                                src={img.image_url}
                                alt={img.caption || `LookBook ${index + 1}`}
                                className="w-full h-full object-cover"
                                loading="lazy"
                            />
                            {/* Overlay */}
                            <div className="absolute inset-0 bg-black/10 hover:bg-transparent transition-colors duration-300"></div>
                        </div>
                    ))}
                </div>
            </div>

            <style>
                {`
                .hide-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .hide-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
                `}
            </style>
        </section>
    );
};
