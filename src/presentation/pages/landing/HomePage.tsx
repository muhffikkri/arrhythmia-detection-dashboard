import React from 'react';
import { PublicHeader } from '../../components/layout/PublicHeader';
import { PublicFooter } from '../../components/layout/PublicFooter';
import { useNavigate, useLocation } from 'react-router-dom';

import fikriImg from '../../../assets/team-profile/Muhammad Fikri.webp';
import rizqikaImg from '../../../assets/team-profile/Rizqika Azkiya Algim.webp';
import athayaImg from '../../../assets/team-profile/Athaya Rashif Hanang Syah.webp';
import rafaImg from '../../../assets/team-profile/Rafa Azlan.webp';
import raffiImg from '../../../assets/team-profile/Raffi Arditama.webp';

const RevealContent: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className }) => {
  const [isVisible, setIsVisible] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        } else {
          setIsVisible(false);
        }
      },
      { threshold: 0.15 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-in-out transform w-full ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-16'} ${className || ''}`}
    >
      {children}
    </div>
  );
};

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showLogoutSuccess, setShowLogoutSuccess] = React.useState(location.state?.logoutSuccess || false);

  React.useEffect(() => {
    if (showLogoutSuccess) {
      window.history.replaceState({}, document.title);
      const timer = setTimeout(() => setShowLogoutSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showLogoutSuccess]);

  return (
    <div id="main-scroll-container" className="bg-white dark:bg-luxury-cream text-clinical-charcoal dark:text-luxury-navy font-body-md dark:font-luxury-body overflow-x-hidden w-full transition-colors duration-700 h-screen overflow-y-scroll snap-y snap-mandatory scroll-smooth">
      <PublicHeader />

      <main>
        {/* Section 1: Hero Section */}
        <section className="relative h-[100svh] md:min-h-screen md:h-screen w-full flex items-center justify-center snap-start overflow-hidden bg-clinical-surface/50 dark:bg-luxury-navy transition-colors duration-700">

          {/* MOBILE: Immersive Background Image */}
          <div className="absolute inset-0 z-0 md:hidden bg-luxury-navy">
            <img alt="Heart monitor device background" className="w-full h-full object-cover object-bottom opacity-100" src="/images/hero_mobile.webp" />
            <div className="absolute inset-0 bg-gradient-to-b from-luxury-navy/90 via-transparent to-transparent"></div>
          </div>

          <div className="absolute inset-0 ecg-grid opacity-30 dark:opacity-10 z-0 md:-z-10"></div>

          <RevealContent className="max-w-container-max w-full h-full md:h-auto mx-auto px-margin-mobile md:px-margin-desktop grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-stretch md:items-center relative z-10 pt-32 pb-12 md:py-0">
            <div className="h-full flex flex-col justify-between md:justify-center items-center md:items-start text-center md:text-left z-20 md:space-y-10">
              <div className="space-y-5">
                <h1 className="font-headline-xl dark:font-luxury-headline text-[44px] md:text-[64px] leading-[1.1] tracking-tight dark:tracking-normal text-white md:text-clinical-charcoal dark:text-luxury-cream transition-colors duration-700 drop-shadow-md md:drop-shadow-none">
                  Monitor your heart rhythm{' '}
                  <span className="text-[#ff7675] md:text-clinical-red dark:text-luxury-gold italic dark:not-italic dark:font-light">anytime,</span>
                  <br className="hidden md:block" />
                  <span className="text-[#74b9ff] md:text-clinical-blue dark:text-luxury-gold italic dark:not-italic dark:font-light block mt-2">anywhere.</span>
                </h1>
                <p className="hidden md:block font-body-lg text-[18px] md:text-[20px] text-white/90 md:text-clinical-charcoal/90 dark:text-luxury-cream/90 max-w-lg leading-relaxed dark:font-light drop-shadow-md md:drop-shadow-none">
                  Bridge the gap between daily life and clinical care. ecgrhythmia provides constant, real-time ECG data to detect arrhythmia before they become emergencies.
                </p>
              </div>
              <div className="w-full sm:w-auto pb-4 md:pb-0">
                <button
                  onClick={() => navigate('/auth/login')}
                  className="w-full sm:w-auto bg-clinical-blue dark:bg-transparent text-white dark:text-luxury-gold font-label-md dark:font-luxury-button dark:uppercase dark:tracking-widest dark:border dark:border-luxury-gold text-[16px] dark:text-[13px] px-10 py-4 rounded-full hover:shadow-xl dark:hover:bg-luxury-gold dark:hover:text-luxury-navy transition-all duration-700 shadow-lg md:shadow-none"
                >
                  Discover Dashboard
                </button>
              </div>
            </div>

            {/* Right Column (Desktop Image & Card) */}
            <div className="hidden md:block relative group">
              <div className="absolute -inset-10 bg-clinical-blue/5 dark:bg-luxury-gold/5 rounded-full blur-3xl group-hover:bg-clinical-blue/10 dark:group-hover:bg-luxury-gold/10 transition-colors duration-700"></div>

              <div className="relative aspect-[4/3] md:aspect-square rounded-[2rem] overflow-hidden shadow-[0px_30px_60px_rgba(0,0,0,0.08)] dark:shadow-[0px_40px_80px_rgba(0,0,0,0.4)] border border-clinical-charcoal/5 dark:border-luxury-gold/20">
                <img alt="Heart monitor device" className="w-full h-full object-cover mix-blend-multiply dark:mix-blend-normal opacity-90 dark:opacity-100" src="/images/hero.webp" />

                <div className="absolute bottom-4 md:bottom-8 left-4 md:left-8 right-4 md:right-8 bg-white/70 dark:bg-luxury-navy/60 backdrop-blur-2xl p-4 md:p-6 rounded-2xl border border-white/50 dark:border-white/10 shadow-sm transition-colors duration-700">
                  <div className="flex items-center justify-between mb-2 md:mb-4">
                    <span className="font-bold font-headline-md dark:font-luxury-headline text-clinical-charcoal dark:text-luxury-cream text-base md:text-lg tracking-wide">ECG Status</span>
                    <span className="flex items-center gap-2 text-clinical-blue dark:text-luxury-gold font-label-md dark:font-luxury-button text-xs md:text-sm uppercase tracking-widest">
                      <span className="w-2 h-2 rounded-full bg-clinical-blue dark:bg-luxury-gold animate-pulse shadow-[0_0_10px_rgba(23,107,206,0.5)] dark:shadow-[0_0_10px_rgba(240,192,74,0.5)]"></span>
                      Active
                    </span>
                  </div>
                  <div className="h-8 md:h-12 w-full overflow-hidden relative">
                    <svg className="absolute inset-0 w-full h-full text-clinical-blue dark:text-luxury-gold" preserveAspectRatio="none" viewBox="0 0 400 100">
                      <path className="pulse-animation" d="M0,50 L50,50 L60,20 L75,80 L85,50 L120,50 L130,10 L145,90 L160,50 L200,50 L210,20 L225,80 L235,50 L270,50 L280,10 L295,90 L310,50 L350,50" fill="none" stroke="currentColor" strokeWidth="2"></path>
                    </svg>
                  </div>
                </div>
              </div>
            </div>

          </RevealContent>
        </section>

        {/* Section 2: Elevate Your Health Intro */}
        <section className="min-h-screen py-24 md:py-0 md:h-screen w-full flex flex-col justify-center items-center snap-start bg-white dark:bg-luxury-cream transition-colors duration-700">
          <div className="max-w-container-max w-full mx-auto px-margin-mobile md:px-margin-desktop">
            <RevealContent className="text-center space-y-4 md:space-y-6">
              <h2 className="font-headline-lg dark:font-luxury-headline text-[40px] md:text-[64px] text-clinical-charcoal dark:text-luxury-navy leading-tight">Never Miss a Beat</h2>
              <p className="text-clinical-charcoal/60 dark:text-luxury-navy/60 max-w-2xl mx-auto font-body-lg dark:font-luxury-body text-lg md:text-2xl dark:font-light">
                We deliver continuous, clinically precise heart analysis directly to you.
              </p>
            </RevealContent>
          </div>
        </section>

        {/* Section 3: Feature 1 */}
        <section className="min-h-screen py-24 md:py-0 md:h-screen w-full flex flex-col justify-center snap-start bg-white dark:bg-luxury-cream transition-colors duration-700">
          <div className="max-w-container-max w-full mx-auto px-margin-mobile md:px-margin-desktop">
            <RevealContent className="flex flex-col md:flex-row items-center gap-8 md:gap-16 group">
              <div className="flex-1 w-full relative">
                <div className="absolute inset-0 border border-clinical-blue/20 dark:border-luxury-gold/30 rounded-[2rem] transform translate-x-3 translate-y-3 md:translate-x-4 md:translate-y-4 group-hover:translate-x-5 group-hover:translate-y-5 transition-transform duration-700"></div>
                <div className="relative rounded-[2rem] overflow-hidden shadow-xl aspect-[16/9] md:aspect-[4/3] bg-clinical-surface dark:bg-luxury-muted/10">
                  <img src="/images/realtime.webp" alt="Real-time monitoring" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                </div>
              </div>
              <div className="flex-1 space-y-4 md:space-y-6 md:pl-8">
                <span className="text-clinical-blue dark:text-luxury-gold font-label-md dark:font-luxury-button tracking-[0.2em] uppercase text-xs md:text-sm font-bold">01 — Precision</span>
                <h3 className="font-headline-lg dark:font-luxury-headline text-3xl md:text-5xl text-clinical-charcoal dark:text-luxury-navy leading-tight">Live Real-time <br className="hidden md:block" />Monitoring</h3>
                <p className="text-clinical-charcoal/70 dark:text-luxury-navy/70 font-body-lg dark:font-luxury-body text-base md:text-lg leading-relaxed dark:font-light">
                  Hassle-free, your heart rate data is sent directly to your phone via encrypted wireless communication. Monitor every beat with clinical-grade accuracy from the comfort of your home.
                </p>
              </div>
            </RevealContent>
          </div>
        </section>

        {/* Section 3: Feature 2 */}
        <section className="min-h-screen py-24 md:py-0 md:h-screen w-full flex flex-col justify-center snap-start bg-clinical-surface/30 dark:bg-[#F8F8F5] transition-colors duration-700">
          <RevealContent className="max-w-container-max w-full mx-auto px-margin-mobile md:px-margin-desktop">
            <div className="flex flex-col md:flex-row-reverse items-center gap-8 md:gap-16 group">
              <div className="flex-1 w-full relative">
                <div className="absolute inset-0 border border-clinical-red/20 dark:border-luxury-navy/20 rounded-[2rem] transform -translate-x-3 translate-y-3 md:-translate-x-4 md:translate-y-4 group-hover:-translate-x-5 group-hover:translate-y-5 transition-transform duration-700"></div>
                <div className="relative rounded-[2rem] overflow-hidden shadow-xl aspect-[16/9] md:aspect-[4/3] bg-clinical-surface dark:bg-luxury-muted/10">
                  <img src="/images/notifications.webp" alt="Smart notifications" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                </div>
              </div>
              <div className="flex-1 space-y-4 md:space-y-6 md:pr-8">
                <span className="text-clinical-red dark:text-luxury-slate font-label-md dark:font-luxury-button tracking-[0.2em] uppercase text-xs md:text-sm font-bold">02 — Intelligence</span>
                <h3 className="font-headline-lg dark:font-luxury-headline text-3xl md:text-5xl text-clinical-charcoal dark:text-luxury-navy leading-tight">Smart AI <br className="hidden md:block" />Notifications</h3>
                <p className="text-clinical-charcoal/70 dark:text-luxury-navy/70 font-body-lg dark:font-luxury-body text-base md:text-lg leading-relaxed dark:font-light">
                  Our proprietary AI algorithms detect heart anomalies early and provide instant, elegant alerts, ensuring you and your doctors are always informed before it's too late.
                </p>
              </div>
            </div>
          </RevealContent>
        </section>

        {/* Section 4: Vision Section */}
        <section className="min-h-screen py-24 md:py-0 md:h-screen w-full flex items-center snap-start bg-white dark:bg-luxury-cream transition-colors duration-700" id="about-us">
          <RevealContent className="max-w-container-max w-full mx-auto px-margin-mobile md:px-margin-desktop">
            <div className="max-w-4xl mx-auto text-center space-y-6 md:space-y-8">
              <h2 className="font-headline-xl dark:font-luxury-headline text-[32px] md:text-[56px] text-clinical-charcoal dark:text-luxury-navy leading-tight">Our Mission</h2>
              <p className="font-body-lg dark:font-luxury-body text-[18px] md:text-[28px] text-clinical-charcoal/70 dark:text-luxury-navy/80 leading-relaxed font-light dark:italic">
                "To bridge the gap between clinical care and daily life. We believe advanced heart health monitoring should be continuous, accurate, and instantly accessible to everyone."
              </p>
            </div>
          </RevealContent>
        </section>

        {/* Section 5: Team Section */}
        <section className="min-h-screen py-24 md:py-0 md:h-screen w-full flex flex-col justify-center snap-start bg-clinical-surface/50 dark:bg-[#F0F0E8] transition-colors duration-700 border-t border-clinical-charcoal/5 dark:border-luxury-navy/5">
          <RevealContent className="max-w-container-max w-full mx-auto px-margin-mobile md:px-margin-desktop">
            <div className="text-center mb-10 md:mb-16">
              <h2 className="font-headline-lg dark:font-luxury-headline text-2xl md:text-4xl text-clinical-charcoal dark:text-luxury-navy">The Artists</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-x-4 md:gap-x-8 gap-y-10 md:gap-y-12">
              {[
                { name: "Athaya Rashif", role: "Hardware Engineer", img: athayaImg, mobileClasses: "order-4 col-span-1 md:order-none md:col-span-1" },
                { name: "Rizqika Azkiya", role: "Medical Researcher", img: rizqikaImg, mobileClasses: "order-2 col-span-1 md:order-none md:col-span-1" },
                { name: "Muhammad Fikri", role: "Team Leader", img: fikriImg, mobileClasses: "order-1 col-span-2 md:order-none md:col-span-1" },
                { name: "Raffi Arditama", role: "Data Engineer", img: raffiImg, mobileClasses: "order-3 col-span-1 md:order-none md:col-span-1" },
                { name: "Rafa Azlan", role: "Software Developer", img: rafaImg, mobileClasses: "order-5 col-span-1 md:order-none md:col-span-1" }
              ].map((member, i) => (
                <div key={i} className={`flex flex-col items-center group cursor-default ${member.mobileClasses}`}>
                  <div className="w-24 h-24 md:w-36 md:h-36 rounded-full overflow-hidden mb-4 md:mb-6 shadow-md border-2 border-transparent dark:border-luxury-navy/10 group-hover:border-clinical-blue dark:group-hover:border-luxury-gold transition-all duration-700">
                    <img src={member.img} alt={member.name} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700" />
                  </div>
                  <h3 className="font-headline-md dark:font-luxury-headline text-base md:text-lg text-clinical-charcoal dark:text-luxury-navy mb-1 md:mb-2 text-center">{member.name}</h3>
                  <p className="text-[10px] md:text-xs font-label-md dark:font-luxury-button tracking-wider uppercase text-clinical-blue dark:text-luxury-gold font-bold text-center">{member.role}</p>
                </div>
              ))}
            </div>
          </RevealContent>
        </section>
      </main>

      <section className="snap-start flex flex-col justify-end bg-clinical-charcoal dark:bg-luxury-navy">
        <PublicFooter />
      </section>

      {showLogoutSuccess && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-clinical-charcoal/40 dark:bg-luxury-navy/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-luxury-cream rounded-2xl shadow-2xl border border-clinical-charcoal/10 dark:border-luxury-gold/30 w-full max-w-sm overflow-hidden animate-in zoom-in-95 fade-in duration-700">
            <div className="p-8 text-center">
              <div className="w-16 h-16 border border-clinical-blue/20 dark:border-luxury-gold/30 text-clinical-blue dark:text-luxury-gold rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="material-symbols-outlined text-[32px]">check</span>
              </div>
              <h2 className="text-2xl font-headline-md dark:font-luxury-headline text-clinical-charcoal dark:text-luxury-navy mb-3">Sesi Berakhir</h2>
              <p className="text-sm font-body-md dark:font-luxury-body text-clinical-charcoal/70 dark:text-luxury-navy/70 mb-8 leading-relaxed">
                Anda telah berhasil keluar dari sistem. Keamanan data Anda adalah prioritas kami.
              </p>
              <button
                onClick={() => setShowLogoutSuccess(false)}
                className="w-full py-3 rounded-full font-label-md dark:font-luxury-button tracking-widest text-xs uppercase font-bold text-white dark:text-luxury-navy bg-clinical-charcoal dark:bg-luxury-gold hover:opacity-90 transition-opacity outline-none"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
