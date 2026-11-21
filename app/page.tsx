"use client";

import {
  ArrowDownUp,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  CircleHelp,
  FileText,
  LayoutDashboard,
  LockKeyhole,
  Mail,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { getSession, signOut } from "next-auth/react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/client-api";
import ResumeManager from "@/app/components/resume-manager";

type Recruiter = {
  id: string;
  name: string;
  email: string;
  company: string;
  jobTitle: string;
  createdAt: string;
};

type Template = {
  id: string;
  name: string;
  subject: string;
  body: string;
};

type DashboardStats = {
  recruiters: number;
  templates: number;
  resumes: number;
  connectedGmailAccounts: number;
  campaigns: number;
};

type LegacyData = {
  recruiters: Recruiter[];
  templates: Template[];
};

type Section = "Overview" | "Recruiters" | "Email templates" | "Resume library";

const navItems: { label: Section; icon: typeof LayoutDashboard }[] = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Recruiters", icon: Users },
  { label: "Email templates", icon: Mail },
  { label: "Resume library", icon: FileText },
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function readLegacyData(): LegacyData | null {
  const recruitersValue = window.localStorage.getItem("resume-sender-recruiters");
  const templatesValue = window.localStorage.getItem("resume-sender-templates");
  const recruiters = recruitersValue ? JSON.parse(recruitersValue) : [];
  const templates = templatesValue ? JSON.parse(templatesValue) : [];

  if (!Array.isArray(recruiters) || !Array.isArray(templates)) {
    throw new Error("The saved browser data has an unexpected format.");
  }

  return recruiters.length || templates.length ? { recruiters, templates } : null;
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function renderTemplate(text: string, recruiterName: string, company: string, userName: string) {
  return text
    .replaceAll("{{recruiter_name}}", recruiterName || "Recruiter")
    .replaceAll("{{company_name}}", company || "your company")
    .replaceAll("{{job_title}}", "Software Engineer")
    .replaceAll("{{your_name}}", userName || "Your name");
}

export default function Home() {
  const [section, setSection] = useState<Section>("Overview");
  const [recruiters, setRecruiters] = useState<Recruiter[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    recruiters: 0,
    templates: 0,
    resumes: 0,
    connectedGmailAccounts: 0,
    campaigns: 0,
  });
  const [ready, setReady] = useState(false);
  const [authState, setAuthState] = useState<"checking" | "authenticated" | "unauthenticated">("checking");
  const [initialError, setInitialError] = useState("");
  const [accountName, setAccountName] = useState("My account");
  const [legacyData, setLegacyData] = useState<LegacyData | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showRecruiterForm, setShowRecruiterForm] = useState(false);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const updateResumeCount = useCallback((count: number) => {
    setStats((current) => ({ ...current, resumes: count }));
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        const session = await getSession();
        if (cancelled) return;
        if (!session?.user?.id) {
          setAuthState("unauthenticated");
          return;
        }

        setAuthState("authenticated");
        setAccountName(session.user.name || session.user.email || "My account");

        const [recruiterData, templateData, dashboardStats] = await Promise.all([
          apiRequest<{ recruiters: Recruiter[] }>("/api/recruiters"),
          apiRequest<{ templates: Template[] }>("/api/templates"),
          apiRequest<DashboardStats>("/api/dashboard/stats"),
        ]);
        if (cancelled) return;

        setRecruiters(recruiterData.recruiters);
        setTemplates(templateData.templates);
        setStats(dashboardStats);
        try {
          setLegacyData(readLegacyData());
        } catch {
          setNotice("Saved browser data could not be read. Your account data is unaffected.");
        }
      } catch (error) {
        if (!cancelled) {
          setInitialError(error instanceof Error ? error.message : "Could not load your workspace.");
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    void initialize();
    return () => {
      cancelled = true;
    };
  }, []);

  async function reloadWorkspace() {
    const [recruiterData, templateData, dashboardStats] = await Promise.all([
      apiRequest<{ recruiters: Recruiter[] }>("/api/recruiters"),
      apiRequest<{ templates: Template[] }>("/api/templates"),
      apiRequest<DashboardStats>("/api/dashboard/stats"),
    ]);
    setRecruiters(recruiterData.recruiters);
    setTemplates(templateData.templates);
    setStats(dashboardStats);
  }

  const filteredRecruiters = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return recruiters;
    return recruiters.filter((person) =>
      [person.name, person.email, person.company, person.jobTitle]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [recruiters, search]);

  const activeTemplate = templates.find((template) => template.id === previewId);
  const completedSetup = Number(stats.recruiters > 0) + Number(stats.templates > 0);

  function showMessage(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3200);
  }

  async function addRecruiter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const company = String(formData.get("company") ?? "").trim();
    const jobTitle = String(formData.get("jobTitle") ?? "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showMessage("Enter a valid email address.");
      return;
    }
    if (recruiters.some((person) => person.email.toLowerCase() === email)) {
      showMessage("That email address is already in your contacts.");
      return;
    }
    setIsSaving(true);
    try {
      const { recruiter } = await apiRequest<{ recruiter: Recruiter }>("/api/recruiters", {
        method: "POST",
        body: JSON.stringify({ name, email, company, jobTitle }),
      });
      setRecruiters((current) => [recruiter, ...current]);
      setStats((current) => ({ ...current, recruiters: current.recruiters + 1 }));
      setShowRecruiterForm(false);
      form.reset();
      showMessage("Recruiter added.");
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Could not add this recruiter.");
    } finally {
      setIsSaving(false);
    }
  }

  async function addTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const input = {
      name: String(formData.get("name") ?? "").trim(),
      subject: String(formData.get("subject") ?? "").trim(),
      body: String(formData.get("body") ?? "").trim(),
    };
    if (!input.name || !input.subject || !input.body) {
      showMessage("Complete all template fields before saving.");
      return;
    }
    setIsSaving(true);
    try {
      const { template } = await apiRequest<{ template: Template }>("/api/templates", {
        method: "POST",
        body: JSON.stringify(input),
      });
      setTemplates((current) => [template, ...current]);
      setStats((current) => ({ ...current, templates: current.templates + 1 }));
      setShowTemplateForm(false);
      form.reset();
      showMessage("Template saved to your account.");
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Could not save this template.");
    } finally {
      setIsSaving(false);
    }
  }

  function exportRecruiters() {
    const rows = [
      ["name", "email", "company", "jobTitle"],
      ...filteredRecruiters.map(({ name, email, company, jobTitle }) => [name, email, company, jobTitle]),
    ];
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "recruiters.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function removeRecruiter(person: Recruiter) {
    if (!window.confirm(`Remove ${person.name} from your contacts?`)) return;
    try {
      await apiRequest<{ deleted: boolean }>(`/api/recruiters/${encodeURIComponent(person.id)}`, {
        method: "DELETE",
      });
      setRecruiters((current) => current.filter((entry) => entry.id !== person.id));
      setStats((current) => ({ ...current, recruiters: Math.max(0, current.recruiters - 1) }));
      showMessage("Recruiter removed.");
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Could not remove this recruiter.");
    }
  }

  async function removeTemplate(template: Template) {
    if (!window.confirm(`Delete the "${template.name}" template?`)) return;
    try {
      await apiRequest<{ deleted: boolean }>(`/api/templates/${encodeURIComponent(template.id)}`, {
        method: "DELETE",
      });
      setTemplates((current) => current.filter((entry) => entry.id !== template.id));
      setStats((current) => ({ ...current, templates: Math.max(0, current.templates - 1) }));
      showMessage("Template deleted.");
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Could not delete this template.");
    }
  }

  async function importLegacyData() {
    if (!legacyData) return;
    setIsMigrating(true);
    try {
      const [recruiterResult, templateResult] = await Promise.all([
        apiRequest<{ imported: number; skipped: number }>("/api/recruiters/import", {
          method: "POST",
          body: JSON.stringify({
            recruiters: legacyData.recruiters.map(({ name, email, company, jobTitle }) => ({
              name,
              email,
              company,
              jobTitle,
            })),
          }),
        }),
        apiRequest<{ imported: number; skipped: number }>("/api/templates/import", {
          method: "POST",
          body: JSON.stringify({
            templates: legacyData.templates.map(({ name, subject, body }) => ({
              name,
              subject,
              body,
            })),
          }),
        }),
      ]);
      await reloadWorkspace();
      window.localStorage.removeItem("resume-sender-recruiters");
      window.localStorage.removeItem("resume-sender-templates");
      setLegacyData(null);
      showMessage(
        `Imported ${recruiterResult.imported} contacts and ${templateResult.imported} templates; duplicates skipped.`,
      );
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Could not import the saved browser data.");
    } finally {
      setIsMigrating(false);
    }
  }

  function importRecruiters(event: FormEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const lines = String(reader.result ?? "").split(/\r?\n/).filter(Boolean);
      const parsed = lines.slice(1).map((line) => {
        const values = line.match(/("(?:[^"]|"")*"|[^,]*)(?:,|$)/g) ?? [];
        return values.map((value) => value.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"'));
      });
      const seen = new Set(recruiters.map((person) => person.email.toLowerCase()));
      const accepted: Recruiter[] = [];
      let rejected = 0;
      for (const [name = "", emailValue = "", company = "", jobTitle = ""] of parsed) {
        const email = emailValue.trim().toLowerCase();
        if (!name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || seen.has(email)) {
          rejected += 1;
          continue;
        }
        seen.add(email);
        accepted.push({
          id: crypto.randomUUID(),
          name: name.trim(),
          email,
          company: company.trim(),
          jobTitle: jobTitle.trim(),
          createdAt: new Date().toISOString(),
        });
      }
      setIsSaving(true);
      try {
        const result = await apiRequest<{ imported: number; skipped: number }>("/api/recruiters/import", {
          method: "POST",
          body: JSON.stringify({
            recruiters: accepted.map(({ name, email, company, jobTitle }) => ({
              name,
              email,
              company,
              jobTitle,
            })),
          }),
        });
        await reloadWorkspace();
        const skipped = rejected + result.skipped;
        showMessage(`${result.imported} imported${skipped ? `; ${skipped} skipped (invalid or duplicate)` : ""}.`);
      } catch (error) {
        showMessage(error instanceof Error ? error.message : "Could not import this CSV file.");
      } finally {
        setIsSaving(false);
      }
    };
    reader.onerror = () => showMessage("Unable to read this CSV file.");
    reader.readAsText(file);
    event.currentTarget.value = "";
  }

  if (!ready || initialError) {
    return (
      <main className="app-shell page-state">
        <section className="page-state-card" role={initialError ? "alert" : "status"}>
          <h1>{initialError ? "Workspace unavailable" : "Loading your workspace"}</h1>
          <p>{initialError || "Checking your sign-in and loading your account data…"}</p>
          {initialError && <button className="button-primary" onClick={() => window.location.reload()}>Try again</button>}
        </section>
      </main>
    );
  }

  if (authState === "unauthenticated") {
    return (
      <main className="app-shell page-state">
        <section className="page-state-card">
          <h1>Sign in to your workspace</h1>
          <p>Your recruiter contacts and templates are private to your account.</p>
          <Link className="button-primary" href="/sign-in">Continue to sign in <ArrowRight size={16} /></Link>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? "sidebar-open" : ""}`}>
        <a className="brand" href="#" onClick={() => setSection("Overview")}>
          <span className="brand-mark"><Sparkles size={19} strokeWidth={2.2} /></span>
          <span>resume<span className="brand-light">sender</span></span>
        </a>
        <div className="workspace-switcher">
          <span className="workspace-avatar">{initials(accountName).slice(0, 1)}</span>
          <span className="workspace-copy"><strong>My workspace</strong><small>Private account</small></span>
          <ChevronDown size={15} />
        </div>
        <div className="nav-label">Workspace</div>
        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map(({ label, icon: Icon }) => (
            <button
              className={`nav-item ${section === label ? "nav-active" : ""}`}
              key={label}
              onClick={() => { setSection(label); setMobileNavOpen(false); }}
            >
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
              {label === "Recruiters" && recruiters.length > 0 && <span className="nav-count">{recruiters.length}</span>}
              {label === "Resume library" && stats.resumes > 0 && <span className="nav-count">{stats.resumes}</span>}
            </button>
          ))}
        </nav>
        <div className="nav-label tools-label">Tools</div>
        <div className="locked-nav">
          <BriefcaseBusiness size={18} strokeWidth={1.8} /><span>Applications</span>
        </div>
        <div className="locked-nav">
          <Mail size={18} strokeWidth={1.8} /><span>Campaigns</span>
        </div>
        <div className="sidebar-bottom">
          <div className="help-card">
            <span className="help-icon"><CircleHelp size={17} /></span>
            <strong>Need a hand?</strong>
            <p>Your workspace guide is coming soon.</p>
            <button onClick={() => showMessage("Workspace guide is not available yet.")}>Explore help <ArrowRight size={14} /></button>
          </div>
          <button className="profile-button" aria-label={`Sign out ${accountName}`} onClick={() => void signOut({ callbackUrl: "/sign-in" })}>
            <span className="profile-avatar">{initials(accountName)}</span>
            <span className="profile-copy"><strong>{accountName}</strong><small>Sign out</small></span>
            <MoreHorizontal size={18} />
          </button>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <button className="mobile-menu icon-button" aria-label="Open menu" onClick={() => setMobileNavOpen((value) => !value)}><Menu size={20} /></button>
          <div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><strong>{section}</strong></div>
          <div className="topbar-right">
            <span className="local-badge">Private workspace</span>
            <button className="icon-button settings-button" aria-label="Settings" onClick={() => showMessage("Workspace settings are coming soon.")}><Settings2 size={18} /></button>
            <button className="avatar-button" aria-label={`Signed in as ${accountName}`}>{initials(accountName)}</button>
          </div>
        </header>

        <div className="content">
          {legacyData && <section className="migration-banner" aria-label="Import saved browser data">
            <div><strong>Saved browser data found</strong><p>Import {legacyData.recruiters.length} contacts and {legacyData.templates.length} templates into your account. Existing records will be skipped.</p></div>
            <button className="button-primary small-button" disabled={isMigrating} onClick={() => void importLegacyData()}>
              {isMigrating ? "Importing…" : "Import data"}
            </button>
          </section>}
          {section === "Overview" && (
            <>
              <div className="welcome-row">
                <div>
                  <h1>Your search, in one place.</h1>
                  <p className="welcome-copy">Keep recruiter contacts and outreach templates together.</p>
                </div>
              </div>

              <div className="stats-grid">
                <StatCard label="Recruiters" value={stats.recruiters} />
                <StatCard label="Email templates" value={stats.templates} />
                <StatCard label="Gmail connection" value={stats.connectedGmailAccounts ? "Connected" : "Not connected"} />
                <StatCard label="Resume" value={stats.resumes ? `${stats.resumes} uploaded` : "Not uploaded"} />
              </div>

              <div className="dashboard-grid">
                <section className="panel activity-panel">
                  <div className="panel-heading">
                    <div><h2>Recently added</h2><p>Recruiter contacts in your account</p></div>
                    <button className="text-button" onClick={() => setSection("Recruiters")}>Manage contacts <ArrowRight size={15} /></button>
                  </div>
                  {recruiters.length > 0 ? (
                    <div className="recent-list">
                      {recruiters.slice(0, 3).map((person, index) => (
                        <div className="recent-row" key={person.id}>
                          <span className={`person-avatar avatar-${index % 5}`}>{initials(person.name)}</span>
                          <span className="recent-copy"><strong>{person.name}</strong><small>{person.company || person.email}</small></span>
                          <span className="recent-date">{new Date(person.createdAt).toLocaleDateString()}</span>
                        </div>
                      ))}
                      <button className="recent-view" onClick={() => setSection("Recruiters")}>View your {recruiters.length} contact{recruiters.length === 1 ? "" : "s"} <ArrowRight size={14} /></button>
                    </div>
                  ) : <div className="empty-activity">
                    <Mail size={22} strokeWidth={1.6} />
                    <h3>Start with a recruiter</h3>
                    <p>Add a contact or import your CSV list.</p>
                    <button className="button-primary small-button" onClick={() => setShowRecruiterForm(true)}><Plus size={16} /> Add a recruiter</button>
                  </div>}
                </section>

                <section className="panel setup-panel">
                  <div className="panel-heading">
                    <div><h2>Getting started</h2><p>A few small steps, a calmer search</p></div>
                    <span className="step-count">{completedSetup} / 3</span>
                  </div>
                  <div className="setup-list">
                    <button className="setup-item" aria-label="Add recruiter" onClick={() => { setSection("Recruiters"); setShowRecruiterForm(true); }}>
                      <span className="setup-icon"><Users size={17} /></span>
                      <span className="setup-copy"><strong>Add recruiter</strong></span>
                      <span className="setup-arrow"><ArrowRight size={16} /></span>
                    </button>
                    <button className="setup-item" aria-label="Create an email template" onClick={() => { setSection("Email templates"); setShowTemplateForm(true); }}>
                      <span className="setup-icon"><FileText size={17} /></span>
                      <span className="setup-copy"><strong>Create template</strong></span>
                      <span className="setup-arrow"><ArrowRight size={16} /></span>
                    </button>
                    <button className="setup-item" aria-label="Connect Gmail" onClick={() => showMessage("Gmail connection requires secure server-side OAuth setup.")}>
                      <span className="setup-icon"><Mail size={17} /></span>
                      <span className="setup-copy"><strong>Connect Gmail</strong></span>
                      <span className="setup-arrow"><ArrowRight size={16} /></span>
                    </button>
                  </div>
                  <div className="privacy-note"><LockKeyhole size={15} /> Only you can access your workspace data.</div>
                </section>
              </div>
              <div className="dashboard-footer"><span>ResumeSender</span><span>Your personal career workspace</span></div>
            </>
          )}

          {section === "Recruiters" && (
            <section className="management-view">
              <div className="page-title-row">
                <div><h1>Recruiters</h1><p className="page-subtitle">Keep important contacts close.</p></div>
                <button className="button-primary" onClick={() => setShowRecruiterForm(true)}><Plus size={17} /> Add recruiter</button>
              </div>
              <div className="panel table-panel">
                <div className="table-toolbar">
                  <div className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, company, email..." aria-label="Search recruiters" />{search && <button aria-label="Clear search" onClick={() => setSearch("")}><X size={15} /></button>}</div>
                  <div className="toolbar-actions">
                    <label className="button-secondary import-button" aria-disabled={isSaving}><Plus size={15} /> Import CSV<input type="file" accept=".csv,text/csv" onChange={importRecruiters} disabled={isSaving} /></label>
                    <button className="button-secondary" onClick={exportRecruiters} disabled={isSaving}><ArrowDownUp size={15} /> Export</button>
                    <button className="icon-button filter-button" aria-label="Reverse contact order" onClick={() => setRecruiters((current) => [...current].reverse())}><ArrowDownUp size={16} /></button>
                  </div>
                </div>
                {filteredRecruiters.length ? (
                  <div className="table-scroll">
                    <table><thead><tr><th>Name</th><th>Company</th><th>Job title</th><th>Email address</th><th>Added</th><th /></tr></thead>
                      <tbody>{filteredRecruiters.map((person, index) => (
                        <tr key={person.id}>
                          <td><div className="person-cell"><span className={`person-avatar avatar-${index % 5}`}>{initials(person.name)}</span><strong>{person.name}</strong></div></td>
                          <td>{person.company || <span className="muted-cell">Not provided</span>}</td><td>{person.jobTitle || <span className="muted-cell">Not provided</span>}</td>
                          <td><a className="email-link" href={`mailto:${person.email}`}>{person.email}</a></td>
                          <td className="date-cell">{new Date(person.createdAt).toLocaleDateString()}</td>
                          <td><button className="row-menu" aria-label={`Remove ${person.name}`} onClick={() => removeRecruiter(person)}><Trash2 size={16} /></button></td>
                        </tr>
                      ))}</tbody></table>
                  </div>
                ) : (
                  <div className="table-empty">
                    <span className="empty-table-icon"><Users size={22} /></span>
                    <h3>{search ? "No contacts found" : "Your contact list is ready"}</h3>
                    <p>{search ? "Try another name, company, or email address." : "Add a recruiter or import a CSV to start building your network."}</p>
                    {!search && <button className="button-primary small-button" onClick={() => setShowRecruiterForm(true)}><Plus size={16} /> Add your first recruiter</button>}
                  </div>
                )}
                <div className="table-bottom"><span>{filteredRecruiters.length} {filteredRecruiters.length === 1 ? "contact" : "contacts"}</span></div>
              </div>
              <p className="storage-disclaimer">Contacts are stored in your private account and synced across your sessions.</p>
            </section>
          )}

          {section === "Resume library" && (
            <ResumeManager onResumeCountChange={updateResumeCount} />
          )}

          {section === "Email templates" && (
            <section className="management-view">
              <div className="page-title-row">
                <div><h1>Email templates</h1><p className="page-subtitle">Write once, then personalize each note.</p></div>
                <button className="button-primary" onClick={() => setShowTemplateForm(true)}><Plus size={17} /> New template</button>
              </div>
              <div className="template-grid">
                {templates.length ? templates.map((template) => (
                  <article className="template-card" key={template.id}>
                    <div className="template-sample"><strong>{template.subject}</strong><p>{template.body.slice(0, 180)}{template.body.length > 180 ? "…" : ""}</p></div>
                    <div className="template-card-body"><div className="template-title-row"><h2>{template.name}</h2><button className="row-menu" aria-label={`Delete ${template.name}`} onClick={() => removeTemplate(template)}><Trash2 size={16} /></button></div><div className="template-card-footer"><span className="template-status">Saved to your account</span><button className="text-button" onClick={() => setPreviewId(template.id)}>Preview <ArrowRight size={14} /></button></div></div>
                  </article>
                )) : <div className="template-empty"><h2>No templates saved</h2><p>Create a template to personalize your next note.</p><button className="button-primary" onClick={() => setShowTemplateForm(true)}><Plus size={16} /> Create template</button></div>}
              </div>
              <p className="storage-disclaimer">Templates are saved to your private account. Email sending is not enabled in this phase.</p>
            </section>
          )}
        </div>
      </section>

      {showRecruiterForm && <Modal title="Add a recruiter" onClose={() => setShowRecruiterForm(false)}>
        <p className="modal-intro">Keep the people behind your next opportunity close.</p>
        <form className="modal-form" onSubmit={addRecruiter}>
          <label>Full name<input name="name" required placeholder="e.g. Alex Morgan" autoFocus /></label>
          <label>Email address<input name="email" type="email" required placeholder="alex@company.com" /></label>
          <div className="form-two-col"><label>Company<input name="company" placeholder="Company name" /></label><label>Job title<input name="jobTitle" placeholder="Talent Partner" /></label></div>
          <div className="modal-actions"><button type="button" className="button-secondary" onClick={() => setShowRecruiterForm(false)} disabled={isSaving}>Cancel</button><button type="submit" className="button-primary" disabled={isSaving}>{isSaving ? "Saving…" : <><Plus size={16} /> Add recruiter</>}</button></div>
        </form>
      </Modal>}

      {showTemplateForm && <Modal title="Create a template" onClose={() => setShowTemplateForm(false)}>
        <p className="modal-intro">Write once, then make every note personal.</p>
        <form className="modal-form" onSubmit={addTemplate}>
          <label>Template name<input name="name" required placeholder="e.g. Product designer outreach" autoFocus /></label>
          <label>Email subject<input name="subject" required placeholder="A subject that feels like you" /></label>
          <label>Email body<textarea name="body" required rows={8} placeholder={"Dear {{recruiter_name}},\n\nI’d love to learn more about opportunities at {{company_name}}..."} /></label>
          <div className="placeholder-hint">Personalize with <code>{"{{recruiter_name}}"}</code> and <code>{"{{company_name}}"}</code></div>
          <div className="modal-actions"><button type="button" className="button-secondary" onClick={() => setShowTemplateForm(false)} disabled={isSaving}>Cancel</button><button type="submit" className="button-primary" disabled={isSaving}>{isSaving ? "Saving…" : <><Check size={16} /> Save template</>}</button></div>
        </form>
      </Modal>}

      {activeTemplate && <Modal title="Template preview" onClose={() => setPreviewId(null)}>
        <div className="preview-email"><div><span>To</span><strong>Recruiter at Example company</strong></div><div><span>Subject</span><strong>{renderTemplate(activeTemplate.subject, "Recruiter", "Example company", accountName)}</strong></div><pre>{renderTemplate(activeTemplate.body, "Recruiter", "Example company", accountName)}</pre><p className="preview-note">Preview only. Nothing has been sent.</p></div>
        <div className="modal-actions preview-actions"><button className="button-secondary" onClick={() => setPreviewId(null)}>Close preview</button></div>
      </Modal>}

      {notice && <div className="toast"><span className="toast-check"><Check size={15} /></span>{notice}<button onClick={() => setNotice("")} aria-label="Dismiss"><X size={15} /></button></div>}
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return <article className="stat-card"><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong></article>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-close" aria-label="Close dialog" onClick={onClose}><X size={18} /></button><h2 id="modal-title">{title}</h2>{children}</section></div>;
}
