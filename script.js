/* ---------------------------------------------------------
   POWER RANKINGS (AUTO-SORTING)
--------------------------------------------------------- */

function renderPowerRankings(league) {
  const container = document.getElementById("content");
  const { users, rosters } = leagueDataCache[league.id];
  const ownerMap = {};
  users.forEach(u => ownerMap[u.user_id] = u);

  const lastWeekList = LAST_WEEK_POWER[currentLeagueKey];
  const week = currentWeek;

  // Build current list with any saved ranks
  let list = rosters.map(r => {
    const name = getTeamName(r, ownerMap);
    const key = `power_${league.id}_${week}_${r.roster_id}`;
    const savedRank = localStorage.getItem(key);
    return {
      roster: r,
      ownerMap,
      name,
      savedRank: savedRank ? Number(savedRank) : null,
      key
    };
  });

  // Sort by rank (1–10) while keeping unrated at bottom
  list.sort((a, b) => {
    if (!a.savedRank && !b.savedRank) return 0;
    if (!a.savedRank) return 1;
    if (!b.savedRank) return -1;
    return a.savedRank - b.savedRank;
  });

  // Build HTML
  let html = `
    <div class="section">
      <h2>${league.name} Power Rankings — Week ${week}</h2>
      <p class="small-label">Enter rankings. List auto-sorts after each change.</p>
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

    const change = (prevIndex !== -1 && item.savedRank)
      ? arrow(prevIndex + 1, item.savedRank)
      : "";

    html += `
      <tr>
        <td>${teamAvatarHtml(item.roster, ownerMap)}</td>
        <td>
          <input class="power-input"
            type="number"
            min="1"
            max="${rosters.length}"
            data-save="${item.key}"
            value="${item.savedRank ?? ""}"
          />
        </td>
        <td>${change}</td>
      </tr>
    `;
  });

  html += "</table></div>";
  container.innerHTML = html;

  attachAutosortHandlers(league);
}

/* ---------------------------------------------------------
   AUTOSORT HANDLERS
--------------------------------------------------------- */

function attachAutosortHandlers(league) {
  document.querySelectorAll("[data-save]").forEach(el => {
    el.addEventListener("input", () => {
      const key = el.dataset.save;
      const val = el.value;

      if (val === "") {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, val);
      }

      // Re-render sorted by latest values:
      renderPowerRankings(league);
    });
  });
}
