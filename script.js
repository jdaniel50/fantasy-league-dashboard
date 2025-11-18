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
   LAST WEEK SNAPSHOTS (WEEK 10)
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

/* Floating presenter bubble */
let presenterBubble, presenterTitle, presenterNext;

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
  if (!roster) 
    return `<div class="team-with-avatar"><span>Unknown</span></div>`;

  const owner = ownerMap[roster.owner_id];
  const name = getTeamName(roster, ownerMap);
  const avatarId = owner?.avatar;

  if (!avatarId) {
    return `<div class="team-with-avatar fade-in"><span>${name}</span></div>`;
  }

  const url = `https://sleepercdn.com/avatars/thumbs/${avatarId}`;
  return `
    <div class="team-with-avatar fade-in">
      <img class="avatar" src="${url}" alt="${name} logo" />
      <span>${name}</span>
    </div>`;
}

function arrow(prev, now) {
  if (!prev || !now || prev === now) return "";
  const diff = prev - now;
  return diff > 0 ? `↑${Math.abs(diff)}` : `↓${Math.abs(diff)}`;
}

/* ------------------------------------------
   DOMContentLoaded
-------------------------------------------*/

document.addEventListener("DOMContentLoaded", () => {
  presenterBubble = document.getElementById("presenter-bubble");
  presenterTitle = document.getElementById("presenter-title");
  presenterNext = document.getElementById("presenter-next");

  const leagueButtons = document.querySelectorAll(".league-tabs .tab-btn");
  const subtabsEl = document.getElementById("subtabs");
  const subtabButtons = subtabsEl.querySelectorAll(".tab-btn");
  const toggleBtn = document.getElementById("presentation-toggle");

  /* League switching */
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

  /* Subtab switching */
  subtabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      subtabButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      loadSection(btn.dataset.section);
    });
  });

  /* Presentation mode toggle */
  toggleBtn.addEventListener("click", () => {
    presentationMode = !presentationMode;

    toggleBtn.textContent = presentationMode
      ? "Presentation Mode: ON"
      : "Presentation Mode: OFF";

    revealIndex = 0;

    if (presentationMode) {
      document.body.classList.add("presentation-mode");
      syncPresentationNotes();
    } else {
      document.body.classList.remove("presentation-mode");
    }

    updatePresenterBubbleVisibility();

    if (currentLeagueKey) {
      const activeSection = document
        .querySelector(".subtabs .tab-btn.active")?.dataset.section;

      if (activeSection) loadSection(activeSection);
    }
  });

  /* NEXT button in presenter bubble */
  presenterNext.addEventListener("click", () => {
    if (presentationMode) {
      revealIndex++;
      applyReveal();
    }
  });

  /* Keyboard shortcuts */
  document.addEventListener("keydown", handleKeyboardShortcuts);

  /* Fetch NFL week */
  fetchJson("https://api.sleeper.app/v1/state/nfl")
    .then(state => {
      currentWeek = state.display_week || state.week || 11;
    })
    .catch(() => {
      currentWeek = 11;
    });

  /* Select the first league by default */
  leagueButtons[0]?.click();
});
