// app/real-estate/page.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  MapPin,
  Camera,
  Bed,
  Bath,
  Square,
  ChevronRight,
  Star,
  Heart,
  Menu,
  X,
  Users,
  Award,
  TrendingUp,
  Phone,
  Mail,
  Navigation,
  Home,
  ChevronDown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Property {
  id: string;
  title: string;
  location: string;
  price: string;
  beds: number;
  baths: number;
  sqft: number;
  image: string; // real Supabase URL or empty string
  featured: boolean;
  rating: number;
  type: string;
  description: string;
}

// Mock data with EMPTY image fields — no placeholders!
const MOCK_PROPERTIES: Property[] = [
  {
    id: 'prop-1',
    title: 'Oceanfront Villa',
    location: 'Malibu, CA',
    price: '$4.2M',
    beds: 5,
    baths: 6,
    sqft: 6200,
    image: '',
    featured: true,
    rating: 4.8,
    type: 'Villa',
    description: 'Stunning ocean-view villa with private beach access and infinity pool.',
  },
  {
    id: 'prop-2',
    title: 'Downtown Penthouse',
    location: 'New York, NY',
    price: '$3.8M',
    beds: 3,
    baths: 3.5,
    sqft: 3200,
    image: '',
    featured: true,
    rating: 4.6,
    type: 'Penthouse',
    description: 'Luxury penthouse with panoramic city views and rooftop terrace.',
  },
  {
    id: 'prop-3',
    title: 'Mountain Retreat',
    location: 'Aspen, CO',
    price: '$5.1M',
    beds: 6,
    baths: 7,
    sqft: 7800,
    image: '',
    featured: false,
    rating: 4.9,
    type: 'Chalet',
    description: 'Secluded alpine estate with ski-in/ski-out access.',
  },
  {
    id: 'prop-4',
    title: 'Historic Townhouse',
    location: 'Charleston, SC',
    price: '$2.9M',
    beds: 4,
    baths: 4,
    sqft: 4100,
    image: '',
    featured: false,
    rating: 4.5,
    type: 'Townhouse',
    description: 'Restored 19th-century townhouse with original details and garden.',
  },
];

