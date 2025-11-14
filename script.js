/* ---------------------------------------------------------
   CONFIGURATION
--------------------------------------------------------- */

const LEAGUES = {
  lor: {
    name: "League of Record",
    id: "1186844188245356544",
    hasDivisions: true
  },
  ffl: {
    name: "FFL",
    id: "1257084943821967360",
    hasDivisions: false
  },
  dynasty: {
    name: "Dynasty Champs",
    id: "1186825886808555520",
    hasDivisions: true
  }
};

/* ---------------------------------------------------------
   LAST WEEK = WEEK 10 SNAPSHOT
--------------------------------------------------------- */

/*
We will fuzzy-match names so even if Sleeper capitalization
or spacing differs, the system will still align teams correctly.
*/

const LAST_WEEK_STANDINGS = {
  lor: {
    East: [
      "Gridiron Man",
      "Scuttlebucs",
      "Pigskin Prophtz",
      "Go Birds",
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
    "Go Birds",
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


/* ---------------------------------------------------------
   GLOBAL STATE
--------------------------------------------------------- */

let currentLeagueKey = null;
let currentWeek = null;
const leagueDataCache = {};

document.addEventListener("DOMContentLoaded", () => {
  const leagueButtons = document.querySelectorAll(".league-tabs .tab-btn");
  const subtabsEl = document.getElementById("subtabs");
  const subtabButtons = subtabsEl.querySelectorAll(".tab-btn");

  leagueButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      leagueButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      currentLeagueKey = btn.dataset.league;

      subtabsEl.style.display = "flex";
      subtabButtons.forEach(b => b.classList.remove("active"));
      subtabsEl.querySelector('[data-section="standings"]').classList.add("active");

      loadSection("standings");
    });
  });

  subtabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      subtabButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      loadSection(btn.dataset.section);
    });
  });

  fetchJson("https://api.sleeper.app/v1/state/nfl")
    .then(state => {
      currentWeek = state.display_week || state.week || 11;
    })
    .catch(() => {
      currentWeek = 11;
    });

  leagueButtons[0].click();
});

/* ---------------------------------------------------------
   FETCH HELPERS
--------------------------------------------------------- */

async function fetchJson(url) {
  const res = await fetch(url);
  return res.json();
}

function normalize(str) {
  return String(str).trim().toLowerCase().replace(/\s+/g, "");
}

function teamAvatarHtml(roster, ownerMap) {
  const owner = ownerMap[roster.owner_id];
  const name = owner?.metadata?.team_name || owner?.display_name || "Unknown";
  const avatar = owner?.avatar;
  if (!avatar) {
    return `<div class="team-with-avatar"><span>${name}</span></div>`;
  }
  return `
    <div class="team-with-avatar">
      <img class="avatar" src="https://sleepercdn.com/avatars/thumbs/${avatar}" />
      <span>${name}</span>
    </div>`;
}

function getTeamName(roster, ownerMap) {
  const owner = ownerMap[roster.owner_id];
  return owner?.metadata?.team_name || owner?.display_name;
}


/* ---------------------------------------------------------
   LOAD SECTION
--------------------------------------------------------- */

async function loadSection(section) {
  const container = document.getElementById("content");
  container.innerHTML = "Loading…";

  const league = LEAGUES[currentLeagueKey];

  if (!leagueDataCache[league.id]) {
    const [users, rosters] = await Promise.all([
      fetchJson(`https://api.sleeper.app/v1/league/${league.id}/users`),
      fetchJson(`https://api.sleeper.app/v1/league/${league.id}/rosters`)
    ]);
    leagueDataCache[league.id] = { users, rosters };
  }

  if (section === "standings") renderStandings(league);
  if (section === "matchups") renderMatchups(league);
  if (section === "power") renderPowerRankings(league);
}


/* ---------------------------------------------------------
   RENDER STANDINGS (WITH CHANGE FROM WEEK 10)
--------------------------------------------------------- */

function renderStandings(league) {
  const container = document.getElementById("content");
  const { users, rosters } = leagueDataCache[league.id];
  const ownerMap = {};
  users.forEach(u => ownerMap[u.user_id] = u);

  const sorted = [...rosters].sort((a, b) => {
    const pctA = a.settings.wins / (a.settings.wins + a.settings.losses || 1);
    const pctB = b.settings.wins / (b.settings.wins + b.settings.losses || 1);
    if (pctB !== pctA) return pctB - pctA;
    return b.settings.fpts - a.settings.fpts;
  });

  let html = `<div class="section"><h2>${league.name} Standings</h2>`;

  // Dyn + LoR as divisions
  const lastWeek = LAST_WEEK_STANDINGS[currentLeagueKey];

  if (league.hasDivisions) {
    for (const div in lastWeek) {
      html += `<h3>${div}</h3>`;
      html += buildStandingsTable(sorted, ownerMap, lastWeek[div]);
    }
  } else {
    html += buildStandingsTable(sorted, ownerMap, lastWeek);
  }

  html += "</div>";
  container.innerHTML = html;
}

