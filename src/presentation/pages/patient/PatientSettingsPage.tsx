import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogoutModal } from '../../components/shared/LogoutModal';
import { PatientHeader } from '../../components/layout/PatientHeader';
import { usePreferences } from '../../../application/context/PreferencesContext';
import { useTranslation } from '../../../application/hooks/useTranslation';
import { SUPPORT_CONTACT } from '../../../config/env';

export const PatientSettingsPage: React.FC = () => {
    const navigate = useNavigate();
    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
    const {
        isLargeText, setIsLargeText,
        isHighContrast, setIsHighContrast,
        hideRecordingNotifications, setHideRecordingNotifications,
        language, setLanguage
    } = usePreferences();
    const { t } = useTranslation();

    return (
        <div className="text-clinical-charcoal w-full bg-clinical-surface/30 min-h-screen flex flex-col relative overflow-hidden">
            <div className="absolute inset-0 ecg-grid opacity-[0.15] z-0 pointer-events-none"></div>

            <PatientHeader />

            <main className="max-w-3xl w-full mx-auto px-4 py-8 space-y-8 relative z-10 flex-grow">
                <div className="mb-10 text-center md:text-left flex flex-col md:flex-row items-center gap-6">
                    <div className="w-20 h-20 rounded-2xl bg-clinical-blue flex items-center justify-center text-white shadow-[0px_20px_40px_rgba(0,0,0,0.04)]">
                        <span className="material-symbols-outlined text-4xl">settings</span>
                    </div>
                    <div>
                        <h1 className="text-3xl font-extrabold font-display text-clinical-charcoal mb-2 tracking-tight">{t('settings.title')}</h1>
                        <p className="text-base font-medium text-clinical-charcoal/60 max-w-lg">
                            {t('settings.desc')}
                        </p>
                    </div>
                </div>
                <div className="space-y-6">
                    {/* Section: Pengaturan Akun */}
                    <div>
                        <div className="flex items-center gap-2 mb-4 px-2">
                            <span className="material-symbols-outlined text-clinical-blue text-xl">account_circle</span>
                            <h2 className="text-sm font-bold text-clinical-charcoal uppercase tracking-wider">{t('settings.accountTitle')}</h2>
                        </div>
                        <section className="bg-white rounded-[2rem] shadow-[0px_20px_40px_rgba(0,0,0,0.04)] border border-clinical-charcoal/5 overflow-hidden transition-all duration-700 hover:shadow-[0px_30px_60px_rgba(0,0,0,0.08)]">
                            <div className="divide-y divide-clinical-charcoal/5">
                                <button onClick={() => navigate('/patient/profile')} className="w-full p-6 flex items-center justify-between hover:bg-clinical-surface transition-colors duration-300 text-left group">
                                    <div className="flex items-center gap-3">
                                        <span className="material-symbols-outlined text-clinical-charcoal/40">manage_accounts</span>
                                        <span className="font-bold text-[15px] text-clinical-charcoal group-hover:text-clinical-blue transition-colors">{t('settings.profile')}</span>
                                    </div>
                                    <span className="material-symbols-outlined text-clinical-charcoal/40 group-hover:translate-x-1 transition-transform">chevron_right</span>
                                </button>
                            </div>
                        </section>
                    </div>

                    {/* Section: Aksesibilitas & Tampilan */}
                    <div>
                        <div className="flex items-center gap-2 mb-4 px-2">
                            <span className="material-symbols-outlined text-clinical-blue text-xl">accessibility_new</span>
                            <h2 className="text-sm font-bold text-clinical-charcoal uppercase tracking-wider">{t('settings.displayTitle')}</h2>
                        </div>
                        <section className="bg-white rounded-[2rem] shadow-[0px_20px_40px_rgba(0,0,0,0.04)] border border-clinical-charcoal/5 overflow-hidden transition-all duration-700 hover:shadow-[0px_30px_60px_rgba(0,0,0,0.08)]">
                            <div className="divide-y divide-clinical-charcoal/5">
                                {/* Row 1 */}
                                <div className="p-6 flex items-center justify-between gap-4 hover:bg-clinical-surface transition-colors duration-300">
                                    <div>
                                        <h3 className="text-[15px] font-bold text-clinical-charcoal mb-0.5">{t('settings.largeText')}</h3>
                                        <p className="text-[13px] font-medium text-clinical-charcoal/60">{t('settings.largeTextDesc')}</p>
                                    </div>
                                    <label className="toggle-switch scale-110">
                                        <input
                                            type="checkbox"
                                            checked={isLargeText}
                                            onChange={(e) => setIsLargeText(e.target.checked)}
                                        />
                                        <span className="slider"></span>
                                    </label>
                                </div>
                                {/* Row 2 */}
                                <div className="p-6 flex items-center justify-between gap-4 hover:bg-clinical-surface transition-colors duration-300">
                                    <div>
                                        <h3 className="text-[15px] font-bold text-clinical-charcoal mb-0.5">{t('settings.highContrast')}</h3>
                                        <p className="text-[13px] font-medium text-clinical-charcoal/60">{t('settings.highContrastDesc')}</p>
                                    </div>
                                    <label className="toggle-switch scale-110">
                                        <input
                                            type="checkbox"
                                            checked={isHighContrast}
                                            onChange={(e) => setIsHighContrast(e.target.checked)}
                                        />
                                        <span className="slider"></span>
                                    </label>
                                </div>

                                {/* Row 3: Sembunyikan notifikasi saat perekaman */}
                                <div className="p-6 flex items-center justify-between gap-4 hover:bg-clinical-surface transition-colors duration-300">
                                    <div>
                                        <h3 className="text-[15px] font-bold text-clinical-charcoal mb-0.5">{t('settings.hideRecordingNotifications')}</h3>
                                        <p className="text-[13px] font-medium text-clinical-charcoal/60">{t('settings.hideRecordingNotificationsDesc')}</p>
                                    </div>
                                    <label className="toggle-switch scale-110">
                                        <input
                                            type="checkbox"
                                            aria-label={t('settings.hideRecordingNotifications')}
                                            checked={hideRecordingNotifications}
                                            onChange={(e) => setHideRecordingNotifications(e.target.checked)}
                                        />
                                        <span className="slider"></span>
                                    </label>
                                </div>

                                {/* Row 4 */}
                                <div className="p-6 flex items-center justify-between gap-4 hover:bg-clinical-surface transition-colors duration-300">
                                    <div>
                                        <h3 className="text-[15px] font-bold text-clinical-charcoal mb-0.5">{t('settings.languageMode')}</h3>
                                        <p className="text-[13px] font-medium text-clinical-charcoal/60">{t('settings.languageModeDesc')}</p>
                                    </div>
                                    <select
                                        className="bg-white border border-clinical-charcoal/10 rounded-xl px-4 py-2.5 text-clinical-charcoal font-medium text-sm outline-none focus:border-clinical-blue transition-colors shadow-sm cursor-pointer"
                                        value={language}
                                        onChange={(e) => setLanguage(e.target.value)}
                                    >
                                        <option value="id">Bahasa Indonesia</option>
                                        <option value="en">English (US)</option>
                                        <option value="zh">中文 (Chinese)</option>
                                        <option value="he">עברית (Hebrew)</option>
                                        <option value="ar">العربية (Arabic)</option>
                                    </select>
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* Section: Bantuan & Tentang Aplikasi */}
                    <div>
                        <div className="flex items-center gap-2 mb-4 px-2">
                            <span className="material-symbols-outlined text-clinical-blue text-xl">help</span>
                            <h2 className="text-sm font-bold text-clinical-charcoal uppercase tracking-wider">{t('settings.helpTitle')}</h2>
                        </div>
                        <section className="bg-white rounded-[2rem] shadow-[0px_20px_40px_rgba(0,0,0,0.04)] border border-clinical-charcoal/5 overflow-hidden transition-all duration-700 hover:shadow-[0px_30px_60px_rgba(0,0,0,0.08)]">
                            <div className="divide-y divide-clinical-charcoal/5">

                                <a href={SUPPORT_CONTACT} target="_blank" rel="noopener noreferrer" className="w-full p-6 flex items-center justify-between gap-4 hover:bg-clinical-surface transition-colors duration-300 text-left group cursor-pointer block">
                                    <div>
                                        <h3 className="text-[15px] font-bold text-clinical-charcoal mb-0.5 group-hover:text-clinical-blue transition-colors">{t('settings.support')}</h3>
                                        <p className="text-[13px] font-medium text-clinical-charcoal/60">{t('settings.supportDesc')}</p>
                                    </div>
                                    <span className="material-symbols-outlined text-clinical-charcoal/40 group-hover:translate-x-1 transition-transform">chevron_right</span>
                                </a>
                            </div>
                        </section>
                    </div>
                </div>

                {/* Bottom Action */}
                <div className="pt-12 pb-16 flex flex-col gap-4">
                    <button
                        onClick={() => alert(t('settings.savedAlert'))}
                        className="w-full py-4 bg-clinical-blue text-white font-bold rounded-xl hover:-translate-y-1 hover:shadow-lg hover:shadow-clinical-blue/30 active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 outline-none"
                    >
                        <span className="material-symbols-outlined">save</span>
                        {t('settings.save')}
                    </button>

                    <button
                        onClick={() => setIsLogoutModalOpen(true)}
                        className="w-full py-4 bg-white text-clinical-red border border-clinical-red/30 hover:bg-red-50/50 font-bold rounded-xl active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 outline-none"
                    >
                        <span className="material-symbols-outlined">logout</span>
                        {t('settings.logout')}
                    </button>
                    <p className="text-center text-sm font-medium text-clinical-charcoal/60 mt-2">Terakhir diperbarui: 4 Agustus 2026</p>
                </div>
            </main>
            <LogoutModal isOpen={isLogoutModalOpen} onClose={() => setIsLogoutModalOpen(false)} />
        </div>
    );
};
