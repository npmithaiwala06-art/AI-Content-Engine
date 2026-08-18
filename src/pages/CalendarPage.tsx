import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  LoaderCircle,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { listClients, platformLabels } from "../services/clients";
import {
  listCalendarItems,
  listSchedulablePosts,
  reschedulePost,
  schedulePost,
  unschedulePost,
} from "../services/calendar";
import type { ClientSummary } from "../types/client";
import type { CalendarItem } from "../types/calendar";
import type { PostSummary } from "../types/content";
import { FriendlyTimePicker } from "../components/FriendlyTimePicker";
type View = "month" | "week" | "day";
const iso = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};
const startMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), 1);
const addDays = (date: Date, n: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
const monday = (date: Date) => addDays(date, -((date.getDay() + 6) % 7));
export function CalendarPage() {
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(new Date());
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [client, setClient] = useState("");
  const [platform, setPlatform] = useState("all");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(false);
  const [editItem, setEditItem] = useState<CalendarItem>();
  const range = useMemo(() => {
    if (view === "month") {
      const first = monday(startMonth(cursor));
      return { start: first, end: addDays(first, 42) };
    }
    if (view === "week") {
      const first = monday(cursor);
      return { start: first, end: addDays(first, 7) };
    }
    return {
      start: new Date(
        cursor.getFullYear(),
        cursor.getMonth(),
        cursor.getDate(),
      ),
      end: addDays(cursor, 1),
    };
  }, [cursor, view]);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setItems(
        await listCalendarItems(iso(range.start), iso(range.end), {
          clientId: client || undefined,
          platform,
          status,
        }),
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [client, platform, range, status]);
  useEffect(() => {
    listClients({ filter: "active", sort: "name" }).then(setClients);
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const days = useMemo(() => {
    const result: Date[] = [];
    for (let d = new Date(range.start); d < range.end; d = addDays(d, 1))
      result.push(d);
    return result;
  }, [range]);
  const navigate = (dir: number) =>
    setCursor(
      view === "month"
        ? new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1)
        : addDays(cursor, dir * (view === "week" ? 7 : 1)),
    );
  const title =
    view === "month"
      ? cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })
      : `${range.start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${addDays(range.end, -1).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
  const drop = async (event: React.DragEvent, date: Date) => {
    event.preventDefault();
    const postId = event.dataTransfer.getData("postId");
    const item = items.find((i) => i.postId === postId);
    if (!item) return;
    try {
      await reschedulePost(
        postId,
        `${iso(date)}T${item.scheduledFor.slice(11, 16)}:00`,
        item.timezone,
      );
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  };
  return (
    <div className="calendar-page">
      <section className="calendar-header">
        <div>
          <span>PHASE 8 · LOCAL CONTENT CALENDAR</span>
          <h2>Content Calendar</h2>
          <p>Approved content stays scheduled after every app restart.</p>
        </div>
        <button
          onClick={() => {
            setEditItem(undefined);
            setModal(true);
          }}
        >
          <Plus size={13} /> Schedule approved post
        </button>
      </section>
      {error && (
        <div className="studio-alert error">
          <span>{error}</span>
          <button onClick={() => setError("")}>
            <X size={13} />
          </button>
        </div>
      )}
      <section className="calendar-controls panel">
        <div className="calendar-nav">
          <button onClick={() => navigate(-1)}>
            <ChevronLeft size={14} />
          </button>
          <button onClick={() => setCursor(new Date())}>Today</button>
          <button onClick={() => navigate(1)}>
            <ChevronRight size={14} />
          </button>
          <h3>{title}</h3>
        </div>
        <div className="calendar-filters">
          <Filter size={12} />
          <select value={client} onChange={(e) => setClient(e.target.value)}>
            <option value="">All clients</option>
            {clients.map((c) => (
              <option value={c.id} key={c.id}>
                {c.clientName}
              </option>
            ))}
          </select>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
          >
            <option value="all">All platforms</option>
            {Object.entries(platformLabels).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="failed">Failed</option>
            <option value="published">Published</option>
          </select>
        </div>
        <nav>
          {(["month", "week", "day"] as View[]).map((v) => (
            <button
              className={v === view ? "active" : ""}
              key={v}
              onClick={() => setView(v)}
            >
              {v}
            </button>
          ))}
        </nav>
      </section>
      {loading ? (
        <div className="calendar-loading">
          <LoaderCircle className="spin" /> Loading calendar…
        </div>
      ) : (
        <section className={`calendar-grid ${view}`}>
          <header>
            {days.slice(0, view === "month" ? 7 : days.length).map((day) => (
              <div key={day.toISOString()}>
                {day.toLocaleDateString(undefined, { weekday: "short" })}
                <b>{view !== "month" && day.getDate()}</b>
              </div>
            ))}
          </header>
          <div className="calendar-days">
            {days.map((day) => {
              const date = iso(day);
              const dayItems = items.filter(
                (i) => i.scheduledFor.slice(0, 10) === date,
              );
              return (
                <article
                  key={date}
                  className={
                    day.getMonth() !== cursor.getMonth() && view === "month"
                      ? "muted"
                      : ""
                  }
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => void drop(e, day)}
                >
                  <time>{day.getDate()}</time>
                  <div>
                    {dayItems.map((item) => (
                      <button
                        draggable
                        onDragStart={(e) =>
                          e.dataTransfer.setData("postId", item.postId)
                        }
                        onClick={() => {
                          setEditItem(item);
                          setModal(true);
                        }}
                        className={item.platform}
                        key={item.scheduleId}
                      >
                        <i>{platformLabels[item.platform][0]}</i>
                        <span>
                          <strong>{item.title}</strong>
                          <small>
                            {item.clientName} ·{" "}
                            {item.scheduledFor.slice(11, 16)}
                          </small>
                        </span>
                      </button>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
      {modal && (
        <ScheduleModal
          item={editItem}
          clients={clients}
          onClose={() => setModal(false)}
          onSaved={() => {
            setModal(false);
            void refresh();
          }}
        />
      )}
    </div>
  );
}
function ScheduleModal({
  item,
  clients,
  onClose,
  onSaved,
}: {
  item?: CalendarItem;
  clients: ClientSummary[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [client, setClient] = useState(item?.clientId ?? "");
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [postId, setPostId] = useState(item?.postId ?? "");
  const [date, setDate] = useState(
    item?.scheduledFor.slice(0, 10) ?? iso(new Date()),
  );
  const [time, setTime] = useState(item?.scheduledFor.slice(11, 16) ?? "10:00");
  const [timezone, setTimezone] = useState(item?.timezone ?? "Asia/Kolkata");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    listSchedulablePosts(client || undefined).then(setPosts);
  }, [client]);
  const save = async () => {
    setBusy(true);
    try {
      if (item)
        await reschedulePost(item.postId, `${date}T${time}:00`, timezone);
      else {
        if (!postId) throw new Error("Select an approved post.");
        await schedulePost(postId, `${date}T${time}:00`, timezone);
      }
      onSaved();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!item) return;
    try {
      await unschedulePost(item.postId);
      onSaved();
    } catch (e) {
      setError(String(e));
    }
  };
  return (
    <div className="studio-prompt-backdrop">
      <section className="schedule-modal">
        <header>
          <div>
            <span>LOCAL SCHEDULER</span>
            <h3>{item ? "Reschedule post" : "Schedule approved content"}</h3>
          </div>
          <button onClick={onClose}>
            <X size={15} />
          </button>
        </header>
        <div>
          {error && <p>{error}</p>}
          <label>
            Client
            <select
              disabled={!!item}
              value={client}
              onChange={(e) => {
                setClient(e.target.value);
                setPostId("");
              }}
            >
              <option value="">All clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.clientName}
                </option>
              ))}
            </select>
          </label>
          <label className="wide">
            Approved post
            <select
              disabled={!!item}
              value={postId}
              onChange={(e) => setPostId(e.target.value)}
            >
              <option value="">Select a human-approved post</option>
              {posts.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.title} · {p.platforms.length} platform
                  {p.platforms.length === 1 ? "" : "s"}
                </option>
              ))}
              {item && <option value={item.postId}>{item.title}</option>}
            </select>
          </label>
          <label>
            Date
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label>
            Time
            <FriendlyTimePicker
              label="Schedule time"
              value={time}
              onChange={setTime}
            />
          </label>
          <label className="wide">
            Timezone
            <input
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            />
          </label>
        </div>
        <footer>
          {item ? (
            <button className="unschedule" onClick={() => void remove()}>
              <Trash2 size={12} /> Unschedule
            </button>
          ) : (
            <span>Only approved posts are shown.</span>
          )}
          <button disabled={busy} onClick={() => void save()}>
            {busy ? (
              <LoaderCircle className="spin" size={13} />
            ) : (
              <Clock size={13} />
            )}{" "}
            {item ? "Save new time" : "Schedule"}
          </button>
        </footer>
      </section>
    </div>
  );
}
