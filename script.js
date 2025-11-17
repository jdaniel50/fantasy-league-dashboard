/* ------------------------------------------
   CONFIGURATION
-------------------------------------------*/

const LEAGUES = {
  lor: {
    name: "League of Record",
    id: "1186844188245356544",
    hasDivisions: true,
    divisions: {
      East: [
        "Gridiron Man",
        "Scuttlebucs",
        "Pigskin Prophtz",
        "🦅Go Birds🦅",
        "Game of Throws"
      ],
      West: [
        "Mighty Mallards",
        "The Aman-Ra Stars",
        "The Juggernauts",
        "Overdrive",
        "Black Panther"
      ]
    }
  },
  ffl: {
    name: "FFL",
    id: "1257084943821967360",
    hasDivisions: false
  },
  dynasty: {
    name: "Dynasty Champs",
    id: "1186825886808555520",
    hasDivisions: true,
    divisions: {
      East: [
        "Black Panther",
        "Knights of Columbus",
        "Venomous Vipers",
        "Swamp Pirates",
        "Baby Got Dak"
      ],
      West: [
        "Gotham City",
        "WillXposU",
        "Howling Commandos",
        "Aggressive Chickens",
        "Game of Throws"
      ]
    }
  }
};

/* ------------------------------------------
   LAST WEEK (WEEK 10) SNAPSHOTS
-------------------------------------------*/

const LAST_WEEK_STANDINGS = {
  lor: {
    East: [
      "Gridiron Man",
      "Scuttlebucs",
      "Pigskin Prophtz",
      "🦅Go Birds🦅",
      "Game of Throws"
    ],
    West: [
      "Mighty Mallards",
      "The Aman-Ra Stars",
      "The Juggernauts",
      "Overdrive",
      "Black Panther"
    ]
  },
  ffl: [
    "UCDUST",
    "Primetime Primates",
    "The Chancla Warriors",
    "Metros Fields of Dreams",
    "Aggressive Chickens",
    "StreetGliders",
    "UnstoppableBoyz",
    "Team HazeHunters13",
    "Dom Perignons",
    "Cabuloso"
  ],
  dynasty: {
    East: [
      "Black Panther",
      "Knights of Columbus",
      "Venomous Vipers",
      "Swamp Pirates",
      "Baby Got Dak"
    ],
    West: [
      "Gotham City",
      "WillXposU",
      "Howling Commandos",
      "Aggressive Chickens",
      "Game of Throws"
    ]
  }
};

const LAST_WEEK_POWER = {
  lor: [
    "Scuttlebucs",
    "Gridiron Man",
    "The Aman-Ra Stars",
    "Mighty Mallards",
    "The Juggernauts",
    "Pigskin Prophtz",
    "🦅Go Birds🦅",
    "Game of Throws",
    "Overdrive",
    "Black Panther"
  ],
  ffl: [
    "Metros Fields of Dreams",
    "UnstoppableBoyz",
    "UCDUST",
    "Primetime Primates",
    "Team HazeHunters13",
    "The Chancla Warriors",
    "StreetGliders",
    "Cabuloso",
    "Aggressive Chickens",
    "Dom Perignons"
  ],
  dynasty: [
    "Gotham City",
    "Black Panther",
    "Swamp Pirates",
    "Knights of Columbus",
    "WillXposU",
    "Howling Commandos",
    "Venomous Vipers",
    "Baby Got Dak",
    "Aggressive Chickens",
    "Game of Throws"
  ]
};

/* ------------------------------------------
   GLOBAL STATE
-------------------------------------------*/

let currentLeagueKey = null;
let currentWeek = null;
const leagueDataCache = {};

let presentationMode = false;
let revealIndex = 0;

/* ------------------------------------------
   UTILITIES
-------------------------------------------*/

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

function normalize(str) {
  return String(str).trim().toLowerCase().replace(/\s+/g, "");
}

function getTeamName(roster, ownerMap) {
  const owner = ownerMap[roster.owner_id];
  return (
    owner?.metadata?.team_name ||
    owner?.display_name ||
    "Unknown"
  );
}

function teamAvatarHtml(roster, ownerMap) {
  if (!roster) {
    return `<div class="team-with-avatar"><span>Unknown</span></div>`;
  }
  const owner = ownerMap[roster.owner_id];
  const name = getTeamName(roster, ownerMap);
  const avatarId = owner?.avatar;
  if (!avatarId) {
    return `<div class="team-with-avatar"><span>${name}</span></div>`;
  }
  const url = `https://sleepercdn.com/avatars/thumbs/${avatarId}`;
  return `
    <div class="team-with-avatar">
      <img class="avatar" src="${url}" alt="${name} logo" />
      <span>${name}</span>
    </div>
  `;
}

