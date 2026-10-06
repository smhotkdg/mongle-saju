// A portable development server: rebuild on change, then refresh the browser.
// This also runs in Windows sandboxes that restrict native dependency prebundling.
import { build, preview } from 'vite';
import config from '../vite.config.js';
import { accountApiPlugin } from '../server/plugin.js';
const clients = new Set();
let server, revision = 0, stopping = false;
const reloadPlugin = {
  name: 'mongle-dev-reload',
  transformIndexHtml() {
    return [{ tag: 'script', injectTo: 'body', children: `(() => { let seen; const s = new EventSource('/__mongle_reload'); s.onmessage = e => { if (seen !== undefined && seen !== e.data) location.reload(); seen = e.data; }; })();` }];
  },
  configurePreviewServer(s) {
    s.middlewares.use('/__mongle_reload', (req,res) => {
      res.writeHead(200, {'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});
      res.write(`data: ${revision}\n\n`); clients.add(res);
      req.on('close',()=>clients.delete(res));
    });
  }
};
const watcher = await build({...config,configFile:false,plugins:[...config.plugins,reloadPlugin],build:{outDir:'.dev',watch:{}}});
watcher.on('event', async event => {
  if (event.code==='ERROR') console.error(event.error.message);
  if (event.code!=='END' || stopping) return;
  revision++;
  if (!server) {
    try {
      server = await preview({configFile:false,plugins:[reloadPlugin,accountApiPlugin()],build:{outDir:'.dev'},preview:{host:'127.0.0.1',port:5173,strictPort:true}});
      console.log('\n몽글사주 개발 미리보기 · 파일 저장 시 자동 새로고침');
      server.printUrls();
    } catch(error) { console.error(error.message); await stop(1); }
  } else for (const client of clients) client.write(`data: ${revision}\n\n`);
});
async function stop(code=0) { if(stopping)return;stopping=true;for(const client of clients)client.end();await watcher.close();server?.httpServer.close();process.exit(code); }
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
