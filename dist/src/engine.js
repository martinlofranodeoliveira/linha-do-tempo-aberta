// SPDX-License-Identifier: MIT
// Datas civis gregorianas e formatos portáveis, sem estado ou dependências.

const MESSAGES = Object.freeze({
  INPUT_INVALID: 'Documento inválido.',
  VALUE_INVALID: 'Valor inválido.',
  DATE_INVALID: 'Data inválida.',
  REFERENCE_INVALID: 'Referência inválida.',
  LIMIT_EXCEEDED: 'Limite excedido.',
  OPTION_INVALID: 'Opções inválidas.',
  JSON_INVALID: 'JSON inválido.',
});
const COLORS = Object.freeze(['#2563eb', '#0f766e', '#b45309', '#7e22ce', '#be123c', '#475569']);
const ID_PATTERN = /^[a-z][a-z0-9_-]{0,39}$/;
const MAX_JSON_BYTES = 1024 * 1024;
const MAX_EXPORT_BYTES = 2 * 1024 * 1024;
const LAST_ORDINAL = 3652059;

export class TimelineError extends Error {
  constructor(code = 'INPUT_INVALID') {
    const safeCode = typeof code === 'string' && Object.hasOwn(MESSAGES, code) ? code : 'INPUT_INVALID';
    super(MESSAGES[safeCode]);
    this.name = 'TimelineError';
    this.code = safeCode;
  }
}

function fail(code) { throw new TimelineError(code); }
function compare(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
function leap(year) { return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0); }
function beforeYear(year) {
  const n = year - 1;
  return 365 * n + Math.floor(n / 4) - Math.floor(n / 100) + Math.floor(n / 400);
}
function monthDays(year, month) {
  return month === 2 ? (leap(year) ? 29 : 28) : ([4, 6, 9, 11].includes(month) ? 30 : 31);
}

export function dateToOrdinal(date) {
  if (typeof date !== 'string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)) fail('DATE_INVALID');
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > monthDays(year, month)) fail('DATE_INVALID');
  let ordinal = beforeYear(year) + day;
  for (let m = 1; m < month; m += 1) ordinal += monthDays(year, m);
  return ordinal;
}

export function ordinalToDate(ordinal) {
  if (!Number.isSafeInteger(ordinal) || ordinal < 1 || ordinal > LAST_ORDINAL) fail('DATE_INVALID');
  let low = 1;
  let high = 9999;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (beforeYear(middle) < ordinal) low = middle;
    else high = middle - 1;
  }
  const year = low;
  let day = ordinal - beforeYear(year);
  let month = 1;
  while (day > monthDays(year, month)) { day -= monthDays(year, month); month += 1; }
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function utf8Bytes(text, limit) {
  let bytes = 0;
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i);
    if (c <= 0x7f) bytes += 1;
    else if (c <= 0x7ff) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < text.length && text.charCodeAt(i + 1) >= 0xdc00 && text.charCodeAt(i + 1) <= 0xdfff) { bytes += 4; i += 1; }
    else bytes += 3;
    if (bytes > limit) fail('LIMIT_EXCEEDED');
  }
  return bytes;
}

// Observe descritores, nunca leia um accessor. Este guard precede o schema.
function resourceGuard(value, code = 'INPUT_INVALID') {
  let nodes = 0;
  function visit(current, depth) {
    nodes += 1;
    if (depth > 8 || nodes > 4000) fail(code === 'OPTION_INVALID' ? code : 'LIMIT_EXCEEDED');
    if (current === null || typeof current !== 'object') return;
    const descriptors = Object.getOwnPropertyDescriptors(current);
    for (const key of Reflect.ownKeys(descriptors)) {
      if (Array.isArray(current) && key === 'length') continue;
      const descriptor = descriptors[key];
      if (!Object.hasOwn(descriptor, 'value')) fail(code);
      visit(descriptor.value, depth + 1);
    }
  }
  visit(value, 1);
}

