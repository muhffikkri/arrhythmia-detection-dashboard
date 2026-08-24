import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EcgViewer } from '../presentation/components/dashboard/EcgViewer';

// Mock translation hook
vi.mock('../application/hooks/useTranslation', () => ({
    useTranslation: () => ({
        t: (key: string) => {
            const keys: Record<string, string> = {
                'history.play': 'Play',
                'history.pause': 'Pause',
                'history.replay': 'Replay',
                'history.recordingTime': 'Recording Time'
            };
            return keys[key] || key;
        }
    })
}));

// Mock preferences hook
vi.mock('../application/context/PreferencesContext', () => ({
    usePreferences: () => ({
        language: 'id',
        setLanguage: vi.fn(),
        isLargeText: false,
        setIsLargeText: vi.fn(),
        isHighContrast: false,
        setIsHighContrast: vi.fn()
    })
}));

describe('EcgViewer Component Integration', () => {
    const mockSegment = {
        payload: {
            ecg: {
                samples: Array.from({ length: 2500 }, (_, i) => [Math.sin(i * 0.1), Math.cos(i * 0.1), 0])
            }
        },
        rPeaks: [],
        isAnomaly: false,
        heartRate: 72
    };

    it('should render SVG canvas and all medical configuration selectors', () => {
        render(
            <EcgViewer segment={mockSegment} />
        );

        // Check if canvas container is present
        expect(document.getElementById('ecg-scroll-container')).toBeInTheDocument();

        // Check for medical configuration selectors
        expect(screen.getByText('Gain')).toBeInTheDocument();
        expect(screen.getByText('Speed')).toBeInTheDocument();

        // Check Gain buttons
        expect(screen.getByRole('button', { name: '5' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '10' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '20' })).toBeInTheDocument();

        // Check Speed buttons
        expect(screen.getByRole('button', { name: '12.5' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '25' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '50' })).toBeInTheDocument();
    });

    it('should toggle play and pause states on click', () => {
        render(
            <EcgViewer segment={mockSegment} />
        );

        const playButton = screen.getByTitle('Play');
        expect(playButton).toBeInTheDocument();

        // Click play
        fireEvent.click(playButton);
        expect(screen.getByTitle('Pause')).toBeInTheDocument();

        // Click pause
        const pauseButton = screen.getByTitle('Pause');
        fireEvent.click(pauseButton);
        expect(screen.getByTitle('Play')).toBeInTheDocument();
    });

    it('should update gain and paper speed configuration state on click', () => {
        render(
            <EcgViewer segment={mockSegment} />
        );

        const gain5Button = screen.getByRole('button', { name: '5' });
        const gain20Button = screen.getByRole('button', { name: '20' });

        // Default 10 should be selected (has white background text-clinical-blue class)
        const gain10Button = screen.getByRole('button', { name: '10' });
        expect(gain10Button.className).toContain('bg-white text-clinical-blue');

        // Click Gain 20
        fireEvent.click(gain20Button);
        expect(gain20Button.className).toContain('bg-white text-clinical-blue');
        expect(gain10Button.className).not.toContain('bg-white text-clinical-blue');
    });
});
