import { createFileRoute, Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { LogoMark } from "@/components/LogoMark";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import carePhoto from "@/assets/care-background.jpg";
import visitPhoto from "@/assets/provider-appointment.jpg";
export const Route = createFileRoute("/")({
 head: () => ({meta: [
 {title: "Log Companion — Your health, clearly told"},
 {name: "description", content: "Capture your health story and share organized health logs with your care team."},
 {property: "og:title", content: "Log Companion — Your health, clearly told"},
 {property: "og:description", content: "Private health logs for patients and the providers they choose."},
 {property: "og:type", content: "website"}, {name: "twitter:card", content: "summary_large_image"}
 ]}), component: Index,
});
function PatientIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 17a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" />
      <path d="M5 28c1.7-5.4 5.4-8 11-8s9.3 2.6 11 8" />
    </svg>
  );
}

function ProviderIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M11 5v8a5 5 0 0 0 10 0V5" />
      <path d="M8 5h6M18 5h6M16 18v2a7 7 0 0 0 14 0v-2" />
      <circle cx="28" cy="15" r="2" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 10h12M11 5l5 5-5 5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="m4 10 4 4 8-9" />
    </svg>
  );
}

function Index() {
  const { user } = useAuth();
  return (
    <div className="source-home app-shell">

      <AppHeader />

      <section className="welcome" aria-labelledby="welcome-title">
        <div className="eyebrow">
          <span />
          Your health, clearly told
        </div>
        <h1 id="welcome-title">
          Welcome to <span>Log Companion.</span>
        </h1>
        <p className="intro">
          Turn how you’ve been feeling into a clear, organized health story.
          Choose how you’ll use Log Companion today.
        </p>

        <div className="role-grid" aria-label="Choose your experience">
          <Button asChild variant="ghost" className="role-card role-card--patient">
            <Link to={user ? "/dashboard" : "/auth"} search={user ? {} : { mode: "signup", type: "patient" }}>

            <span className="card-number">01</span>
            <span className="icon-wrap">
              <PatientIcon />
            </span>
            <span className="card-label">For patients</span>
            <strong>Track my health</strong>
            <span className="card-copy">
              Log symptoms, spot patterns, and prepare for your next
              appointment.
            </span>
            <span className="card-action">
              Continue as a patient <ArrowIcon />
            </span>
            </Link>
          </Button>

          <Button asChild variant="ghost" className="role-card role-card--provider">
            <Link to={user ? "/dashboard" : "/auth"} search={user ? {} : { mode: "signup", type: "provider" }}>

            <span className="card-number">02</span>
            <span className="icon-wrap">
              <ProviderIcon />
            </span>
            <span className="card-label">For providers</span>
            <strong>Review a health log</strong>
            <span className="card-copy">
              Open a patient’s shared summary and get the full picture,
              quickly.
            </span>
            <span className="card-action">
              Continue as a provider <ArrowIcon />
            </span>
            </Link>
          </Button>
        </div>

        <p className="privacy-note">
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <rect x="4" y="8" width="12" height="9" rx="2" />
            <path d="M7 8V6a3 3 0 0 1 6 0v2" />
          </svg>
          Private by design. Your health information stays yours.
        </p>
      </section>

      <section className="product-story" id="how-it-works">
        <div className="story-heading">
          <div className="eyebrow">
            <span />
            From feeling to a useful health record
          </div>
          <h2>Four simple steps. One clearer conversation.</h2>
          <p>
            Log Companion helps you capture what’s happening in the moment,
            then turns it into something both you and your care team can use.
          </p>
        </div>

        <article className="feature-section feature-section--photo">
          <div className="feature-copy">
            <span className="feature-index">01 / Talk it through</span>
            <h3>Start with what’s on your mind.</h3>
            <p>
              Describe how you feel in your own words and organize your notes into a health log.
              AI-guided follow-up questions are coming soon.
            </p>
            <ul>
              <li>
                <CheckIcon /> Conversational, not clinical
              </li>
              <li>
                <CheckIcon /> Available whenever symptoms happen
              </li>
            </ul>
          </div>
          <div className="photo-preview">
            <img
              src={carePhoto}
              alt="A nurse speaking warmly with a patient at home"
            />
            <div className="chat-window">
              <div className="chat-header">
                <LogoMark compact />
                <span>AI preview · coming soon</span>
              </div>
              <div className="message message--agent">
                When did the headache first start?
              </div>
              <div className="message message--user">
                Yesterday afternoon, after lunch.
              </div>
              <div className="message message--agent">
                Has anything made it feel better or worse?
              </div>
              <div className="typing" aria-label="AI is typing">
                <i />
                <i />
                <i />
              </div>
            </div>
          </div>
        </article>

        <article className="feature-section feature-section--reverse">
          <div className="feature-copy">
            <span className="feature-index">02 / Capture the details</span>
            <h3>Your symptoms, organized in one clear record.</h3>
            <p>
              Your notes become a structured draft,
              preserving timing, severity, triggers, and the details your
              provider will want to know.
            </p>
            <div className="feature-stat">
              <strong>Less remembering.</strong>
              <span>More accurate details at your appointment.</span>
            </div>
          </div>
          <div className="app-preview symptom-preview">
            <div className="app-topbar">
              <span className="mini-logo">LC</span>{" "}
              <span>New log entry</span>{" "}
              <span className="status-pill">Example</span>
            </div>
            <div className="entry-date">
              <span className="calendar-day">14</span>
              <span>
                <strong>Tuesday, May 14</strong>{" "}
                <small>2:35 PM</small>
              </span>
            </div>
            <div className="symptom-card">
              <div className="symptom-title">
                <span>Headache</span>{" "}
                <b>Moderate</b>
              </div>
              <div className="detail-grid">
                <span>
                  <small>Started</small>
                  Yesterday, 1:30 PM
                </span>
                <span>
                  <small>Location</small>
                  Behind left eye
                </span>
                <span>
                  <small>Feels like</small>
                  Dull, steady pressure
                </span>
                <span>
                  <small>Possible trigger</small>
                  After lunch
                </span>
              </div>
              <div className="symptom-note">
                “Resting in a dark room helped after about 20 minutes.”
              </div>
            </div>
          </div>
        </article>

        <article className="feature-section feature-section--share">
          <div className="feature-copy">
            <span className="feature-index">03 / Share ahead</span>
            <h3>Give your provider context before you walk in.</h3>
            <p>
              Send a secure, easy-to-read summary before your appointment.
              Your clinician can arrive informed, leaving more time to discuss
              what comes next.
            </p>
            <Button asChild variant="link" className="text-link"><Link to={user ? "/dashboard" : "/auth"} search={user ? {} : {mode: "signup", type: "patient"}}>Start your health story <ArrowIcon /></Link></Button>
          </div>
          <div className="share-photo">
            <img
              src={visitPhoto}
              alt="A patient discussing her health with a clinician during an appointment"
            />
            <div className="share-card">
              <span className="share-icon">
                <CheckIcon />
              </span>
              <div>
                <strong>Health summary shared</strong>{" "}
                <span>Example · shared only with your chosen provider</span>
              </div>
            </div>
          </div>
        </article>

        <article className="feature-section feature-section--reverse">
          <div className="feature-copy">
            <span className="feature-index">04 / See the full picture</span>
            <h3>All your health logs in one place.</h3>
            <p>
              Review your saved health history and return to any entry whenever you need it.
            </p>
            <ul>
              <li>
                <CheckIcon /> Chronological health history
              </li>
              <li>
                <CheckIcon /> Easy-to-read records for appointments
              </li>
            </ul>
          </div>
          <div className="app-preview dashboard-preview">
            <div className="dashboard-head">
              <div>
                <small>Your health log</small>{" "}
                <strong>Good afternoon, Jamie</strong>
              </div>
              <Button variant="lilac" size="sm" className="preview-new-entry disabled:opacity-100 disabled:cursor-default" disabled aria-hidden="true" tabIndex={-1}>+ New entry</Button>
            </div>
            <div className="summary-row">
              <div>
                <small>Entries this month</small>{" "}
                <strong>8</strong>{" "}
                <span>3 symptoms tracked</span>
              </div>
              <div className="trend-card">
                <span>Headache frequency</span>{" "}<b>Trending down</b>
                <div className="bar-chart" role="img" aria-label="Example headache frequency decreasing across six periods">
                  <i /><i /><i /><i /><i /><i />
                </div>
              </div>
            </div>
            <div className="log-list">
              <div className="log-list-head">
                <strong>Recent entries</strong>{" "}
                <Button asChild variant="link" size="sm" className="preview-view-all"><Link to={user ? "/dashboard" : "/auth"}>View all</Link></Button>
              </div>
              {[
                ["14", "Headache", "Moderate · 2:35 PM"],
                ["10", "Low energy", "Mild · 9:10 AM"],
                ["06", "Headache", "Mild · 4:45 PM"],
              ].map(([day, title, detail]) => (
                <div className="log-row" key={day}>
                  <span className="log-day">{day}{" "}<small>May</small></span>
                  <span>
                    <strong>{title}</strong>{" "}
                    <small>{detail}</small>
                  </span>
                  <b>›</b>
                </div>
              ))}
            </div>
          </div>
        </article>
      </section>

      <section className="closing-cta">
        <div>
          <span className="feature-index">Start your health story</span>
          <h2>Walk into your next appointment prepared.</h2>
          <p>
            Your companion is ready when you are. Start a private health log in
            just a few minutes.
          </p>
          <Button asChild variant="outline"><Link to={user ? "/dashboard" : "/auth"} search={user ? {} : {mode: "signup", type: "patient"}}>{user ? "Open your workspace" : "Get started as a patient"} <ArrowIcon /></Link></Button>
        </div>
        <LogoMark />
      </section>

      <footer id="help">
        <span>© 2026 Log Companion</span>
        <span>Private logs. Shared on your terms.</span>
      </footer>
    </div>
  );
}
