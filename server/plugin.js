import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { createApi } from './app.js';

export function loadServerEnv() { if(existsSync('.env'))loadEnvFile('.env'); }
export function accountApiPlugin() {
  function attach(server) {
    loadServerEnv();
    // Vite's build watcher sets NODE_ENV=production even for local development.
    const api=createApi({env:{...process.env,NODE_ENV:'development'}});
    server.middlewares.use('/api',api.app);
    server.httpServer?.once('close',api.close);
  }
  return {name:'mongle-account-api',configureServer:attach,configurePreviewServer:attach};
}
