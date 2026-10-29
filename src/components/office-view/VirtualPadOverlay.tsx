import type { LanguageText } from "../../i18n";
import { LOCALE_TEXT } from "./themes-locale";
import type { MobileMoveDirection } from "./model";

type TFunction = (messages: LanguageText) => string;

interface VirtualPadOverlayProps {
  showVirtualPad: boolean;
  t: TFunction;
  onInteract: () => void;
  onSetMoveDirectionPressed: (direction: MobileMoveDirection, pressed: boolean) => void;
}

const mobilePadButtonClass =
  "pointer-events-auto flex h-11 w-11 touch-none items-center justify-center rounded-xl border border-white/15 bg-slate-950/70 text-sm font-semibold text-slate-100 shadow-lg backdrop-blur active:scale-95 active:bg-slate-700/90";

export default function VirtualPadOverlay({
  showVirtualPad,
  t,
  onInteract,
  onSetMoveDirectionPressed,
}: VirtualPadOverlayProps) {
  if (!showVirtualPad) return null;

  return (
    <>
      <div className="pointer-events-none absolute bottom-3 left-1/2 z-30 -translate-x-1/2">
        <button
          type="button"
          aria-label={t(LOCALE_TEXT.mobileEnter)}
          className="pointer-events-auto flex h-11 min-w-14 touch-none items-center justify-center rounded-xl border border-amber-200/50 bg-amber-400 px-3 text-[11px] font-bold tracking-wide text-slate-950 shadow-lg active:scale-95 active:bg-amber-300"
          style={{ touchAction: "none" }}
          onPointerDown={(event) => event.preventDefault()}
          onClick={onInteract}
        >
          {t(LOCALE_TEXT.mobileEnter)}
        </button>
      </div>

      <div className="pointer-events-none absolute bottom-3 right-3 z-30">
        <div className="grid grid-cols-3 gap-1">
          <div />
          <button
            type="button"
            aria-label={t(LOCALE_TEXT.moveUp)}
            className={mobilePadButtonClass}
            style={{ touchAction: "none" }}
            onPointerDown={() => onSetMoveDirectionPressed("up", true)}
            onPointerUp={() => onSetMoveDirectionPressed("up", false)}
            onPointerCancel={() => onSetMoveDirectionPressed("up", false)}
            onPointerLeave={() => onSetMoveDirectionPressed("up", false)}
          >
            ▲
          </button>
          <div />
          <button
            type="button"
            aria-label={t(LOCALE_TEXT.moveLeft)}
            className={mobilePadButtonClass}
            style={{ touchAction: "none" }}
            onPointerDown={() => onSetMoveDirectionPressed("left", true)}
            onPointerUp={() => onSetMoveDirectionPressed("left", false)}
            onPointerCancel={() => onSetMoveDirectionPressed("left", false)}
            onPointerLeave={() => onSetMoveDirectionPressed("left", false)}
          >
            ◀
          </button>
          <div className="h-11 w-11" />
          <button
            type="button"
            aria-label={t(LOCALE_TEXT.moveRight)}
            className={mobilePadButtonClass}
            style={{ touchAction: "none" }}
            onPointerDown={() => onSetMoveDirectionPressed("right", true)}
            onPointerUp={() => onSetMoveDirectionPressed("right", false)}
            onPointerCancel={() => onSetMoveDirectionPressed("right", false)}
            onPointerLeave={() => onSetMoveDirectionPressed("right", false)}
          >
            ▶
          </button>
          <div />
          <button
            type="button"
            aria-label={t(LOCALE_TEXT.moveDown)}
            className={mobilePadButtonClass}
            style={{ touchAction: "none" }}
            onPointerDown={() => onSetMoveDirectionPressed("down", true)}
            onPointerUp={() => onSetMoveDirectionPressed("down", false)}
            onPointerCancel={() => onSetMoveDirectionPressed("down", false)}
            onPointerLeave={() => onSetMoveDirectionPressed("down", false)}
          >
            ▼
          </button>
          <div />
        </div>
      </div>
    </>
  );
}
