document.addEventListener('DOMContentLoaded', async () => {
  const scoreValue = document.getElementById('score-value');
  const totalGroups = document.getElementById('total-groups');
  const totalTabs = document.getElementById('total-tabs');
  const anomalyBadges = document.getElementById('anomaly-badges');

  const openMainBtn = document.getElementById('open-main');
  const startMergeBtn = document.getElementById('start-merge');
  const startCleanupBtn = document.getElementById('start-cleanup');

  async function updateUI() {
    const { activeGroups, savedGroups } = await TidyCore.fetchState();
    const analysis = TidyCore.analyzeState(activeGroups, savedGroups);
    const score = TidyCore.calculateScore(analysis);

    // Update Score
    scoreValue.textContent = score;

    // Update Stats
    totalGroups.textContent = analysis.totalGroups;
    totalTabs.textContent = analysis.totalTabs;

    // Update Badges
    anomalyBadges.innerHTML = '';
    if (analysis.mixed.length > 0) {
      addBadge('重複あり', 'warning');
      startMergeBtn.disabled = false;
    } else {
      startMergeBtn.disabled = true;
    }

    if (analysis.empty.length > 0 || analysis.stale.length > 0) {
      addBadge('不要なタブグループ', 'warning');
      startCleanupBtn.disabled = false;
    } else {
      startCleanupBtn.disabled = true;
    }

    if (analysis.mixed.length === 0 && analysis.empty.length === 0 && analysis.stale.length === 0) {
      addBadge('クリーン', 'success');
    }
  }

  function addBadge(text, type) {
    const span = document.createElement('span');
    span.className = `badge badge--${type}`;
    span.textContent = text;
    anomalyBadges.appendChild(span);
  }

  // Event Listeners
  if (openMainBtn) {
    openMainBtn.addEventListener('click', () => {
      Utils.openMainPage();
    });
  }

  if (startMergeBtn) {
    startMergeBtn.addEventListener('click', () => {
      Utils.openMainPage('merge');
    });
  }

  if (startCleanupBtn) {
    startCleanupBtn.addEventListener('click', () => {
      Utils.openMainPage('cleanup');
    });
  }

  // Initial Load
  await updateUI();

  // Listen for changes
  if (chrome.tabGroups.onUpdated) {
    chrome.tabGroups.onUpdated.addListener(updateUI);
  }
  if (chrome.tabGroups.onRemoved) {
    chrome.tabGroups.onRemoved.addListener(updateUI);
  }

  Utils.log('Side panel initialized');
});
