import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as tick } from 'node:timers/promises';
import { JSDOM, VirtualConsole } from 'jsdom';
import { mountApp } from '../src/app.js';

// Public regression fixtures are fictitious and contain no user data.
async function editor(t) {
  const errors = [], writes = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error));
  const dom = new JSDOM('<!doctype html><html lang="pt-BR"><body><main id="app"></main></body></html>', {
    url: 'https://timeline.example.test/', virtualConsole,
  });
  const original = {
    version: 1, title: 'Trabalho fictício salvo', description: 'Documento de teste.',
    categories: [],
    events: [{ id: 'encontro', title: 'Encontro imaginário', start: '2024-02-29', end: '2024-02-29', categoryId: null, notes: 'Preservar estas notas.' }],
  };
  const root = dom.window.document.querySelector('#app');
  const app = mountApp(root, {
    storage: {
      async read() { return { revision: 3, document: structuredClone(original) }; },
      async save(...args) { writes.push(args); throw new Error('An import must not save automatically.'); },
    },
    download() {},
    channel: { onmessage: null, postMessage() {}, close() {} },
  });
  t.after(() => { app.dispose(); dom.window.close(); assert.deepEqual(errors, [], 'encoding errors must be handled by the UI'); });
  await app.ready;
  const $ = id => root.querySelector(`#${id}`);
  $('project-title').value = 'Trabalho aplicado somente na memória';
  $('document-form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  const before = app.getDocument();
  assert.equal(before.title, 'Trabalho aplicado somente na memória');
  const importBytes = async bytes => {
    Object.defineProperty($('import-file'), 'files', {
      configurable: true,
      value: [{ size: bytes.byteLength, arrayBuffer: async () => bytes.slice().buffer }],
    });
    $('import-file').dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick();
  };
  const assertRejectedAndPreserved = () => {
    assert.deepEqual(app.getDocument(), before, 'invalid file bytes must preserve the complete current document');
    assert.equal(app.getRevision(), 3, 'invalid input must not change the persisted revision');
    assert.equal(writes.length, 0, 'invalid input must not write browser storage');
    assert.equal($('confirmation').hidden, true, 'invalid file bytes must not offer a confirmable import preview');
    assert.equal($('notice').hidden, false);
    assert.match($('notice').textContent, /Não foi possível importar/);
    assert.equal($('undo').disabled, false, 'the existing edit history must remain available');
    $('confirm-accept').click();
    assert.deepEqual(app.getDocument(), before, 'no stale confirmation may replace current work');
  };
  return { importBytes, assertRejectedAndPreserved };
}

test('a UTF-8 BOM before otherwise valid JSON is rejected without a confirmable preview or lost work', async t => {
  const ui = await editor(t);
  const candidate = { version: 1, title: 'Arquivo fictício com BOM', description: '', categories: [], events: [] };
  const json = new TextEncoder().encode(JSON.stringify(candidate));
  const bytes = new Uint8Array(json.length + 3);
  bytes.set([0xef, 0xbb, 0xbf]); bytes.set(json, 3);
  await ui.importBytes(bytes);
  ui.assertRejectedAndPreserved();
});

test('malformed UTF-8 in JSON text is rejected without a confirmable preview or lost work', async t => {
  const ui = await editor(t);
  // C3 28 is an invalid UTF-8 sequence. Replacement decoding would leave valid JSON.
  const prefix = new TextEncoder().encode('{"version":1,"title":"');
  const suffix = new TextEncoder().encode('","description":"","categories":[],"events":[]}');
  const bytes = new Uint8Array(prefix.length + 2 + suffix.length);
  bytes.set(prefix); bytes.set([0xc3, 0x28], prefix.length); bytes.set(suffix, prefix.length + 2);
  await ui.importBytes(bytes);
  ui.assertRejectedAndPreserved();
});
