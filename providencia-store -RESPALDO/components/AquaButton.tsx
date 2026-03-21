import React from 'react';

interface AquaButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger';
    fullWidth?: boolean;
}

export const AquaButton: React.FC<AquaButtonProps> = ({ 
    children, 
    variant = 'primary', 
    fullWidth = false,
    className = '',
    ...props 
}) => {
    // Base styles attempting to recreate the Mac OS X Aqua feel
    const baseStyles = "aqua-button relative px-6 py-2 rounded-full font-bold text-sm shadow-aqua transition-all duration-200 active:shadow-aqua-pressed active:scale-[0.98] outline-none focus:ring-2 focus:ring-blue-300/50 flex items-center justify-center gap-2";
    
    let colorStyles = "";
    
    switch (variant) {
        case 'primary':
            // Slight blue tint usually found in default buttons
            colorStyles = "text-gray-700 border border-gray-300 hover:text-blue-600";
            break;
        case 'secondary':
            colorStyles = "text-gray-600 border border-gray-300 opacity-90";
            break;
        case 'danger':
            colorStyles = "text-red-600 border border-gray-300 hover:bg-red-50";
            break;
    }

    const widthClass = fullWidth ? "w-full" : "";

    return (
        <button 
            className={`${baseStyles} ${colorStyles} ${widthClass} ${className}`} 
            {...props}
        >
            <span className="relative z-10 flex items-center justify-center gap-2">{children}</span>
        </button>
    );
};
