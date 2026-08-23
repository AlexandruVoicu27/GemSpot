import { useEffect, useState } from "react";
import { ArrowLeft, Gamepad2, ImagePlus, Save, Trash2 } from "lucide-react";
import {
  getEditableProject,
  saveProjectEdits,
} from "../api";
import { GAME_GENRES, MAX_GAME_GENRES } from "../constants/genres";

const MAX_SCREENSHOTS = 6;

export default function EditProjectPage({
  gameId,
  onBack,
  onSaved,
}) {
  const [project, setProject] = useState(null);
  const [selectedGenres, setSelectedGenres] = useState([]);

  const [coverImage, setCoverImage] = useState(null);
  const [newScreenshots, setNewScreenshots] = useState([]);
  const [removedScreenshotIds, setRemovedScreenshotIds] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadProject() {
      try {
        setIsLoading(true);
        setError("");

        const result = await getEditableProject(gameId);

        if (cancelled) {
          return;
        }

        setProject(result);
        setSelectedGenres(result.genres || []);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError.message || "Could not load this project."
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadProject();

    return () => {
      cancelled = true;
    };
  }, [gameId]);

  function toggleGenre(genre) {
    setSelectedGenres((currentGenres) => {
      if (currentGenres.includes(genre)) {
        return currentGenres.filter(
          (currentGenre) => currentGenre !== genre
        );
      }

      if (currentGenres.length >= MAX_GAME_GENRES) {
        setError(`You can select up to ${MAX_GAME_GENRES} genres.`);
        return currentGenres;
      }

      setError("");
      return [...currentGenres, genre];
    });
  }

  function handleCoverChange(event) {
    const file = event.target.files?.[0];

    if (file) {
      setCoverImage(file);
    }
  }

  function handleScreenshotChange(event) {
    const selectedFiles = Array.from(event.target.files || []);

    const activeExistingScreenshots =
      project.screenshots.filter(
        (screenshot) =>
          !removedScreenshotIds.includes(screenshot.id)
      ).length;

    const availableSlots =
      MAX_SCREENSHOTS -
      activeExistingScreenshots -
      newScreenshots.length;

    if (selectedFiles.length > availableSlots) {
      setError(
        `This game can have a maximum of ${MAX_SCREENSHOTS} screenshots.`
      );

      return;
    }

    setError("");
    setNewScreenshots((currentFiles) => [
      ...currentFiles,
      ...selectedFiles,
    ]);

    // Allows the same file to be selected again after removing it.
    event.target.value = "";
  }

  function removeExistingScreenshot(screenshotId) {
    setRemovedScreenshotIds((currentIds) => [
      ...currentIds,
      screenshotId,
    ]);
  }

  function restoreExistingScreenshot(screenshotId) {
    setRemovedScreenshotIds((currentIds) =>
      currentIds.filter((id) => id !== screenshotId)
    );
  }

  function removeNewScreenshot(indexToRemove) {
    setNewScreenshots((currentFiles) =>
      currentFiles.filter(
        (_, index) => index !== indexToRemove
      )
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setIsSaving(true);
      setError("");

      await saveProjectEdits(gameId, {
        genres: selectedGenres,
        coverImage,
        screenshots: newScreenshots,
        removedScreenshotIds,
      });

      onSaved();
    } catch (saveError) {
      setError(
        saveError.message || "Could not save project changes."
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <main className="page-shell">Loading project...</main>;
  }

  if (!project) {
    return (
      <main className="page-shell">
        <p>{error || "Project not found."}</p>
        <button type="button" onClick={onBack}>
          Back to projects
        </button>
      </main>
    );
  }

  return (
    <main className="page-shell project-edit-page">
      <button
        type="button"
        className="back-button"
        onClick={onBack}
      >
        <ArrowLeft size={18} />
        Back to projects
      </button>

      <header className="project-edit-header">
        <p className="eyebrow">EDIT PROJECT</p>
        <h1>{project.title}</h1>
        <p>
          Change the cover, genres and screenshots shown on
          the public game page.
        </p>
      </header>

      <form className="project-edit-form" onSubmit={handleSubmit}>
        <section className="project-edit-section project-edit-cover-section">
          <h2>Cover image</h2>

          <div className="project-cover-editor">
            <div className="project-cover-preview">
              {coverImage || project.coverImageUrl ? (
                <img
                  src={
                    coverImage
                      ? URL.createObjectURL(coverImage)
                      : project.coverImageUrl
                  }
                  alt={`${project.title} cover`}
                />
              ) : (
                <div className="project-edit-cover-placeholder">
                  <Gamepad2 size={48} />
                  <strong>Cover coming soon</strong>
                </div>
              )}
            </div>

            <div className="project-cover-controls">
              <span className="eyebrow">Public cover</span>
              <p>PNG, JPG or WebP. Maximum 5MB.</p>

              <label className="project-file-button">
                <ImagePlus size={18} />
                {coverImage ? "Choose a different cover" : "Choose another cover"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleCoverChange}
                  hidden
                />
              </label>

              {coverImage && (
                <small className="project-selected-file">{coverImage.name}</small>
              )}
            </div>
          </div>
        </section>

        <section className="project-edit-section project-edit-genres-section">
          <h2>Genres</h2>
          <p>Select up to {MAX_GAME_GENRES} genres.</p>

          <div className="genre-picker">
            <div className="genre-options">
              {GAME_GENRES.map((genre) => {
                const isSelected = selectedGenres.includes(genre);

                return (
                  <button
                    key={genre}
                    type="button"
                    className={
                      isSelected
                        ? "genre-option selected"
                        : "genre-option"
                    }
                    onClick={() => toggleGenre(genre)}
                  >
                    {genre}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="project-edit-section project-edit-screenshots-section">
          <h2>Game screenshots</h2>
          <p>
            Add up to {MAX_SCREENSHOTS} screenshots that
            players can see on the game page.
          </p>

          <div className="project-screenshot-grid">
            {project.screenshots.map((screenshot) => {
              const isRemoved =
                removedScreenshotIds.includes(
                  screenshot.id
                );

              return (
                <article
                  key={screenshot.id}
                  className={
                    isRemoved
                      ? "project-screenshot removed"
                      : "project-screenshot"
                  }
                >
                  <img
                    src={screenshot.url}
                    alt="Game screenshot"
                  />

                  {isRemoved ? (
                    <button
                      type="button"
                      onClick={() =>
                        restoreExistingScreenshot(
                          screenshot.id
                        )
                      }
                    >
                      Undo remove
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        removeExistingScreenshot(
                          screenshot.id
                        )
                      }
                    >
                      <Trash2 size={16} />
                      Remove
                    </button>
                  )}
                </article>
              );
            })}

            {newScreenshots.map((file, index) => (
              <article
                key={`${file.name}-${index}`}
                className="project-screenshot new"
              >
                <img
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                />

                <button
                  type="button"
                  onClick={() =>
                    removeNewScreenshot(index)
                  }
                >
                  <Trash2 size={16} />
                  Remove
                </button>
              </article>
            ))}
          </div>

          <label className="project-file-button">
            <ImagePlus size={18} />
            Add screenshots
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              onChange={handleScreenshotChange}
              hidden
            />
          </label>
        </section>

        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}

        <div className="project-edit-actions">
          <button
            type="button"
            className="cancel-button"
            onClick={onBack}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="save-button"
            disabled={isSaving}
          >
            <Save size={18} />
            {isSaving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    </main>
  );
}