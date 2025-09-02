import React, { useEffect } from 'react';

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
  useEffect(() => {
    // Load the ElevenLabs ConvAI widget script if not already loaded
    if (!document.querySelector('script[src="https://unpkg.com/@elevenlabs/convai-widget-embed"]')) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/@elevenlabs/convai-widget-embed';
      script.async = true;
      script.type = 'text/javascript';
      document.head.appendChild(script);
    }
  }, []);

  const positionStyles = position === 'bottom-right' 
    ? { position: 'fixed' as const, bottom: '24px', right: '24px', zIndex: 50 }
    : { position: 'fixed' as const, top: '24px', right: '24px', zIndex: 50 };

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