import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { PRODUCTS } from '../constants';
import { User, ShoppingCart, X, Eye, Package, CheckCircle, Clock, AlertCircle, Trash2 } from 'lucide-react';
import { AquaButton } from './AquaButton';
import { Order, OrderItem } from '../types';
import { FooterEditor } from './FooterEditor';
import { LookBookEditor } from './LookBookEditor';

interface OrderWithDetails extends Order {
    profile?: {
        full_name: string | null;
        address: string | null;
        email: string | null;
        phone: string | null;
    };
    items: (OrderItem & { product_name?: string; product_image?: string })[];
}

export const AdminDashboard: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [orders, setOrders] = useState<OrderWithDetails[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | null>(null);
    const [tab, setTab] = useState<'orders' | 'settings' | 'lookbook'>('orders');

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Orders
            const { data: ordersData, error: ordersError } = await supabase
                .from('orders')
                .select('*')
                .order('created_at', { ascending: false });

            if (ordersError) throw ordersError;

            // 2. Fetch Profiles for these orders
            const userIds = Array.from(new Set(ordersData.map(o => o.user_id)));
            const { data: profilesData, error: profilesError } = await supabase
                .from('profiles')
                .select('id, full_name, address, email, phone')
                .in('id', userIds);

            if (profilesError) throw profilesError;

            // 3. Fetch Order Items
            const orderIds = ordersData.map(o => o.id);
            const { data: itemsData, error: itemsError } = await supabase
                .from('order_items')
                .select('*')
                .in('order_id', orderIds);

            if (itemsError) throw itemsError;

            // 4. Fetch Products for lookup
            const productIds = Array.from(new Set(itemsData.map(i => i.product_id)));
            const { data: productsData, error: productsError } = await supabase
                .from('products')
                .select('*')
                .in('id', productIds);

            if (productsError) throw productsError;

            // 5. Merge Data
            const merged: OrderWithDetails[] = ordersData.map(order => {
                const profile = profilesData.find(p => p.id === order.user_id);
                const items = itemsData
                    .filter(i => i.order_id === order.id)
                    .map(item => {
                        const product = productsData.find(p => p.id === item.product_id);
                        return {
                            ...item,
                            product_name: product?.name || 'Desconocido',
                            product_image: product?.image
                        };
                    });

                return {
                    ...order,
                    profile: profile || { full_name: 'Usuario Desconocido', address: '', email: '', phone: '' },
                    items
                };
            });

            setOrders(merged);

        } catch (error) {
            console.error("Admin fetch error:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleStatusUpdate = async (orderId: string, newStatus: string) => {
        try {
            const { error } = await supabase
                .from('orders')
                .update({ status: newStatus })
                .eq('id', orderId);

            if (error) throw error;

            // Update local state
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus as any } : o));
            if (selectedOrder && selectedOrder.id === orderId) {
                setSelectedOrder(prev => prev ? { ...prev, status: newStatus as any } : null);
            }

        } catch (error) {
            console.error("Error updating status:", error);
            alert("Error al actualizar el estado");
        }
    };

    const handleDeleteOrder = async (orderId: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent row click or other events
        if (!window.confirm("¿Estás seguro de que quieres eliminar este pedido permanentemente? Esta acción no se puede deshacer.")) {
            return;
        }

        try {
            // 1. Delete Order Items first (to satisfy Foreign Key constraints)
            const { error: itemsError } = await supabase
                .from('order_items')
                .delete()
                .eq('order_id', orderId);

            if (itemsError) throw itemsError;

            // 2. Delete the Order
            const { data: deletedOrder, error: orderError } = await supabase
                .from('orders')
                .delete()
                .eq('id', orderId)
                .select();

            if (orderError) throw orderError;

            // Check if backend actually deleted it
            if (!deletedOrder || deletedOrder.length === 0) {
                throw new Error("No se pudo eliminar el pedido en el servidor. Puede ser un problema de permisos.");
            }

            // Update UI
            setOrders(prev => prev.filter(o => o.id !== orderId));

            // If the deleted order was selected, close modal
            if (selectedOrder && selectedOrder.id === orderId) {
                setSelectedOrder(null);
            }

        } catch (error: any) {
            console.error("Error deleting order:", error);
            alert(`Error al eliminar el pedido: ${error.message}`);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return 'bg-green-100 text-green-800 border-green-200';
            case 'processing': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
            default: return 'bg-yellow-100 text-yellow-800 border-yellow-200';
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-gray-100 flex flex-col animate-fadeIn">
            {/* Header */}
            <header className="bg-white shadow-sm px-6 py-4 flex justify-between items-center border-b">
                <div>
                    <h1 className="text-xl font-bold text-gray-800 font-serif">Panel de Gerente</h1>
                    <p className="text-sm text-gray-500">Gestión de Pedidos</p>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
                    <X size={24} />
                </button>
            </header>

            {/* Content */}
            <div className="flex-grow flex flex-col h-full overflow-hidden">
                {/* Tabs */}
                <div className="px-6 pt-4 flex gap-4 border-b border-gray-200 bg-white">
                    <button
                        onClick={() => setTab('orders')}
                        className={`pb-3 px-2 text-sm font-bold uppercase tracking-wide border-b-2 transition-colors ${tab === 'orders' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                    >
                        Pedidos
                    </button>
                    <button
                        onClick={() => setTab('settings')}
                        className={`pb-3 px-2 text-sm font-bold uppercase tracking-wide border-b-2 transition-colors ${tab === 'settings' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                    >
                        Configuración
                    </button>
                    <button
                        onClick={() => setTab('lookbook')}
                        className={`pb-3 px-2 text-sm font-bold uppercase tracking-wide border-b-2 transition-colors ${tab === 'lookbook' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                    >
                        LookBook
                    </button>
                </div>

                {tab === 'orders' ? (
                    <div className="flex-grow p-6 overflow-auto">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
                                    <tr>
                                        <th className="px-6 py-4">Pedido ID</th>
                                        <th className="px-6 py-4">Cliente</th>
                                        <th className="px-6 py-4">Total</th>
                                        <th className="px-6 py-4">Estado</th>
                                        <th className="px-6 py-4">Fecha</th>
                                        <th className="px-6 py-4 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {loading ? (
                                        <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">Cargando pedidos...</td></tr>
                                    ) : orders.length === 0 ? (
                                        <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">No hay pedidos registrados.</td></tr>
                                    ) : (
                                        orders.map(order => (
                                            <tr key={order.id} className="hover:bg-blue-50/50 transition-colors">
                                                <td className="px-6 py-4 font-mono text-xs text-gray-500">
                                                    #{order.id.slice(0, 8)}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs">
                                                            {order.profile?.full_name ? order.profile.full_name[0] : <User size={14} />}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-medium text-gray-900">{order.profile?.full_name || 'Sin Nombre'}</p>
                                                            <p className="text-xs text-gray-500">{order.profile?.email || 'Sin Email'}</p>
                                                            {order.profile?.phone && <p className="text-xs text-green-600 font-mono">{order.profile.phone}</p>}
                                                            {order.profile?.address && <p className="text-xs text-gray-400 max-w-[150px] truncate">{order.profile.address}</p>}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 font-bold text-gray-900">
                                                    ${order.total_amount.toFixed(2)}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <select
                                                        value={order.status}
                                                        onChange={(e) => handleStatusUpdate(order.id, e.target.value)}
                                                        className={`text-xs font-bold px-2 py-1 rounded-full border border-transparent focus:border-blue-300 outline-none cursor-pointer ${getStatusColor(order.status)}`}
                                                    >
                                                        <option value="pending">Pendiente</option>
                                                        <option value="processing">En Proceso</option>
                                                        <option value="completed">Completado</option>
                                                        <option value="cancelled">Cancelado</option>
                                                    </select>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-500">
                                                    {new Date(order.created_at).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4 text-right flex justify-end gap-2">
                                                    <button
                                                        onClick={() => setSelectedOrder(order)}
                                                        className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-2 rounded-lg transition-colors"
                                                        title="Ver Detalles"
                                                    >
                                                        <Eye size={18} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleDeleteOrder(order.id, e)}
                                                        className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                                        title="Eliminar Pedido"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : tab === 'settings' ? (
                    <div className="flex-grow p-6 overflow-auto bg-gray-50">
                        <FooterEditor />
                    </div>
                ) : (
                    <div className="flex-grow p-6 overflow-auto bg-gray-50">
                        <LookBookEditor />
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            {selectedOrder && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-scaleIn">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-start">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 bg-gradient-to-br from-providencia-blue to-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold shadow-lg">
                                    <Package />
                                </div>
                                <div>
                                    <h2 className="text-xl font-serif font-bold text-gray-800">Detalle del Pedido</h2>
                                    <p className="text-sm text-gray-500 font-mono">#{selectedOrder.id}</p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
                        </div>

                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-6">
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Cliente</h3>
                                    <div className="space-y-2">
                                        <p className="text-gray-900 font-bold">{selectedOrder.profile?.full_name || 'Sin Nombre'}</p>
                                        <p className="text-sm text-blue-600 font-mono">{selectedOrder.profile?.email || 'Email no registrado'}</p>
                                        {selectedOrder.profile?.phone && <p className="text-sm text-green-600 font-mono">Tel: {selectedOrder.profile.phone}</p>}
                                        <p className="text-sm text-gray-600">{selectedOrder.profile?.address || 'Sin dirección registrada'}</p>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Estado</h3>
                                    <select
                                        value={selectedOrder.status}
                                        onChange={(e) => handleStatusUpdate(selectedOrder.id, e.target.value)}
                                        className={`w-full p-2 rounded-lg border focus:ring-2 focus:ring-blue-100 outline-none font-bold ${getStatusColor(selectedOrder.status)}`}
                                    >
                                        <option value="pending">Pendiente</option>
                                        <option value="processing">En Proceso</option>
                                        <option value="completed">Completado</option>
                                        <option value="cancelled">Cancelado</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="flex items-center gap-2 font-bold text-gray-800 border-b pb-2">
                                    <ShoppingCart size={18} className="text-blue-500" />
                                    Items ({selectedOrder.items.length})
                                </h3>

                                <ul className="space-y-3 max-h-60 overflow-y-auto pr-2">
                                    {selectedOrder.items.map((item) => (
                                        <li key={item.id} className="flex gap-3 bg-white border border-gray-100 p-2 rounded-lg shadow-sm">
                                            {item.product_image && <img src={item.product_image} className="w-10 h-10 rounded object-cover" />}
                                            <div className="flex-grow">
                                                <p className="text-sm font-bold text-gray-800">{item.product_name}</p>
                                                <div className="flex justify-between text-xs text-gray-500">
                                                    <span>{item.quantity} x ${item.price_at_purchase}</span>
                                                    <span className="font-bold text-gray-800">${(item.quantity * item.price_at_purchase).toFixed(2)}</span>
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>

                                <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                                    <span className="text-gray-500">Total</span>
                                    <span className="text-2xl font-serif font-bold text-gray-900">
                                        ${selectedOrder.total_amount.toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-gray-50 border-t flex justify-end">
                            <AquaButton onClick={() => setSelectedOrder(null)}>Cerrar</AquaButton>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
