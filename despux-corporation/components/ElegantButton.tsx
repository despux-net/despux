import React from 'react';
import { motion } from 'framer-motion';
import { ButtonProps } from '../types';

const ElegantButton: React.FC<ButtonProps> = ({ label, onClick, delay = 0 }) => {
  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.8, 
        delay: delay, 
        ease: [0.16, 1, 0.3, 1] // Custom ease curve for "Apple-like" smoothness
      }}
      whileHover={{ 
        scale: 1.02,
        backgroundColor: "rgba(0, 0, 0, 0.03)",
        borderColor: "rgba(0, 0, 0, 0.3)"
      }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="
        group
        relative
        px-8 
        py-3
        min-w-[200px]
        rounded-full 
        border 
        border-black/10 
        bg-white/80 
        backdrop-blur-md 
        text-apple-text 
        text-sm 
        font-medium 
        tracking-wide 
        uppercase 
        transition-colors 
        duration-300 
        shadow-sm
        hover:shadow-md
        outline-none
      "
    >
      <span className="relative z-10">{label}</span>
      <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-gray-50 to-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-0" />
    </motion.button>
  );
};

export default ElegantButton;