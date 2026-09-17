import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Bookmark,
  Check,
  Compass,
  Clock,
  Mail,
  ArrowRight,
  Globe,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import "./landing.css";
import { landingCatalog } from "./landingCatalog";
import { isActiveOpportunity } from "./availability";
import { deadlineLabel } from "./deadline";
import type { Opportunity } from "./matching";
const steps = [
  {
    title: "Discover",
    icon: Search,
    heading: "Look beyond the usual boards.",
    text: "Scout searches sponsor sites, community posts, and niche challenges. Only verified active hackathons make the cut.",
    detail: "Original sources · Confirmed deadlines",
  },
  {
    title: "Find your fit",
    icon: SlidersHorizontal,
    heading: "Start with your skills and schedule.",
    text: "Tell Scout what you want to build and how much time you have. Get a shortlist with clear tradeoffs.",
    detail: "Your skills · Your available time",
  },
  {
    title: "Save & start",
    icon: Bookmark,
    heading: "Keep the good ones close.",
    text: "Save your picks, check the original rules, and make your next move. Expired opportunities leave the board automatically.",
    detail: "Live countdowns · Automatic expiry",
  },
];
export default function Landing() {
  const [step, setStep] = useState(0);
  const [opportunities, setOpportunities] = useState<Opportunity[] | null>(
    null,
  );
  const [catalogError, setCatalogError] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    let alive = true;
    landingCatalog()
      .then((items) => {
        if (alive) setOpportunities(items);
      })
      .catch(() => {
        if (alive) setCatalogError(true);
      });
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);
  const open = opportunities?.filter((item) => isActiveOpportunity(item, now));
  const active = steps[step];
  return (
    <div className="landing">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="landing-nav">
        <a
          className="landing-brand"
          href="/"
          aria-label="Opportunity Scout home"
        >
          <Compass size={24} />
          opportunity <strong>scout</strong>
        </a>
        <nav aria-label="Website navigation">
          <a href="#open-now">Open now</a>
          <a href="#how-it-works">How it works</a>
          <a href="/app" className="nav-cta">
            Open Scout <ArrowUpRight size={20} />
          </a>
        </nav>
      </header>
      <main id="main-content">
        <section className="landing-hero">
          <div className="hero-copy">
            <h1>
              Less searching.
              <br />
              More <span>starting.</span>
            </h1>
            <p>
              Find the hackathon worth your weekend.
              <br />
              The paid gig that fits your skills.
              <br />
              And a clear reason to go for it.
            </p>
            <a href="/app" className="landing-cta white">
              Find my next opportunity <ArrowUpRight size={20} />
            </a>
            <a className="hero-text-link" href="#open-now">
              See what’s open <ArrowRight size={20} />
            </a>
            <small className="hero-reassurance">
              Browse freely. Sign in when you find your thing.
            </small>
          </div>
          <div className="hero-visual">
            <img
              src="/images/build-together.webp"
              alt="Illustrative scene of builders collaborating in a sunlit studio"
              width="1400"
              height="934"
              fetchPriority="high"
            />
            <div className="photo-note">
              <Compass size={24} />
              <span>
                Less time looking.
                <br />
                <strong>More time making.</strong>
              </span>
            </div>
            <span className="image-caption">
              For the things you haven’t built yet.
            </span>
          </div>
        </section>
        <div className="landing-principles" aria-label="Scout essentials">
          <span>
            <Check /> Source-checked opportunities
          </span>
          <span>
            <Clock /> Deadlines that stay current
          </span>
          <span>
            <Mail /> An optional weekly shortlist
          </span>
        </div>
        <section className="landing-catalog" id="open-now">
          <div className="section-heading">
            <h2>
              Good things.
              <br />
              <span>Still open.</span>
            </h2>
            <div>
              <p>
                A few finds from the board.
                <br />
                Original sources. Real closing dates.
              </p>
              <a href="/app">
                Explore the full board <ArrowUpRight />
              </a>
            </div>
          </div>
          <div
            className="landing-list"
            aria-live="polite"
            aria-busy={!opportunities && !catalogError}
          >
            {open?.length ? (
              open.slice(0, 3).map((item) => (
                <a
                  className="landing-opportunity"
                  href={`/app?opportunity=${encodeURIComponent(item._id)}`}
                  key={item._id}
                >
                  <span className="opportunity-monogram" aria-hidden="true">
                    {item.organization.slice(0, 1)}
                  </span>
                  <span className="landing-opportunity-title">
                    <small>{item.organization}</small>
                    <h3>{item.title}</h3>
                    <span>{item.skills.slice(0, 2).join(" · ")}</span>
                  </span>
                  <span className="landing-opportunity-place">
                    <Globe />
                    {item.remote ? "Remote" : item.location}
                  </span>
                  <span className="landing-opportunity-deadline">
                    <Clock />
                    {deadlineLabel(item.deadline!, now)}
                  </span>
                  <ArrowUpRight className="opportunity-go" />
                </a>
              ))
            ) : (
              <p className="catalog-message">
                {catalogError
                  ? "The live preview is unavailable. Open the board to try again."
                  : opportunities
                    ? "We’re checking the next opportunities. Explore the board for the latest."
                    : "Checking the current opportunities…"}
              </p>
            )}
          </div>
          <p className="catalog-footnote">
            Checked against the source. Always review the organizer’s
            eligibility rules before entering.
          </p>
        </section>
        <section className="walkthrough" id="how-it-works">
          <div>
            <h2>Find it. Make it yours.</h2>
            <div
              className="walkthrough-steps"
              role="tablist"
              aria-label="How Scout works"
            >
              {steps.map((s, i) => (
                <button
                  key={s.title}
                  role="tab"
                  id={`step-tab-${i}`}
                  aria-selected={step === i}
                  aria-controls="step-panel"
                  tabIndex={step === i ? 0 : -1}
                  className={step === i ? "selected" : ""}
                  onClick={() => setStep(i)}
                  onKeyDown={(e) => {
                    const next =
                      e.key === "ArrowRight"
                        ? (i + 1) % 3
                        : e.key === "ArrowLeft"
                          ? (i + 2) % 3
                          : e.key === "Home"
                            ? 0
                            : e.key === "End"
                              ? 2
                              : null;
                    if (next !== null) {
                      e.preventDefault();
                      setStep(next);
                      document.getElementById(`step-tab-${next}`)?.focus();
                    }
                  }}
                >
                  <s.icon size={20} />
                  {s.title}
                </button>
              ))}
            </div>
          </div>
          <div
            className="step-panel"
            id="step-panel"
            role="tabpanel"
            aria-labelledby={`step-tab-${step}`}
          >
            <div key={step} className="step-content">
              <h3>{active.heading}</h3>
              <p>{active.text}</p>
              <small>{active.detail}</small>
            </div>
          </div>
        </section>
        <section className="weekly-section">
          <div>
            <h2>
              A shortlist.
              <br />
              Not another rabbit hole.
            </h2>
            <p>
              Set your skills, time, and goals once. Scout explains why an
              opportunity belongs on your list—and what you still need to check.
            </p>
            <a className="landing-cta blue" href="/app?view=profile">
              Make Scout yours <ArrowUpRight />
            </a>
          </div>
          <div className="weekly-note">
            <Mail size={32} />
            <h3>Your week, considered.</h3>
            <p>
              Turn on the weekly digest to get your shortlist by email. Open a
              brief, save a deadline, and get building.
            </p>
            <p className="weekly-aside">
              Want a different direction? Reply to refine your picks. Always
              optional.
            </p>
            <a href="/app?view=digest">
              Set up my digest <ArrowRight />
            </a>
          </div>
        </section>
        <section className="human-section">
          <img
            src="/images/solo-builder.webp"
            alt="Illustrative scene of an independent builder working beside a window"
            width="1000"
            height="1250"
            loading="lazy"
          />
          <div>
            <h2>
              Your next chapter
              <br />
              can start today.
            </h2>
            <a href="/app" className="landing-cta blue">
              See what’s open <ArrowUpRight size={20} />
            </a>
          </div>
        </section>
      </main>
      <footer className="landing-footer">
        <span>
          <Compass size={24} />
          opportunity scout
        </span>
        <span>Browse without signing in.</span>
      </footer>
    </div>
  );
}
