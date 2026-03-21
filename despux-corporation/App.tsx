import React from 'react';
import { motion } from 'framer-motion';
import AmbientBackground from './components/AmbientBackground';
import ElegantButton from './components/ElegantButton';

const App: React.FC = () => {
  
  const handleEngineeringClick = () => {
    window.location.href = "https://despux.net/ENGINEERING/";
  };

  const handleProvidenciaClick = () => {
    window.location.href = "https://despux.net/PROVIDENCIA";
  };

  const logoUrl = "https://raw.githubusercontent.com/despux-net/despux/main/logo4.png";

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden bg-white selection:bg-gray-200">
      
      {/* Background Canvas Animation */}
      <AmbientBackground />

      {/* Lighting/Vignette Effects (Ventanas opacas grisáceas superior e inferior) */}
      <div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-b from-gray-100/80 via-white/20 to-transparent pointer-events-none z-0" />
      <div className="absolute bottom-0 left-0 w-full h-40 bg-gradient-to-t from-gray-100/80 via-white/20 to-transparent pointer-events-none z-0" />

      {/* Main Content Container */}
      <main className="z-10 flex flex-col items-center justify-center px-4 md:px-0">
        
        {/* Logo Container with Shine Effect */}
        <motion.div 
          className="relative mb-8 cursor-pointer group"
          initial={{ opacity: 0, scale: 0.9, y: 10, filter: 'blur(5px)' }}
          animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          whileHover="hover"
        >
          {/* Main Image */}
          <motion.img 
            src={logoUrl}
            alt="Despux Logo"
            // Removed drop-shadow to avoid box outline on non-transparent image
            // Added mix-blend-multiply to blend white background with page
            className="w-40 md:w-64 relative z-10 mix-blend-multiply"
            variants={{
              hover: { scale: 1.05 }
            }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />

          {/* Shine/Reflection Layer */}
          <motion.div
            className="absolute inset-0 z-20 pointer-events-none"
            style={{
              background: "linear-gradient(105deg, transparent 40%, rgba(255, 255, 255, 0.8) 45%, rgba(255, 255, 255, 0.4) 50%, transparent 54%)",
              backgroundSize: "200% 100%",
              // Mask the shine to the shape of the logo
              maskImage: `url(${logoUrl})`,
              WebkitMaskImage: `url(${logoUrl})`,
              maskSize: "contain",
              WebkitMaskSize: "contain",
              maskRepeat: "no-repeat",
              WebkitMaskRepeat: "no-repeat",
              maskPosition: "center",
              WebkitMaskPosition: "center",
            }}
            variants={{
              hover: {
                backgroundPosition: ["150% 0", "-50% 0"],
                transition: {
                  duration: 1,
                  ease: "easeInOut",
                  repeat: Infinity,
                  repeatDelay: 1.5
                }
              },
              initial: {
                backgroundPosition: "150% 0"
              }
            }}
            initial="initial"
          />
        </motion.div>

        {/* Main Title: DESPUX */}
        <motion.h1 
          initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 1.2, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="text-6xl md:text-8xl font-bold tracking-tighter text-apple-text mb-2 text-center"
        >
          DESPUX
        </motion.h1>

        {/* Subtitle: CORPORATION */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center mb-16"
        >
          <span className="text-sm md:text-base font-light tracking-[0.3em] text-apple-subtext uppercase">
            Corporation
          </span>
          <div className="w-12 h-[1px] bg-gray-300 mt-6 rounded-full shadow-sm" />
        </motion.div>

        {/* Action Buttons */}
        <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-center justify-center w-full">
          <ElegantButton 
            label="Despux Engineering" 
            onClick={handleEngineeringClick} 
            delay={0.6}
          />
          <ElegantButton 
            label="Providencia" 
            onClick={handleProvidenciaClick} 
            delay={0.7}
          />
        </div>

      </main>

      {/* Footer/Legal text */}
      <motion.footer 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 1 }}
        className="absolute bottom-8 text-xs text-gray-400 font-light tracking-wide z-10"
      >
        © {new Date().getFullYear()} Despux Corporation. All rights reserved.
      </motion.footer>

    </div>
  );
};

export default App;