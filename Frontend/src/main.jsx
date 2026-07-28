import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Bell,
  CheckCircle2,
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
} from 'lucide-react';
import './styles.css';

const navItems = ['Games', 'Creators', 'Jams', 'Reviews', 'Forum'];
const filters = ['Featured', 'Fresh', 'Underrated', 'Browser Play', 'Download'];

const games = [
  {
    title: 'Moonlit Delivery',
    creator: 'RivaByte',
    tag: 'Platformer',
    score: '4.8',
    plays: '18.2k',
    reviews: 1240,
    mode: 'Browser Play',
    palette: 'sunset',
  },
  {
    title: 'Circuit Coven',
    creator: 'NullWitch',
    tag: 'Puzzle',
    score: '4.6',
    plays: '9.7k',
    reviews: 680,
    mode: 'Fresh',
    palette: 'mint',
  },
  {
    title: 'Tiny Siege Lab',
    creator: 'ForgeChild',
    tag: 'Strategy',
    score: '4.4',
    plays: '6.4k',
    reviews: 312,
    mode: 'Underrated',
    palette: 'violet',
  },
  {
    title: 'Graveyard Kart',
    creator: 'LatePixel',
    tag: 'Racing',
    score: '4.9',
    plays: '24.1k',
    reviews: 1810,
    mode: 'Download',
    palette: 'lime',
  },
];

const reviews = [
  ['PixelMira', 'Moonlit Delivery', 'Clean controls, generous checkpoints, and a great final chase.'],
  ['ByteVlad', 'Circuit Coven', 'The puzzle language clicks fast, but level six needs a hint pass.'],
  ['SoftCrash', 'Graveyard Kart', 'Chaotic in the best way. Needs better controller prompts before release.'],
];

const activity = [
  ['KaraFrame', 'reviewed Moonlit Delivery', '+230 rep'],
  ['AsterForge', 'posted a devlog update', '12 min'],
  ['PatchKit', 'uploaded v0.8.1', '34 min'],
  ['LumaTest', 'opened a playtest room', '1 hr'],
];

function App() {
  const [activeFilter, setActiveFilter] = useState('Featured');
  const [query, setQuery] = useState('');
  const [rating, setRating] = useState(4);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [gateNotice, setGateNotice] = useState('');
  const [reviewText, setReviewText] = useState('');

  const visibleGames = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return games.filter((game) => {
      const matchesFilter = activeFilter === 'Featured' || game.mode === activeFilter;
      const matchesQuery =
        !normalizedQuery ||
        game.title.toLowerCase().includes(normalizedQuery) ||
        game.creator.toLowerCase().includes(normalizedQuery) ||
        game.tag.toLowerCase().includes(normalizedQuery);
      return matchesFilter && matchesQuery;
    });
  }, [activeFilter, query]);

  const requireAccount = (action) => {
    if (isAuthenticated) {
      setGateNotice('');
      return true;
    }

    setGateNotice(`${action} needs a GemSpot account first.`);
    return false;
  };

  const startDemoSession = () => {
    setIsAuthenticated(true);
    setGateNotice('');
  };

  const endDemoSession = () => {
    setIsAuthenticated(false);
    setGateNotice('You are browsing as a guest. Games and reviews stay visible.');
  };

  return (
    <main className="app-shell">
      <header className="site-header">
        <div className="top-strip">
          <a className="brand" href="#" aria-label="GemSpot home">
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
                <span className="account-pill">
                  <CheckCircle2 size={16} />
                  Logged in
                </span>
                <button className="icon-button" onClick={endDemoSession} aria-label="Log out">
                  <LogOut size={19} />
                </button>
              </div>
            ) : (
              <div className="account-cluster">
                <button className="ghost-button" onClick={startDemoSession}>
                  <LogIn size={17} />
                  Log in
                </button>
                <button className="upload-button" onClick={startDemoSession}>
                  <UserPlus size={18} />
                  Create account
                </button>
              </div>
            )}
          </div>
        </div>

        <nav className="main-nav" aria-label="Primary navigation">
          {navItems.map((item, index) => (
            <a className={index === 0 ? 'active' : ''} href="#" key={item}>
              {item}
            </a>
          ))}
        </nav>
      </header>

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
            <button className="secondary" onClick={() => requireAccount('Uploading a project')}>
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
              <button onClick={() => requireAccount('Uploading a project')}>
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
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
