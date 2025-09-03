import React, { useEffect, useState } from 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'elevenlabs-convai': {
        'agent-id': string;
        style?: React.CSSProperties;
        className?: string;
      };
    }
  }
}

interface ElevenLabsWidgetProps {
  agentId: string;
  position: 'bottom-right' | 'top-right';
  testId?: string;
}

export function ElevenLabsWidget({ agentId, position, testId }: ElevenLabsWidgetProps) {
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [scriptError, setScriptError] = useState(false);

  useEffect(() => {
    // Check if script is already loaded
    const existingScript = document.querySelector('script[src="https://unpkg.com/@elevenlabs/convai-widget-embed"]');
    if (existingScript) {
      setScriptLoaded(true);
      return;
    }

    // Load the ElevenLabs ConvAI widget script
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/@elevenlabs/convai-widget-embed';
    script.async = true;
    script.type = 'text/javascript';
    script.crossOrigin = 'anonymous';
    
    script.onload = () => {
      console.log('ElevenLabs ConvAI script loaded successfully');
      // Wait a bit for the custom element to be defined
      const checkElement = () => {
        if (customElements.get('elevenlabs-convai')) {
          setScriptLoaded(true);
        } else {
          // Retry after a short delay
          setTimeout(checkElement, 100);
        }
      };
      setTimeout(checkElement, 50);
    };
    
    script.onerror = () => {
      console.error('Failed to load ElevenLabs ConvAI script');
      setScriptError(true);
    };
    
    document.head.appendChild(script);

    // Cleanup function
    return () => {
      // Don't remove the script on unmount as it might be used by other components
    };
  }, []);

  const positionStyles = position === 'bottom-right' 
    ? { position: 'fixed' as const, bottom: '24px', right: '24px', zIndex: 50 }
    : { position: 'fixed' as const, top: '24px', right: '24px', zIndex: 50 };

  // Don't render until script is loaded to avoid custom element errors
  if (scriptError) {
    console.warn('ElevenLabs widget failed to load');
    return null;
  }

  if (!scriptLoaded) {
    return (
      <div 
        style={positionStyles}
        data-testid={testId}
        className="elevenlabs-widget-container opacity-0"
      >
        {/* Loading placeholder */}
      </div>
    );
  }

  return (
    <div 
      style={positionStyles}
      data-testid={testId}
      className="elevenlabs-widget-container"
    >
      <elevenlabs-convai agent-id={agentId} />
    </div>
  );
}

// Main UI Agent - Bottom Right Corner
export function MainUIAgent() {
  return (
    <ElevenLabsWidget 
      agentId="agent_3401k4612x44fqcvzgj0hz2shnhv"
      position="bottom-right"
      testId="main-ui-agent"
    />
  );
}

// Interview Agent - Top Right Corner  
export function InterviewAgent() {
  return (
    <ElevenLabsWidget 
      agentId="agent_01k07mhgszfcg9br6n46m8d35m"
      position="top-right"
      testId="interview-agent"
    />
  );
}

// Sales Coach Agent - Top Right Corner
export function SalesCoachAgent() {
  return (
    <ElevenLabsWidget 
      agentId="agent_01jz0xtv25ej8axfe92t1sdv9t"
      position="top-right"
      testId="sales-coach-agent"
    />
  );
}