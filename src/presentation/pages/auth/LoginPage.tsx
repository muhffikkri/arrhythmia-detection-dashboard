import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { API_URL } from '../../../config/env';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    // Cek jika baru saja mendaftar
    if (location.state?.registered) {
      setSuccessMsg('Pendaftaran berhasil! Silakan masuk.');
    }
    // Cek apakah sudah ada token — redirect jika sudah login
    const token = localStorage.getItem('auth_token');
    const userRole = localStorage.getItem('user_role');
    if (token && userRole) {
      if (userRole === 'pasien') navigate('/patient/dashboard', { replace: true });
      else if (userRole === 'dokter') navigate('/doctor/dashboard', { replace: true });
      else if (userRole === 'admin') navigate('/admin/dashboard', { replace: true });
    }
  }, [navigate, location.state]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Langsung ke backend Rust SQLite — tidak melalui Supabase
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || 'Email atau password salah.');
        return;
      }

      // Bersihkan data koneksi lama
      localStorage.removeItem('connectedPatients');
      localStorage.removeItem('connectedDoctor');
      localStorage.removeItem('mock_patient_profile');

      // Simpan sesi ke localStorage
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('user_id', data.user_id?.toString() || '');
      localStorage.setItem('user_role', data.role);

      // Navigasi berdasarkan role
      if (data.role === 'pasien') {
        navigate('/patient/dashboard', { replace: true });
      } else if (data.role === 'dokter') {
        navigate('/doctor/dashboard', { replace: true });
      } else {
        navigate('/admin/dashboard', { replace: true });
      }
    } catch (err) {
      setError('Koneksi ke server gagal. Pastikan backend berjalan.');
    } finally {
      setIsLoading(false);
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
            <div className="w-full space-y-6">
                <div className="text-center">
                    <h2 className="text-[24px] font-bold text-deep-charcoal mb-2">Masuk</h2>
                    <p className="text-body-sm text-secondary max-w-[300px] mx-auto">Masukkan kredensial Anda untuk mengakses portal klinis.</p>
                </div>

                {successMsg && (
                    <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-lg text-sm text-center font-bold">
                        {successMsg}
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 border border-alert-red/30 text-alert-red p-3 rounded-lg text-sm text-center font-bold">
                        {error}
                    </div>
                )}

                <form className="w-full space-y-5" onSubmit={handleLogin}>
                    <div className="space-y-2">
                        <label className="font-medium text-label-bold text-on-surface-variant" htmlFor="email">Email Address</label>
                        <input
                            className="w-full bg-white border border-outline-variant rounded-lg p-3 font-body-sm text-body-sm focus:ring-2 focus:ring-medical-teal focus:border-medical-teal transition-all outline-none border-outline"
                            id="email"
                            placeholder="name@clinical.com"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoComplete="email"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="font-medium text-label-bold text-on-surface-variant" htmlFor="password">Password</label>
                        <div className="relative">
                            <input
                                className="w-full bg-white border border-outline-variant rounded-lg p-3 pr-12 font-body-sm text-body-sm focus:ring-2 focus:ring-medical-teal focus:border-medical-teal transition-all outline-none border-outline"
                                id="password"
                                placeholder="••••••••"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                autoComplete="current-password"
                            />
                            <button
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-medical-teal transition-colors"
                                type="button"
                                onClick={() => setShowPassword(v => !v)}
                                tabIndex={-1}
                            >
                                <span className="material-symbols-outlined text-[20px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                            </button>
                        </div>
                    </div>
                    <div className="pt-2 space-y-4">
                        <button
                            className="w-full bg-medical-teal text-white font-label-bold text-label-bold py-4 rounded-lg shadow-sm hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            type="submit"
                            disabled={isLoading}
                        >
                            {isLoading && <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>}
                            {isLoading ? 'Memverifikasi...' : 'Masuk / Sign In'}
                        </button>
                        <div className="text-center space-y-2 flex flex-col">
                            <span className="text-body-sm text-secondary">
                                Belum punya akun? <Link className="text-medical-teal font-bold hover:underline transition-all" to="/auth/register">Buat Akun</Link>
                            </span>
                        </div>
                    </div>
                </form>
                <div className="mt-6 mb-2 text-center w-full border-t border-outline-variant pt-4">
                    <p className="text-body-sm text-secondary max-w-[300px] mx-auto text-sm">
                        &copy; 2024 ecgrhythmia Medical Systems.
                        <span className="block mt-1">Need help? <Link className="text-medical-teal font-bold hover:underline" to="#">Contact Support</Link></span>
                    </p>
                </div>
            </div>
        </section>
    </main>
    </div>
  );
};
