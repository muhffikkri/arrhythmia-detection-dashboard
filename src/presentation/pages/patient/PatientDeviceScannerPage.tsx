import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { PatientHeader } from '../../components/layout/PatientHeader';
import { API_URL } from '../../../config/env';
import { fetchWithAuth } from '../../../config/api';

export const PatientDeviceScannerPage: React.FC = () => {
  const navigate = useNavigate();
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const isProcessing = useRef(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [modalErrorMsg, setModalErrorMsg] = useState('');
  const [foundDevice, setFoundDevice] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [scannerInstance, setScannerInstance] = useState<Html5Qrcode | null>(null);

  useEffect(() => {
    const html5QrCode = new Html5Qrcode("reader");
    setScannerInstance(html5QrCode);

    const startScanner = async () => {
      try {
        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            aspectRatio: 1.0,
          },
          (decodedText) => {
            if (isProcessing.current) return;

            try {
              const data = JSON.parse(decodedText);
              if (data.type === 'device_sync' && data.deviceId) {
                isProcessing.current = true;
                setInputValue(data.deviceId);
                syncDevice(data.deviceId);
              } else {
                throw new Error("Invalid format");
              }
            } catch (e) {
              isProcessing.current = true;
              setModalErrorMsg('Kode QR tidak valid. Pastikan Anda memindai kode QR perangkat yang sah dari Administrator.');
              setShowErrorModal(true);
            }
          },
          (errorMessage) => {
            // ignore continuous scan errors
          }
        );
        setIsCameraActive(true);
      } catch (err) {
        console.error("Failed to start camera", err);
        setCameraError(true);
        setIsCameraActive(false);
      }
    };

    let isMounted = true;
    startScanner().then(() => {
      if (!isMounted) {
        try {
          html5QrCode.stop().then(() => html5QrCode.clear()).catch(() => html5QrCode.clear());
        } catch (e) {
          html5QrCode.clear();
        }
      }
    });

    return () => {
      isMounted = false;
      try {
        html5QrCode.stop()
          .then(() => html5QrCode.clear())
          .catch(() => html5QrCode.clear());
      } catch (e) {
        try { html5QrCode.clear(); } catch (err) { }
      }
    };
  }, []);

  const syncDevice = async (deviceId: string) => {
    setIsLoading(true);
    try {
      const patientId = localStorage.getItem('user_id');
      if (patientId) {
        await fetchWithAuth(`/api/devices/${deviceId}/assign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patient_id: patientId })
        });
      }

      // Menyimpan deviceId yang disinkronisasi ke localStorage
      localStorage.setItem('synced_device_id', deviceId);
      setFoundDevice(deviceId);
      setShowSuccessModal(true);
    } catch (err) {
      setModalErrorMsg('Gagal menyinkronisasi alat. Silakan coba lagi.');
      setShowErrorModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    if (!inputValue) {
      setModalErrorMsg('Masukkan ID Alat terlebih dahulu.');
      setShowErrorModal(true);
      return;
    }
    syncDevice(inputValue);
  };

  const closeErrorModal = () => {
    setShowErrorModal(false);
    isProcessing.current = false;
  };

  return (
    <div className="bg-clinical-surface/30 text-clinical-charcoal antialiased overflow-x-hidden w-full min-h-screen flex flex-col relative">
      <div className="absolute inset-0 ecg-grid opacity-[0.15] z-0 pointer-events-none"></div>
      <PatientHeader />

      <main id="main-content" className="flex-grow p-4 md:p-6 max-w-4xl mx-auto w-full relative z-10">
        <div className="mb-6">
          <h1 className="text-3xl font-extrabold font-display text-clinical-charcoal tracking-tight">Pemindai Alat EKG</h1>
          <p className="text-sm text-clinical-charcoal/60 mt-1">Pindai QR Code alat dari layar Admin untuk menghubungkannya.</p>
        </div>

        <div className="bg-white rounded-[2rem] border border-clinical-charcoal/5 shadow-[0px_20px_40px_rgba(0,0,0,0.04)] hover:shadow-[0px_30px_60px_rgba(0,0,0,0.08)] transition-all duration-700 overflow-hidden p-4 md:p-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center">
            <div className="flex flex-col gap-4">
              <div className="w-full aspect-square bg-white border border-clinical-charcoal/5 rounded-3xl relative shadow-sm overflow-hidden group">
                <div id="reader" className="w-full h-full [&_video]:object-cover [&_video]:w-full [&_video]:h-full border-none"></div>
                <div className="absolute inset-0 pointer-events-none p-4 flex items-center justify-center z-20">
                  <div className="w-full h-full relative">
                    <div className="absolute top-0 left-0 w-16 h-16 border-t-[6px] border-l-[6px] border-black rounded-tl-3xl"></div>
                    <div className="absolute top-0 right-0 w-16 h-16 border-t-[6px] border-r-[6px] border-black rounded-tr-3xl"></div>
                    <div className="absolute bottom-0 left-0 w-16 h-16 border-b-[6px] border-l-[6px] border-black rounded-bl-3xl"></div>
                    <div className="absolute bottom-0 right-0 w-16 h-16 border-b-[6px] border-r-[6px] border-black rounded-br-3xl"></div>
                  </div>
                </div>
              </div>

              <div className="flex justify-center mt-2">
                <button className="flex items-center gap-2 text-sm text-clinical-charcoal/60 hover:text-clinical-blue font-medium transition-colors bg-clinical-surface px-4 py-2 rounded-full">
                  <span className="material-symbols-outlined text-[18px]">{cameraError || !isCameraActive ? 'videocam_off' : 'videocam'}</span>
                  {cameraError ? 'Kamera Gagal Akses' : (isCameraActive ? 'Status Kamera Aktif' : 'Status Kamera Tidak Aktif')}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-6 justify-center">
              <div>
                <h2 className="text-2xl font-bold font-display text-clinical-charcoal mb-2">Sinkronisasi Manual</h2>
                <p className="text-sm text-clinical-charcoal/60 mb-6 leading-relaxed">Masukkan ID Alat secara manual jika kode QR sulit dipindai atau kamera bermasalah.</p>

                <div className="relative">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Contoh: device01"
                    className="w-full bg-clinical-surface/50 border border-clinical-charcoal/10 rounded-2xl p-4 pl-12 text-lg focus:ring-2 focus:ring-clinical-blue focus:border-clinical-blue outline-none font-mono tracking-widest shadow-sm transition-shadow hover:shadow-md"
                  />
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-clinical-charcoal/40">sensors</span>
                </div>
              </div>
              <button
                onClick={handleSearch}
                disabled={isLoading}
                className="w-full bg-clinical-blue text-white py-4 rounded-2xl font-bold text-base hover:brightness-110 active:scale-[0.98] transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-[20px]">link</span>
                )}
                {isLoading ? 'Menyinkronkan...' : 'Hubungkan Alat'}
              </button>
            </div>
          </div>
        </div>
      </main>

      {showSuccessModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-clinical-charcoal/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-[2rem] p-8 text-center shadow-2xl border border-clinical-charcoal/5 animate-in zoom-in-50 fade-in duration-500 ease-spring">
            <div className="w-20 h-20 rounded-full bg-status-green/10 flex items-center justify-center mx-auto mb-6 text-status-green">
              <span className="material-symbols-outlined text-4xl">verified</span>
            </div>
            <h3 className="text-2xl font-bold font-display text-clinical-charcoal mb-2">Alat Terhubung!</h3>
            <p className="text-clinical-charcoal/60 font-medium">Berhasil sinkronisasi dengan alat:</p>
            <div className="bg-clinical-surface/50 rounded-xl p-4 my-6 border border-clinical-charcoal/10">
              <p className="font-bold font-mono text-xl text-clinical-charcoal">{foundDevice}</p>
            </div>

            <button onClick={() => navigate('/patient/dashboard')} className="w-full bg-clinical-blue text-white py-3.5 rounded-xl font-bold shadow-md hover:brightness-110 hover:-translate-y-0.5 transition-all active:scale-95 flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-[20px]">home</span>
              Kembali ke Dashboard
            </button>
          </div>
        </div>
      )}

      {showErrorModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-clinical-charcoal/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-[2rem] p-8 text-center shadow-2xl border-2 border-clinical-red/10 animate-in zoom-in-50 fade-in duration-500 ease-spring">
            <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6 text-clinical-red">
              <span className="material-symbols-outlined text-4xl">error</span>
            </div>
            <h3 className="text-2xl font-bold font-display text-clinical-charcoal mb-3">Koneksi Gagal</h3>

            <p className="text-sm text-clinical-charcoal/60 mb-8 leading-relaxed px-2">
              {modalErrorMsg}
            </p>

            <button onClick={closeErrorModal} className="w-full bg-clinical-red text-white py-3.5 rounded-xl font-bold shadow-md hover:bg-clinical-red/90 hover:-translate-y-0.5 transition-all active:scale-95">
              Tutup dan Coba Lagi
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
