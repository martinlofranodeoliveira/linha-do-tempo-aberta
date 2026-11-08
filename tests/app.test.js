import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as tick } from 'node:timers/promises';
import { JSDOM, VirtualConsole } from 'jsdom';
import { mountApp } from '../src/app.js';

// These are public behavioral tests. All documents below are fictitious fixtures.
const clone = value => structuredClone(value);
function fixture() {
  return {
    version: 1, title: 'História de um jardim fictício', description: 'Um projeto inventado para os testes.',
    categories: [
      { id: 'arte', label: 'Criação', color: '#2563eb' },
      { id: 'terra', label: 'Horta', color: '#0f766e' },
    ],
    events: [
      { id: 'planejar', title: 'Planejar o jardim', start: '2024-02-28', end: '2024-03-02', categoryId: 'terra', notes: 'Uma reunião sobre sementes.' },
      { id: 'pintar', title: 'Pintar os vasos', start: '2024-03-01', end: '2024-03-01', categoryId: 'arte', notes: 'Usar a cor açafrão.' },
      { id: 'abrir', title: 'Abrir o jardim', start: '2024-04-01', end: '2024-04-01', categoryId: null, notes: '' },
    ],
  };
}

async function setup(t, { document = null, revision = 1, storage, download, channel } = {}) {
  const errors = [];
  const console = new VirtualConsole();
  console.on('jsdomError', error => errors.push(error));
  const dom = new JSDOM('<!doctype html><html lang="pt-BR"><body><div id="app"></div></body></html>', {
    url: 'https://timeline.example.test/', virtualConsole: console,
  });
  const writes = [], downloads = [];
  const persistence = storage ?? {
    async read() { return document ? { revision, document: clone(document) } : null; },
    async save(expectedRevision, value) {
      writes.push({ expectedRevision, document: clone(value) });
      return { revision: expectedRevision + 1, document: clone(value) };
    },
  };
  const broadcast = channel ?? { onmessage: null, postMessage() {}, close() {} };
  const root = dom.window.document.querySelector('#app');
  const app = mountApp(root, {
    storage: persistence,
    download: download ?? ((name, text, type) => downloads.push({ name, text, type })),
    channel: broadcast,
  });
  t.after(() => { app.dispose(); dom.window.close(); assert.deepEqual(errors, [], 'the UI must not emit uncaught browser errors'); });
  await app.ready;
  const $ = id => root.querySelector(`#${id}`);
  const click = id => $(id).click();
  const set = (id, value, event = 'input') => {
    $(id).value = value;
    $(id).dispatchEvent(new dom.window.Event(event, { bubbles: true }));
  };
  const submit = id => $(id).dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  const listTitles = () => [...root.querySelectorAll('#event-list strong')].map(node => node.textContent);
  const choose = title => {
    const row = [...root.querySelectorAll('#event-list button')].find(node => node.querySelector('strong')?.textContent === title);
    assert.ok(row, `event ${title} is in the visible list`); row.click();
  };
  const importText = async raw => {
    const bytes = new TextEncoder().encode(raw);
    Object.defineProperty($('import-file'), 'files', { configurable: true, value: [{ size: bytes.length, arrayBuffer: async () => bytes.buffer }] });
    $('import-file').dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await tick();
  };
  return { app, root, win: dom.window, $, click, set, submit, choose, importText, listTitles, writes, downloads, channel: broadcast };
}

test('the empty editor starts in memory and exposes labelled inputs without saving', async t => {
  const ui = await setup(t);
  assert.deepEqual(ui.app.getDocument().events, []);
  assert.equal(ui.app.getRevision(), 0);
  assert.equal(ui.$('empty').hidden, false);
  assert.equal(ui.$('event-form').hidden, true);
  assert.equal(ui.$('undo').disabled, true);
  assert.equal(ui.writes.length, 0);
  for (const id of ['query', 'from', 'to', 'event-title', 'event-start', 'event-end', 'event-category', 'category-label']) {
    assert.ok(ui.root.querySelector(`label[for="${id}"]`), `${id} has a visible label`);
  }
  ui.click('example');
  assert.ok(ui.app.getDocument().events.length > 0);
  assert.match(ui.$('notice').textContent, /fictício/i);
  assert.equal(ui.writes.length, 0);
});

