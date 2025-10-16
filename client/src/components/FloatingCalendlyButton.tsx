import { useState } from "react";
import { Calendar, X } from "lucide-react";
import { PopupModal } from "react-calendly";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function FloatingCalendlyButton() {
  const { user, isAdmin } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  // Don't show for admin users
  if (isAdmin) {
    return null;
  }

  // Check if user has disabled the button (showCalendlyButton is false or undefined)
  if (user && user.showCalendlyButton === false) {
    return null;
  }

  // If user is not authenticated or showCalendlyButton is true/undefined, show the button
  const prefillData = user ? {
    email: user.email || '',
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || ''
  } : undefined;

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-50",
          "w-16 h-16 rounded-full",
          "glass-panel glow-hover",
          "flex items-center justify-center",
          "transform transition-all duration-300 ease-in-out",
          "hover:scale-110 active:scale-95",
          "group"
        )}
        style={{
          background: "linear-gradient(135deg, hsla(195, 92%, 50%, 0.15) 0%, hsla(183, 100%, 67%, 0.12) 100%)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid hsla(195, 92%, 50%, 0.3)",
          boxShadow: "0 8px 32px hsla(195, 92%, 50%, 0.2), 0 0 80px hsla(183, 100%, 67%, 0.1)",
        }}
        aria-label="Book a consultation"
        data-testid="button-calendly-book"
      >
        {/* Pulse Animation Ring */}
        <span 
          className="absolute inset-0 rounded-full animate-ping"
          style={{
            background: "radial-gradient(circle, hsla(195, 92%, 50%, 0.3) 0%, transparent 70%)",
            animationDuration: "2s",
          }}
        />
        
        {/* Inner glow effect */}
        <span 
          className="absolute inset-2 rounded-full"
          style={{
            background: "radial-gradient(circle, hsla(183, 100%, 67%, 0.2) 0%, transparent 70%)",
            filter: "blur(8px)",
          }}
        />
        
        {/* Calendar Icon */}
        <Calendar 
          className="relative z-10 w-8 h-8 text-cyan-400 transition-all duration-300 group-hover:rotate-12"
        />
        
        {/* Tooltip on hover */}
        <span 
          className={cn(
            "absolute bottom-full mb-2 px-3 py-1.5 rounded-lg",
            "text-xs font-medium text-cyan-400 whitespace-nowrap",
            "opacity-0 group-hover:opacity-100",
            "transition-all duration-200",
            "pointer-events-none",
            "glass-panel",
          )}
          style={{
            left: "50%",
            transform: "translateX(-50%)",
          }}
        >
          Book a Consultation
        </span>
      </button>

      {/* Calendly Popup Modal */}
      {isOpen && (
        <div className="calendly-modal-overlay">
          <PopupModal
            url="https://calendly.com/ifastrecruit/consultation"
            onModalClose={() => setIsOpen(false)}
            open={isOpen}
            rootElement={document.getElementById("root") || document.body}
            prefill={prefillData}
            pageSettings={{
              backgroundColor: "0d1117",
              textColor: "d4dce5",
              primaryColor: "1dbef0",
            }}
          />
        </div>
      )}
    </>
  );
}

// Optional: Add a settings component to control the visibility
export function CalendlyButtonSettings({ 
  showButton, 
  onToggle 
}: { 
  showButton: boolean; 
  onToggle: (show: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between p-4 glass-panel rounded-lg">
      <div className="flex flex-col">
        <span className="text-sm font-medium text-foreground">
          Consultation Booking Button
        </span>
        <span className="text-xs text-muted-foreground">
          Show floating button for booking consultations
        </span>
      </div>
      <Button
        variant={showButton ? "default" : "outline"}
        size="sm"
        onClick={() => onToggle(!showButton)}
        className="min-w-[80px]"
      >
        {showButton ? "Visible" : "Hidden"}
      </Button>
    </div>
  );
}