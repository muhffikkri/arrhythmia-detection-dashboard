import { useState, useEffect } from 'react';

export function useStickyState<T>(defaultValue: T, key: string): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [value, setValue] = useState<T>(() => {
        const stickyValue = window.sessionStorage.getItem(key);
        return stickyValue !== null ? JSON.parse(stickyValue) : defaultValue;
    });

    useEffect(() => {
        window.sessionStorage.setItem(key, JSON.stringify(value));
    }, [key, value]);

    return [value, setValue];
}
