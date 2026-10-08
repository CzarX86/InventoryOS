"use client";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { BrandLockup } from "@/components/BrandLogo";

export default function SplashScreen({ onComplete }) {
  const [isVisible, setIsVisible] = useState(true);
  const shouldReduceMotion = useReducedMotion();

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
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={shouldReduceMotion ? undefined : { opacity: 0 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.3, ease: "easeOut" }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background p-6"
          role="status"
          aria-label="Carregando InventoryOS"
        >
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.35, ease: "easeOut" }}
            className="flex w-[82vw] max-w-[32rem] flex-col items-center"
          >
            <BrandLockup className="h-auto w-full" priority />
            <p className="mt-4 text-sm font-medium text-muted-foreground">InventoryOS</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
