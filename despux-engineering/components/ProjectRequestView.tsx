import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { supabase } from '../supabaseClient';
import { User } from '@supabase/supabase-js';
import { TranslationKeys } from '../types';
import { Canvas } from '@react-three/fiber';
import { useLoader } from '@react-three/fiber';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OrbitControls, Stage } from '@react-three/drei';
import { Suspense } from 'react';

const STLModel = ({ url }: { url: string }) => {
    const geom = useLoader(STLLoader, url);
    return (
        <mesh geometry={geom} rotation={[-Math.PI / 2, 0, 0]}>
            <meshStandardMaterial color="#0066cc" />
        </mesh>
    );
};


const ProjectRequestView: React.FC<ProjectRequestViewProps> = ({ t, user, onBack }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [keywords, setKeywords] = useState('');
    const [budget, setBudget] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    // File States
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [stlFile, setStlFile] = useState<File | null>(null);
    const [stlUrl, setStlUrl] = useState<string | null>(null);

    // Dropzone for PDF
    const onDropPdf = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles?.length) setPdfFile(acceptedFiles[0]);
    }, []);
    const { getRootProps: getPdfRoot, getInputProps: getPdfInput } = useDropzone({
        onDrop: onDropPdf,
        accept: { 'application/pdf': ['.pdf'] },
        maxFiles: 1
    });

    // Dropzone for STL
    const onDropStl = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles?.length) {
            const file = acceptedFiles[0];
            setStlFile(file);
            setStlUrl(URL.createObjectURL(file));
        }
    }, []);
    const { getRootProps: getStlRoot, getInputProps: getStlInput } = useDropzone({
        onDrop: onDropStl,
        accept: { 'model/stl': ['.stl'], 'application/octet-stream': ['.stl'] },
        maxFiles: 1
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setLoading(true);

        try {
            let pdfPath = null;
            let stlPath = null;

            // 1. Upload PDF
            if (pdfFile) {
                const fileName = `${user.id}/${Date.now()}_${pdfFile.name}`;
                const { error: uploadError, data } = await supabase.storage
                    .from('project-files')
                    .upload(fileName, pdfFile);
                if (uploadError) throw uploadError;
                pdfPath = data.path;
            }

            // 2. Upload STL
            if (stlFile) {
                const fileName = `${user.id}/${Date.now()}_${stlFile.name}`;
                const { error: uploadError, data } = await supabase.storage
                    .from('project-files')
                    .upload(fileName, stlFile);
                if (uploadError) throw uploadError;
                stlPath = data.path;
            }

            // 3. Insert Database Record
            const { error: dbError } = await supabase.from('projects').insert({
                user_id: user.id,
                client_name: user.user_metadata.full_name || user.email,
                title: name,
                description,
                keywords: keywords.split(',').map(k => k.trim()),
                budget,
                pdf_path: pdfPath,
                stl_path: stlPath,
                status: 'pending'
            });

            if (dbError) throw dbError;

            setSuccess(true);
        } catch (error: any) {
            console.error('Project Error:', error);
            alert('Error submitting project: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center p-8 animate-fade-in-up bg-bgBody transition-colors duration-300">
                <div className="bg-bgSurface p-8 rounded-lg shadow-2xl text-center border border-primary/30 max-w-lg">
                    <h2 className="text-3xl font-bold text-primary mb-4">Project Request Received!</h2>
                    <p className="text-textMuted mb-6">
                        We have received your project details. We will analyze your files and get back to you with a quote shortly.
                    </p>
                    <button
                        onClick={onBack}
                        className="bg-primary text-white font-bold py-3 px-8 rounded hover:opacity-90 transition-opacity"
                    >
                        Back to Home
                    </button>
                    <button
                        onClick={() => { setSuccess(false); setName(''); setStlFile(null); setPdfFile(null); }}
                        className="block w-full mt-4 text-sm text-textMuted hover:text-textMain"
                    >
                        Submit Another
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full flex flex-col no-scrollbar overflow-y-auto overflow-x-hidden p-6 md:p-12 bg-bgBody transition-colors duration-300">
            <div className="max-w-4xl mx-auto w-full animate-fade-in-up">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-textMain">Start New Project</h1>
                    <button onClick={onBack} className="text-textMuted hover:text-textMain transition-colors">
                        &larr; Back
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8">

                    {/* Left Column: Details */}
                    <div className="space-y-6">
                        <div className="bg-bgSurface p-6 rounded-lg border border-border shadow-sm">
                            <h3 className="text-xl font-bold text-textMain mb-4">Project Details</h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs uppercase text-textMuted mb-1">Project Title</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        className="w-full bg-bgBody border border-border p-3 rounded text-textMain focus:border-primary focus:outline-none transition-colors"
                                        required
                                        placeholder="e.g., Robotic Arm Prototype"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs uppercase text-textMuted mb-1">Keywords (comma separated)</label>
                                    <input
                                        type="text"
                                        value={keywords}
                                        onChange={e => setKeywords(e.target.value)}
                                        className="w-full bg-bgBody border border-border p-3 rounded text-textMain focus:border-primary focus:outline-none transition-colors"
                                        placeholder="3d printing, fast prototype, abs..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs uppercase text-textMuted mb-1">Estimated Budget (USD)</label>
                                    <input
                                        type="text"
                                        value={budget}
                                        onChange={e => setBudget(e.target.value)}
                                        className="w-full bg-bgBody border border-border p-3 rounded text-textMain focus:border-primary focus:outline-none transition-colors"
                                        placeholder="$500 - $1000"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs uppercase text-textMuted mb-1">Description</label>
                                    <textarea
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                        rows={5}
                                        className="w-full bg-bgBody border border-border p-3 rounded text-textMain focus:border-primary focus:outline-none resize-none transition-colors"
                                        required
                                        placeholder="Describe your project requirements, materials, and timeline..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* PDF Upload */}
                        <div className="bg-bgSurface p-6 rounded-lg border border-border shadow-sm">
                            <h3 className="text-xl font-bold text-textMain mb-4">Documentation</h3>
                            <div
                                {...getPdfRoot()}
                                className={`border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer transition-colors ${pdfFile ? 'bg-primary/10 border-primary' : 'hover:bg-bgBody hover:border-textMuted'}`}
                            >
                                <input {...getPdfInput()} />
                                {pdfFile ? (
                                    <div className="text-primary font-bold">{pdfFile.name}</div>
                                ) : (
                                    <p className="text-textMuted text-sm">Drag & drop your PDF specs here, or click to select</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: 3D Model */}
                    <div className="space-y-6">
                        <div className="bg-bgSurface p-6 rounded-lg border border-border h-full flex flex-col shadow-sm">
                            <h3 className="text-xl font-bold text-textMain mb-4">3D Model (STL)</h3>

                            <div className="flex-1 min-h-[300px] bg-bgBody rounded-lg overflow-hidden relative border border-border flex items-center justify-center">
                                {stlFile && stlUrl ? (
                                    <Canvas shadows camera={{ position: [0, 0, 150], fov: 50 }}>
                                        <Suspense fallback={null}>
                                            <Stage environment="city" intensity={0.6}>
                                                <STLModel url={stlUrl} />
                                            </Stage>
                                            <OrbitControls autoRotate />
                                        </Suspense>
                                    </Canvas>
                                ) : (
                                    <div className="text-textMuted text-sm text-center p-4">
                                        {stlFile ? `Selected: ${stlFile.name}` : "No model loaded"}
                                    </div>
                                )}
                            </div>

                            <div
                                {...getStlRoot()}
                                className="mt-4 border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:bg-bgBody hover:border-textMuted transition-colors"
                            >
                                <input {...getStlInput()} />
                                <p className="text-textMuted text-xs">
                                    {stlFile ? `Selected: ${stlFile.name}` : "Upload .STL file for preview"}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Submit Bar */}
                    <div className="md:col-span-2 flex justify-end pt-4 border-t border-border">
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-primary text-white font-bold py-4 px-12 rounded hover:opacity-90 hover:scale-105 transition-all shadow-lg disabled:opacity-50 disabled:scale-100"
                        >
                            {loading ? 'Submitting Project...' : 'SUBMIT PROJECT REQUEST'}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
};

export default ProjectRequestView;
