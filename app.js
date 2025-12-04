// app.js - Fantasy Dashboard: League History & Awards

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

let activeLeagueId = null;
let leaguesData = new Map(); // Map of league_id -> league data
let savedLeagues = []; // Array of {league_id, name, season}

// Historical data cache
let historicalCache = new Map(); // league_id -> {seasons, rosters, matchups, trades}
let playersData = null; // Sleeper players database
let nflState = null; // Current NFL state (week, season)

// Current league context
let currentLeagueData = null;
let currentRosters = [];
let currentUsers = [];
let currentMatchups = [];

// Presentation states
let activePresentationMode = null;
let lastPowerRows = [];
let powerRevealOrder = [];
let powerPresentationActive = false;
let powerPresentationStep = -1;
let lastMatchupData = [];
let matchupPresentationActive = false;
let matchupPresentationStep = -1;
let lastStandingsData = [];
let standingsPresentationActive = false;
let standingsPresentationStep = -1;

// ============================================================================
// DOM ELEMENTS
// ============================================================================

const usernameInput = document.getElementById('usernameInput');
const fetchLeaguesBtn = document.getElementById('fetchLeaguesBtn');
const availableLeaguesContainer = document.getElementById('availableLeaguesContainer');
const availableLeaguesSelect = document.getElementById('availableLeaguesSelect');
const addLeagueBtn = document.getElementById('addLeagueBtn');
const leagueSelect = document.getElementById('leagueSelect');
const removeLeagueBtn = document.getElementById('removeLeagueBtn');
const refreshSleeperBtn = document.getElementById('refreshSleeperBtn');
const currentSeasonLabel = document.getElementById('currentSeasonLabel');
const currentWeekLabel = document.getElementById('currentWeekLabel');

// History tab elements
const historyContent = document.getElementById('historyContent');
const historySeasonSelect = document.getElementById('historySeasonSelect');
const historyAdminPanel = document.getElementById('historyAdminPanel');
const historyAdminToggle = document.getElementById('historyAdminToggle');

// Awards sub-tab elements
const awardsAllTimeContent = document.getElementById('awardsAllTimeContent');
const awardsSeasonContent = document.getElementById('awardsSeasonContent');
const awardsWeeklyContent = document.getElementById('awardsWeeklyContent');
const awardsSeasonSeasonSelect = document.getElementById('awardsSeasonSeasonSelect');
const awardsWeeklySeasonSelect = document.getElementById('awardsWeeklySeasonSelect');
const awardsWeeklyWeekSelect = document.getElementById('awardsWeeklyWeekSelect');

// Draft tab elements
const draftPicksContent = document.getElementById('draftPicksContent');
const draftBoardContent = document.getElementById('draftBoardContent');
const draftGradesContent = document.getElementById('draftGradesContent');
const draftSeasonSelect = document.getElementById('draftSeasonSelect');
const draftWeekSelect = document.getElementById('draftWeekSelect');
const draftViewSelect = document.getElementById('draftViewSelect');

// Matchup, Standings, Power Rankings elements
const matchupContainer = document.getElementById('matchupContainer');
const matchupPresentationContainer = document.getElementById('matchupPresentationContainer');
const matchupPresentationBtn = document.getElementById('matchupPresentationBtn');
const matchupAdminPanel = document.getElementById('matchupAdminPanel');
const matchupAdminToggle = document.getElementById('matchupAdminToggle');

const standingsContainer = document.getElementById('standingsContainer');
const standingsPresentationContainer = document.getElementById('standingsPresentationContainer');
const standingsPresentationBtn = document.getElementById('standingsPresentationBtn');
const standingsAdminPanel = document.getElementById('standingsAdminPanel');
const standingsAdminToggle = document.getElementById('standingsAdminToggle');

const powerTableContainer = document.getElementById('powerTableContainer');
const powerPresentationContainer = document.getElementById('powerPresentationContainer');
const powerPresentationBtn = document.getElementById('powerPresentationBtn');
const powerAdminPanel = document.getElementById('powerAdminPanel');
const powerAdminToggle = document.getElementById('powerAdminToggle');

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  loadSavedLeagues();
  initTabs();
  initControls();
  populateLeagueSelect();
  fetchPlayersData(); // Load player database
  fetchNFLState(); // Get current NFL week/season
});

// ============================================================================
// LOCAL STORAGE MANAGEMENT
// ============================================================================

function loadSavedLeagues() {
  try {
    const stored = localStorage.getItem('fantasy_saved_leagues');
    if (stored) {
      savedLeagues = JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load saved leagues', e);
    savedLeagues = [];
  }
}

function saveleaguesData() {
  try {
    localStorage.setItem('fantasy_saved_leagues', JSON.stringify(savedLeagues));
  } catch (e) {
    console.error('Failed to save leagues', e);
  }
}

function getTeamSettings(leagueId) {
  try {
    const key = `fantasy_team_settings_${leagueId}`;
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : {};
  } catch (e) {
    console.error('Failed to load team settings', e);
    return {};
  }
}

function saveTeamSettings(leagueId, settings) {
  try {
    const key = `fantasy_team_settings_${leagueId}`;
    localStorage.setItem(key, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save team settings', e);
  }
}

// ============================================================================
// TABS NAVIGATION
// ============================================================================

function initTabs() {
  const buttons = document.querySelectorAll('.tab-button');
  const tabs = document.querySelectorAll('.tab-content');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const targetId = btn.dataset.tab;
      tabs.forEach(tab => {
        if (tab.id === targetId) tab.classList.add('active');
        else tab.classList.remove('active');
      });

      // Render the appropriate tab
      if (targetId === 'historyTab') renderHistoryTab();
      else if (targetId === 'awardsTab') renderAwardsTab();
      else if (targetId === 'draftTab') renderDraftTab();
      else if (targetId === 'matchupTab') renderMatchupTab();
      else if (targetId === 'standingsTab') renderStandingsTab();
      else if (targetId === 'powerTab') renderPowerTab();
    });
  });
}

// ============================================================================
// CONTROLS & EVENT LISTENERS
// ============================================================================

function initControls() {
  // Fetch leagues button
  fetchLeaguesBtn.addEventListener('click', async () => {
    const username = usernameInput.value.trim();
    if (!username) {
      alert('Please enter a Sleeper username');
      return;
    }
    await fetchUserLeagues(username);
  });

  // Add league button
  addLeagueBtn.addEventListener('click', () => {
    const selected = availableLeaguesSelect.value;
    if (!selected) {
      alert('Please select a league to add');
      return;
    }
    
    const option = availableLeaguesSelect.options[availableLeaguesSelect.selectedIndex];
    const leagueId = option.value;
    const leagueName = option.getAttribute('data-name');
    const season = option.getAttribute('data-season');
    
    // Check if already added
    if (savedLeagues.some(l => l.league_id === leagueId)) {
      alert('This league is already added');
      return;
    }
    
    savedLeagues.push({ league_id: leagueId, name: leagueName, season: season });
    saveleaguesData();
    populateLeagueSelect();
    availableLeaguesContainer.classList.add('hidden');
    availableLeaguesSelect.innerHTML = '<option value="">Select a league to add...</option>';
  });

  // Remove league button
  removeLeagueBtn.addEventListener('click', () => {
    if (!activeLeagueId) {
      alert('Please select a league to remove');
      return;
    }
    
    if (confirm('Are you sure you want to remove this league from your dashboard?')) {
      savedLeagues = savedLeagues.filter(l => l.league_id !== activeLeagueId);
      saveleaguesData();
      activeLeagueId = null;
      populateLeagueSelect();
      clearAllContent();
    }
  });

  // League select
  leagueSelect.addEventListener('change', async () => {
    activeLeagueId = leagueSelect.value || null;
    if (activeLeagueId) {
      await loadLeagueData(activeLeagueId);
      renderHistoryTab();
      renderAwardsTab();
      renderDraftTab();
      renderMatchupTab();
      renderStandingsTab();
      renderPowerTab();
    } else {
      clearAllContent();
    }
  });

  // Refresh button
  refreshSleeperBtn.addEventListener('click', async () => {
    if (!activeLeagueId) {
      alert('Please select a league first');
      return;
    }
    historicalCache.delete(activeLeagueId);
    await loadLeagueData(activeLeagueId);
    renderHistoryTab();
    renderAwardsTab();
    renderDraftTab();
    renderMatchupTab();
    renderStandingsTab();
    renderPowerTab();
  });

  // History season select
  historySeasonSelect.addEventListener('change', () => {
    renderHistoryTab();
  });

  // History admin toggle
  if (historyAdminToggle && historyAdminPanel) {
    historyAdminToggle.addEventListener('click', () => {
      const nowHidden = historyAdminPanel.classList.toggle('hidden');
      if (!nowHidden) {
        renderHistoryAdminPanel();
      }
    });
  }

  // Awards sub-tabs
  document.querySelectorAll('.awards-sub-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.getAttribute('data-awards-tab');
      
      // Update active tab
      document.querySelectorAll('.awards-sub-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Update active content
      document.querySelectorAll('.awards-tab-content').forEach(content => {
        content.classList.remove('active');
      });
      
      if (targetTab === 'alltime') {
        document.getElementById('awardsAllTimeTab').classList.add('active');
        activeAwardsSubTab = 'alltime';
      } else if (targetTab === 'season') {
        document.getElementById('awardsSeasonTab').classList.add('active');
        activeAwardsSubTab = 'season';
      } else if (targetTab === 'weekly') {
        document.getElementById('awardsWeeklyTab').classList.add('active');
        activeAwardsSubTab = 'weekly';
      }
      
      renderAwardsTab();
    });
  });
  
  // Awards Season tab season select
  awardsSeasonSeasonSelect.addEventListener('change', () => {
    renderAwardsTab();
  });
  
  // Awards Weekly tab controls
  awardsWeeklySeasonSelect.addEventListener('change', () => {
    populateAwardsWeeklyWeeks();
    renderAwardsTab();
  });
  
  awardsWeeklyWeekSelect.addEventListener('change', () => {
    renderAwardsTab();
  });

  // Draft season select
  draftSeasonSelect.addEventListener('change', () => {
    populateDraftWeekSelect();
    renderDraftTab();
  });

  // Draft week select
  draftWeekSelect.addEventListener('change', () => {
    renderDraftTab();
  });

  // Draft view select
  draftViewSelect.addEventListener('change', () => {
    renderDraftTab();
  });

  // Power rankings controls
  if (powerPresentationBtn) {
    powerPresentationBtn.addEventListener('click', () => {
      if (!lastPowerRows.length) {
        renderPowerTab().then(() => {
          if (lastPowerRows.length) enterPowerPresentationMode();
        }).catch(() => {});
      } else {
        enterPowerPresentationMode();
      }
    });
  }

  if (powerAdminToggle && powerAdminPanel) {
    powerAdminToggle.addEventListener('click', () => {
      const nowHidden = powerAdminPanel.classList.toggle('hidden');
      if (!nowHidden) {
        renderPowerAdminPanel();
      }
    });
  }

  // Matchup controls
  if (matchupPresentationBtn) {
    matchupPresentationBtn.addEventListener('click', () => {
      if (!lastMatchupData.length) {
        renderMatchupTab().then(() => {
          if (lastMatchupData.length) enterMatchupPresentationMode();
        }).catch(() => {});
      } else {
        enterMatchupPresentationMode();
      }
    });
  }

  if (matchupAdminToggle && matchupAdminPanel) {
    matchupAdminToggle.addEventListener('click', () => {
      const nowHidden = matchupAdminPanel.classList.toggle('hidden');
      if (!nowHidden) {
        renderMatchupAdminPanel();
      }
    });
  }

  // Standings controls
  if (standingsPresentationBtn) {
    standingsPresentationBtn.addEventListener('click', () => {
      if (!lastStandingsData.length) {
        renderStandingsTab().then(() => {
          if (lastStandingsData.length) enterStandingsPresentationMode();
        }).catch(() => {});
      } else {
        enterStandingsPresentationMode();
      }
    });
  }

  if (standingsAdminToggle && standingsAdminPanel) {
    standingsAdminToggle.addEventListener('click', () => {
      const nowHidden = standingsAdminPanel.classList.toggle('hidden');
      if (!nowHidden) {
        renderStandingsAdminPanel();
      }
    });
  }
}

// ============================================================================
// LEAGUE MANAGEMENT
// ============================================================================

