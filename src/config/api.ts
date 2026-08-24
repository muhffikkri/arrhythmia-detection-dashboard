import { supabase } from './supabaseClient';
import { API_URL } from './env';

/**
 * Custom fetch wrapper that automatically appends the Supabase JWT token
 * to the Authorization header for backend API requests.
 */
export async function fetchWithAuth(endpoint: string, options: RequestInit = {}): Promise<Response> {
    // Determine the full URL
    const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;
    
    // Get the current session from Supabase
    let token: string | undefined = undefined;
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
            console.error('Error getting Supabase session:', error.message);
        }
        token = session?.access_token || undefined;
    } catch (e) {
        console.warn('Failed to retrieve Supabase session, using localStorage fallback');
    }

    if (!token) {
        token = localStorage.getItem('auth_token') || undefined;
    }

    const headers = new Headers(options.headers || {});
    
    // If we have a session or local token, append the JWT token
    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }

    // Default to application/json if not set and body exists
    if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
        headers.set('Content-Type', 'application/json');
    }

    const newOptions: RequestInit = {
        ...options,
        headers,
    };

    return fetch(url, newOptions);
}
