document.addEventListener('DOMContentLoaded', async () => {
  const navItems = document.querySelectorAll('.nav-item');
  const sections = document.querySelectorAll('.content-section');

  // SPA Navigation
  function navigate(targetId) {
    navItems.forEach(item => {
      item.classList.toggle('active', item.dataset.target === targetId);
    });
    sections.forEach(section => {
      section.classList.toggle('active', section.id === `section-${targetId}`);
    });

    if (targetId === 'overview') updateOverview();
    if (targetId === 'merge') renderMergeList();
    if (targetId === 'cleanup') renderCleanupList();
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
  }

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
      if (!groupsByTitle.has(g.title)) groupsByTitle.set(g.title, []);
      groupsByTitle.get(g.title).push(g);
    });

    if (groupsByTitle.size === 0) {
      container.innerHTML = '<p class="md-typescale-body-large">重複しているグループはありません。</p>';
      return;
    }

    groupsByTitle.forEach((groups, title) => {
      const card = document.createElement('div');
      card.className = 'md-card item-card';
      card.style.padding = '16px';
      card.style.marginBottom = '12px';
      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h3 class="md-typescale-title-medium">${title}</h3>
            <p class="md-typescale-body-small">${groups.length} 個の重複が見つかりました</p>
          </div>
          <button class="md-button md-button--filled btn-merge-action" data-title="${title}">マージを実行</button>
        </div>
      `;
      container.appendChild(card);
    });

    container.querySelectorAll('.btn-merge-action').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const title = e.currentTarget.dataset.title;
        await TidyCore.smartMerge(title);
        renderMergeList();
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

    const candidates = [...analysis.stale, ...analysis.empty];
    // De-duplicate by ID
    const uniqueCandidates = Array.from(new Map(candidates.map(c => [c.id, c])).values());

    if (uniqueCandidates.length === 0) {
      container.innerHTML = '<p class="md-typescale-body-large">掃除が必要なグループはありません。</p>';
      document.getElementById('cleanup-footer').style.display = 'none';
      return;
    }

    uniqueCandidates.forEach(g => {
      const item = document.createElement('div');
      item.className = 'group-card';
      const isStale = analysis.stale.some(s => s.id === g.id);
      const isEmpty = analysis.empty.some(e => e.id === g.id);

      item.innerHTML = `
        <input type="checkbox" class="cleanup-checkbox" data-id="${g.id}">
        <div class="group-color-dot" style="background-color: ${g.color || '#ccc'}"></div>
        <div class="group-info">
          <div class="md-typescale-title-small">${g.title}</div>
          <div class="group-meta">
            <span>タブ: ${g.tabCount}</span>
            <span>${isStale ? '放置' : ''} ${isEmpty ? '空' : ''}</span>
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

  function updateCleanupCount() {
    document.getElementById('cleanup-count').textContent = selectedCleanupIds.size;
    document.getElementById('execute-cleanup').disabled = selectedCleanupIds.size === 0;
  }

  document.getElementById('execute-cleanup').addEventListener('click', async () => {
    await TidyCore.batchCleanup(Array.from(selectedCleanupIds));
    renderCleanupList();
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
