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
      <div class="settings-header" style="display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; border-bottom: 1px solid var(--md-sys-color-outline-variant);">
        <div class="md-typescale-title-medium">設定</div>
        <button class="md-button md-button--text btn-close-settings" style="padding: 8px;">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <div class="settings-tabs">
        <div class="settings-tab active" data-tab="general" title="一般">
          <span class="material-symbols-outlined">settings</span>
        </div>
        <div class="settings-tab" data-tab="about" title="About">
          <span class="material-symbols-outlined">info</span>
        </div>
        <div class="settings-tab dev-tab" data-tab="dev" title="開発" style="display: none;">
          <span class="material-symbols-outlined">terminal</span>
        </div>
      </div>
      <div class="settings-content" id="settings-content-pane">
        <!-- Content will be injected here -->
      </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

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
            <div class="settings-section-title md-typescale-title-small">設定データの書き出し/読み込み</div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <div style="display: flex; gap: 8px;">
                <button id="btn-export-clipboard" class="md-button md-button--tonal" style="flex: 1; padding: 8px; display: flex; align-items: center; justify-content: center; gap: 8px;">
                  <span class="material-symbols-outlined" style="font-size: 18px;">content_copy</span>
                  <span class="md-typescale-label-medium">クリップボードにコピー</span>
                </button>
                <button id="btn-import-clipboard" class="md-button md-button--tonal" style="flex: 1; padding: 8px; display: flex; align-items: center; justify-content: center; gap: 8px;">
                  <span class="material-symbols-outlined" style="font-size: 18px;">content_paste</span>
                  <span class="md-typescale-label-medium">クリップボードから復元</span>
                </button>
              </div>
              <div style="display: flex; gap: 8px;">
                <button id="btn-export-file" class="md-button md-button--tonal" style="flex: 1; padding: 8px; display: flex; align-items: center; justify-content: center; gap: 8px;">
                  <span class="material-symbols-outlined" style="font-size: 18px;">download</span>
                  <span class="md-typescale-label-medium">ファイルへ書き出し</span>
                </button>
                <button id="btn-import-file" class="md-button md-button--tonal" style="flex: 1; padding: 8px; display: flex; align-items: center; justify-content: center; gap: 8px;">
                  <span class="material-symbols-outlined" style="font-size: 18px;">upload</span>
                  <span class="md-typescale-label-medium">ファイルから復元</span>
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
        const manifest = chrome.runtime.getManifest();
        contentPane.innerHTML = `
          <div style="padding-top: 8px;">
            <div style="margin-bottom: 8px;">
              <div class="md-typescale-label-small" style="color: var(--md-sys-color-on-surface-variant);">バージョン</div>
              <div id="about-version" class="md-typescale-title-medium" style="cursor: default; user-select: none;">v${manifest.version}</div>
            </div>

            <div style="display: flex; justify-content: space-between; margin-bottom: 16px;">
              <div>
                <div class="md-typescale-label-small" style="color: var(--md-sys-color-on-surface-variant);">放置期間閾値</div>
                <div class="md-typescale-title-medium">${TidyCore.settings.staleThreshold} 日間</div>
              </div>
            </div>

            <div style="margin-bottom: 12px;">
              <div class="md-typescale-label-small" style="color: var(--md-sys-color-on-surface-variant);">開発者</div>
              <div class="md-typescale-title-medium">Masanori SATAKE</div>
            </div>

            <div class="md-typescale-body-small" style="margin-bottom: 12px; line-height: 1.5; color: var(--md-sys-color-on-surface);">
              TidyGroup-Solo は、プライバシー重視のタブグループ管理ツールです。データはブラウザ内に保存され、外部送信は一切行われません。GitHub Actions による依存関係の検証により、高い透明性と安全性を維持しています。
              <br><br>
              このプロジェクトでは、Google によるオープンソースのデザインシステムである Material Design 3 を使用しています。
            </div>

            <div class="md-typescale-body-small" style="font-style: italic; color: var(--md-sys-color-on-surface-variant); line-height: 1.5;">
              【免責事項】 本ソフトウェアは個人開発によるオープンソースプロジェクトであり、無保証です。利用により生じたいかなる損害についても、開発者は一切の責任を負いません。自己責任でご利用ください。
            </div>
          </div>
        `;

        const versionEl = contentPane.querySelector('#about-version');
        versionEl.addEventListener('click', (e) => {
          if (e.detail === 3) {
            const devTab = dialog.querySelector('.dev-tab');
            if (devTab) {
              devTab.style.display = 'flex';
              Utils.UI.showToast('開発者モードが有効になりました');
            }
          }
        });
      } else if (tabName === 'dev') {
        contentPane.innerHTML = `
          <div class="settings-section">
            <div class="settings-section-title md-typescale-title-small">デバッグデータ出力</div>
            <p class="md-typescale-body-small" style="margin-bottom: 16px;">
              現在のタブグループの状態や設定、分析結果をJSON形式で出力します。不具合報告の際にご活用ください。
            </p>
            <div style="display: flex; flex-direction: column; gap: 12px;">
              <button id="btn-dev-copy" class="md-button md-button--tonal" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;">
                <span class="material-symbols-outlined" style="font-size: 18px;">content_copy</span>
                <span class="md-typescale-label-medium">JSONをクリップボードにコピー</span>
              </button>
              <button id="btn-dev-file" class="md-button md-button--tonal" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;">
                <span class="material-symbols-outlined" style="font-size: 18px;">download</span>
                <span class="md-typescale-label-medium">JSONをファイルに保存</span>
              </button>
            </div>
          </div>
        `;

        async function getDebugInfo() {
          const { activeGroups, savedGroups } = await TidyCore.fetchState();
          const analysis = TidyCore.analyzeState(activeGroups, savedGroups);
          const storage = await chrome.storage.local.get(null);

          return {
            timestamp: new Date().toISOString(),
            manifestVersion: chrome.runtime.getManifest().version,
            activeGroups,
            savedGroups,
            analysis,
            storage
          };
        }

        contentPane.querySelector('#btn-dev-copy').addEventListener('click', async () => {
          const info = await getDebugInfo();
          await navigator.clipboard.writeText(JSON.stringify(info, null, 2));
          Utils.UI.showToast('デバッグ情報をコピーしました');
        });

        contentPane.querySelector('#btn-dev-file').addEventListener('click', async () => {
          const info = await getDebugInfo();
          const blob = new Blob([JSON.stringify(info, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `tidygroup-debug-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`;
          a.click();
          URL.revokeObjectURL(url);
        });
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