function populateLeagueSelect() {
  leagueSelect.innerHTML = '';
  
  if (savedLeagues.length === 0) {
    leagueSelect.innerHTML = '<option value="">No leagues added yet</option>';
    return;
  }
  
  leagueSelect.innerHTML = '<option value="">Select a league...</option>';
  savedLeagues.forEach(league => {
    const option = document.createElement('option');
    option.value = league.league_id;
    option.textContent = `${league.name} (${league.season})`;
    leagueSelect.appendChild(option);
  });
  
  // Auto-select if only one league
  if (savedLeagues.length === 1) {
    leagueSelect.value = savedLeagues[0].league_id;
    activeLeagueId = savedLeagues[0].league_id;
    loadLeagueData(activeLeagueId);
  }
}

async function fetchUserLeagues(username) {
  try {
    fetchLeaguesBtn.disabled = true;
    fetchLeaguesBtn.textContent = 'Loading...';
    
    // Get user ID
    const userRes = await fetch(`https://api.sleeper.app/v1/user/${username}`);
    if (!userRes.ok) throw new Error('User not found');
    
    const userData = await userRes.json();
    const userId = userData.user_id;
    
    // Get current season (NFL season)
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    // NFL season runs Sept-Feb, so if we're Jan-Aug, use previous year
    const season = currentMonth >= 8 ? currentYear : currentYear - 1;
    
    // Get leagues for current season
    const leaguesRes = await fetch(`https://api.sleeper.app/v1/user/${userId}/leagues/nfl/${season}`);
    if (!leaguesRes.ok) throw new Error('Failed to fetch leagues');
    
    const leagues = await leaguesRes.json();
    
    // Populate available leagues dropdown
    availableLeaguesSelect.innerHTML = '<option value="">Select a league to add...</option>';
    leagues.forEach(league => {
      const option = document.createElement('option');
      option.value = league.league_id;
      option.textContent = league.name;
      option.setAttribute('data-name', league.name);
      option.setAttribute('data-season', league.season);
      availableLeaguesSelect.appendChild(option);
    });
    
    availableLeaguesContainer.classList.remove('hidden');
    
  } catch (error) {
    console.error('Error fetching leagues:', error);
    alert(`Error: ${error.message}`);
  } finally {
    fetchLeaguesBtn.disabled = false;
    fetchLeaguesBtn.textContent = 'Fetch Leagues';
  }
}

// ============================================================================
// SLEEPER API FUNCTIONS
// ============================================================================

async function fetchPlayersData() {
  try {
    const response = await fetch('https://api.sleeper.app/v1/players/nfl');
    if (response.ok) {
      playersData = await response.json();
      console.log('Players data loaded:', Object.keys(playersData).length, 'players');
    }
  } catch (error) {
    console.error('Error fetching players data:', error);
  }
}

async function fetchNFLState() {
  try {
    const response = await fetch('https://api.sleeper.app/v1/state/nfl');
    if (response.ok) {
      nflState = await response.json();
      console.log('NFL State loaded:', nflState);
    }
  } catch (error) {
    console.error('Error fetching NFL state:', error);
  }
}

async function loadLeagueData(leagueId) {
  try {
    // Fetch current league data
    const leagueRes = await fetch(`https://api.sleeper.app/v1/league/${leagueId}`);
    if (!leagueRes.ok) throw new Error('Failed to fetch league');
    currentLeagueData = await leagueRes.json();
    
    // Fetch users
    const usersRes = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`);
    if (!usersRes.ok) throw new Error('Failed to fetch users');
    currentUsers = await usersRes.json();
    
    // Fetch rosters
    const rostersRes = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`);
    if (!rostersRes.ok) throw new Error('Failed to fetch rosters');
    currentRosters = await rostersRes.json();
    
    // Fetch current week matchups
    if (currentLeagueData.settings && currentLeagueData.settings.leg) {
      const week = currentLeagueData.settings.leg;
      const matchupsRes = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/matchups/${week}`);
      if (matchupsRes.ok) {
        currentMatchups = await matchupsRes.json();
      }
    }
    
    // Update header
    if (currentLeagueData) {
      currentSeasonLabel.textContent = `Season ${currentLeagueData.season}`;
      if (currentLeagueData.settings && currentLeagueData.settings.leg) {
        currentWeekLabel.textContent = `Week ${currentLeagueData.settings.leg}`;
      }
    }
    
    // Load historical data for this league
    await loadHistoricalData(leagueId);
    
  } catch (error) {
    console.error('Error loading league data:', error);
    alert(`Error loading league: ${error.message}`);
  }
}

async function loadHistoricalData(leagueId) {
  // Check cache first
  if (historicalCache.has(leagueId)) {
    return historicalCache.get(leagueId);
  }
  
  try {
    const histData = {
      seasons: [],
      allRosters: new Map(), // season -> rosters
      allMatchups: new Map(), // season -> week -> matchups
      allTrades: new Map(), // season -> trades
      allDrafts: new Map(), // season -> draft
      allWaivers: new Map() // season -> transactions
    };
    
    // Start from current league and walk back through previous_league_id
    let currentId = leagueId;
    const visited = new Set();
    
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      
      // Fetch league info
      const leagueRes = await fetch(`https://api.sleeper.app/v1/league/${currentId}`);
      if (!leagueRes.ok) break;
      const league = await leagueRes.json();
      
      histData.seasons.push({
        league_id: currentId,
        season: league.season,
        name: league.name,
        settings: league.settings
      });
      
      // Fetch rosters for this season
      const rostersRes = await fetch(`https://api.sleeper.app/v1/league/${currentId}/rosters`);
      if (rostersRes.ok) {
        const rosters = await rostersRes.json();
        histData.allRosters.set(league.season, rosters);
      }
      
      // Fetch all matchups for this season
      const seasonMatchups = new Map();
      if (league.settings && league.settings.playoff_week_start) {
        const totalWeeks = league.settings.playoff_week_start + (league.settings.playoff_round_type === 2 ? 2 : 3);
        for (let week = 1; week <= totalWeeks; week++) {
          const matchupsRes = await fetch(`https://api.sleeper.app/v1/league/${currentId}/matchups/${week}`);
          if (matchupsRes.ok) {
            const weekMatchups = await matchupsRes.json();
            seasonMatchups.set(week, weekMatchups);
          }
        }
      }
      histData.allMatchups.set(league.season, seasonMatchups);
      
      // Fetch trades
      const tradesRes = await fetch(`https://api.sleeper.app/v1/league/${currentId}/transactions/2`);
      if (tradesRes.ok) {
        const trades = await tradesRes.json();
        histData.allTrades.set(league.season, trades);
      }
      
      // Fetch draft
      const draftsRes = await fetch(`https://api.sleeper.app/v1/league/${currentId}/drafts`);
      if (draftsRes.ok) {
        const drafts = await draftsRes.json();
        if (drafts && drafts.length > 0) {
          const draftId = drafts[0].draft_id;
          const draftPicksRes = await fetch(`https://api.sleeper.app/v1/draft/${draftId}/picks`);
          if (draftPicksRes.ok) {
            const picks = await draftPicksRes.json();
            histData.allDrafts.set(league.season, picks);
          }
        }
      }
      
      // Fetch waivers/adds
      const waiversRes = await fetch(`https://api.sleeper.app/v1/league/${currentId}/transactions/1`);
      if (waiversRes.ok) {
        const waivers = await waiversRes.json();
        histData.allWaivers.set(league.season, waivers);
      }
      
      // Move to previous season
      currentId = league.previous_league_id;
    }
    
    // Sort seasons (newest first)
    histData.seasons.sort((a, b) => b.season - a.season);
    
    // Cache the data
    historicalCache.set(leagueId, histData);
    
    // Populate season selectors
    populateSeasonSelectors(histData.seasons);
    
    return histData;
    
  } catch (error) {
    console.error('Error loading historical data:', error);
    return null;
  }
}

function populateSeasonSelectors(seasons) {
  // History season select
  historySeasonSelect.innerHTML = '<option value="all">All-Time</option>';
  seasons.forEach(season => {
    const option = document.createElement('option');
    option.value = season.season;
    option.textContent = `${season.season} Season`;
    historySeasonSelect.appendChild(option);
  });
  
  // Awards Season tab select
  awardsSeasonSeasonSelect.innerHTML = '<option value="">Select a season...</option>';
  seasons.forEach(season => {
    const option = document.createElement('option');
    option.value = season.season;
    option.textContent = `${season.season} Season`;
    awardsSeasonSeasonSelect.appendChild(option);
  });
  
  // Awards Weekly tab season select
  awardsWeeklySeasonSelect.innerHTML = '<option value="">Select a season...</option>';
  seasons.forEach(season => {
    const option = document.createElement('option');
    option.value = season.season;
    option.textContent = `${season.season} Season`;
    awardsWeeklySeasonSelect.appendChild(option);
  });
  
  // Draft season select
  draftSeasonSelect.innerHTML = '<option value="">Select a season...</option>';
  seasons.forEach(season => {
    const option = document.createElement('option');
    option.value = season.season;
    option.textContent = `${season.season} Season`;
    draftSeasonSelect.appendChild(option);
  });
  
  // Auto-select current season
  if (seasons.length > 0) {
    awardsSeasonSeasonSelect.value = seasons[0].season;
    awardsWeeklySeasonSelect.value = seasons[0].season;
    draftSeasonSelect.value = seasons[0].season;
    populateDraftWeekSelect();
    populateAwardsWeeklyWeeks();
  }
}

function populateAwardsWeeklyWeeks() {
  const selectedSeason = awardsWeeklySeasonSelect.value;
  if (!selectedSeason || !activeLeagueId) {
    awardsWeeklyWeekSelect.innerHTML = '<option value="">Select a week...</option>';
    return;
  }
  
  const histData = historicalCache.get(activeLeagueId);
  if (!histData) {
    awardsWeeklyWeekSelect.innerHTML = '<option value="">Select a week...</option>';
    return;
  }
  
  const matchupsByWeek = histData.allMatchups.get(selectedSeason);
  if (!matchupsByWeek) {
    awardsWeeklyWeekSelect.innerHTML = '<option value="">Select a week...</option>';
    return;
  }
  
  const weeks = Array.from(matchupsByWeek.keys()).sort((a, b) => a - b);
  
  awardsWeeklyWeekSelect.innerHTML = '<option value="">Select a week...</option>';
  weeks.forEach(week => {
    const option = document.createElement('option');
    option.value = week;
    option.textContent = `Week ${week}`;
    awardsWeeklyWeekSelect.appendChild(option);
  });
}

function populateDraftWeekSelect() {
  const selectedSeason = draftSeasonSelect.value;
  if (!selectedSeason || !activeLeagueId) {
    draftWeekSelect.innerHTML = '<option value="all">Full Season</option>';
    return;
  }
  
  const histData = historicalCache.get(activeLeagueId);
  if (!histData) {
    draftWeekSelect.innerHTML = '<option value="all">Full Season</option>';
    return;
  }
  
  const matchupsByWeek = histData.allMatchups.get(selectedSeason);
  if (!matchupsByWeek) {
    draftWeekSelect.innerHTML = '<option value="all">Full Season</option>';
    return;
  }
  
  const weeks = Array.from(matchupsByWeek.keys()).sort((a, b) => a - b);
  
  draftWeekSelect.innerHTML = '<option value="all">Full Season</option>';
  weeks.forEach(week => {
    const option = document.createElement('option');
    option.value = week;
    option.textContent = `Through Week ${week}`;
    draftWeekSelect.appendChild(option);
  });
}

// ============================================================================
// CLEAR CONTENT
// ============================================================================

function clearAllContent() {
  historyContent.innerHTML = '<div class="muted-text">Select a league to view history.</div>';
  awardsAllTimeContent.innerHTML = '<div class="muted-text">Select a league to view awards.</div>';
  awardsSeasonContent.innerHTML = '<div class="muted-text">Select a league to view awards.</div>';
  awardsWeeklyContent.innerHTML = '<div class="muted-text">Select a league to view awards.</div>';
  draftPicksContent.innerHTML = '<div class="muted-text">Select a league to view draft analysis.</div>';
  draftGradesContent.innerHTML = '';
  draftBoardContent.innerHTML = '';
  matchupContainer.innerHTML = '<div class="muted-text">Select a league to view current matchups.</div>';
  standingsContainer.innerHTML = '<div class="muted-text">Select a league to view standings.</div>';
  powerTableContainer.innerHTML = '<div class="muted-text">Select a league to generate power rankings.</div>';
  currentSeasonLabel.textContent = '';
  currentWeekLabel.textContent = '';
}

// ============================================================================
// HISTORY TAB RENDERING
// ============================================================================

