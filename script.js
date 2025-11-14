// Replace this with your real Sleeper league id
const LEAGUE_ID = 1186844188245356544;

const weekSelect = document.getElementById("week-select");
const refreshButton = document.getElementById("refresh");
const matchupsContainer = document.getElementById("matchups");
const errorBox = document.getElementById("error");
const currentWeekLabel = document.getElementById("current-week-label");

// We will cache some lookups so we do not call the API more than needed
let rosterById = {};
let userById = {};
let currentWeek = 1;

async function init() {
  try {
    errorBox.textContent = "";

    // 1. Get current NFL state to know the active week
    const state = await fetchJson("https://api.sleeper.app/v1/state/nfl");
    currentWeek = state.display_week || state.week || 1;
    currentWeekLabel.textContent = `Current NFL week: ${currentWeek}`;

    // 2. Load league rosters and users once
    await loadRostersAndUsers();

    // 3. Populate week dropdown (you can change the maxWeek)
    const maxWeek = 18;
    for (let w = 1; w <= maxWeek; w++) {
      const option = document.createElement("option");
      option.value = w;
      option.textContent = `Week ${w}`;
      if (w === currentWeek) option.selected = true;
      weekSelect.appendChild(option);
    }

    // 4. Load matchups for the current week
    await loadMatchups(currentWeek);
  } catch (err) {
    console.error(err);
    errorBox.textContent = "Something went wrong loading the dashboard.";
  }
}

async function loadRostersAndUsers() {
  const [rosters, users] = await Promise.all([
    fetchJson(`https://api.sleeper.app/v1/league/${LEAGUE_ID}/rosters`),
    fetchJson(`https://api.sleeper.app/v1/league/${LEAGUE_ID}/users`)
  ]);

  rosterById = {};
  for (const roster of rosters) {
    rosterById[roster.roster_id] = roster;
  }

  userById = {};
  for (const user of users) {
    userById[user.user_id] = user;
  }
}

// Helper to fetch JSON with a little error handling
async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// Build a lookup from roster_id to a nice team label
function getTeamLabel(roster) {
  if (!roster) return "Unknown team";

  const ownerId = roster.owner_id;
  const user = userById[ownerId];
  const displayName = user?.display_name || user?.username || "Unknown";

  const nickname = user?.metadata?.team_name;
  if (nickname) {
    return `${nickname} (${displayName})`;
  }
  return displayName;
}

async function loadMatchups(week) {
  errorBox.textContent = "";
  matchupsContainer.textContent = "Loading matchups...";

  try {
    const matchups = await fetchJson(
      `https://api.sleeper.app/v1/league/${LEAGUE_ID}/matchups/${week}`
    );

    // Group by matchup_id so we can pair two teams per game
    const byMatchupId = {};
    for (const m of matchups) {
      if (!byMatchupId[m.matchup_id]) {
        byMatchupId[m.matchup_id] = [];
      }
      byMatchupId[m.matchup_id].push(m);
    }

    matchupsContainer.textContent = "";

    const matchupIds = Object.keys(byMatchupId).sort(
      (a, b) => Number(a) - Number(b)
    );

    if (matchupIds.length === 0) {
      matchupsContainer.textContent = "No matchups found for this week.";
      return;
    }

    for (const id of matchupIds) {
      const teams = byMatchupId[id];

      // Some odd weeks (like playoffs or byes) may have single team entries
      const team1 = teams[0];
      const team2 = teams[1];

      const card = document.createElement("div");
      card.className = "matchup";

      const header = document.createElement("div");
      header.className = "matchup-header";
      header.textContent = `Matchup ${id}`;
      card.appendChild(header);

      const teamRow1 = document.createElement("div");
      teamRow1.className = "team-row";
      const t1Label = getTeamLabel(rosterById[team1?.roster_id]);
      teamRow1.innerHTML = `
        <span class="team-name">${t1Label}</span>
        <span>${team1?.points?.toFixed(2) ?? "-"}</span>
      `;
      card.appendChild(teamRow1);

      if (team2) {
        const teamRow2 = document.createElement("div");
        teamRow2.className = "team-row";
        const t2Label = getTeamLabel(rosterById[team2.roster_id]);
        teamRow2.innerHTML = `
          <span class="team-name">${t2Label}</span>
          <span>${team2.points.toFixed(2)}</span>
        `;
        card.appendChild(teamRow2);
      }

      matchupsContainer.appendChild(card);
    }
  } catch (err) {
    console.error(err);
    matchupsContainer.textContent = "";
    errorBox.textContent = "Could not load matchups for that week.";
  }
}

// Hook up controls
refreshButton.addEventListener("click", () => {
  const week = Number(weekSelect.value || currentWeek);
  loadMatchups(week);
});

// Kick everything off
init();
