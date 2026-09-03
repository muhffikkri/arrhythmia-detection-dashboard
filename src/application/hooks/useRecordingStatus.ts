import { useState, useEffect, useRef } from "react";
import { fetchWithAuth } from "../../config/api";

export const useRecordingStatus = (patientId: string) => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const hasLocalOverride = useRef(false);
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
          if (isMounted && !hasLocalOverride.current) {
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

    return () => {
      isMounted = false;
    };
  }, [patientId]);

  const setRecordingState = (value: boolean) => {
    hasLocalOverride.current = true;
    setIsRecording(value);
  };

  return { isRecording, isLoading, setIsRecording: setRecordingState };
};
