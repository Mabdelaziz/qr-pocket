import { downloadBlob } from '../export/download';
import { pngFilename } from '../export/filename';
import { renderPngBlob } from '../export/png';
import { encode } from '../qr/encode';
import { drawQr } from '../render/canvas';
import { shareImageFile } from '../share/share';
import { StoreError, type CodeStore, type SavedCode } from '../store/types';
import { announce } from './announce';
import { createDialogs } from './dialogs';
import { byId, el, icon } from './dom';
import { createPanelHost, type PanelModel } from './panels';
import { deriveSavedView, storeErrorText, type SavedStatus } from './savedModel';

export interface SavedDeps {
  readonly store: CodeStore;
  readonly canShare: boolean;
  /** Open a saved item in the editor and show the Generate screen. */
  onOpen(item: SavedCode): void;
  /** A record was deleted; lets the editor reset its Save state. */
  onDeleted(id: string): void;
  /** Go to Generate with the text field focused (empty-state action). */
  createNew(): void;
}

export interface SavedApi {
  enter(): void;
  leave(): void;
}

const dateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export function initSaved(deps: SavedDeps): SavedApi {
  const body = byId('saved-body', HTMLElement);
  const count = byId('saved-count', HTMLElement);
  const notice = byId('saved-notice', HTMLElement);
  const panel = createPanelHost(byId('saved-panel', HTMLElement));
  const panelRoot = byId('saved-panel', HTMLElement);
  const dialogs = createDialogs();

  let status: SavedStatus = { kind: 'loading' };
  let items: readonly SavedCode[] = [];
  let token = 0;
  let busyCard: string | null = null;
  let active = false; // false while another screen is shown: late async work must not announce or move focus
  let observer: IntersectionObserver | null = null;
  const thumbItems = new WeakMap<Element, SavedCode>();

  // ---------------------------------------------------------------- rendering
  function drawThumb(canvas: HTMLCanvasElement): void {
    const item = thumbItems.get(canvas);
    if (!item || canvas.dataset['drawn'] === 'true') return;
    const result = encode(item.payload, item.ecc);
    if (!result.ok) return; // a placeholder box remains; the card is still usable
    drawQr(canvas, result.matrix, 64, window.devicePixelRatio || 1);
    canvas.style.width = '100%'; // thumbnails scale to their box (decorative, nearest-neighbour)
    canvas.style.height = '100%';
    canvas.dataset['drawn'] = 'true';
  }

  function buildCard(item: SavedCode): HTMLLIElement {
    const li = el('li', 'scard');
    li.dataset['id'] = item.id;

    const head = el('div', 'shead');
    const thumb = el('div', 'thumb');
    thumb.setAttribute('aria-hidden', 'true');
    const canvas = document.createElement('canvas');
    thumbItems.set(canvas, item);
    thumb.append(canvas);
    const text = el('div', 'cbody');
    const title = el('h2', undefined, item.title);
    title.setAttribute('dir', 'auto');
    const meta = el('p', 'meta');
    const time = el('time', undefined, dateFormat.format(new Date(item.createdAt)));
    time.dateTime = new Date(item.createdAt).toISOString();
    meta.append(time);
    text.append(title, meta);
    const open = el('button', 'btn btn-primary btn-open', 'Open');
    open.type = 'button';
    open.dataset['action'] = 'open';
    open.setAttribute('aria-label', `Open ${item.title}`);
    head.append(thumb, text, open);

    const actions = el('div', deps.canShare ? 'acts4' : 'acts3');
    const add = (action: string, label: string, iconName: string, extra = ''): void => {
      const button = el('button', `act${extra}`);
      button.type = 'button';
      button.dataset['action'] = action;
      button.setAttribute('aria-label', `${label} ${item.title}`);
      button.append(icon(iconName, 'ico'), el('span', undefined, label));
      actions.append(button);
    };
    add('rename', 'Rename', 'rename');
    add('download', 'Download', 'download');
    if (deps.canShare) add('share', 'Share', 'share');
    add('delete', 'Delete', 'trash', ' act-danger');

    li.append(head, actions);
    return li;
  }

  function render(): void {
    const view = deriveSavedView(status);
    count.textContent = view.countLabel;
    notice.hidden = view.mode === 'error' || view.mode === 'loading';
    observer?.disconnect();
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.target instanceof HTMLCanvasElement) {
            drawThumb(entry.target);
            observer?.unobserve(entry.target);
          }
        }
      });
    } else {
      observer = null;
    }

    if (view.mode === 'loading') {
      const list = el('ul', 'list skeleton');
      list.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < 2; i++) {
        const li = el('li', 'scard');
        const head = el('div', 'shead');
        head.append(el('div', 'thumb'));
        const lines = el('div', 'cbody');
        lines.append(el('div', 'sk'), el('div', 'sk short'));
        head.append(lines);
        li.append(head, el('div', 'sk wide'));
        list.append(li);
      }
      body.replaceChildren(list);
    } else if (view.mode === 'empty') {
      const box = el('div', 'emptybox');
      const badge = el('div', 'ebadge');
      badge.append(icon('saved', 'ico big'));
      const create = el('button', 'btn btn-primary', 'Create a QR code');
      create.type = 'button';
      create.dataset['action'] = 'create';
      box.append(badge, el('h2', undefined, 'Nothing saved yet'), el('p', 'meta emptytext', 'Codes you save will show up here, ready to open, download or share.'), create);
      body.replaceChildren(box);
    } else if (view.mode === 'list') {
      const list = el('ul', 'list');
      for (const item of items) list.append(buildCard(item));
      body.replaceChildren(list);
      for (const canvas of list.querySelectorAll('canvas')) {
        if (observer) observer.observe(canvas);
        else drawThumb(canvas);
      }
    } else {
      body.replaceChildren(); // error: the panel above carries the message and the actions
    }
  }

  function loadError(kind: StoreError['kind']): PanelModel {
    const text = storeErrorText('load', kind);
    return {
      kind: 'error',
      key: 'load-failed',
      title: text.title,
      body: text.body,
      actions: [
        { id: 'retry-load', label: 'Retry' },
        { id: 'create', label: 'Create a QR code' },
      ],
    };
  }

  async function load(showLoading: boolean): Promise<void> {
    const mine = ++token;
    if (showLoading) {
      status = { kind: 'loading' };
      panel.show(null);
      render();
      announce(deriveSavedView(status).announce);
    }
    try {
      const list = await deps.store.list();
      if (mine !== token) return; // a newer load superseded this one, or the screen was left
      items = list;
      status = { kind: 'ready', items: list };
      panel.show(null);
    } catch (error) {
      if (mine !== token) return;
      items = [];
      status = { kind: 'error', error: error instanceof StoreError ? error.kind : 'unknown' };
      panel.show(loadError(status.error));
    }
    render();
    announce(deriveSavedView(status).announce);
  }

  // ---------------------------------------------------------------- card actions
  function cardAction(item: SavedCode, action: string, opener: HTMLElement): void {
    switch (action) {
      case 'open':
        deps.onOpen(item);
        return;
      case 'rename':
        dialogs.rename({
          title: item.title,
          submit: async (value) => {
            await deps.store.rename(item.id, value);
          },
          onClosed: (succeeded) => {
            if (!succeeded) {
              if (opener.isConnected) opener.focus();
              return;
            }
            void load(false).then(() => {
              if (!active) return;
              announce('Renamed.');
              body.querySelector<HTMLElement>(`[data-id="${CSS.escape(item.id)}"] [data-action="rename"]`)?.focus();
            });
          },
        });
        return;
      case 'delete':
        dialogs.confirmDelete({
          title: item.title,
          submit: async () => {
            await deps.store.remove(item.id);
          },
          onClosed: (succeeded) => {
            if (!succeeded) {
              if (opener.isConnected) opener.focus();
              return;
            }
            const index = items.findIndex((candidate) => candidate.id === item.id);
            deps.onDeleted(item.id);
            void load(false).then(() => {
              if (!active) return;
              announce('Deleted.');
              const next = items[Math.min(index, items.length - 1)];
              const target = next
                ? body.querySelector<HTMLElement>(`[data-id="${CSS.escape(next.id)}"] [data-action="open"]`)
                : body.querySelector<HTMLElement>('[data-action="create"]');
              target?.focus();
            });
          },
        });
        return;
      case 'download':
      case 'share':
        void exportCard(item, action, opener);
        return;
    }
  }

  async function exportCard(item: SavedCode, action: 'download' | 'share', opener: HTMLElement): Promise<void> {
    if (busyCard) return;
    busyCard = item.id;
    opener.setAttribute('aria-busy', 'true'); // visible cue while the PNG is rendered
    panel.show(null);
    try {
      const encoded = encode(item.payload, item.ecc);
      if (!encoded.ok) throw new Error('This saved code can no longer be encoded');
      const blob = await renderPngBlob(encoded.matrix); // derived from the stored payload; no image is ever stored
      const filename = pngFilename(item.title, new Date());
      if (action === 'download') downloadBlob(blob, filename);
      else await shareImageFile(new File([blob], filename, { type: 'image/png' })); // 'cancelled' is not an error
    } catch {
      panel.show({
        kind: 'error',
        key: `${action}-failed`,
        title: action === 'download' ? 'Couldn’t create the PNG' : 'Couldn’t open the share sheet',
        body: action === 'download' ? 'Something went wrong while creating the image.' : 'You can download the image instead.',
      });
    } finally {
      busyCard = null;
      opener.removeAttribute('aria-busy');
    }
  }

  body.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLElement>('[data-action]');
    if (!button) return;
    const action = button.dataset['action'] ?? '';
    if (action === 'create') {
      deps.createNew();
      return;
    }
    const id = button.closest<HTMLElement>('[data-id]')?.dataset['id'];
    const item = items.find((candidate) => candidate.id === id);
    if (item) cardAction(item, action, button);
  });

  panelRoot.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const action = target.closest<HTMLElement>('[data-action]')?.dataset['action'];
    if (action === 'retry-load') {
      document.getElementById('h-saved')?.focus(); // the pressed button is removed; keep focus on this screen
      void load(true);
    }
    else if (action === 'create') deps.createNew();
  });

  return {
    enter() {
      active = true;
      void load(true);
    },
    leave() {
      active = false;
      announce(''); // so the next visit announces its result even if the text is identical
      token++; // ignore any in-flight load
      observer?.disconnect();
      body.replaceChildren(); // free thumbnails; the list is rebuilt from storage on the next visit
      panel.show(null);
    },
  };
}
