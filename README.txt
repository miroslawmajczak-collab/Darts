FLIGHT — offline touch darts
============================

QUICK START ON THIS WINDOWS LAPTOP

1. Double-click start.bat in this folder.
2. Your browser opens http://127.0.0.1:17840.
3. Pick a game, choose 1–6 players, enter names if desired, and tap Let's play.
   Tap a name field to open the built-in touch keyboard. Polish mode adds
   Polish letters. A physical keyboard works as well.
4. Use the full-screen icon in the top-right for touch play.

Node.js 20 or newer is the only server prerequisite. There are no package
downloads, npm installs, cloud services, databases, Python requirements or
internet calls. The launcher also detects the existing bundled Node runtime
on this laptop. On another computer install Node.js LTS once, then use the
same launcher. All fonts, illustrations and translations are local.

The Windows launcher runs the server in the background and reuses it on
subsequent launches. Closing the browser does not stop the server. Use
stop.bat to stop a server started by this launcher. To run visibly in a
terminal instead: node server.mjs (Ctrl+C stops it).

The server accepts connections only from this computer (127.0.0.1).
It deliberately does not offer phone/tablet or LAN access in this release.
If port 17840 is busy, set FLIGHT_PORT to a free port before launching.

PLAYING

X01: 301, 501 or 701. Straight-in. Choose straight-out or double-out.
Exactly zero wins. Overshooting busts; with double-out, leaving 1 or finishing
with a non-double also busts. A bust restores the score at the turn's start.
Inner bull counts as a double for finishing.

Cricket: close 20, 19, 18, 17, 16, 15 and bull using three marks each.
Singles/doubles/triples give one/two/three marks; outer/inner bull gives
one/two. Excess marks score only while at least one opponent has that
target open. Close every target and match or exceed all opponents' points
to win. Solo Cricket ends when every target is closed; no excess scoring.

Around the Clock: hit 1–20 in order. Any multiplier advances exactly one
target. Bull does not advance. First to complete target 20 wins.

Killer (doubles-only variant): 2–6 players, each with a unique number from
1 to 20, selected before starting. The defaults are 20, 19, 18, 17, 16, 15;
change them using the number selectors (for example after an off-hand draw).
Everyone starts with three lives. Hit your own double to become a Killer;
the arming dart costs no life. Once armed, each opponent's double takes one
of their lives; your own double takes one of YOUR lives. Singles, triples,
bull and unassigned numbers have no effect. Killer status is permanent.
Zero lives eliminates a player. Eliminated players are skipped, and losing
your own last life ends your turn immediately. The last survivor wins,
even if they never became a Killer. The display tracks lives and status.

Shanghai: seven rounds targeting 1 through 7 in order. Only the current
number scores, at its normal single/double/triple value. A single, double
and triple of that number within one turn, in any order, wins immediately.
Otherwise everyone completes all seven rounds; the highest total wins.
Tied leaders share the win. Solo play ends on a Shanghai or after round 7.
The display tracks the target schedule and current S/D/T combination.

Halve-it: start at 40. Nine rounds: 15, 16, any numbered double, 17, 18,
any triple, 19, 20, bull. Matching hits add their normal points. In the bull
round both outer (25) and inner (50) bull count. Inner bull does NOT qualify
as a numbered double. If all three darts miss the round's target, halve
the running score after the third dart, rounding DOWN to a whole number.
Highest total after everyone completes bull wins; ties share the win.
Solo play completes nine rounds. The display tracks targets and penalties.

These casual games have house-rule variants. The exact variants above
are explained in English and Polish under Game rules before starting and
Rules for this game during play. Corrections and undo replay all mechanics,
including lives, arming, eliminations, combinations, penalties and results.

Each turn has up to three darts. Enter every dart including misses.
Choose Single, Double or Triple, then tap a number. The multiplier resets
to Single after every entry. Bull, Inner bull and Miss have dedicated keys.
You may also tap an actual segment on the dartboard. The keypad is easier
for accurate touch entry in narrow double and triple rings.

The board highlights approximate segment positions, not measured landing
points. Numbered markers represent the current turn's darts.

Tap a recorded dart card to correct it. Later darts are replayed if still
valid. If the corrected dart ends the turn early, later input is discarded
and the app explains this. Undo removes the latest dart; immediately after
Next player, it returns to the previous player and removes their last dart.

After three darts or a bust, remove darts and tap Next player / Next turn.
Pause opens Resume and End game. A completed game offers results, a rematch
and a new game. The first winner ends multiplayer games.

MEMORY AND SETTINGS

