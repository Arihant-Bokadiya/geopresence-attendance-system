import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check for local development TLS certificates
function getHttpsConfig() {
  const possibleCertPaths = [
    path.resolve(__dirname, '../certs/dev-cert.pem'),
    path.resolve(process.cwd(), 'certs/dev-cert.pem'),
    path.resolve(process.cwd(), '../certs/dev-cert.pem')
  ];
  const possibleKeyPaths = [
    path.resolve(__dirname, '../certs/dev-key.pem'),
    path.resolve(process.cwd(), 'certs/dev-key.pem'),
    path.resolve(process.cwd(), '../certs/dev-key.pem')
  ];

  const certPath = possibleCertPaths.find(p => fs.existsSync(p));
  const keyPath = possibleKeyPaths.find(p => fs.existsSync(p));

  if (certPath && keyPath) {
    return {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    };
  }
  return undefined;
}

const httpsConfig = getHttpsConfig();
const backendTarget = process.env.VITE_BACKEND_URL || 'http://127.0.0.1:4050';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5180,
    strictPort: true,
    https: httpsConfig,
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
        xfwd: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            // Forward HTTPS protocol indicator so Express knows request was TLS-secured
            const isEncrypted = Boolean((req.socket as any)?.encrypted) || Boolean(httpsConfig);
            proxyReq.setHeader('x-forwarded-proto', isEncrypted ? 'https' : 'http');
          });
        }
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 5180,
    strictPort: true,
    https: httpsConfig,
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
        xfwd: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const isEncrypted = Boolean((req.socket as any)?.encrypted) || Boolean(httpsConfig);
            proxyReq.setHeader('x-forwarded-proto', isEncrypted ? 'https' : 'http');
          });
        }
      },
    },
  }
});
