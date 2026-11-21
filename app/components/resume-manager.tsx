"use client";

import {
  Check,
  Download,
  Eye,
  FileText,
  LoaderCircle,
  Pencil,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ApiClientError, apiRequest } from "@/lib/client-api";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

type Resume = {
  id: string;
  displayName: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  isDefault: boolean;
  status: "UPLOADING" | "READY" | "FAILED" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
};

type UploadResult = { resume: Resume };

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function uploadResume(file: File, onProgress: (progress: number) => void) {
  return new Promise<UploadResult>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", "/api/resumes");
    request.setRequestHeader("Content-Type", file.type);
    request.setRequestHeader("X-Resume-File-Name", encodeURIComponent(file.name));
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    request.onerror = () => reject(new Error("Could not reach the server. Check your connection and try again."));
    request.onabort = () => reject(new Error("The upload was cancelled."));
    request.onload = () => {
      let payload: { data?: UploadResult; error?: { message?: string } };
      try {
        payload = JSON.parse(request.responseText);
      } catch {
        reject(new Error("The server returned an invalid response."));
        return;
      }

      if (request.status < 200 || request.status >= 300) {
        reject(
          new ApiClientError(
            payload.error?.message ?? "The upload could not be completed.",
            request.status,
          ),
        );
        return;
      }

      if (!payload.data?.resume) {
        reject(new Error("The server returned an invalid upload response."));
        return;
      }

      onProgress(100);
      resolve(payload.data);
    };
    request.send(file);
  });
}

