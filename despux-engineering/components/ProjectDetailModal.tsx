import React from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';

interface ProjectDetailModalProps {
    project: any;
    onClose: () => void;
}

const ProjectDetailModal: React.FC<ProjectDetailModalProps> = ({ project, onClose }) => {
    if (!project) return null;

    const handleDownload = async (filePath: string, fileName: string) => {
        try {
            const { data, error } = await supabase.storage
                .from('project-files')
                .download(filePath);

            if (error) throw error;

            // Create download link
            const url = URL.createObjectURL(data);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error: any) {
            console.error('Download error:', error);
            alert('Error downloading file: ' + error.message);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-bgSurface border border-border rounded-lg p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto relative shadow-2xl transition-colors duration-300">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-textMuted hover:text-textMain transition-colors text-xl"
                >
                    &times;
                </button>

                <div className="mb-6 border-b border-border pb-4">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2 
                        ${project.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' :
                            project.status === 'approved' ? 'bg-green-500/10 text-green-500 border border-green-500/20' :
                                'bg-bgBody text-textMuted border border-border'}`}>
                        {project.status}
                    </span>
                    <h2 className="text-3xl font-bold text-textMain leading-tight">{project.title || 'Untitled Project'}</h2>
                    <p className="text-textMuted text-sm mt-1">Requested on {new Date(project.created_at).toLocaleDateString()}</p>
                </div>

                <div className="space-y-6">
                    <div>
                        <h3 className="text-xs uppercase text-textMuted font-bold mb-2">Description</h3>
                        <div className="bg-bgBody p-4 rounded text-textMain text-sm leading-relaxed whitespace-pre-wrap border border-border">
                            {project.description}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <h3 className="text-xs uppercase text-textMuted font-bold mb-2">Budget</h3>
                            <p className="text-textMain font-mono">{project.budget || 'Not specified'}</p>
                        </div>
                        <div>
                            <h3 className="text-xs uppercase text-textMuted font-bold mb-2">Keywords</h3>
                            <div className="flex flex-wrap gap-2">
                                {project.keywords && project.keywords.map((k: string, i: number) => (
                                    <span key={i} className="bg-bgBody border border-border px-2 py-1 rounded text-xs text-textMuted">
                                        {k}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-xs uppercase text-textMuted font-bold mb-2">Attached Files</h3>
                        <div className="flex flex-col gap-2">
                            {project.pdf_path ? (
                                <div className="flex items-center gap-3 p-3 bg-bgBody rounded border border-border">
                                    <span className="text-red-400">📄</span>
                                    <span className="text-sm text-textMain truncate flex-1">PDF Specification</span>
                                    <button
                                        onClick={() => handleDownload(project.pdf_path, `${project.title || 'project'}_spec.pdf`)}
                                        className="text-xs bg-primary text-white px-3 py-1 rounded hover:opacity-80 transition-opacity font-bold"
                                    >
                                        ⬇ Download
                                    </button>
                                </div>
                            ) : (
                                <p className="text-sm text-textMuted italic">No PDF uploaded</p>
                            )}

                            {project.stl_path ? (
                                <div className="flex items-center gap-3 p-3 bg-bgBody rounded border border-border">
                                    <span className="text-blue-400">🧊</span>
                                    <span className="text-sm text-textMain truncate flex-1">3D Model (STL)</span>
                                    <button
                                        onClick={() => handleDownload(project.stl_path, `${project.title || 'project'}_model.stl`)}
                                        className="text-xs bg-primary text-white px-3 py-1 rounded hover:opacity-80 transition-opacity font-bold"
                                    >
                                        ⬇ Download
                                    </button>
                                </div>
                            ) : (
                                <p className="text-sm text-textMuted italic">No 3D Model uploaded</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-border flex justify-end">
                    <button
                        onClick={onClose}
                        className="bg-textMain text-bgSurface font-bold py-2 px-6 rounded hover:opacity-80 transition-opacity"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ProjectDetailModal;
