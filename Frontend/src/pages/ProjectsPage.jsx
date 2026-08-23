import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Gamepad2,
  MessageSquare,
  Play,
  Star,
  Trash2,
  Pencil,
} from "lucide-react";
import { deleteGame, getMyProjects, publishGame } from "../api";

// Renders an uploaded cover and falls back cleanly when its URL is missing
// or the remote image can no longer be loaded.
function ProjectCover({ project }) {
  const [coverFailed, setCoverFailed] = useState(false);
  const hasUsableCover = Boolean(project.coverImage && !coverFailed);

  return (
    <div className="project-card-image">
      {hasUsableCover ? (
        <img
          src={project.coverImage}
          alt={`${project.title} cover`}
          onError={() => setCoverFailed(true)}
        />
      ) : (
        <div className="project-cover-placeholder" aria-hidden="true">
          <Gamepad2 size={42} />
          <small>Cover coming soon</small>
        </div>
      )}

      <span className="project-genre">{project.tag || "Indie"}</span>
    </div>
  );
}

// Displays all projects owned by the current creator.
export default function ProjectsPage({ profile, accountLabel, onBack, onEdit }) {
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [publishingId, setPublishingId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const profileUsername = profile?.username || accountLabel;

  // Loads the authenticated creator's projects.
  useEffect(() => {
    getMyProjects()
      .then((result) => {
        setProjects(Array.isArray(result) ? result : []);
        setError("");
      })
      .catch((loadError) => {
        setError(loadError.message || "Could not load projects.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  // Publishes one approved project.
  const handlePublish = async (projectId) => {
    setPublishingId(projectId);
    setError("");
    setNotice("");

    try {
      await publishGame(projectId);

      setProjects((currentProjects) =>
        currentProjects.map((project) =>
          project.id === projectId
            ? { ...project, status: "PUBLISHED" }
            : project
        )
      );

      setNotice("Your game is now published on GemSpot.");
    } catch (publishError) {
      setError(publishError.message || "Could not publish the game.");
    } finally {
      setPublishingId("");
    }
  };

  // Archives one creator-owned project after confirmation.
  const handleDelete = async (project) => {
    const confirmed = window.confirm(
      'Delete "' + project.title + '"? It will be removed from your Projects page.'
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(project.id);
    setError("");
    setNotice("");

    try {
      await deleteGame(project.id);
      setProjects((currentProjects) =>
        currentProjects.filter((currentProject) => currentProject.id !== project.id)
      );
      setNotice("Project deleted from your Projects page.");
    } catch (deleteError) {
      setError(deleteError.message || "Could not delete the project.");
    } finally {
      setDeletingId("");
    }
  };

  return (
    <section className="projects-page">
      <div className="projects-page-heading">
        <div>
          <span className="eyebrow">Creator profile</span>
          <h1>{profileUsername}'s projects.</h1>
          <p>
            Manage your approved games and decide when to publish them.
          </p>
        </div>

        <button className="back-button" onClick={onBack}>
          <ArrowLeft size={17} />
          Back to profile
        </button>
      </div>

      {isLoading && (
        <p className="empty-state">Loading projects...</p>
      )}

      {error && (
        <p className="empty-state error-state">{error}</p>
      )}

      {notice && (
        <p className="edit-notice">{notice}</p>
      )}

      {!isLoading && !error && projects.length === 0 && (
        <section className="empty-projects-panel">
          <Gamepad2 size={42} />
          <h2>No projects yet.</h2>
          <p>Upload a game and wait for moderator approval.</p>
        </section>
      )}

      {!isLoading && !error && projects.length > 0 && (
        <div className="projects-grid">
          {projects.map((project) => {
            const isApproved = project.buildStatus === "APPROVED";
            const isPublished = project.status === "PUBLISHED";
            const isPublishing = publishingId === project.id;
            const isDeleting = deletingId === project.id;
            const reviewCount = Number(project.reviews) || 0;
            const statusTone = isPublished
              ? "published"
              : isApproved
                ? "approved"
                : "pending";
            const statusLabel = isPublished
              ? "Published"
              : isApproved
                ? "Approved — ready to publish"
                : `Waiting for review (${project.buildStatus || "PENDING"})`;

            return (
              <article
                className={"project-card " + (project.palette || "mint")}
                key={project.id || project.slug}
              >
                <ProjectCover project={project} />

                <div className="project-card-content">
                  <span className="eyebrow">{project.mode || "Game"}</span>
                  <h2>{project.title}</h2>

                  <div className="project-card-stats" aria-label="Project statistics">
                    <span className="project-stat">
                      <Star size={15} fill="currentColor" />
                      {reviewCount === 0 ? "New" : `${project.score}/5`}
                    </span>

                    <span className="project-stat">
                      {project.mode === "Download" ? (
                        <Download size={15} />
                      ) : (
                        <Play size={15} />
                      )}
                      {project.mode || "Game"}
                    </span>

                    <span className="project-stat">
                      <MessageSquare size={15} />
                      {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
                    </span>
                  </div>

                  <div className={`project-status project-status-${statusTone}`}>
                    <span className="project-status-dot" aria-hidden="true" />
                    <span>
                      <small>Project status</small>
                      <strong>{statusLabel}</strong>
                    </span>
                  </div>

                  <div className="project-actions">
                    {isApproved && !isPublished && (
                      <button
                        className="project-publish-button"
                        type="button"
                        disabled={isPublishing || isDeleting}
                        onClick={() => handlePublish(project.id)}
                      >
                        <Play size={16} fill="currentColor" />
                        {isPublishing ? "Publishing..." : "Publish game"}
                      </button>
                    )}

                    <button
                      type="button"
                      className="project-edit-button"
                      onClick={() => onEdit(project.id)}
                    >
                      <Pencil size={18} />
                      Edit project
                    </button>

                    {isPublished && (
                      <button
                        className="project-open-button"
                        type="button"
                        disabled
                      >
                        <CheckCircle2 size={16} />
                        Published
                      </button>
                    )}

                    <button
                      className="project-delete-button"
                      type="button"
                      disabled={isPublishing || isDeleting}
                      onClick={() => handleDelete(project)}
                    >
                      <Trash2 size={16} />
                      {isDeleting ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}