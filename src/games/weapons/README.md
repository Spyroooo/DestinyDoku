# Weapons modes

- `#/weapons` and `#/weapons/practice`: unlimited practice with random answers.
- `#/weapons/daily`: one deterministic challenge for each Europe/Zurich date.

Both modes allow unlimited guesses. Practice can start another round after a win;
the daily challenge stays completed until the next Zurich midnight. Both use the
reviewed weapon catalogue and exclude Unreleased entries from hidden answers.

Daily date calculations explicitly use `Europe/Zurich`, independently of a
player's browser time zone. Reset timestamps follow calendar midnights, including
23-hour and 25-hour daylight-saving days. A timer and focus/visibility events
refresh the date; submitting a guess also checks the current date before accepting
it. A date change remounts the daily round without touching practice.

The existing `destinydoku:weapons:practice:v1` save is retained. Daily saves use
`destinydoku:weapons:daily:v1:YYYY-MM-DD`, storing the date, catalogue signature,
answer and guess history. Restoration checks both the expected daily answer and
the normal round invariants. Storage failures leave both modes usable and show
the existing storage notice.

Daily answer selection sorts eligible IDs before hashing the Zurich date, so
JSON ordering does not affect the result. The current catalogue determines the
answer pool; an incompatible catalogue update resets saved rounds as before.
Daily share results include their date and the daily-mode link. The page shows
only the reset countdown, without naming the time zone.

During local Vite development, round restoration and persistence are disabled.
Reloading starts a fresh test round, and edits trigger a development-only custom
HMR event that remounts the round. Development daily resets also select a different
eligible weapon, excluding the previous test answer. Session storage remembers
that answer across reloads. Production daily selection remains date-based, with
normal progress restoration and saving.

Selecting a search suggestion fills the input and closes the dropdown. Submitting
the form records the guess. Winning shows the original result panel above the comparison history, followed
by the original numbered share grid. Only the result headings and wording are
updated. Practice offers another round; daily offers a link to practice.

`scripts/test-weapons-daily.mjs` covers midnight boundaries, daylight-saving
transitions, deterministic selection, unreleased exclusions, date-separated
saves, win restoration, stale saves and mode-specific sharing.
`scripts/test-weapons-interface.mjs` covers selecting versus submitting, the
completed-run panel and retained history, development reset events and release-build save restoration.
