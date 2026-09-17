import { compareOpportunities, type OpportunitySort } from "./opportunitySort";
import { cashLabel } from "./prizeFacts";
import { ConvexError } from "convex/values";
import { profileInput } from "./profileInput";
import Markdown from "react-markdown";
import { useState, useEffect, useRef, type FormEvent } from "react";
import {
  useQuery,
  usePaginatedQuery,
  useMutation,
  useAction,
  useConvexAuth,
} from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import {
  Compass,
  CalendarPlus,
  LayoutList,
  Bookmark,
  Mail,
  SlidersHorizontal,
  ArrowUpRight,
  ArrowRight,
  Search,
  Clock,
  Globe,
  Check,
  Plus,
  X,
  ChevronRight,
  LogOut,
  Send,
  LoaderCircle,
  ExternalLink,
  PanelLeftClose,
} from "lucide-react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { downloadDeadline } from "./calendar";
import { deadlineLabel } from "./deadline";
import { useExpiringOpportunities } from "./useExpiringOpportunities";
import {
  matchOpportunity,
  compareProfileFit,
  profileFitLabel,
  type Opportunity,
  type Profile,
} from "./matching";
const initialProfile: Profile = {
  skills: [],
  location: "",
  hours: 12,
  solo: false,
  goal: "portfolio",
};
type View = "board" | "saved" | "digest" | "profile" | "advisor";
type Model = {
  list: Opportunity[] | undefined;
  savedList?: Opportunity[];
  filter?: (
    search: string,
    kind: "all" | "hackathon" | "gig" | "grant",
    sort: OpportunitySort,
  ) => void;
  more?: { loading: boolean; load: () => void };
  saved: string[];
  profile: Profile | null;
  email: string;
  digestEnabled: boolean;
  latest: { body: string; createdAt: number; request: string } | null;
  authenticated: boolean;
  status: { ai: boolean; firecrawl: boolean; email: boolean } | undefined;
  submitSource?: (url: string) => Promise<string>;
  toggle: (id: string) => Promise<unknown>;
  save: (p: Profile, enabled: boolean) => Promise<unknown>;
  ask: (s: string) => Promise<unknown>;
  login: (f: FormData) => Promise<unknown>;
  logout: () => Promise<unknown>;
};
function Connected() {
  const [filters, setFilters] = useState<{
    search: string;
    kind: "all" | "hackathon" | "gig" | "grant";
    sort: OpportunitySort;
  }>({ search: "", kind: "all", sort: "endingSoon" });
  const [catalogAsOf] = useState(() => Date.now());
  const catalog = usePaginatedQuery(
    api.board.page,
    {
      asOf: catalogAsOf,
      search: filters.search,
      sort: filters.sort,
      kind: filters.kind === "all" ? undefined : filters.kind,
    },
    { initialNumItems: 50 },
  );
  const list =
    catalog.status === "LoadingFirstPage" ? undefined : catalog.results;
  const saved = useQuery(api.board.savedData, {}),
    profile = useQuery(api.profiles.mine, {}),
    latest = useQuery(api.profiles.latest, {}),
    status = useQuery(api.system.status, {});
  const submitSource = useMutation(api.discovery.submitSource);
  const toggle = useMutation(api.board.toggleSave),
    save = useMutation(api.profiles.save),
    ask = useAction(api.advisor.ask);
  const { isAuthenticated } = useConvexAuth(),
    { signIn, signOut } = useAuthActions();
  return (
    <Shell
      connected
      model={{
        list,
        more:
          catalog.status === "CanLoadMore" || catalog.status === "LoadingMore"
            ? {
                loading: catalog.status === "LoadingMore",
                load: () => catalog.loadMore(50),
              }
            : undefined,
        saved: saved?.ids ?? [],
        savedList: saved?.records ?? [],
        filter: (search, kind, sort) =>
          setFilters((current) =>
            current.search === search &&
            current.kind === kind &&
            current.sort === sort
              ? current
              : { search, kind, sort },
          ),
        profile: profile ?? null,
        email: profile?.email ?? "",
        digestEnabled: profile?.digestEnabled ?? false,
        latest: latest ?? null,
        authenticated: isAuthenticated,
        status,
        submitSource: (url) => submitSource({ url }),
        toggle: (id) => toggle({ opportunityId: id as Id<"opportunities"> }),
        save: (p, enabled) => save(profileInput(p, enabled)),
        ask: (s) => ask({ prompt: s }),
        login: (f) => signIn("password", f),
        logout: signOut,
      }}
    />
  );
}
function Preview() {
  const [saved, setSaved] = useState<string[]>([]);
  return (
    <Shell
      connected={false}
      model={{
        list: [],
        saved,
        profile: null,
        email: "",
        digestEnabled: false,
        latest: null,
        authenticated: false,
        status: { ai: false, firecrawl: false, email: false },
        toggle: async (id) =>
          setSaved((s) =>
            s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
          ),
        save: async () => {
          throw Error("Connect a Convex deployment to save your profile.");
        },
        ask: async () => {
          throw Error("Connect OpenAI and Convex to use the advisor.");
        },
        login: async () => {
          throw Error("Connect a Convex deployment to create an account.");
        },
        logout: async () => {},
      }}
    />
  );
}
export default function App({ connected }: { connected: boolean }) {
  return connected ? <Connected /> : <Preview />;
}
export function Shell({
  connected,
  model,
}: {
  connected: boolean;
  model: Model;
}) {
  const [view, setView] = useState<View>(() => {
      const requested = new URLSearchParams(window.location.search).get("view");
      return requested === "profile" || requested === "digest"
        ? requested
        : "board";
    }),
    [kind, setKind] = useState<"all" | "hackathon" | "gig" | "grant">("all"),
    [sourceUrl, setSourceUrl] = useState(""),
    [submittingSource, setSubmittingSource] = useState(false),
    [search, setSearch] = useState(""),
    [sortChoice, setSort] = useState<OpportunitySort | null>(null),
    [selected, setSelected] = useState<string | null>(() =>
      new URLSearchParams(window.location.search).get("opportunity"),
    ),
    [onlyFit, setOnlyFit] = useState(false),
    [loginOpen, setLoginOpen] = useState(false),
    [flow, setFlow] = useState("signIn"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [prompt, setPrompt] = useState(""),
    [draft, setDraft] = useState<Profile>(initialProfile),
    [digest, setDigest] = useState(false),
    [editing, setEditing] = useState(false),
    [invalidFields, setInvalidFields] = useState<Record<string, string>>({});

  const authTrigger = useRef<HTMLElement | null>(null);
  function openLogin() {
    authTrigger.current = document.activeElement as HTMLElement | null;
    setLoginOpen(true);
  }
  useEffect(() => {
    if (!loginOpen) return;
    const previous = authTrigger.current;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLoginOpen(false);
      if (event.key === "Tab") {
        const controls = Array.from(
          document.querySelectorAll<HTMLElement>(
            ".auth-dialog button:not([disabled]), .auth-dialog input",
          ),
        );
        const first = controls[0],
          last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, [loginOpen]);
  const profile = editing ? draft : (model.profile ?? draft);
  const sort: OpportunitySort =
    sortChoice === "bestFit" && !model.profile
      ? "endingSoon"
      : (sortChoice ?? (model.profile ? "bestFit" : "endingSoon"));
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const current = Date.now();
    const next = (model.list ?? []).flatMap((o) =>
      o.deadline !== null && o.deadline > current ? [o.deadline - current] : [],
    );
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.max(1, Math.min(1000, ...next)),
    );
    return () => clearTimeout(timer);
  }, [now, model.list]);
  useEffect(() => {
    const timer = setTimeout(() => model.filter?.(search, kind, sort), 200);
    return () => clearTimeout(timer);
  }, [search, kind, sort]);
  const visibleOpportunities = useExpiringOpportunities(
    view === "saved" ? (model.savedList ?? model.list) : model.list,
    now,
  );
  const rows = visibleOpportunities.filter(
    (o) =>
      (kind === "all" || o.kind === kind) &&
      (view !== "saved" || model.saved.includes(o._id)) &&
      ((model.filter && view !== "saved") ||
        `${o.title} ${o.organization} ${o.skills.join(" ")}`
          .toLowerCase()
          .includes(search.toLowerCase())) &&
      (!onlyFit ||
        !model.profile ||
        matchOpportunity(o, model.profile, now).eligible),
  );
  rows.sort((a, b) =>
    sort === "bestFit" && model.profile
      ? compareProfileFit(a, b, model.profile, now)
      : compareOpportunities(a, b, sort),
  );
  const activeRows = rows.filter((o) => !o.departingAt);
  const savedCount = (model.savedList ?? visibleOpportunities).filter((o) =>
    model.saved.includes(o._id),
  ).length;
  const item = activeRows.find((o) => o._id === selected) ?? activeRows[0];
  const activeProfile = () => {
    setDraft(model.profile ?? draft);
    setDigest(model.digestEnabled);
    setEditing(true);
    setView("profile");
  };
  async function perform(fn: () => Promise<unknown>, success = "") {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await fn();
      if (success) setNotice(success);
    } catch (e) {
      setError(
        e instanceof Error && /rate.limit|429|busy/i.test(e.message)
          ? "Scout is temporarily rate-limited. Please try again in a few minutes."
          : e instanceof Error
            ? /\[CONVEX/.test(e.message)
              ? "This action could not be completed. Please try again."
              : e.message.split("\n")[0]
            : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  function requireLogin(next: () => void) {
    if (connected && !model.authenticated) {
      openLogin();
      return;
    }
    next();
  }
  async function submitQuestion(e: FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;
    requireLogin(
      () =>
        void perform(
          () => model.ask(prompt.trim()),
          "Your shortlist has been updated.",
        ),
    );
  }
  const nav = [
    { id: "board" as View, label: "Discover", icon: LayoutList },
    { id: "saved" as View, label: "Saved opportunities", icon: Bookmark },
    { id: "digest" as View, label: "Weekly digest", icon: Mail },
    { id: "profile" as View, label: "Preferences", icon: SlidersHorizontal },
  ];
  return (
    <div className="app-shell">
      <aside className="sidebar" inert={loginOpen}>
        <nav aria-label="Main navigation">
          {nav.map((n) => (
            <button
              key={n.id}
              aria-label={n.label}
              title={n.label}
              aria-current={view === n.id ? "page" : undefined}
              className={view === n.id ? "nav-item active" : "nav-item"}
              onClick={() =>
                n.id === "profile" ? activeProfile() : setView(n.id)
              }
            >
              <n.icon size={16} />
              <span>
                {n.id === "saved"
                  ? "Saved"
                  : n.id === "digest"
                    ? "Digest"
                    : n.label}
              </span>
              {n.id === "saved" && savedCount > 0 && (
                <span className="count">{savedCount}</span>
              )}
            </button>
          ))}
        </nav>
      </aside>
      <main inert={loginOpen}>
        <header className="topbar">
          <span className="breadcrumb">
            <strong>
              {view === "board"
                ? "Discover"
                : view === "saved"
                  ? "Saved"
                  : view === "profile"
                    ? "Your profile"
                    : view === "digest"
                      ? "Weekly digest"
                      : "Advisor"}
            </strong>
          </span>
          <div className="top-actions">
            <span className="mode-label">
              <span
                className={connected ? "status-dot" : "status-dot preview-dot"}
              />
              {connected ? "Connected workspace" : "Interactive preview"}
            </span>
            {model.authenticated ? (
              <button
                className="icon-button"
                aria-label="Sign out"
                onClick={() => void perform(model.logout)}
              >
                <LogOut size={16} />
              </button>
            ) : (
              <button className="text-button" onClick={openLogin}>
                Sign in <ArrowUpRight size={16} />
              </button>
            )}
          </div>
        </header>
        <div className="content">
          {!connected && (
            <div className="preview-banner">
              Connect the backend to see verified active opportunities.
            </div>
          )}
          {(error || notice) && (
            <div
              role={error ? "alert" : "status"}
              className={error ? "feedback error" : "feedback"}
            >
              <span>{error || notice}</span>
              <button
                aria-label="Dismiss message"
                onClick={() => {
                  setError("");
                  setNotice("");
                }}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {(view === "board" || view === "saved") && (
            <>
              <div className="page-heading">
                <div>
                  <h1>
                    {view === "board" ? "Opportunities" : "Saved opportunities"}
                  </h1>
                  <p>
                    {view === "board"
                      ? "Hackathons, grants and paid gigs. Refreshed daily."
                      : "Your active saved picks."}
                  </p>
                </div>
                <button
                  className="primary"
                  onClick={() => {
                    setView("advisor");
                    setPrompt(
                      "Give me my daily briefing: choose up to three opportunities worth my time, explain eligibility uncertainties, deadlines, confirmed cash versus other rewards, and a concrete build or application plan for each.",
                    );
                  }}
                >
                  My daily briefing <ArrowUpRight size={16} />
                </button>
              </div>
              <div className="profile-strip">
                <span className="profile-symbol">
                  <SlidersHorizontal size={16} />
                </span>
                <p>
                  {model.profile
                    ? `${profile.skills.join(", ")} · ${profile.hours} hours a week`
                    : "Add your skills and available time."}
                </p>
                <button className="text-button" onClick={activeProfile}>
                  {model.profile ? "Edit profile" : "Set your preferences"}{" "}
                  <ArrowRight size={16} />
                </button>
              </div>
              <section className="board" aria-label="Opportunity catalog">
                <div className="catalog">
                  <div className="catalog-toolbar">
                    <div
                      className="tabs"
                      role="group"
                      aria-label="Opportunity type"
                    >
                      {(["all", "hackathon", "gig", "grant"] as const).map(
                        (k) => (
                          <button
                            key={k}
                            aria-pressed={kind === k}
                            className={kind === k ? "selected" : ""}
                            onClick={() => setKind(k)}
                          >
                            {k === "all"
                              ? "All opportunities"
                              : k === "hackathon"
                                ? "Hackathons"
                                : k === "grant"
                                  ? "Grants"
                                  : "Gigs"}
                          </button>
                        ),
                      )}
                    </div>
                    <details className="suggest-source">
                      <summary>Missing an opportunity?</summary>
                      <form
                        onSubmit={async (event) => {
                          event.preventDefault();
                          if (!model.authenticated) {
                            openLogin();
                            return;
                          }
                          if (!model.submitSource) return;
                          setError("");
                          setNotice("");
                          setSubmittingSource(true);
                          try {
                            setNotice(await model.submitSource(sourceUrl));
                            setSourceUrl("");
                          } catch (error) {
                            setError(
                              error instanceof ConvexError
                                ? String(error.data)
                                : "Could not submit this link. Please try again.",
                            );
                          } finally {
                            setSubmittingSource(false);
                          }
                        }}
                      >
                        <label htmlFor="source-url">
                          Official event or organizer URL
                        </label>
                        <div className="suggest-source-row">
                          <input
                            id="source-url"
                            type="url"
                            required
                            maxLength={2000}
                            placeholder="https://…"
                            value={sourceUrl}
                            onChange={(event) =>
                              setSourceUrl(event.target.value)
                            }
                          />
                          <button
                            className="btn"
                            type="submit"
                            disabled={submittingSource}
                          >
                            {submittingSource ? "Submitting…" : "Submit link"}
                          </button>
                        </div>
                        <small>
                          We verify applications and deadlines before
                          publishing. No X links.
                        </small>
                      </form>
                    </details>
                    <label className="search">
                      <Search size={16} />
                      <input
                        aria-label="Search opportunities"
                        placeholder="Search a skill, title, or organizer"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                      {search && (
                        <button
                          aria-label="Clear search"
                          onClick={() => setSearch("")}
                        >
                          <X size={16} />
                        </button>
                      )}
                    </label>
                    <label className="sort-control">
                      Sort by
                      <select
                        value={sort}
                        onChange={(event) =>
                          setSort(event.target.value as OpportunitySort)
                        }
                      >
                        {model.profile && (
                          <option value="bestFit">Best match for me</option>
                        )}
                        <option value="endingSoon">Ending soonest</option>
                        <option value="endingLast">Most time remaining</option>
                        <option value="prize">
                          Highest listed prize pool (USD)
                        </option>
                        <option value="cash">Highest cash prize (USD)</option>
                        <option value="newest">Recently added</option>
                      </select>
                    </label>
                    {sort === "bestFit" && (
                      <p className="sort-note">
                        Ranked by your saved skills, time, location and goals
                        among loaded opportunities. Load more to compare more.
                      </p>
                    )}
                    {sort === "prize" && (
                      <p className="sort-note">
                        Listed prize pools may include non-cash rewards. This is
                        not a per-person payout.
                      </p>
                    )}
                    {sort === "cash" && (
                      <p className="sort-note">
                        Source-confirmed USD cash pools first. Credits and
                        unconfirmed prize totals are not counted.
                      </p>
                    )}
                    <div className="list-meta">
                      <span>
                        {activeRows.length}{" "}
                        {activeRows.length === 1
                          ? "opportunity"
                          : "opportunities"}
                        {model.more && view === "board" ? " loaded" : ""}
                        {!connected ? " · sample listings" : ""}
                      </span>
                      <label>
                        <input
                          type="checkbox"
                          disabled={!model.profile}
                          checked={onlyFit && !!model.profile}
                          onChange={(e) => setOnlyFit(e.target.checked)}
                        />{" "}
                        No known conflicts
                      </label>
                    </div>
                  </div>
                  {model.list === undefined ? (
                    <div className="empty">
                      <LoaderCircle className="spin" />
                      <h3>Loading opportunities</h3>
                      <p>Fetching the latest catalog.</p>
                    </div>
                  ) : rows.length === 0 ? (
                    <div className="empty">
                      <Search size={16} />
                      <h3>
                        {view === "saved"
                          ? "Your shortlist starts here."
                          : "Nothing here just yet."}
                      </h3>
                      <p>
                        {view === "saved"
                          ? "Save an opportunity from Discover to return to it later."
                          : search
                            ? "Try a different skill or clear your filters."
                            : "New opportunities will appear after the source refresh runs."}
                      </p>
                      <button
                        className="secondary"
                        onClick={() => {
                          setSearch("");
                          setKind("all");
                          setOnlyFit(false);
                          setView("board");
                        }}
                      >
                        Explore opportunities
                      </button>
                    </div>
                  ) : (
                    <div className="opportunity-list">
                      {rows.map((o) => (
                        <article
                          className={`opportunity-row ${item?._id === o._id ? "is-selected" : ""} ${o.departingAt ? "is-departing" : ""}`}
                          key={o._id}
                          inert={!!o.departingAt}
                          aria-hidden={!!o.departingAt}
                        >
                          <button
                            className="row-main"
                            onClick={() => {
                              setSelected(o._id);
                              if (window.innerWidth <= 760)
                                setTimeout(
                                  () =>
                                    document
                                      .querySelector(".detail")
                                      ?.scrollIntoView({
                                        behavior: window.matchMedia(
                                          "(prefers-reduced-motion: reduce)",
                                        ).matches
                                          ? "instant"
                                          : "smooth",
                                        block: "start",
                                      }),
                                  0,
                                );
                            }}
                            aria-pressed={item?._id === o._id}
                          >
                            <span className={`org-mark ${o.kind}`}>
                              {o.organization.slice(0, 1)}
                            </span>
                            <span className="row-copy">
                              <span className="row-top">
                                <span className="type-label">
                                  {o.kind === "hackathon"
                                    ? "Hackathon"
                                    : o.kind === "grant"
                                      ? "Grant"
                                      : "Paid gig"}
                                </span>
                                {o.origin === "example" && (
                                  <span className="sample-label">Sample</span>
                                )}
                              </span>
                              <h2>{o.title}</h2>
                              <span className="organization">
                                {o.organization}
                              </span>
                              {o.deadline !== null && (
                                <span
                                  className={`deadline-countdown ${o.deadline - now < 86400000 ? "deadline-urgent" : ""}`}
                                >
                                  <Clock size={16} />
                                  {deadlineLabel(o.deadline, now)}
                                </span>
                              )}
                              <span className="row-reward">
                                {o.reward || "Prize details not listed"}
                              </span>
                              <span className="cash-prize">{cashLabel(o)}</span>
                              {model.profile && (
                                <span className="match-reason">
                                  {profileFitLabel(o, model.profile, now)}
                                </span>
                              )}
                              <span className="tags">
                                {o.skills.slice(0, 3).map((s) => (
                                  <span key={s}>{s}</span>
                                ))}
                              </span>
                              <span className="row-facts">
                                <span>
                                  <Globe size={16} />
                                  {o.remote ? "Remote" : o.location}
                                </span>
                                {o.hours !== null && (
                                  <span>
                                    <Clock size={16} />
                                    {o.hours} hours estimated effort
                                  </span>
                                )}
                              </span>
                            </span>
                            <ChevronRight className="row-chevron" size={16} />
                          </button>
                          <button
                            className={`save-button ${model.saved.includes(o._id) ? "is-saved" : ""}`}
                            aria-label={`${model.saved.includes(o._id) ? "Unsave" : "Save"} ${o.title}`}
                            aria-pressed={model.saved.includes(o._id)}
                            disabled={busy}
                            title={
                              model.saved.includes(o._id)
                                ? "Remove from saved"
                                : "Save opportunity"
                            }
                            onClick={() =>
                              requireLogin(
                                () => void perform(() => model.toggle(o._id)),
                              )
                            }
                          >
                            <Bookmark
                              size={16}
                              fill={
                                model.saved.includes(o._id)
                                  ? "currentColor"
                                  : "none"
                              }
                            />
                          </button>
                        </article>
                      ))}
                    </div>
                  )}
                  {view !== "saved" && model.more && (
                    <button
                      className="secondary full"
                      disabled={model.more.loading}
                      onClick={model.more.load}
                    >
                      {model.more.loading
                        ? "Loading…"
                        : "Load more opportunities"}
                    </button>
                  )}
                </div>
                <aside className="detail" aria-label="Selected opportunity">
                  {item ? (
                    <>
                      <h2>{item.title}</h2>
                      <p className="detail-org">By {item.organization}</p>
                      <div className="verified-status">
                        <span className="status-dot" />
                        Active ·{" "}
                        {item.deadlineConfirmed
                          ? "deadline confirmed"
                          : "source checked"}
                      </div>
                      {item.deadline !== null && (
                        <div
                          className={`detail-countdown ${item.deadline - now < 86400000 ? "deadline-urgent" : ""}`}
                        >
                          <Clock size={16} />
                          <strong>{deadlineLabel(item.deadline, now)}</strong>
                          <small>
                            Automatically leaves the board when time runs out.
                          </small>
                        </div>
                      )}
                      <p className="description">{item.description}</p>
                      <dl>
                        <div>
                          <dt>Reward</dt>
                          <dd>{item.reward}</dd>
                        </div>
                        <div>
                          <dt>Cash prize pool</dt>
                          <dd>{cashLabel(item)}</dd>
                        </div>
                        <div>
                          <dt>Where</dt>
                          <dd>
                            {item.remote
                              ? "Remote · " + item.location
                              : item.location}
                          </dd>
                        </div>
                        <div>
                          <dt>Deadline</dt>
                          <dd>
                            {item.deadline
                              ? new Date(item.deadline).toLocaleDateString(
                                  undefined,
                                  {
                                    month: "short",
                                    day: "numeric",
                                    hour: "numeric",
                                    minute: "2-digit",
                                    timeZone: "UTC",
                                    timeZoneName: "short",
                                  },
                                )
                              : "Not confirmed"}
                          </dd>
                        </div>
                        <div>
                          <dt>Team</dt>
                          <dd>
                            {item.solo === null
                              ? "Check the rules"
                              : item.solo
                                ? "Solo-friendly"
                                : "Team required"}
                          </dd>
                        </div>
                      </dl>
                      <section className="evidence">
                        <h3>Before you commit</h3>
                        <p>{item.eligibility}</p>
                        {item.evidence && (
                          <blockquote>{item.evidence}</blockquote>
                        )}
                        {item.cashEvidence && (
                          <blockquote>{item.cashEvidence}</blockquote>
                        )}
                        <p className="source-note">
                          {item.origin === "example"
                            ? "Sample listing · not an available opportunity"
                            : `Source checked ${new Date(item.checkedAt).toLocaleDateString()}`}
                        </p>
                      </section>
                      <a
                        className="primary full"
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {item.origin === "example"
                          ? "Explore source website"
                          : "Read the original brief"}{" "}
                        <ExternalLink size={16} />
                      </a>
                      <button
                        className="secondary full"
                        disabled={busy}
                        aria-pressed={model.saved.includes(item._id)}
                        onClick={() =>
                          requireLogin(
                            () => void perform(() => model.toggle(item._id)),
                          )
                        }
                      >
                        <Bookmark size={16} />
                        {model.saved.includes(item._id)
                          ? "Remove from saved"
                          : "Save for later"}
                      </button>
                      {item.deadlineConfirmed && item.deadline !== null && (
                        <button
                          className="secondary full"
                          onClick={() => {
                            try {
                              downloadDeadline(item);
                              setNotice(
                                "Calendar file downloaded. Open it in your calendar to add the deadline.",
                              );
                            } catch {
                              setError(
                                "This deadline is no longer available. Refresh the board and try again.",
                              );
                            }
                          }}
                        >
                          <CalendarPlus size={16} />
                          Add deadline to calendar
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="empty">
                      <Compass size={16} />
                      <h3>A closer look</h3>
                      <p>
                        Select an opportunity to see its requirements and
                        source.
                      </p>
                    </div>
                  )}
                </aside>
              </section>
            </>
          )}
          {view === "profile" && (
            <section className="settings-page">
              <div className="page-heading">
                <div>
                  <h1>Start with you.</h1>
                  <p>A few details make for a much better shortlist.</p>
                </div>
              </div>
              <form
                onInvalidCapture={(e) => {
                  const field = e.target as HTMLInputElement;
                  setInvalidFields((current) => ({
                    ...current,
                    [field.name]: field.validationMessage,
                  }));
                }}
                onInputCapture={(e) => {
                  const field = e.target as HTMLInputElement;
                  setInvalidFields((current) => ({
                    ...current,
                    [field.name]: "",
                  }));
                }}
                onSubmit={(e) => {
                  e.preventDefault();
                  requireLogin(
                    () =>
                      void perform(
                        () => model.save(profile, digest),
                        "Your preferences are saved.",
                      ),
                  );
                }}
              >
                <label data-invalid={!!invalidFields.skills}>
                  Skills you want to use
                  <input
                    name="skills"
                    aria-invalid={!!invalidFields.skills}
                    aria-describedby="skills-help"
                    maxLength={1219}
                    required
                    value={profile.skills.join(", ")}
                    onChange={(e) => {
                      setEditing(true);
                      setDraft({
                        ...profile,
                        skills: e.target.value
                          .split(",")
                          .map((s) => s.trimStart()),
                      });
                    }}
                    placeholder="React, Python, Design"
                  />
                  <small id="skills-help">
                    Separate your skills with commas.
                  </small>
                </label>
                <div className="form-grid">
                  <label data-invalid={!!invalidFields.location}>
                    Where are you based?
                    <input
                      name="location"
                      aria-invalid={!!invalidFields.location}
                      maxLength={100}
                      value={profile.location}
                      onChange={(e) => {
                        setEditing(true);
                        setDraft({ ...profile, location: e.target.value });
                      }}
                      required
                    />
                  </label>
                  <label data-invalid={!!invalidFields.hours}>
                    Hours available each week
                    <input
                      type="number"
                      name="hours"
                      aria-invalid={!!invalidFields.hours}
                      min="1"
                      max="80"
                      value={profile.hours}
                      onChange={(e) => {
                        setEditing(true);
                        setDraft({ ...profile, hours: Number(e.target.value) });
                      }}
                      required
                    />
                  </label>
                </div>
                <label>
                  What matters most?
                  <select
                    value={profile.goal}
                    onChange={(e) => {
                      setEditing(true);
                      setDraft({
                        ...profile,
                        goal: e.target.value as Profile["goal"],
                      });
                    }}
                  >
                    <option value="portfolio">Build my portfolio</option>
                    <option value="earn">Earn from my skills</option>
                    <option value="learn">Learn something new</option>
                  </select>
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={profile.solo}
                    onChange={(e) => {
                      setEditing(true);
                      setDraft({ ...profile, solo: e.target.checked });
                    }}
                  />
                  I prefer opportunities I can take on solo.
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={digest}
                    onChange={(e) => setDigest(e.target.checked)}
                  />
                  Send me a weekly shortlist by email.
                </label>
                <p className="form-note">
                  {model.email ? `Digests go to ${model.email}. ` : ""}You can
                  turn off weekly email here at any time. Recommendations still
                  need your review of the original rules.
                </p>
                {Object.values(invalidFields).some(Boolean) && (
                  <p className="field-error" role="alert">
                    {Object.values(invalidFields).filter(Boolean).join(" ")}
                  </p>
                )}
                <button disabled={busy} aria-busy={busy} className="primary">
                  {busy ? (
                    <LoaderCircle className="spin" size={16} />
                  ) : (
                    <Check size={16} />
                  )}
                  Save preferences
                </button>
              </form>
            </section>
          )}
          {view === "advisor" && (
            <section className="advisor-page">
              <div className="page-heading">
                <div>
                  <h1>A little help choosing.</h1>
                  <p>Your goals, a few good options, and a clear next step.</p>
                </div>
              </div>
              <div className="advisor-intro">
                <Compass size={16} />
                <h2>What do you have in mind?</h2>
                <p>
                  Ask Scout to compare opportunities, work around your schedule,
                  or narrow down what’s worth pursuing.
                </p>
                <div className="suggestions">
                  {[
                    "Compare my best options and explain what I should skip.",
                    "Find grants I may qualify for in my location.",
                    "Give me a weekend build plan for the best matching hackathon.",
                    "Show me small paid React gigs.",
                  ].map((s) => (
                    <button key={s} onClick={() => setPrompt(s)}>
                      {s}
                      <Plus size={16} />
                    </button>
                  ))}
                </div>
              </div>
              {!model.status?.ai && (
                <p className="connection-note">
                  The advisor will be available once OpenAI is connected. You
                  can explore the board in the meantime.
                </p>
              )}
              {!model.profile && (
                <button className="text-button" onClick={activeProfile}>
                  Set your preferences first <ArrowRight size={16} />
                </button>
              )}
              {model.latest && (
                <div className="advisor-answer">
                  <h3>Your latest shortlist</h3>
                  <div className="markdown">
                    <Markdown skipHtml>{model.latest.body}</Markdown>
                  </div>
                  <small>
                    Updated {new Date(model.latest.createdAt).toLocaleString()}
                  </small>
                </div>
              )}
              <form className="composer" onSubmit={submitQuestion}>
                <textarea
                  aria-label="Ask your advisor"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Tell Scout what you’re looking for…"
                  maxLength={1500}
                />
                <button
                  className="primary"
                  aria-busy={busy}
                  aria-label={busy ? "Preparing your shortlist" : "Ask Scout"}
                  disabled={busy || !prompt.trim() || !model.status?.ai}
                >
                  {busy ? (
                    <LoaderCircle className="spin" size={16} />
                  ) : (
                    <ArrowRight size={16} />
                  )}
                  <span>Ask Scout</span>
                </button>
              </form>
              <p className="fine-print">
                Recommendations are based on recorded sources. Check eligibility
                and deadlines before applying.
              </p>
            </section>
          )}
          {view === "digest" && (
            <section className="digest-page">
              <div className="page-heading">
                <div>
                  <h1>Your week, with direction.</h1>
                  <p>A few useful opportunities. Delivered to your inbox.</p>
                </div>
                <button className="secondary" onClick={activeProfile}>
                  Email preferences <SlidersHorizontal size={16} />
                </button>
              </div>
              <div className="digest-layout">
                <div className="letter">
                  <div className="letter-brand">
                    <Compass size={16} />
                    opportunity scout
                  </div>
                  <span className="letter-status">
                    {model.latest ? "Your latest shortlist" : "Digest preview"}
                  </span>
                  <h2>
                    A few things
                    <br />
                    worth your time.
                  </h2>
                  <p>
                    Each week, Scout checks your preferences against current
                    opportunities and explains which ones deserve a closer look.
                  </p>
                  {model.latest ? (
                    <div className="markdown">
                      <Markdown skipHtml>{model.latest.body}</Markdown>
                    </div>
                  ) : (
                    <div className="letter-empty">
                      <Mail size={16} />
                      <p>
                        Your personalized picks will appear here after you save
                        a profile and generate your first shortlist.
                      </p>
                    </div>
                  )}
                  <div className="letter-reply">
                    <strong>Find a good fit? Open the original brief.</strong>
                    <p>
                      Check the rules and deadline, then join through the
                      organizer’s page.
                    </p>
                    <button
                      className="secondary"
                      onClick={() => setView("board")}
                    >
                      Browse opportunities <ArrowUpRight size={16} />
                    </button>
                  </div>
                </div>
                <div className="digest-settings">
                  <h2>
                    Less searching.
                    <br />
                    More doing.
                  </h2>
                  <p>
                    Get a shortlist built around your skills, time, and what you
                    want to do next.
                  </p>
                  <ul>
                    <li>
                      <Check size={16} />
                      Up to three source-backed picks
                    </li>
                    <li>
                      <Check size={16} />
                      Fit, unknowns, and a next step
                    </li>
                    <li>
                      <Check size={16} />
                      Direct links to join or apply
                    </li>
                  </ul>
                  <div className="digest-status">
                    <span className="status-dot" />
                    <span>
                      {model.digestEnabled
                        ? model.status?.email
                          ? "Weekly digest enabled"
                          : "Preference saved · delivery setup pending"
                        : "Weekly digest is off"}
                    </span>
                  </div>
                  <button className="primary full" onClick={activeProfile}>
                    {model.digestEnabled
                      ? "Manage preferences"
                      : "Set up my weekly digest"}
                    <ArrowRight size={16} />
                  </button>
                  <small>
                    {model.status?.email
                      ? "Optional: reply to a digest to narrow your picks. Update your preferences in the app."
                      : "Email delivery needs AgentMail setup."}
                  </small>
                </div>
              </div>
            </section>
          )}
        </div>
      </main>
      {loginOpen && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setLoginOpen(false);
          }}
        >
          <section
            className="auth-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-title"
            aria-describedby="auth-description"
          >
            <button
              className="dialog-close icon-button"
              aria-label="Close sign in"
              onClick={() => setLoginOpen(false)}
            >
              <X size={16} />
            </button>
            <Compass size={16} />
            <h2 id="auth-title">
              {flow === "signIn"
                ? "Welcome back."
                : "Make room for your next thing."}
            </h2>
            <p id="auth-description">
              Save your profile, shortlist, and weekly digest.
            </p>
            {error && (
              <div role="alert" className="feedback error">
                {error}
              </div>
            )}
            {!connected ? (
              <p className="feedback">
                Account access is available once a Convex backend is connected.
              </p>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const data = new FormData(e.currentTarget);
                  data.set("flow", flow);
                  void perform(async () => {
                    await model.login(data);
                    setLoginOpen(false);
                  });
                }}
              >
                <label>
                  Email
                  <input
                    autoFocus
                    type="email"
                    name="email"
                    autoComplete="email"
                    required
                  />
                </label>
                <label>
                  Password
                  <input
                    type="password"
                    name="password"
                    minLength={8}
                    autoComplete={
                      flow === "signIn" ? "current-password" : "new-password"
                    }
                    required
                  />
                </label>
                <button className="primary full" disabled={busy}>
                  {busy
                    ? "One moment…"
                    : flow === "signIn"
                      ? "Sign in"
                      : "Create account"}
                  <ArrowRight size={16} />
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    setFlow(flow === "signIn" ? "signUp" : "signIn")
                  }
                >
                  {flow === "signIn"
                    ? "New here? Create an account"
                    : "Already have an account? Sign in"}
                </button>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
