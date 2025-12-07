// app/properties/page.tsx
'use client';

import { useState, useEffect, ChangeEvent } from 'react';
import Image from 'next/image';
import { createClient } from '@supabase/supabase-js';
import { Loader2, Upload, Plus, Home, DollarSign, Ruler, Bed, Bath } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Property = {
  id: string;
  title: string;
  content: string;
  image_url: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  square_feet: number;
  property_type: string;
  created_at: string;
};

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [newProperty, setNewProperty] = useState({
    title: '',
    price: '',
    bedrooms: '',
    bathrooms: '',
    square_feet: '',
    property_type: 'Mansion',
    content: '',
  });

  // Fetch user session and properties on mount
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUserId(session?.user?.id || null);
      await fetchProperties();
    };
    init();
  }, []);

  const fetchProperties = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('published', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const transformedProperties = data.map(post => {
        try {
          const details = JSON.parse(post.content);
          return {
            id: post.id,
            title: post.title,
            content: details.description || '',
            image_url: post.image_url,
            price: details.price || 0,
            bedrooms: details.bedrooms || 0,
            bathrooms: details.bathrooms || 0,
            square_feet: details.square_feet || 0,
            property_type: details.property_type || 'Property',
            created_at: post.created_at
          };
        } catch (e) {
          return {
            id: post.id,
            title: post.title,
            content: post.content,
            image_url: post.image_url,
            price: 0,
            bedrooms: 0,
            bathrooms: 0,
            square_feet: 0,
            property_type: 'Property',
            created_at: post.created_at
          };
        }
      }).filter(prop => prop.price > 0);

      setProperties(transformedProperties);
    } catch (err: any) {
      console.error('Error fetching properties:', err);
      setStatus(`❌ Failed to load properties: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>, fileOverride?: File) => {
    const file = fileOverride || e.target.files?.[0];
    if (!file || !userId) return;

    setUploading(true);
    setStatus(null);

    try {
      const filePath = `properties/${userId}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from('blog-images')
        .upload(filePath, file, { upsert: false });

      if (uploadErr) throw uploadErr;

      const { data } = supabase.storage.from('blog-images').getPublicUrl(filePath);
      const imageUrl = data.publicUrl;

      const propertyDetails = {
        price: parseFloat(newProperty.price),
        bedrooms: parseInt(newProperty.bedrooms),
        bathrooms: parseInt(newProperty.bathrooms),
        square_feet: parseInt(newProperty.square_feet),
        property_type: newProperty.property_type,
        description: newProperty.content
      };

      const { error: insertErr } = await supabase
        .from('blog_posts')
        .insert({
          user_id: userId,
          title: newProperty.title,
          content: JSON.stringify(propertyDetails),
          image_url: imageUrl,
          published: true,
        });

      if (insertErr) throw insertErr;

      setStatus('✅ Property created successfully!');
      setNewProperty({
        title: '',
        price: '',
        bedrooms: '',
        bathrooms: '',
        square_feet: '',
        property_type: 'Mansion',
        content: '',
      });
      setIsUploadDialogOpen(false);
      await fetchProperties();
    } catch (err: any) {
      console.error('Upload error:', err);
      setStatus(`❌ Error: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatArea = (sqft: number) => {
    return new Intl.NumberFormat('en-US').format(sqft);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="relative h-[60vh] md:h-[80vh]">
        {properties[0]?.image_url ? (
          <Image
            src={properties[0].image_url}
            alt="Luxury Property Hero"
            fill
            className="object-cover brightness-75 hover:brightness-100 transition-all duration-500"
            priority
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900 to-emerald-800" />
        )}

        <div className="absolute inset-0 flex flex-col justify-center items-center text-center px-4">
          <span className="px-4 py-1 mb-4 bg-white/20 backdrop-blur-sm text-white text-lg rounded-full">
            EXCLUSIVE LUXURY PROPERTIES
          </span>
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 max-w-3xl drop-shadow-lg">
            Discover Your Dream Home in Paradise
          </h1>
          <p className="text-xl text-white/90 mb-8 max-w-2xl drop-shadow-md">
            Experience unparalleled luxury living with our curated collection of premium estates
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => document.getElementById('properties-section')?.scrollIntoView({ behavior: 'smooth' })}
              className="bg-white text-emerald-900 hover:bg-emerald-50 font-bold px-8 py-6 text-lg shadow-lg hover:shadow-xl transition-all rounded-lg flex items-center"
            >
              <Home className="mr-2 h-5 w-5" /> View Properties
            </button>
            {userId && (
              <button
                onClick={() => setIsUploadDialogOpen(true)}
                className="bg-transparent border-2 border-white text-white hover:bg-white/10 font-bold px-8 py-6 text-lg backdrop-blur-sm rounded-lg flex items-center"
              >
                <Plus className="mr-2 h-5 w-5" /> List Property
              </button>
            )}
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/80 to-transparent" />
      </div>

      {/* Properties Grid */}
      <section id="properties-section" className="max-w-7xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Featured Luxury Properties
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Each property has been carefully selected for its exceptional quality, location, and architectural significance
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-12 w-12 text-emerald-600 animate-spin" />
          </div>
        ) : properties.length === 0 ? (
          <div className="text-center py-20">
            <Home className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-xl text-gray-600">No properties available at the moment</p>
            {userId && (
              <button
                onClick={() => setIsUploadDialogOpen(true)}
                className="mt-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-lg flex items-center"
              >
                <Plus className="mr-2 h-4 w-4" /> Add Your First Property
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {properties.map((property) => (
              <div
                key={property.id}
                className="overflow-hidden hover:shadow-xl transition-shadow duration-300 border border-gray-200 rounded-lg bg-white cursor-pointer"
                onClick={() => setSelectedProperty(property)}
              >
                <div className="relative h-64">
                  {property.image_url ? (
                    <Image
                      src={property.image_url}
                      alt={property.title}
                      fill
                      className="object-cover transition-transform duration-500 hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center">
                      <span className="text-white text-4xl font-bold">
                        {property.property_type.charAt(0)}
                      </span>
                    </div>
                  )}
                  <span className="absolute top-4 right-4 bg-emerald-600 text-white text-lg px-3 py-1 rounded-full">
                    {property.property_type}
                  </span>
                </div>
                <div className="p-4">
                  <h3 className="text-xl font-bold text-gray-900 line-clamp-1">{property.title}</h3>
                  <p className="text-emerald-600 font-bold text-lg mt-1">{formatCurrency(property.price)}</p>
                  <p className="text-gray-600 line-clamp-2 min-h-[40px] mt-2">{property.content}</p>
                </div>
                <div className="p-4 pt-2 bg-gray-50 border-t">
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div>
                      <Bed className="h-5 w-5 text-emerald-600 mx-auto" />
                      <span className="text-sm font-medium block mt-1">{property.bedrooms} Beds</span>
                    </div>
                    <div>
                      <Bath className="h-5 w-5 text-emerald-600 mx-auto" />
                      <span className="text-sm font-medium block mt-1">{property.bathrooms} Baths</span>
                    </div>
                    <div>
                      <Ruler className="h-5 w-5 text-emerald-600 mx-auto" />
                      <span className="text-sm font-medium block mt-1">{formatArea(property.square_feet)} sqft</span>
                    </div>
                    <div>
                      <DollarSign className="h-5 w-5 text-emerald-600 mx-auto" />
                      <span className="text-sm font-medium block mt-1">/sqft</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Property Detail Modal */}
      {selectedProperty && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-900 opacity-75" onClick={() => setSelectedProperty(null)} />
            </div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-2xl font-bold text-gray-900">{selectedProperty.title}</h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-4">
                      <div className="relative h-96 rounded-lg overflow-hidden">
                        {selectedProperty.image_url ? (
                          <Image
                            src={selectedProperty.image_url}
                            alt={selectedProperty.title}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-cyan-600" />
                        )}
                      </div>
                      <div>
                        <div className="flex justify-between items-start mb-6">
                          <span className="px-4 py-2 bg-emerald-100 text-emerald-800 text-lg font-medium rounded-full">
                            {selectedProperty.property_type}
                          </span>
                          <span className="text-2xl font-bold text-emerald-600">
                            {formatCurrency(selectedProperty.price)}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-4 mb-6">
                          <div className="text-center p-3 bg-gray-50 rounded-lg">
                            <Bed className="h-6 w-6 text-emerald-600 mx-auto" />
                            <span className="block font-medium mt-1">{selectedProperty.bedrooms} Bedrooms</span>
                          </div>
                          <div className="text-center p-3 bg-gray-50 rounded-lg">
                            <Bath className="h-6 w-6 text-emerald-600 mx-auto" />
                            <span className="block font-medium mt-1">{selectedProperty.bathrooms} Bathrooms</span>
                          </div>
                          <div className="text-center p-3 bg-gray-50 rounded-lg">
                            <Ruler className="h-6 w-6 text-emerald-600 mx-auto" />
                            <span className="block font-medium mt-1">{formatArea(selectedProperty.square_feet)} sqft</span>
                          </div>
                        </div>

                        <p className="text-gray-700 leading-relaxed mb-6">
                          {selectedProperty.content}
                        </p>

                        <div className="border-t pt-4 mt-4">
                          <h4 className="font-bold text-lg mb-2 text-gray-900">Property Details</h4>
                          <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                            <div>
                              <dt className="text-sm text-gray-500">Listed</dt>
                              <dd className="font-medium">{new Date(selectedProperty.created_at).toLocaleDateString()}</dd>
                            </div>
                            <div>
                              <dt className="text-sm text-gray-500">Price/sqft</dt>
                              <dd className="font-medium">
                                {formatCurrency(selectedProperty.price / (selectedProperty.square_feet || 1))}
                              </dd>
                            </div>
                          </dl>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  onClick={() => setSelectedProperty(null)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {isUploadDialogOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-900 opacity-75" onClick={() => setIsUploadDialogOpen(false)} />
            </div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg font-bold text-gray-900">List a New Property</h3>

                    <div className="mt-4 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                        <input
                          type="text"
                          value={newProperty.title}
                          onChange={(e) => setNewProperty({ ...newProperty, title: e.target.value })}
                          className="w-full p-2 border rounded-md focus:ring-emerald-500 focus:border-emerald-500"
                          placeholder="Luxury Waterfront Mansion"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Price ($)</label>
                        <input
                          type="number"
                          value={newProperty.price}
                          onChange={(e) => setNewProperty({ ...newProperty, price: e.target.value })}
                          className="w-full p-2 border rounded-md focus:ring-emerald-500 focus:border-emerald-500"
                          placeholder="5000000"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Bedrooms</label>
                          <input
                            type="number"
                            value={newProperty.bedrooms}
                            onChange={(e) => setNewProperty({ ...newProperty, bedrooms: e.target.value })}
                            className="w-full p-2 border rounded-md focus:ring-emerald-500 focus:border-emerald-500"
                            placeholder="5"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Bathrooms</label>
                          <input
                            type="number"
                            value={newProperty.bathrooms}
                            onChange={(e) => setNewProperty({ ...newProperty, bathrooms: e.target.value })}
                            className="w-full p-2 border rounded-md focus:ring-emerald-500 focus:border-emerald-500"
                            placeholder="6"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Square Feet</label>
                          <input
                            type="number"
                            value={newProperty.square_feet}
                            onChange={(e) => setNewProperty({ ...newProperty, square_feet: e.target.value })}
                            className="w-full p-2 border rounded-md focus:ring-emerald-500 focus:border-emerald-500"
                            placeholder="10000"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                          <select
                            value={newProperty.property_type}
                            onChange={(e) => setNewProperty({ ...newProperty, property_type: e.target.value })}
                            className="w-full p-2 border rounded-md focus:ring-emerald-500 focus:border-emerald-500"
                          >
                            <option>Mansion</option>
                            <option>Waterfront</option>
                            <option>Penthouse</option>
                            <option>Beach House</option>
                            <option>Mountain Retreat</option>
                            <option>Estate</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <textarea
                          value={newProperty.content}
                          onChange={(e) => setNewProperty({ ...newProperty, content: e.target.value })}
                          className="w-full p-2 border rounded-md focus:ring-emerald-500 focus:border-emerald-500 min-h-[100px]"
                          placeholder="Describe your luxury property..."
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Property Image</label>
                        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-emerald-500 transition-colors">
                          <div className="space-y-1 text-center">
                            <Upload className="mx-auto h-12 w-12 text-gray-400" />
                            <div className="flex text-sm text-gray-600">
                              <label
                                htmlFor="file-upload"
                                className="relative cursor-pointer bg-white rounded-md font-medium text-emerald-600 hover:text-emerald-500"
                              >
                                <span>Upload a file</span>
                                <input
                                  id="file-upload"
                                  name="file-upload"
                                  type="file"
                                  accept="image/*"
                                  className="sr-only"
                                  onChange={handleUpload}
                                  disabled={uploading}
                                />
                              </label>
                            </div>
                            <p className="text-xs text-gray-500">PNG, JPG up to 10MB</p>
                          </div>
                        </div>
                      </div>

                      {status && (
                        <p className={`text-sm font-medium ${status.startsWith('✅') ? 'text-green-600' : 'text-red-600'}`}>
                          {status}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-3">
                <button
                  disabled={uploading || !newProperty.title || !newProperty.price}
                  onClick={() => {
                    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
                    if (!fileInput?.files?.[0]) {
                      alert('Please select an image first');
                      return;
                    }
                    handleUpload({ target: fileInput } as any, fileInput.files[0]);
                  }}
                  className={`inline-flex justify-center rounded-md shadow-sm px-4 py-2 text-base font-medium text-white focus:outline-none sm:ml-3 sm:w-auto sm:text-sm ${
                    uploading || !newProperty.title || !newProperty.price
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Listing'
                  )}
                </button>
                <button
                  onClick={() => {
                    setIsUploadDialogOpen(false);
                    setStatus(null);
                  }}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Add Button */}
      {userId && (
        <button
          onClick={() => setIsUploadDialogOpen(true)}
          className="fixed bottom-8 right-8 rounded-full w-16 h-16 shadow-lg bg-emerald-600 hover:bg-emerald-700 flex items-center justify-center"
          aria-label="Add property"
        >
          <Plus className="h-8 w-8 text-white" />
        </button>
      )}
    </div>
  );
}