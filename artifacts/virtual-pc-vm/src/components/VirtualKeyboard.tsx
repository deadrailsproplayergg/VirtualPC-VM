import { useState } from "react";
import { Delete, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface VirtualKeyboardProps {
  onKey: (key: string, code: string) => void;
  onHide: () => void;
}

type Row = Array<{ label: string; code: string; width?: number }>;

const ROWS_NORMAL: Row[] = [
  [
    { label: "Esc", code: "Escape", width: 1.5 },
    { label: "1", code: "Digit1" }, { label: "2", code: "Digit2" },
    { label: "3", code: "Digit3" }, { label: "4", code: "Digit4" },
    { label: "5", code: "Digit5" }, { label: "6", code: "Digit6" },
    { label: "7", code: "Digit7" }, { label: "8", code: "Digit8" },
    { label: "9", code: "Digit9" }, { label: "0", code: "Digit0" },
    { label: "⌫", code: "Backspace", width: 1.5 },
  ],
  [
    { label: "Tab", code: "Tab", width: 1.5 },
    { label: "q", code: "KeyQ" }, { label: "w", code: "KeyW" },
    { label: "e", code: "KeyE" }, { label: "r", code: "KeyR" },
    { label: "t", code: "KeyT" }, { label: "y", code: "KeyY" },
    { label: "u", code: "KeyU" }, { label: "i", code: "KeyI" },
    { label: "o", code: "KeyO" }, { label: "p", code: "KeyP" },
    { label: "↵", code: "Enter", width: 1.5 },
  ],
  [
    { label: "Ctrl", code: "ControlLeft", width: 1.5 },
    { label: "a", code: "KeyA" }, { label: "s", code: "KeyS" },
    { label: "d", code: "KeyD" }, { label: "f", code: "KeyF" },
    { label: "g", code: "KeyG" }, { label: "h", code: "KeyH" },
    { label: "j", code: "KeyJ" }, { label: "k", code: "KeyK" },
    { label: "l", code: "KeyL" },
    { label: "Alt", code: "AltLeft", width: 1.5 },
  ],
  [
    { label: "⇧", code: "ShiftLeft", width: 2 },
    { label: "z", code: "KeyZ" }, { label: "x", code: "KeyX" },
    { label: "c", code: "KeyC" }, { label: "v", code: "KeyV" },
    { label: "b", code: "KeyB" }, { label: "n", code: "KeyN" },
    { label: "m", code: "KeyM" },
    { label: "Space", code: "Space", width: 3 },
  ],
];

const ROWS_SHIFTED: Row[] = ROWS_NORMAL.map(row =>
  row.map(key => {
    const shiftMap: Record<string, string> = {
      "1": "!", "2": "@", "3": "#", "4": "$", "5": "%",
      "6": "^", "7": "&", "8": "*", "9": "(", "0": ")",
    };
    const shifted = shiftMap[key.label] ?? key.label.toUpperCase();
    return key.code.startsWith("Digit") ? { ...key, label: shifted } : key;
  })
);

const FUNCTION_KEYS: Row = [
  { label: "F1", code: "F1" }, { label: "F2", code: "F2" },
  { label: "F3", code: "F3" }, { label: "F4", code: "F4" },
  { label: "F5", code: "F5" }, { label: "F6", code: "F6" },
  { label: "F7", code: "F7" }, { label: "F8", code: "F8" },
  { label: "F9", code: "F9" }, { label: "F10", code: "F10" },
  { label: "F11", code: "F11" }, { label: "F12", code: "F12" },
];

export function VirtualKeyboard({ onKey, onHide }: VirtualKeyboardProps) {
  const [shifted, setShifted] = useState(false);
  const [showFn, setShowFn] = useState(false);

  const rows = shifted ? ROWS_SHIFTED : ROWS_NORMAL;

  const press = (code: string, label: string) => {
    if (code === "ShiftLeft") {
      setShifted(v => !v);
      return;
    }
    onKey(label, code);
    if (shifted && code !== "ShiftLeft") setShifted(false);
  };

  return (
    <div className="fixed bottom-0 inset-x-0 z-[100] bg-slate-900/95 backdrop-blur-sm border-t border-slate-700 pb-safe">
      {/* toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-700/50">
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={showFn ? "default" : "ghost"}
            className="h-7 px-3 text-xs"
            onClick={() => setShowFn(v => !v)}
          >
            Fn
          </Button>
          <Button
            size="sm"
            variant={shifted ? "default" : "ghost"}
            className="h-7 px-3 text-xs"
            onClick={() => setShifted(v => !v)}
          >
            <ChevronUp className="h-3.5 w-3.5 mr-1" />
            Shift
          </Button>
        </div>
        <Button size="sm" variant="ghost" onClick={onHide} className="h-7 px-3 text-xs text-muted-foreground">
          Скрыть
        </Button>
      </div>

      {/* Fn row */}
      {showFn && (
        <div className="flex gap-0.5 px-2 py-1 overflow-x-auto no-scrollbar">
          {FUNCTION_KEYS.map(key => (
            <KeyButton key={key.code} label={key.label} onPress={() => press(key.code, key.label)} />
          ))}
        </div>
      )}

      {/* main rows */}
      <div className="px-1.5 pt-1 pb-2 space-y-0.5">
        {rows.map((row, ri) => (
          <div key={ri} className="flex gap-0.5 justify-center">
            {row.map(key => (
              <KeyButton
                key={key.code}
                label={key.label}
                width={key.width}
                special={["Escape", "Tab", "ControlLeft", "AltLeft", "ShiftLeft", "Enter", "Backspace", "Space"].includes(key.code)}
                active={key.code === "ShiftLeft" && shifted}
                onPress={() => press(key.code, key.label)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function KeyButton({
  label,
  onPress,
  width = 1,
  special = false,
  active = false,
}: {
  label: string;
  onPress: () => void;
  width?: number;
  special?: boolean;
  active?: boolean;
}) {
  return (
    <button
      onPointerDown={(e) => { e.preventDefault(); onPress(); }}
      style={{ flex: width }}
      className={`
        select-none touch-none rounded px-1 py-2 text-xs font-medium min-w-[28px] text-center transition-all active:scale-95
        ${active
          ? "bg-primary text-primary-foreground"
          : special
            ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
            : "bg-slate-800 text-slate-100 hover:bg-slate-700"
        }
      `}
    >
      {label}
    </button>
  );
}
