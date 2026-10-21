import { el, icon } from './dom';

export interface PanelAction {
  readonly id: string;
  readonly label: string;
}

export interface PanelModel {
  readonly kind: 'info' | 'warn' | 'error' | 'success';
  /** Stable identity: the DOM panel is rebuilt (and so re-announced) only when this changes. */
  readonly key: string;
  readonly title: string;
  readonly body: string;
  readonly actions?: readonly PanelAction[];
}

const ICONS = { info: 'info', warn: 'warn', error: 'error', success: 'ok' } as const;
const PREFIXES = { info: 'Note: ', warn: 'Warning: ', error: 'Error: ', success: 'Success: ' } as const;

/** Builds a status panel with DOM APIs only. Status is conveyed by icon shape + text, never by colour alone. */
export function buildPanel(model: PanelModel): HTMLElement {
  const panel = el('div', `panel p-${model.kind}`);
  // One announcement channel: errors announce themselves (role=alert); other kinds are announced via the status region.
  if (model.kind === 'error') panel.setAttribute('role', 'alert');
  panel.append(icon(ICONS[model.kind], 'ico pico'));

  const body = el('div', 'pbody');
  const title = el('p', 'ptitle');
  title.append(el('span', 'sr', PREFIXES[model.kind]), model.title);
  body.append(title);
  if (model.body) {
    const detail = el('p', 'pdetail', model.body);
    detail.setAttribute('aria-live', 'off'); // numbers may change while typing; do not re-announce them
    body.append(detail);
  }
  if (model.actions && model.actions.length > 0) {
    const actions = el('div', 'pact');
    for (const action of model.actions) {
      const button = el('button', 'btn btn-tonal', action.label);
      button.type = 'button';
      button.dataset['action'] = action.id;
      actions.append(button);
    }
    body.append(actions);
  }
  panel.append(body);
  return panel;
}

export interface PanelHost {
  show(panel: PanelModel | null): void;
}

/** Shows at most one panel in `host`. Re-showing the same key only refreshes the detail text in place. */
export function createPanelHost(host: HTMLElement): PanelHost {
  let shownKey = '';
  return {
    show(panel) {
      const key = panel ? panel.key : '';
      if (key === shownKey) {
        const detail = host.querySelector('.pdetail');
        if (panel && detail && detail.textContent !== panel.body) detail.textContent = panel.body;
        return;
      }
      shownKey = key;
      host.replaceChildren(...(panel ? [buildPanel(panel)] : []));
    },
  };
}
