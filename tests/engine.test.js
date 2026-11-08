// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TimelineError, dateToOrdinal, ordinalToDate, validateDocument, parseDocument,
  serializeDocument, filterEvents, layoutTimeline, renderSVG, exportCSV,
} from '../src/engine.js';

function example() {
  return {
    version: 1, title: 'Memória da comunidade', description: 'Exemplo fictício.\nEducação aberta.',
    categories: [
      { id: 'oficina', label: 'Educação', color: '#2563eb' },
      { id: 'mutirao', label: 'Ação coletiva', color: '#0f766e' },
    ],
    events: [
      { id: 'fim', title: 'Publicação', start: '2000-03-03', end: '2000-03-03', categoryId: null, notes: '' },
      { id: 'curso', title: 'Oficina de memória', start: '2000-02-28', end: '2000-03-02', categoryId: 'oficina', notes: 'Criação de acervo.\nSala\tcomunitária.' },
      { id: 'acao', title: 'Praça aberta', start: '2000-02-28', end: '2000-02-28', categoryId: 'mutirao', notes: 'Mutirão' },
    ],
  };
}
function code(fn, expected) {
  assert.throws(fn, (error) => error instanceof TimelineError && error.name === 'TimelineError' && error.code === expected);
}
function deepFreeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(deepFreeze); Object.freeze(value); }
  return value;
}
const consumers = [filterEvents, layoutTimeline, renderSVG, exportCSV];

test('os dez exports são funções e erros têm código/mensagem fixa', () => {
  for (const exported of [TimelineError, dateToOrdinal, ordinalToDate, validateDocument, parseDocument, serializeDocument, ...consumers]) assert.equal(typeof exported, 'function');
  const first = new TimelineError('VALUE_INVALID', 'não deve aparecer');
  const second = new TimelineError('VALUE_INVALID', 'outro dado');
  assert.equal(first.message, second.message);
  assert.equal(first.code, 'VALUE_INVALID');
  assert.equal(new TimelineError('segredo').code, 'INPUT_INVALID');
  assert.ok(!first.message.includes('aparecer'));
});

test('datas civis: extremos, anos pequenos e séculos gregorianos', () => {
  const fixtures = [
    ['0001-01-01', 1], ['0001-12-31', 365], ['0004-02-29', 1155],
    ['0100-01-01', 36160], ['1970-01-01', 719163],
    ['2000-01-01', 730120], ['9999-12-31', 3652059],
  ];
  for (const [date, ordinal] of fixtures) { assert.equal(dateToOrdinal(date), ordinal); assert.equal(ordinalToDate(ordinal), date); }
  assert.equal(dateToOrdinal('1900-03-01') - dateToOrdinal('1900-02-28'), 1);
  assert.equal(dateToOrdinal('2000-03-01') - dateToOrdinal('2000-02-28'), 2);
  assert.equal(dateToOrdinal('0004-03-01') - dateToOrdinal('0004-02-28'), 2);
});

test('roundtrip civil em milhares de ordinais determinísticos sem relógio', () => {
  for (let n = 1; n <= 3652059; n += 997) assert.equal(dateToOrdinal(ordinalToDate(n)), n);
  for (const year of ['0001', '0004', '0099', '0100', '0400', '1900', '2000', '9999']) {
    for (const suffix of ['01-01', '02-28', '03-01', '12-31']) {
      const date = `${year}-${suffix}`;
      assert.equal(ordinalToDate(dateToOrdinal(date)), date);
    }
  }
});