function record(value, keys, code = 'INPUT_INVALID', optional = false) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(code);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail(code);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const ownKeys = Reflect.ownKeys(descriptors);
  if ((!optional && ownKeys.length !== keys.length) || ownKeys.some((key) => typeof key !== 'string' || !keys.includes(key))) fail(code);
  for (const key of ownKeys) {
    const descriptor = descriptors[key];
    if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) fail(code);
  }
  return value;
}

function denseArray(value, maximum, code = 'INPUT_INVALID') {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) fail(code);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.length !== value.length + 1 || !Object.hasOwn(descriptors, 'length')) fail(code);
  for (let i = 0; i < value.length; i += 1) {
    const descriptor = descriptors[String(i)];
    if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) fail(code);
  }
  if (keys.some((key) => typeof key !== 'string' || (key !== 'length' && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length)))) fail(code);
  if (value.length > maximum) fail(code === 'OPTION_INVALID' ? code : 'LIMIT_EXCEEDED');
  return value;
}

function stringValue(value, maximum, { singleLine = false, nonempty = false, option = false } = {}) {
  const inputCode = option ? 'OPTION_INVALID' : 'INPUT_INVALID';
  const valueCode = option ? 'OPTION_INVALID' : 'VALUE_INVALID';
  if (typeof value !== 'string') fail(inputCode);
  let length = 0;
  for (const character of value) {
    const point = character.codePointAt(0);
    if (point >= 0xd800 && point <= 0xdfff) fail(inputCode);
    length += 1;
    if (point === 0xfffe || point === 0xffff || point === 0x7f || (point >= 0x80 && point <= 0x9f)
      || (point < 0x20 && (singleLine || (point !== 0x09 && point !== 0x0a)))
      || (singleLine && (point === 0x2028 || point === 0x2029))) fail(valueCode);
  }
  if (length > maximum) fail(option ? 'OPTION_INVALID' : 'LIMIT_EXCEEDED');
  if (nonempty && value.trim().length === 0) fail(valueCode);
  return value;
}

function idValue(value) {
  stringValue(value, Infinity);
  if (!ID_PATTERN.test(value)) fail('VALUE_INVALID');
  return value;
}
function eventOrder(a, b) { return compare(a.start, b.start) || compare(a.end, b.end) || compare(a.id, b.id); }

export function validateDocument(value) {
  resourceGuard(value);
  record(value, ['version', 'title', 'description', 'categories', 'events']);
  if (value.version !== 1) fail('INPUT_INVALID');
  const title = stringValue(value.title, 120, { singleLine: true, nonempty: true });
  const description = stringValue(value.description, 2000);
  const categoryIds = new Set();
  const categories = denseArray(value.categories, 12).map((category) => {
    record(category, ['id', 'label', 'color']);
    const id = idValue(category.id);
    const label = stringValue(category.label, 40, { singleLine: true, nonempty: true });
    const color = stringValue(category.color, Infinity);
    if (!COLORS.includes(color)) fail('VALUE_INVALID');
    if (categoryIds.has(id)) fail('REFERENCE_INVALID');
    categoryIds.add(id);
    return { id, label, color };
  }).sort((a, b) => compare(a.id, b.id));
  const eventIds = new Set();
  const events = denseArray(value.events, 200).map((event) => {
    record(event, ['id', 'title', 'start', 'end', 'categoryId', 'notes']);
    const id = idValue(event.id);
    const eventTitle = stringValue(event.title, 100, { singleLine: true, nonempty: true });
    if (typeof event.start !== 'string' || typeof event.end !== 'string') fail('INPUT_INVALID');
    const startOrdinal = dateToOrdinal(event.start);
    const endOrdinal = dateToOrdinal(event.end);
    if (endOrdinal < startOrdinal) fail('DATE_INVALID');
    const categoryId = event.categoryId === null ? null : idValue(event.categoryId);
    const notes = stringValue(event.notes, 2000);
    if (eventIds.has(id) || (categoryId !== null && !categoryIds.has(categoryId))) fail('REFERENCE_INVALID');
    eventIds.add(id);
    return { id, title: eventTitle, start: event.start, end: event.end, categoryId, notes };
  }).sort(eventOrder);
  const canonical = { version: 1, title, description, categories, events };
  utf8Bytes(JSON.stringify(canonical, null, 2) + '\n', MAX_JSON_BYTES);
  return canonical;
}

