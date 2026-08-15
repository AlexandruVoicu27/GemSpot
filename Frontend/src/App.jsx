import React, { useEffect, useMemo, useState } from "react";
import { clearAuthToken, getCurrentUser, getGames, login, signup, updateProfile } from "./api";
import ProfilePage from "./pages/ProfilePage";
import EditProfilePage from "./pages/EditProfilePage";
import UploadPage from "./pages/UploadPage";
import ModeratorReviewPage from "./pages/ModeratorReviewPage";
import ProjectsPage from "./pages/ProjectsPage";
import AdminManagementPage from "./pages/AdminManagementPage";
import {
  ArrowLeft,
  Bell,
  Crown,
  Download,
  Flame,
  Gamepad2,
  Gem,
  LockKeyhole,
  LogIn,
  LogOut,
  MessageSquare,
  Play,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Swords,
  Upload,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";

const navItems = ["Games", "Creators", "Jams", "Reviews", "Forum"];
const filters = ["Featured", "Fresh", "Underrated", "Browser Play", "Download"];
const reviews = [];
const activity = [];

function App() {
// Filtrul activ din feed-ul de jocuri: Featured, Fresh, Underrated etc.
  const [activeFilter, setActiveFilter] = useState('Featured');

// Lista de jocuri venita din backend/API.
  const [gamesList, setGamesList] = useState([]);

// Ne spune daca inca se incarca jocurile din API.
  const [isLoadingGames, setIsLoadingGames] = useState(true);

// Mesaj de eroare daca jocurile nu pot fi incarcate.
  const [gamesError, setGamesError] = useState("");

// Textul scris de user in bara de search.
  const [query, setQuery] = useState('');

// Ratingul selectat in zona de Quick Review.
  const [rating, setRating] = useState(4);

// Datele sesiunii curente: user, profile si token dupa login.
  const [session, setSession] = useState(null);

// Username-ul introdus in formularul de signup.
  const [authUsername, setAuthUsername] = useState("");

// Email-ul sau username-ul introdus in formularul de login/signup.
  const [authEmail, setAuthEmail] = useState("");
  
// Parola introdusa in formularul de login/signup.
  const [authPassword, setAuthPassword] = useState("");

// Confirmarea parolei, folosita doar la signup.
  const [authPasswordConfirm, setAuthPasswordConfirm] = useState("");

// Modul formularului de auth: "login" sau "signup".
  const [authMode, setAuthMode] = useState("login");

 // Controleaza daca se vede pagina de auth. null inseamna ca stam pe pagina principala.
  const [authPage, setAuthPage] = useState(null);

  // Mesaj de eroare pentru login/signup.
  const [authError, setAuthError] = useState("");

  // Ne spune daca formularul de login/signup este in curs de trimitere.
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Controleaza modalul de confirmare pentru logout.
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  // Mesaj afisat cand userul incearca o actiune care cere cont.
  const [gateNotice, setGateNotice] = useState("");

  // Textul scris in textarea-ul de review.
  const [reviewText, setReviewText] = useState("");

  // Pagina curenta din aplicatie. Pentru inceput avem "home" si "profile".
  const [page, setPage] = useState("home");

  const showHomePage = () => {
  setPage("home");
  setAuthPage(null);
  setAuthError("");
};

// Userul curent, daca exista sesiune.
const user = session?.user ?? null;

// Profilul userului, daca backendul il trimite.
const profile = session?.profile ?? user?.profile ?? null;

// Numele afisat in header.
const accountLabel =
  profile?.username ||
  user?.user_metadata?.username ||
  user?.email ||
  "Account";

// True daca userul este logat.
// Fotografia reala a userului, daca backendul o trimite.
const avatarUrl =
  profile?.avatar_url ||
  user?.user_metadata?.avatar_url ||
  user?.user_metadata?.avatarUrl ||
  "";

const accountInitials = accountLabel
  .split(/\s+/)
  .map((part) => part[0])
  .join("")
  .slice(0, 2)
  .toUpperCase();

const isAuthenticated = Boolean(user);
  const showAuthPage = Boolean(authPage && !isAuthenticated);
  const isProfilePage = page === "profile" && isAuthenticated;
  const isEditProfilePage = page === "edit-profile" && isAuthenticated;
  const isUploadPage = page === "upload" && isAuthenticated;
  const isProjectsPage = page === "projects" && isAuthenticated;
  const isAdminPage = page === "admin" && isAuthenticated && profile?.role === "ADMIN";
  const canModerate = ["ADMIN", "MODERATOR"].includes(profile?.role);
  const isReviewPage = page === "moderation" && isAuthenticated && canModerate;


  const visibleGames = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return gamesList.filter((game) => {
      const matchesFilter = activeFilter === 'Featured' || game.mode === activeFilter;
      const matchesQuery =
        !normalizedQuery ||
        game.title.toLowerCase().includes(normalizedQuery) ||
        game.creator.toLowerCase().includes(normalizedQuery) ||
        game.tag.toLowerCase().includes(normalizedQuery);
      return matchesFilter && matchesQuery;
    });
  }, [activeFilter, query, gamesList]);

  const requireAccount = (action) => {
    if (isAuthenticated) {
      setGateNotice('');
      return true;
    }

    setGateNotice(`${action} needs a GemSpot account first.`);
    return false;
  };

  const handleStartUpload = () => {
    if (!isAuthenticated) {
      setGateNotice("Uploading a project needs a GemSpot account first.");
      openAuthPage("signup");
      return;
    }

    setPage("upload");
    setAuthPage(null);
  };

  // Opens the projects page for the current profile.
  const handleStartProjects = () => {
    setPage("projects");
    setAuthPage(null);
    setGateNotice("");
  };

  // Opens the moderator review page for authorized users.
  const handleStartModeration = () => {
    if (!isAuthenticated || !canModerate) {
      setGateNotice("Only admins and moderators can review uploads.");
      return;
    }

    setPage("moderation");
    setAuthPage(null);
    setGateNotice("");
  };


  // Opens the administrator management page for admins.
  const handleStartAdmin = () => {
    if (!isAuthenticated || profile?.role !== "ADMIN") {
      setGateNotice("Only admins can manage users and games.");
      return;
    }

    setPage("admin");
    setAuthPage(null);
    setGateNotice("");
  };
  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    setAuthError("");
    if (authMode === "signup" && authUsername.trim().length < 3) {
      setAuthError("Username must be at least 3 characters.");
      return;
    }
    if (authMode === "signup" && authPassword !== authPasswordConfirm) {
      setAuthError("Passwords do not match.");
      return;
    }
    setIsAuthLoading(true);
    try {
      const data =
        authMode === "signup"
          ? await signup(authEmail, authPassword, authUsername.trim())
          : await login(authEmail, authPassword);
      if (data.session?.access_token && data.user) {
        setSession({ user: { ...data.user, profile: data.profile }, profile: data.profile });
        setAuthPage(null);
        setPage("home");
        setGateNotice("");
      } else {
        setGateNotice("Account created. Check your email to confirm it before logging in.");
      }
      setAuthUsername("");
      setAuthPassword("");
      setAuthPasswordConfirm("");
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const openAuthPage = (mode) => {
    setAuthMode(mode);
    setAuthPage(mode);
    setAuthError("");
    setGateNotice("");
  };

  const requestLogout = () => setIsLogoutConfirmOpen(true);

  const confirmLogout = () => {
    clearAuthToken();
    setSession(null);
    setPage("home");
    setAuthPage(null);
    setIsLogoutConfirmOpen(false);
    setGateNotice("You are browsing as a guest. Games and reviews stay visible.");
  };

  const handleNavClick = (event, item) => {
    event.preventDefault();
    if (item === "Games") {
      showHomePage();
      return;
    }
    if (item === "Creators" && isAuthenticated) {
      setPage("profile");
      return;
    }
    setGateNotice(item + " is coming next.");
  };

  const handleProfileSave = async (profileData) => {
  const data = await updateProfile(profileData);

  setSession((current) =>
    current
      ? {
          ...current,
          profile: data.profile,
          user: {
            ...current.user,
            profile: data.profile,
          },
        }
      : current
  );

  return data.profile;
};

  useEffect(() => {
    getGames()
      .then((data) => {
        setGamesList(Array.isArray(data) ? data : []);
        setGamesError("");
      })
      .catch(() => setGamesError("Could not load games from the API."))
      .finally(() => setIsLoadingGames(false));
  }, []);

  useEffect(() => {
    getCurrentUser()
      .then((data) => {
        if (data.user) setSession({ user: data.user, profile: data.user.profile });
      })
      .catch(() => {
        clearAuthToken();
        setSession(null);
      });
  }, []);

return (
    <main className="app-shell">
      <header className="site-header">
        <div className="top-strip">
          <a className="brand" href="#" onClick={(event) => { event.preventDefault(); showHomePage(); }} aria-label="GemSpot home">
            <span className="brand-mark">
              <Gem size={28} strokeWidth={2.7} />
            </span>
            <span>
              <strong>GemSpot</strong>
              <small>Free indie game portal</small>
            </span>
          </a>

          <div className="header-actions">
            <label className="search-box">
              <Search size={18} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search games, creators, tags"
              />
            </label>
            <button className="icon-button" aria-label="Notifications">
              <Bell size={19} />
            </button>
            {isAuthenticated ? (
              <div className="account-cluster">
                <button className="account-pill" onClick={() => setPage("profile")}>
                  <span className="account-avatar" aria-hidden="true">
                    {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{accountInitials}</span>}
                  </span>
                  <span>{accountLabel}</span>
                </button>
                <button className="icon-button" onClick={requestLogout} aria-label="Log out">
                  <LogOut size={19} />
                </button>
              </div>
            ) : (
              <div className="account-cluster">
                <button className="ghost-button" onClick={() => openAuthPage("login")}>
                  <LogIn size={17} />
                  Log in
                </button>
                <button className="upload-button" onClick={() => openAuthPage("signup")}>
                  <UserPlus size={18} />
                  Create account
                </button>
              </div>
            )}
          </div>
        </div>

        <nav className="main-nav" aria-label="Primary navigation">
          {navItems.map((item) => (
            <a
              className={(page === "home" && item === "Games") || (page === "profile" && item === "Creators") ? "active" : ""}
              href="#"
              onClick={(event) => handleNavClick(event, item)}
              key={item}
            >
              {item}
            </a>
          ))}
        </nav>
      </header>

      {showAuthPage ? (
        <section className="auth-page">
          <button className="back-button" onClick={showHomePage}><ArrowLeft size={17} />Back to games</button>
          <div className="auth-panel">
            <span className="eyebrow">GemSpot account</span>
            <h1>{authMode === "signup" ? "Create your account." : "Welcome back."}</h1>
            <p>{authMode === "signup" ? "Create a profile to review games and publish your own projects." : "Log in to review games and open your creator profile."}</p>
            <form className="auth-page-form" onSubmit={handleAuthSubmit}>
              {authMode === "signup" && <label>Username<input value={authUsername} onChange={(event) => setAuthUsername(event.target.value)} required /></label>}
              <label>Email or username<input value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} required /></label>
              <label>Password<input type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} required /></label>
              {authMode === "signup" && <label>Confirm password<input type="password" value={authPasswordConfirm} onChange={(event) => setAuthPasswordConfirm(event.target.value)} required /></label>}
              {authError && <p className="auth-error">{authError}</p>}
              {gateNotice && <p className="gate-notice">{gateNotice}</p>}
              <button className="auth-submit" type="submit" disabled={isAuthLoading}>
                {authMode === "signup" ? <UserPlus size={17} /> : <LogIn size={17} />}
                {isAuthLoading ? "Working..." : authMode === "signup" ? "Create account" : "Log in"}
              </button>
            </form>
            <button className="auth-switch" onClick={() => openAuthPage(authMode === "signup" ? "login" : "signup")}>
              {authMode === "signup" ? "Already have an account? Log in" : "Need an account? Create one"}
            </button>
          </div>
        </section>
      ) : isAdminPage ? (
        <AdminManagementPage
          onBack={() => setPage("profile")}
          currentUserId={user?.id}
        />
      ) : isProjectsPage ? (
        <ProjectsPage
          profile={profile}
          accountLabel={accountLabel}
          onBack={() => setPage("profile")}
        />
      ) : isReviewPage ? (
        <ModeratorReviewPage
          onBack={() => setPage("profile")}
          profile={profile}
        />
      ) : isEditProfilePage ? (
        <EditProfilePage
          accountLabel={accountLabel}
          user={user}
          profile={profile}
          onBack={() => setPage("profile")}
          onSaved={handleProfileSave}
        />
      ) : isUploadPage ? (
        <UploadPage profile={profile} onBack={() => setPage("home")} />
      ) : isProfilePage ? (
        <ProfilePage
          accountLabel={accountLabel}
          user={user}
          profile={profile}
          requireAccount={requireAccount}
          onEdit={() => setPage("edit-profile")}
          onUpload={handleStartUpload}
          onReview={handleStartModeration}
          onAdmin={handleStartAdmin}
          onProjects={handleStartProjects}
        />
      ) : (
        <>
      <section className="hero-panel">
        <div className="hero-copy">
          <div className="badge-row">
            <span>
              <Flame size={16} />
              Weekly Spotlight
            </span>
            <span>
              <ShieldCheck size={16} />
              Moderator picked
            </span>
          </div>
          <h1>Find the weird, brilliant free games before everyone else.</h1>
          <p>
            GemSpot gives creators a loud front page, players a dense discovery feed,
            and logged-in reviewers a place where feedback actually matters.
          </p>
          <div className="hero-actions">
            <button onClick={() => requireAccount('Taking a game')}>
              {isAuthenticated ? <Play size={18} fill="currentColor" /> : <LockKeyhole size={18} />}
              Get Spotlight
            </button>
            <button className="secondary" onClick={handleStartUpload}>
              {isAuthenticated ? <Plus size={18} /> : <LockKeyhole size={18} />}
              Start Project
            </button>
          </div>
          {gateNotice && <p className="gate-notice">{gateNotice}</p>}
        </div>

        <div className="spotlight-stage" aria-label="Featured game preview">
          <div className="game-screen">
            <div className="pixel-sky">
              <span />
              <span />
              <span />
            </div>
            <div className="pixel-ground">
              <div className="hero-character" />
              <div className="gem-token" />
            </div>
          </div>
          <div className="spotlight-meta">
            <div>
              <strong>Moonlit Delivery</strong>
              <small>RivaByte - browser playable</small>
            </div>
            <span>4.8</span>
          </div>
        </div>
      </section>

      <section className="content-grid">
        <div className="feed-column">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Discover</span>
              <h2>Game Feed</h2>
            </div>
            <div className="filter-row" role="tablist" aria-label="Game feed filters">
              {filters.map((filter) => (
                <button
                  className={activeFilter === filter ? 'selected' : ''}
                  onClick={() => setActiveFilter(filter)}
                  role="tab"
                  aria-selected={activeFilter === filter}
                  key={filter}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="game-list">
            {isLoadingGames && <p className="empty-state">Loading games...</p>}
            {!isLoadingGames && gamesError && <p className="empty-state error-state">{gamesError}</p>}
            {!isLoadingGames && !gamesError && visibleGames.length === 0 && <p className="empty-state">No games match this filter yet.</p>}
            {visibleGames.map((game) => (
              <article className={`game-card ${game.palette}`} key={game.title}>
                <div className="thumb">
                  <Gamepad2 size={34} />
                  <span>{game.tag}</span>
                </div>
                <div className="game-info">
                  <div>
                    <h3>{game.title}</h3>
                    <p>by {game.creator}</p>
                  </div>
                  <div className="game-stats">
                    <span>
                      <Star size={15} fill="currentColor" />
                      {game.score}
                    </span>
                    <span>
                      <Users size={15} />
                      {game.plays}
                    </span>
                    <span>
                      {game.mode === 'Download' ? <Download size={15} /> : <Play size={15} />}
                      {game.mode}
                    </span>
                    <span>
                      <MessageSquare size={15} />
                      {game.reviews} reviews
                    </span>
                  </div>
                  <div className="game-actions">
                    <button onClick={() => requireAccount('Taking this game')}>
                      {isAuthenticated ? (
                        game.mode === 'Download' ? <Download size={16} /> : <Play size={16} />
                      ) : (
                        <LockKeyhole size={16} />
                      )}
                      Get & review
                    </button>
                    <button className="quiet-action">
                      <MessageSquare size={16} />
                      Read reviews
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="side-rail">
          <section className="creator-card">
            <span className="eyebrow">Creator Console</span>
            <h2>{isAuthenticated ? 'Launch a build, get useful feedback.' : 'Create an account to publish games.'}</h2>
            <div className="console-actions">
              <button onClick={handleStartUpload}>
                {isAuthenticated ? <Upload size={17} /> : <LockKeyhole size={17} />}
                New Upload
              </button>
              <button onClick={() => requireAccount('Managing review requests')}>
                {isAuthenticated ? <MessageSquare size={17} /> : <LockKeyhole size={17} />}
                Review Queue
              </button>
            </div>
          </section>

          <section className="rating-card">
            <div className="rating-top">
              <span className="eyebrow">Quick Review</span>
              <strong>{isAuthenticated ? `${rating}.0` : 'Locked'}</strong>
            </div>
            <div className="rating-buttons" aria-label="Rate prototype">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  aria-label={`Rate ${value}`}
                  className={value <= rating ? 'filled' : ''}
                  onClick={() => requireAccount('Writing reviews') && setRating(value)}
                  key={value}
                >
                  <Star size={18} fill="currentColor" />
                </button>
              ))}
            </div>
            <textarea
              disabled={!isAuthenticated}
              value={reviewText}
              onChange={(event) => setReviewText(event.target.value)}
              onFocus={() => requireAccount('Writing reviews')}
              placeholder={
                isAuthenticated
                  ? 'Write what worked, what broke, and what would make you replay it.'
                  : 'Log in to leave reviews after taking a game.'
              }
            />
            <button className="review-submit" onClick={() => requireAccount('Submitting reviews')}>
              {isAuthenticated ? <MessageSquare size={17} /> : <LockKeyhole size={17} />}
              Submit review
            </button>
          </section>

          <section className="activity-card">
            <div className="section-mini">
              <MessageSquare size={18} />
              <strong>Recent Reviews</strong>
            </div>
            {reviews.length === 0 && <p className="empty-state">No reviews yet.</p>}
            {reviews.map(([user, game, text]) => (
              <div className="review-item" key={`${user}-${game}`}>
                <span>{user}</span>
                <small>{game}</small>
                <p>{text}</p>
              </div>
            ))}
          </section>

          <section className="activity-card">
            <div className="section-mini">
              <Crown size={18} />
              <strong>Community Pulse</strong>
            </div>
            {activity.length === 0 && <p className="empty-state">No activity yet.</p>}
            {activity.map(([user, action, meta]) => (
              <div className="activity-item" key={`${user}-${action}`}>
                <span>{user}</span>
                <p>{action}</p>
                <small>{meta}</small>
              </div>
            ))}
          </section>
        </aside>
      </section>

      <section className="bottom-board">
        <div>
          <Sparkles size={22} />
          <strong>Hidden Gems</strong>
          <span>Prototype games with fewer than 1,000 plays and high reviewer signal.</span>
        </div>
        <div>
          <Swords size={22} />
          <strong>Jam Arena</strong>
          <span>72-hour theme: one room, one mechanic, one unforgettable twist.</span>
        </div>
        <div>
          <Zap size={22} />
          <strong>Fast Feedback</strong>
          <span>Creators can request structured reviews from trusted testers.</span>
        </div>
      </section>
        </>
      )}

      {isLogoutConfirmOpen && (
        <div className="modal-backdrop" role="presentation">
          <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="logout-title">
            <h2 id="logout-title">Log out of GemSpot?</h2>
            <p>Your session will be removed from this browser.</p>
            <div className="confirm-actions">
              <button className="back-button" onClick={() => setIsLogoutConfirmOpen(false)}>Cancel</button>
              <button className="danger-button" onClick={confirmLogout}><LogOut size={17} />Log out</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
export default App;
