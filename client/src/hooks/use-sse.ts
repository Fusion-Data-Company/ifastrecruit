import { useEffect, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface SSEEvent {
  type: string;
  data: any;
  timestamp: string;
}

interface SSEOptions {
  reconnect?: boolean;
  reconnectInterval?: number;
  onEvent?: (event: SSEEvent) => void;
  onError?: (error: Event) => void;
}

export function useSSE(url: string = "/api/sse", options: SSEOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const {
    reconnect = true,
    reconnectInterval = 5000,
    onEvent,
    onError,
  } = options;

  const connect = useCallback(() => {
    const eventSource = new EventSource(url);

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
      console.log("SSE connected");
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const sseEvent: SSEEvent = {
          type: event.type || "message",
          data,
          timestamp: new Date().toISOString(),
        };
        
        setLastEvent(sseEvent);
        onEvent?.(sseEvent);
      } catch (err) {
        console.warn("Failed to parse SSE message:", event.data);
      }
    };

    // Handle specific event types
    eventSource.addEventListener("connected", (event) => {
      console.log("SSE connection established:", event.data);
    });

    eventSource.addEventListener("ping", (event) => {
      // Keep-alive ping, no action needed
    });

    eventSource.addEventListener("candidate-created", (event) => {
      const candidate = JSON.parse(event.data);
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      console.log("New candidate created:", candidate.name);
    });

    eventSource.addEventListener("candidate-updated", (event) => {
      const candidate = JSON.parse(event.data);
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      console.log("Candidate updated:", candidate.name);
    });

    eventSource.addEventListener("kpis-updated", (event) => {
      const kpis = JSON.parse(event.data);
      queryClient.setQueryData(["/api/kpis"], kpis);
    });

    eventSource.addEventListener("interview-completed", (event) => {
      const interview = JSON.parse(event.data);
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/interviews"] });
      console.log("Interview completed for candidate:", interview.candidateId);
    });

    eventSource.addEventListener("booking-confirmed", (event) => {
      const booking = JSON.parse(event.data);
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      console.log("Booking confirmed:", booking.id);
    });

    eventSource.onerror = (event) => {
      setIsConnected(false);
      setError("Connection error");
      onError?.(event);
      
      eventSource.close();

      if (reconnect) {
        setTimeout(() => {
          console.log("Attempting to reconnect SSE...");
          connect();
        }, reconnectInterval);
      }
    };

    return eventSource;
  }, [url, reconnect, reconnectInterval, onEvent, onError, queryClient]);

  useEffect(() => {
    const eventSource = connect();

    return () => {
      eventSource.close();
      setIsConnected(false);
    };
  }, [connect]);

  const sendEvent = useCallback((eventType: string, data: any) => {
    // For sending custom events if needed
    // This would require a POST endpoint that broadcasts to all SSE clients
    fetch("/api/sse/broadcast", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event: eventType,
        data,
      }),
    }).catch(console.error);
  }, []);

  return {
    isConnected,
    lastEvent,
    error,
    sendEvent,
  };
}
