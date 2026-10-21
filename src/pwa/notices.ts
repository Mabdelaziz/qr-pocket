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

/** Keeps keyboard and screen-reader users oriented when the focused notice disappears: focus the visible screen's heading. */
function focusActiveHeading(): void {
  document.querySelector<HTMLElement>('main .view:not([hidden]) h1')?.focus();
}

/**
 * Inline notice bars under the header (never floating over navigation or buttons). They carry no live role:
 * announcements go through the single polite status region so nothing is read twice.
 */
export function createNotices(host: HTMLElement): Notices {
  const bars = new Map<string, HTMLElement>();

  function remove(id: string): void {
    const bar = bars.get(id);
    if (!bar) return;
    const hadFocus = bar.contains(document.activeElement);
    bar.remove();
    bars.delete(id);
    if (hadFocus) focusActiveHeading();
  }

  return {
    show(id, spec) {
      remove(id);
      const bar = el('div', `notebar p-${spec.kind}`);
      bar.dataset['notice'] = id;
      bar.setAttribute('role', 'group');
      const body = el('div', 'nbody');
      if (spec.title) {
        const title = el('p', 'ntitle', spec.title);
        title.id = `notice-${id}-title`;
        body.append(title);
      }
      const text = el('p', 'ntext', spec.text);
      text.id = `notice-${id}-text`;
      body.append(text);
      // The accessible name follows the visible text (it can change, e.g. the update bar), never a stale copy.
      bar.setAttribute('aria-labelledby', spec.title ? `notice-${id}-title` : `notice-${id}-text`);
      bar.append(icon(spec.icon, 'ico pico'), body);
      if (spec.actions && spec.actions.length > 0) {
        const actions = el('div', 'pact');
        for (const action of spec.actions) {
          const button = el('button', `btn ${action.primary ? 'btn-primary' : 'btn-tonal'}`, action.label);
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
    hide: remove,
    has: (id) => bars.has(id),
  };
}
