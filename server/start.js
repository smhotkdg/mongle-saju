import express from 'express';
import { resolve } from 'node:path';
import { createApi } from './app.js';
import { loadServerEnv } from './plugin.js';

loadServerEnv();
const app=express(), api=createApi();
app.disable('x-powered-by');
app.use('/api',api.app);
app.use(express.static(resolve('dist'),{index:'index.html'}));
app.get('/{*path}',(_req,res)=>res.sendFile(resolve('dist/index.html')));
const port=Number(process.env.PORT||5173);
const server=app.listen(port,process.env.HOST||'127.0.0.1',()=>console.log(`몽글사주 웹/계정 서버: http://${process.env.HOST||'127.0.0.1'}:${port}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{api.close();process.exit(0);}));
