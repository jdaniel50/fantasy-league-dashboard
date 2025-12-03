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

// Awards tab elements
const awardsContent = document.getElementById('awardsContent');
const awardsSeasonSelect = document.getElementById('awardsSeasonSelect');

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

  // Awards season select
  awardsSeasonSelect.addEventListener('change', () => {
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
  
  // Awards season select - include All-Time
  awardsSeasonSelect.innerHTML = '<option value="all">All-Time</option>';
  seasons.forEach(season => {
    const option = document.createElement('option');
    option.value = season.season;
    option.textContent = `${season.season} Season`;
    awardsSeasonSelect.appendChild(option);
  });
  
  // Draft season select
  draftSeasonSelect.innerHTML = '<option value="">Select a season...</option>';
  seasons.forEach(season => {
    const option = document.createElement('option');
    option.value = season.season;
    option.textContent = `${season.season} Season`;
    draftSeasonSelect.appendChild(option);
  });
  
  // Auto-select current season for awards and draft
  if (seasons.length > 0) {
    awardsSeasonSelect.value = seasons[0].season;
    draftSeasonSelect.value = seasons[0].season;
    populateDraftWeekSelect();
  }
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
  awardsContent.innerHTML = '<div class="muted-text">Select a league and season to view awards.</div>';
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
    rosters.forEach(r => rosterByRosterId.set(r.roster_id, r));
    
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
        
        // Initialize stats if needed
        if (!stats.has(userId)) {
          stats.set(userId, {
            user_id: userId,
            username: roster.owner_id, // Will be replaced with actual username
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
        
        const userStats = stats.get(userId);
        
        // Count wins/losses (only for regular season and first round of playoffs)
        if (matchup.matchup_id) {
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
// AWARDS TAB RENDERING
// ============================================================================

async function renderAwardsTab() {
  if (!activeLeagueId) {
    awardsContent.innerHTML = '<div class="muted-text">Select a league to view awards.</div>';
    return;
  }
  
  const selectedSeason = awardsSeasonSelect.value;
  if (!selectedSeason) {
    awardsContent.innerHTML = '<div class="muted-text">Select a season to view awards.</div>';
    return;
  }
  
  const histData = historicalCache.get(activeLeagueId);
  if (!histData) {
    awardsContent.innerHTML = '<div class="muted-text">Loading historical data...</div>';
    return;
  }
  
  awardsContent.innerHTML = '<div class="muted-text">Calculating awards...</div>';
  
  const awards = await calculateSeasonAwards(histData, selectedSeason);
  renderAwardsCards(awards);
}

async function calculateSeasonAwards(histData, season) {
  const awards = [];
  const teamSettings = getTeamSettings(activeLeagueId);
  
  // Get data for this season
  const matchupsByWeek = histData.allMatchups.get(season);
  const rosters = histData.allRosters.get(season);
  const trades = histData.allTrades.get(season);
  const draftPicks = histData.allDrafts.get(season);
  const waivers = histData.allWaivers.get(season);
  
  if (!matchupsByWeek || !rosters) {
    return awards;
  }
  
  // Create roster lookup
  const rosterByRosterId = new Map();
  const rosterByUserId = new Map();
  rosters.forEach(r => {
    rosterByRosterId.set(r.roster_id, r);
    if (r.owner_id) rosterByUserId.set(r.owner_id, r);
  });
  
  // Helper to get team name
  const getTeamName = (roster) => {
    if (!roster) return 'Unknown Team';
    const user = currentUsers.find(u => u.user_id === roster.owner_id);
    const settings = teamSettings[roster.owner_id] || {};
    return settings.customName || (user ? (user.display_name || user.username) : 'Unknown Team');
  };
  
  // Helper to get team color
  const getTeamColor = (roster) => {
    if (!roster) return '#f5c451';
    const settings = teamSettings[roster.owner_id] || {};
    return settings.customColor || '#f5c451';
  };
  
  // 1. BIGGEST BLOWOUT
  let biggestBlowout = { margin: 0, winner: null, loser: null, week: 0, winnerScore: 0, loserScore: 0 };
  matchupsByWeek.forEach((weekMatchups, week) => {
    weekMatchups.forEach(matchup => {
      if (!matchup.matchup_id) return;
      const opponent = weekMatchups.find(m => 
        m.matchup_id === matchup.matchup_id && m.roster_id !== matchup.roster_id
      );
      if (opponent) {
        const margin = Math.abs((matchup.points || 0) - (opponent.points || 0));
        if (margin > biggestBlowout.margin) {
          if ((matchup.points || 0) > (opponent.points || 0)) {
            biggestBlowout = {
              margin,
              winner: rosterByRosterId.get(matchup.roster_id),
              loser: rosterByRosterId.get(opponent.roster_id),
              week,
              winnerScore: matchup.points || 0,
              loserScore: opponent.points || 0
            };
          } else {
            biggestBlowout = {
              margin,
              winner: rosterByRosterId.get(opponent.roster_id),
              loser: rosterByRosterId.get(matchup.roster_id),
              week,
              winnerScore: opponent.points || 0,
              loserScore: matchup.points || 0
            };
          }
        }
      }
    });
  });
  
  if (biggestBlowout.winner) {
    awards.push({
      icon: '💥',
      title: 'Biggest Blowout',
      team: getTeamName(biggestBlowout.winner),
      teamColor: getTeamColor(biggestBlowout.winner),
      description: `Destroyed ${getTeamName(biggestBlowout.loser)} in Week ${biggestBlowout.week} by <span class="award-stat">${biggestBlowout.margin.toFixed(2)} points</span> (${biggestBlowout.winnerScore.toFixed(2)} - ${biggestBlowout.loserScore.toFixed(2)})`
    });
  }
  
  // 2. SLIMMEST WIN
  let slimmestWin = { margin: Infinity, winner: null, loser: null, week: 0, winnerScore: 0, loserScore: 0 };
  matchupsByWeek.forEach((weekMatchups, week) => {
    weekMatchups.forEach(matchup => {
      if (!matchup.matchup_id) return;
      const opponent = weekMatchups.find(m => 
        m.matchup_id === matchup.matchup_id && m.roster_id !== matchup.roster_id
      );
      if (opponent && (matchup.points || 0) > (opponent.points || 0)) {
        const margin = (matchup.points || 0) - (opponent.points || 0);
        if (margin > 0 && margin < slimmestWin.margin) {
          slimmestWin = {
            margin,
            winner: rosterByRosterId.get(matchup.roster_id),
            loser: rosterByRosterId.get(opponent.roster_id),
            week,
            winnerScore: matchup.points || 0,
            loserScore: opponent.points || 0
          };
        }
      }
    });
  });
  
  if (slimmestWin.winner && slimmestWin.margin !== Infinity) {
    awards.push({
      icon: '🤏',
      title: 'Closest Call',
      team: getTeamName(slimmestWin.winner),
      teamColor: getTeamColor(slimmestWin.winner),
      description: `Barely escaped with a win in Week ${slimmestWin.week} by just <span class="award-stat">${slimmestWin.margin.toFixed(2)} points</span> (${slimmestWin.winnerScore.toFixed(2)} - ${slimmestWin.loserScore.toFixed(2)})`
    });
  }
  
  // 3 & 4. LUCKIEST / UNLUCKIEST MANAGER
  // Calculate all-play record for each team
  const allPlayRecords = new Map();
  rosters.forEach(roster => {
    allPlayRecords.set(roster.roster_id, { wins: 0, losses: 0 });
  });
  
  matchupsByWeek.forEach((weekMatchups) => {
    weekMatchups.forEach(matchup => {
      const myScore = matchup.points || 0;
      weekMatchups.forEach(opponent => {
        if (opponent.roster_id !== matchup.roster_id) {
          if (myScore > (opponent.points || 0)) {
            allPlayRecords.get(matchup.roster_id).wins++;
          } else if (myScore < (opponent.points || 0)) {
            allPlayRecords.get(matchup.roster_id).losses++;
          }
        }
      });
    });
  });
  
  // Calculate actual records
  const actualRecords = new Map();
  rosters.forEach(roster => {
    actualRecords.set(roster.roster_id, { wins: 0, losses: 0 });
  });
  
  matchupsByWeek.forEach((weekMatchups) => {
    weekMatchups.forEach(matchup => {
      if (!matchup.matchup_id) return;
      const opponent = weekMatchups.find(m => 
        m.matchup_id === matchup.matchup_id && m.roster_id !== matchup.roster_id
      );
      if (opponent) {
        if ((matchup.points || 0) > (opponent.points || 0)) {
          actualRecords.get(matchup.roster_id).wins++;
        } else if ((matchup.points || 0) < (opponent.points || 0)) {
          actualRecords.get(matchup.roster_id).losses++;
        }
      }
    });
  });
  
  // Find luckiest (best record with worst all-play)
  let luckiestDiff = -Infinity;
  let luckiestRoster = null;
  let luckiestActual = null;
  let luckiestAllPlay = null;
  
  rosters.forEach(roster => {
    const actual = actualRecords.get(roster.roster_id);
    const allPlay = allPlayRecords.get(roster.roster_id);
    const actualWinPct = actual.wins / (actual.wins + actual.losses);
    const allPlayWinPct = allPlay.wins / (allPlay.wins + allPlay.losses);
    const diff = actualWinPct - allPlayWinPct;
    
    if (diff > luckiestDiff) {
      luckiestDiff = diff;
      luckiestRoster = roster;
      luckiestActual = actual;
      luckiestAllPlay = allPlay;
    }
  });
  
  if (luckiestRoster && luckiestDiff > 0) {
    awards.push({
      icon: '🍀',
      title: 'Luckiest Manager',
      team: getTeamName(luckiestRoster),
      teamColor: getTeamColor(luckiestRoster),
      description: `Record of <span class="award-stat">${luckiestActual.wins}-${luckiestActual.losses}</span> despite an all-play record of <span class="award-stat">${luckiestAllPlay.wins}-${luckiestAllPlay.losses}</span>. Caught all the right breaks!`
    });
  }
  
  // Find unluckiest (worst record with best all-play)
  let unluckiestDiff = Infinity;
  let unluckiestRoster = null;
  let unluckiestActual = null;
  let unluckiestAllPlay = null;
  
  rosters.forEach(roster => {
    const actual = actualRecords.get(roster.roster_id);
    const allPlay = allPlayRecords.get(roster.roster_id);
    const actualWinPct = actual.wins / (actual.wins + actual.losses);
    const allPlayWinPct = allPlay.wins / (allPlay.wins + allPlay.losses);
    const diff = actualWinPct - allPlayWinPct;
    
    if (diff < unluckiestDiff) {
      unluckiestDiff = diff;
      unluckiestRoster = roster;
      unluckiestActual = actual;
      unluckiestAllPlay = allPlay;
    }
  });
  
  if (unluckiestRoster && unluckiestDiff < 0) {
    awards.push({
      icon: '😢',
      title: 'Worst Luck Manager',
      team: getTeamName(unluckiestRoster),
      teamColor: getTeamColor(unluckiestRoster),
      description: `Record of <span class="award-stat">${unluckiestActual.wins}-${unluckiestActual.losses}</span> despite an all-play record of <span class="award-stat">${unluckiestAllPlay.wins}-${unluckiestAllPlay.losses}</span>. Tough schedule!`
    });
  }
  
  // 5. BEST TRADE - Track points scored after trade
  if (trades && trades.length > 0 && playersData) {
    let bestTrade = null;
    let bestTradeDiff = -Infinity;
    
    for (const trade of trades) {
      if (trade.status !== 'complete') continue;
      
      const tradeWeek = trade.leg || 1;
      const tradeRosterIds = Object.keys(trade.roster_ids || {}).map(Number);
      
      if (tradeRosterIds.length !== 2) continue; // Only 2-team trades
      
      const [roster1Id, roster2Id] = tradeRosterIds;
      const roster1 = rosterByRosterId.get(roster1Id);
      const roster2 = rosterByRosterId.get(roster2Id);
      
      if (!roster1 || !roster2) continue;
      
      // Get players each team gave up and received
      const roster1Adds = trade.adds ? Object.keys(trade.adds).filter(pid => trade.adds[pid] === roster1Id) : [];
      const roster2Adds = trade.adds ? Object.keys(trade.adds).filter(pid => trade.adds[pid] === roster2Id) : [];
      
      // Calculate points scored in starting lineups after trade
      let roster1Points = 0;
      let roster2Points = 0;
      
      // Iterate through weeks after trade
      matchupsByWeek.forEach((weekMatchups, week) => {
        if (week <= tradeWeek) return;
        
        const r1Matchup = weekMatchups.find(m => m.roster_id === roster1Id);
        const r2Matchup = weekMatchups.find(m => m.roster_id === roster2Id);
        
        if (r1Matchup && r1Matchup.starters_points) {
          roster1Adds.forEach(playerId => {
            const starterIndex = (r1Matchup.starters || []).indexOf(playerId);
            if (starterIndex !== -1 && r1Matchup.starters_points[starterIndex]) {
              roster1Points += r1Matchup.starters_points[starterIndex];
            }
          });
        }
        
        if (r2Matchup && r2Matchup.starters_points) {
          roster2Adds.forEach(playerId => {
            const starterIndex = (r2Matchup.starters || []).indexOf(playerId);
            if (starterIndex !== -1 && r2Matchup.starters_points[starterIndex]) {
              roster2Points += r2Matchup.starters_points[starterIndex];
            }
          });
        }
      });
      
      // Determine who won the trade
      const diff = roster1Points - roster2Points;
      if (Math.abs(diff) > Math.abs(bestTradeDiff)) {
        bestTradeDiff = diff;
        bestTrade = {
          winner: diff > 0 ? roster1 : roster2,
          loser: diff > 0 ? roster2 : roster1,
          winnerPoints: diff > 0 ? roster1Points : roster2Points,
          loserPoints: diff > 0 ? roster2Points : roster1Points,
          week: tradeWeek,
          winnerPlayers: diff > 0 ? roster1Adds : roster2Adds,
          loserPlayers: diff > 0 ? roster2Adds : roster1Adds
        };
      }
    }
    
    if (bestTrade && Math.abs(bestTradeDiff) > 10) { // Minimum 10 point difference
      const winnerPlayerNames = bestTrade.winnerPlayers
        .map(pid => playersData[pid]?.full_name || 'Unknown')
        .join(', ');
      
      awards.push({
        icon: '🤝',
        title: 'Best Trade',
        team: getTeamName(bestTrade.winner),
        teamColor: getTeamColor(bestTrade.winner),
        description: `Acquired ${winnerPlayerNames} in Week ${bestTrade.week} and scored <span class="award-stat">${bestTrade.winnerPoints.toFixed(1)} points</span> with them versus <span class="award-stat">${bestTrade.loserPoints.toFixed(1)} points</span> for ${getTeamName(bestTrade.loser)}`
      });
    }
  }
  
  // 6. BEST DRAFT PICKS - Compare draft position to season rank by position
  if (draftPicks && draftPicks.length > 0 && playersData && matchupsByWeek) {
    const positions = ['QB', 'RB', 'WR', 'TE'];
    const bestSteals = {};
    
    // Calculate total points for each player
    const playerSeasonPoints = new Map();
    
    matchupsByWeek.forEach((weekMatchups) => {
      weekMatchups.forEach(matchup => {
        if (matchup.starters && matchup.starters_points) {
          matchup.starters.forEach((playerId, idx) => {
            if (playerId && matchup.starters_points[idx]) {
              const current = playerSeasonPoints.get(playerId) || 0;
              playerSeasonPoints.set(playerId, current + matchup.starters_points[idx]);
            }
          });
        }
      });
    });
    
    // Group players by position and rank them
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
    
    // Sort each position by points
    positions.forEach(pos => {
      positionRankings[pos].sort((a, b) => b.points - a.points);
    });
    
    // Now check draft picks
    draftPicks.forEach(pick => {
      const player = playersData[pick.player_id];
      if (!player || !player.position || !positions.includes(player.position)) return;
      
      const posRanking = positionRankings[player.position];
      const seasonRank = posRanking.findIndex(p => p.playerId === pick.player_id);
      
      if (seasonRank === -1) return; // Player didn't score any points
      
      // Find their draft position within their position group
      const posDraftPicks = draftPicks
        .filter(p => playersData[p.player_id]?.position === player.position)
        .sort((a, b) => a.pick_no - b.pick_no);
      
      const draftRank = posDraftPicks.findIndex(p => p.player_id === pick.player_id);
      
      if (draftRank === -1) return;
      
      const improvement = draftRank - seasonRank;
      
      if (improvement > 0) {
        if (!bestSteals[player.position] || improvement > bestSteals[player.position].improvement) {
          const roster = rosterByRosterId.get(pick.roster_id);
          bestSteals[player.position] = {
            player,
            draftRank: draftRank + 1,
            seasonRank: seasonRank + 1,
            improvement,
            points: posRanking[seasonRank].points,
            roster,
            pickNo: pick.pick_no
          };
        }
      }
    });
    
    // Add award for the best steal overall
    let bestOverall = null;
    positions.forEach(pos => {
      if (bestSteals[pos] && (!bestOverall || bestSteals[pos].improvement > bestOverall.improvement)) {
        bestOverall = bestSteals[pos];
      }
    });
    
    if (bestOverall) {
      awards.push({
        icon: '🎯',
        title: 'Best Draft Steal',
        team: getTeamName(bestOverall.roster),
        teamColor: getTeamColor(bestOverall.roster),
        description: `Drafted <span class="award-stat">${bestOverall.player.full_name}</span> (${bestOverall.player.position}) as the <span class="award-stat">#${bestOverall.draftRank} ${bestOverall.player.position}</span> (pick ${bestOverall.pickNo}) who finished as the <span class="award-stat">#${bestOverall.seasonRank} ${bestOverall.player.position}</span> with ${bestOverall.points.toFixed(1)} points`
      });
    }
  }
  
  // 7. BEST WAIVER PICKUP - Most points scored after waiver claim
  if (waivers && waivers.length > 0 && playersData && matchupsByWeek) {
    let bestWaiverPickup = null;
    let bestWaiverPoints = 0;
    
    waivers.forEach(transaction => {
      if (transaction.status !== 'complete') return;
      if (!transaction.adds) return;
      
      const addWeek = transaction.leg || 1;
      const rosterIds = Object.keys(transaction.roster_ids || {});
      
      Object.keys(transaction.adds).forEach(playerId => {
        const addedToRosterId = transaction.adds[playerId];
        const roster = rosterByRosterId.get(addedToRosterId);
        
        if (!roster) return;
        
        let totalPoints = 0;
        
        // Count points in starting lineup after this week
        matchupsByWeek.forEach((weekMatchups, week) => {
          if (week <= addWeek) return;
          
          const matchup = weekMatchups.find(m => m.roster_id === addedToRosterId);
          if (!matchup || !matchup.starters || !matchup.starters_points) return;
          
          const starterIndex = matchup.starters.indexOf(playerId);
          if (starterIndex !== -1 && matchup.starters_points[starterIndex]) {
            totalPoints += matchup.starters_points[starterIndex];
          }
        });
        
        if (totalPoints > bestWaiverPoints) {
          bestWaiverPoints = totalPoints;
          bestWaiverPickup = {
            player: playersData[playerId],
            playerId,
            points: totalPoints,
            roster,
            week: addWeek
          };
        }
      });
    });
    
    if (bestWaiverPickup && bestWaiverPoints > 20) { // Minimum 20 points threshold
      awards.push({
        icon: '💎',
        title: 'Best Waiver Pickup',
        team: getTeamName(bestWaiverPickup.roster),
        teamColor: getTeamColor(bestWaiverPickup.roster),
        description: `Picked up <span class="award-stat">${bestWaiverPickup.player?.full_name || 'Unknown'}</span> in Week ${bestWaiverPickup.week} who went on to score <span class="award-stat">${bestWaiverPickup.points.toFixed(1)} points</span> in their starting lineup`
      });
    }
  }
  
  return awards;
}

function renderAwardsCards(awards) {
  if (awards.length === 0) {
    awardsContent.innerHTML = '<div class="muted-text">No awards data available for this season.</div>';
    return;
  }
  
  let html = '<div class="awards-grid">';
  
  awards.forEach(award => {
    html += `
      <div class="award-card">
        <div class="award-card-header">
          <div class="award-icon">${award.icon}</div>
          <div class="award-title">${escapeHtml(award.title)}</div>
        </div>
        <div class="award-team" style="background-color: ${award.teamColor}33; border-left: 3px solid ${award.teamColor};">
          ${escapeHtml(award.team)}
        </div>
        <div class="award-description">
          ${award.description}
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  awardsContent.innerHTML = html;
}

// ============================================================================
// PLACEHOLDER FUNCTIONS FOR MATCHUPS, STANDINGS, POWER RANKINGS
// ============================================================================
// These will use similar logic to your existing code
// I'll provide simplified versions that work with the new data structure

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
  
  // Calculate pick ratings with PAR (Points Above Replacement)
  const pickRatings = calculateDraftPickRatingsWithPAR(
    draftPicks, matchupsByWeek, rosters, trades, waivers, selectedSeason, evalWeek
  );
  
  // Calculate team draft grades
  const teamGrades = calculateTeamDraftGrades(pickRatings, rosters);
  
  // Render team draft grades
  renderTeamDraftGrades(teamGrades);
  
  // Render best/worst picks cards
  renderDraftPicksCards(pickRatings);
  
  // Render draft board
  renderDraftBoard(draftPicks, pickRatings, rosters, selectedSeason);
}

function calculateDraftPickRatingsWithPAR(draftPicks, matchupsByWeek, rosters, trades, waivers, season, evalWeek) {
  if (!matchupsByWeek || !playersData) return [];
  
  const positions = ['QB', 'RB', 'WR', 'TE'];
  const pickRatings = [];
  
  // Track player ownership changes (trades and drops)
  const playerOwnershipChanges = new Map(); // playerId -> [{week, oldRoster, newRoster, type}]
  
  // Process trades
  trades.forEach(trade => {
    if (trade.status !== 'complete') return;
    const tradeWeek = trade.leg || 1;
    
    if (trade.adds && trade.drops) {
      Object.keys(trade.adds).forEach(playerId => {
        const newRosterId = trade.adds[playerId];
        const oldRosterId = Object.keys(trade.drops).find(pid => trade.drops[pid] === playerId);
        
        if (!playerOwnershipChanges.has(playerId)) {
          playerOwnershipChanges.set(playerId, []);
        }
        playerOwnershipChanges.get(playerId).push({
          week: tradeWeek,
          oldRosterId: oldRosterId ? parseInt(oldRosterId) : null,
          newRosterId,
          type: 'trade'
        });
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
  
  // Calculate points for each player, tracking ownership
  const playerPointsByOwner = new Map(); // playerId -> { rosterId -> points }
  
  matchupsByWeek.forEach((weekMatchups, week) => {
    // Skip weeks beyond evaluation point
    if (evalWeek && week > evalWeek) return;
    
    weekMatchups.forEach(matchup => {
      if (matchup.starters && matchup.starters_points) {
        matchup.starters.forEach((playerId, idx) => {
          if (!playerId || !matchup.starters_points[idx]) return;
          
          // Check if player was still owned by this roster this week
          const changes = playerOwnershipChanges.get(playerId) || [];
          const wasTraded = changes.some(c => c.week <= week && c.oldRosterId === matchup.roster_id);
          
          if (wasTraded) return; // Don't count points after trade/drop
          
          if (!playerPointsByOwner.has(playerId)) {
            playerPointsByOwner.set(playerId, new Map());
          }
          
          const rosterPoints = playerPointsByOwner.get(playerId);
          const current = rosterPoints.get(matchup.roster_id) || 0;
          rosterPoints.set(matchup.roster_id, current + matchup.starters_points[idx]);
        });
      }
    });
  });
  
  // Calculate positional averages for PAR calculation
  const positionAveragesByDraftSlot = {}; // position -> draftRank -> avgPoints
  positions.forEach(pos => {
    positionAveragesByDraftSlot[pos] = {};
  });
  
  // Group drafted players by position
  const draftedByPosition = {};
  positions.forEach(pos => {
    draftedByPosition[pos] = draftPicks
      .filter(p => playersData[p.player_id]?.position === pos)
      .sort((a, b) => a.pick_no - b.pick_no);
  });
  
  // Calculate average points for each draft slot
  positions.forEach(pos => {
    const posPicks = draftedByPosition[pos];
    posPicks.forEach((pick, idx) => {
      const draftRank = idx + 1;
      const playerPoints = playerPointsByOwner.get(pick.player_id);
      const totalPoints = playerPoints ? Array.from(playerPoints.values()).reduce((sum, pts) => sum + pts, 0) : 0;
      
      if (!positionAveragesByDraftSlot[pos][draftRank]) {
        positionAveragesByDraftSlot[pos][draftRank] = [];
      }
      positionAveragesByDraftSlot[pos][draftRank].push(totalPoints);
    });
    
    // Calculate averages
    Object.keys(positionAveragesByDraftSlot[pos]).forEach(rank => {
      const points = positionAveragesByDraftSlot[pos][rank];
      positionAveragesByDraftSlot[pos][rank] = points.reduce((sum, p) => sum + p, 0) / points.length;
    });
  });
  
  // Now calculate PAR for each pick
  draftPicks.forEach(pick => {
    const player = playersData[pick.player_id];
    if (!player || !player.position || !positions.includes(player.position)) return;
    
    const posPicks = draftedByPosition[player.position];
    const draftRank = posPicks.findIndex(p => p.player_id === pick.player_id) + 1;
    
    if (draftRank === 0) return;
    
    // Get actual points scored for original drafter
    const playerPoints = playerPointsByOwner.get(pick.player_id);
    const actualPoints = playerPoints && playerPoints.has(pick.roster_id) 
      ? playerPoints.get(pick.roster_id) 
      : 0;
    
    // Get expected points for this draft slot
    const expectedPoints = positionAveragesByDraftSlot[player.position][draftRank] || 0;
    
    // Calculate PAR
    const par = actualPoints - expectedPoints;
    
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
    
    // Calculate rating tier based on PAR
    let ratingTier = 'average';
    let ratingLabel = '';
    
    if (par >= 50) {
      ratingTier = 'great';
      ratingLabel = `+${par.toFixed(0)} Elite`;
    } else if (par >= 20) {
      ratingTier = 'good';
      ratingLabel = `+${par.toFixed(0)} Good`;
    } else if (par >= -10) {
      ratingTier = 'average';
      ratingLabel = par >= 0 ? `+${par.toFixed(0)}` : `${par.toFixed(0)}`;
    } else if (par >= -30) {
      ratingTier = 'poor';
      ratingLabel = `${par.toFixed(0)} Poor`;
    } else {
      ratingTier = 'bad';
      ratingLabel = `${par.toFixed(0)} Bust`;
    }
    
    pickRatings.push({
      pick_no: pick.pick_no,
      player_id: pick.player_id,
      player,
      roster_id: pick.roster_id,
      draftRank,
      actualPoints,
      expectedPoints,
      par,
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

function renderDraftPicksCards(pickRatings) {
  const viewType = draftViewSelect.value; // 'best' or 'worst'
  const positions = ['QB', 'RB', 'WR', 'TE'];
  const positionIcons = { QB: '🎯', RB: '🏃', WR: '🙌', TE: '🎣' };
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
  
  let html = '<div class="awards-grid">';
  
  positions.forEach(pos => {
    const positionPicks = pickRatings.filter(p => p.player.position === pos);
    
    if (positionPicks.length === 0) return;
    
    // Sort by PAR (descending for best, ascending for worst)
    positionPicks.sort((a, b) => {
      if (viewType === 'best') {
        return b.par - a.par;
      } else {
        return a.par - b.par;
      }
    });
    
    const topPick = positionPicks[0];
    
    if (!topPick) return;
    
    const title = viewType === 'best' ? `Best ${pos} Pick` : `Worst ${pos} Pick`;
    const teamName = getTeamName(topPick.roster_id);
    const teamColor = getTeamColor(topPick.roster_id);
    
    let description = '';
    if (viewType === 'best') {
      description = `Drafted <span class="award-stat">${topPick.player.full_name}</span> as the <span class="award-stat">#${topPick.draftRank} ${pos}</span> (pick ${topPick.pick_no}) who scored <span class="award-stat">${topPick.actualPoints.toFixed(1)} points</span> vs expected <span class="award-stat">${topPick.expectedPoints.toFixed(1)}</span> (PAR: +${topPick.par.toFixed(1)})`;
    } else {
      description = `Drafted <span class="award-stat">${topPick.player.full_name}</span> as the <span class="award-stat">#${topPick.draftRank} ${pos}</span> (pick ${topPick.pick_no}) who only scored <span class="award-stat">${topPick.actualPoints.toFixed(1)} points</span> vs expected <span class="award-stat">${topPick.expectedPoints.toFixed(1)}</span> (PAR: ${topPick.par.toFixed(1)})`;
    }
    
    html += `
      <div class="award-card">
        <div class="award-card-header">
          <div class="award-icon">${positionIcons[pos]}</div>
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
  
  // Build draft board HTML
  let html = '<div class="draft-board-title">Draft Board' + (isSnakeDraft ? ' (Snake Draft)' : '') + '</div>';
  html += '<div class="draft-board"><div class="draft-board-grid" style="grid-template-columns: 60px repeat(' + numTeams + ', minmax(180px, 1fr));">';
  
  // Header row
  html += '<div class="draft-round-header">Round</div>';
  teamOrder.forEach(rosterId => {
    html += `<div class="draft-manager-header">${escapeHtml(getTeamName(rosterId))}</div>`;
  });
  
  // Draft picks by round
  for (let round = 1; round <= numRounds; round++) {
    html += `<div class="draft-round-header">${round}</div>`;
    
    // Snake draft logic: reverse on even rounds
    const roundTeamOrder = (isSnakeDraft && round % 2 === 0) 
      ? [...teamOrder].reverse() 
      : teamOrder;
    
    roundTeamOrder.forEach(rosterId => {
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
          
          html += `
            <div class="draft-pick-card ${statusClass}">
              ${statusIcon ? `<div class="draft-pick-status">${statusIcon}</div>` : ''}
              <div class="draft-pick-name">${escapeHtml(player.full_name || 'Unknown')}${statusText}</div>
              <div class="draft-pick-position">${player.position || '??'} - Pick ${pick.pick_no}</div>
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
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
