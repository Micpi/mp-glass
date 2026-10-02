export type PortalLanguage = 'fr' | 'en' | 'de' | 'it' | 'ru';

const LANGUAGES: PortalLanguage[] = ['fr', 'en', 'de', 'it', 'ru'];
const LABELS: Record<PortalLanguage, string> = {
  fr: 'Français', en: 'English', de: 'Deutsch', it: 'Italiano', ru: 'Русский',
};
const COPY = {
  fr: {
    language: 'Langue', pageTitle: 'MP Nexus · Espace démo', brandCaption: 'Démonstration du plan 3D', loginKicker: 'Votre espace de démonstration', welcome: 'Bienvenue dans MP Nexus.',
    loginLead: 'Connectez-vous avec les identifiants fournis par l’administrateur pour choisir votre univers et explorer le plan 3D.',
    privacy: 'Votre compte permet à l’administrateur de suivre l’utilisation de la démo : connexions, ouvertures du plan et durée approximative. Aucune adresse IP ni localisation n’est enregistrée. Les statistiques sont conservées 180 jours.',
    icmCredit: 'Intégration & déploiement par ICM', icmDetail: 'Integrated Components for Media · Votre interface de contrôle.',
    signInTitle: 'Connexion', username: 'Nom d’utilisateur', password: 'Mot de passe', signIn: 'Se connecter',
    invalidCredentials: 'Nom d’utilisateur ou mot de passe incorrect.', expiredLogin: 'La page a expiré. Rechargez-la puis réessayez.', inactiveAccount: 'Ce compte n’est plus actif.',
    chooseTitle: 'Choisissez votre univers.', hello: 'Bonjour {username}. Sélectionnez un environnement pour découvrir les équipements et le plan 3D.',
    residential: 'Résidentiel', homeThreeFloors: 'Maison · 3 niveaux', homeDescription: 'Une maison connectée, du séjour à la buanderie.',
    residentialCategories: 'Éclairage · chauffage · volets · sécurité · multimédia · linge',
    office: 'Bureau / magasin', professional: 'Espaces professionnels', officeDescription: 'Un commerce, ses réserves et ses espaces de travail.',
    officeCategories: 'Éclairage · climatisation · stores · accès · présence · affichage · linge',
    yacht: 'Yacht', yachtFourDecks: 'À bord · 4 ponts', yachtDescription: 'Les équipements d’un yacht, du salon au pont extérieur.',
    yachtCategories: 'Éclairage · climatisation · hublots · accès · multimédia · linge',
    explore: 'Explorer cette démo', chooseDemo: 'Choisir un type de démonstration',
    changePassword: 'Choisissez votre mot de passe', temporaryPassword: 'Mot de passe provisoire',
    newPassword: 'Nouveau mot de passe', temporaryHint: 'Le mot de passe provisoire doit être remplacé avant d’accéder aux démos.', save: 'Enregistrer',
    qrTitle: 'Sur un autre appareil', qrHint: 'Scannez le QR code, connectez-vous puis choisissez une démo.',
    adminUpdate: 'Administration et mise à jour', adminInfo: 'Gérez les comptes depuis Utilisateurs dans le menu en haut. Version installée : {version}. Sur le Synology, lancez update.sh depuis le dossier du projet pour télécharger l’image et recréer proprement le conteneur.',
    manageUsers: 'Gérer les utilisateurs ↗',
  },
  en: {
    language: 'Language', pageTitle: 'MP Nexus · Demo space', brandCaption: '3D floor plan demo', loginKicker: 'Your demo space', welcome: 'Welcome to MP Nexus.',
    loginLead: 'Sign in with the credentials provided by your administrator to choose an environment and explore the 3D floor plan.',
    privacy: 'Your account lets the administrator follow demo usage: sign-ins, plan views and approximate time spent. No IP address or location is stored. Statistics are kept for 180 days.',
    icmCredit: 'Integrated and deployed by ICM', icmDetail: 'Integrated Components for Media · Your unified control interface.',
    signInTitle: 'Sign in', username: 'Username', password: 'Password', signIn: 'Sign in',
    invalidCredentials: 'Incorrect username or password.', expiredLogin: 'This page has expired. Reload it and try again.', inactiveAccount: 'This account is no longer active.',
    chooseTitle: 'Choose your environment.', hello: 'Hello {username}. Choose an environment to explore its devices and 3D floor plan.',
    residential: 'Residential', homeThreeFloors: 'Home · 3 floors', homeDescription: 'A connected home, from the living room to the laundry.',
    residentialCategories: 'Lighting · heating · shutters · security · media · laundry',
    office: 'Office / retail', professional: 'Professional spaces', officeDescription: 'A retail space, its back rooms and work areas.',
    officeCategories: 'Lighting · climate · blinds · access · presence · signage · laundry',
    yacht: 'Yacht', yachtFourDecks: 'On board · 4 decks', yachtDescription: 'A yacht’s systems, from the saloon to the open deck.',
    yachtCategories: 'Lighting · climate · portholes · access · media · laundry',
    explore: 'Explore this demo', chooseDemo: 'Choose a demo type',
    changePassword: 'Choose your password', temporaryPassword: 'Temporary password',
    newPassword: 'New password', temporaryHint: 'Replace the temporary password before accessing the demos.', save: 'Save',
    qrTitle: 'On another device', qrHint: 'Scan the QR code, sign in, then choose a demo.',
    adminUpdate: 'Administration and updates', adminInfo: 'Manage accounts from Users in the top menu. Installed version: {version}. On Synology, run update.sh from the project folder to download the image and recreate the container.',
    manageUsers: 'Manage users ↗',
  },
  de: {
    language: 'Sprache', pageTitle: 'MP Nexus · Demo', brandCaption: '3D-Grundriss-Demo', loginKicker: 'Ihr Demo-Bereich', welcome: 'Willkommen bei MP Nexus.',
    loginLead: 'Melden Sie sich mit den Zugangsdaten Ihrer Administration an, wählen Sie Ihre Umgebung und entdecken Sie den 3D-Grundriss.',
    privacy: 'Ihr Konto ermöglicht der Administration, die Demo-Nutzung nachzuvollziehen: Anmeldungen, Aufrufe des Grundrisses und ungefähre Nutzungsdauer. IP-Adresse und Standort werden nicht gespeichert. Die Statistiken werden 180 Tage aufbewahrt.',
    icmCredit: 'Integration und Bereitstellung durch ICM', icmDetail: 'Integrated Components for Media · Ihre zentrale Steuerungsoberfläche.',
    signInTitle: 'Anmelden', username: 'Benutzername', password: 'Passwort', signIn: 'Anmelden',
    invalidCredentials: 'Benutzername oder Passwort ist falsch.', expiredLogin: 'Diese Seite ist abgelaufen. Laden Sie sie neu und versuchen Sie es erneut.', inactiveAccount: 'Dieses Konto ist nicht mehr aktiv.',
    chooseTitle: 'Wählen Sie Ihre Umgebung.', hello: 'Hallo {username}. Wählen Sie eine Umgebung und entdecken Sie ihre Geräte und den 3D-Grundriss.',
    residential: 'Wohnen', homeThreeFloors: 'Wohnhaus · 3 Ebenen', homeDescription: 'Ein vernetztes Zuhause – vom Wohnbereich bis zur Waschküche.',
    residentialCategories: 'Beleuchtung · Heizung · Rollläden · Sicherheit · Medien · Wäsche',
    office: 'Büro / Geschäft', professional: 'Gewerbliche Räume', officeDescription: 'Ein Geschäft mit Lager- und Arbeitsbereichen.',
    officeCategories: 'Beleuchtung · Klima · Jalousien · Zutritt · Präsenz · Beschilderung · Wäsche',
    yacht: 'Yacht', yachtFourDecks: 'An Bord · 4 Decks', yachtDescription: 'Yachttechnik – vom Salon bis zum Außendeck.',
    yachtCategories: 'Beleuchtung · Klima · Bullaugen · Zutritt · Medien · Wäsche',
    explore: 'Demo öffnen', chooseDemo: 'Demobereich auswählen',
    changePassword: 'Neues Passwort festlegen', temporaryPassword: 'Vorläufiges Passwort',
    newPassword: 'Neues Passwort', temporaryHint: 'Ersetzen Sie das vorläufige Passwort, bevor Sie auf die Demos zugreifen.', save: 'Speichern',
    qrTitle: 'Auf einem anderen Gerät', qrHint: 'Scannen Sie den QR-Code, melden Sie sich an und wählen Sie eine Demo.',
    adminUpdate: 'Administration und Aktualisierung', adminInfo: 'Verwalten Sie Konten über Benutzer im oberen Menü. Installierte Version: {version}. Führen Sie auf Synology update.sh im Projektordner aus, um das Image herunterzuladen und den Container neu zu erstellen.',
    manageUsers: 'Benutzer verwalten ↗',
  },
  it: {
    language: 'Lingua', pageTitle: 'MP Nexus · Demo', brandCaption: 'Demo della planimetria 3D', loginKicker: 'Il tuo spazio demo', welcome: 'Benvenuto in MP Nexus.',
    loginLead: 'Accedi con le credenziali fornite dall’amministratore, scegli il tuo ambiente ed esplora la planimetria 3D.',
    privacy: 'Il tuo account permette all’amministratore di seguire l’utilizzo della demo: accessi, aperture della planimetria e durata approssimativa. Non vengono registrati indirizzo IP né posizione. Le statistiche sono conservate per 180 giorni.',
    icmCredit: 'Integrazione e distribuzione a cura di ICM', icmDetail: 'Integrated Components for Media · La tua interfaccia di controllo.',
    signInTitle: 'Accesso', username: 'Nome utente', password: 'Password', signIn: 'Accedi',
    invalidCredentials: 'Nome utente o password non corretti.', expiredLogin: 'Questa pagina è scaduta. Ricaricala e riprova.', inactiveAccount: 'Questo account non è più attivo.',
    chooseTitle: 'Scegli il tuo ambiente.', hello: 'Ciao {username}. Scegli un ambiente per scoprire i dispositivi e la planimetria 3D.',
    residential: 'Residenziale', homeThreeFloors: 'Casa · 3 livelli', homeDescription: 'Una casa connessa, dal soggiorno alla lavanderia.',
    residentialCategories: 'Luci · riscaldamento · tapparelle · sicurezza · multimedia · bucato',
    office: 'Ufficio / negozio', professional: 'Spazi professionali', officeDescription: 'Un negozio, i suoi magazzini e gli spazi di lavoro.',
    officeCategories: 'Luci · climatizzazione · tende · accessi · presenza · insegne · bucato',
    yacht: 'Yacht', yachtFourDecks: 'A bordo · 4 ponti', yachtDescription: 'I sistemi di uno yacht, dal salone al ponte esterno.',
    yachtCategories: 'Luci · climatizzazione · oblò · accessi · multimedia · bucato',
    explore: 'Esplora la demo', chooseDemo: 'Scegli un tipo di demo',
    changePassword: 'Scegli la tua password', temporaryPassword: 'Password temporanea',
    newPassword: 'Nuova password', temporaryHint: 'Sostituisci la password temporanea prima di accedere alle demo.', save: 'Salva',
    qrTitle: 'Su un altro dispositivo', qrHint: 'Scansiona il codice QR, accedi e scegli una demo.',
    adminUpdate: 'Amministrazione e aggiornamenti', adminInfo: 'Gestisci gli account da Utenti nel menu in alto. Versione installata: {version}. Su Synology, esegui update.sh dalla cartella del progetto per scaricare l’immagine e ricreare il container.',
    manageUsers: 'Gestisci utenti ↗',
  },
  ru: {
    language: 'Язык', pageTitle: 'MP Nexus · Демоверсия', brandCaption: 'Демонстрация плана в 3D', loginKicker: 'Ваша демоверсия', welcome: 'Добро пожаловать в MP Nexus.',
    loginLead: 'Войдите с учетными данными, предоставленными администратором, выберите среду и изучите план в 3D.',
    privacy: 'Ваша учетная запись позволяет администратору отслеживать использование демоверсии: входы, просмотры плана и примерную продолжительность. IP-адрес и местоположение не сохраняются. Статистика хранится 180 дней.',
    icmCredit: 'Интеграция и внедрение от ICM', icmDetail: 'Integrated Components for Media · Единый интерфейс управления.',
    signInTitle: 'Вход', username: 'Имя пользователя', password: 'Пароль', signIn: 'Войти',
    invalidCredentials: 'Неверное имя пользователя или пароль.', expiredLogin: 'Срок действия страницы истёк. Обновите её и попробуйте снова.', inactiveAccount: 'Эта учетная запись больше не активна.',
    chooseTitle: 'Выберите среду.', hello: 'Здравствуйте, {username}. Выберите среду, чтобы изучить устройства и план в 3D.',
    residential: 'Жилой дом', homeThreeFloors: 'Дом · 3 этажа', homeDescription: 'Умный дом: от гостиной до прачечной.',
    residentialCategories: 'Освещение · отопление · ставни · безопасность · мультимедиа · стирка',
    office: 'Офис / магазин', professional: 'Коммерческие помещения', officeDescription: 'Магазин, подсобные помещения и рабочие зоны.',
    officeCategories: 'Освещение · климат · жалюзи · доступ · присутствие · вывески · стирка',
    yacht: 'Яхта', yachtFourDecks: 'На борту · 4 палубы', yachtDescription: 'Системы яхты: от салона до открытой палубы.',
    yachtCategories: 'Освещение · климат · иллюминаторы · доступ · мультимедиа · стирка',
    explore: 'Открыть демоверсию', chooseDemo: 'Выберите тип демоверсии',
    changePassword: 'Задайте пароль', temporaryPassword: 'Временный пароль',
    newPassword: 'Новый пароль', temporaryHint: 'Замените временный пароль, чтобы открыть демоверсии.', save: 'Сохранить',
    qrTitle: 'На другом устройстве', qrHint: 'Отсканируйте QR-код, войдите и выберите демоверсию.',
    adminUpdate: 'Администрирование и обновления', adminInfo: 'Управляйте учетными записями через пункт «Пользователи» в верхнем меню. Установленная версия: {version}. На Synology запустите update.sh из папки проекта, чтобы загрузить образ и пересоздать контейнер.',
    manageUsers: 'Управление пользователями ↗',
  },
} as const;

