// views/AdminView.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabaseService } from '../services/supabaseService';
import { komerceService } from '../services/komerceService';
import type { Product, FullOrder, OrderStatus, ProductVariant, ProductVariantOption, ProductVariantOptionValue } from '../types';
import Spinner from '../components/Spinner';
import MarketingView from './MarketingView';

// #region Helper Functions
const base64ToBlob = (base64: string, contentType = '', sliceSize = 512) => {
  const byteCharacters = atob(base64);
  const byteArrays = [];
  for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
    const slice = byteCharacters.slice(offset, offset + sliceSize);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }
  return new Blob(byteArrays, { type: contentType });
};

// Generates the cartesian product of the variant options to create all possible variants
const generateVariantCombinations = (options: ProductVariantOption[]): Record<string, string>[] => {
    if (!options || options.length === 0 || options.some(o => o.values.length === 0)) {
        // If there are options defined but no values, treat as no variants.
        // If no options, create one default variant.
        return options.length > 0 ? [] : [{}];
    }
    
    const [firstOption, ...restOptions] = options;
    const restCombinations = generateVariantCombinations(restOptions);
    
    return firstOption.values.flatMap(value => 
        restCombinations.map(combination => ({
            ...combination,
            [firstOption.name]: value.value
        }))
    );
};
// #endregion

// #region Child Components for AdminView