test('events support valid points and inclusive periods, chronological order and invalid draft recovery', async t => {
  const ui = await setup(t);
  ui.click('add-event');
  ui.set('event-title', 'Período fictício');
  ui.set('event-start', '2024-02-28', 'change');
  ui.$('is-period').checked = true;
  ui.$('is-period').dispatchEvent(new ui.win.Event('change'));
  ui.set('event-end', '2024-02-27', 'change');
  ui.set('event-notes', 'A nota deve sobreviver à validação.');
  ui.submit('event-form');
  assert.equal(ui.app.getDocument().events.length, 0);
  assert.equal(ui.$('event-error').hidden, false);
  assert.equal(ui.$('event-notes').value, 'A nota deve sobreviver à validação.');
  ui.set('event-end', '2024-03-01', 'change');
  assert.match(ui.$('duration').textContent, /3 dia/);
  ui.submit('event-form');
  const period = ui.app.getDocument().events[0];
  assert.equal(period.start, '2024-02-28');
  assert.equal(period.end, '2024-03-01');
  ui.click('add-event'); ui.set('event-title', 'Antes de tudo'); ui.set('event-start', '2024-01-01', 'change'); ui.submit('event-form');
  assert.deepEqual(ui.listTitles(), ['Antes de tudo', 'Período fictício']);
  const point = ui.app.getDocument().events[0];
  assert.equal(point.start, point.end);
  assert.equal(ui.root.querySelectorAll('#timeline circle').length, 1);
  assert.equal(ui.writes.length, 0);
});

test('select, edit, cancel and confirmed deletion preserve history', async t => {
  const ui = await setup(t, { document: fixture() });
  ui.choose('Pintar os vasos');
  assert.equal(ui.$('event-title').disabled, true);
  assert.equal(ui.root.querySelector('[aria-pressed="true"] strong').textContent, 'Pintar os vasos');
  ui.click('event-edit'); ui.set('event-title', 'Rascunho'); ui.click('event-cancel');
  assert.equal(ui.$('event-title').value, 'Pintar os vasos');
  ui.click('event-edit'); ui.set('event-title', 'Pintar vasos azuis'); ui.submit('event-form');
  assert.equal(ui.app.getDocument().events.find(e => e.id === 'pintar').title, 'Pintar vasos azuis');
  ui.click('event-delete'); ui.click('confirm-cancel');
  assert.equal(ui.app.getDocument().events.length, 3);
  ui.click('event-delete'); ui.click('confirm-accept');
  assert.equal(ui.app.getDocument().events.length, 2);
  ui.click('undo');
  assert.equal(ui.app.getDocument().events.find(e => e.id === 'pintar').title, 'Pintar vasos azuis');
  ui.click('undo');
  assert.equal(ui.app.getDocument().events.find(e => e.id === 'pintar').title, 'Pintar os vasos');
  ui.click('redo');
  assert.equal(ui.app.getDocument().events.find(e => e.id === 'pintar').title, 'Pintar vasos azuis');
});

test('category CRUD keeps referenced events, requires confirmation and can be undone', async t => {
  const ui = await setup(t, { document: fixture() });
  ui.set('category-label', 'Aprendizado'); ui.set('category-color', '#7e22ce', 'change'); ui.submit('category-form');
  const category = ui.app.getDocument().categories.find(c => c.label === 'Aprendizado');
  assert.equal(category.color, '#7e22ce');
  ui.choose('Abrir o jardim'); ui.click('event-edit'); ui.set('event-category', category.id, 'change'); ui.submit('event-form');
  [...ui.$('categories').querySelectorAll('button')].find(b => b.textContent === 'Editar Aprendizado').click();
  ui.set('category-label', 'Oficinas'); ui.submit('category-form');
  assert.equal(ui.app.getDocument().events.find(e => e.id === 'abrir').categoryId, category.id);
  [...ui.$('categories').querySelectorAll('button')].find(b => b.textContent === 'Excluir Oficinas').click();
  ui.click('confirm-cancel');
  assert.ok(ui.app.getDocument().categories.some(c => c.id === category.id));
  [...ui.$('categories').querySelectorAll('button')].find(b => b.textContent === 'Excluir Oficinas').click();
  ui.click('confirm-accept');
  assert.equal(ui.app.getDocument().events.length, 3);
  assert.equal(ui.app.getDocument().events.find(e => e.id === 'abrir').categoryId, null);
  ui.click('undo');
  assert.equal(ui.app.getDocument().events.find(e => e.id === 'abrir').categoryId, category.id);
  assert.equal(ui.app.getDocument().categories.find(c => c.id === category.id).label, 'Oficinas');
});

