import { useEffect, type MutableRefObject } from "react";
import { Application } from "pixi.js";
import type { Agent, Department, SubAgent, Task } from "../../types";
import { type Delivery, MIN_OFFICE_W } from "./model";
import { runOfficeTickerStep, type OfficeTickerContext } from "./officeTicker";

interface UseOfficePixiRuntimeParams {
  containerRef: MutableRefObject<HTMLDivElement | null>;
  appRef: MutableRefObject<Application | null>;
  destroyedRef: MutableRefObject<boolean>;
  initIdRef: MutableRefObject<number>;
  initDoneRef: MutableRefObject<boolean>;
  officeWRef: MutableRefObject<number>;
  deliveriesRef: MutableRefObject<Delivery[]>;
  buildScene: () => void;
  followCeoInView: () => void;
  triggerDepartmentInteract: () => void;
  keysRef: MutableRefObject<Record<string, boolean>>;
  tickerContext: OfficeTickerContext;
  departments: Department[];
  agents: Agent[];
  tasks: Task[];
  subAgents: SubAgent[];
  unreadAgentIds?: Set<string>;
  language: string;
  activeMeetingTaskId?: string | null;
  customDeptThemes?: Record<string, { floor1: number; floor2: number; wall: number; accent: number }>;
  currentTheme: string;
}

export function useOfficePixiRuntime({
  containerRef,
  appRef,
  destroyedRef,
  initIdRef,
  initDoneRef,
  officeWRef,
  deliveriesRef,
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
}: UseOfficePixiRuntimeParams): void {
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    destroyedRef.current = false;
    const currentInitId = ++initIdRef.current;

    async function init() {
      if (!element) return;

      officeWRef.current = Math.max(MIN_OFFICE_W, element.clientWidth);

      const app = new Application();
      await app.init({
        width: officeWRef.current,
        height: 600,
        backgroundAlpha: 0,
        antialias: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
      });

      if (initIdRef.current !== currentInitId) {
        try {
          app.destroy();
        } catch {}
        return;
      }

      appRef.current = app;
      const canvas = app.canvas as HTMLCanvasElement;
      canvas.style.imageRendering = "auto";
      element.innerHTML = "";
      element.appendChild(canvas);


      if (initIdRef.current !== currentInitId) {
        try {
          app.destroy();
        } catch {}
        return;
      }

      buildScene();
      initDoneRef.current = true;
      followCeoInView();

      app.ticker.add(() => {
        if (destroyedRef.current || appRef.current !== app) return;
        runOfficeTickerStep(tickerContext);
      });
    }

    const isInputFocused = () => {
      const tag = document.activeElement?.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        (document.activeElement as HTMLElement)?.isContentEditable
      );
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (isInputFocused()) return;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD"].includes(event.code)) {
        event.preventDefault();
        keysRef.current[event.code] = true;
      }
      if (event.code === "Enter" || event.code === "Space") {
        event.preventDefault();
        triggerDepartmentInteract();
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (isInputFocused()) return;
      keysRef.current[event.code] = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    init();

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry || !appRef.current || destroyedRef.current || initIdRef.current !== currentInitId) return;
      const newWidth = Math.max(MIN_OFFICE_W, Math.floor(entry.contentRect.width));
      if (Math.abs(newWidth - officeWRef.current) > 10) {
        officeWRef.current = newWidth;
        buildScene();
      }
    });

    resizeObserver.observe(element);

    return () => {
      destroyedRef.current = true;
      initIdRef.current++;
      resizeObserver.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      deliveriesRef.current = [];
      initDoneRef.current = false;

      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }
    };
  }, [
    containerRef,
    appRef,
    destroyedRef,
    initIdRef,
    initDoneRef,
    officeWRef,
    deliveriesRef,
    buildScene,
    followCeoInView,
    triggerDepartmentInteract,
    keysRef,
    tickerContext,
  ]);

  useEffect(() => {
    if (initDoneRef.current && appRef.current) {
      buildScene();
    }
  }, [
    departments,
    agents,
    tasks,
    subAgents,
    unreadAgentIds,
    language,
    activeMeetingTaskId,
    customDeptThemes,
    currentTheme,
    buildScene,
    initDoneRef,
    appRef,
  ]);
}
