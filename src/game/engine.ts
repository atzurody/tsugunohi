import { Anomaly, DialogueLine, GameState, GhostEvent } from "./types";
import { getStoryDialogue } from "./story";

const PLAYER_SPEED = 0.4;
const STAGE_WIDTH = 2000;
const TOTAL_LOOPS = 4;

export function createInitialState(): GameState {
  return {
    phase: "title",
    loopCount: 0,
    playerX: STAGE_WIDTH,
    playerY: 0,
    cameraX: 0,
    walkFrame: 0,
    walkTimer: 0,
    stageWidth: STAGE_WIDTH,
    screenShake: { x: 0, y: 0, duration: 0 },
    flashOpacity: 0,
    darkness: 0,
    textOverlay: null,
    anomalies: [],
    triggeredAnomalies: new Set(),
    isWalking: false,
    facingRight: false,
    ghostEvents: [],
    ambientFlicker: 0,
    endingTimer: 0,
    breathingPhase: 0,
    zoom: 4.5,
    dialogue: null,
    dialogueQueue: [],
    dialogueTimer: 0,
    storyFlags: new Set(),
    lookingUp: false,
    lookUpTimer: 0,
    carX: -500,
    carActive: false,
    carCooldown: 600,
    transitionTimer: 0,
  };
}

export function startGame(state: GameState): GameState {
  const dialogues = getStoryDialogue(0);
  return {
    ...state,
    phase: "playing",
    loopCount: 0,
    playerX: STAGE_WIDTH,
    cameraX: STAGE_WIDTH,
    walkFrame: 0,
    darkness: 1,
    anomalies: generateAnomalies(0),
    triggeredAnomalies: new Set(),
    ghostEvents: [],
    endingTimer: 0,
    breathingPhase: 0,
    zoom: 4.5,
    dialogue: null,
    dialogueQueue: dialogues,
    dialogueTimer: 0,
    storyFlags: new Set(),
    lookingUp: false,
    lookUpTimer: 0,
    carX: -500,
    carActive: false,
    carCooldown: 600,
    transitionTimer: 0,
  };
}

export function updateGame(state: GameState, keys: Set<string>, time: number): GameState {
  if (state.phase === "ending") {
    return updateEnding(state);
  }
  if (state.phase === "transition") {
    return updateTransition(state);
  }
  if (state.phase !== "playing") return state;

  let next = { ...state };

  // Look-up at hanging figure — trigger when passing worldX=1200 on loop 2
  if (state.loopCount >= 2 && !state.lookingUp && state.lookUpTimer === 0
    && !state.storyFlags.has("lookedUp")
    && state.playerX <= 1250 && state.playerX > 1100) {
    next.lookingUp = true;
    next.lookUpTimer = 0;
    next.isWalking = false;
    next.dialogue = { text: "...え？", speaker: "mono", opacity: 0, duration: 200 };
    next.dialogueQueue = [
      { text: "先生...？", speaker: "mono", opacity: 0, duration: 220 },
      { text: "なんで...", speaker: "mono", opacity: 0, duration: 220 },
    ];
    next.dialogueTimer = 0;
    const flags = new Set(state.storyFlags);
    flags.add("lookedUp");
    next.storyFlags = flags;
  }

  // Update look-up timer
  if (next.lookingUp) {
    next.lookUpTimer = state.lookUpTimer + 1;
    if (next.lookUpTimer > 640) {
      next.lookingUp = false;
    }
  }

  // Block movement while intro dialogue (no triggerX) is playing
  const hasIntroDialogue = state.dialogue && state.dialogue.triggerX === undefined;
  const introQueued = state.dialogueQueue.length > 0 && state.dialogueQueue[0].triggerX === undefined;
  const movementLocked = hasIntroDialogue || introQueued || next.lookingUp;

  // Walk only while space is held — default direction is LEFT (right to left)
  const holdingSpace = keys.has(" ");
  const moveLeft = keys.has("ArrowLeft") || keys.has("a");

  if (!movementLocked && (holdingSpace || moveLeft)) {
    // Only walk left, no going back
    const speed = PLAYER_SPEED;
    next.playerX -= speed;
    next.facingRight = false;
    next.isWalking = true;
    next.walkTimer++;
    next.walkFrame = next.walkTimer;
  } else {
    next.isWalking = false;
  }

  // Breathing
  next.breathingPhase = state.breathingPhase + 0.02;

  // Zoom
  const baseZoom = 4.5;
  const loopZoomIncrease = state.loopCount * 0.03;
  const breathZoom = Math.sin(next.breathingPhase) * 0.008 * (1 + state.loopCount * 0.2);
  next.zoom = baseZoom + loopZoomIncrease + breathZoom;

  // Camera follows player — player at the right edge of screen
  next.cameraX = next.playerX - 230;
  if (next.cameraX < 0) next.cameraX = 0;
  if (next.cameraX > next.stageWidth) next.cameraX = next.stageWidth;

  // Loop trigger: player walked far enough off the left side of screen
  // playerX needs to be well past the camera's left edge so character is fully invisible
  if (next.playerX < next.cameraX - 100) {
    next = triggerLoop(next);
  }

  // Update dialogue system
  next = updateDialogue(next);

  // Update anomalies
  next = updateAnomalies(next, time);

  // Update ghost events
  next = updateGhostEvents(next, time);

  // Update car — only in early loops (0, 1), occasionally passes by
  if (state.loopCount <= 1) {
    if (state.carActive) {
      // Car moves right to left quickly
      next.carX = state.carX - 5;
      if (next.carX < state.cameraX - 400) {
        next.carActive = false;
        next.carCooldown = 800 + Math.floor(Math.random() * 600);
      }
    } else {
      next.carCooldown = state.carCooldown - 1;
      if (next.carCooldown <= 0) {
        // Spawn car from the right
        next.carActive = true;
        next.carX = state.cameraX + 600;
      }
    }
  } else {
    next.carActive = false;
  }

  // Update screen effects
  next = updateEffects(next, time);

  return next;
}

