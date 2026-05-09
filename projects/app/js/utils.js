const Utils = {
  /**
   * Helper to open the main dashboard page
   */
  openMainPage: function(target = '') {
    const baseUrl = chrome.runtime.getURL('index.html');
    const url = target ? `${baseUrl}#${target}` : baseUrl;

    chrome.tabs.query({ url: baseUrl + '*' }, (tabs) => {
      if (tabs.length > 0) {
        const updateInfo = { active: true };
        if (target) {
          chrome.tabs.update(tabs[0].id, { url: url, active: true });
        } else {
          chrome.tabs.update(tabs[0].id, { active: true });
        }
        chrome.windows.update(tabs[0].windowId, { focused: true });
      } else {
        chrome.tabs.create({ url });
      }
    });
  },

  /**
   * Common logging
   */
  log: function(msg) {
    console.log(`[TidyGroup] ${msg}`);
  }
};

/**
 * Core logic for TidyGroup-Solo
 */
const TidyCore = {
  /**
   * Fetches the current state of tab groups (Active and Saved)
   */
  async fetchState() {
    try {
      const activeGroups = await chrome.tabGroups.query({});
      // Note: getAllSavedGroups might be under a different name depending on Chrome version
      // but according to functional_spec.md, it's getAllSavedGroups.
      // In latest Chrome it's often chrome.tabGroups.getSavedGroups.
      let savedGroups = [];
      if (chrome.tabGroups.getSavedGroups) {
        savedGroups = await chrome.tabGroups.getSavedGroups({});
      } else if (chrome.tabGroups.getAllSavedGroups) {
        savedGroups = await chrome.tabGroups.getAllSavedGroups();
      }

      return { activeGroups, savedGroups };
    } catch (e) {
      Utils.log(`Error fetching state: ${e.message}`);
      return { activeGroups: [], savedGroups: [] };
    }
  },

  /**
   * Analyzes the state and categorizes groups
   */
  analyzeState(activeGroups, savedGroups) {
    const activeMap = new Map(activeGroups.map(g => [g.id, g]));
    const analysis = {
      active: [],
      stashed: [],
      mixed: [],
      stale: [],
      empty: [],
      totalTabs: 0,
      totalGroups: 0
    };

    const titleCount = new Map();
    savedGroups.forEach(sg => {
      const title = sg.title || 'Untitled';
      titleCount.set(title, (titleCount.get(title) || 0) + 1);
    });

    savedGroups.forEach(sg => {
      const isActive = sg.localGroupId !== null && activeMap.has(sg.localGroupId);
      const tabCount = sg.tabs ? sg.tabs.length : 0;
      const title = sg.title || 'Untitled';

      const groupInfo = {
        id: sg.savedGuid, // Saved groups use GUID
        localId: sg.localGroupId,
        title: title,
        color: sg.color,
        tabCount: tabCount,
        updateTime: sg.updateTime,
        isActive: isActive,
        tabs: sg.tabs || []
      };

      analysis.totalGroups++;
      analysis.totalTabs += tabCount;

      if (isActive) {
        analysis.active.push(groupInfo);
      } else {
        analysis.stashed.push(groupInfo);
      }

      // Mixed (Duplicates)
      if (titleCount.get(title) > 1) {
        analysis.mixed.push(groupInfo);
      }

      // Empty
      if (tabCount === 0 || (tabCount === 1 && sg.tabs[0].url === 'chrome://newtab/')) {
        analysis.empty.push(groupInfo);
      }

      // Stale (Over 30 days)
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      if (!isActive && sg.updateTime < thirtyDaysAgo) {
        analysis.stale.push(groupInfo);
      }
    });

    return analysis;
  },

  /**
   * Calculates Health Score (0-100)
   */
  calculateScore(analysis) {
    if (analysis.totalGroups === 0) return 100;

    // Deduct points for duplicates, stale, and empty groups
    // This is a simple heuristic
    let score = 100;

    // Duplicates are bad (-10 per extra copy)
    const uniqueMixedTitles = new Set(analysis.mixed.map(g => g.title)).size;
    const extraCopies = analysis.mixed.length - uniqueMixedTitles;
    score -= extraCopies * 10;

    // Stale groups (-5 per group)
    score -= analysis.stale.length * 5;

    // Empty groups (-5 per group)
    score -= analysis.empty.length * 5;

    return Math.max(0, Math.min(100, score));
  },

  /**
   * Smart Merge: Consolidates duplicate groups into one Active group
   */
  async smartMerge(title) {
    const { activeGroups, savedGroups } = await this.fetchState();
    const duplicates = savedGroups.filter(sg => (sg.title || 'Untitled') === title);

    if (duplicates.length <= 1) return;

    // 1. Collect all unique URLs (excluding newtab)
    const allUrls = new Set();
    duplicates.forEach(sg => {
      sg.tabs.forEach(tab => {
        if (tab.url && tab.url !== 'chrome://newtab/' && !tab.url.startsWith('edge://newtab')) {
          allUrls.add(tab.url);
        }
      });
    });

    // 2. Identify/Create the target Active group
    let targetSaved = duplicates.find(sg => sg.localGroupId !== null) ||
                      duplicates.sort((a, b) => b.updateTime - a.updateTime)[0];

    let localGroupId = targetSaved.localGroupId;

    // If not active, we should theoretically open it, but the spec says update "Active" group.
    // If none are active, we'll just merge the saved data.

    if (localGroupId !== null) {
      // It's active, update it with missing tabs
      const currentTabs = await chrome.tabs.query({ groupId: localGroupId });
      const currentUrls = new Set(currentTabs.map(t => t.url));

      for (const url of allUrls) {
        if (!currentUrls.has(url)) {
          await chrome.tabs.create({ url, active: false }).then(tab => {
            return chrome.tabs.group({ tabIds: tab.id, groupId: localGroupId });
          });
        }
      }
    }

    Utils.log(`Merging ${duplicates.length} groups for "${title}"`);

    // 3. Delete other duplicates from saved groups
    for (const sg of duplicates) {
      if (sg.savedGuid !== targetSaved.savedGuid) {
        if (chrome.tabGroups.deleteSavedGroup) {
          await chrome.tabGroups.deleteSavedGroup(sg.savedGuid);
        }
      }
    }

    // 4. Update the target saved group with the consolidated list of URLs if possible
    // (In some environments, updating a saved group might happen automatically if it's active)
  },

  /**
   * Batch Cleanup: Deletes groups based on criteria
   */
  async batchCleanup(ids) {
    for (const id of ids) {
      if (chrome.tabGroups.deleteSavedGroup) {
        await chrome.tabGroups.deleteSavedGroup(id);
      }
    }
  }
};
