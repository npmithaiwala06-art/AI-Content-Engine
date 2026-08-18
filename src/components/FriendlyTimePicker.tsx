import { Clock3, X } from "lucide-react";

interface FriendlyTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  quickTimes?: boolean;
}

const pad = (value: number | string) => String(value).padStart(2, "0");

function readTime(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return { hour: "", minute: "", period: "AM" as const };
  const hour24 = Number(match[1]);
  return {
    hour: String(hour24 % 12 || 12),
    minute: match[2],
    period: hour24 >= 12 ? "PM" as const : "AM" as const,
  };
}

function to24Hour(hour: string, minute: string, period: "AM" | "PM") {
  let hour24 = Number(hour) % 12;
  if (period === "PM") hour24 += 12;
  return `${pad(hour24)}:${pad(minute)}`;
}

export function FriendlyTimePicker({ value, onChange, label = "Time", quickTimes = true }: FriendlyTimePickerProps) {
  const current = readTime(value);
  const minutes = Array.from(new Set([
    ...Array.from({ length: 12 }, (_, index) => pad(index * 5)),
    ...(current.minute ? [current.minute] : []),
  ])).sort();

  const setHour = (hour: string) => {
    if (!hour) return onChange("");
    onChange(to24Hour(hour, current.minute || "00", current.period));
  };
  const setMinute = (minute: string) => {
    if (!minute) return onChange("");
    onChange(to24Hour(current.hour || "9", minute, current.period));
  };
  const setPeriod = (period: "AM" | "PM") => onChange(to24Hour(current.hour || "9", current.minute || "00", period));
  const setNow = () => {
    const now = new Date();
    onChange(`${pad(now.getHours())}:${pad(now.getMinutes())}`);
  };

  return <div className="friendly-time-picker" data-value={value}>
    <div className="friendly-time-fields">
      <Clock3 size={13} aria-hidden="true" />
      <select aria-label={`${label} hour`} value={current.hour} onChange={(event) => setHour(event.target.value)}>
        <option value="">Hour</option>
        {Array.from({ length: 12 }, (_, index) => String(index + 1)).map((hour) => <option key={hour} value={hour}>{hour}</option>)}
      </select>
      <span>:</span>
      <select aria-label={`${label} minute`} value={current.minute} onChange={(event) => setMinute(event.target.value)}>
        <option value="">Min</option>
        {minutes.map((minute) => <option key={minute} value={minute}>{minute}</option>)}
      </select>
      <select aria-label={`${label} period`} value={current.period} onChange={(event) => setPeriod(event.target.value as "AM" | "PM")}>
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
      {value && <button type="button" className="friendly-time-clear" aria-label={`Clear ${label.toLowerCase()}`} onClick={() => onChange("")}><X size={12} /></button>}
    </div>
    {quickTimes && <div className="friendly-time-quick" aria-label={`${label} quick choices`}>
      <button type="button" onClick={setNow}>Now</button>
      {["09:00", "12:00", "15:00", "18:00"].map((time) => <button type="button" className={value === time ? "active" : ""} key={time} onClick={() => onChange(time)}>{time === "09:00" ? "9 AM" : time === "12:00" ? "12 PM" : time === "15:00" ? "3 PM" : "6 PM"}</button>)}
    </div>}
  </div>;
}
