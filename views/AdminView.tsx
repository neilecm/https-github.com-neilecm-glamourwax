import React, { useState, useEffect, useCallback, ChangeEvent, FormEvent, Fragment, useMemo } from 'react';
import { supabaseService } from '../services/supabaseService';
import { komerceService } from '../services/komerceService';
import type { FullOrder, KomerceOrderDetail, Product, ProductVariant, ProductVariantOption, ProductVariantOptionValue } from '../types';
import Spinner from '../components/Spinner';
import MarketingView from './MarketingView';

type ActionLoadingState = {
    [key: string]: boolean;
};

// Modal Component for Shipping Details
const ShippingDetailModal: React.FC<{ details: KomerceOrderDetail | null; onClose: () => void; isLoading: boolean }> = ({ details, onClose, isLoading }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center border-b pb-3 mb-4">
                    <h2 className="text-xl font-bold">Shipping Details</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl">&times;</button>
                </div>
                {isLoading ? <Spinner /> : details && (
                    <div className="space-y-4 text-sm">
                        <div className="grid grid-cols-2 gap-4">
                            <div><strong>Order Number:</strong> {details.order_no}</div>
                            <div><strong>Status:</strong> <span className="font-semibold text-blue-600">{details.order_status}</span></div>
                            <div><strong>AWB / Tracking:</strong> {details.awb || 'Not available'}</div>
                             <div><strong>Courier:</strong> {details.shipping} ({details.shipping_type})</div>
                        </div>

                        {details.live_tracking_url && (
                            <a href={details.live_tracking_url} target="_blank" rel="noopener noreferrer" className="text-pink-600 hover:underline">
                                Track Shipment &rarr;
                            </a>
                        )}

                        <div className="border-t pt-4">
                            <h3 className="font-semibold mb-2">Recipient</h3>
                            <p>{details.receiver_name}</p>
                            <p>{details.receiver_phone}</p>
                            <p className="text-gray-600">{details.receiver_address}</p>
                        </div>
                         <div className="border-t pt-4">
                            <h3 className="font-semibold mb-2">Cost Breakdown</h3>
                            <div className="grid grid-cols-2 gap-x-4">
                                <div>Shipping:</div> <div>Rp{details.shipping_cost?.toLocaleString('id-ID')}</div>
                                <div>Cashback:</div> <div>- Rp{details.shipping_cashback?.toLocaleString('id-ID')}</div>
                                <div>Insurance:</div> <div>Rp{details.insurance_value?.toLocaleString('id-ID')}</div>
                                <div>Service Fee:</div> <div>Rp{details.service_fee?.toLocaleString('id-ID')}</div>
                                <div className="font-bold border-t pt-1 mt-1">Grand Total:</div> <div className="font-bold border-t pt-1 mt-1">Rp{details.grand_total?.toLocaleString('id-ID')}</div>
                            </div>
                        </div>
                        <div className="border-t pt-4">
                            <h3 className="font-semibold mb-2">Items</h3>
                            <ul>
                                {details.order_details.map((item, index) => (
                                    <li key={index} className="flex justify-between">
                                        <span>{item.product_name} ({item.product_variant_name}) x {item.qty}</span>
                                        <span>Rp{item.subtotal.toLocaleString('id-ID')}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const getStatusBadgeClass = (status: FullOrder['status']) => {
    switch (status) {
        case 'paid': return 'bg-green-100 text-green-800';
        case 'label_created': return 'bg-purple-100 text-purple-800';
        case 'shipped': return 'bg-blue-100 text-blue-800';
        case 'pending_payment': return 'bg-yellow-100 text-yellow-800';
        case 'failed':
        case 'cancelled':
            return 'bg-red-100 text-red-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
};


const OrdersManager: React.FC = () => {
    const [orders, setOrders] = useState<FullOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<ActionLoadingState>({});
    
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedOrderDetails, setSelectedOrderDetails] = useState<KomerceOrderDetail | null>(null);
    const [isModalLoading, setIsModalLoading] = useState(false);


    const fetchOrders = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);
            const data = await supabaseService.getOrders();
            setOrders(data);
        } catch (err: any) {
            setError(err.message || "Failed to fetch orders.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);
    
    const handleAction = async (orderId: string, action: () => Promise<any>) => {
        setActionLoading(prev => ({ ...prev, [orderId]: true }));
        setError(null);
        try {
            await action();
            await fetchOrders(); 
        } catch (err: any) {
            setError(`Action failed: ${err.message}`);
        } finally {
            setActionLoading(prev => ({ ...prev, [orderId]: false }));
        }
    };

    const handleSubmitToKomerce = (order: FullOrder) => {
        handleAction(`submit-${order.id}`, () => komerceService.submitOrderToKomerce(order.id));
    };

    const handleArrangePickup = (order: FullOrder) => {
        handleAction(`pickup-${order.order_number}`, () => komerceService.arrangePickup(order.order_number));
    };
    
    const handlePrintWaybill = async (order: FullOrder) => {
        const actionId = `waybill-${order.order_number}`;
        setActionLoading(prev => ({ ...prev, [actionId]: true }));
        setError(null);
        try {
            const pdfBlob = await komerceService.printWaybill([order.order_number]);
            const url = URL.createObjectURL(pdfBlob);
            window.open(url, '_blank');
            setOrders(prev => prev.map(o => o.id === order.id ? { ...o, waybill_url: url } : o));
        } catch(err: any) {
             setError(`Failed to print waybill for ${order.order_number}: ${err.message}`);
        } finally {
            setActionLoading(prev => ({ ...prev, [actionId]: false }));
        }
    };
    
    const handleVerifyPayment = (order: FullOrder) => {
        handleAction(`check-${order.order_number}`, async () => {
            await supabaseService.checkOrderStatus(order.order_number);
        });
    };

    const handleCancelOrder = (order: FullOrder) => {
        if (window.confirm(`Are you sure you want to cancel order ${order.order_number}? This action cannot be undone.`)) {
            handleAction(`cancel-${order.order_number}`, () => komerceService.cancelOrder(order.order_number));
        }
    };

    const handleShowDetails = async (order: FullOrder) => {
        if (!order.komerce_order_no) {
            setError("This order has not been submitted to the shipping partner yet.");
            return;
        }
        setIsModalLoading(true);
        setIsDetailModalOpen(true);
        setSelectedOrderDetails(null);
        setError(null);
        try {
            const details = await komerceService.getKomerceOrderDetails(order.order_number);
            
            const mergedDetails: KomerceOrderDetail = {
                ...details,
                shipping_cost: order.shipping_cost_original ?? details.shipping_cost,
                shipping_cashback: order.shipping_cashback ?? details.shipping_cashback,
                service_fee: order.service_fee ?? details.service_fee,
                insurance_value: order.insurance_amount ?? details.insurance_value,
                grand_total: order.total_amount, 
            };

            setSelectedOrderDetails(mergedDetails);
        } catch (err: any) {
            setError(`Failed to fetch shipping details: ${err.message}`);
            setIsDetailModalOpen(false);
        } finally {
            setIsModalLoading(false);
        }
    };

    if (isLoading) return <Spinner />;

    return (
        <div>
            {isDetailModalOpen && (
                <ShippingDetailModal 
                    details={selectedOrderDetails}
                    isLoading={isModalLoading}
                    onClose={() => setIsDetailModalOpen(false)}
                />
            )}
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-semibold">My Orders</h2>
                <button onClick={fetchOrders} disabled={isLoading} className="text-sm bg-gray-200 px-3 py-1 rounded-md hover:bg-gray-300 disabled:bg-gray-100">Refresh</button>
            </div>
            {error && <div className="bg-red-100 text-red-700 p-3 rounded-md mb-4 break-words">{error}</div>}
            <div className="bg-white shadow-md rounded-lg overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {orders.map(order => (
                            <tr key={order.id}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <button onClick={() => handleShowDetails(order)} disabled={!order.komerce_order_no} className="text-sm font-medium text-pink-600 hover:underline disabled:text-gray-500 disabled:no-underline">
                                        {order.order_number}
                                    </button>
                                    <div className="text-sm text-gray-500">{new Date(order.created_at).toLocaleDateString()}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-gray-900">{order.customers.first_name} {order.customers.last_name}</div>
                                    <div className="text-sm text-gray-500">{order.customers.email}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Rp{order.total_amount.toLocaleString('id-ID')}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(order.status)}`}>
                                        {order.status.replace('_', ' ')}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                     {order.status === 'pending_payment' && (
                                         <button onClick={() => handleVerifyPayment(order)} disabled={actionLoading[`check-${order.order_number}`]} className="bg-yellow-500 text-white px-2 py-1 rounded disabled:bg-yellow-300">
                                            {actionLoading[`check-${order.order_number}`] ? 'Verifying...' : 'Verify'}
                                        </button>
                                    )}
                                    {order.status === 'paid' && (
                                        <>
                                            <button onClick={() => handleSubmitToKomerce(order)} disabled={actionLoading[`submit-${order.id}`]} className="bg-blue-500 text-white px-2 py-1 rounded disabled:bg-blue-300">
                                                {actionLoading[`submit-${order.id}`] ? 'Submitting...' : 'Submit to Komerce'}
                                            </button>
                                            <button onClick={() => handleCancelOrder(order)} disabled={actionLoading[`cancel-${order.order_number}`]} className="bg-red-500 text-white px-2 py-1 rounded disabled:bg-red-300">
                                                {actionLoading[`cancel-${order.order_number}`] ? 'Cancelling...' : 'Cancel'}
                                            </button>
                                        </>
                                    )}
                                    {order.status === 'processing' && (
                                        <>
                                            <button onClick={() => handleArrangePickup(order)} disabled={actionLoading[`pickup-${order.order_number}`]} className="bg-green-500 text-white px-2 py-1 rounded disabled:bg-green-300">
                                                {actionLoading[`pickup-${order.order_number}`] ? 'Arranging...' : 'Arrange Pickup'}
                                            </button>
                                            <button onClick={() => handleCancelOrder(order)} disabled={actionLoading[`cancel-${order.order_number}`]} className="bg-red-500 text-white px-2 py-1 rounded disabled:bg-red-300">
                                                {actionLoading[`cancel-${order.order_number}`] ? 'Cancelling...' : 'Cancel'}
                                            </button>
                                        </>
                                    )}
                                     {(order.status === 'label_created' || order.status === 'shipped') && (
                                        <button onClick={() => handlePrintWaybill(order)} disabled={actionLoading[`waybill-${order.order_number}`]} className="bg-gray-500 text-white px-2 py-1 rounded disabled:bg-gray-300">
                                            {actionLoading[`waybill-${order.order_number}`] ? 'Printing...' : 'Print Label'}
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                 {orders.length === 0 && <div className="text-center py-8 text-gray-500">No orders found.</div>}
            </div>
        </div>
    );
};

// --- Product Manager Implementation ---

const getInitialProductState = (): Omit<Product, 'id' | 'createdAt'> => ({
    name: '',
    category: '',
    longDescription: '',
    imageUrls: [],
    videoUrl: null,
    variants: [],
    variantOptions: [],
});

// Helper to generate cartesian product of option values
const generateVariantCombinations = (options: ProductVariantOption[]): Record<string, string>[] => {
    if (!options || options.length === 0) return [];

    const allValues = options.map(opt => opt.values.map(v => ({ name: opt.name, value: v.value })));
    
    return allValues.reduce<Record<string, string>[]>((acc, values) => {
        if (acc.length === 0) {
            return values.map(v => ({ [v.name]: v.value }));
        }
        return acc.flatMap(existingCombo =>
            values.map(v => ({ ...existingCombo, [v.name]: v.value }))
        );
    }, []);
};

// Form component for adding/editing products
const ProductForm: React.FC<{
    initialProduct: Product | null;
    onSave: (productData: Omit<Product, 'id' | 'createdAt'>, id?: string) => Promise<void>;
    onCancel: () => void;
}> = ({ initialProduct, onSave, onCancel }) => {
    const [product, setProduct] = useState(getInitialProductState());
    const [isLoading, setIsLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setProduct(initialProduct ? { ...initialProduct } : getInitialProductState());
    }, [initialProduct]);

    const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setProduct(prev => ({ ...prev, [name]: value }));
    };
    
    const handleMediaUpload = async (e: ChangeEvent<HTMLInputElement>, variantId?: string) => {
        if (!e.target.files) return;
        setIsUploading(true);
        setError(null);
        try {
            // FIX: Refactored to use a standard for loop to iterate over the FileList.
            // This is more robust against TypeScript environments with misconfigured 'lib' settings
            // that might cause incorrect type inference for `Array.from(FileList)`.
            const files = e.target.files;
            const uploadPromises: Promise<string>[] = [];
            for (let i = 0; i < files.length; i++) {
                const file = files.item(i);
                if (file) {
                    uploadPromises.push(supabaseService.uploadProductMedia(file));
                }
            }
            const urls = await Promise.all(uploadPromises);
            
            setProduct(prev => {
                const newImageUrls = [...(prev.imageUrls || []), ...urls];
                return { ...prev, imageUrls: newImageUrls };
            });
            
        } catch (err: any) {
            setError(err.message || 'Media upload failed.');
        } finally {
            setIsUploading(false);
        }
    };
    
    const removeImage = (urlToRemove: string) => {
        setProduct(prev => ({ ...prev, imageUrls: prev.imageUrls.filter(url => url !== urlToRemove) }));
    };

    const handleAddOption = () => {
        setProduct(prev => ({ ...prev, variantOptions: [...prev.variantOptions, { name: '', values: [{ value: '' }] }] }));
    };

    const handleOptionNameChange = (index: number, name: string) => {
        setProduct(prev => {
            const newOptions = [...prev.variantOptions];
            newOptions[index].name = name;
            return { ...prev, variantOptions: newOptions };
        });
    };
    
    const handleAddOptionValue = (optionIndex: number) => {
        setProduct(prev => {
            const newOptions = [...prev.variantOptions];
            newOptions[optionIndex].values.push({ value: '' });
            return { ...prev, variantOptions: newOptions };
        });
    };

    const handleOptionValueChange = (optionIndex: number, valueIndex: number, value: string) => {
        setProduct(prev => {
            const newOptions = [...prev.variantOptions];
            newOptions[optionIndex].values[valueIndex].value = value;
            return { ...prev, variantOptions: newOptions };
        });
    };

    const handleRemoveOptionValue = (optionIndex: number, valueIndex: number) => {
        setProduct(prev => {
            const newOptions = [...prev.variantOptions];
            newOptions[optionIndex].values.splice(valueIndex, 1);
            return { ...prev, variantOptions: newOptions };
        });
    };

    const handleRemoveOption = (optionIndex: number) => {
        setProduct(prev => {
            const newOptions = [...prev.variantOptions];
            newOptions.splice(optionIndex, 1);
            return { ...prev, variantOptions: newOptions };
        });
    };
    
    const generatedVariants = useMemo(() => {
        const combinations = generateVariantCombinations(product.variantOptions);
        if (combinations.length === 0 && product.variants.length <= 1) {
            // Handle simple product (no options)
            return [{ options: {}, ...product.variants[0] }];
        }
        
        return combinations.map(combo => {
            const existingVariant = product.variants.find(v => 
                JSON.stringify(v.options) === JSON.stringify(combo)
            );
            return {
                ...existingVariant,
                name: Object.values(combo).join(' / '),
                options: combo,
            };
        });
    }, [product.variantOptions, product.variants]);

    const handleVariantChange = (index: number, field: keyof Omit<ProductVariant, 'id' | 'productId'>, value: string | number) => {
        setProduct(prev => {
            const updatedVariants = [...prev.variants];
            const targetOptions = generatedVariants[index].options;
            const existingVariantIndex = updatedVariants.findIndex(v => JSON.stringify(v.options) === JSON.stringify(targetOptions));

            if (existingVariantIndex > -1) {
                // @ts-ignore
                updatedVariants[existingVariantIndex][field] = value;
            } else {
                // @ts-ignore
                updatedVariants.push({ options: targetOptions, [field]: value, name: Object.values(targetOptions).join(' / ') });
            }

            return { ...prev, variants: updatedVariants };
        });
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const finalProductData = { ...product };
            
            if (finalProductData.variantOptions.length > 0) {
                 finalProductData.variants = generatedVariants.map(genVar => {
                     const storedVariant = product.variants.find(v => JSON.stringify(v.options) === JSON.stringify(genVar.options)) || {};
                     return { ...storedVariant, ...genVar };
                 });
            } else {
                // For simple products, ensure the single variant has an empty options object
                finalProductData.variants[0] = { ...product.variants[0], options: {} };
            }
             
            await onSave(finalProductData, initialProduct?.id);
        } catch (err: any) {
            setError(err.message || 'Failed to save product.');
        } finally {
            setIsLoading(false);
        }
    };
    
    const renderVariantManager = () => {
         const hasOptions = product.variantOptions.length > 0 && product.variantOptions.some(o => o.name && o.values.some(v => v.value));

         return (
            <div className="bg-white p-4 rounded-lg shadow-inner">
                <h3 className="text-lg font-semibold mb-3">Variants</h3>
                { (hasOptions ? generatedVariants : product.variants.slice(0, 1)).map((variant, index) => {
                     const variantKey = JSON.stringify(variant.options);
                     const storedVariant = product.variants.find(v => JSON.stringify(v.options) === variantKey) || {};
                    return (
                        <div key={variantKey} className="grid grid-cols-2 md:grid-cols-5 gap-3 p-3 border-b items-center">
                            <div className="col-span-2 md:col-span-1 font-medium">{hasOptions ? variant.name : 'Default Variant'}</div>
                            <input type="number" placeholder="Price" value={storedVariant.price || ''} onChange={e => handleVariantChange(index, 'price', Number(e.target.value))} className="p-2 border rounded-md" required/>
                            <input type="number" placeholder="Stock" value={storedVariant.stock || ''} onChange={e => handleVariantChange(index, 'stock', Number(e.target.value))} className="p-2 border rounded-md" required/>
                            <input type="number" placeholder="Weight (g)" value={storedVariant.weight || ''} onChange={e => handleVariantChange(index, 'weight', Number(e.target.value))} className="p-2 border rounded-md" required/>
                            <input type="text" placeholder="SKU" value={storedVariant.sku || ''} onChange={e => handleVariantChange(index, 'sku', e.target.value)} className="p-2 border rounded-md"/>
                        </div>
                    );
                })}
            </div>
         )
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4" onClick={onCancel}>
            <form onSubmit={handleSubmit} className="bg-gray-100 rounded-lg shadow-xl w-full max-w-4xl max-h-[95vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="p-6 sticky top-0 bg-white border-b z-10">
                    <h2 className="text-2xl font-bold">{initialProduct ? 'Edit Product' : 'Add New Product'}</h2>
                </div>
                <div className="p-6 space-y-6">
                    {error && <div className="bg-red-100 text-red-700 p-3 rounded-md">{error}</div>}
                    
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                        <h3 className="text-lg font-semibold mb-3">Basic Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input name="name" placeholder="Product Name" value={product.name} onChange={handleInputChange} required className="p-2 border rounded-md"/>
                            <input name="category" placeholder="Category" value={product.category} onChange={handleInputChange} required className="p-2 border rounded-md"/>
                        </div>
                        <textarea name="longDescription" placeholder="Long Description" value={product.longDescription} onChange={handleInputChange} rows={4} className="mt-4 w-full p-2 border rounded-md"/>
                    </div>
                    
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                        <h3 className="text-lg font-semibold mb-3">Media</h3>
                        <input type="file" multiple onChange={handleMediaUpload} className="mb-4" disabled={isUploading}/>
                        {isUploading && <Spinner />}
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                            {product.imageUrls.map(url => (
                                <div key={url} className="relative group">
                                    <img src={url} alt="product" className="w-full h-24 object-cover rounded-md"/>
                                    <button type="button" onClick={() => removeImage(url)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity">&times;</button>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                     <div className="bg-white p-4 rounded-lg shadow-sm">
                        <h3 className="text-lg font-semibold mb-3">Product Options</h3>
                        {product.variantOptions.map((option, optIndex) => (
                             <div key={optIndex} className="p-3 border rounded-md mb-3">
                                <div className="flex items-center gap-3 mb-2">
                                    <input placeholder="Option Name (e.g., Size)" value={option.name} onChange={e => handleOptionNameChange(optIndex, e.target.value)} className="p-2 border rounded-md flex-grow"/>
                                    <button type="button" onClick={() => handleRemoveOption(optIndex)} className="text-red-500 hover:text-red-700 font-bold">Remove</button>
                                </div>
                                {option.values.map((val, valIndex) => (
                                    <div key={valIndex} className="flex items-center gap-2 mb-1 pl-4">
                                        <input placeholder="Value (e.g., Small)" value={val.value} onChange={e => handleOptionValueChange(optIndex, valIndex, e.target.value)} className="p-2 border rounded-md flex-grow text-sm"/>
                                        <button type="button" onClick={() => handleRemoveOptionValue(optIndex, valIndex)} className="text-red-500 text-xl">&times;</button>
                                    </div>
                                ))}
                                <button type="button" onClick={() => handleAddOptionValue(optIndex)} className="text-sm text-pink-600 hover:underline mt-1 ml-4">+ Add another value</button>
                            </div>
                        ))}
                        <button type="button" onClick={handleAddOption} className="text-pink-600 hover:underline font-semibold">+ Add an option</button>
                    </div>

                    {renderVariantManager()}

                </div>
                <div className="p-6 flex justify-end gap-4 sticky bottom-0 bg-white border-t">
                    <button type="button" onClick={onCancel} className="bg-gray-200 px-6 py-2 rounded-md hover:bg-gray-300">Cancel</button>
                    <button type="submit" disabled={isLoading} className="bg-pink-500 text-white px-6 py-2 rounded-md hover:bg-pink-600 disabled:bg-pink-300">
                        {isLoading ? <Spinner/> : 'Save Product'}
                    </button>
                </div>
            </form>
        </div>
    );
};

const ProductsManager: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isFormVisible, setIsFormVisible] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);

    const fetchProducts = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await supabaseService.getProducts();
            setProducts(data);
        } catch (err: any) {
            setError(err.message || "Failed to fetch products.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    const handleAddNew = () => {
        setEditingProduct(null);
        setIsFormVisible(true);
    };

    const handleEdit = (product: Product) => {
        setEditingProduct(product);
        setIsFormVisible(true);
    };

    const handleDelete = async (productId: string) => {
        if (window.confirm("Are you sure you want to delete this product? This cannot be undone.")) {
            try {
                await supabaseService.deleteProduct(productId);
                await fetchProducts(); // Refresh list
            } catch (err: any) {
                setError(err.message || 'Failed to delete product.');
            }
        }
    };
    
    const handleSave = async (productData: Omit<Product, 'id' | 'createdAt'>, id?: string) => {
        if (id) {
            await supabaseService.updateProduct(id, productData);
        } else {
            await supabaseService.addProduct(productData);
        }
        setIsFormVisible(false);
        await fetchProducts();
    };

    if (isLoading) return <Spinner />;

    return (
        <div>
            {isFormVisible && (
                <ProductForm
                    initialProduct={editingProduct}
                    onSave={handleSave}
                    onCancel={() => setIsFormVisible(false)}
                />
            )}
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-semibold">My Products</h2>
                <button onClick={handleAddNew} className="bg-pink-500 text-white px-4 py-2 rounded-md hover:bg-pink-600">
                    + Add New Product
                </button>
            </div>
            {error && <div className="bg-red-100 text-red-700 p-3 rounded-md mb-4">{error}</div>}
            
            <div className="bg-white shadow-md rounded-lg overflow-hidden">
                 <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Variants</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Stock</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {products.map(product => {
                                const totalStock = product.variants.reduce((acc, v) => acc + v.stock, 0);
                                return (
                                    <tr key={product.id}>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <img src={product.imageUrls[0] || 'https://placehold.co/40x40'} alt={product.name} className="w-10 h-10 rounded-md object-cover mr-4"/>
                                                <span className="font-medium">{product.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.category}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.variants.length}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{totalStock}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                            <button onClick={() => handleEdit(product)} className="text-indigo-600 hover:text-indigo-900">Edit</button>
                                            <button onClick={() => handleDelete(product.id)} className="text-red-600 hover:text-red-900">Delete</button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
                 {products.length === 0 && <div className="text-center py-8 text-gray-500">No products found. Click 'Add New Product' to get started.</div>}
            </div>
        </div>
    );
};


const AdminView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'orders' | 'products' | 'marketing'>('orders');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'orders':
        return <OrdersManager />;
      case 'products':
        return <ProductsManager />;
      case 'marketing':
        return <MarketingView />;
      default:
        return null;
    }
  };

  const TabButton: React.FC<{ tabName: 'orders' | 'products' | 'marketing', label: string }> = ({ tabName, label }) => (
    <button
      onClick={() => setActiveTab(tabName)}
      className={`px-4 py-2 text-sm font-medium rounded-md ${
        activeTab === tabName ? 'bg-pink-500 text-white' : 'text-gray-600 hover:bg-gray-200'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      <div className="flex space-x-2 border-b mb-6">
        <TabButton tabName="orders" label="My Orders" />
        <TabButton tabName="products" label="Products" />
        <TabButton tabName="marketing" label="Marketing" />
      </div>
      <div>
        {renderTabContent()}
      </div>
    </div>
  );
};

export default AdminView;