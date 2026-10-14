let locks = 0;

export function lockBodyScroll(): void {
  locks++;
  document.body.classList.add('modal-open');
}

export function unlockBodyScroll(): void {
  locks = Math.max(0, locks - 1);
  if (locks === 0) {
    document.body.classList.remove('modal-open');
  }
}
