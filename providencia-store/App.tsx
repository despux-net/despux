import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DivineCanvas } from './components/DivineCanvas';
import { ProductCard } from './components/ProductCard';
import { Sidebar } from './components/Sidebar';
import { AdminDashboard } from './components/AdminDashboard';
import { CheckoutSuccessPopup } from './components/CheckoutSuccessPopup';
import { ProductEditor } from './components/ProductEditor';
import { ProductDetailsModal } from './components/ProductDetailsModal';
import { LookBook } from './components/LookBook';
import { Footer } from './components/Footer';
import { Product, CartItem } from './types';
import { Menu } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { useLanguage } from './context/LanguageContext';
import { supabase } from './lib/supabase';

const App: React.FC = () => {
    // Auth state from context
    const { user } = useAuth();
    const { t, setLanguage, language } = useLanguage();

    // Derived Admin State
    const isAdmin = user?.email?.toLowerCase().trim() === 'despux@gmail.com';

    // Local state for Cart and UI
    const [products, setProducts] = useState<Product[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Default closed
    const [isMobile, setIsMobile] = useState(false);
    const [showAdmin, setShowAdmin] = useState(false);
    const [showCheckoutSuccess, setShowCheckoutSuccess] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

    // Responsive check
    useEffect(() => {
        let lastIsMobile = window.innerWidth < 1024;

        // Initial check
        const mobile = window.innerWidth < 1024;
        setIsMobile(mobile);
        // Sidebar stays closed by default on load

        const handleResize = () => {
            const currentIsMobile = window.innerWidth < 1024;

            // Only update if crossing the breakpoint
            if (currentIsMobile !== lastIsMobile) {
                setIsMobile(currentIsMobile);
                lastIsMobile = currentIsMobile;
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // ... (fetchProducts and syncCart logic remains consistent, skipping for brevity in this replacement chunk if possible, but simplest to keep context if small enough.
    // actually, I'll just skip to the render part for the button in a separate chunk to avoid huge replace)


    // Fetch Products
    const fetchProducts = async () => {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .order('id');

        if (error) {
            console.error('Error fetching products:', error);
        } else if (data) {
            // Transform DB arrays/types if needed. Supabase returns sizes as string[] usually if defined as such.
            setProducts(data);
        }
    };

    useEffect(() => {
        fetchProducts();
    }, []);

    // Sync Cart with Supabase
    useEffect(() => {
        if (!user) {
            setCart([]); // Clear cart on logout
            // We should still verify local storage if we wanted persistence without login, but current req implies cloud sync.
            return;
        }

        if (products.length === 0) return; // Wait for products to load

        const fetchCart = async () => {
            const { data, error } = await supabase
                .from('cart_items')
                .select('*')
                .eq('user_id', user.id);

            if (error) {
                console.error('Error fetching cart:', error);
                return;
            }

            if (data) {
                // Map DB items to full product details
                const items: CartItem[] = data.map(item => {
                    const product = products.find(p => p.id === item.product_id);
                    if (!product) return null;
                    return {
                        ...product,
                        quantity: item.quantity
                    };
                }).filter((item): item is CartItem => item !== null);

                setCart(items);
            }
        };

        fetchCart();
    }, [user, products]);

    const addToCart = async (product: Product) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                return prev.map(item =>
                    item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
                );
            }
            return [...prev, { ...product, quantity: 1 }];
        });

        if (isMobile) {
            setIsSidebarOpen(true);
        }

        // Sync with DB if logged in
        if (user) {
            try {
                const { data: existing, error: selectError } = await supabase
                    .from('cart_items')
                    .select('id, quantity')
                    .eq('user_id', user.id)
                    .eq('product_id', product.id)
                    .single();

                if (selectError && selectError.code !== 'PGRST116') {
                    throw selectError;
                }

                if (existing) {
                    await supabase
                        .from('cart_items')
                        .update({ quantity: existing.quantity + 1 })
                        .eq('id', existing.id);
                } else {
                    await supabase
                        .from('cart_items')
                        .insert({
                            user_id: user.id,
                            product_id: product.id,
                            quantity: 1
                        });
                }
            } catch (err) {
                console.error("Error syncing cart:", err);
            }
        }
    };

    const removeFromCart = async (id: number) => {
        setCart(prev => prev.filter(item => item.id !== id));

        if (user) {
            try {
                await supabase
                    .from('cart_items')
                    .delete()
                    .eq('user_id', user.id)
                    .eq('product_id', id);
            } catch (err) {
                console.error("Error removing from cart DB:", err);
            }
        }
    };

    const handleCheckout = async () => {
        if (!user) {
            alert(t('alertLogin'));
            if (isMobile) setIsSidebarOpen(true);
            return;
        }

        if (cart.length === 0) return;

        try {
            const total = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);

            // 1. Create Order
            const { data: orderData, error: orderError } = await supabase
                .from('orders')
                .insert({
                    user_id: user.id,
                    total_amount: total,
                    status: 'pending'
                })
                .select()
                .single();

            if (orderError) throw orderError;

            // 2. Create Order Items
            const orderItems = cart.map(item => ({
                order_id: orderData.id,
                product_id: item.id,
                quantity: item.quantity,
                price_at_purchase: item.price
            }));

            const { error: itemsError } = await supabase
                .from('order_items')
                .insert(orderItems);

            if (itemsError) throw itemsError;

            // 3. Clear Cart DB
            const { error: clearError } = await supabase
                .from('cart_items')
                .delete()
                .eq('user_id', user.id);

            if (clearError) throw clearError;

            // 4. Update UI
            setCart([]);
            setShowCheckoutSuccess(true);

        } catch (error) {
            console.error("Error during checkout:", error);
            alert(t('alertOrderError'));
        }
    };

    return (
        <div className="relative w-full h-screen overflow-hidden flex flex-col md:flex-row">
            <DivineCanvas />

            {/* Main Content Area */}
            <main className="flex-grow h-full overflow-y-auto relative z-10 transition-all duration-300">
                {/* Header */}
                <header className="sticky top-0 z-20 bg-white/70 backdrop-blur-md border-b border-white/50 px-6 py-4 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                                className="p-2 bg-white/50 rounded-full border border-gray-200 text-gray-800 hover:bg-gray-100 transition-colors relative"
                                title="Ver Carrito"
                            >
                                <Menu size={20} className="hidden" /> {/* Keep import but hide if strictly replacing, or better invoke ShoppingBag */}
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-shopping-bag"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
                                {cart.length > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                                        {cart.reduce((speech, item) => speech + item.quantity, 0)}
                                    </span>
                                )}
                            </button>
                            <div>
                                <h1 className="text-3xl font-serif font-bold text-gray-800 tracking-wider">{t('siteTitle')}</h1>
                                <p className="text-xs text-gray-500 font-sans tracking-widest uppercase">{t('siteSubtitle')}</p>
                            </div>
                        </div>
                    </div>

                    {/* Language Toggles */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setLanguage('en')}
                            className={`w-8 h-8 rounded-full overflow-hidden border-2 transition-transform hover:scale-110 ${language === 'en' ? 'border-providencia-gold scale-110' : 'border-transparent opacity-70 hover:opacity-100'}`}
                            title="English"
                        >
                            <img
                                src="https://flagcdn.com/w80/gb.png"
                                alt="English"
                                className="w-full h-full object-cover"
                            />
                        </button>
                        <button
                            onClick={() => setLanguage('es')}
                            className={`w-8 h-8 rounded-full overflow-hidden border-2 transition-transform hover:scale-110 ${language === 'es' ? 'border-providencia-gold scale-110' : 'border-transparent opacity-70 hover:opacity-100'}`}
                            title="Español"
                        >
                            <img
                                src="https://flagcdn.com/w80/es.png"
                                alt="Español"
                                className="w-full h-full object-cover"
                            />
                        </button>
                    </div>
                </header>

                {/* Hero / Banner */}
                <div className="px-6 py-8 md:py-16 space-y-12">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                        className="bg-gradient-to-r from-gray-50 via-white to-gray-50 rounded-3xl p-8 md:p-16 shadow-2xl border border-white relative overflow-hidden group"
                    >
                        {/* Subtle Background Texture/Pattern */}
                        <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>

                        {/* Subtle Overlay for Contrast */}
                        <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] z-0 pointer-events-none"></div>

                        <div className="relative z-10 max-w-2xl">
                            <motion.span
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.3, duration: 0.6 }}
                                className="inline-block text-gray-500 font-sans font-bold tracking-[0.2em] text-sm mb-4 uppercase"
                            >
                                {t('newCollection')}
                            </motion.span>
                            <motion.h2
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.5, duration: 0.8, ease: "easeOut" }}
                                className="text-5xl md:text-7xl font-serif font-bold text-gray-900 mb-6 leading-tight drop-shadow-sm"
                            >
                                {t('heroTitle')}
                            </motion.h2>
                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.8, duration: 0.8 }}
                                className="text-gray-600 text-lg md:text-xl mb-8 max-w-lg leading-relaxed mix-blend-multiply"
                            >
                                {t('heroSubtitle')}
                            </motion.p>
                            <motion.button
                                whileHover={{ scale: 1.05, boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)" }}
                                whileTap={{ scale: 0.95 }}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 1, duration: 0.5 }}
                                onClick={() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })}
                                className="bg-gray-900 text-white px-10 py-4 rounded-full font-bold shadow-lg hover:bg-gray-800 transition-all"
                            >
                                {t('viewCollection')}
                            </motion.button>
                        </div>

                        {/* Hero Image */}
                        <motion.div
                            initial={{ opacity: 0, x: 50, scale: 0.9 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            transition={{ delay: 0.6, duration: 1, ease: "circOut" }}
                            className="absolute right-0 bottom-0 top-0 w-1/2 hidden md:flex items-center justify-end pr-8 pointer-events-none"
                        >
                            <img
                                src="https://github.com/despux-net/divina-providentia/blob/main/DIVINA_PROVIDENTIA.png?raw=true"
                                alt="Divina Providentia"
                                className="object-contain h-[95%] w-auto opacity-95 mix-blend-multiply drop-shadow-2xl"
                            />
                        </motion.div>

                        {/* Abstract Decorative Circle - Adjusted */}
                        <motion.div
                            animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.3, 0.5] }}
                            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                            className="absolute -left-20 -bottom-40 w-96 h-96 bg-yellow-100/50 rounded-full blur-3xl z-0"
                        ></motion.div>
                    </motion.div>
                </div>

                {/* Products Grid */}
                <div id="products" className="px-6 pb-32">
                    <div className="flex items-center justify-between mb-12">
                        <h3 className="text-3xl font-serif font-bold text-gray-900 border-l-4 border-gray-900 pl-4 tracking-tight">
                            {t('catalogTitle')}
                        </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-8 md:gap-12">
                        {products.map(product => (
                            <ProductCard
                                key={product.id}
                                product={product}
                                onAddToCart={addToCart}
                                isAdmin={isAdmin}
                                onEdit={(p) => setEditingProduct(p)}
                                onClick={(p) => setSelectedProduct(p)}
                            />
                        ))}
                    </div>
                </div>

                {/* Look Book Section */}
                <LookBook />

                {/* Footer */}
                <Footer />
            </main >

            {/* Sidebar Panel */}
            < aside
                className={`
                    fixed inset-y-0 right-0 z-30 w-full sm:w-96 
                    transform transition-transform duration-300 ease-in-out shadow-2xl bg-white
                    ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}
                `}
            >
                <button
                    onClick={() => setIsSidebarOpen(false)}
                    className="absolute top-4 left-4 z-50 p-2 bg-white/80 rounded-full shadow-lg text-gray-600 hover:bg-gray-100"
                >
                    <Menu size={20} className="rotate-180" /> {/* Reuse Menu or X icon */}
                </button>
                <Sidebar
                    cart={cart}
                    onRemoveFromCart={removeFromCart}
                    onCheckout={handleCheckout}
                    onOpenAdmin={() => setShowAdmin(true)}
                />
            </aside >

            {/* Overlay for Mobile Sidebar */}
            {
                isMobile && isSidebarOpen && (
                    <div
                        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-20"
                        onClick={() => setIsSidebarOpen(false)}
                    />
                )
            }

            {/* Admin Dashboard Overlay */}
            {showAdmin && <AdminDashboard onClose={() => setShowAdmin(false)} />}

            {/* Editor Modal */}
            {
                editingProduct && (
                    <ProductEditor
                        product={editingProduct}
                        onClose={() => setEditingProduct(null)}
                        onSave={() => {
                            fetchProducts();
                            setEditingProduct(null);
                        }}
                    />
                )
            }

            {/* Checkout Success Popup */}
            <CheckoutSuccessPopup
                isOpen={showCheckoutSuccess}
                onClose={() => setShowCheckoutSuccess(false)}
            />

            {/* Product Details Modal */}
            <ProductDetailsModal
                product={selectedProduct}
                isOpen={!!selectedProduct}
                onClose={() => setSelectedProduct(null)}
                onAddToCart={(p) => {
                    addToCart(p);
                    setSelectedProduct(null);
                }}
            />
        </div >
    );
};

export default App;