async function renderHistoryTab() {
  if (!activeLeagueId) {
    historyContent.innerHTML = '<div class="muted-text">Select a league to view history.</div>';
    return;
  }
  
  const histData = historicalCache.get(activeLeagueId);
  if (!histData) {
    historyContent.innerHTML = '<div class="muted-text">Loading historical data...</div>';
    return;
  }
  
  const selectedSeason = historySeasonSelect.value;
  const teamSettings = getTeamSettings(activeLeagueId);
  
  // Calculate stats
  const managerStats = calculateHistoricalStats(histData, selectedSeason, teamSettings);
  
  // Render table
  renderHistoryTable(managerStats);
}

function calculateHistoricalStats(histData, selectedSeason, teamSettings) {
  const stats = new Map(); // user_id -> stats object
  
  // Determine which seasons to include
  const seasonsToProcess = selectedSeason === 'all' 
    ? histData.seasons 
    : histData.seasons.filter(s => s.season === selectedSeason);
  
  seasonsToProcess.forEach(seasonInfo => {
    const season = seasonInfo.season;
    const matchupsByWeek = histData.allMatchups.get(season);
    const rosters = histData.allRosters.get(season);
    
    if (!matchupsByWeek || !rosters) return;
    
    // Create roster lookup
    const rosterByRosterId = new Map();
    rosters.forEach(r => {
      rosterByRosterId.set(r.roster_id, r);
      
      // Initialize stats for all users in this season upfront
      if (r.owner_id) {
        const userId = r.owner_id;
        const userSettings = teamSettings[userId] || {};
        
        if (!stats.has(userId)) {
          stats.set(userId, {
            user_id: userId,
            username: userId,
            wins: 0,
            losses: 0,
            playoff_wins: 0,
            third_place: 0,
            second_place: 0,
            first_place: 0,
            customName: userSettings.customName || null,
            customColor: userSettings.customColor || null
          });
        }
      }
    });
    
    // Process each week
    matchupsByWeek.forEach((weekMatchups, week) => {
      weekMatchups.forEach(matchup => {
        const roster = rosterByRosterId.get(matchup.roster_id);
        if (!roster || !roster.owner_id) return;
        
        const userId = roster.owner_id;
        
        // Check if this user should be excluded for this season
        const userSettings = teamSettings[userId] || {};
        if (userSettings.excludeSeasons && userSettings.excludeSeasons.includes(season)) {
          return;
        }
        
        const userStats = stats.get(userId);
        if (!userStats) return;
        
        // Determine if this is a regular season week
        const playoffWeekStart = seasonInfo.settings?.playoff_week_start || 15;
        const isRegularSeason = week < playoffWeekStart;
        
        // Count wins/losses ONLY for regular season
        if (isRegularSeason && matchup.matchup_id) {
          // Find opponent
          const opponent = weekMatchups.find(m => 
            m.matchup_id === matchup.matchup_id && m.roster_id !== matchup.roster_id
          );
          
          if (opponent) {
            if ((matchup.points || 0) > (opponent.points || 0)) {
              userStats.wins++;
            } else if ((matchup.points || 0) < (opponent.points || 0)) {
              userStats.losses++;
            }
          }
        }
      });
    });
    
    // Analyze playoff matchups to determine finishes
    if (seasonInfo.settings && seasonInfo.settings.playoff_week_start && matchupsByWeek) {
      const playoffStart = seasonInfo.settings.playoff_week_start;
      const playoffTeams = seasonInfo.settings.playoff_teams || 6;
      
      // Get all weeks of playoff matchups
      const playoffWeeks = [];
      matchupsByWeek.forEach((weekMatchups, week) => {
        if (week >= playoffStart) {
          playoffWeeks.push({ week, matchups: weekMatchups });
        }
      });
      
      if (playoffWeeks.length > 0) {
        // Last week of playoffs is championship week
        const championshipWeek = playoffWeeks[playoffWeeks.length - 1];
        
        // Find championship matchup (usually matchup_id 1)
        const champMatchups = championshipWeek.matchups.filter(m => m.matchup_id === 1);
        if (champMatchups.length === 2) {
          const [team1, team2] = champMatchups;
          const winner = (team1.points || 0) > (team2.points || 0) ? team1 : team2;
          const loser = winner.roster_id === team1.roster_id ? team2 : team1;
          
          const winnerRoster = rosterByRosterId.get(winner.roster_id);
          const loserRoster = rosterByRosterId.get(loser.roster_id);
          
          if (winnerRoster && stats.has(winnerRoster.owner_id)) {
            const userSettings = teamSettings[winnerRoster.owner_id] || {};
            if (!userSettings.excludeSeasons || !userSettings.excludeSeasons.includes(season)) {
              stats.get(winnerRoster.owner_id).first_place++;
            }
          }
          
          if (loserRoster && stats.has(loserRoster.owner_id)) {
            const userSettings = teamSettings[loserRoster.owner_id] || {};
            if (!userSettings.excludeSeasons || !userSettings.excludeSeasons.includes(season)) {
              stats.get(loserRoster.owner_id).second_place++;
            }
          }
        }
        
        // 3rd place game (usually matchup_id 2 in championship week)
        const thirdPlaceMatchups = championshipWeek.matchups.filter(m => m.matchup_id === 2);
        if (thirdPlaceMatchups.length === 2) {
          const [team1, team2] = thirdPlaceMatchups;
          const winner = (team1.points || 0) > (team2.points || 0) ? team1 : team2;
          
          const winnerRoster = rosterByRosterId.get(winner.roster_id);
          
          if (winnerRoster && stats.has(winnerRoster.owner_id)) {
            const userSettings = teamSettings[winnerRoster.owner_id] || {};
            if (!userSettings.excludeSeasons || !userSettings.excludeSeasons.includes(season)) {
              stats.get(winnerRoster.owner_id).third_place++;
            }
          }
        }
        
        // Count playoff wins
        playoffWeeks.forEach(({ week, matchups }) => {
          matchups.forEach(matchup => {
            if (!matchup.matchup_id) return;
            
            const roster = rosterByRosterId.get(matchup.roster_id);
            if (!roster || !roster.owner_id) return;
            
            const userSettings = teamSettings[roster.owner_id] || {};
            if (userSettings.excludeSeasons && userSettings.excludeSeasons.includes(season)) {
              return;
            }
            
            const opponent = matchups.find(m => 
              m.matchup_id === matchup.matchup_id && m.roster_id !== matchup.roster_id
            );
            
            if (opponent && stats.has(roster.owner_id)) {
              if ((matchup.points || 0) > (opponent.points || 0)) {
                stats.get(roster.owner_id).playoff_wins++;
              }
            }
          });
        });
      }
    }
  });
  
  // Get usernames from currentUsers
  const userMap = new Map();
  currentUsers.forEach(user => {
    userMap.set(user.user_id, user.display_name || user.username);
  });
  
  // Update usernames
  stats.forEach(userStats => {
    userStats.username = userStats.customName || userMap.get(userStats.user_id) || 'Unknown';
  });
  
  return Array.from(stats.values());
}

function renderHistoryTable(managerStats) {
  if (managerStats.length === 0) {
    historyContent.innerHTML = '<div class="muted-text">No historical data available.</div>';
    return;
  }
  
  // Calculate win percentages
  managerStats.forEach(stat => {
    const totalGames = stat.wins + stat.losses;
    stat.win_pct = totalGames > 0 ? (stat.wins / totalGames * 100).toFixed(1) : '0.0';
  });
  
  // Initial sort by wins (descending)
  managerStats.sort((a, b) => b.wins - a.wins);
  
  let html = `
    <table class="history-table">
      <thead>
        <tr>
          <th data-sort="username">Manager</th>
          <th data-sort="wins">Wins</th>
          <th data-sort="losses">Losses</th>
          <th data-sort="win_pct">Win %</th>
          <th data-sort="playoff_wins">Playoff Wins</th>
          <th data-sort="third_place"><span class="history-medal">🥉</span>3rd Place</th>
          <th data-sort="second_place"><span class="history-medal">🥈</span>2nd Place</th>
          <th data-sort="first_place"><span class="history-medal">🥇</span>Championships</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  managerStats.forEach(stat => {
    html += `
      <tr>
        <td class="history-manager-cell">${escapeHtml(stat.username)}</td>
        <td>${stat.wins}</td>
        <td>${stat.losses}</td>
        <td>${stat.win_pct}%</td>
        <td>${stat.playoff_wins}</td>
        <td>${stat.third_place}</td>
        <td>${stat.second_place}</td>
        <td>${stat.first_place}</td>
      </tr>
    `;
  });
  
  html += `
      </tbody>
    </table>
  `;
  
  historyContent.innerHTML = html;
  
  // Add sort functionality
  const headers = historyContent.querySelectorAll('th[data-sort]');
  let currentSort = { column: 'wins', direction: 'desc' };
  
  headers.forEach(header => {
    header.addEventListener('click', () => {
      const column = header.getAttribute('data-sort');
      
      // Toggle direction if same column
      if (currentSort.column === column) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
      } else {
        currentSort.column = column;
        currentSort.direction = 'desc';
      }
      
      // Sort data
      managerStats.sort((a, b) => {
        let aVal = a[column];
        let bVal = b[column];
        
        // Handle numeric sorting
        if (column !== 'username') {
          aVal = parseFloat(aVal) || 0;
          bVal = parseFloat(bVal) || 0;
        }
        
        if (currentSort.direction === 'asc') {
          return aVal > bVal ? 1 : -1;
        } else {
          return aVal < bVal ? 1 : -1;
        }
      });
      
      // Update UI
      headers.forEach(h => {
        h.classList.remove('sorted-asc', 'sorted-desc');
      });
      header.classList.add(`sorted-${currentSort.direction}`);
      
      // Re-render
      renderHistoryTable(managerStats);
    });
  });
}

// ============================================================================
// HISTORY ADMIN PANEL
// ============================================================================

function renderHistoryAdminPanel() {
  if (!activeLeagueId || !currentUsers.length) {
    historyAdminPanel.innerHTML = '<div class="muted-text">No league selected.</div>';
    return;
  }
  
  const teamSettings = getTeamSettings(activeLeagueId);
  const histData = historicalCache.get(activeLeagueId);
  
  let html = '<h4 style="margin-top:0; margin-bottom: 12px; color: var(--accent);">Team Settings</h4>';
  
  currentUsers.forEach(user => {
    const userId = user.user_id;
    const settings = teamSettings[userId] || {};
    const displayName = user.display_name || user.username;
    
    html += `
      <div class="history-admin-team">
        <div class="history-admin-team-header">
          <div class="history-admin-team-name">${escapeHtml(displayName)}</div>
        </div>
        <div class="history-admin-controls">
          <div>
            <div class="history-admin-label">Custom Display Name</div>
            <input type="text" 
              class="history-admin-input" 
              placeholder="${escapeHtml(displayName)}"
              value="${escapeHtml(settings.customName || '')}"
              data-user-id="${userId}"
              data-field="customName">
          </div>
          <div>
            <div class="history-admin-label">Team Color</div>
            <input type="color" 
              class="history-admin-input" 
              value="${settings.customColor || '#f5c451'}"
              data-user-id="${userId}"
              data-field="customColor">
          </div>
        </div>
        ${histData && histData.seasons.length > 0 ? `
          <div style="margin-top: 8px;">
            <div class="history-admin-label">Exclude Seasons</div>
            <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px;">
              ${histData.seasons.map(season => `
                <label style="display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--text-secondary);">
                  <input type="checkbox" 
                    value="${season.season}"
                    ${settings.excludeSeasons && settings.excludeSeasons.includes(season.season) ? 'checked' : ''}
                    data-user-id="${userId}"
                    data-field="excludeSeasons">
                  ${season.season}
                </label>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  });
  
  html += `
    <button class="btn btn-primary" id="saveHistorySettings" style="margin-top: 12px;">
      Save Settings
    </button>
  `;
  
  historyAdminPanel.innerHTML = html;
  
  // Add save handler
  document.getElementById('saveHistorySettings').addEventListener('click', () => {
    const updatedSettings = {};
    
    // Gather all input values
    const inputs = historyAdminPanel.querySelectorAll('input[data-user-id]');
    inputs.forEach(input => {
      const userId = input.getAttribute('data-user-id');
      const field = input.getAttribute('data-field');
      
      if (!updatedSettings[userId]) {
        updatedSettings[userId] = teamSettings[userId] || {};
      }
      
      if (field === 'excludeSeasons') {
        if (!updatedSettings[userId].excludeSeasons) {
          updatedSettings[userId].excludeSeasons = [];
        }
        if (input.checked) {
          updatedSettings[userId].excludeSeasons.push(input.value);
        }
      } else if (input.type === 'checkbox') {
        updatedSettings[userId][field] = input.checked;
      } else {
        updatedSettings[userId][field] = input.value;
      }
    });
    
    saveTeamSettings(activeLeagueId, updatedSettings);
    alert('Settings saved!');
    renderHistoryTab();
  });
}