test('query, category and inclusive date filters combine without changing the document', async t => {
  const value = fixture(); const ui = await setup(t, { document: value });
  ui.set('query', 'ACAFRAO');
  assert.deepEqual(ui.listTitles(), ['Pintar os vasos']);
  ui.set('query', 'criacao');
  assert.deepEqual(ui.listTitles(), ['Pintar os vasos']);
  ui.click('clear-filters'); ui.set('filter-category', 'terra', 'change'); ui.set('from', '2024-03-02', 'change'); ui.set('to', '2024-03-02', 'change');
  assert.deepEqual(ui.listTitles(), ['Planejar o jardim']);
  ui.set('from', '2024-03-03', 'change');
  assert.equal(ui.$('filter-error').hidden, false);
  ui.click('clear-filters');
  assert.deepEqual(ui.listTitles(), value.events.map(e => e.title));
  assert.deepEqual(ui.app.getDocument(), value);
});

test('JSON is a full current backup while CSV and SVG respect current filters', async t => {
  const ui = await setup(t, { document: fixture() });
  ui.set('project-title', 'Jardim atual'); ui.submit('document-form'); ui.set('query', 'vasos');
  ui.click('json'); ui.click('csv'); ui.click('svg');
  const [json, csv, svg] = ui.downloads;
  assert.equal(json.name, 'jardim-atual.json');
  assert.match(json.type, /application\/json/);
  assert.deepEqual(JSON.parse(json.text), ui.app.getDocument());
  assert.equal(JSON.parse(json.text).events.length, 3);
  assert.ok(json.text.endsWith('\n'));
  assert.match(csv.type, /text\/csv/);
  assert.ok(csv.text.startsWith('id,titulo,inicio,fim,dias,categoria,notas\r\n'));
  assert.match(csv.text, /Pintar os vasos/); assert.doesNotMatch(csv.text, /Planejar o jardim|Abrir o jardim/);
  assert.match(svg.type, /image\/svg\+xml/);
  const xml = new ui.win.DOMParser().parseFromString(svg.text, 'image/svg+xml');
  assert.equal(xml.querySelector('parsererror'), null);
  assert.match(xml.documentElement.textContent, /Pintar os vasos/);
  assert.doesNotMatch(xml.documentElement.textContent, /Planejar o jardim|Abrir o jardim/);
});

test('twenty undo states are available, redo is invalidated by an edit, and saving preserves history', async t => {
  const ui = await setup(t);
  for (let i = 1; i <= 22; i++) { ui.set('project-title', `Título ${i}`); ui.submit('document-form'); }
  ui.click('save'); await tick();
  assert.equal(ui.writes.length, 1); assert.equal(ui.app.getRevision(), 1);
  for (let i = 0; i < 20; i++) ui.click('undo');
  assert.equal(ui.app.getDocument().title, 'Título 2');
  assert.equal(ui.$('undo').disabled, true);
  ui.click('redo'); assert.equal(ui.app.getDocument().title, 'Título 3');
  ui.set('project-title', 'Outro caminho'); ui.submit('document-form');
  assert.equal(ui.$('redo').disabled, true);
});