function buildStandingsTable(sorted, ownerMap, lastWeekNames) {
  const container = [];

  sorted.forEach((team, idx) => {
    const name = getTeamName(team, ownerMap);
    const norm = normalize(name);
    const prevIndex = lastWeekNames.findIndex(x => normalize(x) === norm);
    const change = prevIndex === -1 ? "" : arrow(prevIndex + 1, idx + 1);

    container.push(`
      <tr>
        <td>${idx + 1}</td>
        <td>${teamAvatarHtml(team, ownerMap)}</td>
        <td>${team.settings.wins}-${team.settings.losses}</td>
        <td>${team.settings.fpts.toFixed(2)}</td>
        <td>${change}</td>
      </tr>
    `);
  });

  return `
    <table>
      <tr><th>#</th><th>Team</th><th>Record</th><th>PF</th><th>Chg</th></tr>
      ${container.join("")}
    </table>`;
}


/* ---------------------------------------------------------
   MATCHUPS
--------------------------------------------------------- */

async function renderMatchups(league) {
  const container = document.getElementById("content");
  const { users, rosters } = leagueDataCache[league.id];

  const ownerMap = {};
  users.forEach(u => ownerMap[u.user_id] = u);

  const week = currentWeek;
  const matchups = await fetchJson(
    `https://api.sleeper.app/v1/league/${league.id}/matchups/${week}`
  );

  const rosterMap = {};
  rosters.forEach(r => rosterMap[r.roster_id] = r);

  const grouped = {};
  matchups.forEach(m => {
    if (!grouped[m.matchup_id]) grouped[m.matchup_id] = [];
    grouped[m.matchup_id].push(m);
  });

  let html = `<div class="section"><h2>${league.name} — Week ${week} Matchups</h2>`;

  Object.keys(grouped).forEach(id => {
    const [a, b] = grouped[id];

    html += `
      <h3>Matchup ${id}</h3>
      <table>
        <tr><th>Team</th><th>Points</th></tr>
        <tr>
          <td>${teamAvatarHtml(rosterMap[a.roster_id], ownerMap)}</td>
          <td>${(a.points ?? 0).toFixed(2)}</td>
        </tr>
        ${b ? `
        <tr>
          <td>${teamAvatarHtml(rosterMap[b.roster_id], ownerMap)}</td>
          <td>${(b.points ?? 0).toFixed(2)}</td>
        </tr>` : ""}
      </table>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;
}


/* ---------------------------------------------------------
   POWER RANKINGS (WITH CHANGE FROM WEEK 10)
--------------------------------------------------------- */

function renderPowerRankings(league) {
  const container = document.getElementById("content");
  const { users, rosters } = leagueDataCache[league.id];
  const ownerMap = {};
  users.forEach(u => ownerMap[u.user_id] = u);

  const lastWeekList = LAST_WEEK_POWER[currentLeagueKey];

  let html = `<div class="section"><h2>${league.name} Power Rankings — Week ${currentWeek}</h2>`;
  html += `<table><tr><th>Team</th><th>Rank</th><th>Chg</th></tr>`;

  rosters.forEach(r => {
    const name = getTeamName(r, ownerMap);
    const norm = normalize(name);
    const prevIndex = lastWeekList.findIndex(x => normalize(x) === norm);

    const rankKey = `power_${league.id}_${currentWeek}_${r.roster_id}`;
    const currentRank = localStorage.getItem(rankKey) || "";

    const change =
      prevIndex === -1 || !currentRank
        ? ""
        : arrow(prevIndex + 1, Number(currentRank));

    html += `
      <tr>
        <td>${teamAvatarHtml(r, ownerMap)}</td>
        <td>
          <input class="power-input" data-save="${rankKey}" type="number"
                 min="1" max="${rosters.length}" value="${currentRank}">
        </td>
        <td>${change}</td>
      </tr>
    `;
  });

  html += `</table></div>`;
  container.innerHTML = html;

  attachAutosaveHandlers();
}


/* ---------------------------------------------------------
   ARROW FUNCTION
--------------------------------------------------------- */

function arrow(prev, now) {
  if (prev === now) return "";
  return prev > now ? `↑${prev - now}` : `↓${now - prev}`;
}


/* ---------------------------------------------------------
   AUTOSAVE
--------------------------------------------------------- */

function attachAutosaveHandlers() {
  document.querySelectorAll("[data-save]").forEach(el => {
    el.oninput = () => localStorage.setItem(el.dataset.save, el.value);
  });
}
