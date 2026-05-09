document.addEventListener('DOMContentLoaded', async () => {
  await TidyCore.init();

  const scoreValue = document.getElementById('score-value');
  const totalGroups = document.getElementById('total-groups');
  const totalTabs = document.getElementById('total-tabs');
  const anomalyBadges = document.getElementById('anomaly-badges');

  const openMainBtn = document.getElementById('open-main');
  const startMergeBtn = document.getElementById('start-merge');
  const startCleanupBtn = document.getElementById('start-cleanup');
  const btnSettings = document.getElementById('btn-settings');

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

  if (btnSettings) {
    btnSettings.addEventListener('click', () => {
      showSettingsDialog();
    });
  }

  function showSettingsDialog() {
    const overlay = document.createElement('div');
    overlay.className = 'md-dialog-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'md-dialog md-dialog--settings';
    dialog.innerHTML = `
      <div class="settings-tabs">
        <div class="settings-tab active" data-tab="general">一般</div>
        <div class="settings-tab" data-tab="about">About</div>
      </div>
      <div class="settings-content" id="settings-content-pane">
        <!-- Content will be injected here -->
      </div>
      <div class="md-dialog__actions" style="padding: 16px;">
        <button class="md-button md-button--text btn-close-settings">閉じる</button>
      </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    const contentPane = dialog.querySelector('#settings-content-pane');

    function renderTab(tabName) {
      dialog.querySelectorAll('.settings-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tabName);
      });

      if (tabName === 'general') {
        contentPane.innerHTML = `
          <div class="settings-section">
            <div class="settings-section-title md-typescale-title-small">共通</div>
            <div class="settings-row">
              <div class="md-typescale-body-medium">放置期間の閾値:</div>
              <select id="setting-stale-threshold" class="md-select">
                <option value="7">7日間</option>
                <option value="30">30日間</option>
                <option value="90">90日間</option>
                <option value="180">180日間</option>
              </select>
            </div>
          </div>
          <div class="settings-section">
            <div class="settings-section-title md-typescale-title-small">設定</div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <div style="display: flex; gap: 8px;">
                <button id="btn-export-clipboard" class="md-button md-button--tonal" style="flex: 1; padding: 8px;">
                  <span class="material-symbols-outlined" style="font-size: 18px; vertical-align: middle; margin-right: 4px;">content_copy</span>
                  クリップボードに書き出し
                </button>
                <button id="btn-import-clipboard" class="md-button md-button--tonal" style="flex: 1; padding: 8px;">
                  <span class="material-symbols-outlined" style="font-size: 18px; vertical-align: middle; margin-right: 4px;">content_paste</span>
                  クリップボードから読み込み
                </button>
              </div>
              <div style="display: flex; gap: 8px;">
                <button id="btn-export-file" class="md-button md-button--tonal" style="flex: 1; padding: 8px;">
                  <span class="material-symbols-outlined" style="font-size: 18px; vertical-align: middle; margin-right: 4px;">download</span>
                  ファイルに書き出し
                </button>
                <button id="btn-import-file" class="md-button md-button--tonal" style="flex: 1; padding: 8px;">
                  <span class="material-symbols-outlined" style="font-size: 18px; vertical-align: middle; margin-right: 4px;">upload</span>
                  ファイルから読み込み
                </button>
              </div>
              <input type="file" id="file-input" style="display: none;" accept=".json">
            </div>
          </div>
        `;

        const thresholdSelect = contentPane.querySelector('#setting-stale-threshold');
        thresholdSelect.value = TidyCore.settings.staleThreshold;
        thresholdSelect.addEventListener('change', async (e) => {
          await TidyCore.saveSettings({ staleThreshold: parseInt(e.target.value) });
          updateUI();
        });

        // Export to Clipboard
        contentPane.querySelector('#btn-export-clipboard').addEventListener('click', async () => {
          const json = JSON.stringify(TidyCore.settings, null, 2);
          await navigator.clipboard.writeText(json);
          Utils.UI.showToast('設定をクリップボードにコピーしました');
        });

        // Import from Clipboard
        contentPane.querySelector('#btn-import-clipboard').addEventListener('click', async () => {
          try {
            const text = await navigator.clipboard.readText();
            const settings = JSON.parse(text);
            await TidyCore.saveSettings(settings);
            renderTab('general');
            updateUI();
            Utils.UI.showToast('設定を読み込みました');
          } catch (e) {
            Utils.UI.showToast('読み込みに失敗しました');
          }
        });

        // Export to File
        contentPane.querySelector('#btn-export-file').addEventListener('click', () => {
          const json = JSON.stringify(TidyCore.settings, null, 2);
          const blob = new Blob([json], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `tidygroup-settings-${new Date().toISOString().split('T')[0]}.json`;
          a.click();
          URL.revokeObjectURL(url);
        });

        // Import from File
        const fileInput = contentPane.querySelector('#file-input');
        contentPane.querySelector('#btn-import-file').addEventListener('click', () => {
          fileInput.click();
        });
        fileInput.addEventListener('change', (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = async (re) => {
            try {
              const settings = JSON.parse(re.target.result);
              await TidyCore.saveSettings(settings);
              renderTab('general');
              updateUI();
              Utils.UI.showToast('設定を読み込みました');
            } catch (err) {
              Utils.UI.showToast('読み込みに失敗しました');
            }
          };
          reader.readAsText(file);
        });

      } else if (tabName === 'about') {
        contentPane.innerHTML = `
          <div style="text-align: center; padding-top: 16px;">
            <img src="icons/icon128.png" style="width: 64px; height: 64px; margin-bottom: 16px;">
            <div class="md-typescale-title-medium">TidyGroup-Solo</div>
            <div class="md-typescale-body-small">Version 0.3.0</div>
            <div class="md-typescale-body-medium" style="margin-top: 24px; color: var(--md-sys-color-on-surface-variant);">
              大量のタブグループを整理し、<br>あなたのブラウザに平穏をもたらします。
            </div>
            <div class="md-typescale-body-small" style="margin-top: 32px;">
              © 2026 Solo Series
            </div>
          </div>
        `;
      }
    }

    dialog.querySelectorAll('.settings-tab').forEach(tab => {
      tab.addEventListener('click', () => renderTab(tab.dataset.tab));
    });

    dialog.querySelector('.btn-close-settings').addEventListener('click', () => {
      overlay.remove();
    });

    renderTab('general');
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
