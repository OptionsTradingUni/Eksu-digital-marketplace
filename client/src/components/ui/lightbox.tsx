import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ZoomIn, ZoomOut, Download, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LightboxProps {
  src: string;
  alt?: string;
  isOpen: boolean;
  onClose: () => void;
  images?: string[];
  initialIndex?: number;
}

export function Lightbox({ 
  src, 
  alt = "Image preview", 
  isOpen, 
  onClose,
  images,
  initialIndex = 0
}: LightboxProps) {
  const [zoom, setZoom] = useState(1);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  
  const hasMultipleImages = images && images.length > 1;
  const currentSrc = images ? images[currentIndex] : src;
  
  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev + 0.5, 3));
  }, []);
  
  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev - 0.5, 0.5));
  }, []);
  
  const handleDownload = useCallback(() => {
    const link = document.createElement('a');
    link.href = currentSrc;
    link.download = `image-${Date.now()}.jpg`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [currentSrc]);
  
  const handleOpenInNewTab = useCallback(() => {
    window.open(currentSrc, '_blank');
  }, [currentSrc]);
  
  const handlePrevious = useCallback(() => {
    if (images) {
      setCurrentIndex(prev => (prev > 0 ? prev - 1 : images.length - 1));
    }
  }, [images]);
  
  const handleNext = useCallback(() => {
    if (images) {
      setCurrentIndex(prev => (prev < images.length - 1 ? prev + 1 : 0));
    }
  }, [images]);
  
  useEffect(() => {
    if (!isOpen) {
      setZoom(1);
      setCurrentIndex(initialIndex);
    }
  }, [isOpen, initialIndex]);
  
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          if (hasMultipleImages) handlePrevious();
          break;
        case 'ArrowRight':
          if (hasMultipleImages) handleNext();
          break;
        case '+':
        case '=':
          handleZoomIn();
          break;
        case '-':
          handleZoomOut();
          break;
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handlePrevious, handleNext, handleZoomIn, handleZoomOut, hasMultipleImages]);
  
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);
  
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center"
          onClick={onClose}
          data-testid="lightbox-overlay"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="relative max-w-[90vw] max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
            data-testid="lightbox-container"
          >
            <div className="absolute top-2 right-2 z-10 bg-black/70 backdrop-blur-sm rounded-md p-1 flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleZoomOut}
                disabled={zoom <= 0.5}
                className="text-white"
                data-testid="lightbox-zoom-out"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-white text-sm px-2">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleZoomIn}
                disabled={zoom >= 3}
                className="text-white"
                data-testid="lightbox-zoom-in"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDownload}
                className="text-white"
                data-testid="lightbox-download"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleOpenInNewTab}
                className="text-white"
                data-testid="lightbox-external"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="text-white"
                data-testid="lightbox-close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {hasMultipleImages && (
              <>
                <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-black/70 backdrop-blur-sm rounded-md p-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handlePrevious}
                    className="text-white"
                    data-testid="lightbox-previous"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </Button>
                </div>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-black/70 backdrop-blur-sm rounded-md p-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleNext}
                    className="text-white"
                    data-testid="lightbox-next"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </Button>
                </div>
              </>
            )}
            
            <div className="overflow-auto">
              <motion.img
                src={currentSrc}
                alt={alt}
                style={{ transform: `scale(${zoom})` }}
                className="max-w-full max-h-[85vh] object-contain transition-transform duration-200"
                data-testid="lightbox-image"
                draggable={false}
              />
            </div>
            
            {hasMultipleImages && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 bg-black/70 backdrop-blur-sm rounded-md px-3 py-1.5 flex items-center gap-2">
                {images.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentIndex(index)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      index === currentIndex ? 'bg-white' : 'bg-white/40'
                    }`}
                    data-testid={`lightbox-dot-${index}`}
                  />
                ))}
                <span className="text-white text-xs ml-1">
                  {currentIndex + 1} / {images.length}
                </span>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function useLightbox() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentImage, setCurrentImage] = useState<string>("");
  const [images, setImages] = useState<string[]>([]);
  const [initialIndex, setInitialIndex] = useState(0);
  
  const openLightbox = useCallback((src: string, allImages?: string[], index?: number) => {
    setCurrentImage(src);
    if (allImages) {
      setImages(allImages);
      setInitialIndex(index ?? allImages.indexOf(src));
    } else {
      setImages([]);
      setInitialIndex(0);
    }
    setIsOpen(true);
  }, []);
  
  const closeLightbox = useCallback(() => {
    setIsOpen(false);
  }, []);
  
  return {
    isOpen,
    currentImage,
    images,
    initialIndex,
    openLightbox,
    closeLightbox
  };
}
