"use client";

import { useRef, useEffect, useCallback } from "react";
import { createInitialState, startGame, updateGame } from "@/game/engine";
import { drawGame, drawTitle, drawEnding, drawTransition } from "@/game/renderer";
import { HorrorAudio } from "@/game/audio";
import { GameState } from "@/game/types";

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(createInitialState());
  const keysRef = useRef<Set<string>>(new Set());
  const audioRef = useRef<HorrorAudio>(new HorrorAudio());
  const frameRef = useRef<number>(0);
  const lastLoopRef = useRef<number>(-1);
  const footstepTimerRef = useRef<number>(0);
  const droneTimerRef = useRef<number>(0);
  const heartbeatTimerRef = useRef<number>(0);
  const playerImageRef = useRef<HTMLImageElement | null>(null);
  const bgImageRef = useRef<HTMLImageElement | null>(null);
  const yukariImageRef = useRef<HTMLImageElement | null>(null);
  const yukariHorrorImageRef = useRef<HTMLImageElement | null>(null);
  const bloodFrameRef = useRef<HTMLImageElement | null>(null);
  const bloodTextureRef = useRef<HTMLImageElement | null>(null);
  const bloodSplatRef = useRef<HTMLImageElement | null>(null);
  const bloodHandRef = useRef<HTMLImageElement | null>(null);
  const hangingRef = useRef<HTMLImageElement | null>(null);
  const playerLookupRef = useRef<HTMLImageElement | null>(null);
  const carRef = useRef<HTMLImageElement | null>(null);
  const pedestrianRef = useRef<HTMLImageElement | null>(null);
  const pedFootstepTimerRef = useRef<number>(0);

  const handleStart = useCallback(() => {
    const state = stateRef.current;
    if (state.phase === "title") {
      audioRef.current.init();
      stateRef.current = startGame(state);
    } else if (state.phase === "ending" && state.endingTimer > 2500) {
      audioRef.current.init();
      stateRef.current = startGame(createInitialState());
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Load player sprite
    if (!playerImageRef.current) {
      const img = new Image();
      img.src = "/player.png";
      playerImageRef.current = img;
    }
    // Load background image
    if (!bgImageRef.current) {
      const bg = new Image();
      bg.src = "/bg.png";
      bgImageRef.current = bg;
    }
    // Load Yukari sprites
    if (!yukariImageRef.current) {
      const yk = new Image();
      yk.src = "/yukari.png";
      yukariImageRef.current = yk;
    }
    if (!yukariHorrorImageRef.current) {
      const ykh = new Image();
      ykh.src = "/yukari_horror.png";
      yukariHorrorImageRef.current = ykh;
    }
    for (const [ref, src] of [
      [bloodFrameRef, "/blood_frame.png"],
      [bloodTextureRef, "/blood_texture.png"],
      [bloodSplatRef, "/blood_splat.png"],
      [bloodHandRef, "/blood_hand.png"],
      [hangingRef, "/hanging.png"],
      [playerLookupRef, "/player_lookup.png"],
      [carRef, "/car.png"],
      [pedestrianRef, "/pedestrian.png"],
    ] as [React.RefObject<HTMLImageElement | null>, string][]) {
      if (!ref.current) {
        const img = new Image();
        img.src = src;
        ref.current = img;
      }
    }

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      keysRef.current.add(e.key);
      const state = stateRef.current;
      if (state.phase === "title" && (e.key === " " || e.key === "Enter")) {
        handleStart();
      } else if (state.phase === "ending" && (e.key === " " || e.key === "Enter")) {
        handleStart();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key);
    };
    const onClick = () => {
      handleStart();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("click", onClick);

    const startTime = performance.now();

    const gameLoop = (timestamp: number) => {
      const time = timestamp - startTime;
      const state = stateRef.current;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (state.phase === "title") {
        drawTitle(ctx, canvas.width, canvas.height, time);
      } else if (state.phase === "playing") {
        stateRef.current = updateGame(state, keysRef.current, time);
        const cur = stateRef.current;

        const audio = audioRef.current;

        // Footsteps — play when bob starts going down, with cooldown to prevent overlap
        if (cur.isWalking && cur.walkFrame > 1) {
          const prev = Math.sin((cur.walkFrame - 1) * 0.08);
          const curr = Math.sin(cur.walkFrame * 0.08);
          footstepTimerRef.current++;
          if (prev > curr && prev > 0.9 && footstepTimerRef.current > 20) {
            audio.playFootstep();
            footstepTimerRef.current = 0;
          }
        } else {
          footstepTimerRef.current = 0;
        }

        // Loop change audio
        if (cur.loopCount !== lastLoopRef.current) {
          lastLoopRef.current = cur.loopCount;
          audio.playAmbientDrone(cur.loopCount);
          audio.setCricketVolume(cur.loopCount);
          if (cur.loopCount >= 2) {
            audio.playHorrorSting();
          }
          if (cur.loopCount >= 5) {
            audio.playWhisper();
          }
        }

        // Pedestrian footsteps
        if (cur.pedestrianActive) {
          const prevP = Math.sin((cur.pedestrianWalkFrame - 1) * 0.08);
          const currP = Math.sin(cur.pedestrianWalkFrame * 0.08);
          pedFootstepTimerRef.current++;
          if (prevP > currP && prevP > 0.9 && pedFootstepTimerRef.current > 20) {
            audio.playFootstep();
            pedFootstepTimerRef.current = 0;
          }
        } else {
          pedFootstepTimerRef.current = 0;
        }

        // Car pass sound — play when car spawns
        if (cur.carActive && !state.carActive) {
          audio.playCarPass();
        }

        // Jumpscare sound
        for (const a of cur.anomalies) {
          if (a.type === "jumpscare" && a.triggered && a.data.elapsed === 1) {
            audio.playHorrorSting();
          }
        }

        // Memory flashback sound — play when memory/voice dialogue starts, stop when it ends
        if (cur.dialogue && cur.dialogueTimer === 1 && (cur.dialogue.speaker === "memory" || cur.dialogue.speaker === "voice")) {
          audio.playMemory();
        }
        if (!cur.dialogue && state.dialogue && (state.dialogue.speaker === "memory" || state.dialogue.speaker === "voice")) {
          audio.stopMemory();
        }

        // Shadow fall sound — play when a shadow starts falling
        for (const a of cur.anomalies) {
          if (a.type === "shadow_figure" && a.data.falling && a.data.fallY === 4 && !a.data.playedSound) {
            audio.playFall();
            a.data.playedSound = true;
          }
        }

        // Periodic drone
        droneTimerRef.current++;
        if (droneTimerRef.current > 200) {
          audio.playAmbientDrone(cur.loopCount);
          droneTimerRef.current = 0;
        }

        // Heartbeat
        if (cur.loopCount >= 3) {
          heartbeatTimerRef.current++;
          const rate = Math.max(25, 70 - cur.loopCount * 7);
          if (heartbeatTimerRef.current > rate) {
            audio.playHeartbeat(cur.loopCount);
            heartbeatTimerRef.current = 0;
          }
        }

        // Breathing sound
        if (cur.loopCount >= 4 && Math.sin(cur.breathingPhase) > 0.95) {
          audio.playBreathing(cur.loopCount);
        }

        // Glitch sound
        if (cur.ambientFlicker > 0.3) {
          audio.playGlitch();
        }

        // Random creepy ambient sounds
        if (cur.loopCount >= 2 && Math.random() < 0.002 * cur.loopCount) {
          const r = Math.random();
          if (r < 0.33) audio.playCreak();
          else if (r < 0.66) audio.playDistantBang();
          else audio.playLowRumble();
        }

        // --- CLOSE-UP: only head + upper body visible ---
        ctx.save();
        const zoom = cur.zoom;
        const internalW = canvas.width / zoom;
        const internalH = canvas.height / zoom;

        ctx.scale(zoom, zoom);
        // Push camera down so ground is far below screen bottom
        // Character's head is at ~groundY - 106, we want that near screen center
        ctx.translate(0, -internalH * 0.55);

        drawGame({
          ctx,
          width: internalW,
          height: internalH * 2,
          state: cur,
          time,
          playerImage: playerImageRef.current ?? undefined,
          bgImage: bgImageRef.current ?? undefined,
          yukariImage: yukariImageRef.current ?? undefined,
          yukariHorrorImage: yukariHorrorImageRef.current ?? undefined,
          bloodFrameImage: bloodFrameRef.current ?? undefined,
          bloodTextureImage: bloodTextureRef.current ?? undefined,
          bloodSplatImage: bloodSplatRef.current ?? undefined,
          bloodHandImage: bloodHandRef.current ?? undefined,
          hangingImage: hangingRef.current ?? undefined,
          playerLookupImage: playerLookupRef.current ?? undefined,
          carImage: carRef.current ?? undefined,
          pedestrianImage: pedestrianRef.current ?? undefined,
        });

        ctx.restore();

        // Cinematic letterbox bars while dialogue is active or queued
        const hasDialogue = cur.dialogue && cur.dialogue.opacity > 0;
        const nextReady = cur.dialogueQueue.length > 0 && (
          cur.dialogueQueue[0].triggerX === undefined || cur.playerX <= cur.dialogueQueue[0].triggerX
        );
        const showBars = hasDialogue || nextReady;
        if (showBars) {
          const barH = Math.floor(canvas.height * 0.15);
          let barAlpha = 0.85;
          if (hasDialogue && !nextReady && cur.dialogue && cur.dialogueQueue.length === 0) {
            const remaining = cur.dialogue.duration - cur.dialogueTimer;
            if (remaining < 30) barAlpha = 0.85 * (remaining / 30);
          }
          if (hasDialogue && cur.dialogue && cur.dialogue.opacity < 1) {
            barAlpha = 0.85 * Math.min(1, cur.dialogue.opacity * 2);
          }
          ctx.save();
          ctx.globalAlpha = Math.max(0, barAlpha);
          ctx.fillStyle = "#000";
          ctx.fillRect(0, 0, canvas.width, barH);
          ctx.fillRect(0, canvas.height - barH, canvas.width, barH);
          ctx.restore();
        }

        // Draw dialogue text — floating text
        if (cur.dialogue && cur.dialogue.opacity > 0) {
          const d = cur.dialogue;

          ctx.save();
          ctx.globalAlpha = d.opacity;

          const horrorFont = "'Noto Serif JP','Yu Mincho','Hiragino Mincho Pro',serif";
          const lines = d.text.split("\n");
          const lineH = 28;
          const textY = canvas.height - lines.length * lineH - 50;

          // Subtle shake for voice type
          const isVoice = d.speaker === "voice";
          const shakeAmount = isVoice ? 1.0 * (1 + cur.loopCount * 0.15) : 0;
          const shakeX = isVoice ? (Math.random() - 0.5) * shakeAmount : 0;
          const shakeY = isVoice ? (Math.random() - 0.5) * shakeAmount : 0;

          if (isVoice) {
            ctx.fillStyle = "#c04040";
            ctx.font = `20px ${horrorFont}`;
          } else if (d.speaker === "memory") {
            ctx.fillStyle = "#7888a8";
            ctx.font = `18px ${horrorFont}`;
          } else {
            ctx.fillStyle = "#b0a8a0";
            ctx.font = `18px ${horrorFont}`;
          }

          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.shadowColor = "rgba(0,0,0,0.8)";
          ctx.shadowBlur = 6;
          ctx.shadowOffsetX = 1;
          ctx.shadowOffsetY = 1;

          for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], canvas.width / 2 + shakeX, textY + i * lineH + shakeY);
          }

          ctx.restore();
        }

      } else if (state.phase === "transition") {
        stateRef.current = updateGame(state, keysRef.current, time);
        const cur2 = stateRef.current;
        drawTransition(ctx, canvas.width, canvas.height, time, cur2.transitionTimer, cur2.loopCount);
      } else if (state.phase === "ending") {
        stateRef.current = updateGame(state, keysRef.current, time);
        drawEnding(ctx, canvas.width, canvas.height, time, stateRef.current.endingTimer, yukariHorrorImageRef.current ?? undefined);
      }

      frameRef.current = requestAnimationFrame(gameLoop);
    };

    frameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("click", onClick);
    };
  }, [handleStart]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: "block",
        width: "100vw",
        height: "100vh",
        background: "#000",
      }}
    />
  );
}
