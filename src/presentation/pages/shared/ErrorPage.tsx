import React from 'react';
import { useNavigate, useRouteError, isRouteErrorResponse } from 'react-router-dom';

interface ErrorPageProps {
  type?: '404' | 'error';
  message?: string;
}

export const ErrorPage: React.FC<ErrorPageProps> = ({ type = 'error', message }) => {
  const navigate = useNavigate();
  // useRouteError is useful if used as an errorElement in a data router,
  // but here it might be null since we are just rendering it as a component.
  const routeError = useRouteError();
  
  let errorCode = type === '404' ? '404' : '500';
  let errorTitle = type === '404' ? 'Halaman Tidak Ditemukan' : 'Terjadi Kesalahan Server';
  let errorMessage = message || 'Mohon maaf, halaman yang Anda cari tidak ada.';

  if (routeError) {
    if (isRouteErrorResponse(routeError)) {
      errorCode = String(routeError.status);
    } else if (routeError instanceof Error) {
      errorMessage = routeError.message;
    }
  }

  // Override logic based on the user request to blame the server
  if (errorCode === '404') {
    errorTitle = 'Halaman Tidak Ditemukan (Kesalahan Kami)';
    errorMessage = 'Mohon maaf, URL yang Anda tuju tidak dapat kami temukan di sistem. Ini sepenuhnya merupakan kesalahan dari sisi server kami, bukan kesalahan Anda. Kami sedang berusaha memperbaikinya.';
  } else if (errorCode === '504' || errorCode === '500') {
    errorTitle = 'Server Sedang Sibuk (Kesalahan Kami)';
    errorMessage = 'Mohon maaf, server kami gagal merespons permintaan Anda tepat waktu. Ini sepenuhnya merupakan kendala teknis dari sisi kami, bukan kesalahan Anda. Tim teknis kami sedang bekerja menstabilkan layanan.';
  }

  return (
    <div className="min-h-screen bg-clinical-surface flex flex-col items-center justify-center p-6 text-clinical-charcoal text-center relative overflow-hidden">
      {/* Background decorations matching landing page */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-radial from-clinical-blue/5 to-transparent rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none blur-3xl"></div>
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-radial from-clinical-red/5 to-transparent rounded-full translate-y-1/3 -translate-x-1/4 pointer-events-none blur-3xl"></div>

      <div className="bg-white/80 backdrop-blur-xl p-10 md:p-12 rounded-[2rem] shadow-[0px_20px_40px_rgba(0,0,0,0.04)] max-w-lg w-full border border-clinical-charcoal/5 relative z-10">
        <div className="flex items-center justify-center gap-2 mb-8 select-none">
          <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuBVHX00UF6lwM6kjDUMgD4Jv6lMMp5h2u1ZBPFlnvJJNam11nmTsrGtn_y5NNHv61wLHc3plhgbJeduSWPWMT-xKDKHnnifesb9pERppu-cGEHZODeFvF8XLLfRKpP1GdLDV5iINEmqPsbVTFdQZhAPCXP6aHQm-ecIuBbV0YG8GByhRtVQ6xZQrpQpUmXqjqW6DWiEZHDW8D81u4xSnTtsE-7HlTKrn6GuXcYUOYjdpCvaEqIKW1ghrNjEt5sTxTf_o6esUGi3HzNB" className="w-10 h-10 object-contain" alt="Logo" />
          <div className="text-2xl font-bold font-display tracking-tight flex"><span className="text-clinical-red">ecg</span><span className="text-clinical-charcoal">rhythmia</span></div>
        </div>

        <h1 className="text-6xl font-extrabold font-display mb-4 text-transparent bg-clip-text bg-gradient-to-br from-clinical-blue to-clinical-red">{errorCode}</h1>
        <h2 className="text-2xl font-bold mb-4 font-display text-clinical-charcoal">{errorTitle}</h2>
        <p className="text-clinical-charcoal/70 mb-10 leading-relaxed font-medium">{errorMessage}</p>
        <button
          onClick={() => navigate(-1)}
          className="w-full py-3 px-6 bg-clinical-blue text-white rounded-xl font-bold hover:brightness-110 active:scale-95 transition-all mb-3"
        >
          Kembali
        </button>
        <button
          onClick={() => navigate('/')}
          className="w-full py-3 px-6 bg-transparent border-2 border-clinical-charcoal/10 text-clinical-charcoal rounded-xl font-bold hover:bg-clinical-surface active:scale-95 transition-all"
        >
          Ke Halaman Utama
        </button>
      </div>
    </div>
  );
};
