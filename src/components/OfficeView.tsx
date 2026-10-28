import { useEffect, useRef, useCallback, useState, useMemo, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent, type WheelEvent as ReactWheelEvent } from "react";
import {
  type Application,
  type Container,
  type Graphics,
  type Text,
  type Sprite,
  type Texture,
  type AnimatedSprite,
} from "pixi.js";
import { useI18n } from "../i18n";
import { useTheme, type ThemeMode } from "../ThemeContext";
import CliUsagePanel from "./office-view/CliUsagePanel";
import VirtualPadOverlay from "./office-view/VirtualPadOverlay";
import {
  type OfficeViewProps,
  type Delivery,
  type RoomRect,
  type WallClockVisual,
  type OfficeMapMode,
  MIN_OFFICE_W,
  MOBILE_MOVE_CODES,
  type MobileMoveDirection,
  type SubCloneBurstParticle,
} from "./office-view/model";
import { type SupportedLocale } from "./office-view/themes-locale";
import { useCliUsage } from "./office-view/useCliUsage";
import {
  useMeetingPresenceSync,
  useCrossDeptDeliveryAnimations,
  useCeoOfficeCallAnimations,
} from "./office-view/useOfficeDeliveryEffects";
import { useOfficePixiRuntime } from "./office-view/useOfficePixiRuntime";
import { buildOfficeScene } from "./office-view/buildScene";

