import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { accountApiPlugin } from './server/plugin.js';
export default defineConfig({ plugins: [react(), tailwindcss(), accountApiPlugin()], server: { strictPort: true, port: 5173, fs:{deny:['.env','.env.*','*.{crt,pem}','**/.git/**','**/*.sqlite','**/*.sqlite-*','**/data/**']} }, preview:{host:'127.0.0.1',port:5173,strictPort:true} });
