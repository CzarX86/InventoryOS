"use client";
import { useTooltip } from "@/hooks/useTooltip";

export default function MagneticTooltip({ text, children }) {
  const { coords, visible, show, hide } = useTooltip();

  return (
    <div 
      className="tooltip-container relative inline-block"
      onMouseEnter={() => show(text)}
      onMouseLeave={hide}
    >
      {children}
      {visible && (
        <div 
          className="magnetic-tooltip opacity-100" 
          style={{ 
            left: coords.x, 
            top: coords.y,
            position: 'fixed'
          }}
        >
          {text}
        </div>
      )}
    </div>
  );
}
