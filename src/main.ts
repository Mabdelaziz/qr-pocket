import './styles/app.css';
import { canShareImageFiles } from './share/share';
import { createIndexedDbStore } from './store/indexedDb';
import { initPwa } from './pwa';
import { initAnnouncer } from './ui/announce';
import { byId } from './ui/dom';
import { initGenerate } from './ui/generate';
import { initRouter, type Route } from './ui/router';
import { initSaved } from './ui/saved';

initAnnouncer(byId('sr-status', HTMLElement));
document.documentElement.dataset['build'] = __BUILD_ID__; // which build is running (used by the update tests)

const store = createIndexedDbStore(); // IndexedDB on this device only; nothing is sent anywhere
const canShare = canShareImageFiles();

const views: Readonly<Record<Route, { section: HTMLElement; heading: HTMLElement; tab: HTMLElement; title: string }>> = {
  generate: { section: byId('view-generate', HTMLElement), heading: byId('h-generate', HTMLElement), tab: byId('tab-generate', HTMLElement), title: 'QR Pocket' },
  saved: { section: byId('view-saved', HTMLElement), heading: byId('h-saved', HTMLElement), tab: byId('tab-saved', HTMLElement), title: 'Saved codes – QR Pocket' },
};

let focusInputNext = false;

const pwa = initPwa(byId('text', HTMLTextAreaElement));
const generate = initGenerate({ store, canShare, onFirstQr: () => pwa.notifyEngaged(), onTextChange: () => pwa.textChanged() });
const saved = initSaved({
  store,
  canShare,
  onOpen: (item) => {
    generate.load(item);
    router.go('generate');
  },
  onDeleted: (id) => generate.onDeleted(id),
  createNew: () => {
    focusInputNext = true;
    router.go('generate');
  },
});

const router = initRouter((route, navigated) => {
  for (const [name, view] of Object.entries(views) as Array<[Route, (typeof views)[Route]]>) {
    const active = name === route;
    view.section.hidden = !active;
    if (active) view.tab.setAttribute('aria-current', 'page');
    else view.tab.removeAttribute('aria-current');
  }
  document.title = views[route].title;
  if (route === 'generate') generate.refresh(); // a QR loaded while hidden is drawn now, at the real container width
  if (route === 'saved') saved.enter();
  else saved.leave();
  if (navigated) {
    // Move focus to the new screen so keyboard and screen-reader users land in the right place.
    if (route === 'generate' && focusInputNext) generate.focusInput();
    else views[route].heading.focus();
  }
  focusInputNext = false;
});