The active game exists ONLY in browser memory. A browser refresh, closing
the tab, or power loss clears it. The browser warns before leaving a game
where supported. A second tab is an independent game, not a second display
of the same session. Keep one kiosk tab open.

EN/PL switches language without changing the active game. This choice lasts
for the current page; the saved default comes from admin settings.

Admin: tap the small settings icon at the bottom of the start screen.
On first use choose your own password (8–128 characters). There is no
default password. Subsequent visits require login. Admin sessions expire
after 15 minutes. Defaults apply to a fresh page; they never change an
ongoing game or overwrite the current setup form.

Defaults: config/settings.json
Admin credential hash: config/admin.json (created on first admin setup).
Passwords are salted and hashed. Writes are serialized and use a temporary
file followed by replacement. There is no game history saved to disk.
To reset a forgotten admin password, stop the server, remove admin.json
and start again. Anyone with filesystem access can do this; admin access
protects settings through the app, not against the device owner.

ADDING A LANGUAGE

1. Copy web/locales/en.json to e.g. web/locales/de.json.
2. Translate the values; preserve keys and placeholders such as {name}.
   Whole sentences are stored independently to avoid joining fragments.
3. Add { "code": "de", "name": "Deutsch" } to locales/languages.json.
4. Restart the server and refresh. The language button cycles through all
   registered languages; admin defaults list them automatically.
Missing message keys fall back to English. The current text avoids dynamic
plural sentences; introduce locale-aware plural formatting if adding them.

ARCHITECTURE AND FUTURE CAMERAS

web/js/engine.js: pure game rules and action-history replay; no DOM/server.
web/js/app.js: session controller, touch UI, admin UI and localization.
web/js/board.js: standard board layout, selectable segments and markers.
server.mjs: local static serving, settings validation and admin sessions.

Game actions are the source of truth. Derived scores are never edited
directly. New games can be added as additional reducers with corresponding
views. X01, Cricket and Clock already have separate rule branches.

The exported throwInput adapter in app.js accepts a normalized camera
candidate: {id, number, multiplier, requiresConfirmation, boardPosition}.
IDs provide duplicate protection. Candidates marked requiresConfirmation
are rejected with REVIEW_REQUIRED, rather than silently scored. A future
camera service needs a transport and review UI, camera calibration, board
readiness and removal detection. None are installed or claimed functional.

Optional boardPosition uses x/y coordinates in board-plane millimetres
relative to centre (positive x right, positive y down; double outer radius
170). Manual throws omit this; their markers indicate segments only.

LINUX MINI PC

Prerequisites: Node.js >=20 and a graphical browser. Copy this folder to
the device, then run: sh start.sh
Open http://127.0.0.1:17840 in Chromium. No Windows dependencies are used by
the application. Windows launchers are convenience wrappers only.

For appliance deployment (template configuration, not installed here):
1. Copy the app to /opt/flight, excluding logs and any personal admin.json.
2. Create a dedicated unprivileged Linux user named flight.
3. Give it write access to /opt/flight/config; keep application files owned
   by the administrator. Ensure /usr/bin/node exists, or adjust ExecStart.
4. Install deploy/flight.service into /etc/systemd/system, then use
   systemctl daemon-reload and systemctl enable --now flight.
5. Configure a lightweight graphical session with automatic login for the
   kiosk user. Install Chromium and curl. Put flight-kiosk.desktop into
   that user's ~/.config/autostart, adjusting paths if necessary.
   For compositors without XDG autostart, invoke sh /opt/flight/deploy/kiosk.sh
   from the session's own startup configuration.
6. Disable display sleep for that session as appropriate to the device.

The service does not wait for networking or internet. The kiosk waits for
the local server health endpoint rather than sleeping for a fixed interval.
Saved settings load without camera initialization. Linux boot time and
power-to-screen time must be measured on the actual target device.
These Linux templates have not been exercised on a physical mini PC here.

UPDATES

Stop the server before replacing application files. Preserve config/.
Keep config backed up if calibration is added later. Avoid copying logs,
admin passwords/hashes or device-specific settings into a shared release.

TESTS

From this folder:
  node --test --test-isolation=none tests/engine.test.mjs tests/new-games.test.mjs tests/server.test.mjs

The isolation flag avoids restricted Windows child-process spawning and
requires a recent Node release (Node 24 used for verification). On older
Node versions use node --test tests/engine.test.mjs tests/new-games.test.mjs tests/server.test.mjs.
Tests use Node built-ins and write temporary fixtures under a work folder
outside this app directory. They never modify your live settings.

Checks cover game rules, all six player positions, busts and wins, bull,
corrections, undo, duplicate input, pause, admin authentication, origin
checks, saved settings and matching Polish/English translation keys.
