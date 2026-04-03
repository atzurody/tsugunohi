import { DrawContext, GameState } from "./types";
import { getEndingTexts } from "./story";

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function lerpColor(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ra = (pa >> 16) & 0xff, ga = (pa >> 8) & 0xff, ba2 = pa & 0xff;
  const rb = (pb >> 16) & 0xff, gb = (pb >> 8) & 0xff, bb = pb & 0xff;
  const r = Math.round(ra + (rb - ra) * t);
  const g = Math.round(ga + (gb - ga) * t);
  const bv = Math.round(ba2 + (bb - ba2) * t);
  return `#${((r << 16) | (g << 8) | bv).toString(16).padStart(6, "0")}`;
}

// Ground line is at 78% of internal height for close-up feel
const GROUND_Y_RATIO = 0.78;

export function drawGame(dc: DrawContext) {
  const { ctx, width, height, state, bgImage } = dc;
  ctx.save();
  if (state.screenShake.duration > 0) {
    ctx.translate(state.screenShake.x, state.screenShake.y);
  }

  // Use photo background if loaded, otherwise fallback to drawn background
  const useBgImage = bgImage && bgImage.complete && bgImage.naturalWidth > 0;

  if (useBgImage) {
    drawPhotoBg(dc);
  } else {
    drawSky(dc);
    drawDistantBuildings(dc);
    drawMidBuildings(dc);
    drawTrees(dc);
    drawStreet(dc);
    drawMainBuildings(dc);
    drawEnvironmentDetails(dc);
    drawUtilityPoles(dc);
    drawGroundDetails(dc);
  }

  drawHangingFigures(dc);
  drawPedestrian(dc);
  drawAnomaliesBehind(dc);
  drawPlayer(dc);
  drawAnomaliesFront(dc);
  drawCar(dc);
  drawGhostEvents(dc);
  if (!useBgImage) drawFog(dc);
  drawEffects(dc);
  drawHorrorAtmosphere(dc);
  ctx.restore();
  drawOverlays(dc);
}

