// pages/portfolio.tsx
import { useState, useEffect, useRef } from 'react';
import { NextPage } from 'next';
import { createClient } from '@supabase/supabase-js';

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

// Initialize Supabase (client-side)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Helper: get user ID
const getCurrentUserId = async (): Promise<string | null> => {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id || null;
};

// Portfolio CRUD
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

// Trusted Clients CRUD
async function createTrustedClient({ name, logo_url }: { name: string; logo_url: string }) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Authentication required');
  const { error } = await supabase
    .from('trusted_clients')
    .insert([{ user_id: userId, name, logo_url }]);
  if (error) throw error;
}

async function updateTrustedClient(
  id: string,
  { name, logo_url }: { name: string; logo_url: string }
) {
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

// Fetch data
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

// Utils
function getOrgInitials(org: string): string {
  if (!org) return 'X';
  return org
    .split(' ')
    .map(w => w[0]?.toUpperCase())
    .join('')
    .substring(0, 3)
    .padEnd(2, org[0]?.toUpperCase() || 'X');
}

// Image upload
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

// Delete image from storage
async function deleteImageFromStorage(path: string) {
  await supabase.storage.from('portfolio-images').remove([path]);
}

const PortfolioPage: NextPage = () => {
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

  // Fetch data
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

  // Modal handlers
  const openModal = (
    mode: 'addProject' | 'editProject' | 'addClient' | 'editClient',
    item?: any
  ) => {
    if (item) {
      selectedItemRef.current = { id: item.id, data: item };
    } else {
      selectedItemRef.current = null;
    }

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
      <div className="portfolio-content">
        <div className="loading">Loading portfolio…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="portfolio-content">
        <div className="error">Failed to load portfolio: {error}</div>
      </div>
    );
  }

  return (
    <div className="portfolio-content" style={{ marginTop: '1.5rem' }}>
      {/* Trusted By Banner (Public) */}
      {clients.length > 0 && (
        <div className="credibility-banner">
          <h3>Trusted By</h3>
          <div className="org-logos">
            {clients.map(client => (
              <div
                key={client.id}
                className="org-badge"
                title={client.name}
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
                  <span>{getOrgInitials(client.name)}</span>
                )}
                <small>{client.name}</small>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Owner: Trusted Clients Management */}
      {currentUserId && (
        <div className="trusted-clients-section">
          <div className="trusted-clients-header">
            <h3>My Trusted Clients</h3>
            <button className="btn primary" onClick={() => openModal('addClient')}>
              + Add Client
            </button>
          </div>
          {clients.length === 0 ? (
            <div className="empty-state">
              <p>✨ No trusted clients added yet.</p>
            </div>
          ) : (
            <div className="trusted-clients-grid">
              {clients.map(client => (
                <div key={client.id} className="client-card" data-id={client.id}>
                  {client.logo_url ? (
                    <img
                      src={client.logo_url}
                      alt={client.name}
                      className="client-logo"
                    />
                  ) : (
                    <div className="client-logo">{getOrgInitials(client.name)}</div>
                  )}
                  <div className="client-name">{client.name}</div>
                  <div className="client-actions">
                    <button
                      className="client-edit-btn"
                      onClick={() => openModal('editClient', client)}
                    >
                      ✏️
                    </button>
                    <button
                      className="client-delete-btn"
                      onClick={() => handleDeleteClient(client.id, client.logo_url)}
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
        <div className="empty-state">
          <p>✨ No projects published yet.</p>
          {currentUserId && (
            <button
              className="btn primary"
              style={{ marginTop: '1rem' }}
              onClick={() => openModal('addProject')}
            >
              + Add Project
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="project-grid">
            {projects.map(item => {
              const isOwner = currentUserId === item.user_id;
              return (
                <div key={item.id} className="project-card" data-id={item.id}>
                  <h3>{item.title}</h3>
                  <p>{item.description || <em>No description</em>}</p>
                  {item.image_url && (
                    <div className="project-image-container">
                      <img
                        src={item.image_url}
                        alt={item.title}
                        className="project-image"
                      />
                    </div>
                  )}
                  {isOwner && (
                    <div className="project-actions">
                      <button
                        className="edit-btn"
                        onClick={() => openModal('editProject', item)}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        className="delete-btn"
                        onClick={() => handleDeleteProject(item.id, item.image_url)}
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
              id="add-project-btn"
              className="btn primary"
              style={{ marginTop: '1.5rem', display: 'block', marginLeft: 'auto', marginRight: 'auto' }}
              onClick={() => openModal('addProject')}
            >
              + Add Project
            </button>
          )}
        </>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="portfolio-modal">
          <div className="portfolio-modal-content">
            <span className="close" onClick={closeModal}>
              &times;
            </span>
            <h2>
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
                  <div className="form-group">
                    <label htmlFor="pf-title">Project Title</label>
                    <input
                      type="text"
                      id="pf-title"
                      value={modalData.title || ''}
                      onChange={e => setModalData(prev => ({ ...prev, title: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="pf-description">Description</label>
                    <textarea
                      id="pf-description"
                      value={modalData.description || ''}
                      onChange={e => setModalData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Details about this project..."
                    />
                  </div>
                  <div className="form-group">
                    <label>Project Image (optional)</label>
                    <div className="image-upload-area">
                      {typeof modalData.image_url === 'string' && modalData.image_url && (
                        <img
                          src={modalData.image_url}
                          alt="Preview"
                          className="preview-image"
                        />
                      )}
                      <input
                        type="file"
                        id="pf-image_url"
                        accept="image/*"
                        onChange={e => handleFileChange(e, 'image_url')}
                        style={{ display: 'none' }}
                      />
                      <div
                        className="upload-placeholder"
                        onClick={() => document.getElementById('pf-image_url')?.click()}
                      >
                        <p>Drag & drop an image or click to browse</p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {(modalMode === 'addClient' || modalMode === 'editClient') && (
                <>
                  <div className="form-group">
                    <label htmlFor="pf-name">Client Name</label>
                    <input
                      type="text"
                      id="pf-name"
                      value={modalData.name || ''}
                      onChange={e => setModalData(prev => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Logo Image (optional)</label>
                    <div className="image-upload-area">
                      {typeof modalData.logo_url === 'string' && modalData.logo_url && (
                        <img
                          src={modalData.logo_url}
                          alt="Preview"
                          className="preview-image"
                        />
                      )}
                      <input
                        type="file"
                        id="pf-logo_url"
                        accept="image/*"
                        onChange={e => handleFileChange(e, 'logo_url')}
                        style={{ display: 'none' }}
                      />
                      <div
                        className="upload-placeholder"
                        onClick={() => document.getElementById('pf-logo_url')?.click()}
                      >
                        <p>Drag & drop an image or click to browse</p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div className="modal-actions">
                <button type="button" className="btn secondary" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn primary">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .portfolio-content {
          margin-top: 1.5rem;
        }
        .loading {
          text-align: center;
          color: #7f8c8d;
          margin: 2rem 0;
        }
        .error {
          color: #e74c3c;
          margin: 1rem 0;
        }

        .credibility-banner {
          background: #f8fafc;
          padding: 2rem;
          border-radius: 12px;
          margin-bottom: 2.5rem;
          text-align: center;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.03);
        }
        .credibility-banner h3 {
          margin: 0 0 1.5rem;
          color: #1e293b;
          font-weight: 600;
          font-size: 1.4rem;
          letter-spacing: -0.2px;
        }
        .org-logos {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 2rem;
          align-items: center;
        }
        .org-badge {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          transition: transform 0.2s ease;
        }
        .org-badge:hover {
          transform: translateY(-2px);
        }
        .org-badge span {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 64px;
          height: 64px;
          background: #e2e8f0;
          border-radius: 50%;
          font-weight: 700;
          color: #475569;
          font-size: 1.2rem;
          letter-spacing: -0.5px;
        }
        .org-badge small {
          font-size: 0.85rem;
          color: #64748b;
          max-width: 120px;
          text-align: center;
          font-weight: 500;
        }

        .project-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.8rem;
          margin-top: 1rem;
        }
        .project-card {
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 1.25rem;
          background: white;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.02);
          transition: all 0.2s ease;
          display: flex;
          flex-direction: column;
        }
        .project-card:hover {
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);
          transform: translateY(-2px);
        }
        .project-card h3 {
          margin: 0 0 0.75rem;
          font-size: 1.15rem;
          color: #1e293b;
          line-height: 1.3;
        }
        .project-card p {
          margin: 0 0 1rem;
          color: #64748b;
          font-size: 0.95rem;
          line-height: 1.6;
          flex-grow: 1;
        }
        .project-image-container {
          width: 100%;
          margin: 0.5rem 0;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid #f1f5f9;
          background: #f8fafc;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .project-image {
          width: 100%;
          height: auto;
          display: block;
          object-fit: contain;
          border-radius: 8px;
        }

        .project-actions {
          display: flex;
          gap: 0.75rem;
          margin-top: 1rem;
          flex-shrink: 0;
        }
        .project-actions button {
          flex: 1;
          padding: 0.5rem;
          font-size: 0.9rem;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          transition: opacity 0.2s;
        }
        .project-actions button:hover {
          opacity: 0.95;
        }
        .edit-btn {
          background: #3b82f6;
          color: white;
        }
        .delete-btn {
          background: #ef4444;
          color: white;
        }

        .trusted-clients-section {
          margin-bottom: 2.5rem;
          padding: 1.5rem;
          background: #fcfdff;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
        }
        .trusted-clients-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }
        .trusted-clients-header h3 {
          margin: 0;
          color: #1e293b;
          font-weight: 600;
          font-size: 1.3rem;
        }
        .trusted-clients-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 1.5rem;
        }
        .client-card {
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 1rem;
          background: white;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.02);
          transition: all 0.2s ease;
          position: relative;
        }
        .client-card:hover {
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);
          transform: translateY(-2px);
        }
        .client-logo {
          width: 100%;
          height: 80px;
          border-radius: 8px;
          margin: 0.5rem 0;
          object-fit: contain;
          background: #f8fafc;
          border: 1px solid #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          font-weight: bold;
          color: #475569;
        }
        .client-name {
          font-weight: 600;
          color: #1e293b;
          margin: 0.5rem 0 0;
          font-size: 0.95rem;
          text-align: center;
        }
        .client-actions {
          position: absolute;
          top: 0.5rem;
          right: 0.5rem;
          display: flex;
          gap: 0.25rem;
        }
        .client-actions button {
          padding: 0.25rem 0.5rem;
          font-size: 0.8rem;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 600;
          transition: opacity 0.2s;
        }
        .client-edit-btn {
          background: #3b82f6;
          color: white;
        }
        .client-delete-btn {
          background: #ef4444;
          color: white;
        }

        .empty-state {
          text-align: center;
          padding: 3rem 1rem;
          color: #7f8c8d;
          border: 2px dashed #e2e8f0;
          border-radius: 12px;
          background: #fafcff;
        }

        .portfolio-modal {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.6);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
        }
        .portfolio-modal-content {
          background: white;
          padding: 2rem;
          border-radius: 14px;
          max-width: 520px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        }
        .portfolio-modal h2 {
          margin-top: 0;
          color: #1e293b;
          font-size: 1.4rem;
        }
        .close {
          position: absolute;
          top: 1.25rem;
          right: 1.25rem;
          font-size: 1.5rem;
          cursor: pointer;
          color: #cbd5e1;
          transition: color 0.2s;
        }
        .close:hover {
          color: #94a3b8;
        }
        .form-group {
          margin-bottom: 1.5rem;
        }
        .form-group label {
          display: block;
          margin-bottom: 0.6rem;
          font-weight: 600;
          color: #1e293b;
          font-size: 0.95rem;
        }
        .form-group input,
        .form-group textarea {
          width: 100%;
          padding: 0.65rem;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 0.95rem;
          font-family: inherit;
          transition: border-color 0.2s;
        }
        .form-group input:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }
        .form-group textarea {
          resize: vertical;
          min-height: 100px;
        }

        .image-upload-area {
          border: 2px dashed #cbd5e1;
          border-radius: 10px;
          padding: 1.5rem;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
          min-height: 160px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
        }
        .image-upload-area:hover {
          border-color: #94a3b8;
          background: #f8fafc;
        }
        .preview-image {
          max-width: 100%;
          max-height: 200px;
          border-radius: 8px;
          margin-bottom: 1rem;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .upload-placeholder p {
          margin: 0;
          color: #94a3b8;
          font-size: 0.95rem;
        }

        .btn {
          padding: 0.6rem 1.2rem;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          font-size: 0.95rem;
          transition: all 0.2s;
        }
        .btn.primary {
          background: #3b82f6;
          color: white;
        }
        .btn.secondary {
          background: #f1f5f9;
          color: #1e293b;
        }
        .modal-actions {
          display: flex;
          gap: 0.75rem;
          justify-content: flex-end;
          margin-top: 1.5rem;
        }

        @media (max-width: 768px) {
          .org-logos {
            gap: 1.2rem;
          }
          .org-badge span {
            width: 56px;
            height: 56px;
            font-size: 1.1rem;
          }
          .project-grid,
          .trusted-clients-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 480px) {
          .credibility-banner {
            padding: 1.25rem;
          }
          .project-card {
            padding: 1rem;
          }
          .project-actions button {
            padding: 0.4rem;
            font-size: 0.8rem;
          }
        }
      `}</style>
    </div>
  );
};

export default PortfolioPage;