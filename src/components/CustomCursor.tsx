
import { useEffect, useState } from 'react';
import { motion, useSpring } from 'framer-motion';

export const CustomCursor = () => {
  const [isDesktop, setIsDesktop] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  const cursorX = useSpring(0, { damping: 20, stiffness: 250 });
  const cursorY = useSpring(0, { damping: 20, stiffness: 250 });
  
  const ringX = useSpring(0, { damping: 30, stiffness: 150 });
  const ringY = useSpring(0, { damping: 30, stiffness: 150 });

  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth > 1024);
    };
    
    checkDesktop();
    window.addEventListener('resize', checkDesktop);

    const moveCursor = (e: MouseEvent) => {
      cursorX.set(e.clientX);
      cursorY.set(e.clientY);
      ringX.set(e.clientX);
      ringY.set(e.clientY);
    };

    const handleHover = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isClickable = 
        target.tagName === 'BUTTON' || 
        target.tagName === 'A' || 
        target.closest('button') || 
        target.closest('a') ||
        target.classList.contains('cursor-pointer');
      
      setIsHovering(!!isClickable);
    };

    window.addEventListener('mousemove', moveCursor);
    window.addEventListener('mouseover', handleHover);

    return () => {
      window.removeEventListener('resize', checkDesktop);
      window.removeEventListener('mousemove', moveCursor);
      window.removeEventListener('mouseover', handleHover);
    };
  }, [cursorX, cursorY, ringX, ringY]);

  if (!isDesktop) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999]">
      {/* Main Dot */}
      <motion.div
        className="fixed w-2 h-2 bg-[#6366F1] rounded-full"
        style={{
          x: cursorX,
          y: cursorY,
          translateX: '-50%',
          translateY: '-50%',
        }}
      />
      {/* Outer Ring */}
      <motion.div
        className="fixed w-8 h-8 border border-[#6366F1]/50 rounded-full"
        animate={{
          scale: isHovering ? 1.5 : 1,
          backgroundColor: isHovering ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
        }}
        style={{
          x: ringX,
          y: ringY,
          translateX: '-50%',
          translateY: '-50%',
        }}
      />
    </div>
  );
};
