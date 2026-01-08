// src/components/charts/RechartsWrapper.jsx
import React, { useEffect, useRef } from 'react';

export const RechartsWrapper = ({ children, height = 400 }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Fonction ultra-agressive qui force les styles
    const forceStyles = () => {
      const container = containerRef.current;
      if (!container) return;

      // Récupère TOUS les éléments text dans les SVG
      const allTexts = container.querySelectorAll('text, tspan, .recharts-text, [class*="recharts"]');
      
      allTexts.forEach((el) => {
        // Supprime complètement les attributs style problématiques
        const currentStyle = el.getAttribute('style') || '';
        
        // Remplace inherit par des valeurs fixes
        const newStyle = currentStyle
          .replace(/font-size\s*:\s*inherit\s*;?/gi, 'font-size: 11px;')
          .replace(/letter-spacing\s*:\s*inherit\s*;?/gi, 'letter-spacing: 0;');
        
        if (newStyle !== currentStyle) {
          el.setAttribute('style', newStyle);
        }

        // Force aussi via propriété style directement
        if (el.style.fontSize === 'inherit') {
          el.style.fontSize = '11px';
        }
        if (el.style.letterSpacing === 'inherit') {
          el.style.letterSpacing = '0';
        }
      });
    };

    // Application multi-phases pour capturer TOUS les rendus
    const timers = [];
    timers.push(setTimeout(forceStyles, 0));
    timers.push(setTimeout(forceStyles, 10));
    timers.push(setTimeout(forceStyles, 50));
    timers.push(setTimeout(forceStyles, 100));
    timers.push(setTimeout(forceStyles, 200));
    timers.push(setTimeout(forceStyles, 500));

    // Observer pour modifications futures
    const observer = new MutationObserver(() => {
      forceStyles();
    });

    observer.observe(containerRef.current, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });

    return () => {
      timers.forEach(t => clearTimeout(t));
      observer.disconnect();
    };
  }, [children]);

  return (
    <div 
      ref={containerRef}
      style={{ 
        width: '100%', 
        height: `${height}px`,
        minHeight: `${height}px`,
        fontSize: '12px',
        letterSpacing: '0',
        position: 'relative'
      }}
    >
      {children}
    </div>
  );
};
