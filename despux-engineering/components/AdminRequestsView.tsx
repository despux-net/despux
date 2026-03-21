import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { TranslationKeys } from '../types';
import ProjectDetailModal from './ProjectDetailModal';

interface AdminRequestsViewProps {
    t: TranslationKeys;
    onBack: () => void;
}

const AdminRequestsView: React.FC<AdminRequestsViewProps> = ({ t, onBack }) => {
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [selectedProject, setSelectedProject] = useState<any | null>(null);

    useEffect(() => {
        fetchAllRequests();
    }, []);

    const fetchAllRequests = async () => {
        setLoading(true);
        setErrorMsg(null);
        try {
            console.log("AdminView: Fetching projects...");
            // Fetch projects first
            const { data: projectsData, error: projectsError } = await supabase
                .from('projects')
                .select('*')
                .order('created_at', { ascending: false });

            if (projectsError) {
                throw new Error("Projects Error: " + projectsError.message);
            }

            console.log("AdminView: Projects fetched:", projectsData?.length);
            console.log("AdminView: Sample project:", projectsData?.[0]);

            if (!projectsData || projectsData.length === 0) {
                setRequests([]);
                setLoading(false);
                return;
            }

            // Get unique non-null user IDs
            const userIds = [...new Set(projectsData
                .map(p => p.user_id)
                .filter(id => id !== null && id !== undefined)
            )];

            console.log("AdminView: User IDs to fetch:", userIds);

            let profilesData: any[] = [];

            if (userIds.length > 0) {
                const { data, error: profilesError } = await supabase
                    .from('profiles')
                    .select('id, email, full_name')
                    .in('id', userIds);

                if (profilesError) {
                    console.error("Error fetching profiles:", profilesError);
                } else {
                    profilesData = data || [];
                    console.log("AdminView: Profiles fetched:", profilesData);
                }
            }

            // Map profiles to projects
            const mergedRequests = projectsData.map(p => {
                if (!p.user_id) {
                    return {
                        ...p,
                        profiles: {
                            email: 'Legacy User (No Account)',
                            full_name: 'Unknown User'
                        }
                    };
                }

                const profile = profilesData.find(prof => prof.id === p.user_id);
                return {
                    ...p,
                    profiles: profile || {
                        email: `User ID: ${p.user_id}`,
                        full_name: 'No Profile'
                    }
                };
            });

            console.log("AdminView: Merged requests sample:", mergedRequests[0]);
            setRequests(mergedRequests);
        } catch (error: any) {
            console.error("Error fetching requests:", error);
            setErrorMsg(error.message || "Unknown error occurred");
        } finally {
            setLoading(false);
        }
    };

    const updateStatus = async (id: number, newStatus: 'approved' | 'rejected') => {
        try {
            const { error } = await supabase
                .from('projects')
                .update({ status: newStatus })
                .eq('id', id);

            if (error) throw error;
            fetchAllRequests(); // Refresh
        } catch (error: any) {
            alert("Error updating status: " + error.message);
        }
    };

    const handleDelete = async (e: React.MouseEvent, project: any) => {
        e.stopPropagation();

        if (!confirm(`¿Estás seguro de eliminar el proyecto "${project.title}"? Esta acción no se puede deshacer.`)) {
            return;
        }

        try {
            // 1. Delete files from storage if they exist
            const filesToDelete = [];
            if (project.pdf_path) filesToDelete.push(project.pdf_path);
            if (project.stl_path) filesToDelete.push(project.stl_path);

            if (filesToDelete.length > 0) {
                const { error: storageError } = await supabase.storage
                    .from('project-files')
                    .remove(filesToDelete);

                if (storageError) console.error('Error deleting files:', storageError);
            }

            // 2. Delete project from database
            const { error: dbError } = await supabase
                .from('projects')
                .delete()
                .eq('id', project.id);

            if (dbError) throw dbError;

            // 3. Refresh list
            fetchAllRequests();
        } catch (error: any) {
            alert("Error deleting project: " + error.message);
        }
    };

    const filteredRequests = requests.filter(r => {
        if (filter === 'all') return true;
        return (r.status || 'pending') === filter;
    });

    return (
        <div className="w-full h-full p-6 md:p-12 overflow-y-auto bg-white/80 backdrop-blur-sm animate-fade-in">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-3xl font-bold text-textMain uppercase tracking-widest">
                        <span className="text-primary">Admin</span> Requests Dashboard
                    </h2>
                    <button onClick={onBack} className="text-textMuted hover:text-textMain underline">
                        Back to Home
                    </button>
                </div>

                {/* Filters */}
                <div className="flex gap-4 mb-6">
                    {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-full text-sm font-bold uppercase tracking-wider transition-colors ${filter === f
                                ? 'bg-primary text-white shadow-lg'
                                : 'bg-white border border-border text-textMuted hover:bg-gray-50'
                                }`}
                        >
                            {f}
                        </button>
                    ))}
                </div>

                {errorMsg && (
                    <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg flex items-center gap-2">
                        <span>⚠️</span>
                        <div>
                            <p className="font-bold">Error Loading Data</p>
                            <p className="text-sm">{errorMsg}</p>
                        </div>
                    </div>
                )}

                {/* Table */}
                <div className="bg-white rounded-xl shadow-xl border border-border overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 border-b border-border text-textMuted uppercase text-xs font-bold tracking-wider">
                                <tr>
                                    <th className="p-4">Date</th>
                                    <th className="p-4">User</th>
                                    <th className="p-4">Project</th>
                                    <th className="p-4">Budget</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading ? (
                                    <tr><td colSpan={6} className="p-8 text-center text-textMuted">Loading requests...</td></tr>
                                ) : filteredRequests.length === 0 ? (
                                    <tr><td colSpan={6} className="p-8 text-center text-textMuted">No requests found.</td></tr>
                                ) : (
                                    filteredRequests.map(req => (
                                        <tr key={req.id} className="hover:bg-blue-50/50 transition-colors">
                                            <td className="p-4 whitespace-nowrap text-textMuted font-mono">
                                                {new Date(req.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="p-4">
                                                <div className="font-bold text-textMain">{req.profiles?.full_name || 'Unknown'}</div>
                                                <div className="text-xs text-textMuted">{req.profiles?.email}</div>
                                            </td>
                                            <td className="p-4 max-w-xs">
                                                <div
                                                    className="font-bold text-primary truncate cursor-pointer hover:underline"
                                                    title={req.title}
                                                    onClick={() => setSelectedProject(req)}
                                                >
                                                    {req.title}
                                                </div>
                                                <div className="text-xs text-textMuted truncate" title={req.description}>{req.description}</div>
                                            </td>
                                            <td className="p-4 font-mono">
                                                {req.budget ? `$${req.budget}` : '-'}
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded-full text-[10px] uppercase font-bold border ${req.status === 'approved' ? 'bg-green-100 text-green-600 border-green-200' :
                                                    req.status === 'rejected' ? 'bg-red-100 text-red-600 border-red-200' :
                                                        'bg-yellow-100 text-yellow-600 border-yellow-200'
                                                    }`}>
                                                    {req.status || 'pending'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right space-x-2">
                                                <button
                                                    onClick={() => updateStatus(req.id, 'approved')}
                                                    className="px-3 py-1 bg-green-500 text-white text-xs font-bold rounded hover:opacity-90 disabled:opacity-50"
                                                    disabled={req.status === 'approved'}
                                                >
                                                    ✓ Approve
                                                </button>
                                                <button
                                                    onClick={() => updateStatus(req.id, 'rejected')}
                                                    className="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded hover:opacity-90 disabled:opacity-50"
                                                    disabled={req.status === 'rejected'}
                                                >
                                                    ✗ Reject
                                                </button>
                                                <button
                                                    onClick={(e) => handleDelete(e, req)}
                                                    className="px-3 py-1 bg-gray-700 text-white text-xs font-bold rounded hover:opacity-90 transition-opacity"
                                                    title="Delete Project"
                                                >
                                                    🗑️ Delete
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Project Detail Modal */}
                {selectedProject && (
                    <ProjectDetailModal
                        project={selectedProject}
                        onClose={() => setSelectedProject(null)}
                    />
                )}
            </div>
        </div>
    );
};

export default AdminRequestsView;
