import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { API_URL } from '../../../config/env';
import { fetchWithAuth } from '../../../config/api';

export const PublicHeader: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const userId = localStorage.getItem('user_id');
  const userRole = localStorage.getItem('user_role');
  const [scrolled, setScrolled] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [initials, setInitials] = useState<string>('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (userId) {
      if (userRole === 'pasien') {
        fetchWithAuth(`/api/patients/${userId}`)
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data?.patient) {
              setProfilePhoto(data.patient.profile_photo || null);
              setInitials(`${(data.patient.first_name || '').charAt(0)}${(data.patient.last_name || '').charAt(0)}`.toUpperCase());
            }
          })
          .catch(console.error);
      } else if (userRole === 'dokter') {
        fetchWithAuth(`/api/doctors/${userId}`)
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data) {
              setProfilePhoto(data.profile_photo || null);
              setInitials(`${(data.first_name || '').charAt(0)}${(data.last_name || '').charAt(0)}`.toUpperCase());
            }
          })
          .catch(console.error);
      }
    }
  }, [userId, userRole]);

  useEffect(() => {
    const container = document.getElementById('main-scroll-container') || window;
    let lastScrollY = 0;

    const handleScroll = (e: any) => {
      const target = e.target === document ? window : e.target;
      const currentScrollY = target.scrollTop ?? window.scrollY;

      setScrolled(currentScrollY > 20);

      if (currentScrollY > lastScrollY && currentScrollY > 80) {
        setIsVisible(false); // scrolling down
      } else {
        setIsVisible(true); // scrolling up
      }
      lastScrollY = currentScrollY;
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [location.pathname]);

  const handleDashboardClick = () => {
    if (userRole === 'pasien') navigate('/patient/dashboard');
    else if (userRole === 'dokter') navigate('/doctor/dashboard');
    else if (userRole === 'admin') navigate('/admin/monitor');
    else navigate('/auth/login');
  };

  const navLinks = [
    { label: 'Home', path: '/' },
    { label: 'How It Works', path: '/how-it-works' },
    { label: 'FAQ', path: '/faq' },
  ];

  return (
    <nav className={`fixed top-0 w-full z-50 transition-all duration-700 ease-in-out ${isVisible ? 'translate-y-0' : '-translate-y-full'} ${scrolled ? 'bg-white/90 backdrop-blur-xl shadow-[0px_4px_30px_rgba(0,0,0,0.03)] py-4' : 'bg-white md:bg-transparent py-4 md:py-6'}`}>
      <div className="flex justify-between items-center px-margin-mobile md:px-margin-desktop w-full relative">
        <Link to="/" className="flex items-center gap-3 cursor-pointer group">
          <img alt="ecgrhythmia logo" className="h-9 w-auto group-hover:scale-105 transition-transform" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBVHX00UF6lwM6kjDUMgD4Jv6lMMp5h2u1ZBPFlnvJJNam11nmTsrGtn_y5NNHv61wLHc3plhgbJeduSWPWMT-xKDKHnnifesb9pERppu-cGEHZODeFvF8XLLfRKpP1GdLDV5iINEmqPsbVTFdQZhAPCXP6aHQm-ecIuBbV0YG8GByhRtVQ6xZQrpQpUmXqjqW6DWiEZHDW8D81u4xSnTtsE-7HlTKrn6GuXcYUOYjdpCvaEqIKW1ghrNjEt5sTxTf_o6esUGi3HzNB" />
          <div className="font-headline-md text-[24px] tracking-tight flex">
            <span className="text-clinical-red">ecg</span>
            <span className="text-clinical-charcoal">rhythmia</span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-2 absolute left-1/2 transform -translate-x-1/2">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                className={`
                  font-label-md tracking-wide px-5 py-2.5 rounded-full transition-all duration-500
                  ${isActive
                    ? 'bg-clinical-surface text-clinical-blue'
                    : 'text-clinical-charcoal/70 hover:text-clinical-blue hover:bg-clinical-surface/50'}
                `}
                to={link.path}
              >
                {link.label}
              </Link>
            )
          })}
        </div>

        <div className="flex items-center gap-3">
          {userId ? (
            <div
              onClick={handleDashboardClick}
              className="w-11 h-11 rounded-full border-2 border-clinical-blue/20 hover:border-clinical-blue overflow-hidden bg-clinical-surface flex items-center justify-center font-bold text-clinical-blue text-sm cursor-pointer transition-all shadow-sm hover:shadow-md shrink-0"
              title="Go to Dashboard"
            >
              {profilePhoto ? (
                <img className="w-full h-full object-cover" src={profilePhoto} alt="Profile" />
              ) : (
                <span>{initials || <span className="material-symbols-outlined text-[20px]">person</span>}</span>
              )}
            </div>
          ) : (
            <button
              onClick={() => navigate('/auth/login')}
              className="hidden md:flex px-8 py-3 rounded-full transition-all duration-500 items-center justify-center font-label-md uppercase tracking-widest text-[13px] font-bold bg-clinical-blue text-white hover:bg-blue-700 hover:shadow-lg hover:shadow-clinical-blue/30 border border-transparent"
            >
              Sign In
            </button>
          )}

          {/* Mobile Hamburger Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden w-11 h-11 flex items-center justify-center rounded-full bg-clinical-surface text-clinical-charcoal hover:bg-clinical-blue hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined">{isMobileMenuOpen ? 'close' : 'menu'}</span>
          </button>
        </div>
      </div>

      {/* Mobile Nav Drawer */}
      <div className={`md:hidden absolute top-full left-0 w-full bg-white border-t border-clinical-surface shadow-xl transition-all duration-300 overflow-hidden ${isMobileMenuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-6 py-4 flex flex-col gap-4">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              onClick={() => setIsMobileMenuOpen(false)}
              className="font-label-md text-[16px] text-clinical-charcoal py-2 border-b border-clinical-surface last:border-0"
            >
              {link.label}
            </Link>
          ))}
          {!userId && (
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                navigate('/auth/login');
              }}
              className="mt-2 w-full px-8 py-3 rounded-full font-label-md uppercase tracking-widest text-[13px] font-bold bg-clinical-blue text-white"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};
