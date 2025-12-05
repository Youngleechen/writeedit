// app/real-estate/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useImageUpload } from '@/hooks/useImageUpload';

// Define a mutable version of the property for local editing
interface Property {
  id: number;
  title: string;
  location: string;
  price: string;
  beds: number;
  baths: number;
  sqft: number;
  image: string;
  featured: boolean;
  rating: number;
  type: string;
  description: string;
}

const App = () => {
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [scrolled, setScrolled] = useState(false);

  // Mock property data (now treated as mutable for demo)
  const [properties, setProperties] = useState<Property[]>([
    {
      id: 1,
      title: 'Luxury Waterfront Villa',
      location: 'Malibu, California',
      price: '$8,500,000',
      beds: 6,
      baths: 8,
      sqft: 12500,
      image: 'https://placehold.co/600x400/1a1a2e/ffffff?text=Luxury+Villa',
      featured: true,
      rating: 4.9,
      type: 'Villa',
      description:
        'Stunning oceanfront estate with panoramic views, private beach access, infinity pool, and smart home technology throughout.',
    },
    {
      id: 2,
      title: 'Modern Downtown Penthouse',
      location: 'Manhattan, New York',
      price: '$4,200,000',
      beds: 3,
      baths: 3,
      sqft: 3200,
      image: 'https://placehold.co/600x400/16213e/ffffff?text=Modern+Penthouse',
      featured: true,
      rating: 4.8,
      type: 'Penthouse',
      description:
        'Contemporary penthouse featuring floor-to-ceiling windows, private rooftop terrace, and premium finishes throughout.',
    },
    {
      id: 3,
      title: 'Mountain Retreat Estate',
      location: 'Aspen, Colorado',
      price: '$6,800,000',
      beds: 5,
      baths: 6,
      sqft: 8900,
      image: 'https://placehold.co/600x400/0f3460/ffffff?text=Mountain+Estate',
      featured: false,
      rating: 4.7,
      type: 'Estate',
      description:
        'Secluded mountain estate with ski-in/ski-out access, great room with stone fireplace, and expansive outdoor living spaces.',
    },
    {
      id: 4,
      title: 'Beachfront Condo Paradise',
      location: 'Miami Beach, Florida',
      price: '$2,950,000',
      beds: 4,
      baths: 4,
      sqft: 3800,
      image: 'https://placehold.co/600x400/533483/ffffff?text=Beachfront+Condo',
      featured: true,
      rating: 4.9,
      type: 'Condo',
      description:
        'Luxury beachfront condominium with direct ocean access, resort-style amenities, and designer interiors.',
    },
    {
      id: 5,
      title: 'Historic Brownstone',
      location: 'Brooklyn, New York',
      price: '$3,750,000',
      beds: 5,
      baths: 4,
      sqft: 4200,
      image: 'https://placehold.co/600x400/e94560/ffffff?text=Historic+Brownstone',
      featured: false,
      rating: 4.6,
      type: 'Brownstone',
      description:
        'Fully renovated historic brownstone featuring original architectural details, modern amenities, and private garden.',
    },
    {
      id: 6,
      title: 'Golf Course Mansion',
      location: 'Scottsdale, Arizona',
      price: '$5,200,000',
      beds: 6,
      baths: 7,
      sqft: 9800,
      image: 'https://placehold.co/600x400/f7b267/ffffff?text=Golf+Mansion',
      featured: true,
      rating: 4.8,
      type: 'Mansion',
      description:
        'Mediterranean-style mansion overlooking championship golf course with resort-style pool, outdoor kitchen, and guest house.',
    },
  ]);

  const stats = [
    { value: '12,500+', label: 'Properties Listed', icon: <Home className="w-6 h-6" /> },
    { value: '8,900+', label: 'Happy Clients', icon: <Users className="w-6 h-6" /> },
    { value: '98%', label: 'Client Satisfaction', icon: <Star className="w-6 h-6" /> },
    { value: '$2.1B', label: 'Total Sales Volume', icon: <TrendingUp className="w-6 h-6" /> },
  ];

  const filteredProperties = properties.filter(
    (property) =>
      property.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      property.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle image replacement in modal
  const handleReplaceImage = (propertyId: number, newImageUrl: string) => {
    setProperties((prev) =>
      prev.map((p) => (p.id === propertyId ? { ...p, image: newImageUrl } : p))
    );
    if (selectedProperty && selectedProperty.id === propertyId) {
      setSelectedProperty({ ...selectedProperty, image: newImageUrl });
    }
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
  className="relative h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-gray-900 via-black to-indigo-950"
  style={{ paddingTop: '120px', paddingBottom: '80px' }}
>
  <div className="absolute inset-0 bg-black/40"></div>
  
  <div className="text-center text-white z-10 max-w-4xl mx-auto px-4">
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
        />
      </div>
      <button className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:shadow-lg hover:scale-105 transition-all">
        Search
      </button>
    </motion.div>
  </div>
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
                  <div className="text-blue-600">
                    {stat.icon}
                  </div>
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
            {filteredProperties.filter(p => p.featured).map((property, index) => (
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
                  <img 
                    src={property.image} 
                    alt={property.title}
                    className="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-500"
                  />
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
                  <img 
                    src={property.image} 
                    alt={property.title}
                    className="w-full h-56 object-cover group-hover:scale-105 transition-transform duration-300"
                  />
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
                  <div key={i} className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-gradient-to-r hover:from-blue-600 hover:to-purple-600 transition-all cursor-pointer">
                    <Navigation className="w-5 h-5" />
                  </div>
                ))}
              </div>
            </div>
            
            {['Quick Links', 'Properties', 'Services', 'Contact'].map((category, index) => (
              <div key={category}>
                <h3 className="text-lg font-semibold mb-4 text-white">{category}</h3>
                <ul className="space-y-3 text-gray-400">
                  {['Home', 'About Us', 'Meet Agents', 'Blog', 'Contact'].slice(0, 4).map((item) => (
                    <li key={item} className="hover:text-white transition-colors cursor-pointer hover:translate-x-1">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          
          <div className="border-t border-gray-800 pt-8 text-center text-gray-400">
            <p className="text-sm">&copy; 2025 LuxEstate. All rights reserved. Licensed Real Estate Brokers serving luxury clients worldwide.</p>
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
                <img 
                  src={selectedProperty.image} 
                  alt={selectedProperty.title}
                  className="w-full h-80 md:h-96 object-cover"
                />
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

                {/* ✨ UPLOAD ZONE OVERLAY (only in modal) */}
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer">
                  <div className="flex items-center space-x-2 bg-white px-4 py-2 rounded-full font-medium text-gray-800">
                    <Camera className="w-4 h-4" />
                    <span>Replace Image</span>
                  </div>
                </div>

                {/* Hidden Upload UI triggered by click */}
                <ReplaceImageButton
                  propertyId={selectedProperty.id}
                  currentImage={selectedProperty.image}
                  onReplace={handleReplaceImage}
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

// ✨ Reusable Upload Trigger Component (inside modal only)
const ReplaceImageButton = ({ propertyId, currentImage, onReplace }: { propertyId: number; currentImage: string; onReplace: (id: number, url: string) => void }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { upload } = useImageUpload({ pathPrefix: 'properties' });

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // prevent closing modal
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    const result = await upload(file);
    if (result) {
      onReplace(propertyId, result.publicUrl);
    } else {
      setError('Upload failed');
    }

    setIsUploading(false);
  };

  // Overlay click triggers file dialog
  return (
    <>
      <div
        onClick={handleClick}
        className="absolute inset-0 z-10"
        style={{ display: 'block' }}
      />
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        ref={fileInputRef}
        className="hidden"
      />
      {isUploading && (
        <div className="absolute top-4 left-4 bg-black/70 text-white px-3 py-1 rounded-full text-sm">
          Uploading...
        </div>
      )}
      {error && (
        <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded-full text-sm">
          {error}
        </div>
      )}
    </>
  );
};

export default App;