function arrow(prev, now) {
  if (!prev || !now || prev === now) return "";
  const diff = prev - now;
  const dir = diff > 0 ? "↑" : "↓";
  return `${dir}${Math.abs(diff)}`;
}

/* ------------------------------------------
   DOMCONTENTLOADED
-------------------------------------------*/

document.addEventListener("DOMContentLoaded", () => {
  const leagueButtons = document.querySelectorAll(".league-tabs .tab-btn");
  const subtabsEl = document.getElementById("subtabs");
  const subtabButtons = subtabsEl.querySelectorAll(".tab-btn");
  const toggleBtn = document.getElementById("presentation-toggle");
  const nextBtn = document.getElementById("next-reveal");

  // League tabs
  leagueButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      leagueButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentLeagueKey = btn.dataset.league;

      subtabsEl.style.display = "flex";
      subtabButtons.forEach(b => b.classList.remove("active"));
      subtabsEl
        .querySelector('[data-section="standings"]')
        .classList.add("active");

      loadSection("standings");
    });
  });

  // Subtabs
  subtabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      subtabButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      loadSection(btn.dataset.section);
    });
  });

  // Presentation toggle
  toggleBtn.addEventListener("click", () => {
    presentationMode = !presentationMode;
    toggleBtn.textContent = presentationMode
      ? "Presentation Mode: ON"
      : "Presentation Mode: OFF";

    revealIndex = 0;
    nextBtn.style.display = presentationMode ? "inline-block" : "none";

    if (currentLeagueKey) {
      const activeSection = document
        .querySelector(".subtabs .tab-btn.active")
        ?.dataset.section;
      if (activeSection) loadSection(activeSection);
    }
  });

  // Next reveal
  nextBtn.addEventListener("click", () => {
    if (!presentationMode) return;
    revealIndex++;
    applyReveal();
  });

  // NFL state
  fetchJson("https://api.sleeper.app/v1/state/nfl")
    .then(state => {
      currentWeek = state.display_week || state.week || 11;
    })
    .catch(() => {
      currentWeek = 11;
    });

  if (leagueButtons[0]) leagueButtons[0].click();
});

/* ------------------------------------------
   SECTION LOADER
-------------------------------------------*/

async function loadSection(section) {
  const container = document.getElementById("content");
  container.innerHTML = "<div class='section'>Loading...</div>";

  if (!currentLeagueKey) return;
  const league = LEAGUES[currentLeagueKey];

  if (!leagueDataCache[league.id]) {
    try {
      const [users, rosters] = await Promise.all([
        fetchJson(`https://api.sleeper.app/v1/league/${league.id}/users`),
        fetchJson(`https://api.sleeper.app/v1/league/${league.id}/rosters`)
      ]);
      leagueDataCache[league.id] = { users, rosters };
    } catch (err) {
      console.error(err);
      container.innerHTML = "<div class='section'>Could not load league data.</div>";
      return;
    }
  }

  if (section === "standings") renderStandings(league);
  if (section === "matchups") renderMatchups(league);
  if (section === "power") renderPowerRankings(league);
}

/* ------------------------------------------
   STANDINGS
-------------------------------------------*/

function renderStandings(league) {
  const container = document.getElementById("content");
  const { users, rosters } = leagueDataCache[league.id];

  const ownerMap = {};
  users.forEach(u => (ownerMap[u.user_id] = u));

  const sorted = [...rosters].sort((a, b) => {
    const wa = a.settings.wins || 0;
    const la = a.settings.losses || 0;
    const wb = b.settings.wins || 0;
    const lb = b.settings.losses || 0;
    const pctA = wa + la === 0 ? 0 : wa / (wa + la);
    const pctB = wb + lb === 0 ? 0 : wb / (wb + lb);
    if (pctB !== pctA) return pctB - pctA;
    const pfa = Number(a.settings.fpts ?? 0);
    const pfb = Number(b.settings.fpts ?? 0);
    return pfb - pfa;
  });

  const lastWeek = LAST_WEEK_STANDINGS[currentLeagueKey];

  let html = `<div class="section"><h2>${league.name} Standings</h2>`;

  if (league.hasDivisions && league.divisions) {
    Object.keys(league.divisions).forEach(divName => {
      const divList = league.divisions[divName];
      const lastWeekList = lastWeek[divName];
      html += `<h3>${divName} Division</h3>`;
      html += buildStandingsTable(
        league,
        sorted,
        ownerMap,
        divList,
        lastWeekList
      );
    });
  } else {
    html += buildStandingsTable(
      league,
      sorted,
      ownerMap,
      null,
      lastWeek
    );
  }

  html += "</div>";
  container.innerHTML = html;

  attachNoteHandlers();
  if (presentationMode) {
    revealIndex = 0;
    applyReveal();
  }
}

