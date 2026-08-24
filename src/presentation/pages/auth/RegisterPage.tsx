import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_URL } from '../../../config/env';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [role, setRole] = useState<'pasien' | 'dokter'>('pasien');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [age, setAge] = useState<number | ''>('');
  const [gender, setGender] = useState('L');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Password dan Konfirmasi Password tidak cocok.');
      return;
    }
    if (password.length < 6) {
      setError('Password harus lebih dari 6 karakter.');
      return;
    }
    if (role === 'pasien' && (!age || Number(age) < 1 || Number(age) > 120)) {
      setError('Masukkan umur yang valid (1-120 tahun).');
      return;
    }

    setIsLoading(true);
    try {
      // Langsung ke backend Rust SQLite — tidak melalui Supabase
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          role,
          first_name: firstName,
          last_name: lastName,
          age: role === 'pasien' ? Number(age) : null,
          gender: role === 'pasien' ? gender : null,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || 'Gagal mendaftarkan akun. Coba lagi.');
        return;
      }

      navigate('/auth/login', { state: { registered: true } });
    } catch (err) {
      setError('Koneksi ke server gagal. Pastikan backend berjalan.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 w-full bg-background overflow-y-auto">
    <main className="w-full max-w-[450px] my-8">
        <section className="bg-white shadow-lg rounded-xl p-6 md:p-10 flex flex-col items-center">
            <div className="flex flex-row items-center justify-center gap-2 mb-6">
                <img alt="ecgrhythmia clinical heart and stethoscope logo" className="w-14 h-14" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDCMHY1rwJz3Bn-D6aH30NsUoKCHh50RKw49BhscJugmYHzwjI4ey5ccSp9XawgX4Jzj6xSb8kHazzVJlVQ4AdKSkMKGRM3q1qB3ul_AyWaXLT_CJAZj0oV7QHTVIezEjnYJ1hRIIzWdfCh30ZbtQNyDMH86S-6c8UfQHx6HJub_2ZcnhGdwWIYbmcrjuDuluEo3nxY2ENq7nc0W5lO03dsPefmV_kTOnKCGtpZq9Sd3zxp7toZSYaVXYPGZa3bFZpNAb27eoWoXd1A" />
                <h1 className="font-headline-lg text-headline-lg flex tracking-tight text-[32px]">
                    <span className="text-brand-red font-extrabold">ecg</span><span className="text-brand-navy font-bold">rhythmia</span>
                </h1>
            </div>
            <div className="w-full space-y-6">
                <div className="text-center">
                    <h2 className="text-[24px] font-bold text-deep-charcoal mb-1">Buat Akun</h2>
                    <p className="text-body-sm text-secondary max-w-[300px] mx-auto">Silakan isi data diri Anda untuk mendaftar ke portal klinis.</p>
                </div>

                {error && (
                    <div className="bg-red-50 border border-alert-red/30 text-alert-red p-3 rounded-lg text-sm text-center font-bold">
                        {error}
                    </div>
                )}

                {/* Role Selector */}
                <div className="flex bg-surface-container p-1 rounded-lg w-full">
                    <button
                        type="button"
                        onClick={() => { setRole('pasien'); setError(''); }}
                        className={`flex-1 py-2 px-2 md:px-4 rounded-md font-label-bold text-label-bold transition-all text-xs md:text-sm ${role === 'pasien' ? 'bg-white shadow-sm text-on-surface' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
                    >
                        Pasien
                    </button>
                    <button
                        type="button"
                        onClick={() => { setRole('dokter'); setError(''); }}
                        className={`flex-1 py-2 px-2 md:px-4 rounded-md font-label-bold text-label-bold transition-all text-xs md:text-sm ${role === 'dokter' ? 'bg-white shadow-sm text-on-surface' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
                    >
                        Dokter / Nakes
                    </button>
                </div>

                <form className="w-full space-y-4" onSubmit={handleRegister}>
                    {/* Nama — always fixed 2 columns, no optional shifting */}
                    <div className="flex flex-col md:flex-row gap-4 w-full">
                        <div className="space-y-2 flex-1">
                            <label className="font-medium text-label-bold text-on-surface-variant" htmlFor="firstName">Nama Depan</label>
                            <input className="w-full bg-white border border-outline-variant rounded-lg p-3 font-body-sm text-body-sm focus:ring-2 focus:ring-medical-teal focus:border-medical-teal transition-all outline-none border-outline" id="firstName" placeholder="John"
                                type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                        </div>
                        <div className="space-y-2 flex-1">
                            <label className="font-medium text-label-bold text-on-surface-variant" htmlFor="lastName">Nama Belakang</label>
                            <input className="w-full bg-white border border-outline-variant rounded-lg p-3 font-body-sm text-body-sm focus:ring-2 focus:ring-medical-teal focus:border-medical-teal transition-all outline-none border-outline" id="lastName" placeholder="Doe"
                                type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                        </div>
                    </div>

                    {/* Age and Gender fields: always rendered for both to prevent layout shift */}
                    <div className="flex flex-col md:flex-row gap-4 w-full">
                        <div className="space-y-2 flex-1">
                            <label className="font-medium text-label-bold text-on-surface-variant" htmlFor="age">Umur (Tahun)</label>
                            <input
                                className="w-full bg-white border border-outline-variant rounded-lg p-3 font-body-sm text-body-sm focus:ring-2 focus:ring-medical-teal focus:border-medical-teal transition-all outline-none border-outline"
                                id="age"
                                type="number"
                                min="1"
                                max="120"
                                placeholder="25"
                                value={age}
                                onChange={(e) => setAge(e.target.value === '' ? '' : parseInt(e.target.value))}
                                required
                            />
                        </div>
                        <div className="space-y-2 flex-1">
                            <label className="font-medium text-label-bold text-on-surface-variant" htmlFor="gender">Jenis Kelamin</label>
                            <select className="w-full bg-white border border-outline-variant rounded-lg p-3 font-body-sm text-body-sm focus:ring-2 focus:ring-medical-teal focus:border-medical-teal transition-all outline-none border-outline appearance-none" id="gender" value={gender} onChange={(e) => setGender(e.target.value)}>
                                <option value="L">Laki-laki</option>
                                <option value="P">Perempuan</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="font-medium text-label-bold text-on-surface-variant" htmlFor="email">Email Address</label>
                        <input className="w-full bg-white border border-outline-variant rounded-lg p-3 font-body-sm text-body-sm focus:ring-2 focus:ring-medical-teal focus:border-medical-teal transition-all outline-none border-outline" id="email" placeholder="name@clinical.com"
                            type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                        <label className="font-medium text-label-bold text-on-surface-variant" htmlFor="password">Password</label>
                        <input className="w-full bg-white border border-outline-variant rounded-lg p-3 font-body-sm text-body-sm focus:ring-2 focus:ring-medical-teal focus:border-medical-teal transition-all outline-none border-outline" id="password" placeholder="Minimal 6 karakter" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                        <label className="font-medium text-label-bold text-on-surface-variant" htmlFor="confirmPassword">Konfirmasi Password</label>
                        <input className="w-full bg-white border border-outline-variant rounded-lg p-3 font-body-sm text-body-sm focus:ring-2 focus:ring-medical-teal focus:border-medical-teal transition-all outline-none border-outline" id="confirmPassword" placeholder="Ulangi password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                    </div>
                    <div className="pt-2 space-y-4">
                        <button
                            className="w-full bg-medical-teal text-white font-label-bold text-label-bold py-4 rounded-lg shadow-sm hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            type="submit"
                            disabled={isLoading}
                        >
                            {isLoading && <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>}
                            {isLoading ? 'Mendaftarkan...' : 'Buat Akun / Register'}
                        </button>
                        <div className="text-center">
                            <span className="text-body-sm text-secondary">
                                Sudah punya akun? <Link className="text-medical-teal font-bold hover:underline transition-all" to="/auth/login">Masuk di sini</Link>
                            </span>
                        </div>
                    </div>
                </form>
                <div className="mt-4 mb-2 text-center w-full border-t border-outline-variant pt-4">
                    <p className="text-body-sm text-secondary max-w-[300px] mx-auto text-sm">
                        &copy; 2024 ecgrhythmia Medical Systems.
                    </p>
                </div>
            </div>
        </section>
    </main>
    </div>
  );
};
