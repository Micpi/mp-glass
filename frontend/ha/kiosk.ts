/*
 * Kiosk: for everyone but administrators, MP Nexus is the whole interface. Any other page of Home Assistant
 * (settings, history, another dashboard, a link typed by hand) brings them back to the MP Nexus dashboard.
 * Loaded by frontend/bootstrap.ts on every page; imports nothing, and its syntax is lowered like the bootstrap's.
 * An interface rule, not a permission: what a user may do stays what Home Assistant lets that user do.
 */
interface KioskHass {
  user?: { is_admin: boolean };
  callWS<T>(message: Record<string, unknown>): Promise<T>;
}

/** Where a user kept on the dashboard must go from this path, nothing when the path is part of it. */
export function kioskTarget(path: string, dashboard: string) {
  return path === `/${dashboard}` || path.startsWith(`/${dashboard}/`) ? undefined : `/${dashboard}`;
}

/** Navigates as Home Assistant's own links do, without reloading the page. */
function go(path: string) {
  history.replaceState(null, '', path);
  window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: true } }));
}

function currentHass() {
  return (document.querySelector('home-assistant') as (Element & { hass?: KioskHass }) | null)?.hass;
}

export function startKiosk(log: (message: string) => void) {
  const started = Date.now();
  const wait = setInterval(() => {
    const hass = currentHass();
    if (!hass?.user) {
      if (Date.now() - started > 120_000) clearInterval(wait); // Never signed in on this page: the login page.
      return;
    }
    clearInterval(wait);
    if (hass.user.is_admin) return;
    hass.callWS<{ dashboard: string | null; admin: boolean }>({ type: 'mp_glass/kiosk' }).then(({ dashboard, admin }) => {
      if (admin || !dashboard) return;
      log(`mode kiosque : tableau de bord /${dashboard}`);
      const keep = () => {
        const target = kioskTarget(location.pathname, dashboard);
        if (target) go(target);
      };
      keep();
      // After Home Assistant's own handler, which changes the page first.
      for (const type of ['location-changed', 'popstate']) window.addEventListener(type, () => setTimeout(keep, 0));
    }).catch(() => log('mode kiosque indisponible : intégration MP Nexus non chargée'));
  }, 300);
}
