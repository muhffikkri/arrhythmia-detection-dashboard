import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../../config/supabaseClient';

import { fetchWithAuth } from '../../../config/api';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const userRole = localStorage.getItem('user_role');
      if (session && userRole) {
        if (userRole === 'pasien') navigate('/patient/dashboard');
        else if (userRole === 'dokter') navigate('/doctor/dashboard');
        else navigate('/admin/dashboard');
      }
    };
    checkSession();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message || 'Gagal login. Periksa email atau password.');
        return;
      }

      if (authData.user && authData.session) {
        // Ambil role dari Backend Rust
        try {
            // Kita HARUS mendaftarkan sesi access token agar fetchWithAuth berfungsi
            localStorage.setItem('auth_token', authData.session.access_token);
            
            const response = await fetchWithAuth('/api/auth/me');
            const data = await response.json();
            
            if (response.ok && data.success && data.role) {
                // Hapus data koneksi lama sebelum login baru berhasil
                localStorage.removeItem('connectedPatients');
                localStorage.removeItem('connectedDoctor');
                localStorage.removeItem('mock_patient_profile');

                // Simpan data auth ke localStorage
                localStorage.setItem('user_id', authData.user.id);
                localStorage.setItem('user_role', data.role);
                
                // Navigasi jika berhasil
                if (data.role === 'pasien') {
                  navigate('/patient/dashboard');
                } else if (data.role === 'dokter') {
                  navigate('/doctor/dashboard');
                } else {
                  navigate('/admin/dashboard');
                }
            } else {
                console.warn("Gagal mengambil role dari backend:", data.message);
                setError("Gagal memverifikasi akun Anda dengan server. Pastikan API menyala.");
                await supabase.auth.signOut();
                localStorage.clear();
            }
        } catch (err) {
            console.error("Kesalahan jaringan saat mengambil profil:", err);
            setError("Koneksi ke server terputus. Pastikan backend Rust berjalan.");
            await supabase.auth.signOut();
            localStorage.clear();
        }

      }
    } catch (err) {
      setError('Terjadi kesalahan saat login.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 w-full">

    <main className="w-full max-w-[450px]">
        <section className="bg-white shadow-lg rounded-xl p-6 md:p-10 flex flex-col items-center">
            <div className="flex flex-row items-center justify-center gap-2 mb-8">
                <img alt="ecgrhythmia clinical heart and stethoscope logo" className="w-14 h-14" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDCMHY1rwJz3Bn-D6aH30NsUoKCHh50RKw49BhscJugmYHzwjI4ey5ccSp9XawgX4Jzj6xSb8kHazzVJlVQ4AdKSkMKGRM3q1qB3ul_AyWaXLT_CJAZj0oV7QHTVIezEjnYJ1hRIIzWdfCh30ZbtQNyDMH86S-6c8UfQHx6HJub_2ZcnhGdwWIYbmcrjuDuluEo3nxY2ENq7nc0W5lO03dsPefmV_kTOnKCGtpZq9Sd3zxp7toZSYaVXYPGZa3bFZpNAb27eoWoXd1A" />
                <h1 className="font-headline-lg text-headline-lg flex tracking-tight text-[32px]">
                    <span className="text-brand-red font-extrabold">ecg</span><span className="text-brand-navy font-bold">rhythmia</span>
                </h1>
            </div>
            <div className="w-full space-y-8">
                <div className="text-center">
                    <h2 className="text-[24px] font-bold text-deep-charcoal mt-6 mb-2">Sign In</h2>
                    <p className="text-body-sm text-secondary max-w-[300px] mx-auto">Enter your credentials to access the clinical portal.</p>
                </div>
                
                {error && (
                    <div className="bg-red-50 border border-alert-red/30 text-alert-red p-3 rounded-lg text-sm text-center font-bold">
                        {error}
                    </div>
                )}
                <form className="w-full space-y-5" onSubmit={handleLogin}>
                    <div className="space-y-2">
                        <label className="font-medium text-label-bold text-on-surface-variant" htmlFor="email">Email Address</label>
                        <input className="w-full bg-white border border-outline-variant rounded-lg p-3 font-body-sm text-body-sm focus:ring-2 focus:ring-medical-teal focus:border-medical-teal transition-all outline-none border-outline" id="email" placeholder="name@clinical.com"
                            type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                        <label className="font-medium text-label-bold text-on-surface-variant" htmlFor="password">Password</label>
                        <div className="relative">
                            <input className="w-full bg-white border border-outline-variant rounded-lg p-3 font-body-sm text-body-sm focus:ring-2 focus:ring-medical-teal focus:border-medical-teal transition-all outline-none border-outline" id="password" placeholder="••••••••" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                            <button className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-medical-teal transition-colors" type="button">
                                <span className="material-symbols-outlined text-[20px]">visibility</span>
                            </button>
                        </div>
                    </div>
                    <div className="pt-4 space-y-4">
                        <button className="w-full bg-medical-teal text-white font-label-bold text-label-bold py-4 rounded-lg shadow-sm hover:brightness-110 active:scale-[0.98] transition-all" type="submit">
                             Masuk / Sign In
                        </button>
                        <div className="text-center space-y-2 flex flex-col">
                            <Link className="font-label-md text-label-md text-on-surface-variant hover:text-medical-teal hover:underline transition-all" to="#">
                                Forgot Password?
                            </Link>
                            <span className="text-body-sm text-secondary">
                                Belum punya akun? <Link className="text-medical-teal font-bold hover:underline transition-all" to="/auth/register">Buat Akun</Link>
                            </span>
                        </div>
                    </div>
                </form>
                <div className="mt-8 mb-6 text-center w-full border-t border-outline-variant pt-6">
                    <p className="text-body-sm text-secondary max-w-[300px] mx-auto text-sm">
                        © 2024 ecgrhythmia Medical Systems.
                        <span className="block mt-1">Need help? <Link className="text-medical-teal font-bold hover:underline" to="#">Contact Support</Link></span>
                    </p>
                </div>
            </div>
        </section>
    </main>
    



    </div>
  );
};
