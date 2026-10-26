// La instalación depende de eventos reales del navegador; se prueban sus decisiones.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setupInstallation } from '../dist/js/pwa.js';

function screen({ standalone = false } = {}) {
  const events = new Map(), clicks = new Map();
  const displayMode = { matches: standalone, addEventListener() {} };
  const host = { navigator: {}, matchMedia: () => displayMode,
    addEventListener: (name, callback) => events.set(name, callback) };
  const button = { hidden: false, addEventListener: (name, callback) => clicks.set(name, callback) };
  const helpDialog = { open: false, showModal() { this.open = true; } };
  setupInstallation({ host, button, helpDialog });
  return { events, button, helpDialog, click: () => clicks.get('click')() };
}

test('sin aviso nativo se muestran instrucciones de instalación', async () => {
  const s = screen();
  await s.click();
  assert.equal(s.helpDialog.open, true);
  assert.equal(s.button.hidden, false);
});

test('el aviso nativo se ejecuta en respuesta al clic y se consume una sola vez', async () => {
  const s = screen();
  let prompts = 0, prevented = 0;
  s.events.get('beforeinstallprompt')({ preventDefault() { prevented++; },
    prompt: async () => { prompts++; }, userChoice: Promise.resolve({ outcome: 'accepted' }) });
  assert.equal(prompts, 0);
  await s.click();
  assert.equal(prevented, 1);
  assert.equal(prompts, 1);
  assert.equal(s.button.hidden, true);
  assert.equal(s.helpDialog.open, false);
});

test('cancelar el aviso permite continuar y ofrece la guía en el siguiente clic', async () => {
  const s = screen();
  s.events.get('beforeinstallprompt')({ preventDefault() {}, prompt: async () => {},
    userChoice: Promise.resolve({ outcome: 'dismissed' }) });
  await s.click();
  assert.equal(s.button.hidden, false);
  await s.click();
  assert.equal(s.helpDialog.open, true);
});

test('en ventana instalada se oculta la acción de instalación', () => {
  assert.equal(screen({ standalone: true }).button.hidden, true);
  const s = screen();
  s.events.get('appinstalled')();
  assert.equal(s.button.hidden, true);
});

test('si falla el aviso nativo la aplicación conserva una alternativa', async () => {
  const s = screen();
  s.events.get('beforeinstallprompt')({ preventDefault() {}, prompt: async () => { throw new Error('Aviso no disponible'); } });
  await s.click();
  assert.equal(s.helpDialog.open, true);
});