export default function OfficeView({
  departments,
  agents,
  tasks,
  subAgents,
  meetingPresence,
  activeMeetingTaskId,
  unreadAgentIds,
  crossDeptDeliveries,
  onCrossDeptDeliveryProcessed,
  ceoOfficeCalls,
  onCeoOfficeCallProcessed,
  onOpenActiveMeetingMinutes,
  customDeptThemes,
  themeHighlightTargetId,
  onSelectAgent,
  onSelectDepartment,
}: OfficeViewProps) {
  const { language, t } = useI18n();
  const { theme: currentTheme } = useTheme();
  const themeRef = useRef<ThemeMode>(currentTheme);
  themeRef.current = currentTheme;
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const texturesRef = useRef<Record<string, Texture>>({});
  const destroyedRef = useRef(false);
  const initIdRef = useRef(0);
  const initDoneRef = useRef(false);
  const [sceneRevision, setSceneRevision] = useState(0);
  const [officeMapMode, setOfficeMapMode] = useState<OfficeMapMode>(() => {
    if (typeof window === "undefined") return "balanced";
    const stored = window.localStorage.getItem("climpire.office.map_mode");
    return stored === "wide" || stored === "focused" ? stored : "balanced";
  });

  // Animation state refs
  const tickRef = useRef(0);
  const keysRef = useRef<Record<string, boolean>>({});
  const ceoPosRef = useRef({ x: 180, y: 60 });
  const ceoSpriteRef = useRef<Container | null>(null);
  const crownRef = useRef<Text | null>(null);
  const highlightRef = useRef<Graphics | null>(null);
  const animItemsRef = useRef<
    Array<{
      sprite: Container;
      status: string;
      baseX: number;
      baseY: number;
      particles: Container;
      agentId?: string;
      cliProvider?: string;
      deskG?: Graphics;
      bedG?: Graphics;
      blanketG?: Graphics;
    }>
  >([]);
  const roomRectsRef = useRef<RoomRect[]>([]);
  const deliveriesRef = useRef<Delivery[]>([]);
  const deliveryLayerRef = useRef<Container | null>(null);
  const prevAssignRef = useRef<Set<string>>(new Set());
  const agentPosRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const processedCrossDeptRef = useRef<Set<string>>(new Set());
  const processedCeoOfficeRef = useRef<Set<string>>(new Set());
  const spriteMapRef = useRef<Map<string, number>>(new Map());
  const ceoMeetingSeatsRef = useRef<Array<{ x: number; y: number }>>([]);
  const totalHRef = useRef(600);
  const officeWRef = useRef(MIN_OFFICE_W);
  const ceoOfficeRectRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const breakRoomRectRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const breakAnimItemsRef = useRef<
    Array<{
      sprite: Container;
      baseX: number;
      baseY: number;
    }>
  >([]);
  const subCloneAnimItemsRef = useRef<
    Array<{
      container: Container;
      aura: Graphics;
      cloneVisual: Sprite;
      animated?: AnimatedSprite;
      frameCount: number;
      baseScale: number;
      baseX: number;
      baseY: number;
      phase: number;
      fireworkOffset: number;
    }>
  >([]);
  const subCloneBurstParticlesRef = useRef<SubCloneBurstParticle[]>([]);
  const subCloneSnapshotRef = useRef<Map<string, { parentAgentId: string; x: number; y: number }>>(new Map());
  const breakSteamParticlesRef = useRef<Container | null>(null);
  const breakBubblesRef = useRef<Container[]>([]);
  const wallClocksRef = useRef<WallClockVisual[]>([]);
  const wallClockSecondRef = useRef(-1);
  const localeRef = useRef<SupportedLocale>(language);
  localeRef.current = language;
  const themeHighlightTargetIdRef = useRef<string | null>(themeHighlightTargetId ?? null);
  themeHighlightTargetIdRef.current = themeHighlightTargetId ?? null;

  // Latest data via refs (avoids stale closures)
  const dataRef = useRef({ departments, agents, tasks, subAgents, unreadAgentIds, meetingPresence, customDeptThemes });
  dataRef.current = { departments, agents, tasks, subAgents, unreadAgentIds, meetingPresence, customDeptThemes };
  const cbRef = useRef({ onSelectAgent, onSelectDepartment });
  cbRef.current = { onSelectAgent, onSelectDepartment };
  const activeMeetingTaskIdRef = useRef<string | null>(activeMeetingTaskId ?? null);
  activeMeetingTaskIdRef.current = activeMeetingTaskId ?? null;
  const meetingMinutesOpenRef = useRef<typeof onOpenActiveMeetingMinutes>(onOpenActiveMeetingMinutes);
  meetingMinutesOpenRef.current = onOpenActiveMeetingMinutes;
  const [showVirtualPad, setShowVirtualPad] = useState(false);
  const [officeZoomPercent, setOfficeZoomPercent] = useState(100);
  const officePanViewportRef = useRef<HTMLDivElement | null>(null);
  const officePanLayerRef = useRef<HTMLDivElement | null>(null);
  const officeZoomRef = useRef(1);
  const officePanRef = useRef({ active: false, pointerId: -1, startX: 0, startY: 0, originX: 0, originY: 0 });
  const officePanMovedRef = useRef(false);
  const mapModeRef = useRef<OfficeMapMode>(officeMapMode);
  mapModeRef.current = officeMapMode;

  const applyOfficeTransform = useCallback((x: number, y: number, scale: number) => {
    const layer = officePanLayerRef.current;
    if (layer) layer.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
  }, []);

  const setOfficeZoom = useCallback((nextScale: number, anchorX?: number, anchorY?: number) => {
    const viewport = officePanViewportRef.current;
    const oldScale = officeZoomRef.current;
    const scale = Math.max(0.65, Math.min(1.8, nextScale));
    const rect = viewport?.getBoundingClientRect();
    const x = anchorX ?? (rect ? rect.width / 2 : 0);
    const y = anchorY ?? (rect ? rect.height / 2 : 0);
    const origin = officePanRef.current;
    const nextX = x - (x - origin.originX) * (scale / oldScale);
    const nextY = y - (y - origin.originY) * (scale / oldScale);
    officeZoomRef.current = scale;
    setOfficeZoomPercent(Math.round(scale * 100));
    officePanRef.current = { ...origin, originX: nextX, originY: nextY };
    applyOfficeTransform(nextX, nextY, scale);
  }, [applyOfficeTransform]);

  const triggerDepartmentInteract = useCallback(() => {
    const cx = ceoPosRef.current.x;
    const cy = ceoPosRef.current.y;
    for (const r of roomRectsRef.current) {
      if (cx >= r.x && cx <= r.x + r.w && cy >= r.y - 10 && cy <= r.y + r.h) {
        cbRef.current.onSelectDepartment(r.dept);
        break;
      }
    }
  }, []);

  const setMoveDirectionPressed = useCallback((direction: MobileMoveDirection, pressed: boolean) => {
    for (const code of MOBILE_MOVE_CODES[direction]) {
      keysRef.current[code] = pressed;
    }
  }, []);

  const clearVirtualMovement = useCallback(() => {
    (Object.keys(MOBILE_MOVE_CODES) as MobileMoveDirection[]).forEach((direction) => {
      setMoveDirectionPressed(direction, false);
    });
  }, [setMoveDirectionPressed]);

  const followCeoInView = useCallback(() => {
    // The office is navigated by direct drag now. Do not force the page to
    // scroll whenever the CEO moves; this keeps the view under user control.
  }, []);

  const onOfficePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button, a, input, textarea, select")) return;
    const layer = officePanLayerRef.current;
    if (!layer) return;
    officePanRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: officePanRef.current.originX,
      originY: officePanRef.current.originY,
    };
    officePanMovedRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }, []);

  const onOfficePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const pan = officePanRef.current;
    const layer = officePanLayerRef.current;
    if (!pan.active || pan.pointerId !== event.pointerId || !layer) return;
    const dx = event.clientX - pan.startX;
    const dy = event.clientY - pan.startY;
    if (Math.abs(dx) + Math.abs(dy) > 4) officePanMovedRef.current = true;
    applyOfficeTransform(pan.originX + dx, pan.originY + dy, officeZoomRef.current);
    event.preventDefault();
  }, [applyOfficeTransform]);

  const onOfficeWheel = useCallback((event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const direction = event.deltaY < 0 ? 1 : -1;
    setOfficeZoom(officeZoomRef.current + direction * 0.1, event.clientX - rect.left, event.clientY - rect.top);
  }, [setOfficeZoom]);

  const onOfficePointerEnd = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const pan = officePanRef.current;
    if (!pan.active || pan.pointerId !== event.pointerId) return;
    const dx = event.clientX - pan.startX;
    const dy = event.clientY - pan.startY;
    officePanRef.current = { ...pan, active: false, originX: pan.originX + dx, originY: pan.originY + dy };
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

  const onOfficeClick = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (!officePanMovedRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    officePanMovedRef.current = false;
  }, []);

  useEffect(() => {
    const updateVirtualPadVisibility = () => {
      const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
      const isNarrowViewport = window.innerWidth <= 1024;
      setShowVirtualPad(isCoarsePointer || isNarrowViewport);
    };
    updateVirtualPadVisibility();
    window.addEventListener("resize", updateVirtualPadVisibility);
    return () => window.removeEventListener("resize", updateVirtualPadVisibility);
  }, []);

  useEffect(() => {
    if (!showVirtualPad) clearVirtualMovement();
  }, [showVirtualPad, clearVirtualMovement]);

  useEffect(
    () => () => {
      clearVirtualMovement();
    },
    [clearVirtualMovement],
  );

  /* ── BUILD SCENE (no app destroy, just stage clear + rebuild) ── */
  const buildScene = useCallback(() => {
    buildOfficeScene({
      appRef,
      texturesRef,
      dataRef,
      cbRef,
      activeMeetingTaskIdRef,
      meetingMinutesOpenRef,
      localeRef,
      themeRef,
      mapModeRef,
      animItemsRef,
      roomRectsRef,
      deliveriesRef,
      deliveryLayerRef,
      prevAssignRef,
      agentPosRef,
      spriteMapRef,
      ceoMeetingSeatsRef,
      totalHRef,
      officeWRef,
      ceoPosRef,
      ceoSpriteRef,
      crownRef,
      highlightRef,
      ceoOfficeRectRef,
      breakRoomRectRef,
      breakAnimItemsRef,
      subCloneAnimItemsRef,
      subCloneBurstParticlesRef,
      subCloneSnapshotRef,
      breakSteamParticlesRef,
      breakBubblesRef,
      wallClocksRef,
      wallClockSecondRef,
      setSceneRevision,
    });
  }, []);

  useEffect(() => {
    window.localStorage.setItem("climpire.office.map_mode", officeMapMode);
    if (initDoneRef.current && appRef.current) buildScene();
  }, [officeMapMode, buildScene]);

  const { cliStatus, cliUsage, cliUsageRef, refreshing, handleRefreshUsage } = useCliUsage(tasks);

  const tickerContext = useMemo(
    () => ({
      tickRef,
      keysRef,
      ceoPosRef,
      ceoSpriteRef,
      crownRef,
      highlightRef,
      animItemsRef,
      cliUsageRef,
      roomRectsRef,
      deliveriesRef,
      breakAnimItemsRef,
      subCloneAnimItemsRef,
      subCloneBurstParticlesRef,
      breakSteamParticlesRef,
      breakBubblesRef,
      wallClocksRef,
      wallClockSecondRef,
      themeHighlightTargetIdRef,
      ceoOfficeRectRef,
      breakRoomRectRef,
      officeWRef,
      totalHRef,
      dataRef,
      followCeoInView,
    }),
    [followCeoInView, cliUsageRef],
  );

  useOfficePixiRuntime({
    containerRef,
    appRef,
    texturesRef,
    destroyedRef,
    initIdRef,
    initDoneRef,
    officeWRef,
    deliveriesRef,
    dataRef,
    buildScene,
    followCeoInView,
    triggerDepartmentInteract,
    keysRef,
    tickerContext,
    departments,
    agents,
    tasks,
    subAgents,
    unreadAgentIds,
    language,
    activeMeetingTaskId,
    customDeptThemes,
    currentTheme,
  });

  useMeetingPresenceSync({
    meetingPresence,
    language,
    sceneRevision,
    deliveryLayerRef,
    texturesRef,
    ceoMeetingSeatsRef,
    agentPosRef,
    deliveriesRef,
    spriteMapRef,
  });

  useCrossDeptDeliveryAnimations({
    crossDeptDeliveries,
    language,
    onCrossDeptDeliveryProcessed,
    deliveryLayerRef,
    texturesRef,
    agentPosRef,
    spriteMapRef,
    processedCrossDeptRef,
    deliveriesRef,
  });

  useCeoOfficeCallAnimations({
    ceoOfficeCalls,
    agents,
    language,
    onCeoOfficeCallProcessed,
    deliveryLayerRef,
    texturesRef,
    ceoMeetingSeatsRef,
    deliveriesRef,
    spriteMapRef,
    agentPosRef,
    processedCeoOfficeRef,
  });

  return (
    <div className="w-full" style={{ minHeight: "100%" }}>
      <div
        ref={officePanViewportRef}
        className="office-pan-viewport relative mx-auto w-full"
        onPointerDown={onOfficePointerDown}
        onPointerMove={onOfficePointerMove}
        onPointerUp={onOfficePointerEnd}
        onPointerCancel={onOfficePointerEnd}
        onClick={onOfficeClick}
        onWheel={onOfficeWheel}
        aria-label="Kantor interaktif. Gunakan roda mouse untuk zoom dan seret untuk berpindah."
      >
        <div className="office-view-controls" role="toolbar" aria-label="Kontrol kantor">
          <button type="button" onClick={() => setOfficeZoom(officeZoomRef.current + 0.1)} aria-label="Perbesar kantor">+</button>
          <span>{officeZoomPercent}%</span>
          <button type="button" onClick={() => setOfficeZoom(officeZoomRef.current - 0.1)} aria-label="Perkecil kantor">−</button>
          <button type="button" onClick={() => setOfficeZoom(1)} aria-label="Atur ulang zoom">↺</button>
          <select
            value={officeMapMode}
            onChange={(event) => setOfficeMapMode(event.target.value as OfficeMapMode)}
            aria-label="Mode tata letak kantor"
          >
            <option value="balanced">Seimbang</option>
            <option value="wide">Lebar</option>
            <option value="focused">Fokus</option>
          </select>
        </div>
        <div ref={officePanLayerRef} className="office-pan-layer" data-office-theme={currentTheme}>
          <div
            ref={containerRef}
            className="mx-auto"
            style={{ maxWidth: "100%", lineHeight: 0, outline: "none" }}
            tabIndex={0}
          />
        </div>

        <VirtualPadOverlay
          showVirtualPad={showVirtualPad}
          t={t}
          onInteract={triggerDepartmentInteract}
          onSetMoveDirectionPressed={setMoveDirectionPressed}
        />
      </div>

      <CliUsagePanel
        cliStatus={cliStatus}
        cliUsage={cliUsage}
        language={language}
        refreshing={refreshing}
        onRefreshUsage={handleRefreshUsage}
        t={t}
      />
    </div>
  );
}
