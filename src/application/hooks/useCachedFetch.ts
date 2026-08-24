import useSWR, { type SWRConfiguration } from 'swr';
import { fetchWithAuth } from '../../config/api';

/**
 * Fetcher function that wraps our existing fetchWithAuth
 * to be compatible with SWR.
 */
const fetcher = async (url: string) => {
    const response = await fetchWithAuth(url);
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(errorData.message || 'An error occurred while fetching the data.');
        (error as any).status = response.status;
        throw error;
    }
    return response.json();
};

/**
 * Custom hook for data fetching using SWR and authenticated fetch.
 * 
 * @param url The API endpoint to fetch
 * @param config Optional SWR configuration
 * @returns SWR response containing data, error, isLoading, and mutate
 */
export function useCachedFetch<T = any>(url: string | null, config?: SWRConfiguration) {
    return useSWR<T>(url, fetcher, {
        revalidateOnFocus: true,     // Auto-refresh when tab is focused
        revalidateOnReconnect: true, // Auto-refresh when network recovers
        shouldRetryOnError: false,   // Don't bombard the server if it explicitly fails
        ...config
    });
}