const STORAGE_KEY = 'mpnexus.demo.language';
function detectLanguage(): PortalLanguage {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && LANGUAGES.includes(saved as PortalLanguage)) return saved as PortalLanguage;
  } catch { /* Use the browser language when storage is unavailable. */ }
  const browser = typeof navigator === 'undefined' ? '' : navigator.language.toLowerCase();
  return browser.startsWith('de') ? 'de' : browser.startsWith('it') ? 'it' : browser.startsWith('ru') ? 'ru' : browser.startsWith('en') ? 'en' : 'fr';
}

let current: PortalLanguage = detectLanguage();
export const portalLanguage = () => current;
export function setPortalLanguage(value: string) {
  if (!LANGUAGES.includes(value as PortalLanguage)) return;
  current = value as PortalLanguage;
  try { localStorage.setItem(STORAGE_KEY, current); } catch { /* The selection still applies for this page. */ }
}
export function portalText(key: keyof typeof COPY.fr, values?: Record<string, string>) {
  let text: string = COPY[current][key] ?? COPY.en[key] ?? COPY.fr[key];
  for (const [name, value] of Object.entries(values ?? {})) text = text.replaceAll(`{${name}}`, value);
  return text;
}
const API_ERRORS: Record<string, keyof typeof COPY.fr> = {
  'Nom d’utilisateur ou mot de passe incorrect.': 'invalidCredentials',
  'La page a expiré. Rechargez-la puis réessayez.': 'expiredLogin',
  'Ce compte n’est plus actif.': 'inactiveAccount',
};
export function portalError(message: string) { return API_ERRORS[message] ? portalText(API_ERRORS[message]!) : message; }

