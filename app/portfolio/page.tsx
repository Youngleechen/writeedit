// app/portfolio/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { PageWithChrome } from '@/components/PageWithChrome';

// Define types
interface PortfolioItem {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  created_at: string;
}

interface TrustedClient {
  id: string;
  user_id: string;
  name: string;
  logo_url: string | null;
  created_at: string;
}

interface FormData {
  title?: string;
  description?: string;
  name?: string;
  image_url?: File | string | null;
  logo_url?: File | string | null;
}

// Helper: get current user ID
const getCurrentUserId = async (): Promise<string | null> => {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id || null;
};

// === Portfolio CRUD ===
async function createPortfolioItem({
  title,
  description,
  image_url,
}: {
  title: string;
  description: string;
  image_url: string;
}) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Authentication required');
  const { error } = await supabase
    .from('portfolio_items')
    .insert([{ user_id: userId, title, description, image_url }]);
  if (error) throw error;
}

async function updatePortfolioItem(
  id: string,
  { title, description, image_url }: { title: string; description: string; image_url: string }
) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Authentication required');
  const { error } = await supabase
    .from('portfolio_items')
    .update({ title, description, image_url })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}

async function deletePortfolioItem(id: string) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Authentication required');
  const { error } = await supabase
    .from('portfolio_items')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}

// === Trusted Clients CRUD ===
async function createTrustedClient({ name, logo_url }: { name: string; logo_url: string }) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Authentication required');
  const { error } = await supabase
    .from('trusted_clients')
    .insert([{ user_id: userId, name, logo_url }]);
  if (error) throw error;
}

async function updateTrustedClient(id: string, { name, logo_url }: { name: string; logo_url: string }) {
  const { error } = await supabase
    .from('trusted_clients')
    .update({ name, logo_url })
    .eq('id', id);
  if (error) throw error;
}

async function deleteTrustedClient(id: string) {
  const { error } = await supabase.from('trusted_clients').delete().eq('id', id);
  if (error) throw error;
}

