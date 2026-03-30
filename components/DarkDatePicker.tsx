"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function parseYmd(s: string): { y: number; m: number; d: number } | null {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
}

export function toYmd(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function compareYmd(a: string, b: string): number {
  return a.localeCompare(b);
}

export type DarkDateCalendarProps = {
  value: string;
  min?: string;
  max?: string;
  onSelect: (ymd: string) => void;
  onClear?: () => void;
  showFooter?: boolean;
};

export function DarkDateCalendar({
  value,
  min,
  max,
  onSelect,
  onClear,
  showFooter = true,
}: DarkDateCalendarProps) {
  const fallback = parseYmd(new Date().toISOString().slice(0, 10))!;
  const v = parseYmd(value) ?? fallback;
  const [viewY, setViewY] = useState(v.y);
  const [viewM, setViewM] = useState(v.m);

  useEffect(() => {
    const p = parseYmd(value);
    if (p) {
      setViewY(p.y);
      setViewM(p.m);
    }
  }, [value]);

  const cells = useMemo(() => {
    const first = new Date(viewY, viewM - 1, 1).getDay();
    const count = new Date(viewY, viewM, 0).getDate();
    const arr: (number | null)[] = [];
    for (let i = 0; i < first; i++) arr.push(null);
    for (let d = 1; d <= count; d++) arr.push(d);
    return arr;
  }, [viewY, viewM]);

  const isDisabled = (d: number): boolean => {
    const ymd = toYmd(viewY, viewM, d);
    if (min && compareYmd(ymd, min) < 0) return true;
    if (max && compareYmd(ymd, max) > 0) return true;
    return false;
  };

  const prevMonth = () => {
    if (viewM === 1) {
      setViewM(12);
      setViewY((y) => y - 1);
    } else setViewM((m) => m - 1);
  };

  const nextMonth = () => {
    if (viewM === 12) {
      setViewM(1);
      setViewY((y) => y + 1);
    } else setViewM((m) => m + 1);
  };

  const today = new Date();
  const todayYmd = toYmd(today.getFullYear(), today.getMonth() + 1, today.getDate());
  const todayOutOfRange = Boolean(
    (min != null && min !== "" && compareYmd(todayYmd, min) < 0) ||
      (max != null && max !== "" && compareYmd(todayYmd, max) > 0),
  );

  return (
    <div className="w-[min(100vw-2rem,288px)] select-none 
                bg-[#0B1220] 
                border border-white/10 
                rounded-xl 
                shadow-2xl 
                backdrop-blur-xl 
                p-3">
      <div className="flex items-center justify-between mb-3 px-0.5">
        <button
          type="button"
          onClick={prevMonth}
          className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-white tracking-tight">
          {MONTHS[viewM - 1]} {viewY}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          aria-label="Next month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-medium uppercase tracking-wider text-zinc-500 mb-2">
        {DOW.map((d) => (
          <span key={d} className="py-1">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) =>
          d === null ? (
            <span key={`e-${i}`} className="h-9" />
          ) : (
            <button
              key={d}
              type="button"
              disabled={isDisabled(d)}
              onClick={() => {
                if (!isDisabled(d)) onSelect(toYmd(viewY, viewM, d));
              }}
              className={`h-9 rounded-xl text-xs font-medium transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-25 ${
                value === toYmd(viewY, viewM, d) ?
                  "bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-900/40 ring-1 ring-violet-400/30"
                : "text-zinc-200 hover:bg-violet-500/15 hover:text-white border border-transparent hover:border-violet-500/25"
              }`}
            >
              {d}
            </button>
          ),
        )}
      </div>
      {showFooter ? (
        <div className="flex gap-2 mt-4 pt-3 border-t border-white/10">
          {onClear ? (
            <button
              type="button"
              onClick={() => onClear()}
              className="flex-1 py-2 rounded-xl text-xs font-medium text-zinc-400 border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] hover:text-zinc-200 cursor-pointer"
            >
              Clear
            </button>
          ) : null}
          <button
            type="button"
            disabled={todayOutOfRange}
            onClick={() => onSelect(todayYmd)}
            className="flex-1 py-2 rounded-xl text-xs font-medium text-violet-200 border border-violet-500/35 bg-violet-500/10 hover:bg-violet-500/20 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Today
          </button>
        </div>
      ) : null}
    </div>
  );
}

function formatDisplayYmd(ymd: string): string {
  const p = parseYmd(ymd);
  if (!p) return ymd;
  const d = new Date(p.y, p.m - 1, p.d);
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export function DarkDatePickerField({
  label,
  value,
  min,
  max,
  onChange,
  onClear,
  emptyLabel = "Any",
  calendarFallback,
}: {
  label: string;
  value: string | null;
  min?: string;
  max?: string;
  onChange: (v: string) => void;
  onClear?: () => void;
  /** Shown on the button when `value` is empty */
  emptyLabel?: string;
  /** YYYY-MM-DD anchor when opening calendar with no `value` */
  calendarFallback?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const hasValue = Boolean(value && YMD.test(value));
  const calendarValue =
    hasValue && value ? value : (calendarFallback ?? new Date().toISOString().slice(0, 10));

  return (
    <div ref={ref} className="relative">
      <label className="block text-xs text-zinc-400 mb-1">{label}</label>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-3 py-2.5 rounded-xl text-sm bg-[#0a0614] border border-violet-500/20 text-white flex items-center justify-between gap-2 hover:border-violet-400/40 hover:bg-[#0d0818] cursor-pointer shadow-inner shadow-black/40"
      >
        <span
          className={`tabular-nums truncate text-left ${hasValue ? "text-zinc-100" : "text-zinc-500 italic"}`}
        >
          {hasValue && value ? formatDisplayYmd(value) : emptyLabel}
        </span>
        <div className="flex items-center gap-1 shrink-0 text-violet-400/80">
          <Calendar className="w-4 h-4" aria-hidden />
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
        </div>
      </button>
      {open ? (
        <div className="absolute z-[100] left-0 right-0 mt-2 p-3 rounded-2xl border border-violet-500/30 bg-[#07030f] shadow-2xl shadow-black/90 ring-1 ring-white/5 backdrop-blur-xl">
          <DarkDateCalendar
            value={calendarValue}
            min={min}
            max={max}
            onSelect={(ymd) => {
              onChange(ymd);
              setOpen(false);
            }}
            onClear={
              onClear ?
                () => {
                  onClear();
                  setOpen(false);
                }
              : undefined
            }
          />
        </div>
      ) : null}
    </div>
  );
}
