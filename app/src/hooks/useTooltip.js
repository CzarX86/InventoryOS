"use client";
import { useState, useEffect } from 'react';

export function useTooltip() {
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [visible, setVisible] = useState(false);
  const [text, setText] = useState('');

  useEffect(() => {
    const handleMouseMove = (e) => {
      // Slightly to the right and below the mouse pointer (e.g., 15px offset)
      setCoords({ x: e.clientX + 15, y: e.clientY + 15 });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const show = (tooltipText) => {
    setText(tooltipText);
    setVisible(true);
  };

  const hide = () => setVisible(false);

  return { coords, visible, text, show, hide };
}
