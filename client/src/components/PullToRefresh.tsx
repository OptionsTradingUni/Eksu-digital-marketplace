import { useState, useEffect, useRef, ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { hapticFeedback } from '@/lib/haptics';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  className?: string;
}

export function PullToRefresh({ onRefresh, children, className = '' }: PullToRefreshProps) {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const isAtTop = useRef(true);

  const TRIGGER_THRESHOLD = 80;
  const MAX_PULL = 120;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY <= 0) {
        isAtTop.current = true;
        startY.current = e.touches[0].clientY;
      } else {
        isAtTop.current = false;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isAtTop.current || isRefreshing) return;
      
      const currentY = e.touches[0].clientY;
      const diff = currentY - startY.current;
      
      if (diff > 0) {
        setIsPulling(true);
        const distance = Math.min(diff * 0.5, MAX_PULL);
        setPullDistance(distance);
        
        if (distance >= TRIGGER_THRESHOLD && !isPulling) {
          hapticFeedback('light');
        }
      }
    };

    const handleTouchEnd = async () => {
      if (!isPulling) return;
      
      if (pullDistance >= TRIGGER_THRESHOLD && !isRefreshing) {
        setIsRefreshing(true);
        hapticFeedback('medium');
        
        try {
          await onRefresh();
        } finally {
          setIsRefreshing(false);
        }
      }
      
      setIsPulling(false);
      setPullDistance(0);
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isPulling, pullDistance, isRefreshing, onRefresh]);

  const progress = Math.min(pullDistance / TRIGGER_THRESHOLD, 1);
  const rotation = progress * 360;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <motion.div
        className="absolute left-1/2 -translate-x-1/2 z-10 flex items-center justify-center"
        style={{ top: pullDistance - 40 }}
        animate={{ opacity: isPulling || isRefreshing ? 1 : 0 }}
      >
        <div 
          className={`w-8 h-8 rounded-full bg-background border shadow-sm flex items-center justify-center ${isRefreshing ? 'animate-spin' : ''}`}
          style={{ transform: isRefreshing ? undefined : `rotate(${rotation}deg)` }}
        >
          <RefreshCw className="w-4 h-4 text-primary" />
        </div>
      </motion.div>
      
      <motion.div
        style={{ transform: isPulling ? `translateY(${pullDistance}px)` : undefined }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        {children}
      </motion.div>
    </div>
  );
}