// ======================== PHOTO BACKGROUND ========================
function drawPhotoBg(dc: DrawContext) {
  const { ctx, width, height, state, bgImage, time } = dc;
  if (!bgImage) return;

  const loop = state.loopCount;
  const imgAspect = bgImage.naturalWidth / bgImage.naturalHeight;
  const drawH = height;
  const drawW = drawH * imgAspect;

  const scrollSpeed = 0.95;
  const offset = (state.cameraX * scrollSpeed) % drawW;

  // === PROGRESSIVE WORLD DISTORTION ===

  // Loop 6+: subtle horizontal wave distortion
  if (loop >= 6) {
    ctx.save();
    const sliceH = 4;
    for (let sy = 0; sy < height; sy += sliceH) {
      const waveAmt = Math.sin(sy * 0.02 + time * 0.001) * (loop - 5) * 1.5;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, sy, width, sliceH);
      ctx.clip();
      ctx.translate(waveAmt, 0);
      for (let i = -1; i < Math.ceil(width / drawW) + 2; i++) {
        ctx.drawImage(bgImage, i * drawW - offset, 0, drawW, drawH);
      }
      ctx.restore();
    }
    ctx.restore();
  } else {
    // Normal draw
    for (let i = -1; i < Math.ceil(width / drawW) + 2; i++) {
      const x = i * drawW - offset;
      ctx.drawImage(bgImage, x, 0, drawW, drawH);
    }
  }

  // === PROGRESSIVE DARKNESS ===
  // Each loop the world gets darker
  if (loop >= 1) {
    ctx.save();
    ctx.globalAlpha = loop * 0.06;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  // === PROGRESSIVE COLOR SHIFT ===
  // Loop 3+: desaturation
  if (loop >= 3) {
    ctx.save();
    ctx.globalCompositeOperation = "saturation";
    ctx.globalAlpha = (loop - 2) * 0.08;
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  // Loop 4+: red tint creeping in
  if (loop >= 4) {
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = (loop - 3) * 0.06;
    ctx.fillStyle = "#ff4040";
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  // Loop 5+: blue/cold dead tint on top
  if (loop >= 5) {
    ctx.save();
    ctx.globalAlpha = (loop - 4) * 0.04;
    ctx.fillStyle = "#000818";
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  // Loop 7: world is almost unrecognizable — heavy red overlay pulses
  if (loop >= 7) {
    ctx.save();
    const pulse = Math.sin(time * 0.002) * 0.5 + 0.5;
    ctx.globalAlpha = 0.08 + pulse * 0.06;
    ctx.fillStyle = "#200000";
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  // === STREET LIGHTS DYING ===
  // Later loops: random dark patches where lights should be (world going dark)
  if (loop >= 4) {
    ctx.save();
    ctx.globalAlpha = 0.15 + (loop - 4) * 0.08;
    for (let i = 0; i < 3; i++) {
      const darkX = seededRandom(i * 7 + loop) * width;
      const darkW = 40 + seededRandom(i * 3 + loop) * 80;
      ctx.fillStyle = "#000";
      ctx.fillRect(darkX, 0, darkW, height);
    }
    ctx.restore();
  }
}

// ======================== PEDESTRIAN ========================
function drawPedestrian(dc: DrawContext) {
  const { ctx, height, state, pedestrianImage } = dc;
  if (!state.pedestrianActive || !pedestrianImage || !pedestrianImage.complete || !pedestrianImage.naturalWidth) return;

  const gy = height * GROUND_Y_RATIO - 28;
  const screenX = state.pedestrianX - state.cameraX;

  ctx.save();

  // Same bob as player
  const bob = Math.sin(state.pedestrianWalkFrame * 0.08) * 1.2;

  // Same scale as player
  const targetH = 350;
  const scale = targetH / pedestrianImage.naturalHeight;
  const imgW = pedestrianImage.naturalWidth * scale;
  const imgH = targetH;

  const drawX = screenX - imgW / 2;
  const drawY = gy - imgH * 0.42 + bob;

  ctx.drawImage(pedestrianImage, drawX, drawY, imgW, imgH);

  ctx.restore();
}

// ======================== CAR ========================
function drawCar(dc: DrawContext) {
  const { ctx, height, state, carImage } = dc;
  if (!state.carActive || !carImage || !carImage.complete || !carImage.naturalWidth) return;

  const gy = height * GROUND_Y_RATIO - 28;
  const screenX = state.carX - state.cameraX;

  ctx.save();

  // Car scale — very large, dominant on screen
  const carH = 320;
  const scale = carH / carImage.naturalHeight;
  const carW = carImage.naturalWidth * scale;

  // Car position — lower on screen
  const carY = gy - carH + 140;

  // Draw car (facing left — same direction as it moves)
  const cx = screenX - carW / 2;
  ctx.drawImage(carImage, cx, carY, carW, carH);

  // Headlight glow (front of car = left side since moving left)
  ctx.globalAlpha = 0.15;
  const hlGrad = ctx.createRadialGradient(screenX - carW / 2 - 10, carY + carH / 2, 5, screenX - carW / 2 - 10, carY + carH / 2, 80);
  hlGrad.addColorStop(0, "#fffde0");
  hlGrad.addColorStop(0.3, "rgba(255,250,200,0.3)");
  hlGrad.addColorStop(1, "transparent");
  ctx.fillStyle = hlGrad;
  ctx.fillRect(screenX - carW / 2 - 90, carY - 30, 120, carH + 60);

  // Light beam on ground
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = "#fffde0";
  ctx.beginPath();
  ctx.moveTo(screenX - carW / 2, carY + carH / 2);
  ctx.lineTo(screenX - carW / 2 - 150, carY + carH + 20);
  ctx.lineTo(screenX - carW / 2 - 150, carY - 10);
  ctx.fill();

  ctx.restore();
}

// ======================== HANGING FIGURES ========================
function drawHangingFigures(dc: DrawContext) {
  const { ctx, width, height, state, time, hangingImage } = dc;
  if (!hangingImage || !hangingImage.complete || !hangingImage.naturalWidth) return;
  const loop = state.loopCount;
  if (loop < 4) return; // Only appear from loop 4+

  const px = state.cameraX * 0.95;
  const gy = height * GROUND_Y_RATIO - 28;

  // Hanging positions — tied to "utility pole" spacing
  const positions: { worldX: number; minLoop: number }[] = [
    { worldX: 1200, minLoop: 2 },
    { worldX: 500, minLoop: 2 },
    { worldX: 1700, minLoop: 3 },
    { worldX: 900, minLoop: 3 },
    { worldX: 300, minLoop: 3 },
  ];

  for (const pos of positions) {
    if (loop < pos.minLoop) continue;
    const screenX = pos.worldX - state.cameraX;
    if (screenX < -100 || screenX > width + 100) continue;

    ctx.save();

    // Subtle swaying
    const sway = Math.sin(time * 0.001 + pos.worldX * 0.01) * 3;

    // Scale image
    const targetH = 180;
    const scale = targetH / hangingImage.naturalHeight;
    const imgW = hangingImage.naturalWidth * scale;
    const imgH = targetH;

    // Draw from top — hanging from above, feet dangling
    const hangY = gy - imgH - 60; // Above ground level

    // Rope from top of screen
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(screenX + sway * 0.3, 0);
    ctx.lineTo(screenX + sway, hangY + 5);
    ctx.stroke();

    // The figure — slight sway rotation
    ctx.translate(screenX + sway, hangY);
    ctx.rotate(sway * 0.003);
    ctx.translate(-(screenX + sway), -hangY);

    // Opacity — slightly transparent, more visible in later loops
    ctx.globalAlpha = 0.4 + (loop - 4) * 0.12;

    ctx.drawImage(hangingImage, screenX - imgW / 2 + sway, hangY, imgW, imgH);

    ctx.restore();
  }
}

// ======================== SKY ========================
function drawSky(dc: DrawContext) {
  const { ctx, width, height, state } = dc;
  const d = Math.min(state.loopCount * 0.04, 0.3);
  // Deep navy blue night sky like the reference
  const grad = ctx.createLinearGradient(0, 0, 0, height * 0.55);
  grad.addColorStop(0, lerpColor("#0a0e1e", "#040608", d));
  grad.addColorStop(0.3, lerpColor("#0e1428", "#060810", d));
  grad.addColorStop(0.6, lerpColor("#141a30", "#0a0c18", d));
  grad.addColorStop(1, lerpColor("#1a2035", "#0e1018", d));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height * 0.55);

  // Stars (fade out in later loops)
  if (state.loopCount < 5) {
    ctx.save();
    ctx.globalAlpha = 0.15 - state.loopCount * 0.03;
    ctx.fillStyle = "#c0c8d0";
    for (let i = 0; i < 12; i++) {
      const sx = seededRandom(i * 7.1) * width;
      const sy = seededRandom(i * 3.3) * height * 0.25;
      ctx.fillRect(sx, sy, 1, 1);
    }
    ctx.restore();
  }

  // Eerie reddish glow on horizon (gets stronger each loop)
  if (state.loopCount >= 1) {
    ctx.save();
    ctx.globalAlpha = 0.03 + state.loopCount * 0.015;
    const redGlow = ctx.createLinearGradient(0, height * 0.3, 0, height * 0.55);
    redGlow.addColorStop(0, "transparent");
    redGlow.addColorStop(0.7, "#401010");
    redGlow.addColorStop(1, "#200808");
    ctx.fillStyle = redGlow;
    ctx.fillRect(0, height * 0.3, width, height * 0.25);
    ctx.restore();
  }

  // Low menacing clouds
  ctx.save();
  const cloudAlpha = 0.04 + state.loopCount * 0.01;
  ctx.globalAlpha = cloudAlpha;
  const px = state.cameraX * 0.01;
  for (let i = 0; i < 5; i++) {
    const cx = seededRandom(i * 11.3) * width * 1.5 - px * 10;
    const cy = height * 0.15 + seededRandom(i * 7.7) * height * 0.2;
    const cw = 100 + seededRandom(i * 5.1) * 150;
    const ch = 10 + seededRandom(i * 3.9) * 15;
    ctx.fillStyle = state.loopCount >= 4 ? "#1a0810" : "#151a25";
    ctx.beginPath();
    ctx.ellipse(cx % (width + 200), cy, cw, ch, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ======================== DISTANT BUILDINGS ========================
function drawDistantBuildings(dc: DrawContext) {
  const { ctx, width, height, state } = dc;
  const px = state.cameraX * 0.06;
  const baseY = height * 0.35;
  for (let i = -2; i < 25; i++) {
    const s = i * 11.3;
    const x = i * 90 - (px % 90);
    const bw = 40 + seededRandom(s) * 70;
    const bh = 25 + seededRandom(s + 1) * 60;
    // Bluish-grey distant silhouettes
    ctx.fillStyle = "#181e2a";
    ctx.fillRect(x, baseY - bh, bw, bh + 15);
    // Tiny warm window dots
    for (let wy = 5; wy < bh - 5; wy += 7) {
      for (let wx = 4; wx < bw - 4; wx += 8) {
        if (seededRandom(s + wx + wy) > 0.6) {
          const lit = seededRandom(s + wx * 3 + wy) > 0.65;
          ctx.fillStyle = lit ? "#c8a050" : "#101520";
          ctx.globalAlpha = lit ? 0.25 : 1;
          ctx.fillRect(x + wx, baseY - bh + wy, 3, 3);
          ctx.globalAlpha = 1;
        }
      }
    }
  }
}

// ======================== MID BUILDINGS ========================
function drawMidBuildings(dc: DrawContext) {
  const { ctx, width, height, state, time } = dc;
  const px = state.cameraX * 0.25;
  const baseY = height * 0.48;
  for (let i = -2; i < 14; i++) {
    const s = i * 19.7 + 3;
    const x = i * 140 - (px % 140);
    const bw = 70 + seededRandom(s) * 90;
    const bh = 70 + seededRandom(s + 1) * 80;
    // Blue-grey concrete apartment blocks
    const grad = ctx.createLinearGradient(x, baseY - bh, x + bw, baseY);
    grad.addColorStop(0, "#2a3040");
    grad.addColorStop(1, "#222838");
    ctx.fillStyle = grad;
    ctx.fillRect(x, baseY - bh, bw, bh + 20);
    // Moonlight edge highlight
    ctx.fillStyle = "rgba(80,90,110,0.15)";
    ctx.fillRect(x, baseY - bh, 1.5, bh + 20);
    // Windows — warm orange/yellow light
    for (let wy = 8; wy < bh - 10; wy += 16) {
      for (let wx = 6; wx < bw - 10; wx += 18) {
        if (seededRandom(s + wx * 0.5 + wy * 0.3) < 0.2) continue;
        const lit = seededRandom(s + wx * 2 + wy) > 0.5;
        const flk = state.loopCount >= 3 && lit && Math.sin(time * 0.003 + s + wx) > 0.9;
        if (lit || flk) {
          // Warm window glow
          ctx.save();
          ctx.globalAlpha = 0.12;
          ctx.fillStyle = "#d4a040";
          ctx.fillRect(x + wx - 3, baseY - bh + wy - 3, 15, 15);
          ctx.restore();
          // Some windows orange, some warm white — eerie red in later loops
          const isCreepy = state.loopCount >= 3 && seededRandom(s + wx * 7) > 0.9;
          const warmColor = isCreepy ? "#a03030" : (seededRandom(s + wx) > 0.5 ? "#c89040" : "#d4b868");
          ctx.fillStyle = flk ? "#e0a848" : warmColor;
          ctx.globalAlpha = 0.6;
          ctx.fillRect(x + wx, baseY - bh + wy, 9, 9);
          ctx.globalAlpha = 1;
        } else {
          ctx.fillStyle = "#101825";
          ctx.fillRect(x + wx, baseY - bh + wy, 9, 9);
        }
      }
    }
  }
}

// ======================== STREET ========================
function drawStreet(dc: DrawContext) {
  const { ctx, width, height, state } = dc;
  const gy = height * GROUND_Y_RATIO;

  // Asphalt — slightly blue-tinted dark grey
  const rg = ctx.createLinearGradient(0, gy, 0, height);
  rg.addColorStop(0, "#222530");
  rg.addColorStop(0.4, "#1a1d28");
  rg.addColorStop(1, "#12141c");
  ctx.fillStyle = rg;
  ctx.fillRect(0, gy, width, height - gy);

  // Curb
  ctx.fillStyle = "#3a3d48";
  ctx.fillRect(0, gy - 4, width, 6);
  ctx.fillStyle = "#484c55";
  ctx.fillRect(0, gy - 4, width, 1.5);

  // Sidewalk — light grey concrete
  const sg = ctx.createLinearGradient(0, gy - 28, 0, gy - 4);
  sg.addColorStop(0, "#404550");
  sg.addColorStop(1, "#353840");
  ctx.fillStyle = sg;
  ctx.fillRect(0, gy - 28, width, 24);

  // Tile joints
  const ppx = state.cameraX * 0.95;
  ctx.strokeStyle = "rgba(70,75,85,0.3)";
  ctx.lineWidth = 0.8;
  for (let i = -1; i < width / 40 + 2; i++) {
    const tx = i * 40 - (ppx % 40);
    ctx.beginPath();
    ctx.moveTo(tx, gy - 28);
    ctx.lineTo(tx, gy - 4);
    ctx.stroke();
  }

  // Wet road reflection — bluish
  ctx.save();
  ctx.globalAlpha = 0.05;
  const wg = ctx.createLinearGradient(0, gy, 0, gy + 40);
  wg.addColorStop(0, "#6080a0");
  wg.addColorStop(1, "transparent");
  ctx.fillStyle = wg;
  ctx.fillRect(0, gy, width, 40);
  ctx.restore();
}

// ======================== MAIN BUILDINGS ========================
function drawMainBuildings(dc: DrawContext) {
  const { ctx, width, height, state, time } = dc;
  const px = state.cameraX * 0.95;
  const baseY = height * GROUND_Y_RATIO - 28;

  for (let i = -1; i < 6; i++) {
    const worldI = i + Math.floor(px / 350);
    const x = i * 350 - (px % 350);
    const bt = ((worldI % 6) + 6) % 6;
    switch (bt) {
      case 0: drawConcreteHouse(ctx, x, baseY, state, time, worldI); break;
      case 1: drawApartment(ctx, x, baseY, state, time, worldI); break;
      case 2: drawShop(ctx, x, baseY, state, time, worldI); break;
      case 3: drawWall(ctx, x, baseY, state, time, worldI); break;
      case 4: drawTraditionalHouse(ctx, x, baseY, state, time, worldI); break;
      case 5: drawAlley(ctx, x, baseY, state, time, worldI); break;
    }
  }
}

function drawConcreteHouse(ctx: CanvasRenderingContext2D, x: number, baseY: number, state: GameState, time: number, seed: number) {
  const w = 300, h = 220;
  // Wall — light grey concrete like the reference photo
  const wg = ctx.createLinearGradient(x, baseY - h, x + w, baseY);
  wg.addColorStop(0, "#505868");
  wg.addColorStop(0.5, "#4a5260");
  wg.addColorStop(1, "#454d58");
  ctx.fillStyle = wg;
  ctx.fillRect(x, baseY - h, w, h);

  // Water stain
  ctx.save();
  ctx.globalAlpha = 0.12;
  const sg = ctx.createLinearGradient(x + w * 0.3, baseY - h, x + w * 0.3, baseY);
  sg.addColorStop(0, "transparent");
  sg.addColorStop(0.5, "#2a3040");
  sg.addColorStop(1, "#202830");
  ctx.fillStyle = sg;
  ctx.fillRect(x + w * 0.2, baseY - h, w * 0.25, h);
  ctx.restore();

  // Roof — dark blue-grey tiles
  ctx.fillStyle = "#252a35";
  ctx.fillRect(x - 8, baseY - h - 8, w + 16, 10);
  ctx.fillStyle = "#1a2028";
  ctx.beginPath();
  ctx.moveTo(x - 12, baseY - h - 8);
  ctx.lineTo(x + w / 2, baseY - h - 55);
  ctx.lineTo(x + w + 12, baseY - h - 8);
  ctx.fill();

  // Wall texture
  drawWallTexture(ctx, x, baseY - h, w, h, seed * 7);

  // Foundation line
  ctx.fillStyle = "#3a4250";
  ctx.fillRect(x, baseY - 15, w, 15);

  // Door
  ctx.fillStyle = "#2a3038";
  ctx.fillRect(x + w / 2 - 30, baseY - 100, 60, 100);
  ctx.fillStyle = "#222830";
  ctx.fillRect(x + w / 2 - 27, baseY - 96, 26, 96);
  ctx.fillRect(x + w / 2 + 1, baseY - 96, 26, 96);
  // Door handle
  ctx.fillStyle = "#808890";
  ctx.beginPath();
  ctx.arc(x + w / 2 - 4, baseY - 50, 2, 0, Math.PI * 2);
  ctx.fill();
  // Door light
  ctx.save();
  ctx.globalAlpha = 0.04;
  ctx.fillStyle = "#c0a060";
  ctx.fillRect(x + w / 2 - 32, baseY - 102, 64, 8);
  ctx.restore();

  // Windows with shutters
  drawWindow(ctx, x + 20, baseY - 180, 55, 50, state, time, seed);
  drawWindow(ctx, x + w - 80, baseY - 180, 55, 50, state, time, seed + 1);

  // Window ledges
  ctx.fillStyle = "#555e68";
  ctx.fillRect(x + 18, baseY - 128, 59, 3);
  ctx.fillRect(x + w - 82, baseY - 128, 59, 3);

  // Intercom/nameplate
  ctx.fillStyle = "#586068";
  ctx.fillRect(x + w / 2 - 40, baseY - 70, 15, 10);

  // Mailbox
  ctx.fillStyle = "#882020";
  ctx.fillRect(x + 12, baseY - 55, 14, 22);
  ctx.fillStyle = "#aa2828";
  ctx.fillRect(x + 12, baseY - 55, 14, 3);

  // Concrete block fence in front
  ctx.fillStyle = "#485060";
  ctx.fillRect(x - 5, baseY - 45, w * 0.3, 45);
  ctx.strokeStyle = "rgba(60,68,78,0.4)";
  ctx.lineWidth = 0.5;
  for (let fy = 0; fy < 45; fy += 10) {
    ctx.beginPath();
    ctx.moveTo(x - 5, baseY - 45 + fy);
    ctx.lineTo(x - 5 + w * 0.3, baseY - 45 + fy);
    ctx.stroke();
  }
  // Fence cap
  ctx.fillStyle = "#505868";
  ctx.fillRect(x - 7, baseY - 48, w * 0.3 + 4, 4);

  if (state.loopCount >= 4) {
    ctx.save();
    ctx.globalAlpha = 0.25 + Math.sin(time * 0.002) * 0.1;
    drawBloodDrips(ctx, x + w / 2 - 25, baseY - 95, 50, 60, time);
    ctx.restore();
  }
}

function drawApartment(ctx: CanvasRenderingContext2D, x: number, baseY: number, state: GameState, time: number, seed: number) {
  const w = 340, h = 300;
  // Concrete apartment — grey with blue tint like reference
  const wg = ctx.createLinearGradient(x, baseY - h, x, baseY);
  wg.addColorStop(0, "#485060");
  wg.addColorStop(1, "#3a4250");
  ctx.fillStyle = wg;
  ctx.fillRect(x, baseY - h, w, h);
  // Shadow edge
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.fillRect(x + w - 16, baseY - h, 16, h);
  // Flat roof
  ctx.fillStyle = "#2a3040";
  ctx.fillRect(x - 5, baseY - h - 6, w + 10, 8);

  // Wall texture
  drawWallTexture(ctx, x, baseY - h, w, h, seed * 11);

  for (let fl = 0; fl < 5; fl++) {
    const fy = baseY - h + 12 + fl * 58;

    // Floor slab / corridor line
    ctx.fillStyle = "#3a4250";
    ctx.fillRect(x, fy + 43, w - 16, 6);
    // Shadow under slab
    ctx.fillStyle = "rgba(0,0,0,0.1)";
    ctx.fillRect(x, fy + 49, w - 16, 3);

    // Balcony railing — metal bars
    ctx.strokeStyle = "#5a6270";
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(x, fy + 42);
    ctx.lineTo(x + w - 16, fy + 42);
    ctx.stroke();
    // Vertical bars
    for (let bar = 0; bar < w - 20; bar += 12) {
      ctx.beginPath();
      ctx.moveTo(x + 4 + bar, fy + 42);
      ctx.lineTo(x + 4 + bar, fy + 49);
      ctx.stroke();
    }

    for (let rm = 0; rm < 3; rm++) {
      const wx = x + 14 + rm * 105;
      drawWindow(ctx, wx, fy, 70, 40, state, time, seed + fl * 10 + rm);

      // Window ledge
      ctx.fillStyle = "#555e68";
      ctx.fillRect(wx - 2, fy + 40, 74, 2);

      // Balcony items
      if (seededRandom(seed + fl + rm * 5) > 0.5) {
        // Laundry/futon
        ctx.fillStyle = "#485058";
        ctx.fillRect(wx + 5, fy + 40, 24, 4);
      }
      // AC outdoor unit on balcony
      if (seededRandom(seed + fl * 3 + rm * 7) > 0.7) {
        ctx.fillStyle = "#505860";
        ctx.fillRect(wx + 55, fy + 32, 14, 10);
        ctx.strokeStyle = "#48505a";
        ctx.lineWidth = 0.4;
        ctx.beginPath();
        ctx.arc(wx + 62, fy + 37, 3, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Face in window
      if (state.loopCount >= 5 && fl === 3 && rm === 1 && Math.sin(time * 0.0006) > 0.15) {
        drawFace(ctx, wx + 25, fy + 6, 0.35 + Math.sin(time * 0.002) * 0.15, state.loopCount);
      }
    }
  }
  // Stairwell with door outlines
  ctx.fillStyle = "#283040";
  ctx.fillRect(x + w - 44, baseY - h, 28, h);
  for (let fl = 0; fl < 5; fl++) {
    const fy = baseY - h + 15 + fl * 58;
    ctx.strokeStyle = "#3a4250";
    ctx.lineWidth = 0.6;
    ctx.strokeRect(x + w - 40, fy, 20, 40);
  }
}

function drawShop(ctx: CanvasRenderingContext2D, x: number, baseY: number, state: GameState, time: number, seed: number) {
  const w = 280, h = 170;
  ctx.fillStyle = "#3a4250";
  ctx.fillRect(x, baseY - h, w, h);

  // Convenience store style — illuminated sign band
  ctx.fillStyle = "#e8e0d0";
  ctx.globalAlpha = 0.2;
  ctx.fillRect(x, baseY - h - 2, w, 22);
  ctx.globalAlpha = 1;
  // Sign with colored stripes (like 7-11 or FamilyMart)
  ctx.fillStyle = "#1060a0";
  ctx.fillRect(x + 5, baseY - h, w - 10, 6);
  ctx.fillStyle = "#e04020";
  ctx.fillRect(x + 5, baseY - h + 6, w - 10, 4);
  ctx.fillStyle = "#20a040";
  ctx.fillRect(x + 5, baseY - h + 10, w - 10, 4);

  // Store name
  ctx.fillStyle = "#c0c8d0";
  ctx.font = "bold 8px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("マート", x + w / 2, baseY - h + 20);

  // Big illuminated window — bright interior
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = "#d0d8e0";
  ctx.fillRect(x + 5, baseY - h + 22, w - 65, 95);
  ctx.restore();
  ctx.fillStyle = "#c0c8d0";
  ctx.globalAlpha = 0.12;
  ctx.fillRect(x + 10, baseY - h + 28, w - 75, 82);
  ctx.globalAlpha = 1;
  // Store interior - shelves visible
  ctx.fillStyle = "#a0a8b0";
  ctx.globalAlpha = 0.08;
  ctx.fillRect(x + 15, baseY - h + 35, w - 85, 68);
  ctx.globalAlpha = 1;
  // Shelf lines
  ctx.strokeStyle = "rgba(160,170,180,0.06)";
  ctx.lineWidth = 0.5;
  for (let sy = 0; sy < 4; sy++) {
    ctx.beginPath();
    ctx.moveTo(x + 20, baseY - h + 42 + sy * 16);
    ctx.lineTo(x + w - 80, baseY - h + 42 + sy * 16);
    ctx.stroke();
  }
  // Window frame
  ctx.strokeStyle = "#6a7080";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 10, baseY - h + 28, w - 75, 82);

  // Glass door (automatic)
  ctx.fillStyle = "#8090a0";
  ctx.globalAlpha = 0.1;
  ctx.fillRect(x + w - 68, baseY - h + 28, 55, h - 28);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "#6a7080";
  ctx.strokeRect(x + w - 68, baseY - h + 28, 55, h - 28);
  // Door center line
  ctx.beginPath();
  ctx.moveTo(x + w - 40, baseY - h + 28);
  ctx.lineTo(x + w - 40, baseY);
  ctx.stroke();

  // Vending machine
  drawVendingMachine(ctx, x + w + 8, baseY, time, state.loopCount);

  // Poster
  ctx.fillStyle = "#3a2822";
  ctx.fillRect(x + 10, baseY - 58, 30, 42);
  ctx.fillStyle = "#4a3830";
  ctx.fillRect(x + 12, baseY - 56, 26, 22);

  // Something behind shop window in later loops
  if (state.loopCount >= 5) {
    ctx.save();
    ctx.globalAlpha = 0.2 + Math.sin(time * 0.001) * 0.1;
    ctx.fillStyle = "#080508";
    ctx.beginPath();
    ctx.ellipse(x + 80, baseY - h + 75, 12, 30, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 80, baseY - h + 42, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawWall(ctx: CanvasRenderingContext2D, x: number, baseY: number, state: GameState, time: number, seed: number) {
  const w = 350, h = 140;
  const wg = ctx.createLinearGradient(x, baseY - h, x, baseY);
  wg.addColorStop(0, "#4a5060");
  wg.addColorStop(1, "#3e4550");
  ctx.fillStyle = wg;
  ctx.fillRect(x, baseY - h, w, h);

  // Block joints
  ctx.strokeStyle = "rgba(42,38,42,0.5)";
  ctx.lineWidth = 0.8;
  for (let by = 0; by < h; by += 16) {
    ctx.beginPath();
    ctx.moveTo(x, baseY - h + by);
    ctx.lineTo(x + w, baseY - h + by);
    ctx.stroke();
    const off = (by / 16) % 2 === 0 ? 0 : 22;
    for (let bx = off; bx < w; bx += 44) {
      ctx.beginPath();
      ctx.moveTo(x + bx, baseY - h + by);
      ctx.lineTo(x + bx, baseY - h + by + 16);
      ctx.stroke();
    }
  }

  // Cap
  ctx.fillStyle = "#282428";
  ctx.fillRect(x - 3, baseY - h - 5, w + 6, 7);

  // Drain pipe
  ctx.fillStyle = "#4a4648";
  ctx.fillRect(x + w * 0.6, baseY - h - 5, 8, h + 5);
  for (let pb = 0; pb < h; pb += 30) {
    ctx.fillStyle = "#555";
    ctx.fillRect(x + w * 0.6 - 2, baseY - h + pb, 12, 3);
  }
  ctx.fillStyle = "#4a4648";
  ctx.fillRect(x + w * 0.6, baseY - 8, 22, 8);

  // Weeds
  ctx.fillStyle = "#182518";
  for (let g = 0; g < 5; g++) {
    const gx = x + 15 + seededRandom(seed + g) * (w - 30);
    ctx.beginPath();
    ctx.moveTo(gx, baseY);
    ctx.lineTo(gx - 1.5, baseY - 6 - seededRandom(seed + g + 8) * 8);
    ctx.lineTo(gx + 1.5, baseY);
    ctx.fill();
  }

  if (state.loopCount >= 3) {
    ctx.save();
    ctx.globalAlpha = 0.35;
    drawBloodDrips(ctx, x + 40, baseY - h + 5, w - 80, 50, time);
    ctx.restore();
  }

  // Handprint on wall in later loops
  if (state.loopCount >= 6) {
    ctx.save();
    ctx.globalAlpha = 0.2 + Math.sin(time * 0.001) * 0.05;
    drawHandprint(ctx, x + 150, baseY - 80);
    ctx.restore();
  }
}

function drawTraditionalHouse(ctx: CanvasRenderingContext2D, x: number, baseY: number, state: GameState, time: number, seed: number) {
  const w = 330, h = 230;
  // White-ish traditional house wall like the reference
  const wg = ctx.createLinearGradient(x, baseY - h, x + w, baseY);
  wg.addColorStop(0, "#586068");
  wg.addColorStop(0.5, "#505860");
  wg.addColorStop(1, "#484e58");
  ctx.fillStyle = wg;
  ctx.fillRect(x, baseY - h, w, h);

  // Water stain
  ctx.save();
  ctx.globalAlpha = 0.14;
  ctx.fillStyle = "#1a1414";
  ctx.fillRect(x + 15, baseY - h + h * 0.55, w * 0.65, h * 0.45);
  ctx.restore();

  // Wooden beams
  ctx.fillStyle = "#282018";
  ctx.fillRect(x, baseY - h, w, 5);
  ctx.fillRect(x, baseY - h * 0.45, w, 3);
  ctx.fillRect(x + w * 0.36, baseY - h, 4, h);

  // Roof
  ctx.fillStyle = "#131012";
  ctx.beginPath();
  ctx.moveTo(x - 22, baseY - h);
  ctx.lineTo(x + 35, baseY - h - 50);
  ctx.lineTo(x + w - 35, baseY - h - 50);
  ctx.lineTo(x + w + 22, baseY - h);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + 35, baseY - h - 50);
  ctx.lineTo(x + w / 2, baseY - h - 72);
  ctx.lineTo(x + w - 35, baseY - h - 50);
  ctx.fill();
  // Eave shadow
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(x - 22, baseY - h, w + 44, 9);

  // Fusuma
  ctx.fillStyle = "#242018";
  ctx.fillRect(x + 18, baseY - 110, 95, 110);
  ctx.fillRect(x + 118, baseY - 110, 95, 110);
  ctx.strokeStyle = "#2e2820";
  ctx.lineWidth = 1.2;
  ctx.strokeRect(x + 20, baseY - 108, 91, 106);
  ctx.strokeRect(x + 120, baseY - 108, 91, 106);
  for (let dy = 0; dy < 4; dy++) {
    for (const dx of [20, 120]) {
      ctx.beginPath();
      ctx.moveTo(x + dx, baseY - 108 + dy * 26);
      ctx.lineTo(x + dx + 91, baseY - 108 + dy * 26);
      ctx.stroke();
    }
  }

  // Lattice window
  ctx.fillStyle = "#0a0808";
  ctx.fillRect(x + w - 90, baseY - 190, 60, 50);
  ctx.strokeStyle = "#302820";
  ctx.lineWidth = 1.2;
  for (let lx = 0; lx < 6; lx++) {
    ctx.beginPath();
    ctx.moveTo(x + w - 90 + lx * 10, baseY - 190);
    ctx.lineTo(x + w - 90 + lx * 10, baseY - 140);
    ctx.stroke();
  }
  for (let ly = 0; ly < 5; ly++) {
    ctx.beginPath();
    ctx.moveTo(x + w - 90, baseY - 190 + ly * 10);
    ctx.lineTo(x + w - 30, baseY - 190 + ly * 10);
    ctx.stroke();
  }

  // Bicycle
  drawBicycle(ctx, x + w - 50, baseY - 10);

  // Washing machine
  ctx.fillStyle = "#3a3838";
  ctx.fillRect(x + w - 95, baseY - 60, 42, 60);
  ctx.fillStyle = "#2a2828";
  ctx.beginPath();
  ctx.arc(x + w - 74, baseY - 32, 13, 0, Math.PI * 2);
  ctx.fill();
}

function drawAlley(ctx: CanvasRenderingContext2D, x: number, baseY: number, state: GameState, time: number, seed: number) {
  const w = 350, h = 240;

  // Left wall
  ctx.fillStyle = "#3a4250";
  ctx.fillRect(x, baseY - h, 55, h);

  // Alley void — very dark
  const ag = ctx.createLinearGradient(x + 55, baseY - h, x + 125, baseY - h);
  ag.addColorStop(0, "#060810");
  ag.addColorStop(0.5, "#030508");
  ag.addColorStop(1, "#080c14");
  ctx.fillStyle = ag;
  ctx.fillRect(x + 55, baseY - h, 70, h);

  // Right wall
  ctx.fillStyle = "#404858";
  ctx.fillRect(x + 125, baseY - h, w - 125, h);

  // Eyes in the dark
  if (state.loopCount >= 2) {
    ctx.save();
    const eo = 0.15 + Math.sin(time * 0.0008 + seed) * 0.12;
    ctx.globalAlpha = eo;
    ctx.fillStyle = "#cc2020";
    ctx.beginPath();
    ctx.arc(x + 80, baseY - 110, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 92, baseY - 110, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Full figure in deeper loops
    if (state.loopCount >= 4) {
      ctx.save();
      ctx.globalAlpha = 0.3 + Math.sin(time * 0.001) * 0.12;
      ctx.fillStyle = "#080410";
      ctx.beginPath();
      ctx.ellipse(x + 86, baseY - 85, 14, 75, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + 86, baseY - 168, 15, 0, Math.PI * 2);
      ctx.fill();
      // Hair
      ctx.fillRect(x + 72, baseY - 175, 4, 55);
      ctx.fillRect(x + 96, baseY - 175, 4, 55);
      ctx.restore();
    }

    // Reaching hand from alley
    if (state.loopCount >= 6) {
      ctx.save();
      ctx.globalAlpha = 0.25 + Math.sin(time * 0.002) * 0.1;
      ctx.fillStyle = "#c0a880";
      // Arm reaching out
      ctx.fillRect(x + 120, baseY - 80, 15, 5);
      // Fingers
      for (let f = 0; f < 4; f++) {
        ctx.fillRect(x + 135 + f * 4, baseY - 82 + f, 4, 3);
      }
      ctx.restore();
    }
  }

  // Right building windows
  drawWindow(ctx, x + 140, baseY - 200, 48, 42, state, time, seed);
  drawWindow(ctx, x + 210, baseY - 200, 48, 42, state, time, seed + 1);
  drawWindow(ctx, x + 140, baseY - 120, 48, 42, state, time, seed + 2);

  // Door
  ctx.fillStyle = "#1e1a20";
  ctx.fillRect(x + 270, baseY - 95, 48, 95);

  // Pipes
  ctx.fillStyle = "#444";
  ctx.fillRect(x + 51, baseY - h, 3.5, h);
  ctx.fillRect(x + 125, baseY - h, 3.5, h);
}

// ======================== TREES ========================
function drawTrees(dc: DrawContext) {
  const { ctx, height, state } = dc;
  const px = state.cameraX * 0.5;
  const baseY = height * 0.48;

  for (let i = -1; i < 8; i++) {
    const s = i * 31.7;
    const x = i * 320 + 80 - (px % 320);
    if (seededRandom(s) < 0.4) continue;

    const treeH = 40 + seededRandom(s + 1) * 50;
    const treeW = 30 + seededRandom(s + 2) * 40;

    // Trunk
    ctx.fillStyle = "#1a2018";
    ctx.fillRect(x - 2, baseY - treeH * 0.4, 4, treeH * 0.4 + 15);

    // Canopy - dark green/black silhouette with organic shape
    ctx.fillStyle = "#0c1810";
    ctx.beginPath();
    ctx.ellipse(x, baseY - treeH * 0.5, treeW * 0.5, treeH * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Secondary canopy blobs for natural look
    ctx.beginPath();
    ctx.ellipse(x - treeW * 0.25, baseY - treeH * 0.45, treeW * 0.35, treeH * 0.3, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + treeW * 0.2, baseY - treeH * 0.55, treeW * 0.3, treeH * 0.28, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // Subtle leaf texture highlights
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = "#1a3020";
    for (let l = 0; l < 8; l++) {
      const lx = x + (seededRandom(s + l * 5) - 0.5) * treeW * 0.8;
      const ly = baseY - treeH * 0.3 - seededRandom(s + l * 3 + 1) * treeH * 0.4;
      ctx.beginPath();
      ctx.arc(lx, ly, 3 + seededRandom(s + l) * 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// ======================== ENVIRONMENT DETAILS ========================
function drawEnvironmentDetails(dc: DrawContext) {
  const { ctx, height, state } = dc;
  const px = state.cameraX * 0.95;
  const baseY = height * GROUND_Y_RATIO - 28;

  // AC outdoor units on buildings
  for (let i = 0; i < 6; i++) {
    const s = i * 43.1;
    const x = i * 400 + 50 - (px % 400);
    if (seededRandom(s) < 0.3) continue;

    const unitY = baseY - 40 - seededRandom(s + 1) * 60;

    // AC unit box
    ctx.fillStyle = "#505860";
    ctx.fillRect(x, unitY, 22, 16);
    ctx.fillStyle = "#586068";
    ctx.fillRect(x + 1, unitY + 1, 20, 14);

    // Fan grill
    ctx.strokeStyle = "#48505a";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.arc(x + 11, unitY + 8, 5, 0, Math.PI * 2);
    ctx.stroke();

    // Pipes from AC
    ctx.strokeStyle = "#485058";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 11, unitY + 16);
    ctx.lineTo(x + 11, unitY + 30);
    ctx.stroke();

    // Wall bracket
    ctx.fillStyle = "#404850";
    ctx.fillRect(x - 2, unitY + 14, 3, 8);
    ctx.fillRect(x + 21, unitY + 14, 3, 8);
  }

  // Road signs
  for (let i = 0; i < 3; i++) {
    const x = i * 700 + 200 - (px % 700);
    const signY = baseY - 100;

    // Sign pole
    ctx.fillStyle = "#607080";
    ctx.fillRect(x, signY, 3, 100);

    // Sign plate (blue triangle = one-way, etc.)
    ctx.fillStyle = "#2040a0";
    ctx.beginPath();
    ctx.moveTo(x - 10, signY - 5);
    ctx.lineTo(x + 13, signY - 5);
    ctx.lineTo(x + 13, signY + 15);
    ctx.lineTo(x - 10, signY + 15);
    ctx.fill();
    // White arrow
    ctx.fillStyle = "#c0c8d0";
    ctx.beginPath();
    ctx.moveTo(x - 4, signY + 5);
    ctx.lineTo(x + 8, signY + 5);
    ctx.lineTo(x + 5, signY + 1);
    ctx.moveTo(x + 8, signY + 5);
    ctx.lineTo(x + 5, signY + 9);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#c0c8d0";
    ctx.stroke();
  }

  // Concrete wall texture noise on main buildings
  ctx.save();
  ctx.globalAlpha = 0.04;
  for (let i = 0; i < 200; i++) {
    const nx = seededRandom(i * 1.7) * 400 - (px % 400) + (Math.floor(px / 400)) * 400;
    const ny = baseY - seededRandom(i * 2.3) * 300;
    ctx.fillStyle = seededRandom(i * 3.1) > 0.5 ? "#8090a0" : "#202830";
    ctx.fillRect(nx, ny, 1 + seededRandom(i) * 2, 1);
  }
  ctx.restore();

  // Meter boxes on walls
  for (let i = 0; i < 4; i++) {
    const s = i * 57.3;
    const x = i * 500 + 130 - (px % 500);
    if (seededRandom(s) < 0.5) continue;

    ctx.fillStyle = "#3a4250";
    ctx.fillRect(x, baseY - 90, 18, 24);
    ctx.strokeStyle = "#4a5260";
    ctx.lineWidth = 0.8;
    ctx.strokeRect(x, baseY - 90, 18, 24);
    // Meter circle
    ctx.beginPath();
    ctx.arc(x + 9, baseY - 78, 5, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// ======================== WALL TEXTURE HELPER ========================
function drawWallTexture(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number) {
  ctx.save();
  ctx.globalAlpha = 0.06;
  // Concrete surface noise
  for (let i = 0; i < 30; i++) {
    const nx = x + seededRandom(seed + i * 1.3) * w;
    const ny = y + seededRandom(seed + i * 2.7) * h;
    const ns = 1 + seededRandom(seed + i * 4.1) * 3;
    ctx.fillStyle = seededRandom(seed + i) > 0.5 ? "#8090a0" : "#303840";
    ctx.fillRect(nx, ny, ns, ns * 0.5);
  }
  // Subtle crack lines
  ctx.globalAlpha = 0.03;
  ctx.strokeStyle = "#303840";
  ctx.lineWidth = 0.5;
  for (let c = 0; c < 3; c++) {
    const cx = x + seededRandom(seed + c * 10) * w;
    const cy = y + seededRandom(seed + c * 10 + 1) * h * 0.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + (seededRandom(seed + c * 10 + 2) - 0.5) * 20, cy + seededRandom(seed + c * 10 + 3) * 30);
    ctx.stroke();
  }
  ctx.restore();
}

// ======================== UTILITY ========================
function drawWindow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, state: GameState, time: number, seed: number) {
  // Window frame — darker concrete
  ctx.fillStyle = "#3a4050";
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);

  const lit = seededRandom(seed * 7.1) > 0.5;
  if (lit) {
    // Warm light glow spill
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = "#d4a040";
    ctx.fillRect(x - 5, y - 5, w + 10, h + 10);
    ctx.restore();
    // Warm interior — orange/amber
    const warmTone = seededRandom(seed * 2.1) > 0.4;
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    if (warmTone) {
      g.addColorStop(0, "#c08838");
      g.addColorStop(1, "#a07028");
    } else {
      g.addColorStop(0, "#d0a050");
      g.addColorStop(1, "#b89040");
    }
    ctx.fillStyle = g;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
  } else {
    // Dark window — deep blue-black
    ctx.fillStyle = "#0c1020";
    ctx.fillRect(x, y, w, h);
  }

  // Cross frame
  ctx.strokeStyle = "#4a5060";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w / 2, y + h);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.38);
  ctx.lineTo(x + w, y + h * 0.38);
  ctx.stroke();

  // Curtain
  if (seededRandom(seed * 3.3) > 0.35) {
    ctx.fillStyle = lit ? "#3a3020" : "#181418";
    ctx.fillRect(x + 1, y + 1, w * 0.32, h - 2);
    ctx.fillRect(x + w * 0.68, y + 1, w * 0.31, h - 2);
  }

  // Reflection
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.moveTo(x + 2, y + 2);
  ctx.lineTo(x + w * 0.3, y + 2);
  ctx.lineTo(x + 2, y + h * 0.35);
  ctx.fill();
  ctx.restore();
}

function drawVendingMachine(ctx: CanvasRenderingContext2D, x: number, baseY: number, time: number, loop: number) {
  const w = 40, h = 105;
  const mx = x - w;
  ctx.fillStyle = "#183040";
  ctx.fillRect(mx, baseY - h, w, h);

  // Glow
  ctx.save();
  const glowAlpha = loop >= 6 ? 0.05 : 0.2;
  ctx.globalAlpha = glowAlpha;
  ctx.fillStyle = "#204858";
  ctx.fillRect(mx - 6, baseY - h - 3, w + 12, h + 6);
  ctx.restore();

  // Products
  const dg = ctx.createLinearGradient(mx, baseY - h, mx, baseY - 30);
  dg.addColorStop(0, loop >= 6 ? "#0a1820" : "#1a4050");
  dg.addColorStop(1, loop >= 6 ? "#081518" : "#153540");
  ctx.fillStyle = dg;
  ctx.fillRect(mx + 3, baseY - h + 5, w - 6, 58);

  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      ctx.fillStyle = seededRandom(r + c * 5) > 0.5 ? "#2050aa" : "#aa3020";
      ctx.fillRect(mx + 6 + c * 10, baseY - h + 8 + r * 18, 7, 14);
    }
  }

  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(mx + 5, baseY - 32, w - 10, 20);
  ctx.fillStyle = "#555";
  ctx.fillRect(mx + w - 12, baseY - h + 68, 6, 10);

  // Flickering light in late loops
  if (loop >= 5 && Math.sin(time * 0.01) > 0.8) {
    ctx.save();
    ctx.globalAlpha = 0.04;
    ctx.fillStyle = "#000";
    ctx.fillRect(mx, baseY - h, w, h);
    ctx.restore();
  }
}

function drawBicycle(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.strokeStyle = "#4a4545";
  ctx.lineWidth = 1.2;
  for (const wx of [x, x + 28]) {
    ctx.beginPath();
    ctx.arc(wx, y, 11, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(wx, y, 1.5, 0, Math.PI * 2);
    ctx.stroke();
    for (let s = 0; s < 6; s++) {
      const a = (s / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(wx + Math.cos(a) * 1.5, y + Math.sin(a) * 1.5);
      ctx.lineTo(wx + Math.cos(a) * 10, y + Math.sin(a) * 10);
      ctx.stroke();
    }
  }
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 14, y - 18);
  ctx.lineTo(x + 28, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + 14, y - 18);
  ctx.lineTo(x + 14, y - 4);
  ctx.stroke();
  ctx.fillStyle = "#2a2222";
  ctx.beginPath();
  ctx.ellipse(x + 10, y - 22, 5, 2, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBloodDrips(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, maxH: number, time: number) {
  ctx.fillStyle = "#5a0000";
  for (let d = 0; d < 10; d++) {
    const dx = x + seededRandom(d * 3.7) * w;
    const dh = 6 + seededRandom(d * 5.1) * maxH + Math.sin(d + time * 0.001) * 4;
    const dw = 1.2 + seededRandom(d * 2.3) * 2;
    ctx.fillRect(dx, y, dw, dh);
    ctx.beginPath();
    ctx.arc(dx + dw / 2, y + dh, dw * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHandprint(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#5a0000";
  // Palm
  ctx.beginPath();
  ctx.ellipse(x, y, 10, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  // Fingers
  for (let f = 0; f < 4; f++) {
    ctx.save();
    ctx.translate(x - 9 + f * 6, y - 12);
    ctx.rotate((f - 1.5) * 0.08);
    ctx.fillRect(-2, -14, 4, 14);
    ctx.restore();
  }
  // Thumb
  ctx.save();
  ctx.translate(x + 10, y - 2);
  ctx.rotate(0.5);
  ctx.fillRect(-2, -10, 4, 10);
  ctx.restore();
}

function drawFace(ctx: CanvasRenderingContext2D, x: number, y: number, opacity: number, loop: number) {
  ctx.save();
  ctx.globalAlpha = opacity;
  // Pale face
  ctx.fillStyle = "#c4b490";
  ctx.beginPath();
  ctx.ellipse(x, y + 14, 10, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  // Hair
  ctx.fillStyle = "#080408";
  ctx.beginPath();
  ctx.ellipse(x, y + 6, 12, 10, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x - 14, y + 3, 5, 28);
  ctx.fillRect(x + 9, y + 3, 5, 28);
  // Eyes - hollow black
  ctx.fillStyle = "#000";
  const eyeH = loop >= 6 ? 7 : 4;
  ctx.beginPath();
  ctx.ellipse(x - 4, y + 12, 3, eyeH, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + 4, y + 12, 3, eyeH, 0, 0, Math.PI * 2);
  ctx.fill();
  // Red pupil glow
  if (loop >= 6) {
    ctx.fillStyle = "#aa1515";
    ctx.beginPath();
    ctx.arc(x - 4, y + 12, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 4, y + 12, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  // Mouth
  ctx.fillStyle = "#180505";
  if (loop >= 6) {
    ctx.beginPath();
    ctx.ellipse(x, y + 22, 7, 3, 0, 0, Math.PI);
    ctx.fill();
    // Teeth
    ctx.fillStyle = "#c0b8a0";
    for (let t = -4; t <= 4; t += 2) {
      ctx.fillRect(x + t - 0.5, y + 22, 1.5, 2);
    }
  } else {
    ctx.fillRect(x - 3, y + 21, 6, 2);
  }
  ctx.restore();
}

// ======================== UTILITY POLES ========================
function drawUtilityPoles(dc: DrawContext) {
  const { ctx, width, height, state, time } = dc;
  const px = state.cameraX * 0.95;
  const baseY = height * GROUND_Y_RATIO - 28;

  for (let i = -1; i < 5; i++) {
    const x = i * 500 - (px % 500);

    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.fillRect(x + 9, baseY - 400, 3.5, 430);

    // Pole — blue-grey
    const pg = ctx.createLinearGradient(x, 0, x + 8, 0);
    pg.addColorStop(0, "#606878");
    pg.addColorStop(0.5, "#505868");
    pg.addColorStop(1, "#404850");
    ctx.fillStyle = pg;
    ctx.fillRect(x, baseY - 400, 7, 430);

    // Cross arms
    ctx.fillStyle = "#4c4c4c";
    ctx.fillRect(x - 38, baseY - 390, 83, 4);
    ctx.fillRect(x - 28, baseY - 358, 63, 3);

    // Insulators
    ctx.fillStyle = "#585858";
    for (const ix of [-36, -12, 12, 36]) {
      ctx.beginPath();
      ctx.arc(x + 3.5 + ix, baseY - 392, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Transformer
    if (i % 2 === 0) {
      ctx.fillStyle = "#383838";
      ctx.fillRect(x - 14, baseY - 320, 35, 28);
      ctx.fillStyle = "#303030";
      ctx.fillRect(x - 12, baseY - 318, 31, 24);
    }

    // Wires
    const nx = (i + 1) * 500 - (px % 500);
    ctx.strokeStyle = "#282828";
    ctx.lineWidth = 0.8;
    for (const wy of [baseY - 388, baseY - 356]) {
      ctx.beginPath();
      ctx.moveTo(x + 3.5, wy);
      ctx.quadraticCurveTo((x + nx) / 2, wy + 20, nx + 3.5, wy);
      ctx.stroke();
    }

    // Street light — with creepy flicker in later loops
    ctx.fillStyle = "#555";
    ctx.fillRect(x - 18, baseY - 380, 14, 3);
    // Flicker: lights stutter and go out in later loops
    const flickerSeed = Math.sin(time * 0.008 + i * 5) + Math.sin(time * 0.013 + i * 3);
    const isFlickering = state.loopCount >= 2 && flickerSeed > 1.5;
    const lightOn = state.loopCount < 5 && !isFlickering;
    if (lightOn) {
      // White cone of light
      ctx.save();
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = "#c0c8d8";
      ctx.beginPath();
      ctx.moveTo(x - 18, baseY - 377);
      ctx.lineTo(x - 35, baseY - 280);
      ctx.lineTo(x + 0, baseY - 280);
      ctx.fill();
      ctx.restore();
      // Ground light pool
      ctx.save();
      ctx.globalAlpha = 0.04;
      const pool = ctx.createRadialGradient(x - 12, baseY, 5, x - 12, baseY, 50);
      pool.addColorStop(0, "#c0c8d0");
      pool.addColorStop(1, "transparent");
      ctx.fillStyle = pool;
      ctx.fillRect(x - 62, baseY - 50, 100, 80);
      ctx.restore();
    }
    ctx.fillStyle = lightOn ? "#d0d4e0" : "#1a1a1a";
    ctx.fillRect(x - 17, baseY - 380, 12, 5);
  }
}

// ======================== PLAYER ========================
export function drawPlayer(dc: DrawContext) {
  const { ctx, height, state, playerImage, playerLookupImage } = dc;
  const gy = height * GROUND_Y_RATIO - 28;
  const sx = state.playerX - state.cameraX;
  const facing = state.facingRight ? 1 : -1;

  // Use look-up sprite when looking up at hanging figure
  const lookupReady = playerLookupImage && playerLookupImage.complete && playerLookupImage.naturalWidth > 0;
  if (state.lookingUp && lookupReady) {
    ctx.save();
    const targetH = 350;
    const scale = targetH / playerLookupImage!.naturalHeight;
    const imgW = playerLookupImage!.naturalWidth * scale;
    const imgH = targetH;
    const drawX = sx - imgW / 2;
    const drawY = gy - imgH * 0.42;
    ctx.drawImage(playerLookupImage!, drawX, drawY, imgW, imgH);
    ctx.restore();
    return;
  }

  // Use sprite image if loaded
  if (playerImage && playerImage.complete && playerImage.naturalWidth > 0) {
    ctx.save();

    // Subtle walking bob
    const bob = state.isWalking ? Math.sin(state.walkFrame * 0.08) * 1.2 : 0;

    // Scale large — waist and below will be off-screen
    const targetH = 350;
    const scale = targetH / playerImage.naturalHeight;
    const imgW = playerImage.naturalWidth * scale;
    const imgH = targetH;

    // Push down so legs/lower body are below screen edge, shift up a bit
    const drawX = sx - imgW / 2;
    const drawY = gy - imgH * 0.42 + bob;

    ctx.drawImage(playerImage, drawX, drawY, imgW, imgH);

    ctx.restore();
    return;
  }

  // Fallback: original drawn character (below)

  ctx.save();
  ctx.translate(sx, gy);
  ctx.scale(facing, 1);

  const bob = state.isWalking ? Math.sin(state.walkFrame * 0.08) * 1.8 : 0;
  const legSw = state.isWalking ? Math.sin(state.walkFrame * 0.08) * 14 : 0;
  const armSw = state.isWalking ? Math.sin(state.walkFrame * 0.08) * 10 : 0;

  // Ground shadow
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(0, 0, 20, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // --- LEGS ---
  for (const side of [-1, 1]) {
    const sw = legSw * side;
    ctx.save();
    ctx.translate(side * 5, -30);
    ctx.rotate(sw * 0.012);
    // Thigh
    ctx.fillStyle = "#c4ac88";
    ctx.fillRect(-3.5, 0, 7, 14);
    // Knee
    ctx.fillRect(-3, 14, 6.5, 4);
    // Shin
    ctx.fillRect(-3, 18, 6, 12);
    // Sock
    ctx.fillStyle = "#ddd8d0";
    ctx.fillRect(-3, 24, 6, 8);
    ctx.restore();
  }

  // Shoes
  const sh1 = state.isWalking ? Math.sin(state.walkFrame * 0.08) * 5 : 0;
  ctx.fillStyle = "#121010";
  ctx.fillRect(-1 + sh1, -4, 9, 5);
  ctx.fillRect(-9 - sh1, -4, 9, 5);

  // --- SKIRT ---
  ctx.fillStyle = "#1a1a30";
  const skSw = state.isWalking ? Math.sin(state.walkFrame * 0.08) * 2 : 0;
  ctx.beginPath();
  ctx.moveTo(-16, -46 + bob);
  ctx.lineTo(-14 + skSw, -28);
  ctx.lineTo(15 - skSw, -28);
  ctx.lineTo(17, -46 + bob);
  ctx.fill();
  // Pleat lines
  ctx.strokeStyle = "#141428";
  ctx.lineWidth = 0.5;
  for (let p = -12; p <= 12; p += 4) {
    ctx.beginPath();
    ctx.moveTo(p, -46 + bob);
    ctx.lineTo(p + skSw * (p > 0 ? -0.3 : 0.3), -29);
    ctx.stroke();
  }

  // --- BODY ---
  ctx.fillStyle = "#1a1a30";
  ctx.beginPath();
  ctx.moveTo(-14, -76 + bob);
  ctx.lineTo(-16, -46 + bob);
  ctx.lineTo(17, -46 + bob);
  ctx.lineTo(15, -76 + bob);
  ctx.fill();

  // Sailor collar
  ctx.fillStyle = "#d0ccc5";
  ctx.beginPath();
  ctx.moveTo(-15, -73 + bob);
  ctx.lineTo(-18, -58 + bob);
  ctx.lineTo(0, -47 + bob);
  ctx.lineTo(19, -58 + bob);
  ctx.lineTo(16, -73 + bob);
  ctx.fill();

  // Collar stripes
  ctx.strokeStyle = "#1a1a30";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-16, -69 + bob);
  ctx.lineTo(-17, -60 + bob);
  ctx.lineTo(0, -50 + bob);
  ctx.lineTo(18, -60 + bob);
  ctx.lineTo(17, -69 + bob);
  ctx.stroke();

  // Back collar
  ctx.fillStyle = "#d0ccc5";
  ctx.fillRect(-13, -76 + bob, 27, 12);
  ctx.strokeStyle = "#1a1a30";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-13, -67 + bob);
  ctx.lineTo(14, -67 + bob);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-13, -69 + bob);
  ctx.lineTo(14, -69 + bob);
  ctx.stroke();

  // Ribbon
  ctx.fillStyle = "#8a2030";
  ctx.beginPath();
  ctx.moveTo(-6, -63 + bob);
  ctx.lineTo(0, -55 + bob);
  ctx.lineTo(7, -63 + bob);
  ctx.fill();
  ctx.strokeStyle = "#6a1520";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(0, -63 + bob);
  ctx.lineTo(0, -53 + bob);
  ctx.stroke();

  // --- ARMS ---
  for (const [side, swing] of [[-1, armSw], [1, -armSw]] as [number, number][]) {
    ctx.save();
    ctx.translate(side * 15, -70 + bob);
    ctx.rotate((side * 12 + swing) * Math.PI / 180);
    ctx.fillStyle = "#1a1a30";
    ctx.fillRect(-3.5, 0, 8, 26);
    ctx.fillStyle = "#c4ac88";
    ctx.fillRect(-2.5, 24, 6, 7);
    ctx.restore();
  }

  // --- NECK ---
  ctx.fillStyle = "#c4ac88";
  ctx.fillRect(-3.5, -82 + bob, 8, 7);

  // --- HEAD ---
  ctx.fillStyle = "#c4ac88";
  ctx.beginPath();
  ctx.ellipse(0, -92 + bob, 12, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  // Ear
  ctx.beginPath();
  ctx.ellipse(facing > 0 ? 11 : -11, -91 + bob, 3.5, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // --- HAIR ---
  ctx.fillStyle = "#080408";
  ctx.beginPath();
  ctx.ellipse(0, -96 + bob, 14, 12, 0, Math.PI * 0.85, Math.PI * 2.15);
  ctx.fill();

  // Side strands
  const hairSide = facing > 0 ? 1 : -1;
  ctx.beginPath();
  ctx.moveTo(hairSide * 9, -106 + bob);
  ctx.quadraticCurveTo(hairSide * 16, -88 + bob, hairSide * 13, -52 + bob);
  ctx.lineTo(hairSide * 9, -52 + bob);
  ctx.quadraticCurveTo(hairSide * 12, -82 + bob, hairSide * 9, -106 + bob);
  ctx.fill();

  // Back hair
  ctx.fillRect(-14, -100 + bob, 28, 9);
  for (const sx2 of [-13, 9]) {
    ctx.beginPath();
    ctx.moveTo(sx2, -91 + bob);
    ctx.quadraticCurveTo(sx2 + (sx2 < 0 ? -3 : 3), -65 + bob, sx2 + (sx2 < 0 ? -1 : 1), -46 + bob);
    ctx.lineTo(sx2 + (sx2 < 0 ? 4 : -4), -46 + bob);
    ctx.quadraticCurveTo(sx2 + (sx2 < 0 ? 1 : -1), -65 + bob, sx2, -91 + bob);
    ctx.fill();
  }

  // Bangs
  for (const [bx, bend] of [[-11, -4], [-4, -1], [2, 1], [7, 4]] as [number, number][]) {
    ctx.beginPath();
    ctx.moveTo(bx, -104 + bob);
    ctx.quadraticCurveTo(bx + bend, -85 + bob, bx + bend * 1.5, -83 + bob);
    ctx.lineTo(bx + 4, -104 + bob);
    ctx.fill();
  }

  // Eye
  const ex = facing > 0 ? 4 : -7;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.ellipse(ex, -93 + bob, 3.5, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2a1a10";
  ctx.beginPath();
  ctx.arc(ex + (facing > 0 ? 0.5 : -0.5), -93 + bob, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.arc(ex + (facing > 0 ? 0.5 : -0.5), -93 + bob, 0.9, 0, Math.PI * 2);
  ctx.fill();
  // Highlight
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(ex + (facing > 0 ? 1.5 : -1.5), -94 + bob, 0.6, 0, Math.PI * 2);
  ctx.fill();

  // Eyelash
  ctx.strokeStyle = "#080408";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(ex - 3.5, -94.5 + bob);
  ctx.lineTo(ex + 3.5, -94.5 + bob);
  ctx.stroke();

  // Mouth
  ctx.strokeStyle = "#a08070";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(facing > 0 ? 3 : -6, -87 + bob);
  ctx.lineTo(facing > 0 ? 6 : -3, -87 + bob);
  ctx.stroke();

  // School bag
  ctx.fillStyle = "#181420";
  ctx.fillRect(facing > 0 ? -18 : 10, -72 + bob, 10, 24);
  ctx.fillStyle = "#1a1622";
  ctx.fillRect(facing > 0 ? -19 : 9, -70 + bob, 12, 2);

  ctx.restore();
}

// ======================== ANOMALIES ========================
function drawAnomaliesBehind(dc: DrawContext) {
  const { ctx, width, height, state, time } = dc;
  const gy = height * GROUND_Y_RATIO - 28;

  state.anomalies.forEach((a) => {
    if (!a.triggered) return;
    const sx = a.triggerX - state.cameraX;
    switch (a.type) {
      case "shadow_figure": {
        const fx = sx + (a.data.offsetX as number || 200);
        const fallY = (a.data.fallY as number) || 0;
        const fallen = fallY > 200; // completely off screen

        if (!fallen) {
          ctx.save();
          ctx.globalAlpha = 0.55 + Math.sin(time * 0.0015) * 0.15;
          ctx.fillStyle = "#040008";

          if (fallY > 0) {
            // Falling — translate down and rotate slightly for collapse effect
            ctx.translate(fx, gy + fallY);
            ctx.rotate(fallY * 0.005);
            ctx.translate(-fx, -gy);
          }

          // Body
          ctx.beginPath();
          ctx.ellipse(fx, gy - 85, 15, 85, 0, 0, Math.PI * 2);
          ctx.fill();
          // Head
          ctx.beginPath();
          ctx.arc(fx, gy - 178, 17, 0, Math.PI * 2);
          ctx.fill();
          // Hair
          ctx.fillRect(fx - 14, gy - 185, 4, 55);
          ctx.fillRect(fx + 10, gy - 185, 4, 55);
          ctx.restore();
        }
        break;
      }
      case "blood_wall": {
        ctx.save();
        ctx.globalAlpha = 0.35 + Math.sin(time * 0.002) * 0.1;
        drawBloodDrips(ctx, sx + 20, gy - 150, 120, 90, time);
        ctx.restore();
        break;
      }
      case "distortion": {
        ctx.save();
        ctx.globalAlpha = 0.14;
        ctx.fillStyle = "#200020";
        for (let y = 0; y < height; y += 2.5) {
          const off = Math.sin(y * 0.035 + time * 0.004) * (10 + state.loopCount * 5);
          ctx.fillRect(off, y, width, 1.2);
        }
        ctx.restore();
        break;
      }
    }
  });
}

function drawAnomaliesFront(dc: DrawContext) {
  const { ctx, width, height, state, time } = dc;
  const gy = height * GROUND_Y_RATIO - 28;

  state.anomalies.forEach((a) => {
    if (!a.triggered) return;
    const sx = a.triggerX - state.cameraX;
    switch (a.type) {
      case "approaching_figure": {
        const el = (a.data.elapsed as number) || 0;
        const fx = sx - 500 + el * 0.65;
        const sc = 0.4 + el * 0.005;
        ctx.save();
        ctx.globalAlpha = Math.min(0.88, 0.15 + el * 0.004);
        ctx.fillStyle = "#040005";
        const bh = 140 * sc;
        const bw = 20 * sc;
        ctx.beginPath();
        ctx.ellipse(fx, gy - bh / 2, bw / 2, bh / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(fx, gy - bh - 14 * sc, 15 * sc, 0, Math.PI * 2);
        ctx.fill();
        // Hair
        ctx.fillRect(fx - 12 * sc, gy - bh - 22 * sc, 4 * sc, 65 * sc);
        ctx.fillRect(fx + 8 * sc, gy - bh - 22 * sc, 4 * sc, 65 * sc);
        // Arms reaching
        ctx.strokeStyle = "#040005";
        ctx.lineWidth = 3 * sc;
        ctx.beginPath();
        ctx.moveTo(fx - bw, gy - bh * 0.6);
        ctx.quadraticCurveTo(fx - bw * 2.5, gy - bh * 0.2, fx - bw * 3, gy - bh * 0.05);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(fx + bw, gy - bh * 0.6);
        ctx.quadraticCurveTo(fx + bw * 2.5, gy - bh * 0.2, fx + bw * 3, gy - bh * 0.05);
        ctx.stroke();
        ctx.restore();
        break;
      }
      case "following_shadow": {
        const psx = state.playerX - state.cameraX;
        const shx = psx + 100;
        ctx.save();
        ctx.globalAlpha = 0.4 + Math.sin(time * 0.002) * 0.12;

        // Use Yukari image (horror version in later loops)
        const fYukariH = dc.yukariHorrorImage;
        const fYukariN = dc.yukariImage;
        const useHorrorF = state.loopCount >= 5 && fYukariH && fYukariH.complete && fYukariH.naturalWidth > 0;
        const useNormalF = fYukariN && fYukariN.complete && fYukariN.naturalWidth > 0;
        const fImg = useHorrorF ? fYukariH! : (useNormalF ? fYukariN! : null);

        if (fImg) {
          const targetH = 350;
          const scale = targetH / fImg.naturalHeight;
          const imgW = fImg.naturalWidth * scale;
          const imgH = targetH;
          const drawX = shx - imgW / 2;
          const drawY = gy - imgH * 0.42;

          // No flip — she faces same direction as player (looking left)

          ctx.drawImage(fImg, drawX, drawY, imgW, imgH);

          // Dark ghostly overlay
          if (!useHorrorF) {
            ctx.globalCompositeOperation = "source-atop";
            ctx.fillStyle = "rgba(5,0,15,0.45)";
            ctx.fillRect(drawX, drawY, imgW, imgH);
            ctx.globalCompositeOperation = "source-over";
          }
        } else {
          // Fallback shadow
          ctx.fillStyle = "#030005";
          ctx.beginPath();
          ctx.ellipse(shx, gy - 70, 14, 70, 0.04, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(shx, gy - 148, 16, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillRect(shx - 12, gy - 155, 4, 50);
          ctx.fillRect(shx + 8, gy - 155, 4, 50);
        }
        ctx.restore();
        break;
      }
      case "glitch": {
        ctx.save();
        const n = 5 + state.loopCount * 3;
        for (let s = 0; s < n; s++) {
          const sy = Math.random() * height;
          const sh = 1 + Math.random() * 7;
          const sxo = (Math.random() - 0.5) * 18;
          ctx.drawImage(ctx.canvas, 0, sy, width, sh, sxo, sy, width, sh);
        }
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = 0.06;
        ctx.fillStyle = "#ff0000";
        ctx.fillRect(2, 0, width, height);
        ctx.fillStyle = "#0000ff";
        ctx.fillRect(-2, 0, width, height);
        ctx.restore();
        break;
      }
      case "jumpscare": {
        const el = (a.data.elapsed as number) || 0;
        if (el > 40) break;

        ctx.save();
        // Quick pop in then fade out
        let jsAlpha = 0;
        if (el < 4) jsAlpha = el / 4;
        else if (el < 12) jsAlpha = 1;
        else jsAlpha = Math.max(0, 1 - (el - 12) / 28);
        ctx.globalAlpha = jsAlpha;

        // Horror Yukari fills the screen
        const jsImg = dc.yukariHorrorImage;
        if (jsImg && jsImg.complete && jsImg.naturalWidth > 0) {
          const scale = height * 0.95 / jsImg.naturalHeight;
          const imgW = jsImg.naturalWidth * scale;
          const imgH = jsImg.naturalHeight * scale;
          const jx = (width - imgW) / 2 + (Math.random() - 0.5) * 10;
          const jy = (height - imgH) / 2 + (Math.random() - 0.5) * 10;
          ctx.drawImage(jsImg, jx, jy, imgW, imgH);
        } else {
          ctx.fillStyle = "#200000";
          ctx.fillRect(0, 0, width, height);
          ctx.fillStyle = "#080010";
          ctx.beginPath();
          ctx.arc(width / 2, height / 2, height * 0.25, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#cc0000";
          ctx.beginPath();
          ctx.arc(width / 2 - 30, height / 2 - 20, 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(width / 2 + 30, height / 2 - 20, 10, 0, Math.PI * 2);
          ctx.fill();
        }

        // Red flash
        if (el < 6) {
          ctx.globalAlpha = (1 - el / 6) * 0.5;
          ctx.fillStyle = "#ff0000";
          ctx.fillRect(0, 0, width, height);
        }
        ctx.restore();
        break;
      }
    }
  });
}

function drawGhostEvents(dc: DrawContext) {
  const { ctx, height, state, time, yukariImage, yukariHorrorImage } = dc;
  const gy = height * GROUND_Y_RATIO - 28;

  state.ghostEvents.forEach((g) => {
    if (!g.active) return;
    const sx = g.x - state.cameraX;
    ctx.save();
    ctx.globalAlpha = g.opacity;

    switch (g.type) {
      case "standing": {
        // Pick normal or horror Yukari based on loop
        const horrorReady = yukariHorrorImage && yukariHorrorImage.complete && yukariHorrorImage.naturalWidth > 0;
        const normalReady = yukariImage && yukariImage.complete && yukariImage.naturalWidth > 0;
        const useHorror = state.loopCount >= 5 && horrorReady;
        const img = useHorror ? yukariHorrorImage! : (normalReady ? yukariImage! : null);

        if (img) {
          const targetH = 350;
          const scale = targetH / img.naturalHeight;
          const imgW = img.naturalWidth * scale;
          const imgH = targetH;
          const drawX = sx - imgW / 2;
          const drawY = gy - imgH * 0.42;

          ctx.drawImage(img, drawX, drawY, imgW, imgH);

          // Ghostly dark overlay (lighter for horror version since it's already creepy)
          if (!useHorror) {
            ctx.globalCompositeOperation = "source-atop";
            ctx.fillStyle = `rgba(5,0,15,${0.4 + (1 - g.opacity) * 0.3})`;
            ctx.fillRect(drawX, drawY, imgW, imgH);
            ctx.globalCompositeOperation = "source-over";
          }
        } else {
          // Fallback shadow figure
          ctx.fillStyle = "#040008";
          ctx.beginPath();
          ctx.ellipse(sx, gy - g.height / 2, g.width / 2 + 3, g.height / 2, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(sx, gy - g.height - 14, 17, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillRect(sx - 14, gy - g.height - 20, 4, 50);
          ctx.fillRect(sx + 10, gy - g.height - 20, 4, 50);
          // Red eyes
          ctx.fillStyle = `rgba(180,30,30,${g.opacity * 0.75})`;
          ctx.beginPath();
          ctx.arc(sx - 5, gy - g.height - 16, 1.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(sx + 5, gy - g.height - 16, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case "crawling": {
        ctx.fillStyle = "#040008";
        ctx.beginPath();
        ctx.ellipse(sx, gy - 14, g.width + 6, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(sx + g.width, gy - 22, 12, 0, Math.PI * 2);
        ctx.fill();
        // Reaching arm
        ctx.strokeStyle = "#040008";
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(sx + g.width + 10, gy - 18);
        ctx.lineTo(sx + g.width + 35, gy - 10);
        ctx.stroke();
        // Fingers
        ctx.lineWidth = 1.5;
        for (let f = 0; f < 4; f++) {
          ctx.beginPath();
          ctx.moveTo(sx + g.width + 35, gy - 10);
          ctx.lineTo(sx + g.width + 40 + f * 2, gy - 12 + f * 1.5);
          ctx.stroke();
        }
        break;
      }
      case "floating": {
        const fy = gy - g.height + Math.sin(time * 0.002) * 28;
        ctx.fillStyle = "#040008";
        ctx.beginPath();
        ctx.ellipse(sx, fy, g.width / 2, g.height / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(4,0,8,${g.opacity * 0.4})`;
        ctx.lineWidth = 2;
        for (let w = 0; w < 6; w++) {
          ctx.beginPath();
          ctx.moveTo(sx + (w - 3) * 4, fy + g.height / 2);
          ctx.quadraticCurveTo(
            sx + Math.sin(time * 0.002 + w) * 22,
            fy + g.height,
            sx + (w - 3) * 7,
            fy + g.height + 35
          );
          ctx.stroke();
        }
        break;
      }
    }
    ctx.restore();
  });
}

// ======================== GROUND DETAILS ========================
function drawGroundDetails(dc: DrawContext) {
  const { ctx, width, height, state } = dc;
  const gy = height * GROUND_Y_RATIO;
  const px = state.cameraX * 0.95;

  // Drains
  for (let i = 0; i < 4; i++) {
    const x = i * 450 + 80 - (px % 450);
    ctx.fillStyle = "#1c1a1a";
    ctx.fillRect(x, gy + 3, 38, 6);
    ctx.strokeStyle = "#242222";
    ctx.lineWidth = 0.6;
    for (let l = 0; l < 8; l++) {
      ctx.beginPath();
      ctx.moveTo(x + 2 + l * 4.5, gy + 3);
      ctx.lineTo(x + 2 + l * 4.5, gy + 9);
      ctx.stroke();
    }
  }

  // Cracks
  ctx.strokeStyle = "#141212";
  ctx.lineWidth = 0.4;
  for (let c = 0; c < 3; c++) {
    const cx = c * 600 + 200 - (px % 600);
    ctx.beginPath();
    ctx.moveTo(cx, gy + 4);
    ctx.lineTo(cx + 12, gy + 18);
    ctx.lineTo(cx + 8, gy + 32);
    ctx.stroke();
  }
}

// ======================== FOG ========================
function drawFog(dc: DrawContext) {
  const { ctx, width, height, state, time } = dc;
  const gy = height * GROUND_Y_RATIO;
  const fogIntensity = 0.04 + state.loopCount * 0.02;

  // Ground-level rolling fog
  ctx.save();
  for (let layer = 0; layer < 3; layer++) {
    ctx.globalAlpha = fogIntensity * (1 - layer * 0.25);
    const yOff = layer * 15;
    const speed = (0.3 + layer * 0.15) * 0.001;
    const fogGrad = ctx.createLinearGradient(0, gy - 30 - yOff, 0, gy + 30);
    // Fog color shifts from cool blue to sickly red in later loops
    const fogR = state.loopCount >= 5 ? 80 + (state.loopCount - 5) * 30 : 180;
    const fogG = state.loopCount >= 5 ? 40 : 190;
    const fogB = state.loopCount >= 5 ? 40 : 210;
    fogGrad.addColorStop(0, "transparent");
    fogGrad.addColorStop(0.3, `rgba(${fogR},${fogG},${fogB},0.3)`);
    fogGrad.addColorStop(0.7, `rgba(${fogR - 30},${fogG - 30},${fogB - 30},0.5)`);
    fogGrad.addColorStop(1, "transparent");
    ctx.fillStyle = fogGrad;

    // Drifting fog patches
    for (let i = -1; i < 8; i++) {
      const fx = i * 120 + Math.sin(time * speed + i * 2 + layer) * 30 - (state.cameraX * 0.3 % 120);
      const fw = 80 + Math.sin(i * 3.7 + time * speed * 0.5) * 30;
      ctx.beginPath();
      ctx.ellipse(fx, gy - 10 - yOff, fw, 12 + layer * 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // Distant haze between buildings
  ctx.save();
  ctx.globalAlpha = 0.03 + state.loopCount * 0.01;
  const hazeGrad = ctx.createLinearGradient(0, height * 0.3, 0, gy);
  hazeGrad.addColorStop(0, "transparent");
  hazeGrad.addColorStop(1, "rgba(100,110,130,0.2)");
  ctx.fillStyle = hazeGrad;
  ctx.fillRect(0, height * 0.3, width, gy - height * 0.3);
  ctx.restore();
}

// ======================== HORROR ATMOSPHERE ========================
function drawHorrorAtmosphere(dc: DrawContext) {
  const { ctx, width, height, state, time,
    bloodFrameImage, bloodTextureImage, bloodSplatImage, bloodHandImage } = dc;
  const loop = state.loopCount;

  // === BLOOD OVERLAY IMAGES ===

  // Blood frame — edges of screen, from 2日目 (loop 1+)
  if (loop >= 1 && bloodFrameImage && bloodFrameImage.complete) {
    ctx.save();
    ctx.globalAlpha = 0.05 + loop * 0.1;
    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(bloodFrameImage, 0, 0, width, height);
    ctx.restore();
  }

  // Blood splat — brief flash on screen shake triggers, from 2日目
  if (loop >= 1 && bloodSplatImage && bloodSplatImage.complete && state.screenShake.duration > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.35, state.screenShake.duration * 0.012);
    const splatX = seededRandom(state.screenShake.duration * 3.7) * width * 0.6;
    const splatY = seededRandom(state.screenShake.duration * 5.1) * height * 0.6;
    const splatSize = 50 + loop * 20;
    ctx.drawImage(bloodSplatImage, splatX, splatY, splatSize, splatSize);
    ctx.restore();
  }

  // Blood handprint — appears on screen from 2日目
  if (loop >= 1 && bloodHandImage && bloodHandImage.complete) {
    const handPhase = Math.sin(time * 0.0004 + loop);
    if (handPhase > 0.7) {
      ctx.save();
      ctx.globalAlpha = (handPhase - 0.7) * 1.5 * 0.25;
      const handSize = 70 + loop * 15;
      ctx.drawImage(bloodHandImage, width * 0.15, height * 0.2, handSize, handSize);
      if (loop >= 3) {
        // Second hand in final loop
        ctx.drawImage(bloodHandImage, width * 0.65, height * 0.4, handSize * 0.8, handSize * 0.8);
      }
      ctx.restore();
    }
  }

  // Blood texture — full screen flash in loop 7, brief
  if (loop >= 7 && bloodTextureImage && bloodTextureImage.complete) {
    const flashPhase = Math.sin(time * 0.002);
    if (flashPhase > 0.95) {
      ctx.save();
      ctx.globalAlpha = (flashPhase - 0.95) * 8;
      ctx.globalCompositeOperation = "multiply";
      ctx.drawImage(bloodTextureImage, 0, 0, width, height);
      ctx.restore();
    }
  }

  // Peripheral shadow figures — brief glimpses at screen edges (only loop 3+)
  if (loop >= 3) {
    const chance = 0.002 * (loop - 1);
    if (seededRandom(Math.floor(time * 0.01) * 0.1) < chance) {
      ctx.save();
      ctx.globalAlpha = 0.08 + loop * 0.02;
      ctx.fillStyle = "#040008";
      // Figure at left or right edge
      const side = seededRandom(Math.floor(time * 0.005)) > 0.5;
      const figX = side ? width - 15 : 5;
      const gy = height * GROUND_Y_RATIO;
      ctx.beginPath();
      ctx.ellipse(figX, gy - 60, 8, 55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(figX, gy - 120, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // Window watchers — faces occasionally appear in lit windows (only loop 4+)
  if (loop >= 4) {
    const px = state.cameraX * 0.95;
    for (let i = 0; i < 3; i++) {
      const ws = i * 37.3 + loop * 5;
      const wx = i * 350 + 150 - (px % 350);
      const wy = height * GROUND_Y_RATIO - 200 + seededRandom(ws) * 80;
      // Only show briefly
      const showPhase = Math.sin(time * 0.0005 + ws);
      if (showPhase > 0.85 && wx > 0 && wx < width) {
        ctx.save();
        ctx.globalAlpha = (showPhase - 0.85) * 3 * (0.15 + loop * 0.05);
        // Dark silhouette behind window
        ctx.fillStyle = "#0a0010";
        ctx.beginPath();
        ctx.ellipse(wx, wy, 6, 15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(wx, wy - 18, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  // Breathing darkness at screen edges — gets worse each loop
  if (loop >= 1) {
    const breathe = Math.sin(time * 0.0015) * 0.5 + 0.5;
    const intensity = (0.05 + loop * 0.04 + breathe * 0.03 * loop) * 0.5;

    // Left edge darkness
    const leftGrad = ctx.createLinearGradient(0, 0, width * 0.25, 0);
    leftGrad.addColorStop(0, `rgba(0,0,0,${intensity})`);
    leftGrad.addColorStop(1, "transparent");
    ctx.fillStyle = leftGrad;
    ctx.fillRect(0, 0, width * 0.25, height);

    // Right edge darkness
    const rightGrad = ctx.createLinearGradient(width, 0, width * 0.75, 0);
    rightGrad.addColorStop(0, `rgba(0,0,0,${intensity * 0.7})`);
    rightGrad.addColorStop(1, "transparent");
    ctx.fillStyle = rightGrad;
    ctx.fillRect(width * 0.75, 0, width * 0.25, height);

    // Top darkness pressing down
    const topGrad = ctx.createLinearGradient(0, 0, 0, height * 0.3);
    topGrad.addColorStop(0, `rgba(0,0,0,${intensity * 1.2})`);
    topGrad.addColorStop(1, "transparent");
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, 0, width, height * 0.3);
  }

  // Subtle color drain — world loses saturation in later loops
  if (loop >= 4) {
    ctx.save();
    ctx.globalCompositeOperation = "saturation";
    ctx.globalAlpha = 0.05 * (loop - 3);
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  // Occasional full-screen pulse of darkness (only loop 3+)
  if (loop >= 3) {
    const pulse = Math.sin(time * 0.001 + loop);
    if (pulse > 0.97) {
      ctx.save();
      ctx.globalAlpha = (pulse - 0.97) * 10;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
  }
}

// ======================== EFFECTS ========================
function drawEffects(dc: DrawContext) {
  const { ctx, width, height, state, time } = dc;

  // Darkness
  if (state.darkness > 0) {
    ctx.fillStyle = `rgba(0,0,0,${state.darkness})`;
    ctx.fillRect(-20, -20, width + 40, height + 40);
  }

  // Vignette - subtle, builds with loops
  const vs = 0.3 + state.loopCount * 0.06;
  const vg = ctx.createRadialGradient(width / 2, height * 0.45, height * 0.25, width / 2, height * 0.45, height * 0.75);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(0.7, `rgba(0,0,0,${vs * 0.2})`);
  vg.addColorStop(1, `rgba(0,0,0,${vs})`);
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, width, height);

  // Film grain (subtle)
  ctx.save();
  ctx.globalAlpha = 0.015 + state.loopCount * 0.002;
  for (let i = 0; i < 150; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)";
    ctx.fillRect(Math.random() * width, Math.random() * height, 1, 1);
  }
  ctx.restore();

  // Flash
  if (state.flashOpacity > 0) {
    ctx.fillStyle = `rgba(255,255,255,${state.flashOpacity})`;
    ctx.fillRect(0, 0, width, height);
  }

  // Flicker
  if (state.ambientFlicker > 0) {
    ctx.fillStyle = `rgba(0,0,0,${state.ambientFlicker})`;
    ctx.fillRect(0, 0, width, height);
  }

  // Scanlines - only visible in later loops
  if (state.loopCount >= 3) {
    ctx.save();
    ctx.globalAlpha = 0.02 + (state.loopCount - 3) * 0.01;
    ctx.fillStyle = "#000";
    for (let y = 0; y < height; y += 2.5) {
      ctx.fillRect(0, y, width, 0.8);
    }
    ctx.restore();
  }

  // Chromatic aberration - only in later loops
  if (state.loopCount >= 4) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.012 * (state.loopCount - 3);
    ctx.fillStyle = "#ff0000";
    ctx.fillRect(1.5, 0, width, height);
    ctx.fillStyle = "#0000ff";
    ctx.fillRect(-1.5, 0, width, height);
    ctx.restore();
  }

  // Red tint
  if (state.loopCount >= 5) {
    ctx.fillStyle = `rgba(25,0,0,${0.04 + (state.loopCount - 5) * 0.035})`;
    ctx.fillRect(0, 0, width, height);
  }

  // Pulsing darkness edges in late loops
  if (state.loopCount >= 6) {
    const pulse = Math.sin(time * 0.002) * 0.5 + 0.5;
    const eg = ctx.createRadialGradient(width / 2, height * 0.45, height * 0.1, width / 2, height * 0.45, height * 0.55);
    eg.addColorStop(0, "rgba(0,0,0,0)");
    eg.addColorStop(1, `rgba(0,0,0,${0.3 + pulse * 0.2})`);
    ctx.fillStyle = eg;
    ctx.fillRect(0, 0, width, height);
  }
}

function drawOverlays(dc: DrawContext) {
  const { ctx, width, height, state } = dc;

  // Story dialogue — floating text, no box
  if (state.dialogue && state.dialogue.opacity > 0) {
    const d = state.dialogue;
    ctx.save();
    ctx.globalAlpha = d.opacity;

    const font = "'Yu Gothic','Hiragino Kaku Gothic Pro',serif";
    const lines = d.text.split("\n");
    const lineHeight = 24;
    const textY = height - lines.length * lineHeight - 40;

    // Text color based on speaker
    if (d.speaker === "voice") {
      ctx.fillStyle = "#c06060";
      ctx.font = `18px ${font}`;
    } else if (d.speaker === "memory") {
      ctx.fillStyle = "#8090b0";
      ctx.font = `italic 16px ${font}`;
    } else {
      ctx.fillStyle = "#c0bab0";
      ctx.font = `16px ${font}`;
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;

    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], width / 2, textY + i * lineHeight);
    }

    ctx.restore();
  }
}

// ======================== TITLE / ENDING ========================
export function drawTitle(ctx: CanvasRenderingContext2D, width: number, height: number, time: number) {
  const f = "'Noto Serif JP','Yu Mincho','Hiragino Mincho Pro',serif";

  // Black background
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);

  // Subtle red mist at bottom
  ctx.save();
  ctx.globalAlpha = 0.04 + Math.sin(time * 0.001) * 0.02;
  const mistGrad = ctx.createLinearGradient(0, height * 0.6, 0, height);
  mistGrad.addColorStop(0, "transparent");
  mistGrad.addColorStop(1, "#200000");
  ctx.fillStyle = mistGrad;
  ctx.fillRect(0, height * 0.6, width, height * 0.4);
  ctx.restore();

  // Blood drip lines falling slowly
  ctx.save();
  ctx.globalAlpha = 0.04;
  ctx.fillStyle = "#4a0000";
  for (let d = 0; d < 6; d++) {
    const dx = seededRandom(d * 7.3) * width;
    const dy = ((time * 0.02 + seededRandom(d * 11) * height) % (height + 100)) - 50;
    ctx.fillRect(dx, dy, 1.5, 40 + seededRandom(d * 5) * 60);
  }
  ctx.restore();

  // Ghost echoes behind title
  ctx.save();
  ctx.globalAlpha = 0.04 + Math.sin(time * 0.0008) * 0.02;
  ctx.fillStyle = "#500000";
  ctx.font = `bold 80px ${f}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let e = 0; e < 3; e++) {
    const ex = (Math.random() - 0.5) * 4;
    const ey = (Math.random() - 0.5) * 4;
    ctx.fillText("つぐのひ", width / 2 + ex, height / 2 - 50 + ey);
  }
  ctx.restore();

  // Main title — with subtle shake
  ctx.save();
  const titleAlpha = 0.6 + Math.sin(time * 0.001) * 0.15;
  ctx.globalAlpha = titleAlpha;
  ctx.fillStyle = "#8a1818";
  ctx.font = `bold 76px ${f}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const shakeX = (Math.random() - 0.5) * 0.8;
  const shakeY = (Math.random() - 0.5) * 0.8;
  ctx.fillText("つぐのひ", width / 2 + shakeX, height / 2 - 50 + shakeY);

  // Subtitle
  ctx.fillStyle = "#403535";
  ctx.font = `18px ${f}`;
  ctx.globalAlpha = 0.3 + Math.sin(time * 0.0015) * 0.1;
  ctx.fillText("― 次ぐ日 ―", width / 2, height / 2 + 10);
  ctx.restore();

  // "はじめる" button
  ctx.save();
  const btnW = 180;
  const btnH = 48;
  const btnX = width / 2 - btnW / 2;
  const btnY = height / 2 + 55;
  const btnPulse = 0.4 + Math.sin(time * 0.003) * 0.15;

  // Button border
  ctx.globalAlpha = btnPulse;
  ctx.strokeStyle = "#6a2020";
  ctx.lineWidth = 1;
  ctx.strokeRect(btnX, btnY, btnW, btnH);

  // Button fill
  ctx.globalAlpha = btnPulse * 0.15;
  ctx.fillStyle = "#300000";
  ctx.fillRect(btnX, btnY, btnW, btnH);

  // Button text
  ctx.globalAlpha = btnPulse + 0.1;
  ctx.fillStyle = "#a03030";
  ctx.font = `20px ${f}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("はじめる", width / 2, btnY + btnH / 2);
  ctx.restore();

  // Noise dots (very subtle)
  ctx.save();
  ctx.globalAlpha = 0.01;
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = Math.random() > 0.7 ? "#300" : "#fff";
    ctx.fillRect(Math.random() * width, Math.random() * height, 1, 1);
  }
  ctx.restore();

  // Heavy vignette
  const vg = ctx.createRadialGradient(width / 2, height / 2, height * 0.08, width / 2, height / 2, height * 0.55);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(0.6, "rgba(0,0,0,0.5)");
  vg.addColorStop(1, "rgba(0,0,0,0.95)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, width, height);

  // Scanlines
  ctx.save();
  ctx.globalAlpha = 0.04;
  ctx.fillStyle = "#000";
  for (let y = 0; y < height; y += 3) ctx.fillRect(0, y, width, 1);
  ctx.restore();
}

export function drawTransition(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, timer: number, loop: number) {
  const duration = 360;
  const f = "'Noto Serif JP','Yu Mincho','Hiragino Mincho Pro',serif";
  const isFinal = loop >= 7;
  const title = isFinal ? "つぐのひ" : "つぎのひ";

  // Background — pure black with subtle red pulse in later loops
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);

  // Eerie red pulse in background
  if (loop >= 3) {
    const pulse = Math.sin(timer * 0.02) * 0.5 + 0.5;
    ctx.save();
    ctx.globalAlpha = 0.02 + loop * 0.008 + pulse * 0.015;
    ctx.fillStyle = "#200000";
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  // Blood-like drip lines falling slowly
  if (loop >= 4) {
    ctx.save();
    ctx.globalAlpha = 0.06 + (loop - 4) * 0.02;
    ctx.fillStyle = "#4a0000";
    for (let d = 0; d < 5 + loop; d++) {
      const dx = seededRandom(d * 7.3 + loop) * width;
      const dy = (timer * (0.5 + seededRandom(d * 3.1) * 0.8) + seededRandom(d * 11) * height) % (height + 100) - 50;
      const dw = 1 + seededRandom(d * 2.3) * 2;
      const dh = 30 + seededRandom(d * 5.1) * 80;
      ctx.fillRect(dx, dy, dw, dh);
    }
    ctx.restore();
  }

  // Main text — slow fade in
  const fadeInEnd = 80;
  const holdEnd = duration - 80;
  let alpha = 0;
  if (timer < fadeInEnd) {
    alpha = timer / fadeInEnd;
  } else if (timer > holdEnd) {
    alpha = (duration - timer) / 80;
  } else {
    alpha = 1;
  }
  alpha = Math.max(0, alpha);

  // Text shake — gets worse each loop
  const shakeIntensity = loop >= 3 ? (loop - 2) * 0.8 : 0;
  const shakeX = shakeIntensity > 0 ? (Math.random() - 0.5) * shakeIntensity : 0;
  const shakeY = shakeIntensity > 0 ? (Math.random() - 0.5) * shakeIntensity : 0;

  // Ghost echoes of text (layered behind, offset)
  if (loop >= 2) {
    ctx.save();
    ctx.globalAlpha = alpha * 0.08 * (loop - 1);
    ctx.fillStyle = "#600000";
    ctx.font = `bold 56px ${f}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let e = 0; e < Math.min(loop - 1, 4); e++) {
      const ex = (Math.random() - 0.5) * (3 + e * 2);
      const ey = (Math.random() - 0.5) * (3 + e * 2);
      ctx.fillText(title, width / 2 + ex, height / 2 - 15 + ey);
    }
    ctx.restore();
  }

  // Main title
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Text glow
  ctx.save();
  ctx.globalAlpha = alpha * 0.15;
  ctx.fillStyle = "#aa2020";
  ctx.font = `bold 60px ${f}`;
  ctx.fillText(title, width / 2, height / 2 - 15);
  ctx.restore();

  ctx.fillStyle = isFinal ? "#aa1515" : "#8a2222";
  ctx.font = `bold 54px ${f}`;
  ctx.fillText(title, width / 2 + shakeX, height / 2 - 15 + shakeY);

  // Day number — delayed appearance
  if (timer > 60) {
    const dayAlpha = Math.min(1, (timer - 60) / 50) * alpha;
    ctx.globalAlpha = dayAlpha * 0.5;
    ctx.fillStyle = "#484040";
    ctx.font = `18px ${f}`;
    const dayText = `― ${loop + 1}日目 ―`;
    ctx.fillText(dayText, width / 2, height / 2 + 35);
  }

  ctx.restore();

  // Noise/static in later loops (subtle)
  if (loop >= 5) {
    ctx.save();
    ctx.globalAlpha = 0.008 * (loop - 4);
    for (let i = 0; i < 20; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? "#fff" : "#300";
      ctx.fillRect(Math.random() * width, Math.random() * height, Math.random() * 3, 1);
    }
    ctx.restore();
  }

  // Horizontal glitch lines in final
  if (isFinal && timer > 100) {
    ctx.save();
    for (let g = 0; g < 4; g++) {
      const gy = Math.random() * height;
      const gh = 1 + Math.random() * 4;
      const gx = (Math.random() - 0.5) * 12;
      ctx.drawImage(ctx.canvas, 0, gy, width, gh, gx, gy, width, gh);
    }
    ctx.restore();
  }

  // Scanlines
  ctx.save();
  ctx.globalAlpha = 0.04;
  ctx.fillStyle = "#000";
  for (let y = 0; y < height; y += 3) ctx.fillRect(0, y, width, 1);
  ctx.restore();

  // Vignette
  const vg = ctx.createRadialGradient(width / 2, height / 2, height * 0.12, width / 2, height / 2, height * 0.6);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.9)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, width, height);
}

export function drawEnding(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, timer: number, yukariHorrorImage?: HTMLImageElement) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);

  const f = "'Yu Gothic','Hiragino Kaku Gothic Pro',serif";
  const texts = getEndingTexts();

  for (const t of texts) {
    if (timer < t.start || timer > t.end) continue;

    const fadeIn = Math.min(1, (timer - t.start) / 60);
    const fadeOut = Math.max(0, 1 - (timer - (t.end - 40)) / 40);
    const alpha = Math.min(fadeIn, timer > t.end - 40 ? fadeOut : 1);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (t.style === "red") {
      ctx.fillStyle = "#8a2222";
      ctx.font = t.text === "つ ぐ の ひ" ? `bold 48px ${f}` : `bold 28px ${f}`;
    } else if (t.style === "white") {
      ctx.fillStyle = "#c0bab0";
      ctx.font = `17px ${f}`;
    } else {
      ctx.fillStyle = "#706868";
      ctx.font = `16px ${f}`;
    }

    const lines = t.text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], width / 2, height / 2 - (lines.length - 1) * 14 + i * 28);
    }

    ctx.restore();
  }

  // Horror Yukari appears after "一人で。永遠に。"
  const yukariStart = 1750;
  const yukariEnd = 1830;
  if (timer > yukariStart && timer < yukariEnd && yukariHorrorImage && yukariHorrorImage.complete && yukariHorrorImage.naturalWidth > 0) {
    ctx.save();
    const elapsed = timer - yukariStart;

    // Instant pop, then hold, then quick fade
    let alpha = 0;
    if (elapsed < 3) alpha = elapsed / 3;
    else if (elapsed < yukariEnd - yukariStart - 15) alpha = 1;
    else alpha = Math.max(0, (yukariEnd - timer) / 15);

    ctx.globalAlpha = alpha;

    // EXTREME CLOSE-UP on Yukari's face — crop to upper 30% of image, scale to fill screen
    const cropTop = 0;
    const cropH = yukariHorrorImage.naturalHeight * 0.3; // face area only
    const cropW = yukariHorrorImage.naturalWidth;

    const shakeX = (Math.random() - 0.5) * 10;
    const shakeY = (Math.random() - 0.5) * 10;

    ctx.drawImage(
      yukariHorrorImage,
      0, cropTop, cropW, cropH,  // source: top 30% of image
      shakeX - width * 0.1, shakeY - height * 0.1, width * 1.2, height * 1.2  // dest: fill entire screen + overflow
    );

    // Red flash at the start
    if (elapsed < 5) {
      ctx.globalAlpha = (1 - elapsed / 5) * 0.4;
      ctx.fillStyle = "#ff0000";
      ctx.fillRect(0, 0, width, height);
    }

    ctx.restore();
  }

  // Restart prompt — after Yukari disappears
  if (timer > 2100) {
    ctx.save();
    ctx.globalAlpha = 0.2 + Math.sin(time * 0.003) * 0.15;
    ctx.fillStyle = "#353030";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("スペースキーでもう一度", width / 2, height / 2 + 80);
    ctx.restore();
  }
}