function buildStandingsTable(league, sortedRosters, ownerMap, divisionNames, lastWeekList) {
  let filtered = sortedRosters;

  if (divisionNames) {
    const divNorms = divisionNames.map(normalize);
    filtered = sortedRosters.filter(r => {
      const name = getTeamName(r, ownerMap);
      return divNorms.includes(normalize(name));
    });
  }

  let groups = "";

  filtered.forEach((team, idx) => {
    const name = getTeamName(team, ownerMap);
    const norm = normalize(name);
    const prevIndex = Array.isArray(lastWeekList)
      ? lastWeekList.findIndex(x => normalize(x) === norm)
      : -1;
    const thisRank = idx + 1;
    const prevRank = prevIndex === -1 ? null : prevIndex + 1;
    const changeDisplay = prevRank ? arrow(prevRank, thisRank) : "";

    const noteKey = `stand_note_${league.id}_${team.roster_id}`;
    const savedNote = localStorage.getItem(noteKey) || "";

    groups += `
      <tbody class="reveal-item">
        <tr>
          <td>${thisRank}</td>
          <td>${teamAvatarHtml(team, ownerMap)}</td>
          <td>${team.settings.wins || 0}-${team.settings.losses || 0}</td>
          <td>${Number(team.settings.fpts ?? 0).toFixed(2)}</td>
          <td>${changeDisplay}</td>
        </tr>
        <tr>
          <td colspan="5">
            <textarea class="note-box" data-save="${noteKey}" placeholder="Add note...">${savedNote}</textarea>
          </td>
        </tr>
      </tbody>
    `;
  });

  return `
    <table>
      <tr>
        <th>#</th>
        <th>Team</th>
        <th>Record</th>
        <th>PF</th>
        <th>Chg</th>
      </tr>
      ${groups}
    </table>
  `;
}

/* ------------------------------------------
   MATCHUPS
-------------------------------------------*/