// Parser próprio apenas para a estrutura: JSON.parse decodifica cada token string.
// Assim duplicatas também são detectadas após escapes, em qualquer objeto.
export function parseDocument(text) {
  if (typeof text !== 'string') fail('INPUT_INVALID');
  utf8Bytes(text, MAX_JSON_BYTES);
  if (text.charCodeAt(0) === 0xfeff) fail('JSON_INVALID');
  let position = 0;
  let nodes = 0;
  function whitespace() { while (position < text.length && /[\x20\t\r\n]/.test(text[position])) position += 1; }
  function stringToken() {
    const start = position;
    if (text[position] !== '"') fail('JSON_INVALID');
    position += 1;
    while (position < text.length) {
      if (text[position] === '"') {
        position += 1;
        try { return JSON.parse(text.slice(start, position)); } catch { fail('JSON_INVALID'); }
      }
      if (text[position] === '\\') position += 1;
      position += 1;
    }
    fail('JSON_INVALID');
  }
  function parseValue(depth) {
    nodes += 1;
    if (depth > 8 || nodes > 4000) fail('LIMIT_EXCEEDED');
    whitespace();
    const character = text[position];
    if (character === '"') return stringToken();
    if (character === '{') {
      position += 1;
      whitespace();
      const object = Object.create(null);
      const seen = new Set();
      if (text[position] === '}') { position += 1; return object; }
      while (position < text.length) {
        whitespace();
        const key = stringToken();
        if (seen.has(key)) fail('JSON_INVALID');
        seen.add(key);
        whitespace();
        if (text[position] !== ':') fail('JSON_INVALID');
        position += 1;
        object[key] = parseValue(depth + 1);
        whitespace();
        if (text[position] === '}') { position += 1; return object; }
        if (text[position] !== ',') fail('JSON_INVALID');
        position += 1;
      }
      fail('JSON_INVALID');
    }
    if (character === '[') {
      position += 1;
      whitespace();
      const array = [];
      if (text[position] === ']') { position += 1; return array; }
      while (position < text.length) {
        array.push(parseValue(depth + 1));
        whitespace();
        if (text[position] === ']') { position += 1; return array; }
        if (text[position] !== ',') fail('JSON_INVALID');
        position += 1;
      }
      fail('JSON_INVALID');
    }
    for (const [literal, value] of [['true', true], ['false', false], ['null', null]]) {
      if (text.startsWith(literal, position)) { position += literal.length; return value; }
    }
    const number = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(text.slice(position));
    if (!number) fail('JSON_INVALID');
    position += number[0].length;
    const value = Number(number[0]);
    if (!Number.isFinite(value)) fail('JSON_INVALID');
    return value;
  }
  const value = parseValue(1);
  whitespace();
  if (position !== text.length) fail('JSON_INVALID');
  return validateDocument(value);
}

export function serializeDocument(value) { return JSON.stringify(validateDocument(value), null, 2) + '\n'; }

