import React, { useState, useEffect, useCallback } from 'react';
import { supabaseService } from '../services/supabaseService';
import type { Product } from '../types';
import Spinner from '../components/Spinner';

type FormState = Omit<Product, 'id' | 'imageUrl' | 'createdAt'> & { imageUrl: string | null };

const initialFormState: FormState = {
  name: '',
  price: 0,
  description: '',
  longDescription: '',
  category: '',
  weight: 0,
  imageUrl: null,
};

const AdminView: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState>(initialFormState);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchProducts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await supabaseService.getProducts();
      setProducts(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch products.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormState(prev => ({ ...prev, [name]: name === 'price' || name === 'weight' ? Number(value) : value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImageFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageFile) {
        setError("Please select an image for the product.");
        return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
        const imageUrl = await supabaseService.uploadImage(imageFile);
        const newProductData = { ...formState, imageUrl };
        await supabaseService.insertProduct(newProductData);
        
        // Reset form and refetch products
        setFormState(initialFormState);
        setImageFile(null);
        (document.getElementById('imageFile') as HTMLInputElement).value = '';
        await fetchProducts();

    } catch (err: any) {
        setError(err.message || "An unexpected error occurred while adding the product.");
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-12">
      <div>
        <h1 className="text-4xl font-bold text-gray-800">Admin Dashboard</h1>
        <p className="text-lg text-gray-600 mt-2">Manage your product inventory.</p>
      </div>

      {error && <div className="text-center text-red-500 bg-red-100 p-4 rounded-lg">{error}</div>}
      
      {/* Add Product Form */}
      <div className="bg-white p-8 rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold mb-6">Add New Product</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input name="name" placeholder="Product Name" value={formState.name} onChange={handleInputChange} required className="p-3 border rounded-md w-full"/>
            <input name="category" placeholder="Category" value={formState.category} onChange={handleInputChange} required className="p-3 border rounded-md w-full"/>
            <input type="number" name="price" placeholder="Price (IDR)" value={formState.price || ''} onChange={handleInputChange} required className="p-3 border rounded-md w-full"/>
            <input type="number" name="weight" placeholder="Weight (grams)" value={formState.weight || ''} onChange={handleInputChange} required className="p-3 border rounded-md w-full"/>
          </div>
          <textarea name="description" placeholder="Short Description" value={formState.description} onChange={handleInputChange} required className="p-3 border rounded-md w-full h-24"></textarea>
          <textarea name="longDescription" placeholder="Long Description" value={formState.longDescription} onChange={handleInputChange} required className="p-3 border rounded-md w-full h-40"></textarea>
          <div>
            <label htmlFor="imageFile" className="block text-sm font-medium text-gray-700 mb-1">Product Image</label>
            <input id="imageFile" type="file" onChange={handleFileChange} required className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-pink-50 file:text-pink-700 hover:file:bg-pink-100"/>
          </div>
          <button type="submit" disabled={isSubmitting} className="w-full bg-pink-500 text-white py-3 rounded-lg font-semibold hover:bg-pink-600 disabled:bg-pink-300 transition-colors">
            {isSubmitting ? <Spinner/> : 'Add Product'}
          </button>
        </form>
      </div>

      {/* Products Table */}
      <div className="bg-white p-8 rounded-lg shadow-lg">
         <h2 className="text-2xl font-bold mb-6">Existing Products</h2>
         {isLoading ? <Spinner /> : (
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b">
                            <th className="p-4">Image</th>
                            <th className="p-4">Name</th>
                            <th className="p-4">Category</th>
                            <th className="p-4">Price</th>
                        </tr>
                    </thead>
                    <tbody>
                        {products.map(product => (
                            <tr key={product.id} className="border-b hover:bg-gray-50">
                                <td className="p-2"><img src={product.imageUrl} alt={product.name} className="w-16 h-16 object-cover rounded-md"/></td>
                                <td className="p-4 font-semibold">{product.name}</td>
                                <td className="p-4 text-gray-600">{product.category}</td>
                                <td className="p-4 text-gray-600">Rp{product.price.toLocaleString('id-ID')}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
         )}
         {products.length === 0 && !isLoading && <p className="text-center text-gray-500 py-4">No products found.</p>}
      </div>
    </div>
  );
};

export default AdminView;
