# GemSpot

GemSpot is a free indie game portal inspired by Newgrounds: a place where creators publish games, players discover them, and feedback helps projects improve.

## Core Idea

Build a community-powered platform for free games where users can:

- create accounts
- publish game projects
- play browser games or download builds
- leave ratings, reviews, and comments
- discover new and underrated games
- follow creators
- see featured projects

## First MVP

The first version should stay focused:

- homepage with a game feed
- user accounts
- creator profiles
- project upload flow
- project pages
- tags and search
- ratings and written reviews
- comments
- basic admin moderation

Later features can include game jams, medals, collections, collaborator credits, reviewer reputation, and playtest rooms.

## What GemSpot Is For

GemSpot is not a game engine. It is a platform for:

- hosting game projects
- discovering indie games
- downloading approved game files
- reviewing games
- managing creator profiles
- moderating unsafe uploads

---

## Project Status

GemSpot is currently an early MVP.

The project already includes:

- account creation
- login and logout
- creator profiles
- profile editing
- game uploading
- game cover images
- game archive scanning
- moderator upload review
- admin user management
- public game discovery
- search for games and creators
- creator project management
- game publishing
- game archiving
- database tables for claims and reviews
- game review API endpoints
- game detail and review page

Some features are still incomplete:

- browser-playable games
- comments
- forums
- game jams
- followers
- notifications
- play-count tracking
- reviewer reputation
- collections
- version-based reviews
- automated tests
- production deployment

---

## Accounts and Permissions

GemSpot does not have separate player and creator accounts.

Every normal account can act as both:

- a player who discovers, downloads, and reviews games
- a creator who uploads and manages game projects

A user can create a profile, play other people’s games, review games, upload their own games, and publish their own projects using the same account.

### Normal accounts

Normal users can:

- create an account
- edit their profile
- browse published games
- search and filter games
- download approved games
- leave ratings and reviews
- edit their own reviews
- upload game projects
- add descriptions, genres, and cover images
- view their own projects
- publish approved games
- archive their own games

A game is not immediately public after upload. It must pass the upload review process first.

### Moderators

Moderators are normal users with additional upload-safety permissions. They can:

- view the manual upload-review queue
- download quarantined uploads
- inspect uploaded files
- approve uploads
- reject uploads
- add rejection notes
- view the current scanning mode

### Administrators

Administrators are users with the highest management permissions. They can:

- do everything normal users and moderators can do
- manage users
- ban users
- unban users
- manage games
- change upload scanning settings
- archive games when necessary

### What We Need to Do Next
The game page should include:
- cover image
- game title
- creator name
- creator profile link
- genre
- description
- download button
- file name
- file size
- upload date
- published status
- average rating
- review count
- existing reviews
- review form
- related games

## Improve creator project management
Creators should be able to:
- edit the game title
- edit the description
- edit the genre
- view scan status
- view publication status
- view review average
- view review count
- view download count
- unpublish a game
- archive a game
- restore an archived game

### Add community features
Later community features can include:
- following creators
- forums
- game jams
- collections
- favorites
- helpful votes
- reviewer reputation
- creator achievements