function optionsValue(options, document) {
  resourceGuard(options, 'OPTION_INVALID');
  record(options, ['query', 'categoryIds', 'from', 'to', 'selectedId'], 'OPTION_INVALID', true);
  const result = { query: '', categoryIds: [], from: null, to: null, selectedId: null };
  for (const key of Object.keys(options)) if (options[key] === undefined) fail('OPTION_INVALID');
  if (Object.hasOwn(options, 'query')) result.query = stringValue(options.query, 120, { singleLine: true, option: true });
  const categories = new Set(document.categories.map((category) => category.id));
  if (Object.hasOwn(options, 'categoryIds')) {
    const ids = denseArray(options.categoryIds, 12, 'OPTION_INVALID');
    const seen = new Set();
    for (const id of ids) {
      if (typeof id !== 'string' || !ID_PATTERN.test(id) || !categories.has(id) || seen.has(id)) fail('OPTION_INVALID');
      seen.add(id);
    }
    result.categoryIds = [...ids];
  }
  for (const key of ['from', 'to']) {
    if (Object.hasOwn(options, key) && options[key] !== null) {
      try { result[key] = dateToOrdinal(options[key]); } catch { fail('OPTION_INVALID'); }
    }
  }
  if (result.from !== null && result.to !== null && result.from > result.to) fail('OPTION_INVALID');
  if (Object.hasOwn(options, 'selectedId') && options.selectedId !== null) {
    if (typeof options.selectedId !== 'string' || !ID_PATTERN.test(options.selectedId) || !document.events.some((event) => event.id === options.selectedId)) fail('OPTION_INVALID');
    result.selectedId = options.selectedId;
  }
  return result;
}
function fold(text) { return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase(); }
function prepared(value, options) {
  const document = validateDocument(value);
  const settings = optionsValue(options, document);
  const categoryMap = new Map(document.categories.map((category) => [category.id, category]));
  const query = fold(settings.query);
  const events = document.events.filter((event) => {
    if (settings.categoryIds.length && !settings.categoryIds.includes(event.categoryId)) return false;
    if (settings.from !== null && dateToOrdinal(event.end) < settings.from) return false;
    if (settings.to !== null && dateToOrdinal(event.start) > settings.to) return false;
    const label = categoryMap.get(event.categoryId)?.label ?? '';
    return !query || fold(`${event.title}\n${event.notes}\n${label}`).includes(query);
  });
  return { document, settings, categoryMap, events };
}

export function filterEvents(value, options = {}) { return prepared(value, options).events; }

function buildLayout(context) {
  const { events, categoryMap } = context;
  const height = 260 + 68 * events.length;
  if (events.length === 0) return { width: 1200, height, range: null, rows: [], ticks: [] };
  const startOrdinal = Math.min(...events.map((event) => dateToOrdinal(event.start)));
  const endOrdinal = Math.max(...events.map((event) => dateToOrdinal(event.end)));
  const span = endOrdinal - startOrdinal;
  const x = (ordinal) => span === 0 ? 725 : 300 + ((ordinal - startOrdinal) / span) * 850;
  const rows = events.map((event, index) => {
    const start = dateToOrdinal(event.start);
    const end = dateToOrdinal(event.end);
    return { event, days: end - start + 1, x1: x(start), x2: x(end), y: 160 + index * 68, color: categoryMap.get(event.categoryId)?.color ?? '#475569' };
  });
  const ordinals = span === 0 ? [startOrdinal] : [...new Set([0, 1, 2, 3, 4].map((i) => startOrdinal + Math.floor(span * i / 4)))];
  return {
    width: 1200, height,
    range: { start: ordinalToDate(startOrdinal), end: ordinalToDate(endOrdinal), startOrdinal, endOrdinal },
    rows,
    ticks: ordinals.map((ordinal) => ({ date: ordinalToDate(ordinal), ordinal, x: x(ordinal) })),
  };
}
export function layoutTimeline(value, options = {}) { return buildLayout(prepared(value, options)); }

