import { downloadBlob } from '../export/download';
import { pngFilename } from '../export/filename';
import { renderPngBlob } from '../export/png';
import type { Ecc, QrMatrix } from '../qr/encode';
import { drawQr } from '../render/canvas';
import { shareImageFile } from '../share/share';
import { defaultTitle } from '../store/titles';
import { StoreError, type CodeStore, type SavedCode } from '../store/types';
import { debounce } from '../util/debounce';
import { announce } from './announce';
import { byId, el, icon } from './dom';
import { deriveView, type GenerateState } from './model';
import { createPanelHost, type PanelModel } from './panels';
import { afterDelete, canStartSave, contentKey, SAVE_IDLE, saveButtonState, type SaveButtonState, type SaveUi } from './saveState';
import { storeErrorText } from './savedModel';

const LIVE_DELAY_MS = 150;

function setBusy(button: HTMLElement, on: boolean): void {
  if (on) button.setAttribute('aria-busy', 'true');
  else button.removeAttribute('aria-busy');
}

export interface GenerateDeps {
  readonly store: CodeStore;
  /** Whether the browser can share image files; when false the Share button is hidden. */
  readonly canShare: boolean;
  /** Called once, the first time a QR code is shown: the visitor is using the app (gates the install prompt). */
  readonly onFirstQr?: () => void;
}

export interface GenerateApi {
  /** Load a saved item into the editor (Save then shows "Saved" until the content changes). */
  load(item: Pick<SavedCode, 'id' | 'payload' | 'ecc'>): void;
  /** A saved record was deleted elsewhere; resets the Save state if it referred to that record. */
  onDeleted(id: string): void;
  focusInput(): void;
  /** Redraw the preview at the size of the now-visible container (call when the Generate view is shown). */
  refresh(): void;
}

interface ActionNote {
  /** The content the note belongs to; it disappears as soon as the text or level changes. */
  readonly contentKey: string;
  readonly panel: PanelModel;
}

