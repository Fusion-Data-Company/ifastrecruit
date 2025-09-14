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
  position: 'bottom-right' | 'top-right' | 'bottom-left' | 'bottom-center';
  testId?: string;
}

export function ElevenLabsWidget({ agentId, position, testId }: ElevenLabsWidgetProps) {
  const [widgetStatus, setWidgetStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    // Environmental diagnostics for debugging
    console.log('🔍 ElevenLabs Widget Debug Info:');
    console.log('- Current domain:', window.location.hostname);
    console.log('- Full URL:', window.location.href);
    console.log('- Protocol:', window.location.protocol);
    console.log('- Agent ID:', agentId);
    console.log('- Position:', position);
    console.log('- TestID:', testId);
    
    // Check for AudioWorklet support
    if (typeof window.AudioWorkletNode === 'undefined') {
      console.warn('⚠️ AudioWorklet not supported in this browser');
      setErrorMessage('Browser does not support advanced audio features');
      setWidgetStatus('error');
      return;
    }
    
    // Load the ElevenLabs ConvAI widget script if not already loaded
    if (!document.querySelector('script[src="https://unpkg.com/@elevenlabs/convai-widget-embed"]')) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/@elevenlabs/convai-widget-embed';
      script.async = true;
      script.type = 'text/javascript';
      
      script.onload = () => {
        console.log('✅ ElevenLabs ConvAI script loaded successfully');
        setWidgetStatus('loaded');
        
        // Add global error handler for AudioWorklet issues
        const handleGlobalError = (event: ErrorEvent | PromiseRejectionEvent) => {
          const message = 'message' in event ? event.message : event.reason?.toString() || 'Unknown error';
          if (message.includes('raw-audio-processor') || message.includes('worklet') || message.includes('AudioWorklet')) {
            console.warn('🎧 AudioWorklet issue detected, but widget may still function for text interactions');
            // Don't set error status for AudioWorklet issues as the widget may still work for text
            return;
          }
        };
        
        window.addEventListener('error', handleGlobalError);
        window.addEventListener('unhandledrejection', handleGlobalError);

        // Add widget event listeners for debugging
        setTimeout(() => {
          const widget = document.querySelector('elevenlabs-convai');
          if (widget) {
            // Listen for widget events
            widget.addEventListener('error', (e: any) => {
              console.error('🚨 ElevenLabs Widget Error:', e);
              const detail = e.detail || 'Unknown error';
              
              // Don't treat AudioWorklet errors as fatal - widget may still work for text
              if (detail.includes('raw-audio-processor') || detail.includes('worklet') || detail.includes('AudioWorklet')) {
                console.warn('🎧 Audio features may be limited, but text chat should work');
                return;
              }
              
              setErrorMessage(`Widget Error: ${detail}`);
              setWidgetStatus('error');
            });
            
            widget.addEventListener('connect', () => {
              console.log('🎉 ElevenLabs Widget Connected Successfully');
            });
            
            widget.addEventListener('disconnect', (e: any) => {
              console.warn('⚠️ ElevenLabs Widget Disconnected:', e);
            });
          }
        }, 1000);
        
        // Cleanup function
        return () => {
          window.removeEventListener('error', handleGlobalError);
          window.removeEventListener('unhandledrejection', handleGlobalError);
        };
      };
      
      script.onerror = () => {
        console.error('❌ Failed to load ElevenLabs ConvAI script');
        setErrorMessage('Failed to load widget script');
        setWidgetStatus('error');
      };
      
      document.head.appendChild(script);
    } else {
      setWidgetStatus('loaded');
    }

    // Check for HTTPS requirement
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      console.warn('⚠️ ElevenLabs requires HTTPS for microphone access in production');
      setErrorMessage('Voice features require HTTPS connection');
    }
  }, [agentId]);

  const positionStyles = position === 'bottom-right' 
    ? { position: 'fixed' as const, bottom: '24px', right: '24px', zIndex: 9999 }
    : position === 'bottom-left'
    ? { position: 'fixed' as const, bottom: '24px', left: '24px', zIndex: 9999 }
    : position === 'bottom-center'
    ? { position: 'fixed' as const, bottom: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 9999 }
    : { position: 'fixed' as const, top: '24px', right: '24px', zIndex: 9999 };

  if (widgetStatus === 'error') {
    return (
      <div 
        style={{...positionStyles, backgroundColor: '#ff4444', color: 'white', padding: '12px', borderRadius: '8px', fontSize: '12px', maxWidth: '250px'}}
        data-testid={`${testId}-error`}
        className="elevenlabs-widget-error"
      >
        <div>🚨 Voice Agent Error</div>
        <div style={{ marginTop: '4px', opacity: 0.9 }}>{errorMessage}</div>
        <div style={{ marginTop: '8px', fontSize: '10px', opacity: 0.8 }}>
          Domain: {window.location.hostname}
          <br />
          {errorMessage.includes('AudioWorklet') || errorMessage.includes('worklet') ? (
            <>
              Audio features may be limited in this browser.
              <br />
              • Try using Chrome or Edge for full functionality
              <br />
              • Text chat may still work
            </>
          ) : (
            <>
              Check ElevenLabs agent settings:
              <br />
              • Agent must be public (auth disabled)
              <br />
              • Domain must be in allowlist
            </>
          )}
        </div>
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
      agentId="agent_0601k4t9d82qe5ybsgkngct0zzkm"
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

// Secondary Agent - Bottom Left Corner
export function SecondaryAgent() {
  return (
    <ElevenLabsWidget 
      agentId="agent_01k07mhgszfcg9br6n46m8d35m"
      position="bottom-left"
      testId="secondary-agent"
    />
  );
}

// Center Agent - Bottom Center
export function CenterAgent() {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        left: 'calc(50% - 40px)', // Center minus half estimated width
        zIndex: 9999,
        backgroundColor: 'rgba(255, 255, 0, 0.3)', // Yellow debug background
        padding: '2px',
        borderRadius: '4px'
      }}
      data-testid="center-agent-debug"
    >
      <ElevenLabsWidget 
        agentId="agent_01jxb0mn53ft19tt6crjzaqnwc"
        position="bottom-right" // Use bottom-right positioning logic but in center container
        testId="center-agent"
      />
    </div>
  );
}