async function renderMatchups(league) {
  const container = document.getElementById("content");
  const { users, rosters } = leagueDataCache[league.id];

  const ownerMap = {};
  users.forEach(u => (ownerMap[u.user_id] = u));

  const week = currentWeek || 1;
  container.innerHTML = `<div class="section"><h2>${league.name} — Week ${week} Matchups</h2><div>Loading...</div></div>`;

  let matchups;
  try {
    matchups = await fetchJson(
      `https://api.sleeper.app/v1/league/${league.id}/matchups/${week}`
    );
  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="section"><h2>${league.name} — Week ${week} Matchups</h2><div>Could not load matchups.</div></div>`;
    return;
  }

  const rosterMap = {};
  rosters.forEach(r => (rosterMap[r.roster_id] = r));

  const grouped = {};
  matchups.forEach(m => {
    if (!grouped[m.matchup_id]) grouped[m.matchup_id] = [];
    grouped[m.matchup_id].push(m);
  });

  let html = `<div class="section"><h2>${league.name} — Week ${week} Matchups</h2>`;

  Object.keys(grouped)
    .sort((a, b) => Number(a) - Number(b))
    .forEach(mid => {
      const teams = grouped[mid];
      if (!teams[0]) return;
      const t1 = teams[0];
      const t2 = teams[1];

      const p1 = typeof t1.points === "number" ? t1.points.toFixed(2) : "-";
      const p2 =
        t2 && typeof t2.points === "number" ? t2.points.toFixed(2) : "-";

      const noteKey = `match_note_${league.id}_${week}_${mid}`;
      const savedNote = localStorage.getItem(noteKey) || "";

      html += `
        <div class="reveal-item">
          <h3>Matchup ${mid}</h3>
          <table>
            <tr><th>Team</th><th>Points</th></tr>
            <tr>
              <td>${teamAvatarHtml(rosterMap[t1.roster_id], ownerMap)}</td>
              <td><strong>${p1}</strong></td>
            </tr>
            ${
              t2
                ? `<tr>
                    <td>${teamAvatarHtml(rosterMap[t2.roster_id], ownerMap)}</td>
                    <td><strong>${p2}</strong></td>
                  </tr>`
                : ""
            }
          </table>
          <textarea class="note-box" data-save="${noteKey}" placeholder="Add note...">${savedNote}</textarea>
        </div>
      `;
    });

  html += "</div>";
  container.innerHTML = html;

  attachNoteHandlers();
  if (presentationMode) {
    revealIndex = 0;
    applyReveal();
  }
}

/* ------------------------------------------
   POWER RANKINGS
-------------------------------------------*/

function renderPowerRankings(league) {
  const container = document.getElementById("content");
  const { users, rosters } = leagueDataCache[league.id];

  const ownerMap = {};
  users.forEach(u => (ownerMap[u.user_id] = u));

  const lastWeekList = LAST_WEEK_POWER[currentLeagueKey];
  const week = currentWeek || 1;

  let list = rosters.map(r => {
    const name = getTeamName(r, ownerMap);
    const rankKey = `power_${league.id}_${week}_${r.roster_id}`;
    const noteKey = `power_note_${league.id}_${week}_${r.roster_id}`;
    const savedRank = localStorage.getItem(rankKey);
    const savedNote = localStorage.getItem(noteKey) || "";
    return {
      roster: r,
      ownerMap,
      name,
      rankKey,
      noteKey,
      rank: savedRank ? Number(savedRank) : null,
      note: savedNote
    };
  });

  // sort by rank, blanks at bottom
  list.sort((a, b) => {
    if (!a.rank && !b.rank) return 0;
    if (!a.rank) return 1;
    if (!b.rank) return -1;
    return a.rank - b.rank;
  });

  let html = `
    <div class="section">
      <h2>${league.name} Power Rankings — Week ${week}</h2>
      <p class="small-label">Enter rankings. List auto-sorts after each change. Notes save automatically.</p>
      <table>
        <tr>
          <th>Team</th>
          <th>Rank</th>
          <th>Chg</th>
        </tr>
  `;

  list.forEach(item => {
    const prevIndex = lastWeekList.findIndex(
      x => normalize(x) === normalize(item.name)
    );
    const change =
      prevIndex !== -1 && item.rank
        ? arrow(prevIndex + 1, item.rank)
        : "";

    html += `
      <tbody class="reveal-item">
        <tr>
          <td>${teamAvatarHtml(item.roster, item.ownerMap)}</td>
          <td>
            <input
              class="power-input"
              type="number"
              min="1"
              max="${rosters.length}"
              data-save="${item.rankKey}"
              value="${item.rank ?? ""}"
            />
          </td>
          <td>${change}</td>
        </tr>
        <tr>
          <td colspan="3">
            <textarea
              class="note-box"
              data-save="${item.noteKey}"
              placeholder="Add note...">${item.note}</textarea>
          </td>
        </tr>
      </tbody>
    `;
  });

  html += "</table></div>";
  container.innerHTML = html;

  attachPowerHandlers(league);
  attachNoteHandlers();
  if (presentationMode) {
    revealIndex = 0;
    applyReveal();
  }
}

/* ------------------------------------------
   PRESENTATION MODE REVEAL
-------------------------------------------*/

function applyReveal() {
  if (!presentationMode) return;

  const sectionBtn = document.querySelector(".subtabs .tab-btn.active");
  const section = sectionBtn?.dataset.section || "standings";
  const items = Array.from(document.querySelectorAll(".reveal-item"));
  const nextBtn = document.getElementById("next-reveal");

  if (!items.length) {
    nextBtn.style.display = "none";
    return;
  }

  // Hide all
  items.forEach(el => {
    el.style.display = "none";
  });

  const total = items.length;

  if (section === "power") {
    // reveal from bottom (10 -> 1)
    for (let i = 0; i < revealIndex && i < total; i++) {
      const idxFromEnd = total - 1 - i;
      items[idxFromEnd].style.display = "";
    }
  } else {
    // standings + matchups: top-down
    for (let i = 0; i < revealIndex && i < total; i++) {
      items[i].style.display = "";
    }
  }

  nextBtn.style.display =
    presentationMode && revealIndex < total ? "inline-block" : "none";
}

/* ------------------------------------------
   AUTOSAVE HELPERS
-------------------------------------------*/

function attachNoteHandlers() {
  const notes = document.querySelectorAll(".note-box[data-save]");
  notes.forEach(el => {
    el.removeEventListener("input", noteInputHandler);
    el.addEventListener("input", noteInputHandler);
  });
}

function noteInputHandler(e) {
  const key = e.target.dataset.save;
  if (!key) return;
  localStorage.setItem(key, e.target.value);
}

function attachPowerHandlers(league) {
  const inputs = document.querySelectorAll(".power-input[data-save]");
  inputs.forEach(el => {
    el.removeEventListener("input", powerInputHandler);
    el.addEventListener("input", powerInputHandler.bind(null, league));
  });
}

function powerInputHandler(league, e) {
  const key = e.target.dataset.save;
  const val = e.target.value;
  if (!key) return;
  if (val === "") {
    localStorage.removeItem(key);
  } else {
    localStorage.setItem(key, val);
  }
  // re-render to re-sort after change
  renderPowerRankings(league);
}
