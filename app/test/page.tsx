// app/chef-experiences/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Predefined chef profiles (core metadata fixed)
const CHEFS = [
  { id: 'marco-ricci', name: 'Marco Ricci', cuisine: 'Italian', price: 850, experience: '20+ years', location: 'Napa Valley, CA' },
  { id: 'aiko-tanaka', name: 'Aiko Tanaka', cuisine: 'Japanese Fusion', price: 950, experience: 'Michelin-trained', location: 'Los Angeles, CA' },
  { id: 'james-ellis', name: 'James Ellis', cuisine: 'Modern British', price: 750, experience: 'Royal Chef', location: 'London, UK' },
  { id: 'sofia-martinez', name: 'Sofia Martinez', cuisine: 'Latin American', price: 800, experience: 'James Beard Finalist', location: 'Miami, FL' },
  { id: 'olivier-dubois', name: 'Olivier Dubois', cuisine: 'French Haute', price: 1200, experience: '3-Michelin Star Alumni', location: 'Paris, France' },
];

type ChefData = {
  image_url: string | null;
  price: number;
  cuisine: string;
  experience: string;
  location: string;
};

export default function ChefExperiencesPage() {
  const [chefs, setChefs] = useState<{ [key: string]: ChefData }>({});
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [heroUploading, setHeroUploading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [adminMode, setAdminMode] = useState(true);

  // Initialize data on mount
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user.id;
      setUserId(uid || null);

      if (uid) {
        // Fetch chef data
        const { data: chefData, error: chefError } = await supabase
          .from('blog_posts')
          .select('title, image_url, content')
          .eq('user_id', uid)
          .in('title', CHEFS.map(c => c.name));

        if (chefError) {
          console.error('Failed to fetch chefs:', chefError);
        } else {
          const initialState: { [key: string]: ChefData } = {};
          CHEFS.forEach((chef) => {
            const stored = chefData.find((row: any) => row.title === chef.name);
            if (stored) {
              let price = chef.price;
              let cuisine = chef.cuisine;
              let experience = chef.experience;
              let location = chef.location;
              try {
                const content = JSON.parse(stored.content);
                price = content.price ?? price;
                cuisine = content.cuisine ?? cuisine;
                experience = content.experience ?? experience;
                location = content.location ?? location;
              } catch (e) {
                // fallback
              }
              initialState[chef.id] = { image_url: stored.image_url || null, price, cuisine, experience, location };
            } else {
              initialState[chef.id] = {
                image_url: null,
                price: chef.price,
                cuisine: chef.cuisine,
                experience: chef.experience,
                location: chef.location,
              };
            }
          });
          setChefs(initialState);
        }

        // Fetch hero
        const { data: heroData, error: heroError } = await supabase
          .from('blog_posts')
          .select('image_url')
          .eq('user_id', uid)
          .eq('title', 'hero_image')
          .single();

        if (!heroError || heroError.code === 'PGRST116') {
          if (heroData) setHeroImageUrl(heroData.image_url);
        } else {
          console.error('Hero fetch error:', heroError);
        }
      }
    };

    init();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, chefId: string) => {
    if (!adminMode) return;
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    setUploading(chefId);
    setStatus(null);

    try {
      const chef = CHEFS.find(c => c.id === chefId);
      if (!chef) throw new Error('Invalid chef');

      const filePath = `blog/${userId}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from('blog-images')
        .upload(filePath, file, { upsert: false });

      if (uploadErr) throw uploadErr;

      const { data } = supabase.storage.from('blog-images').getPublicUrl(filePath);
      const imageUrl = data.publicUrl;

      const content = JSON.stringify({
        price: chefs[chefId]?.price || chef.price,
        cuisine: chefs[chefId]?.cuisine || chef.cuisine,
        experience: chefs[chefId]?.experience || chef.experience,
        location: chefs[chefId]?.location || chef.location,
        bio: `Award-winning chef ${chef.name} brings exquisite ${chef.cuisine} cuisine to your table.`
      });

      await supabase
        .from('blog_posts')
        .delete()
        .eq('user_id', userId)
        .eq('title', chef.name);

      const { error: insertErr } = await supabase
        .from('blog_posts')
        .insert({
          user_id: userId,
          title: chef.name,
          content,
          image_url: imageUrl,
          published: false,
        });

      if (insertErr) throw insertErr;

      setChefs(prev => ({
        ...prev,
        [chefId]: {
          ...prev[chefId],
          image_url: imageUrl,
        },
      }));

      setStatus(`✅ ${chef.name}'s photo updated!`);
      e.target.value = '';
    } catch (err: any) {
      console.error(err);
      setStatus(`❌ Error: ${err.message}`);
    } finally {
      setUploading(null);
    }
  };

  const handleHeroUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!adminMode) return;
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    setHeroUploading(true);
    setStatus(null);

    try {
      const filePath = `blog/${userId}/hero_${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from('blog-images')
        .upload(filePath, file, { upsert: false });

      if (uploadErr) throw uploadErr;

      const { data } = supabase.storage.from('blog-images').getPublicUrl(filePath);
      const imageUrl = data.publicUrl;

      await supabase
        .from('blog_posts')
        .delete()
        .eq('user_id', userId)
        .eq('title', 'hero_image');

      const { error: insertErr } = await supabase
        .from('blog_posts')
        .insert({
          user_id: userId,
          title: 'hero_image',
          content: JSON.stringify({ 
            headline: 'Private Dining, Perfected', 
            subhead: 'Book world-class chefs for unforgettable in-home culinary experiences' 
          }),
          image_url: imageUrl,
          published: false,
        });

      if (insertErr) throw insertErr;

      setHeroImageUrl(imageUrl);
      setStatus('✅ Hero image updated!');
      e.target.value = '';
    } catch (err: any) {
      console.error(err);
      setStatus(`❌ Error: ${err.message}`);
    } finally {
      setHeroUploading(false);
    }
  };

  const formatPrice = (price: number): string => `$${price}/event`;

  const getCuisineColor = (cuisine: string) => {
    const lower = cuisine.toLowerCase();
    if (lower.includes('italian')) return 'bg-amber-600';
    if (lower.includes('japanese') || lower.includes('fusion')) return 'bg-red-600';
    if (lower.includes('french')) return 'bg-indigo-700';
    if (lower.includes('british')) return 'bg-emerald-600';
    if (lower.includes('latin')) return 'bg-rose-600';
    return 'bg-gray-600';
  };

  return (
    <div className="min-h-screen bg-amber-50">
      {/* ===== HEADER ===== */}
      <header className="bg-white shadow-sm border-b z-10 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-8">
              <h1 className="text-2xl font-bold text-amber-700">Savory & Co.</h1>
              <nav className="hidden md:flex space-x-6">
                <a href="#" className="text-gray-700 hover:text-amber-700 font-medium">Home</a>
                <a href="#" className="text-gray-700 hover:text-amber-700 font-medium">Chefs</a>
                <a href="#" className="text-gray-700 hover:text-amber-700 font-medium">Experiences</a>
                <a href="#" className="text-gray-700 hover:text-amber-700 font-medium">Gifting</a>
                <a href="#" className="text-gray-700 hover:text-amber-700 font-medium">About</a>
              </nav>
            </div>
            <button className="bg-amber-600 text-white px-4 py-2 rounded-full font-medium hover:bg-amber-700 transition">
              Host a Dinner
            </button>
          </div>
        </div>
      </header>

      {/* ===== HERO SECTION ===== */}
      <div className="relative h-[60vh] min-h-[400px] max-h-[600px] w-full overflow-hidden">
        {heroImageUrl ? (
          <img
            src={heroImageUrl}
            alt="Gourmet dining experience"
            className="w-full h-full object-cover brightness-75 transition-all duration-500 hover:brightness-90"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-amber-900 via-red-800 to-rose-700">
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          </div>
        )}

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 md:px-8">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-6xl font-extrabold text-white mb-4 drop-shadow-lg">
              Private Dining, Perfected
            </h1>
            <p className="text-xl md:text-2xl text-white/90 mb-8 drop-shadow-md">
              Book world-class chefs for unforgettable in-home culinary experiences
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <button className="bg-white text-amber-700 font-bold px-6 py-3 rounded-full hover:bg-amber-50 hover:shadow-lg transition transform hover:-translate-y-0.5">
                Browse Chefs
              </button>
              <button className="bg-transparent border-2 border-white text-white font-bold px-6 py-3 rounded-full hover:bg-white/10 hover:shadow-lg transition">
                Create Custom Menu
              </button>
            </div>
          </div>
        </div>

        {/* Hero Upload */}
        {userId && adminMode && (
          <div className="absolute top-6 right-6 z-20">
            <div className="relative">
              <input
                type="file"
                accept="image/*"
                onChange={handleHeroUpload}
                disabled={heroUploading}
                className="hidden"
                id="hero-upload-chef"
              />
              <label
                htmlFor="hero-upload-chef"
                className={`cursor-pointer ${heroUploading ? 'opacity-70' : 'hover:opacity-90'}`}
                title={heroUploading ? "Uploading..." : "Change hero image"}
              >
                <div className="flex items-center bg-black/50 text-white px-4 py-2 rounded-full backdrop-blur-sm border border-white/20 hover:border-white/40 transition">
                  {heroUploading ? (
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                    </svg>
                  )}
                  <span className="font-medium">
                    {heroUploading ? 'Uploading...' : 'Change Hero'}
                  </span>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Admin Toggle */}
        {userId && (
          <div className="absolute top-6 left-6 z-20">
            <button
              onClick={() => setAdminMode(!adminMode)}
              className={`w-6 h-6 rounded-full border border-gray-400 flex items-center justify-center transition-colors ${
                adminMode ? 'bg-green-500' : 'bg-gray-400'
              }`}
              title={adminMode ? 'Disable admin mode' : 'Enable admin mode'}
            >
              <div className="w-3 h-3 rounded-full bg-white opacity-80"></div>
            </button>
          </div>
        )}

        <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-black/80 to-transparent" />
      </div>

      {/* ===== CHEFS GRID ===== */}
      <div className="max-w-7xl mx-auto p-4 md:p-6 mt-6 space-y-10">
        <h2 className="text-2xl font-bold text-gray-800">Our Master Chefs</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {CHEFS.map((chef) => {
            const data = chefs[chef.id];
            const bgColorClass = getCuisineColor(data?.cuisine || chef.cuisine);

            return (
              <div
                key={chef.id}
                className="rounded-xl overflow-hidden shadow-lg border border-amber-100 bg-white hover:shadow-xl transition-shadow duration-300"
              >
                <div className="relative h-48">
                  {data?.image_url ? (
                    <img
                      src={data.image_url}
                      alt={chef.name}
                      className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-r from-amber-100 to-amber-200 flex items-center justify-center text-amber-500">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </div>
                  )}
                  <button className="absolute top-3 right-3 bg-white/80 rounded-full p-2 hover:bg-white transition shadow-md">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.682l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </button>
                </div>

                <div className="p-4">
                  <div className={`inline-block px-3 py-1 rounded-full text-xs font-semibold text-white mb-2 ${bgColorClass}`}>
                    {data?.cuisine || chef.cuisine}
                  </div>
                  <h3 className="font-bold text-lg text-gray-900">{chef.name}</h3>
                  <div className="flex items-center text-sm text-gray-500 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.995 1.995 0 01-2.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>{data?.location || chef.location}</span>
                  </div>
                  <div className="mt-2 text-xl font-bold text-amber-700">
                    {formatPrice(data?.price || chef.price)}
                  </div>
                  <p className="text-sm text-gray-600 mt-2 italic">
                    "{data?.experience || chef.experience}"
                  </p>

                  {userId && adminMode && (
                    <div className="mt-4">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleUpload(e, chef.id)}
                        disabled={uploading === chef.id}
                        className="w-full text-xs border border-gray-300 rounded px-2 py-1 file:mr-4 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== WHY CHOOSE US ===== */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-16 bg-gradient-to-r from-amber-50 to-red-50 rounded-2xl my-12">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            The Savory & Co. Difference
          </h2>
          <p className="text-lg text-gray-700">
            From sourcing ingredients to plating, every detail is tailored to your palate and occasion—because extraordinary meals deserve extraordinary care.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              title: "Curated Talent",
              desc: "Only chefs with proven excellence, impeccable reviews, and culinary awards.",
              icon: "👨‍🍳"
            },
            {
              title: "End-to-End Service",
              desc: "We handle staffing, equipment, cleanup, and wine pairing—so you savor the moment.",
              icon: "🍷"
            },
            {
              title: "Fully Customizable",
              desc: "Dietary needs, themes, surprise menus—we craft the entire experience with you.",
              icon: "✨"
            }
          ].map((item, idx) => (
            <div key={idx} className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition">
              <div className="text-4xl mb-4">{item.icon}</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{item.title}</h3>
              <p className="text-gray-600">{item.desc}</p>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <button className="bg-gradient-to-r from-amber-600 to-red-600 text-white font-bold px-8 py-4 rounded-full text-lg hover:shadow-xl transition transform hover:-translate-y-1">
            Book Your Chef Today →
          </button>
          <p className="text-gray-600 mt-4 text-sm">
            Availability limited. Reserve 14+ days in advance for the best selection.
          </p>
        </div>
      </div>

      {/* ===== FOOTER ===== */}
      <footer className="bg-gray-900 text-white mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-xl font-bold text-amber-400 mb-4">Savory & Co.</h3>
              <p className="text-gray-400 text-sm">
                Elevating private dining through unmatched culinary artistry and service.
              </p>
              <div className="flex space-x-4 mt-4">
                {['instagram', 'pinterest', 'linkedin', 'facebook'].map((platform) => (
                  <a key={platform} href="#" className="text-gray-400 hover:text-white transition" aria-label={platform}>
                    <span className="sr-only">{platform}</span>
                    <div className="h-5 w-5 bg-gray-700 rounded-full flex items-center justify-center text-xs">
                      {platform[0].toUpperCase()}
                    </div>
                  </a>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Experiences</h4>
              <ul className="space-y-2 text-gray-400">
                {['Intimate Dinners', 'Wedding Rehearsals', 'Corporate Events', 'Culinary Classes'].map((item) => (
                  <li key={item}>
                    <a href="#" className="hover:text-white transition">{item}</a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">For Chefs</h4>
              <ul className="space-y-2 text-gray-400">
                {['Apply to Join', 'Chef Resources', 'Pricing Guide', 'FAQ'].map((item) => (
                  <li key={item}>
                    <a href="#" className="hover:text-white transition">{item}</a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Contact</h4>
              <address className="text-gray-400 not-italic text-sm space-y-2">
                <p>Concierge Desk</p>
                <p>New York, NY</p>
                <p className="mt-2">hello@savoryco.com</p>
                <p>+1 (888) CHEF-NOW</p>
              </address>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-10 pt-6 text-center text-gray-500 text-sm">
            © {new Date().getFullYear()} Savory & Co. All rights reserved. | Where every meal tells a story.
          </div>
        </div>
      </footer>

      {/* Toast */}
      {status && (
        <div className={`fixed bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-lg shadow-lg text-center z-50 ${
          status.startsWith('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {status}
        </div>
      )}
    </div>
  );
}