export function initGenerate(deps: GenerateDeps): GenerateApi {
  const input = byId('text', HTMLTextAreaElement);
  const counter = byId('count', HTMLElement);
  const hint = byId('hint', HTMLElement);
  const clear = byId('clear', HTMLButtonElement);
  const eccRow = byId('ecc-low', HTMLElement);
  const back = byId('ecc-back', HTMLButtonElement);
  const previewHost = byId('preview', HTMLElement);
  const saveButton = byId('save', HTMLButtonElement);
  const downloadButton = byId('download', HTMLButtonElement);
  const shareButton = byId('share', HTMLButtonElement);
  const shareNote = byId('share-note', HTMLElement);
  const validationPanel = createPanelHost(byId('panel-host', HTMLElement));
  const actionHost = byId('action-panel', HTMLElement);
  const actionPanel = createPanelHost(actionHost);

  // Preview building blocks are created once and swapped in/out.
  const canvas = document.createElement('canvas');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'QR code for the text you entered');
  const qrBox = el('div', 'pv');
  qrBox.append(canvas);
  const emptyBox = el('div', 'pvempty');
  const emptyText = el('p');
  emptyBox.append(icon('gen', 'ico big'), emptyText);

  // Restore-safe: a browser may re-populate the field (reload / back-forward cache).
  let state: GenerateState = { text: input.value, ecc: 'M', touched: input.value.length > 0 };
  let saveUi: SaveUi = SAVE_IDLE;
  let note: ActionNote | null = null;
  let busy: 'download' | 'share' | null = null;
  let hasQr = false;
  let currentMatrix: QrMatrix | null = null;
  let shownAnnounce = '';
  let shownPreview: 'qr' | 'text' | '' = '';
  let shownSaveState: SaveButtonState | '' = '';
  let reportedFirstQr = false;

  shareButton.hidden = !deps.canShare;
  shareNote.hidden = deps.canShare;

  const keyNow = (): string => contentKey(state.text, state.ecc);

  function drawCurrent(): void {
    if (!currentMatrix) return;
    if (qrBox.clientWidth === 0) return; // the view is hidden (e.g. Open from Saved): draw when it is shown, see refresh()
    const cs = getComputedStyle(qrBox);
    const inner = qrBox.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    drawQr(canvas, currentMatrix, inner, window.devicePixelRatio || 1);
  }

  function renderSaveButton(current: SaveButtonState): void {
    if (current !== shownSaveState) {
      shownSaveState = current;
      saveButton.classList.toggle('btn-done', current === 'saved');
      saveButton.classList.toggle('btn-primary', current !== 'saved');
      if (current === 'saved') saveButton.replaceChildren(icon('ok', 'ico'), 'Saved');
      else saveButton.replaceChildren(current === 'saving' ? 'Saving…' : 'Save');
    }
    setBusy(saveButton, current === 'saving');
  }

  function renderActions(): void {
    const key = keyNow();
    const saveState = saveButtonState(saveUi, key);
    renderSaveButton(saveState);
    // Not activatable (and muted, without explanatory text) when there is nothing to act on; the saving and
    // saved states are inactive too, so a repeat press does nothing (no accidental duplicate records).
    saveButton.setAttribute('aria-disabled', String(!canStartSave(saveUi, key, hasQr)));
    downloadButton.setAttribute('aria-disabled', String(!hasQr || busy !== null));
    shareButton.setAttribute('aria-disabled', String(!hasQr || busy !== null));
    setBusy(downloadButton, busy === 'download');
    setBusy(shareButton, busy === 'share');
    actionPanel.show(note && note.contentKey === key ? note.panel : null);
  }

  function renderPreview(matrix: QrMatrix | null, label: string): void {
    if (matrix) {
      if (shownPreview !== 'qr') {
        previewHost.replaceChildren(qrBox);
        shownPreview = 'qr';
      }
      currentMatrix = matrix;
      drawCurrent();
    } else {
      currentMatrix = null;
      emptyText.textContent = label;
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
    validationPanel.show(vm.panel);
    hasQr = vm.preview.kind === 'qr';
    if (hasQr && !reportedFirstQr) {
      reportedFirstQr = true;
      deps.onFirstQr?.();
    }
    renderPreview(vm.preview.kind === 'qr' ? vm.preview.matrix : null, vm.preview.kind === 'qr' ? '' : vm.preview.label);
    renderActions();
    if (vm.announce !== shownAnnounce) {
      shownAnnounce = vm.announce;
      announce(vm.announce);
    }
  }

  const renderLive = debounce(render, LIVE_DELAY_MS);

  /** Actions must see the latest typing, not the last debounced render. */
  function syncNow(): void {
    renderLive.cancel();
    state = { ...state, text: input.value };
    render();
  }

  function setNote(panel: PanelModel | null, forKey: string = keyNow()): void {
    note = panel ? { contentKey: forKey, panel } : null;
  }

  // ---- Save
  async function doSave(): Promise<void> {
    syncNow();
    const key = keyNow();
    if (!canStartSave(saveUi, key, hasQr)) return; // not shown, already saving, or already saved: ignore (no duplicates)
    const { text, ecc } = state;
    saveUi = { kind: 'saving', key };
    setNote(null);
    renderActions();
    try {
      const record = await deps.store.add({ payload: text, ecc, source: 'typed' });
      if (saveUi.kind === 'saving' && saveUi.key === key) saveUi = { kind: 'saved', key, id: record.id };
      setNote({ kind: 'success', key: 'saved', title: 'Saved to this device', body: 'Clearing browser data may erase saved codes — there’s no backup.' }, key);
      announce('Saved to this device.');
    } catch (error) {
      if (saveUi.kind === 'saving' && saveUi.key === key) saveUi = SAVE_IDLE;
      const text2 = storeErrorText('save', error instanceof StoreError ? error.kind : 'unknown');
      setNote(
        { kind: 'error', key: 'save-failed', title: text2.title, body: text2.body, actions: [{ id: 'retry-save', label: 'Try again' }] },
        key,
      );
    }
    renderActions();
  }

  // ---- Download / Share
  async function makeFile(matrix: QrMatrix, text: string): Promise<{ blob: Blob; filename: string }> {
    const now = new Date();
    return { blob: await renderPngBlob(matrix), filename: pngFilename(defaultTitle(text, now), now) };
  }

  async function doDownload(): Promise<void> {
    syncNow();
    const matrix = currentMatrix;
    if (!hasQr || !matrix || busy) return;
    const key = keyNow();
    const text = state.text;
    busy = 'download';
    setNote(null);
    renderActions();
    try {
      const { blob, filename } = await makeFile(matrix, text);
      downloadBlob(blob, filename);
    } catch {
      setNote(
        { kind: 'error', key: 'export-failed', title: 'Couldn’t create the PNG', body: 'Something went wrong while creating the image.', actions: [{ id: 'retry-download', label: 'Try again' }] },
        key,
      );
    }
    busy = null;
    renderActions();
  }

  async function doShare(): Promise<void> {
    syncNow();
    const matrix = currentMatrix;
    if (!deps.canShare || !hasQr || !matrix || busy) return;
    const key = keyNow();
    const text = state.text;
    busy = 'share';
    setNote(null);
    renderActions();
    try {
      const { blob, filename } = await makeFile(matrix, text);
      await shareImageFile(new File([blob], filename, { type: 'image/png' })); // 'cancelled' is not an error
    } catch {
      setNote({ kind: 'error', key: 'share-failed', title: 'Couldn’t open the share sheet', body: 'You can download the image instead.' }, key);
    }
    busy = null;
    renderActions();
  }

  const guard = (button: HTMLButtonElement, action: () => Promise<void>): void => {
    button.addEventListener('click', () => {
      if (button.getAttribute('aria-disabled') === 'true') return;
      void action();
    });
  };
  guard(saveButton, doSave);
  guard(downloadButton, doDownload);
  guard(shareButton, doShare);

  // ---- editing
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

  const useLow = (ecc: Ecc): void => {
    renderLive.cancel();
    state = { ...state, text: input.value, ecc };
    render();
  };

  byId('panel-host', HTMLElement).addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element) || !target.closest('[data-action="use-low"]')) return;
    useLow('L');
    back.focus(); // the pressed button is gone; keep focus in the flow without opening the keyboard
  });

  back.addEventListener('click', () => {
    useLow('M');
    const next = byId('panel-host', HTMLElement).querySelector<HTMLElement>('[data-action="use-low"]');
    (next ?? input).focus();
  });

  actionHost.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const action = target.closest<HTMLElement>('[data-action]')?.dataset['action'];
    if (action === 'retry-save') {
      saveButton.focus(); // the pressed button is removed when the panel changes
      void doSave();
    } else if (action === 'retry-download') {
      downloadButton.focus();
      void doDownload();
    }
  });

  // Keep the QR crisp when the container width changes (rotation, window resize).
  let lastWidth = window.innerWidth;
  window.addEventListener('resize', () => {
    if (window.innerWidth === lastWidth) return;
    lastWidth = window.innerWidth;
    drawCurrent();
  });

  render();

  return {
    load(item) {
      renderLive.cancel();
      state = { text: item.payload, ecc: item.ecc, touched: true };
      input.value = item.payload;
      saveUi = { kind: 'saved', key: contentKey(item.payload, item.ecc), id: item.id };
      note = null;
      render();
    },
    onDeleted(id) {
      saveUi = afterDelete(saveUi, id);
      if (saveUi.kind !== 'saved') note = null;
      renderActions();
    },
    focusInput() {
      input.focus();
    },
    refresh() {
      drawCurrent();
    },
  };
}
