import { useEffect, useState } from 'react';

interface FloatingConsultButtonProps {
  calendlyUrl?: string;
  imageSrc?: string;
  consultText?: string;
  visible?: boolean;
}

export function FloatingConsultButton({
  calendlyUrl = "https://calendly.com/neil-schwabe",
  imageSrc = "/neil-schwabe.jpg",
  consultText = "Schedule a consultation with Neil Schwabe - MGA w/ United Healthcare",
  visible = true
}: FloatingConsultButtonProps) {
  const [isRotating, setIsRotating] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsRotating(prev => !prev);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  if (!visible) return null;

  const openCalendly = () => {
    window.open(calendlyUrl, '_blank', 'width=800,height=800');
  };

  return (
    <div 
      className="fixed bottom-8 right-8 z-50 group cursor-pointer"
      onClick={openCalendly}
      data-testid="button-floating-consult"
    >
      <div className="relative">
        <div
          className={`w-20 h-20 rounded-full overflow-hidden border-4 border-cyan-400 shadow-lg shadow-cyan-400/50 transition-transform duration-1000 ${
            isRotating ? 'rotate-0' : 'rotate-180'
          }`}
        >
          <img
            src={imageSrc}
            alt="Consult"
            className="w-full h-full object-cover"
          />
        </div>
        
        <div className="absolute -top-16 right-0 bg-black/90 text-cyan-400 px-4 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-cyan-400/30 shadow-lg">
          {consultText}
        </div>

        <div className="absolute inset-0 rounded-full bg-cyan-400/20 animate-ping" />
      </div>
    </div>
  );
}