export default function ResumeManager({
  onResumeCountChange,
}: {
  onResumeCountChange: (count: number) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [authExpired, setAuthExpired] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [busyResumeId, setBusyResumeId] = useState<string | null>(null);
  const [editingResume, setEditingResume] = useState<Resume | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const loadResumes = useCallback(async () => {
    setIsLoading(true);
    setLoadError("");
    setAuthExpired(false);
    try {
      const { resumes: result } = await apiRequest<{ resumes: Resume[] }>("/api/resumes");
      setResumes(result);
      onResumeCountChange(result.length);
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        setAuthExpired(true);
      }
      setLoadError(error instanceof Error ? error.message : "Could not load your resumes.");
    } finally {
      setIsLoading(false);
    }
  }, [onResumeCountChange]);

  useEffect(() => {
    void loadResumes();
  }, [loadResumes]);

  async function handleUpload(file: File) {
    setMessage("");
    setErrorMessage("");
    if (!/\.pdf$/i.test(file.name)) {
      setErrorMessage("Choose a file with a .pdf extension.");
      return;
    }
    if (file.type !== "application/pdf") {
      setErrorMessage("The selected file must be identified as a PDF.");
      return;
    }
    if (!file.size) {
      setErrorMessage("The selected PDF is empty.");
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMessage("PDF files must be 5 MB or smaller.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    try {
      await uploadResume(file, setUploadProgress);
      setMessage("Resume uploaded to your private library.");
      await loadResumes();
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        setAuthExpired(true);
      }
      setErrorMessage(error instanceof Error ? error.message : "Could not upload this resume.");
    } finally {
      setIsUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function saveDisplayName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingResume) return;
    setBusyResumeId(editingResume.id);
    setErrorMessage("");
    setMessage("");
    try {
      await apiRequest<{ resume: Resume }>(`/api/resumes/${encodeURIComponent(editingResume.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ displayName }),
      });
      setEditingResume(null);
      setMessage("Resume name updated.");
      await loadResumes();
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        setAuthExpired(true);
      }
      setErrorMessage(error instanceof Error ? error.message : "Could not rename this resume.");
    } finally {
      setBusyResumeId(null);
    }
  }

  async function makeDefault(resume: Resume) {
    setBusyResumeId(resume.id);
    setErrorMessage("");
    setMessage("");
    try {
      await apiRequest<{ resume: Resume }>(`/api/resumes/${encodeURIComponent(resume.id)}/default`, {
        method: "POST",
      });
      setMessage(`${resume.displayName} is now your default resume.`);
      await loadResumes();
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        setAuthExpired(true);
      }
      setErrorMessage(error instanceof Error ? error.message : "Could not change your default resume.");
    } finally {
      setBusyResumeId(null);
    }
  }

  async function removeResume(resume: Resume) {
    if (!window.confirm(`Delete "${resume.displayName}" from your resume library? This cannot be undone.`)) {
      return;
    }

    setBusyResumeId(resume.id);
    setErrorMessage("");
    setMessage("");
    try {
      await apiRequest<{ deleted: boolean }>(`/api/resumes/${encodeURIComponent(resume.id)}`, {
        method: "DELETE",
      });
      setMessage("Resume deleted.");
      await loadResumes();
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        setAuthExpired(true);
      }
      setErrorMessage(error instanceof Error ? error.message : "Could not delete this resume.");
    } finally {
      setBusyResumeId(null);
    }
  }

  function startRename(resume: Resume) {
    setEditingResume(resume);
    setDisplayName(resume.displayName);
    setErrorMessage("");
  }

  return (
    <section className="management-view resume-manager">
      <div className="page-title-row">
        <div>
          <h1>Resume library</h1>
          <p className="page-subtitle">Keep your application documents private and ready.</p>
        </div>
        <label className={`button-primary resume-upload-button ${isUploading ? "is-disabled" : ""}`}>
          {isUploading ? <LoaderCircle className="resume-spinner" size={17} /> : <Upload size={17} />}
          {isUploading ? "Uploading…" : "Upload a resume"}
          <input
            ref={fileInput}
            type="file"
            accept=".pdf,application/pdf"
            aria-label="Upload a PDF resume"
            disabled={isUploading}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) void handleUpload(file);
            }}
          />
        </label>
      </div>

      <div className="resume-policy">
        <FileText size={17} />
        <span>PDF files only, up to 5 MB. Files are stored in private cloud storage.</span>
      </div>

      {isUploading && (
        <div className="resume-progress" role="status" aria-live="polite">
          <div className="resume-progress-copy">
            <span>Uploading securely</span>
            <span>{uploadProgress}%</span>
          </div>
          <progress max={100} value={uploadProgress} aria-label={`Upload progress: ${uploadProgress}%`} />
        </div>
      )}

      {message && <p className="resume-feedback resume-feedback-success" role="status">{message}</p>}
      {errorMessage && (
        <p className="resume-feedback resume-feedback-error" role="alert">
          {errorMessage}
          {authExpired && <> <a href="/sign-in">Sign in again</a></>}
        </p>
      )}

      <section className="panel resume-panel" aria-label="Your resumes">
        <div className="resume-panel-heading">
          <div>
            <h2>Your resumes</h2>
            <p>{isLoading ? "Loading your private files…" : `${resumes.length} ${resumes.length === 1 ? "resume" : "resumes"}`}</p>
          </div>
          <button className="button-secondary resume-refresh" onClick={() => void loadResumes()} disabled={isLoading || isUploading}>
            Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="resume-skeleton-list" aria-label="Loading resumes">
            {[0, 1, 2].map((item) => <div className="resume-skeleton-row" key={item} />)}
          </div>
        ) : loadError ? (
          <div className="resume-empty resume-error-state" role="alert">
            <FileText size={23} />
            <h3>Resumes could not be loaded</h3>
            <p>{loadError}</p>
            {authExpired ? (
              <a className="button-primary small-button" href="/sign-in">Sign in again</a>
            ) : (
              <button className="button-secondary" onClick={() => void loadResumes()}>Try again</button>
            )}
          </div>
        ) : resumes.length === 0 ? (
          <div className="resume-empty">
            <FileText size={24} />
            <h3>No resumes uploaded yet</h3>
            <p>Add a private PDF so it is ready when you need it.</p>
            <button className="button-primary small-button" onClick={() => fileInput.current?.click()} disabled={isUploading}>
              <Upload size={15} /> Upload your first resume
            </button>
          </div>
        ) : (
          <ul className="resume-list">
            {resumes.map((resume) => {
              const isBusy = busyResumeId === resume.id;
              return (
                <li className="resume-row" key={resume.id}>
                  <span className="resume-file-icon"><FileText size={20} /></span>
                  <div className="resume-main">
                    <div className="resume-name-line">
                      <strong title={resume.displayName}>{resume.displayName}</strong>
                      {resume.isDefault && <span className="resume-default-badge"><Star size={12} fill="currentColor" /> Default</span>}
                    </div>
                    <div className="resume-meta">
                      <span>{formatFileSize(resume.sizeBytes)}</span>
                      <span>{new Date(resume.createdAt).toLocaleDateString()}</span>
                      <span>{resume.status === "READY" ? "Ready" : resume.status.toLowerCase()}</span>
                    </div>
                  </div>
                  <div className="resume-actions" aria-label={`Actions for ${resume.displayName}`}>
                    {resume.status === "READY" && (
                      <>
                        <a
                          className="resume-action"
                          href={`/api/resumes/${encodeURIComponent(resume.id)}/preview`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Preview ${resume.displayName}`}
                          title="Preview PDF"
                        >
                          <Eye size={16} /><span>Preview</span>
                        </a>
                        <a
                          className="resume-action"
                          href={`/api/resumes/${encodeURIComponent(resume.id)}/download`}
                          aria-label={`Download ${resume.displayName}`}
                          title="Download PDF"
                        >
                          <Download size={16} /><span>Download</span>
                        </a>
                        <button className="resume-action" onClick={() => startRename(resume)} disabled={isBusy} aria-label={`Rename ${resume.displayName}`} title="Rename">
                          <Pencil size={16} /><span>Rename</span>
                        </button>
                        {!resume.isDefault && (
                          <button className="resume-action" onClick={() => void makeDefault(resume)} disabled={isBusy} aria-label={`Set ${resume.displayName} as default`} title="Set as default">
                            <Star size={16} /><span>Set default</span>
                          </button>
                        )}
                        <button className="resume-action resume-delete-action" onClick={() => void removeResume(resume)} disabled={isBusy} aria-label={`Delete ${resume.displayName}`} title="Delete">
                          {isBusy ? <LoaderCircle className="resume-spinner" size={16} /> : <Trash2 size={16} />}
                          <span>{isBusy ? "Working…" : "Delete"}</span>
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {editingResume && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !busyResumeId) setEditingResume(null);
        }}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="resume-rename-title">
            <button className="modal-close" aria-label="Close rename dialog" onClick={() => setEditingResume(null)} disabled={Boolean(busyResumeId)}>
              <X size={18} />
            </button>
            <h2 id="resume-rename-title">Rename resume</h2>
            <p className="modal-intro">Choose a display name for this private file.</p>
            <form className="modal-form" onSubmit={(event) => void saveDisplayName(event)}>
              <label>
                Display name
                <input
                  autoFocus
                  required
                  maxLength={160}
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  aria-label="Resume display name"
                />
              </label>
              <div className="modal-actions">
                <button type="button" className="button-secondary" onClick={() => setEditingResume(null)} disabled={Boolean(busyResumeId)}>Cancel</button>
                <button type="submit" className="button-primary" disabled={Boolean(busyResumeId)}>
                  {busyResumeId ? "Saving…" : <><Check size={16} /> Save name</>}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
