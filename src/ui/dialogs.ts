import { StoreError } from '../store/types';
import { storeErrorText } from './savedModel';
import { byId } from './dom';
import { createPanelHost } from './panels';

export interface DialogRequest {
  /** Performs the change. Reject (ideally with a StoreError) to keep the dialog open with an inline error. */
  submit(value: string): Promise<void>;
  /** Called after the dialog has closed; `succeeded` tells whether `submit` completed. */
  onClosed(succeeded: boolean): void;
}

export interface RenameRequest extends DialogRequest {
  readonly title: string;
}

export interface DeleteRequest extends DialogRequest {
  readonly title: string;
}

export interface Dialogs {
  rename(request: RenameRequest): void;
  confirmDelete(request: DeleteRequest): void;
}

function errorKind(error: unknown): StoreError['kind'] {
  return error instanceof StoreError ? error.kind : 'unknown';
}

/** Native <dialog> elements: top layer, focus trap, Esc to close, inert background, focus restored by the caller. */
export function createDialogs(): Dialogs {
  // ---- rename
  const renameDialog = byId('dlg-rename', HTMLDialogElement);
  const renameForm = byId('rename-form', HTMLFormElement);
  const renameInput = byId('rename-input', HTMLInputElement);
  const renameCancel = byId('rename-cancel', HTMLButtonElement);
  const renameSave = byId('rename-save', HTMLButtonElement);
  const renamePanel = createPanelHost(byId('rename-panel', HTMLElement));
  let renameRequest: RenameRequest | null = null;
  let renameBusy = false;
  let renameDone = false;

  renameForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const request = renameRequest;
    if (!request || renameBusy) return;
    renameBusy = true;
    renameSave.setAttribute('aria-busy', 'true');
    renameSave.setAttribute('aria-disabled', 'true');
    renamePanel.show(null);
    request
      .submit(renameInput.value)
      .then(() => {
        renameDone = true;
        renameDialog.close();
      })
      .catch((error: unknown) => {
        const text = storeErrorText('rename', errorKind(error));
        renamePanel.show({ kind: 'error', key: 'rename-failed', title: text.title, body: text.body });
      })
      .finally(() => {
        renameBusy = false;
        renameSave.removeAttribute('aria-busy');
        renameSave.removeAttribute('aria-disabled');
      });
  });
  renameDialog.addEventListener('cancel', (event) => {
    if (renameBusy) event.preventDefault(); // Esc must not close the dialog while the change is being written
  });
  renameCancel.addEventListener('click', () => {
    if (!renameBusy) renameDialog.close();
  });
  renameDialog.addEventListener('close', () => {
    const request = renameRequest;
    renameRequest = null;
    request?.onClosed(renameDone);
  });

  // ---- delete
  const deleteDialog = byId('dlg-delete', HTMLDialogElement);
  const deleteTitle = byId('delete-title', HTMLElement);
  const deleteCancel = byId('delete-cancel', HTMLButtonElement);
  const deleteConfirm = byId('delete-confirm', HTMLButtonElement);
  const deletePanel = createPanelHost(byId('delete-panel', HTMLElement));
  let deleteRequest: DeleteRequest | null = null;
  let deleteBusy = false;
  let deleteDone = false;

  deleteConfirm.addEventListener('click', () => {
    const request = deleteRequest;
    if (!request || deleteBusy) return;
    deleteBusy = true;
    deleteConfirm.setAttribute('aria-busy', 'true');
    deleteConfirm.setAttribute('aria-disabled', 'true');
    deletePanel.show(null);
    request
      .submit('')
      .then(() => {
        deleteDone = true;
        deleteDialog.close();
      })
      .catch((error: unknown) => {
        const text = storeErrorText('delete', errorKind(error));
        deletePanel.show({ kind: 'error', key: 'delete-failed', title: text.title, body: text.body });
      })
      .finally(() => {
        deleteBusy = false;
        deleteConfirm.removeAttribute('aria-busy');
        deleteConfirm.removeAttribute('aria-disabled');
      });
  });
  deleteDialog.addEventListener('cancel', (event) => {
    if (deleteBusy) event.preventDefault();
  });
  deleteCancel.addEventListener('click', () => {
    if (!deleteBusy) deleteDialog.close();
  });
  deleteDialog.addEventListener('close', () => {
    const request = deleteRequest;
    deleteRequest = null;
    request?.onClosed(deleteDone);
  });

  return {
    rename(request) {
      renameRequest = request;
      renameBusy = false;
      renameDone = false;
      renamePanel.show(null);
      renameInput.value = request.title;
      renameDialog.showModal();
      renameInput.focus();
      renameInput.select();
    },
    confirmDelete(request) {
      deleteRequest = request;
      deleteBusy = false;
      deleteDone = false;
      deletePanel.show(null);
      deleteTitle.textContent = request.title; // the element is a <bdi>, so an Arabic title cannot scramble the quotes
      deleteDialog.showModal();
      deleteCancel.focus(); // the safe choice has focus; Enter must not delete
    },
  };
}
