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
        "Howling Comandos",
        "Aggressive Chickens",
        "Game of Throws"
      ]
    }
  }
};

let currentLeagueKey = null;
let currentWeek = null;
const leagueDataCache = {};

/* ------------------------------------------
   UTILITIES
-------------------------------------------*/

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed ${res.status} ${res.statusText}`);
  }
  return res.json();
}

function teamName(roster, ownerMap) {
  if (!roster) return "Unknown";
  const owner = ownerMap[roster.owner_id];
  return (
    (owner && owner.metadata && owner.metadata.team_name) ||
    (owner && owner.display_name) ||
    "Unknown"
  );
}

function teamAvatarHtml(roster, ownerMap) {
  if (!roster) {
    return "Unknown";
  }
  const owner = ownerMap[roster.owner_id];
  const name = teamName(roster, ownerMap);
  const avatarId = owner && owner.avatar;
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

/* ------------------------------------------
   INIT AFTER DOM READY
-------------------------------------------*/

document.addEventListener("DOMContentLoaded", () => {
  const leagueButtons = document.querySelectorAll(".league-tabs .tab-btn");
  const subtabsEl = document.getElementById("subtabs");
  const subtabButtons = subtabsEl ? subtabsEl.querySelectorAll(".tab-btn") : [];

  if (!leagueButtons.length || !subtabsEl || !subtabButtons.length) {
    console.error("Required tab elements not found in DOM");
    return;
  }

  leagueButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      leagueButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      currentLeagueKey = btn.dataset.league;

      subtabsEl.style.display = "flex";
      subtabButtons.forEach(b => b.classList.remove("active"));
      const standingsBtn = subtabsEl.querySelector('[data-section="standings"]');
      if (standingsBtn) standingsBtn.classList.add("active");

      loadSection("standings");
    });
  });

  subtabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      subtabButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const section = btn.dataset.section;
      loadSection(section);
    });
  });

  fetchJson("https://api.sleeper.app/v1/state/nfl")
    .then(state => {
      currentWeek = state.display_week || state.week || 1;
    })
    .catch(err => {
      console.error("Could not load NFL state", err);
      currentWeek = 1;
    });

  if (leagueButtons[0]) {
    leagueButtons[0].click();
  }
});

/* ------------------------------------------
   SECTION LOADER
-------------------------------------------*/

async function loadSection(section) {
  const container = document.getElementById("content");
  container.innerHTML = "<div class='section'>Loading...</div>";

  if (!currentLeagueKey) {
    container.innerHTML = "<div class='section'>Select a league above.</div>";
    return;
  }

  const league = LEAGUES[currentLeagueKey];

  if (!leagueDataCache[league.id]) {
    try {
      const [users, rosters] = await Promise.all([
        fetchJson(`https://api.sleeper.app/v1/league/${league.id}/users`),
        fetchJson(`https://api.sleeper.app/v1/league/${league.id}/rosters`)
      ]);
      leagueDataCache[league.id] = { users, rosters };
    } catch (err) {
      console.error("Error loading league data", err);
      container.innerHTML = "<div class='section'>Could not load league data.</div>";
      return;
    }
  }

  if (section === "standings") {
    renderStandings(league);
  } else if (section === "matchups") {
    renderMatchups(league);
  } else if (section === "power") {
    renderPowerRankings(league);
  }
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

  let html = `<div class="section"><h2>${league.name} Standings</h2>`;

  if (league.hasDivisions && league.divisions) {
    Object.keys(league.divisions).forEach(divName => {
      html += `<h3>${divName} Division</h3>`;
      html += buildStandingsTable(league, divName, sorted, ownerMap);
    });
  } else {
    html += buildStandingsTable(league, null, sorted, ownerMap);
  }

  html += "</div>";
  container.innerHTML = html;

  attachAutosaveHandlers();
}

