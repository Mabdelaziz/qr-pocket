import type { QrMatrix } from '../qr/encode';
import { drawQr } from '../render/canvas';
import { debounce } from '../util/debounce';
import { deriveView, type GenerateState, type PanelModel, type ViewModel } from './model';

const SVG_NS = 'http://www.w3.org/2000/svg';
const LIVE_DELAY_MS = 150;

function byId<T extends HTMLElement>(id: string, type: new () => T): T {
  const node = document.getElementById(id);
  if (!(node instanceof type)) throw new Error(`#${id} is missing or has the wrong type`);
  return node;
}

function icon(name: string, cls: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', cls);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `#i-${name}`);
  svg.append(use);
  return svg;
}

/** Builds a status panel with DOM APIs only; user text never reaches here (messages are fixed strings + numbers). */
function buildPanel(model: PanelModel): HTMLElement {
  const panel = document.createElement('div');
  panel.className = `panel p-${model.kind}`;
  if (model.kind === 'error') panel.setAttribute('role', 'alert'); // warnings are announced via #sr-status (one channel)
  panel.append(icon(model.kind === 'error' ? 'error' : 'warn', 'ico pico'));

  const body = document.createElement('div');
  body.className = 'pbody';
  const title = document.createElement('p');
  title.className = 'ptitle';
  const prefix = document.createElement('span');
  prefix.className = 'sr';
  prefix.textContent = model.kind === 'error' ? 'Error: ' : 'Warning: ';
  title.append(prefix, model.title);
  body.append(title);
  if (model.body) {
    const text = document.createElement('p');
    text.className = 'pdetail';
    text.setAttribute('aria-live', 'off'); // byte counts change while typing; do not re-announce them
    text.textContent = model.body;
    body.append(text);
  }
  if (model.action) {
    const actions = document.createElement('div');
    actions.className = 'pact';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-tonal';
    button.dataset['action'] = model.action.id;
    button.textContent = model.action.label;
    actions.append(button);
    body.append(actions);
  }
  panel.append(body);
  return panel;
}

export function initGenerate(): void {
  const input = byId('text', HTMLTextAreaElement);
  const counter = byId('count', HTMLElement);
  const hint = byId('hint', HTMLElement);
  const clear = byId('clear', HTMLButtonElement);
  const eccRow = byId('ecc-low', HTMLElement);
  const back = byId('ecc-back', HTMLButtonElement);
  const panelHost = byId('panel-host', HTMLElement);
  const previewHost = byId('preview', HTMLElement);
  const srStatus = byId('sr-status', HTMLElement);

  // Preview building blocks are created once and swapped in/out.
  const canvas = document.createElement('canvas');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'QR code for the text you entered');
  const qrBox = document.createElement('div');
  qrBox.className = 'pv';
  qrBox.append(canvas);
  const emptyBox = document.createElement('div');
  emptyBox.className = 'pvempty';
  const emptyText = document.createElement('p');
  emptyBox.append(icon('gen', 'ico big'), emptyText);

  // Restore-safe: a browser may re-populate the field (reload / back-forward cache).
  let state: GenerateState = { text: input.value, ecc: 'M', touched: input.value.length > 0 };
  let shownPanelKey = '';
  let shownAnnounce = '';
  let shownPreview: 'qr' | 'text' | '' = '';
  let currentMatrix: QrMatrix | null = null;

  function drawCurrent(): void {
    if (!currentMatrix) return;
    const cs = getComputedStyle(qrBox);
    const inner = qrBox.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    drawQr(canvas, currentMatrix, inner, window.devicePixelRatio || 1);
  }

  function renderPanel(panel: PanelModel | null): void {
    const key = panel ? panel.key : '';
    if (key === shownPanelKey) {
      // Same message: keep the element (no rebuild, no re-announce) but refresh the numbers in its detail line.
      const detail = panelHost.querySelector('.pdetail');
      if (panel && detail && detail.textContent !== panel.body) detail.textContent = panel.body;
      return;
    }
    shownPanelKey = key;
    panelHost.replaceChildren(...(panel ? [buildPanel(panel)] : []));
  }

  function renderPreview(vm: ViewModel): void {
    if (vm.preview.kind === 'qr') {
      if (shownPreview !== 'qr') {
        previewHost.replaceChildren(qrBox);
        shownPreview = 'qr';
      }
      currentMatrix = vm.preview.matrix;
      drawCurrent();
    } else {
      currentMatrix = null;
      emptyText.textContent = vm.preview.label;
      if (shownPreview !== 'text') {
        previewHost.replaceChildren(emptyBox);
        shownPreview = 'text';
      }
    }
  }

  function render(): void {
    const vm = deriveView(state);
    counter.textContent = vm.counter;
    hint.hidden = !vm.showHint;
    clear.hidden = !vm.clearVisible;
    eccRow.hidden = !vm.eccLowVisible;
    if (vm.invalid) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
    renderPanel(vm.panel);
    renderPreview(vm);
    if (vm.announce !== shownAnnounce) {
      shownAnnounce = vm.announce;
      srStatus.textContent = vm.announce;
    }
  }

  const renderLive = debounce(render, LIVE_DELAY_MS);

  input.addEventListener('input', () => {
    state = { ...state, text: input.value, touched: true };
    renderLive();
  });

  clear.addEventListener('click', () => {
    renderLive.cancel();
    state = { text: '', ecc: 'M', touched: false };
    input.value = '';
    render();
    input.focus();
  });

  panelHost.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element) || !target.closest('[data-action="use-low"]')) return;
    renderLive.cancel();
    state = { ...state, text: input.value, ecc: 'L' };
    render();
    back.focus(); // the pressed button is gone; keep focus in the flow without opening the keyboard
  });

  back.addEventListener('click', () => {
    renderLive.cancel();
    state = { ...state, text: input.value, ecc: 'M' };
    render();
    const next = panelHost.querySelector<HTMLElement>('[data-action="use-low"]');
    (next ?? input).focus();
  });

  // Keep the QR crisp when the container width changes (rotation, window resize).
  let lastWidth = window.innerWidth;
  window.addEventListener('resize', () => {
    if (window.innerWidth === lastWidth) return;
    lastWidth = window.innerWidth;
    drawCurrent();
  });

  render();
}
