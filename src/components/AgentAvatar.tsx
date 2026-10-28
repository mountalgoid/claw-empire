import { memo, useMemo } from "react";
import type { CSSProperties } from "react";
import type { Agent } from "../types";

/** Map agent IDs to sprite numbers (stable order, same as OfficeView) */
export type SpriteMap = Map<string, number>;

export function buildSpriteMap(agents: Agent[]): Map<string, number> {
  const map = new Map<string, number>();
  // 1) sprite_number가 DB에 지정된 에이전트 우선
  for (const a of agents) {
    if (a.sprite_number != null && a.sprite_number > 0) map.set(a.id, a.sprite_number);
  }
  // 2) DORO fallback (sprite_number 미지정시)
  const doro = agents.find((a) => a.name === "DORO");
  if (doro && !map.has(doro.id)) map.set(doro.id, 13);
  // 3) 나머지: 자동 할당 (1-12 순환)
  const rest = [...agents].filter((a) => !map.has(a.id)).sort((a, b) => a.id.localeCompare(b.id));
  rest.forEach((a, i) => map.set(a.id, (i % 12) + 1));
  return map;
}

/** Hook: memoized sprite map from agents array */
export function useSpriteMap(agents: Agent[]): Map<string, number> {
  return useMemo(() => buildSpriteMap(agents), [agents]);
}

/** Get the sprite number for an agent by ID */
export function getSpriteNum(agents: Agent[], agentId: string): number | undefined {
  return buildSpriteMap(agents).get(agentId);
}

function hashIdToSprite(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return (hash % 12) + 1;
}

function resolveSpriteNum(agent: Agent | undefined, spriteMap: Map<string, number>): number | undefined {
  if (!agent) return undefined;
  if (agent.sprite_number != null && agent.sprite_number > 0) return agent.sprite_number;
  const mapped = spriteMap.get(agent.id);
  if (mapped != null && mapped > 0) return mapped;
  if (agent.name === "DORO") return 13;
  return hashIdToSprite(agent.id);
}

interface AgentAvatarProps {
  agent: Agent | undefined;
  agents?: Agent[];
  spriteMap?: Map<string, number>;
  size?: number;
  className?: string;
  rounded?: "full" | "xl" | "2xl";
  imageFit?: "cover" | "contain";
  imagePosition?: CSSProperties["objectPosition"];
  notificationCount?: number;
}

/** Sprite-based avatar — pass either `agents` or `spriteMap` */
function AgentAvatar({
  agent,
  agents,
  spriteMap,
  size = 28,
  className = "",
  rounded = "full",
  imageFit = "cover",
  imagePosition = "center",
  notificationCount = 0,
}: AgentAvatarProps) {
  const fallbackMap = useMemo(() => (agents ? buildSpriteMap(agents) : new Map<string, number>()), [agents]);
  const map = spriteMap ?? fallbackMap;
  const spriteNum = resolveSpriteNum(agent, map);

  const roundedClass = rounded === "full" ? "rounded-full" : rounded === "xl" ? "rounded-xl" : "rounded-2xl";

  const statusClass =
    agent?.status === "working"
      ? "bg-emerald-400"
      : agent?.status === "break"
        ? "bg-amber-400"
        : agent?.status === "offline"
          ? "bg-slate-500"
          : "bg-sky-400";
  const statusText = agent?.status === "working" ? "working" : agent?.status === "break" ? "break" : agent?.status === "offline" ? "offline" : "idle";

  if (spriteNum) {
    return (
      <div
        className={`relative flex-shrink-0 ${className}`}
        style={{ width: size, height: size }}
        title={agent ? `${agent.name} · ${statusText}` : undefined}
      >
        <div className={`${roundedClass} h-full w-full overflow-hidden bg-gray-700`}>
          <img src={`/sprites/${spriteNum}-D-1.png`} alt={agent?.name ?? ""} className={`h-full w-full ${imageFit === "contain" ? "object-contain" : "object-cover"}`} style={{ imageRendering: "pixelated", objectPosition: imagePosition }} />
        </div>
        {agent && <span aria-label={statusText} className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 ${statusClass}`} style={{ borderColor: "var(--th-card-bg, #0f172a)" }} />}
        {notificationCount > 0 && <span aria-label={`${notificationCount} notifications`} className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-white/70 bg-rose-500 px-1 text-[9px] font-black leading-none text-white shadow-sm">{notificationCount > 9 ? "9+" : notificationCount}</span>}
      </div>
    );
  }
  return (
    <div
      className={`relative flex-shrink-0 ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.6 }}
      title={agent ? `${agent.name} · ${statusText}` : undefined}
    >
      <div className={`${roundedClass} flex h-full w-full items-center justify-center bg-gray-700`}>{agent?.avatar_emoji ?? "🤖"}</div>
      {agent && <span aria-label={statusText} className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 ${statusClass}`} style={{ borderColor: "var(--th-card-bg, #0f172a)" }} />}
      {notificationCount > 0 && <span aria-label={`${notificationCount} notifications`} className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-white/70 bg-rose-500 px-1 text-[9px] font-black leading-none text-white shadow-sm">{notificationCount > 9 ? "9+" : notificationCount}</span>}
    </div>
  );
}

export default memo(AgentAvatar);
