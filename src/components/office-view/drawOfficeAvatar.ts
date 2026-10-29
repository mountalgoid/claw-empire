import { Container, Graphics } from "pixi.js";

// Stable per-agent palette: office themes may change, but a person's look does not.
const SHIRTS = [0x3c82f6, 0x12a594, 0x8b6cf6, 0xe87952, 0xd64d77, 0x4b9b74, 0x6874c8, 0xc28b38, 0x397b9c, 0x7951a8, 0x537a56, 0xbf5b46, 0x3864a3];
const HAIR = [0x523d32, 0x24344a, 0x6a4937, 0x3d2c42, 0x8b5b33, 0x293b36, 0x6a3842, 0x33343e, 0x74543f, 0x392d56, 0x5c4434, 0x41343d, 0x765238];

/** Small, antialiased vector portrait used throughout the office scene. */
export function drawOfficeAvatar(identity: number, height = 52): Container {
  const avatar = new Container();
  const g = new Graphics();
  const scale = height / 52;
  const shirt = SHIRTS[(Math.abs(identity) - 1) % SHIRTS.length] ?? SHIRTS[0];
  const hair = HAIR[(Math.abs(identity) - 1) % HAIR.length] ?? HAIR[0];

  g.ellipse(0, -1.5, 14, 3.2).fill({ color: 0x13202f, alpha: 0.16 });
  // Neck and shoulders
  g.roundRect(-4.2, -21, 8.4, 9).fill(0xe6ae88);
  g.roundRect(-11, -16, 22, 15, 7).fill(shirt);
  g.moveTo(-3.8, -14).lineTo(0, -9).lineTo(3.8, -14).stroke({ width: 1.2, color: 0xffffff, alpha: 0.82 });
  // Face
  g.roundRect(-8.2, -39, 16.4, 19, 7).fill(0xf0bd98);
  g.ellipse(-8, -30, 1.8, 3).fill(0xe6ae88);
  g.ellipse(8, -30, 1.8, 3).fill(0xe6ae88);
  // Hair silhouette and fringe
  g.roundRect(-9, -42, 18, 9, 5).fill(hair);
  g.moveTo(-8, -36).quadraticCurveTo(-4, -42, 0, -37).quadraticCurveTo(4, -43, 8, -36).fill(hair);
  // Eyes and a subtle smile
  g.circle(-3, -30, 0.9).fill(0x263342);
  g.circle(3, -30, 0.9).fill(0x263342);
  g.moveTo(-2, -25).quadraticCurveTo(0, -23.7, 2, -25).stroke({ width: 0.8, color: 0x9c594f, alpha: 0.8 });

  avatar.addChild(g);
  avatar.scale.set(scale);
  return avatar;
}

export function drawOfficeMascot(size = 44): Container {
  const mascot = new Container();
  const g = new Graphics();
  const s = size / 44;
  // Smooth, compact lobster mascot, replacing the raster pixel sprite.
  g.ellipse(0, 1, 16, 16).fill(0xe34b42);
  g.ellipse(-14, 10, 6, 3.5).fill(0xd33e38);
  g.ellipse(14, 10, 6, 3.5).fill(0xd33e38);
  g.roundRect(-12, -16, 24, 9, 4).fill(0xe34b42);
  g.circle(-5, -3, 2).fill(0x16212e);
  g.circle(5, -3, 2).fill(0x16212e);
  g.moveTo(-2, 5).quadraticCurveTo(0, 7, 2, 5).stroke({ width: 1.2, color: 0x8c2927 });
  mascot.addChild(g);
  mascot.scale.set(s);
  return mascot;
}
