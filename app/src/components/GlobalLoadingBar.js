"use client";
import { motion, AnimatePresence } from "framer-motion";

export default function GlobalLoadingBar({ isLoading }) {
  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="fixed top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-emerald-500 via-primary to-emerald-500 z-[9999] origin-left shadow-[0_0_10px_rgba(16,185,129,0.5)]"
        >
          <motion.div 
            animate={{ 
              x: ["-100%", "100%"] 
            }}
            transition={{ 
              duration: 1.5, 
              repeat: Infinity, 
              ease: "linear" 
            }}
            className="absolute inset-0 bg-white/30"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
