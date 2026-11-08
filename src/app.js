import {
  validateDocument,
  parseDocument,
  serializeDocument,
  filterEvents,
  layoutTimeline,
  renderSVG,
  exportCSV,
  dateToOrdinal,
} from "./engine.js";
import { createStorage } from "./storage.js";
import { example } from "./example.js";

const colors = [
  "#2563eb",
  "#0f766e",
  "#b45309",
  "#7e22ce",
  "#be123c",
  "#475569",
];
const blank = () => ({
  version: 1,
  title: "Minha linha do tempo",
  description: "",
  categories: [],
  events: [],
});
const asDate = (value) => value.split("-").reverse().join("/");
const svgNS = "http://www.w3.org/2000/svg";

export function mountApp(root, services = {}) {
  const doc = root.ownerDocument,
    win = doc.defaultView;
  const storage = services.storage ?? createStorage(win.indexedDB);
  const download =
    services.download ??
    ((name, text, type) => {
      const url = win.URL.createObjectURL(new win.Blob([text], { type }));
      const link = doc.createElement("a");
      link.href = url;
      link.download = name;
      doc.body.append(link);
      link.click();
      link.remove();
      win.setTimeout(() => win.URL.revokeObjectURL(url), 1000);
    });
  let current = validateDocument(blank()),
    revision = 0,
    lastSaved = serializeDocument(current);
  let undo = [],
    redo = [],
    selectedId = null,
    mode = "view",
    busy = true,
    importCandidate = null;
  let filters = { query: "", categoryIds: [], from: null, to: null },
    zoom = 1;
  let disposed = false,
    pendingConfirmation = null,
    confirmationKind = null,
    returnFocus = null,
    importEpoch = 0;
  const channel =
    services.channel ??
    (typeof win.BroadcastChannel === "function"
      ? new win.BroadcastChannel("lofrano.linha-do-tempo-aberta.v1")
      : null);

  // All markup here is authored static content; imported values are assigned through DOM text/value APIs.
  root.innerHTML = `
    <header class="app-header"><a class="brand" href="https://lofranotecnologia.com.br" target="_blank" rel="noopener noreferrer">LOFRANO<span>código aberto</span></a><h1>Linha do Tempo Aberta</h1><a class="source-link" href="https://github.com/martinlofranodeoliveira/linha-do-tempo-aberta" target="_blank" rel="noopener noreferrer">Código e documentação</a></header>
    <main id="main"><section class="document-heading"><div><h2 id="document-title"></h2><p id="document-description"></p><p class="status" id="save-status" role="status" aria-live="polite"></p></div><div class="document-actions"><button id="save" class="primary" type="button">Salvar neste navegador</button><button id="reload" type="button">Recarregar cópia salva</button></div></section>
    <p id="notice" class="notice" role="status" aria-live="polite" hidden></p>
    <nav class="file-actions" aria-label="Documento e arquivos"><button id="new" type="button">Novo documento</button><button id="example" type="button">Carregar exemplo fictício</button><button id="import" type="button">Importar JSON</button><input id="import-file" type="file" accept=".json,application/json" hidden><span class="separator" aria-hidden="true"></span><button id="json" type="button">Baixar backup JSON</button><button id="csv" type="button">Exportar CSV</button><button id="svg" type="button">Exportar SVG</button><span class="history-actions"><button id="undo" type="button">Desfazer</button><button id="redo" type="button">Refazer</button></span></nav>
    <details class="settings"><summary>Nome, descrição e categorias</summary><div class="settings-grid"><form id="document-form"><label for="project-title">Nome da linha do tempo</label><input id="project-title" required><label for="project-description">Descrição</label><textarea id="project-description" rows="3"></textarea><button type="submit">Aplicar nome e descrição</button></form><section aria-labelledby="categories-heading"><h3 id="categories-heading">Categorias</h3><ul id="categories" class="category-list"></ul><form id="category-form"><label for="category-label">Nome da categoria</label><input id="category-label" required><label for="category-color">Cor da categoria</label><select id="category-color"><option value="#2563eb">Azul</option><option value="#0f766e">Verde</option><option value="#b45309">Ocre</option><option value="#7e22ce">Violeta</option><option value="#be123c">Rosa</option><option value="#475569">Cinza</option></select><div class="inline-actions"><button type="submit" id="category-save">Adicionar categoria</button><button type="button" id="category-cancel" hidden>Cancelar edição</button></div></form></section></div></details>
    <section class="workbench" aria-label="Editor da linha do tempo"><div class="timeline-column"><div class="section-heading"><div><h3>A história, em perspectiva</h3><p id="range"></p></div><label class="zoom-label" for="zoom">Ampliação<select id="zoom"><option value="1">100%</option><option value="1.5">150%</option><option value="2">200%</option><option value="3">300%</option></select></label></div><div class="filters"><div class="search-field"><label for="query">Buscar em títulos, notas e categorias</label><input id="query" type="search" placeholder="Uma palavra da história"></div><div><label for="filter-category">Categoria</label><select id="filter-category"><option value="">Todas as categorias</option></select></div><div><label for="from">De</label><input id="from" type="date" min="0001-01-01" max="9999-12-31"></div><div><label for="to">Até</label><input id="to" type="date" min="0001-01-01" max="9999-12-31"></div><button id="clear-filters" type="button">Limpar filtros</button></div><p id="filter-error" class="error" role="alert" hidden></p><div id="legend" class="legend"></div><div class="timeline-scroll" tabindex="0" aria-label="Desenho da linha do tempo; role para explorar"><div id="timeline"></div></div><p class="diagram-help">Círculo: um dia. Barra: período com início e fim incluídos. Use a lista para selecionar e editar. Datas em calendário gregoriano, sem horários ou fusos.</p><section class="event-section" aria-labelledby="events-heading"><div class="section-heading"><h3 id="events-heading">Acontecimentos</h3><button id="add-event" class="primary" type="button">Novo evento</button></div><p id="event-count"></p><ol id="event-list" class="event-list"></ol><div id="empty" class="empty-state"><h4>Comece por um acontecimento.</h4><p>Registre uma data ou um período. Depois, conte a história no seu ritmo.</p><button id="empty-add" type="button">Criar primeiro evento</button></div></section></div><aside class="editor" aria-labelledby="editor-heading"><h3 id="editor-heading">Um lugar para cada detalhe</h3><p id="editor-intro">Selecione um acontecimento na lista ou crie um novo. Seus arquivos ficam com você.</p><form id="event-form" hidden><label for="event-title">Título do evento</label><input id="event-title" required><div class="date-pair"><div><label for="event-start">Data inicial</label><input id="event-start" type="date" min="0001-01-01" max="9999-12-31" required></div><div id="end-field"><label for="event-end">Data final</label><input id="event-end" type="date" min="0001-01-01" max="9999-12-31"></div></div><label class="check-label"><input id="is-period" type="checkbox">É um período, com mais de um dia</label><label for="event-category">Categoria</label><select id="event-category"><option value="">Sem categoria</option></select><label for="event-notes">Notas</label><textarea id="event-notes" rows="6"></textarea><p id="duration" class="form-help"></p><p id="event-error" class="error" role="alert" hidden></p><div class="inline-actions"><button type="submit" id="event-save" class="primary">Salvar evento</button><button type="button" id="event-cancel">Cancelar edição</button><button type="button" id="event-edit">Editar evento</button><button type="button" id="event-delete" class="danger">Excluir evento</button></div></form><div class="privacy-note"><h4>Local, por escolha.</h4><p>Editar não salva automaticamente. Baixe um backup JSON ou escolha salvar neste navegador. Nenhum arquivo é enviado pelo aplicativo.</p><p>CSV e SVG respeitam os filtros. O backup JSON sempre inclui o documento completo.</p></div></aside></section>
    <details class="help"><summary>Como usar e limites</summary><div><p>Inclua eventos pontuais ou períodos. As barras mostram dias reais, não meses aproximados. A ordem é cronológica; períodos sobrepostos são permitidos.</p><p>Você pode desfazer ou refazer até 20 edições nesta aba. Recarregar ou fechar a página encerra esse histórico. Salvar neste navegador não é um backup permanente: limpeza dos dados do site e modo privado podem removê-lo.</p><p>Se outra aba salvar antes de você, sua edição será preservada na memória. Baixe seu JSON antes de recarregar a cópia salva. Um documento inválido no navegador não será substituído automaticamente.</p><p>Até 200 eventos, 12 categorias e 1 MiB por backup. Anos de 0001 a 9999. Datas antigas usam o calendário gregoriano calculado, sem converter calendários históricos. O SVG pode abreviar títulos visíveis, mas mantém os títulos completos como descrições. O CSV protege células que planilhas poderiam interpretar como fórmulas.</p><p>Não há sincronização, inteligência artificial, conta, telemetria ou anexos. O primeiro carregamento e a atualização da página precisam da hospedagem ou de um servidor local; esta edição não é uma PWA.</p></div></details></main><footer>Feito para histórias que merecem ser organizadas. <a href="https://github.com/martinlofranodeoliveira/linha-do-tempo-aberta/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">MIT · LOFRANO TECNOLOGIA</a></footer>
    <div id="confirmation" class="modal-layer" hidden><section class="modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message" tabindex="-1"><h2 id="confirm-title"></h2><p id="confirm-message"></p><div class="inline-actions"><button id="confirm-cancel" type="button">Cancelar</button><button id="confirm-accept" class="primary" type="button">Confirmar</button></div></section></div>`;
  const $ = (id) => root.querySelector(`#${id}`);
  const text = (id, value) => {
    $(id).textContent = value;
  };
  const message = (value) => {
    text("notice", value);
    $("notice").hidden = !value;
  };
  const dirty = () => serializeDocument(current) !== lastSaved;
  let categoryEdit = null;
  function uniqueId(prefix, items) {
    let id;
    do {
      id = `${prefix}_${win.crypto?.randomUUID?.().replaceAll("-", "").slice(0, 24) ?? Math.random().toString(36).slice(2)}`;
    } while (items.some((item) => item.id === id));
    return id;
  }
  function confirm(
    title,
    description,
    action,
    label = "Confirmar",
    kind = null,
  ) {
    returnFocus = doc.activeElement;
    pendingConfirmation = action;
    confirmationKind = kind;
    text("confirm-title", title);
    text("confirm-message", description);
    text("confirm-accept", label);
    $("confirmation").hidden = false;
    $("confirmation").querySelector(".modal").focus();
  }
  function closeConfirmation() {
    $("confirmation").hidden = true;
    pendingConfirmation = null;
    confirmationKind = null;
    returnFocus?.focus();
  }
  $("confirm-cancel").onclick = closeConfirmation;
  $("confirm-accept").onclick = () => {
    const fn = pendingConfirmation;
    closeConfirmation();
    fn?.();
  };
  $("confirmation").onkeydown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeConfirmation();
    }
    if (event.key === "Tab") {
      const nodes = [$("confirm-cancel"), $("confirm-accept")];
      const i = nodes.indexOf(doc.activeElement);
      event.preventDefault();
      nodes[(i + (event.shiftKey ? 1 : 1)) % 2]?.focus();
    }
  };
  function guardDraft(action, kind = null) {
    if (mode !== "view")
      confirm(
        "Descartar a edição do evento?",
        "Os campos ainda não aplicados serão descartados. Os eventos já salvos na linha do tempo continuam disponíveis.",
        action,
        "Descartar edição",
        kind,
      );
    else action();
  }
  function mutate(next, notice = "") {
    const validated = validateDocument(next);
    undo.push(serializeDocument(current));
    if (undo.length > 20) undo.shift();
    redo = [];
    current = validated;
    mode = "view";
    if (!current.events.some((e) => e.id === selectedId)) selectedId = null;
    message(notice);
    render();
  }
  function button(label, action, className) {
    const el = doc.createElement("button");
    el.type = "button";
    el.textContent = label;
    if (className) el.className = className;
    el.onclick = action;
    return el;
  }
  function option(select, value, label) {
    const el = doc.createElement("option");
    el.value = value;
    el.textContent = label;
    select.append(el);
  }
  function categories() {
    const list = $("categories");
    list.replaceChildren();
    for (const c of current.categories) {
      const li = doc.createElement("li");
      const label = doc.createElement("span");
      label.className = "category-name";
      label.dataset.color = c.color;
      label.textContent = c.label;
      li.append(
        label,
        button(`Editar ${c.label}`, () => {
          categoryEdit = c.id;
          $("category-label").value = c.label;
          $("category-color").value = c.color;
          text("category-save", "Salvar categoria");
          $("category-cancel").hidden = false;
          $("category-label").focus();
        }),
        button(
          `Excluir ${c.label}`,
          () => {
            const n = current.events.filter(
              (e) => e.categoryId === c.id,
            ).length;
            confirm(
              "Excluir categoria?",
              `${n} evento(s) passarão a ficar sem categoria. Os eventos serão preservados.`,
              () => {
                mutate({
                  ...current,
                  categories: current.categories.filter((x) => x.id !== c.id),
                  events: current.events.map((e) =>
                    e.categoryId === c.id ? { ...e, categoryId: null } : e,
                  ),
                });
                resetCategory();
              },
              "Excluir categoria",
            );
          },
          "danger",
        ),
      );
      list.append(li);
    }
    for (const id of ["filter-category", "event-category"]) {
      const select = $(id),
        before = select.value;
      select.replaceChildren();
      option(
        select,
        "",
        id === "filter-category" ? "Todas as categorias" : "Sem categoria",
      );
      current.categories.forEach((c) => option(select, c.id, c.label));
      select.value = current.categories.some((c) => c.id === before)
        ? before
        : "";
    }
    if (
      filters.categoryIds.some(
        (id) => !current.categories.some((c) => c.id === id),
      )
    )
      filters.categoryIds = [];
    $("filter-category").value = filters.categoryIds[0] ?? "";
    const legend = $("legend");
    legend.replaceChildren();
    current.categories.forEach((c) => {
      const span = doc.createElement("span");
      span.dataset.color = c.color;
      span.textContent = c.label;
      legend.append(span);
    });
  }
  function resetCategory() {
    categoryEdit = null;
    $("category-form").reset();
    text("category-save", "Adicionar categoria");
    $("category-cancel").hidden = true;
  }
  function svgElement(name, attrs = {}, content) {
    const el = doc.createElementNS(svgNS, name);
    for (const [key, value] of Object.entries(attrs))
      el.setAttribute(key, String(value));
    if (content !== undefined) el.textContent = content;
    return el;
  }
  function showTimeline(layout) {
    const svg = svgElement("svg", {
      viewBox: `0 0 ${layout.width} ${layout.height}`,
      width: layout.width * zoom,
      height: layout.height * zoom,
      role: "img",
      "aria-label":
        "Datas e durações dos eventos filtrados. A lista textual permite selecionar cada evento.",
    });
    svg.append(
      svgElement("title", {}, current.title),
      svgElement("rect", {
        x: 0,
        y: 0,
        width: layout.width,
        height: layout.height,
        fill: "#ffffff",
      }),
    );
    if (!layout.rows.length)
      svg.append(
        svgElement(
          "text",
          {
            x: 36,
            y: 100,
            fill: "#475569",
            "font-family": "sans-serif",
            "font-size": 20,
          },
          current.events.length
            ? "Nenhum evento corresponde aos filtros."
            : "Sua primeira data começa aqui.",
        ),
      );
    else {
      for (const tick of layout.ticks)
        svg.append(
          svgElement("line", {
            x1: tick.x,
            x2: tick.x,
            y1: 95,
            y2: layout.height - 70,
            stroke: "#e2e8f0",
          }),
          svgElement(
            "text",
            {
              x: tick.x,
              y: 72,
              "text-anchor": "middle",
              fill: "#334155",
              "font-family": "sans-serif",
              "font-size": 15,
            },
            asDate(tick.date),
          ),
        );
      for (const row of layout.rows) {
        const group = svgElement("g");
        group.append(
          svgElement(
            "title",
            {},
            `${row.event.title}: ${asDate(row.event.start)} a ${asDate(row.event.end)}, ${row.days} dia(s)`,
          ),
        );
        if (row.event.id === selectedId)
          group.append(
            svgElement("rect", {
              x: 12,
              y: row.y - 29,
              width: 1176,
              height: 58,
              rx: 8,
              fill: "#eff6ff",
            }),
          );
        group.append(
          svgElement(
            "text",
            {
              x: 28,
              y: row.y - 3,
              fill: "#172033",
              "font-family": "sans-serif",
              "font-size": 16,
              textLength: Math.min(
                228,
                Array.from(row.event.title).length * 8.2,
              ),
              lengthAdjust: "spacingAndGlyphs",
            },
            Array.from(row.event.title).slice(0, 34).join("") +
              (Array.from(row.event.title).length > 34 ? "…" : ""),
          ),
          svgElement(
            "text",
            {
              x: 28,
              y: row.y + 20,
              fill: "#475569",
              "font-family": "sans-serif",
              "font-size": 13,
            },
            `${asDate(row.event.start)}${row.days > 1 ? ` · ${row.days} dias` : " · um dia"}`,
          ),
        );
        group.append(
          svgElement("line", {
            x1: 300,
            x2: 1150,
            y1: row.y,
            y2: row.y,
            stroke: "#e2e8f0",
          }),
        );
        if (row.days === 1)
          group.append(
            svgElement("circle", {
              cx: row.x1,
              cy: row.y,
              r: 8,
              fill: row.color,
            }),
          );
        else
          group.append(
            svgElement("rect", {
              x: row.x1,
              y: row.y - 7,
              width: Math.max(2, row.x2 - row.x1),
              height: 14,
              rx: 3,
              fill: row.color,
            }),
          );
        svg.append(group);
      }
    }
    $("timeline").dataset.zoom = String(zoom);
    $("timeline").replaceChildren(svg);
  }
  function renderList() {
    let events, layout;
    try {
      events = filterEvents(current, { ...filters, selectedId });
      layout = layoutTimeline(current, { ...filters, selectedId });
      $("filter-error").hidden = true;
    } catch {
      text(
        "filter-error",
        "Revise os filtros: use datas válidas, início até o fim e uma busca de até 120 caracteres.",
      );
      $("filter-error").hidden = false;
      return;
    }
    text(
      "range",
      layout.range
        ? `${asDate(layout.range.start)} — ${asDate(layout.range.end)}`
        : "O tempo ganha forma quando você inclui um evento.",
    );
    text(
      "event-count",
      `${events.length} de ${current.events.length} evento(s) · ordem cronológica`,
    );
    const list = $("event-list");
    list.replaceChildren();
    for (const event of events) {
      const li = doc.createElement("li");
      const b = button("", () =>
        guardDraft(() => {
          selectedId = event.id;
          mode = "view";
          renderList();
          renderEditor();
          $("editor-heading").focus();
        }),
      );
      b.className = "event-row";
      b.dataset.selected = String(event.id === selectedId);
      b.setAttribute("aria-pressed", String(event.id === selectedId));
      const title = doc.createElement("strong");
      title.textContent = event.title;
      const detail = doc.createElement("span");
      detail.textContent = `${asDate(event.start)}${event.start !== event.end ? ` até ${asDate(event.end)}` : ""}`;
      const category = doc.createElement("span");
      const c = current.categories.find((c) => c.id === event.categoryId);
      category.className = "category-name";
      category.dataset.color = c?.color ?? "#475569";
      category.textContent = c?.label ?? "Sem categoria";
      b.append(title, detail, category);
      li.append(b);
      list.append(li);
    }
    $("empty").hidden = current.events.length !== 0;
    if (!events.length && current.events.length) {
      const li = doc.createElement("li");
      li.textContent = "Nenhum evento encontrado. Você pode limpar os filtros.";
      list.append(li);
    }
    showTimeline(layout);
  }
  function renderEditor() {
    const event = current.events.find((e) => e.id === selectedId);
    $("event-error").hidden = true;
    $("editor-heading").tabIndex = -1;
    if (mode === "view" && !event) {
      $("event-form").hidden = true;
      $("editor-intro").hidden = false;
      text("editor-heading", "Um lugar para cada detalhe");
      return;
    }
    $("event-form").hidden = false;
    $("editor-intro").hidden = true;
    text(
      "editor-heading",
      mode === "new"
        ? "Novo evento"
        : mode === "edit"
          ? "Editar evento"
          : "Detalhes do evento",
    );
    const value =
      mode === "new"
        ? { title: "", start: "", end: "", categoryId: null, notes: "" }
        : event;
    $("event-title").value = value.title;
    $("event-start").value = value.start;
    $("event-end").value = value.end;
    $("is-period").checked = value.end !== value.start;
    $("event-category").value = value.categoryId ?? "";
    $("event-notes").value = value.notes;
    for (const id of [
      "event-title",
      "event-start",
      "event-end",
      "is-period",
      "event-category",
      "event-notes",
    ])
      $(id).disabled = mode === "view" || busy;
    $("event-save").hidden = mode === "view";
    $("event-cancel").hidden = mode === "view";
    $("event-edit").hidden = mode !== "view";
    $("event-delete").hidden = mode !== "view";
    updateDuration();
  }
  function updateDuration() {
    $("end-field").hidden = !$("is-period").checked;
    $("event-end").required = $("is-period").checked;
    try {
      const start = dateToOrdinal($("event-start").value),
        end = dateToOrdinal(
          $("is-period").checked
            ? $("event-end").value
            : $("event-start").value,
        );
      text(
        "duration",
        end >= start
          ? `${end - start + 1} dia(s), incluindo início e fim.`
          : "A data final precisa ser igual ou posterior à inicial.",
      );
    } catch {
      text("duration", "Informe as datas para conferir a duração.");
    }
  }
  function renderStatus() {
    text(
      "save-status",
      busy
        ? "Abrindo ou salvando a cópia local…"
        : dirty()
          ? "Alterações na memória · baixe um backup ou salve neste navegador"
          : revision
            ? `Cópia deste navegador · revisão ${revision}`
            : "Documento na memória · salvamento opcional",
    );
  }
  function render() {
    text("document-title", current.title);
    text("document-description", current.description);
    $("project-title").value = current.title;
    $("project-description").value = current.description;
    categories();
    renderList();
    renderEditor();
    renderStatus();
    for (const el of root.querySelectorAll("button,input,select,textarea"))
      el.disabled = busy;
    if (!busy) {
      $("undo").disabled = !undo.length;
      $("redo").disabled = !redo.length;
      for (const id of [
        "event-title",
        "event-start",
        "event-end",
        "is-period",
        "event-category",
        "event-notes",
      ])
        $(id).disabled = mode === "view";
    }
    root.setAttribute("aria-busy", String(busy));
  }
  function replaceDocument(next, notice) {
    current = validateDocument(next);
    selectedId = null;
    mode = "view";
    filters = { query: "", categoryIds: [], from: null, to: null };
    $("query").value = "";
    $("from").value = "";
    $("to").value = "";
    resetCategory();
    message(notice);
    render();
  }
  function nextDocument(next, notice) {
    mutate(next, notice);
    selectedId = null;
    mode = "view";
    filters = { query: "", categoryIds: [], from: null, to: null };
    $("query").value = "";
    $("from").value = "";
    $("to").value = "";
    resetCategory();
    render();
  }
  function replaceAction(next, notice) {
    guardDraft(() => {
      if (dirty() || current.events.length || current.categories.length)
        confirm(
          "Substituir o documento na memória?",
          "Baixe um backup JSON se quiser guardar o documento atual. A cópia salva no navegador só muda quando você escolher salvar.",
          () => nextDocument(next, notice),
          "Substituir documento",
        );
      else nextDocument(next, notice);
    });
  }
  $("new").onclick = () => replaceAction(blank(), "Novo documento na memória.");
  $("example").onclick = () =>
    replaceAction(
      example,
      "Exemplo fictício carregado. Nenhuma informação representa pessoas ou acontecimentos reais.",
    );
  function addEvent() {
    guardDraft(() => {
      selectedId = null;
      mode = "new";
      renderEditor();
      $("event-title").focus();
    });
  }
  $("add-event").onclick = addEvent;
  $("empty-add").onclick = addEvent;
  $("event-edit").onclick = () => {
    mode = "edit";
    renderEditor();
    $("event-title").focus();
  };
  $("event-cancel").onclick = () => {
    mode = "view";
    renderEditor();
  };
  $("is-period").onchange = updateDuration;
  $("event-start").onchange = () => {
    if (!$("event-end").value) $("event-end").value = $("event-start").value;
    updateDuration();
  };
  $("event-end").onchange = updateDuration;
  $("event-form").onsubmit = (event) => {
    event.preventDefault();
    if (busy || mode === "view") return;
    const id = mode === "new" ? uniqueId("evento", current.events) : selectedId;
    const value = {
      id,
      title: $("event-title").value,
      start: $("event-start").value,
      end: $("is-period").checked
        ? $("event-end").value
        : $("event-start").value,
      categoryId: $("event-category").value || null,
      notes: $("event-notes").value,
    };
    try {
      const next = {
        ...current,
        events: [...current.events.filter((e) => e.id !== id), value],
      };
      validateDocument(next);
      selectedId = id;
      mutate(next, "Evento aplicado à linha do tempo.");
    } catch (e) {
      text(
        "event-error",
        `${e.message ?? "Não foi possível aplicar o evento."} Revise título, datas e notas. Sua edição foi preservada.`,
      );
      $("event-error").hidden = false;
    }
  };
  $("event-delete").onclick = () =>
    confirm(
      "Excluir evento?",
      "O evento será removido do documento na memória. Você poderá desfazer enquanto esta aba continuar aberta.",
      () =>
        mutate(
          {
            ...current,
            events: current.events.filter((e) => e.id !== selectedId),
          },
          "Evento excluído.",
        ),
      "Excluir evento",
    );
  $("document-form").onsubmit = (event) => {
    event.preventDefault();
    try {
      const next = validateDocument({
        ...current,
        title: $("project-title").value,
        description: $("project-description").value,
      });
      guardDraft(() => mutate(next, "Nome e descrição aplicados."));
    } catch (e) {
      message(`${e.message} O documento foi preservado.`);
    }
  };
  $("category-form").onsubmit = (event) => {
    event.preventDefault();
    const id = categoryEdit ?? uniqueId("categoria", current.categories);
    try {
      const next = validateDocument({
        ...current,
        categories: [
          ...current.categories.filter((c) => c.id !== id),
          {
            id,
            label: $("category-label").value,
            color: $("category-color").value,
          },
        ],
      });
      guardDraft(() => {
        mutate(next, "Categoria aplicada.");
        resetCategory();
      });
    } catch (e) {
      message(`${e.message} A categoria não foi alterada.`);
    }
  };
  $("category-cancel").onclick = resetCategory;
  $("undo").onclick = () =>
    guardDraft(() => {
      if (undo.length) {
        redo.push(serializeDocument(current));
        replaceDocument(parseDocument(undo.pop()), "Edição desfeita.");
      }
    });
  $("redo").onclick = () =>
    guardDraft(() => {
      if (redo.length) {
        undo.push(serializeDocument(current));
        replaceDocument(parseDocument(redo.pop()), "Edição refeita.");
      }
    });
  function updateFilters() {
    filters = {
      query: $("query").value,
      categoryIds: $("filter-category").value
        ? [$("filter-category").value]
        : [],
      from: $("from").value || null,
      to: $("to").value || null,
    };
    renderList();
  }
  $("query").oninput = updateFilters;
  for (const id of ["filter-category", "from", "to"])
    $(id).onchange = updateFilters;
  $("clear-filters").onclick = () => {
    $("query").value = "";
    $("filter-category").value = "";
    $("from").value = "";
    $("to").value = "";
    updateFilters();
  };
  $("zoom").onchange = () => {
    zoom = Number($("zoom").value);
    renderList();
  };
  function exportFile(kind) {
    try {
      const stem =
        current.title
          .normalize("NFD")
          .replace(/\p{M}/gu, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 60) || "linha-do-tempo";
      const types = {
        json: "application/json;charset=utf-8",
        csv: "text/csv;charset=utf-8",
        svg: "image/svg+xml;charset=utf-8",
      };
      const result =
        kind === "json"
          ? serializeDocument(current)
          : kind === "csv"
            ? exportCSV(current, { ...filters, selectedId })
            : renderSVG(current, { ...filters, selectedId });
      download(`${stem}.${kind}`, result, types[kind]);
      const draftNotice =
        mode !== "view"
          ? " Os campos do rascunho ainda não aplicados ficaram fora deste arquivo. Salve o evento para incluí-los."
          : "";
      message(
        (kind === "json"
          ? "Backup completo preparado para download."
          : "Exportação dos eventos filtrados preparada para download.") +
          draftNotice,
      );
    } catch (e) {
      message(
        `Não foi possível exportar. ${e.message ?? ""} O documento foi preservado.`,
      );
    }
  }
  for (const kind of ["json", "csv", "svg"])
    $(kind).onclick = () => exportFile(kind);
  $("import").onclick = () => $("import-file").click();
  $("import-file").onchange = async () => {
    const file = $("import-file").files?.[0];
    $("import-file").value = "";
    if (!file) return;
    const epoch = ++importEpoch;
    importCandidate = null;
    if (confirmationKind === "import" || confirmationKind === "import-draft")
      closeConfirmation();
    try {
      if (file.size > 1048576) throw new Error("O arquivo excede 1 MiB.");
      const raw = new TextDecoder("utf-8", { fatal: true }).decode(
        await file.arrayBuffer(),
      );
      const parsed = parseDocument(raw);
      if (epoch !== importEpoch || disposed) return;
      importCandidate = parsed;
      const candidate = importCandidate;
      guardDraft(() => {
        if (epoch !== importEpoch || disposed) return;
        confirm(
          "Importar este documento?",
          `${candidate.title} · ${candidate.events.length} evento(s) e ${candidate.categories.length} categoria(s). A importação substituirá somente o documento na memória. Baixe antes um backup do trabalho atual.`,
          () => {
            if (epoch !== importEpoch || disposed) return;
            nextDocument(
              candidate,
              "Documento importado. A cópia salva no navegador não foi alterada.",
            );
            importCandidate = null;
          },
          "Importar documento",
          "import",
        );
      }, "import-draft");
    } catch (e) {
      if (epoch !== importEpoch || disposed) return;
      importCandidate = null;
      message(
        `Não foi possível importar. ${e.message ?? "Arquivo inválido."} Seu trabalho foi preservado.`,
      );
    }
  };
  $("save").onclick = async () => {
    if (busy) return;
    if (mode !== "view") {
      message(
        "Aplique ou cancele a edição do evento antes de salvar o documento.",
      );
      return;
    }
    busy = true;
    render();
    const snapshot = validateDocument(current);
    try {
      const result = await storage.save(revision, snapshot);
      revision = result.revision;
      lastSaved = serializeDocument(snapshot);
      channel?.postMessage({ type: "saved", revision });
      message(
        "Cópia salva neste navegador. Continue mantendo seu backup JSON.",
      );
    } catch (e) {
      message(
        `${e.message ?? "Não foi possível salvar."} Baixe um backup JSON para guardar seu trabalho.`,
      );
    } finally {
      busy = false;
      if (!disposed) render();
    }
  };
  async function reload() {
    busy = true;
    render();
    try {
      const saved = await storage.read();
      revision = saved?.revision ?? 0;
      undo = [];
      redo = [];
      replaceDocument(
        saved?.document ?? blank(),
        saved
          ? "Cópia do navegador recarregada."
          : "Não há cópia salva neste navegador.",
      );
      lastSaved = serializeDocument(current);
    } catch (e) {
      message(
        `${e.message ?? "Não foi possível ler."} O documento na memória foi preservado.`,
      );
    } finally {
      busy = false;
      if (!disposed) render();
    }
  }
  $("reload").onclick = () =>
    guardDraft(() => {
      if (dirty())
        confirm(
          "Recarregar a cópia salva?",
          "As alterações na memória serão descartadas. Baixe um backup JSON antes, se precisar preservá-las.",
          reload,
          "Recarregar cópia",
        );
      else reload();
    });
  if (channel)
    channel.onmessage = (event) => {
      if (event.data?.type === "saved" && event.data.revision !== revision)
        message(
          "Outra aba salvou uma nova revisão. Sua edição continua na memória: baixe um backup ou recarregue a cópia salva antes de salvar novamente.",
        );
    };
  const beforeUnload = (event) => {
    if (dirty() || mode !== "view") {
      event.preventDefault();
      event.returnValue = "";
    }
  };
  win.addEventListener("beforeunload", beforeUnload);
  render();
  const ready = reload();
  return Object.freeze({
    ready,
    getDocument: () => validateDocument(current),
    getRevision: () => revision,
    dispose() {
      disposed = true;
      importEpoch++;
      channel?.close();
      win.removeEventListener("beforeunload", beforeUnload);
    },
  });
}
