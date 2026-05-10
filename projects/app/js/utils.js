const Utils = {
  /**
   * Helper to open the main dashboard page
   */
  openMainPage: function(target = '') {
    const baseUrl = chrome.runtime.getURL('index.html');
    const url = target ? `${baseUrl}#${target}` : baseUrl;

    chrome.tabs.query({ url: baseUrl + '*' }, (tabs) => {
      if (tabs.length > 0) {
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
  },

  /**
   * UI Helpers for Solo series consistency
   */
  UI: {
    showToast: function(message, duration = 3000) {
      const toast = document.createElement('div');
      toast.className = 'md-toast';
      toast.textContent = message;
      document.body.appendChild(toast);

      // Trigger reflow for animation
      toast.offsetHeight;
      toast.classList.add('visible');

      setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 300);
      }, duration);
    },

    showConfirm: function(title, message, onConfirm) {
      const overlay = document.createElement('div');
      overlay.className = 'md-dialog-overlay';

      const dialog = document.createElement('div');
      dialog.className = 'md-dialog';
      dialog.innerHTML = `
        <div class="md-dialog__title md-typescale-title-large">${title}</div>
        <div class="md-dialog__content md-typescale-body-medium">${message}</div>
        <div class="md-dialog__actions">
          <button class="md-button md-button--text btn-cancel">キャンセル</button>
          <button class="md-button md-button--text btn-confirm">実行</button>
        </div>
      `;

      overlay.appendChild(dialog);
      document.body.appendChild(overlay);

      dialog.querySelector('.btn-cancel').addEventListener('click', () => {
        overlay.remove();
      });

      dialog.querySelector('.btn-confirm').addEventListener('click', () => {
        onConfirm();
        overlay.remove();
      });
    }
  }
};

/**
 * Core logic for TidyGroup-Solo
 */