const FLAG: Record<PortalLanguage, string> = {
  fr: '<svg viewBox="0 0 3 2" preserveAspectRatio="none"><rect width="1" height="2" fill="#002395"/><rect x="1" width="1" height="2" fill="#fff"/><rect x="2" width="1" height="2" fill="#ed2939"/></svg>',
  en: '<svg viewBox="0 0 60 30" preserveAspectRatio="xMidYMid slice"><path d="M0 0v30h60V0z" fill="#012169"/><path d="M0 0l60 30m0-30L0 30" stroke="#fff" stroke-width="6"/><path d="M0 0l60 30m0-30L0 30" stroke="#c8102e" stroke-width="3"/><path d="M30 0v30M0 15h60" stroke="#fff" stroke-width="10"/><path d="M30 0v30M0 15h60" stroke="#c8102e" stroke-width="6"/></svg>',
  de: '<svg viewBox="0 0 3 2" preserveAspectRatio="none"><rect width="3" height="2" fill="#ffce00"/><rect width="3" height="1.333" fill="#dd0000"/><rect width="3" height=".667" fill="#000"/></svg>',
  it: '<svg viewBox="0 0 3 2" preserveAspectRatio="none"><rect width="1" height="2" fill="#009246"/><rect x="1" width="1" height="2" fill="#fff"/><rect x="2" width="1" height="2" fill="#ce2b37"/></svg>',
  ru: '<svg viewBox="0 0 3 2" preserveAspectRatio="none"><rect width="3" height="2" fill="#fff"/><rect y=".667" width="3" height=".667" fill="#0039a6"/><rect y="1.333" width="3" height=".667" fill="#d52b1e"/></svg>',
};
export function portalLanguagePicker() {
  const label = `${portalText('language')} : ${LABELS[current]}`;
  const choices = LANGUAGES.map(language => `<button type="button" role="menuitemradio" aria-checked="${language === current}" lang="${language}" data-portal-language-choice="${language}"><span class="portal-flag" aria-hidden="true">${FLAG[language]}</span><span>${LABELS[language]}</span></button>`).join('');
  return `<div class="portal-locale"><button type="button" class="portal-locale-toggle" data-portal-language-toggle aria-label="${label}" title="${label}" aria-haspopup="menu" aria-expanded="false"><span class="portal-flag" aria-hidden="true">${FLAG[current]}</span></button><div class="portal-locale-menu" role="menu" aria-label="${portalText('language')}" hidden>${choices}</div></div>`;
}
