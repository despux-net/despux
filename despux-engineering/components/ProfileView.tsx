import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';
import { User } from '@supabase/supabase-js';
import QRCode from 'qrcode';
import ProjectDetailModal from './ProjectDetailModal';

interface ProfileViewProps {
    user: User | null;
    isVisible: boolean;
}

const ProfileView: React.FC<ProfileViewProps> = ({ user, isVisible }) => {
    const [loading, setLoading] = useState(true);
    const [fullName, setFullName] = useState('');
    const [bio, setBio] = useState('');
    const [website, setWebsite] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [message, setMessage] = useState('');

    // Project History State
    const [userProjects, setUserProjects] = useState<any[]>([]);
    const [projectsLoading, setProjectsLoading] = useState(false);
    const [selectedProject, setSelectedProject] = useState<any | null>(null);
    const [isEditRequestModalOpen, setIsEditRequestModalOpen] = useState(false);
    const [editingRequest, setEditingRequest] = useState<any | null>(null);
    const [editFormData, setEditFormData] = useState({ title: '', description: '', budget: '' });
    const [requestSaving, setRequestSaving] = useState(false);

    // MFA State
    const [showMfaSetup, setShowMfaSetup] = useState(false);
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [factorId, setFactorId] = useState('');
    const [verifyCode, setVerifyCode] = useState('');
    const [mfaFactors, setMfaFactors] = useState<any[]>([]);

    useEffect(() => {
        if (user) {
            getProfile();
            getUserProjects();
            checkMfaStatus();
        }
    }, [user]);

    const checkMfaStatus = async () => {
        try {
            const { data, error } = await supabase.auth.mfa.listFactors();
            if (error) throw error;
            setMfaFactors(data.all || []);
        } catch (error) {
            console.error('Error fetching MFA factors:', error);
        }
    };

    const isMfaVerified = mfaFactors.some(f => f.status === 'verified');

    const handleDeleteRequest = async (e: React.MouseEvent, project: any) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this request?')) return;

        try {
            setProjectsLoading(true);

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
            const { error } = await supabase.from('projects').delete().eq('id', project.id);
            if (error) throw error;

            // 3. Refresh project list
            getUserProjects();
        } catch (error: any) {
            console.error('Error deleting request:', error);
            alert('Error deleting request: ' + error.message);
        } finally {
            setProjectsLoading(false);
        }
    };

    const openEditRequestModal = (e: React.MouseEvent, project: any) => {
        e.stopPropagation();
        setEditingRequest(project);
        setEditFormData({
            title: project.title,
            description: project.description,
            budget: project.budget || ''
        });
        setIsEditRequestModalOpen(true);
    };

    const handleUpdateRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setRequestSaving(true);
            const { error } = await supabase
                .from('projects')
                .update({
                    title: editFormData.title,
                    description: editFormData.description,
                    budget: editFormData.budget
                })
                .eq('id', editingRequest.id);

            if (error) throw error;

            setIsEditRequestModalOpen(false);
            getUserProjects();
        } catch (error: any) {
            alert('Error updating request: ' + error.message);
        } finally {
            setRequestSaving(false);
        }
    };

    const getUserProjects = async () => {
        try {
            setProjectsLoading(true);
            const { data, error } = await supabase
                .from('projects')
                .select('*')
                .eq('user_id', user?.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setUserProjects(data || []);
        } catch (error) {
            console.error('Error fetching user projects:', error);
        } finally {
            setProjectsLoading(false);
        }
    };

    const startMfaSetup = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase.auth.mfa.enroll({
                factorType: 'totp',
            });

            if (error) throw error;

            setFactorId(data.id);

            // Generate QR Code
            const qr = await QRCode.toDataURL(data.totp.uri);
            setQrCodeUrl(qr);
            setShowMfaSetup(true);

        } catch (error: any) {
            setMessage('Error starting MFA setup: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const verifyMfa = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase.auth.mfa.challenge({
                factorId: factorId
            });

            if (error) throw error;

            const { data: verifyData, error: verifyError } = await supabase.auth.mfa.verify({
                factorId: factorId,
                challengeId: data.id,
                code: verifyCode
            });

            if (verifyError) throw verifyError;

            setMessage("Two-Factor Authentication Enabled Successfully!");
            setShowMfaSetup(false);
            setVerifyCode('');
            checkMfaStatus(); // Refresh status
        } catch (error: any) {
            setMessage('Error verifying MFA: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const getProfile = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('profiles')
                .select('full_name, bio, website, avatar_url, email')
                .eq('id', user?.id)
                .single();

            if (error && error.code !== 'PGRST116') {
                throw error;
            }

            if (data) {
                setFullName(data.full_name || '');
                setBio(data.bio || '');
                setWebsite(data.website || '');
                setAvatarUrl(data.avatar_url || '');
            }
        } catch (error: any) {
            console.error('Error loading profile:', error.message);
        } finally {
            setLoading(false);
        }
    };

    const updateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setLoading(true);
            setMessage('');

            const updates = {
                id: user?.id,
                full_name: fullName,
                bio,
                website,
                avatar_url: avatarUrl,
                email: user?.email, // Store email for admin dashboard access
                updated_at: new Date(),
            };

            const { error } = await supabase.from('profiles').upsert(updates);

            if (error) {
                throw error;
            }
            setMessage('Profile updated successfully!');

            // Also update user metadata for Home welcome message
            if (fullName) {
                await supabase.auth.updateUser({
                    data: { full_name: fullName }
                });
            }

        } catch (error: any) {
            setMessage('Error updating profile: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`w-full h-full p-6 md:p-12 ${isVisible ? 'block' : 'hidden'}`}>
            <div className="flex flex-col md:flex-row h-full w-full overflow-hidden bg-bgBody text-textMain transition-colors duration-300 rounded-xl shadow-2xl border border-border">
                {/* Left: User Profile Actions */}
                <div className="flex-none w-full md:w-1/3 min-w-[300px] border-b md:border-b-0 md:border-r border-border p-8 md:p-12 flex flex-col items-center justify-center bg-bgSurface/50 backdrop-blur-sm relative z-10 transition-colors duration-300">
                    <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-primary to-purple-600 p-[2px] mb-6 shadow-2xl">
                        <div className="w-full h-full rounded-full bg-bgSurface flex items-center justify-center overflow-hidden border-4 border-bgSurface">
                            {avatarUrl ? (
                                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-600">
                                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                                </span>
                            )}
                        </div>
                    </div>

                    <h2 className="text-2xl font-bold mb-2 text-primary tracking-wide text-center">
                        {fullName || user?.user_metadata?.full_name || 'Innovator'}
                    </h2>
                    <p className="text-textMuted text-sm mb-8 font-mono bg-bgBody px-3 py-1 rounded-full border border-border">
                        {user?.email}
                    </p>

                    <form onSubmit={updateProfile} className="w-full max-w-xs space-y-4 mb-8">
                        <div>
                            <label className="text-xs uppercase text-textMuted block mb-1">Full Name</label>
                            <input
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                className="w-full bg-bgBody border border-border p-2 rounded text-textMain focus:border-primary focus:outline-none transition-colors text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-xs uppercase text-textMuted block mb-1">Bio</label>
                            <textarea
                                value={bio}
                                onChange={(e) => setBio(e.target.value)}
                                rows={3}
                                className="w-full bg-bgBody border border-border p-2 rounded text-textMain focus:border-primary focus:outline-none transition-colors text-sm resize-none"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-2 bg-textMain text-bgSurface font-bold rounded hover:opacity-80 transition-opacity text-sm"
                        >
                            {loading ? 'Saving...' : 'Update Profile'}
                        </button>
                    </form>

                    <div className="w-full max-w-xs space-y-4">
                        {/* MFA Setup - conditional styling - ONLY FOR ADMIN */}
                        {user?.email === 'despux@gmail.com' && (
                            <div className={`p-4 rounded-lg border transition-all ${isMfaVerified
                                ? 'bg-green-500/10 border-green-500/30'
                                : 'bg-bgBody border-border hover:border-primary/50'
                                }`}>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">{isMfaVerified ? '🔒' : '🛡️'}</span>
                                        <h3 className="font-bold text-sm text-textMain">Security</h3>
                                    </div>
                                    {isMfaVerified && <span className="text-xs text-green-500 font-bold">VERIFIED</span>}
                                </div>

                                {!isMfaVerified ? (
                                    !showMfaSetup ? (
                                        <button
                                            onClick={startMfaSetup}
                                            className="w-full py-2 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold rounded transition-colors uppercase tracking-wider"
                                        >
                                            Enable 2FA
                                        </button>
                                    ) : (
                                        <div className="space-y-4 animate-fade-in">
                                            {qrCodeUrl && (
                                                <div className="flex justify-center bg-white p-2 rounded-lg">
                                                    <img src={qrCodeUrl} alt="2FA QR Code" className="w-32 h-32" />
                                                </div>
                                            )}
                                            <input
                                                type="text"
                                                placeholder="Enter 6-digit code"
                                                className="w-full bg-bgBody border border-border p-2 rounded text-textMain text-center tracking-[0.5em] font-mono focus:border-primary focus:outline-none transition-colors"
                                                maxLength={6}
                                                value={verifyCode}
                                                onChange={(e) => setVerifyCode(e.target.value)}
                                            />
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setShowMfaSetup(false)}
                                                    className="flex-1 py-2 text-xs text-textMuted hover:text-textMain"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={verifyMfa}
                                                    disabled={verifyCode.length !== 6}
                                                    className="flex-1 py-2 bg-primary text-white text-xs font-bold rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    Verify
                                                </button>
                                            </div>
                                        </div>
                                    )
                                ) : (
                                    <p className="text-xs text-textMuted text-center">
                                        Your account is secured with two-factor authentication.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Request History */}
                <div className="flex-1 bg-bgBody/80 p-8 md:p-12 overflow-y-auto w-full no-scrollbar relative z-0 transition-colors duration-300">
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-3 text-textMain uppercase tracking-widest border-b border-border pb-4">
                        <span className="text-primary">My Request History</span>
                        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">{userProjects.length}</span>
                    </h3>

                    {projectsLoading ? (
                        <div className="text-textMuted animate-pulse">Loading history...</div>
                    ) : userProjects.length === 0 ? (
                        <div className="text-center py-20 border-2 border-dashed border-border rounded-xl">
                            <p className="text-textMuted mb-4">No project requests found.</p>
                            <button
                                onClick={() => (window as any).dispatchEvent(new CustomEvent('navigate', { detail: 'project_request' }))}
                                className="text-primary hover:underline text-sm font-bold"
                            >
                                START NEW PROJECT
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {userProjects.map((project) => (
                                <div
                                    key={project.id}
                                    onClick={() => setSelectedProject(project)}
                                    className="group relative bg-bgSurface border border-border rounded-xl p-6 hover:border-primary/50 transition-all duration-300 cursor-pointer shadow-sm hover:shadow-lg hover:translate-x-1"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-bold text-lg text-textMain group-hover:text-primary transition-colors">
                                            {project.title}
                                        </h4>
                                        <span className="text-xs font-mono text-textMuted">
                                            {new Date(project.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <p className="text-sm text-textMuted line-clamp-2 mb-4">
                                        {project.description}
                                    </p>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            {project.budget && (
                                                <span className="text-xs font-bold text-textMain bg-bgBody px-2 py-1 rounded">
                                                    ${project.budget}
                                                </span>
                                            )}
                                            <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full border ${project.status === 'approved' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                                                project.status === 'rejected' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                                    'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'}`}>
                                                {project.status || 'pending'}
                                            </span>

                                            {/* Action Buttons */}
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={(e) => openEditRequestModal(e, project)}
                                                    className="p-1.5 hover:bg-bgBody rounded text-blue-400 hover:text-blue-300 transition-colors"
                                                    title="Edit Request"
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    onClick={(e) => handleDeleteRequest(e, project.id)}
                                                    className="p-1.5 hover:bg-bgBody rounded text-red-500 hover:text-red-400 transition-colors"
                                                    title="Delete Request"
                                                >
                                                    🗑️
                                                </button>
                                            </div>

                                            <span className="text-textMuted/20 group-hover:text-primary transition-colors">&rarr;</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Detail Modal */}
                {selectedProject && (
                    <ProjectDetailModal
                        project={selectedProject}
                        onClose={() => setSelectedProject(null)}
                    />
                )}

                {/* Edit Request Modal */}
                {isEditRequestModalOpen && createPortal(
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <div className="bg-bgSurface border border-border rounded-lg p-8 w-full max-w-lg animate-fade-in-up shadow-2xl transition-colors duration-300">
                            <h2 className="text-xl font-bold text-textMain mb-6">Edit Request</h2>
                            <form onSubmit={handleUpdateRequest} className="flex flex-col gap-4">
                                <div>
                                    <label className="text-xs uppercase text-textMuted block mb-1">Title</label>
                                    <input
                                        className="w-full bg-bgBody border border-border p-2 rounded text-textMain focus:border-primary focus:outline-none transition-colors"
                                        value={editFormData.title}
                                        onChange={e => setEditFormData({ ...editFormData, title: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-xs uppercase text-textMuted block mb-1">Budget</label>
                                    <input
                                        className="w-full bg-bgBody border border-border p-2 rounded text-textMain focus:border-primary focus:outline-none transition-colors"
                                        value={editFormData.budget}
                                        onChange={e => setEditFormData({ ...editFormData, budget: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs uppercase text-textMuted block mb-1">Description</label>
                                    <textarea
                                        className="w-full bg-bgBody border border-border p-2 rounded text-textMain h-24 focus:border-primary focus:outline-none transition-colors"
                                        value={editFormData.description}
                                        onChange={e => setEditFormData({ ...editFormData, description: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="flex justify-end gap-3 mt-4">
                                    <button
                                        type="button"
                                        onClick={() => setIsEditRequestModalOpen(false)}
                                        className="px-4 py-2 text-textMuted hover:text-textMain"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={requestSaving}
                                        className="px-6 py-2 bg-primary text-white font-bold rounded hover:opacity-90 transition-colors disabled:opacity-50"
                                    >
                                        {requestSaving ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>,
                    document.body
                )}
            </div>
        </div>
    );
};

export default ProfileView;
