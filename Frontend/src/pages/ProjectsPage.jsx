import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Download,
  Gamepad2,
  Play,
  Star,
  Trash2,
} from "lucide-react";
import { deleteGame, getMyProjects, publishGame } from "../api";

// Displays all projects owned by the current creator.
export default function ProjectsPage({ profile, accountLabel, onBack }) {
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

            return (
              <article
                className={"project-card " + (project.palette || "mint")}
                key={project.id || project.slug}
              >
                <div className="project-card-image">
                  {project.coverImage ? (
                    <img
                      src={project.coverImage}
                      alt={project.title + " cover"}
                    />
                  ) : (
                    <Gamepad2 size={38} />
                  )}
                  <span>{project.tag || "Indie"}</span>
                </div>

                <div className="project-card-content">
                  <span className="eyebrow">{project.mode || "Game"}</span>
                  <h2>{project.title}</h2>

                  <div className="project-card-stats">
                    <span>
                      <Star size={15} fill="currentColor" />
                      {project.score || "New"}
                    </span>

                    <span>
                      {project.mode === "Download" ? (
                        <Download size={15} />
                      ) : (
                        <Play size={15} />
                      )}
                      {project.mode || "Game"}
                    </span>

                    <span>{project.reviews || 0} reviews</span>
                  </div>

                  <p className="project-status">
                    Status: {isPublished
                      ? "Published"
                      : isApproved
                        ? "Approved — ready to publish"
                        : "Waiting for review (" + project.buildStatus + ")"}
                  </p>

                  <div className="project-actions">
                    {isApproved && !isPublished && (
                      <button
                        className="project-publish-button"
                        type="button"
                        disabled={isPublishing || isDeleting}
                        onClick={() => handlePublish(project.id)}
                      >
                        {isPublishing ? "Publishing..." : "Publish game"}
                      </button>
                    )}

                    {isPublished && (
                      <button
                        className="project-open-button"
                        type="button"
                        disabled
                      >
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