test('datas inválidas são rejeitadas sem coerção', () => {
  for (const value of [null, undefined, 1, {}, '', '0000-01-01', '10000-01-01', '2020-2-01', '2020-02-30', '1900-02-29', '0001-00-01', '2001-13-01', '2001-01-00', ' 2001-01-01', '2001-01-01\n', '٢٠٠١-01-01', '2001-01-01T00:00:00Z']) code(() => dateToOrdinal(value), 'DATE_INVALID');
  for (const value of [null, undefined, '1', 0, -1, 3652060, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) code(() => ordinalToDate(value), 'DATE_INVALID');
});

test('cópia canônica ordena categorias e eventos sem normalizar textos', () => {
  const input = example();
  input.title = '  História 📚  ';
  input.events[1].title = '  Oficina  ';
  const snapshot = JSON.stringify(input);
  const result = validateDocument(input);
  assert.deepEqual(result.categories.map((item) => item.id), ['mutirao', 'oficina']);
  assert.deepEqual(result.events.map((item) => item.id), ['acao', 'curso', 'fim']);
  assert.equal(result.title, input.title);
  assert.equal(result.events[1].title, '  Oficina  ');
  assert.equal(JSON.stringify(input), snapshot);
  assert.notEqual(result, input);
  assert.notEqual(result.events[1], input.events[1]);
  assert.deepEqual(Object.keys(result), ['version', 'title', 'description', 'categories', 'events']);
  assert.deepEqual(Object.keys(result.events[0]), ['id', 'title', 'start', 'end', 'categoryId', 'notes']);
});

test('desempate canônico usa start, end e id ASCII', () => {
  const input = example();
  input.events = ['z', 'a', 'a_1', 'a-1'].map((id) => ({ ...input.events[0], id }));
  assert.deepEqual(validateDocument(input).events.map((event) => event.id), ['a', 'a-1', 'a_1', 'z']);
});

test('documento vazio e objetos com prototype null são válidos', () => {
  const empty = { version: 1, title: 'Vazio', description: '', categories: [], events: [] };
  assert.deepEqual(validateDocument(Object.assign(Object.create(null), empty)), empty);
  assert.deepEqual(filterEvents(empty), []);
  assert.deepEqual(layoutTimeline(empty), { width: 1200, height: 260, range: null, rows: [], ticks: [] });
});

test('estrutura exata e tipos do schema', () => {
  for (const value of [null, [], 1, 'json', true, new Map()]) code(() => validateDocument(value), 'INPUT_INVALID');
  for (const key of ['version', 'title', 'description', 'categories', 'events']) {
    const input = example(); delete input[key]; code(() => validateDocument(input), 'INPUT_INVALID');
  }
  const mutations = [
    (d) => { d.extra = 1; }, (d) => { d.version = '1'; }, (d) => { d.title = 4; },
    (d) => { d.description = null; }, (d) => { d.categories = {}; },
    (d) => { d.events[0].extra = 1; }, (d) => { delete d.events[0].notes; },
    (d) => { d.categories[0].label = null; }, (d) => { d.events[0].categoryId = 1; },
    (d) => { d.events[0].start = 1; }, (d) => { d.events[0].end = null; },
  ];
  for (const mutate of mutations) { const input = example(); mutate(input); code(() => validateDocument(input), 'INPUT_INVALID'); }
});

test('objetos especiais, propriedades ocultas, símbolos e getters são rejeitados', () => {
  let reads = 0;
  const getter = example();
  Object.defineProperty(getter, 'title', { enumerable: true, get() { reads += 1; return 'x'; } });
  code(() => validateDocument(getter), 'INPUT_INVALID');
  assert.equal(reads, 0);
  const hidden = example(); Object.defineProperty(hidden, 'title', { value: 'x', enumerable: false });
  code(() => validateDocument(hidden), 'INPUT_INVALID');
  const symbol = example(); symbol[Symbol('x')] = 1; code(() => validateDocument(symbol), 'INPUT_INVALID');
  const unusual = Object.assign(Object.create({ custom: true }), example()); code(() => validateDocument(unusual), 'INPUT_INVALID');
  const frozen = deepFreeze(example()); assert.equal(validateDocument(frozen).events.length, 3);
});

test('arrays são normais, densos, sem chaves extras ou accessors', () => {
  const mutations = [
    (a) => { delete a[0]; }, (a) => { a.extra = 1; }, (a) => { a[Symbol('x')] = 1; },
    (a) => { Object.defineProperty(a, '0', { get() { throw new Error('não executar'); }, enumerable: true }); },
    (a) => { Object.defineProperty(a, '0', { value: a[0], enumerable: false }); },
    (a) => { Object.setPrototypeOf(a, null); },
  ];
  for (const mutate of mutations) { const input = example(); mutate(input.events); code(() => validateDocument(input), 'INPUT_INVALID'); }
  const input = example(); input.events = new (class extends Array {})(...input.events); code(() => validateDocument(input), 'INPUT_INVALID');
});

test('Unicode é preservado, comprimentos contam pontos de código', () => {
  const input = example(); input.title = '📚'.repeat(120); input.events[0].title = 'é'.repeat(100);
  assert.equal(validateDocument(input).title, input.title);
  input.title += '📚'; code(() => validateDocument(input), 'LIMIT_EXCEEDED');
  for (const malformed of ['\ud800', '\udfff', 'a\ud800b']) {
    const invalid = example(); invalid.description = malformed; code(() => validateDocument(invalid), 'INPUT_INVALID');
  }
});

test('controles, não caracteres XML, títulos vazios e valores enumerados', () => {
  for (const invalid of ['', ' \t ', '\u2028', '\u2029', '\u007f', '\u0085', '\ufffe', '\uffff', '\n', '\u0000']) {
    const input = example(); input.title = invalid; code(() => validateDocument(input), 'VALUE_INVALID');
  }
  for (const invalid of ['x\r', '\u000b', '\u007f', '\u009f', '\uffff']) {
    const input = example(); input.description = invalid; code(() => validateDocument(input), 'VALUE_INVALID');
  }
  const allowed = example(); allowed.description = '\n\tA\u2028B'; assert.equal(validateDocument(allowed).description, allowed.description);
  for (const invalid of ['A', '_id', 'a b', 'a'.repeat(41)]) { const input = example(); input.events[0].id = invalid; code(() => validateDocument(input), 'VALUE_INVALID'); }
  for (const invalid of ['red', '#ffffff', '#2563EB', 'url(x)', '#2563eb ']) { const input = example(); input.categories[0].color = invalid; code(() => validateDocument(input), 'VALUE_INVALID'); }
});

test('referências e datas de evento têm códigos específicos', () => {
  const duplicateEvent = example(); duplicateEvent.events[0].id = duplicateEvent.events[1].id; code(() => validateDocument(duplicateEvent), 'REFERENCE_INVALID');
  const duplicateCategory = example(); duplicateCategory.categories[0].id = duplicateCategory.categories[1].id; code(() => validateDocument(duplicateCategory), 'REFERENCE_INVALID');
  const unknown = example(); unknown.events[0].categoryId = 'ausente'; code(() => validateDocument(unknown), 'REFERENCE_INVALID');
  const invalidId = example(); invalidId.events[0].categoryId = 'Inválido'; code(() => validateDocument(invalidId), 'VALUE_INVALID');
  const backwards = example(); backwards.events[0].end = '0001-01-01'; code(() => validateDocument(backwards), 'DATE_INVALID');
  const invalidDate = example(); invalidDate.events[0].start = '1900-02-29'; code(() => validateDocument(invalidDate), 'DATE_INVALID');
  const sharedId = example(); sharedId.events[0].id = sharedId.categories[0].id; assert.equal(validateDocument(sharedId).events.length, 3);
});

test('contagens, profundidade e nós são limitados antes do schema', () => {
  const categories = example(); categories.categories = Array.from({ length: 13 }, (_, i) => ({ id: `c${i}`, label: 'Categoria', color: '#2563eb' })); code(() => validateDocument(categories), 'LIMIT_EXCEEDED');
  const events = example(); events.events = Array.from({ length: 201 }, (_, i) => ({ ...events.events[0], id: `e${i}` })); code(() => validateDocument(events), 'LIMIT_EXCEEDED');
  const deep = example(); let branch = null; for (let i = 0; i < 8; i += 1) branch = { branch }; deep.extra = branch; code(() => validateDocument(deep), 'LIMIT_EXCEEDED');
  const many = example(); many.extra = Array(4000).fill(null); code(() => validateDocument(many), 'LIMIT_EXCEEDED');
  const cyclic = example(); cyclic.extra = cyclic; code(() => validateDocument(cyclic), 'LIMIT_EXCEEDED');
});

test('backup canônico tem teto UTF-8 e todo modelo aceito volta pelo parser', () => {
  const input = example();
  input.events = Array.from({ length: 200 }, (_, i) => ({ ...input.events[0], id: `e${i}`, notes: '📚'.repeat(2000) }));
  code(() => validateDocument(input), 'LIMIT_EXCEEDED');
  code(() => serializeDocument(input), 'LIMIT_EXCEEDED');
  const text = serializeDocument(example());
  assert.ok(text.endsWith('\n'));
  assert.ok(text.includes('\n  "version": 1,'));
  assert.deepEqual(parseDocument(text), validateDocument(example()));
  assert.equal(serializeDocument(parseDocument(text)), text);
});

test('JSON estrito rejeita sintaxe, duplicatas decodificadas e não finitos', () => {
  const invalid = [
    '', ' ', '{', '[1,]', '{"a":1,}', '{a:1}', 'NaN', 'Infinity', '-Infinity', '1e309',
    '01', '+1', 'true false', '/* comentário */ {}', '\ufeff{}', '"linha\ncrua"',
    '{"title":1,"ti\\u0074le":2}', '{"x":{"a":1,"a":2}}', '{"__proto__":1,"__proto__":2}',
  ];
  for (const text of invalid) code(() => parseDocument(text), 'JSON_INVALID');
  code(() => parseDocument({}), 'INPUT_INVALID');
  code(() => parseDocument('"\\ud800"'), 'INPUT_INVALID');
  const input = example(); input.title = '\ud800'; code(() => parseDocument(JSON.stringify(input)), 'INPUT_INVALID');
});

test('limites de JSON são UTF-8, inclusive espaços e estruturas fora do schema', () => {
  const text = serializeDocument(example());
  const bytes = Buffer.byteLength(text, 'utf8');
  assert.deepEqual(parseDocument(text + ' '.repeat(1024 * 1024 - bytes)), validateDocument(example()));
  code(() => parseDocument(text + ' '.repeat(1024 * 1024 - bytes + 1)), 'LIMIT_EXCEEDED');
  code(() => parseDocument('['.repeat(9) + '0' + ']'.repeat(9)), 'LIMIT_EXCEEDED');
  code(() => parseDocument('[' + Array(4001).fill('null').join(',') + ']'), 'LIMIT_EXCEEDED');
});

test('filtros buscam título, notas e categoria sem acentos e sem título do documento', () => {
  assert.deepEqual(filterEvents(example(), { query: 'EDUCACAO' }).map((event) => event.id), ['curso']);
  assert.deepEqual(filterEvents(example(), { query: 'MUTIRAO' }).map((event) => event.id), ['acao']);
  assert.deepEqual(filterEvents(example(), { query: 'memoria' }).map((event) => event.id), ['curso']);
  assert.deepEqual(filterEvents(example(), { query: 'comunidade' }), []);
  assert.deepEqual(filterEvents(example(), { categoryIds: ['oficina'] }).map((event) => event.id), ['curso']);
  assert.equal(filterEvents(example(), { categoryIds: [] }).length, 3);
});

test('interseção de períodos é inclusiva e seleção não filtra', () => {
  assert.deepEqual(filterEvents(example(), { from: '2000-03-02', to: '2000-03-02' }).map((event) => event.id), ['curso']);
  assert.deepEqual(filterEvents(example(), { from: '2000-03-03' }).map((event) => event.id), ['fim']);
  assert.deepEqual(filterEvents(example(), { to: '2000-02-28' }).map((event) => event.id), ['acao', 'curso']);
  assert.deepEqual(filterEvents(example(), { selectedId: 'fim', query: 'oficina' }).map((event) => event.id), ['curso']);
  assert.equal(filterEvents(example(), { from: null, to: null, selectedId: null }).length, 3);
});

test('opções são estritas em todas APIs consumidoras', () => {
  const invalid = [
    null, [], 1, { other: true }, { query: undefined }, { query: null }, { query: 'x'.repeat(121) },
    { query: '\ud800' }, { query: '\n' }, { query: '\t' }, { query: '\u007f' }, { query: '\u2028' }, { query: '\ufffe' },
    { from: undefined }, { from: '1900-02-29' }, { to: 1 }, { from: '2000-03-03', to: '2000-03-02' },
    { categoryIds: undefined }, { categoryIds: null }, { categoryIds: ['ausente'] }, { categoryIds: ['oficina', 'oficina'] },
    { categoryIds: Array(13).fill('oficina') }, { categoryIds: Array(1) }, { selectedId: undefined }, { selectedId: 'ausente' },
  ];
  for (const options of invalid) for (const consume of consumers) code(() => consume(example(), options), 'OPTION_INVALID');
  let reads = 0;
  const accessor = Object.defineProperty({}, 'query', { enumerable: true, get() { reads += 1; return ''; } });
  code(() => filterEvents(example(), accessor), 'OPTION_INVALID'); assert.equal(reads, 0);
  const symbol = { [Symbol('x')]: 1 }; code(() => filterEvents(example(), symbol), 'OPTION_INVALID');
  const ids = ['oficina']; ids.extra = 1; code(() => filterEvents(example(), { categoryIds: ids }), 'OPTION_INVALID');
  assert.equal(filterEvents(example(), Object.assign(Object.create(null), { query: '' })).length, 3);
  assert.equal(filterEvents(example(), undefined).length, 3);
});

test('todas APIs preservam entradas congeladas e devolvem cópias independentes', () => {
  const input = deepFreeze(example());
  const options = deepFreeze({ selectedId: 'curso', categoryIds: ['oficina'] });
  const original = JSON.stringify(input);
  for (const consume of consumers) consume(input, options);
  serializeDocument(input);
  assert.equal(JSON.stringify(input), original);
  const filtered = filterEvents(input); filtered[0].title = 'Editado';
  assert.notEqual(input.events[2].title, 'Editado');
  const layout = layoutTimeline(input); layout.rows[0].event.notes = 'Editado';
  assert.notEqual(input.events[2].notes, 'Editado');
});

test('layout conserva ordem, duração inclusiva, geometria e cores', () => {
  const layout = layoutTimeline(example());
  assert.equal(layout.width, 1200); assert.equal(layout.height, 464);
  assert.deepEqual(layout.rows.map((row) => row.event), filterEvents(example()));
  assert.deepEqual(layout.rows.map((row) => row.days), [1, 4, 1]);
  assert.deepEqual(layout.rows.map((row) => row.y), [160, 228, 296]);
  assert.deepEqual(layout.rows.map((row) => row.color), ['#0f766e', '#2563eb', '#475569']);
  assert.equal(layout.range.start, '2000-02-28'); assert.equal(layout.range.end, '2000-03-03');
  assert.equal(layout.rows[0].x1, 300); assert.equal(layout.rows[1].x2, 937.5); assert.equal(layout.rows[2].x2, 1150);
  assert.deepEqual(layout.ticks.map((tick) => tick.x), [300, 512.5, 725, 937.5, 1150]);
  for (const row of layout.rows) for (const number of [row.x1, row.x2, row.y, row.days]) assert.ok(Number.isFinite(number));
});

test('layout usa só eventos filtrados, ticks únicos e centro de um dia', () => {
  const point = layoutTimeline(example(), { query: 'publicacao', from: '0001-01-01', to: '9999-12-31' });
  assert.equal(point.rows[0].x1, 725); assert.equal(point.rows[0].x2, 725);
  assert.equal(point.ticks.length, 1); assert.equal(point.ticks[0].x, 725);
  assert.equal(point.range.start, '2000-03-03');
  assert.deepEqual(layoutTimeline(example(), { query: 'inexistente' }).range, null);
  const input = example(); input.events = [{ ...input.events[0], start: '2000-01-01', end: '2000-01-02' }];
  const span = layoutTimeline(input); assert.deepEqual(span.ticks.map((tick) => tick.date), ['2000-01-01', '2000-01-02']);
  assert.deepEqual(layoutTimeline(example(), { selectedId: 'curso' }), layoutTimeline(example()));
});

test('SVG é passivo, escapa texto completo e mantém geometria', () => {
  const input = example();
  input.title = 'Título < & " >';
  input.events[1].title = '<script onload="x"> & evento completo';
  input.events[1].notes = '" onclick="segredo';
  const svg = renderSVG(input, { selectedId: 'curso' });
  assert.ok(svg.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.ok(svg.includes('width="1200" height="464"'));
  assert.ok(svg.includes('<title id="timeline-title">Título &lt; &amp; &quot; &gt;</title>'));
  assert.ok(svg.includes('&lt;script onload=&quot;x&quot;&gt; &amp; evento completo'));
  assert.ok(!svg.includes('segredo'));
  assert.ok(svg.includes('x="300" y="222" width="637.5"'));
  const allowed = new Set(['svg', 'title', 'desc', 'rect', 'text', 'line', 'g', 'circle']);
  for (const match of svg.matchAll(/<\/?([A-Za-z][A-Za-z0-9]*)(\s[^<>]*?)?\s*\/?>/g)) {
    assert.ok(allowed.has(match[1]), match[1]);
    assert.ok(!/\son[a-z]+\s*=|href\s*=|\sstyle\s*=/i.test(match[2] ?? ''));
  }
  assert.ok(Buffer.byteLength(svg) <= 2 * 1024 * 1024);
});

test('SVG selecionado fora do filtro não vaza eventos e vazio não inventa intervalo', () => {
  const svg = renderSVG(example(), { query: 'praca', selectedId: 'fim' });
  assert.ok(svg.includes('Praça aberta')); assert.ok(!svg.includes('Publicação'));
  assert.ok(!svg.includes('Memória da comunidade ·'));
  const empty = renderSVG(example(), { query: 'inexistente' });
  assert.ok(empty.includes('Nenhum evento neste recorte.')); assert.ok(!empty.includes('2000-'));
  assert.notEqual(renderSVG(example()), renderSVG(example(), { selectedId: 'curso' }));
});

function readCSV(text) {
  const rows = []; let row = []; let cell = ''; let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\r' && text[i + 1] === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i += 1; }
    else cell += c;
  }
  assert.equal(quoted, false); assert.deepEqual(row, []); assert.equal(cell, ''); return rows;
}

test('CSV tem cabeçalho exato, CRLF, RFC4180 e dados Unicode íntegros', () => {
  const input = example(); input.events[1].title = 'Oficina, "memória" 📚';
  const csv = exportCSV(input);
  assert.ok(csv.startsWith('id,titulo,inicio,fim,dias,categoria,notas\r\n'));
  assert.ok(csv.endsWith('\r\n'));
  const rows = readCSV(csv);
  assert.deepEqual(rows[0], ['id', 'titulo', 'inicio', 'fim', 'dias', 'categoria', 'notas']);
  assert.deepEqual(rows[2], ['curso', input.events[1].title, '2000-02-28', '2000-03-02', '4', 'Educação', input.events[1].notes]);
  assert.equal(rows[3][5], '');
  assert.ok(Buffer.byteLength(csv) <= 2 * 1024 * 1024);
});

test('CSV neutraliza primeiros caracteres de fórmula e respeita filtros', () => {
  for (const first of ['=', '+', '-', '@', '\t']) {
    const input = example(); input.events[0].notes = first + 'conteúdo';
    const rows = readCSV(exportCSV(input, { query: 'publicacao' }));
    assert.equal(rows[1][6], "'" + first + 'conteúdo');
  }
  const input = example(); input.events[1].title = '=SOMA(1)'; input.categories[0].label = '@categoria';
  const rows = readCSV(exportCSV(input, { categoryIds: ['oficina'] }));
  assert.equal(rows.length, 2); assert.equal(rows[1][1], "'=SOMA(1)"); assert.equal(rows[1][5], "'@categoria");
  assert.equal(exportCSV(input, { query: 'inexistente' }), 'id,titulo,inicio,fim,dias,categoria,notas\r\n');
});

test('limites exatos de profundidade e nós preservam o guard anterior ao schema', () => {
  let branch = null;
  for (let i = 0; i < 6; i += 1) branch = { child: branch };
  code(() => validateDocument({ extra: branch }), 'INPUT_INVALID');
  code(() => validateDocument({ extra: { child: branch } }), 'LIMIT_EXCEEDED');
  code(() => validateDocument({ extra: Array(3998).fill(null) }), 'INPUT_INVALID');
  code(() => validateDocument({ extra: Array(3999).fill(null) }), 'LIMIT_EXCEEDED');
});

test('todos os limites de texto preservam o original e rejeitam o ponto excedente', () => {
  const cases = [
    [(d, text) => { d.title = text; }, 120],
    [(d, text) => { d.description = text; }, 2000],
    [(d, text) => { d.categories[0].label = text; }, 40],
    [(d, text) => { d.events[0].title = text; }, 100],
    [(d, text) => { d.events[0].notes = text; }, 2000],
  ];
  for (const [set, maximum] of cases) {
    const input = example(); set(input, '📚'.repeat(maximum));
    assert.deepEqual(parseDocument(serializeDocument(input)), validateDocument(input));
    set(input, '📚'.repeat(maximum + 1)); code(() => validateDocument(input), 'LIMIT_EXCEEDED');
  }
});

test('coleções nos máximos e as seis cores produzem backup, layout e exports válidos', () => {
  const colors = ['#2563eb', '#0f766e', '#b45309', '#7e22ce', '#be123c', '#475569'];
  const input = example();
  input.categories = Array.from({ length: 12 }, (_, i) => ({ id: `c${i}`, label: `Categoria ${i}`, color: colors[i % colors.length] }));
  input.events = Array.from({ length: 200 }, (_, i) => ({ id: `e${i}`, title: `Evento ${i} < & >`, start: '0001-01-01', end: '9999-12-31', categoryId: `c${i % 12}`, notes: '' }));
  assert.equal(parseDocument(serializeDocument(input)).events.length, 200);
  const layout = layoutTimeline(input);
  assert.equal(layout.height, 13860); assert.equal(layout.rows.length, 200);
  assert.equal(layout.rows[0].days, 3652059);
  assert.deepEqual([...new Set(layout.rows.map((row) => row.color))].sort(), [...colors].sort());
  const svg = renderSVG(input);
  for (let i = 0; i < 200; i += 1) assert.ok(svg.includes(`<title>Evento ${i} &lt; &amp; &gt; ·`));
  assert.equal(readCSV(exportCSV(input)).length, 201);
});