function triggerLoop(state: GameState): GameState {
  const newLoop = state.loopCount + 1;

  if (newLoop >= TOTAL_LOOPS) {
    return {
      ...state,
      phase: "ending",
      darkness: 0,
      endingTimer: 0,
      flashOpacity: 1,
      dialogue: null,
    };
  }

  // Go to transition phase — show "つぐのひ" before next loop
  return {
    ...state,
    phase: "transition",
    transitionTimer: 0,
    loopCount: newLoop,
    dialogue: null,
    isWalking: false,
  };
}

const TRANSITION_DURATION = 360; // ~6 seconds at 60fps

function updateTransition(state: GameState): GameState {
  const next = { ...state, transitionTimer: state.transitionTimer + 1 };

  // After transition animation, start the next loop
  if (next.transitionTimer >= TRANSITION_DURATION) {
    const dialogues = getStoryDialogue(state.loopCount);
    return {
      ...next,
      phase: "playing",
      playerX: STAGE_WIDTH,
      cameraX: STAGE_WIDTH,
      darkness: 0.9,
      flashOpacity: state.loopCount >= 4 ? 0.6 : 0.3,
      anomalies: generateAnomalies(state.loopCount),
      triggeredAnomalies: new Set(),
      ghostEvents: generateGhostEvents(state.loopCount),
      textOverlay: null,
      screenShake: state.loopCount >= 5 ? { x: 0, y: 0, duration: 20 } : { x: 0, y: 0, duration: 0 },
      dialogue: null,
      dialogueQueue: dialogues,
      dialogueTimer: 0,
      transitionTimer: 0,
    };
  }

  return next;
}

function updateEnding(state: GameState): GameState {
  return {
    ...state,
    endingTimer: state.endingTimer + 1,
    flashOpacity: Math.max(0, state.flashOpacity - 0.008),
  };
}

// --- DIALOGUE SYSTEM ---
function updateDialogue(state: GameState): GameState {
  const next = { ...state };

  // Fade out current dialogue
  if (next.dialogue) {
    if (next.dialogue.duration > 0) {
      next.dialogueTimer++;
      const fadeOutStart = next.dialogue.duration - 30;
      let opacity = next.dialogue.opacity;
      // Fade in
      if (next.dialogueTimer < 20) {
        opacity = next.dialogueTimer / 20;
      }
      // Fade out
      else if (next.dialogueTimer > fadeOutStart) {
        opacity = Math.max(0, 1 - (next.dialogueTimer - fadeOutStart) / 30);
      } else {
        opacity = 1;
      }
      next.dialogue = { ...next.dialogue, opacity, duration: next.dialogue.duration };
      if (next.dialogueTimer >= next.dialogue.duration) {
        next.dialogue = null;
        next.dialogueTimer = 0;
      }
    }
  }

  // Check if next dialogue in queue should trigger
  if (!next.dialogue && next.dialogueQueue.length > 0) {
    const nextLine = next.dialogueQueue[0];
    if (nextLine.triggerX === undefined || state.playerX <= nextLine.triggerX) {
      next.dialogue = { ...nextLine, opacity: 0 };
      next.dialogueQueue = next.dialogueQueue.slice(1);
      next.dialogueTimer = 0;
    }
  }

  return next;
}

