// Tarayıcının ses özellikleri: metin okuma (TTS), konuşma tanıma (STT) ve ses kaydı.
import { settings } from './store.js';

export const ACCENTS = [
  { id: 'en-US', label: 'Amerikan' },
  { id: 'en-GB', label: 'İngiliz' },
  { id: 'en-AU', label: 'Avustralya' },
  { id: 'en-IN', label: 'Hint' },
];

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
let voices = [];
const loadVoices = () => { voices = synth ? synth.getVoices() : []; };
if (synth) { loadVoices(); synth.addEventListener?.('voiceschanged', loadVoices); }

export const ttsSupported = () => Boolean(synth && 'SpeechSynthesisUtterance' in window);

export function voiceFor(lang) {
  if (!voices.length) loadVoices();
  const norm = (l) => (l || '').replace('_', '-').toLowerCase();
  const exact = voices.filter((v) => norm(v.lang) === lang.toLowerCase());
  return exact.find((v) => /google|natural|premium|enhanced/i.test(v.name)) || exact[0] || voices.find((v) => norm(v.lang).startsWith('en')) || null;
}

// Hangi aksanlar için gerçekten bir ses var?
export function accentAvailability() {
  if (!voices.length) loadVoices();
  return ACCENTS.map((a) => ({ ...a, available: voices.some((v) => (v.lang || '').replace('_', '-').toLowerCase() === a.id.toLowerCase()) }));
}

export function speak(text, { slow = false, accent, rate } = {}) {
  return new Promise((resolve) => {
    if (!ttsSupported()) return resolve(false);
    synth.cancel();
    const s = settings();
    const u = new SpeechSynthesisUtterance(text);
    const lang = accent || s.accent || 'en-US';
    u.lang = lang;
    const v = voiceFor(lang);
    if (v) u.voice = v;
    u.rate = (rate || s.rate || 0.9) * (slow ? 0.65 : 1);
    u.onend = () => resolve(true);
    u.onerror = () => resolve(false);
    synth.speak(u);
    // Bazı tarayıcılar onend olayını göndermez.
    setTimeout(() => resolve(true), Math.max(3000, text.length * 120));
  });
}

export const stopSpeaking = () => synth?.cancel();

const Recognition = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
export const sttSupported = () => Boolean(Recognition);

// Tek bir konuşma örneğini metne çevirir.
export function listen({ lang } = {}) {
  return new Promise((resolve, reject) => {
    if (!Recognition) return reject(new Error('Bu tarayıcı konuşma tanımayı desteklemiyor.'));
    const r = new Recognition();
    r.lang = lang || settings().accent || 'en-US';
    r.interimResults = false;
    r.maxAlternatives = 3;
    let settled = false;
    r.onresult = (e) => {
      settled = true;
      const alts = [...e.results[0]].map((a) => ({ transcript: a.transcript, confidence: a.confidence }));
      resolve(alts);
    };
    r.onerror = (e) => {
      settled = true;
      const msg = { 'not-allowed': 'Mikrofon izni verilmedi.', 'no-speech': 'Ses algılanamadı. Tekrar dene.', network: 'Konuşma tanıma servisine ulaşılamadı.', 'audio-capture': 'Mikrofon bulunamadı.' }[e.error] || 'Konuşma tanıma başarısız oldu.';
      reject(new Error(msg));
    };
    r.onend = () => { if (!settled) reject(new Error('Ses algılanamadı. Tekrar dene.')); };
    r.start();
  });
}

export const recorderSupported = () => Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);

// Kullanıcının kendi sesini kaydedip dinleyebilmesi için.
export async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const rec = new MediaRecorder(stream);
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.start();
  return {
    stop: () => new Promise((resolve) => {
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        resolve(URL.createObjectURL(new Blob(chunks, { type: rec.mimeType || 'audio/webm' })));
      };
      rec.stop();
    }),
  };
}
