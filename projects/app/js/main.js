document.addEventListener('DOMContentLoaded', async () => {
  await TidyCore.init();

  const navItems = document.querySelectorAll('.nav-item');
  const sections = document.querySelectorAll('.content-section');

  // SPA Navigation
  function navigate(targetId, extraData = null) {
    navItems.forEach(item => {
      item.classList.toggle('active', item.dataset.target === targetId);
    });
    sections.forEach(section => {
      section.classList.toggle('active', section.id === `section-${targetId}`);
    });

    if (targetId === 'overview') updateOverview();
    if (targetId === 'merge') renderMergeList();
    if (targetId === 'cleanup') renderCleanupList();
    if (targetId === 'result' && extraData) renderResultView(extraData);
  }

  navItems.forEach(item => {
    item.addEventListener('click', () => navigate(item.dataset.target));
  });

  // Overview Data
  async function updateOverview() {
    const { activeGroups, savedGroups } = await TidyCore.fetchState();
    const analysis = TidyCore.analyzeState(activeGroups, savedGroups);

    updateCard('card-mixed', analysis.mixed.length);
    updateCard('card-stale', analysis.stale.length);
    updateCard('card-empty', analysis.empty.length);
    renderCapabilityNote();

    renderActiveList(analysis.active);
  }

  function renderCapabilityNote() {
    const note = document.getElementById('capability-note');
    if (!note) return;

    if (TidyCore.hasSavedGroupsCapability()) {
      note.style.display = 'none';
      note.innerHTML = '';
      return;
    }

    note.style.display = 'block';
    note.innerHTML = `
      <div class="md-typescale-title-small" style="margin-bottom: 8px; color: var(--md-sys-color-primary);">保存済みタブグループについて</div>
      <div class="md-typescale-body-medium" style="line-height: 1.6;">
        現在の Chrome 拡張機能 API では、保存済みタブグループ一覧の取得メソッドが公開されていません。
        このため TidyGroup-Solo は、今のランタイムではアクティブなタブグループのみを分析対象にします。
        デバッグ JSON にもこの制約を出力します。
      </div>
    `;
  }

  function renderActiveList(activeGroups) {
    const container = document.getElementById('active-list');
    container.innerHTML = '';

    if (activeGroups.length === 0) {
      container.innerHTML = '<p class="md-typescale-body-large">現在開いているタブグループはありません。</p>';
      return;
    }

    activeGroups.forEach(g => {
      const card = document.createElement('div');
      card.className = 'md-card item-card';
      card.style.padding = '16px';
      card.style.marginBottom = '12px';
      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div class="group-color-dot" style="background-color: ${g.color || '#ccc'}"></div>
            <div>
              <h3 class="md-typescale-title-medium">${g.title || '無題'}</h3>
              <p class="md-typescale-body-small">${g.tabCount} 個のタブ</p>
            </div>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="md-button md-button--outlined btn-ungroup" data-local-id="${g.localId}">解除</button>
            <button class="md-button md-button--filled btn-close-unsave" data-id="${g.id}" data-local-id="${g.localId}">完結</button>
          </div>
        </div>
      `;
      container.appendChild(card);
    });

    container.querySelectorAll('.btn-ungroup').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const localId = parseInt(e.currentTarget.dataset.localId);
        Utils.UI.showConfirm('グループ解除', 'タブグループを解除しますか？タブはそのまま残ります。', async () => {
          await TidyCore.ungroup(localId);
          updateOverview();
          Utils.UI.showToast('グループを解除しました');
        });
      });
    });

    container.querySelectorAll('.btn-close-unsave').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        const localId = parseInt(e.currentTarget.dataset.localId);
        Utils.UI.showConfirm('完結して閉じる', 'タブをすべて閉じ、保存リストからも削除しますか？', async () => {
          await TidyCore.closeAndUnsave(id, localId);
          updateOverview();
          Utils.UI.showToast('グループを削除しました');
        });
      });
    });
  }

  function renderResultView(stats) {
    const messageEl = document.getElementById('result-message');
    let message = '';
    if (stats.type === 'merge') {
      message = `${stats.count} 個の重複タブグループをマージしました。`;
    } else if (stats.type === 'cleanup') {
      message = `${stats.count} 個の不要なタブグループを削除しました。`;
    }
    messageEl.textContent = message;
  }

  document.getElementById('btn-result-back').addEventListener('click', () => {
    navigate('overview');
  });

  function updateCard(id, count) {
    const card = document.getElementById(id);
    const badge = card.querySelector('.count-badge');
    badge.textContent = count;
    if (count > 0) {
      badge.classList.add('badge--warning');
    } else {
      badge.classList.remove('badge--warning');
    }
  }

  document.querySelectorAll('.btn-to-merge').forEach(btn => {
    btn.addEventListener('click', () => navigate('merge'));
  });
  document.querySelectorAll('.btn-to-cleanup').forEach(btn => {
    btn.addEventListener('click', () => navigate('cleanup'));
  });

  // Merge List
  async function renderMergeList() {
    const { activeGroups, savedGroups } = await TidyCore.fetchState();
    const analysis = TidyCore.analyzeState(activeGroups, savedGroups);
    const container = document.getElementById('merge-list');
    container.innerHTML = '';

    const groupsByTitle = new Map();
    analysis.mixed.forEach(g => {
      const nTitle = TidyCore.normalizeTitle(g.title);
      if (!groupsByTitle.has(nTitle)) groupsByTitle.set(nTitle, []);
      groupsByTitle.get(nTitle).push(g);
    });

    if (groupsByTitle.size === 0) {
      container.innerHTML = '<p class="md-typescale-body-large">重複しているタブグループはありません。</p>';
      return;
    }

    groupsByTitle.forEach((groups, titleKey) => {
      const card = document.createElement('div');
      card.className = 'md-card item-card';
      card.style.padding = '16px';
      card.style.marginBottom = '12px';

      const displayTitle = titleKey === 'GENERIC_TAB_GROUP_TITLE' ? '（名前のないグループ）' : titleKey;

      // Collect all unique domains from all duplicates
      const allDomains = Array.from(new Set(groups.flatMap(g => g.domains))).slice(0, 5);
      const domainHtml = allDomains.map(d => `<span class="domain-tag" style="background: var(--md-sys-color-surface-variant); padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-right: 4px;">${d}</span>`).join('');

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h3 class="md-typescale-title-medium">${displayTitle}</h3>
            <p class="md-typescale-body-small">${groups.length} 個の重複が見つかりました</p>
            <div style="margin-top: 8px;">${domainHtml}</div>
          </div>
          <button class="md-button md-button--filled btn-merge-action" data-title="${titleKey}" data-count="${groups.length}">マージを実行</button>
        </div>
      `;
      container.appendChild(card);
    });

    container.querySelectorAll('.btn-merge-action').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const title = e.currentTarget.dataset.title;
        const count = parseInt(e.currentTarget.dataset.count);
        Utils.UI.showConfirm('スマート・マージ', `「${title}」の重複を統合しますか？`, async () => {
          await TidyCore.smartMerge(title);
          Utils.UI.showToast('マージが完了しました');
          navigate('result', { type: 'merge', count: count });
        });
      });
    });
  }

  // Cleanup List
  let selectedCleanupIds = new Set();

  async function renderCleanupList() {
    const { activeGroups, savedGroups } = await TidyCore.fetchState();
    const analysis = TidyCore.analyzeState(activeGroups, savedGroups);
    const container = document.getElementById('cleanup-list');
    container.innerHTML = '';
    selectedCleanupIds.clear();

    const ageLimit = parseInt(document.getElementById('filter-age').value);
    const tabLimit = parseInt(document.getElementById('filter-tabs').value);

    // Target both inactive (stashed) and active (but stale or empty) groups
    const candidates = [...analysis.stashed, ...analysis.stale, ...analysis.empty].filter((g, index, self) => {
      // De-duplicate
      if (self.findIndex(t => t.id === g.id) !== index) return false;

      const now = Date.now();
      let ageInDays = 0;

      if (g.isActive && g.tabs.length > 0) {
        // For active groups, age is based on the most recently accessed tab
        const lastAccess = g.tabs.reduce((max, t) => Math.max(max, t.lastAccessed || 0), 0);
        // If lastAccess is 0, it means no tabs have been accessed since browser restart.
        // We treat such groups as new (0 days) to be safe.
        ageInDays = lastAccess > 0 ? (now - lastAccess) / (1000 * 60 * 60 * 24) : 0;
      } else {
        ageInDays = (now - g.updateTime) / (1000 * 60 * 60 * 24);
      }

      // Age filter
      if (ageLimit > 0 && ageInDays < ageLimit) return false;

      // Tab count filter
      if (tabLimit === 0) {
        // Empty only (consider chrome://newtab as empty)
        const nonIgnoredTabs = g.tabs.filter(t => !TidyCore.isIgnoredUrl(t.url));
        if (nonIgnoredTabs.length > 0) return false;
      } else if (tabLimit === 1) {
        // 1 tab or less
        if (g.tabCount > 1) return false;
      }

      return true;
    });

    if (candidates.length === 0) {
      container.innerHTML = '<p class="md-typescale-body-large">条件に合致するタブグループはありません。</p>';
      document.getElementById('cleanup-footer').style.display = 'none';
      return;
    }

    candidates.forEach(g => {
      const item = document.createElement('div');
      item.className = 'group-card';

      item.innerHTML = `
        <input type="checkbox" class="cleanup-checkbox" data-id="${g.id}">
        <div class="group-color-dot" style="background-color: ${g.color || '#ccc'}"></div>
        <div class="group-info">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div class="md-typescale-title-small">${g.title}</div>
            ${g.hasMobile ? '<span class="badge badge--info" style="font-size: 10px; padding: 0 4px;">Mobile</span>' : ''}
          </div>
          <div class="group-meta">
            <span>タブ: ${g.tabCount}</span>
            <span>${g.domains.join(', ')}</span>
          </div>
        </div>
      `;
      container.appendChild(item);
    });

    document.getElementById('cleanup-footer').style.display = 'flex';
    updateCleanupCount();

    container.querySelectorAll('.cleanup-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        if (e.target.checked) {
          selectedCleanupIds.add(e.target.dataset.id);
        } else {
          selectedCleanupIds.delete(e.target.dataset.id);
        }
        updateCleanupCount();
      });
    });
  }

  document.getElementById('filter-age').addEventListener('change', renderCleanupList);
  document.getElementById('filter-tabs').addEventListener('change', renderCleanupList);

  function updateCleanupCount() {
    document.getElementById('cleanup-count').textContent = selectedCleanupIds.size;
    document.getElementById('execute-cleanup').disabled = selectedCleanupIds.size === 0;
  }

  document.getElementById('execute-cleanup').addEventListener('click', async () => {
    const count = selectedCleanupIds.size;
    Utils.UI.showConfirm('一括掃除', `${count} 件のタブグループを削除しますか？`, async () => {
      await TidyCore.batchCleanup(Array.from(selectedCleanupIds));
      Utils.UI.showToast('掃除が完了しました');
      navigate('result', { type: 'cleanup', count: count });
    });
  });

  // Hash Routing
  function handleHashChange() {
    const hash = window.location.hash.substring(1);
    if (['overview', 'merge', 'cleanup'].includes(hash)) {
      navigate(hash);
    } else {
      navigate('overview');
    }
  }

  window.addEventListener('hashchange', handleHashChange);

  // Initial Load
  if (window.location.hash) {
    handleHashChange();
  } else {
    updateOverview();
  }

  Utils.log('Main dashboard initialized');
});
