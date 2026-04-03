export interface GameState {
  phase: "title" | "playing" | "transition" | "ending";
  transitionTimer: number;
  loopCount: number;
  playerX: number;
  playerY: number;
  cameraX: number;
  walkFrame: number;
  walkTimer: number;
  stageWidth: number;
  screenShake: { x: number; y: number; duration: number };
  flashOpacity: number;
  darkness: number;
  textOverlay: { text: string; opacity: number; duration: number } | null;
  anomalies: Anomaly[];
  triggeredAnomalies: Set<number>;
  isWalking: boolean;
  facingRight: boolean;
  ghostEvents: GhostEvent[];
  ambientFlicker: number;
  endingTimer: number;
  breathingPhase: number;
  zoom: number;
  // Story system
  dialogue: DialogueLine | null;
  dialogueQueue: DialogueLine[];
  dialogueTimer: number;
  storyFlags: Set<string>;
  lookingUp: boolean;
  lookUpTimer: number;
  carX: number;
  carActive: boolean;
  carCooldown: number;
  pedestrianX: number;
  pedestrianActive: boolean;
  pedestrianTriggered: boolean;
  pedestrianWalkFrame: number;
}

export interface DialogueLine {
  text: string;
  speaker: "mono" | "voice" | "memory";
  opacity: number;
  duration: number;
  triggerX?: number;
}

export interface Anomaly {
  id: number;
  loopMin: number;
  triggerX: number;
  type: AnomalyType;
  triggered: boolean;
  data: Record<string, number | string | boolean>;
}

export type AnomalyType =
  | "shadow_figure"
  | "window_face"
  | "following_shadow"
  | "blood_wall"
  | "distortion"
  | "glitch"
  | "approaching_figure"
  | "text_flash"
  | "screen_shake"
  | "darkness_pulse"
  | "jumpscare";

export interface GhostEvent {
  x: number;
  y: number;
  opacity: number;
  width: number;
  height: number;
  type: "standing" | "crawling" | "floating";
  speed: number;
  active: boolean;
}

export interface DrawContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  state: GameState;
  time: number;
  playerImage?: HTMLImageElement;
  bgImage?: HTMLImageElement;
  yukariImage?: HTMLImageElement;
  yukariHorrorImage?: HTMLImageElement;
  bloodFrameImage?: HTMLImageElement;
  bloodTextureImage?: HTMLImageElement;
  bloodSplatImage?: HTMLImageElement;
  bloodHandImage?: HTMLImageElement;
  hangingImage?: HTMLImageElement;
  playerLookupImage?: HTMLImageElement;
  carImage?: HTMLImageElement;
  pedestrianImage?: HTMLImageElement;
}
