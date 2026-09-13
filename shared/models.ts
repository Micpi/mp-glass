export interface HAState { entity_id: string; state: string; attributes: Record<string, unknown> }
export interface HAFloor { floor_id: string; name: string; level?: number }
export interface HAArea { area_id: string; name: string; floor_id?: string | null; icon?: string | null; picture?: string | null }
export interface HADevice { id: string; area_id?: string | null; via_device_id?: string | null; manufacturer?: string | null; model?: string | null }
export interface HAEntity { id?: string; entity_id: string; device_id?: string | null; area_id?: string | null; name?: string | null; original_name?: string | null; disabled_by?: string | null; hidden_by?: string | null; labels?: string[] }
export interface Snapshot { floors: HAFloor[]; areas: HAArea[]; devices: HADevice[]; entities: HAEntity[]; states: Record<string, HAState>; warnings: string[] }
export type Capability = 'POWER' | 'DIM' | 'COLOR_TEMP' | 'RGB' | 'RGBW' | 'RGBWW' | 'EFFECT';
export interface CapabilityBinding { capability: Capability; entityId: string; evidence: string }
export type Category = 'light' | 'generic';
export type Preset = 'glass-blue' | 'glass-warm' | 'glass-dark' | 'glass-light' | 'glass-oled' | 'glass-neutral';
export type NavigationItem = 'home' | 'lights' | 'rooms';
export interface AppearanceConfig {
  preset: Preset;
  accent?: string;
  glassOpacity?: number;
  glassBlur?: number;
  radius?: number;
  backgroundDim?: number;
  backgroundPosition?: 'left' | 'center' | 'right';
  backgroundUrl?: string;
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
}
export interface NavigationConfig { items: NavigationItem[]; showLabels: boolean }
export interface Override { name?: string; areaId?: string; hidden?: boolean; presentation?: Category }
export interface ProjectConfig { schema_version: 2; project: { name: string }; appearance: AppearanceConfig; navigation: NavigationConfig; roles: Record<string, string>; overrides: Record<string, Override> }
export interface LogicalDevice {
  id: string; entityKey: string; entityId: string; name: string; sourceDeviceIds: string[];
  areaId?: string; floorId?: string; category: Category; presentation?: Category;
  confidence: number; evidence: string[]; capabilities: CapabilityBinding[];
  hidden: boolean; disabled: boolean;
}
export interface MPHomeGraph { floors: HAFloor[]; areas: HAArea[]; sourceDevices: HADevice[]; devices: LogicalDevice[]; warnings: string[] }
export interface CardConfig { type: string; entity: string; name?: string; preset?: Preset; appearance?: AppearanceConfig; debug?: boolean }
export interface CardDefinition { type: string; categories: Category[]; requires: Capability[]; priority: number; variants: string[] }
export interface MPAreaSummary { id: string; name: string; icon?: string | null; picture?: string | null; deviceCount: number; lightCount: number; activeCount: number }
