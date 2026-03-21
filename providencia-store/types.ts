export interface Product {
    id: number;
    name: string;
    description: string;
    price: number;
    image: string;
    category: 'Gorras' | 'Camisetas' | 'Accesorios';
    sizes?: string[]; // Made optional to avoid breaking existing code immediately, but DB has it.
}

export interface User {
    id: string;
    email: string;
    name: string;
}

export interface UserProfile {
    id: string;
    full_name: string | null;
    address: string | null;
    biography: string | null;
    date_of_birth: string | null;
    email?: string;
    phone?: string;
}

export interface CartItem extends Product {
    quantity: number;
}

export interface Order {
    id: string;
    user_id: string;
    status: 'pending' | 'processing' | 'completed' | 'cancelled';
    total_amount: number;
    created_at: string;
}

export interface OrderItem {
    id: string;
    order_id: string;
    product_id: number;
    quantity: number;
    price_at_purchase: number;
}

export enum AuthView {
    LOGIN = 'LOGIN',
    REGISTER = 'REGISTER',
    PROFILE = 'PROFILE'
}

export enum SidebarView {
    CART = 'CART',
    PROFILE = 'PROFILE',
    ORDERS = 'ORDERS'
}

export interface SiteSettings {
    id: number;
    address: string;
    email: string;
    phone: string;
    facebook_url: string;
    instagram_url: string;
    twitter_url: string;
}

export interface LookBookImage {
    id: number;
    image_url: string;
    caption?: string;
    display_order: number;
    created_at?: string;
}
