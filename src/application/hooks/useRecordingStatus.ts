import { useState, useEffect, useRef } from 'react';
import { WS_URL } from '../../config/env';
import { fetchWithAuth } from '../../config/api';

export const useRecordingStatus = (patientId: string) => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!patientId) {
      setIsRecording(false);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    // 1. Fetch initial status via REST
    const fetchInitialStatus = async () => {
      try {
        const response = await fetchWithAuth(`/api/patients/${patientId}/recording-status`);
        if (response.ok) {
          const data = await response.json();
          if (isMounted) {
            setIsRecording(data.is_recording || false);
          }
        }
      } catch (error) {
        console.error("Failed to fetch initial recording status:", error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchInitialStatus();

    // 2. Connect to WebSocket for real-time updates
    const connectWebSocket = () => {
      const wsUrl = `${WS_URL}?client_type=web&patient_id=${patientId}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("WebSocket connected for recording status.");
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'recording_status') {
            setIsRecording(message.status === 'START');
          }
        } catch (error) {
          console.error("Error parsing websocket message in useRecordingStatus", error);
        }
      };

      ws.onclose = () => {
        console.log("WebSocket for recording status closed.");
      };

      ws.onerror = (error) => {
        console.error("WebSocket error in useRecordingStatus:", error);
      };

      wsRef.current = ws;
    };

    connectWebSocket();

    return () => {
      isMounted = false;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [patientId]);

  return { isRecording, isLoading, setIsRecording };
};
