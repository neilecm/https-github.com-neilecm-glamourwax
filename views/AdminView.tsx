import React, { useState, useEffect, useCallback } from 'react';
import { supabaseService } from '../services/supabaseService';
import type { Product } from '../types';
import Spinner from '../components/Spinner';

type FormState = Omit<Product, 'id' | 'createdAt'>;

const initialFormState: FormState = {
  name: '',
  price: 0,
  category: '',
  imageUrl: '',
  longDescription: '',
  weight: 0,
};

const AdminView: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formState, setFormState] = useState<FormState>(initialFormState);

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

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormState((prev) => ({
      ...prev,
      [name]:
        name === 'price' || name === 'weight' ? parseFloat(value) || 0 : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (editingProduct) {
        await supabaseService.updateProduct(editingProduct.id, formState);
      } else {
        await supabaseService.addProduct(formState);
      }
      await fetchProducts();
      handleCancelEdit();
    } catch (err: any) {
      setError(err.message || 'Failed to save product.');
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormState({
      name: product.name,
      price: product.price,
      category: product.category,
      imageUrl: product.imageUrl,
      longDescription: product.longDescription,
      weight: product.weight,
    });
    setIsFormVisible(true);
    window.scrollTo(0, 0);
  };

  const handleAddNew = () => {
    setEditingProduct(null);
    setFormState(initialFormState);
    setIsFormVisible(true);
  };

  const handleCancelEdit = () => {
    setEditingProduct(null);
    setFormState(initialFormState);
    setIsFormVisible(false);
  };

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

  return (
    <div className="bg-white p-8 rounded-lg shadow-xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        {!isFormVisible && (
          <button
            onClick={handleAddNew}
            className="bg-pink-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-pink-600 transition-colors"
          >
            Add New Product
          </button>
        )}
      </div>

      {error && (
        <div className="text-center text-red-500 bg-red-100 p-4 rounded-lg mb-4">
          {error}
        </div>
      )}

      {isFormVisible && (
        <div className="mb-8 p-6 bg-gray-50 rounded-lg border">
          <h2 className="text-2xl font-semibold mb-4">
            {editingProduct ? 'Edit Product' : 'Add New Product'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input name="name" placeholder="Product Name" value={formState.name} onChange={handleInputChange} required className="p-3 border rounded-md w-full" />
              <input type="number" name="price" placeholder="Price (IDR)" value={formState.price} onChange={handleInputChange} required className="p-3 border rounded-md w-full" />
              <input name="category" placeholder="Category" value={formState.category} onChange={handleInputChange} required className="p-3 border rounded-md w-full" />
              <input type="number" name="weight" placeholder="Weight (grams)" value={formState.weight} onChange={handleInputChange} required className="p-3 border rounded-md w-full" />
            </div>
            <input name="imageUrl" placeholder="Image URL" value={formState.imageUrl} onChange={handleInputChange} required className="p-3 border rounded-md w-full" />
            <textarea name="longDescription" placeholder="Long Description" value={formState.longDescription} onChange={handleInputChange} required rows={4} className="p-3 border rounded-md w-full" />
            <div className="flex justify-end gap-4">
              <button type="button" onClick={handleCancelEdit} className="bg-gray-300 text-gray-800 px-6 py-2 rounded-lg hover:bg-gray-400">
                Cancel
              </button>
              <button type="submit" className="bg-pink-500 text-white px-6 py-2 rounded-lg hover:bg-pink-600">
                {editingProduct ? 'Update' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <Spinner />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white">
            <thead className="bg-gray-100">
              <tr>
                <th className="py-3 px-4 text-left">Product</th>
                <th className="py-3 px-4 text-left">Price</th>
                <th className="py-3 px-4 text-left">Category</th>
                <th className="py-3 px-4 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 flex items-center">
                    <img src={product.imageUrl} alt={product.name} className="w-12 h-12 object-cover rounded-md mr-4" />
                    <span>{product.name}</span>
                  </td>
                  <td className="py-3 px-4">
                    Rp{product.price.toLocaleString('id-ID')}
                  </td>
                  <td className="py-3 px-4">{product.category}</td>
                  <td className="py-3 px-4">
                    <button onClick={() => handleEdit(product)} className="text-blue-500 hover:underline mr-4">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(product.id)} className="text-red-500 hover:underline">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {products.length === 0 && (
            <p className="text-center py-8 text-gray-500">No products found.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminView;