const App = () => {
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [properties, setProperties] = useState<Property[]>([]);

  const stats = [
    { value: '12,500+', label: 'Properties Listed', icon: <Home className="w-6 h-6" /> },
    { value: '8,900+', label: 'Happy Clients', icon: <Users className="w-6 h-6" /> },
    { value: '98%', label: 'Client Satisfaction', icon: <Star className="w-6 h-6" /> },
    { value: '$2.1B', label: 'Total Sales Volume', icon: <TrendingUp className="w-6 h-6" /> },
  ];

  // Initialize properties from blog_posts (auto-creates if missing)
  useEffect(() => {
    const initializeProperties = async () => {
      setIsLoading(true);
      try {
        const { data: existing, error: fetchError } = await supabase
          .from('blog_posts')
          .select('id, title, content, image_url, user_id, type, metadata')
          .eq('type', 'property');

        if (fetchError) throw fetchError;

        if (existing && existing.length > 0) {
          // Hydrate from real DB — assume metadata holds beds, price, etc.
          const hydrated = existing.map(row => {
            const meta = row.metadata || {};
            return {
              id: row.id,
              title: row.title,
              location: meta.location || '',
              price: meta.price || '',
              beds: meta.beds || 0,
              baths: meta.baths || 0,
              sqft: meta.sqft || 0,
              featured: meta.featured || false,
              rating: meta.rating || 0,
              type: meta.type || 'Property',
              description: row.content || '',
              image: row.image_url || '',
            };
          });
          setProperties(hydrated);
        } else {
          // Seed with mock data (images are empty by design)
          const blogRecords = MOCK_PROPERTIES.map(p => ({
            id: p.id,
            title: p.title,
            content: p.description,
            image_url: p.image, // empty string
            published: true,
            user_id: 'system',
            type: 'property',
            metadata: {
              location: p.location,
              price: p.price,
              beds: p.beds,
              baths: p.baths,
              sqft: p.sqft,
              featured: p.featured,
              rating: p.rating,
              type: p.type,
            },
          }));

          const { error: upsertError } = await supabase
            .from('blog_posts')
            .upsert(blogRecords, { onConflict: 'id' });

          if (upsertError) throw upsertError;
          setProperties(MOCK_PROPERTIES);
        }
      } catch (err: any) {
        console.error('Failed to initialize properties:', err);
        alert('Failed to load properties. Check console.');
      } finally {
        setIsLoading(false);
      }
    };

    initializeProperties();
  }, []);

  const filteredProperties = properties.filter(
    (property) =>
      property.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      property.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleReplaceImage = async (propertyId: string, newImageUrl: string) => {
    setProperties(prev =>
      prev.map(p => (p.id === propertyId ? { ...p, image: newImageUrl } : p))
    );

    if (selectedProperty && selectedProperty.id === propertyId) {
      setSelectedProperty({ ...selectedProperty, image: newImageUrl });
    }

    const { error } = await supabase
      .from('blog_posts')
      .update({ image_url: newImageUrl })
      .eq('id', propertyId)
      .eq('type', 'property');

    if (error) {
      alert(`Failed to save image: ${error.message}`);
    }
  };

  // Scroll effect for header
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Upload handler (used in ReplaceImageButton)
  const handleFileUpload = async (
    file: File,
    propertyId: string,
    onReplace: (id: string, url: string) => void
  ) => {
    try {
      const filePath = `properties/${propertyId}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from('blog-images')
        .upload(filePath, file, { upsert: false });

      if (uploadErr) throw uploadErr;

      const { data } = supabase.storage.from('blog-images').getPublicUrl(filePath);
      onReplace(propertyId, data.publicUrl);
    } catch (err: any) {
      console.error('Upload error:', err);
      alert(`Upload failed: ${err.message}`);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-xl">Loading properties...</div>
      </div>
    );
  }

  // --- RENDER IMAGE WITH EMPTY STATE ---
  const renderPropertyImage = (property: Property, size: 'card' | 'modal') => {
    const isCard = size === 'card';
    const hClass = isCard ? 'h-64' : 'h-80 md:h-96';

    if (property.image) {
      return (
        <img
          src={property.image}
          alt={property.title}
          className={`w-full ${hClass} object-cover`}
        />
      );
    }

    return (
      <div
        className={`w-full ${hClass} bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400`}
      >
        <Camera className="w-8 h-8 mr-2" />
        <span>No image</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header
        id="header"
        className={`fixed top-0 w-full z-50 transition-all duration-300 ${
          scrolled ? 'bg-white shadow-lg py-2' : 'bg-transparent py-4'
        }`}
      >
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <motion.div
              className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              LuxEstate
            </motion.div>

            <nav className="hidden md:flex space-x-8">
              {['Home', 'Properties', 'Agents', 'About', 'Contact'].map((item, index) => (
                <motion.a
                  key={item}
                  href="#"
                  className={`font-medium transition-colors ${
                    scrolled
                      ? 'text-gray-700 hover:text-blue-600'
                      : 'text-white hover:text-blue-300'
                  }`}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                >
                  {item}
                </motion.a>
              ))}
            </nav>

            <div className="flex items-center space-x-4">
              <button className="hidden md:block bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-full font-medium hover:shadow-lg transition-all hover:scale-105">
                List Property
              </button>
              <button
                className="md:hidden text-white"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
              >
                {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white shadow-lg"
          >
            <div className="container mx-auto px-4 py-4 space-y-4">
              {['Home', 'Properties', 'Agents', 'About', 'Contact'].map((item) => (
                <a key={item} href="#" className="block text-gray-700 hover:text-blue-600 font-medium">
                  {item}
                </a>
              ))}
              <button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-full font-medium">
                List Your Property
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <section
        className="relative h-screen flex items-center justify-center overflow-hidden"
        style={{
          backgroundImage: `url('https://placehold.co/1920x1080/0f172a/ffffff?text=Premium+Real+Estate')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 to-black/80"></div>
        <div
          className="relative z-10 text-center text-white max-w-4xl mx-auto px-4"
          style={{ paddingTop: '120px', paddingBottom: '80px' }}
        >
          <motion.h1
            className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 leading-tight"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            Find Your <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">Perfect</span> Home
          </motion.h1>

          <motion.p
            className="text-xl md:text-2xl font-medium text-gray-300 mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            Premium Real Estate
          </motion.p>

          <motion.div
            className="flex items-center justify-center gap-2"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by location, property type, or price..."
                className="w-full py-3 pl-12 pr-4 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:shadow-lg hover:scale-105 transition-all">
              Search
            </button>
          </motion.div>
        </div>

        <motion.div
          className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <ChevronDown className="w-6 h-6 text-white/80" />
        </motion.div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white border-b border-gray-100">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <motion.div
                key={index}
                className="text-center group"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl mb-4 group-hover:scale-110 transition-transform">
                  <div className="text-blue-600">{stat.icon}</div>
                </div>
                <div className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">{stat.value}</div>
                <div className="text-gray-600 font-medium">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Properties */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-100 to-purple-100 rounded-2xl mb-6">
              <Award className="w-8 h-8 text-blue-600" />
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Featured Properties
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Our handpicked selection of premium properties offering exceptional value and luxury craftsmanship.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredProperties
              .filter((p) => p.featured)
              .map((property, index) => (
                <motion.div
                  key={property.id}
                  className="bg-white rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer group relative"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  whileHover={{ y: -8 }}
                  onClick={() => setSelectedProperty(property)}
                >
                  <div className="relative overflow-hidden">
                    {renderPropertyImage(property, 'card')}
                    <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-full p-2 shadow-lg">
                      <Heart className="w-5 h-5 text-gray-400 hover:text-red-500 transition-colors" />
                    </div>
                    <div className="absolute bottom-4 left-4">
                      <span className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-3 py-1.5 rounded-full text-sm font-semibold">
                        {property.type}
                      </span>
                    </div>
                  </div>

                  <div className="p-6">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xl font-bold text-gray-900 leading-tight">{property.title}</h3>
                      <div className="flex items-center bg-yellow-50 px-2 py-1 rounded-full">
                        <Star className="w-4 h-4 text-yellow-400 fill-current" />
                        <span className="ml-1 text-sm font-semibold text-gray-700">{property.rating}</span>
                      </div>
                    </div>

                    <div className="flex items-center text-gray-600 mb-4">
                      <MapPin className="w-4 h-4 mr-2 text-gray-500" />
                      <span className="text-sm">{property.location}</span>
                    </div>

                    <div className="flex items-center justify-between mb-4">
                      <span className="text-2xl font-bold text-blue-600">{property.price}</span>
                    </div>

                    <div className="flex items-center justify-between text-gray-600 text-sm">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center">
                          <Bed className="w-4 h-4 mr-1" />
                          <span>{property.beds} beds</span>
                        </div>
                        <div className="flex items-center">
                          <Bath className="w-4 h-4 mr-1" />
                          <span>{property.baths} baths</span>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <Square className="w-4 h-4 mr-1" />
                        <span>{property.sqft.toLocaleString()} sqft</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
          </div>
        </div>
      </section>

      {/* All Properties */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              All Properties
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Browse our complete collection of available luxury properties worldwide.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredProperties.map((property, index) => (
              <motion.div
                key={property.id}
                className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group relative"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                whileHover={{ y: -6 }}
                onClick={() => setSelectedProperty(property)}
              >
                <div className="relative overflow-hidden">
                  {renderPropertyImage(property, 'card')}
                  <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-full p-1.5 shadow-lg">
                    <Heart className="w-4 h-4 text-gray-400 hover:text-red-500 transition-colors" />
                  </div>
                </div>

                <div className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-bold text-gray-900 leading-tight">{property.title}</h3>
                    <div className="flex items-center bg-yellow-50 px-1.5 py-0.5 rounded-full">
                      <Star className="w-3 h-3 text-yellow-400 fill-current" />
                      <span className="ml-1 text-xs font-semibold text-gray-700">{property.rating}</span>
                    </div>
                  </div>

                  <div className="flex items-center text-gray-600 text-xs mb-3">
                    <MapPin className="w-3 h-3 mr-1.5 text-gray-500" />
                    <span>{property.location}</span>
                  </div>

                  <div className="flex items-center justify-between mb-3">
                    <span className="text-lg font-bold text-blue-600">{property.price}</span>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{property.type}</span>
                  </div>

                  <div className="flex items-center text-gray-600 text-xs">
                    <div className="flex items-center mr-3">
                      <Bed className="w-3 h-3 mr-1" />
                      <span>{property.beds}</span>
                    </div>
                    <div className="flex items-center mr-3">
                      <Bath className="w-3 h-3 mr-1" />
                      <span>{property.baths}</span>
                    </div>
                    <div className="flex items-center">
                      <Square className="w-3 h-3 mr-1" />
                      <span>{property.sqft.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="container mx-auto px-4 text-center">
          <motion.h2
            className="text-4xl md:text-5xl font-bold text-white mb-6"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            Ready to Find Your Dream Home?
          </motion.h2>
          <motion.p
            className="text-lg md:text-xl text-blue-100 mb-8 max-w-3xl mx-auto leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Our expert agents are ready to help you navigate the luxury real estate market and find the perfect property that matches your lifestyle and investment goals.
          </motion.p>
          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <button className="bg-white text-blue-600 px-8 py-4 rounded-xl font-bold text-lg hover:shadow-xl transition-all hover:scale-105 flex items-center justify-center">
              <Phone className="w-5 h-5 mr-2" />
              Schedule Consultation
            </button>
            <button className="bg-transparent border-2 border-white text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-white hover:text-blue-600 transition-all flex items-center justify-center">
              <Mail className="w-5 h-5 mr-2" />
              Contact Agent
            </button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            <div>
              <div className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-4">
                LuxEstate
              </div>
              <p className="text-gray-400 mb-6 leading-relaxed">
                Your trusted partner in luxury real estate. We specialize in helping clients find, buy, and sell premium properties worldwide with unmatched expertise and personalized service.
              </p>
              <div className="flex space-x-4">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-gradient-to-r hover:from-blue-600 hover:to-purple-600 transition-all cursor-pointer"
                  >
                    <Navigation className="w-5 h-5" />
                  </div>
                ))}
              </div>
            </div>

            {['Quick Links', 'Properties', 'Services', 'Contact'].map((category) => (
              <div key={category}>
                <h3 className="text-lg font-semibold mb-4 text-white">{category}</h3>
                <ul className="space-y-3 text-gray-400">
                  {['Home', 'About Us', 'Meet Agents', 'Blog', 'Contact']
                    .slice(0, 4)
                    .map((item) => (
                      <li
                        key={item}
                        className="hover:text-white transition-colors cursor-pointer hover:translate-x-1"
                      >
                        {item}
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-800 pt-8 text-center text-gray-400">
            <p className="text-sm">
              &copy; 2025 LuxEstate. All rights reserved. Licensed Real Estate Brokers serving luxury clients worldwide.
            </p>
          </div>
        </div>
      </footer>

      {/* Property Detail Modal */}
      <AnimatePresence>
        {selectedProperty && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
            onClick={() => setSelectedProperty(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative">
                {renderPropertyImage(selectedProperty, 'modal')}

                <button
                  className="absolute top-6 right-6 bg-white/90 backdrop-blur-sm rounded-full p-2 shadow-lg hover:shadow-xl transition-all"
                  onClick={() => setSelectedProperty(null)}
                >
                  <X className="w-6 h-6 text-gray-700" />
                </button>

                <div className="absolute bottom-6 left-6">
                  <span className="bg-white/90 backdrop-blur-sm text-gray-800 px-4 py-2 rounded-full text-sm font-semibold">
                    {selectedProperty.type}
                  </span>
                </div>

                {/* Upload Overlay Trigger */}
                <div
                  className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    document.getElementById(`upload-${selectedProperty.id}`)?.click();
                  }}
                >
                  <div className="flex items-center space-x-2 bg-white px-4 py-2 rounded-full font-medium text-gray-800">
                    <Camera className="w-4 h-4" />
                    <span>Replace Image</span>
                  </div>
                </div>

                {/* Hidden file input */}
                <input
                  id={`upload-${selectedProperty.id}`}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      await handleFileUpload(file, selectedProperty.id, handleReplaceImage);
                      e.target.value = ''; // reset
                    }
                  }}
                />
              </div>

              <div className="p-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
                  <div>
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">{selectedProperty.title}</h2>
                    <div className="flex items-center text-gray-600">
                      <MapPin className="w-5 h-5 mr-2" />
                      <span className="text-lg">{selectedProperty.location}</span>
                    </div>
                  </div>
                  <div className="flex items-center bg-yellow-50 px-3 py-2 rounded-full mt-2 md:mt-0">
                    <Star className="w-5 h-5 text-yellow-400 fill-current" />
                    <span className="ml-2 text-gray-700 font-semibold">{selectedProperty.rating}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="text-center p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl">
                    <div className="text-2xl font-bold text-blue-600 mb-1">{selectedProperty.price}</div>
                    <div className="text-gray-600 text-sm font-medium">List Price</div>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl">
                    <div className="text-2xl font-bold text-gray-900 mb-1">{selectedProperty.beds}</div>
                    <div className="text-gray-600 text-sm font-medium">Bedrooms</div>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl">
                    <div className="text-2xl font-bold text-gray-900 mb-1">{selectedProperty.baths}</div>
                    <div className="text-gray-600 text-sm font-medium">Bathrooms</div>
                  </div>
                </div>

                <div className="mb-8">
                  <h3 className="text-xl font-semibold mb-4 text-gray-900">Property Details</h3>
                  <p className="text-gray-600 leading-relaxed text-base">
                    {selectedProperty.description}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <button className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-xl font-bold hover:shadow-xl transition-all hover:scale-105">
                    Schedule a Private Viewing
                  </button>
                  <button className="flex-1 bg-gray-900 text-white py-4 rounded-xl font-bold hover:bg-gray-800 transition-all">
                    Contact Listing Agent
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;