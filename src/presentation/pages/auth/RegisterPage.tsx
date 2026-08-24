import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../../config/supabaseClient';

import { fetchWithAuth } from '../../../config/api';

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

    try {
      // 1. Sign up di Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        setError(authError.message || 'Gagal mendaftar auth');
        return;
      }

      if (authData.user) {
        // 2. Simpan profil lewat Backend Rust
        const payload = {
            role,
            first_name: firstName,
            last_name: lastName,
            email,
            age: role === 'pasien' ? (age || 0) : null,
            gender: role === 'pasien' ? gender : null,
        };

        const response = await fetchWithAuth('/api/auth/register_profile', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            setError(data.message || 'Gagal menyimpan profil ke sistem medis');
            return;
        }

        alert('Registrasi berhasil! Silakan login.');
        navigate('/auth/login');
      }
    } catch (err) {
      setError('Terjadi kesalahan saat pendaftaran');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 w-full bg-background overflow-y-auto">

    <main className="w-full max-w-[450px] my-8">
        <section className="bg-white shadow-lg rounded-xl p-6 md:p-10 flex flex-col items-center">
            <div className="flex flex-row items-center justify-center gap-2 mb-8">
                <img alt="ecgrhythmia clinical heart and stethoscope logo" className="w-14 h-14" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDCMHY1rwJz3Bn-D6aH30NsUoKCHh50RKw49BhscJugmYHzwjI4ey5ccSp9XawgX4Jzj6xSb8kHazzVJlVQ4AdKSkMKGRM3q1qB3ul_AyWaXLT_CJAZj0oV7QHTVIezEjnYJ1hRIIzWdfCh30ZbtQNyDMH86S-6c8UfQHx6HJub_2ZcnhGdwWIYbmcrjuDuluEo3nxY2ENq7nc0W5lO03dsPefmV_kTOnKCGtpZq9Sd3zxp7toZSYaVXYPGZa3bFZpNAb27eoWoXd1A" />
                <h1 className="font-headline-lg text-headline-lg flex tracking-tight text-[32px]">
                    <span className="text-brand-red font-extrabold">ecg</span><span className="text-brand-navy font-bold">rhythmia</span>
                </h1>
            </div>
            <div className="w-full space-y-8">
                <div className="text-center">
                    <h2 className="text-[24px] font-bold text-deep-charcoal mt-2 mb-2">Create Account</h2>
                    <p className="text-body-sm text-secondary max-w-[300px] mx-auto">Silakan isi data diri Anda untuk mendaftar ke portal klinis.</p>
                </div>
                
                {error && (
                    <div className="bg-red-50 border border-alert-red/30 text-alert-red p-3 rounded-lg text-sm text-center font-bold">
                        {error}
                    </div>
                )}

                <div className="flex bg-surface-container p-1 rounded-lg w-full my-6">
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
                    <div className="flex flex-col md:flex-row gap-4 w-full">
                        <div className="space-y-2 flex-1">
                            <label className="font-medium text-label-bold text-on-surface-variant" htmlFor="firstName">Nama Depan</label>
                            <input className="w-full bg-white border border-outline-variant rounded-lg p-3 font-body-sm text-body-sm focus:ring-2 focus:ring-medical-teal focus:border-medical-teal transition-all outline-none border-outline" id="firstName" placeholder="John"
                                type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                        </div>
                        <div className="space-y-2 flex-1">
                            <label className="font-medium text-label-bold text-on-surface-variant" htmlFor="lastName">Nama Belakang (Opsional)</label>
                            <input className="w-full bg-white border border-outline-variant rounded-lg p-3 font-body-sm text-body-sm focus:ring-2 focus:ring-medical-teal focus:border-medical-teal transition-all outline-none border-outline" id="lastName" placeholder="Doe"
                                type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                        </div>
                    </div>
                    {role === 'pasien' && (
                        <div className="flex flex-col md:flex-row gap-4 w-full animate-fade-in">
                            <div className="space-y-2 flex-1">
                                <label className="font-medium text-label-bold text-on-surface-variant" htmlFor="dob">Tanggal Lahir (Umur)</label>
                                <input className="w-full bg-white border border-outline-variant rounded-lg p-3 font-body-sm text-body-sm focus:ring-2 focus:ring-medical-teal focus:border-medical-teal transition-all outline-none border-outline" id="dob"
                                    type="date" value={age} onChange={(e) => setAge(parseInt(e.target.value))} required />
                            </div>
                            <div className="space-y-2 flex-1">
                                <label className="font-medium text-label-bold text-on-surface-variant" htmlFor="gender">Jenis Kelamin</label>
                                <select className="w-full bg-white border border-outline-variant rounded-lg p-3 font-body-sm text-body-sm focus:ring-2 focus:ring-medical-teal focus:border-medical-teal transition-all outline-none border-outline appearance-none" id="gender" value={gender} onChange={(e) => setGender(e.target.value)}>
                                    <option value="L">Laki-laki</option>
                                    <option value="P">Perempuan</option>
                                </select>
                            </div>
                        </div>
                    )}
                    <div className="space-y-2">
                        <label className="font-medium text-label-bold text-on-surface-variant" htmlFor="email">Email Address</label>
                        <input className="w-full bg-white border border-outline-variant rounded-lg p-3 font-body-sm text-body-sm focus:ring-2 focus:ring-medical-teal focus:border-medical-teal transition-all outline-none border-outline" id="email" placeholder="name@clinical.com"
                            type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                        <label className="font-medium text-label-bold text-on-surface-variant" htmlFor="password">Password</label>
                        <input className="w-full bg-white border border-outline-variant rounded-lg p-3 font-body-sm text-body-sm focus:ring-2 focus:ring-medical-teal focus:border-medical-teal transition-all outline-none border-outline" id="password" placeholder="••••••••" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                        <label className="font-medium text-label-bold text-on-surface-variant" htmlFor="confirmPassword">Konfirmasi Password</label>
                        <input className="w-full bg-white border border-outline-variant rounded-lg p-3 font-body-sm text-body-sm focus:ring-2 focus:ring-medical-teal focus:border-medical-teal transition-all outline-none border-outline" id="confirmPassword" placeholder="••••••••" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                    </div>
                    <div className="pt-4 space-y-4">
                        <button className="w-full bg-medical-teal text-white font-label-bold text-label-bold py-4 rounded-lg shadow-sm hover:brightness-110 active:scale-[0.98] transition-all" type="submit">
                             Buat Akun / Register
                        </button>
                        <div className="text-center">
                            <span className="text-body-sm text-secondary">
                                Sudah punya akun? <Link className="text-medical-teal font-bold hover:underline transition-all" to="/auth/login">Masuk di sini</Link>
                            </span>
                        </div>
                    </div>
                </form>
                <div className="mt-8 mb-6 text-center w-full border-t border-outline-variant pt-6">
                    <p className="text-body-sm text-secondary max-w-[300px] mx-auto text-sm">
                        © 2024 ecgrhythmia Medical Systems.
                    </p>
                </div>
            </div>
        </section>
    </main>
    </div>
  );
};
