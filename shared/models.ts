export interface HAState { entity_id: string; state: string; attributes: Record<string, unknown>; last_changed?: string }
export interface HAFloor { floor_id: string; name: string; level?: number }
export interface HAArea { area_id: string; name: string; floor_id?: string | null; icon?: string | null; picture?: string | null }
export interface HADevice { id: string; area_id?: string | null; via_device_id?: string | null; manufacturer?: string | null; model?: string | null; name?: string | null; name_by_user?: string | null }
export interface HAEntity { id?: string; entity_id: string; device_id?: string | null; area_id?: string | null; name?: string | null; original_name?: string | null; disabled_by?: string | null; hidden_by?: string | null; entity_category?: string | null; labels?: string[] }
export interface Snapshot { floors: HAFloor[]; areas: HAArea[]; devices: HADevice[]; entities: HAEntity[]; states: Record<string, HAState>; warnings: string[] }
export type Capability = 'POWER' | 'DIM' | 'COLOR_TEMP' | 'RGB' | 'RGBW' | 'RGBWW' | 'EFFECT';
export interface CapabilityBinding { capability: Capability; entityId: string; evidence: string }
export type Category = 'light' | 'generic';
export type Preset = 'glass-blue' | 'glass-warm' | 'glass-dark' | 'glass-light' | 'glass-oled' | 'glass-neutral';
export type NavigationItem = 'home' | 'lights' | 'rooms';
export interface AppearanceConfig {
  preset: Preset;
  /** Short monogram shown in the dashboard's home emblem. */
  logoMark?: string;
  accent?: string;
  glassOpacity?: number;
  glassBlur?: number;
  radius?: number;
  backgroundDim?: number;
  backgroundPosition?: 'left' | 'center' | 'right';
  backgroundUrl?: string;
  /** A wallpaper of the MP Nexus library by name, or one imported into Home Assistant by its identifier. */
  wallpaper?: string;
  /** The wallpaper once the sun has set; unset keeps the day one. */
  nightWallpaper?: string;
  density?: 'compact' | 'comfortable';
  motion?: boolean;
  showHero?: boolean;
  eyebrow?: string;
  subtitle?: string;
  quote?: string;
  secondaryAccent?: string;
  glassTint?: string;
  borderStrength?: number;
  shadowStrength?: number;
  fontStyle?: 'elegant' | 'modern' | 'soft';
  iconStyle?: 'tile' | 'orb' | 'minimal';
  cardStyle?: 'compact' | 'standard' | 'spacious';
  cardColumns?: number;
  cardGap?: number;
  maxWidth?: number;
  heroHeight?: number;
  backgroundBlur?: number;
  backgroundSaturation?: number;
  showClock?: boolean;
  showOverview?: boolean;
  showFooter?: boolean;
  showSettingsShortcut?: boolean;
  showCardDetails?: boolean;
  showBrightness?: boolean;
  sectionTitle?: string;
  sectionSubtitle?: string;
  /** Colours of the plan chosen over those of MP Nexus, by what they show (see `PlanPalette`). */
  planColors?: Partial<Record<import('./spatial-state').PlanColor, string>>;
  /** How bright the halos of the plan shine: 1 as designed. */
  planGlow?: number;
  /** Ambiances of the plan kept off its buttons; the lights always stay. */
  hiddenLayers?: Exclude<import('./spatial-state').PlanMode, 'lights'>[];
  /** Entities MP Nexus v2 neither shows nor counts: a player, a light, a shutter set aside. */
  hiddenEntities?: string[];
  /** The summary pills and the scenes of the home page; unset shows them. */
  showStats?: boolean;
  showScenes?: boolean;
}
export interface NavigationConfig { items: NavigationItem[]; showLabels: boolean }
/** Which MP Nexus interface the dashboard draws: the first one, or MP Nexus v2. Unset is v1. */
export type InterfaceVersion = 1 | 2;
export interface InterfaceConfig { version: InterfaceVersion }
export interface Override { name?: string; areaId?: string; hidden?: boolean; presentation?: Category }
export interface ProjectConfig { schema_version: 2; project: { name: string }; appearance: AppearanceConfig; navigation: NavigationConfig; interface?: InterfaceConfig; roles: Record<string, string>; overrides: Record<string, Override>; spatial?: import('./spatial').SpatialPlan }
export interface LogicalDevice {
  id: string; entityKey: string; entityId: string; name: string; sourceDeviceIds: string[];
  areaId?: string; floorId?: string; category: Category; presentation?: Category;
  confidence: number; evidence: string[]; capabilities: CapabilityBinding[];
  hidden: boolean; disabled: boolean;
  /** Shown in its area's room of the plan; unset for diagnostics, settings and other sensors. */
  planKind?: import('./rooms').PlanKind;
}
export interface MPHomeGraph { floors: HAFloor[]; areas: HAArea[]; sourceDevices: HADevice[]; devices: LogicalDevice[]; warnings: string[] }
export interface CardConfig { type: string; entity: string; name?: string; preset?: Preset; appearance?: AppearanceConfig; debug?: boolean }
export interface CardDefinition { type: string; categories: Category[]; requires: Capability[]; priority: number; variants: string[] }
export interface MPAreaSummary { id: string; name: string; icon?: string | null; picture?: string | null; deviceCount: number; lightCount: number; activeCount: number }
