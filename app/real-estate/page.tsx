// app/properties/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Property = {
  id: string;
  title: string;
  content: string;
  image_url: string;
  created_at: string;
};

export default function PropertyGallery() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);

  useEffect(() => {
    const init = async () => {
      // Get user
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email || '',
        });
      }

      // Fetch all property-like blog posts (treat 'Test Image Upload' or any titled post as property)
      // You can later filter by a `type = 'property'` column
      const { data, error } = await supabase
        .from('blog_posts')
        .select('id, title, content, image_url, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching properties:', error);
      } else {
        setProperties(data || []);
      }
      setLoading(false);
    };

    init();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="relative h-[60vh] bg-gradient-to-r from-gray-900 to-black">
        {properties[0]?.image_url ? (
          <div className="absolute inset-0 bg-cover bg-center opacity-30" style={{ backgroundImage: `url(${properties[0].image_url})` }} />
        ) : (
          <div className="absolute inset-0 bg-gray-800 opacity-40" />
        )}
        <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-4">
          <h1 className="text-4xl md:text-6xl font-bold text-white drop-shadow-lg">
            Discover Your Dream Home
          </h1>
          <p className="mt-4 text-xl text-white max-w-2xl">
            Explore luxury properties, modern apartments, and serene countryside estates — all in one place.
          </p>
          <button className="mt-6 px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-full transition-all shadow-lg hover:shadow-xl">
            Browse Listings
          </button>
        </div>
      </div>

      {/* Property Gallery */}
      <div className="container mx-auto px-4 py-12">
        <h2 className="text-3xl font-bold text-gray-800 text-center mb-10">Featured Properties</h2>

        {loading ? (
          <div className="text-center text-gray-600">Loading properties...</div>
        ) : properties.length === 0 ? (
          <div className="text-center text-gray-600">
            No properties listed yet. <br />
            <span className="text-sm">{user ? "Upload images via the test page to create listings." : "Log in to add your first property."}</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {properties.map((property) => (
              <div
                key={property.id}
                className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300"
              >
                {property.image_url ? (
                  <div
                    className="h-56 bg-cover bg-center w-full"
                    style={{ backgroundImage: `url(${property.image_url})` }}
                  />
                ) : (
                  <div className="h-56 bg-gray-200 flex items-center justify-center">
                    <span className="text-gray-500">No image</span>
                  </div>
                )}
                <div className="p-5">
                  <h3 className="text-xl font-bold text-gray-900">{property.title}</h3>
                  <p className="mt-2 text-gray-600 line-clamp-2">{property.content}</p>
                  <div className="mt-4 flex justify-between items-center">
                    <span className="text-sm text-gray-500">
                      {new Date(property.created_at).toLocaleDateString()}
                    </span>
                    <button className="text-emerald-600 hover:text-emerald-800 font-medium">
                      View Details →
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}