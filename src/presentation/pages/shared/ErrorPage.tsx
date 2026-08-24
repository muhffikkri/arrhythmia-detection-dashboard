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
  
  let errorCode = type === '404' ? '404' : 'Error';
  let errorTitle = type === '404' ? 'Halaman Tidak Ditemukan' : 'Terjadi Kesalahan';
  let errorMessage = message || 'Mohon maaf, halaman yang Anda cari tidak ada atau terjadi kesalahan pada server.';

  if (routeError) {
    if (isRouteErrorResponse(routeError)) {
      if (routeError.status === 404) {
        errorCode = '404';
        errorTitle = 'Halaman Tidak Ditemukan';
        errorMessage = 'Mohon maaf, halaman yang Anda cari tidak ada.';
      } else {
        errorCode = String(routeError.status);
        errorTitle = routeError.statusText;
        errorMessage = routeError.data?.message || errorMessage;
      }
    } else if (routeError instanceof Error) {
      errorMessage = routeError.message;
    }
  }

  return (
    <div className="min-h-screen bg-clinical-surface flex flex-col items-center justify-center p-6 text-clinical-charcoal text-center">
      <div className="bg-white p-10 rounded-[2rem] shadow-[0px_20px_40px_rgba(0,0,0,0.04)] max-w-md w-full border border-clinical-charcoal/5">
        <div className="w-20 h-20 bg-red-50 text-clinical-red rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="material-symbols-outlined text-[40px]">
            {errorCode === '404' ? 'search_off' : 'error'}
          </span>
        </div>
        <h1 className="text-4xl font-extrabold font-display mb-2 text-clinical-red">{errorCode}</h1>
        <h2 className="text-xl font-bold mb-4">{errorTitle}</h2>
        <p className="text-clinical-charcoal/70 mb-8">{errorMessage}</p>
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
