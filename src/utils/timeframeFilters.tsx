import React from 'react';
import { Calendar, Clock, Sparkles } from 'lucide-react';

export type TimeframeFilter = 'all' | 'today' | '7days' | 'monthly';

/**
 * Checks if a date/timestamp falls within the chosen timeframe filter
 */
export function matchesTimeframe(
  dateOrIso: string | undefined | null,
  filter: TimeframeFilter
): boolean {
  if (filter === 'all' || !dateOrIso) return true;

  let dateObj: Date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOrIso)) {
    const [y, m, d] = dateOrIso.split('-').map(Number);
    dateObj = new Date(y, m - 1, d);
  } else {
    dateObj = new Date(dateOrIso);
  }

  if (Number.isNaN(dateObj.getTime())) return true;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfToday = startOfToday + 86400000 - 1;
  const targetTime = dateObj.getTime();

  if (filter === 'today') {
    return targetTime >= startOfToday && targetTime <= endOfToday;
  }

  if (filter === '7days') {
    // Last 7 full calendar days (including today)
    const sevenDaysAgo = startOfToday - (6 * 86400000);
    return targetTime >= sevenDaysAgo;
  }

  if (filter === 'monthly') {
    // Current calendar month
    return dateObj.getFullYear() === now.getFullYear() && dateObj.getMonth() === now.getMonth();
  }

  return true;
}

/**
 * Formats date and time cleanly for display (e.g., "19 Nov 2026 at 04:30 PM")
 */
export function formatFullDateTime(
  dateStr?: string | null,
  timeStr?: string | null
): { formattedDate: string; formattedTime: string; fullDisplay: string } {
  let dateObj: Date;

  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-').map(Number);
    dateObj = new Date(y, m - 1, d);
  } else if (dateStr) {
    dateObj = new Date(dateStr);
  } else {
    dateObj = new Date();
  }

  const formattedDate = !Number.isNaN(dateObj.getTime())
    ? dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : (dateStr || 'Today');

  let formattedTime = timeStr || '';
  if (!formattedTime && dateStr && dateStr.includes('T')) {
    formattedTime = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  } else if (formattedTime && /^\d{1,2}:\d{2}$/.test(formattedTime)) {
    const [h, m] = formattedTime.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    formattedTime = `${hour12}:${String(m).padStart(2, '0')} ${period}`;
  }

  const fullDisplay = formattedTime ? `${formattedDate} at ${formattedTime}` : formattedDate;
  return { formattedDate, formattedTime, fullDisplay };
}

interface TimeframeFilterBarProps {
  selected: TimeframeFilter;
  onChange: (filter: TimeframeFilter) => void;
  counts?: Partial<Record<TimeframeFilter, number>>;
  theme?: 'purple' | 'emerald' | 'dark';
}

export const TimeframeFilterBar: React.FC<TimeframeFilterBarProps> = ({
  selected,
  onChange,
  counts,
  theme = 'purple'
}) => {
  const options: { id: TimeframeFilter; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'all', label: 'All Time', icon: Sparkles },
    { id: 'today', label: 'Today', icon: Clock },
    { id: '7days', label: 'Last 7 Days', icon: Calendar },
    { id: 'monthly', label: 'This Month', icon: Calendar },
  ];

  const getActiveClass = () => {
    if (theme === 'emerald') {
      return 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/20';
    }
    if (theme === 'dark') {
      return 'bg-slate-800 text-white border border-slate-600 shadow-md';
    }
    return 'bg-gradient-to-r from-[#6D28D9] to-purple-700 text-white shadow-md shadow-purple-500/20';
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl bg-slate-950/80 border border-slate-800 shadow-inner">
      {options.map((opt) => {
        const isActive = selected === opt.id;
        const Icon = opt.icon;
        const count = counts ? counts[opt.id] : undefined;

        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer select-none active:scale-95 ${
              isActive
                ? getActiveClass()
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
            <span>{opt.label}</span>
            {count !== undefined && (
              <span
                className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
