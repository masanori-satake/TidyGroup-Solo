const Utils = {
  /**
   * Helper to open the main dashboard page
   */
  openMainPage: function() {
    chrome.tabs.create({ url: chrome.runtime.getURL('index.html') });
  },

  /**
   * Placeholder for future common utilities
   */
  log: function(msg) {
    console.log(`[TidyGroup] ${msg}`);
  }
};
