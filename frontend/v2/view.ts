import { applyAppearance } from '../appearance';
import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { keyed } from 'lit/directives/keyed.js';
import { repeat } from 'lit/directives/repeat.js';
import type { AppearanceConfig, HAState, NavigationConfig } from '../../shared/models';
import { accentOf, ACCENTS, activeWallpaper, AMBIANCES, ambianceOf, cleanLook, cssImage, DEFAULT_WALLPAPER, deleteWallpaper, importedSource, isImported, isNight, libraryWallpaper, listWallpapers, prepareWallpaper, readScreenLook, SCREEN_LOOK_KEY, uploadWallpaper, WALLPAPERS, wallpaperSource, writeScreenLook, type ImportedWallpaper, type ScreenLook } from '../wallpapers';
import { mpIcon, type MPIconName } from '../icons';
import { buildingPlan, planBuildings, withoutHidden, type SpatialFloor, type SpatialPlan, type SpatialRoom } from '../../shared/spatial';
import { canMedia, contactSensor, coverOpen, coverPosition, finite, groupCover, mediaIsTv, mediaOn, mediaTvInput, mediaPlaying, mediaVolume, nowPlaying, accentPalette, DEFAULT_PALETTE, PLAN_COLOR_KEYS, PLAN_PALETTES, planPalette, roomEntityIds, roomTemperature, type PlanColor, type PlanMode, type PlanPalette } from '../../shared/spatial-state';
import { available } from '../../shared/capabilities';
import type { Hass } from '../ha/client';
import { claimHeader, kioskLeft, leaveKiosk, releaseHeader } from '../ha/header';
import '../spatial/viewer';
import { PLAN_LAYERS, roomIcon } from '../spatial/viewer';
import { climateActionMode, domainOf, entityIcon, HVAC, hvacIcon, kindOf, RUN_SERVICES, since, stateDetail, stateLabel, stateName, TOGGLE_DOMAINS } from '../entities';
import '../controls';
import '../detail';
import { chooseLanguage, language, LANGUAGE_NAMES, LANGUAGES, LanguageController, locale, tr, trPlan, type Language } from '../i18n';
import type { MessageKey } from '../locales';
import { flag } from '../flags';
import { nexusStyles } from './styles';
import './scene-editor';
import { sceneIcon } from './scenes';
import { listenTone, ringSound, unlockSound } from './sound';
import { TabletVolume } from './tablet-volume';
import { voiceMedia, voiceTransfer } from './voice-media';
import { confirmation, isVoiceRoutineRequest, parseVoiceRoutine, voiceRoutineAutomation, type VoiceRoutine, type VoiceScope } from './voice-routine';
import { householdRequest } from './organization';
import { AlertAnnouncements } from './announcements';
import { withScreenArea } from './assist';
import { WakeGuard } from './wake-guard';
import { replayRows, replayStates } from './replay';
import type { HistoryRow } from '../history';
import { addFact, factsOf, lessonMarker, LESSON_TURNS, loadFacts, removeFact, setPersona as setPersonaWS, TOPICS, type FactsListing } from './facts';
import { cancelTimer, clockLabel, countdown, EMPTY as NO_TIMERS, snoozeRing, stopRing, TimerFeed, type Ring, type TimerItem, type TimerSnapshot } from './timers';
import { audioSession, canRecord, micWhileSpeaking, onlyWakeWord, claimVoice, canTranscribe, readVoicePrefs, Recorder, deviceVoices, engineVoices, speakOnDevice, speakWithHomeAssistant, speechEngines, transcribe, unlockAudio, writeVoicePrefs, VOICE_EVENT, type Speech, type VoicePrefs } from './voice';
import { addWakeWord, wakeGone, wakeLabels, learnWake, loadWakeModels, removeWakeWord, WakeListener, wakeModel, wakeWords, type WakeWord } from './wake';
import { createVoiceWord, recordSamples, SENTENCE_MS, speechSpan, WORD_MS, WORD_TIMES } from './wake-enroll';
import { askAssist, comfortSuggestions, diagnosticTarget, fold, nexusAgent, houseAlerts, houseSummary, wantsHouseSummary, roomOverview, roomOverviewRequest, inQuietHours, people, QUIET_FROM, QUIET_TO, readPrefs, unseen, writePrefs, type Alert, type AlertLevel, type NexusPrefs, type Person } from './assist';
import { automationId, automationOf, backupName, energySummary, projectTemplate, cycleStep, readSaver, routineReady, SAVER_DELAYS, SAVER_LAYER_SECONDS, SAVER_PHOTO_SECONDS, SAVER_SPIN, slideTransition, timerLeft, writeSaver, type Routine, type SaverContent, type SaverPhotos, type SaverPrefs, type SaverSpin, type SaverTransition, type SaverWidget } from './plus';
import { readProject, saveProject } from '../ha/client';
import { parseProject, projectLogoMark } from '../../shared/project';
import { createGuest, defaultUntil, endGuest, guestPassword, guestStatus, invite, listGuests, localInput, myAccess, networkCheck, qrCode, removeGuest, type Guest, type GuestDraft, type Invitation } from './guests';
import { browse, clockTime, displayMediaImage, elapsed, groupOf, isMusicAssistant, musicAction, musicAssistantFavoriteButton, musicBridgeSearch, musicLibrary, musicQueue, musicStatus, nextRepeat, queueSignature, readMediaFavorites, DIGITS, remoteKeyboard, remoteProfile, remoteRoutes, remoteSystem, safeFavoriteContentId, safeFavoriteImage, searchMedia, toggleMediaFavorite, trackpadAvailable, type BrowseItem, type MusicBridgeStatus, type MusicHubItem, type MusicLibraryKind, type NexusFavorite, type RemoteKey, type RemoteRoute } from './media';
import { serviceBrand } from './brands';
import { connectedServices, engineSetup, engineStatus, entryVisible, formDefaults, MUSIC_SERVICES, MusicEngineSession, serviceLogo, type EngineStatus, type FlowEntry, type FlowStep, type MusicService, type ProviderInstance, type ProviderManifest } from './music-engine';

type ViewKind = 'home'|'lights'|'rooms'|'area'|'inventory'|'info'|'media'|'plus';
/** The four ways MP Nexus v2 lays itself out: phone, tablet held upright, tablet held sideways, computer. */
type Layout = 'phone'|'portrait'|'rail'|'desk';
type Tab = 'home'|'lights'|'rooms'|'media'|'plus';
interface AreaSummary { id:string; name:string; icon?:string; picture?:string; deviceCount:number; lightCount:number }
interface ViewConfig {
  title?: string;
  mp_project_name?: string;
  mp_spatial?: SpatialPlan;
  mp_spatial_origin?: 'project'|'areas'|'example';
  mp_appearance?: AppearanceConfig;
  mp_navigation?: NavigationConfig;
  mp_view_kind?: ViewKind;
  mp_view_path?: string;
  mp_view_title?: string;
  mp_areas?: AreaSummary[];
  mp_inventory?: { title:string; count:number };
  mp_info?: { version?: string; deviceCount: number; lightCount: number; areaCount: number };
  mp_entities?: string[];
  mp_media?: string[];
}
interface PlacedRoom { room: SpatialRoom; floor: SpatialFloor }
/** The four faces of the Multimédia page. */
type MediaTab = 'play'|'foryou'|'rooms'|'remote';
/** A panel opened over the page: a thermostat (or the list of them), or the covers of the house or of one room. */
interface SubPanel { type: 'climate'|'covers'|'routines'|'routine'|'energy'|'outdoor'|'access'|'history'|'backup'|'saver'|'users'|'guest'|'appearance'|'customize'|'educate'; id: string }
interface LogEntry { when: number; entity_id?: string; name?: string; message?: string; state?: string }
const EXPORT_KEY = 'mp-nexus.last-export';
const newGuest = (): GuestDraft => ({ name: '', kind: 'temporary', profile: 'read', local_only: true, until: defaultUntil() });
const newRoutine = (): Routine => ({ name: '', when: { kind: 'sunset', offsetMinutes: 0 }, then: { kind: 'covers-close', entities: [] } });
/** The browser's dictation, under the name each browser gives it. */
interface SpeechEvent { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }
interface Recognition { lang: string; interimResults: boolean; onresult: ((e: SpeechEvent) => void) | null; onend: (() => void) | null; onerror: (() => void) | null; start(): void; stop(): void }
const speechRecognition = () => (window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }).SpeechRecognition
  ?? (window as unknown as { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition;
/** The faces of people without a picture: one colour each, always in the same order. */
const AVATAR_TONES = ['linear-gradient(135deg,#65b5ff,#327ccd)', 'linear-gradient(135deg,#ff9fb6,#c14d7a)', 'linear-gradient(135deg,#ffe481,#ff9f40)', 'linear-gradient(135deg,#7be0c4,#2c7f8f)', 'linear-gradient(135deg,#b9a4ff,#5a3fb0)'];
interface Browsing { player: string; stack: BrowseItem[]; state: 'loading'|'ready'|'error' }

/** Kept in this browser, shared with the v1 view: the house of the domain the plan shows. */
const BUILDING_KEY = 'mp-glass.building';
function readBuilding(): string { try { return localStorage.getItem(BUILDING_KEY) ?? ''; } catch { return ''; } }
/** The layer chosen on the plan, kept from one page to the next while the dashboard stays open. */
let chosenLayer: PlanMode = 'lights';
/** Every page of the dashboard is told when the look changes; the house's once saved, over the one the dashboard loaded with. */
const LOOK_CHANGED = 'mp-nexus-look-changed';
let savedHouse: AppearanceConfig | undefined;
/** Each page opens its plan on the layer that speaks of it; the others keep the layer last chosen. */
const PAGE_LAYERS: Partial<Record<ViewKind, PlanMode>> = { lights: 'lights', media: 'media' };
/** The face of the Multimédia page last chosen, kept while the dashboard stays open. */
let mediaTab: MediaTab = 'play';
/** The player last chosen, kept while the dashboard stays open, so a card of the home opens the Multimédia page on it. */
let mediaPlayer = '';
const MEDIA_TABS: Record<MediaTab, { label: 'Lecture'|'Pour vous'|'Pièces'|'Télécommande'; icon: MPIconName }> = {
  play: { label: 'Lecture', icon: 'play' }, foryou: { label: 'Pour vous', icon: 'sparkle' }, rooms: { label: 'Pièces', icon: 'speaker' }, remote: { label: 'Télécommande', icon: 'remote' },
};
/** The keys some remotes have beside the arrows, in the order a remote shows them. */
const REMOTE_SHORTCUTS: [RemoteKey, MPIconName, MessageKey][] = [
  ['input', 'tv', 'Source'], ['guide', 'clock', 'Guide TV'], ['info', 'info', 'Info'], ['apps', 'layers', 'Applis'], ['settings', 'tune', 'Réglages'],
  ['options', 'dots', 'Options'], ['search', 'search', 'Rechercher'], ['assistant', 'mic', 'Assistant vocal'], ['captions', 'text', 'Sous-titres'],
  ['control', 'sliders', 'Centre de contrôle'], ['ambilight', 'sun', 'Ambilight'], ['replay', 'repeat', 'Revoir'], ['rewind', 'previous', 'Reculer'],
  ['forward', 'next', 'Avancer'], ['exit', 'close', 'Quitter'],
];
const COLOR_NAMES: Record<'red'|'green'|'yellow'|'blue', MessageKey> = { red: 'Rouge', green: 'Vert', yellow: 'Jaune', blue: 'Bleu' };
const APP_NAMES: Record<'netflix'|'youtube'|'prime', string> = { netflix: 'Netflix', youtube: 'YouTube', prime: 'Prime Video' };
type RemoteSlot = RemoteKey | 'power';
/** Where each brand's own phone app puts its keys: above the pad, the large keys right under it, and whether it has channels. */
interface RemoteLayout { top: RemoteSlot[]; under: RemoteKey[]; channels: boolean; skip: 'ten'|'scan'; faces?: Partial<Record<RemoteKey, [MPIconName, MessageKey]>> }
const REMOTE_LAYOUTS: Record<string, RemoteLayout> = {
  apple_tv: { top: ['power', 'menu', 'control'], under: ['back', 'home'], channels: false, skip: 'ten', faces: { home: ['tv', 'Accueil'] } },
  androidtv_remote: { top: ['power', 'input', 'settings'], under: ['back', 'home', 'assistant'], channels: true, skip: 'scan', faces: { assistant: ['mic', 'Assistant'] } },
  androidtv: { top: ['power', 'input', 'settings'], under: ['back', 'home', 'menu'], channels: true, skip: 'scan' },
  samsungtv: { top: ['power', 'input', 'guide'], under: ['back', 'home', 'exit'], channels: true, skip: 'scan' },
  webostv: { top: ['power', 'menu', 'guide'], under: ['back', 'home', 'info'], channels: true, skip: 'scan', faces: { menu: ['tune', 'Réglages'] } },
  braviatv: { top: ['power', 'input', 'options'], under: ['back', 'home', 'guide'], channels: true, skip: 'scan' },
  panasonic_viera: { top: ['power', 'input', 'apps'], under: ['back', 'home', 'menu'], channels: true, skip: 'scan' },
  philips_js: { top: ['power', 'input', 'ambilight'], under: ['back', 'home', 'menu'], channels: true, skip: 'scan', faces: { menu: ['dots', 'Options'] } },
  roku: { top: ['power', 'back', 'home'], under: ['replay', 'menu'], channels: false, skip: 'scan', faces: { menu: ['star', 'Options'] } },
  kodi: { top: ['power', 'menu', 'info'], under: ['back', 'home'], channels: false, skip: 'ten' },
};
const DEFAULT_LAYOUT: RemoteLayout = { top: ['power', 'back', 'home', 'menu'], under: [], channels: true, skip: 'ten' };
const REMOTE_FACES: Partial<Record<RemoteKey, [MPIconName, MessageKey]>> = {
  back: ['back', 'Retour'], home: ['home', 'Accueil'], menu: ['dots', 'Menu'],
  ...Object.fromEntries(REMOTE_SHORTCUTS.map(([k, icon, label]) => [k, [icon, label]])),
};
/** A short buzz under the finger, where the phone can, so a key feels pressed. */
const tap = () => { try { navigator.vibrate?.(8); } catch { /* No vibration on this device. */ } };
interface Enrollment { step: 'name'|'word'|'sentence'|'saving'|'done'|'error'; name: string; words: Float32Array[]; sentences: Float32Array[]; recording: boolean; level: number; note?: string; id?: string; again?: string }
/** Read aloud while making a wake word: ordinary speech, so that Nexus learns what is not its name. */
const ENROLL_SENTENCES = ['Ce soir, je voudrais écouter un peu de musique dans le salon.', 'Pense à éteindre les lumières de la cuisine avant de partir.'] as const;
/** Requests in a row without touching the screen, after the wake word; then Nexus waits for its name again. */
/** The colour of a thermostat's arc: what it is doing, as the plan and the detail window show it. */
/** The usual presets and fan speeds of thermostats, named in the interface language; others keep the name their integration gives. */
const CLIMATE_NAMES: Record<string, 'Aucun'|'Éco'|'Confort'|'Absent'|'Nuit'|'Boost'|'Programme'|'Automatique'|'Faible'|'Moyenne'|'Forte'> = {
  none: 'Aucun', eco: 'Éco', comfort: 'Confort', away: 'Absent', sleep: 'Nuit', boost: 'Boost', schedule: 'Programme', auto: 'Automatique', low: 'Faible', medium: 'Moyenne', high: 'Forte',
};
const climateName = (value: string) => { const key = CLIMATE_NAMES[value.toLowerCase()]; return key ? tr(key) : value; };
/** The weather as Home Assistant names it, in the interface language. */
const WEATHER: Record<string, 'Ensoleillé'|'Nuit claire'|'Nuageux'|'Éclaircies'|'Pluie'|'Averses'|'Neige'|'Neige et pluie'|'Brouillard'|'Venteux'|'Orage'|'Grêle'> = {
  sunny: 'Ensoleillé', 'clear-night': 'Nuit claire', cloudy: 'Nuageux', partlycloudy: 'Éclaircies', rainy: 'Pluie', pouring: 'Averses', snowy: 'Neige', 'snowy-rainy': 'Neige et pluie',
  fog: 'Brouillard', windy: 'Venteux', 'windy-variant': 'Venteux', lightning: 'Orage', 'lightning-rainy': 'Orage', hail: 'Grêle',
};
const weatherName = (state: string) => { const key = WEATHER[state]; return key ? tr(key) : state; };
/** The weather drawn from the icons at hand: rain, snow, a clear night, else the sun. */
const weatherIcon = (state: string): MPIconName => ['rainy', 'pouring', 'lightning-rainy', 'hail'].includes(state) ? 'drop' : ['snowy', 'snowy-rainy'].includes(state) ? 'snow' : state === 'clear-night' ? 'moon' : state === 'windy' || state === 'windy-variant' ? 'fan' : 'sun';
const HVAC_TONES: Record<string, string> = { heat: '#ff9a5c', cool: '#5cd8ff', dry: '#b08cff', fan_only: '#71d7c0', heat_cool: '#ffd45c', auto: '#ffd45c' };
const TABS: Record<Tab, { label: 'Accueil'|'Lumières'|'Pièces'|'Multimédia'|'Plus'; icon: MPIconName }> = {
  home: { label: 'Accueil', icon: 'home' }, lights: { label: 'Lumières', icon: 'bulb' }, rooms: { label: 'Pièces', icon: 'rooms' },
  media: { label: 'Multimédia', icon: 'music' }, plus: { label: 'Plus', icon: 'dots' },
};
/** Domains a touch switches; the others open their window. */
const SWITCHED = ['light', 'cover', ...TOGGLE_DOMAINS];
const HOLD_MS = 520;
/** The translated plan of the areas or of the example, made once per plan and language: the 3D plan redraws only when it changes. */
const translated = new WeakMap<SpatialPlan, Map<string, SpatialPlan>>();

/** An engine by the name Home Assistant shows, not its entity id. */
function engineLabel(hass: Hass | undefined, e: { id: string; name: string }) {
  const friendly = hass?.states[e.id]?.attributes?.friendly_name;
  return typeof friendly === 'string' && friendly ? friendly : e.name;
}

export class MPNexusView extends LitElement {
  static properties = { cards:{attribute:false}, badges:{attribute:false}, hass:{attribute:false}, layout:{state:true}, room:{state:true}, full:{state:true}, layer:{state:true}, shownLayer:{state:true}, layers:{state:true}, detail:{state:true}, languageOpen:{state:true}, floorFilter:{state:true}, player:{state:true}, online:{state:true}, mediaTab:{state:true}, browsing:{state:true}, queue:{state:true}, mediaFavorites:{state:true}, mediaNotice:{state:true}, mediaSearch:{state:true}, mediaResults:{state:true}, mediaSearching:{state:true}, sub:{state:true}, scenesOpen:{state:true}, prefs:{state:true}, overlay:{state:true}, voiceState:{state:true}, voiceLevel:{state:true}, voiceHeard:{state:true}, voicePrefs:{state:true}, voiceEngines:{state:true}, voiceList:{state:true}, wakeList:{state:true}, wakeState:{state:true}, wakeOld:{state:true}, timerSnap:{state:true}, timerTick:{state:true}, enroll:{state:true}, query:{state:true}, answer:{state:true}, listening:{state:true}, draft:{state:true}, routineState:{state:true}, logbook:{state:true}, backupState:{state:true}, saver:{state:true}, saving:{state:true}, guests:{state:true}, guestDraft:{state:true}, invitation:{state:true}, guestNote:{state:true}, network:{state:true}, access:{state:true}, engine:{state:true}, musicSources:{state:true}, musicFlow:{state:true}, musicServicesOpen:{state:true}, remoteExtra:{state:true}, remoteText:{state:true} };
  static styles = nexusStyles;

  cards: HTMLElement[] = [];
  badges: HTMLElement[] = [];
  hass?: Hass;
  private language = new LanguageController(this);
  private projectName = '';
  private spatial?: SpatialPlan;
  private spatialOrigin: ViewConfig['mp_spatial_origin'] = 'project';
  private appearance: AppearanceConfig = { preset: 'glass-blue' };
  /** The look saved for the whole house; an administrator's changes not yet saved; the screen's own look over both. */
  private houseLook: AppearanceConfig = { preset: 'glass-blue' };
  private houseDraft?: AppearanceConfig;
  private screenLook: ScreenLook = readScreenLook();
  private lookScope: 'screen'|'house' = 'screen';
  private lookSlot: 'day'|'night' = 'day';
  private imported?: ImportedWallpaper[];
  private importedMax = 24;
  private lookBusy = false;
  private lookNote?: { ok: boolean; text: string };
  private navigation: NavigationConfig = { items: ['home', 'lights', 'rooms'], showLabels: true };
  private kind: ViewKind = 'home';
  private path = 'home';
  private viewTitle = '';
  private areas: AreaSummary[] = [];
  private inventory?: ViewConfig['mp_inventory'];
  private info?: ViewConfig['mp_info'];
  private entityIds: string[] = [];
  private mediaIds: string[] = [];
  private building = readBuilding();
  private layout: Layout = 'desk';
  /** The room opened from the plan: its card beside the plan, in a sheet on a phone. */
  private room = '';
  private full = false;
  private layer: PlanMode = chosenLayer;
  /** What the plan shows: the layer asked for when the floors shown offer it, else its lights. */
  private shownLayer: PlanMode = 'lights';
  private layers: PlanMode[] = ['lights'];
  private detail = '';
  private languageOpen = false;
  private floorFilter = '';
  private player = mediaPlayer;
  private online = true;
  private mediaTab: MediaTab = mediaTab;
  private browsing?: Browsing;
  private queue?: { player: string; next: { title: string; artist: string; image: string } };
  private queueKey = '';
  private queueRequest = 0;
  private queueFetchedAt = 0;
  private queueLoading = false;
  private browseRequest = 0;
  private mediaFavorites: NexusFavorite[] = [];
  private mediaFavoritesKey = '';
  private mediaNotice = '';
  private mediaSearch = '';
  private mediaResults?: BrowseItem[];
  private mediaSearching = false;
  private mediaSearchRequest = 0;
  private musicBridge?: MusicBridgeStatus | 'loading';
  private musicBridgeConnection?: object;
  private musicKind: MusicLibraryKind = 'albums';
  private musicItems?: MusicHubItem[];
  private musicLoading = false;
  private musicLibraryRequest = 0;
  private musicQueueData?: { player: string; queue_id?: string; current_index?: number; items: MusicHubItem[] };
  private musicQueueAt = 0;
  /** The household music engine, as an administrator sees it; members never ask. */
  private engine?: EngineStatus | 'loading' | 'error';
  private engineConnection?: object;
  private engineTimer?: number;
  private engineSession?: { entry: string; session: MusicEngineSession };
  private musicSources?: { providers: ProviderInstance[]; manifests: ProviderManifest[] } | 'loading' | 'error';
  /** The service being connected, and the step of its sign-in the person is at. */
  private musicFlow?: { service: MusicService; step?: FlowStep; values: Record<string, unknown>; busy: boolean; error?: string; reconnect?: string };
  private flowTimer?: number;
  private musicServicesOpen = false;
  private remotePointer?: { id: number; player: string; x: number; y: number; moved: boolean };
  /** The drawer open under the remote: the numbers, or the keyboard that types on the television. */
  private remoteExtra?: 'digits'|'keyboard';
  private remoteText = '';
  /** The keyboard opens by itself while the television waits for text, unless it was closed during that wait. */
  private remoteFocusClosed = false;
  private remoteFocusShown = false;
  private imageObserver?: IntersectionObserver;
  private protectedImages = new Map<string, string>();
  private protectedImageRequests = new Map<string, Promise<string | undefined>>();
  private sub?: SubPanel;
  private scenesOpen = false;
  private prefs: NexusPrefs = readPrefs();
  private overlay: ''|'search'|'alerts'|'invite'|'voice'|'enroll'|'timers'|'ring' = '';
  private timerSnap: TimerSnapshot = NO_TIMERS; private timerTick = 0;
  private timerFeed?: TimerFeed; private timerFeedFor?: object; private timerTicker?: number;
  private ringing?: { key: string; sound: ReturnType<typeof ringSound> };
  /** The voice of Nexus: what it is doing, how loud it hears, what it heard, and how it speaks on this screen. */
  private voiceState: 'idle'|'listening'|'thinking'|'speaking' = 'idle';
  private voiceLevel = 0;
  private voiceHeard = '';
  private voicePrefs: VoicePrefs = readVoicePrefs();
  private voiceEngines?: { id: string; name: string }[];
  /** The wake word: the words this home can use, and whether this screen is listening for its own. */
  private wakeList?: WakeWord[];
  private wakeState: 'off'|'loading'|'touch'|'armed'|'error'|'gone' = 'off';
  /** A voice word recorded before 0.38.1, without its far versions: it hears poorly from across the room. */
  private wakeOld = false;
  private wakePeak = 0; private wakePeakAt = 0;
  private wakeListener?: WakeListener;
  private waking = false; private voiceRelease?: () => void;
  private wakeGuard = new WakeGuard();
  private wakeAttempt = false;
  private wakeCooldownTimer?: number;
  private wakeFor?: string;
  /** A conversation started by the wake word goes on without touching the screen, and closes by itself in silence. */
  private handsFree = false;
  private tabletVolume = new TabletVolume(() => this.hass);
  private announcements = new AlertAnnouncements();
  private announceMode: 'off'|'alarm'|'all' = (() => { try { const s = localStorage.getItem('mp-nexus.announcements'); return s === 'alarm' || s === 'all' ? s : 'off'; } catch { return 'off'; } })();
  private announcementSpeech?: Speech;
  private tabletServices?: string[];
  private tabletServicesAt = 0;
  /** The lesson Nexus is giving, when the voice panel is one; lessons run longer than a command. */
  private lesson = '';
  private facts?: FactsListing; private factsAsked = false; private voiceList?: { key: string; voices: { id: string; name: string }[] }; private factText = ''; private factNote = '';
  private handsFreeTurns = 0;
  /** A voice word learns on this screen: ordinary sounds, and what woke Nexus (kept until the request tells which it was). */
  private wakeLesson?: { word: string; heard: Float32Array };
  /** Making a wake word from the voice: the steps and what was recorded. */
  private enroll?: Enrollment;
  private enrollStop: { stop?: () => void } = {};
  private recorder?: Recorder;
  private speech?: Speech;
  private transcription?: boolean;
  /** Each turn of the voice gets a number: an answer that comes back after the voice was closed or restarted is dropped. */
  private voiceTurn = 0;
  private query = '';
  private answer?: { text: string; touched?: string[] };
  /** The conversation going on with the assistant, so « et dans la cuisine ? » follows the last request. */
  private conversationId?: string;
  private pendingVoiceRoutine?: { routine: VoiceRoutine; expires: number };
  private listening = false;
  private draft: Routine = newRoutine();
  private routineState: ''|'saving'|'saved'|'error' = '';
  private routineRoom = '';
  private routineWhenRoom = '';
  private logbook?: LogEntry[] | 'error';
  private logbookAsked = false;
  private replay?: { from: number; until: number; at: number; rows: Record<string, HistoryRow[]> } | 'loading' | 'error' | 'too-many';
  private replayRequest = 0;
  private ignoredSuggestions: string[] = (() => { try { const value: unknown = JSON.parse(localStorage.getItem('mp-nexus.suggestions.dismissed') ?? '[]'); return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string').slice(-100) : []; } catch { return []; } })();
  private backupState?: { ok: boolean; text: string };
  private lastExport = (() => { try { return Number(localStorage.getItem(EXPORT_KEY)) || 0; } catch { return 0; } })();
  private saver: SaverPrefs = readSaver();
  private saving = false;
  private guests?: Guest[] | 'error';
  private guestsAsked = false;
  private guestDraft: GuestDraft = newGuest();
  private guestNote?: { ok: boolean; text: string };
  /** The invitation or the password just made, shown once: nothing keeps it after the window closes. */
  private invitation?: { guest: string; invitation?: Invitation; qr?: string; password?: { username: string; password: string }; copied?: boolean };
  private network: 'trusted'|'proxy'|'unknown' = 'unknown';
  private access?: { guest: boolean; profile?: Guest['profile']; until?: number | null };
  private accessAsked = false;
  private saverSince = 0;
  /** The layers the plan of the screensaver offers, kept apart from those of the page. */
  private saverLayers: PlanMode[] = [];
  /** Ticks while the screensaver shows, to bring in the next photo or the next layer on time. */
  private saverTimer?: number;
  private saverStep = '';
  private lastActivity = Date.now();
  private header?: Element;
  private clock?: number;
  private hold?: number;
  private held = false;
  private resize = new ResizeObserver(() => this.measure());
  private connectionWatched?: object;

  setConfig(config: ViewConfig) {
    this.projectName = config?.mp_project_name ?? config?.title ?? '';
    this.spatial = config?.mp_spatial;
    this.spatialOrigin = config?.mp_spatial_origin ?? 'project';
    this.houseLook = savedHouse ?? config?.mp_appearance ?? { preset: 'glass-blue' };
    this.navigation = config?.mp_navigation ?? { items: ['home', 'lights', 'rooms'], showLabels: true };
    this.kind = config?.mp_view_kind ?? 'home';
    if ((config?.mp_view_path ?? 'home') !== this.path) this.sub = undefined;
    this.path = config?.mp_view_path ?? 'home';
    this.viewTitle = config?.mp_view_title ?? '';
    this.areas = config?.mp_areas ?? [];
    this.inventory = config?.mp_inventory;
    this.info = config?.mp_info;
    this.entityIds = config?.mp_entities ?? [];
    this.mediaIds = config?.mp_media ?? [];
    this.layer = PAGE_LAYERS[this.kind] ?? chosenLayer;
    this.applyLook();
  }
  /** A look kept for this screen, told at once to the other pages of the dashboard that Home Assistant keeps alive. */
  private writeLook(look: ScreenLook) {
    writeScreenLook(look);
    dispatchEvent(new CustomEvent(LOOK_CHANGED, { detail: this }));
  }
  /** Another page changed the look (or another tab, through storage): this one shows it too, without a reload. */
  private lookChanged = (event: Event) => {
    if (event instanceof CustomEvent && event.detail === this) return;
    if (event instanceof StorageEvent && event.key !== null && event.key !== SCREEN_LOOK_KEY) return;
    this.screenLook = readScreenLook();
    if (savedHouse) this.houseLook = savedHouse;
    this.applyLook();
  };
  /** The look shown: the house's (or its draft while an administrator edits it), then what this screen sets for itself. */
  private applyLook() {
    this.appearance = { ...(this.houseDraft ?? this.houseLook), ...this.screenLook };
    applyAppearance(this, this.appearance);
    const a = this.appearance;
    const vars: Record<string, string> = { 'max-width': `${Math.max(1200, a.maxWidth ?? 1560)}px`, 'bg-blur': `${a.backgroundBlur ?? 0}px`, 'bg-saturation': String(a.backgroundSaturation ?? 1) };
    for (const [name, value] of Object.entries(vars)) this.style.setProperty(`--mp-${name}`, value);
    this.requestUpdate();
  }

  connectedCallback() {
    super.connectedCallback();
    this.header = claimHeader(this);
    // Home Assistant keeps each view and plugs it back in: the voice may have been changed in another one meanwhile.
    this.voicePrefs = readVoicePrefs();
    addEventListener(VOICE_EVENT, this.voicePrefsChanged);
    addEventListener('storage', this.voicePrefsStored);
    this.toggleAttribute('comfort', this.prefs.comfort);
    this.addEventListener('hass-more-info', this.interceptMoreInfo);
    addEventListener('resize', this.measure);
    window.visualViewport?.addEventListener('resize', this.measure);
    window.visualViewport?.addEventListener('scroll', this.measure);
    addEventListener('keydown', this.escape);
    addEventListener('pointerdown', this.outside);
    addEventListener(LOOK_CHANGED, this.lookChanged);
    addEventListener('storage', this.lookChanged);
    // A page Home Assistant kept aside comes back with the look chosen meanwhile on another page.
    this.lookChanged(new Event(LOOK_CHANGED));
    this.resize.observe(this);
    this.clock = window.setInterval(() => { this.checkIdle(); this.requestUpdate(); }, 15_000);
    for (const type of ['pointerdown', 'keydown', 'wheel']) addEventListener(type, this.activity, { passive: true });
    document.addEventListener('visibilitychange', this.wakeVisibility);
    this.measure();
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.announcementSpeech?.stop(); this.announcementSpeech = undefined; this.announcements.reset();
    void this.tabletVolume.set(false);
    this.endVoice();
    removeEventListener(VOICE_EVENT, this.voicePrefsChanged);
    removeEventListener('storage', this.voicePrefsStored);
    this.voiceRelease?.(); this.voiceRelease = undefined;
    this.stopWake();
    this.stopTimers();
    document.removeEventListener('visibilitychange', this.wakeVisibility);
    if (this.header) releaseHeader(this.header, this);
    this.header = undefined;
    this.removeEventListener('hass-more-info', this.interceptMoreInfo);
    removeEventListener('resize', this.measure);
    window.visualViewport?.removeEventListener('resize', this.measure);
    window.visualViewport?.removeEventListener('scroll', this.measure);
    removeEventListener('keydown', this.escape);
    removeEventListener('pointerdown', this.outside);
    removeEventListener(LOOK_CHANGED, this.lookChanged);
    removeEventListener('storage', this.lookChanged);
    clearTimeout(this.engineTimer); clearTimeout(this.flowTimer);
    clearTimeout(this.wakeCooldownTimer); this.wakeCooldownTimer = undefined;
    this.engineSession?.session.close(); this.engineSession = undefined;
    for (const type of ['pointerdown', 'keydown', 'wheel']) removeEventListener(type, this.activity);
    this.resize.disconnect();
    this.imageObserver?.disconnect();
    this.imageObserver = undefined;
    for (const url of this.protectedImages.values()) URL.revokeObjectURL(url);
    this.protectedImages.clear();
    clearInterval(this.clock);
    clearInterval(this.saverTimer); this.saverTimer = undefined;
    this.remotePointer = undefined;
    this.browseRequest++;
    this.queueRequest++;
    this.queueLoading = false;
  }
  protected updated() {
    this.watchConnection();
    this.checkAnnouncements();
    void this.tabletVolume.set(this.overlay === 'voice' && this.voiceState === 'listening', this.voicePrefs.tabletVolume);
    // Every path back to the idle orb gets a deadline, including interrupted or empty conversations.
    if (this.overlay === 'voice' && this.voiceState === 'idle') {
      if (this.voiceCloseTimer === undefined) this.scheduleVoiceClose();
    } else if (this.voiceCloseTimer !== undefined) {
      clearTimeout(this.voiceCloseTimer); this.voiceCloseTimer = undefined;
    }
    if (this.voiceRelease && this.overlay !== 'voice') { this.voiceRelease(); this.voiceRelease = undefined; }
    queueMicrotask(() => this.keepWake());
    queueMicrotask(() => this.keepTimers());
    this.observeProtectedImages();
    if (this.saving) this.checkIdle();
    if (this.saving && !this.saverTimer) this.saverTimer = window.setInterval(this.saverTick, 1000);
    else if (!this.saving && this.saverTimer) { clearInterval(this.saverTimer); this.saverTimer = undefined; }
    if ((this.saving && this.saver.content === 'photos') || this.sub?.type === 'saver') this.loadImported();
    if (this.sub?.type === 'history') this.loadLogbook(); else if (this.logbookAsked) { this.logbookAsked = false; this.logbook = undefined; }
    if (this.sub?.type === 'users' || this.sub?.type === 'guest') this.loadGuests(); else if (this.guestsAsked) { this.guestsAsked = false; this.guests = undefined; }
    if (this.hass && !this.accessAsked && !this.hass.user?.is_admin) { this.accessAsked = true; myAccess(this.hass).then(a => { this.access = a; }).catch(() => undefined); }
    if (this.kind !== 'media') return;
    this.loadEngine();
    const id = this.currentPlayer;
    if (!id) return;
    const favoriteKey = this.mediaFavoriteStorageKey();
    if (favoriteKey !== this.mediaFavoritesKey) { this.mediaFavoritesKey = favoriteKey; this.mediaFavorites = readMediaFavorites(favoriteKey); }
    this.loadMusicBridge();
    if (this.mediaTab === 'play') { this.loadQueue(id); this.loadMusicQueue(id); }
    if (this.mediaTab === 'foryou' && this.browsing?.player !== id && canMedia(this.state(id), 'browse_media')) void this.browseInto(id);
  }

  /** The app fills the visible HA WebView, including after iPhone rotation or a native inset change. */
  private measure = () => {
    const viewport = window.visualViewport;
    const top = Math.max(0, this.getBoundingClientRect().top - (viewport?.offsetTop ?? 0));
    // WKWebView can report a visual viewport shortened by the home-indicator inset.
    // Only follow that shorter height when a keyboard or another large obstruction is open.
    const visible = viewport?.height ?? innerHeight;
    const screen = Math.max(innerHeight, document.documentElement.clientHeight);
    const viewportHeight = screen - visible > 100 ? visible : Math.max(visible, screen);
    const height = Math.max(1, Math.floor(viewportHeight - top));
    const width = this.clientWidth || viewport?.width || innerWidth;
    this.style.setProperty('--mp-app-height', `${height}px`);
    const layout: Layout = width < 700 || (height < 520 && width < 1000) ? 'phone' : width >= 1200 ? 'desk' : height > width ? 'portrait' : 'rail';
    if (layout !== this.layout || this.getAttribute('layout') !== layout) { this.layout = layout; this.setAttribute('layout', layout); }
  };
  private watchConnection() {
    const conn = this.hass?.connection as unknown as { connected?: boolean; addEventListener?: (type: string, listener: () => void) => void } | undefined;
    if (!conn?.addEventListener || this.connectionWatched === conn) return;
    this.connectionWatched = conn;
    const update = () => { this.online = conn.connected !== false; };
    for (const type of ['ready', 'reconnected', 'disconnected']) conn.addEventListener(type, update);
    update();
  }
  private escape = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || this.detail || e.composedPath().some(node => node instanceof HTMLDialogElement && node.open)) return;
    if (this.languageOpen) this.languageOpen = false;
    else if (this.overlay) this.closeOverlay();
    else if (this.full) this.full = false;
    else if (this.sub) this.sub = undefined;
    else if (this.room && this.layout === 'phone') this.room = '';
  };
  private outside = (e: Event) => {
    if (this.languageOpen && !e.composedPath().some(node => node instanceof HTMLElement && node.classList.contains('language'))) this.languageOpen = false;
  };
  /** Every more-info asked on this page opens the MP Nexus window instead, as on the v1 pages. */
  private interceptMoreInfo = (event: Event) => {
    const detail = (event as CustomEvent<{ entityId?: unknown; mpNative?: unknown } | undefined>).detail;
    if (detail?.mpNative === true) return;
    const entityId = typeof detail?.entityId === 'string' ? detail.entityId : '';
    if (!entityId.includes('.')) return;
    event.stopPropagation();
    this.detail = entityId;
  };

  // ——— Places ———
  private route(path: string) {
    const parts = window.location.pathname.split('/').filter(Boolean);
    return `/${[...parts.slice(0, -1), path].join('/')}`;
  }
  /** Goes to another page the way a link would, so Home Assistant keeps its own navigation. */
  private go(path: string) {
    const link = document.createElement('a');
    link.href = path.startsWith('/') ? path : this.route(path);
    this.renderRoot.appendChild(link);
    link.click();
    link.remove();
  }
  private areaPath(areaId?: string) { return areaId && this.areas.some(a => a.id === areaId) ? `area-${areaId}` : undefined; }
  private areaHref = (areaId: string) => { const path = this.areaPath(areaId); return path ? this.route(path) : undefined; };
  private get tab(): Tab { return this.kind === 'area' || this.kind === 'inventory' ? (this.kind === 'area' ? 'rooms' : 'plus') : this.kind === 'info' ? 'plus' : this.kind; }
  private get tabs(): Tab[] { return [...this.navigation.items, 'media', 'plus']; }

  // ——— The plan ———
  /** The plan of the house shown, its names in the interface language when MP Nexus drew it. */
  private get plan(): SpatialPlan | undefined {
    const spatial = this.spatial;
    if (!spatial?.enabled || !spatial.floors.length) return undefined;
    let named = spatial;
    if (this.spatialOrigin !== 'project') {
      const cache = translated.get(spatial) ?? new Map<string, SpatialPlan>(), key = language();
      named = cache.get(key) ?? trPlan(spatial, this.spatialOrigin === 'example');
      translated.set(spatial, cache.set(key, named));
    }
    return withoutHidden(buildingPlan(named, this.building), this.setAside);
  }
  private get placed(): PlacedRoom[] { return this.plan?.floors.flatMap(floor => floor.rooms.map(room => ({ room, floor }))) ?? []; }
  private find(roomId: string) { return this.placed.find(p => p.room.id === roomId); }
  private get houses() { return this.spatial?.enabled ? planBuildings(this.spatial).filter(h => h.floors.length) : []; }
  private chooseHouse(id: string) {
    this.building = id; this.room = '';
    try { localStorage.setItem(BUILDING_KEY, id); } catch { /* The choice holds for this page only. */ }
  }
  private planAmbiance = (e: CustomEvent<{ mode: PlanMode; floorIds: string[]; modes?: PlanMode[] }>) => {
    this.shownLayer = e.detail.mode;
    if (e.detail.modes?.length) this.layers = e.detail.modes;
  };
  private chooseLayer(mode: PlanMode) { this.layer = mode; this.shownLayer = mode; chosenLayer = mode; }
  /** A room touched on the plan: its card on the home page, its group of lights, its own page from the rooms. */
  private planRoom = (e: CustomEvent<{ roomId: string }>) => {
    const roomId = e.detail.roomId, placed = this.find(roomId);
    if (!placed) return;
    if (!this.full && (this.kind === 'rooms' || this.kind === 'area')) {
      const path = this.areaPath(placed.room.areaId);
      if (path && path !== this.path) { this.go(path); return; }
    }
    this.room = roomId;
    if (this.kind === 'lights') this.renderRoot.querySelector(`[data-room="${CSS.escape(roomId)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  private planDeselect = () => { if (this.kind !== 'area') this.room = ''; };
  private viewer(opts: { focus?: string; expandable?: boolean; quiet?: boolean; key: string; layer?: PlanMode; spin?: number; hass?: Hass; ambiance?: (e: CustomEvent<{ mode: PlanMode; floorIds: string[]; modes?: PlanMode[] }>) => void }) {
    const plan = this.plan;
    if (!plan) return nothing;
    return keyed(`${opts.key}|${this.building}`, html`<mp-spatial-viewer bare ?quiet=${opts.quiet ?? false} ?expandable=${opts.expandable ?? false} .plan=${plan} .scope=${this.building} .hass=${opts.hass ?? this.hass} .areaHref=${this.areaHref}
      .layer=${opts.layer ?? this.layer} .spin=${opts.spin ?? 0} .palette=${this.palette} .hiddenLayers=${this.appearance.hiddenLayers ?? []} .hiddenEntities=${this.setAside} .focusRoom=${opts.focus ?? this.room} @plan-ambiance=${opts.ambiance ?? this.planAmbiance} @room-select=${this.planRoom} @room-deselect=${this.planDeselect}
      @plan-expand=${() => { this.full = true; }}></mp-spatial-viewer>`);
  }
  /** The plan as a banner on a phone, a button to open it on the whole screen. */
  private banner(height: number, viewer: unknown) {
    return html`<div class="plan3d banner" style=${`--banner:${height}px`}>${viewer}<button class="ib fsb" aria-label=${tr('Plan en plein écran')} title=${tr('Plan en plein écran')} @click=${() => { this.full = true; }}>${mpIcon('expand', 16)}</button></div>`;
  }
  private layerButtons() {
    const offered = this.layers.length ? this.layers : ['lights' as PlanMode];
    if (offered.length < 2) return nothing;
    return html`<div class="layers" role="group" aria-label=${tr('Ambiance du plan')}>${offered.map(mode => html`<button aria-pressed=${mode === this.shownLayer} @click=${() => this.chooseLayer(mode)}>${mpIcon(PLAN_LAYERS[mode].icon, 15)}<span>${mode === 'media' ? tr('Médias') : tr(PLAN_LAYERS[mode].label)}</span></button>`)}</div>`;
  }
  private houseButtons() {
    const houses = this.houses;
    if (houses.length < 2) return nothing;
    const current = buildingPlan(this.spatial!, this.building).floors[0];
    return html`<div class="houses" role="group" aria-label=${tr('Maisons du domaine')}>${houses.map(({ building, floors }) => html`<button class="pill" aria-pressed=${floors[0] === current} @click=${() => this.chooseHouse(building.id)}>${mpIcon('home', 13)}${building.name || tr('Maison')}</button>`)}</div>`;
  }

  // ——— Devices ———
  private state(id: string): HAState | undefined { return this.hass?.states[id]; }
  /** What the person set aside in Personnaliser: neither shown nor counted anywhere in MP Nexus. */
  private get setAside(): ReadonlySet<string> {
    const ids = this.appearance.hiddenEntities ?? [], key = ids.join(',');
    if (key !== this.hiddenKey) { this.hiddenKey = key; this.hiddenIds = new Set(ids); }
    return this.hiddenIds;
  }
  private hiddenKey = '';
  private hiddenIds: ReadonlySet<string> = new Set();
  private get entities() { return this.visible(this.entityIds); }
  private get media() { return this.visible(this.mediaIds); }
  private set media(ids: string[]) { this.mediaIds = ids; }
  private visible(ids: string[]) { const hidden = this.setAside; return hidden.size ? ids.filter(id => !hidden.has(id)) : ids; }
  /** The palette of the plan, the same object while the choices stay the same so the plan is not drawn again for nothing. */
  private get palette(): PlanPalette {
    const a = this.appearance, key = JSON.stringify([a.planColors, a.planGlow]);
    if (key !== this.paletteKey) { this.paletteKey = key; this.paletteValue = planPalette(a.planColors, a.planGlow); }
    return this.paletteValue;
  }
  private paletteKey = '';
  private paletteValue: PlanPalette = planPalette();
  private on(id: string) {
    const state = this.state(id), domain = domainOf(id);
    if (!available(state)) return false;
    if (domain === 'cover') return coverOpen(state) === true;
    if (domain === 'media_player') return mediaOn(state);
    if (domain === 'climate') return state!.state !== 'off';
    return state!.state === 'on';
  }
  private name(id: string, room = '') {
    const name = String(this.state(id)?.attributes.friendly_name ?? id), rest = name.slice(room.length);
    if (!room || !/^[\s·:|/–—-]/.test(rest) || name.slice(0, room.length).localeCompare(room, undefined, { sensitivity: 'base' }) !== 0) return name;
    return rest.replace(/^[\s·:|/–—-]+/, '') || name;
  }
  private call(domain: string, service: string, data: Record<string, unknown>) { void this.hass?.callService(domain, service, data); }
  private mediaFavoriteStorageKey() { return `mp-nexus.media-favorites:${this.hass?.user?.id ?? 'browser'}:${location.pathname}`; }
  private saveMediaFavorites(items: NexusFavorite[]) {
    this.mediaFavorites = items;
    try { localStorage.setItem(this.mediaFavoriteStorageKey(), JSON.stringify(items)); } catch { this.mediaNotice = tr('Les favoris ne peuvent pas être enregistrés sur cet appareil.'); }
  }
  private async mediaCall(service: string, data: Record<string, unknown>) {
    this.mediaNotice = '';
    if (this.mediaReadOnlyGuest) { this.mediaNotice = tr('Cet accès invité est en lecture seule.'); return false; }
    try { await this.hass?.callService('media_player', service, data); return true; }
    catch { this.mediaNotice = tr('La commande multimédia a échoué. Vérifiez les droits et la disponibilité du lecteur.'); return false; }
  }
  private async remoteCall(route: { domain: string; service: string; data: Record<string, unknown> }) {
    try { await this.hass?.callService(route.domain, route.service, route.data); this.mediaNotice = ''; }
    catch { this.mediaNotice = tr('La commande multimédia a échoué. Vérifiez les droits et la disponibilité du lecteur.'); }
  }
  private get mediaReadOnlyGuest() { return this.access?.guest === true && this.access.profile === 'read'; }
  private remoteModeKey(player: string) { return `mp-nexus.trackpad:${this.hass?.user?.id ?? 'browser'}:${location.pathname}:${player}`; }
  private remoteTrackpad(player: string) { try { return localStorage.getItem(this.remoteModeKey(player)) === 'on'; } catch { return false; } }
  private toggleRemoteTrackpad(player: string, enabled: boolean) { this.remotePointer = undefined; try { localStorage.setItem(this.remoteModeKey(player), enabled ? 'on' : 'off'); } catch { /* Current page choice still takes effect below. */ } this.requestUpdate(); }
  private remotePointerDown = (event: PointerEvent, player: string) => {
    event.stopPropagation();
    this.activity();
    if (!event.isPrimary || event.button !== 0) return;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.remotePointer = { id: event.pointerId, player, x: event.clientX, y: event.clientY, moved: false };
  };
  private remotePointerMove = (event: PointerEvent) => {
    event.stopPropagation();
    if (event.cancelable) event.preventDefault();
    const pointer = this.remotePointer;
    if (pointer?.id === event.pointerId && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) >= 12) pointer.moved = true;
  };
  private remotePointerUp = (event: PointerEvent, player: string, send: (key: RemoteKey) => void) => {
    event.stopPropagation();
    const pointer = this.remotePointer;
    this.remotePointer = undefined;
    if (!pointer || pointer.id !== event.pointerId || pointer.player !== player || this.currentPlayer !== player || this.mediaTab !== 'remote' || !this.remoteTrackpad(player)) return;
    const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
    if (Math.hypot(dx, dy) < 28) { if (!pointer.moved) send('select'); return; }
    send(Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 'right' : 'left' : dy > 0 ? 'down' : 'up');
  };
  private remotePointerCancel = (event: PointerEvent) => { event.stopPropagation(); if (this.remotePointer?.id === event.pointerId) this.remotePointer = undefined; };
  private remoteTouchMove = (event: TouchEvent) => { event.stopPropagation(); if (event.cancelable) event.preventDefault(); };
  private remoteTouchBoundary = (event: TouchEvent) => { event.stopPropagation(); };
  private remoteClick = (event: MouseEvent) => { event.stopPropagation(); event.preventDefault(); };
  private favoriteItem(item: NexusFavorite) { this.saveMediaFavorites(toggleMediaFavorite(this.mediaFavorites, item)); }
  private isMusicAssistantPlayer(id: string) {
    const state = this.state(id);
    return isMusicAssistant(this.hass?.entities?.[id]?.platform) || typeof state?.attributes.mass_player_type === 'string' || typeof state?.attributes.active_queue === 'string';
  }
  private async loadMusicBridge() {
    const hass = this.hass;
    if (!hass) return;
    if (this.musicBridgeConnection !== hass.connection) {
      this.musicBridgeConnection = hass.connection; this.musicBridge = 'loading'; this.musicItems = undefined;
      try { this.musicBridge = await musicStatus(hass); } catch { this.musicBridge = { configured: false, connected: false }; }
      this.requestUpdate();
    }
    if (this.musicBridge !== 'loading' && this.musicBridge?.connected && !this.musicItems && !this.musicLoading) void this.loadMusicLibrary(this.musicKind);
  }
  private async loadMusicLibrary(kind: MusicLibraryKind) {
    const hass = this.hass;
    if (!hass || this.musicBridge === 'loading' || !this.musicBridge?.connected) return;
    const request = ++this.musicLibraryRequest;
    this.musicKind = kind; this.musicLoading = true; this.musicItems = undefined;
    try { const items = await musicLibrary(hass, kind); if (request === this.musicLibraryRequest) this.musicItems = items; }
    catch { if (request === this.musicLibraryRequest) this.mediaNotice = tr('La bibliothèque Music Assistant ne répond pas.'); }
    finally { if (request === this.musicLibraryRequest) { this.musicLoading = false; this.requestUpdate(); } }
  }
  private async musicItemAction(id: string, item: MusicHubItem, action: 'play_now'|'play_next'|'add') {
    const hass = this.hass;
    if (!hass || this.mediaReadOnlyGuest) return;
    try {
      const queue = await musicQueue(hass, id);
      if (!queue.queue_id) throw new Error('queue unavailable');
      await musicAction(hass, action, { entity_id: id, media: item.media_content_id, media_type: item.media_content_type });
      this.mediaNotice = action === 'play_now' ? tr('Lecture lancée.') : action === 'play_next' ? tr('Ajouté à la suite.') : tr('Ajouté à la file.');
      this.musicQueueAt = 0; this.loadMusicQueue(id);
    } catch { this.mediaNotice = tr('La commande multimédia a échoué. Vérifiez les droits et la disponibilité du lecteur.'); }
    this.requestUpdate();
  }
  private async loadMusicQueue(id: string) {
    const hass = this.hass;
    if (!hass || !this.isMusicAssistantPlayer(id) || this.musicBridge === 'loading' || !this.musicBridge?.connected || Date.now() - this.musicQueueAt < 15_000) return;
    this.musicQueueAt = Date.now();
    try { const queue = await musicQueue(hass, id); this.musicQueueData = { player: id, ...queue }; }
    catch { this.musicQueueData = undefined; }
    this.requestUpdate();
  }
  private async musicQueueAction(action: 'clear', data: Record<string, unknown>) {
    const hass = this.hass, queue = this.musicQueueData;
    if (!hass || !queue?.queue_id || this.mediaReadOnlyGuest) return;
    try { await musicAction(hass, action, { entity_id: queue.player, ...data }); this.musicQueueAt = 0; await this.loadMusicQueue(queue.player); }
    catch { this.mediaNotice = tr('La commande multimédia a échoué. Vérifiez les droits et la disponibilité du lecteur.'); this.requestUpdate(); }
  }
  private async searchMusicAssistant(id: string) {
    const query = this.mediaSearch.trim(), hass = this.hass;
    if (!hass || !query || this.mediaReadOnlyGuest) return;
    const request = ++this.mediaSearchRequest;
    this.mediaSearching = true; this.mediaResults = undefined; this.mediaNotice = '';
    try {
      const results = this.musicBridge !== 'loading' && this.musicBridge?.connected ? await musicBridgeSearch(hass, query) : await searchMedia(hass, id, query);
      if (request === this.mediaSearchRequest && this.currentPlayer === id && this.mediaTab === 'foryou') this.mediaResults = results;
    } catch { if (request === this.mediaSearchRequest) this.mediaNotice = tr('La recherche Music Assistant a échoué. Vérifiez les droits et la disponibilité du lecteur.'); }
    finally { if (request === this.mediaSearchRequest) this.mediaSearching = false; }
  }
  private mediaSourceBadge(name: string) {
    const brand = serviceBrand(name);
    return html`<span class=${`source-logo ${brand?.tone ?? 'generic'}`} aria-hidden="true">${brand ? html`<img src=${brand.image} alt="" loading="lazy" decoding="async">` : name.trim().slice(0, 2).toUpperCase() || '♪'}</span>`;
  }
  /** A touch: a light, a shutter or a switch changes; a scene runs; a player pauses or plays; the rest opens its window. */
  private act(id: string) {
    if (this.held) { this.held = false; return; }
    const domain = domainOf(id), state = this.state(id);
    if (!available(state)) { this.detail = id; return; }
    if (domain === 'climate') this.sub = { type: 'climate', id };
    else if (SWITCHED.includes(domain)) this.call(domain, 'toggle', { entity_id: id });
    else if (RUN_SERVICES[domain]) this.call(domain, RUN_SERVICES[domain]!, { entity_id: id });
    else if (domain === 'media_player' && mediaOn(state) && canMedia(state, 'pause')) this.call('media_player', 'media_play_pause', { entity_id: id });
    else this.detail = id;
  }
  private press(id: string) { clearTimeout(this.hold); this.held = false; this.hold = window.setTimeout(() => { this.held = true; this.detail = id; }, HOLD_MS); }
  private release = () => clearTimeout(this.hold);
  /** A device in a tile: a touch for its main action, a long press or its corner button for everything else. */
  private tile(id: string, room = '') {
    const state = this.state(id), on = this.on(id), domain = domainOf(id), name = this.name(id, room);
    const detail = stateDetail(id, state), label = stateLabel(id, state);
    const tone = !available(state) ? 'off' : on ? (domain === 'light' ? 'on' : 'blue') : '';
    return html`<div class=${`tl ${tone}`}>
      <button class="tap" title=${name} @click=${() => this.act(id)} @pointerdown=${() => this.press(id)} @pointerup=${this.release} @pointerleave=${this.release} @pointercancel=${this.release} @contextmenu=${(e: Event) => { e.preventDefault(); this.release(); this.detail = id; }}>
        <span class="ti">${mpIcon(entityIcon(id, state), 18)}</span><b>${name}</b><small>${detail && on ? `${label} · ${detail}` : label}</small>
      </button>
      <button class="more" aria-label=${tr('Détails de {name}', { name })} title=${tr('Détails')} @click=${() => { this.detail = id; }}>${mpIcon('dots', 16)}</button>
    </div>`;
  }
  private format(value: number, digits = 1) { return new Intl.NumberFormat(locale(), { maximumFractionDigits: digits }).format(value); }
  private temperature(room: SpatialRoom) { return roomTemperature(room, this.hass?.states ?? {}, this.hass?.config?.unit_system?.temperature ?? '°C'); }
  private humidity(room: SpatialRoom) {
    const id = roomEntityIds(room).find(e => this.state(e)?.attributes.device_class === 'humidity');
    const value = id ? finite(this.state(id)?.state) : undefined;
    return value === undefined ? undefined : `${this.format(value, 0)} %`;
  }
  private lightsIn(ids: string[]) { return ids.filter(id => id.startsWith('light.') && !!this.state(id)); }
  private allOff(ids: string[]) {
    const lights = this.lightsIn(ids).filter(id => this.on(id));
    if (lights.length) this.call('light', 'turn_off', { entity_id: lights });
  }

  // ——— Pieces of the pages ———
  private head(title: string, sub = '', right: TemplateResult | typeof nothing = nothing, back?: string | (() => void)) {
    const backIcon = mpIcon('back', 18);
    return html`<div class="hd">${typeof back === 'function' ? html`<button class="ib" aria-label=${tr('Retour')} title=${tr('Retour')} @click=${back}>${backIcon}</button>`
      : back ? html`<a class="ib" href=${this.route(back)} aria-label=${tr('Retour')} title=${tr('Retour')}>${backIcon}</a>` : nothing}
      <div>${sub ? html`<div class="lbl">${sub}</div>` : nothing}<div class="title serif">${title}</div></div>${right === nothing ? nothing : html`<div class="rgt">${right}</div>`}</div>`;
  }
  private greeting() {
    const hour = new Date().getHours(), hello = hour < 12 ? tr('Bonjour') : hour < 18 ? tr('Bon après-midi') : tr('Bonsoir');
    const first = this.hass?.user?.name?.trim().split(/\s+/)[0];
    return first ? `${hello} ${first}` : hello;
  }
  private navLink(tab: Tab, compact = false) {
    const meta = TABS[tab], current = this.tab === tab;
    return html`<a href=${this.route(tab)} aria-current=${current ? 'page' : nothing} title=${tr(meta.label)}>${mpIcon(meta.icon, compact ? 20 : 18)}<span>${tr(meta.label)}</span></a>`;
  }
  private languageMenu(placement: 'button'|'row') {
    const current = language(), label = tr('Langue : {language}', { language: LANGUAGE_NAMES[current] });
    const toggle = () => { this.languageOpen = !this.languageOpen; };
    const trigger = placement === 'row'
      ? html`<button class="rw" aria-haspopup="menu" aria-expanded=${this.languageOpen} @click=${toggle}><span class="ib">${flag(current)}</span><div><b>${tr('Langue de l’interface')}</b><small>${LANGUAGE_NAMES[current]}</small></div><span class="end">${mpIcon('arrow', 16)}</span></button>`
      : html`<button class="ib" aria-haspopup="menu" aria-expanded=${this.languageOpen} aria-label=${label} title=${label} @click=${toggle}>${flag(current)}</button>`;
    return html`<div class="language">${trigger}${this.languageOpen ? html`<div class="menu" role="menu" aria-label=${tr('Langue de l’interface')}>${LANGUAGES.map(value => html`<button role="menuitemradio" aria-checked=${value === current} lang=${value} @click=${() => { this.languageOpen = false; chooseLanguage(value as Language, this.hass); }}>${flag(value)}<span>${LANGUAGE_NAMES[value]}</span></button>`)}</div>` : nothing}</div>`;
  }
  private clockFace() {
    const now = new Date();
    return html`<div class="clock"><b>${new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit' }).format(now)}</b><small title=${this.online ? tr('Connecté à Home Assistant') : tr('Connexion interrompue, reconnexion…')}><i class=${this.online ? '' : 'off'}></i>${new Intl.DateTimeFormat(locale(), { weekday: 'short', day: 'numeric', month: 'short' }).format(now)}</small></div>`;
  }
  private get mark() { return this.appearance.logoMark?.trim() || projectLogoMark(this.projectName || tr('Maison')); }
  private navigationBar() {
    if (this.layout === 'desk') return html`<header class="dhead glass"><span class="logo" aria-hidden="true">${this.mark}</span><div class="brand"><b>${this.projectName || tr('Maison')}</b><div class="lbl">${tr('{n} pièce|{n} pièces', { n: this.placed.length || this.areas.length })}</div></div>
      <nav aria-label=${tr('Navigation')}>${this.tabs.map(tab => this.navLink(tab))}</nav>${this.appearance.showClock === false ? html`<span style="margin-left:auto"></span>` : this.clockFace()}${this.headerActions()}${this.languageMenu('button')}</header>`;
    if (this.layout === 'rail') return html`<nav class="rail" aria-label=${tr('Navigation')}><span class="logo" aria-hidden="true">${this.mark}</span>${this.tabs.map(tab => this.navLink(tab, true))}</nav>`;
    return html`<nav class="tabbar glass" aria-label=${tr('Navigation')}>${this.tabs.map(tab => this.navLink(tab, true))}</nav>`;
  }

  /** The room opened from the plan: its state, its main devices, and its page. */
  private roomCard(placed: PlacedRoom, where: 'side'|'sheet'|'float') {
    const { room, floor } = placed, ids = roomEntityIds(room).filter(id => this.state(id));
    const quick = ids.filter(id => ['light', 'cover', 'media_player', 'climate', ...TOGGLE_DOMAINS].includes(domainOf(id)));
    const temperature = this.temperature(room), humidity = this.humidity(room), path = this.areaPath(room.areaId);
    const reading = [temperature ? `${this.format(temperature.value)}°` : '', humidity ?? ''].filter(Boolean).join(' · ');
    const close = html`<button class="ib" aria-label=${tr('Fermer')} title=${tr('Fermer')} @click=${() => { this.room = ''; }}>${mpIcon('close', 16)}</button>`;
    return html`${where === 'sheet' ? html`<div class="grab"></div>` : nothing}
      ${this.head(room.name, (this.plan?.floors.length ?? 0) > 1 ? floor.name : tr('Pièce'), html`${reading ? html`<span class="pill">${mpIcon('thermo', 13)}${reading}</span>` : nothing}${close}`)}
      <div class="body">
        ${quick.length ? html`<div class="tgrid">${quick.map(id => this.tile(id, room.name))}</div>` : html`<p class="empty">${tr('Aucun équipement à piloter dans cette pièce.')}</p>`}
        <div class="acts">
          ${this.lightsIn(ids).length ? html`<button class="btn" ?disabled=${!this.lightsIn(ids).some(id => this.on(id))} @click=${() => this.allOff(ids)}>${mpIcon('power', 16)}${tr('Tout éteindre')}</button>` : nothing}
          ${path ? html`<a class="btn primary" href=${this.route(path)}>${tr('Ouvrir la pièce')}</a>` : nothing}
        </div>
      </div>`;
  }
  /** The plan beside the page on a big screen, on the layer of the page. */
  private planPanel() {
    const placed = this.room ? this.find(this.room) : undefined;
    return html`<section class="side panel card glass">
      ${this.head(tr('Plan 3D'), tr('Calque · {layer}', { layer: this.shownLayer === 'media' ? tr('Médias') : tr(PLAN_LAYERS[this.shownLayer].label) }), html`<span class="pill">${placed ? placed.room.name : tr('Toute la maison')}</span>`)}
      <div class="body">${this.houseButtons()}<div class="plan3d">${this.viewer({ key: 'side', expandable: true, focus: this.kind === 'area' ? this.areaRoom?.room.id ?? '' : this.room })}</div>${this.layerButtons()}</div>
    </section>`;
  }

  // ——— Home ———
  private stats() {
    const states = this.hass?.states ?? {}, placed = this.placed;
    // The lights of the dashboard and those of the plan: a light linked to a room only is still a light of the house.
    const lights = this.lightsIn([...new Set([...this.entities, ...placed.flatMap(p => roomEntityIds(p.room))])]), lit = lights.filter(id => this.on(id)).length;
    const warm = placed.map(p => ({ p, t: this.temperature(p.room) })).find(x => x.t);
    const covers = [...new Set(placed.flatMap(p => roomEntityIds(p.room)).filter(id => id.startsWith('cover.') && states[id]))];
    const contacts = [...new Set(placed.flatMap(p => roomEntityIds(p.room)).filter(id => id.startsWith('binary_sensor.') && contactSensor(states[id]) && states[id]!.state === 'on'))];
    const playing = this.media.filter(id => mediaPlaying(states[id])).length;
    const pill = (mode: PlanMode, icon: MPIconName, value: string, text: string, warn = false) => html`<button class=${`pill ${warn ? 'warn' : ''}`} @click=${() => this.chooseLayer(mode)}>${mpIcon(icon, 14)}<b>${value}</b>${text}</button>`;
    return html`<div class="stat">
      ${lights.length ? pill('lights', 'bulb', String(lit), lit ? tr('allumée|allumées', { n: lit }) : tr('allumée|allumées', { n: 0 })) : nothing}
      ${warm?.t ? pill('climate', 'thermo', `${this.format(warm.t.value)}°`, warm.p.room.name.toLocaleLowerCase(locale())) : nothing}
      ${covers.length ? pill('openings', 'shutter', `${covers.filter(id => coverOpen(states[id])).length}/${covers.length}`, tr('ouverts')) : nothing}
      ${contacts.length ? pill('openings', 'window', String(contacts.length), tr('ouverture|ouvertures', { n: contacts.length }), true) : nothing}
      ${playing ? pill('media', 'music', String(playing), tr('en lecture')) : nothing}
      ${this.prefs.quietNight && inQuietHours() ? html`<button class="pill night" @click=${() => this.openOverlay('alerts')}>${mpIcon('moon', 14)}${tr('Nuit silencieuse')}</button>` : nothing}
    </div>`;
  }
  private scenes() {
    const scenes = Object.values(this.hass?.states ?? {}).filter(s => s.entity_id.startsWith('scene.') && s.state !== 'unavailable');
    const sources = new Set(scenes.map(s => s.attributes.mp_nexus_source).filter(Boolean));
    return html`<div class="sec"><b>${tr('Scènes')}</b><button @click=${() => { this.scenesOpen = true; }}>${tr('Gérer les scènes')}</button></div>
      <div class="houses">${scenes.filter(s => !sources.has(s.entity_id)).map(s => html`<button class="btn" @click=${() => this.call('scene', 'turn_on', { entity_id: s.entity_id })}>${mpIcon(sceneIcon(s), 16)}${String(s.attributes.friendly_name ?? s.entity_id)}</button>`)}</div>
      ${!scenes.length ? html`<p class="muted">${tr('Une scène règle plusieurs appareils d’un seul toucher : cinéma, réveil, départ ou soirée.')}</p>` : nothing}`;
  }
  private homeMain() {
    return html`<section class="main panel card glass">
      ${this.head(this.projectName || tr('Ma maison'), this.greeting(), html`${this.whoStack()}${this.layout === 'desk' ? nothing : this.headerActions()}`)}
      <div class="body">
        ${this.appearance.showStats === false ? nothing : this.stats()}${this.houseButtons()}
        ${this.comfortSuggestion()}
        ${this.plan ? html`<div class="plan3d">${this.viewer({ key: 'home', expandable: true })}</div>${this.layerButtons()}` : this.noPlan()}
        ${this.appearance.showScenes === false ? nothing : this.scenes()}
      </div>
    </section>`;
  }
  private comfortSuggestion() {
    const suggestion = comfortSuggestions(this.placedAll.map(p => p.room), this.hass?.states ?? {}).find(s => !this.ignoredSuggestions.includes(s.key));
    if (!suggestion) return nothing;
    const explanation = suggestion.action === 'heating' ? tr('{window} est ouverte depuis au moins 20 minutes ; {climate} chauffe dans la même pièce.', { window: this.name(suggestion.window), climate: this.name(suggestion.climate) }) : tr('{window} est ouverte depuis au moins 20 minutes ; {climate} refroidit dans la même pièce.', { window: this.name(suggestion.window), climate: this.name(suggestion.climate) });
    return html`<div class="live glass"><span class="ib">${mpIcon('sparkle', 16)}</span><div><b>${tr('Suggestion Nexus')} · ${suggestion.room}</b><small>${explanation}</small><div class="houses"><button class="pill" @click=${() => { this.sub = { type: 'climate', id: suggestion.climate }; }}>${tr('Vérifier le climat')}</button><button class="pill" @click=${() => { this.ignoredSuggestions = [...this.ignoredSuggestions, suggestion.key].slice(-100); try { localStorage.setItem('mp-nexus.suggestions.dismissed', JSON.stringify(this.ignoredSuggestions)); } catch { /* Dismissed until this page closes. */ } this.requestUpdate(); }}>${tr('Masquer cette suggestion')}</button></div></div></div>`;
  }
  private noPlan() {
    return html`<p class="empty">${tr('Ajoutez votre plan dans Studio → Plan 3D.')}${this.hass?.user?.is_admin ? html` <a style="color:var(--accent)" href="/mp-glass-settings">${tr('Ouvrir le Studio')}</a>` : nothing}</p>`;
  }
  /** What is going on at home right now: what plays, what heats or cools, what stands open, the weather. */
  private now() {
    const states = this.hass?.states ?? {};
    const playing = this.media.filter(id => mediaPlaying(states[id]));
    const running = Object.values(states).filter(s => s.entity_id.startsWith('climate.') && ['heating', 'cooling', 'drying', 'fan'].includes(String(s.attributes.hvac_action ?? '')));
    const open = [...new Set(this.placed.flatMap(p => roomEntityIds(p.room)))].filter(id => id.startsWith('binary_sensor.') && contactSensor(states[id]) && states[id]!.state === 'on');
    const weather = Object.values(states).find(s => s.entity_id.startsWith('weather.') && available(s));
    const quiet = !playing.length && !running.length && !open.length;
    return html`<section class="side panel card glass">
      ${this.head(tr('En ce moment'), new Intl.DateTimeFormat(locale(), { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()))}
      <div class="body">
        ${this.whoRow()}
        ${playing.map(id => this.nowPlayingRow(id))}
        ${running.map(s => html`<button class="live glass" @click=${() => { this.sub = { type: 'climate', id: s.entity_id }; }}><span class="ib">${mpIcon(entityIcon(s.entity_id, s), 18)}</span><div><b>${this.name(s.entity_id)}</b><small>${stateLabel(s.entity_id, s)} · ${stateDetail(s.entity_id, s)}</small></div></button>`)}
        ${open.length ? html`<div class="rlab">${tr('À surveiller')}</div><div class="sg">${open.map(id => html`<button class="rw" @click=${() => { this.detail = id; }}><span class="ib" style="color:#ffb4b4">${mpIcon('window', 16)}</span><div><b>${this.name(id)}</b><small>${stateLabel(id, states[id])}</small></div><span class="end">${mpIcon('arrow', 16)}</span></button>`)}</div>` : nothing}
        ${weather ? html`<div class="rlab">${tr('Météo')}</div><button class="live glass" @click=${() => { this.detail = weather.entity_id; }}><span class="ib">${mpIcon(weatherIcon(weather.state), 18)}</span><div><b>${finite(weather.attributes.temperature) === undefined ? weather.state : `${this.format(finite(weather.attributes.temperature)!)} ${String(weather.attributes.temperature_unit ?? '°')}`}</b><small>${String(weather.attributes.friendly_name ?? '')} · ${weatherName(weather.state)}</small></div></button>` : nothing}
        ${quiet ? html`<p class="empty">${tr('Tout est calme à la maison.')}</p>` : nothing}
      </div>
    </section>`;
  }
  private mediaImage(value: unknown, eager = false) {
    const url = displayMediaImage(value);
    if (!url) return nothing;
    // Home Assistant proxies and MP Nexus' own artwork route both want the session token, which an <img> cannot send.
    const protectedPath = (url.startsWith('/api/media_player_proxy/') && !new URL(url, location.origin).searchParams.has('token') || url.startsWith('/api/mp_glass/music/artwork/')) && !!this.hass?.fetchWithAuth;
    const cached = protectedPath ? this.protectedImages.get(url) : undefined;
    return html`<img class="media-image" src=${protectedPath ? cached ?? nothing : url} data-auth-src=${protectedPath && !cached ? url : nothing} alt="" loading=${eager ? 'eager' : 'lazy'} decoding="async" @error=${(e: Event) => { (e.currentTarget as HTMLImageElement).hidden = true; }} @load=${(e: Event) => { (e.currentTarget as HTMLImageElement).hidden = false; }}>`;
  }
  private observeProtectedImages() {
    const images = this.renderRoot.querySelectorAll<HTMLImageElement>('img[data-auth-src]');
    if (!images.length || !this.hass?.fetchWithAuth) return;
    if (!this.imageObserver && typeof IntersectionObserver !== 'undefined') this.imageObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const image = entry.target as HTMLImageElement, path = image.dataset.authSrc;
        this.imageObserver?.unobserve(image);
        if (path) void this.loadProtectedImage(path).then(url => { if (url && image.isConnected && image.dataset.authSrc === path) image.src = url; });
      }
    }, { rootMargin: '180px' });
    for (const image of images) {
      const path = image.dataset.authSrc;
      if (!path || image.dataset.authObserved === path) continue;
      image.dataset.authObserved = path;
      if (this.imageObserver) this.imageObserver.observe(image);
      else void this.loadProtectedImage(path).then(url => { if (url && image.isConnected && image.dataset.authSrc === path) image.src = url; });
    }
  }
  private loadProtectedImage(path: string): Promise<string | undefined> {
    const cached = this.protectedImages.get(path);
    if (cached) return Promise.resolve(cached);
    const pending = this.protectedImageRequests.get(path);
    if (pending) return pending;
    const hass = this.hass, connection = hass?.connection;
    const request = hass?.fetchWithAuth?.(path).then(async response => {
      if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) return undefined;
      const blob = await response.blob();
      if (blob.size > 10_000_000 || !this.isConnected || this.hass?.connection !== connection) return undefined;
      const url = URL.createObjectURL(blob);
      this.protectedImages.set(path, url);
      if (this.protectedImages.size > 240) {
        const oldest = this.protectedImages.keys().next().value;
        if (oldest) { URL.revokeObjectURL(this.protectedImages.get(oldest)!); this.protectedImages.delete(oldest); }
      }
      return url;
    }).catch(() => undefined).finally(() => { this.protectedImageRequests.delete(path); });
    if (!request) return Promise.resolve(undefined);
    this.protectedImageRequests.set(path, request);
    return request;
  }
  /** Shows a player on the Multimédia page, on its Lecture face. */
  private openPlayer(id: string) {
    this.player = mediaPlayer = id;
    this.mediaTab = mediaTab = 'play';
    this.go('media');
  }
  /** What the television plays has no cover: a soundbar on the TV input, or a TV without artwork, shows a screen instead. */
  private tvArtwork(state?: HAState) {
    return (mediaTvInput(state) || mediaIsTv(state) && mediaOn(state)) && !displayMediaImage(state?.attributes.entity_picture);
  }
  private tvScreen(size: number) {
    return html`<svg class="tv-glyph" width=${size} height=${size} viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="mp-tv-screen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7fd0ff"/><stop offset=".55" stop-color="#4f7dff"/><stop offset="1" stop-color="#a05cff"/></linearGradient></defs>
      <rect x="5" y="9" width="38" height="25" rx="4" fill="#0b1328" stroke="rgba(255,255,255,.85)" stroke-width="2"/><rect x="8.5" y="12.5" width="31" height="18" rx="2" fill="url(#mp-tv-screen)" opacity=".92"/>
      <path d="M8.5 22c6-6 14-8.5 31-8" stroke="rgba(255,255,255,.35)" stroke-width="1.6" fill="none"/><path d="M21 17.5v8l6.5-4z" fill="#fff"/>
      <path d="M17 40h14M24 34v6" stroke="rgba(255,255,255,.85)" stroke-width="2" stroke-linecap="round"/></svg>`;
  }
  private nowPlayingRow(id: string) {
    const state = this.state(id), tv = this.tvArtwork(state);
    return html`<div class="live glass player-card" role="link" tabindex="0" aria-label=${`${tr('Multimédia')} · ${this.playerLabel(id)}`} @click=${(e: Event) => { if (!(e.target as HTMLElement).closest('button')) this.openPlayer(id); }} @keydown=${(e: KeyboardEvent) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); this.openPlayer(id); } }}><span class=${`art ${tv ? 'tv' : ''}`}>${tv ? this.tvScreen(30) : this.mediaImage(state?.attributes.entity_picture)}</span><div><b>${nowPlaying(state) ?? this.name(id)}</b><small>${this.name(id)}</small></div>
      <span class="rgt" style="margin-left:auto;display:flex;gap:4px">${canMedia(state, 'pause') ? html`<button class="ib" aria-label=${tr('Pause')} @click=${() => this.call('media_player', 'media_play_pause', { entity_id: id })}>${mpIcon('pause', 16)}</button>` : nothing}${canMedia(state, 'next_track') ? html`<button class="ib" aria-label=${tr('Suivant')} @click=${() => this.call('media_player', 'media_next_track', { entity_id: id })}>${mpIcon('next', 16)}</button>` : nothing}</span></div>`;
  }

  // ——— Lights ———
  private lightsMain() {
    const lights = this.lightsIn([...new Set([...this.entities, ...this.placedAll.flatMap(p => roomEntityIds(p.room))])]), lit = lights.filter(id => this.on(id));
    const placedIds = new Set<string>();
    const groups = this.placedAll.map(p => {
      const ids = lights.filter(id => roomEntityIds(p.room).includes(id) && !placedIds.has(id));
      ids.forEach(id => placedIds.add(id));
      return { ...p, ids };
    }).filter(g => g.ids.length);
    const rest = lights.filter(id => !placedIds.has(id)), several = (this.spatial?.floors.length ?? 0) > 1;
    const group = (key: string, title: string, sub: string, ids: string[], room = '') => {
      const on = ids.some(id => this.on(id));
      return html`<div class="rh" data-room=${key}><b>${title}</b><small>${sub}</small><button class="end" role="switch" aria-checked=${on} aria-label=${title} @click=${() => this.call('light', on ? 'turn_off' : 'turn_on', { entity_id: ids })}><span class=${`tgl ${on ? '' : 'off'}`}></span></button></div>
        <div class="tgrid">${ids.map(id => this.tile(id, room))}</div>`;
    };
    return html`<section class="main panel card glass">
      ${this.head(tr('Lumières'), tr('{n} allumée sur {total}|{n} allumées sur {total}', { n: lit.length, total: lights.length }), html`<button class="pill" ?disabled=${!lit.length} @click=${() => this.allOff(lights)}>${mpIcon('power', 14)}${tr('Tout éteindre')}</button>`)}
      <div class="body">
        ${lights.length ? nothing : html`<p class="empty">${tr('Aucune lumière détectée pour le moment.')}</p>`}
        ${groups.map(g => group(g.room.id, g.room.name, several ? g.floor.name : tr('Pièce'), g.ids, g.room.name))}
        ${rest.length ? group('outside-plan', tr('Hors du plan'), '', rest) : nothing}
      </div>
    </section>`;
  }
  /** Every room of the plan, all houses together: a light belongs to its room whatever house the plan shows. */
  private get placedAll(): PlacedRoom[] {
    const spatial = this.spatial;
    if (!spatial) return [];
    const plan = withoutHidden(this.spatialOrigin === 'project' ? spatial : trPlan(spatial, this.spatialOrigin === 'example'), this.setAside);
    return plan.floors.flatMap(floor => floor.rooms.map(room => ({ room, floor })));
  }

  // ——— Rooms ———
  private roomBadges(room: SpatialRoom) {
    const ids = roomEntityIds(room), states = this.hass?.states ?? {};
    const lit = this.lightsIn(ids).filter(id => this.on(id)).length, temperature = this.temperature(room);
    const open = ids.filter(id => id.startsWith('binary_sensor.') && contactSensor(states[id]) && states[id]!.state === 'on').length;
    const playing = ids.filter(id => id.startsWith('media_player.') && mediaOn(states[id]));
    return { lit, html: html`${lit ? html`<span class="w">${tr('{n} lumière|{n} lumières', { n: lit })}</span>` : nothing}${temperature ? html`<span>${this.format(temperature.value)}°</span>` : nothing}${open ? html`<span class="a">${tr('{n} ouverture|{n} ouvertures', { n: open })}</span>` : nothing}${playing.length ? html`<span>${playing.some(id => mediaIsTv(states[id])) ? tr('TV') : tr('Musique')}</span>` : nothing}` };
  }
  private roomsMain() {
    const plan = this.plan, floors = plan?.floors ?? [];
    const placed = this.placed.filter(p => !this.floorFilter || p.floor.id === this.floorFilter);
    const onPlan = new Set(this.placedAll.map(p => p.room.areaId).filter(Boolean));
    const others = this.areas.filter(a => !onPlan.has(a.id));
    const open = (p: PlacedRoom) => { const path = this.areaPath(p.room.areaId); if (path) this.go(path); else this.room = p.room.id; };
    return html`<section class="main panel card glass">
      ${this.head(tr('Pièces'), [tr('{n} pièce|{n} pièces', { n: this.placed.length + others.length }), floors.length > 1 ? tr('{n} niveau|{n} niveaux', { n: floors.length }) : ''].filter(Boolean).join(' · '))}
      <div class="body">
        ${this.layout === 'phone' && plan ? this.banner(210, this.viewer({ key: 'rooms', quiet: true })) : nothing}
        ${this.houseButtons()}
        ${floors.length > 1 ? html`<div class="houses" role="group" aria-label=${tr('Niveau affiché')}><button class="pill" aria-pressed=${!this.floorFilter} @click=${() => { this.floorFilter = ''; }}>${tr('Tous')}</button>${floors.map(f => html`<button class="pill" aria-pressed=${this.floorFilter === f.id} @click=${() => { this.floorFilter = f.id; }}>${f.name}</button>`)}</div>` : nothing}
        ${placed.length || others.length ? nothing : html`<p class="empty">${tr('Aucune pièce détectée. Créez des zones dans Home Assistant, puis ouvrez le Studio pour analyser votre installation.')}</p>`}
        <div class="rgrid">
          ${placed.map(p => { const badges = this.roomBadges(p.room); return html`<button class=${`rm ${badges.lit ? 'lit' : ''}`} @click=${() => open(p)}><span style="display:flex;align-items:center;gap:8px;min-width:0">${mpIcon(roomIcon(p.room.name), 18)}<b>${p.room.name}</b></span><div class="bd">${badges.html}</div></button>`; })}
          ${this.floorFilter ? nothing : others.map(a => html`<a class="rm" href=${this.route(`area-${a.id}`)}><b>${a.name}</b><div class="bd"><span>${tr('{n} équipement|{n} équipements', { n: a.deviceCount })}</span></div></a>`)}
          ${this.inventory && !this.floorFilter ? html`<a class="rm" href=${this.route('inventory')}><span style="display:flex;align-items:center;gap:8px">${mpIcon('scan', 18)}<b>${this.inventory.title}</b></span><div class="bd"><span>${tr('{n} équipement|{n} équipements', { n: this.inventory.count })}</span></div></a>` : nothing}
        </div>
      </div>
    </section>`;
  }

  // ——— One room ———
  private get area() { return this.areas.find(a => `area-${a.id}` === this.path); }
  private get areaRoom() { const id = this.area?.id; return id ? this.placed.find(p => p.room.areaId === id) ?? this.placedAll.find(p => p.room.areaId === id) : undefined; }
  private areaMain() {
    const area = this.area, placed = this.areaRoom, room = placed?.room;
    const ids = [...new Set([...this.entities, ...(room ? roomEntityIds(room) : [])])].filter(id => this.state(id));
    const of = (test: (id: string) => boolean) => ids.filter(test);
    const lights = of(id => domainOf(id) === 'light'), covers = of(id => domainOf(id) === 'cover');
    const openings = of(id => kindOf(id, this.state(id)) === 'opening'), climate = of(id => domainOf(id) === 'climate'), media = of(id => domainOf(id) === 'media_player');
    const shown = new Set([...lights, ...covers, ...openings, ...climate, ...media]);
    const readings = of(id => ['temperature', 'humidity', 'motion'].includes(kindOf(id, this.state(id))));
    const others = ids.filter(id => !shown.has(id) && !readings.includes(id));
    const name = room?.name ?? area?.name ?? this.viewTitle, lit = lights.filter(id => this.on(id)).length;
    const pills = html`<div class="stat">${readings.map(id => html`<button class="pill" @click=${() => { this.detail = id; }}>${mpIcon(entityIcon(id, this.state(id)), 13)}${stateLabel(id, this.state(id))}</button>`)}</div>`;
    const section = (icon: MPIconName, title: string, sub: string, list: string[], extra: TemplateResult | typeof nothing = nothing, more?: SubPanel) => list.length ? html`<div class="secg">${mpIcon(icon, 17)}<b>${title}</b><small>${sub}</small>${more ? html`<button class="more" @click=${() => { this.sub = more; }}>${tr('Voir tout')}</button>` : nothing}</div>${extra}<div class="tgrid">${list.map(id => this.tile(id, name))}</div>` : nothing;
    const positions = covers.filter(id => coverPosition(this.state(id)) !== undefined).map(id => coverPosition(this.state(id))!);
    const coverActions = covers.length ? html`<div class="acts"><button class="btn" @click=${() => this.call('cover', 'open_cover', { entity_id: covers })}>${tr('Ouvrir')}</button><button class="btn" @click=${() => this.call('cover', 'set_cover_position', { entity_id: covers, position: 50 })}>${tr('Mi-ombre')}</button><button class="btn" @click=${() => this.call('cover', 'close_cover', { entity_id: covers })}>${tr('Fermer')}</button></div>` : nothing;
    const busy = lit > 0 || media.some(id => mediaPlaying(this.state(id)));
    return html`<section class="main panel card glass">
      ${this.head(name, placed && (this.plan?.floors.length ?? 0) > 1 ? placed.floor.name : tr('Pièce'), nothing, 'rooms')}
      <div class="body">
        ${this.layout === 'phone' && room && this.plan ? this.banner(200, this.viewer({ key: 'area', focus: room.id, quiet: true })) : nothing}
        ${readings.length ? pills : nothing}
        ${section('bulb', tr('Lumières'), tr('{n} sur {total}', { n: lit, total: lights.length }), lights)}
        ${section('shutter', tr('Ouvrants'), positions.length ? tr('{n} % ouvert', { n: this.format(positions.reduce((a, b) => a + b, 0) / positions.length, 0) }) : '', [...covers, ...openings], coverActions, covers.length && room ? { type: 'covers', id: room.id } : undefined)}
        ${section('thermo', tr('Climat'), '', climate)}
        ${section('music', tr('Multimédia'), '', media)}
        ${section('dots', tr('Autres équipements'), '', others)}
        ${ids.length ? nothing : html`<p class="empty">${tr('Aucun équipement dans cette pièce pour le moment.')}</p>`}
        ${busy ? html`<button class="btn gold" @click=${() => { this.allOff(ids); const on = media.filter(id => mediaPlaying(this.state(id)) && canMedia(this.state(id), 'pause')); if (on.length) this.call('media_player', 'media_pause', { entity_id: on }); }}>${mpIcon('power', 16)}${tr('Quitter la pièce')}</button>` : nothing}
      </div>
    </section>`;
  }

  // ——— Multimédia ———
  private get players() {
    const musicAssistant = Object.keys(this.hass?.states ?? {}).filter(id => id.startsWith('media_player.') && this.isMusicAssistantPlayer(id));
    return [...new Set([...this.media, ...this.visible(musicAssistant)])].filter(id => this.state(id));
  }
  private get currentPlayer() {
    const players = this.players, states = this.hass?.states ?? {};
    return players.find(id => id === this.player) ?? players.find(id => mediaPlaying(states[id])) ?? players.find(id => mediaOn(states[id])) ?? players[0];
  }
  /** The rooms a player sounds in: its own name, and those of the players grouped with it. */
  private groupLabel(id: string) { return groupOf(this.hass?.states ?? {}, id).map(p => this.roomOf(p) ?? this.name(p)).join(' + '); }
  /** A player named by its room, and by its own name too when the room holds several. */
  private playerLabel(id: string) {
    const room = this.roomOf(id);
    if (!room) return this.name(id);
    return this.players.filter(p => this.roomOf(p) === room).length > 1 ? `${room} · ${this.name(id, room)}` : room;
  }
  /** The room of the plan a device sits in, by its name. */
  private roomOf(id: string) { return this.placedAll.find(p => roomEntityIds(p.room).includes(id))?.room.name; }
  private mediaTabs(id: string): MediaTab[] {
    const state = this.state(id), tv = mediaIsTv(state) || Object.keys(remoteRoutes(this.hass, id)).length > 0;
    return ['play', 'foryou', ...(this.players.length > 1 ? ['rooms' as const] : []), ...(tv ? ['remote' as const] : [])];
  }
  private mediaMain() {
    const id = this.currentPlayer, state = id ? this.state(id) : undefined;
    if (!id) return html`<section class="main panel card glass">${this.head(tr('Multimédia'))}<div class="body">${this.hass?.user?.is_admin && this.engine !== undefined && this.engine !== 'error' && (this.engine === 'loading' || this.engine.phase !== 'unsupported') ? nothing : html`<p class="empty">${tr('Aucun lecteur multimédia détecté pour le moment.')}</p>`}${this.musicSetup()}</div></section>`;
    const tabs = this.mediaTabs(id), tab = tabs.includes(this.mediaTab) ? this.mediaTab : 'play';
    const media = (service: string, data: Record<string, unknown> = {}) => void this.mediaCall(service, { entity_id: id, ...data });
    const power = mediaOn(state) && canMedia(state, 'turn_off') ? html`<button class="ib" aria-label=${tr('Éteindre')} title=${tr('Éteindre')} @click=${() => media('turn_off')}>${mpIcon('power', 16)}</button>`
      : !mediaOn(state) && canMedia(state, 'turn_on') ? html`<button class="ib" aria-label=${tr('Allumer')} title=${tr('Allumer')} @click=${() => media('turn_on')}>${mpIcon('power', 16)}</button>` : nothing;
    return html`<section class="main panel card glass">
      ${this.head(this.groupLabel(id), tr('Multimédia'), html`${power}<button class="ib" aria-label=${tr('Détails')} title=${tr('Détails')} @click=${() => { this.detail = id; }}>${mpIcon('dots', 16)}</button>`)}
      <div class="body">
        ${tabs.length > 1 ? html`<div class="layers mtabs" role="tablist" aria-label=${tr('Multimédia')}>${tabs.map(t => html`<button role="tab" aria-selected=${t === tab} aria-pressed=${t === tab} @click=${() => { this.remotePointer = undefined; if (this.mediaTab === 'foryou' && t !== 'foryou') { this.browseRequest++; this.mediaSearchRequest++; this.browsing = undefined; this.mediaResults = undefined; } this.mediaTab = t; mediaTab = t; }}>${mpIcon(MEDIA_TABS[t].icon, 15)}<span>${tr(MEDIA_TABS[t].label)}</span></button>`)}</div>` : nothing}
        ${tab === 'play' ? this.playing(id) : tab === 'foryou' ? this.forYou(id) : tab === 'rooms' ? this.speakers(id) : this.remote(id)}
        ${this.mediaNotice ? html`<p class="note" role="alert">${this.mediaNotice}</p>` : nothing}
      </div>
    </section>`;
  }
  /** The immersive player: the cover, the track, where it stands, and its commands. */
  private playing(id: string) {
    const state = this.state(id), duration = finite(state?.attributes.media_duration), at = elapsed(state);
    const progress = at !== undefined && duration ? Math.min(100, at / duration * 100) : undefined;
    const volume = mediaVolume(state), muted = state?.attributes.is_volume_muted === true;
    const artist = String(state?.attributes.media_artist ?? state?.attributes.media_series_title ?? state?.attributes.media_album_name ?? '');
    const sourceName = String(state?.attributes.app_name ?? state?.attributes.source ?? '');
    const title = String(state?.attributes.media_title ?? '') || nowPlaying(state) || stateLabel(id, state);
    const media = (service: string, data: Record<string, unknown> = {}) => void this.mediaCall(service, { entity_id: id, ...data });
    const favoriteButton = musicAssistantFavoriteButton(this.hass, id), contentId = String(state?.attributes.media_content_id ?? title);
    const safeContentId = safeFavoriteContentId(contentId);
    const favorite: NexusFavorite = { key: `${id}|${contentId}|${title}`, title, artist, media_content_id: safeContentId ?? '', media_content_type: String(state?.attributes.media_content_type ?? 'music'), ...(safeFavoriteImage(state?.attributes.entity_picture, location.origin) ? { image: safeFavoriteImage(state?.attributes.entity_picture, location.origin) } : {}), source: String(state?.attributes.source ?? state?.attributes.app_name ?? ''), player: id };
    const saved = this.mediaFavorites.some(item => item.key === favorite.key);
    const shuffle = state?.attributes.shuffle === true, repeat = String(state?.attributes.repeat ?? 'off');
    const soundModes = Array.isArray(state?.attributes.sound_mode_list) ? (state!.attributes.sound_mode_list as unknown[]).map(String) : [];
    const seek = (e: Event) => {
      if (!duration || !canMedia(state, 'seek')) return;
      const box = (e.currentTarget as HTMLElement).getBoundingClientRect(), x = (e as PointerEvent).clientX;
      if (box.width) media('media_seek', { seek_position: Math.round(Math.min(1, Math.max(0, (x - box.left) / box.width)) * duration) });
    };
    const others = this.players.filter(p => p !== id);
    return html`<div class="player">
      <div class=${`cover ${mediaPlaying(state) ? 'spin' : ''} ${this.tvArtwork(state) ? 'tv' : ''}`}>${this.tvArtwork(state) ? this.tvScreen(120) : this.mediaImage(state?.attributes.entity_picture, true)}</div>
      <div class="track"><div class="serif">${title}</div><div class="muted">${artist || stateLabel(id, state)}</div></div>
      ${sourceName ? html`<div class="playing-source">${this.mediaSourceBadge(sourceName)}<span>${sourceName}</span></div>` : nothing}
      ${this.isMusicAssistantPlayer(id) && favoriteButton ? html`<button class="btn favorite-current" ?disabled=${this.mediaReadOnlyGuest} aria-label=${tr('Ajouter le titre aux favoris Music Assistant')} title=${tr('Ajouter le titre aux favoris Music Assistant')} @click=${async () => { if (this.mediaReadOnlyGuest) return; try { await this.hass?.callService('button', 'press', { entity_id: favoriteButton }); this.mediaNotice = tr('Titre ajouté aux favoris Music Assistant.'); } catch { this.mediaNotice = tr('Impossible d’ajouter ce titre aux favoris Music Assistant.'); } }}>${mpIcon('sparkle', 15)}${tr('Favoris Music Assistant')}</button>` : nothing}
      ${title && safeContentId ? html`<button class="btn favorite-current" aria-pressed=${saved} @click=${() => this.favoriteItem(favorite)}>${mpIcon(saved ? 'check' : 'plus', 15)}${saved ? tr('Enregistré sur cet écran') : tr('Garder sur cet écran')}</button>` : nothing}
      ${progress === undefined ? nothing : html`<div class="seek"><div class=${`bar ${canMedia(state, 'seek') ? 'can' : ''}`} role=${canMedia(state, 'seek') ? 'slider' : 'progressbar'} tabindex=${canMedia(state, 'seek') ? 0 : -1} aria-label=${tr('Position')} aria-valuenow=${Math.round(progress)} aria-valuemin="0" aria-valuemax="100" aria-valuetext=${`${clockTime(at!)} / ${clockTime(duration!)}`} @click=${seek} @keydown=${(e: KeyboardEvent) => { if (!canMedia(state, 'seek') || duration === undefined) return; const delta = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 5 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -5 : 0; if (delta || e.key === 'Home' || e.key === 'End') { e.preventDefault(); media('media_seek', { seek_position: e.key === 'Home' ? 0 : e.key === 'End' ? duration : Math.max(0, Math.min(duration, (at ?? 0) + delta)) }); } }}><i style=${`width:${progress}%`}></i></div>
        <div class="times"><span>${clockTime(at!)}</span><span>${clockTime(duration!)}</span></div></div>`}
      <div class="ctl">
        ${canMedia(state, 'shuffle_set') ? html`<button class="sm" aria-label=${tr('Aléatoire')} title=${tr('Aléatoire')} aria-pressed=${shuffle} @click=${() => media('shuffle_set', { shuffle: !shuffle })}>${mpIcon('shuffle', 19)}</button>` : html`<span class="sm"></span>`}
        <button aria-label=${tr('Précédent')} ?disabled=${!canMedia(state, 'previous_track')} @click=${() => media('media_previous_track')}>${mpIcon('previous', 22)}</button>
        <button class="play" aria-label=${mediaPlaying(state) ? tr('Pause') : tr('Lecture')} ?disabled=${!canMedia(state, 'pause') && !canMedia(state, 'play')} @click=${() => media('media_play_pause')}>${mpIcon(mediaPlaying(state) ? 'pause' : 'play', 26)}</button>
        <button aria-label=${tr('Suivant')} ?disabled=${!canMedia(state, 'next_track')} @click=${() => media('media_next_track')}>${mpIcon('next', 22)}</button>
        ${canMedia(state, 'repeat_set') ? html`<button class="sm" aria-label=${tr('Répéter')} title=${repeat === 'one' ? tr('Répéter ce titre') : tr('Répéter')} aria-pressed=${repeat !== 'off'} @click=${() => media('repeat_set', { repeat: nextRepeat(repeat) })}>${mpIcon('repeat', 19)}${repeat === 'one' ? html`<small class="one">1</small>` : nothing}</button>` : html`<span class="sm"></span>`}
      </div>
      ${volume !== undefined && canMedia(state, 'volume_set') ? html`<div class="vol">
        <button class="ib" aria-label=${muted ? tr('Rétablir le son') : tr('Couper le son')} title=${muted ? tr('Rétablir le son') : tr('Couper le son')} ?disabled=${!canMedia(state, 'volume_mute')} @click=${() => media('volume_mute', { is_volume_muted: !muted })}>${mpIcon(muted ? 'mute' : 'volume', 17)}</button>
        <input type="range" min="0" max="100" .value=${String(Math.round(volume))} aria-label=${tr('Volume')} @change=${(e: Event) => media('volume_set', { volume_level: Number((e.target as HTMLInputElement).value) / 100 })}>
        <span class="muted" style="font-size:12px;min-width:38px;text-align:right">${Math.round(volume)} %</span></div>` : nothing}
      ${soundModes.length && canMedia(state, 'select_sound_mode') ? html`<label class="vol">${mpIcon('sliders', 18)}<select aria-label=${tr('Mode sonore')} @change=${(e: Event) => media('select_sound_mode', { sound_mode: (e.target as HTMLSelectElement).value })}>${soundModes.map(m => html`<option .selected=${m === state?.attributes.sound_mode} value=${m}>${m}</option>`)}</select><span></span></label>` : nothing}
      ${this.queue?.player === id && this.queue.next ? html`<div class="rlab">${tr('À suivre')}</div><div class="live glass"><span class="art">${this.mediaImage(this.queue.next.image)}</span><div><b>${this.queue.next.title}</b><small>${this.queue.next.artist}</small></div></div>` : nothing}
      ${this.musicQueueData?.player === id && this.musicQueueData.items.length ? this.musicQueuePanel() : nothing}
      ${others.length ? html`<div class="rlab">${tr('Lecteurs')}</div><div class="houses">${[id, ...others].map(p => html`<button class="pill" aria-pressed=${p === id} @click=${() => { this.player = mediaPlayer = p; this.requestUpdate(); }}>${mpIcon(entityIcon(p, this.state(p)), 13)}${this.playerLabel(p)}${mediaPlaying(this.state(p)) ? html`<i class="eq"></i>` : nothing}</button>`)}</div>` : nothing}
    </div>`;
  }
  // ——— Music: the household engine, then the services connected to it ———
  private loadEngine(force = false) {
    const hass = this.hass;
    if (!hass?.user?.is_admin || (!force && this.engineConnection === hass.connection)) return;
    this.engineConnection = hass.connection;
    if (!this.engine) this.engine = 'loading';
    engineStatus(hass).then(status => {
      if (!status?.phase) throw new Error('no engine');
      const was = this.engine;
      this.engine = status;
      clearTimeout(this.engineTimer);
      if (status.phase === 'preparing') this.engineTimer = window.setTimeout(() => this.loadEngine(true), 3000);
      if (status.phase === 'ready' && (typeof was !== 'object' || was.phase !== 'ready')) { this.musicBridgeConnection = undefined; void this.loadMusicBridge(); }
      if (status.phase === 'ready' && status.ingress_entry && (!this.musicSources || this.musicSources === 'error')) void this.loadMusicSources();
    }).catch(() => { this.engine = 'error'; });
  }
  private musicSession() {
    const hass = this.hass, entry = typeof this.engine === 'object' ? this.engine.ingress_entry : null;
    if (!hass || !entry) return undefined;
    if (this.engineSession?.entry !== entry) { this.engineSession?.session.close(); this.engineSession = { entry, session: new MusicEngineSession(hass, entry, language()) }; }
    return this.engineSession.session;
  }
  private async loadMusicSources() {
    const session = this.musicSession();
    if (!session) return;
    if (!this.musicSources || this.musicSources === 'error') this.musicSources = 'loading';
    for (let attempt = 0; attempt < 3; attempt++) {
      try { const [providers, manifests] = await Promise.all([session.providers(), session.manifests()]); this.musicSources = { providers, manifests }; return; }
      // The first connection can race the ingress session cookie: start over on a fresh socket.
      catch { session.close(); await new Promise(resolve => setTimeout(resolve, 1500 * (attempt + 1))); }
    }
    this.musicSources = 'error';
  }
  private async startMusicEngine() {
    const hass = this.hass;
    if (!hass) return;
    try { this.engine = await engineSetup(hass); } catch { this.engine = 'error'; return; }
    this.loadEngine(true);
  }
  private async connectService(service: MusicService, reconnect?: string) {
    const session = this.musicSession();
    if (!session) return;
    this.musicServicesOpen = false;
    this.musicFlow = { service, values: {}, busy: true, ...(reconnect ? { reconnect } : {}) };
    try { this.showFlowStep(await (reconnect ? session.reconfigure(reconnect) : session.setup(service.domain))); }
    catch { if (this.musicFlow?.service === service) this.musicFlow = { ...this.musicFlow, busy: false, error: tr('{name} ne répond pas pour le moment. Réessayez dans quelques instants.', { name: service.name }) }; }
  }
  private showFlowStep(step: FlowStep) {
    const flow = this.musicFlow;
    if (!flow) return;
    const same = flow.step?.flow_id === step.flow_id && flow.step.step_id === step.step_id && flow.step.type === step.type;
    this.musicFlow = { ...flow, step, values: step.type === 'form' && !same ? formDefaults(step.entries) : flow.values, busy: false, error: undefined };
    clearTimeout(this.flowTimer);
    // An outside page or a long wait ends on the server: MP Nexus looks again until the next step shows.
    if (step.type === 'external' || step.type === 'progress') this.flowTimer = window.setTimeout(() => void this.pollFlow(step.flow_id), 2000);
    if (step.type === 'finish') { void this.loadMusicSources(); this.musicItems = undefined; void this.loadMusicBridge(); }
  }
  private async pollFlow(flowId: string) {
    const session = this.musicSession(), flow = this.musicFlow;
    if (!session || flow?.step?.flow_id !== flowId) return;
    try { const step = await session.step(flowId); if (this.musicFlow?.step?.flow_id === flowId) this.showFlowStep(step); }
    catch {
      // A flow that ended is no longer on the server: its service is there if it succeeded.
      await this.loadMusicSources();
      const sources = this.musicSources, done = typeof sources === 'object' && sources.providers.some(p => p.domain === flow.service.domain);
      if (this.musicFlow?.step?.flow_id === flowId) this.musicFlow = done ? { ...this.musicFlow, step: { ...this.musicFlow.step, type: 'finish' } } : { ...this.musicFlow, busy: false, error: tr('La connexion à {name} n’a pas abouti. Réessayez.', { name: flow.service.name }) };
    }
  }
  private async submitFlow() {
    const session = this.musicSession(), flow = this.musicFlow;
    if (!session || !flow?.step || flow.busy) return;
    this.musicFlow = { ...flow, busy: true };
    try { this.showFlowStep(await session.submit(flow.step.flow_id, flow.values)); }
    catch { if (this.musicFlow) this.musicFlow = { ...this.musicFlow, busy: false, error: tr('La connexion à {name} n’a pas abouti. Réessayez.', { name: flow.service.name }) }; }
  }
  private closeFlow() {
    const flow = this.musicFlow;
    clearTimeout(this.flowTimer);
    if (flow?.step && !['finish', 'abort'].includes(flow.step.type)) void this.musicSession()?.abort(flow.step.flow_id).catch(() => undefined);
    this.musicFlow = undefined;
  }
  private serviceMark(service: Pick<MusicService, 'name'|'tone'|'glyph'>, size = 44) {
    const logo = serviceLogo(service);
    return html`<span class=${`svc-logo ${service.tone}`} style=${`--size:${size}px`}>${logo ? html`<img src=${logo} alt="">` : service.glyph ? service.glyph : mpIcon('music', Math.round(size / 2))}</span>`;
  }
  private serviceOf(provider: ProviderInstance): MusicService {
    const manifest = typeof this.musicSources === 'object' ? this.musicSources.manifests.find(m => m.domain === provider.domain) : undefined;
    return MUSIC_SERVICES.find(service => service.domain === provider.domain) ?? { domain: provider.domain, name: manifest?.name ?? provider.default_name ?? provider.domain, access: 'login', tone: 'other', glyph: '' };
  }
  /** The music block on top of "Pour vous", for administrators: switch the engine on, then connect and look after services. */
  private musicSetup() {
    if (!this.hass?.user?.is_admin) return nothing;
    const engine = this.engine;
    if (!engine || engine === 'loading') return nothing;
    if (engine === 'error') return html`<div class="music-setup glass"><p class="muted">${tr('MP Nexus ne parvient pas à joindre le moteur musical.')}</p><button class="btn" @click=${() => this.loadEngine(true)}>${tr('Réessayer')}</button></div>`;
    if (engine.phase === 'unsupported') return html`<div class="music-setup glass"><b>${tr('Musique')}</b><p class="muted">${tr('Cette installation de Home Assistant ne peut pas ajouter d’application. Installez Music Assistant à part, puis ajoutez son intégration : MP Nexus la reprendra automatiquement.')}</p><a class="btn" href="https://music-assistant.io/installation/" target="_blank" rel="noopener noreferrer">${tr('Guide d’installation')}</a></div>`;
    if (engine.phase === 'preparing') return this.enginePreparing(engine);
    if (engine.phase !== 'ready') return html`<div class="music-hero glass">
      <span class="svc-logo radio" style="--size:60px">${mpIcon('music', 28)}</span>
      <b class="serif">${tr('Votre musique, dans toute la maison')}</b>
      <p class="muted">${tr('Spotify, Deezer, Apple Music, radios… sur toutes vos enceintes, en quelques touches.')}</p>
      ${engine.phase === 'failed' ? html`<p class="note" role="alert">${tr('La préparation s’est arrêtée. Vérifiez la connexion Internet de Home Assistant, puis réessayez.')}</p>` : nothing}
      <button class="btn primary big" @click=${() => void this.startMusicEngine()}>${mpIcon('sparkle', 17)}${engine.phase === 'failed' ? tr('Réessayer') : tr('Activer la musique')}</button>
      <small class="muted">${tr('Gratuit · environ 1 minute · rien à configurer')}</small>
    </div>`;
    if (!engine.ingress_entry) return nothing;
    if (this.musicFlow) return this.musicFlowPanel(this.musicFlow);
    const sources = this.musicSources;
    if (!sources || sources === 'loading') return nothing;
    if (sources === 'error') return html`<div class="music-setup glass"><p class="muted">${tr('Les services de musique ne répondent pas pour le moment.')}</p><button class="btn" @click=${() => void this.loadMusicSources()}>${tr('Réessayer')}</button></div>`;
    const connected = connectedServices(sources.providers, sources.manifests);
    if (!connected.length || this.musicServicesOpen) return this.musicServiceGrid(connected);
    return html`<div class="sec"><b>${tr('Mes services')}</b><button @click=${() => { this.musicServicesOpen = true; }}>${tr('Ajouter')}</button></div>
      <div class="svc-rows">${connected.map(provider => {
        const service = this.serviceOf(provider), lost = provider.status === 'auth_required';
        return html`<div class=${`svc-row ${lost ? 'lost' : ''}`}>${this.serviceMark(service, 32)}<span><b>${provider.name || service.name}</b><small>${lost ? tr('Reconnexion nécessaire') : provider.status === 'loading' ? tr('Connexion…') : provider.last_error ? tr('Indisponible pour le moment') : tr('Connecté')}</small></span>
          ${lost ? html`<button class="btn gold sm" @click=${() => void this.connectService(service, provider.instance_id)}>${tr('Reconnecter')}</button>` : nothing}</div>`;
      })}</div>`;
  }
  private enginePreparing(engine: EngineStatus) {
    const order = ['repository', 'install', 'start', 'link', 'done'] as const, at = order.indexOf(engine.step ?? 'repository');
    const steps: [number, Parameters<typeof tr>[0], Parameters<typeof tr>[0]][] = [
      [1, 'Moteur musical installé', 'Music Assistant, géré par MP Nexus'],
      [2, 'Moteur démarré', 'Il trouve vos enceintes tout seul'],
      [3, 'Relié à Home Assistant', 'Automatiquement, sans jeton'],
    ];
    return html`<div class="music-setup glass"><b>${tr('Préparation de la musique')}</b>
      <p class="muted">${tr('MP Nexus installe et relie le moteur musical. Vous pouvez quitter cet écran.')}</p>
      ${steps.map(([index, title, detail]) => html`<div class=${`stp ${at > index ? 'ok' : at === index || (index === 1 && at === 0) ? 'run' : ''}`}><span class="o">${at > index ? mpIcon('check', 14) : nothing}</span><span><b>${tr(title)}</b><small>${tr(detail)}</small></span></div>`)}
      <div class="bar"><i style=${`width:${Math.round(Math.max(8, at / 4 * 100))}%`}></i></div>
    </div>`;
  }
  private musicServiceGrid(connected: ProviderInstance[]) {
    const has = new Set(connected.map(p => p.domain));
    const badge = (service: MusicService) => has.has(service.domain) ? tr('connecté') : service.access === 'free' ? tr('inclus') : service.access === 'oauth' ? tr('1 touche') : service.access === 'login' ? tr('e-mail') : tr('guidé');
    return html`<div class="sec"><b>${tr('Ajouter un service')}</b>${connected.length ? html`<button @click=${() => { this.musicServicesOpen = false; }}>${tr('Fermer')}</button>` : nothing}</div>
      <p class="muted svc-hint">${tr('Touchez votre service : la connexion se fait sur sa propre page.')}</p>
      <div class="svc-grid">${MUSIC_SERVICES.map(service => html`<button class=${has.has(service.domain) ? 'on' : ''} ?disabled=${has.has(service.domain) && service.access === 'free'} @click=${() => void this.connectService(service)}>
        <i class=${`svc-badge ${has.has(service.domain) ? 'ok' : service.access}`}>${badge(service)}</i>${this.serviceMark(service)}<span>${service.name}</span></button>`)}</div>`;
  }
  private flowField(entry: FlowEntry, flow: NonNullable<typeof this.musicFlow>) {
    const value = flow.values[entry.key], set = (next: unknown) => { if (this.musicFlow) this.musicFlow = { ...this.musicFlow, values: { ...this.musicFlow.values, [entry.key]: next } }; };
    const label = entry.label || entry.key, error = flow.step?.errors?.[entry.key];
    if (entry.type === 'label') return html`<p class="muted flow-text">${label}</p>`;
    if (entry.type === 'alert') return html`<p class="note">${label}</p>`;
    if (entry.type === 'url' || entry.help_link && entry.type === 'action') return html`<a class="btn" href=${String(entry.value ?? entry.default_value ?? entry.help_link ?? '')} target="_blank" rel="noopener noreferrer">${mpIcon('link', 15)}${label}</a>`;
    if (['image', 'icon', 'action', 'divider'].includes(entry.type)) return nothing;
    if (entry.type === 'boolean') return html`<label class="flow-check"><input type="checkbox" .checked=${Boolean(value)} ?disabled=${entry.read_only} @change=${(event: Event) => set((event.target as HTMLInputElement).checked)}><span><b>${label}</b>${entry.description ? html`<small>${entry.description}</small>` : nothing}</span></label>`;
    const input = entry.options?.length
      ? html`<select ?disabled=${entry.read_only} @change=${(event: Event) => set(entry.options![(event.target as HTMLSelectElement).selectedIndex]?.value)}>${entry.options.map(option => html`<option .selected=${option.value === value}>${option.title}</option>`)}</select>`
      : html`<input type=${entry.type === 'secure_string' ? 'password' : entry.type === 'integer' || entry.type === 'float' ? 'number' : 'text'} autocomplete=${entry.type === 'secure_string' ? 'current-password' : 'off'} .value=${value === null || value === undefined ? '' : String(value)} ?readonly=${entry.read_only} ?required=${entry.required} @input=${(event: Event) => { const raw = (event.target as HTMLInputElement).value; set(entry.type === 'integer' ? parseInt(raw, 10) : entry.type === 'float' ? parseFloat(raw) : raw); }}>`;
    return html`<label class="flow-field"><span>${label}${entry.required ? nothing : html` <small>${tr('facultatif')}</small>`}</span>${input}${entry.description ? html`<small>${entry.description}</small>` : nothing}${error ? html`<small class="err">${error}</small>` : nothing}${entry.help_link ? html`<a href=${entry.help_link} target="_blank" rel="noopener noreferrer">${tr('Où trouver cette information ?')}</a>` : nothing}</label>`;
  }
  private musicFlowPanel(flow: NonNullable<typeof this.musicFlow>) {
    const { service, step } = flow;
    const head = html`<div class="flow-head">${this.serviceMark(service, 36)}<b>${service.name}</b><button class="ib" aria-label=${tr('Fermer')} title=${tr('Fermer')} @click=${() => this.closeFlow()}>${mpIcon('close', 15)}</button></div>`;
    let body: TemplateResult;
    if (flow.error) body = html`<p class="note" role="alert">${flow.error}</p><button class="btn primary big" @click=${() => void this.connectService(service, flow.reconnect)}>${tr('Réessayer')}</button>`;
    else if (!step) body = html`<p class="muted">${tr('Ouverture de {name}…', { name: service.name })}</p><div class="bar busy"><i></i></div>`;
    else if (step.type === 'form') {
      const entries = (step.entries ?? []).filter(entry => entryVisible(entry, flow.values));
      body = html`<form class="flow-form" @submit=${(event: Event) => { event.preventDefault(); void this.submitFlow(); }}>
        ${step.description ? html`<p class="muted flow-text">${step.description}</p>` : nothing}
        ${service.domain === 'deezer' && step.entries?.some(entry => entry.type === 'secure_string') ? html`<ol class="flow-guide"><li>${tr('Ouvrez deezer.com sur un ordinateur et connectez-vous.')}</li><li>${tr('Ouvrez les outils de développement (F12), onglet Application, puis Cookies de deezer.com.')}</li><li>${tr('Copiez la valeur « arl » et collez-la ci-dessous. Elle reste dans votre Home Assistant.')}</li></ol>` : nothing}
        ${entries.map(entry => this.flowField(entry, flow))}
        ${step.errors?.base ? html`<p class="note" role="alert">${step.errors.base}</p>` : nothing}
        <button class="btn primary big" type="submit" ?disabled=${flow.busy}>${flow.busy ? tr('Connexion…') : step.last_step === false ? tr('Continuer') : tr('Connecter {name}', { name: service.name })}</button></form>`;
    } else if (step.type === 'external') body = html`
      <p class="muted flow-text">${step.description || tr('La connexion se fait sur la page officielle de {name}. Aucun mot de passe ne passe par MP Nexus.', { name: service.name })}</p>
      ${step.url ? html`<a class="btn primary big" href=${step.url} target="_blank" rel="noopener noreferrer">${mpIcon('link', 16)}${tr('Se connecter avec {name}', { name: service.name })}</a>` : nothing}
      ${step.copy_text ? html`<button class="btn" @click=${() => void navigator.clipboard?.writeText(step.copy_text!)}>${mpIcon('copy', 15)}${step.copy_text}</button>` : nothing}
      <small class="muted">${tr('Revenez ici une fois connecté : MP Nexus continue tout seul.')}</small><div class="bar busy"><i></i></div>`;
    else if (step.type === 'progress') body = html`<p class="muted flow-text">${step.progress_text || step.description || tr('Un instant…')}</p>${step.image ? html`<img class="flow-qr" src=${step.image} alt="">` : nothing}<div class="bar ${typeof step.progress === 'number' ? '' : 'busy'}"><i style=${typeof step.progress === 'number' ? `width:${Math.round(step.progress * 100)}%` : ''}></i></div>`;
    else if (step.type === 'finish') body = html`<div class="flow-done">${mpIcon('check', 22)}<b class="serif">${tr('{name} est connecté', { name: service.name })}</b><small class="muted">${tr('Votre bibliothèque arrive dans quelques minutes, vous pouvez déjà écouter.')}</small></div>
      <button class="btn primary big" @click=${() => { this.closeFlow(); }}>${mpIcon('play', 16)}${tr('Commencer à écouter')}</button>
      <button class="btn" @click=${() => { this.closeFlow(); this.musicServicesOpen = true; }}>${mpIcon('plus', 15)}${tr('Ajouter un autre service')}</button>`;
    else body = html`<p class="note" role="alert">${step.reason || tr('La connexion à {name} n’a pas abouti. Réessayez.', { name: service.name })}</p><button class="btn" @click=${() => this.closeFlow()}>${tr('Fermer')}</button>`;
    return html`<div class="music-flow glass">${head}${body}</div>`;
  }
  /** Sources and apps to start in one touch, then the library the player offers to browse. */
  private forYou(id: string) {
    const state = this.state(id), tv = mediaIsTv(state);
    const otherPlayers = this.players.filter(player => player !== id);
    const currentArtwork = state?.attributes.entity_picture;
    const currentTitle = nowPlaying(state);
    const sources = Array.isArray(state?.attributes.source_list) ? (state!.attributes.source_list as unknown[]).map(String) : [];
    const browsing = this.browsing, level = browsing?.player === id ? browsing.stack[browsing.stack.length - 1] : undefined;
    const playItem = (item: Pick<BrowseItem, 'media_content_id'|'media_content_type'>) => void this.mediaCall('play_media', { entity_id: id, media_content_id: item.media_content_id, media_content_type: item.media_content_type });
    const target = this.musicTarget(id);
    const addFavorite = (item: BrowseItem) => { const mediaId = safeFavoriteContentId(item.media_content_id); if (!mediaId) return; this.favoriteItem({ key: `${id}|${item.media_content_type}|${mediaId}`, title: item.title, artist: '', media_content_id: mediaId, media_content_type: item.media_content_type, ...(safeFavoriteImage(item.thumbnail, location.origin) ? { image: safeFavoriteImage(item.thumbnail, location.origin) } : {}), player: id }); };
    return html`
      ${this.musicSetup()}
      ${target && target !== id ? html`<p class="muted music-target">${mpIcon('speaker', 13)}${tr('La musique choisie ici joue sur {player}.', { player: this.playerLabel(target) })}</p>` : nothing}
      ${this.isMusicAssistantPlayer(id) || target ? html`<form class="media-search" @submit=${(event: Event) => { event.preventDefault(); void this.searchMusicAssistant(id); }}>
        <label class="sr" for="mp-ma-search">${tr('Rechercher dans Music Assistant')}</label><input id="mp-ma-search" .value=${this.mediaSearch} placeholder=${tr('Titre, artiste, album ou radio')} @input=${(event: Event) => { this.mediaSearch = (event.target as HTMLInputElement).value; }}>
        <button class="btn" type="submit" ?disabled=${this.mediaSearching || this.mediaReadOnlyGuest || !this.mediaSearch.trim()}>${mpIcon('search', 15)}${this.mediaSearching ? tr('Recherche…') : tr('Rechercher')}</button>
      </form>` : nothing}
      ${this.mediaResults && target ? html`<div class="rlab">${tr('Résultats')}</div>${this.mediaResults.length ? this.musicList(target, this.mediaResults) : html`<p class="empty">${tr('Aucun résultat pour cette recherche.')}</p>`}`
        : this.mediaResults ? html`<div class="rlab">${tr('Résultats Music Assistant')}</div>${this.mediaResults.length ? html`<div class="lib">${this.mediaResults.map(item => html`<div class="li"><button class="library-open" ?disabled=${!item.can_play && !item.can_expand} @click=${() => item.can_expand ? void this.browseInto(id, item) : item.can_play ? playItem(item) : undefined}><span class="th">${mpIcon(item.can_expand ? 'grid' : 'music', 20)}${this.mediaImage(item.thumbnail)}</span><b>${item.title}</b></button>${item.can_play && safeFavoriteContentId(item.media_content_id) ? html`<button class="favorite-add" aria-label=${tr('Garder sur cet écran')} @click=${() => addFavorite(item)}>${mpIcon('plus', 14)}</button>` : nothing}</div>`)}</div>` : html`<p class="empty">${tr('Aucun résultat pour cette recherche.')}</p>`}` : nothing}
      ${target ? this.musicHub(target) : nothing}
      ${this.musicBridge !== 'loading' && this.musicBridge?.connected ? html`<div class="music-connected">${mpIcon('check', 16)}<span><b>${tr('Musique')}</b><small>${tr('Connecté automatiquement · {n} lecteur|Connecté automatiquement · {n} lecteurs', { n: this.musicBridge.player_count ?? this.players.filter(player => this.isMusicAssistantPlayer(player)).length })}</small></span></div>` : nothing}
      ${otherPlayers.length ? html`<div class="rlab">${tr('Lecteurs')}</div><div class="houses">${[id, ...otherPlayers].map(player => html`<button class="pill" aria-pressed=${player === id} @click=${() => { this.player = mediaPlayer = player; this.browsing = undefined; this.mediaResults = undefined; this.browseRequest++; this.mediaSearchRequest++; this.requestUpdate(); }}>${mpIcon(entityIcon(player, this.state(player)), 13)}${this.playerLabel(player)}${this.isMusicAssistantPlayer(player) ? html`<span>Music Assistant</span>` : nothing}</button>`)}</div>` : nothing}
      ${currentTitle && currentArtwork ? html`<div class="rlab">${tr('En lecture')}</div><div class="live glass"><span class="art">${this.mediaImage(currentArtwork, true)}</span><div><b>${currentTitle}</b><small>${this.playerLabel(id)}</small></div></div>` : nothing}
      <div class="sec"><b>${tr('Favoris MP Nexus · cet écran')}</b><span>${this.mediaFavorites.length}</span></div>
      ${this.mediaFavorites.length ? html`<div class="media-favorites">${this.mediaFavorites.map(item => html`<div class="media-favorite">
        <button class="favorite-play" @click=${() => playItem(item)}><span class="th">${mpIcon('music', 20)}${this.mediaImage(item.image || (this.state(item.player)?.attributes.media_content_id === item.media_content_id ? this.state(item.player)?.attributes.entity_picture : undefined))}</span><span><b>${item.title}</b><small>${item.source ? this.mediaSourceBadge(item.source) : nothing}${item.artist || item.media_content_type}</small></span></button>
        <button class="ib" aria-label=${tr('Retirer des favoris')} title=${tr('Retirer des favoris')} @click=${() => this.favoriteItem(item)}>${mpIcon('close', 15)}</button>
      </div>`)}</div>` : html`<p class="empty">${tr('Gardez ici vos morceaux, albums et playlists préférés.')}</p>`}
      ${sources.length && canMedia(state, 'select_source') ? html`<div class="rlab">${tv ? tr('Applis et entrées') : tr('Sources')}</div>
        <div class="srcs">${sources.map(s => html`<button class="src" aria-pressed=${s === state?.attributes.source} @click=${() => void this.mediaCall('select_source', { entity_id: id, source: s })}>${this.mediaSourceBadge(s)}<b>${s}</b></button>`)}</div>` : nothing}
      ${this.musicBridge !== 'loading' && this.musicBridge?.connected ? nothing : canMedia(state, 'browse_media') ? html`<div class="sec"><b>${level && browsing!.stack.length > 1 ? level.title : tr('Bibliothèque')}</b>${browsing && browsing.stack.length > 1 ? html`<button @click=${() => { this.browsing = { ...browsing, stack: browsing.stack.slice(0, -1) }; }}>${tr('Retour')}</button>` : nothing}</div>
        ${browsing?.player === id && browsing.state === 'loading' ? html`<p class="empty">${tr('Chargement…')}</p>`
          : browsing?.player === id && browsing.state === 'error' ? html`<p class="empty">${tr('La bibliothèque de ce lecteur ne répond pas.')} <button class="btn" @click=${() => { this.browsing = undefined; }}>${tr('Réessayer')}</button></p>`
            : level?.children?.length ? html`${!level.children.some(item => displayMediaImage(item.thumbnail)) ? html`<p class="media-art-hint">${tr('Ce dossier ne fournit aucune pochette. Ouvrez un album ou choisissez un lecteur Music Assistant pour voir les pochettes disponibles.')}</p>` : nothing}<div class="lib">${level.children.map(item => html`<div class="li">
              <button class="library-open" ?disabled=${!item.can_expand && !item.can_play} @click=${() => item.can_expand ? void this.browseInto(id, item) : item.can_play ? playItem(item) : undefined}>
                <span class="th">${mpIcon(item.can_expand ? 'grid' : 'music', 20)}${this.mediaImage(item.thumbnail)}${item.can_play ? html`<i class="pl">${mpIcon('play', 14)}</i>` : nothing}</span><b>${item.title}</b></button>
      ${item.can_play && safeFavoriteContentId(item.media_content_id) ? html`<button class="favorite-add" aria-label=${tr('Garder sur cet écran')} title=${tr('Garder sur cet écran')} @click=${() => addFavorite(item)}>${mpIcon(this.mediaFavorites.some(saved => saved.key === `${id}|${item.media_content_type}|${item.media_content_id}`) ? 'check' : 'plus', 14)}</button>` : nothing}</div>`)}</div>`
              : html`<p class="empty">${tr('Rien à parcourir sur ce lecteur.')}</p>`}` : sources.length ? nothing : html`<p class="empty">${tr('Rien à parcourir sur ce lecteur.')}</p>`}`;
  }
  /**
   * The Music Assistant player that plays what is picked on this one: itself, else the Music Assistant twin of the
   * same speaker (same name), else the first one. Music from the services only plays through Music Assistant.
   */
  private musicTarget(id: string) {
    if (this.musicBridge === 'loading' || !this.musicBridge?.connected) return undefined;
    if (this.isMusicAssistantPlayer(id)) return id;
    const own = Object.keys(this.hass?.states ?? {}).filter(player => player.startsWith('media_player.') && this.isMusicAssistantPlayer(player));
    const name = this.playerLabel(id).trim().toLowerCase();
    return own.find(player => this.playerLabel(player).trim().toLowerCase() === name) ?? own.find(player => this.hass?.entities?.[player]?.device_id && this.hass?.entities?.[player]?.device_id === this.hass?.entities?.[id]?.device_id) ?? own[0];
  }
  private musicList(id: string, items: MusicHubItem[]) {
    return html`<div class="lib music-hub">${items.map(item => html`<div class="li music-item">
        <button class="library-open" @click=${() => void this.musicItemAction(id, item, 'play_now')}><span class="th">${mpIcon('music', 20)}${this.mediaImage(item.thumbnail)}<i class="pl">${mpIcon('play', 14)}</i></span><b>${item.title}</b><small>${item.artist || item.album || item.media_content_type}</small></button>
        <div class="media-item-actions"><button aria-label=${tr('Lire ensuite')} title=${tr('Lire ensuite')} @click=${() => void this.musicItemAction(id, item, 'play_next')}>${mpIcon('next', 13)}</button><button aria-label=${tr('Ajouter à la file')} title=${tr('Ajouter à la file')} @click=${() => void this.musicItemAction(id, item, 'add')}>${mpIcon('plus', 13)}</button></div>
      </div>`)}</div>`;
  }
  private musicHub(id: string) {
    const kinds: { kind: MusicLibraryKind; label: Parameters<typeof tr>[0] }[] = [
      { kind: 'albums', label: 'Albums' }, { kind: 'artists', label: 'Artistes' }, { kind: 'tracks', label: 'Morceaux' },
      { kind: 'playlists', label: 'Playlists' }, { kind: 'radio', label: 'Radios' }, { kind: 'podcasts', label: 'Podcasts' },
    ];
    return html`<div class="sec"><b>${tr('Ma bibliothèque')}</b><span>${this.musicItems?.length ?? 0}</span></div>
      <div class="houses music-kinds">${kinds.map(({ kind, label }) => html`<button class="pill" aria-pressed=${this.musicKind === kind} @click=${() => void this.loadMusicLibrary(kind)}>${tr(label)}</button>`)}</div>
      ${this.musicLoading ? html`<p class="empty">${tr('Chargement…')}</p>` : this.musicItems?.length ? this.musicList(id, this.musicItems) : html`<p class="empty">${tr('Aucun média dans cette section.')}</p>`}`;
  }
  private musicQueuePanel() {
    const queue = this.musicQueueData!;
    return html`<div class="sec"><b>${tr('File de lecture')}</b><button @click=${() => void this.musicQueueAction('clear', {})}>${tr('Vider')}</button></div><div class="queue-list">${queue.items.map(item => html`<div class=${`queue-row ${item.index === queue.current_index ? 'current' : ''}`}><span class="art">${this.mediaImage(item.thumbnail)}</span><button class="queue-title" @click=${() => void this.musicItemAction(queue.player, item, 'play_now')}><b>${item.title}</b><small>${item.artist}</small></button></div>`)}</div>`;
  }
  private async browseInto(player: string, item?: BrowseItem) {
    const hass = this.hass;
    if (!hass) return;
    const request = ++this.browseRequest;
    const stack = item && this.browsing?.player === player ? this.browsing.stack : [];
    this.browsing = { player, stack, state: 'loading' };
    try {
      const level = await browse(hass, player, item);
      if (request !== this.browseRequest || player !== this.currentPlayer) return;
      this.browsing = { player, stack: [...stack, level], state: 'ready' };
    } catch { if (request === this.browseRequest && player === this.currentPlayer) this.browsing = { player, stack, state: 'error' }; }
  }
  /** Every player of the house: its volume, what it plays, and whether it plays with the one chosen. */
  private speakers(id: string) {
    const states = this.hass?.states ?? {}, current = states[id], group = groupOf(states, id);
    const groups = canMedia(current, 'grouping');
    const playing = this.players.filter(p => mediaPlaying(states[p]) && canMedia(states[p], 'pause'));
    return html`<div class="sg">${[id, ...this.players.filter(p => p !== id)].map(p => {
      const s = states[p], volume = mediaVolume(s), joined = group.includes(p), self = p === id;
      return html`<div class="spk">
        <button class="rw" @click=${() => { this.player = mediaPlayer = p; this.mediaTab = 'play'; mediaTab = 'play'; this.requestUpdate(); }}><span class="ib" style=${self ? 'color:var(--accent)' : ''}>${mpIcon(entityIcon(p, s), 16)}</span><div><b>${this.playerLabel(p)}</b><small>${[stateLabel(p, s), mediaOn(s) ? nowPlaying(s) : ''].filter(Boolean).join(' · ')}</small></div>
          <span class="end">${self ? html`<span class="pill">${tr('Ce lecteur')}</span>` : nothing}</span></button>
        ${groups && !self && canMedia(s, 'grouping') ? html`<button class="end" role="switch" aria-checked=${joined} aria-label=${tr('Jouer ensemble')} title=${tr('Jouer ensemble')} @click=${() => joined ? this.call('media_player', 'unjoin', { entity_id: p }) : this.call('media_player', 'join', { entity_id: id, group_members: [p] })}><span class=${`tgl ${joined ? '' : 'off'}`}></span></button>` : nothing}
        ${volume !== undefined && canMedia(s, 'volume_set') ? html`<label class="vol mini">${mpIcon('volume', 15)}<input type="range" min="0" max="100" .value=${String(volume)} aria-label=${tr('Volume')} @change=${(e: Event) => this.call('media_player', 'volume_set', { entity_id: p, volume_level: Number((e.target as HTMLInputElement).value) / 100 })}><span class="muted">${volume} %</span></label>` : nothing}
      </div>`;
    })}</div>
    ${groups ? html`<p class="muted" style="font-size:12px;margin:0">${tr('Activez une pièce pour qu’elle joue la même musique que {room}.', { room: this.roomOf(id) ?? this.name(id) })}</p>` : nothing}
    ${playing.length ? html`<button class="btn" @click=${() => this.call('media_player', 'media_pause', { entity_id: playing })}>${mpIcon('pause', 16)}${tr('Tout mettre en pause')}</button>` : nothing}`;
  }
  /** The remote of a television: the same arrows or trackpad for every brand, then the keys its brand and integration really have. */
  private remote(id: string) {
    const state = this.state(id), routes = remoteRoutes(this.hass, id), muted = state?.attributes.is_volume_muted === true;
    const profile = remoteProfile(this.hass, id), keyboard = remoteKeyboard(this.hass, id);
    const send = (key: RemoteKey) => { const route = routes[key]; if (route && !this.mediaReadOnlyGuest) { tap(); void this.remoteCall(route); } else if (this.mediaReadOnlyGuest) { this.mediaNotice = tr('Cet accès invité est en lecture seule.'); this.requestUpdate(); } };
    const canTrackpad = trackpadAvailable(routes), trackpad = canTrackpad && this.remoteTrackpad(id);
    const key = (k: RemoteKey, icon: MPIconName | '', label: string, cls = '') => routes[k] ? html`<button class=${`k ${cls}`} aria-label=${label} title=${label} @click=${() => send(k)}>${icon ? mpIcon(icon, 22) : html`<b>${label}</b>`}</button>` : html`<span class=${`k ${cls}`}></span>`;
    const media = (service: string, data: Record<string, unknown> = {}) => { tap(); return this.call('media_player', service, { entity_id: id, ...data }); };
    /** A round key of the remote, its name written under it like on the real one. */
    const rkey = (label: string, icon: MPIconName, click: () => unknown, options: { cls?: string; disabled?: boolean; pressed?: boolean; text?: string } = {}) => html`<div class=${`rkey-wrap ${options.cls ?? ''}`}><button class="rkey" aria-label=${label} title=${label} aria-pressed=${options.pressed ?? nothing} ?disabled=${options.disabled} @click=${click}>${options.text ? html`<b>${options.text}</b>` : mpIcon(icon, 20)}</button><small>${label}</small></div>`;
    const volume = mediaVolume(state), step = (by: number) => canMedia(state, 'volume_step') ? media(by > 0 ? 'volume_up' : 'volume_down') : volume !== undefined ? media('volume_set', { volume_level: Math.min(100, Math.max(0, volume + by)) / 100 }) : undefined;
    const canStep = canMedia(state, 'volume_step') || (volume !== undefined && canMedia(state, 'volume_set'));
    const apps = (['netflix', 'youtube', 'prime'] as const).filter(k => routes[k]);
    const colors = (['red', 'green', 'yellow', 'blue'] as const).filter(k => routes[k]);
    const hasDigits = DIGITS.every(n => routes[n]);
    const focused = !!keyboard?.focus && this.state(keyboard.focus)?.state === 'on';
    if (!focused) { this.remoteFocusClosed = false; this.remoteFocusShown = false; }
    const asked = this.remoteExtra === 'digits' && !hasDigits || this.remoteExtra === 'keyboard' && !keyboard ? undefined : this.remoteExtra;
    const extra = focused && !this.remoteFocusClosed && !this.mediaReadOnlyGuest ? 'keyboard' : asked;
    if (extra === 'keyboard' && focused && !this.remoteFocusShown) { this.remoteFocusShown = true; void this.updateComplete.then(() => this.renderRoot.querySelector<HTMLInputElement>('.remote-keyboard input')?.focus()); }
    const drawer = (which: 'digits'|'keyboard') => {
      if (extra === which) { this.remoteExtra = undefined; if (focused) this.remoteFocusClosed = true; }
      else { this.remoteExtra = which; if (which === 'keyboard') this.remoteFocusClosed = false; else if (focused) this.remoteFocusClosed = true; }
      this.requestUpdate();
    };
    const type = (e: Event) => {
      e.preventDefault();
      const text = this.remoteText.trim() && this.remoteText.slice(0, 250);
      if (!keyboard || !text) return;
      if (this.mediaReadOnlyGuest) { this.mediaNotice = tr('Cet accès invité est en lecture seule.'); return; }
      void this.remoteCall(keyboard.send(text)).then(() => { if (!this.mediaNotice) { this.remoteText = ''; this.mediaNotice = keyboard.mode === 'search' ? tr('Recherche lancée sur le téléviseur.') : tr('Texte envoyé au téléviseur.'); } });
    };
    const guarded = (route: RemoteRoute) => { if (this.mediaReadOnlyGuest) { this.mediaNotice = tr('Cet accès invité est en lecture seule.'); return; } void this.remoteCall(route); };
    const on = mediaOn(state), playing = mediaPlaying(state);
    const layout = REMOTE_LAYOUTS[remoteSystem(this.hass, id)] ?? DEFAULT_LAYOUT;
    const face = (k: RemoteKey): [MPIconName, string] => { const [icon, label] = layout.faces?.[k] ?? REMOTE_FACES[k] ?? ['dots', 'Menu']; return [icon, tr(label)]; };
    const top = layout.top.filter(k => k === 'power' || routes[k]), under = layout.under.filter(k => routes[k]);
    const placed = new Set<RemoteKey | 'power'>([...top, ...under, 'rewind', 'forward']);
    const rest = (['back', 'home', 'menu', ...REMOTE_SHORTCUTS.map(([k]) => k)] as RemoteKey[]).filter(k => routes[k] && !placed.has(k));
    // Back and forward: the television's own keys, else a ten-second jump on the player.
    const at = elapsed(state), duration = finite(state?.attributes.media_duration), canSeek = canMedia(state, 'seek') && at !== undefined;
    const jump = (by: number) => routes[by < 0 ? 'rewind' : 'forward'] ? send(by < 0 ? 'rewind' : 'forward') : canSeek ? media('media_seek', { seek_position: Math.max(0, Math.min(duration ?? Infinity, at! + by)) }) : undefined;
    const ten = layout.skip === 'ten' || !routes.rewind;
    const canJump = (by: number) => !!routes[by < 0 ? 'rewind' : 'forward'] || canSeek;
    return html`<div class="remote-body">
      ${mediaIsTv(state) || Object.keys(routes).length ? html`<div class="remote-mode">${profile ? html`<span class=${`remote-brand ${profile.tone}`}>${mpIcon('tv', 14)}<b>${profile.brand && !profile.system.startsWith(profile.brand) ? profile.brand : profile.system}</b>${profile.brand && !profile.system.startsWith(profile.brand) ? html`<small>${profile.system}</small>` : nothing}</span>` : nothing}<span>${tr('Trackpad')}</span><button role="switch" aria-checked=${trackpad} aria-label=${tr('Trackpad')} ?disabled=${!canTrackpad || this.mediaReadOnlyGuest} title=${canTrackpad ? tr('Trackpad') : tr('Le trackpad n’est pas pris en charge par ce lecteur.')} @click=${() => this.toggleRemoteTrackpad(id, !trackpad)}><span class=${`tgl ${trackpad ? '' : 'off'}`}></span></button></div>` : nothing}
      <div class="rtop">
        ${top.map(k => k === 'power' ? rkey(on ? tr('Éteindre') : tr('Allumer'), 'power', () => media(on ? 'turn_off' : 'turn_on'), { cls: `power ${on ? 'on' : ''}`, disabled: !canMedia(state, on ? 'turn_off' : 'turn_on') }) : rkey(face(k)[1], face(k)[0], () => send(k)))}
      </div>
      ${Object.keys(routes).length ? html`<div class=${`pad ${trackpad ? 'tracking' : ''}`} role="group" aria-label=${tr('Télécommande')}>
        ${trackpad ? html`<div class="track-surface" role="button" tabindex="0" aria-label=${tr('Trackpad télécommande')} @pointerdown=${(e: PointerEvent) => this.remotePointerDown(e, id)} @pointermove=${this.remotePointerMove} @pointerup=${(e: PointerEvent) => this.remotePointerUp(e, id, send)} @pointercancel=${this.remotePointerCancel} @lostpointercapture=${this.remotePointerCancel} @touchstart=${this.remoteTouchBoundary} @touchmove=${this.remoteTouchMove} @touchend=${this.remoteTouchBoundary} @touchcancel=${this.remoteTouchBoundary} @click=${this.remoteClick} @keydown=${(e: KeyboardEvent) => { const k: Partial<Record<string, RemoteKey>> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'select', ' ': 'select' }; const key = k[e.key]; if (key) { e.preventDefault(); e.stopPropagation(); if (!e.repeat) send(key); } }}><span>${mpIcon('hand', 22)}</span><b>${tr('Glissez pour naviguer · Touchez pour OK')}</b></div>` : html`${key('up', 'up', tr('Haut'), 'n')}${key('left', 'back', tr('Gauche'), 'w')}${key('select', '', tr('OK'), 'ok')}${key('right', 'arrow', tr('Droite'), 'e')}${key('down', 'down', tr('Bas'), 's')}`}
      </div>` : html`<p class="empty">${tr('Aucune touche fléchée pour ce téléviseur : elles apparaissent avec les intégrations Apple TV, Android TV, Roku, Samsung, LG webOS, Philips, Sony, Panasonic et Kodi.')}</p>`}
      ${under.length ? html`<div class="remote-under" style=${`--n:${under.length}`}>${under.map(k => { const [icon, label] = face(k); return html`<button class=${`rwide k-${k}`} @click=${() => send(k)}>${mpIcon(icon, 19)}<span>${label}</span></button>`; })}</div>` : nothing}
      <div class="remote-transport" role="group" aria-label=${tr('Lecture')}>
        <button class="rskip" aria-label=${ten ? tr('Reculer de 10 s') : tr('Reculer')} title=${ten ? tr('Reculer de 10 s') : tr('Reculer')} ?disabled=${!canJump(-10)} @click=${() => jump(-10)}>${mpIcon(ten ? 'rewind10' : 'rewind', 26)}<small>${ten ? '−10 s' : tr('Reculer')}</small></button>
        <button class="rplay" aria-label=${playing ? tr('Pause') : tr('Lecture')} title=${playing ? tr('Pause') : tr('Lecture')} ?disabled=${!canMedia(state, 'pause') && !canMedia(state, 'play')} @click=${() => media('media_play_pause')}>${mpIcon(playing ? 'pause' : 'play', 28)}</button>
        <button class="rskip" aria-label=${ten ? tr('Avancer de 10 s') : tr('Avancer')} title=${ten ? tr('Avancer de 10 s') : tr('Avancer')} ?disabled=${!canJump(10)} @click=${() => jump(10)}>${mpIcon(ten ? 'forward10' : 'forward', 26)}<small>${ten ? '+10 s' : tr('Avancer')}</small></button>
      </div>
      <div class="rkeys">
        <div class="rk" role="group" aria-label=${tr('Volume')}><button aria-label=${tr('Monter le volume')} title=${tr('Monter le volume')} ?disabled=${!canStep} @click=${() => step(5)}>${mpIcon('plus', 20)}</button><small>${tr('Volume')}</small><button aria-label=${tr('Baisser le volume')} title=${tr('Baisser le volume')} ?disabled=${!canStep} @click=${() => step(-5)}>${mpIcon('minus', 20)}</button></div>
        <div class="rc">
          ${rkey(muted ? tr('Rétablir le son') : tr('Couper le son'), muted ? 'mute' : 'volume', () => media('volume_mute', { is_volume_muted: !muted }), { cls: muted ? 'muted' : '', disabled: !canMedia(state, 'volume_mute'), pressed: muted })}
        </div>
        ${layout.channels ? html`<div class="rk" role="group" aria-label=${tr('Chaîne')}><button aria-label=${tr('Suivant')} title=${tr('Suivant')} ?disabled=${!canMedia(state, 'next_track')} @click=${() => media('media_next_track')}>${mpIcon('up', 20)}</button><small>${tr('Chaîne')}</small><button aria-label=${tr('Précédent')} title=${tr('Précédent')} ?disabled=${!canMedia(state, 'previous_track')} @click=${() => media('media_previous_track')}>${mpIcon('down', 20)}</button></div>` : html`<span class="rk-space"></span>`}
      </div>
      ${hasDigits || keyboard ? html`<div class="remote-tools">${hasDigits ? html`<button aria-pressed=${extra === 'digits'} @click=${() => drawer('digits')}>${mpIcon('grid', 16)}<span>123</span></button>` : nothing}${keyboard ? html`<button aria-pressed=${extra === 'keyboard'} @click=${() => drawer('keyboard')}>${mpIcon(keyboard.mode === 'search' ? 'search' : 'text', 16)}<span>${tr('Clavier')}</span></button>` : nothing}</div>` : nothing}
      ${extra === 'keyboard' && keyboard ? html`<form class="remote-keyboard" @submit=${type}>
        <input type="text" enterkeyhint="send" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="250" .value=${this.remoteText} placeholder=${keyboard.mode === 'search' ? tr('Rechercher sur le téléviseur') : tr('Texte à taper sur le téléviseur')} aria-label=${tr('Clavier')} @input=${(e: Event) => { this.remoteText = (e.target as HTMLInputElement).value; }} @keydown=${(e: KeyboardEvent) => e.stopPropagation()}>
        <button class="btn primary" type="submit" ?disabled=${!this.remoteText.trim()}>${mpIcon('arrow', 16)}${tr('Envoyer')}</button>
        ${keyboard.enter ? html`<button class="btn" type="button" @click=${() => guarded(keyboard.enter!)}>${mpIcon('check', 16)}${tr('Valider')}</button>` : nothing}
        ${keyboard.clear ? html`<button class="btn" type="button" @click=${() => guarded(keyboard.clear!)}>${mpIcon('close', 16)}${tr('Effacer')}</button>` : nothing}
        <small>${focused ? tr('Le téléviseur attend du texte.') + ' ' : ''}${keyboard.mode === 'search' ? tr('Le texte part directement dans la recherche du téléviseur.') : tr('Le texte s’écrit dans le champ ouvert sur le téléviseur.')}</small>
      </form>` : nothing}
      ${extra === 'digits' ? html`<div class="remote-digits" role="group" aria-label=${tr('Pavé numérique')}>${DIGITS.map(n => html`<button class=${`rkey ${n === '0' ? 'zero' : ''}`} @click=${() => send(n)}><b>${n}</b></button>`)}</div>` : nothing}
      ${colors.length ? html`<div class="remote-colors" role="group" aria-label=${tr('Touches de couleur')}>${colors.map(k => html`<button class=${k} aria-label=${tr(COLOR_NAMES[k])} title=${tr(COLOR_NAMES[k])} @click=${() => send(k)}><i></i></button>`)}</div>` : nothing}
      ${apps.length ? html`<div class="remote-apps">${apps.map(k => { const brand = serviceBrand(APP_NAMES[k]); return html`<button class=${`remote-app ${k}`} @click=${() => send(k)}>${brand ? html`<span class=${`source-logo ${brand.tone}`}><img src=${brand.image} alt=""></span>` : html`<span class="source-logo prime"><b>prime</b></span>`}<small>${APP_NAMES[k]}</small></button>`; })}</div>` : nothing}
      ${rest.length ? html`<div class="remote-shortcuts">${rest.map(k => { const [icon, label] = face(k); return rkey(label, icon, () => send(k)); })}</div>` : nothing}
    </div>`;
  }
  /** What Music Assistant plays next on a player, the one integration that tells it. */
  private loadQueue(id: string) {
    const hass = this.hass, state = this.state(id), key = queueSignature(id, state), now = Date.now();
    if (this.queueKey !== key) { this.queueKey = key; this.queue = undefined; this.queueFetchedAt = 0; this.queueRequest++; this.queueLoading = false; }
    if (!hass || !this.isMusicAssistantPlayer(id) || !mediaOn(state)) { this.queue = undefined; return; }
    if (this.queueLoading || now - this.queueFetchedAt < 15_000) return;
    const request = ++this.queueRequest;
    this.queueLoading = true;
    const domain = this.hass?.entities?.[id]?.platform === 'mass' ? 'mass' : 'music_assistant';
    hass.callWS<{ response?: Record<string, { next_item?: { name?: string; media_item?: { name?: string; artists?: { name?: string }[]; image?: unknown; metadata?: { images?: { path?: string }[] } } } }> }>({ type: 'call_service', domain, service: 'get_queue', target: { entity_id: id }, return_response: true })
      .then(answer => {
        if (request !== this.queueRequest || this.currentPlayer !== id || this.mediaTab !== 'play') return;
        const next = answer.response?.[id]?.next_item;
        const image = next?.media_item?.image, path = typeof image === 'string' ? image : (image as { path?: string } | undefined)?.path ?? next?.media_item?.metadata?.images?.[0]?.path;
        this.queue = next ? { player: id, next: { title: next.media_item?.name ?? next.name ?? '', artist: next.media_item?.artists?.map(a => a.name).filter(Boolean).join(', ') ?? '', image: typeof path === 'string' && /^(https?:|\/)/.test(path) ? path : '' } } : undefined;
        this.queueFetchedAt = Date.now();
      }).catch(() => { if (request === this.queueRequest) { this.queue = undefined; this.queueFetchedAt = 0; this.mediaNotice = tr('La file Music Assistant ne répond pas. Réessayez dans quelques instants.'); } }).finally(() => { if (request === this.queueRequest) this.queueLoading = false; });
  }

  // ——— Climate and covers, opened over the page ———
  private climateIds() { return Object.keys(this.hass?.states ?? {}).filter(id => id.startsWith('climate.') && !this.setAside.has(id) && available(this.state(id))).sort((a, b) => this.name(a).localeCompare(this.name(b), locale())); }
  /** A thermostat as the room uses it: the dial of its setpoint, its modes, its fan and its presets. */
  private climatePanel(id: string) {
    const close = () => { this.sub = undefined; };
    if (!id || !this.state(id)) {
      const ids = this.climateIds();
      return html`${this.head(tr('Climat'), tr('Toute la maison'), nothing, close)}<div class="body">
        ${ids.length ? html`<div class="sg">${ids.map(c => { const s = this.state(c); return html`<button class="rw" @click=${() => { this.sub = { type: 'climate', id: c }; }}><span class="ib">${mpIcon(entityIcon(c, s), 16)}</span><div><b>${this.name(c)}</b><small>${stateLabel(c, s)} · ${stateDetail(c, s)}</small></div><span class="end">${mpIcon('arrow', 16)}</span></button>`; })}</div>` : html`<p class="empty">${tr('Aucun thermostat détecté pour le moment.')}</p>`}
      </div>`;
    }
    const state = this.state(id)!, a = state.attributes, room = this.placedAll.find(p => roomEntityIds(p.room).includes(id));
    const num = (v: unknown) => finite(v), target = num(a.temperature), step = num(a.target_temp_step) ?? .5, min = num(a.min_temp) ?? 7, max = num(a.max_temp) ?? 35;
    const low = num(a.target_temp_low), high = num(a.target_temp_high), current = num(a.current_temperature), humidity = num(a.current_humidity);
    const modes = Array.isArray(a.hvac_modes) ? a.hvac_modes.map(String) : [], fans = Array.isArray(a.fan_modes) ? a.fan_modes.map(String) : [], presets = Array.isArray(a.preset_modes) ? a.preset_modes.map(String) : [];
    const call = (service: string, data: Record<string, unknown>) => this.call('climate', service, { entity_id: id, ...data });
    const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step));
    const action = climateActionMode(state) ?? state.state, tone = HVAC_TONES[action] ?? 'var(--accent)';
    const reading = [stateLabel(id, state), current === undefined || target !== undefined ? '' : tr('mesurée {n} °', { n: this.format(current) }), humidity === undefined ? '' : `${this.format(humidity, 0)} %`].filter(Boolean).join(' · ');
    const pair = (label: string, value: number, set: (v: number) => void) => html`<div class="rh"><b>${label}</b><span class="end" style="display:flex;align-items:center;gap:8px"><button class="ib" aria-label=${tr('Baisser la consigne')} @click=${() => set(clamp(value - step))}>${mpIcon('minus', 16)}</button><b class="serif" style="font-size:22px;min-width:56px;text-align:center">${this.format(value)}°</b><button class="ib" aria-label=${tr('Monter la consigne')} @click=${() => set(clamp(value + step))}>${mpIcon('plus', 16)}</button></span></div>`;
    return html`${this.head(this.name(id, room?.room.name), room?.room.name ?? tr('Climat'), html`<button class="ib" aria-label=${tr('Détails')} title=${tr('Détails')} @click=${() => { this.detail = id; }}>${mpIcon('tune', 16)}</button>`, close)}
      <div class="body">
        ${this.layout === 'phone' && room && this.plan ? this.banner(120, this.viewer({ key: 'clim', focus: room.room.id, quiet: true, layer: 'climate' })) : nothing}
        ${target !== undefined ? html`<div class="dialrow">
          <button class="ib round" aria-label=${tr('Baisser la consigne')} ?disabled=${target <= min} @click=${() => call('set_temperature', { temperature: clamp(target - step) })}>${mpIcon('minus', 20)}</button>
          <mp-glass-dial label=${tr('Consigne')} .min=${min} .max=${max} .step=${step} .value=${target} tone=${tone} reading=${current === undefined ? '' : tr('mesurée {n} °', { n: this.format(current) })}
            @mp-control-change=${(e: Event) => call('set_temperature', { temperature: clamp((e as CustomEvent<{ value: number }>).detail.value) })}></mp-glass-dial>
          <button class="ib round" aria-label=${tr('Monter la consigne')} ?disabled=${target >= max} @click=${() => call('set_temperature', { temperature: clamp(target + step) })}>${mpIcon('plus', 20)}</button>
        </div>` : nothing}
        ${target === undefined && low !== undefined && high !== undefined ? html`<div class="sg" style="padding:6px 12px">${pair(tr('Minimum'), low, v => call('set_temperature', { target_temp_low: Math.min(v, high), target_temp_high: high }))}${pair(tr('Maximum'), high, v => call('set_temperature', { target_temp_low: low, target_temp_high: Math.max(v, low) }))}</div>` : nothing}
        <p class="muted" style="text-align:center;margin:0">${reading}</p>
        ${modes.length ? html`<div class="layers mtabs" role="group" aria-label=${tr('Mode')}>${modes.map(m => html`<button aria-pressed=${m === state.state} @click=${() => call('set_hvac_mode', { hvac_mode: m })}>${mpIcon(m === 'off' ? 'power' : hvacIcon(m), 15)}<span>${stateName(HVAC, m)}</span></button>`)}</div>` : nothing}
        ${fans.length ? html`<div class="rlab">${tr('Vitesse de ventilation')}</div><div class="houses">${fans.map(f => html`<button class="pill" aria-pressed=${f === a.fan_mode} @click=${() => call('set_fan_mode', { fan_mode: f })}>${mpIcon('fan', 13)}${climateName(f)}</button>`)}</div>` : nothing}
        ${presets.length ? html`<div class="rlab">${tr('Préréglage')}</div><div class="houses">${presets.map(p => html`<button class="pill" aria-pressed=${p === a.preset_mode} @click=${() => call('set_preset_mode', { preset_mode: p })}>${mpIcon(p === 'eco' ? 'leaf' : p === 'sleep' ? 'moon' : 'sparkle', 13)}${climateName(p)}</button>`)}</div>` : nothing}
      </div>`;
  }
  /** Every shutter, blind and curtain, room by room: where it stands, a bar to move it, and all of them at once. */
  private coversPanel(roomId: string) {
    const close = () => { this.sub = undefined; };
    const rooms = this.placedAll.filter(p => !roomId || p.room.id === roomId), states = this.hass?.states ?? {}, seen = new Set<string>();
    const groups = rooms.map(p => ({ p, ids: roomEntityIds(p.room).filter(id => id.startsWith('cover.') && states[id] && !seen.has(id) && !!seen.add(id)) })).filter(g => g.ids.length);
    const rest = roomId ? [] : [...new Set(this.entities)].filter(id => id.startsWith('cover.') && states[id] && !seen.has(id));
    const all = [...groups.flatMap(g => g.ids), ...rest], together = all.filter(id => groupCover(states[id]));
    const open = all.filter(id => coverOpen(states[id])).length;
    const row = (id: string, room = '') => {
      const s = states[id], position = coverPosition(s), features = finite(s?.attributes.supported_features) ?? 0, cover = (service: string, data: Record<string, unknown> = {}) => this.call('cover', service, { entity_id: id, ...data });
      return html`<div class="cv">
        <button class="rw" @click=${() => { this.detail = id; }}><span class="ib">${mpIcon(entityIcon(id, s), 16)}</span><div><b>${this.name(id, room)}</b><small>${stateLabel(id, s)}</small></div></button>
        <span class="end">${features & 1 ? html`<button class="ib" aria-label=${tr('Ouvrir')} title=${tr('Ouvrir')} @click=${() => cover('open_cover')}>${mpIcon('up', 16)}</button>` : nothing}${features & 8 ? html`<button class="ib" aria-label=${tr('Arrêter')} title=${tr('Arrêter')} @click=${() => cover('stop_cover')}>${mpIcon('stop', 14)}</button>` : nothing}${features & 2 ? html`<button class="ib" aria-label=${tr('Fermer#cover')} title=${tr('Fermer#cover')} @click=${() => cover('close_cover')}>${mpIcon('down', 16)}</button>` : nothing}</span>
        ${features & 4 && position !== undefined ? html`<mp-glass-bar horizontal icon="shutter" label=${this.name(id, room)} .min=${0} .max=${100} .step=${1} .value=${position} @mp-control-change=${(e: Event) => cover('set_cover_position', { position: Math.round((e as CustomEvent<{ value: number }>).detail.value) })}></mp-glass-bar>` : nothing}
      </div>`;
    };
    const title = roomId ? rooms[0]?.room.name ?? tr('Ouvrants') : tr('Ouvrants');
    return html`${this.head(title, all.length ? tr('{n} ouvert sur {total}|{n} ouverts sur {total}', { n: open, total: all.length }) : tr('Ouvrants'), nothing, close)}
      <div class="body">
        ${together.length > 1 ? html`<div class="acts"><button class="btn" @click=${() => this.call('cover', 'open_cover', { entity_id: together })}>${tr('Tout ouvrir')}</button><button class="btn" @click=${() => this.call('cover', 'set_cover_position', { entity_id: together.filter(id => (finite(states[id]?.attributes.supported_features) ?? 0) & 4), position: 50 })}>${tr('Mi-ombre')}</button><button class="btn" @click=${() => this.call('cover', 'close_cover', { entity_id: together })}>${tr('Tout fermer')}</button></div>` : nothing}
        ${groups.map(g => html`${roomId ? nothing : html`<div class="rh"><b>${g.p.room.name}</b><small>${(this.spatial?.floors.length ?? 0) > 1 ? g.p.floor.name : ''}</small></div>`}<div class="sg">${g.ids.map(id => row(id, g.p.room.name))}</div>`)}
        ${rest.length ? html`<div class="rh"><b>${tr('Hors du plan')}</b></div><div class="sg">${rest.map(id => row(id))}</div>` : nothing}
        ${all.length ? nothing : html`<p class="empty">${tr('Aucun volet ni store détecté pour le moment.')}</p>`}
      </div>`;
  }
  private subPanel() {
    const sub = this.sub!;
    const body = sub.type === 'climate' ? this.climatePanel(sub.id) : sub.type === 'covers' ? this.coversPanel(sub.id) : sub.type === 'routines' ? this.routinesPanel() : sub.type === 'routine' ? this.routinePanel()
      : sub.type === 'energy' ? this.energyPanel() : sub.type === 'outdoor' ? this.outdoorPanel() : sub.type === 'access' ? this.accessPanel() : sub.type === 'history' ? this.historyPanel() : sub.type === 'backup' ? this.backupPanel() : sub.type === 'users' ? this.usersPanel() : sub.type === 'guest' ? this.guestPanel() : sub.type === 'appearance' ? this.appearancePanel() : sub.type === 'customize' ? this.customizePanel() : sub.type === 'educate' ? this.educatePanel() : this.saverPanel();
    return html`<section class=${`${this.layout === 'phone' ? 'main' : 'side'} panel card glass`}>${body}</section>`;
  }

  // ——— Who is home, search and voice, alerts ———
  private setPrefs(change: Partial<NexusPrefs>) {
    this.prefs = { ...this.prefs, ...change };
    writePrefs(this.prefs);
    this.toggleAttribute('comfort', this.prefs.comfort);
  }
  private get persons(): Person[] { return this.prefs.people ? people(this.hass?.states ?? {}) : []; }
  private avatar(person: Person, size: number, index: number) {
    const gradient = AVATAR_TONES[index % AVATAR_TONES.length]!;
    return html`<span class="av" style=${`width:${size}px;height:${size}px;font-size:${Math.round(size * .42)}px;${person.picture ? `background-image:url("${person.picture.replace(/"/g, '%22')}")` : `background:${gradient}`}`}>${person.picture ? nothing : person.name.trim().charAt(0).toLocaleUpperCase(locale())}</span>`;
  }
  /** The faces of those at home, side by side in the header of the home page. */
  private whoStack() {
    const home = this.persons.filter(p => p.home), all = this.persons;
    if (!home.length) return nothing;
    const label = tr('À la maison : {names}', { names: home.map(p => p.name).join(', ') });
    return html`<span class="who stack" role="img" aria-label=${label} title=${label}>${home.slice(0, 4).map(p => this.avatar(p, 28, all.indexOf(p)))}</span>`;
  }
  private whoRow() {
    const all = this.persons;
    if (!all.length) return nothing;
    return html`<div class="rlab">${tr('À la maison')}</div><div class="who row">${all.map((p, i) => html`<button class=${`p ${p.home ? '' : 'away'}`} @click=${() => { this.detail = p.id; }}>${this.avatar(p, 44, i)}<i class="d"></i><small>${p.name.split(/\s+/)[0]}</small></button>`)}</div>`;
  }
  private roomOfEntity = (id: string) => this.placedAll.find(p => roomEntityIds(p.room).includes(id))?.room.name;
  private get alerts(): Alert[] { return houseAlerts(this.hass?.states ?? {}, this.roomOfEntity); }
  private checkAnnouncements() {
    if (this.announceMode === 'off' || !this.hass) { this.announcements.reset(); return; }
    const alerts = this.alerts.filter(a => this.announceMode === 'all' || a.level === 'alarm');
    const ready = document.visibilityState === 'visible' && !this.overlay && !this.announcementSpeech && this.voicePrefs.speak !== 'off' && !(this.prefs.quietNight && inQuietHours());
    const alert = this.announcements.next(alerts, Date.now(), ready);
    if (!alert) return;
    const message = alert.kind === 'battery' ? tr('Batterie faible') : alert.kind === 'heating-open' ? tr('En marche avec une fenêtre ouverte') : alert.kind === 'open' ? tr('Ouvert') : alert.kind === 'unlocked' ? tr('Déverrouillé') : alert.kind === 'update' ? tr('Mise à jour disponible') : tr('Alerte');
    const speech = this.announcementSpeech = speakOnDevice(`${message} : ${this.name(alert.entity)}.`, locale());
    void speech.done.then(() => { if (this.announcementSpeech === speech) this.announcementSpeech = undefined; });
  }
  private headerActions() {
    const count = unseen(this.alerts, this.prefs).length;
    const bell = count ? tr('Alertes : {n} à voir', { n: count }) : tr('Alertes');
    const next = this.timerSnap.timers[0];
    const chip = next ? html`<button class="tchip" aria-label=${tr('Minuteurs et réveils')} title=${tr('Minuteurs et réveils')} @click=${() => { this.overlay = 'timers'; }}>${mpIcon(next.kind === 'alarm' ? 'bell' : 'clock', 15)}<span>${next.kind === 'alarm' && !next.snoozed ? clockLabel(next, locale()) : countdown(this.timerFeed?.left(next) ?? 0)}</span></button>` : nothing;
    return html`${chip}<button class=${`ib orbb ${this.wakeState === 'armed' && !this.wakeGuard.remaining() ? 'armed' : ''}`} aria-label=${tr('Parler à Nexus')} title=${this.wakeGuard.remaining() ? tr('Mot d’éveil en pause après plusieurs réveils sans demande. Il reprend dans une minute.') : this.wakeState === 'armed' ? tr('À l’écoute de « {word} »', { word: this.wakeName() }) : tr('Parler à Nexus')} @click=${() => this.openVoice()}><i class="orb"></i></button>
      <button class="ib" aria-label=${tr('Rechercher')} title=${tr('Rechercher')} @click=${() => this.openOverlay('search')}>${mpIcon('search', 17)}</button>
      <button class="ib bell" aria-label=${bell} title=${bell} @click=${() => this.openOverlay('alerts')}>${mpIcon('bell', 17)}${count ? html`<span class="bdg">${count > 9 ? '9+' : count}</span>` : nothing}</button>`;
  }
  private openOverlay(which: 'search'|'alerts') {
    this.overlay = which; this.query = ''; this.answer = undefined; this.conversationId = undefined;
    if (which === 'search') void this.updateComplete.then(() => (this.renderRoot.querySelector('.srch input') as HTMLInputElement | null)?.focus());
  }
  private closeOverlay = () => {
    if (this.overlay === 'voice' && this.wakeAttempt && this.handsFreeTurns === 0 && !this.voiceHeard && !this.answer) {
      const wait = this.wakeGuard.unanswered();
      if (wait) { clearTimeout(this.wakeCooldownTimer); this.wakeCooldownTimer = window.setTimeout(() => { this.wakeCooldownTimer = undefined; this.requestUpdate(); }, wait); }
    }
    this.wakeAttempt = false;
    // Closed while Nexus still waited for the request it was woken for: a false wake, which the word learns.
    if (this.overlay === 'voice' && this.handsFree && this.handsFreeTurns === 0 && this.voiceState === 'listening' && !this.voiceHeard) this.teachWake('cancelled');
    if (this.overlay === 'enroll') { this.enrollStop.stop?.(); this.enroll = undefined; }
    if (this.overlay === 'ring' && this.hass) void stopRing(this.hass).catch(() => undefined);
    this.wakeLesson = undefined;
    this.overlay = ''; this.invitation = undefined; this.stopListening(); this.endVoice();
  };
  /** The rooms, devices and actions whose name holds what was typed, then Assist for anything else. */
  private searchPanel() {
    const q = fold(this.query.trim()), states = this.hass?.states ?? {};
    const rooms = q ? this.placedAll.filter(p => fold(p.room.name).includes(q)).slice(0, 4) : [];
    const devices = q ? Object.values(states).filter(s => available(s) && !this.setAside.has(s.entity_id) && ['light', 'switch', 'cover', 'climate', 'media_player', 'fan', 'lock', 'scene', 'script', 'sensor', 'binary_sensor', 'input_boolean', 'vacuum'].includes(domainOf(s.entity_id))
      && fold(String(s.attributes.friendly_name ?? s.entity_id)).includes(q)).sort((a, b) => Number(SWITCHED.includes(domainOf(b.entity_id))) - Number(SWITCHED.includes(domainOf(a.entity_id)))).slice(0, 10) : [];
    const offRooms = rooms.filter(p => this.lightsIn(roomEntityIds(p.room)).some(id => this.on(id)));
    const voice = !!speechRecognition(), nexus = !!nexusAgent(this.hass);
    const roomRow = (p: PlacedRoom) => { const lit = this.lightsIn(roomEntityIds(p.room)).filter(id => this.on(id)).length, t = this.temperature(p.room); return html`<button class="rw" @click=${() => { this.closeOverlay(); const path = this.areaPath(p.room.areaId); if (path) this.go(path); else this.room = p.room.id; }}><span class="ib">${mpIcon(roomIcon(p.room.name), 16)}</span><div><b>${p.room.name}</b><small>${[lit ? tr('{n} lumière|{n} lumières', { n: lit }) : '', t ? `${this.format(t.value)}°` : '', p.floor.name].filter(Boolean).join(' · ')}</small></div><span class="end">${mpIcon('arrow', 16)}</span></button>`; };
    const deviceRow = (s: HAState) => { const id = s.entity_id, switched = SWITCHED.includes(domainOf(id)), run = !!RUN_SERVICES[domainOf(id)]; return html`<div class="rw"><span class="ib">${mpIcon(entityIcon(id, s), 16)}</span><button class="txt" @click=${() => { this.detail = id; }}><b>${this.name(id)}</b><small>${[stateLabel(id, s), this.roomOfEntity(id) ?? ''].filter(Boolean).join(' · ')}</small></button>
      <span class="end">${switched ? html`<button role="switch" aria-checked=${this.on(id)} aria-label=${this.name(id)} @click=${() => this.act(id)}><span class=${`tgl ${this.on(id) ? '' : 'off'}`}></span></button>` : run ? html`<button class="pill" @click=${() => this.act(id)}>${mpIcon('play', 13)}${tr('Lancer')}</button>` : mpIcon('arrow', 16)}</span></div>`; };
    return html`<div class="hd srch">
        <label class="inp">${mpIcon('search', 17)}<input type="search" .value=${this.query} placeholder=${tr('Une pièce, un appareil, une question…')} aria-label=${tr('Rechercher')} @input=${(e: Event) => { this.query = (e.target as HTMLInputElement).value; this.answer = undefined; }} @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter' && this.query.trim()) void this.ask(this.query.trim()); }}></label>
        <button class=${`ib micb ${this.listening ? 'on' : ''}`} aria-label=${nexus ? tr('Parler à Nexus') : tr('Parler à Assist')} title=${voice || canRecord() ? (nexus ? tr('Parler à Nexus') : tr('Parler à Assist')) : tr('La dictée n’est pas disponible dans ce navigateur.')} ?disabled=${!voice && !canRecord()} @click=${() => canRecord() ? this.openVoice() : this.listening ? this.stopListening() : this.listen()}>${mpIcon('mic', 18)}</button>
        <button class="ib" aria-label=${tr('Fermer')} title=${tr('Fermer')} @click=${this.closeOverlay}>${mpIcon('close', 16)}</button>
      </div>
      <div class="body">
        ${this.listening ? html`<div class="voice"><div class="mic">${mpIcon('mic', 30)}</div><div class="muted">${tr('J’écoute…')}</div><div class="serif">${this.query}</div></div>` : nothing}
        ${this.answer ? html`<div class="live glass answer"><span class="ib">${mpIcon('sparkle', 16)}</span><div><small>${nexus ? 'Nexus' : tr('Assist · Home Assistant')}</small><b>${this.answer.text}</b>${this.answer.touched?.length ? html`<div class="houses touched">${this.answer.touched.slice(0, 8).map(id => html`<button class="pill" @click=${() => { this.detail = id; }}>${mpIcon(entityIcon(id, states[id]), 13)}${[this.name(id), this.roomOfEntity(id)].filter(Boolean).join(' · ')}</button>`)}</div>` : nothing}</div></div>` : nothing}
        ${rooms.length ? html`<div class="rlab">${tr('Pièces')}</div><div class="sg">${rooms.map(roomRow)}</div>` : nothing}
        ${devices.length ? html`<div class="rlab">${tr('Appareils')}</div><div class="sg">${devices.map(deviceRow)}</div>` : nothing}
        ${offRooms.length ? html`<div class="rlab">${tr('Actions')}</div><div class="sg">${offRooms.map(p => html`<button class="rw" @click=${() => this.allOff(roomEntityIds(p.room))}><span class="ib">${mpIcon('power', 16)}</span><div><b>${tr('Éteindre : {room}', { room: p.room.name })}</b><small>${tr('Toutes les lumières de la pièce')}</small></div></button>`)}</div>` : nothing}
        ${q ? html`<button class="rw ask" @click=${() => void this.ask(this.query.trim())}><span class="ib">${mpIcon('sparkle', 16)}</span><div><b>${nexus ? tr('Demander à Nexus : « {text} »', { text: this.query.trim() }) : tr('Demander à Assist : « {text} »', { text: this.query.trim() })}</b><small>${tr('Entrée pour envoyer')}</small></div></button>`
          : html`<p class="muted" style="margin:0">${nexus ? tr('Cherchez une pièce ou un appareil, ou parlez à Nexus :') : tr('Cherchez une pièce ou un appareil, ou parlez à Assist :')}</p><div class="houses">${[tr('Éteins tout au salon'), tr('Quelle température fait-il ?'), tr('Mets de la musique dans la cuisine')].map(text => html`<button class="pill" @click=${() => { this.query = text; void this.ask(text); }}>« ${text} »</button>`)}</div>`}
      </div>`;
  }
  private async ask(text: string, voice = false) {
    const hass = this.hass;
    if (!hass) return;
    if (voice && language() === 'fr' && this.pendingVoiceRoutine) {
      const pending = this.pendingVoiceRoutine;
      this.pendingVoiceRoutine = undefined;
      const result = confirmation(text);
      if (result === 'yes') {
        if (Date.now() > pending.expires) { this.answer = { text: 'La proposition a expiré. Redemandez-moi de créer la routine.' }; return; }
        if (this.mediaReadOnlyGuest) { this.answer = { text: 'Cet accès invité est en lecture seule.' }; return; }
        if (!hass.user?.is_admin || !hass.fetchWithAuth) { this.answer = { text: 'Un compte administrateur est nécessaire pour enregistrer cette routine.' }; return; }
        try {
          const response = await hass.fetchWithAuth(`/api/config/automation/config/${automationId()}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(voiceRoutineAutomation(pending.routine)) });
          this.answer = { text: response.ok ? `La routine « ${pending.routine.phrase} » est enregistrée dans Home Assistant.` : 'Home Assistant a refusé la routine ; elle n’a pas été enregistrée.' };
        } catch { this.answer = { text: 'Je n’ai pas pu joindre Home Assistant. Vérifiez les routines avant de réessayer.' }; }
        return;
      }
      if (result === 'no') { this.answer = { text: 'D’accord, la routine est annulée.' }; return; }
      this.answer = { text: 'La proposition est annulée. Redemandez-moi de créer la routine si vous le souhaitez.' };
      return;
    }
    if (voice && language() === 'fr' && isVoiceRoutineRequest(text)) {
      if (this.mediaReadOnlyGuest) { this.answer = { text: 'Cet accès invité est en lecture seule.' }; return; }
      if (!hass.user?.is_admin) { this.answer = { text: 'Un compte administrateur est nécessaire pour créer une routine.' }; return; }
      const placed = this.placedAll;
      const scope = (name: string, ids: string[]): VoiceScope => ({ name, lights: ids.filter(id => id.startsWith('light.') && !!hass.states[id] && !this.setAside.has(id)), covers: ids.filter(id => id.startsWith('cover.') && !!hass.states[id] && !this.setAside.has(id)) });
      const scopes: VoiceScope[] = placed.map(p => scope(p.room.name, roomEntityIds(p.room)));
      const floors = new Map<string, { name: string; ids: string[] }>();
      for (const p of placed) { const floor = floors.get(p.floor.id) ?? { name: p.floor.name, ids: [] }; floor.ids.push(...roomEntityIds(p.room)); floors.set(p.floor.id, floor); }
      for (const floor of floors.values()) scopes.push(scope(floor.name, floor.ids));
      const routine = parseVoiceRoutine(text, scopes);
      if (!routine) { this.answer = { text: 'Je ne peux pas préparer cette routine sans ambiguïté. Dites par exemple : quand je dis bonne nuit, éteins les lumières du salon. Chaque action doit préciser sa pièce.' }; return; }
      this.pendingVoiceRoutine = { routine, expires: Date.now() + 60_000 };
      this.handsFree = true;
      this.answer = { text: `Je propose : quand vous dites « ${routine.phrase} », ${routine.summary}. Confirmez-vous l’enregistrement ? Dites oui pour confirmer ou non pour annuler.` };
      return;
    }
    if (language() === 'fr' && wantsHouseSummary(text)) {
      const report = houseSummary(hass.states, this.alerts);
      const descriptions: Record<Alert['kind'], string> = { alarm: 'alarme détectée', open: 'ouvert', unlocked: 'serrure non verrouillée', battery: 'batterie faible', 'heating-open': 'chauffage ou climatisation en marche avec une ouverture', update: 'mise à jour disponible' };
      const details = report.alerts.slice(0, 4).map(a => `${this.name(a.entity)} : ${descriptions[a.kind]}${a.room ? `, ${a.room}` : ''}`);
      const messages = [report.lights ? `${report.lights} lumière${report.lights > 1 ? 's sont allumées' : ' est allumée'}.` : 'Aucune lumière allumée signalée.'];
      if (details.length) messages.push(`Points à vérifier : ${details.join(' ; ')}${report.alerts.length > details.length ? ` ; et ${report.alerts.length - details.length} autre(s)` : ''}.`);
      else messages.push('Aucune alerte détectée par les capteurs disponibles.');
      if (report.unavailable) messages.push(`${report.unavailable} entité${report.unavailable > 1 ? 's sont indisponibles ou sans état' : ' est indisponible ou sans état'}.`);
      this.answer = { text: messages.join(' ') };
      return;
    }
    const roomRequest = language() === 'fr' && this.spatial?.enabled ? roomOverviewRequest(text, this.placedAll) : undefined;
    if (roomRequest && (roomRequest.matches.length || /ce qui se passe|la situation|la pi[eè]ce|le plan/i.test(text))) {
      if (roomRequest.matches.length !== 1) {
        this.answer = { text: roomRequest.matches.length ? 'Plusieurs pièces portent ce nom. Choisissez la pièce sur le plan pour éviter toute confusion.' : 'Je ne trouve pas cette pièce sur le plan.' };
        return;
      }
      const placed = roomRequest.matches[0]!;
      const house = planBuildings(this.spatial!).find(h => h.floors.some(f => f.id === placed.floor.id));
      if (!house || house.floors.flatMap(f => f.rooms).filter(r => r.id === placed.room.id).length !== 1) {
        this.answer = { text: 'Je ne peux pas repérer cette pièce sans ambiguïté sur le plan. Sélectionnez-la directement.' };
        return;
      }
      this.stopReplay();
      if (house) this.chooseHouse(house.building.id);
      this.room = placed.room.id;
      this.full = true;
      if (this.saving) this.wake();
      const report = roomOverview(placed.room, hass.states, hass.config?.unit_system?.temperature ?? '°C');
      const details: string[] = [];
      if (report.temperature) details.push(`température ${this.format(report.temperature.value)} ${report.temperature.unit}`);
      if (report.lights) details.push(`${report.lights} lumière${report.lights > 1 ? 's allumées' : ' allumée'}`);
      if (report.open) details.push(`${report.open} ouverture${report.open > 1 ? 's signalées ouvertes' : ' signalée ouverte'}`);
      for (const climate of report.climate.slice(0, 2)) {
        const action = climate.action === 'heating' ? 'chauffe' : climate.action === 'cooling' ? 'refroidit' : climate.action === 'idle' ? 'en attente' : undefined;
        details.push(`${this.name(climate.id)} : ${action ?? stateLabel(climate.id, hass.states[climate.id])}`);
      }
      if (report.unavailable) details.push(`${report.unavailable} équipement${report.unavailable > 1 ? 's indisponibles' : ' indisponible'}`);
      this.answer = { text: details.length ? `${placed.room.name} : ${details.join(' ; ')}.` : `${placed.room.name} est affiché sur le plan. Aucun état utile n’est disponible pour le moment.` };
      return;
    }
    const diagnosis = language() === 'fr' ? diagnosticTarget(text, hass.states) : undefined;
    if (diagnosis) {
      const unavailable = diagnosis.state === 'unavailable' || diagnosis.state === 'unknown';
      this.answer = { text: unavailable
        ? `${this.name(diagnosis.entity_id)} est signalé sans état disponible par Home Assistant. Je ne peux pas déterminer la cause ; vérifiez son alimentation et sa connexion.`
        : `Home Assistant indique pour ${this.name(diagnosis.entity_id)} : ${stateLabel(diagnosis.entity_id, diagnosis)}. Cet état seul ne permet pas de déterminer la cause du problème.` };
      return;
    }
    const voicePlayers = voice && language() === 'fr' ? this.players.map(id => hass.states[id]).filter((state): state is HAState => !!state) : [];
    const transfer = voicePlayers.length ? voiceTransfer(text, voicePlayers, this.roomOfEntity, id => this.isMusicAssistantPlayer(id)) : undefined;
    if (transfer) {
      if (this.mediaReadOnlyGuest) { this.answer = { text: 'Cet accès invité est en lecture seule.' }; return; }
      if (typeof transfer === 'string') { this.answer = { text: transfer === 'ambiguous' ? 'Plusieurs lecteurs correspondent. Précisez le lecteur ou la pièce.' : 'Je ne trouve pas de source et de destination Music Assistant disponibles.' }; return; }
      try { await hass.callService('music_assistant', 'transfer_queue', { entity_id: transfer.target, source_player: transfer.source, auto_play: true }); this.answer = { text: `Lecture transférée vers ${this.name(transfer.target)}.`, touched: [transfer.target] }; }
      catch { this.answer = { text: 'Le transfert a échoué. Vérifiez Music Assistant et les lecteurs.' }; }
      return;
    }
    const mediaCommand = voicePlayers.length ? voiceMedia(text, voicePlayers) : undefined;
    if (mediaCommand) {
      if (this.mediaReadOnlyGuest) { this.answer = { text: 'Cet accès invité est en lecture seule.' }; return; }
      if (mediaCommand.kind !== 'action') { this.answer = { text: mediaCommand.kind === 'ambiguous' ? 'Plusieurs lecteurs sont actifs. Précisez le lecteur ou la pièce.' : 'Aucun lecteur disponible ne permet cette commande.' }; return; }
      const { service, entity_id, volume_level, message } = mediaCommand.action;
      try { await hass.callService('media_player', service, { entity_id, ...(volume_level !== undefined ? { volume_level } : {}) }); this.answer = { text: message, touched: [entity_id] }; }
      catch { this.answer = { text: 'La commande multimédia a échoué. Vérifiez le lecteur et les autorisations.' }; }
      return;
    }
    this.answer = { text: tr('Je réfléchis…') };
    const householdAnswer = await householdRequest(hass, text, language(), this.mediaReadOnlyGuest);
    if (householdAnswer !== undefined) { this.answer = { text: householdAnswer }; return; }
    try {
      const query = voice ? withScreenArea(text, language(), this.prefs.screenArea, this.areas) : text;
      const reply = await askAssist(hass, query, language(), this.conversationId);
      this.conversationId = reply.conversationId;
      this.answer = { text: reply.text || (reply.failed ? tr('Je n’ai pas compris.') : tr('C’est fait.')), touched: reply.touched };
    } catch (error) {
      // Home Assistant says why it refused: showing it beats a message that sends the household looking in the wrong place.
      const said = (error as { message?: string } | undefined)?.message?.trim();
      this.answer = { text: said || (nexusAgent(hass) ? tr('Nexus ne répond pas. Vérifiez l’intégration MP Nexus dans Home Assistant.') : tr('Assist ne répond pas. Vérifiez qu’il est activé dans Home Assistant.')) };
    }
  }
  private recognition?: { stop(): void };
  private listen() {
    const Recognition = speechRecognition();
    if (!Recognition) return;
    const recognition = new Recognition();
    recognition.lang = locale(); recognition.interimResults = true;
    recognition.onresult = (event: SpeechEvent) => {
      const result = event.results[event.results.length - 1];
      this.query = Array.from(event.results).map(r => r[0]?.transcript ?? '').join(' ');
      if (result?.isFinal) { this.stopListening(); void this.ask(this.query.trim()); }
    };
    recognition.onend = () => { this.listening = false; };
    recognition.onerror = () => { this.listening = false; };
    this.recognition = recognition; this.listening = true; this.answer = undefined;
    recognition.start();
  }
  private stopListening() { this.recognition?.stop(); this.recognition = undefined; this.listening = false; }
  /** The alerts of the house, the most serious first, with a silent night that lets only alarms through. */
  private alertsPanel() {
    const alerts = this.alerts, states = this.hass?.states ?? {}, fresh = new Set(unseen(alerts, this.prefs).map(a => a.key));
    const groups: [AlertLevel, 'Alarmes'|'Sécurité'|'Maison'|'Infos'][] = [['alarm', 'Alarmes'], ['security', 'Sécurité'], ['house', 'Maison'], ['info', 'Infos']];
    const row = (a: Alert) => {
      const s = states[a.entity], name = this.name(a.entity), when = since(s);
      const detail = a.kind === 'battery' ? tr('Batterie faible · {n} %', { n: this.format(a.value ?? 0, 0) }) : a.kind === 'heating-open' ? tr('En marche avec une fenêtre ouverte') : a.kind === 'update' ? tr('Mise à jour disponible') : stateLabel(a.entity, s);
      const icon: MPIconName = a.kind === 'alarm' ? 'alarm' : a.kind === 'open' ? 'window' : a.kind === 'unlocked' ? 'lock' : a.kind === 'battery' ? 'battery' : a.kind === 'heating-open' ? 'thermo' : 'download';
      return html`<div class=${`al ${a.level} ${fresh.has(a.key) ? 'new' : ''}`}><span class="ib">${mpIcon(icon, 16)}</span><div><b>${name}</b><small>${[detail, a.room ?? '', a.kind === 'battery' ? '' : when ?? ''].filter(Boolean).join(' · ')}</small></div>
        ${a.kind === 'heating-open' ? html`<button class="pill" @click=${() => this.call('climate', 'set_hvac_mode', { entity_id: a.entity, hvac_mode: 'off' })}>${tr('Couper')}</button>` : a.kind === 'update' && this.hass?.user?.is_admin ? html`<a class="pill" href="/config/updates">${tr('Voir')}</a>` : html`<button class="pill" @click=${() => { this.detail = a.entity; }}>${tr('Voir')}</button>`}</div>`;
    };
    return html`${this.head(tr('Alertes'), alerts.length ? tr('{n} à voir|{n} à voir', { n: fresh.size }) : tr('Tout va bien'), html`<button class="ib" aria-label=${tr('Fermer')} title=${tr('Fermer')} @click=${this.closeOverlay}>${mpIcon('close', 16)}</button>`)}
      <div class="body">
        ${alerts.length ? groups.map(([level, label]) => { const list = alerts.filter(a => a.level === level); return list.length ? html`<div class="rlab">${tr(label)}</div>${list.map(row)}` : nothing; }) : html`<p class="empty">${tr('Aucune alerte : tout est en ordre à la maison.')}</p>`}
        <div class="live glass"><span class="ib" style="color:#c9b8ff">${mpIcon('moon', 16)}</span><div><b>${tr('Nuit silencieuse')}</b><small>${tr('{from} – {to} · seules les alarmes comptent', { from: `${QUIET_FROM}:00`, to: `${QUIET_TO}:00` })}</small></div>
          <button class="end" role="switch" aria-checked=${this.prefs.quietNight} aria-label=${tr('Nuit silencieuse')} @click=${() => this.setPrefs({ quietNight: !this.prefs.quietNight })}><span class=${`tgl ${this.prefs.quietNight ? '' : 'off'}`}></span></button></div>
        ${fresh.size ? html`<button class="btn" @click=${() => this.setPrefs({ seen: [...new Set([...this.prefs.seen, ...alerts.map(a => a.key)])] })}>${mpIcon('check', 16)}${tr('Tout marquer comme lu')}</button>` : nothing}
      </div>`;
  }
  // ——— Timers and alarms: counted by Home Assistant, rung on every open screen ———
  private keepTimers() {
    const hass = this.hass;
    if (!hass) return;
    if (this.timerFeedFor !== hass.connection) {
      this.stopTimers();
      this.timerFeedFor = hass.connection;
      const feed = this.timerFeed = new TimerFeed(hass, snapshot => { this.timerSnap = snapshot; this.syncRing(); });
      void feed.start();
    }
    const counting = this.timerSnap.timers.length > 0;
    if (counting && !this.timerTicker) this.timerTicker = window.setInterval(() => { this.timerTick++; }, 1000);
    else if (!counting && this.timerTicker) { clearInterval(this.timerTicker); this.timerTicker = undefined; }
    if (this.overlay === 'timers' && !counting) this.overlay = '';
  }
  private stopTimers() {
    this.timerFeed?.stop(); this.timerFeed = undefined; this.timerFeedFor = undefined;
    clearInterval(this.timerTicker); this.timerTicker = undefined;
    this.ringing?.sound.stop(); this.ringing = undefined;
  }
  /** Rings while something rings, on whatever page is open; stops when it was stopped on any screen. */
  private syncRing() {
    const rings = this.timerSnap.ringing, key = rings.map(r => r.id).join(',');
    if (!rings.length) {
      this.ringing?.sound.stop(); this.ringing = undefined;
      if (this.overlay === 'ring') this.overlay = '';
      return;
    }
    if (this.ringing?.key !== key) {
      this.ringing?.sound.stop();
      this.ringing = { key, sound: ringSound(rings.some(r => r.kind === 'alarm') ? 'alarm' : 'timer') };
    }
    if (this.overlay !== 'ring' && this.overlay !== 'enroll') {
      if (this.overlay === 'voice') this.endVoice();
      this.overlay = 'ring';
    }
  }
  private ringPanel() {
    const hass = this.hass, rings = this.timerSnap.ringing;
    const ring: Ring | undefined = rings.find(r => r.kind === 'alarm') ?? rings[0];
    if (!ring || !hass) return nothing;
    const alarm = ring.kind === 'alarm';
    return html`<div class="hd"><b class="vtitle">${alarm ? tr('Réveil') : tr('Minuteur')}</b></div>
      <div class="body nexus-voice ringp">
        <div class="ringbell">${mpIcon(alarm ? 'bell' : 'clock', 40)}</div>
        <div class="said serif">${ring.label || (alarm ? tr('C’est l’heure !') : tr('Minuteur terminé'))}</div>
        ${rings.length > 1 ? html`<p class="muted small">${tr('{n} sonneries en cours', { n: rings.length })}</p>` : nothing}
        <button class="btn primary" @click=${() => { void stopRing(hass).catch(() => undefined); }}>${tr('Arrêter')}</button>
        <button class="btn" @click=${() => { for (const r of rings) void snoozeRing(hass, r, alarm ? 9 * 60 : 60).catch(() => undefined); }}>${alarm ? tr('Reporter de 9 min') : tr('+ 1 min')}</button>
      </div>`;
  }
  private timersPanel() {
    const hass = this.hass, items = this.timerSnap.timers;
    const days = (item: TimerItem) => !item.days?.length ? '' : item.days.length === 7 ? tr('tous les jours') : item.days.length === 5 && item.days.every(d => d < 5) ? tr('en semaine')
      : item.days.map(d => new Date(2024, 0, 1 + d).toLocaleDateString(locale(), { weekday: 'short' })).join(', ');
    const row = (item: TimerItem) => {
      const alarm = item.kind === 'alarm' && !item.snoozed;
      const title = item.label || (alarm ? tr('Réveil') : tr('Minuteur'));
      const sub = alarm ? [clockLabel(item, locale()), days(item)].filter(Boolean).join(' · ') : `${tr('Il reste {time}', { time: countdown(this.timerFeed?.left(item) ?? 0) })}${item.snoozed ? ` · ${tr('Reporté')}` : ''}`;
      return html`<div class="al"><span class="ib">${mpIcon(item.kind === 'alarm' ? 'bell' : 'clock', 16)}</span><div><b>${title}</b><small>${sub}</small></div>
        <button class="pill" @click=${() => { if (hass) void cancelTimer(hass, item).catch(() => undefined); }}>${tr('Annuler')}</button></div>`;
    };
    return html`${this.head(tr('Minuteurs et réveils'), '', html`<button class="ib" aria-label=${tr('Fermer')} title=${tr('Fermer')} @click=${this.closeOverlay}>${mpIcon('close', 16)}</button>`)}
      <div class="body">${items.length ? items.map(row) : html`<p class="empty">${tr('Aucun minuteur ni réveil. Dites : « Nexus, mets un minuteur de 10 minutes ».')}</p>`}</div>`;
  }
  private overlayPanel() {
    return html`<div class="scrim" @click=${this.closeOverlay}></div><section class=${`modal panel glass ${this.overlay}`} role="dialog" aria-modal="true" aria-label=${this.overlay === 'search' ? tr('Rechercher') : this.overlay === 'invite' ? tr('Invitation') : this.overlay === 'voice' ? 'Nexus' : this.overlay === 'enroll' ? tr('Créer un mot d’éveil') : this.overlay === 'timers' ? tr('Minuteurs et réveils') : this.overlay === 'ring' ? tr('Minuteur') : tr('Alertes')}>${this.overlay === 'search' ? this.searchPanel() : this.overlay === 'invite' ? this.invitePanel() : this.overlay === 'voice' ? this.voicePanel() : this.overlay === 'enroll' ? this.enrollPanel() : this.overlay === 'timers' ? this.timersPanel() : this.overlay === 'ring' ? this.ringPanel() : this.alertsPanel()}</section>`;
  }

  // ——— Éduquer Nexus: guided lessons, and what the home taught it ———
  private async refreshFacts() {
    if (this.hass) { try { this.facts = await loadFacts(this.hass); } catch { /* An older integration has no lessons. */ } }
    this.requestUpdate();
  }
  /** A lesson is a conversation Nexus leads: it asks, the person answers aloud, and each useful answer becomes a fact. */
  private startLesson(id: string) {
    const hass = this.hass;
    if (!hass) return;
    unlockAudio();
    this.handsFree = true; this.handsFreeTurns = 0; this.lesson = id;
    this.overlay = 'voice'; this.query = ''; this.answer = undefined; this.conversationId = undefined; this.voiceHeard = '';
    const turn = ++this.voiceTurn;
    this.voiceState = 'thinking';
    void (async () => {
      await this.ask(lessonMarker(id));
      const reply = this.answer as { text: string } | undefined;
      if (turn !== this.voiceTurn || !reply) { if (turn === this.voiceTurn) this.voiceState = 'idle'; return; }
      await this.say(reply.text, turn);
      void this.refreshFacts();
    })();
  }
  private async teach() {
    const hass = this.hass, text = this.factText.trim();
    if (!hass || !text) return;
    try { this.facts = await addFact(hass, text); this.factText = ''; this.factNote = ''; }
    catch { this.factNote = tr('Nexus ne garde pas les mots de passe ni les codes.'); }
    this.requestUpdate();
  }
  private educatePanel() {
    const hass = this.hass, listing = this.facts;
    const names: Record<string, string> = { maison: tr('Maison'), pieces: tr('Pièces'), appareils: tr('Appareils'), habitudes: tr('Habitudes'), ambiances: tr('Ambiances'), style: tr('Style'), autre: tr('Autre') };
    return html`${this.head(tr('Éduquer Nexus'), tr('Nexus apprend ce que vous lui dites'), nothing, this.back)}
      <div class="body">
        <p class="note info">${tr('Chaque réponse utile devient un fait retenu pour la maison. Une leçon utilise quelques requêtes IA.')}</p>
        <div class="rlab">${tr('Leçons')}</div>
        <div class="sg">${(listing?.lessons ?? []).map(l => { const known = listing?.progress[l.id] ?? 0; return html`<button class="rw" @click=${() => this.startLesson(l.id)}><span class="ib">${mpIcon('mic', 16)}</span><div><b>${tr(l.title as Parameters<typeof tr>[0])}</b><small>${tr(l.blurb as Parameters<typeof tr>[0])}${known ? ` · ${tr('{n} fait|{n} faits', { n: known })}` : ''}</small></div><span class="end">${mpIcon('arrow', 16)}</span></button>`; })}</div>
        <div class="rlab">${tr('Ajouter un fait')}</div>
        <form class="sg" style="display:flex;gap:8px" @submit=${(e: Event) => { e.preventDefault(); void this.teach(); }}>
          <input style="flex:1" maxlength="200" .value=${this.factText} placeholder=${tr('Ex. : le salon, c’est la pièce Living')} @input=${(e: Event) => { this.factText = (e.target as HTMLInputElement).value; }}>
          <button class="btn primary" type="submit" ?disabled=${!hass}>${tr('Retenir')}</button>
        </form>
        ${this.factNote ? html`<p class="note warn">${this.factNote}</p>` : nothing}
        <div class="rlab">${tr('Ce que Nexus sait')}</div>
        ${listing?.facts.length ? TOPICS.map(topic => { const facts = factsOf(listing, topic); return facts.length ? html`<div class="rh"><b>${names[topic]}</b><small>${facts.length}</small></div><div class="sg">${facts.map(f => html`<div class="al"><div><b>${f.text}</b></div><button class="pill" @click=${() => { if (hass) void removeFact(hass, f).then(l => { this.facts = l; this.requestUpdate(); }).catch(() => undefined); }}>${tr('Oublier')}</button></div>`)}</div>` : nothing; })
          : html`<p class="empty">${tr('Nexus ne sait encore rien de votre maison. Lancez une leçon : il vous posera quelques questions.')}</p>`}
      </div>`;
  }

  // ——— The voice of Nexus: touch the orb, speak, hear the answer ———
  private openVoice(handsFree = false) {
    if (!handsFree) unlockAudio();
    this.handsFree = handsFree; this.handsFreeTurns = 0; this.lesson = '';
    this.overlay = 'voice'; this.query = ''; this.answer = undefined; this.conversationId = undefined; this.voiceHeard = '';
    void this.talk();
  }
  /** Listens to one request, sends it, then speaks the answer. Touching the orb while Nexus speaks cuts it short and listens again. */
  private async talk() {
    this.announcementSpeech?.stop(); this.announcementSpeech = undefined;
    clearTimeout(this.voiceCloseTimer); this.voiceCloseTimer = undefined;
    const hass = this.hass;
    if (!hass) return;
    // Do not treat the wait for transcription availability as an idle, finished conversation.
    if (this.voiceState !== 'listening') this.voiceState = 'thinking';
    this.speech?.stop(); this.speech = undefined;
    this.recorder?.cancel(); this.stopListening();
    audioSession('auto');
    const turn = ++this.voiceTurn;
    this.answer = undefined; this.voiceHeard = '';
    this.transcription ??= await canTranscribe(hass);
    if (turn !== this.voiceTurn) return;
    let text = '';
    if (this.transcription && canRecord()) {
      const recorder = this.recorder = new Recorder(level => { this.voiceLevel = level; }, this.handsFree && this.handsFreeTurns > 0 ? (this.voicePrefs.followWait ?? 7) * 1000 : undefined);
      this.voiceState = 'listening';
      // One recording at a time: phones silence the first when a second one starts.
      if (this.wakeListener) { this.wakeListener.paused = true; await this.wakeListener.mic(false); }
      if (turn !== this.voiceTurn) return;
      if (this.handsFree && this.handsFreeTurns > 0) { await this.listenSignal(); if (turn !== this.voiceTurn) return; }
      try { await recorder.start(); }
      catch { if (turn === this.voiceTurn) { this.voiceState = 'idle'; this.answer = { text: tr('Le micro n’est pas accessible. Autorisez-le pour cette page dans le navigateur.') }; this.scheduleVoiceClose(); } return; }
      const audio = await recorder.done;
      if (turn !== this.voiceTurn) return;
      this.recorder = undefined; this.voiceLevel = 0;
      if (!audio) { this.voiceState = 'idle'; if (this.handsFree && this.overlay === 'voice') this.closeOverlay(); else this.scheduleVoiceClose(); return; }
      this.voiceState = 'thinking';
      try { text = await transcribe(hass, audio, locale()); }
      catch (error) { if (turn === this.voiceTurn) { this.voiceState = 'idle'; this.answer = { text: (error as { message?: string })?.message || tr('Je n’ai pas pu entendre la demande.') }; this.scheduleVoiceClose(); } return; }
    } else if (speechRecognition()) {
      if (this.wakeListener) { this.wakeListener.paused = true; await this.wakeListener.mic(false); }
      if (turn !== this.voiceTurn) return;
      text = await new Promise<string>(resolve => {
        const recognition = new (speechRecognition()!)();
        recognition.lang = locale(); recognition.interimResults = true;
        let heard = '';
        recognition.onresult = (event: SpeechEvent) => { heard = Array.from(event.results).map(r => r[0]?.transcript ?? '').join(' '); this.voiceHeard = heard; };
        recognition.onend = () => resolve(heard); recognition.onerror = () => resolve(heard);
        this.recognition = recognition; this.voiceState = 'listening';
        recognition.start();
      });
      this.recognition = undefined;
    } else {
      this.voiceState = 'idle';
      this.answer = { text: tr('Pour parler à Nexus ici, ajoutez une clé IA dans les options de l’intégration MP Nexus, ou écrivez votre demande dans la recherche.') };
      this.scheduleVoiceClose();
      return;
    }
    if (turn !== this.voiceTurn) return;
    text = text.trim();
    if (!text) { this.voiceState = 'idle'; if (this.handsFree && this.overlay === 'voice') this.closeOverlay(); else this.scheduleVoiceClose(); return; }
    if (onlyWakeWord(text, this.wakeName())) {
      // « Nexus » said again while it listened: it listens afresh, after its tone.
      this.handsFree = true; this.handsFreeTurns = Math.max(1, this.handsFreeTurns);
      void this.talk();
      return;
    }
    this.teachWake('confirmed');
    this.wakeAttempt = false; this.wakeGuard.reset(); clearTimeout(this.wakeCooldownTimer); this.wakeCooldownTimer = undefined;
    this.voiceHeard = text; this.voiceState = 'thinking';
    await this.ask(text, true);
    // Read again: `ask` set it meanwhile, which the type checker cannot see.
    const reply = this.answer as { text: string } | undefined;
    if (turn !== this.voiceTurn || !reply) return;
    await this.say(reply.text, turn);
  }
  private applyVoicePrefs(prefs: VoicePrefs) {
    this.voicePrefs = { ...prefs };
    if (!prefs.wake) {
      this.wakeGuard.reset(); clearTimeout(this.wakeCooldownTimer); this.wakeCooldownTimer = undefined;
      this.stopWake();
      if (this.wakeAttempt && this.overlay === 'voice') { this.wakeAttempt = false; this.wakeLesson = undefined; this.closeOverlay(); }
    }
  }
  private voicePrefsChanged = (e: Event) => { const prefs = (e as CustomEvent<VoicePrefs>).detail; if (prefs) this.applyVoicePrefs(prefs); };
  private voicePrefsStored = (e: StorageEvent) => { if (e.key === null || e.key === 'mp-nexus.voice') this.applyVoicePrefs(readVoicePrefs()); };
  private async say(text: string, turn: number) {
    const hass = this.hass, prefs = this.voicePrefs;
    if (!hass || prefs.speak === 'off') { this.voiceState = 'idle'; this.followUp(); return; }
    await this.tabletVolume.beforeReply();
    if (turn !== this.voiceTurn) return;
    this.voiceState = 'speaking';
    // The page lets go of the microphone first: on iPhones, a page that listens speaks quietly, in the earpiece.
    // Elsewhere it keeps hearing the wake word, so that « Nexus » cuts the answer short and listens.
    if (this.wakeListener && !micWhileSpeaking()) { this.wakeListener.paused = true; await this.wakeListener.mic(false); }
    else if (this.wakeListener) { this.wakeListener.paused = false; void this.wakeListener.mic(true); }
    if (turn !== this.voiceTurn) return;
    audioSession('playback');
    try { this.speech = prefs.speak === 'ha' && prefs.engine ? await speakWithHomeAssistant(hass, text, language(), prefs.engine, prefs.voice, prefs.effect) : speakOnDevice(text, locale(), prefs.voice); }
    catch (error) { console.warn('MP Nexus: voice', error); this.speech = speakOnDevice(text, locale(), prefs.speak === 'device' ? prefs.voice : undefined); }
    await this.speech.done;
    audioSession('auto');
    if (turn !== this.voiceTurn) return;
    this.voiceState = 'idle'; this.speech = undefined;
    this.followUp();
  }
  /** Hands free, the conversation goes on: Nexus listens for a follow-up, and closes after a silence or a few requests. */
  private followUp() {
    if (this.overlay !== 'voice') return;
    if (!this.handsFree) { this.scheduleVoiceClose(); return; }
    if (++this.handsFreeTurns < (this.lesson ? LESSON_TURNS : 100)) void this.talk();
    else this.closeOverlay();
  }
  private voiceCloseTimer?: number;
  private scheduleVoiceClose() {
    clearTimeout(this.voiceCloseTimer);
    this.voiceCloseTimer = window.setTimeout(() => {
      this.voiceCloseTimer = undefined;
      if (this.overlay === 'voice' && this.voiceState === 'idle') this.closeOverlay();
    }, 5000);
  }
  private orbTouched() {
    this.handsFree = false;
    if (this.voiceState === 'listening') { if (this.recorder) this.recorder.stop(); else this.recognition?.stop(); }
    else if (this.voiceState !== 'thinking') { unlockAudio(); void this.talk(); }
  }
  private endVoice() {
    this.pendingVoiceRoutine = undefined;
    void this.tabletVolume.set(false);
    clearTimeout(this.voiceCloseTimer); this.voiceCloseTimer = undefined;
    audioSession('auto');
    this.voiceTurn++;
    this.handsFree = false; this.lesson = '';
    this.recorder?.cancel(); this.recorder = undefined;
    this.speech?.stop(); this.speech = undefined;
    this.voiceState = 'idle'; this.voiceLevel = 0;
  }
  private voicePanel() {
    const state = this.voiceState, states = this.hass?.states ?? {};
    const status = state === 'listening' ? tr('J’écoute…') : state === 'thinking' ? tr('Je réfléchis…') : state === 'speaking' ? tr('Touchez l’orbe pour m’interrompre') : tr('Touchez l’orbe pour parler');
    return html`<div class="hd"><b class="vtitle">Nexus</b><button class="ib vclose" aria-label=${tr('Fermer')} title=${tr('Fermer')} @click=${this.closeOverlay}>${mpIcon('close', 16)}</button></div>
      <div class="body nexus-voice">
        <button class=${`vorb ${state}`} style=${`--lvl:${this.voiceLevel.toFixed(2)}`} aria-label=${state === 'listening' ? tr('Envoyer') : tr('Parler à Nexus')} @click=${() => this.orbTouched()}><i></i><i></i><i></i></button>
        <div class="muted" aria-live="polite">${status}</div>
        ${this.wakeLesson && state === 'listening' ? html`<div class="muted small">${tr('Réveillé par erreur ? Fermez : Nexus apprendra.')}</div>` : nothing}
        ${this.voiceHeard ? html`<div class="heard">« ${this.voiceHeard} »</div>` : nothing}
        ${this.answer && state !== 'thinking' ? html`<div class="said serif" aria-live="polite">${this.answer.text}</div>
          ${this.answer.touched?.length ? html`<div class="houses touched">${this.answer.touched.slice(0, 8).map(id => html`<button class="pill" @click=${() => { this.detail = id; }}>${mpIcon(entityIcon(id, states[id]), 13)}${[this.name(id), this.roomOfEntity(id)].filter(Boolean).join(' · ')}</button>`)}</div>` : nothing}` : nothing}
      </div>`;
  }
  /** The choices this screen keeps for itself: who is home, comfort mode, silent night. */
  private screenPrefs() {
    const toggle = (on: boolean, label: string, change: () => void) => html`<button class="end" role="switch" aria-checked=${on} aria-label=${label} @click=${change}><span class=${`tgl ${on ? '' : 'off'}`}></span></button>`;
    const row = (icon: MPIconName, title: string, sub: string, on: boolean, change: () => void) => html`<div class="rw"><span class="ib">${mpIcon(icon, 16)}</span><div><b>${title}</b><small>${sub}</small></div>${toggle(on, title, change)}</div>`;
    const count = unseen(this.alerts, this.prefs).length;
    return html`<div class="sg">
      <button class="rw" @click=${() => this.openOverlay('alerts')}><span class="ib">${mpIcon('bell', 16)}</span><div><b>${tr('Alertes')}</b><small>${count ? tr('{n} à voir|{n} à voir', { n: count }) : tr('Tout va bien')}</small></div><span class="end">${mpIcon('arrow', 16)}</span></button>
      <button class="rw" @click=${() => this.openOverlay('search')}><span class="ib">${mpIcon('search', 16)}</span><div><b>${tr('Rechercher')}</b><small>${tr('Pièces, appareils et Assist à la voix')}</small></div><span class="end">${mpIcon('arrow', 16)}</span></button>
    </div>
    <div class="rlab">${tr('Sur cet écran')}</div>
    <div class="sg">
      ${row('user', tr('Qui est à la maison'), this.prefs.people ? tr('Affiché sur l’accueil') : tr('Masqué'), this.prefs.people, () => this.setPrefs({ people: !this.prefs.people }))}
      ${row('text', tr('Mode confort'), tr('Grand texte, contraste renforcé'), this.prefs.comfort, () => this.setPrefs({ comfort: !this.prefs.comfort }))}
      ${row('moon', tr('Nuit silencieuse'), tr('{from} – {to} · seules les alarmes comptent', { from: `${QUIET_FROM}:00`, to: `${QUIET_TO}:00` }), this.prefs.quietNight, () => this.setPrefs({ quietNight: !this.prefs.quietNight }))}
      <label class="rw"><span class="ib">${mpIcon('bell', 16)}</span><div><b>${tr('Annonces vocales')}</b><small>${tr('Nouvelles alertes persistantes, avec la voix de cet appareil.')}</small></div><select class="end" aria-label=${tr('Annonces vocales')} @change=${(e: Event) => { const mode = (e.target as HTMLSelectElement).value; this.announceMode = mode === 'alarm' || mode === 'all' ? mode : 'off'; this.announcements.reset(); try { localStorage.setItem('mp-nexus.announcements', this.announceMode); } catch { /* This screen keeps it until closed. */ } this.requestUpdate(); }}><option value="off" .selected=${this.announceMode === 'off'}>${tr('Aucune')}</option><option value="alarm" .selected=${this.announceMode === 'alarm'}>${tr('Alarmes')}</option><option value="all" .selected=${this.announceMode === 'all'}>${tr('Toutes les alertes')}</option></select></label>
      <label class="rw"><span class="ib">${mpIcon('home', 16)}</span><div><b>${tr('Pièce de cet écran')}</b><small>${tr('Utilisée pour les commandes vocales de lumière sans pièce précisée.')}</small></div><select class="end" aria-label=${tr('Pièce de cet écran')} @change=${(e: Event) => this.setPrefs({ screenArea: (e.target as HTMLSelectElement).value || undefined })}><option value="" .selected=${!this.prefs.screenArea}>${tr('Aucun')}</option>${this.areas.map(a => html`<option value=${a.id} .selected=${this.prefs.screenArea === a.id}>${a.name}</option>`)}</select></label>
      ${this.voiceChoice()}
      <label class="rw"><span class="ib">${mpIcon('mic', 16)}</span><div><b>${tr('Temps pour continuer la conversation')}</b><small>${tr('Après une réponse, Nexus attend votre prochaine demande puis se ferme en cas de silence.')}</small></div><select class="end" aria-label=${tr('Temps pour continuer la conversation')} @change=${(e: Event) => { this.voicePrefs = { ...this.voicePrefs, followWait: Number((e.target as HTMLSelectElement).value) as 5|7|10|15 }; writeVoicePrefs(this.voicePrefs); }}>${[5, 7, 10, 15].map(n => html`<option value=${n} .selected=${(this.voicePrefs.followWait ?? 7) === n}>${n} s</option>`)}</select></label>
      ${this.tabletVolumeChoice()}
      ${this.wakeChoice()}
    </div>`;
  }

  // ——— The wake word: heard on this screen, nothing leaves it before ———
  /** The list of words; asked again a little later when Home Assistant did not answer (it was restarting after an update). */
  private wakeListRetry?: number;
  private loadWakeList(delay = 5000) {
    const hass = this.hass;
    if (!hass) return;
    this.wakeList = this.wakeList?.length ? this.wakeList : [];
    void wakeWords(hass).then(list => {
      this.wakeList = list;
      if (list.failed && this.isConnected) { clearTimeout(this.wakeListRetry); this.wakeListRetry = window.setTimeout(() => this.loadWakeList(Math.min(delay * 2, 60000)), delay); }
    });
  }
  private wakeName() { return this.wakeList?.find(w => w.id === this.voicePrefs.wake)?.name ?? 'Nexus'; }
  /** Starts, follows or stops listening for the word as the choice, the page and the voice change. */
  private keepWake() {
    const word = this.voicePrefs.wake, wanted = !!word && !!this.hass && canRecord() && document.visibilityState === 'visible' && this.overlay !== 'enroll';
    if (!wanted) { if (this.wakeListener || this.wakeState !== 'off') this.stopWake(); return; }
    if (!this.wakeList) this.loadWakeList();
    const key = `${word}:${this.voicePrefs.wakeSensitivity ?? 'normal'}:${this.voicePrefs.wakeLearn !== false}`;
    if (this.wakeFor !== key) { this.stopWake(); this.wakeFor = key; void this.startWake(word!, ++this.wakeGen); return; }
    if (this.wakeListener) {
      const cooldown = !!this.wakeGuard.remaining();
      const busy = cooldown || (this.overlay === 'voice' && (this.voiceState === 'listening' || this.voiceState === 'thinking' || (this.voiceState === 'speaking' && !micWhileSpeaking()))) || this.overlay === 'ring';
      this.wakeListener.paused = busy;
      if (cooldown) void this.wakeListener.mic(false);
      else if (!busy) void this.wakeListener.mic(true);
    }
  }
  /** Each start of the listening has its number: a start overtaken while it loaded (stopped, then started again) gives up. */
  private wakeGen = 0;
  private async startWake(word: string, gen: number) {
    const hass = this.hass;
    if (!hass) return;
    this.wakeState = 'loading';
    try {
      const model = await wakeModel(hass, word, id => {
        // Removed from another screen, its twin of the same name took its place: this screen follows.
        if (gen !== this.wakeGen || this.voicePrefs.wake !== word || !this.isConnected) return;
        word = id; this.voicePrefs = { ...this.voicePrefs, wake: id }; writeVoicePrefs(this.voicePrefs); this.wakeList = undefined;
        this.wakeFor = `${id}:${this.voicePrefs.wakeSensitivity ?? 'normal'}:${this.voicePrefs.wakeLearn !== false}`;
      }), voice = typeof model === 'object' && !(model instanceof Uint8Array);
      if (gen !== this.wakeGen || !this.isConnected) return;
      const models = await loadWakeModels(model, undefined, this.voicePrefs.wakeSensitivity ?? 'normal');
      if (gen !== this.wakeGen || !this.isConnected) return;
      const listener = this.wakeListener = new WakeListener(models, () => { void this.woke(); });
      // Unlabelled room audio may contain an unsuccessful attempt at the wake word; do not teach it as noise.
      listener.onScore = score => this.showWakeScore(score);
      this.wakeOld = voice && !((model as { version?: number }).version! >= 2);
      this.wakeTries = 0;
      await this.armWake();
    } catch (error) {
      if (gen !== this.wakeGen) return;
      console.warn('MP Nexus: wake word', error);
      if (wakeGone(error)) {
        // The word no longer exists: the screen says so instead of failing at every page.
        this.voicePrefs = { ...this.voicePrefs, wake: undefined }; writeVoicePrefs(this.voicePrefs); this.wakeList = undefined;
        this.wakeState = 'gone';
        return;
      }
      this.wakeState = 'error';
      // Most often Home Assistant was restarting (after an update): the screen tries again by itself.
      const tries = this.wakeTries = (this.wakeTries ?? 0) + 1;
      if (tries <= 6) window.setTimeout(() => {
        if (gen !== this.wakeGen || !this.isConnected || this.wakeState !== 'error' || this.voicePrefs.wake !== word) return;
        if (this.wakeList?.length && !this.wakeList.some(w => w.custom)) this.loadWakeList();
        this.wakeGen++; void this.startWake(word, this.wakeGen);
      }, Math.min(5000 * 2 ** (tries - 1), 60000));
    }
  }
  private wakeTries?: number;
  /** Browsers start the microphone's sound only after a touch on the page: until then, the first touch does it. */
  private armWake = async () => {
    const wake = this.wakeListener;
    if (!wake) return;
    // The same touch lets the page speak the answers later (phones need it).
    unlockAudio();
    try {
      await wake.start();
      if (this.wakeListener !== wake) return;
      if (wake.running) { this.wakeState = 'armed'; removeEventListener('pointerdown', this.armWake); return; }
    } catch (error) {
      if (this.wakeListener !== wake || !this.voicePrefs.wake) return;
      if ((error as { name?: string })?.name === 'NotAllowedError' || (error as { name?: string })?.name === 'NotFoundError') { this.wakeState = 'error'; return; }
    }
    if (this.wakeListener !== wake || !this.voicePrefs.wake) return;
    this.wakeState = 'touch';
    addEventListener('pointerdown', this.armWake, { once: true });
  };
  private stopWake() {
    this.wakeGen++;
    removeEventListener('pointerdown', this.armWake);
    this.wakeListener?.stop(); this.wakeListener = undefined; this.wakeFor = undefined;
    if (this.wakeState !== 'off') this.wakeState = 'off';
  }
  private wakeVisibility = () => { if (document.visibilityState !== 'visible') this.stopWake(); this.requestUpdate(); };
  private woke = async () => {
    const listenerAtWake = this.wakeListener, generation = this.wakeGen, wordAtWake = this.voicePrefs.wake;
    if (!listenerAtWake || !wordAtWake || this.wakeGuard.remaining()) return;
    // While Nexus speaks, its name cuts the answer short and it listens again.
    if (this.overlay === 'voice' && this.voiceState === 'speaking') { this.speech?.stop(); this.speech = undefined; this.voiceTurn++; }
    else if (this.overlay === 'voice' && this.voiceState !== 'idle') return;
    if (this.overlay === 'enroll' || this.overlay === 'ring' || this.waking || !this.isConnected) return;
    // Two tabs of the dashboard on this device both hear the word: the first one answers, the others stay quiet.
    this.waking = true;
    const release = await claimVoice();
    this.waking = false;
    if (!release) return;
    if (generation !== this.wakeGen || this.wakeListener !== listenerAtWake || this.voicePrefs.wake !== wordAtWake || !this.isConnected || document.visibilityState !== 'visible') { release(); return; }
    this.wakeAttempt = true;
    this.voiceRelease?.(); this.voiceRelease = release;
    const word = this.voicePrefs.wake, heard = this.wakeListener?.heard;
    this.wakeLesson = word && heard && this.voicePrefs.wakeLearn !== false && this.wakeList?.find(w => w.id === word)?.kind === 'voice' ? { word, heard } : undefined;
    // On the screensaver, Nexus answers over it: the screensaver stays.
    // The sphere shows at once; then the page lets go of the microphone (an iPhone plays quietly while it is held),
    // a short tone says « I listen », and the recording starts.
    this.handsFree = true; this.handsFreeTurns = 0; this.lesson = '';
    this.overlay = 'voice'; this.query = ''; this.answer = undefined; this.conversationId = undefined; this.voiceHeard = '';
    this.voiceState = 'listening';
    const turn = ++this.voiceTurn;
    const listener = this.wakeListener;
    if (listener) { listener.paused = true; await listener.mic(false); }
    if (turn !== this.voiceTurn || this.overlay !== 'voice' || !this.voicePrefs.wake) return;
    await this.listenSignal();
    if (turn !== this.voiceTurn || this.overlay !== 'voice') return;
    void this.talk();
  };
  /** The short tone before each time Nexus listens (it can be turned off in the wake word's settings). */
  private async listenSignal() {
    if (this.voicePrefs.wakeChime === false) return;
    audioSession('playback');
    await listenTone();
    audioSession('auto');
  }
  /** How close the word came lately, drawn straight into the settings' meter (no new render 12 times a second). */
  private showWakeScore(score: number) {
    const now = performance.now();
    if (score >= this.wakePeak || now - this.wakePeakAt > 2500) { this.wakePeak = score; this.wakePeakAt = now; }
    const meter = this.renderRoot.querySelector<HTMLElement>('.wmeter');
    if (!meter) return;
    const share = Math.min(1, this.wakePeak / 0.5);
    meter.style.setProperty('--v', share.toFixed(3));
    meter.classList.toggle('hit', this.wakePeak >= 0.5);
    const label = meter.querySelector('small');
    if (label) label.textContent = this.wakePeak >= 0.5 ? tr('Reconnu') : `${Math.round(share * 100)} %`;
  }
  /** What woke Nexus becomes a lesson for the word: the word itself when a request followed, a false wake when closed at once. */
  private teachWake(kind: 'confirmed'|'cancelled') {
    const lesson = this.wakeLesson, hass = this.hass;
    this.wakeLesson = undefined;
    if (!lesson || !hass) return;
    void learnWake(hass, lesson.word, { [kind]: [lesson.heard] }).catch(error => console.warn('MP Nexus: wake word lesson', error));
  }

  // ——— A wake word made from the voice: the name, said five times, then two ordinary sentences ———
  /** `again`: a word of this home recorded once more (same name and settings, new recordings). */
  private startEnroll(again?: { id: string; name: string }) {
    unlockAudio();
    this.stopWake();
    this.enroll = { step: 'name', name: again?.name ?? 'Nexus', words: [], sentences: [], recording: false, level: 0, again: again?.id };
    this.overlay = 'enroll';
  }
  private async enrollRecord() {
    const e = this.enroll;
    if (!e || e.recording) { this.enrollStop.stop?.(); return; }
    const sentence = e.step === 'sentence';
    this.enroll = { ...e, recording: true, note: undefined, level: 0 };
    this.enrollStop = {};
    let samples: Float32Array;
    try { samples = await recordSamples(sentence ? SENTENCE_MS : WORD_MS, level => { if (this.enroll) this.enroll = { ...this.enroll, level }; }, this.enrollStop); }
    catch { if (this.enroll) this.enroll = { ...this.enroll, recording: false, level: 0, note: tr('Le micro n’est pas accessible. Autorisez-le pour cette page dans le navigateur.') }; return; }
    const now = this.enroll;
    if (!now || this.overlay !== 'enroll') return;
    const span = speechSpan(samples);
    if (!span || (!sentence && span.end - span.start > 16000 * 1.8)) {
      this.enroll = { ...now, recording: false, level: 0, note: !span ? tr('Je n’ai rien entendu, ou le mot a été coupé. Recommencez, un peu plus près.') : tr('C’était un peu long : dites seulement « {word} ».', { word: now.name }) };
      return;
    }
    if (sentence) {
      const sentences = [...now.sentences, samples];
      this.enroll = { ...now, sentences, recording: false, level: 0 };
      if (sentences.length >= ENROLL_SENTENCES.length) void this.enrollSave();
      return;
    }
    const words = [...now.words, samples];
    this.enroll = { ...now, words, recording: false, level: 0, step: words.length >= WORD_TIMES ? 'sentence' : 'word' };
    if (words.length < WORD_TIMES) window.setTimeout(() => { if (this.enroll?.step === 'word' && !this.enroll.recording) void this.enrollRecord(); }, 700);
  }
  private async enrollSave() {
    const e = this.enroll, hass = this.hass;
    if (!e || !hass) return;
    this.enroll = { ...e, step: 'saving' };
    try {
      const made = await createVoiceWord(hass, e.name, e.words, e.sentences, undefined, e.again);
      if (this.overlay !== 'enroll') return;
      this.wakeList = [{ id: made.id, name: made.name, custom: true, kind: 'voice' }, ...(this.wakeList ?? []).filter(w => w.id !== made.id)];
      this.voicePrefs = { ...this.voicePrefs, wake: made.id };
      writeVoicePrefs(this.voicePrefs);
      this.wakeFor = undefined;
      this.enroll = { ...e, step: 'done', id: made.id };
    } catch (error) {
      if (this.overlay !== 'enroll') return;
      this.enroll = { ...e, step: 'error', note: (error as { message?: string })?.message || tr('Le mot n’a pas pu être créé.') };
    }
  }
  private enrollPanel() {
    const e = this.enroll;
    if (!e) return nothing;
    const close = html`<button class="ib vclose" aria-label=${tr('Fermer')} title=${tr('Fermer')} @click=${this.closeOverlay}>${mpIcon('close', 16)}</button>`;
    const orb = (label: string) => html`<button class=${`vorb ${e.recording ? 'listening' : e.step === 'saving' ? 'thinking' : 'idle'}`} style=${`--lvl:${e.level.toFixed(2)}`} aria-label=${label} ?disabled=${e.step === 'saving'} @click=${() => this.enrollRecord()}><i></i><i></i><i></i></button>`;
    const dots = (done: number, total: number) => html`<div class="edots" aria-hidden="true">${Array.from({ length: total }, (_, i) => html`<i class=${i < done ? 'on' : ''}></i>`)}</div>`;
    let body;
    if (e.step === 'name') {
      const begin = () => { const name = e.name.trim().replace(/\s+/g, ' ').slice(0, 40); if (name) this.enroll = { ...e, name, step: 'word' }; };
      body = html`<p class="muted">${tr('Choisissez le nom qui réveillera Nexus. Un mot de deux ou trois syllabes, peu courant, marche le mieux.')}</p>
        <input class="ename" maxlength="40" .value=${e.name} aria-label=${tr('Nom du mot d’éveil')} @input=${(ev: Event) => { if (this.enroll) this.enroll = { ...this.enroll, name: (ev.target as HTMLInputElement).value }; }} @keydown=${(ev: KeyboardEvent) => { if (ev.key === 'Enter') begin(); }}>
        <p class="muted small">${tr('Vous le direz cinq fois, puis vous lirez deux phrases. Rien n’est enregistré en son : seule l’empreinte de votre voix est gardée dans Home Assistant.')}</p>
        <button class="btn primary" ?disabled=${!e.name.trim()} @click=${begin}>${tr('Commencer')}</button>`;
    } else if (e.step === 'word') {
      body = html`${orb(tr('Enregistrer'))}${dots(e.words.length, WORD_TIMES)}
        <div class="said serif">${e.recording ? tr('Dites « {word} »', { word: e.name }) : e.words.length ? tr('Encore une fois…') : tr('Touchez l’orbe, puis dites « {word} »', { word: e.name })}</div>
        <div class="muted">${e.note ?? tr('Comme vous l’appelleriez depuis le canapé.')}</div>`;
    } else if (e.step === 'sentence') {
      const text = ENROLL_SENTENCES[Math.min(e.sentences.length, ENROLL_SENTENCES.length - 1)]!;
      body = html`${orb(tr('Enregistrer'))}${dots(e.sentences.length, ENROLL_SENTENCES.length)}
        <div class="muted">${e.note ?? (e.recording ? tr('Lisez la phrase, puis touchez l’orbe.') : tr('Touchez l’orbe, puis lisez cette phrase à voix haute :'))}</div>
        <div class="said serif">« ${tr(text)} »</div>`;
    } else if (e.step === 'saving') {
      body = html`${orb(tr('Préparation…'))}<div class="said serif">${tr('Nexus apprend votre voix…')}</div><div class="muted">${tr('Quelques secondes.')}</div>`;
    } else if (e.step === 'done') {
      body = html`<div class="said serif">${tr('C’est prêt ! Dites « {word} » pour essayer.', { word: e.name })}</div>
        <p class="muted">${tr('Il apprend des réveils confirmés et de ceux fermés par erreur.')}</p>
        <button class="btn primary" @click=${this.closeOverlay}>${tr('Terminer')}</button>`;
    } else {
      body = html`<div class="said serif">${e.note}</div><button class="btn" @click=${() => { this.enroll = { step: 'name', name: e.name, words: [], sentences: [], recording: false, level: 0, again: e.again }; }}>${tr('Recommencer')}</button>`;
    }
    return html`<div class="hd"><b class="vtitle">${tr('Créer un mot d’éveil')}</b>${close}</div><div class="body nexus-voice enroll">${body}</div>`;
  }

  private wakeChoice() {
    const hass = this.hass, admin = !!hass?.user?.is_admin;
    if (!canRecord()) return nothing;
    if (hass && !this.wakeList?.length) this.loadWakeList();
    const current = this.voicePrefs.wake ?? '';
    const custom = this.wakeList?.find(w => w.id === current && w.custom);
    const status = this.wakeGuard.remaining() ? tr('Mot d’éveil en pause après plusieurs réveils sans demande. Il reprend dans une minute.') : this.wakeState === 'armed' ? tr('À l’écoute de « {word} »', { word: this.wakeName() }) : this.wakeState === 'loading' ? tr('Préparation…') : this.wakeState === 'touch' ? tr('Touchez l’écran pour activer le micro')
      : this.wakeState === 'error' ? tr('Le mot d’éveil n’a pas pu démarrer.') : this.wakeState === 'gone' ? tr('Ce mot d’éveil a été retiré depuis un autre écran : choisissez-en un dans la liste.') : current ? tr('Le micro reste sur cet écran tant que le mot n’est pas entendu.') : tr('Dites-le pour parler à Nexus sans toucher l’écran');
    const change = (e: Event) => {
      const value = (e.target as HTMLSelectElement).value;
      if (value === '+') { (e.target as HTMLSelectElement).value = current; this.renderRoot.querySelector<HTMLInputElement>('input.wakefile')?.click(); return; }
      if (value === '*') { (e.target as HTMLSelectElement).value = current; this.startEnroll(); return; }
      this.voicePrefs = { ...this.voicePrefs, wake: value || undefined };
      writeVoicePrefs(this.voicePrefs);
      if (value) unlockAudio();
    };
    const add = async (e: Event) => {
      const input = e.target as HTMLInputElement, file = input.files?.[0];
      input.value = '';
      if (!file || !hass) return;
      try {
        const word = await addWakeWord(hass, file);
        this.wakeList = [word, ...(this.wakeList ?? []).filter(w => w.id !== word.id)];
        this.voicePrefs = { ...this.voicePrefs, wake: word.id };
        writeVoicePrefs(this.voicePrefs);
      } catch (error) { this.wakeState = 'error'; console.warn('MP Nexus: wake word', error); }
    };
    const remove = async () => {
      if (!hass || !custom) return;
      try { await removeWakeWord(hass, custom.id); } catch { return; }
      this.wakeList = (this.wakeList ?? []).filter(w => w.id !== custom.id);
      this.voicePrefs = { ...this.voicePrefs, wake: undefined };
      writeVoicePrefs(this.voicePrefs);
    };
    const labels = wakeLabels(this.wakeList ?? []), label = labels.find(([w]) => w.id === custom?.id)?.[1] ?? custom?.name ?? '';
    const twins = custom ? (this.wakeList ?? []).filter(w => w.custom && w.id !== custom.id && w.name.toLowerCase() === custom.name.toLowerCase()) : [];
    const keepOnly = async () => {
      if (!hass) return;
      const gone = new Set<string>();
      for (const w of twins) { try { await removeWakeWord(hass, w.id); gone.add(w.id); } catch { /* Kept; it can be removed by itself. */ } }
      this.wakeList = (this.wakeList ?? []).filter(w => !gone.has(w.id));
    };
    return html`<label class="rw"><span class="ib">${mpIcon('mic', 16)}</span><div><b>${tr('Mot d’éveil')}</b><small>${status}</small></div>
      <select class="end" aria-label=${tr('Mot d’éveil')} @change=${change}>
        <option value="" .selected=${!current}>${tr('Aucun')}</option>
        ${labels.map(([w, label]) => html`<option value=${w.id} .selected=${current === w.id}>${label}</option>`)}
        ${admin ? html`<option value="*">${tr('+ Créer un mot avec ma voix…')}</option><option value="+">${tr('Ajouter un mot entraîné (.onnx)')}</option>` : nothing}
      </select></label>
      ${this.wakeGuard.remaining() ? html`<button class="btn" @click=${() => { this.wakeGuard.reset(); clearTimeout(this.wakeCooldownTimer); this.wakeCooldownTimer = undefined; this.requestUpdate(); }}>${tr('Réactiver le mot d’éveil')}</button>` : nothing}
      ${custom?.kind === 'voice' ? this.voiceWordPrefs() : nothing}
      ${current ? html`<div class="rw"><span class="ib">${mpIcon('bell', 16)}</span><div><b>${tr('Bip d’écoute')}</b><small>${tr('Un petit son dit que Nexus vous écoute après son nom')}</small></div>
        <button class="end" role="switch" aria-checked=${this.voicePrefs.wakeChime !== false} aria-label=${tr('Bip d’écoute')} @click=${() => { this.voicePrefs = { ...this.voicePrefs, wakeChime: this.voicePrefs.wakeChime === false ? undefined : false }; writeVoicePrefs(this.voicePrefs); if (this.voicePrefs.wakeChime !== false) { unlockSound(); void listenTone(); } }}><span class=${`tgl ${this.voicePrefs.wakeChime !== false ? '' : 'off'}`}></span></button></div>` : nothing}
      ${admin && custom?.kind === 'voice' ? html`<button class="rw" @click=${() => this.startEnroll({ id: custom.id, name: custom.name })}><span class="ib">${mpIcon('mic', 16)}</span><div><b>${tr('Réenregistrer « {word} »', { word: custom.name })}</b><small>${tr('Nouvelles prises de votre voix, mêmes réglages. Ce que la maison lui a appris est gardé.')}</small></div></button>` : nothing}
      ${admin ? html`<input class="wakefile" type="file" accept=".onnx" hidden @change=${add}>` : nothing}
      ${admin && custom && twins.length ? html`<button class="rw" @click=${keepOnly}><span class="ib">${mpIcon('check', 16)}</span><div><b>${tr('Garder seulement ce « {word} »', { word: custom.name })}</b><small>${tr('Retire les autres mots du même nom. Un écran qui en utilisait un devra choisir celui-ci.')}</small></div></button>` : nothing}
      ${admin && custom ? html`<button class="rw" @click=${remove}><span class="ib">${mpIcon('close', 16)}</span><div><b>${tr('Retirer « {word} »', { word: label })}</b></div></button>` : nothing}`;
  }

  /** For a word made from the voice: how readily it wakes, and whether this screen teaches it what it hears. */
  private voiceWordPrefs() {
    const prefs = this.voicePrefs, learn = prefs.wakeLearn !== false;
    const set = (patch: Partial<VoicePrefs>) => { this.voicePrefs = { ...this.voicePrefs, ...patch }; writeVoicePrefs(this.voicePrefs); };
    return html`${this.wakeOld ? html`<div class="rw"><span class="ib">${mpIcon('mic', 16)}</span><div><b>${tr('Enregistrez ce mot à nouveau')}</b><small>${tr('Depuis la 0.38.1, l’enregistrement apprend aussi votre voix de loin : recréez le mot pour qu’il vous entende partout dans la pièce.')}</small></div></div>` : ''}
      <div class="rw"><span class="ib">${mpIcon('motion', 16)}</span><div><b>${tr('Ce que l’écran entend')}</b><small>${tr('Dites le mot : la barre doit atteindre « Reconnu »')}</small></div>
        <span class="end wmeter" style="--v:0"><i></i><small .textContent=${this.wakeState === 'armed' ? '0 %' : tr('Touchez l’écran pour écouter')}></small></span></div>
      <label class="rw"><span class="ib">${mpIcon('motion', 16)}</span><div><b>${tr('Sensibilité')}</b><small>${tr('Plus sensible : il entend de plus loin, mais se trompe plus souvent')}</small></div>
        <select class="end" aria-label=${tr('Sensibilité')} @change=${(e: Event) => { const v = (e.target as HTMLSelectElement).value; set({ wakeSensitivity: v === 'high' || v === 'low' ? v : undefined }); }}>
          <option value="high" .selected=${prefs.wakeSensitivity === 'high'}>${tr('Sensible')}</option>
          <option value="" .selected=${!prefs.wakeSensitivity}>${tr('Normale')}</option>
          <option value="low" .selected=${prefs.wakeSensitivity === 'low'}>${tr('Stricte')}</option>
        </select></label>
      <div class="rw"><span class="ib">${mpIcon('moon', 16)}</span><div><b>${tr('Apprendre en arrière-plan')}</b><small>${tr('Les réveils confirmés et ceux fermés par erreur servent à améliorer le mot.')}</small></div>
        <button class="end" role="switch" aria-checked=${learn} aria-label=${tr('Apprendre en arrière-plan')} @click=${() => set({ wakeLearn: learn ? false : undefined })}><span class=${`tgl ${learn ? '' : 'off'}`}></span></button></div>`;
  }

  /** The Android companion controls its music stream; pair its notification service with that same device's sensor. */
  private tabletVolumeChoice() {
    const hass = this.hass;
    if (hass && (!this.tabletServices || Date.now() - this.tabletServicesAt > 30_000)) {
      this.tabletServicesAt = Date.now(); this.tabletServices ??= [];
      void hass.callWS<Record<string, Record<string, unknown>>>({ type: 'get_services' }).then(services => {
        this.tabletServices = Object.keys(services.notify ?? {}).filter(name => /^mobile_app_[a-z0-9_]+$/.test(name)).sort();
        this.requestUpdate();
      }).catch(() => undefined);
    }
    const choice = this.voicePrefs.tabletVolume ?? { service: '', sensor: '' };
    const set = (patch: Partial<typeof choice>) => { this.voicePrefs = { ...this.voicePrefs, tabletVolume: { ...choice, ...patch } }; writeVoicePrefs(this.voicePrefs); };
    const services = [...new Set([...(this.tabletServices ?? []), ...(choice.service ? [choice.service] : [])])];
    const sensors = Object.values(hass?.states ?? {}).filter(s => s.entity_id.startsWith('sensor.') && (/volume.*(music|media|multimedia|musique)/i.test(`${s.entity_id} ${String(s.attributes.friendly_name ?? '')}`) || s.entity_id === choice.sensor));
    return html`<div class="rw"><span class="ib">${mpIcon('volume', 16)}</span><div><b>${tr('Baisser le son pendant l’écoute')}</b><small>${tr('Le volume multimédia de cette tablette baisse pendant l’écoute et revient avant la réponse.')}</small></div></div>
      <label class="rw"><span class="ib">${mpIcon('user', 16)}</span><div><b>${tr('Tablette Android')}</b></div><select class="end" aria-label=${tr('Tablette Android')} @change=${(e: Event) => set({ service: (e.target as HTMLSelectElement).value })}><option value="" .selected=${!choice.service}>${tr('Aucun')}</option>${services.map(service => html`<option value=${service} .selected=${choice.service === service}>${service.replace(/^mobile_app_/, '').replace(/_/g, ' ')}</option>`)}</select></label>
      ${choice.service ? html`<label class="rw"><span class="ib">${mpIcon('volume', 16)}</span><div><b>${tr('Capteur de volume multimédia')}</b><small>${tr('Choisissez les deux éléments de la même tablette. Activez le capteur « Volume level music » dans l’application Home Assistant.')}</small></div><select class="end" aria-label=${tr('Capteur de volume multimédia')} @change=${(e: Event) => set({ sensor: (e.target as HTMLSelectElement).value })}><option value="" .selected=${!choice.sensor}>${tr('Aucun')}</option>${sensors.map(s => html`<option value=${s.entity_id} .selected=${choice.sensor === s.entity_id}>${String(s.attributes.friendly_name ?? s.entity_id)}</option>`)}</select></label>` : nothing}`;
  }

  /** How Nexus answers aloud on this screen: the device's voice, a Home Assistant voice, or silence; which voice, and its colour. */
  private enginesAt = 0;
  private voiceChoice() {
    const hass = this.hass, prefs = this.voicePrefs;
    // The list is read again now and then: an engine added to Home Assistant shows up without reloading the page.
    if (hass && (!this.voiceEngines || Date.now() - this.enginesAt > 30_000)) {
      this.enginesAt = Date.now(); this.voiceEngines ??= [];
      void speechEngines(hass, language()).then(list => { this.voiceEngines = list; });
    }
    if (hass && !this.facts && !this.factsAsked && nexusAgent(hass)) { this.factsAsked = true; void this.refreshFacts(); }
    const value = prefs.speak === 'ha' && prefs.engine ? `ha:${prefs.engine}` : prefs.speak;
    const keep = { wake: prefs.wake, wakeSensitivity: prefs.wakeSensitivity, wakeLearn: prefs.wakeLearn, wakeChime: prefs.wakeChime, tabletVolume: prefs.tabletVolume, followWait: prefs.followWait };
    const set = (patch: Partial<VoicePrefs>) => { this.voicePrefs = { ...this.voicePrefs, ...patch }; writeVoicePrefs(this.voicePrefs); };
    const change = (e: Event) => {
      const v = (e.target as HTMLSelectElement).value;
      this.voicePrefs = { ...keep, ...(v.startsWith('ha:') ? { speak: 'ha' as const, engine: v.slice(3) } : { speak: v === 'off' ? 'off' as const : 'device' as const }), effect: prefs.effect };
      this.voiceList = undefined;
      writeVoicePrefs(this.voicePrefs);
    };
    const listKey = prefs.speak === 'ha' ? `ha:${prefs.engine}` : prefs.speak === 'device' ? 'device' : '';
    if (listKey && this.voiceList?.key !== listKey) {
      this.voiceList = { key: listKey, voices: [] };
      if (prefs.speak === 'device') {
        const load = () => { if (this.voiceList?.key === 'device') this.voiceList = { key: 'device', voices: deviceVoices(locale()).map(v => ({ id: v.name, name: v.name })) }; };
        load();
        if (typeof speechSynthesis !== 'undefined') speechSynthesis.onvoiceschanged = load;
      } else if (hass && prefs.engine) {
        void engineVoices(hass, prefs.engine, language()).then(voices => { if (this.voiceList?.key === listKey) this.voiceList = { key: listKey, voices }; });
      }
    }
    const voices = this.voiceList?.key === listKey ? this.voiceList.voices : [];
    const persona = this.facts?.persona ?? 'standard', butler = persona === 'majordome', holo = prefs.effect === 'holo';
    const setPersona = async (next: string) => {
      if (!hass) return;
      try { this.facts = await setPersonaWS(hass, next); } catch { /* An older integration. */ }
      // The butler comes with his colour; it can be taken off afterwards.
      if (next === 'majordome' && !this.voicePrefs.effect) set({ effect: 'holo' });
      this.requestUpdate();
    };
    return html`<label class="rw"><span class="ib">${mpIcon('mic', 16)}</span><div><b>${tr('Voix de Nexus')}</b><small>${tr('Comment Nexus répond à voix haute')}</small></div>
      <select class="end" aria-label=${tr('Voix de Nexus')} @change=${change}>
        <option value="device" .selected=${value === 'device'}>${tr('Voix de l’appareil')}</option>
        ${(this.voiceEngines ?? []).map(e => html`<option value=${`ha:${e.id}`} .selected=${value === `ha:${e.id}`}>${engineLabel(hass, e)}</option>`)}
        <option value="off" .selected=${value === 'off'}>${tr('Muette')}</option>
      </select></label>
      ${voices.length > 1 ? html`<label class="rw"><span class="ib">${mpIcon('user', 16)}</span><div><b>${tr('Timbre')}</b><small>${tr('Une des voix proposées')}</small></div>
        <select class="end" aria-label=${tr('Timbre')} @change=${(e: Event) => set({ voice: (e.target as HTMLSelectElement).value || undefined })}>
          <option value="" .selected=${!prefs.voice}>${tr('Automatique')}</option>
          ${voices.map(v => html`<option value=${v.id} .selected=${prefs.voice === v.id}>${v.name}</option>`)}
        </select></label>` : nothing}
      ${this.facts ? html`<label class="rw"><span class="ib">${mpIcon('sparkle', 16)}</span><div><b>${tr('Personnalité')}</b><small>${butler ? tr('Majordome : « Monsieur », flegme et humour pince-sans-rire') : tr('Pour toute la maison')}</small></div>
        <select class="end" aria-label=${tr('Personnalité')} @change=${(e: Event) => { void setPersona((e.target as HTMLSelectElement).value); }}>
          <option value="standard" .selected=${!butler}>${tr('Standard')}</option>
          <option value="majordome" .selected=${butler}>${tr('Majordome')}</option>
        </select></label>` : nothing}
      ${prefs.speak !== 'off' ? html`<div class="rw"><span class="ib">${mpIcon('volume', 16)}</span><div><b>${tr('Effet hologramme')}</b><small>${prefs.speak === 'ha' ? tr('Une voix un peu irréelle, comme projetée') : tr('Avec une voix Home Assistant seulement')}</small></div>
        <button class="end" role="switch" aria-checked=${holo} aria-label=${tr('Effet hologramme')} ?disabled=${prefs.speak !== 'ha'} @click=${() => set({ effect: holo ? undefined : 'holo' })}><span class=${`tgl ${holo ? '' : 'off'}`}></span></button></div>
      <button class="rw" @click=${() => this.previewVoice()}><span class="ib">${mpIcon('play', 16)}</span><div><b>${tr('Écouter la voix')}</b><small>${tr('Une phrase, avec ces réglages')}</small></div><span class="end">${mpIcon('arrow', 16)}</span></button>` : nothing}`;
  }
  /** A sentence in the chosen voice, style and colour. */
  private previewVoice() {
    const butler = this.facts?.persona === 'majordome';
    unlockAudio();
    this.speech?.stop();
    const text = butler ? tr('Bonjour Monsieur. Tout est en ordre dans la maison, à l’exception peut-être de la pile de linge.') : tr('Bonjour ! Je suis Nexus. Voici ma voix sur cet écran.');
    const prefs = this.voicePrefs, hass = this.hass;
    void (async () => {
      try { this.speech = prefs.speak === 'ha' && prefs.engine && hass ? await speakWithHomeAssistant(hass, text, language(), prefs.engine, prefs.voice, prefs.effect) : speakOnDevice(text, locale(), prefs.voice); }
      catch (error) { console.warn('MP Nexus: voice', error); this.speech = speakOnDevice(text, locale(), prefs.speak === 'device' ? prefs.voice : undefined); }
    })();
  }

  // ——— Plus: routines, energy, outdoor, access, history, backup, screensaver ———
  private back = () => { this.sub = undefined; };
  private ofDomain(domain: string, test: (s: HAState) => boolean = () => true) { const hidden = this.setAside; return Object.values(this.hass?.states ?? {}).filter(s => s.entity_id.startsWith(`${domain}.`) && !hidden.has(s.entity_id) && test(s)); }
  /** The entities of a domain in one room of the plan, or in the whole house. */
  private inScope(domain: string, roomId: string, test: (s: HAState) => boolean = () => true) {
    const room = this.placedAll.find(p => p.room.id === roomId)?.room;
    return this.ofDomain(domain, test).map(s => s.entity_id).filter(id => !room || roomEntityIds(room).includes(id));
  }
  private toggleRow(id: string, sub: string) {
    const s = this.state(id), on = this.on(id) || s?.state === 'open';
    return html`<div class="rw"><span class="ib">${mpIcon(entityIcon(id, s), 16)}</span><button class="txt" @click=${() => { this.detail = id; }}><b>${this.name(id)}</b><small>${sub}</small></button>
      <button class="end" role="switch" aria-checked=${on} aria-label=${this.name(id)} @click=${() => domainOf(id) === 'valve' ? this.call('valve', on ? 'close_valve' : 'open_valve', { entity_id: id }) : this.call(domainOf(id), 'toggle', { entity_id: id })}><span class=${`tgl ${on ? '' : 'off'}`}></span></button></div>`;
  }
  private routinesPanel() {
    const automations = this.ofDomain('automation', s => available(s)).sort((a, b) => this.name(a.entity_id).localeCompare(this.name(b.entity_id), locale()));
    const admin = !!this.hass?.user?.is_admin, active = automations.filter(s => s.state === 'on').length;
    const last = (s: HAState) => { const at = Date.parse(String(s.attributes.last_triggered ?? '')); return Number.isFinite(at) ? tr('Dernière fois : {when}', { when: new Intl.DateTimeFormat(locale(), { weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(at) }) : tr('Jamais déclenchée'); };
    return html`${this.head(tr('Routines « Si… alors… »'), tr('{n} active|{n} actives', { n: active }), admin ? html`<button class="btn primary sm" @click=${() => { this.routineRoom = ''; this.routineWhenRoom = ''; this.draft = { ...newRoutine(), then: { kind: 'covers-close', entities: this.inScope('cover', '', s => groupCover(s)) } }; this.routineState = ''; this.sub = { type: 'routine', id: '' }; }}>${mpIcon('plus', 15)}${tr('Nouvelle')}</button>` : nothing, this.back)}
      <div class="body">
        ${automations.length ? html`<div class="sg">${automations.map(s => html`<div class="rw"><span class="ib">${mpIcon('sparkle', 16)}</span><button class="txt" @click=${() => { this.detail = s.entity_id; }}><b>${this.name(s.entity_id)}</b><small>${last(s)}</small></button>
          <button class="end" role="switch" aria-checked=${s.state === 'on'} aria-label=${this.name(s.entity_id)} @click=${() => this.call('automation', s.state === 'on' ? 'turn_off' : 'turn_on', { entity_id: s.entity_id })}><span class=${`tgl ${s.state === 'on' ? '' : 'off'}`}></span></button></div>`)}</div>`
          : html`<p class="empty">${tr('Aucune routine pour le moment. Créez la première en deux touches.')}</p>`}
        ${admin ? html`<p class="muted" style="margin:0;font-size:12px">${tr('Les routines sont des automatisations Home Assistant : vous les retrouvez et les modifiez aussi dans Paramètres → Automatisations.')}</p>` : nothing}
      </div>`;
  }
  /** Builds a routine in two touches: what starts it, what it does, and a sentence that says it back. */
  private routinePanel() {
    const draft = this.draft, set = (change: Partial<Routine>) => { this.draft = { ...draft, ...change }; this.routineState = ''; };
    const rooms = this.placedAll, contacts = (roomId: string) => this.inScope('binary_sensor', roomId, s => contactSensor(s));
    const persons = people(this.hass?.states ?? {}), scenes = this.ofDomain('scene', s => available(s));
    const roomSelect = (value: string, change: (roomId: string) => void, has: (roomId: string) => boolean) => html`<select aria-label=${tr('Pièce')} @change=${(e: Event) => change((e.target as HTMLSelectElement).value)}>
      <option value="" .selected=${!value}>${tr('Toute la maison')}</option>${rooms.filter(p => has(p.room.id)).map(p => html`<option value=${p.room.id} .selected=${value === p.room.id}>${p.room.name}</option>`)}</select>`;
    const chip = (on: boolean, icon: MPIconName, label: string, pick: () => void) => html`<button class="pill" aria-pressed=${on} @click=${pick}>${mpIcon(icon, 13)}${label}</button>`;
    const w = draft.when, t = draft.then, scope = this.routineRoom;
    const thenScoped = (kind: 'climate-off'|'lights-on'|'covers-close', roomId: string) => ({ kind, entities: this.inScope(kind === 'climate-off' ? 'climate' : kind === 'lights-on' ? 'light' : 'cover', roomId) });
    const whenText = w.kind === 'opens' ? (this.routineWhenRoom ? tr('une fenêtre s’ouvre ({room})', { room: rooms.find(p => p.room.id === this.routineWhenRoom)?.room.name ?? '' }) : tr('une fenêtre s’ouvre')) : w.kind === 'sunset' ? tr('le soleil se couche') : w.kind === 'arrives' ? tr('quelqu’un arrive') : tr('il est {time}', { time: w.at || '—' });
    const where = scope ? rooms.find(p => p.room.id === scope)?.room.name ?? '' : tr('toute la maison');
    const thenText = t.kind === 'climate-off' ? tr('couper la climatisation ({where})', { where }) : t.kind === 'lights-on' ? tr('allumer les lumières ({where})', { where }) : t.kind === 'covers-close' ? tr('fermer les volets ({where})', { where }) : t.kind === 'notify' ? tr('m’envoyer une alerte') : tr('lancer la scène {scene}', { scene: t.scene ? this.name(t.scene) : '—' });
    const sentence = tr('Si {when}, alors {then}.', { when: whenText, then: thenText }), ready = routineReady({ ...draft, name: draft.name || sentence });
    return html`${this.head(tr('Nouvelle routine'), tr('Si… alors…'), html`<button class="btn primary sm" ?disabled=${!ready || this.routineState === 'saving'} @click=${() => void this.saveRoutine(sentence)}>${tr('Enregistrer')}</button>`, () => { this.sub = { type: 'routines', id: '' }; })}
      <div class="body">
        <div class="rlab">${tr('Si')}</div>
        <div class="houses wrap">
          ${chip(w.kind === 'opens', 'window', tr('Une fenêtre s’ouvre'), () => set({ when: { kind: 'opens', sensors: contacts(this.routineWhenRoom) } }))}
          ${chip(w.kind === 'sunset', 'moon', tr('Le soleil se couche'), () => set({ when: { kind: 'sunset', offsetMinutes: 0 } }))}
          ${chip(w.kind === 'arrives', 'motion', tr('Quelqu’un arrive'), () => set({ when: { kind: 'arrives', people: persons.map(p => p.id) } }))}
          ${chip(w.kind === 'time', 'sun', tr('À une heure'), () => set({ when: { kind: 'time', at: '07:00' } }))}
        </div>
        ${w.kind === 'opens' ? html`<label class="vol">${mpIcon('window', 16)}${roomSelect(this.routineWhenRoom, roomId => { this.routineWhenRoom = roomId; set({ when: { kind: 'opens', sensors: contacts(roomId) } }); }, roomId => contacts(roomId).length > 0)}<small class="muted">${tr('{n} capteur|{n} capteurs', { n: w.sensors.length })}</small></label>`
          : w.kind === 'arrives' ? html`<div class="houses wrap">${persons.map(p => chip(w.people.includes(p.id), 'user', p.name, () => set({ when: { kind: 'arrives', people: w.people.includes(p.id) ? w.people.filter(x => x !== p.id) : [...w.people, p.id] } })))}</div>`
            : w.kind === 'time' ? html`<label class="vol">${mpIcon('sun', 16)}<input type="time" .value=${w.at} aria-label=${tr('Heure')} @change=${(e: Event) => set({ when: { kind: 'time', at: (e.target as HTMLInputElement).value } })}><span></span></label>` : nothing}
        <div class="rlab">${tr('Alors')}</div>
        <div class="houses wrap">
          ${chip(t.kind === 'climate-off', 'thermo', tr('Couper la climatisation'), () => set({ then: thenScoped('climate-off', scope) }))}
          ${chip(t.kind === 'lights-on', 'bulb', tr('Allumer les lumières'), () => set({ then: thenScoped('lights-on', scope) }))}
          ${chip(t.kind === 'covers-close', 'shutter', tr('Fermer les volets'), () => set({ then: thenScoped('covers-close', scope) }))}
          ${chip(t.kind === 'notify', 'bell', tr('M’envoyer une alerte'), () => set({ then: { kind: 'notify', message: sentence } }))}
          ${scenes.length ? chip(t.kind === 'scene', 'sparkle', tr('Lancer une scène'), () => set({ then: { kind: 'scene', scene: scenes[0]!.entity_id } })) : nothing}
        </div>
        ${t.kind === 'climate-off' || t.kind === 'lights-on' || t.kind === 'covers-close' ? html`<label class="vol">${mpIcon('rooms', 16)}${roomSelect(scope, roomId => { this.routineRoom = roomId; set({ then: thenScoped(t.kind, roomId) }); }, roomId => this.inScope(t.kind === 'climate-off' ? 'climate' : t.kind === 'lights-on' ? 'light' : 'cover', roomId).length > 0)}<small class="muted">${tr('{n} équipement|{n} équipements', { n: t.entities.length })}</small></label>`
          : t.kind === 'notify' ? html`<label class="inp wide"><input .value=${t.message} aria-label=${tr('Message')} @input=${(e: Event) => set({ then: { kind: 'notify', message: (e.target as HTMLInputElement).value } })}></label>`
            : html`<label class="vol">${mpIcon('sparkle', 16)}<select aria-label=${tr('Scène')} @change=${(e: Event) => set({ then: { kind: 'scene', scene: (e.target as HTMLSelectElement).value } })}>${scenes.map(s => html`<option value=${s.entity_id} .selected=${t.scene === s.entity_id}>${this.name(s.entity_id)}</option>`)}</select><span></span></label>`}
        <div class="rlab">${tr('En résumé')}</div>
        <div class="live glass summary"><span class="ib">${mpIcon('sparkle', 16)}</span><div><b>${sentence}</b><small>${tr('Tous les jours, dans toute la maison')}</small></div></div>
        <label class="inp wide">${mpIcon('text', 16)}<input .value=${draft.name} placeholder=${sentence} aria-label=${tr('Nom de la routine')} @input=${(e: Event) => set({ name: (e.target as HTMLInputElement).value })}></label>
        ${this.routineState === 'saved' ? html`<p class="note ok">${tr('Routine enregistrée dans Home Assistant.')}</p>` : this.routineState === 'error' ? html`<p class="note">${tr('Home Assistant a refusé la routine. Vérifiez que vous êtes administrateur.')}</p>` : nothing}
      </div>`;
  }
  private async saveRoutine(sentence: string) {
    const hass = this.hass;
    if (!hass?.fetchWithAuth) { this.routineState = 'error'; return; }
    this.routineState = 'saving';
    const routine = { ...this.draft, name: this.draft.name.trim() || sentence };
    try {
      const response = await hass.fetchWithAuth(`/api/config/automation/config/${automationId()}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(automationOf(routine)) });
      this.routineState = response.ok ? 'saved' : 'error';
      if (response.ok) window.setTimeout(() => { if (this.sub?.type === 'routine') this.sub = { type: 'routines', id: '' }; }, 1200);
    } catch { this.routineState = 'error'; }
  }
  private energyPanel() {
    const { power, energy } = energySummary(this.hass?.states ?? {});
    const watts = (w: number) => w >= 1000 ? `${this.format(w / 1000, 2)} kW` : `${this.format(w, 0)} W`;
    const bar = (value: number, max: number) => html`<i class="meter"><b style=${`width:${max ? Math.max(3, value / max * 100) : 0}%`}></b></i>`;
    return html`${this.head(tr('Énergie'), tr('En ce moment'), this.hass?.user?.is_admin ? html`<a class="pill" href="/energy">${tr('Tableau Énergie')}</a>` : nothing, this.back)}
      <div class="body">
        ${power.length || energy.length ? html`<p class="note info">${tr('Relevés indépendants : certains compteurs peuvent mesurer les mêmes usages.')}</p>` : nothing}
        ${power.length ? html`<div class="rlab">${tr('Puissance')}</div><div class="sg">${power.slice(0, 8).map(p => html`<button class="rw" @click=${() => { this.detail = p.id; }}><span class="ib">${mpIcon('gauge', 16)}</span><div style="flex:1"><b>${this.name(p.id)}</b>${this.roomOfEntity(p.id) ? html`<small>${this.roomOfEntity(p.id)}</small>` : nothing}${bar(p.watts, power[0]!.watts)}</div><span class="end"><b>${watts(p.watts)}</b></span></button>`)}</div>` : nothing}
        ${energy.length ? html`<div class="rlab">${tr('Compteurs d’énergie')}</div><div class="sg">${energy.slice(0, 8).map(e => html`<button class="rw" @click=${() => { this.detail = e.id; }}><span class="ib">${mpIcon('leaf', 16)}</span><div style="flex:1"><b>${this.name(e.id)}</b>${this.roomOfEntity(e.id) ? html`<small>${this.roomOfEntity(e.id)}</small>` : nothing}${bar(e.kwh, energy[0]!.kwh)}</div><span class="end"><b>${this.format(e.kwh, 1)} kWh</b></span></button>`)}</div>` : nothing}
        ${power.length || energy.length ? nothing : html`<p class="empty">${tr('Aucun capteur de puissance ou d’énergie pour le moment.')}</p>`}
      </div>`;
  }
  private outdoorPanel() {
    const states = this.hass?.states ?? {}, weather = this.ofDomain('weather', s => available(s))[0], sun = states['sun.sun'];
    const water = [...this.ofDomain('valve', s => available(s)), ...this.ofDomain('switch', s => available(s) && /arros|irrig|sprink|water|goutte|pelouse|jardin/i.test(`${s.entity_id} ${String(s.attributes.friendly_name ?? '')}`))].map(s => s.entity_id);
    const time = (value: unknown) => { const at = Date.parse(String(value ?? '')); return Number.isFinite(at) ? new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit' }).format(at) : '—'; };
    const on = water.filter(id => this.on(id) || states[id]?.state === 'open').length;
    return html`${this.head(tr('Extérieur & arrosage'), water.length ? tr('{n} zone sur {total}|{n} zones sur {total}', { n: on, total: water.length }) : tr('Extérieur'), nothing, this.back)}
      <div class="body">
        ${weather ? html`<button class="live glass" @click=${() => { this.detail = weather.entity_id; }}><span class="ib">${mpIcon(weatherIcon(weather.state), 18)}</span><div><b>${finite(weather.attributes.temperature) === undefined ? weather.state : `${this.format(finite(weather.attributes.temperature)!)} ${String(weather.attributes.temperature_unit ?? '°')}`}</b><small>${[weatherName(weather.state), finite(weather.attributes.humidity) === undefined ? '' : `${this.format(finite(weather.attributes.humidity)!, 0)} %`, finite(weather.attributes.wind_speed) === undefined ? '' : `${this.format(finite(weather.attributes.wind_speed)!, 0)} ${String(weather.attributes.wind_speed_unit ?? 'km/h')}`].filter(Boolean).join(' · ')}</small></div></button>` : nothing}
        ${sun ? html`<div class="stat"><span class="pill">${mpIcon('sun', 13)}${tr('Lever {time}', { time: time(sun.attributes.next_rising) })}</span><span class="pill">${mpIcon('moon', 13)}${tr('Coucher {time}', { time: time(sun.attributes.next_setting) })}</span></div>` : nothing}
        ${water.length ? html`<div class="rlab">${tr('Arrosage')}</div><div class="sg">${water.map(id => this.toggleRow(id, stateLabel(id, states[id])))}</div>` : html`<p class="empty">${tr('Aucune vanne ni zone d’arrosage détectée.')}</p>`}
      </div>`;
  }
  private accessPanel() {
    const cameras = this.ofDomain('camera', s => available(s)), locks = this.ofDomain('lock', s => available(s));
    const gates = this.ofDomain('cover', s => available(s) && ['garage', 'gate', 'door'].includes(String(s.attributes.device_class ?? ''))), alarms = this.ofDomain('alarm_control_panel', s => available(s));
    const open = locks.filter(s => s.state !== 'locked').length + gates.filter(s => s.state !== 'closed').length;
    return html`${this.head(tr('Accès & caméras'), open ? tr('{n} ouvert|{n} ouverts', { n: open }) : tr('Tout est fermé'), nothing, this.back)}
      <div class="body">
        ${alarms.map(s => html`<button class="live glass" @click=${() => { this.detail = s.entity_id; }}><span class="ib">${mpIcon('shield', 18)}</span><div><b>${this.name(s.entity_id)}</b><small>${stateLabel(s.entity_id, s)}</small></div></button>`)}
        ${cameras.length ? html`<div class="cams">${cameras.map(s => html`<button class="cam" @click=${() => { this.detail = s.entity_id; }}><span style=${typeof s.attributes.entity_picture === 'string' ? `background-image:url("${s.attributes.entity_picture.replace(/"/g, '%22')}")` : ''}></span><b>${this.name(s.entity_id)}</b></button>`)}</div>` : nothing}
        ${locks.length ? html`<div class="rlab">${tr('Serrures')}</div><div class="sg">${locks.map(s => html`<div class="rw"><span class="ib">${mpIcon('lock', 16)}</span><div><b>${this.name(s.entity_id)}</b><small>${stateLabel(s.entity_id, s)}</small></div><span class="end"><button class="pill" @click=${() => this.call('lock', s.state === 'locked' ? 'unlock' : 'lock', { entity_id: s.entity_id })}>${s.state === 'locked' ? tr('Déverrouiller') : tr('Verrouiller')}</button></span></div>`)}</div>` : nothing}
        ${gates.length ? html`<div class="rlab">${tr('Portes et portails')}</div><div class="sg">${gates.map(s => html`<div class="rw"><span class="ib">${mpIcon('door', 16)}</span><div><b>${this.name(s.entity_id)}</b><small>${stateLabel(s.entity_id, s)}</small></div><span class="end"><button class="pill" @click=${() => this.call('cover', s.state === 'closed' ? 'open_cover' : 'close_cover', { entity_id: s.entity_id })}>${s.state === 'closed' ? tr('Ouvrir') : tr('Fermer#cover')}</button></span></div>`)}</div>` : nothing}
        ${cameras.length || locks.length || gates.length || alarms.length ? nothing : html`<p class="empty">${tr('Aucune caméra, serrure ni portail détecté.')}</p>`}
      </div>`;
  }
  /** What happened at home over the last day, newest first, for the devices of the dashboard and of the plan. */
  private historyPanel() {
    const log = this.logbook;
    return html`${this.head(tr('Historique'), tr('Dernières 24 heures'), nothing, this.back)}
      <div class="body">
        ${!log ? html`<p class="empty">${tr('Chargement…')}</p>` : log === 'error' ? html`<p class="empty">${tr('L’historique ne répond pas.')}</p>` : log.length ? html`<div class="sg">${log.map(e => html`<button class="rw" @click=${() => { if (e.entity_id) this.detail = e.entity_id; }}><span class="ib">${mpIcon(e.entity_id ? entityIcon(e.entity_id, this.state(e.entity_id)) : 'info', 16)}</span><div><b>${e.name ?? (e.entity_id ? this.name(e.entity_id) : '')}</b><small>${e.message ?? (e.entity_id && e.state ? stateLabel(e.entity_id, { ...this.state(e.entity_id)!, state: e.state }) : e.state ?? '')}</small></div><span class="end"><small>${new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit' }).format(e.when * 1000)}</small></span></button>`)}</div>` : html`<p class="empty">${tr('Rien ne s’est passé ces dernières 24 heures.')}</p>`}
      </div>`;
  }
  private loadLogbook() {
    const hass = this.hass;
    if (!hass || this.logbookAsked) return;
    this.logbookAsked = true;
    const ids = new Set([...this.entities, ...this.placedAll.flatMap(p => roomEntityIds(p.room)), ...this.media]);
    hass.callWS<LogEntry[]>({ type: 'logbook/get_events', start_time: new Date(Date.now() - 86_400_000).toISOString() })
      .then(events => { this.logbook = events.filter(e => !e.entity_id || ids.has(e.entity_id)).filter(e => e.entity_id).slice(-60).reverse(); })
      .catch(() => { this.logbook = 'error'; });
  }
  private backupPanel() {
    const admin = !!this.hass?.user?.is_admin;
    return html`${this.head(tr('Sauvegarde & partage'), this.lastExport ? tr('Dernière exportation : {when}', { when: new Intl.DateTimeFormat(locale(), { dateStyle: 'medium', timeStyle: 'short' }).format(this.lastExport) }) : tr('Configuration MP Nexus'), nothing, this.back)}
      <div class="body">
        <div class="live glass"><span class="ib" style="color:#9fd0ff">${mpIcon('layers', 18)}</span><div><b>${tr('Configuration complète')}</b><small>${tr('Tableau de bord, apparence, plan 3D et équipements')}</small></div></div>
        ${admin ? html`<div class="acts"><button class="btn primary" @click=${() => void this.exportProject(false)}>${mpIcon('download', 16)}${tr('Exporter')}</button>
          <label class="btn">${mpIcon('up', 16)}${tr('Restaurer')}<input type="file" accept="application/json,.json" hidden @change=${(e: Event) => void this.restoreProject(e)}></label></div>
          <button class="btn" @click=${() => void this.exportProject(true)}>${mpIcon('sparkle', 16)}${tr('Partager comme modèle (sans données privées)')}</button>
          ${this.backupState ? html`<p class=${`note ${this.backupState.ok ? 'ok' : ''}`}>${this.backupState.text}</p>` : nothing}`
          : html`<p class="empty">${tr('Seul un administrateur peut exporter ou restaurer la configuration.')}</p>`}
        <p class="note info">${tr('Le modèle garde le plan, les pièces et l’apparence, sans vos appareils, vos zones, vos photos ni le nom de la maison. Les sauvegardes complètes de Home Assistant restent dans Paramètres → Système → Sauvegardes.')}</p>
      </div>`;
  }
  private async exportProject(template: boolean) {
    const hass = this.hass;
    if (!hass) return;
    try {
      const { project } = await readProject(hass);
      const blob = new Blob([JSON.stringify(template ? projectTemplate(project) : project, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob); link.download = template ? backupName().replace('mp-nexus', 'mp-nexus-modele') : backupName();
      this.renderRoot.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(link.href), 5000);
      if (!template) { this.lastExport = Date.now(); try { localStorage.setItem(EXPORT_KEY, String(this.lastExport)); } catch { /* For this page only. */ } }
      this.backupState = { ok: true, text: template ? tr('Modèle téléchargé.') : tr('Configuration téléchargée.') };
    } catch { this.backupState = { ok: false, text: tr('La configuration n’a pas pu être lue.') }; }
  }
  private async restoreProject(event: Event) {
    const input = event.target as HTMLInputElement, file = input.files?.[0], hass = this.hass;
    input.value = '';
    if (!file || !hass) return;
    try {
      const project = parseProject(JSON.parse(await file.text()));
      const current = await readProject(hass);
      await saveProject(hass, { revision: current.revision, project });
      this.backupState = { ok: true, text: tr('Configuration restaurée. Rechargez la page pour la voir.') };
    } catch { this.backupState = { ok: false, text: tr('Ce fichier n’est pas une configuration MP Nexus valide.') }; }
  }
  // ——— Appearance: wallpaper, accent, glass and type, for this screen or the whole house ———
  private lookSummary() {
    const a = this.appearance, ambiance = ambianceOf(a), ref = a.wallpaper ?? (a.backgroundUrl ? undefined : DEFAULT_WALLPAPER);
    const look = ambiance ? tr(ambiance.name) : libraryWallpaper(ref) ? tr(libraryWallpaper(ref)!.name) : isImported(ref) ? tr('Votre photo') : tr('Image personnalisée');
    if (this.houseDraft) return tr('{look} · non enregistré', { look });
    return Object.keys(this.screenLook).length ? tr('{look} · propre à cet écran', { look }) : look;
  }
  /** What the panel edits: the house's look (with its draft) for an administrator, else the look this screen shows. */
  private get lookTarget(): AppearanceConfig { return this.lookScope === 'house' ? this.houseDraft ?? this.houseLook : this.appearance; }
  private setLook(change: Partial<AppearanceConfig>) {
    if (this.lookScope === 'house') this.houseDraft = { ...(this.houseDraft ?? this.houseLook), ...change };
    else { this.screenLook = cleanLook({ ...this.screenLook, ...change }); this.writeLook(this.screenLook); }
    this.lookNote = undefined;
    this.applyLook();
  }
  private loadImported() {
    const hass = this.hass;
    if (!hass || this.imported) return;
    this.imported = [];
    listWallpapers(hass).then(({ wallpapers, max }) => { this.imported = Array.isArray(wallpapers) ? wallpapers : []; if (typeof max === 'number') this.importedMax = max; this.requestUpdate(); }).catch(() => { /* An older integration: the library alone. */ });
  }
  private async importWallpaper(event: Event) {
    const input = event.target as HTMLInputElement, file = input.files?.[0], hass = this.hass;
    input.value = '';
    if (!file || !hass) return;
    this.lookBusy = true; this.lookNote = { ok: true, text: tr('Préparation de la photo…') }; this.requestUpdate();
    try {
      const id = await uploadWallpaper(hass, await prepareWallpaper(file));
      this.imported = [{ id, size: 0, modified: Date.now() / 1000 }, ...(this.imported ?? [])];
      this.pickWallpaper(id);
      this.lookNote = { ok: true, text: tr('Photo importée. « Assortir au fond » choisit une couleur qui lui va.') };
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      this.lookNote = { ok: false, text: code === 'too_many' ? tr('{n} photos au plus : supprimez-en une avant d’en importer une autre.', { n: this.importedMax }) : code === 'invalid_file' ? tr('Ce fichier n’est pas une image lisible.') : tr('La photo n’a pas pu être importée.') };
    } finally { this.lookBusy = false; this.requestUpdate(); }
  }
  private pendingRemoval = '';
  private async removeWallpaper(id: string) {
    const hass = this.hass;
    if (!hass) return;
    if (this.pendingRemoval !== id) { this.pendingRemoval = id; this.requestUpdate(); return; }
    this.pendingRemoval = '';
    try {
      await deleteWallpaper(hass, id);
      this.imported = (this.imported ?? []).filter(w => w.id !== id);
      if (this.screenLook.wallpaper === id || this.screenLook.nightWallpaper === id) { const { wallpaper, nightWallpaper, ...rest } = this.screenLook; this.screenLook = { ...rest, ...(wallpaper === id ? {} : { wallpaper }), ...(nightWallpaper === id ? {} : { nightWallpaper }) }; this.screenLook = cleanLook(this.screenLook); this.writeLook(this.screenLook); }
      this.lookNote = { ok: true, text: tr('Photo supprimée.') };
    } catch { this.lookNote = { ok: false, text: tr('La photo n’a pas pu être supprimée.') }; }
    this.applyLook();
  }
  private pickWallpaper(id: string | undefined) {
    if (this.lookSlot === 'night') { this.setLook({ nightWallpaper: id }); return; }
    const library = libraryWallpaper(id);
    this.setLook({ wallpaper: id, backgroundPosition: library?.position ?? 'center' });
  }
  /** The accent of a library wallpaper is chosen with it; for a photo, the most present vivid colour of the picture. */
  private async matchAccent() {
    const a = this.lookTarget, ref = a.wallpaper, library = libraryWallpaper(ref ?? (a.backgroundUrl ? undefined : DEFAULT_WALLPAPER));
    if (library) { this.setLook({ accent: library.accent, glassTint: library.tint }); return; }
    const accent = await accentOf(wallpaperSource(a, this.hass, false, () => undefined));
    if (accent) this.setLook({ accent });
    else this.lookNote = { ok: false, text: tr('La couleur de cette image n’a pas pu être lue.') };
    this.requestUpdate();
  }
  /** The choices of this screen are kept as they are made; the button says so and loads the page again, every view with them. */
  private saveScreenButton() {
    return html`<button class="btn primary" @click=${() => location.reload()}>${mpIcon('check', 16)}${tr('Enregistrer et recharger')}</button>`;
  }
  private async saveHouseLook() {
    const hass = this.hass, draft = this.houseDraft;
    if (!hass || !draft) return;
    const before = this.houseLook as unknown as Record<string, unknown>, after = draft as unknown as Record<string, unknown>;
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(key => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
    this.lookBusy = true; this.requestUpdate();
    try {
      const current = await readProject(hass);
      const appearance = { ...current.project.appearance } as Record<string, unknown>;
      for (const key of keys) { if (after[key] === undefined) delete appearance[key]; else appearance[key] = after[key]; }
      const saved = await saveProject(hass, { revision: current.revision, project: parseProject({ ...current.project, appearance }) });
      this.houseLook = savedHouse = saved.project.appearance; this.houseDraft = undefined;
      this.lookNote = { ok: true, text: tr('Enregistré pour toute la maison. Les autres écrans l’afficheront à leur prochain chargement.') };
      dispatchEvent(new CustomEvent(LOOK_CHANGED, { detail: this }));
      // The page loads again, as from Home Assistant: every view takes the saved look.
      setTimeout(() => location.reload(), 600);
    } catch { this.lookNote = { ok: false, text: tr('L’apparence n’a pas pu être enregistrée.') }; }
    this.lookBusy = false;
    this.applyLook();
  }
  private appearancePanel() {
    this.loadImported();
    const admin = !!this.hass?.user?.is_admin, house = this.lookScope === 'house', a = this.lookTarget, night = this.lookSlot === 'night';
    const current = night ? a.nightWallpaper : a.wallpaper ?? (a.backgroundUrl ? undefined : DEFAULT_WALLPAPER);
    const ambiance = ambianceOf(a), accent = a.accent ?? '#69b7ff', ready = () => this.requestUpdate();
    const range = (label: string, value: number, min: number, max: number, step: number, shown: string, change: (v: number) => void) => html`<label class="rng"><span><b>${label}</b><small>${shown}</small></span><input type="range" min=${min} max=${max} step=${step} .value=${String(value)} @input=${(e: Event) => change(Number((e.target as HTMLInputElement).value))}></label>`;
    const tile = (id: string | undefined, image: string | undefined, label: string, remove = false) => html`<div class="wp-cell"><button class="wp" aria-pressed=${current === id} aria-label=${label} title=${label} style=${image ? `background-image:${cssImage(image)}` : ''} @click=${() => this.pickWallpaper(id)}>${image ? nothing : html`<span class="wp-same">${mpIcon('sun', 18)}</span>`}<span class="wp-name">${label}</span></button>
      ${remove && admin ? html`<button class="wp-del" aria-label=${this.pendingRemoval === id ? tr('Confirmer la suppression') : tr('Supprimer')} title=${this.pendingRemoval === id ? tr('Confirmer la suppression') : tr('Supprimer')} data-confirm=${this.pendingRemoval === id} @click=${() => void this.removeWallpaper(id!)}>${this.pendingRemoval === id ? tr('Supprimer ?') : mpIcon('close', 14)}</button>` : nothing}</div>`;
    const fonts: ['elegant'|'modern'|'soft', 'Élégante'|'Moderne'|'Douce', string][] = [['elegant', 'Élégante', 'Georgia,serif'], ['modern', 'Moderne', 'Inter,system-ui,sans-serif'], ['soft', 'Douce', 'ui-rounded,system-ui,sans-serif']];
    const overridden = house && Object.keys(this.screenLook).length;
    return html`${this.head(tr('Apparence'), house ? tr('Pour toute la maison') : tr('Sur cet écran'), nothing, this.back)}
      <div class="body look">
        ${admin ? html`<div class="layers" role="group" aria-label=${tr('Appliquer à')}>
          <button aria-pressed=${!house} @click=${() => { this.lookScope = 'screen'; this.requestUpdate(); }}>${mpIcon('tv', 15)}<span>${tr('Cet écran')}</span></button>
          <button aria-pressed=${house} @click=${() => { this.lookScope = 'house'; this.requestUpdate(); }}>${mpIcon('home', 15)}<span>${tr('Toute la maison')}</span></button></div>`
          : html`<p class="note info">${tr('Vos choix s’appliquent à cet écran seulement.')}</p>`}
        ${overridden ? html`<p class="note info">${tr('Cet écran garde ses propres réglages par-dessus ceux de la maison.')} <button class="lnk" @click=${() => { this.screenLook = {}; this.writeLook({}); this.applyLook(); }}>${tr('Les retirer')}</button></p>` : nothing}

        <div class="rlab">${tr('Ambiances')}</div>
        <div class="amb">${AMBIANCES.map(x => { const w = libraryWallpaper(x.look.wallpaper)!; return html`<button class="amb-card" aria-pressed=${ambiance === x} style=${`--amb:${x.look.accent}`} @click=${() => this.setLook(x.look)}><span class="amb-img" style=${`background-image:${cssImage(w.thumb)}`}></span><span class="amb-name"><i></i>${tr(x.name)}</span></button>`; })}</div>

        <div class="rlab">${tr('Fond d’écran')}</div>
        <div class="layers" role="group" aria-label=${tr('Moment de la journée')}>
          <button aria-pressed=${!night} @click=${() => { this.lookSlot = 'day'; this.requestUpdate(); }}>${mpIcon('sun', 15)}<span>${tr('Jour')}</span></button>
          <button aria-pressed=${night} @click=${() => { this.lookSlot = 'night'; this.requestUpdate(); }}>${mpIcon('moon', 15)}<span>${a.nightWallpaper ? tr('Nuit') : tr('Nuit · comme le jour')}</span></button></div>
        ${night ? html`<p class="note">${tr('Ce fond remplace celui du jour du coucher au lever du soleil.')}</p>` : nothing}
        <div class="wps">
          ${night ? tile(undefined, undefined, tr('Comme le jour')) : nothing}
          ${(this.imported ?? []).map(w => tile(w.id, importedSource(this.hass, w.id, ready), tr('Votre photo'), true))}
          ${WALLPAPERS.map(w => tile(w.id, w.thumb, tr(w.name)))}
          ${admin ? html`<label class=${`wp wp-add ${this.lookBusy ? 'busy' : ''}`} title=${tr('Importer une photo')}>${mpIcon('up', 20)}<span>${tr('Importer une photo')}</span><input type="file" accept="image/*" hidden ?disabled=${this.lookBusy} @change=${(e: Event) => void this.importWallpaper(e)}></label>` : nothing}
        </div>
        ${!night && !current && a.backgroundUrl ? html`<p class="note">${tr('Image personnalisée du Studio : {path}', { path: a.backgroundUrl })}</p>` : nothing}
        <div class="layers" role="group" aria-label=${tr('Cadrage')}>${(['left', 'center', 'right'] as const).map(p => html`<button aria-pressed=${(a.backgroundPosition ?? 'right') === p} @click=${() => this.setLook({ backgroundPosition: p })}><span>${tr(p === 'left' ? 'Gauche' : p === 'center' ? 'Centre' : 'Droite')}</span></button>`)}</div>
        ${range(tr('Assombrissement'), Math.round((a.backgroundDim ?? .44) * 100), 0, 80, 1, `${Math.round((a.backgroundDim ?? .44) * 100)} %`, v => this.setLook({ backgroundDim: v / 100 }))}
        ${range(tr('Flou du fond'), a.backgroundBlur ?? 0, 0, 20, 1, `${a.backgroundBlur ?? 0} px`, v => this.setLook({ backgroundBlur: v }))}

        <div class="rlab">${tr('Couleur d’accentuation')}</div>
        <div class="sws">${ACCENTS.map(([value, name]) => html`<button class="swatch" style=${`--sw:${value}`} aria-pressed=${accent.toLowerCase() === value} aria-label=${tr(name)} title=${tr(name)} @click=${() => this.setLook({ accent: value })}></button>`)}
          <label class="swatch custom" aria-pressed=${!ACCENTS.some(([value]) => value === accent.toLowerCase())} title=${tr('Autre couleur')} style=${`--sw:${accent}`}>${mpIcon('palette', 15)}<input type="color" aria-label=${tr('Autre couleur')} .value=${accent} @input=${(e: Event) => this.setLook({ accent: (e.target as HTMLInputElement).value })}></label></div>
        <button class="btn" @click=${() => void this.matchAccent()}>${mpIcon('sparkle', 16)}${tr('Assortir au fond')}</button>

        <div class="rlab">${tr('Verre')}</div>
        ${range(tr('Opacité'), Math.round((a.glassOpacity ?? .62) * 100), 25, 90, 1, `${Math.round((a.glassOpacity ?? .62) * 100)} %`, v => this.setLook({ glassOpacity: v / 100 }))}
        ${range(tr('Flou du verre'), a.glassBlur ?? 22, 0, 40, 1, `${a.glassBlur ?? 22} px`, v => this.setLook({ glassBlur: v }))}
        ${range(tr('Arrondis'), a.radius ?? 22, 10, 38, 1, `${a.radius ?? 22} px`, v => this.setLook({ radius: v }))}
        <div class="sg"><div class="rw"><span class="ib">${mpIcon('palette', 16)}</span><div><b>${tr('Teinte du verre')}</b><small>${a.glassTint ?? '#12344f'}</small></div><span class="end"><input class="tint" type="color" aria-label=${tr('Teinte du verre')} .value=${a.glassTint ?? '#12344f'} @input=${(e: Event) => this.setLook({ glassTint: (e.target as HTMLInputElement).value })}></span></div>
          <div class="rw"><span class="ib">${mpIcon('sparkle', 16)}</span><div><b>${tr('Effets animés')}</b><small>${tr('Transitions et mouvements doux')}</small></div><button class="end" role="switch" aria-checked=${a.motion !== false} aria-label=${tr('Effets animés')} @click=${() => this.setLook({ motion: a.motion === false })}><span class=${`tgl ${a.motion !== false ? '' : 'off'}`}></span></button></div></div>

        <div class="rlab">${tr('Typographie')}</div>
        <div class="layers" role="group" aria-label=${tr('Typographie')}>${fonts.map(([value, label, family]) => html`<button aria-pressed=${(a.fontStyle ?? 'elegant') === value} style=${`font-family:${family};font-size:14px`} @click=${() => this.setLook({ fontStyle: value })}><span>${tr(label)}</span></button>`)}</div>

        ${this.lookNote ? html`<p class=${`note ${this.lookNote.ok ? 'ok' : ''}`} role="status">${this.lookNote.text}</p>` : nothing}
        ${house ? html`<div class="acts"><button class="btn" ?disabled=${!this.houseDraft || this.lookBusy} @click=${() => { this.houseDraft = undefined; this.lookNote = undefined; this.applyLook(); }}>${tr('Annuler')}</button>
          <button class="btn primary" ?disabled=${!this.houseDraft || this.lookBusy} @click=${() => void this.saveHouseLook()}>${mpIcon('check', 16)}${tr('Enregistrer pour la maison')}</button></div>`
          : html`${Object.keys(this.screenLook).length ? html`<button class="btn" @click=${() => { this.screenLook = {}; this.writeLook({}); this.lookNote = undefined; this.applyLook(); }}>${mpIcon('home', 16)}${tr('Reprendre le style de la maison')}</button>` : nothing}${this.saveScreenButton()}`}
      </div>`;
  }
  // ——— Personnaliser: the colours of the plan, its layers, the home page and the devices set aside ———
  private customizeSummary() {
    const a = this.appearance, hidden = a.hiddenEntities?.length ?? 0, colours = Object.keys(a.planColors ?? {}).length || (a.planGlow ?? 1) !== 1;
    return [colours ? tr('Couleurs du plan choisies') : tr('Couleurs du plan, calques, accueil'), hidden ? tr('{n} appareil masqué|{n} appareils masqués', { n: hidden }) : ''].filter(Boolean).join(' · ');
  }
  /** Only the colours that differ from those of MP Nexus are kept: a later change of the defaults still reaches the others. */
  private setPlanColors(colors: Partial<Record<PlanColor, string>>) {
    const kept = Object.fromEntries(PLAN_COLOR_KEYS.map(key => [key, colors[key]?.toLowerCase()]).filter(([key, value]) => value && value !== DEFAULT_PALETTE[key as PlanColor]));
    this.setLook({ planColors: Object.keys(kept).length ? kept : undefined });
  }
  private toggleListed<T extends string>(list: readonly T[] | undefined, item: T, on: boolean): T[] | undefined {
    const next = on ? [...new Set([...(list ?? []), item])] : (list ?? []).filter(x => x !== item);
    return next.length ? next : undefined;
  }
  private customizePanel() {
    const admin = !!this.hass?.user?.is_admin, house = this.lookScope === 'house', a = this.lookTarget, states = this.hass?.states ?? {};
    const palette = planPalette(a.planColors, a.planGlow), chosen = a.planColors ?? {};
    const toggle = (on: boolean, label: string, change: () => void) => html`<button class="end" role="switch" aria-checked=${on} aria-label=${label} @click=${change}><span class=${`tgl ${on ? '' : 'off'}`}></span></button>`;
    const row = (icon: MPIconName, title: string, sub: string, on: boolean, change: () => void) => html`<div class="rw"><span class="ib">${mpIcon(icon, 16)}</span><div><b>${title}</b><small>${sub}</small></div>${toggle(on, title, change)}</div>`;
    const colour = (key: PlanColor, label: string) => html`<div class="pcl"><label class="pc" style=${`--sw:${palette[key]}`} title=${label}><input type="color" aria-label=${label} .value=${palette[key]} @input=${(e: Event) => this.setPlanColors({ ...chosen, [key]: (e.target as HTMLInputElement).value })}></label><span>${label}</span></div>`;
    const palettes = PLAN_PALETTES.map(p => ({ ...p, colors: p.name === 'Accent' ? accentPalette(this.appearance.accent ?? '#69b7ff') : p.colors }));
    const current = palettes.find(p => PLAN_COLOR_KEYS.every(key => (p.colors[key] ?? DEFAULT_PALETTE[key]).toLowerCase() === palette[key].toLowerCase()));
    const layers: [Exclude<PlanMode, 'lights'>, MPIconName, MessageKey, string][] = [['climate', 'thermo', 'Climat', tr('Températures pièce par pièce')], ['openings', 'window', 'Ouvrants', tr('Portes, fenêtres et volets')], ['media', 'tv', 'Audio-vidéo', tr('Télévisions et enceintes')], ['laundry', 'washer', 'Buanderie', tr('Lave-linge et sèche-linge')]];
    const hidden = new Set(a.hiddenEntities ?? []), query = fold(this.hideQuery.trim());
    const groups: [string, MPIconName, string, (id: string) => boolean][] = [
      ['players', 'speaker', tr('Lecteurs multimédia'), id => id.startsWith('media_player.')], ['lights', 'bulb', tr('Lumières'), id => id.startsWith('light.')],
      ['covers', 'shutter', tr('Volets et portails'), id => id.startsWith('cover.')], ['climate', 'thermo', tr('Climat'), id => id.startsWith('climate.')],
      ['switches', 'power', tr('Prises et interrupteurs'), id => ['switch', 'fan', 'input_boolean'].includes(domainOf(id))],
    ];
    const all = Object.keys(states).sort((x, y) => this.name(x).localeCompare(this.name(y), locale()));
    const device = (id: string) => { const shown = !hidden.has(id), name = this.name(id), room = shown ? this.roomOfEntity(id) : undefined;
      return html`<div class=${`rw ${shown ? '' : 'off'}`}><span class="ib">${mpIcon(entityIcon(id, states[id]), 16)}</span><div><b>${name}</b><small>${shown ? room ?? id : tr('Masqué · ni affiché, ni compté')}</small></div>${toggle(shown, tr('Afficher {name}', { name }), () => this.setLook({ hiddenEntities: this.toggleListed(a.hiddenEntities, id, shown) }))}</div>`; };
    return html`${this.head(tr('Personnaliser'), house ? tr('Pour toute la maison') : tr('Sur cet écran'), nothing, this.back)}
      <div class="body look">
        ${admin ? html`<div class="layers" role="group" aria-label=${tr('Appliquer à')}>
          <button aria-pressed=${!house} @click=${() => { this.lookScope = 'screen'; this.requestUpdate(); }}>${mpIcon('tv', 15)}<span>${tr('Cet écran')}</span></button>
          <button aria-pressed=${house} @click=${() => { this.lookScope = 'house'; this.requestUpdate(); }}>${mpIcon('home', 15)}<span>${tr('Toute la maison')}</span></button></div>`
          : html`<p class="note info">${tr('Vos choix s’appliquent à cet écran seulement.')}</p>`}

        <div class="rlab">${tr('Couleurs du plan 3D')}</div>
        <div class="pals">${palettes.map(p => html`<button class="pal" aria-pressed=${current === p} @click=${() => this.setPlanColors(p.colors)}><span class="pal-dots">${(['lights', 'selected', 'open', 'media', 'hot'] as const).map(key => html`<i style=${`background:${p.colors[key] ?? DEFAULT_PALETTE[key]}`}></i>`)}</span><span>${tr(p.name)}</span></button>`)}</div>
        <p class="hint-text">${tr('Touchez une pastille pour choisir sa couleur.')}</p>
        <div class="rsub">${tr('Pièces')}</div>
        <div class="pcs">${colour('lights', tr('Lumière allumée'))}${colour('selected', tr('Pièce choisie'))}${colour('room', tr('Pièces au repos'))}${colour('house', tr('Halo sous la maison'))}</div>
        <div class="rsub">${tr('Calques')}</div>
        <div class="pcs">${colour('open', tr('Porte ou fenêtre ouverte'))}${colour('daylight', tr('Volets ouverts'))}${colour('media', tr('Média en lecture'))}${colour('laundry', tr('Machine en cours'))}</div>
        <div class="rsub">${tr('Températures')}</div>
        <div class="pcs">${colour('cold', '< 18 °C')}${colour('cool', '18 – 21 °C')}${colour('mild', '21 – 24 °C')}${colour('hot', '≥ 24 °C')}</div>
        <label class="rng"><span><b>${tr('Intensité des halos')}</b><small>${Math.round(palette.glow * 100)} %</small></span><input type="range" min="30" max="180" step="5" .value=${String(Math.round(palette.glow * 100))} @input=${(e: Event) => { const v = Number((e.target as HTMLInputElement).value) / 100; this.setLook({ planGlow: v === 1 ? undefined : v }); }}></label>
        ${a.planColors || a.planGlow !== undefined ? html`<button class="btn" @click=${() => this.setLook({ planColors: undefined, planGlow: undefined })}>${mpIcon('back', 16)}${tr('Couleurs d’origine')}</button>` : nothing}

        <div class="rlab">${tr('Calques du plan')}</div>
        <div class="sg">${row('bulb', tr('Lumières'), tr('Toujours proposé'), true, () => undefined)}${layers.map(([mode, icon, label, sub]) => row(icon, tr(label), sub, !a.hiddenLayers?.includes(mode), () => this.setLook({ hiddenLayers: this.toggleListed(a.hiddenLayers, mode, !a.hiddenLayers?.includes(mode)) })))}</div>

        <div class="rlab">${tr('Accueil')}</div>
        <div class="sg">
          ${row('gauge', tr('Résumé de la maison'), tr('Lumières, températures, ouvertures en un coup d’œil'), a.showStats !== false, () => this.setLook({ showStats: a.showStats === false }))}
          ${row('sparkle', tr('Scènes'), tr('Sous le plan de l’accueil'), a.showScenes !== false, () => this.setLook({ showScenes: a.showScenes === false }))}
          ${row('clock', tr('Horloge'), tr('Dans la barre du haut sur grand écran'), a.showClock !== false, () => this.setLook({ showClock: a.showClock === false }))}
        </div>

        <div class="rlab">${tr('Appareils affichés')}</div>
        <p class="hint-text">${tr('Un appareil masqué disparaît de MP Nexus : il n’est plus affiché, ni compté sur le plan, l’accueil ou le multimédia.')}</p>
        <label class="srch"><span class="inp">${mpIcon('search', 16)}<input type="search" placeholder=${tr('Rechercher un appareil')} aria-label=${tr('Rechercher un appareil')} .value=${this.hideQuery} @input=${(e: Event) => { this.hideQuery = (e.target as HTMLInputElement).value; this.requestUpdate(); }}></span></label>
        ${groups.map(([key, icon, title, test]) => {
          const ids = all.filter(id => test(id) && (!query || fold(`${this.name(id)} ${id}`).includes(query)));
          if (!ids.length) return nothing;
          const off = ids.filter(id => hidden.has(id)).length;
          return html`<details class="hide-group" ?open=${!!query || key === 'players'}><summary><span class="ib">${mpIcon(icon, 16)}</span><b>${title}</b><small>${off ? tr('{n} masqué sur {total}|{n} masqués sur {total}', { n: off, total: ids.length }) : tr('{n} affiché|{n} affichés', { n: ids.length })}</small></summary><div class="sg">${ids.map(device)}</div></details>`;
        })}
        ${hidden.size ? html`<button class="btn" @click=${() => this.setLook({ hiddenEntities: undefined })}>${mpIcon('check', 16)}${tr('Tout réafficher')}</button>` : nothing}

        ${this.lookNote ? html`<p class=${`note ${this.lookNote.ok ? 'ok' : ''}`} role="status">${this.lookNote.text}</p>` : nothing}
        ${house ? html`<div class="acts"><button class="btn" ?disabled=${!this.houseDraft || this.lookBusy} @click=${() => { this.houseDraft = undefined; this.lookNote = undefined; this.applyLook(); }}>${tr('Annuler')}</button>
          <button class="btn primary" ?disabled=${!this.houseDraft || this.lookBusy} @click=${() => void this.saveHouseLook()}>${mpIcon('check', 16)}${tr('Enregistrer pour la maison')}</button></div>` : this.saveScreenButton()}
      </div>`;
  }
  private hideQuery = '';
  private saverPanel() {
    const saver = this.saver, set = (change: Partial<SaverPrefs>) => { this.saver = { ...saver, ...change }; writeSaver(this.saver); this.lastActivity = Date.now(); };
    const sensors = this.ofDomain('binary_sensor', s => ['motion', 'occupancy', 'presence'].includes(String(s.attributes.device_class ?? '')));
    const widgets: [SaverWidget, 'Heure'|'Météo'|'Minuteur'|'Musique'|'Alertes'|'Qui est là'][] = [['clock', 'Heure'], ['weather', 'Météo'], ['timer', 'Minuteur'], ['music', 'Musique'], ['alerts', 'Alertes'], ['people', 'Qui est là']];
    const contents: [SaverContent, 'Photos'|'Plan 3D'|'Horloge'][] = [['photos', 'Photos'], ['plan', 'Plan 3D'], ['clock', 'Horloge']];
    const sources: [SaverPhotos, 'Toutes les photos'|'Mes photos'|'La bibliothèque'][] = [['all', 'Toutes les photos'], ['mine', 'Mes photos'], ['library', 'La bibliothèque']];
    const transitions: [SaverTransition, 'Au hasard'|'Fondu'|'Glissement'|'Zoom'|'Flou'|'Balayage'|'Cercle'][] = [['random', 'Au hasard'], ['fade', 'Fondu'], ['slide', 'Glissement'], ['zoom', 'Zoom'], ['blur', 'Flou'], ['wipe', 'Balayage'], ['circle', 'Cercle']];
    const spins: [SaverSpin, 'Arrêtée'|'Lente'|'Normale'|'Rapide'][] = [['off', 'Arrêtée'], ['slow', 'Lente'], ['normal', 'Normale'], ['fast', 'Rapide']];
    const every = (n: number) => n < 60 ? tr('{n} s', { n }) : tr('{n} min', { n: n / 60 });
    const choice = <T extends string | number>(label: string, value: T, options: [T, string][], change: (value: string) => void) =>
      html`<select aria-label=${label} @change=${(e: Event) => change((e.target as HTMLSelectElement).value)}>${options.map(([v, text]) => html`<option value=${String(v)} .selected=${v === value}>${text}</option>`)}</select>`;
    const mine = this.imported?.length ?? 0;
    return html`${this.head(tr('Écran de veille'), saver.enabled ? tr('Après {n} min sans toucher l’écran', { n: saver.delayMinutes }) : tr('Désactivé sur cet écran'), html`<button class="end" role="switch" aria-checked=${saver.enabled} aria-label=${tr('Écran de veille')} @click=${() => set({ enabled: !saver.enabled })}><span class=${`tgl ${saver.enabled ? '' : 'off'}`}></span></button>`, this.back)}
      <div class="body">
        <div class="rlab">${tr('Contenu')}</div>
        <div class="layers">${contents.map(([value, label]) => html`<button aria-pressed=${saver.content === value} @click=${() => set({ content: value })}><span>${tr(label)}</span></button>`)}</div>
        ${saver.content === 'photos' ? html`<div class="sg">
          <div class="rw"><span class="ib">${mpIcon('palette', 16)}</span><div><b>${tr('Diaporama')}</b><small>${mine ? tr('{n} photo importée|{n} photos importées', { n: mine }) : tr('Importez-les dans Apparence')}</small></div><span class="end">${choice(tr('Diaporama'), saver.photos, sources.map(([v, l]) => [v, tr(l)]), v => set({ photos: v as SaverPhotos }))}</span></div>
          <div class="rw"><span class="ib">${mpIcon('sparkle', 16)}</span><div><b>${tr('Transition')}</b><small>${tr('Entre deux photos')}</small></div><span class="end">${choice(tr('Transition'), saver.transition, transitions.map(([v, l]) => [v, tr(l)]), v => set({ transition: v as SaverTransition }))}</span></div>
          <div class="rw"><span class="ib">${mpIcon('repeat', 16)}</span><div><b>${tr('Photo suivante')}</b><small>${tr('après')}</small></div><span class="end">${choice(tr('Photo suivante'), saver.photoSeconds, SAVER_PHOTO_SECONDS.map(n => [n, every(n)]), v => set({ photoSeconds: Number(v) }))}</span></div>
        </div>` : saver.content === 'plan' ? html`<div class="sg">
          <div class="rw"><span class="ib">${mpIcon('orbit', 16)}</span><div><b>${tr('Rotation du plan')}</b><small>${tr('La maison tourne lentement sur elle-même')}</small></div><span class="end">${choice(tr('Rotation du plan'), saver.spin, spins.map(([v, l]) => [v, tr(l)]), v => set({ spin: v as SaverSpin }))}</span></div>
          <div class="rw"><span class="ib">${mpIcon('layers', 16)}</span><div><b>${tr('Changer de calque')}</b><small>${tr('Lumières, climat, ouvrants… à tour de rôle')}</small></div><button class="end" role="switch" aria-checked=${saver.cycleLayers} aria-label=${tr('Changer de calque')} @click=${() => set({ cycleLayers: !saver.cycleLayers })}><span class=${`tgl ${saver.cycleLayers ? '' : 'off'}`}></span></button></div>
          ${saver.cycleLayers ? html`<div class="rw"><span class="ib">${mpIcon('repeat', 16)}</span><div><b>${tr('Calque suivant')}</b><small>${tr('après')}</small></div><span class="end">${choice(tr('Calque suivant'), saver.layerSeconds, SAVER_LAYER_SECONDS.map(n => [n, every(n)]), v => set({ layerSeconds: Number(v) }))}</span></div>` : nothing}
        </div>` : nothing}
        <div class="rlab">${tr('Afficher')}</div>
        <div class="houses wrap">${widgets.map(([value, label]) => html`<button class="pill" aria-pressed=${saver.widgets.includes(value)} @click=${() => set({ widgets: saver.widgets.includes(value) ? saver.widgets.filter(x => x !== value) : [...saver.widgets, value] })}>${tr(label)}</button>`)}</div>
        <div class="sg">
          <div class="rw"><span class="ib">${mpIcon('sun', 16)}</span><div><b>${tr('Démarrer après')}</b><small>${tr('sans toucher l’écran')}</small></div><span class="end"><select aria-label=${tr('Démarrer après')} @change=${(e: Event) => set({ delayMinutes: Number((e.target as HTMLSelectElement).value) })}>${SAVER_DELAYS.map(n => html`<option value=${n} .selected=${n === saver.delayMinutes}>${tr('{n} min', { n })}</option>`)}</select></span></div>
          <div class="rw"><span class="ib">${mpIcon('moon', 16)}</span><div><b>${tr('Assombrir la nuit')}</b><small>${tr('23:00 – 7:00 · luminosité 15 %')}</small></div><button class="end" role="switch" aria-checked=${saver.nightDim} aria-label=${tr('Assombrir la nuit')} @click=${() => set({ nightDim: !saver.nightDim })}><span class=${`tgl ${saver.nightDim ? '' : 'off'}`}></span></button></div>
          <div class="rw"><span class="ib">${mpIcon('motion', 16)}</span><div><b>${tr('Réveil à l’approche')}</b><small>${tr('Un capteur de présence réveille l’écran')}</small></div><span class="end"><select aria-label=${tr('Réveil à l’approche')} @change=${(e: Event) => set({ wakeSensor: (e.target as HTMLSelectElement).value })}><option value="" .selected=${!saver.wakeSensor}>${tr('Aucun')}</option>${sensors.map(s => html`<option value=${s.entity_id} .selected=${saver.wakeSensor === s.entity_id}>${this.name(s.entity_id)}</option>`)}</select></span></div>
        </div>
        <button class="btn primary" @click=${() => { this.saving = true; this.saverSince = Date.now(); }}>${mpIcon('play', 16)}${tr('Aperçu')}</button>
      </div>`;
  }
  /** The photos of the slideshow, as backgrounds: imported ones once fetched, then the library; the library alone while none is imported. */
  private saverPhotos(): string[] {
    const which = this.saver.photos, ready = () => this.requestUpdate();
    const mine = which === 'library' ? [] : (this.imported ?? []).flatMap(w => { const url = importedSource(this.hass, w.id, ready); return url ? [`background-image:${cssImage(url)};background-position:center`] : []; });
    const library = which === 'mine' && this.imported?.length ? [] : WALLPAPERS.map(w => `background-image:${cssImage(w.url)};background-position:${w.position} center`);
    return [...mine, ...library];
  }
  /** The photo on screen and the one it covers, each kept in place by its number so its slow drift never jumps. */
  private slideshow(background: string, elapsed: number) {
    const photos = this.saverPhotos(), n = photos.length;
    if (!n) return html`<div class="backdrop kb" style=${background}></div>`;
    const step = cycleStep(elapsed, this.saver.photoSeconds), shown = step > 0 ? [step - 1, step] : [step];
    return repeat(shown, i => i, i => html`<div class=${`pic ${i === step && step > 0 ? `in ${slideTransition(this.saver.transition, step)}` : ''}`}><div class=${`backdrop ${i % 2 ? 'kb2' : 'kb'}`} style=${photos[i % n]!}></div></div>`);
  }
  private saverAmbiance = (e: CustomEvent<{ mode: PlanMode; floorIds: string[]; modes?: PlanMode[] }>) => { if (e.detail.modes?.length && e.detail.modes.join() !== this.saverLayers.join()) { this.saverLayers = e.detail.modes; this.requestUpdate(); } };
  /** The layer the screensaver's plan shows: the one of the page, or each in turn. */
  private saverLayer(elapsed: number): PlanMode | undefined {
    const offered = this.saverLayers.length ? this.saverLayers : this.layers;
    if (!this.saver.cycleLayers || offered.length < 2) return undefined;
    return offered[cycleStep(elapsed, this.saver.layerSeconds) % offered.length];
  }
  private saverTick = () => {
    const elapsed = Date.now() - this.saverSince, saver = this.saver;
    const step = saver.content === 'photos' ? `p${cycleStep(elapsed, saver.photoSeconds)}` : saver.content === 'plan' ? `l${cycleStep(elapsed, saver.layerSeconds)}` : '';
    if (step !== this.saverStep) { this.saverStep = step; this.requestUpdate(); }
  };
  /** The screen at rest: a photo, the plan or a clock, with the few things worth seeing from across the room. */
  private screensaver(background: string) {
    const saver = this.saver, now = new Date(), states = this.hass?.states ?? {}, elapsed = Date.now() - this.saverSince;
    const has = (w: SaverWidget) => saver.widgets.includes(w);
    const weather = this.ofDomain('weather', s => available(s))[0], playing = this.media.find(id => mediaPlaying(states[id]));
    const timer = this.ofDomain('timer', s => s.state === 'active')[0], left = timerLeft(timer);
    const alerts = unseen(this.alerts, this.prefs), home = this.persons.filter(p => p.home);
    const dim = saver.nightDim && inQuietHours(now), layer = saver.content === 'plan' ? this.saverLayer(elapsed) : undefined;
    return html`<div class=${`saver ${saver.content}`} role="dialog" aria-label=${tr('Écran de veille')} @pointerdown=${this.wake}>
      ${saver.content === 'photos' ? this.slideshow(background, elapsed) : saver.content === 'plan' ? html`<div class="backdrop" style=${`${background};filter:brightness(.4)`}></div><div class="splan">${this.viewer({ key: 'saver', quiet: true, layer, spin: SAVER_SPIN[saver.spin], ambiance: this.saverAmbiance })}${layer ? keyed(layer, html`<div class="slayer">${mpIcon(PLAN_LAYERS[layer].icon, 16)}<span>${layer === 'media' ? tr('Médias') : tr(PLAN_LAYERS[layer].label)}</span></div>`) : nothing}</div>` : nothing}
      <div class="sl">
        ${has('clock') || saver.content === 'clock' ? html`<div class="sclock">${new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit' }).format(now)}</div><div class="sdate">${new Intl.DateTimeFormat(locale(), { weekday: 'long', day: 'numeric', month: 'long' }).format(now)}</div>` : nothing}
        ${has('weather') && weather ? html`<div class="sw">${mpIcon(weatherIcon(weather.state), 22)}<div><b>${finite(weather.attributes.temperature) === undefined ? weather.state : `${this.format(finite(weather.attributes.temperature)!)}°`}</b><small>${weatherName(weather.state)}</small></div></div>` : nothing}
        ${has('timer') && timer && left !== undefined ? html`<div class="sw"><span class="ring">${clockTime(left)}</span><div><b>${tr('Minuteur')}</b><small>${this.name(timer.entity_id)}</small></div></div>` : nothing}
        ${has('music') && playing ? html`<div class="sw"><span class="art">${this.mediaImage(states[playing]?.attributes.entity_picture)}</span><div><b>${nowPlaying(states[playing]) ?? ''}</b><small>${this.playerLabel(playing)}</small></div></div>` : nothing}
        ${has('alerts') && alerts.length ? html`<div class="sw warn">${mpIcon('bell', 22)}<div><b>${this.name(alerts[0]!.entity)}</b><small>${tr('{n} alerte|{n} alertes', { n: alerts.length })}</small></div></div>` : nothing}
        ${has('people') && home.length ? html`<div class="sw"><span class="who stack">${home.slice(0, 4).map(p => this.avatar(p, 30, this.persons.indexOf(p)))}</span><div><b>${tr('À la maison')}</b><small>${home.map(p => p.name).join(', ')}</small></div></div>` : nothing}
      </div>
      <div class="shint">${tr('Touchez pour revenir')}</div>
      ${dim ? html`<div class="sdim"></div>` : nothing}
    </div>`;
  }
  private wake = () => { this.saving = false; this.lastActivity = Date.now(); };
  private activity = () => { this.lastActivity = Date.now(); };
  private checkIdle() {
    const saver = this.saver;
    if (saver.enabled && !this.saving && Date.now() - this.lastActivity > saver.delayMinutes * 60_000) { this.saving = true; this.saverSince = Date.now(); }
    const sensor = saver.wakeSensor ? this.state(saver.wakeSensor) : undefined;
    if (this.saving && sensor?.state === 'on' && Date.parse(sensor.last_changed ?? '') > this.saverSince) this.wake();
  }

  // ——— Plus, info and the other devices ———
  // ——— Users: guests invited by a link or a QR code ———
  private when(seconds: number) { return new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(seconds * 1000); }
  private loadGuests(force = false) {
    const hass = this.hass;
    if (!hass || (this.guestsAsked && !force)) return;
    this.guestsAsked = true;
    listGuests(hass).then(list => { this.guests = list; }).catch(() => { this.guests = 'error'; });
    if (!force) void networkCheck(hass).then(result => { this.network = result; });
  }
  private async guestAction(work: () => Promise<unknown>, failure: string) {
    this.guestNote = undefined;
    try { await work(); } catch { this.guestNote = { ok: false, text: failure }; }
    this.loadGuests(true);
  }
  private async showInvitation(guest: Guest | { id: string; name: string }, mode: Invitation['mode']) {
    const hass = this.hass;
    if (!hass) return;
    await this.guestAction(async () => {
      const invitation = await invite(hass, guest.id, mode);
      this.invitation = { guest: guest.name, invitation, qr: mode === 'qr' ? await qrCode(invitation.url) : undefined };
      this.overlay = 'invite';
    }, tr('L’invitation n’a pas pu être créée.'));
  }
  private async showPassword(guest: Guest) {
    const hass = this.hass;
    if (!hass) return;
    await this.guestAction(async () => {
      const password = await guestPassword(hass, guest.id);
      this.invitation = { guest: guest.name, password, qr: await qrCode(location.origin) };
      this.overlay = 'invite';
    }, tr('Le mot de passe n’a pas pu être créé.'));
  }
  private usersPanel() {
    const hass = this.hass, list = this.guests, now = Date.now() / 1000;
    const live = Array.isArray(list) ? list.filter(g => guestStatus(g, now) !== 'ended').length : 0;
    const describe = (g: Guest) => [g.profile === 'read' ? tr('Lecture seule') : tr('Peut commander'), g.kind === 'temporary' && g.until ? tr('jusqu’au {when}', { when: this.when(g.until) }) : tr('Permanent'), g.local_only ? tr('Wi-Fi de la maison') : ''].filter(Boolean).join(' · ');
    const status = (g: Guest) => { const st = guestStatus(g, now); return st === 'ended' ? tr('Accès terminé') : st === 'invited' ? tr('Invitation en attente jusqu’à {time}', { time: new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit' }).format(g.invite!.expires * 1000) }) : st === 'active' ? tr('Connecté sur {n} appareil|Connecté sur {n} appareils', { n: g.sessions }) : tr('Pas encore connecté'); };
    const pill = (icon: MPIconName, label: string, act: () => void, danger = false) => html`<button class=${`pill ${danger ? 'danger' : ''}`} @click=${act}>${mpIcon(icon, 13)}${label}</button>`;
    const row = (g: Guest) => {
      const ended = guestStatus(g, now) === 'ended';
      return html`<div class=${`guest ${ended ? 'ended' : ''}`}><div class="rw"><span class="av" style="width:36px;height:36px;font-size:15px;background:linear-gradient(135deg,#65b5ff,#327ccd)">${g.name.trim().charAt(0).toLocaleUpperCase(locale())}</span><div><b>${g.name}</b><small>${describe(g)}</small><small class=${`st ${guestStatus(g, now)}`}>${status(g)}</small></div></div>
        <div class="houses wrap">${ended ? pill('close', tr('Supprimer'), () => { if (hass) void this.guestAction(() => removeGuest(hass, g.id), tr('Home Assistant a refusé.')); }, true)
          : html`${pill('qr', tr('QR code'), () => void this.showInvitation(g, 'qr'))}${pill('link', tr('Lien'), () => void this.showInvitation(g, 'link'))}${pill('key', tr('Mot de passe'), () => void this.showPassword(g))}${pill('stop', tr('Arrêter l’accès'), () => { if (hass) void this.guestAction(() => endGuest(hass, g.id), tr('Home Assistant a refusé.')); }, true)}`}</div></div>`;
    };
    return html`${this.head(tr('Utilisateurs'), Array.isArray(list) ? tr('{n} invité actif|{n} invités actifs', { n: live }) : tr('Invités par lien ou QR code'), html`<button class="btn primary sm" @click=${() => { this.guestDraft = newGuest(); this.guestNote = undefined; this.sub = { type: 'guest', id: '' }; }}>${mpIcon('plus', 15)}${tr('Inviter')}</button>`, this.back)}
      <div class="body">
        ${this.network === 'proxy' ? html`<p class="note">${tr('Home Assistant vous voit comme connecté depuis la maison alors que vous passez par une adresse publique : « Wi-Fi de la maison seulement » ne protège pas ici. Réglez use_x_forwarded_for et trusted_proxies dans Home Assistant.')}</p>` : nothing}
        ${this.guestNote ? html`<p class=${`note ${this.guestNote.ok ? 'ok' : ''}`}>${this.guestNote.text}</p>` : nothing}
        ${list === undefined ? html`<p class="empty">${tr('Chargement…')}</p>` : list === 'error' ? html`<p class="empty">${tr('Les invités ne répondent pas. Mettez MP Nexus à jour dans HACS puis redémarrez Home Assistant.')}</p>`
          : list.length ? html`<div class="sg guests">${list.map(row)}</div>` : html`<p class="empty">${tr('Aucun invité pour le moment. Invitez une personne : elle scanne le QR code et arrive sur MP Nexus, sans mot de passe.')}</p>`}
        <p class="note info">${tr('Chaque invité est un utilisateur Home Assistant, jamais administrateur. Une invitation ne sert qu’une fois : 15 minutes pour un QR code, 24 heures pour un lien. « Arrêter l’accès » le déconnecte partout.')}</p>
      </div>`;
  }
  private guestPanel() {
    const hass = this.hass, draft = this.guestDraft, set = (change: Partial<GuestDraft>) => { this.guestDraft = { ...draft, ...change }; };
    const chip = (on: boolean, icon: MPIconName, label: string, pick: () => void) => html`<button class="pill" aria-pressed=${on} @click=${pick}>${mpIcon(icon, 13)}${label}</button>`;
    const ready = !!draft.name.trim() && (draft.kind === 'permanent' || (draft.until ?? 0) > Date.now() / 1000);
    const create = () => { if (!hass || !ready) return; void this.guestAction(async () => { const guest = await createGuest(hass, { ...draft, name: draft.name.trim() }); this.sub = { type: 'users', id: '' }; await this.showInvitation(guest, 'qr'); }, tr('Home Assistant a refusé la création de l’invité.')); };
    return html`${this.head(tr('Inviter quelqu’un'), tr('Jamais administrateur'), nothing, () => { this.sub = { type: 'users', id: '' }; })}
      <div class="body">
        <label class="inp wide">${mpIcon('user', 16)}<input .value=${draft.name} maxlength="40" placeholder=${tr('Prénom ou nom')} aria-label=${tr('Prénom ou nom')} @input=${(e: Event) => set({ name: (e.target as HTMLInputElement).value })}></label>
        <div class="rlab">${tr('Durée')}</div>
        <div class="houses wrap">
          ${chip(draft.kind === 'temporary', 'moon', tr('Temporaire'), () => set({ kind: 'temporary', until: draft.until ?? defaultUntil(), profile: 'read', local_only: true }))}
          ${chip(draft.kind === 'permanent', 'home', tr('Permanent'), () => set({ kind: 'permanent' }))}
        </div>
        ${draft.kind === 'temporary' ? html`<label class="vol">${mpIcon('sun', 16)}<input type="datetime-local" .value=${localInput(draft.until ?? defaultUntil())} aria-label=${tr('Fin de l’accès')} @change=${(e: Event) => { const at = Date.parse((e.target as HTMLInputElement).value); if (Number.isFinite(at)) set({ until: at / 1000 }); }}><span></span></label>` : nothing}
        <div class="rlab">${tr('Ce que la personne peut faire')}</div>
        <div class="houses wrap">
          ${chip(draft.profile === 'read', 'scan', tr('Lecture seule'), () => set({ profile: 'read' }))}
          ${chip(draft.profile === 'user', 'power', tr('Peut commander'), () => set({ profile: 'user' }))}
        </div>
        ${draft.profile === 'user' ? html`<p class="note">${tr('Home Assistant n’a pas de droits par appareil : cette personne pourra tout commander, y compris ouvrir la serrure et couper l’alarme, même ce que MP Nexus masque.')}</p>` : html`<p class="note info">${tr('Voit l’état de la maison, ne peut rien commander.')}</p>`}
        <div class="sg"><div class="rw"><span class="ib">${mpIcon('home', 16)}</span><div><b>${tr('Wi-Fi de la maison seulement')}</b><small>${tr('Refuse toute connexion depuis l’extérieur')}</small></div>
          <button class="end" role="switch" aria-checked=${draft.local_only} aria-label=${tr('Wi-Fi de la maison seulement')} @click=${() => set({ local_only: !draft.local_only })}><span class=${`tgl ${draft.local_only ? '' : 'off'}`}></span></button></div></div>
        ${this.network === 'proxy' && draft.local_only ? html`<p class="note">${tr('Attention : derrière votre proxy, Home Assistant voit toutes les connexions comme locales.')}</p>` : nothing}
        ${this.guestNote ? html`<p class=${`note ${this.guestNote.ok ? 'ok' : ''}`}>${this.guestNote.text}</p>` : nothing}
        <button class="btn primary" ?disabled=${!ready} @click=${create}>${mpIcon('qr', 16)}${tr('Créer et inviter')}</button>
      </div>`;
  }
  private invitePanel() {
    const shown = this.invitation;
    if (!shown) return nothing;
    const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); this.invitation = { ...shown, copied: true }; } catch { /* The text stays selectable. */ } };
    const close = html`<button class="ib" aria-label=${tr('Fermer')} @click=${this.closeOverlay}>${mpIcon('close', 16)}</button>`;
    if (shown.password) return html`${this.head(shown.guest, tr('Identifiants, affichés une seule fois'), close)}
      <div class="body invite">
        ${shown.qr ? html`<img class="qr" src=${shown.qr} alt=${tr('QR code de l’adresse de Home Assistant')}>` : nothing}
        <div class="sg"><div class="rw"><span class="ib">${mpIcon('user', 16)}</span><div><small>${tr('Nom d’utilisateur')}</small><b class="mono">${shown.password.username}</b></div></div>
          <div class="rw"><span class="ib">${mpIcon('key', 16)}</span><div><small>${tr('Mot de passe')}</small><b class="mono">${shown.password.password}</b></div><button class="end pill" @click=${() => void copy(shown.password!.password)}>${mpIcon('copy', 13)}${shown.copied ? tr('Copié') : tr('Copier')}</button></div></div>
        <p class="note info">${tr('Le QR code ouvre Home Assistant ; la personne s’y connecte avec ces identifiants. Un nouveau mot de passe remplace celui-ci.')}</p>
      </div>`;
    const invitation = shown.invitation!, time = new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit' }).format(invitation.expires * 1000);
    const share = typeof navigator.share === 'function' ? html`<button class="btn" @click=${() => { void navigator.share({ title: 'MP Nexus', url: invitation.url }).catch(() => undefined); }}>${mpIcon('link', 16)}${tr('Partager')}</button>` : nothing;
    return html`${this.head(shown.guest, tr('Valable une fois, jusqu’à {time}', { time }), close)}
      <div class="body invite">
        ${shown.qr ? html`<img class="qr" src=${shown.qr} alt=${tr('QR code d’invitation')}><p class="muted center">${tr('À scanner avec l’appareil photo du téléphone de l’invité.')}</p>` : nothing}
        <label class="inp wide">${mpIcon('link', 16)}<input readonly .value=${invitation.url} aria-label=${tr('Lien d’invitation')} @focus=${(e: Event) => (e.target as HTMLInputElement).select()}></label>
        <div class="acts"><button class="btn primary" @click=${() => void copy(invitation.url)}>${mpIcon('copy', 16)}${shown.copied ? tr('Copié') : tr('Copier le lien')}</button>${share}</div>
        <p class="note info">${tr('Après usage, ce lien ne sert plus : une photo du QR code prise ensuite n’ouvre rien. Envoyez le lien seulement à cette personne.')}</p>
      </div>`;
  }
  private plusMain() {
    const admin = !!this.hass?.user?.is_admin, states = this.hass?.states ?? {};
    const link = (href: string, icon: MPIconName, title: string, sub: string) => html`<a class="rw" href=${href}><span class="ib">${mpIcon(icon, 16)}</span><div><b>${title}</b><small>${sub}</small></div><span class="end">${mpIcon('arrow', 16)}</span></a>`;
    const open = (type: SubPanel['type'], icon: MPIconName, title: string, sub: string) => html`<button class="rw" aria-pressed=${this.sub?.type === type} @click=${() => { this.sub = { type, id: '' }; }}><span class="ib">${mpIcon(icon, 16)}</span><div><b>${title}</b><small>${sub}</small></div><span class="end">${mpIcon('arrow', 16)}</span></button>`;
    const automations = this.ofDomain('automation', s => s.state === 'on').length, { power } = energySummary(states);
    const locksOpen = this.ofDomain('lock', s => available(s) && s.state !== 'locked').length + this.ofDomain('cover', s => available(s) && ['garage', 'gate', 'door'].includes(String(s.attributes.device_class ?? '')) && s.state !== 'closed').length;
    const saver = this.saver;
    return html`<section class="main panel card glass">
      ${this.head(tr('Plus'), tr('Toute la maison'))}
      <div class="body">
        ${this.access?.guest ? html`<div class="live glass"><span class="ib" style="color:#9fd0ff">${mpIcon('user', 18)}</span><div><b>${tr('Accès invité')}</b><small>${[this.access.profile === 'read' ? tr('Lecture seule') : tr('Peut commander'), this.access.until ? tr('jusqu’au {when}', { when: this.when(this.access.until) }) : ''].filter(Boolean).join(' · ')}</small></div></div>` : nothing}
        <div class="sg">
          ${open('routines', 'sparkle', tr('Routines « Si… alors… »'), tr('{n} active|{n} actives', { n: automations }))}
          ${open('energy', 'gauge', tr('Énergie'), power[0] ? tr('En ce moment · {value}', { value: power[0].watts >= 1000 ? `${this.format(power[0].watts / 1000, 2)} kW` : `${this.format(power[0].watts, 0)} W` }) : tr('Puissance et consommation'))}
          ${open('outdoor', 'leaf', tr('Extérieur & arrosage'), tr('Météo, soleil et arrosage'))}
          ${open('access', 'shield', tr('Accès & caméras'), locksOpen ? tr('{n} ouvert|{n} ouverts', { n: locksOpen }) : tr('Tout est fermé'))}
          ${open('history', 'scan', tr('Historique'), tr('Dernières 24 heures'))}
        </div>
        ${this.housePanels()}
        <div class="sg"><button class="rw" @click=${() => { this.scenesOpen = true; }}><span class="ib">${mpIcon('sparkle', 16)}</span><div><b>${tr('Scènes')}</b><small>${tr('Créer, modifier et personnaliser vos ambiances')}</small></div><span class="end">${mpIcon('arrow', 16)}</span></button></div>
        ${this.screenPrefs()}
        <div class="sg">
          ${open('appearance', 'palette', tr('Apparence'), this.lookSummary())}
          ${open('customize', 'tune', tr('Personnaliser'), this.customizeSummary())}
          ${nexusAgent(this.hass) ? html`<button class="rw" aria-pressed=${this.sub?.type === 'educate'} @click=${() => { this.sub = { type: 'educate', id: '' }; void this.refreshFacts(); }}><span class="ib">${mpIcon('sparkle', 16)}</span><div><b>${tr('Éduquer Nexus')}</b><small>${this.facts ? tr('{n} fait appris|{n} faits appris', { n: this.facts.facts.length }) : tr('Leçons guidées pour mieux connaître la maison')}</small></div><span class="end">${mpIcon('arrow', 16)}</span></button>` : nothing}
          ${open('saver', 'moon', tr('Écran de veille'), saver.enabled ? tr('{content} · après {n} min', { content: tr(saver.content === 'photos' ? 'Photos' : saver.content === 'plan' ? 'Plan 3D' : 'Horloge'), n: saver.delayMinutes }) : tr('Désactivé sur cet écran'))}
          ${admin ? open('users', 'user', tr('Utilisateurs'), tr('Invités par lien ou QR code')) : nothing}
          ${admin ? open('backup', 'layers', tr('Sauvegarde & partage'), this.lastExport ? tr('Dernière exportation : {when}', { when: new Intl.DateTimeFormat(locale(), { dateStyle: 'short' }).format(this.lastExport) }) : tr('Exporter, restaurer, partager')) : nothing}
        </div>
        <div class="sg">
          ${this.inventory ? link(this.route('inventory'), 'scan', this.inventory.title, tr('{n} équipement|{n} équipements', { n: this.inventory.count })) : nothing}
          ${link(this.route('info'), 'info', tr('Info'), tr('Versions et installation'))}
          ${this.languageMenu('row')}
          ${admin ? link('/mp-glass-settings', 'tune', 'MP Nexus Studio', tr('Apparence, plan 3D et équipements')) : nothing}
          ${admin ? link('/mp-glass-settings', 'sparkle', tr('Interface MP Nexus v2 (aperçu)'), tr('Revenir à la v1 depuis le Studio')) : nothing}
          ${admin ? this.kioskRow() : nothing}
        </div>
      </div>
    </section>`;
  }
  /** Administrators only: the Home Assistant interface in this tab, or back to the kiosk. */
  private kioskRow() {
    const left = kioskLeft();
    return html`<button class="rw" @click=${() => { leaveKiosk(!left); this.requestUpdate(); }}><span class="ib">${mpIcon(left ? 'expand' : 'grid', 16)}</span><div><b>${left ? tr('Revenir au mode kiosque') : tr('Interface Home Assistant')}</b><small>${left ? tr('Plein écran, sans barre ni menu') : tr('Barre et menu de Home Assistant sur cet écran')}</small></div><span class="end">${mpIcon('arrow', 16)}</span></button>`;
  }
  /** The climate and the covers of the whole house, each a touch away. */
  private housePanels() {
    const states = this.hass?.states ?? {}, climates = this.climateIds();
    const covers = [...new Set([...this.entities, ...this.placedAll.flatMap(p => roomEntityIds(p.room))])].filter(id => id.startsWith('cover.') && states[id]);
    if (!climates.length && !covers.length) return nothing;
    const running = climates.filter(id => states[id]!.state !== 'off').length;
    const row = (sub: SubPanel, icon: MPIconName, title: string, text: string) => html`<button class="rw" @click=${() => { this.sub = sub; }}><span class="ib">${mpIcon(icon, 16)}</span><div><b>${title}</b><small>${text}</small></div><span class="end">${mpIcon('arrow', 16)}</span></button>`;
    return html`<div class="sg">
      ${climates.length ? row({ type: 'climate', id: climates.length === 1 ? climates[0]! : '' }, 'thermo', tr('Climat'), tr('{n} sur {total}', { n: running, total: climates.length })) : nothing}
      ${covers.length ? row({ type: 'covers', id: '' }, 'shutter', tr('Ouvrants'), tr('{n} ouvert sur {total}|{n} ouverts sur {total}', { n: covers.filter(id => coverOpen(states[id])).length, total: covers.length })) : nothing}
    </div>`;
  }
  private infoMain() {
    const info = this.info, unknown = tr('Indisponible');
    const row = (label: string, value: string | number) => html`<div><dt>${label}</dt><dd>${value}</dd></div>`;
    return html`<section class="main panel card glass">
      ${this.head(tr('Info'), tr('Plus'), nothing, 'plus')}
      <div class="body">
        ${info?.version && info.version !== __MP_GLASS_VERSION__ ? html`<div class="note" role="alert">${tr('MP Nexus {installed} est installé, mais cette page affiche encore la version {shown}. Rechargez-la pour utiliser la nouvelle interface.', { installed: info.version, shown: __MP_GLASS_VERSION__ })}<button class="btn" @click=${() => location.reload()}>${tr('Recharger la page')}</button></div>` : nothing}
        <div class="rlab">${tr('Versions')}</div>
        <dl class="sg">${row(tr('Version de l’intégration MP Nexus'), info?.version ?? unknown)}${row(tr('Version du bundle chargé'), __MP_GLASS_VERSION__)}${row('Home Assistant', this.hass?.config?.version ?? unknown)}</dl>
        <div class="rlab">${tr('Votre installation')}</div>
        <dl class="sg">${row(tr('Maison'), this.projectName || tr('Maison'))}${row(tr('Pièces'), info?.areaCount ?? this.areas.length)}${row(tr('Équipements du dashboard'), info?.deviceCount ?? unknown)}${row(tr('Lumières'), info?.lightCount ?? unknown)}${row(tr('Langue de l’interface'), LANGUAGE_NAMES[language()])}</dl>
      </div>
    </section>`;
  }
  private inventoryMain() {
    return html`<section class="main panel card glass">
      ${this.head(this.inventory?.title ?? this.viewTitle, tr('Plus'), nothing, 'plus')}
      <div class="body">${this.cards.length ? html`<div class="cards">${this.cards.map(card => html`<div>${card}</div>`)}</div>` : html`<p class="empty">${tr('Aucun équipement à afficher pour le moment.')}</p>`}</div>
    </section>`;
  }

  // ——— The plan on the whole screen ———
  private stopReplay() { this.replayRequest++; this.replay = undefined; this.requestUpdate(); }
  private async startReplay() {
    const hass = this.hass, plan = this.plan;
    if (!hass || !plan) return;
    const ids = [...new Set(plan.floors.flatMap(f => f.rooms.flatMap(roomEntityIds)))].filter(id => !!hass.states[id]);
    if (!ids.length || ids.length > 250) { this.replay = ids.length ? 'too-many' : 'error'; this.requestUpdate(); return; }
    const request = ++this.replayRequest, until = Date.now(), from = until - 86_400_000;
    this.replay = 'loading'; this.requestUpdate();
    try {
      const answer = await hass.callWS<unknown>({ type: 'history/history_during_period', start_time: new Date(from).toISOString(), end_time: new Date(until).toISOString(), entity_ids: ids, include_start_time_state: true, minimal_response: false, no_attributes: false, significant_changes_only: false });
      if (request !== this.replayRequest) return;
      this.replay = { from, until, at: until, rows: replayRows(answer, ids) };
    } catch { if (request === this.replayRequest) this.replay = 'error'; }
    this.requestUpdate();
  }
  private fullPlan(background: string) {
    const placed = this.room ? this.find(this.room) : undefined, floors = this.plan?.floors.length ?? 0;
    const replay = typeof this.replay === 'object' ? this.replay : undefined;
    const replayHass = replay && this.hass ? { ...this.hass, states: replayStates(replay.rows, replay.at) } : undefined;
    return html`<div class="full" role="dialog" aria-modal="true" aria-label=${tr('Plan 3D')}>
      <div class="backdrop" style=${background}></div>
      <div class="fplan" ?inert=${!!replay}>${this.viewer({ key: 'full', hass: replayHass })}</div>
      <div class="ftop"><div><div class="lbl">${[this.projectName, floors > 1 ? tr('{n} niveau|{n} niveaux', { n: floors }) : ''].filter(Boolean).join(' · ')}</div><div class="serif" style="font-size:24px">${tr('Plan 3D')}</div></div>${this.replay ? nothing : this.houseButtons()}
        <button class="ib" aria-label=${tr('Fermer')} title=${tr('Fermer')} @click=${() => { this.stopReplay(); this.full = false; }}>${mpIcon('close', 18)}</button></div>
      ${placed && !replay ? html`<section class="fcard panel glass">${this.roomCard(placed, 'float')}</section>` : nothing}
      <div class="fbot">${replay ? html`<div class="replay panel glass"><b>${tr('Historique du plan')} · ${new Intl.DateTimeFormat(locale(), { dateStyle: 'short', timeStyle: 'short' }).format(replay.at)}</b><small>${tr('Lecture seule · seuls les états enregistrés sont affichés.')}</small><input type="range" min=${replay.from} max=${replay.until} step="60000" .value=${String(replay.at)} aria-label=${tr('Moment affiché')} @input=${(e: Event) => { replay.at = Number((e.target as HTMLInputElement).value); this.requestUpdate(); }}><button class="pill" @click=${() => this.stopReplay()}>${tr('Retour au direct')}</button></div>` : html`${this.layerButtons()}<div class="replay-actions">${this.replay === 'loading' ? tr('Chargement…') : this.replay === 'error' ? tr('Historique indisponible.') : this.replay === 'too-many' ? tr('Trop d’équipements sur ce plan pour revoir son historique.') : nothing} <button class="pill" ?disabled=${this.replay === 'loading'} @click=${() => void this.startReplay()}>${tr('Revoir les dernières 24 h')}</button></div>`}</div>
    </div>`;
  }

  render() {
    const a = this.appearance;
    const source = wallpaperSource(a, this.hass, isNight(this.hass?.states), () => this.requestUpdate());
    const background = `background-image:${cssImage(source)};background-position:${a.backgroundPosition ?? libraryWallpaper(activeWallpaper(a, isNight(this.hass?.states)))?.position ?? 'right'} center`;
    const big = this.layout !== 'phone', placed = this.room ? this.find(this.room) : undefined;
    const sub = this.sub ? this.subPanel() : undefined;
    const main = sub && !big ? sub : this.kind === 'home' ? this.homeMain() : this.kind === 'lights' ? this.lightsMain() : this.kind === 'rooms' ? this.roomsMain()
      : this.kind === 'area' ? this.areaMain() : this.kind === 'media' ? this.mediaMain() : this.kind === 'plus' ? this.plusMain()
        : this.kind === 'info' ? this.infoMain() : this.inventoryMain();
    // On a big screen the home page keeps its plan in the middle: beside it, the room opened or what is going on.
    const side = !big ? nothing : sub ?? (this.kind === 'home' ? (placed ? html`<section class="side panel card glass">${this.roomCard(placed, 'side')}</section>` : this.now()) : this.plan ? this.planPanel() : nothing);
    return html`
      <div class="backdrop" style=${background}></div><div class="shade" style=${`opacity:${Math.min(1, (a.backgroundDim ?? .44) + .4)}`}></div>
      <div class="app">${this.layout === 'desk' ? this.navigationBar() : nothing}${main}${side}${this.layout !== 'desk' ? this.navigationBar() : nothing}</div>
      ${!big && placed && !this.full && (this.kind === 'home' || this.kind === 'rooms') ? html`<div class="scrim" @click=${() => { this.room = ''; }}></div><section class="sheet panel">${this.roomCard(placed, 'sheet')}</section>` : nothing}
      ${this.full && this.plan ? this.fullPlan(background) : nothing}
      ${this.overlay && !(this.saving && this.overlay === 'voice') ? this.overlayPanel() : nothing}
      ${this.scenesOpen && this.hass ? html`<mp-nexus-scenes .hass=${this.hass} @mp-scenes-close=${() => { this.scenesOpen = false; }}></mp-nexus-scenes>` : nothing}
      ${this.saving ? this.screensaver(background) : nothing}
      ${this.saving && this.overlay === 'voice' ? html`<section class="svoice panel glass" role="dialog" aria-label="Nexus" @pointerdown=${(e: Event) => e.stopPropagation()}>${this.voicePanel()}</section>` : nothing}
      ${this.detail && this.hass ? html`<mp-glass-detail .hass=${this.hass} .entity=${this.detail} @mp-glass-detail-close=${() => { this.detail = ''; }}></mp-glass-detail>` : nothing}`;
  }
}
