import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  Gamepad2,
  RefreshCw,
  ShieldAlert,
  Trash2,
  UserRound,
} from "lucide-react";
import {
  banUser,
  deleteGame,
  getAdminGames,
  getAdminUsers,
  unbanUser,
} from "../api";

// Displays administrator controls for games and user access.
export default function AdminManagementPage({ onBack, currentUserId }) {
  const [games, setGames] = useState([]);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actingId, setActingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Loads the current administrator's game and user lists.
  const loadAdminData = async () => {
    setIsLoading(true);
    setError("");

    try {
      const [gameResult, userResult] = await Promise.all([
        getAdminGames(),
        getAdminUsers(),
      ]);

      setGames(Array.isArray(gameResult) ? gameResult : []);
      setUsers(Array.isArray(userResult) ? userResult : []);
    } catch (loadError) {
      setError(loadError.message || "Could not load administrator data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  // Archives any game after an administrator confirms the action.
  const handleDeleteGame = async (game) => {
    const confirmed = window.confirm(
      'Archive "' + game.title + '"? It will be removed from the public site.'
    );

    if (!confirmed) {
      return;
    }

    setActingId("game-" + game.id);
    setError("");
    setNotice("");

    try {
      await deleteGame(game.id);
      setGames((currentGames) =>
        currentGames.filter((currentGame) => currentGame.id !== game.id)
      );
      setNotice("The game was removed from the site.");
    } catch (deleteError) {
      setError(deleteError.message || "Could not remove the game.");
    } finally {
      setActingId("");
    }
  };

  // Bans or unbans one account after an administrator confirms the action.
  const handleToggleBan = async (user) => {
    const action = user.is_banned ? "unban" : "ban";
    const confirmed = window.confirm(
      (user.is_banned ? "Unban " : "Ban ") +
        (user.username || user.email) +
        "?"
    );

    if (!confirmed) {
      return;
    }

    setActingId("user-" + user.id);
    setError("");
    setNotice("");

    try {
      const updatedUser = user.is_banned
        ? await unbanUser(user.id)
        : await banUser(user.id);

      setUsers((currentUsers) =>
        currentUsers.map((currentUser) =>
          currentUser.id === user.id ? updatedUser : currentUser
        )
      );
      setNotice(
        action === "ban"
          ? "The user was banned."
          : "The user can access the site again."
      );
    } catch (banError) {
      setError(banError.message || "Could not update the user's ban.");
    } finally {
      setActingId("");
    }
  };

  return (
    <section className="admin-management-page">
      <div className="admin-management-heading">
        <div>
          <span className="eyebrow">Administrator tools</span>
          <h1>Manage GemSpot.</h1>
          <p>Remove games from the site and control account access.</p>
        </div>

        <div className="admin-heading-actions">
          <button
            className="back-button"
            type="button"
            onClick={onBack}
          >
            <ArrowLeft size={17} />
            Back to profile
          </button>
          <button
            className="admin-refresh-button"
            type="button"
            onClick={loadAdminData}
            disabled={isLoading}
          >
            <RefreshCw size={17} />
            Refresh
          </button>
        </div>
      </div>

      {error && <p className="admin-message admin-error">{error}</p>}
      {notice && <p className="admin-message admin-notice">{notice}</p>}

      {isLoading ? (
        <p className="empty-state">Loading administrator tools...</p>
      ) : (
        <div className="admin-management-grid">
          <section className="admin-management-card">
            <div className="admin-card-heading">
              <div>
                <span className="eyebrow">Game control</span>
                <h2>Games on GemSpot</h2>
              </div>
              <Gamepad2 size={26} />
            </div>

            {games.length === 0 ? (
              <p className="admin-empty-list">No active games found.</p>
            ) : (
              <div className="admin-list">
                {games.map((game) => (
                  <article className="admin-list-item" key={game.id}>
                    <div className="admin-item-icon">
                      <Gamepad2 size={19} />
                    </div>
                    <div className="admin-item-copy">
                      <strong>{game.title}</strong>
                      <span>
                        by {game.creator?.username || "Unknown creator"}
                      </span>
                      <small>
                        {game.status} · Build {game.buildStatus}
                      </small>
                    </div>
                    <button
                      className="admin-danger-button"
                      type="button"
                      disabled={actingId === "game-" + game.id}
                      onClick={() => handleDeleteGame(game)}
                    >
                      <Trash2 size={16} />
                      {actingId === "game-" + game.id ? "Removing..." : "Delete"}
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="admin-management-card">
            <div className="admin-card-heading">
              <div>
                <span className="eyebrow">Account control</span>
                <h2>Users</h2>
              </div>
              <UserRound size={26} />
            </div>

            {users.length === 0 ? (
              <p className="admin-empty-list">No users found.</p>
            ) : (
              <div className="admin-list">
                {users.map((user) => {
                  const isCurrentUser = user.id === currentUserId;
                  const isActing = actingId === "user-" + user.id;

                  return (
                    <article className="admin-list-item" key={user.id}>
                      <div className="admin-item-icon">
                        {user.is_banned ? (
                          <Ban size={19} />
                        ) : (
                          <CheckCircle2 size={19} />
                        )}
                      </div>
                      <div className="admin-item-copy">
                        <strong>{user.username || user.email}</strong>
                        <span>{user.email}</span>
                        <small>{user.role}</small>
                      </div>
                      <span
                        className={
                          user.is_banned
                            ? "admin-status-badge banned"
                            : "admin-status-badge active"
                        }
                      >
                        {user.is_banned ? "Banned" : "Active"}
                      </span>
                      {isCurrentUser ? (
                        <span className="admin-current-account">You</span>
                      ) : (
                        <button
                          className={
                            user.is_banned
                              ? "admin-unban-button"
                              : "admin-ban-button"
                          }
                          type="button"
                          disabled={isActing}
                          onClick={() => handleToggleBan(user)}
                        >
                          <ShieldAlert size={16} />
                          {isActing
                            ? "Saving..."
                            : user.is_banned
                              ? "Unban"
                              : "Ban"}
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );
}