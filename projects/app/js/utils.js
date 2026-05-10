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
  lastDiagnostics: {
    browser: {},
    apis: {},
    errors: [],
    windowStats: []
  },

  /**
   * Helper to normalize titles for duplicate detection and grouping.
   * e.g., "1個のタブ", "2個のタブ" -> "GENERIC_TAB_GROUP_TITLE"
   */
  normalizeTitle: function(title) {
    if (!title) return 'Untitled';
    // Remove "🧲" (TabMagnet-Solo marker) and trim
    let normalized = title.replace(/🧲/g, '').trim();
    if (!normalized) return 'Untitled';

    // Normalize "x tabs" or "x個のタブ" (case-insensitive)
    if (/^\d+\s*個のタブ$/i.test(normalized) || /^\d+\s*tabs?$/i.test(normalized)) {
      return 'GENERIC_TAB_GROUP_TITLE';
    }
    return normalized;
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
    // Initialize diagnostics
    this.lastDiagnostics = {
      browser: {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform
      },
      apis: {
        savedTabGroupsGetAll: typeof (chrome.savedTabGroups && chrome.savedTabGroups.getAll),
        getAllSavedGroups: typeof chrome.tabGroups.getAllSavedGroups,
        getSavedGroups: typeof chrome.tabGroups.getSavedGroups,
        tabGroupsQuery: typeof chrome.tabGroups.query,
        tabGroupsKeys: Object.keys(chrome.tabGroups || {})
      },
      errors: [],
      windowStats: []
    };

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

      // Window diagnostics
      try {
        const windows = await chrome.windows.getAll({ populate: false });
        for (const win of windows) {
          const winGroups = activeGroups.filter(ag => ag.windowId === win.id);
          this.lastDiagnostics.windowStats.push({
            windowId: win.id,
            type: win.type,
            groupCount: winGroups.length
          });
        }
      } catch (winErr) {
        this.lastDiagnostics.errors.push(`Window query error: ${winErr.message}`);
      }

      let savedGroups = [];

      // 1. Try new chrome.savedTabGroups API (Chrome 132+)
      if (chrome.savedTabGroups && typeof chrome.savedTabGroups.getAll === 'function') {
        try {
          savedGroups = await chrome.savedTabGroups.getAll();
          this.lastDiagnostics.apis.savedTabGroupsGetAllResult = savedGroups.length;
        } catch (e) {
          this.lastDiagnostics.errors.push(`savedTabGroups.getAll error: ${e.message}`);
        }
      }

      // 2. Try getAllSavedGroups (Legacy experimental standard)
      if (savedGroups.length === 0 && typeof chrome.tabGroups.getAllSavedGroups === 'function') {
        try {
          savedGroups = await chrome.tabGroups.getAllSavedGroups();
          this.lastDiagnostics.apis.getAllSavedGroupsResult = savedGroups.length;
        } catch (e) {
          this.lastDiagnostics.errors.push(`getAllSavedGroups error: ${e.message}`);
        }
      }

      // If still empty and getSavedGroups exists, try fallback/alternative
      if (savedGroups.length === 0 && typeof chrome.tabGroups.getSavedGroups === 'function') {
        try {
          // Some versions might require a callback or return a promise.
          // Wrapped in a promise for consistency.
          const sgAlt = await new Promise((resolve, reject) => {
            try {
              const result = chrome.tabGroups.getSavedGroups({}, (res) => {
                if (chrome.runtime.lastError) {
                  reject(chrome.runtime.lastError);
                } else {
                  resolve(res);
                }
              });
              // If it returns a promise (MV3), result will be a promise.
              if (result instanceof Promise) {
                result.then(resolve).catch(reject);
              }
            } catch (err) {
              // If calling with {} fails, try without arguments
              try {
                const resultNoArgs = chrome.tabGroups.getSavedGroups((res) => {
                  if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                  } else {
                    resolve(res);
                  }
                });
                if (resultNoArgs instanceof Promise) {
                  resultNoArgs.then(resolve).catch(reject);
                }
              } catch (innerErr) {
                reject(innerErr);
              }
            }
          });

          this.lastDiagnostics.apis.getSavedGroupsResult = sgAlt ? sgAlt.length : 0;
          if (sgAlt && sgAlt.length > 0) {
            savedGroups = sgAlt;
          }
        } catch (e) {
          this.lastDiagnostics.errors.push(`getSavedGroups error: ${e.message}`);
        }
      }

      Utils.log(`Fetched ${activeGroups.length} active groups and ${savedGroups.length} saved groups`);
      return { activeGroups, savedGroups };
    } catch (err) {
      Utils.log(`Error fetching state: ${err.stack || err.message}`);
      this.lastDiagnostics.errors.push(`Fetch state fatal error: ${err.message}`);
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
    } catch (_) {
      return true;
    }
  },

  /**
   * Analyzes the state and categorizes groups
   */
  analyzeState(activeGroups, savedGroups) {
    const savedLocalIds = new Map();
    const activeGroupMap = new Map();

    activeGroups.forEach(ag => {
      activeGroupMap.set(ag.id, ag);
    });

    savedGroups.forEach(sg => {
      const guid = sg.savedGuid || sg.id;
      if (guid && sg.localGroupId != null) {
        savedLocalIds.set(sg.localGroupId, guid);
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
      if (!g) return null;
      let tabs = g.tabs || [];
      const localId = type === 'active' ? g.id : (g.localGroupId ?? null);

      // If it's a saved group but currently active, use active tabs for richer metadata (e.g. lastAccessed)
      if (type === 'saved' && localId != null && activeGroupMap.has(localId)) {
        tabs = activeGroupMap.get(localId).tabs || [];
      }

      const tabCount = tabs.length;
      const title = g.title || 'Untitled';
      const domains = Array.from(new Set(tabs
        .map(t => {
          try {
            return new URL(t.url).hostname;
          } catch (_) {
            return null;
          }
        })
        .filter(h => h && !this.isIgnoredUrl(`http://${h}`))))
        .slice(0, 3);

      const hasMobile = tabs.some(t => {
        try {
          const host = new URL(t.url).hostname;
          return host.startsWith('m.') || host.startsWith('mobile.');
        } catch (_) {
          return false;
        }
      });

      return {
        id: type === 'saved' ? (g.savedGuid || g.id) : (savedLocalIds.get(localId) || `local-${localId}`),
        localId: localId,
        title: title,
        color: g.color,
        tabCount: tabCount,
        domains: domains,
        hasMobile: hasMobile,
        updateTime: type === 'saved' ? g.updateTime : Date.now(), // Active is always fresh
        isActive: localId != null,
        tabs: tabs,
        isSaved: type === 'saved' || savedLocalIds.has(localId)
      };
    };

    const allGroups = [];
    const processedSavedGuids = new Set();
    const processedLocalIds = new Set();

    // 1. Process Saved Groups
    savedGroups.forEach(sg => {
      const info = normalizeGroup(sg, 'saved');
      if (info) {
        allGroups.push(info);
        const guid = sg.savedGuid || sg.id;
        if (guid) processedSavedGuids.add(guid);
        if (info.localId != null) {
          processedLocalIds.add(info.localId);
        }
      }
    });

    // 2. Process Active Groups that are NOT saved
    activeGroups.forEach(ag => {
      if (!processedLocalIds.has(ag.id)) {
        const info = normalizeGroup(ag, 'active');
        if (info) {
          allGroups.push(info);
          processedLocalIds.add(ag.id);
        }
      }
    });

    // Title count for mixed check (using normalized titles)
    const titleCount = new Map();
    allGroups.forEach(g => {
      const nTitle = this.normalizeTitle(g.title);
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
      const nTitle = this.normalizeTitle(g.title);
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
        // If a tab has never been accessed (lastAccessed is undefined), we treat it as very old if it's discarded,
        // but if it's active/highlighted, it's definitely NOT stale.
        isStale = g.tabs.every(t => {
          if (t.active || t.highlighted) return false;
          const lastAccess = t.lastAccessed || 0;
          return lastAccess < staleLimit;
        });
      } else if (!g.isActive) {
        // Inactive saved groups: use updateTime
        isStale = g.updateTime < staleLimit;
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
  async smartMerge(targetTitle) {
    const { savedGroups } = await this.fetchState();
    const normalizedTarget = this.normalizeTitle(targetTitle);

    const duplicates = savedGroups.filter(sg => {
      return this.normalizeTitle(sg.title) === normalizedTarget;
    });

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
    const targetGuid = targetSaved.savedGuid || targetSaved.id;

    Utils.log(`Merging ${duplicates.length} groups for "${targetTitle}" into ${targetGuid}`);

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
    const wasInactive = (localId == null);

    if (wasInactive) {
      // Open it first
      if (chrome.savedTabGroups && typeof chrome.savedTabGroups.open === 'function') {
        localId = await chrome.savedTabGroups.open(targetGuid);
      } else if (chrome.tabGroups.openSavedGroup) {
        localId = await chrome.tabGroups.openSavedGroup(targetGuid);
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

    const newTabs = await Promise.all(tabsToAdd.map(url => chrome.tabs.create({ url, active: false })));
    if (newTabs.length > 0) {
      await chrome.tabs.group({ tabIds: newTabs.map(t => t.id), groupId: localId });
    }

    // Delete other duplicates
    for (const sg of duplicates) {
      const guid = sg.savedGuid || sg.id;
      if (guid !== targetGuid) {
        if (chrome.savedTabGroups && typeof chrome.savedTabGroups.remove === 'function') {
          await chrome.savedTabGroups.remove(guid);
        } else if (chrome.tabGroups.deleteSavedGroup) {
          await chrome.tabGroups.deleteSavedGroup(guid);
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
    const { savedGroups } = await this.fetchState();

    for (const id of ids) {
      if (id.startsWith('local-')) {
        const localId = parseInt(id.replace('local-', ''));
        const tabs = await chrome.tabs.query({ groupId: localId });
        if (tabs.length > 0) {
          await chrome.tabs.remove(tabs.map(t => t.id));
        }
      } else {
        // It's a saved GUID/ID
        // Check if it's currently open
        const sg = savedGroups.find(g => (g.savedGuid || g.id) === id);
        if (sg && sg.localGroupId != null) {
          const tabs = await chrome.tabs.query({ groupId: sg.localGroupId });
          if (tabs.length > 0) {
            await chrome.tabs.remove(tabs.map(t => t.id));
          }
        }
        if (chrome.savedTabGroups && typeof chrome.savedTabGroups.remove === 'function') {
          await chrome.savedTabGroups.remove(id);
        } else if (chrome.tabGroups.deleteSavedGroup) {
          await chrome.tabGroups.deleteSavedGroup(id);
        }
      }
    }
  },

  /**
   * Close and Unsave: Closes active tabs and deletes from saved list
   */
  async closeAndUnsave(savedGuid, localGroupId) {
    if (localGroupId != null) {
      const tabs = await chrome.tabs.query({ groupId: localGroupId });
      const tabIds = tabs.map(t => t.id);
      if (tabIds.length > 0) {
        await chrome.tabs.remove(tabIds);
      }
    }

    if (savedGuid && !savedGuid.startsWith('local-')) {
      if (chrome.savedTabGroups && typeof chrome.savedTabGroups.remove === 'function') {
        await chrome.savedTabGroups.remove(savedGuid);
      } else if (chrome.tabGroups.deleteSavedGroup) {
        await chrome.tabGroups.deleteSavedGroup(savedGuid);
      }
    }
  },

  /**
   * Ungroup: Dissolves the group but keeps tabs open
   */
  async ungroup(localGroupId) {
    if (localGroupId == null) return;

    const tabs = await chrome.tabs.query({ groupId: localGroupId });
    const tabIds = tabs.map(t => t.id);
    if (tabIds.length > 0) {
      await chrome.tabs.ungroup(tabIds);
    }
  }
};