function xml(text) { return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;'); }
function short(text, maximum) { const points = [...text]; return points.length <= maximum ? text : points.slice(0, maximum - 1).join('') + '…'; }

export function renderSVG(value, options = {}) {
  const context = prepared(value, options);
  const layout = buildLayout(context);
  const { document, settings, categoryMap } = context;
  const parts = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${layout.height}" viewBox="0 0 1200 ${layout.height}" role="img" aria-labelledby="timeline-title timeline-description" font-family="sans-serif">`,
    `<title id="timeline-title">${xml(document.title)}</title>`,
    `<desc id="timeline-description">${xml(document.description)} Linha do tempo de datas civis. ${layout.rows.length} eventos.</desc>`,
    `<rect width="1200" height="${layout.height}" fill="#ffffff"/>`,
    `<text x="40" y="48" font-size="26" font-weight="700" fill="#0f172a">${xml(short(document.title, 36))}</text>`,
    `<text x="40" y="78" font-size="13" fill="#475569">${xml(layout.range ? `${layout.range.start} a ${layout.range.end} · ${layout.rows.length} eventos · duração inclusiva em dias` : 'Nenhum evento neste recorte.')}</text>`,
  ];
  if (layout.range) {
    parts.push('<line x1="300" y1="112" x2="1150" y2="112" stroke="#94a3b8" stroke-width="1"/>');
    for (const tick of layout.ticks) {
      parts.push(`<line x1="${tick.x}" y1="112" x2="${tick.x}" y2="${layout.height - 100}" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="3 5"/>`);
      parts.push(`<text x="${tick.x}" y="131" text-anchor="middle" font-size="11" fill="#475569">${tick.date}</text>`);
    }
    for (const row of layout.rows) {
      const selected = settings.selectedId === row.event.id;
      const label = categoryMap.get(row.event.categoryId)?.label ?? 'Sem categoria';
      parts.push(`<g><title>${xml(row.event.title)} · ${row.event.start} a ${row.event.end} · ${row.days} dias</title>`);
      if (selected) parts.push(`<rect x="24" y="${row.y - 20}" width="1152" height="58" rx="8" fill="#f1f5f9" stroke="#0f172a" stroke-width="1"/>`);
      parts.push(`<text x="40" y="${row.y}" font-size="14" font-weight="${selected ? '700' : '400'}" fill="#0f172a">${xml(short(row.event.title, 16))}</text>`);
      parts.push(`<text x="40" y="${row.y + 17}" font-size="11" fill="#475569">${row.event.start} → ${row.event.end}</text>`);
      parts.push(`<text x="40" y="${row.y + 32}" font-size="10" fill="#475569">${xml(short(label, 22))} · ${row.days} dias</text>`);
      if (row.x1 === row.x2) parts.push(`<circle cx="${row.x1}" cy="${row.y}" r="6" fill="${row.color}" stroke="${selected ? '#0f172a' : row.color}" stroke-width="2"/>`);
      else parts.push(`<rect x="${row.x1}" y="${row.y - 6}" width="${row.x2 - row.x1}" height="12" rx="6" fill="${row.color}" stroke="${selected ? '#0f172a' : row.color}" stroke-width="2"/>`);
      parts.push('</g>');
    }
  } else parts.push('<text x="600" y="170" text-anchor="middle" font-size="18" fill="#475569">Adicione um evento ou ajuste os filtros.</text>');
  parts.push('</svg>');
  const result = parts.join('\n') + '\n';
  utf8Bytes(result, MAX_EXPORT_BYTES);
  return result;
}

function csvCell(value) {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}
export function exportCSV(value, options = {}) {
  const { events, categoryMap } = prepared(value, options);
  const rows = ['id,titulo,inicio,fim,dias,categoria,notas'];
  for (const event of events) {
    rows.push([
      event.id, event.title, event.start, event.end,
      dateToOrdinal(event.end) - dateToOrdinal(event.start) + 1,
      categoryMap.get(event.categoryId)?.label ?? '', event.notes,
    ].map(csvCell).join(','));
  }
  const result = rows.join('\r\n') + '\r\n';
  utf8Bytes(result, MAX_EXPORT_BYTES);
  return result;
}
