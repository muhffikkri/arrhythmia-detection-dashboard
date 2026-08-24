import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { API_URL } from '../../config/env';
import { fetchWithAuth } from '../../config/api';
import { useCachedFetch } from '../hooks/useCachedFetch';

export interface ConnectedPatient {
  id: string;
  name: string;
  profile_photo?: string;
  connectedAt: string;
  raw_id?: string;
}

export interface ConnectedDoctor {
  id?: string;
  name: string;
  hospital: string;
  photo?: string;
}

interface ConnectionContextType {
  connectedPatients: ConnectedPatient[];
  connectedDoctor: ConnectedDoctor | null;
  addConnectedPatient: (patient: ConnectedPatient) => void;
  removeConnectedPatient: (patientId: string) => void;
  clearConnectedPatients: () => void;
  setConnectedDoctor: (doctor: ConnectedDoctor | null) => void;
  disconnectAll: () => void;
}

const ConnectionContext = createContext<ConnectionContextType | undefined>(undefined);

export const ConnectionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [connectedPatients, setConnectedPatientsState] = useState<ConnectedPatient[]>(() => {
    const saved = localStorage.getItem('connectedPatients');
    return saved ? JSON.parse(saved) : [];
  });

  const [connectedDoctor, setConnectedDoctorState] = useState<ConnectedDoctor | null>(() => {
    const saved = localStorage.getItem('connectedDoctor');
    return saved ? JSON.parse(saved) : null;
  });

  const [authContext, setAuthContext] = useState({
    role: localStorage.getItem('user_role'),
    userId: localStorage.getItem('user_id')
  });

  useEffect(() => {
    const checkAuth = () => {
      const currentRole = localStorage.getItem('user_role');
      const currentUserId = localStorage.getItem('user_id');
      if (currentRole !== authContext.role || currentUserId !== authContext.userId) {
        setAuthContext({ role: currentRole, userId: currentUserId });
      }
    };
    const interval = setInterval(checkAuth, 1000);
    return () => clearInterval(interval);
  }, [authContext]);

  const { role, userId } = authContext;

  const { data: doctorPatientsData, mutate: mutateDoctorPatients } = useCachedFetch(
    role === 'dokter' && userId ? `/api/doctors/${userId}/patients` : null,
    { refreshInterval: 5000 }
  );

  const { data: patientData, mutate: mutatePatient } = useCachedFetch(
    role === 'pasien' && userId ? `/api/patients/${userId}` : null,
    { refreshInterval: 5000 }
  );

  useEffect(() => {
    if (role === 'dokter' && doctorPatientsData) {
      const data = doctorPatientsData.data || (Array.isArray(doctorPatientsData.patients) ? doctorPatientsData.patients : (Array.isArray(doctorPatientsData) ? doctorPatientsData : []));
      const mapped = data.map((p: any) => {
        const numStr = String(p.id).replace(/[^0-9]/g, '');
        const displayId = `PAT-${numStr.padStart(4, '0')}-XYZ`;
        return {
          id: displayId,
          raw_id: String(p.id),
          name: p.name,
          profile_photo: p.profile_photo || undefined,
          connectedAt: new Date().toISOString()
        };
      });
      setConnectedPatientsState(mapped);
    }
  }, [role, doctorPatientsData]);

  useEffect(() => {
    if (role === 'pasien' && patientData) {
      if (patientData.doctor) {
        setConnectedDoctorState({
          id: String(patientData.doctor.id),
          name: `Dr. ${patientData.doctor.first_name} ${patientData.doctor.last_name}`,
          hospital: "",
          photo: patientData.doctor.profile_photo || undefined
        });
      } else {
        setConnectedDoctorState(null);
      }
    }
  }, [role, patientData]);

  const addConnectedPatient = async (patient: ConnectedPatient) => {
    const dbPatientId = patient.raw_id || patient.id;
    const doctorId = localStorage.getItem('user_id');
    
    try {
      if (doctorId) {
        await fetchWithAuth(`/api/patients/${dbPatientId}/connect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ doctor_id: doctorId })
        });
      }
      setConnectedPatientsState(prev => {
        if (prev.some(p => p.id === patient.id)) return prev;
        return [...prev, patient];
      });
      if (role === 'dokter') {
        mutateDoctorPatients();
      }
    } catch (e) {
      console.error("Failed to connect patient", e);
    }
  };

  const removeConnectedPatient = async (patientId: string) => {
    // Find patient from current state to get their raw_id
    const patientObj = connectedPatients.find(p => p.id === patientId);
    const dbPatientId = patientObj?.raw_id || patientId;
    
    try {
      await fetchWithAuth(`/api/patients/${dbPatientId}/disconnect`, {
        method: 'POST'
      });
      setConnectedPatientsState(prev => prev.filter(p => p.id !== patientId));
      if (role === 'dokter') {
        mutateDoctorPatients();
      }
    } catch (e) {
      console.error("Failed to disconnect patient", e);
    }
  };

  const clearConnectedPatients = () => {
    setConnectedPatientsState([]);
  };

  const setConnectedDoctor = (doctor: ConnectedDoctor | null) => {
    setConnectedDoctorState(doctor);
    if (doctor) {
      localStorage.setItem('connectedDoctor', JSON.stringify(doctor));
    } else {
      localStorage.removeItem('connectedDoctor');
    }
  };

  const disconnectAll = () => {
    setConnectedPatientsState([]);
    setConnectedDoctorState(null);
    localStorage.removeItem('connectedPatients');
    localStorage.removeItem('connectedDoctor');
  };

  return (
    <ConnectionContext.Provider value={{ 
      connectedPatients, 
      connectedDoctor, 
      addConnectedPatient, 
      removeConnectedPatient,
      clearConnectedPatients,
      setConnectedDoctor, 
      disconnectAll 
    }}>
      {children}
    </ConnectionContext.Provider>
  );
};

export const useConnection = (): ConnectionContextType => {
  const context = useContext(ConnectionContext);
  if (context === undefined) {
    throw new Error('useConnection must be used within a ConnectionProvider');
  }
  return context;
};