// --- ANOMALIES ---
function generateAnomalies(loop: number): Anomaly[] {
  const anomalies: Anomaly[] = [];
  let id = 0;

  // triggerX: player triggers when playerX <= triggerX (right to left, stage=2000)
  // 4 loops: 0=calm, 1=uneasy, 2=scary, 3=nightmare

  if (loop >= 1) {
    // Loop 1: shadows, light shake
    anomalies.push({ id: id++, loopMin: 1, triggerX: 1500, type: "shadow_figure", triggered: false, data: { offsetX: -250 } });
    anomalies.push({ id: id++, loopMin: 1, triggerX: 1200, type: "screen_shake", triggered: false, data: { intensity: 2, duration: 15 } });
    anomalies.push({ id: id++, loopMin: 1, triggerX: 600, type: "shadow_figure", triggered: false, data: { offsetX: -180 } });
    anomalies.push({ id: id++, loopMin: 1, triggerX: 400, type: "darkness_pulse", triggered: false, data: {} });
    anomalies.push({ id: id++, loopMin: 1, triggerX: 900, type: "following_shadow", triggered: false, data: {} });
  }
  if (loop >= 2) {
    // Loop 2: blood, glitch, approaching figure, jumpscare
    anomalies.push({ id: id++, loopMin: 2, triggerX: 1800, type: "darkness_pulse", triggered: false, data: {} });
    anomalies.push({ id: id++, loopMin: 2, triggerX: 1600, type: "screen_shake", triggered: false, data: { intensity: 8, duration: 50 } });
    anomalies.push({ id: id++, loopMin: 2, triggerX: 1400, type: "blood_wall", triggered: false, data: {} });
    anomalies.push({ id: id++, loopMin: 2, triggerX: 1100, type: "glitch", triggered: false, data: {} });
    anomalies.push({ id: id++, loopMin: 2, triggerX: 800, type: "approaching_figure", triggered: false, data: { elapsed: 0 } });
    anomalies.push({ id: id++, loopMin: 2, triggerX: 500, type: "distortion", triggered: false, data: {} });
  }
  if (loop >= 3) {
    // Loop 3 (final): everything at once, jumpscare, max horror
    anomalies.push({ id: id++, loopMin: 3, triggerX: 1900, type: "distortion", triggered: false, data: {} });
    anomalies.push({ id: id++, loopMin: 3, triggerX: 1800, type: "glitch", triggered: false, data: {} });
    anomalies.push({ id: id++, loopMin: 3, triggerX: 1600, type: "screen_shake", triggered: false, data: { intensity: 18, duration: 100 } });
    anomalies.push({ id: id++, loopMin: 3, triggerX: 1400, type: "approaching_figure", triggered: false, data: { elapsed: 0 } });
    anomalies.push({ id: id++, loopMin: 3, triggerX: 1100, type: "jumpscare", triggered: false, data: { elapsed: 0 } });
    anomalies.push({ id: id++, loopMin: 3, triggerX: 800, type: "darkness_pulse", triggered: false, data: {} });
    anomalies.push({ id: id++, loopMin: 3, triggerX: 600, type: "approaching_figure", triggered: false, data: { elapsed: 0 } });
    anomalies.push({ id: id++, loopMin: 3, triggerX: 300, type: "jumpscare", triggered: false, data: { elapsed: 0 } });
  }

  return anomalies;
}

function generateGhostEvents(loop: number): GhostEvent[] {
  const ghosts: GhostEvent[] = [];

  if (loop >= 1) {
    ghosts.push({
      x: 1100, y: 0, opacity: 0.35, width: 18, height: 120,
      type: "standing", speed: 0, active: true,
    });
  }
  if (loop >= 2) {
    ghosts.push({
      x: 700, y: 0, opacity: 0.45, width: 18, height: 140,
      type: "standing", speed: 0.3, active: true,
    });
    ghosts.push({
      x: 400, y: 0, opacity: 0.4, width: 35, height: 18,
      type: "crawling", speed: 1.5, active: true,
    });
  }
  if (loop >= 3) {
    for (let i = 0; i < 5; i++) {
      ghosts.push({
        x: 150 + i * 350, y: 0, opacity: 0.45 + i * 0.08,
        width: 16 + i * 2, height: 110 + i * 20,
        type: i % 3 === 0 ? "crawling" : i % 3 === 1 ? "standing" : "floating",
        speed: 0.2 + i * 0.15, active: true,
      });
    }
  }

  return ghosts;
}

