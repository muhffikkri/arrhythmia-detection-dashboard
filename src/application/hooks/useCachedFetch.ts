import useSWR, { type SWRConfiguration } from 'swr';
import { fetchWithAuth } from '../../config/api';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes default TTL

interface CacheEntry<T> {
    data: T;
    expiresAt: number;
}

/**
 * Read from localStorage cache.
 */
function readCache<T>(key: string): T | null {
    try {
        const raw = localStorage.getItem(`swr_cache:${key}`);
        if (!raw) return null;
        const entry: CacheEntry<T> = JSON.parse(raw);
        if (Date.now() > entry.expiresAt) {
            localStorage.removeItem(`swr_cache:${key}`);
            return null;
        }
        return entry.data;
    } catch {
        return null;
    }
}

/**
 * Write to localStorage cache with TTL.
 */
function writeCache<T>(key: string, data: T, ttlMs = CACHE_TTL_MS): void {
    try {
        const entry: CacheEntry<T> = { data, expiresAt: Date.now() + ttlMs };
        localStorage.setItem(`swr_cache:${key}`, JSON.stringify(entry));
    } catch {
        // quota exceeded or unavailable — silently ignore
    }
}

/**
 * Remove all expired cache entries from localStorage.
 */
export function clearExpiredCache(): void {
    try {
        const prefix = 'swr_cache:';
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith(prefix)) {
                try {
                    const entry = JSON.parse(localStorage.getItem(k) || '{}');
                    if (entry.expiresAt && Date.now() > entry.expiresAt) {
                        keysToRemove.push(k);
                    }
                } catch {
                    keysToRemove.push(k!);
                }
            }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch {
        // ignore
    }
}

// Schedule cache cleanup every 10 minutes
setInterval(clearExpiredCache, 10 * 60 * 1000);

/**
 * Fetcher function that wraps fetchWithAuth for SWR,
 * with read-through localStorage caching.
 */
const fetcher = async (url: string) => {
    const response = await fetchWithAuth(url);
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(errorData.message || 'An error occurred while fetching the data.');
        (error as any).status = response.status;
        throw error;
    }
    const data = await response.json();
    writeCache(url, data);
    return data;
};

/**
 * Custom hook for data fetching using SWR and authenticated fetch.
 * Uses localStorage as a persistent fallback cache to reduce API calls.
 *
 * @param url The API endpoint to fetch (null to skip)
 * @param config Optional SWR configuration
 * @returns SWR response containing data, error, isLoading, and mutate
 */
export function useCachedFetch<T = any>(url: string | null, config?: SWRConfiguration) {
    const fallbackData = url ? readCache<T>(url) ?? undefined : undefined;

    return useSWR<T>(url, fetcher, {
        fallbackData,
        revalidateOnFocus: false,      // Don't re-fetch when switching tabs
        revalidateOnReconnect: true,   // Re-fetch when network recovers
        shouldRetryOnError: false,     // Don't hammer server on errors
        dedupingInterval: 60_000,      // Deduplicate requests within 1 minute
        ...config,
    });
}
