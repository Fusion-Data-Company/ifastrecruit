import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Global error handler to suppress benign third-party errors from ElevenLabs widget
function handleBenignError(event: ErrorEvent | PromiseRejectionEvent) {
  const message = 'message' in event ? event.message : (event.reason?.message || String(event.reason || ''))
  const filename = 'filename' in event ? event.filename : ''
  
  // Check for known benign errors from ElevenLabs/AudioWorklet
  const benignPatterns = [
    'raw-audio-processor',
    'AudioWorklet',
    'AudioContext',
    'worklet',
    'unpkg.com/@elevenlabs/convai-widget-embed',
    'AbortError',
    'NotAllowedError', 
    'NotFoundError',
    'SecurityError',
    'The user aborted a request',
    'play() request was interrupted',
    'Failed to load the raw-audio-processor worklet module'
  ]
  
  const isBenignError = benignPatterns.some(pattern => 
    message.includes(pattern) || filename.includes(pattern)
  )
  
  if (isBenignError) {
    console.debug('🔇 Suppressing benign third-party error:', message)
    event.preventDefault?.()
    event.stopImmediatePropagation?.()
    return true
  }
  
  return false
}

// Register global error handlers before rendering
window.addEventListener('error', handleBenignError, true)
window.addEventListener('unhandledrejection', handleBenignError, true)

createRoot(document.getElementById("root")!).render(<App />);