test('discarding an unapplied event draft requires a cancellable keyboard-accessible dialog', async t => {
  const ui = await setup(t, { document: fixture() });
  ui.choose('Pintar os vasos'); ui.click('event-edit'); ui.set('event-title', 'Ainda não aplicado');
  ui.click('add-event');
  assert.equal(ui.$('confirmation').hidden, false);
  assert.equal(ui.root.querySelector('[role="dialog"]').getAttribute('aria-modal'), 'true');
  ui.$('confirmation').dispatchEvent(new ui.win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  assert.equal(ui.$('confirmation').hidden, true);
  assert.equal(ui.$('event-title').value, 'Ainda não aplicado');
  ui.click('add-event'); ui.click('confirm-accept');
  assert.equal(ui.$('event-title').value, '');
  assert.equal(ui.app.getDocument().events.find(e => e.id === 'pintar').title, 'Pintar os vasos');
});

test('applying document or category metadata cannot silently discard an event draft', async t => {
  for (const form of ['document-form', 'category-form']) {
    await t.test(form, async t => {
      const ui = await setup(t, { document: fixture() });
      ui.choose('Pintar os vasos'); ui.click('event-edit');
      ui.set('event-title', 'Meu rascunho ainda não aplicado'); ui.set('event-notes', 'Anotações que preciso conservar.');
      if (form === 'document-form') ui.set('project-title', 'Nome atualizado');
      else ui.set('category-label', 'Nova categoria');
      ui.submit(form);
      // Both preserving the draft and asking before discarding it are valid UX.
      if (!ui.$('confirmation').hidden) ui.click('confirm-cancel');
      assert.equal(ui.$('event-title').value, 'Meu rascunho ainda não aplicado');
      assert.equal(ui.$('event-notes').value, 'Anotações que preciso conservar.');
      assert.equal(ui.$('event-title').disabled, false);
      assert.equal(ui.app.getDocument().events.find(e => e.id === 'pintar').title, 'Pintar os vasos');
    });
  }
});

test('backing up during an unapplied draft explains what the backup contains and retains the draft', async t => {
  const ui = await setup(t, { document: fixture() });
  ui.choose('Pintar os vasos'); ui.click('event-edit'); ui.set('event-title', 'Título ainda não aplicado');
  ui.click('json');
  assert.equal(JSON.parse(ui.downloads[0].text).events.find(e => e.id === 'pintar').title, 'Pintar os vasos');
  assert.match(ui.$('notice').textContent, /rascunho|edição.*aplicad|campos.*aplicad/i);
  assert.equal(ui.$('event-title').value, 'Título ainda não aplicado');
  assert.equal(ui.$('event-title').disabled, false);
});

test('import previews do not mutate work; cancel, invalid JSON and oversized input preserve it', async t => {
  const ui = await setup(t, { document: fixture() });
  ui.set('project-title', 'Trabalho na memória'); ui.submit('document-form');
  const before = ui.app.getDocument(); const imported = { ...fixture(), title: 'Outro documento fictício', events: [] };
  await ui.importText(JSON.stringify(imported));
  assert.equal(ui.$('confirmation').hidden, false);
  assert.match(ui.$('confirm-message').textContent, /Outro documento fictício/);
  assert.deepEqual(ui.app.getDocument(), before);
  ui.click('confirm-cancel'); assert.deepEqual(ui.app.getDocument(), before);
  await ui.importText('{"version":1');
  assert.match(ui.$('notice').textContent, /Não foi possível importar/);
  assert.deepEqual(ui.app.getDocument(), before);
  Object.defineProperty(ui.$('import-file'), 'files', { configurable: true, value: [{ size: 1048577, arrayBuffer: async () => { assert.fail('an oversized file must be rejected before reading'); } }] });
  ui.$('import-file').dispatchEvent(new ui.win.Event('change')); await tick();
  assert.deepEqual(ui.app.getDocument(), before);
  assert.equal(ui.writes.length, 0);
});

test('confirmed import changes only memory and can be undone', async t => {
  const initial = fixture(); const ui = await setup(t, { document: initial, revision: 4 });
  const candidate = { ...fixture(), title: 'Arquivo de teste', events: [] };
  await ui.importText(JSON.stringify(candidate)); ui.click('confirm-accept');
  assert.deepEqual(ui.app.getDocument(), candidate);
  assert.equal(ui.app.getRevision(), 4);
  assert.equal(ui.writes.length, 0);
  ui.click('undo'); assert.deepEqual(ui.app.getDocument(), initial);
});

test('a delayed earlier file read cannot replace the preview or error of the newest selection', async t => {
  for (const newestIsValid of [true, false]) {
    await t.test(newestIsValid ? 'newest valid file owns its preview' : 'newest invalid file leaves no stale preview', async t => {
      const ui = await setup(t, { document: fixture() }); const before = ui.app.getDocument();
      const older = { ...fixture(), title: 'Arquivo antigo ainda em leitura' };
      const newer = { ...fixture(), title: 'Arquivo escolhido por último', events: [] };
      const bytes = new TextEncoder().encode(JSON.stringify(older)); let finishOlder;
      const pendingRead = new Promise(resolve => { finishOlder = resolve; });
      Object.defineProperty(ui.$('import-file'), 'files', { configurable: true, value: [{ size: bytes.length, arrayBuffer: () => pendingRead }] });
      ui.$('import-file').dispatchEvent(new ui.win.Event('change'));
      await ui.importText(newestIsValid ? JSON.stringify(newer) : '{invalid');
      finishOlder(bytes.buffer); await tick();
      assert.deepEqual(ui.app.getDocument(), before);
      if (newestIsValid) {
        assert.match(ui.$('confirm-message').textContent, /Arquivo escolhido por último/);
        ui.click('confirm-accept'); assert.deepEqual(ui.app.getDocument(), newer);
      } else {
        assert.equal(ui.$('confirmation').hidden, true);
        assert.match(ui.$('notice').textContent, /Não foi possível importar/);
      }
      assert.equal(ui.writes.length, 0);
    });
  }
});

test('imported markup remains literal text in headings, categories, notes and SVG', async t => {
  const ui = await setup(t);
  const malicious = {
    version: 1, title: '<img src=x onerror=alert(1)>', description: '<script>alert(2)</script>',
    categories: [{ id: 'texto', label: '<svg onload=alert(3)>', color: '#be123c' }],
    events: [{ id: 'evento', title: '<script>alert(4)</script>', start: '2024-01-01', end: '2024-01-01', categoryId: 'texto', notes: '<img src=x onerror=alert(5)>\n& "texto"' }],
  };
  await ui.importText(JSON.stringify(malicious)); ui.click('confirm-accept');
  assert.equal(ui.$('document-title').textContent, malicious.title);
  assert.equal(ui.$('document-description').textContent, malicious.description);
  assert.equal(ui.root.querySelector('script, img, iframe, object, foreignObject'), null);
  assert.ok([...ui.root.querySelectorAll('*')].every(el => [...el.attributes].every(a => !/^on/i.test(a.name))));
  assert.equal(ui.root.querySelector('#timeline svg title').textContent, malicious.title);
  ui.choose(malicious.events[0].title);
  assert.equal(ui.$('event-notes').value, malicious.events[0].notes);
  ui.click('json'); assert.deepEqual(JSON.parse(ui.downloads[0].text), malicious);
  const exposed = ui.app.getDocument(); exposed.events[0].title = 'modified externally'; exposed.categories.length = 0;
  assert.deepEqual(ui.app.getDocument(), malicious);
});

test('save quota and stale-revision failures retain memory, revision, undo and export access', async t => {
  for (const failure of [
    Object.assign(new Error('O navegador não tem espaço para salvar esta cópia.'), { code: 'QUOTA' }),
    Object.assign(new Error('Outra aba salvou uma versão diferente.'), { code: 'CONFLICT' }),
  ]) {
    await t.test(failure.code, async t => {
      const initial = fixture();
      const ui = await setup(t, { storage: { async read() { return { revision: 7, document: clone(initial) }; }, async save() { throw failure; } } });
      ui.set('project-title', 'Trabalho que precisa de backup'); ui.submit('document-form');
      const before = ui.app.getDocument(); ui.click('save'); await tick();
      assert.deepEqual(ui.app.getDocument(), before); assert.equal(ui.app.getRevision(), 7);
      assert.match(ui.$('notice').textContent, /backup JSON/);
      assert.equal(ui.$('undo').disabled, false); assert.equal(ui.$('json').disabled, false);
      ui.click('json'); assert.deepEqual(JSON.parse(ui.downloads[0].text), before);
      ui.click('undo'); assert.deepEqual(ui.app.getDocument(), initial);
    });
  }
});

test('failed reads and download errors retain current editable work', async t => {
  let reads = 0;
  const ui = await setup(t, {
    storage: { async read() { reads++; throw new Error('A cópia deste navegador está inválida. Ela não foi substituída.'); }, async save() { assert.fail('reading corruption must not trigger a write'); } },
    download() { throw new Error('Download indisponível'); },
  });
  assert.equal(reads, 1); assert.match(ui.$('notice').textContent, /inválida/);
  ui.set('project-title', 'Documento recuperável'); ui.submit('document-form');
  const before = ui.app.getDocument(); ui.click('json');
  assert.match(ui.$('notice').textContent, /Não foi possível exportar/);
  assert.deepEqual(ui.app.getDocument(), before);
  ui.click('reload'); ui.click('confirm-accept'); await tick();
  assert.equal(reads, 2); assert.deepEqual(ui.app.getDocument(), before);
  assert.equal(ui.$('undo').disabled, false);
});

test('another tab only warns; reload preserves memory until confirmed and loads the newer revision', async t => {
  let saved = { revision: 2, document: fixture() };
  const broadcast = { onmessage: null, sent: [], postMessage(value) { this.sent.push(value); }, close() { this.closed = true; } };
  const ui = await setup(t, { channel: broadcast, storage: { async read() { return clone(saved); }, async save() { assert.fail('a notification must not save'); } } });
  ui.set('project-title', 'Minha edição'); ui.submit('document-form'); const before = ui.app.getDocument();
  saved = { revision: 3, document: { ...fixture(), title: 'Salvo em outra aba' } };
  broadcast.onmessage({ data: { type: 'saved', revision: 3 } });
  assert.match(ui.$('notice').textContent, /Outra aba/); assert.deepEqual(ui.app.getDocument(), before);
  ui.click('reload'); ui.click('confirm-cancel'); assert.deepEqual(ui.app.getDocument(), before);
  ui.click('reload'); ui.click('confirm-accept'); await tick();
  assert.equal(ui.app.getDocument().title, 'Salvo em outra aba'); assert.equal(ui.app.getRevision(), 3);
  assert.equal(ui.$('undo').disabled, true); assert.equal(broadcast.sent.length, 0);
});