const TidyCore = {
  settings: {
    staleThreshold: 30
  },

  async init() {
    await this.loadSettings();
  },

  async loadSettings() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const data = await chrome.storage.local.get('settings');
      if (data.settings) {
        this.settings = { ...this.settings, ...data.settings };
      }
    }
    return this.settings;
  },

  async saveSettings(settings) {
    this.settings = { ...this.settings, ...settings };
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ settings: this.settings });
    }
  },

  /**
   * Fetches the current state of tab groups (Active and Saved)
   */
  async fetchState() {
    try {
      const activeGroups = await chrome.tabGroups.query({});
      const allTabs = await chrome.tabs.query({});
      const tabsByGroup = {};
      allTabs.forEach(t => {
        if (t.groupId !== -1) {
          if (!tabsByGroup[t.groupId]) tabsByGroup[t.groupId] = [];
          tabsByGroup[t.groupId].push(t);
        }
      });

      // Enrich active groups with tabs
      activeGroups.forEach(g => {
        g.tabs = tabsByGroup[g.id] || [];
      });

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
   * Helper to check if a URL should be filtered out/ignored
   */
  isIgnoredUrl: function(url) {
    if (!url) return true;
    const ignoredProtocols = ['chrome:', 'edge:', 'about:', 'chrome-extension:', 'chrome-search:'];
    const ignoredHosts = ['newtab', 'localhost', '127.0.0.1'];

    try {
      const parsed = new URL(url);
      if (ignoredProtocols.includes(parsed.protocol)) return true;
      if (ignoredHosts.includes(parsed.hostname)) return true;
      return false;
    } catch (e) {
      return true;
    }
  },

  /**
   * Analyzes the state and categorizes groups
   */
  analyzeState(activeGroups, savedGroups) {
    const savedLocalIds = new Map();
    savedGroups.forEach(sg => {
      if (sg.localGroupId !== null) {
        savedLocalIds.set(sg.localGroupId, sg.savedGuid);
      }
    });

    const analysis = {
      active: [],
      stashed: [],
      mixed: [],
      stale: [],
      empty: [],
      totalTabs: 0,
      totalGroups: 0
    };

    const threshold = this.settings.staleThreshold || 30;
    const staleLimit = Date.now() - (threshold * 24 * 60 * 60 * 1000);

    // Helper to extract info from any group (Active or Saved)
    const normalizeGroup = (g, type) => {
      const tabs = g.tabs || [];
      const tabCount = tabs.length;
      const title = g.title || 'Untitled';
      const domains = Array.from(new Set(tabs
        .map(t => {
          try {
            return new URL(t.url).hostname;
          } catch (e) {
            return null;
          }
        })
        .filter(h => h && !this.isIgnoredUrl(`http://${h}`))))
        .slice(0, 3);

      const hasMobile = tabs.some(t => {
        try {
          const host = new URL(t.url).hostname;
          return host.startsWith('m.') || host.startsWith('mobile.');
        } catch (e) {
          return false;
        }
      });

      return {
        id: type === 'saved' ? g.savedGuid : (savedLocalIds.get(g.id) || `local-${g.id}`),
        localId: type === 'active' ? g.id : g.localGroupId,
        title: title,
        color: g.color,
        tabCount: tabCount,
        domains: domains,
        hasMobile: hasMobile,
        updateTime: type === 'saved' ? g.updateTime : Date.now(), // Active is always fresh
        isActive: type === 'active' || (g.localGroupId !== null),
        tabs: tabs,
        isSaved: type === 'saved' || savedLocalIds.has(g.id)
      };
    };

    const allGroups = [];
    const processedSavedGuids = new Set();
    const processedLocalIds = new Set();

    // 1. Process Saved Groups
    savedGroups.forEach(sg => {
      const info = normalizeGroup(sg, 'saved');
      allGroups.push(info);
      processedSavedGuids.add(sg.savedGuid);
      if (sg.localGroupId !== null) processedLocalIds.add(sg.localGroupId);
    });

    // 2. Process Active Groups that are NOT saved
    activeGroups.forEach(ag => {
      if (!processedLocalIds.has(ag.id)) {
        const info = normalizeGroup(ag, 'active');
        allGroups.push(info);
        processedLocalIds.add(ag.id);
      }
    });

    // Helper to normalize titles for duplicate detection
    const normalizeTitle = (title) => {
      if (!title) return 'Untitled';
      // Normalize "x tabs" or "x個のタブ" to a generic title
      if (/^\d+\s*個のタブ$/.test(title) || /^\d+\s*tabs?$/.test(title)) {
        return 'GENERIC_TAB_GROUP_TITLE';
      }
      return title;
    };

    // Title count for mixed check (using normalized titles)
    const titleCount = new Map();
    allGroups.forEach(g => {
      const nTitle = normalizeTitle(g.title);
      titleCount.set(nTitle, (titleCount.get(nTitle) || 0) + 1);
    });

    // Final categorization
    allGroups.forEach(g => {
      analysis.totalGroups++;
      analysis.totalTabs += g.tabCount;

      if (g.isActive) {
        analysis.active.push(g);
      } else {
        analysis.stashed.push(g);
      }

      // Mixed (Duplicates)
      const nTitle = normalizeTitle(g.title);
      if (titleCount.get(nTitle) > 1) {
        analysis.mixed.push(g);
      }

      // Empty
      const nonIgnoredTabs = g.tabs.filter(t => !this.isIgnoredUrl(t.url));
      if (g.tabCount === 0 || nonIgnoredTabs.length === 0) {
        analysis.empty.push(g);
      }

      // Stale logic
      let isStale = false;
      if (g.isActive && g.tabs.length > 0) {
        // Active groups: stale if ALL tabs are older than staleLimit
        isStale = g.tabs.every(t => t.lastAccessed && t.lastAccessed < staleLimit);
      } else if (!g.isActive && g.updateTime < staleLimit) {
        // Inactive saved groups: use updateTime
        isStale = true;
      }

      if (isStale) {
        analysis.stale.push(g);
      }
    });

    return analysis;
  },

  /**
   * Calculates Health Score (0-100)
   */
  calculateScore(analysis) {
    if (analysis.totalGroups === 0) return 100.0;

    const unhealthyIds = new Set([
      ...analysis.mixed.map(g => g.id),
      ...analysis.stale.map(g => g.id),
      ...analysis.empty.map(g => g.id)
    ]);

    const healthyCount = analysis.totalGroups - unhealthyIds.size;
    const score = (healthyCount / analysis.totalGroups) * 100;
    return parseFloat(score.toFixed(1));
  },

  /**
   * Smart Merge: Consolidates duplicate groups.
   * Requirement: Merged group stays inactive if target was inactive, keeps latest timestamp,
   * excludes chrome://newtab/.
   */
  async smartMerge(title) {
    const { savedGroups } = await this.fetchState();
    const duplicates = savedGroups.filter(sg => (sg.title || 'Untitled') === title);

    if (duplicates.length <= 1) return;

    // 1. Collect all unique URLs (excluding ignored)
    const allUrls = new Set();
    duplicates.forEach(sg => {
      sg.tabs.forEach(tab => {
        if (!this.isIgnoredUrl(tab.url)) {
          allUrls.add(tab.url);
        }
      });
    });

    // 2. Identify target (latest update time)
    const sorted = [...duplicates].sort((a, b) => b.updateTime - a.updateTime);
    const targetSaved = sorted[0];

    Utils.log(`Merging ${duplicates.length} groups for "${title}" into ${targetSaved.savedGuid}`);

    // Since we can't directly update saved group tabs via API without opening it,
    // and the user wants to maintain inactive state, we have a challenge.
    // However, if we open it, add tabs, then it might save.
    // But the user said "maintain inactive".

    // Workaround: Open it hidden/minimized if possible? No.
    // Actually, maybe we can open it, update, and then close it immediately.
    // But "maintain inactive" usually implies it shouldn't pop up.

    // If I can't fulfill "inactive" perfectly, I'll do the closest thing:
    // Open the target group, add all missing tabs from duplicates, then if it was inactive, close it.

    let localId = targetSaved.localGroupId;
    const wasInactive = (localId === null);

    if (wasInactive) {
      // Open it first
      if (chrome.tabGroups.openSavedGroup) {
        localId = await chrome.tabGroups.openSavedGroup(targetSaved.savedGuid);
      } else {
        // Fallback: create tabs and group them
        const tabs = await Promise.all(targetSaved.tabs.map(t => chrome.tabs.create({ url: t.url, active: false })));
        localId = await chrome.tabs.group({ tabIds: tabs.map(t => t.id) });
        await chrome.tabGroups.update(localId, { title: targetSaved.title, color: targetSaved.color });
      }
    }

    // Add missing tabs
    const currentTabs = await chrome.tabs.query({ groupId: localId });
    const currentUrls = new Set(currentTabs.map(t => t.url));
    const tabsToAdd = Array.from(allUrls).filter(url => !currentUrls.has(url));

    for (const url of tabsToAdd) {
      const tab = await chrome.tabs.create({ url, active: false });
      await chrome.tabs.group({ tabIds: tab.id, groupId: localId });
    }

    // Delete other duplicates
    for (const sg of duplicates) {
      if (sg.savedGuid !== targetSaved.savedGuid) {
        if (chrome.tabGroups.deleteSavedGroup) {
          await chrome.tabGroups.deleteSavedGroup(sg.savedGuid);
        }
      }
    }

    // If it was originally inactive, "save and close" to maintain intended state
    // In Chrome, just closing the tabs of a saved group keeps it saved.
    if (wasInactive) {
      const finalTabs = await chrome.tabs.query({ groupId: localId });
      await chrome.tabs.remove(finalTabs.map(t => t.id));
    }
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
  },

  /**
   * Close and Unsave: Closes active tabs and deletes from saved list
   */
  async closeAndUnsave(savedGuid, localGroupId) {
    if (localGroupId !== null) {
      const tabs = await chrome.tabs.query({ groupId: localGroupId });
      const tabIds = tabs.map(t => t.id);
      if (tabIds.length > 0) {
        await chrome.tabs.remove(tabIds);
      }
    }

    if (savedGuid && !savedGuid.startsWith('local-') && chrome.tabGroups.deleteSavedGroup) {
      await chrome.tabGroups.deleteSavedGroup(savedGuid);
    }
  },

  /**
   * Ungroup: Dissolves the group but keeps tabs open
   */
  async ungroup(localGroupId) {
    if (localGroupId === null) return;

    const tabs = await chrome.tabs.query({ groupId: localGroupId });
    const tabIds = tabs.map(t => t.id);
    if (tabIds.length > 0) {
      await chrome.tabs.ungroup(tabIds);
    }
  }
};
