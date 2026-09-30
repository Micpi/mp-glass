import QRCode from 'qrcode';

const address = document.querySelector<HTMLElement>('#address')!;
const qr = document.querySelector<HTMLElement>('#qr')!;
const status = document.querySelector<HTMLElement>('#status')!;
const stop = document.querySelector<HTMLButtonElement>('#stop')!;
const hint = document.querySelector<HTMLElement>('#hint')!;

interface LauncherInfo { mobileUrl: string; localUrl: string; stopToken?: string | null; mobileAvailable: boolean; canStop: boolean; }

try {
  const response = await fetch('/__mpnexus/config.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('Configuration réseau indisponible.');
  const info: LauncherInfo = await response.json();
  stop.hidden = !info.canStop;
  if (!info.canStop) {
    hint.textContent = 'Le serveur reste actif en permanence sur le NAS.';
    document.querySelector('.intro')!.textContent = 'Ouvrez la démonstration sur cet ordinateur ou scannez le QR code avec un téléphone ou une tablette.';
    document.querySelector('.network-note')!.textContent = 'Le QR code reprend cette adresse. Elle fonctionne sur votre réseau ou à distance si un accès distant est configuré.';
    document.querySelector('header small')!.textContent = 'Plan 3D · serveur Synology';
  }
  if (info.mobileAvailable) {
    address.textContent = info.mobileUrl;
    const canvas = document.createElement('canvas');
    qr.replaceChildren(canvas);
    await QRCode.toCanvas(canvas, info.mobileUrl, { errorCorrectionLevel: 'M', margin: 1, width: 480, color: { dark: '#10202a', light: '#ffffff' } });
  } else {
    address.textContent = 'Connectez cet ordinateur au Wi-Fi, puis rechargez cette page.';
    qr.textContent = 'Réseau local indisponible';
    qr.classList.add('qr-placeholder');
  }
  stop.addEventListener('click', async () => {
    if (!info.stopToken) return;
    stop.disabled = true;
    status.textContent = 'Arrêt en cours…';
    try {
      await fetch('/__mpnexus/stop', { method: 'POST', headers: { 'X-MP-Nexus-Token': info.stopToken } });
      hint.textContent = 'Serveur arrêté. Vous pouvez fermer cette page.';
      status.textContent = 'Serveur arrêté';
    } catch {
      hint.textContent = 'La demande d’arrêt est envoyée. Vous pouvez fermer cette page.';
      status.textContent = 'Arrêt demandé';
    }
  });
} catch (error) {
  status.textContent = 'Connexion locale';
  address.textContent = location.origin;
  qr.textContent = error instanceof Error ? error.message : 'Le QR code ne peut pas être affiché.';
  qr.classList.add('qr-placeholder');
}