function buildStandingsTable(league, divisionName, sortedRosters, ownerMap) {
  let filtered = sortedRosters;
  if (divisionName) {
    const namesInDiv = league.divisions[divisionName];
    filtered = sortedRosters.filter(r => namesInDiv.includes(teamName(r, ownerMap)));
  }

  let rows = "";

  filtered.forEach((team, idx) => {
    const wins = team.settings.wins || 0;
    const losses = team.settings.losses || 0;
    const pf = Number(team.settings.fpts ?? 0).toFixed(2);

    const thisRank = idx + 1;
    const week = currentWeek || 1;
    const prevWeek = week - 1;
    const prevKey = `stand_${league.id}_${team.roster_id}_${prevWeek}`;
    const thisKey = `stand_${league.id}_${team.roster_id}_${week}`;
    const prevRankStr = localStorage.getItem(prevKey);
    const prevRank = prevRankStr ? Number(prevRankStr) : null;
    let changeDisplay = "";
    if (prevRank && prevRank !== thisRank) {
      const diff = prevRank - thisRank;
      const arrow = diff > 0 ? "↑" : "↓";
      changeDisplay = `${arrow}${Math.abs(diff)}`;
    }

    const noteKey = `note_${league.id}_${team.roster_id}`;
    const savedNote = localStorage.getItem(noteKey) || "";

    rows += `
      <tr>
        <td>${thisRank}</td>
        <td>${teamAvatarHtml(team, ownerMap)}</td>
        <td>${wins}-${losses}</td>
        <td>${pf}</td>
        <td>${changeDisplay}</td>
      </tr>
      <tr>
        <td colspan="5">
          <textarea class="note-box" data-save="${noteKey}" placeholder="Add note...">${savedNote}</textarea>
        </td>
      </tr>
    `;

    localStorage.setItem(thisKey, String(thisRank));
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
      ${rows}
    </table>
  `;
}

/* ------------------------------------------
   MATCHUPS
-------------------------------------------*/

async function renderMatchups(league) {
  const container = document.getElementById("content");
  const week = currentWeek || 1;

  container.innerHTML = `<div class="section"><h2>${league.name} — Week ${week} Matchups</h2><div>Loading...</div></div>`;

  let matchups;
  try {
    matchups = await fetchJson(
      `https://api.sleeper.app/v1/league/${league.id}/matchups/${week}`
    );
  } catch (err) {
    console.error("Error loading matchups", err);
    container.innerHTML = `<div class="section"><h2>${league.name} — Week ${week} Matchups</h2><div>Could not load matchups.</div></div>`;
    return;
  }

  const { users, rosters } = leagueDataCache[league.id];
  const rosterMap = {};
  rosters.forEach(r => (rosterMap[r.roster_id] = r));
  const ownerMap = {};
  users.forEach(u => (ownerMap[u.user_id] = u));

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

      const noteKey = `match_${league.id}_${week}_${mid}`;
      const savedNote = localStorage.getItem(noteKey) || "";

      html += `
        <h3>Matchup ${mid}</h3>
        <table>
          <tr><th>Team</th><th>Points</th></tr>
          <tr>
            <td>${teamAvatarHtml(rosterMap[t1.roster_id], ownerMap)}</td>
            <td>${p1}</td>
          </tr>
          ${
            t2
              ? `<tr>
                  <td>${teamAvatarHtml(rosterMap[t2.roster_id], ownerMap)}</td>
                  <td>${p2}</td>
                </tr>`
              : ""
          }
        </table>
        <textarea class="note-box" data-save="${noteKey}" placeholder="Add note...">${savedNote}</textarea>
      `;
    });

  html += "</div>";
  container.innerHTML = html;

  attachAutosaveHandlers();
}

/* ------------------------------------------
   POWER RANKINGS
-------------------------------------------*/

function renderPowerRankings(league) {
  const container = document.getElementById("content");
  const { users, rosters } = leagueDataCache[league.id];

  const ownerMap = {};
  users.forEach(u => (ownerMap[u.user_id] = u));

  const week = currentWeek || 1;
  const prevWeek = week - 1;

  let html = `<div class="section"><h2>${league.name} Power Rankings — Week ${week}</h2>
  <p class="small-label">Enter manual rankings for each team. Change shows movement from last week's saved rankings.</p>
  <table>
    <tr>
      <th>Team</th>
      <th>Rank</th>
      <th>Chg</th>
    </tr>
  `;

  rosters.forEach(r => {
    const thisKey = `power_${league.id}_${week}_${r.roster_id}`;
    const prevKey = `power_${league.id}_${prevWeek}_${r.roster_id}`;
    const savedRank = localStorage.getItem(thisKey) || "";
    const prevRankStr = localStorage.getItem(prevKey);
    const prevRank = prevRankStr ? Number(prevRankStr) : null;

    let changeDisplay = "";
    if (prevRank && savedRank) {
      const thisRankNum = Number(savedRank);
      if (thisRankNum && prevRank !== thisRankNum) {
        const diff = prevRank - thisRankNum;
        const arrow = diff > 0 ? "↑" : "↓";
        changeDisplay = `${arrow}${Math.abs(diff)}`;
      }
    }

    const noteKey = `note_${thisKey}`;
    const savedNote = localStorage.getItem(noteKey) || "";

    html += `
      <tr>
        <td>${teamAvatarHtml(r, ownerMap)}</td>
        <td>
          <input class="power-input" type="number" min="1" max="${rosters.length}"
            data-save="${thisKey}"
            value="${savedRank}" />
        </td>
        <td>${changeDisplay}</td>
      </tr>
      <tr>
        <td colspan="3">
          <textarea class="note-box" data-save="${noteKey}" placeholder="Add note...">${savedNote}</textarea>
        </td>
      </tr>
    `;
  });

  html += "</table></div>";
  container.innerHTML = html;

  attachAutosaveHandlers();
}

/* ------------------------------------------
   AUTOSAVE HANDLER
-------------------------------------------*/

function attachAutosaveHandlers() {
  const inputs = document.querySelectorAll("[data-save]");
  inputs.forEach(el => {
    el.removeEventListener("input", handleAutosave);
    el.addEventListener("input", handleAutosave);
  });
}

function handleAutosave(e) {
  const key = e.target.dataset.save;
  if (!key) return;
  localStorage.setItem(key, e.target.value);
}