// === Fetch public data ===
async function getAllPublicPortfolioItems(): Promise<PortfolioItem[]> {
  const { data, error } = await supabase
    .from('portfolio_items')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

async function getAllTrustedClients(): Promise<TrustedClient[]> {
  const { data, error } = await supabase
    .from('trusted_clients')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

// === Utils ===
function getOrgInitials(org: string): string {
  if (!org) return 'X';
  return org
    .split(' ')
    .map(w => w[0]?.toUpperCase())
    .join('')
    .substring(0, 3)
    .padEnd(2, org[0]?.toUpperCase() || 'X');
}

// === Image upload ===
async function uploadPortfolioImage(file: File): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Not authenticated');
  const fileName = `${userId}_${Date.now()}_${file.name}`;
  const filePath = `portfolio/${fileName}`;
  const { error } = await supabase.storage
    .from('portfolio-images')
    .upload(filePath, file, { cacheControl: '3600', upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from('portfolio-images').getPublicUrl(filePath);
  return data.publicUrl;
}

async function uploadClientImage(file: File): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Not authenticated');
  const fileName = `${userId}_${Date.now()}_${file.name}`;
  const filePath = `client-logos/${fileName}`;
  const { error } = await supabase.storage
    .from('portfolio-images')
    .upload(filePath, file, { cacheControl: '3600', upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from('portfolio-images').getPublicUrl(filePath);
  return data.publicUrl;
}

async function deleteImageFromStorage(path: string) {
  await supabase.storage.from('portfolio-images').remove([path]);
}

// === Main Component ===
export default function PortfolioPage() {
  const [projects, setProjects] = useState<PortfolioItem[]>([]);
  const [clients, setClients] = useState<TrustedClient[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<
    'addProject' | 'editProject' | 'addClient' | 'editClient' | null
  >(null);
  const [modalData, setModalData] = useState<FormData>({});
  const selectedItemRef = useRef<{ id: string; data: any } | null>(null);

  // Fetch data on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const userId = await getCurrentUserId();
        setCurrentUserId(userId);

        const [proj, cl] = await Promise.all([
          getAllPublicPortfolioItems(),
          getAllTrustedClients(),
        ]);
        setProjects(proj);
        setClients(cl);
      } catch (err: any) {
        setError(err.message || 'Failed to load portfolio');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const openModal = (
    mode: 'addProject' | 'editProject' | 'addClient' | 'editClient',
    item?: any
  ) => {
    selectedItemRef.current = item ? { id: item.id, data: item } : null;

    if (mode === 'editProject' && item) {
      setModalData({
        title: item.title,
        description: item.description || '',
        image_url: item.image_url || '',
      });
    } else if (mode === 'editClient' && item) {
      setModalData({
        name: item.name,
        logo_url: item.logo_url || '',
      });
    } else {
      setModalData({});
    }

    setModalMode(mode);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalMode(null);
    setModalData({});
    selectedItemRef.current = null;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const file = e.target.files?.[0];
    if (file) {
      setModalData(prev => ({ ...prev, [field]: file }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalMode) return;

    try {
      let imageUrl = '';
      let logoUrl = '';

      if (modalData.image_url instanceof File) {
        imageUrl = await uploadPortfolioImage(modalData.image_url);
      } else if (typeof modalData.image_url === 'string') {
        imageUrl = modalData.image_url;
      }

      if (modalData.logo_url instanceof File) {
        logoUrl = await uploadClientImage(modalData.logo_url);
      } else if (typeof modalData.logo_url === 'string') {
        logoUrl = modalData.logo_url;
      }

      if (modalMode === 'addProject') {
        await createPortfolioItem({
          title: modalData.title || '',
          description: modalData.description || '',
          image_url: imageUrl,
        });
      } else if (modalMode === 'editProject' && selectedItemRef.current) {
        await updatePortfolioItem(selectedItemRef.current.id, {
          title: modalData.title || '',
          description: modalData.description || '',
          image_url: imageUrl,
        });
      } else if (modalMode === 'addClient') {
        await createTrustedClient({
          name: modalData.name || '',
          logo_url: logoUrl,
        });
      } else if (modalMode === 'editClient' && selectedItemRef.current) {
        await updateTrustedClient(selectedItemRef.current.id, {
          name: modalData.name || '',
          logo_url: logoUrl,
        });
      }

      // Refresh data
      const [proj, cl] = await Promise.all([
        getAllPublicPortfolioItems(),
        getAllTrustedClients(),
      ]);
      setProjects(proj);
      setClients(cl);
      closeModal();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleDeleteProject = async (id: string, imageUrl: string | null) => {
    if (!confirm('Delete this project permanently?')) return;
    try {
      await deletePortfolioItem(id);
      if (imageUrl) {
        const urlParts = imageUrl.split('/');
        const filename = urlParts[urlParts.length - 1];
        await deleteImageFromStorage(`portfolio/${filename}`);
      }
      setProjects(prev => prev.filter(p => p.id !== id));
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleDeleteClient = async (id: string, logoUrl: string | null) => {
    if (!confirm('Delete this trusted client permanently?')) return;
    try {
      await deleteTrustedClient(id);
      if (logoUrl) {
        const urlParts = logoUrl.split('/');
        const filename = urlParts[urlParts.length - 1];
        await deleteImageFromStorage(`client-logos/${filename}`);
      }
      setClients(prev => prev.filter(c => c.id !== id));
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="portfolio-content" style={{ marginTop: '2rem', textAlign: 'center' }}>
        <div className="loading">Loading portfolio…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="portfolio-content" style={{ marginTop: '2rem', textAlign: 'center' }}>
        <div className="error">Failed to load portfolio: {error}</div>
      </div>
    );
  }

  return (
    <PageWithChrome>
      <div className="portfolio-content">
        {/* Trusted By Banner (Public) */}
        {clients.length > 0 && (
          <div
            className="credibility-banner"
            style={{
              background: '#f8fafc',
              padding: '2rem',
              borderRadius: '12px',
              marginBottom: '2.5rem',
              textAlign: 'center',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.03)',
            }}
          >
            <h3 style={{ margin: '0 0 1.5rem', color: '#1e293b', fontWeight: 600, fontSize: '1.4rem', letterSpacing: '-0.2px' }}>
              Trusted By
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '2rem', alignItems: 'center' }}>
              {clients.map(client => (
                <div
                  key={client.id}
                  className="org-badge"
                  title={client.name}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', transition: 'transform 0.2s ease' }}
                >
                  {client.logo_url ? (
                    <img
                      src={client.logo_url}
                      alt={client.name}
                      style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '64px',
                        height: '64px',
                        background: '#e2e8f0',
                        borderRadius: '50%',
                        fontWeight: 700,
                        color: '#475569',
                        fontSize: '1.2rem',
                        letterSpacing: '-0.5px',
                      }}
                    >
                      {getOrgInitials(client.name)}
                    </span>
                  )}
                  <small style={{ fontSize: '0.85rem', color: '#64748b', maxWidth: '120px', textAlign: 'center', fontWeight: 500 }}>
                    {client.name}
                  </small>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Owner: Trusted Clients Management */}
        {currentUserId && (
          <div
            className="trusted-clients-section"
            style={{
              marginBottom: '2.5rem',
              padding: '1.5rem',
              background: '#fcfdff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
            }}
          >
            <div
              className="trusted-clients-header"
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}
            >
              <h3 style={{ margin: 0, color: '#1e293b', fontWeight: 600, fontSize: '1.3rem' }}>My Trusted Clients</h3>
              <button
                className="btn primary"
                onClick={() => openModal('addClient')}
                style={{
                  padding: '0.6rem 1.2rem',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  background: '#3b82f6',
                  color: 'white',
                  transition: 'all 0.2s',
                }}
              >
                + Add Client
              </button>
            </div>
            {clients.length === 0 ? (
              <div
                className="empty-state"
                style={{
                  textAlign: 'center',
                  padding: '3rem 1rem',
                  color: '#7f8c8d',
                  border: '2px dashed #e2e8f0',
                  borderRadius: '12px',
                  background: '#fafcff',
                }}
              >
                <p>✨ No trusted clients added yet.</p>
              </div>
            ) : (
              <div
                className="trusted-clients-grid"
                style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.5rem' }}
              >
                {clients.map(client => (
                  <div
                    key={client.id}
                    className="client-card"
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '1rem',
                      background: 'white',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)',
                      transition: 'all 0.2s ease',
                      position: 'relative',
                    }}
                  >
                    {client.logo_url ? (
                      <img
                        src={client.logo_url}
                        alt={client.name}
                        className="client-logo"
                        style={{
                          width: '100%',
                          height: '80px',
                          borderRadius: '8px',
                          margin: '0.5rem 0',
                          objectFit: 'contain',
                          background: '#f8fafc',
                          border: '1px solid #f1f5f9',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.5rem',
                          fontWeight: 'bold',
                          color: '#475569',
                        }}
                      />
                    ) : (
                      <div
                        className="client-logo"
                        style={{
                          width: '100%',
                          height: '80px',
                          borderRadius: '8px',
                          margin: '0.5rem 0',
                          background: '#f8fafc',
                          border: '1px solid #f1f5f9',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.5rem',
                          fontWeight: 'bold',
                          color: '#475569',
                        }}
                      >
                        {getOrgInitials(client.name)}
                      </div>
                    )}
                    <div
                      className="client-name"
                      style={{
                        fontWeight: 600,
                        color: '#1e293b',
                        marginTop: '0.5rem',
                        fontSize: '0.95rem',
                        textAlign: 'center',
                      }}
                    >
                      {client.name}
                    </div>
                    <div
                      className="client-actions"
                      style={{
                        position: 'absolute',
                        top: '0.5rem',
                        right: '0.5rem',
                        display: 'flex',
                        gap: '0.25rem',
                      }}
                    >
                      <button
                        className="client-edit-btn"
                        onClick={() => openModal('editClient', client)}
                        style={{
                          padding: '0.25rem 0.5rem',
                          fontSize: '0.8rem',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontWeight: 600,
                          background: '#3b82f6',
                          color: 'white',
                          transition: 'opacity 0.2s',
                        }}
                      >
                        ✏️
                      </button>
                      <button
                        className="client-delete-btn"
                        onClick={() => handleDeleteClient(client.id, client.logo_url)}
                        style={{
                          padding: '0.25rem 0.5rem',
                          fontSize: '0.8rem',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontWeight: 600,
                          background: '#ef4444',
                          color: 'white',
                          transition: 'opacity 0.2s',
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Projects */}
        {projects.length === 0 ? (
          <div
            className="empty-state"
            style={{
              textAlign: 'center',
              padding: '3rem 1rem',
              color: '#7f8c8d',
              border: '2px dashed #e2e8f0',
              borderRadius: '12px',
              background: '#fafcff',
            }}
          >
            <p>✨ No projects published yet.</p>
            {currentUserId && (
              <button
                className="btn primary"
                onClick={() => openModal('addProject')}
                style={{
                  marginTop: '1rem',
                  padding: '0.6rem 1.2rem',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  background: '#3b82f6',
                  color: 'white',
                  transition: 'all 0.2s',
                }}
              >
                + Add Project
              </button>
            )}
          </div>
        ) : (
          <>
            <div
              className="project-grid"
              style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.8rem', marginTop: '1rem' }}
            >
              {projects.map(item => {
                const isOwner = currentUserId === item.user_id;
                return (
                  <div
                    key={item.id}
                    className="project-card"
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '1.25rem',
                      background: 'white',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <h3 style={{ margin: '0 0 0.75rem', fontSize: '1.15rem', color: '#1e293b', lineHeight: '1.3' }}>
                      {item.title}
                    </h3>
                    <p style={{ margin: '0 0 1rem', color: '#64748b', fontSize: '0.95rem', lineHeight: '1.6', flexGrow: 1 }}>
                      {item.description || <em>No description</em>}
                    </p>
                    {item.image_url && (
                      <div
                        className="project-image-container"
                        style={{
                          width: '100%',
                          margin: '0.5rem 0',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          border: '1px solid #f1f5f9',
                          background: '#f8fafc',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <img
                          src={item.image_url}
                          alt={item.title}
                          className="project-image"
                          style={{
                            width: '100%',
                            height: 'auto',
                            display: 'block',
                            objectFit: 'contain',
                            borderRadius: '8px',
                          }}
                        />
                      </div>
                    )}
                    {isOwner && (
                      <div
                        className="project-actions"
                        style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexShrink: 0 }}
                      >
                        <button
                          className="edit-btn"
                          onClick={() => openModal('editProject', item)}
                          style={{
                            flex: 1,
                            padding: '0.5rem',
                            fontSize: '0.9rem',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 600,
                            background: '#3b82f6',
                            color: 'white',
                            transition: 'opacity 0.2s',
                          }}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          className="delete-btn"
                          onClick={() => handleDeleteProject(item.id, item.image_url)}
                          style={{
                            flex: 1,
                            padding: '0.5rem',
                            fontSize: '0.9rem',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 600,
                            background: '#ef4444',
                            color: 'white',
                            transition: 'opacity 0.2s',
                          }}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {currentUserId && (
              <button
                className="btn primary"
                style={{
                  marginTop: '1.5rem',
                  display: 'block',
                  marginLeft: 'auto',
                  marginRight: 'auto',
                  padding: '0.6rem 1.2rem',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  background: '#3b82f6',
                  color: 'white',
                  transition: 'all 0.2s',
                }}
                onClick={() => openModal('addProject')}
              >
                + Add Project
              </button>
            )}
          </>
        )}

        {/* Modal */}
        {modalOpen && (
          <div
            className="portfolio-modal"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              background: 'rgba(0, 0, 0, 0.6)',
              zIndex: 10000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
            }}
          >
            <div
              className="portfolio-modal-content"
              style={{
                background: 'white',
                padding: '2rem',
                borderRadius: '14px',
                maxWidth: '520px',
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              }}
            >
              <span
                className="close"
                onClick={closeModal}
                style={{
                  position: 'absolute',
                  top: '1.25rem',
                  right: '1.25rem',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#cbd5e1',
                  transition: 'color 0.2s',
                }}
              >
                &times;
              </span>
              <h2 style={{ marginTop: 0, color: '#1e293b', fontSize: '1.4rem' }}>
                {modalMode === 'addProject'
                  ? 'Add New Project'
                  : modalMode === 'editProject'
                  ? 'Edit Project'
                  : modalMode === 'addClient'
                  ? 'Add Trusted Client'
                  : 'Edit Trusted Client'}
              </h2>
              <form id="portfolio-modal-form" onSubmit={handleSubmit}>
                {(modalMode === 'addProject' || modalMode === 'editProject') && (
                  <>
                    <div style={{ marginBottom: '1.5rem' }}>
                      <label
                        htmlFor="pf-title"
                        style={{ display: 'block', marginBottom: '0.6rem', fontWeight: 600, color: '#1e293b', fontSize: '0.95rem' }}
                      >
                        Project Title
                      </label>
                      <input
                        type="text"
                        id="pf-title"
                        value={modalData.title || ''}
                        onChange={e => setModalData(prev => ({ ...prev, title: e.target.value }))}
                        required
                        style={{
                          width: '100%',
                          padding: '0.65rem',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          fontSize: '0.95rem',
                          fontFamily: 'inherit',
                        }}
                      />
                    </div>
                    <div style={{ marginBottom: '1.5rem' }}>
                      <label
                        htmlFor="pf-description"
                        style={{ display: 'block', marginBottom: '0.6rem', fontWeight: 600, color: '#1e293b', fontSize: '0.95rem' }}
                      >
                        Description
                      </label>
                      <textarea
                        id="pf-description"
                        value={modalData.description || ''}
                        onChange={e => setModalData(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Details about this project..."
                        style={{
                          width: '100%',
                          padding: '0.65rem',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          fontSize: '0.95rem',
                          fontFamily: 'inherit',
                          resize: 'vertical',
                          minHeight: '100px',
                        }}
                      />
                    </div>
                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.6rem', fontWeight: 600, color: '#1e293b', fontSize: '0.95rem' }}>
                        Project Image (optional)
                      </label>
                      <div
                        style={{
                          border: '2px dashed #cbd5e1',
                          borderRadius: '10px',
                          padding: '1.5rem',
                          textAlign: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          minHeight: '160px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}
                        onClick={() => document.getElementById('pf-image_url')?.click()}
                      >
                        {typeof modalData.image_url === 'string' && modalData.image_url && (
                          <img
                            src={modalData.image_url}
                            alt="Preview"
                            style={{
                              maxWidth: '100%',
                              maxHeight: '200px',
                              borderRadius: '8px',
                              marginBottom: '1rem',
                              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                            }}
                          />
                        )}
                        <input
                          type="file"
                          id="pf-image_url"
                          accept="image/*"
                          onChange={e => handleFileChange(e, 'image_url')}
                          style={{ display: 'none' }}
                        />
                        <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.95rem' }}>
                          Drag & drop an image or click to browse
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {(modalMode === 'addClient' || modalMode === 'editClient') && (
                  <>
                    <div style={{ marginBottom: '1.5rem' }}>
                      <label
                        htmlFor="pf-name"
                        style={{ display: 'block', marginBottom: '0.6rem', fontWeight: 600, color: '#1e293b', fontSize: '0.95rem' }}
                      >
                        Client Name
                      </label>
                      <input
                        type="text"
                        id="pf-name"
                        value={modalData.name || ''}
                        onChange={e => setModalData(prev => ({ ...prev, name: e.target.value }))}
                        required
                        style={{
                          width: '100%',
                          padding: '0.65rem',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          fontSize: '0.95rem',
                          fontFamily: 'inherit',
                        }}
                      />
                    </div>
                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.6rem', fontWeight: 600, color: '#1e293b', fontSize: '0.95rem' }}>
                        Logo Image (optional)
                      </label>
                      <div
                        style={{
                          border: '2px dashed #cbd5e1',
                          borderRadius: '10px',
                          padding: '1.5rem',
                          textAlign: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          minHeight: '160px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}
                        onClick={() => document.getElementById('pf-logo_url')?.click()}
                      >
                        {typeof modalData.logo_url === 'string' && modalData.logo_url && (
                          <img
                            src={modalData.logo_url}
                            alt="Preview"
                            style={{
                              maxWidth: '100%',
                              maxHeight: '200px',
                              borderRadius: '8px',
                              marginBottom: '1rem',
                              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                            }}
                          />
                        )}
                        <input
                          type="file"
                          id="pf-logo_url"
                          accept="image/*"
                          onChange={e => handleFileChange(e, 'logo_url')}
                          style={{ display: 'none' }}
                        />
                        <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.95rem' }}>
                          Drag & drop an image or click to browse
                        </p>
                      </div>
                    </div>
                  </>
                )}

                <div
                  style={{
                    display: 'flex',
                    gap: '0.75rem',
                    justifyContent: 'flex-end',
                    marginTop: '1.5rem',
                  }}
                >
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={closeModal}
                    style={{
                      padding: '0.6rem 1.2rem',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: '0.95rem',
                      background: '#f1f5f9',
                      color: '#1e293b',
                      transition: 'all 0.2s',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn primary"
                    style={{
                      padding: '0.6rem 1.2rem',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: '0.95rem',
                      background: '#3b82f6',
                      color: 'white',
                      transition: 'all 0.2s',
                    }}
                  >
                    Save
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </PageWithChrome>
  );
}