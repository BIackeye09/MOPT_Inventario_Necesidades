// Instalación progresiva: usa el aviso nativo cuando el navegador lo ofrece.
// En los demás casos muestra instrucciones; nunca afirma que se instaló por su cuenta.
export function setupInstallation({ host, button, helpDialog }) {
  let pendingPrompt = null;
  const displayMode = host.matchMedia('(display-mode: standalone)');
  const isStandalone = () => displayMode.matches || host.navigator.standalone === true;
  button.hidden = isStandalone();

  host.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    pendingPrompt = event;
    button.hidden = isStandalone();
  });
  host.addEventListener('appinstalled', () => {
    pendingPrompt = null;
    button.hidden = true;
  });
  displayMode.addEventListener?.('change', () => { button.hidden = isStandalone(); });

  button.addEventListener('click', async () => {
    if (!pendingPrompt) {
      if (!helpDialog.open) helpDialog.showModal();
      return;
    }
    // Cada evento de instalación solo se puede utilizar una vez.
    const event = pendingPrompt;
    pendingPrompt = null;
    try {
      await event.prompt();
      const result = await event.userChoice;
      if (result.outcome === 'accepted') button.hidden = true;
    } catch {
      if (!helpDialog.open) helpDialog.showModal();
    }
  });
}

if (typeof document !== 'undefined') {
  setupInstallation({ host: window, button: document.getElementById('install-app'),
    helpDialog: document.getElementById('install-dialog') });
}
