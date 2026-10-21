import { encode, MAX_BYTES, type Ecc, type QrMatrix } from '../qr/encode';
import type { PanelModel } from './panels';

/** Everything the Generate screen needs to render, derived purely from state (SPEC-001). */
export interface GenerateState {
  readonly text: string;
  readonly ecc: Ecc;
  /** True once the user has typed; blank-input messages only show after interaction. */
  readonly touched: boolean;
}

export type PreviewModel =
  | { readonly kind: 'empty'; readonly label: string }
  | { readonly kind: 'none'; readonly label: string }
  | { readonly kind: 'qr'; readonly matrix: QrMatrix };

export interface ViewModel {
  readonly counter: string;
  readonly invalid: boolean;
  readonly showHint: boolean;
  readonly clearVisible: boolean;
  readonly eccLowVisible: boolean;
  readonly panel: PanelModel | null;
  readonly preview: PreviewModel;
  /** Text for the screen-reader status region; '' = nothing to announce (role=alert panels announce themselves). */
  readonly announce: string;
}

const number = new Intl.NumberFormat('en-US');
const fmt = (n: number): string => number.format(n);
const levelName = (ecc: Ecc): string => (ecc === 'M' ? 'Medium' : 'Low');

export const TEXT = {
  emptyPreview: 'Type something to see your QR code',
  nonePreview: 'No QR code yet',
  blankTitle: 'Enter some text or a link.',
  tooLongMediumTitle: 'Too long for Medium error correction',
  useLow: 'Use lower error correction (L)',
  tooLongTitle: 'Too long for a QR code',
  failedTitle: 'Couldn’t generate this code',
  failedBody: 'Try changing the text and try again.',
  ready: 'QR code ready.',
} as const;

export function deriveView(state: GenerateState): ViewModel {
  const { text, ecc, touched } = state;
  const result = encode(text, ecc);
  const clearVisible = text.length > 0;
  const eccLowVisible = ecc === 'L';
  const base = { clearVisible, eccLowVisible };

  if (result.ok) {
    return {
      ...base,
      counter: `${fmt(result.bytes)} / ${fmt(MAX_BYTES[ecc])} bytes · ${levelName(ecc)}`,
      invalid: false,
      showHint: !eccLowVisible,
      panel: null,
      preview: { kind: 'qr', matrix: result.matrix },
      announce: TEXT.ready,
    };
  }

  switch (result.reason) {
    case 'empty': {
      const counter = `${fmt(result.bytes)} / ${fmt(MAX_BYTES[ecc])} bytes · ${levelName(ecc)}`;
      if (!touched) {
        return { ...base, counter, invalid: false, showHint: true, panel: null, preview: { kind: 'empty', label: TEXT.emptyPreview }, announce: '' };
      }
      return {
        ...base,
        counter,
        invalid: true,
        showHint: false,
        panel: { kind: 'error', key: 'blank', title: TEXT.blankTitle, body: '' },
        preview: { kind: 'empty', label: TEXT.emptyPreview },
        announce: '', // the role=alert panel announces itself
      };
    }
    case 'too-long': {
      if (result.fitsAtL) {
        return {
          ...base,
          counter: `${fmt(result.bytes)} / ${fmt(result.maxBytes)} bytes · ${levelName(ecc)}`,
          invalid: true,
          showHint: false,
          panel: {
            kind: 'warn',
            key: 'too-long-medium',
            title: TEXT.tooLongMediumTitle,
            body: `${fmt(result.bytes)} bytes, limit ${fmt(MAX_BYTES.M)}. Low allows up to ${fmt(MAX_BYTES.L)} bytes but tolerates less damage to the printed code.`,
            actions: [{ id: 'use-low', label: TEXT.useLow }],
          },
          preview: { kind: 'none', label: TEXT.nonePreview },
          announce: `${TEXT.tooLongMediumTitle}. A Low option is available.`, // warning panel has no live role; announced here
        };
      }
      return {
        ...base,
        counter: `${fmt(result.bytes)} / ${fmt(MAX_BYTES.L)} bytes`,
        invalid: true,
        showHint: false,
        panel: {
          kind: 'error',
          key: 'too-long',
          title: TEXT.tooLongTitle,
          body: `${fmt(result.bytes)} bytes. The most a QR code can hold is ${fmt(MAX_BYTES.L)} bytes. Shorten the text to continue.`,
        },
        preview: { kind: 'none', label: TEXT.nonePreview },
        announce: '', // role=alert panel announces itself
      };
    }
    case 'failed':
      return {
        ...base,
        counter: `${fmt(result.bytes)} / ${fmt(MAX_BYTES[ecc])} bytes · ${levelName(ecc)}`,
        invalid: true,
        showHint: false,
        panel: { kind: 'error', key: 'failed', title: TEXT.failedTitle, body: TEXT.failedBody },
        preview: { kind: 'none', label: TEXT.nonePreview },
        announce: '', // role=alert panel announces itself
      };
  }
}
