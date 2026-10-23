import { createServer } from 'node:http';
import { createApp } from './app.js';
import { BRAND } from '../shared/brand.js';

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';
const { handler } = createApp();

createServer(handler).listen(port, host, () => {
  console.log(`${BRAND.appName} çalışıyor: http://localhost:${port}`);
  if (!process.env.ANTHROPIC_API_KEY) console.log('Not: ANTHROPIC_API_KEY tanımlı değil, AI öğretmen devre dışı. Diğer özellikler çalışır.');
});