function updateAnomalies(state: GameState, time: number): GameState {
  const next = { ...state };
  next.anomalies = state.anomalies.map((anomaly) => {
    if (anomaly.triggered) {
      if (anomaly.type === "approaching_figure") {
        return {
          ...anomaly,
          data: { ...anomaly.data, elapsed: (anomaly.data.elapsed as number) + 1 },
        };
      }
      // Shadow figure: start falling when player passes it
      if (anomaly.type === "shadow_figure") {
        const figX = anomaly.triggerX + (anomaly.data.offsetX as number || 0);
        const passedBy = state.playerX < figX - 50;
        if (passedBy && !anomaly.data.falling) {
          return {
            ...anomaly,
            data: { ...anomaly.data, falling: true, fallY: 0, playedSound: false },
          };
        }
        if (anomaly.data.falling) {
          const fallY = (anomaly.data.fallY as number) + 4; // fall speed
          return {
            ...anomaly,
            data: { ...anomaly.data, fallY, elapsed: ((anomaly.data.elapsed as number) || 0) + 1 },
          };
        }
      }
      if (anomaly.type === "jumpscare") {
        return {
          ...anomaly,
          data: { ...anomaly.data, elapsed: (anomaly.data.elapsed as number) + 1 },
        };
      }
      return anomaly;
    }

    if (state.playerX <= anomaly.triggerX && !state.triggeredAnomalies.has(anomaly.id)) {
      next.triggeredAnomalies = new Set(state.triggeredAnomalies);
      next.triggeredAnomalies.add(anomaly.id);

      if (anomaly.type === "screen_shake") {
        next.screenShake = {
          x: 0, y: 0,
          duration: anomaly.data.duration as number,
        };
      }
      if (anomaly.type === "text_flash") {
        next.textOverlay = {
          text: anomaly.data.text as string,
          opacity: 1,
          duration: 100,
        };
      }
      if (anomaly.type === "darkness_pulse") {
        next.darkness = Math.min(0.8, state.darkness + 0.4);
      }
      if (anomaly.type === "jumpscare") {
        next.screenShake = { x: 0, y: 0, duration: 30 };
      }

      return { ...anomaly, triggered: true };
    }

    return anomaly;
  });

  return next;
}

function updateGhostEvents(state: GameState, time: number): GameState {
  const next = { ...state };
  next.ghostEvents = state.ghostEvents.map((ghost) => {
    if (!ghost.active) return ghost;

    if (ghost.speed > 0 && ghost.type === "crawling") {
      return { ...ghost, x: ghost.x - ghost.speed };
    }
    if (ghost.speed > 0 && ghost.type === "floating") {
      return {
        ...ghost,
        x: ghost.x + Math.sin(time * 0.002) * ghost.speed,
      };
    }
    if (ghost.speed > 0 && ghost.type === "standing") {
      const dir = state.playerX > ghost.x ? 1 : -1;
      return { ...ghost, x: ghost.x + dir * ghost.speed * 0.3 };
    }

    return ghost;
  });

  return next;
}

function updateEffects(state: GameState, time: number): GameState {
  const next = { ...state };

  if (state.screenShake.duration > 0) {
    const intensity = state.screenShake.duration * 0.35;
    next.screenShake = {
      x: (Math.random() - 0.5) * intensity,
      y: (Math.random() - 0.5) * intensity,
      duration: state.screenShake.duration - 1,
    };
  }

  if (state.flashOpacity > 0) {
    next.flashOpacity = Math.max(0, state.flashOpacity - 0.012);
  }

  if (state.darkness > 0 && state.loopCount < 5) {
    next.darkness = Math.max(0, state.darkness - 0.006);
  } else if (state.loopCount >= 5) {
    const targetDark = 0.12 + (state.loopCount - 5) * 0.12;
    next.darkness = state.darkness + (targetDark - state.darkness) * 0.008;
  }

  // Text overlay fade (horror flashes - separate from dialogue)
  if (state.textOverlay) {
    if (state.textOverlay.duration > 0) {
      next.textOverlay = {
        ...state.textOverlay,
        duration: state.textOverlay.duration - 1,
        opacity: state.textOverlay.duration < 35
          ? state.textOverlay.opacity - 0.028
          : state.textOverlay.opacity,
      };
    } else {
      next.textOverlay = null;
    }
  }

  if (state.loopCount >= 3) {
    if (Math.random() < 0.004 * (state.loopCount - 2)) {
      next.ambientFlicker = 0.6 + Math.random() * 0.35;
    } else {
      next.ambientFlicker = Math.max(0, state.ambientFlicker - 0.04);
    }
  }

  return next;
}
