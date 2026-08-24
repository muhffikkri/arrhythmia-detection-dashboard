import React from 'react';

export const SplashPage: React.FC = () => {
  return (
    <div className="bg-surface min-h-screen flex items-center justify-center overflow-hidden m-0 p-0 w-full">

    <main className="w-full h-screen flex flex-col items-center justify-center animate-page-exit px-6" id="splash-container">
        <div className="mb-8">
            <img alt="ecgrhythmia logo" className="w-[200px] h-auto object-contain" src="https://lh3.googleusercontent.com/aida-public/AB6AXuB0sg3lCBGmrx069zGM8qjxFBlfGPhf0aIEm4Eyt4n4wTQsCF7W1VQxMLaJuVIJfkvdGXkA1C4D2BGkVzs4Hi8DG6O2BcAU8wq8KxTukpkQHabx1UjNq7WAt_OhYRxczzj36K_xC3bIQ3JRkZYA_x8tAhwQSg7t6X9Tpn42QoTafMgo2iG_NZbCW8B5jTRy0eEolLDM49mTTygZYI0NCzE6hskSJ5098if5A_wV8GmdsDVqfgPAlVn9XiRIX3nASBT-Dbk5k9FxwHpU" />
        </div>
        <div className="flex flex-col items-center text-center">
            <h1 className="font-nunito text-4xl md:text-5xl font-bold tracking-tight lowercase">
                <span className="text-vibrant-red">ecg</span><span className="text-dark-navy">rhythmia</span>
            </h1>
            <p className="font-inter text-sm md:text-base text-deep-charcoal mt-4 font-medium">
                Wearable 3-Lead ECG Berbasis Edge AI
            </p>
        </div>
        <div className="mt-8 flex flex-col items-center">
            <div className="w-8 h-8 border-4 border-dark-navy border-t-transparent rounded-full animate-spin"></div>
        </div>
    </main>
    

    </div>
  );
};