// ... (OrdersView components remain the same)
const CountdownTimer: React.FC<{ deadline: Date }> = ({ deadline }) => {
  const [timeLeft, setTimeLeft] = useState(deadline.getTime() - Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(deadline.getTime() - Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [deadline]);

  if (timeLeft <= 0) {
    return <span className="text-red-500 font-semibold">Past Due</span>;
  }

  const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
  const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

  return (
    <div className="text-sm text-gray-700">
      {days > 0 && `${days}d `}
      {`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`}
    </div>
  );
};

const RenderOrderActions: React.FC<{
  order: FullOrder;
  isLoading: boolean;
  onArrangePickup: (order: FullOrder) => void;
  onPrintWaybill: (order: FullOrder) => void;
}> = ({ order, isLoading, onArrangePickup, onPrintWaybill }) => {
  switch (order.status) {
    case 'paid':
      return (
        <button
          onClick={() => onArrangePickup(order)}
          disabled={isLoading}
          className="bg-green-500 text-white px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-green-600 disabled:bg-gray-300 transition-colors w-32 text-center"
        >
          {isLoading ? <Spinner /> : 'Arrange Pickup'}
        </button>
      );
    case 'shipped':
      return (
        <button
          onClick={() => onPrintWaybill(order)}
          disabled={isLoading || !order.awb_number}
          className="bg-indigo-500 text-white px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-indigo-600 disabled:bg-gray-300 transition-colors w-32 text-center"
        >
          {isLoading ? <Spinner /> : 'Print Waybill'}
        </button>
      );
    case 'pending_payment':
      return <p className="text-xs text-yellow-600">Awaiting Payment</p>;
    case 'delivered':
      return <p className="text-xs text-green-600">Order Completed</p>;
    case 'failed':
      return <p className="text-xs text-red-600">Order Failed</p>;
    default:
      return <p className="text-xs text-gray-500">-</p>;
  }
};


const OrdersView: React.FC = () => {
    const [orders, setOrders] = useState<FullOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
    const [searchQuery, setSearchQuery] = useState('');

    const fetchOrders = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);
            const data = await supabaseService.getOrders();
            setOrders(data);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch orders.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);
    
    const filteredOrders = orders.filter(order => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return true;

        const clientName = `${order.customers?.first_name || ''} ${order.customers?.last_name || ''}`.toLowerCase();
        const hasMatchingProduct = order.order_items.some(item =>
            item.products?.name.toLowerCase().includes(query) ||
            item.products?.product_variants?.name.toLowerCase().includes(query)
        );
        const hasMatchingOrderNumber = order.order_number.toLowerCase().includes(query);

        return clientName.includes(query) || hasMatchingProduct || hasMatchingOrderNumber;
    });

    const handleArrangePickup = async (order: FullOrder) => {
        setActionLoading(prev => ({ ...prev, [order.id]: true }));
        setError(null);
        try {
            const result = await komerceService.arrangePickup(order.order_number);
            alert(`Pickup arranged successfully! AWB: ${result.awb}`);
            await fetchOrders(); 
        } catch (err: any) {
            setError(err.message || "Failed to arrange pickup.");
        } finally {
            setActionLoading(prev => ({ ...prev, [order.id]: false }));
        }
    };
    
    const handlePrintWaybill = async (order: FullOrder) => {
        setActionLoading(prev => ({ ...prev, [order.id]: true }));
        setError(null);
        try {
            const { base64 } = await komerceService.printWaybill(order.order_number);
            const blob = base64ToBlob(base64, 'application/pdf');
            const url = URL.createObjectURL(blob);
            const printWindow = window.open(url, '_blank');
            if(printWindow) {
                printWindow.onload = () => { printWindow.print(); }
            } else {
                throw new Error("Could not open print window. Please disable pop-up blockers.");
            }
        } catch(err: any) {
            setError(err.message || "Failed to print waybill.");
        } finally {
            setActionLoading(prev => ({ ...prev, [order.id]: false }));
        }
    };
    
    const getShippingDeadline = (order: FullOrder): Date | null => {
        if (order.status !== 'paid') return null;
        const orderDate = new Date(order.created_at);
        const isSameDay = order.shipping_service.toLowerCase().includes('sameday') || order.shipping_service.toLowerCase().includes('instant');
        if (isSameDay) {
            const deadline = new Date(orderDate);
            deadline.setHours(17, 0, 0, 0);
            return deadline;
        } else {
            const deadline = new Date(orderDate);
            deadline.setDate(deadline.getDate() + 3);
            return deadline;
        }
    };

    if (isLoading) return <Spinner />;

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-semibold">My Orders</h2>
              <div className="relative w-full max-w-sm">
                  <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by Order No, Client, or Product..."
                      className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                  />
                   <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                   </svg>
              </div>
            </div>
            {error && <div className="text-red-500 bg-red-100 p-4 rounded-lg my-4">{error}</div>}
            <div className="overflow-x-auto">
                <table className="min-w-full bg-white text-sm">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="py-3 px-4 text-left font-semibold">Client Name</th>
                            <th className="py-3 px-4 text-left font-semibold">Products Purchased</th>
                            <th className="py-3 px-4 text-left font-semibold">Status & Countdown</th>
                            <th className="py-3 px-4 text-left font-semibold">AWB / Tracking</th>
                            <th className="py-3 px-4 text-left font-semibold">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredOrders.map(order => {
                            const deadline = getShippingDeadline(order);
                            return (
                                <tr key={order.id} className="border-b hover:bg-gray-50 align-top">
                                    <td className="py-3 px-4">
                                        <div className="font-medium">{order.customers ? `${order.customers.first_name} ${order.customers.last_name}` : 'N/A'}</div>
                                        <div className="text-gray-500">Total: Rp{order.total_amount.toLocaleString('id-ID')}</div>
                                    </td>
                                    <td className="py-3 px-4">
                                      <ul className="space-y-1">
                                        {order.order_items.map((item, idx) => (
                                          <li key={idx}>
                                            {item.products?.name || 'Unknown'} - <strong>{item.products?.product_variants?.name || 'Variant'}</strong> x <strong>{item.quantity}</strong>
                                          </li>
                                        ))}
                                      </ul>
                                    </td>
                                    <td className="py-3 px-4">
                                        <span className={`capitalize px-2 py-1 text-xs font-semibold rounded-full ${
                                            order.status === 'paid' ? 'bg-blue-100 text-blue-800' : 
                                            order.status === 'shipped' ? 'bg-green-100 text-green-800' :
                                            order.status === 'pending_payment' ? 'bg-yellow-100 text-yellow-800' :
                                            order.status === 'delivered' ? 'bg-purple-100 text-purple-800' :
                                            order.status === 'failed' ? 'bg-red-100 text-red-800' :
                                            'bg-gray-200 text-gray-800'
                                        }`}>
                                            {order.status.replace('_', ' ')}
                                        </span>
                                        {deadline && <CountdownTimer deadline={deadline} />}
                                    </td>
                                    <td className="py-3 px-4 font-mono text-xs">{order.awb_number || 'N/A'}</td>
                                    <td className="py-3 px-4">
                                      <RenderOrderActions order={order} isLoading={actionLoading[order.id]} onArrangePickup={handleArrangePickup} onPrintWaybill={handlePrintWaybill} />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {filteredOrders.length === 0 && orders.length > 0 && ( <p className="text-center py-8 text-gray-500">No orders match your search criteria.</p>)}
                {orders.length === 0 && <p className="text-center py-8 text-gray-500">No orders found.</p>}
            </div>
        </div>
    );
};


const ProductsView: React.FC<{
  onEdit: (product: Product) => void;
  onAddNew: () => void;
  onManageBrands: () => void;
}> = ({ onEdit, onAddNew, onManageBrands }) => {
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchProducts = useCallback(async () => {
        try {
            setIsLoading(true); setError(null);
            const data = await supabaseService.getProducts();
            setProducts(data);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch products.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { fetchProducts(); }, [fetchProducts]);

    const handleDelete = async (productId: string) => {
        if (window.confirm('Are you sure you want to delete this product?')) {
            try {
                setError(null);
                await supabaseService.deleteProduct(productId);
                await fetchProducts();
            } catch (err: any) {
                setError(err.message || 'Failed to delete product.');
            }
        }
    };
    
    if (isLoading) return <Spinner />;

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-semibold">My Products</h2>
                <div className="flex items-center gap-4">
                    <button onClick={onManageBrands} className="bg-indigo-500 text-white px-4 py-2 rounded-lg hover:bg-indigo-600 transition-colors font-semibold">Brand Management</button>
                    <button onClick={onAddNew} className="bg-pink-500 text-white px-4 py-2 rounded-lg hover:bg-pink-600 transition-colors font-semibold">+ Add New Product</button>
                </div>
            </div>
            {error && <div className="text-red-500 bg-red-100 p-4 rounded-lg mb-4">{error}</div>}
             <div className="overflow-x-auto">
                <table className="min-w-full bg-white">
                    <thead className="bg-gray-100">
                    <tr>
                        <th className="py-3 px-4 text-left">Product</th>
                        <th className="py-3 px-4 text-left">Price Range</th>
                        <th className="py-3 px-4 text-left">Category</th>
                        <th className="py-3 px-4 text-left">Variants</th>
                        <th className="py-3 px-4 text-left">Actions</th>
                    </tr>
                    </thead>
                    <tbody>
                    {products.map((product) => {
                         const prices = product.variants.map(v => v.price);
                         const priceDisplay = prices.length > 0
                           ? `Rp${Math.min(...prices).toLocaleString('id-ID')} - Rp${Math.max(...prices).toLocaleString('id-ID')}`
                           : 'N/A';
                        return (
                            <tr key={product.id} className="border-b hover:bg-gray-50">
                                <td className="py-3 px-4 flex items-center">
                                    <img src={product.imageUrls?.[0] || 'https://placehold.co/100x100?text=No+Img'} alt={product.name} className="w-12 h-12 object-cover rounded-md mr-4" />
                                    <span>{product.name}</span>
                                </td>
                                <td className="py-3 px-4">{priceDisplay}</td>
                                <td className="py-3 px-4">{product.category}</td>
                                <td className="py-3 px-4">{product.variants.length}</td>
                                <td className="py-3 px-4">
                                    <button onClick={() => onEdit(product)} className="text-blue-500 hover:underline mr-4">Edit</button>
                                    <button onClick={() => handleDelete(product.id)} className="text-red-500 hover:underline">Delete</button>
                                </td>
                            </tr>
                        )
                    })}
                    </tbody>
                </table>
                {products.length === 0 && ( <p className="text-center py-8 text-gray-500">No products found.</p> )}
            </div>
        </div>
    );
};

const MediaUploader: React.FC<{ urls: (string | null)[]; onUrlsChange: (newUrls: string[]) => void; maxFiles: number; fileType: 'image' | 'video'; className?: string;}> = ({ urls, onUrlsChange, maxFiles, fileType, className }) => {
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = React.useRef<HTMLInputElement>(null);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;
        if (urls.length + files.length > maxFiles) { setError(`You can only upload a maximum of ${maxFiles} ${fileType}s.`); return; }
        setIsUploading(true); setError(null);
        try {
            const uploadPromises = Array.from(files).map((file: File) => supabaseService.uploadProductMedia(file));
            const newUrls = await Promise.all(uploadPromises);
            onUrlsChange([...(urls.filter(u => u) as string[]), ...newUrls]);
        } catch (err: any) {
            setError(err.message || `Failed to upload ${fileType}.`);
        } finally {
            setIsUploading(false);
            if (inputRef.current) { inputRef.current.value = ''; }
        }
    };
    const handleRemove = (urlToRemove: string) => { onUrlsChange(urls.filter(url => url !== urlToRemove) as string[]); };
    const slots = Array.from({ length: maxFiles }, (_, i) => urls[i] || null);

    return ( <div className={className}> {error && <p className="text-red-500 text-sm mb-2">{error}</p>} <div className="grid grid-cols-2 md:grid-cols-5 gap-4"> {slots.map((url, index) => ( <div key={index} className={`relative aspect-square border-2 border-dashed rounded-lg flex items-center justify-center transition-colors ${url ? 'border-gray-300' : 'border-gray-300 hover:border-pink-400 bg-gray-50'}`} > {url ? ( <> {fileType === 'image' ? ( <img src={url} alt={`Product media ${index + 1}`} className="w-full h-full object-cover rounded-md" /> ) : ( <video src={url} className="w-full h-full object-cover rounded-md" controls /> )} <button type="button" onClick={() => handleRemove(url)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full h-6 w-6 flex items-center justify-center text-sm font-bold hover:bg-red-600" > &times; </button> </> ) : ( !urls.some(Boolean) || urls.length < maxFiles ? ( <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer text-gray-500"> <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4v16m8-8H4" /></svg> <span className="text-xs mt-1">Add {fileType}</span> <input ref={inputRef} type="file" className="hidden" accept={`${fileType}/*`} multiple={maxFiles > 1} onChange={handleFileChange} disabled={isUploading || urls.length >= maxFiles} /> </label> ) : null )} {isUploading && ( <div className="absolute inset-0 bg-white/70 flex items-center justify-center"><Spinner /></div> )} </div> ))} </div> </div> );
};

type FormState = Omit<Product, 'id' | 'createdAt'>;
const initialFormState: FormState = { name: '', category: '', imageUrls: [], videoUrl: null, longDescription: '', variantOptions: [], variants: [] };
type ProductFormSection = 'basic' | 'description' | 'sales' | 'others';

const ProductForm: React.FC<{ product: Product | null; onFinish: () => void }> = ({ product, onFinish }) => {
    const [formState, setFormState] = useState<FormState>(initialFormState);
    const [error, setError] = useState<string | null>(null);
    const [activeSection, setActiveSection] = useState<ProductFormSection>('basic');

    useEffect(() => {
        if (product) {
            setFormState({ name: product.name, category: product.category, imageUrls: product.imageUrls || [], videoUrl: product.videoUrl || null, longDescription: product.longDescription, variantOptions: product.variantOptions || [], variants: product.variants || [] });
        } else {
            setFormState(initialFormState);
            setActiveSection('basic');
        }
    }, [product]);
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormState((prev) => ({...prev, [name]: value }));
    };

    const handleVariantsChange = useCallback((variants: ProductVariant[]) => {
        setFormState(prev => ({ ...prev, variants }));
    }, []);
    
    const handleVariantOptionsChange = useCallback((options: ProductVariantOption[]) => {
        setFormState(prev => ({...prev, variantOptions: options}));
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // --- Validation ---
        if (!formState.name.trim() || !formState.category.trim()) {
            setError("Product Name and Category are required.");
            setActiveSection('basic');
            return;
        }
        if (formState.imageUrls.length === 0) {
            setError("Please upload at least one product image.");
            setActiveSection('basic');
            return;
        }
        if (formState.variants.length === 0 && formState.variantOptions.length > 0) {
            setError("Please add values to your product options to generate variants.");
            setActiveSection('sales');
            return;
        }
        const invalidVariant = formState.variants.find(v => v.price < 500);
        if (invalidVariant) {
            setError(`Price for variant "${invalidVariant.name}" must be at least Rp 500.`);
            setActiveSection('sales');
            return;
        }
        // --- End Validation ---
        
        try {
            if (product) {
                await supabaseService.updateProduct(product.id, formState);
            } else {
                const payload = { ...formState };
                // If no variants are configured, create a default one with a consistent shape.
                if (payload.variants.length === 0) {
                    payload.variants = [{
                        name: 'Default',
                        price: 500,
                        sku: null,
                        gtin: null,
                        weight: 0,
                        stock: 0,
                        imageUrls: [],
                        videoUrl: null, // Ensure videoUrl is present
                        options: {}
                    }] as any;
                }
                await supabaseService.addProduct(payload as any);
            }
            onFinish();
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred while saving the product.');
        }
    };
    
    const sections: { key: ProductFormSection; label: string }[] = [ { key: 'basic', label: 'Basic Information' }, { key: 'description', label: 'Description' }, { key: 'sales', label: 'Sales Information' }, { key: 'others', label: 'Others' } ];

    return (
        <div className="p-6 bg-gray-50 rounded-lg border">
            <h2 className="text-2xl font-semibold mb-4">{product ? 'Edit Product' : 'Add New Product'}</h2>
            {error && <div className="text-red-500 bg-red-100 p-4 rounded-lg mb-4">{error}</div>}
            
            <div className="flex border-b mb-6 flex-wrap">
                {sections.map(({ key, label }) => ( <button key={key} type="button" onClick={() => setActiveSection(key)} className={`px-4 py-2 font-medium text-sm transition-colors ${ activeSection === key ? 'border-b-2 border-pink-500 text-pink-600' : 'text-gray-500 hover:text-pink-600' }`} > {label} </button> ))}
            </div>

            <form onSubmit={handleSubmit}>
                <div className="min-h-[250px]">
                    {activeSection === 'basic' && (
                        <div className="space-y-6 animate-fadeIn">
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <input name="name" placeholder="Product Name" value={formState.name} onChange={handleInputChange} required className="p-3 border rounded-md w-full" />
                                <input name="category" placeholder="Category" value={formState.category} onChange={handleInputChange} required className="p-3 border rounded-md w-full" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Product Images (up to 5)</label>
                                <MediaUploader urls={formState.imageUrls} onUrlsChange={(newUrls) => setFormState(prev => ({...prev, imageUrls: newUrls}))} maxFiles={5} fileType="image" />
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Product Video (optional)</label>
                                <MediaUploader urls={formState.videoUrl ? [formState.videoUrl] : []} onUrlsChange={(newUrls) => setFormState(prev => ({...prev, videoUrl: newUrls[0] || null}))} maxFiles={1} fileType="video" />
                            </div>
                        </div>
                    )}
                    {activeSection === 'description' && ( <div className="animate-fadeIn"> <textarea name="longDescription" placeholder="Long Description" value={formState.longDescription} onChange={handleInputChange} required rows={6} className="p-3 border rounded-md w-full" /> </div> )}
                    {activeSection === 'sales' && ( <VariantManager options={formState.variantOptions} variants={formState.variants} onOptionsChange={handleVariantOptionsChange} onVariantsChange={handleVariantsChange}/> )}
                    {activeSection === 'others' && ( <div className="text-center p-8 text-gray-500 animate-fadeIn"> <p>Additional fields and options will be available here in the future.</p> </div> )}
                </div>

                <div className="flex justify-end gap-4 mt-6 pt-6 border-t">
                    <button type="button" onClick={onFinish} className="bg-gray-300 text-gray-800 px-6 py-2 rounded-lg hover:bg-gray-400">Cancel</button>
                    <button type="submit" className="bg-pink-500 text-white px-6 py-2 rounded-lg hover:bg-pink-600">{product ? 'Update Product' : 'Save Product'}</button>
                </div>
            </form>
        </div>
    );
};

const VariantManager: React.FC<{
    options: ProductVariantOption[];
    variants: ProductVariant[];
    onOptionsChange: (options: ProductVariantOption[]) => void;
    onVariantsChange: (variants: ProductVariant[]) => void;
}> = ({ options, variants, onOptionsChange, onVariantsChange }) => {

    useEffect(() => {
        const combinations = generateVariantCombinations(options);
        
        const newVariants = combinations.map(combo => {
            const name = Object.values(combo).join(' / ') || 'Default';
            
            // Find an existing variant that matches the new combination to preserve its data
            const existingVariant = variants.find(v => {
                return Object.keys(combo).length === Object.keys(v.options).length &&
                       Object.entries(combo).every(([key, value]) => v.options[key] === value);
            });
            
            // If it's a new combination, the ID should be undefined so the backend treats it as new
            const newVariantData = {
                name,
                price: existingVariant?.price || 500,
                sku: existingVariant?.sku || null,
                gtin: existingVariant?.gtin || null,
                weight: existingVariant?.weight || 0,
                stock: existingVariant?.stock || 0,
                imageUrls: existingVariant?.imageUrls || [],
                options: combo,
                videoUrl: existingVariant?.videoUrl || null,
            };

            // Only include ID if it's an existing variant.
            // This prevents sending `id: ""` for new variants.
            if (existingVariant?.id) {
                return { ...newVariantData, id: existingVariant.id, productId: existingVariant.productId };
            }
            return newVariantData;

        });
        
        // Only update if the variants have actually changed to prevent infinite loops.
        if (JSON.stringify(newVariants) !== JSON.stringify(variants)) {
            onVariantsChange(newVariants as ProductVariant[]);
        }
    }, [options, variants, onVariantsChange]);

    const handleAddOption = () => onOptionsChange([...options, { name: '', values: [] }]);
    const handleOptionNameChange = (index: number, name: string) => {
        const newOptions = [...options];
        newOptions[index].name = name;
        onOptionsChange(newOptions);
    };
    const handleAddOptionValue = (optionIndex: number, value: string) => {
        if (!value) return;
        const newOptions = [...options];
        const newValues = [...newOptions[optionIndex].values, { value }];
        // Prevent duplicate values
        if (newOptions[optionIndex].values.some(v => v.value.toLowerCase() === value.toLowerCase())) return;
        newOptions[optionIndex].values = newValues;
        onOptionsChange(newOptions);
    };
    const handleRemoveOptionValue = (optionIndex: number, valueToRemove: string) => {
        const newOptions = [...options];
        newOptions[optionIndex].values = newOptions[optionIndex].values.filter(v => v.value !== valueToRemove);
        onOptionsChange(newOptions);
    };
    const handleRemoveOption = (optionIndex: number) => {
        onOptionsChange(options.filter((_, i) => i !== optionIndex));
    };

    const handleVariantChange = (index: number, field: keyof ProductVariant, value: any) => {
        const newVariants = [...variants];
        (newVariants[index] as any)[field] = value;
        onVariantsChange(newVariants);
    };

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Option Configuration */}
            <div className="p-4 border rounded-lg bg-white">
                <h3 className="font-semibold mb-2">Product Options</h3>
                <div className="space-y-4">
                    {options.map((option, optIndex) => (
                        <div key={optIndex} className="p-3 border rounded-md">
                            <div className="flex gap-2 items-center">
                                <input value={option.name} onChange={(e) => handleOptionNameChange(optIndex, e.target.value)} placeholder="Option Name (e.g., Size)" className="p-2 border rounded-md flex-grow" />
                                <button type="button" onClick={() => handleRemoveOption(optIndex)} className="text-red-500 font-bold text-xl">&times;</button>
                            </div>
                            <div className="flex flex-wrap gap-2 mt-2">
                                {option.values.map((val) => ( <span key={val.value} className="bg-gray-200 text-gray-700 px-2 py-1 rounded-md text-sm flex items-center gap-1"> {val.value} <button type="button" onClick={() => handleRemoveOptionValue(optIndex, val.value)}>&times;</button> </span> ))}
                                <input type="text" placeholder="Add value" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddOptionValue(optIndex, e.currentTarget.value); e.currentTarget.value = ''; } }} className="p-1 border rounded-md text-sm" />
                            </div>
                        </div>
                    ))}
                </div>
                <button type="button" onClick={handleAddOption} className="mt-4 text-pink-600 text-sm font-semibold">+ Add another option</button>
            </div>

            {/* Variants Table */}
            {variants.length > 0 && (
                 <div className="overflow-x-auto">
                    <table className="min-w-full bg-white text-sm">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="py-2 px-3 text-left">Variant</th>
                                <th className="py-2 px-3 text-left">Price (Rp)</th>
                                <th className="py-2 px-3 text-left">SKU</th>
                                <th className="py-2 px-3 text-left">GTIN</th>
                                <th className="py-2 px-3 text-left">Weight (g)</th>
                                <th className="py-2 px-3 text-left">Stock</th>
                            </tr>
                        </thead>
                        <tbody>
                            {variants.map((variant, index) => (
                                <tr key={variant.name} className="border-b">
                                    <td className="py-2 px-3 font-medium">{variant.name}</td>
                                    <td className="py-2 px-3"><input type="text" inputMode="decimal" placeholder="Min. 500" value={variant.price} onChange={e => handleVariantChange(index, 'price', parseFloat(e.target.value) || 0)} className="w-24 p-1 border rounded-md" /></td>
                                    <td className="py-2 px-3"><input type="text" value={variant.sku ?? ''} onChange={e => handleVariantChange(index, 'sku', e.target.value)} className="w-32 p-1 border rounded-md" /></td>
                                    <td className="py-2 px-3"><input type="text" value={variant.gtin ?? ''} onChange={e => handleVariantChange(index, 'gtin', e.target.value)} className="w-32 p-1 border rounded-md" /></td>
                                    <td className="py-2 px-3"><input type="text" inputMode="decimal" placeholder="e.g. 150" value={variant.weight} onChange={e => handleVariantChange(index, 'weight', parseFloat(e.target.value) || 0)} className="w-20 p-1 border rounded-md" /></td>
                                    <td className="py-2 px-3"><input type="text" inputMode="numeric" placeholder="e.g. 100" value={variant.stock} onChange={e => handleVariantChange(index, 'stock', parseInt(e.target.value, 10) || 0)} className="w-20 p-1 border rounded-md" /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};


const PlaceholderView: React.FC<{ section: string }> = ({ section }) => ( <div className="text-center bg-gray-50 p-12 rounded-lg border-dashed border-2"> <h2 className="text-2xl font-semibold text-gray-700 mb-2">{section}</h2> <p className="text-gray-500">This feature is coming soon.</p> </div> );
const BrandManagementView: React.FC<{ onBack: () => void }> = ({ onBack }) => ( <div> <div className="flex justify-between items-center mb-4"> <h2 className="text-2xl font-semibold">Brand Management</h2> <button onClick={onBack} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 font-semibold" > &larr; Back to Products </button> </div> <div className="text-center bg-gray-50 p-12 rounded-lg border-dashed border-2"> <h2 className="text-2xl font-semibold text-gray-700 mb-2">Manage Brands</h2> <p className="text-gray-500">Functionality to add, edit, and delete brands will be implemented here.</p> </div> </div> );

// #endregion

const AdminView: React.FC = () => {
  const [activeView, setActiveView] = useState('products');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const handleEditProduct = (product: Product) => { setEditingProduct(product); setActiveView('addProduct'); };
  const handleFormFinish = () => { setEditingProduct(null); setActiveView('products'); }
  const handleAddNewProduct = () => { setEditingProduct(null); setActiveView('addProduct'); };
  const handleManageBrands = () => { setActiveView('brandManagement'); };

  const navItems = { 'orders': 'Orders', 'products': 'Product', 'marketing': 'Marketing Centre', 'customerservice': 'Customer Service', 'finance': 'Finance', 'data': 'Data', 'shop': 'Shop' };

  const renderActiveView = () => {
    switch(activeView) {
        case 'orders': return <OrdersView />;
        case 'products': return <ProductsView onEdit={handleEditProduct} onAddNew={handleAddNewProduct} onManageBrands={handleManageBrands} />;
        case 'addProduct': return <ProductForm product={editingProduct} onFinish={handleFormFinish} />;
        case 'brandManagement': return <BrandManagementView onBack={() => setActiveView('products')} />;
        case 'marketing': return <MarketingView />;
        case 'customerservice': return <PlaceholderView section="Customer Service" />;
        case 'finance': return <PlaceholderView section="Finance" />;
        case 'data': return <PlaceholderView section="Data" />;
        case 'shop': return <PlaceholderView section="Shop Settings" />;
        default: return <OrdersView />;
    }
  };

  return (
    <div className="bg-white p-8 rounded-lg shadow-xl">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      <div className="flex flex-wrap border-b mb-6 gap-2">
        {Object.entries(navItems).map(([key, value]) => (
            <button key={key} onClick={() => setActiveView(key)} className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${ (activeView === key || (activeView === 'addProduct' && key === 'products') || (activeView === 'brandManagement' && key === 'products') ) ? 'border-b-2 border-pink-500 text-pink-600 bg-pink-50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100' }`} > {value} </button>
        ))}
      </div>
      <div className="mt-6"> {renderActiveView()} </div>
    </div>
  );
};

export default AdminView;