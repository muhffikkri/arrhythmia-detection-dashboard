import { supabase, isSupabaseConfigured } from './supabaseClient';
import { API_URL } from './env';

/**
 * Returns true only if the header holds a usable bearer token.
 * Callers sometimes build `'Bearer ' + localStorage.getItem('auth_token')`,
 * which yields the literal string "Bearer null" when the key is missing.
 */
function hasUsableAuth(header: Headers): boolean {
    const raw = header.get('Authorization');
    if (!raw) return false;
    const token = raw.replace(/^Bearer\s+/i, '').trim();
    return token.length > 0 && token !== 'null' && token !== 'undefined';
}

/**
 * Custom fetch wrapper that automatically appends the Supabase JWT token
 * to the Authorization header for backend API requests.
 */
export async function fetchWithAuth(endpoint: string, options: RequestInit = {}): Promise<Response> {
    // Determine the full URL
    const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;

    // Get the current session from Supabase
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
        console.error('Error getting Supabase session:', error.message);
    }

    const headers = new Headers(options.headers || {});

    // Drop malformed caller-supplied values (e.g. "Bearer null") so they
    // cannot suppress the fallbacks below.
    if (headers.has('Authorization') && !hasUsableAuth(headers)) {
        headers.delete('Authorization');
    }

    // If we have a session, append the JWT token
    if (session?.access_token) {
        headers.set('Authorization', `Bearer ${session.access_token}`);
    } else if (!hasUsableAuth(headers)) {
        const fallbackToken = localStorage.getItem('auth_token');
        if (fallbackToken) {
            headers.set('Authorization', `Bearer ${fallbackToken}`);
        } else {
            console.warn(
                `[api] Tidak ada token untuk ${endpoint}. Permintaan kemungkinan besar akan 401. ` +
                (isSupabaseConfigured
                    ? 'Sesi Supabase kosong — pastikan user sudah login via Supabase.'
                    : 'Supabase belum dikonfigurasi (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY kosong di .env) ' +
                      'dan build perlu diulang agar env ter-inline.')
            );
        }
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

export const getPhotoUrl = (url: string | null | undefined) => {
    if (!url) return undefined;
    
    const baseUrl = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
    
    const normalizedUrl = url.replace(/\\/g, '/');
    
    if (normalizedUrl.includes('/uploads/')) {
        const parts = normalizedUrl.split('/uploads/');
        return `${baseUrl}/uploads/${parts[1]}`;
    }
    
    if (normalizedUrl.startsWith('http')) {
        return normalizedUrl;
    }
    
    return `${baseUrl}${normalizedUrl.startsWith('/') ? '' : '/'}${normalizedUrl}`;
};
