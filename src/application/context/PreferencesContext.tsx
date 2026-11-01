import React, { createContext, useContext, useState, useEffect } from 'react';

interface PreferencesContextType {
  isLargeText: boolean;
  setIsLargeText: (val: boolean) => void;
  isHighContrast: boolean;
  setIsHighContrast: (val: boolean) => void;
  hideRecordingNotifications: boolean;
  setHideRecordingNotifications: (val: boolean) => void;
  language: string;
  setLanguage: (val: string) => void;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

const getInitialPreferences = () => {
  const saved = localStorage.getItem('app_preferences');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error("Failed to parse preferences");
    }
  }
  return { isLargeText: false, isHighContrast: false, hideRecordingNotifications: false, language: 'id' };
};

export const PreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialPrefs = getInitialPreferences();
  const [isLargeText, setIsLargeText] = useState(initialPrefs.isLargeText || false);
  const [isHighContrast, setIsHighContrast] = useState(initialPrefs.isHighContrast || false);
  const [hideRecordingNotifications, setHideRecordingNotifications] = useState(initialPrefs.hideRecordingNotifications || false);
  const [language, setLanguage] = useState(initialPrefs.language || 'id');

  // Save to localStorage and apply side effects whenever state changes
  useEffect(() => {
    localStorage.setItem('app_preferences', JSON.stringify({
      isLargeText, isHighContrast, hideRecordingNotifications, language
    }));

    // Ensure dark mode is off since it's removed
    document.documentElement.classList.remove('dark');

    if (isLargeText) {
      document.documentElement.classList.add('large-text');
    } else {
      document.documentElement.classList.remove('large-text');
    }

    if (isHighContrast) {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }
  }, [isLargeText, isHighContrast, hideRecordingNotifications, language]);

  return (
    <PreferencesContext.Provider value={{
      isLargeText, setIsLargeText,
      isHighContrast, setIsHighContrast,
      hideRecordingNotifications, setHideRecordingNotifications,
      language, setLanguage
    }}>
      {children}
    </PreferencesContext.Provider>
  );
};

export const usePreferences = () => {
  const context = useContext(PreferencesContext);
  if (context === undefined) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return context;
};
