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

/* ------------------------------------------
   GLOBAL STATE
-------------------------------------------*/

let currentLeagueKey = null;
let currentWeek = null;
const leagueDataCache = {};

/* ------------------------------------------
   UTILITIES
-------------------------------------------*/

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

function normaliz
