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

let currentLeague = null;
let currentSection = null;
let currentWeek = null;

// Cache league data
const leagueDataCache = {};


/* ------------------------------------------
   INITIALIZATION
-------------------------------------------*/

document.querySelectorAll(".league-tabs .tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    // activate
    document.querySelectorAll(".league-tabs .tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    const key = btn.dataset.league;
    currentLeague = LEAGUES[key];

    showSubtabs();
    loadSection("standings");
  });
});

document.querySelectorAll("#subtabs .tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    loadSection(btn.dataset.section);
  });
});


async function init() {
  const nflState = await fetchJson("https://api.sleeper.app/v1/state/nfl");
  currentWeek = nflState.display_week || nflState.week || 1;
}
init();


/* ------------------------------------------
   SUBTAB HANDLING
-------------------------------------------*/

function showSubtabs() {
  const el = document.getElementById("subtabs");
  el.style.display = "flex";

  document.querySelectorAll("#subtabs .tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelector('#subtabs .tab-btn[data-section="standings"]').classList.add("active");

  currentSection = "standings";
}


/* ------------------------------------------
   SECTION LOADER
-------------------------------------------*/

async function loadSection(section) {
  currentSection = section;

  document.querySelectorAll("#subtabs .tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelector(`#subtabs .tab-btn[data-section="${section}"]`).classList.add("active");

  const container = document.getElementById("content");
  container.innerHTML = "<div class='section'>Loading...</div>";

  if (!currentLeague) return;

  if (!leagueDataCache[currentLeague.id]) {
    const [users, rosters] = await Promise.all([
      fetchJson(`https://api.sleeper.app/v1/league/${currentLeague.id}/users`),
      fetchJson(`https://api.sleeper.app/v1/league/${currentLeague.id}/rosters`)
    ]);

    leagueDataCache[currentLeague.id] = { users, rosters };
  }

  if (section === "standings") renderStandings();
  if (section === "matchups") renderMatchups();
  if (section === "power") renderPowerRankings();
}


/* ------------------------------------------
   STANDINGS
-------------------------------------------*/

function renderStandings() {
  const container = document.getElementById("content");
  const { users, rosters } = leagueDataCache[currentLeague.id];

  // Build owners lookup
  const owners = {};
  users.forEach(u => owners[u.user_id] = u);

  // Sort rosters by win %, then points for
  const sorted = [...rosters].sort((a, b) => {
    const winA = a.settings.wins;
    const lossA = a.settings.losses;
    const pctA = winA + lossA === 0 ? 0 : winA / (winA + lossA);

    const winB = b.settings.wins;
    const lossB = b.settings.losses;
    const pctB = winB + lossB === 0 ? 0 : winB / (winB + lossB);

    if (pctB !== pctA) return pctB - pctA;
    return b.settings.fpts - a.settings.fpts;
  });

  let html = `<div class='section'><h2>${currentLeague.name} Standings</h2>`;

  if (currentLeague.hasDivisions) {
    Object.keys(currentLeague.divisions).forEach(divName => {
      html += `<h3>${divName} Division</h3>`;
      html += standingsTable(divName, sorted, owners);
    });
  } else {
    html += standingsTable(null, sorted, owners);
  }

  html += "</div>";

  container.innerHTML = html;
}


// Build standings table
function standingsTable(divisionName, sortedRosters, owners) {
  const divTeams = divisionName ? currentLeague.divisions[divisionName] : null;

  let rows = "";

  sortedRosters.forEach((team, idx) => {
    const owner = owners[team.owner_id];
    const teamName = owner?.metadata?.team_name || owner?.display_name || "Unknown";
    if (divisionName && !divTeams.includes(teamName)) return;

    const noteKey = `note_${currentLeague.id}_${team.roster_id}`;
    const savedNote = localStorage.getItem(noteKey) || "";

    rows += `
      <tr>
        <td>${idx + 1}</td>
        <td>${teamName}</td>
        <td>${team.settings.wins}-${team.settings.losses}</td>
        <td>${team.settings.fpts.toFixed(2)}</td>
      </tr>
      <tr>
        <td colspan="4">
          <textarea class="note-box" 
            data-save="${noteKey}"
            placeholder="Add note...">${savedNote}</textarea>
        </td>
      </tr>
    `;
  });

  return `
    <table>
      <tr>
        <th>#</th><th>Team</th><th>Record</th><th>PF</th>
      </tr>
      ${rows}
    </table>
  `;
}


/* ------------------------------------------
   MATCHUPS
-------------------------------------------*/

async function renderMatchups() {
  const container = document.getElementById("content");

  const matchups = await fetchJson(
    `https://api.sleeper.app/v1/league/${currentLeague.id}/matchups/${currentWeek}`
  );

  const { users, rosters } = leagueDataCache[currentLeague.id];
  const rosterMap = {};
  rosters.forEach(r => rosterMap[r.roster_id] = r);

  const ownerMap = {};
  users.forEach(u => ownerMap[u.user_id] = u);

  // Group by matchup_id
  const grouped = {};
  matchups.forEach(m => {
    if (!grouped[m.matchup_id]) grouped[m.matchup_id] = [];
    grouped[m.matchup_id].push(m);
  });

  let html = `<div class="section"><h2>${currentLeague.name} — Week ${currentWeek} Matchups</h2>`;

  Object.keys(grouped).forEach(mid => {
    const teams = grouped[mid];
    if (!teams[0]) return;

    const t1 = teams[0];
    const t2 = teams[1];

    const n1 = teamName(rosterMap[t1.roster_id], ownerMap);
    const n2 = t2 ? teamName(rosterMap[t2.roster_id], ownerMap) : "(Bye)";

    const noteKey = `match_${currentLeague.id}_${mid}`;
    const savedNote = localStorage.getItem(noteKey) || "";

    html += `
      <h3>Matchup ${mid}</h3>
      <table>
        <tr><th>Team</th><th>Points</th></tr>
        <tr><td>${n1}</td><td>${t1.points?.toFixed(2) ?? "-"}</td></tr>
        ${t2 ? `<tr><td>${n2}</td><td>
