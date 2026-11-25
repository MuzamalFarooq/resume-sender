import {
  ArrowDown,
  ArrowRight,
  Check,
  FileText,
  LockKeyhole,
  Mail,
  Sparkles,
  Users,
} from "lucide-react";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import "./welcome.css";
const features = [

  {
    icon: Users,
    title: "Recruiter management",
    description: "Keep names, roles, companies, and contact details organized in one private list.",
  },
  {
    icon: Mail,
    title: "Reusable email templates",
    description: "Write outreach drafts once, personalize them with placeholders, and preview before use.",
  },
  {
    icon: FileText,
    title: "A private resume library",
    description: "Upload and manage your resumes, choose a default, and access secure previews or downloads.",
  },
  {
    icon: Sparkles,
    title: "A clear workspace overview",
    description: "See your recruiter, template, and resume totals at a glance while you plan your next steps.",
  },
  {
    icon: ArrowRight,
    title: "An organized workflow",
    description: "Bring contacts, outreach drafts, and resume files together in one focused workspace.",
  },
  {
    icon: LockKeyhole,
    title: "Your own protected account",
    description: "Sign in with Google and keep workspace records scoped to your account.",
  },
];

export default async function WelcomePage() {
  const session = await getServerSession(authOptions);
  const isAuthenticated = Boolean(session?.user?.id);
  const workspaceHref = isAuthenticated ? "/dashboard" : "/sign-in";

  return (
    <main className="welcome-page">
      <header className="welcome-header">
        <div className="welcome-header-inner">
          <Link className="welcome-brand" href="/" aria-label="ResumeSender home">
            <span className="welcome-brand-mark"><Sparkles size={18} /></span>
            <span>resume<span>sender</span></span>
          </Link>
          <nav className="welcome-nav" aria-label="Main navigation">
            <Link className="welcome-home-link" href="/">Home</Link>
            <a className="welcome-features-link" href="#features">Features</a>
            <a className="welcome-how-link" href="#how-it-works">How it works</a>
          </nav>
          <div className="welcome-auth-nav">
            <Link className="welcome-login" href={isAuthenticated ? "/dashboard" : "/sign-in"}>
              {isAuthenticated ? "Dashboard" : "Login"}
            </Link>
            <Link className="welcome-nav-cta" href={workspaceHref}>
              {isAuthenticated ? "Open dashboard" : "Get started"}
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </header>

      <section className="welcome-hero">
        <div className="welcome-hero-inner">
          <div className="welcome-hero-copy">
            <span className="welcome-eyebrow"><span /> YOUR JOB SEARCH, IN ONE PLACE</span>
            <h1>Send Your Resume to Recruiters. <span>Faster. Smarter.</span></h1>
            <p className="welcome-lead">
              Organize recruiter contacts, prepare thoughtful email templates, and keep your resume
              ready to share—all from one calm, focused workspace.
            </p>
            <div className="welcome-hero-actions">
              <Link className="welcome-primary-button" href={workspaceHref}>
                {isAuthenticated ? "Go to your dashboard" : "Get Started Free"}
                <ArrowRight size={17} />
              </Link>
              <a className="welcome-secondary-button" href="#features">
                Explore Features <ArrowDown size={16} />
              </a>
            </div>
            <div className="welcome-proof">
              <span><Check size={14} /> Private workspace</span>
              <span><Check size={14} /> Simple to get started</span>
            </div>
          </div>

          <div className="preview-scene" aria-label="Illustrative mockup of the ResumeSender workspace">
            <div className="preview-glow" />
            <div className="workflow-note"><span className="workflow-note-icon"><Check size={14} /></span><span><strong>One step at a time</strong><small>Your outreach, organized</small></span></div>
            <div className="dashboard-preview">
              <div className="preview-topbar">
                <div className="preview-brand"><span><Sparkles size={13} /></span> resume<span>sender</span></div>
                <span className="preview-account"><i /> Private workspace</span>
              </div>
              <div className="preview-content">
                <div className="preview-greeting"><div><small>EXAMPLE WORKSPACE</small><h2>Your search, in one place.</h2><p>Keep recruiter contacts and outreach templates together.</p></div><span className="preview-avatar">AM</span></div>
                <div className="preview-stats">
                  <div><small>Recruiters</small><strong>12</strong><span>Contacts organized</span></div>
                  <div><small>Email templates</small><strong>3</strong><span>Ready to personalize</span></div>
                  <div><small>Resume</small><strong>Ready</strong><span>Private library</span></div>
                </div>
                <div className="preview-lower">
                  <div className="preview-panel">
                    <div className="preview-panel-heading"><span><strong>Recent contacts</strong><small>Your recruiter list</small></span><Users size={16} /></div>
                    <div className="preview-person"><span className="preview-person-avatar avatar-lilac">JM</span><span><strong>Jordan Miller</strong><small>Northstar · Talent</small></span><i /></div>
                    <div className="preview-person"><span className="preview-person-avatar avatar-blue">SK</span><span><strong>Sam Kim</strong><small>Studio Works · Recruiter</small></span><i /></div>
                    <div className="preview-person"><span className="preview-person-avatar avatar-green">AR</span><span><strong>Alex Rivera</strong><small>Fieldstone · People</small></span><i /></div>
                  </div>
                  <div className="preview-panel preview-steps">
                    <div className="preview-panel-heading"><span><strong>Getting started</strong><small>Your next steps</small></span><Sparkles size={16} /></div>
                    <div className="preview-step"><span className="step-check"><Check size={11} /></span><span>Add recruiter</span><ArrowRight size={13} /></div>
                    <div className="preview-step"><span className="step-check"><Check size={11} /></span><span>Create template</span><ArrowRight size={13} /></div>
                    <div className="preview-step"><span className="step-empty" /><span>Add your resume</span><ArrowRight size={13} /></div>
                    <div className="preview-only-note"><LockKeyhole size={12} /> Email delivery isn’t enabled yet</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="preview-floating-card"><span className="floating-mail"><Mail size={16} /></span><span><strong>Thoughtful outreach</strong><small>Drafts you can personalize</small></span><span className="floating-sparkle"><Sparkles size={14} /></span></div>
          </div>
        </div>
        <div className="hero-bottom-line"><span>MADE FOR THE MOMENT BETWEEN APPLYING AND WHAT’S NEXT</span><span>CONTACTS <i /> TEMPLATES <i /> RESUMES</span></div>
      </section>

      <section className="welcome-section feature-section" id="features">
        <div className="section-heading">
          <span className="welcome-eyebrow">A BETTER WAY TO STAY READY</span>
          <h2>Everything you need to stay organized.<br /><span>Nothing you don’t.</span></h2>
          <p>Spend less energy keeping track of the details, and more on the conversations that move your search forward.</p>
        </div>
        <div className="feature-grid">
          {features.map(({ icon: Icon, title, description }, index) => (
            <article className="feature-card" key={title}>
              <span className={`feature-icon feature-icon-${index}`}><Icon size={19} strokeWidth={1.8} /></span>
              <h3>{title}</h3>
              <p>{description}</p>
              {index === 2 && <span className="feature-caption">Private uploads · Secure links</span>}
            </article>
          ))}
        </div>
        <p className="feature-disclaimer">Email templates are for drafting and preview. Sending emails and campaign automation are not enabled yet.</p>
      </section>

      <section className="welcome-section process-section" id="how-it-works">
        <div className="process-intro">
          <span className="welcome-eyebrow">A SIMPLE PLACE TO BEGIN</span>
          <h2>Three steps.<br /><span>A little more focus.</span></h2>
          <p>Set up your space once, then keep the pieces of your outreach close at hand.</p>
          <Link className="text-link" href={workspaceHref}>{isAuthenticated ? "Return to your workspace" : "Create your workspace"} <ArrowRight size={16} /></Link>
        </div>
        <div className="process-list">
          <article className="process-step"><span className="process-number">01</span><div><h3>Create your account</h3><p>Sign in securely with Google to open your private workspace.</p></div><span className="process-step-icon"><LockKeyhole size={18} /></span></article>
          <article className="process-step"><span className="process-number">02</span><div><h3>Add recruiters and prepare templates</h3><p>Organize your contacts and draft reusable, personalized outreach.</p></div><span className="process-step-icon"><Users size={18} /></span></article>
          <article className="process-step"><span className="process-number">03</span><div><h3>Keep your resume ready</h3><p>Manage your resume files and use your dashboard to stay on top of next steps.</p></div><span className="process-step-icon"><FileText size={18} /></span></article>
        </div>
      </section>

      <section className="benefit-band">
        <div className="benefit-inner">
          <div className="benefit-mark"><Sparkles size={22} /></div>
          <div><span className="welcome-eyebrow">MAKE ROOM FOR THE IMPORTANT PART</span><h2>A more thoughtful job search<br />starts with a little less juggling.</h2></div>
          <p>Contacts here. Templates there. Your resume somewhere else. Bring the essentials together and make each next step feel manageable.</p>
        </div>
      </section>

      <section className="welcome-cta">
        <div className="cta-orb cta-orb-one" /><div className="cta-orb cta-orb-two" />
        <span className="welcome-eyebrow">YOUR NEXT STEP CAN BE A SMALL ONE</span>
        <h2>Make your next outreach<br />feel a little more like you.</h2>
        <p>Build a workspace that helps you show up prepared—one contact and one thoughtful draft at a time.</p>
        <Link className="cta-button" href={workspaceHref}>{isAuthenticated ? "Open your dashboard" : "Get Started Free"} <ArrowRight size={17} /></Link>
        <small>Secure Google sign-in · Your own private workspace</small>
      </section>

      <footer className="welcome-footer">
        <div className="welcome-footer-main">
          <Link className="welcome-brand" href="/" aria-label="ResumeSender home">
            <span className="welcome-brand-mark"><Sparkles size={17} /></span>
            <span>resume<span>sender</span></span>
          </Link>
          <p>A calmer home for your job-search essentials.</p>
          <nav aria-label="Footer navigation">
            <a href="#features">Features</a>
            <a href="#how-it-works">How it works</a>
            <Link href={workspaceHref}>{isAuthenticated ? "Dashboard" : "Login"}</Link>
          </nav>
        </div>
        <div className="welcome-footer-bottom"><span>© {new Date().getFullYear()} ResumeSender</span><span>Organize your search. Keep moving forward.</span></div>
      </footer>
    </main>
  );
}
