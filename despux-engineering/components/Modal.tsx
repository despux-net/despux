import React from 'react';

interface ModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    onClose: () => void;
}

const Modal: React.FC<ModalProps> = ({ isOpen, title, message, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            ></div>

            {/* Modal Content */}
            <div className="relative bg-bgSurface border border-border rounded-lg p-6 max-w-sm w-full shadow-2xl transform transition-all animate-fade-in-up">
                <h3 className="text-xl font-bold text-textMain mb-2">{title}</h3>
                <p className="text-textMuted text-sm mb-6 leading-relaxed">
                    {message}
                </p>

                <div className="flex justify-end">
                    <button
                        onClick={onClose}
                        className="bg-primary text-white font-bold py-2 px-6 rounded hover:opacity-90 transition-opacity text-sm shadow-md"
                    >
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Modal;
