import { el, icon } from '../ui/dom';

export interface NoticeAction {
  readonly id: string;
  readonly label: string;
  readonly primary?: boolean;
  readonly onClick: () => void;
}

export interface NoticeSpec {
  readonly kind: 'info' | 'success';
  readonly icon: string;
  readonly title?: string;
  readonly text: string;
  readonly actions?: readonly NoticeAction[];
}

export interface Notices {
  show(id: string, spec: NoticeSpec): void;
  setText(id: string, text: string): void;
  hide(id: string): void;
  has(id: string): boolean;
}

/**
 * Inline notice bars under the header (never floating over navigation or buttons). They carry no live role:
 * announcements go through the single polite status region so nothing is read twice.
 */
export function createNotices(host: HTMLElement): Notices {
  const bars = new Map<string, HTMLElement>();
  return {
    show(id, spec) {
      bars.get(id)?.remove();
      const bar = el('div', `notebar p-${spec.kind}`);
      bar.dataset['notice'] = id;
      bar.setAttribute('role', 'group');
      const label = spec.title ?? spec.text;
      bar.setAttribute('aria-label', label);
      bar.append(icon(spec.icon, 'ico pico'));
      const body = el('div', 'nbody');
      if (spec.title) body.append(el('p', 'ntitle', spec.title));
      body.append(el('p', 'ntext', spec.text));
      bar.append(body);
      if (spec.actions && spec.actions.length > 0) {
        const actions = el('div', 'pact');
        for (const action of spec.actions) {
          const button = el('button', `btn btn-sm ${action.primary ? 'btn-primary' : 'btn-tonal'}`, action.label);
          button.type = 'button';
          button.dataset['action'] = action.id;
          button.addEventListener('click', action.onClick);
          actions.append(button);
        }
        bar.append(actions);
      }
      bars.set(id, bar);
      host.append(bar);
    },
    setText(id, text) {
      const target = bars.get(id)?.querySelector('.ntext');
      if (target && target.textContent !== text) target.textContent = text;
    },
    hide(id) {
      bars.get(id)?.remove();
      bars.delete(id);
    },
    has: (id) => bars.has(id),
  };
}
