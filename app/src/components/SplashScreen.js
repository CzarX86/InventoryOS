"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

export default function SplashScreen({ onComplete }) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onComplete, 500); // Give time for exit animation
    }, 2500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] bg-[#080808] flex flex-col items-center justify-center p-6"
        >
          <div className="relative group">
            {/* Pulsing Aura */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ 
                scale: [0.8, 1.2, 0.8],
                opacity: [0, 0.3, 0]
              }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="absolute inset-0 bg-blue-500/20 blur-[60px] rounded-none"
            />

            {/* Logo Image */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ 
                type: "spring",
                stiffness: 100,
                damping: 20,
                delay: 0.2
              }}
              className="relative w-40 h-40 md:w-48 md:h-48 rounded-none overflow-hidden border border-white/[0.1] shadow-2xl"
            >
              <img 
                src="/icons/icon-144x144.png" 
                alt="InventoryOS Logo" 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            </motion.div>
          </div>

          {/* Text reveal */}
          <div className="mt-8 text-center overflow-hidden">
            <motion.h1 
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="text-4xl md:text-5xl font-black uppercase tracking-[0.2em] text-white"
            >
              Inventory<span className="text-blue-500">OS</span>
            </motion.h1>
            
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ delay: 1, duration: 1, ease: "easeInOut" }}
              className="h-[1px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent mt-4 mb-2 max-w-[200px] mx-auto"
            />
            
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2, duration: 1 }}
              className="text-xs font-black uppercase tracking-[0.4em] text-zinc-500"
            >
              Intelligent Assets
            </motion.p>
          </div>

          {/* Subtle detail text */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.8 }}
            className="absolute bottom-12 flex items-center gap-3"
          >
            <div className="w-1.5 h-1.5 rounded-none bg-blue-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">
              System Ready {process.env.NEXT_PUBLIC_APP_VERSION && `v${process.env.NEXT_PUBLIC_APP_VERSION}`}
            </span>
          </motion.div>
          
          {/* Scanline Effect */}
          <div className="absolute inset-0 pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03]" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
