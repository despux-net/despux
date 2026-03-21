import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { TranslationKeys } from '../types';
import { supabase } from '../supabaseClient';
import Modal from './Modal';

interface WorksViewProps {
    t: TranslationKeys;
    isVisible: boolean;
    isAdmin?: boolean;
}

interface Project {
    id: number;
    title: string;
    description: string;
    image_url: string; // Keep for backward compatibility/read
    images: string[];  // New array
    tags: string[];
}

const WorksView: React.FC<WorksViewProps> = ({ t, isVisible, isAdmin }) => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // CRUD States
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [formData, setFormData] = useState({ title: '', description: '', images: [] as string[], tags: '' });
    const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
    const [uploading, setUploading] = useState(false);

    // Carousel State: maps project ID to current image index
    const [carouselIndices, setCarouselIndices] = useState<{ [key: number]: number }>({});

    useEffect(() => {
        fetchProjects();
        // Start Carousel Interval
        const interval = setInterval(() => {
            setCarouselIndices(prev => {
                const next = { ...prev };
                projects.forEach(p => {
                    const imgs = p.images?.length > 0 ? p.images : (p.image_url ? [p.image_url] : []);
                    if (imgs.length > 1) {
                        const currentIndex = prev[p.id] || 0;
                        next[p.id] = (currentIndex + 1) % imgs.length;
                    }
                });
                return next;
            });
        }, 5000);

        return () => clearInterval(interval);
    }, [projects.length]); // Re-create interval when project list changes

    const fetchProjects = async () => {
        try {
            const { data, error } = await supabase
                .from('projects')
                .select('*')
                .is('user_id', null) // Only show public portfolio projects (no user owner)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Normalize data: ensure images array exists and tags is an array
            const normalizedData = (data || []).map((p: any) => ({
                ...p,
                images: p.images || (p.image_url ? [p.image_url] : []),
                tags: Array.isArray(p.tags) ? p.tags : (p.tags ? [p.tags] : [])
            }));

            setProjects(normalizedData);
        } catch (error) {
            console.error('Error fetching projects:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleEdit = (project: Project) => {
        setEditingProject(project);
        setFormData({
            title: project.title,
            description: project.description,
            images: project.images && project.images.length > 0 ? project.images : (project.image_url ? [project.image_url] : []),
            tags: project.tags.join(', ')
        });
        setSelectedFiles(null);
        setIsEditModalOpen(true);
    };

    const handleCreate = () => {
        setEditingProject(null);
        setFormData({ title: '', description: '', images: [], tags: '' });
        setSelectedFiles(null);
        setIsEditModalOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this project?')) return;

        try {
            const { error } = await supabase.from('projects').delete().eq('id', id);
            if (error) throw error;
            fetchProjects();
        } catch (error: any) {
            console.error('Error deleting project:', error);
            alert('Error deleting project: ' + error.message);
        }
    };

    const uploadImage = async (file: File): Promise<string | null> => {
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('project-images')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage
                .from('project-images')
                .getPublicUrl(filePath);

            return data.publicUrl;
        } catch (error: any) {
            console.error('Error uploading image:', error);
            // Don't alert here to avoid spamming alerts for multiple files
            return null;
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setUploading(true);

        try {
            let currentImages = [...formData.images];

            // Upload new files
            if (selectedFiles && selectedFiles.length > 0) {
                const uploadPromises = Array.from(selectedFiles).map((file: File) => uploadImage(file));
                const results = await Promise.all(uploadPromises);
                const successfulUploads = results.filter((url): url is string => url !== null);

                if (successfulUploads.length > 0) {
                    currentImages = [...currentImages, ...successfulUploads];
                }
            }

            const tagsArray = formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag !== '');

            const projectData = {
                title: formData.title,
                description: formData.description,
                image_url: currentImages[0] || '', // Fallback for backward compat
                images: currentImages,
                tags: tagsArray
            };

            if (editingProject) {
                const { error } = await supabase
                    .from('projects')
                    .update(projectData)
                    .eq('id', editingProject.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('projects')
                    .insert([projectData]);
                if (error) throw error;
            }
            setIsEditModalOpen(false);
            fetchProjects();
        } catch (error: any) {
            console.error('Error saving project:', error);
            alert('Error saving project: ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    const renderProjectImage = (project: Project) => {
        const imgs = project.images && project.images.length > 0 ? project.images : (project.image_url ? [project.image_url] : []);
        const currentIndex = carouselIndices[project.id] || 0;
        const currentSrc = imgs[currentIndex] || '';

        return (
            <div className="w-full h-full relative">
                {/* Main Image with Transition */}
                {imgs.map((img, idx) => (
                    <img
                        key={`${project.id}-img-${idx}`}
                        src={img}
                        alt={`${project.title} - ${idx + 1}`}
                        className={`absolute inset-0 w-full h-full object-contain bg-[#1a1a1a] transition-opacity duration-1000 ease-in-out ${idx === currentIndex ? 'opacity-100' : 'opacity-0'}`}
                        onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            if (!target.src.includes('placeholder')) target.src = "https://placehold.co/800x600?text=No+Image";
                        }}
                    />
                ))}

                {/* Carousel Indicators */}
                {imgs.length > 1 && (
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-10">
                        {imgs.map((_, idx) => (
                            <div
                                key={idx}
                                className={`w-2 h-2 rounded-full transition-colors duration-300 ${idx === currentIndex ? 'bg-primary shadow-[0_0_8px_rgba(255,255,0,0.8)]' : 'bg-white/30'}`}
                            />
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="w-full h-full flex flex-col no-scrollbar overflow-y-auto overflow-x-hidden relative bg-bgBody transition-colors duration-300">
            <div className="max-w-7xl mx-auto px-10 py-16 w-full flex-1 flex flex-col gap-20 items-center justify-start">

                {isAdmin && (
                    <div className="w-full flex justify-end">
                        <button
                            onClick={handleCreate}
                            className="bg-primary text-white font-bold py-2 px-6 rounded hover:opacity-90 transition-opacity uppercase tracking-widest text-sm shadow-lg"
                        >
                            + Add New Project
                        </button>
                    </div>
                )}

                {isLoading ? (
                    <div className="text-textMuted text-xl animate-pulse">Loading Projects...</div>
                ) : (
                    projects.map((project, index) => (
                        <article
                            key={project.id}
                            className={`bg-bgSurface border border-border rounded-lg overflow-hidden grid grid-cols-1 md:grid-cols-[1.2fr_0.8fr] shadow-xl backdrop-blur-sm max-w-5xl w-full transform transition-all duration-700 ease-out ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
                            style={{ transitionDelay: `${index * 200}ms` }}
                        >
                            <div className="w-full h-[400px] bg-bgBody relative overflow-hidden group border-r border-border">
                                {renderProjectImage(project)}

                                {isAdmin && (
                                    <div className="absolute top-4 right-4 flex gap-2 z-20">
                                        <button
                                            onClick={() => handleEdit(project)}
                                            className="bg-blue-600 p-2 rounded text-white hover:bg-blue-500 shadow-lg transition-transform hover:scale-110"
                                            title="Edit Project"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            onClick={() => handleDelete(project.id)}
                                            className="bg-red-600 p-2 rounded text-white hover:bg-red-500 shadow-lg transition-transform hover:scale-110"
                                            title="Delete Project"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="p-10 flex flex-col justify-center bg-bgSurface">
                                <span className="text-primary text-xs font-bold tracking-widest uppercase mb-2">PROJECT</span>
                                <h2 className="text-3xl font-bold mb-5 leading-tight text-textMain">{project.title}</h2>
                                <p className="text-textMuted mb-8 text-base">
                                    {project.description}
                                </p>
                                <div className="flex flex-wrap gap-2 mb-8">
                                    {project.tags.map((tag) => (
                                        <span key={tag} className="bg-bgBody border border-border px-3 py-1 rounded-full text-xs text-textMuted">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                                <a href="#" className="self-start text-textMain border border-primary px-6 py-2 rounded transition-all hover:bg-primary hover:text-white hover:shadow-primary-glow">
                                    {t.work_btn}
                                </a>
                            </div>
                        </article>
                    ))
                )}
            </div>

            <footer className="py-8 px-10 text-center text-sm text-textMuted border-t border-border bg-bgSurface">
                <div dangerouslySetInnerHTML={{ __html: t.footer_rights }}></div>
            </footer>

            {/* Edit/Create Modal */}
            {isEditModalOpen && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-bgSurface border border-border rounded-lg p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                        <h2 className="text-2xl font-bold text-textMain mb-6">
                            {editingProject ? 'Edit Project' : 'Create New Project'}
                        </h2>
                        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                            <div>
                                <label className="text-xs uppercase text-textMuted block mb-1">Title</label>
                                <input
                                    className="w-full bg-bgBody border border-border p-2 rounded text-textMain focus:border-primary focus:outline-none transition-colors"
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-xs uppercase text-textMuted block mb-1">Description</label>
                                <textarea
                                    className="w-full bg-bgBody border border-border p-2 rounded text-textMain h-24 focus:border-primary focus:outline-none transition-colors"
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    required
                                />
                            </div>

                            {/* Image Upload Section */}
                            <div>
                                <label className="text-xs uppercase text-textMuted block mb-1">Project Images (Select Multiple)</label>
                                <div className="flex flex-col gap-2">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        multiple // Enable multiple files
                                        onChange={(e) => setSelectedFiles(e.target.files)}
                                        className="text-textMuted text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-blue-600 transition-colors cursor-pointer"
                                    />

                                    {/* Show existing images list with remove option could be a nice add-on, keeping it simple for now */}
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {formData.images.map((img, i) => (
                                            <div key={i} className="relative w-16 h-16 border border-border">
                                                <img src={img} className="w-full h-full object-cover" />
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData(prev => ({ ...prev, images: prev.images.filter((_, idx) => idx !== i) }))}
                                                    className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow-sm"
                                                >
                                                    x
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs uppercase text-textMuted block mb-1">Tags (comma separated)</label>
                                <input
                                    className="w-full bg-bgBody border border-border p-2 rounded text-textMain focus:border-primary focus:outline-none transition-colors"
                                    value={formData.tags}
                                    onChange={e => setFormData({ ...formData, tags: e.target.value })}
                                />
                            </div>
                            <div className="flex justify-end gap-3 mt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsEditModalOpen(false)}
                                    className="px-4 py-2 text-textMuted hover:text-textMain"
                                    disabled={uploading}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={uploading}
                                    className="px-6 py-2 bg-primary text-white font-bold rounded hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {uploading ? 'Uploading...' : 'Save Project'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default WorksView;