// ============================================================================
// ============================================================================
// AWARDS TAB RENDERING - NEW IMPLEMENTATION WITH SUB-TABS
// ============================================================================

// Active awards sub-tab
let activeAwardsSubTab = 'alltime';

async function renderAwardsTab() {
  // Render the active sub-tab
  if (activeAwardsSubTab === 'alltime') {
    await renderAwardsAllTimeTab();
  } else if (activeAwardsSubTab === 'season') {
    await renderAwardsSeasonTab();
  } else if (activeAwardsSubTab === 'weekly') {
    await renderAwardsWeeklyTab();
  }
}

// ============================================================================
// ALL-TIME TAB
// ============================================================================

async function renderAwardsAllTimeTab() {
  const content = document.getElementById('awardsAllTimeContent');
  
  if (!activeLeagueId) {
    content.innerHTML = '<div class="muted-text">Select a league to view awards.</div>';
    return;
  }
  
  const histData = historicalCache.get(activeLeagueId);
  if (!histData || !playersData) {
    content.innerHTML = '<div class="muted-text">Loading awards data...</div>';
    return;
  }
  
  content.innerHTML = '<div class="muted-text">Calculating all-time awards...</div>';
  
  // Calculate all awards
  const awards = await calculateAllTimeAwards(histData);
  
  // Render sections
  let html = '';
  
  // Hall of Fame
  html += '<div class="awards-section-title">🏆 Hall of Fame</div>';
  html += '<div class="awards-grid-full">';
  html += renderAwardCard('Most Points (Season)', awards.hallOfFame.mostPointsSeason);
  html += renderAwardCard('Most Points (Week)', awards.hallOfFame.mostPointsWeek);
  html += renderAwardCard('Biggest Blowout', awards.hallOfFame.biggestBlowout);
  html += renderAwardCard('Highest Scoring QB', awards.hallOfFame.topQB);
  html += renderAwardCard('Highest Scoring RB', awards.hallOfFame.topRB);
  html += renderAwardCard('Highest Scoring WR', awards.hallOfFame.topWR);
  html += renderAwardCard('Highest Scoring TE', awards.hallOfFame.topTE);
  html += '</div>';
  
  // Hall of Shame
  html += '<div class="awards-section-title">💀 Hall of Shame</div>';
  html += '<div class="awards-grid-full">';
  html += renderAwardCard('Least Points (Season)', awards.hallOfShame.leastPointsSeason);
  html += renderAwardCard('Least Points (Week)', awards.hallOfShame.leastPointsWeek);
  html += renderAwardCard('Biggest Loss', awards.hallOfShame.biggestLoss);
  html += '</div>';
  
  // Trades & Waivers
  html += '<div class="awards-section-title">📊 Trades & Waivers</div>';
  html += '<div class="awards-grid-full">';
  html += renderAwardCard('Best Trade', awards.tradesWaivers.bestTrade);
  html += renderAwardCard('Best QB Waiver', awards.tradesWaivers.bestQBWaiver);
  html += renderAwardCard('Best RB Waiver', awards.tradesWaivers.bestRBWaiver);
  html += renderAwardCard('Best WR Waiver', awards.tradesWaivers.bestWRWaiver);
  html += renderAwardCard('Best TE Waiver', awards.tradesWaivers.bestTEWaiver);
  html += '</div>';
  
  content.innerHTML = html;
}

// ============================================================================
// SEASON TAB (Placeholder)
// ============================================================================

async function renderAwardsSeasonTab() {
  const content = document.getElementById('awardsSeasonContent');
  content.innerHTML = '<div class="muted-text">Season tab coming soon...</div>';
}

// ============================================================================
// WEEKLY TAB (Placeholder)
// ============================================================================

async function renderAwardsWeeklyTab() {
  const content = document.getElementById('awardsWeeklyContent');
  content.innerHTML = '<div class="muted-text">Weekly tab coming soon...</div>';
}

// ============================================================================
// ALL-TIME AWARDS CALCULATION
// ============================================================================

async function calculateAllTimeAwards(histData) {
  const teamSettings = getTeamSettings(activeLeagueId);
  
  const getTeamName = (roster) => {
    if (!roster) return 'Unknown Team';
    const user = currentUsers.find(u => u.user_id === roster.owner_id);
    const settings = teamSettings[roster.owner_id] || {};
    return settings.customName || (user ? (user.display_name || user.username) : 'Unknown Team');
  };
  
  const getTeamColor = (roster) => {
    if (!roster) return '#f5c451';
    const settings = teamSettings[roster.owner_id] || {};
    return settings.customColor || '#f5c451';
  };
  
  // Initialize tracking
  let mostPointsSeason = { points: 0, team: null, season: null, roster: null };
  let mostPointsWeek = { points: 0, team: null, week: null, season: null, roster: null };
  let leastPointsSeason = { points: Infinity, team: null, season: null, roster: null };
  let leastPointsWeek = { points: Infinity, team: null, week: null, season: null, roster: null };
  let biggestBlowout = { margin: 0, winner: null, loser: null, week: null, season: null, winnerScore: 0, loserScore: 0 };
  let biggestLoss = { margin: 0, winner: null, loser: null, week: null, season: null, winnerScore: 0, loserScore: 0 };
  
  // Player scoring tracking
  const playerSeasonScoring = []; // { playerId, position, points, season, rosterId }
  
  // Waiver tracking
  const bestWaivers = { QB: null, RB: null, WR: null, TE: null };
  
  // Iterate through all seasons
  histData.seasons.forEach(seasonInfo => {
    const season = seasonInfo.season;
    const matchupsByWeek = histData.allMatchups.get(season);
    const rosters = histData.allRosters.get(season);
    const waivers = histData.allWaivers.get(season) || [];
    
    if (!matchupsByWeek || !rosters) return;
    
    const rosterByRosterId = new Map();
    rosters.forEach(r => rosterByRosterId.set(r.roster_id, r));
    
    // Track season totals
    const seasonTotals = new Map(); // roster_id -> total points
    
    // Process each week
    matchupsByWeek.forEach((weekMatchups, week) => {
      weekMatchups.forEach(matchup => {
        const roster = rosterByRosterId.get(matchup.roster_id);
        if (!roster) return;
        
        const points = matchup.points || 0;
        
        // Update season totals
        const current = seasonTotals.get(matchup.roster_id) || 0;
        seasonTotals.set(matchup.roster_id, current + points);
        
        // Check weekly records
        if (points > mostPointsWeek.points) {
          mostPointsWeek = { points, team: roster, week, season, roster };
        }
        if (points < leastPointsWeek.points && points > 0) {
          leastPointsWeek = { points, team: roster, week, season, roster };
        }
        
        // Track player scoring in starters
        if (matchup.starters && matchup.starters_points) {
          matchup.starters.forEach((playerId, idx) => {
            if (playerId && matchup.starters_points[idx]) {
              const player = playersData[playerId];
              if (player && ['QB', 'RB', 'WR', 'TE'].includes(player.position)) {
                playerSeasonScoring.push({
                  playerId,
                  position: player.position,
                  points: matchup.starters_points[idx],
                  season,
                  week,
                  rosterId: matchup.roster_id
                });
              }
            }
          });
        }
        
        // Check blowouts
        if (matchup.matchup_id) {
          const opponent = weekMatchups.find(m => 
            m.matchup_id === matchup.matchup_id && m.roster_id !== matchup.roster_id
          );
          
          if (opponent) {
            const margin = Math.abs((matchup.points || 0) - (opponent.points || 0));
            const isWinner = (matchup.points || 0) > (opponent.points || 0);
            
            if (isWinner && margin > biggestBlowout.margin) {
              const opponentRoster = rosterByRosterId.get(opponent.roster_id);
              biggestBlowout = {
                margin,
                winner: roster,
                loser: opponentRoster,
                week,
                season,
                winnerScore: matchup.points || 0,
                loserScore: opponent.points || 0
              };
            }
            
            if (!isWinner && margin > biggestLoss.margin) {
              const opponentRoster = rosterByRosterId.get(opponent.roster_id);
              biggestLoss = {
                margin,
                winner: opponentRoster,
                loser: roster,
                week,
                season,
                winnerScore: opponent.points || 0,
                loserScore: matchup.points || 0
              };
            }
          }
        }
      });
    });
    
    // Check season totals
    seasonTotals.forEach((points, rosterId) => {
      const roster = rosterByRosterId.get(rosterId);
      if (roster) {
        if (points > mostPointsSeason.points) {
          mostPointsSeason = { points, team: roster, season, roster };
        }
        if (points < leastPointsSeason.points) {
          leastPointsSeason = { points, team: roster, season, roster };
        }
      }
    });
    
    // Process waivers for this season
    waivers.forEach(transaction => {
      if (transaction.status !== 'complete' || !transaction.adds) return;
      
      const pickupWeek = transaction.leg || 1;
      
      Object.keys(transaction.adds).forEach(playerId => {
        const rosterId = transaction.adds[playerId];
        const player = playersData[playerId];
        
        if (!player || !['QB', 'RB', 'WR', 'TE'].includes(player.position)) return;
        
        // Calculate points from pickup week forward (starters only)
        let totalPoints = 0;
        playerSeasonScoring
          .filter(p => p.playerId === playerId && p.season === season && p.week >= pickupWeek && p.rosterId === rosterId)
          .forEach(p => totalPoints += p.points);
        
        if (totalPoints > 0) {
          const currentBest = bestWaivers[player.position];
          if (!currentBest || totalPoints > currentBest.points) {
            const roster = rosterByRosterId.get(rosterId);
            if (roster) {
              bestWaivers[player.position] = {
                player,
                points: totalPoints,
                season,
                team: roster,
                pickupWeek
              };
            }
          }
        }
      });
    });
  });
  
  // Aggregate player season stats
  const playerSeasonTotals = new Map(); // `${playerId}-${season}` -> { points, rosterId }
  playerSeasonScoring.forEach(entry => {
    const key = `${entry.playerId}-${entry.season}`;
    const current = playerSeasonTotals.get(key) || { points: 0, rosterId: entry.rosterId, season: entry.season };
    current.points += entry.points;
    playerSeasonTotals.set(key, current);
  });
  
  // Find top player by position
  const topPlayers = { QB: null, RB: null, WR: null, TE: null };
  
  playerSeasonTotals.forEach((data, key) => {
    const [playerId, season] = key.split('-');
    const player = playersData[playerId];
    
    if (!player || !['QB', 'RB', 'WR', 'TE'].includes(player.position)) return;
    
    const rosters = histData.allRosters.get(season);
    if (!rosters) return;
    
    const roster = rosters.find(r => r.roster_id === data.rosterId);
    if (!roster) return;
    
    const currentTop = topPlayers[player.position];
    if (!currentTop || data.points > currentTop.points) {
      topPlayers[player.position] = {
        player,
        points: data.points,
        season,
        team: roster
      };
    }
  });
  
  // Build award objects
  return {
    hallOfFame: {
      mostPointsSeason: mostPointsSeason.team ? {
        winner: getTeamName(mostPointsSeason.team),
        teamName: getTeamName(mostPointsSeason.team),
        teamColor: getTeamColor(mostPointsSeason.team),
        blurb: `<span class="award-stat">${getTeamName(mostPointsSeason.team)}</span> dominated the ${mostPointsSeason.season} season with <span class="award-stat">${mostPointsSeason.points.toFixed(1)} points</span>, the highest single-season total in league history.`
      } : null,
      
      mostPointsWeek: mostPointsWeek.team ? {
        winner: getTeamName(mostPointsWeek.team),
        teamName: getTeamName(mostPointsWeek.team),
        teamColor: getTeamColor(mostPointsWeek.team),
        blurb: `<span class="award-stat">${getTeamName(mostPointsWeek.team)}</span> exploded for <span class="award-stat">${mostPointsWeek.points.toFixed(1)} points</span> in Week ${mostPointsWeek.week} of ${mostPointsWeek.season}, the highest single-week score ever.`
      } : null,
      
      biggestBlowout: biggestBlowout.winner ? {
        winner: getTeamName(biggestBlowout.winner),
        teamName: getTeamName(biggestBlowout.winner),
        teamColor: getTeamColor(biggestBlowout.winner),
        blurb: `<span class="award-stat">${getTeamName(biggestBlowout.winner)}</span> destroyed <span class="award-stat">${getTeamName(biggestBlowout.loser)}</span> by <span class="award-stat">${biggestBlowout.margin.toFixed(1)} points</span> (${biggestBlowout.winnerScore.toFixed(1)}-${biggestBlowout.loserScore.toFixed(1)}) in Week ${biggestBlowout.week} of ${biggestBlowout.season}.`
      } : null,
      
      topQB: topPlayers.QB ? {
        winner: topPlayers.QB.player.full_name,
        teamName: getTeamName(topPlayers.QB.team),
        teamColor: getTeamColor(topPlayers.QB.team),
        blurb: `<span class="award-stat">${topPlayers.QB.player.full_name}</span> (${getTeamName(topPlayers.QB.team)}) scored <span class="award-stat">${topPlayers.QB.points.toFixed(1)} points</span> in ${topPlayers.QB.season}, the highest QB season ever.`
      } : null,
      
      topRB: topPlayers.RB ? {
        winner: topPlayers.RB.player.full_name,
        teamName: getTeamName(topPlayers.RB.team),
        teamColor: getTeamColor(topPlayers.RB.team),
        blurb: `<span class="award-stat">${topPlayers.RB.player.full_name}</span> (${getTeamName(topPlayers.RB.team)}) scored <span class="award-stat">${topPlayers.RB.points.toFixed(1)} points</span> in ${topPlayers.RB.season}, the highest RB season ever.`
      } : null,
      
      topWR: topPlayers.WR ? {
        winner: topPlayers.WR.player.full_name,
        teamName: getTeamName(topPlayers.WR.team),
        teamColor: getTeamColor(topPlayers.WR.team),
        blurb: `<span class="award-stat">${topPlayers.WR.player.full_name}</span> (${getTeamName(topPlayers.WR.team)}) scored <span class="award-stat">${topPlayers.WR.points.toFixed(1)} points</span> in ${topPlayers.WR.season}, the highest WR season ever.`
      } : null,
      
      topTE: topPlayers.TE ? {
        winner: topPlayers.TE.player.full_name,
        teamName: getTeamName(topPlayers.TE.team),
        teamColor: getTeamColor(topPlayers.TE.team),
        blurb: `<span class="award-stat">${topPlayers.TE.player.full_name}</span> (${getTeamName(topPlayers.TE.team)}) scored <span class="award-stat">${topPlayers.TE.points.toFixed(1)} points</span> in ${topPlayers.TE.season}, the highest TE season ever.`
      } : null
    },
    
    hallOfShame: {
      leastPointsSeason: leastPointsSeason.team ? {
        winner: getTeamName(leastPointsSeason.team),
        teamName: getTeamName(leastPointsSeason.team),
        teamColor: getTeamColor(leastPointsSeason.team),
        blurb: `<span class="award-stat">${getTeamName(leastPointsSeason.team)}</span> struggled through ${leastPointsSeason.season} with only <span class="award-stat">${leastPointsSeason.points.toFixed(1)} points</span>, the lowest season total in league history.`
      } : null,
      
      leastPointsWeek: leastPointsWeek.team ? {
        winner: getTeamName(leastPointsWeek.team),
        teamName: getTeamName(leastPointsWeek.team),
        teamColor: getTeamColor(leastPointsWeek.team),
        blurb: `<span class="award-stat">${getTeamName(leastPointsWeek.team)}</span> put up a pathetic <span class="award-stat">${leastPointsWeek.points.toFixed(1)} points</span> in Week ${leastPointsWeek.week} of ${leastPointsWeek.season}, the lowest single-week score ever.`
      } : null,
      
      biggestLoss: biggestLoss.loser ? {
        winner: getTeamName(biggestLoss.loser),
        teamName: getTeamName(biggestLoss.loser),
        teamColor: getTeamColor(biggestLoss.loser),
        blurb: `<span class="award-stat">${getTeamName(biggestLoss.loser)}</span> got demolished by <span class="award-stat">${getTeamName(biggestLoss.winner)}</span> by <span class="award-stat">${biggestLoss.margin.toFixed(1)} points</span> (${biggestLoss.loserScore.toFixed(1)}-${biggestLoss.winnerScore.toFixed(1)}) in Week ${biggestLoss.week} of ${biggestLoss.season}.`
      } : null
    },
    
    tradesWaivers: {
      bestTrade: {
        winner: 'Coming Soon',
        teamName: 'Coming Soon',
        teamColor: '#666',
        blurb: 'Best trade calculation coming soon (complex starter-only tracking required).'
      },
      
      bestQBWaiver: bestWaivers.QB ? {
        winner: bestWaivers.QB.player.full_name,
        teamName: getTeamName(bestWaivers.QB.team),
        teamColor: getTeamColor(bestWaivers.QB.team),
        blurb: `<span class="award-stat">${getTeamName(bestWaivers.QB.team)}</span> picked up <span class="award-stat">${bestWaivers.QB.player.full_name}</span> in Week ${bestWaivers.QB.pickupWeek} of ${bestWaivers.QB.season}, who went on to score <span class="award-stat">${bestWaivers.QB.points.toFixed(1)} points</span> in starting lineups.`
      } : null,
      
      bestRBWaiver: bestWaivers.RB ? {
        winner: bestWaivers.RB.player.full_name,
        teamName: getTeamName(bestWaivers.RB.team),
        teamColor: getTeamColor(bestWaivers.RB.team),
        blurb: `<span class="award-stat">${getTeamName(bestWaivers.RB.team)}</span> picked up <span class="award-stat">${bestWaivers.RB.player.full_name}</span> in Week ${bestWaivers.RB.pickupWeek} of ${bestWaivers.RB.season}, who went on to score <span class="award-stat">${bestWaivers.RB.points.toFixed(1)} points</span> in starting lineups.`
      } : null,
      
      bestWRWaiver: bestWaivers.WR ? {
        winner: bestWaivers.WR.player.full_name,
        teamName: getTeamName(bestWaivers.WR.team),
        teamColor: getTeamColor(bestWaivers.WR.team),
        blurb: `<span class="award-stat">${getTeamName(bestWaivers.WR.team)}</span> picked up <span class="award-stat">${bestWaivers.WR.player.full_name}</span> in Week ${bestWaivers.WR.pickupWeek} of ${bestWaivers.WR.season}, who went on to score <span class="award-stat">${bestWaivers.WR.points.toFixed(1)} points</span> in starting lineups.`
      } : null,
      
      bestTEWaiver: bestWaivers.TE ? {
        winner: bestWaivers.TE.player.full_name,
        teamName: getTeamName(bestWaivers.TE.team),
        teamColor: getTeamColor(bestWaivers.TE.team),
        blurb: `<span class="award-stat">${getTeamName(bestWaivers.TE.team)}</span> picked up <span class="award-stat">${bestWaivers.TE.player.full_name}</span> in Week ${bestWaivers.TE.pickupWeek} of ${bestWaivers.TE.season}, who went on to score <span class="award-stat">${bestWaivers.TE.points.toFixed(1)} points</span> in starting lineups.`
      } : null
    }
  };
}

