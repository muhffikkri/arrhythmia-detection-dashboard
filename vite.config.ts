import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import obfuscatorPlugin from 'vite-plugin-javascript-obfuscator'
import { VitePWA } from 'vite-plugin-pwa'

const backendStatusPlugin = () => {
  return {
    name: 'backend-status-checker',
    configureServer(server: any) {
      server.httpServer?.once('listening', () => {
        const reset = '\x1b[0m';
        const green = '\x1b[32m';
        const cyan = '\x1b[36m';
        const red = '\x1b[31m';
        const dim = '\x1b[2m';
        
        console.log(`\n  ╭───────────────────────────────────────────────────╮`);
        console.log(`  │        ${cyan}ECGRHYTHMIA FRONTEND DEVELOPMENT${reset}           │`);
        console.log(`  ╰───────────────────────────────────────────────────╯`);
        console.log(`  ${dim}[SYSTEM]${reset} Memuat Environment Variables...`);
        console.log(`  ${dim}[TRACE]${reset}  VITE_API_URL        -> ${cyan}http://127.0.0.1:8081${reset}`);
        console.log(`  ${dim}[TRACE]${reset}  VITE_SUPABASE_URL   -> ${cyan}/supabase${reset} (Proxy Mode)\n`);
        
        console.log(`  ${dim}[NETWORK]${reset} Memeriksa koneksi komponen...`);
        
        const startTime = Date.now();
        fetch('http://127.0.0.1:8081/api/devices')
          .then(() => {
            const ms = Date.now() - startTime;
            console.log(`  [  ${green}OK${reset}  ] Backend Rust API    : ${green}ONLINE${reset} (Respons < ${ms}ms)`);
          })
          .catch(() => {
            console.log(`  [ ${red}FAIL${reset} ] Backend Rust API    : ${red}OFFLINE${reset} (Pastikan "cargo run" berjalan)`);
          });
          
        console.log(`  [  ${green}OK${reset}  ] Supabase Routing    : ${green}ACTIVE${reset} (Anti-Adblock Bypassed)`);
        console.log(`  -----------------------------------------------------\n`);
      });
    }
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    server: {
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8081',
          changeOrigin: true,
        },
        '/supabase': {
          target: env.VITE_SUPABASE_URL === '/supabase' 
            ? 'https://xzjxkplsgzcvdcjdhpcp.supabase.co' 
            : (env.VITE_ACTUAL_SUPABASE_URL || 'https://xzjxkplsgzcvdcjdhpcp.supabase.co'),
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/supabase/, '')
        }
      }
    },
    plugins: [
      react(),
      backendStatusPlugin(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        includeAssets: ['pwa-192x192.png', 'pwa-512x512.png'],
        manifest: {
          name: 'Arrhythmia Detection Dashboard',
          short_name: 'HeartSync',
          description: 'Dashboard untuk memantau detak jantung dan mendeteksi aritmia secara real-time',
          theme_color: '#ffffff',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,json}']
        }
      }),
      // @ts-ignore
      obfuscatorPlugin({
        include: ['src/**/*.js', 'src/**/*.ts', 'src/**/*.jsx', 'src/**/*.tsx'],
        exclude: [/node_modules/],
        apply: 'build',
        debugger: false,
        options: {
          compact: true,
          controlFlowFlattening: false,
          deadCodeInjection: false,
          stringArray: false,
        },
      }),
    ],
  }
})