// ============================================================================
// AWARD CARD RENDERING HELPER
// ============================================================================

function renderAwardCard(title, awardData) {
  if (!awardData || !awardData.winner) {
    return `
      <div class="award-card">
        <div class="award-card-header">
          <div class="award-title">${title}</div>
        </div>
        <div class="award-description" style="text-align: center; color: var(--text-muted);">
          No data available
        </div>
      </div>
    `;
  }
  
  const teamColor = awardData.teamColor || '#f5c451';
  
  return `
    <div class="award-card">
      <div class="award-card-header">
        <div class="award-title">${title}</div>
      </div>
      <div class="award-team" style="background-color: ${teamColor}33; border-left: 3px solid ${teamColor};">
        ${escapeHtml(awardData.teamName || awardData.winner)}
      </div>
      <div class="award-description">
        ${awardData.blurb}
      </div>
    </div>
  `;
}

// ============================================================================
// MATCHUP TAB RENDERING (NEXT SECTION STARTS HERE)
// ============================================================================
async function renderMatchupTab() {
  if (!activeLeagueId || !currentMatchups.length) {
    matchupContainer.innerHTML = '<div class="muted-text">Select a league to view current matchups.</div>';
    return;
  }
  
  // Group matchups by matchup_id
  const matchupPairs = new Map();
  currentMatchups.forEach(m => {
    if (!matchupPairs.has(m.matchup_id)) {
      matchupPairs.set(m.matchup_id, []);
    }
    matchupPairs.get(m.matchup_id).push(m);
  });
  
  const teamSettings = getTeamSettings(activeLeagueId);
  
  let html = '<div class="matchups-grid">';
  
  matchupPairs.forEach((pair, matchupId) => {
    if (pair.length !== 2) return;
    
    const [team1Matchup, team2Matchup] = pair;
    const roster1 = currentRosters.find(r => r.roster_id === team1Matchup.roster_id);
    const roster2 = currentRosters.find(r => r.roster_id === team2Matchup.roster_id);
    
    const user1 = currentUsers.find(u => u.user_id === roster1?.owner_id);
    const user2 = currentUsers.find(u => u.user_id === roster2?.owner_id);
    
    const settings1 = teamSettings[roster1?.owner_id] || {};
    const settings2 = teamSettings[roster2?.owner_id] || {};
    
    const team1Name = settings1.customName || user1?.display_name || user1?.username || 'Team 1';
    const team2Name = settings2.customName || user2?.display_name || user2?.username || 'Team 2';
    
    const team1Color = settings1.customColor || '#f5c451';
    const team2Color = settings2.customColor || '#3498db';
    
    html += `
      <div class="matchup-card">
        <div class="matchup-team">
          <div class="matchup-team-name" style="background-color: ${team1Color}33; border-left: 3px solid ${team1Color};">
            ${escapeHtml(team1Name)}
          </div>
          <div class="matchup-score">${(team1Matchup.points || 0).toFixed(2)}</div>
        </div>
        <div class="matchup-vs">VS</div>
        <div class="matchup-team right">
          <div class="matchup-team-name" style="background-color: ${team2Color}33; border-left: 3px solid ${team2Color};">
            ${escapeHtml(team2Name)}
          </div>
          <div class="matchup-score">${(team2Matchup.points || 0).toFixed(2)}</div>
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  matchupContainer.innerHTML = html;
}

async function renderStandingsTab() {
  if (!activeLeagueId || !currentRosters.length) {
    standingsContainer.innerHTML = '<div class="muted-text">Select a league to view standings.</div>';
    return;
  }
  
  const teamSettings = getTeamSettings(activeLeagueId);
  
  // Sort rosters by wins, then by points
  const sortedRosters = [...currentRosters].sort((a, b) => {
    if ((b.settings?.wins || 0) !== (a.settings?.wins || 0)) {
      return (b.settings?.wins || 0) - (a.settings?.wins || 0);
    }
    return (b.settings?.fpts || 0) - (a.settings?.fpts || 0);
  });
  
  let html = `
    <div class="standings-section">
      <div class="standings-section-title">Current Standings</div>
      <table class="standings-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Team</th>
            <th>Record</th>
            <th>Points For</th>
            <th>Points Against</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  sortedRosters.forEach((roster, idx) => {
    const user = currentUsers.find(u => u.user_id === roster.owner_id);
    const settings = teamSettings[roster.owner_id] || {};
    const teamName = settings.customName || user?.display_name || user?.username || 'Unknown';
    const teamColor = settings.customColor || '#f5c451';
    
    html += `
      <tr>
        <td>${idx + 1}</td>
        <td>
          <div class="standings-team-cell">
            <div class="standings-team-name" style="background-color: ${teamColor}33; border-left: 3px solid ${teamColor};">
              ${escapeHtml(teamName)}
            </div>
          </div>
        </td>
        <td>${roster.settings?.wins || 0}-${roster.settings?.losses || 0}</td>
        <td>${(roster.settings?.fpts || 0).toFixed(2)}</td>
        <td>${(roster.settings?.fpts_against || 0).toFixed(2)}</td>
      </tr>
    `;
  });
  
  html += `
        </tbody>
      </table>
    </div>
  `;
  
  standingsContainer.innerHTML = html;
}

async function renderPowerTab() {
  if (!activeLeagueId || !currentRosters.length) {
    powerTableContainer.innerHTML = '<div class="muted-text">Select a league to generate power rankings.</div>';
    return;
  }
  
  const teamSettings = getTeamSettings(activeLeagueId);
  
  // Simple power ranking based on record and points
  const rankings = currentRosters.map(roster => {
    const user = currentUsers.find(u => u.user_id === roster.owner_id);
    const settings = teamSettings[roster.owner_id] || {};
    
    return {
      roster_id: roster.roster_id,
      team: settings.customName || user?.display_name || user?.username || 'Unknown',
      teamColor: settings.customColor || '#f5c451',
      wins: roster.settings?.wins || 0,
      losses: roster.settings?.losses || 0,
      points: roster.settings?.fpts || 0,
      powerScore: (roster.settings?.wins || 0) * 100 + (roster.settings?.fpts || 0)
    };
  });
  
  rankings.sort((a, b) => b.powerScore - a.powerScore);
  
  let html = `
    <table class="table">
      <thead>
        <tr>
          <th>Rank</th>
          <th>Team</th>
          <th>Record</th>
          <th>Points For</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  rankings.forEach((rank, idx) => {
    html += `
      <tr>
        <td>${idx + 1}</td>
        <td>
          <div style="padding: 6px 12px; border-radius: 8px; background-color: ${rank.teamColor}33; border-left: 3px solid ${rank.teamColor};">
            ${escapeHtml(rank.team)}
          </div>
        </td>
        <td>${rank.wins}-${rank.losses}</td>
        <td>${rank.points.toFixed(2)}</td>
      </tr>
    `;
  });
  
  html += `
      </tbody>
    </table>
  `;
  
  powerTableContainer.innerHTML = html;
  lastPowerRows = rankings;
}

// ============================================================================
// PRESENTATION MODE FUNCTIONS (Simplified placeholders)
// ============================================================================

function enterPowerPresentationMode() {
  activePresentationMode = 'power';
  powerPresentationActive = true;
  powerPresentationStep = -1;
  renderPowerPresentation();
}

function renderPowerPresentation() {
  // Placeholder for presentation mode
  powerPresentationContainer.classList.remove('hidden');
  powerTableContainer.classList.add('hidden');
  powerPresentationContainer.innerHTML = '<div class="muted-text">Presentation mode coming soon...</div>';
}

function enterMatchupPresentationMode() {
  activePresentationMode = 'matchup';
  matchupPresentationActive = true;
  matchupPresentationStep = -1;
  renderMatchupPresentation();
}

function renderMatchupPresentation() {
  matchupPresentationContainer.classList.remove('hidden');
  matchupContainer.classList.add('hidden');
  matchupPresentationContainer.innerHTML = '<div class="muted-text">Presentation mode coming soon...</div>';
}

function enterStandingsPresentationMode() {
  activePresentationMode = 'standings';
  standingsPresentationActive = true;
  standingsPresentationStep = -1;
  renderStandingsPresentation();
}

function renderStandingsPresentation() {
  standingsPresentationContainer.classList.remove('hidden');
  standingsContainer.classList.add('hidden');
  standingsPresentationContainer.innerHTML = '<div class="muted-text">Presentation mode coming soon...</div>';
}

function renderPowerAdminPanel() {
  powerAdminPanel.innerHTML = '<div class="muted-text">Power rankings admin panel coming soon...</div>';
}

function renderMatchupAdminPanel() {
  matchupAdminPanel.innerHTML = '<div class="muted-text">Matchup admin panel coming soon...</div>';
}

function renderStandingsAdminPanel() {
  standingsAdminPanel.innerHTML = '<div class="muted-text">Standings admin panel coming soon...</div>';
}

// ============================================================================
// ============================================================================
// DRAFT TAB RENDERING - ENHANCED VERSION
// Replace the existing "DRAFT TAB RENDERING" section with this code
// ============================================================================

async function renderDraftTab() {
  if (!activeLeagueId) {
    draftPicksContent.innerHTML = '<div class="muted-text">Select a league to view draft analysis.</div>';
    draftGradesContent.innerHTML = '';
    draftBoardContent.innerHTML = '';
    return;
  }
  
  const selectedSeason = draftSeasonSelect.value;
  if (!selectedSeason) {
    draftPicksContent.innerHTML = '<div class="muted-text">Select a season to view draft analysis.</div>';
    draftGradesContent.innerHTML = '';
    draftBoardContent.innerHTML = '';
    return;
  }
  
  const histData = historicalCache.get(activeLeagueId);
  if (!histData || !playersData) {
    draftPicksContent.innerHTML = '<div class="muted-text">Loading draft data...</div>';
    draftGradesContent.innerHTML = '';
    draftBoardContent.innerHTML = '';
    return;
  }
  
  const draftPicks = histData.allDrafts.get(selectedSeason);
  const matchupsByWeek = histData.allMatchups.get(selectedSeason);
  const rosters = histData.allRosters.get(selectedSeason);
  const trades = histData.allTrades.get(selectedSeason) || [];
  const waivers = histData.allWaivers.get(selectedSeason) || [];
  
  if (!draftPicks || draftPicks.length === 0) {
    draftPicksContent.innerHTML = '<div class="muted-text">No draft data available for this season.</div>';
    draftGradesContent.innerHTML = '';
    draftBoardContent.innerHTML = '';
    return;
  }
  
  draftPicksContent.innerHTML = '<div class="muted-text">Analyzing draft picks...</div>';
  
  // Get evaluation week
  const evalWeek = draftWeekSelect.value === 'all' ? null : parseInt(draftWeekSelect.value);
  
  // Calculate pick ratings with simple position differential
  const pickRatings = calculateDraftPickRatings(
    draftPicks, matchupsByWeek, rosters, trades, waivers, selectedSeason, evalWeek
  );
  
  // Render best/worst picks cards
  renderDraftPicksCards(pickRatings, evalWeek);
  
  // Render draft board
  renderDraftBoard(draftPicks, pickRatings, rosters, selectedSeason);
}

function calculateDraftPickRatings(draftPicks, matchupsByWeek, rosters, trades, waivers, season, evalWeek) {
  if (!matchupsByWeek || !playersData) return [];
  
  const positions = ['QB', 'RB', 'WR', 'TE'];
  const pickRatings = [];
  
  // Track player ownership changes (trades and drops)
  const playerOwnershipChanges = new Map(); // playerId -> [{week, oldRoster, newRoster, type}]
  
  // Process trades
  trades.forEach(trade => {
    if (trade.status !== 'complete') return;
    const tradeWeek = trade.leg || 1;
    
    // Sleeper trade structure: adds contains playerId -> newRosterId, drops contains playerId -> oldRosterId
    if (trade.adds) {
      Object.keys(trade.adds).forEach(playerId => {
        const newRosterId = trade.adds[playerId];
        
        // Find old roster by checking which roster_id key has this player in their side of trade
        let oldRosterId = null;
        if (trade.drops && trade.drops[playerId]) {
          oldRosterId = trade.drops[playerId];
        }
        
        if (!playerOwnershipChanges.has(playerId)) {
          playerOwnershipChanges.set(playerId, []);
        }
        
        // Record both the trade away and trade to
        if (oldRosterId) {
          playerOwnershipChanges.get(playerId).push({
            week: tradeWeek,
            oldRosterId: parseInt(oldRosterId),
            newRosterId: parseInt(newRosterId),
            type: 'trade'
          });
        }
      });
    }
  });
  
  // Process waivers/drops
  waivers.forEach(transaction => {
    if (transaction.status !== 'complete') return;
    const week = transaction.leg || 1;
    
    if (transaction.drops) {
      Object.keys(transaction.drops).forEach(playerId => {
        const oldRosterId = transaction.drops[playerId];
        
        if (!playerOwnershipChanges.has(playerId)) {
          playerOwnershipChanges.set(playerId, []);
        }
        playerOwnershipChanges.get(playerId).push({
          week,
          oldRosterId,
          newRosterId: null,
          type: 'drop'
        });
      });
    }
  });
  
  // Calculate points for each player through the evaluation week
  const playerSeasonPoints = new Map();
  
  matchupsByWeek.forEach((weekMatchups, week) => {
    // Skip weeks beyond evaluation point
    if (evalWeek && week > evalWeek) return;
    
    weekMatchups.forEach(matchup => {
      if (matchup.starters && matchup.starters_points) {
        matchup.starters.forEach((playerId, idx) => {
          if (!playerId || !matchup.starters_points[idx]) return;
          
          const current = playerSeasonPoints.get(playerId) || 0;
          playerSeasonPoints.set(playerId, current + matchup.starters_points[idx]);
        });
      }
    });
  });
  
  // Group players by position and rank them based on points through eval week
  const positionRankings = {};
  positions.forEach(pos => {
    positionRankings[pos] = [];
  });
  
  playerSeasonPoints.forEach((points, playerId) => {
    const player = playersData[playerId];
    if (player && player.position && positions.includes(player.position)) {
      positionRankings[player.position].push({ playerId, points, player });
    }
  });
  
  // Sort each position by points (descending)
  positions.forEach(pos => {
    positionRankings[pos].sort((a, b) => b.points - a.points);
  });
  
  // Analyze each draft pick
  draftPicks.forEach(pick => {
    const player = playersData[pick.player_id];
    if (!player || !player.position || !positions.includes(player.position)) return;
    
    // Find their draft position within their position group
    const posDraftPicks = draftPicks
      .filter(p => playersData[p.player_id]?.position === player.position)
      .sort((a, b) => a.pick_no - b.pick_no);
    
    const draftRank = posDraftPicks.findIndex(p => p.player_id === pick.player_id);
    
    if (draftRank === -1) return;
    
    // Find their season rank within position
    const posRanking = positionRankings[player.position];
    const seasonRank = posRanking.findIndex(p => p.playerId === pick.player_id);
    
    const pointsScored = seasonRank !== -1 ? posRanking[seasonRank].points : 0;
    const improvement = seasonRank !== -1 ? draftRank - seasonRank : draftRank;
    
    // Check if traded or dropped
    const changes = playerOwnershipChanges.get(pick.player_id) || [];
    const tradeChange = changes.find(c => c.type === 'trade' && c.oldRosterId === pick.roster_id);
    const dropChange = changes.find(c => c.type === 'drop' && c.oldRosterId === pick.roster_id);
    
    let status = 'active';
    let statusWeek = null;
    
    if (tradeChange) {
      status = 'traded';
      statusWeek = tradeChange.week;
    } else if (dropChange) {
      status = 'dropped';
      statusWeek = dropChange.week;
    }
    
    // Calculate rating tier based on position improvement
    let ratingTier = 'average';
    let ratingLabel = '';
    
    if (improvement >= 5) {
      ratingTier = 'great';
      ratingLabel = `+${improvement} Steal!`;
    } else if (improvement >= 2) {
      ratingTier = 'good';
      ratingLabel = `+${improvement} Good`;
    } else if (improvement >= -1) {
      ratingTier = 'average';
      ratingLabel = improvement >= 0 ? `+${improvement}` : `${improvement}`;
    } else if (improvement >= -4) {
      ratingTier = 'poor';
      ratingLabel = `${improvement} Below`;
    } else {
      ratingTier = 'bad';
      ratingLabel = `${improvement} Bust`;
    }
    
    pickRatings.push({
      pick_no: pick.pick_no,
      player_id: pick.player_id,
      player,
      roster_id: pick.roster_id,
      draftRank: draftRank + 1,
      seasonRank: seasonRank !== -1 ? seasonRank + 1 : null,
      improvement,
      pointsScored,
      ratingTier,
      ratingLabel,
      status,
      statusWeek
    });
  });
  
  return pickRatings;
}

function calculateTeamDraftGrades(pickRatings, rosters) {
  const teamGrades = [];
  const teamSettings = getTeamSettings(activeLeagueId);
  
  // Group picks by roster
  const picksByRoster = new Map();
  pickRatings.forEach(pick => {
    if (!picksByRoster.has(pick.roster_id)) {
      picksByRoster.set(pick.roster_id, []);
    }
    picksByRoster.get(pick.roster_id).push(pick);
  });
  
  // Calculate grade for each team
  picksByRoster.forEach((picks, rosterId) => {
    const roster = rosters.find(r => r.roster_id === rosterId);
    if (!roster) return;
    
    const user = currentUsers.find(u => u.user_id === roster.owner_id);
    const settings = teamSettings[roster.owner_id] || {};
    const teamName = settings.customName || (user ? (user.display_name || user.username) : 'Team');
    const teamColor = settings.customColor || '#f5c451';
    
    // Group by position
    const positionGroups = {
      QB: picks.filter(p => p.player.position === 'QB'),
      RB: picks.filter(p => p.player.position === 'RB'),
      WR: picks.filter(p => p.player.position === 'WR'),
      TE: picks.filter(p => p.player.position === 'TE')
    };
    
    // Calculate position scores (average PAR of active players)
    const positionScores = {};
    let totalScore = 0;
    const weights = { QB: 0.20, RB: 0.35, WR: 0.35, TE: 0.10 };
    
    Object.keys(positionGroups).forEach(pos => {
      const posPlayers = positionGroups[pos].filter(p => p.status === 'active');
      if (posPlayers.length === 0) {
        positionScores[pos] = 0;
        return;
      }
      
      // Take top starters (QB: 1, RB: 2, WR: 2, TE: 1)
      const starterCounts = { QB: 1, RB: 2, WR: 2, TE: 1 };
      const topStarters = posPlayers
        .sort((a, b) => b.par - a.par)
        .slice(0, starterCounts[pos]);
      
      const avgPAR = topStarters.reduce((sum, p) => sum + p.par, 0) / topStarters.length;
      positionScores[pos] = avgPAR;
      totalScore += avgPAR * weights[pos];
    });
    
    // Normalize to 0-100 scale (assume -50 to +100 PAR range)
    const normalizedScore = Math.max(0, Math.min(100, ((totalScore + 50) / 150) * 100));
    
    // Assign letter grade
    let letterGrade = 'F';
    if (normalizedScore >= 90) letterGrade = 'A+';
    else if (normalizedScore >= 85) letterGrade = 'A';
    else if (normalizedScore >= 80) letterGrade = 'A-';
    else if (normalizedScore >= 75) letterGrade = 'B+';
    else if (normalizedScore >= 70) letterGrade = 'B';
    else if (normalizedScore >= 65) letterGrade = 'B-';
    else if (normalizedScore >= 60) letterGrade = 'C+';
    else if (normalizedScore >= 55) letterGrade = 'C';
    else if (normalizedScore >= 50) letterGrade = 'C-';
    else if (normalizedScore >= 40) letterGrade = 'D';
    
    teamGrades.push({
      roster_id: rosterId,
      teamName,
      teamColor,
      overallScore: normalizedScore,
      letterGrade,
      positionScores,
      positionGroups,
      picks
    });
  });
  
  // Sort by overall score
  teamGrades.sort((a, b) => b.overallScore - a.overallScore);
  
  return teamGrades;
}

function renderTeamDraftGrades(teamGrades) {
  if (teamGrades.length === 0) {
    draftGradesContent.innerHTML = '';
    return;
  }
  
  let html = '<div class="draft-board-title">Team Draft Grades</div>';
  html += '<div class="draft-grades-grid">';
  
  teamGrades.forEach(grade => {
    const activeCounts = {
      QB: grade.positionGroups.QB.filter(p => p.status === 'active').length,
      RB: grade.positionGroups.RB.filter(p => p.status === 'active').length,
      WR: grade.positionGroups.WR.filter(p => p.status === 'active').length,
      TE: grade.positionGroups.TE.filter(p => p.status === 'active').length
    };
    
    html += `
      <div class="draft-grade-card">
        <div class="draft-grade-header">
          <div class="draft-grade-team" style="color: ${grade.teamColor};">
            ${escapeHtml(grade.teamName)}
          </div>
          <div class="draft-grade-overall">${grade.letterGrade}</div>
        </div>
        <div class="draft-grade-positions">
          <div class="draft-grade-position">
            <span class="draft-grade-position-name">QB</span>
            <span class="draft-grade-position-score">${grade.positionScores.QB.toFixed(1)} PAR (${activeCounts.QB} active)</span>
          </div>
          <div class="draft-grade-position">
            <span class="draft-grade-position-name">RB</span>
            <span class="draft-grade-position-score">${grade.positionScores.RB.toFixed(1)} PAR (${activeCounts.RB} active)</span>
          </div>
          <div class="draft-grade-position">
            <span class="draft-grade-position-name">WR</span>
            <span class="draft-grade-position-score">${grade.positionScores.WR.toFixed(1)} PAR (${activeCounts.WR} active)</span>
          </div>
          <div class="draft-grade-position">
            <span class="draft-grade-position-name">TE</span>
            <span class="draft-grade-position-score">${grade.positionScores.TE.toFixed(1)} PAR (${activeCounts.TE} active)</span>
          </div>
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  draftGradesContent.innerHTML = html;
}

function renderDraftPicksCards(pickRatings, evalWeek) {
  const viewType = draftViewSelect.value; // 'best' or 'worst'
  const positions = ['QB', 'RB', 'WR', 'TE'];
  const positionColors = { 
    QB: '#e74c3c', // Red
    RB: '#2ecc71', // Green
    WR: '#3498db', // Blue
    TE: '#f39c12'  // Orange
  };
  const teamSettings = getTeamSettings(activeLeagueId);
  
  const getTeamName = (rosterId) => {
    const roster = currentRosters.find(r => r.roster_id === rosterId);
    if (!roster) return 'Unknown Team';
    const user = currentUsers.find(u => u.user_id === roster.owner_id);
    const settings = teamSettings[roster.owner_id] || {};
    return settings.customName || (user ? (user.display_name || user.username) : 'Unknown Team');
  };
  
  const getTeamColor = (rosterId) => {
    const roster = currentRosters.find(r => r.roster_id === rosterId);
    if (!roster) return '#f5c451';
    const settings = teamSettings[roster.owner_id] || {};
    return settings.customColor || '#f5c451';
  };
  
  let html = '<div class="draft-picks-grid">';
  
  positions.forEach(pos => {
    let positionPicks = pickRatings.filter(p => p.player.position === pos);
    
    if (positionPicks.length === 0) return;
    
    // For best picks, only consider top 24 finishers
    if (viewType === 'best') {
      positionPicks = positionPicks.filter(p => p.seasonRank && p.seasonRank <= 24);
    }
    
    if (positionPicks.length === 0) {
      // No top 24 players for this position
      html += `
        <div class="award-card">
          <div class="award-card-header">
            <div class="position-badge" style="background-color: ${positionColors[pos]}; color: white; padding: 6px 12px; border-radius: 6px; font-weight: 700; font-size: 14px;">${pos}</div>
            <div class="award-title">Best ${pos} Pick</div>
          </div>
          <div class="award-description" style="text-align: center; color: var(--text-muted);">
            No ${pos} in top 24
          </div>
        </div>
      `;
      return;
    }
    
    // Sort by improvement (descending for best, ascending for worst)
    positionPicks.sort((a, b) => {
      if (viewType === 'best') {
        return b.improvement - a.improvement;
      } else {
        return a.improvement - b.improvement;
      }
    });
    
    const topPick = positionPicks[0];
    
    if (!topPick) return;
    
    const title = viewType === 'best' ? `Best ${pos} Pick` : `Worst ${pos} Pick`;
    const teamName = getTeamName(topPick.roster_id);
    const teamColor = getTeamColor(topPick.roster_id);
    
    let description = '';
    if (viewType === 'best') {
      if (topPick.seasonRank) {
        description = `Drafted <span class="award-stat">${topPick.player.full_name}</span> as the <span class="award-stat">#${topPick.draftRank} ${pos}</span> (pick ${topPick.pick_no}) who finished as the <span class="award-stat">#${topPick.seasonRank} ${pos}</span> with ${topPick.pointsScored.toFixed(1)} points`;
      } else {
        description = `Drafted <span class="award-stat">${topPick.player.full_name}</span> as the <span class="award-stat">#${topPick.draftRank} ${pos}</span> (pick ${topPick.pick_no})`;
      }
    } else {
      if (topPick.seasonRank) {
        description = `Drafted <span class="award-stat">${topPick.player.full_name}</span> as the <span class="award-stat">#${topPick.draftRank} ${pos}</span> (pick ${topPick.pick_no}) who only finished as the <span class="award-stat">#${topPick.seasonRank} ${pos}</span> with ${topPick.pointsScored.toFixed(1)} points`;
      } else {
        description = `Drafted <span class="award-stat">${topPick.player.full_name}</span> as the <span class="award-stat">#${topPick.draftRank} ${pos}</span> (pick ${topPick.pick_no}) who didn't produce`;
      }
    }
    
    html += `
      <div class="award-card">
        <div class="award-card-header" style="align-items: center; gap: 12px;">
          <div class="position-badge" style="background-color: ${positionColors[pos]}; color: white; padding: 6px 12px; border-radius: 6px; font-weight: 700; font-size: 14px;">${pos}</div>
          <div class="award-title">${title}</div>
        </div>
        <div class="award-team" style="background-color: ${teamColor}33; border-left: 3px solid ${teamColor};">
          ${escapeHtml(teamName)}
        </div>
        <div class="award-description">
          ${description}
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  draftPicksContent.innerHTML = html;
}

function renderDraftBoard(draftPicks, pickRatings, rosters, season) {
  const teamSettings = getTeamSettings(activeLeagueId);
  
  if (!draftPicks || draftPicks.length === 0) {
    draftBoardContent.innerHTML = '';
    return;
  }
  
  // Sort picks by pick number
  const sortedPicks = [...draftPicks].sort((a, b) => a.pick_no - b.pick_no);
  
  // Determine draft type (snake vs linear) - check first few rounds
  const rosterIds = [...new Set(sortedPicks.map(p => p.roster_id))];
  const numTeams = rosterIds.length;
  
  // Create team order based on first round picks
  const firstRoundPicks = sortedPicks.slice(0, numTeams);
  const secondRoundPicks = sortedPicks.slice(numTeams, numTeams * 2);
  
  // Check if it's snake draft (2nd round reverses)
  const isSnakeDraft = secondRoundPicks.length > 0 && 
    secondRoundPicks[0].roster_id === firstRoundPicks[firstRoundPicks.length - 1].roster_id;
  
  const teamOrder = firstRoundPicks.map(p => p.roster_id);
  const numRounds = Math.ceil(sortedPicks.length / numTeams);
  
  // Get team names
  const getTeamName = (rosterId) => {
    const roster = rosters.find(r => r.roster_id === rosterId);
    if (!roster) return 'Team ' + rosterId;
    const user = currentUsers.find(u => u.user_id === roster.owner_id);
    const settings = teamSettings[roster.owner_id] || {};
    return settings.customName || (user ? (user.display_name || user.username) : 'Team ' + rosterId);
  };
  
  const positionColors = { 
    QB: '#e74c3c', // Red
    RB: '#2ecc71', // Green
    WR: '#3498db', // Blue
    TE: '#f39c12'  // Orange
  };
  
  // Build draft board HTML
  let html = '<div class="draft-board-title">Draft Board' + (isSnakeDraft ? ' (Snake Draft)' : '') + '</div>';
  
  // Position filter buttons
  html += '<div class="position-filter-buttons">';
  html += '<button class="position-filter-btn active" data-position="ALL">All</button>';
  html += '<button class="position-filter-btn" data-position="QB" style="background-color: rgba(231, 76, 60, 0.2); color: #e74c3c; border-color: #e74c3c;">QB</button>';
  html += '<button class="position-filter-btn" data-position="RB" style="background-color: rgba(46, 204, 113, 0.2); color: #2ecc71; border-color: #2ecc71;">RB</button>';
  html += '<button class="position-filter-btn" data-position="WR" style="background-color: rgba(52, 152, 219, 0.2); color: #3498db; border-color: #3498db;">WR</button>';
  html += '<button class="position-filter-btn" data-position="TE" style="background-color: rgba(243, 156, 18, 0.2); color: #f39c12; border-color: #f39c12;">TE</button>';
  html += '</div>';
  
  html += '<div class="draft-board"><div class="draft-board-grid" style="grid-template-columns: 60px repeat(' + numTeams + ', minmax(180px, 1fr));">';
  
  // Header row
  html += '<div class="draft-round-header">Round</div>';
  teamOrder.forEach(rosterId => {
    html += `<div class="draft-manager-header">${escapeHtml(getTeamName(rosterId))}</div>`;
  });
  
  // Draft picks by round
  for (let round = 1; round <= numRounds; round++) {
    html += `<div class="draft-round-header">${round}</div>`;
    
    // For each team column in the original order
    teamOrder.forEach(rosterId => {
      // In snake draft, we need to find which pick in this round belongs to this roster
      const pick = sortedPicks.find(p => {
        const pickRound = Math.ceil(p.pick_no / numTeams);
        return pickRound === round && p.roster_id === rosterId;
      });
      
      if (pick) {
        const player = playersData[pick.player_id];
        const rating = pickRatings.find(r => r.pick_no === pick.pick_no);
        
        if (player && rating) {
          const statusIcon = rating.status === 'traded' ? '🔄' : (rating.status === 'dropped' ? '📤' : '');
          const statusClass = rating.status !== 'active' ? rating.status : '';
          const statusText = rating.status !== 'active' ? ` (Wk ${rating.statusWeek})` : '';
          const posColor = positionColors[player.position] || '#666';
          
          html += `
            <div class="draft-pick-card ${statusClass}" data-position="${player.position}">
              ${statusIcon ? `<div class="draft-pick-status">${statusIcon}</div>` : ''}
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <div class="position-badge-small" style="background-color: ${posColor}; color: white; padding: 3px 8px; border-radius: 4px; font-weight: 700; font-size: 11px;">${player.position}</div>
                <div class="draft-pick-name" style="flex: 1;">${escapeHtml(player.full_name || 'Unknown')}${statusText}</div>
              </div>
              <div class="draft-pick-position">Pick ${pick.pick_no}</div>
              <div class="draft-pick-rating ${rating.ratingTier}">${rating.ratingLabel}</div>
            </div>
          `;
        } else {
          html += `<div class="draft-pick-card"><div class="draft-pick-name">Unknown Player</div></div>`;
        }
      } else {
        html += `<div class="draft-pick-card" style="opacity: 0.3;"><div class="draft-pick-name">-</div></div>`;
      }
    });
  }
  
  html += '</div></div>';
  draftBoardContent.innerHTML = html;
  
  // Add event listeners for position filter buttons
  const filterButtons = draftBoardContent.querySelectorAll('.position-filter-btn');
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const position = btn.getAttribute('data-position');
      
      // Update active button
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Filter draft picks
      const pickCards = draftBoardContent.querySelectorAll('.draft-pick-card[data-position]');
      pickCards.forEach(card => {
        const cardPosition = card.getAttribute('data-position');
        if (position === 'ALL' || cardPosition === position) {
          card.style.opacity = '1';
        } else {
          card.style.opacity = '0.3';
        }
      });
    });
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}


// ============================================================================
// UNIFIED ADMIN - TEAM MANAGEMENT BY SEASON
// ============================================================================


// Admin modal control
let adminSelectedSeason = null;

function openUnifiedAdmin() {
  const modal = document.getElementById('globalAdminModal');
  modal.style.display = 'block';
  populateAdminSeasonSelect();
}

function populateAdminSeasonSelect() {
  const select = document.getElementById('adminSeasonSelect');
  
  if (!activeLeagueId) {
    select.innerHTML = '<option value="">Select a league first...</option>';
    return;
  }
  
  const histData = historicalCache.get(activeLeagueId);
  if (!histData) {
    select.innerHTML = '<option value="">Loading...</option>';
    return;
  }
  
  select.innerHTML = '<option value="">Select a season...</option>';
  histData.seasons.forEach(seasonInfo => {
    const option = document.createElement('option');
    option.value = seasonInfo.season;
    option.textContent = `${seasonInfo.season} Season`;
    select.appendChild(option);
  });
  
  // Auto-select first season if none selected
  if (!adminSelectedSeason && histData.seasons.length > 0) {
    adminSelectedSeason = histData.seasons[0].season;
    select.value = adminSelectedSeason;
    renderAdminTeamList();
  } else if (adminSelectedSeason) {
    select.value = adminSelectedSeason;
    renderAdminTeamList();
  }
}

function renderAdminTeamList() {
  const container = document.getElementById('globalAdminTeamList');
  const seasonSelect = document.getElementById('adminSeasonSelect');
  const selectedSeason = seasonSelect.value;
  
  if (!selectedSeason) {
    container.innerHTML = '<div class="muted-text">Select a season to edit teams.</div>';
    return;
  }
  
  adminSelectedSeason = selectedSeason;
  
  const histData = historicalCache.get(activeLeagueId);
  if (!histData) {
    container.innerHTML = '<div class="muted-text">Loading...</div>';
    return;
  }
  
  const rosters = histData.allRosters.get(selectedSeason);
  const matchupsByWeek = histData.allMatchups.get(selectedSeason);
  const seasonInfo = histData.seasons.find(s => s.season === selectedSeason);
  
  if (!rosters || !matchupsByWeek) {
    container.innerHTML = '<div class="muted-text">No data available for this season.</div>';
    return;
  }
  
  const teamSettings = getTeamSettings(activeLeagueId);
  const playoffWeekStart = seasonInfo?.settings?.playoff_week_start || 15;
  
  // Calculate stats for each team
  const teamStats = new Map();
  
  rosters.forEach(roster => {
    teamStats.set(roster.roster_id, {
      roster,
      wins: 0,
      losses: 0,
      points: 0
    });
  });
  
  // Calculate regular season wins/losses and total points
  matchupsByWeek.forEach((weekMatchups, week) => {
    const isRegularSeason = week < playoffWeekStart;
    
    weekMatchups.forEach(matchup => {
      const stats = teamStats.get(matchup.roster_id);
      if (!stats) return;
      
      // Add points regardless of regular/playoff
      stats.points += (matchup.points || 0);
      
      // Only count wins/losses in regular season
      if (isRegularSeason && matchup.matchup_id) {
        const opponent = weekMatchups.find(m => 
          m.matchup_id === matchup.matchup_id && m.roster_id !== matchup.roster_id
        );
        
        if (opponent) {
          if ((matchup.points || 0) > (opponent.points || 0)) {
            stats.wins++;
          } else if ((matchup.points || 0) < (opponent.points || 0)) {
            stats.losses++;
          }
        }
      }
    });
  });
  
  // Get all available user_ids for assignment dropdown
  const allUserIds = new Set();
  const userDisplayNames = new Map();
  
  histData.seasons.forEach(seasonInfo => {
    const seasonRosters = histData.allRosters.get(seasonInfo.season);
    if (seasonRosters) {
      seasonRosters.forEach(r => {
        if (r.owner_id) {
          allUserIds.add(r.owner_id);
          if (!userDisplayNames.has(r.owner_id)) {
            const user = currentUsers.find(u => u.user_id === r.owner_id);
            const userSettings = teamSettings[r.owner_id] || {};
            userDisplayNames.set(r.owner_id, 
              userSettings.customName || (user ? (user.display_name || user.username) : r.owner_id)
            );
          }
        }
      });
    }
  });
  
  // Build HTML
  let html = '';
  
  // Header row
  html += `
    <div class="team-settings-row-header">
      <div>Team Name</div>
      <div>Record</div>
      <div>Points</div>
      <div>Custom Name</div>
      <div>Color</div>
      <div>Assign to User</div>
      <div>Actions</div>
    </div>
  `;
  
  // Team rows
  Array.from(teamStats.values())
    .sort((a, b) => b.wins - a.wins) // Sort by wins
    .forEach(stats => {
      const roster = stats.roster;
      const user = currentUsers.find(u => u.user_id === roster.owner_id);
      const userSettings = teamSettings[roster.owner_id] || {};
      const rosterSettings = teamSettings[`roster_${roster.roster_id}_${selectedSeason}`] || {};
      
      const originalName = user ? (user.display_name || user.username || 'Unknown') : 'Unknown';
      const customName = rosterSettings.customName || userSettings.customName || '';
      const customColor = rosterSettings.customColor || userSettings.customColor || '#f5c451';
      const assignedUserId = rosterSettings.assignedUserId || roster.owner_id || '';
      
      html += `
        <div class="team-settings-row" data-roster-id="${roster.roster_id}">
          <div class="team-settings-label">${escapeHtml(originalName)}</div>
          <div style="color: var(--text-primary); font-weight: 600;">${stats.wins}-${stats.losses}</div>
          <div style="color: var(--text-secondary);">${stats.points.toFixed(1)}</div>
          <input 
            type="text" 
            class="team-settings-input" 
            placeholder="Custom name..."
            value="${escapeHtml(customName)}"
            data-roster-id="${roster.roster_id}"
            data-field="customName"
          />
          <input 
            type="color" 
            class="team-color-picker"
            value="${customColor}"
            data-roster-id="${roster.roster_id}"
            data-field="customColor"
          />
          <select 
            class="team-settings-input"
            data-roster-id="${roster.roster_id}"
            data-field="assignedUserId"
          >
            <option value="">Unassigned</option>
            ${Array.from(allUserIds).map(userId => `
              <option value="${userId}" ${userId === assignedUserId ? 'selected' : ''}>
                ${escapeHtml(userDisplayNames.get(userId) || userId)}
              </option>
            `).join('')}
          </select>
          <button class="team-settings-save" data-roster-id="${roster.roster_id}">Save</button>
        </div>
      `;
    });
  
  container.innerHTML = html;
  
  // Add event listeners
  container.querySelectorAll('.team-settings-save').forEach(btn => {
    btn.addEventListener('click', () => {
      const rosterId = parseInt(btn.getAttribute('data-roster-id'));
      saveRosterSettings(rosterId);
    });
  });
  
  // Auto-save on change
  container.querySelectorAll('.team-settings-input, .team-color-picker').forEach(input => {
    input.addEventListener('change', () => {
      const rosterId = parseInt(input.getAttribute('data-roster-id'));
      saveRosterSettings(rosterId);
    });
  });
}

function saveRosterSettings(rosterId) {
  const nameInput = document.querySelector(`.team-settings-input[data-roster-id="${rosterId}"][data-field="customName"]`);
  const colorInput = document.querySelector(`.team-color-picker[data-roster-id="${rosterId}"]`);
  const assignInput = document.querySelector(`.team-settings-input[data-roster-id="${rosterId}"][data-field="assignedUserId"]`);
  
  if (!nameInput || !colorInput || !assignInput) return;
  
  const teamSettings = getTeamSettings(activeLeagueId);
  const settingsKey = `roster_${rosterId}_${adminSelectedSeason}`;
  
  // Check if assigned user is already assigned to another roster this season
  const assignedUserId = assignInput.value;
  if (assignedUserId) {
    const conflict = Object.keys(teamSettings).find(key => {
      if (!key.startsWith('roster_') || key === settingsKey) return false;
      if (!key.endsWith(`_${adminSelectedSeason}`)) return false;
      return teamSettings[key].assignedUserId === assignedUserId;
    });
    
    if (conflict) {
      alert(`This user is already assigned to another team in this season. Each user can only be assigned once per season.`);
      assignInput.value = teamSettings[settingsKey]?.assignedUserId || '';
      return;
    }
  }
  
  teamSettings[settingsKey] = {
    customName: nameInput.value.trim() || null,
    customColor: colorInput.value,
    assignedUserId: assignedUserId || null
  };
  
  saveTeamSettings_toStorage(activeLeagueId, teamSettings);
  
  // Refresh all tabs
  renderHistoryTab();
  renderAwardsTab();
  renderDraftTab();
  renderMatchupTab();
  renderStandingsTab();
  renderPowerTab();
  
  // Visual feedback
  const saveBtn = document.querySelector(`.team-settings-save[data-roster-id="${rosterId}"]`);
  if (saveBtn) {
    const originalText = saveBtn.textContent;
    saveBtn.textContent = '✓ Saved';
    saveBtn.style.background = '#2ecc71';
    setTimeout(() => {
      saveBtn.textContent = originalText;
      saveBtn.style.background = '';
    }, 1500);
  }
}

function saveTeamSettings_toStorage(leagueId, settings) {
  try {
    localStorage.setItem(`fantasy_team_settings_${leagueId}`, JSON.stringify(settings));
  } catch (e) {
    console.error('Error saving team settings:', e);
  }
}

function exportGlobalTeamSettings() {
  if (!activeLeagueId) {
    alert('Please select a league first');
    return;
  }
  
  const teamSettings = getTeamSettings(activeLeagueId);
  const dataStr = JSON.stringify(teamSettings, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `team_settings_${activeLeagueId}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importGlobalTeamSettings() {
  const fileInput = document.getElementById('importTeamSettingsFile');
  fileInput.click();
}

// Initialize admin controls
document.addEventListener('DOMContentLoaded', () => {
  // All admin toggle buttons open the same unified admin
  const adminButtons = [
    'historyAdminToggle',
    'awardsAdminToggle', 
    'draftAdminToggle',
    'matchupAdminToggle',
    'standingsAdminToggle',
    'powerAdminToggle'
  ];
  
  adminButtons.forEach(btnId => {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.addEventListener('click', openUnifiedAdmin);
    }
  });
  
  // Season select change
  const adminSeasonSelect = document.getElementById('adminSeasonSelect');
  if (adminSeasonSelect) {
    adminSeasonSelect.addEventListener('change', renderAdminTeamList);
  }
  
  // Export/Import
  const exportBtn = document.getElementById('exportTeamSettings');
  const importBtn = document.getElementById('importTeamSettings');
  const importFile = document.getElementById('importTeamSettingsFile');
  
  if (exportBtn) exportBtn.addEventListener('click', exportGlobalTeamSettings);
  if (importBtn) importBtn.addEventListener('click', importGlobalTeamSettings);
  
  if (importFile) {
    importFile.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const settings = JSON.parse(event.target.result);
          saveTeamSettings_toStorage(activeLeagueId, settings);
          renderAdminTeamList();
          renderHistoryTab();
          renderAwardsTab();
          renderDraftTab();
          renderMatchupTab();
          renderStandingsTab();
          renderPowerTab();
          alert('Settings imported successfully!');
        } catch (err) {
          alert('Error importing settings: ' + err.message);
        }
      };
      reader.readAsText(file);
    });
  }
  
  // Close modal when clicking outside
  const modal = document.getElementById('globalAdminModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });
  }
});
