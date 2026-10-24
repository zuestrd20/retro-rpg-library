/* The Pixel Archive. No tracking, frameworks, or build step. */
(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const elements = {
    grid: $('#game-grid'), filters: $('#platform-filters'), search: $('#search'), sort: $('#sort'),
    count: $('#results-count'), empty: $('#empty-state'), error: $('#load-error'), dialog: $('#lightbox'),
    dialogImage: $('#lightbox-image'), dialogError: $('#lightbox-image-error'), dialogSource: $('#lightbox-source'),
    previous: $('#lightbox-prev'), next: $('#lightbox-next')
  };
  const platformOrder = ['FC', 'SFC', 'Game Boy Color', 'Mega Drive', 'SEGA CD', 'Game Gear'];
  const platformLabels = { FC: 'FC 紅白機', SFC: 'SFC 超任', 'Game Boy Color': 'Game Boy Color', 'Mega Drive': 'Mega Drive', 'SEGA CD': 'SEGA CD', 'Game Gear': 'Game Gear' };
  const collator = new Intl.Collator('zh-Hant', { numeric: true, sensitivity: 'base' });
  const state = { games: [], visible: [], platform: 'all', query: '', sort: 'original', dialogGames: [], dialogIndex: 0, returnFocus: null };

  function normalize(value) { return String(value ?? '').normalize('NFKC').toLocaleLowerCase().trim(); }
  function canonicalPlatform(value) {
    const original = String(value || '其他').trim();
    const key = normalize(original).replace(/[\s_-]+/g, '');
    if (/^(sfc|snes|superfamicom|supernintendo)$/.test(key) || /超任|超級任天堂/.test(original)) return 'SFC';
    if (/^(fc|nes|famicom)$/.test(key) || /紅白機/.test(original)) return 'FC';
    if (/^(gbc|gameboycolor)$/.test(key) || /gb\s*\/\s*gbc/i.test(original)) return 'Game Boy Color';
    if (/^(md|megadrive|genesis|segagenesis)$/.test(key)) return 'Mega Drive';
    if (/^(segacd|megacd|mcd)$/.test(key) || /mega.?cd|sega\s*cd/i.test(original)) return 'SEGA CD';
    if (/^(gg|gamegear)$/.test(key)) return 'Game Gear';
    return original;
  }
  function safeURL(value, allowRelative = false) {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
      const url = new URL(value, document.baseURI);
      if (!['https:', 'http:'].includes(url.protocol)) return null;
      if (!allowRelative && !/^https?:\/\//i.test(value)) return null;
      return allowRelative ? value : url.href;
    } catch (_) { return null; }
  }
  function sourceInfo(value) {
    if (Array.isArray(value)) value = value[0];
    if (typeof value === 'string') return { url: safeURL(value), label: safeURL(value) ? '' : value };
    if (value && typeof value === 'object') return { url: safeURL(value.url || value.href || value.link), label: String(value.label || value.name || value.title || '') };
    return { url: null, label: '' };
  }
  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }
  function externalLink(info, label) {
    if (!info.url) return info.label ? make('span', 'source-label', info.label) : null;
    const link = make('a', '', label);
    link.href = info.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    if (info.label) link.title = info.label;
    link.append(make('span', '', '↗'));
    link.lastChild.setAttribute('aria-hidden', 'true');
    return link;
  }
  function gameYear(game) { const n = parseInt(game.year, 10); return Number.isFinite(n) ? n : 0; }
  function readURL() {
    const params = new URLSearchParams(location.search);
    state.query = params.get('q') || '';
    state.platform = params.get('platform') || 'all';
    state.sort = ['original', 'year-asc', 'year-desc', 'title'].includes(params.get('sort')) ? params.get('sort') : 'original';
    if (state.platform !== 'all' && !state.games.some((game) => game.platform === state.platform)) state.platform = 'all';
    elements.search.value = state.query;
    elements.sort.value = state.sort;
  }
  function updateURL() {
    const url = new URL(location.href);
    if (state.query) url.searchParams.set('q', state.query); else url.searchParams.delete('q');
    if (state.platform !== 'all') url.searchParams.set('platform', state.platform); else url.searchParams.delete('platform');
    if (state.sort !== 'original') url.searchParams.set('sort', state.sort); else url.searchParams.delete('sort');
    try { history.replaceState(null, '', url); } catch (_) { /* Search still works where history is restricted. */ }
  }
  function renderFilters() {
    const counts = new Map();
    state.games.forEach((game) => counts.set(game.platform, (counts.get(game.platform) || 0) + 1));
    const platforms = [...counts.keys()].sort((a, b) => {
      const ai = platformOrder.indexOf(a), bi = platformOrder.indexOf(b);
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi) || collator.compare(a, b);
    });
    const fragment = document.createDocumentFragment();
    [['all', state.games.length], ...platforms.map((p) => [p, counts.get(p)])].forEach(([platform, count]) => {
      const button = make('button', 'platform-button', platform === 'all' ? '全部遊戲 ' : `${platformLabels[platform] || platform} `);
      button.type = 'button';
      button.dataset.platform = platform;
      button.setAttribute('aria-pressed', String(platform === state.platform));
      button.classList.toggle('is-active', platform === state.platform);
      button.append(make('span', '', String(count).padStart(2, '0')));
      fragment.append(button);
    });
    elements.filters.replaceChildren(fragment);
    $('#game-total').textContent = String(state.games.length).padStart(2, '0');
    $('#platform-total').textContent = String(platforms.length).padStart(2, '0');
    const years = state.games.map(gameYear).filter(Boolean);
    if (years.length) $('#archive-years').textContent = `${Math.min(...years)}—${Math.max(...years)}`;
  }
  function makeCard(game) {
    const article = make('article', 'game-card');
    article.id = `game-${game._index + 1}`;
    const art = make('div', 'game-art');
    const artHeader = make('div', 'card-art-header');
    artHeader.append(make('span', '', `NO. ${String(game._index + 1).padStart(2, '0')}`), make('span', 'card-platform', game.platform.toUpperCase()));
    const screenshot = make('button', 'screenshot-button');
    screenshot.type = 'button';
    screenshot.setAttribute('aria-label', `放大《${game.title}》遊戲畫面`);
    if (game.imageCaption) screenshot.title = game.imageCaption;
    const fallback = make('span', 'image-unavailable', '畫面暫時無法載入\n請查看下方的畫面來源');
    const src = safeURL(game.image, true);
    if (src) {
      const img = document.createElement('img');
      img.alt = game.imageAlt || game.imageCaption || `${game.title}遊戲畫面`;
      img.width = 512; img.height = 448; img.loading = 'lazy'; img.decoding = 'async'; img.src = src;
      fallback.hidden = true;
      img.addEventListener('error', () => { img.hidden = true; fallback.hidden = false; });
      screenshot.append(img);
    }
    screenshot.append(fallback, make('span', 'screenshot-hint', '↗'));
    screenshot.lastChild.setAttribute('aria-hidden', 'true');
    screenshot.addEventListener('click', () => openLightbox(game, state.visible, screenshot));
    art.append(artHeader, screenshot);
    const meta = make('div', 'game-meta');
    meta.append(make('span', 'game-year', String(game.year || '年份待考')));
    if (game.genre) meta.append(make('span', 'game-genre', game.genre));
    const title = make('h3', 'game-title', game.title);
    const original = make('p', 'game-original', game.original || '');
    if (game.original) original.lang = /[\u3040-\u30ff]/.test(game.original) ? 'ja' : 'en';
    article.append(art, meta, title, original, make('p', 'game-description', game.description || ''));
    if (game.note) {
      const details = make('details', 'game-note');
      details.append(make('summary', '', '版本、名稱與原清單註記'), make('p', '', String(game.note)));
      article.append(details);
    }
    const links = make('div', 'game-links');
    const source = externalLink(sourceInfo(game.source), '遊戲資料');
    const imageSource = externalLink(sourceInfo(game.imageSource), '畫面來源');
    if (source) links.append(source);
    if (imageSource) links.append(imageSource);
    if (!source && !imageSource) links.append(make('span', 'source-label', '資料來源待補'));
    article.append(links);
    return article;
  }
  function render({ writeURL = true } = {}) {
    const words = normalize(state.query).split(/\s+/).filter(Boolean);
    state.visible = state.games.filter((game) => (state.platform === 'all' || game.platform === state.platform) && words.every((word) => game._search.includes(word)));
    if (state.sort === 'year-asc') state.visible.sort((a, b) => gameYear(a) - gameYear(b) || a._index - b._index);
    if (state.sort === 'year-desc') state.visible.sort((a, b) => gameYear(b) - gameYear(a) || a._index - b._index);
    if (state.sort === 'title') state.visible.sort((a, b) => collator.compare(a.title, b.title));
    elements.grid.replaceChildren(...state.visible.map(makeCard));
    elements.grid.setAttribute('aria-busy', 'false');
    elements.empty.hidden = state.visible.length > 0;
    elements.count.replaceChildren(document.createTextNode('顯示 '), make('strong', '', String(state.visible.length).padStart(2, '0')), document.createTextNode(` / ${String(state.games.length).padStart(2, '0')} 款遊戲${state.platform !== 'all' ? ` · ${state.platform}` : ''}`));
    elements.filters.querySelectorAll('button').forEach((button) => {
      const active = button.dataset.platform === state.platform;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    if (writeURL) updateURL();
  }
  function populateHero() {
    const withImages = state.games.filter((game) => safeURL(game.image, true));
    if (!withImages.length) return;
    const main = withImages.find((game) => /chrono trigger|クロノ.?トリガー|超時空之鑰|時空之旅/.test(normalize(`${game.title} ${game.original}`))) || withImages.find((game) => game.platform === 'SFC') || withImages[0];
    const second = withImages.find((game) => game._index !== main._index && game.platform === 'FC') || withImages.find((game) => game._index !== main._index);
    function setHero(game, prefix) {
      if (!game) return;
      const image = $(`#${prefix}-image`), button = $(`#${prefix}-open`), figure = $(`#${prefix}-screen`);
      image.alt = game.imageAlt || game.imageCaption || `${game.title}遊戲畫面`;
      image.src = safeURL(game.image, true);
      image.addEventListener('error', () => { figure.hidden = true; }, { once: true });
      $(`#${prefix}-game-title`).textContent = game.title;
      button.setAttribute('aria-label', `放大《${game.title}》遊戲畫面`);
      button.onclick = () => openLightbox(game, state.games, button);
      figure.hidden = false;
    }
    setHero(main, 'hero');
    $('#hero-game-platform').textContent = `${main.platform} / ${main.year || '—'}`;
    setHero(second, 'mini');
  }
  function renderLightbox() {
    const game = state.dialogGames[state.dialogIndex];
    if (!game) return;
    $('#lightbox-title').textContent = game.title;
    $('#lightbox-description').textContent = [game.original, game.platform, game.year, game.imageCaption].filter(Boolean).join(' · ');
    $('#lightbox-counter').textContent = `SCREENSHOT ${String(state.dialogIndex + 1).padStart(2, '0')} / ${String(state.dialogGames.length).padStart(2, '0')}`;
    elements.dialogImage.alt = `${game.imageAlt || game.imageCaption || `${game.title}遊戲畫面`}（放大）`;
    const src = safeURL(game.image, true);
    elements.dialogImage.hidden = !src;
    elements.dialogError.hidden = Boolean(src);
    if (src) elements.dialogImage.src = src; else elements.dialogImage.removeAttribute('src');
    const info = sourceInfo(game.imageSource);
    elements.dialogSource.hidden = !info.url;
    if (info.url) {
      elements.dialogSource.href = info.url;
      elements.dialogSource.title = info.label || '查看這張遊戲畫面的原始來源';
    } else elements.dialogSource.removeAttribute('href');
    elements.previous.disabled = elements.next.disabled = state.dialogGames.length < 2;
  }
  function openLightbox(game, list, trigger) {
    state.dialogGames = list.length ? [...list] : [game];
    state.dialogIndex = Math.max(0, state.dialogGames.findIndex((item) => item._index === game._index));
    state.returnFocus = trigger;
    renderLightbox();
    if (typeof elements.dialog.showModal !== 'function') {
      const source = sourceInfo(game.imageSource).url || safeURL(game.image, true);
      if (source) window.open(source, '_blank', 'noopener,noreferrer');
      return;
    }
    if (!elements.dialog.open) elements.dialog.showModal();
    document.body.classList.add('modal-open');
    $('#lightbox-close').focus();
  }
  function changeScreenshot(direction) {
    if (state.dialogGames.length < 2) return;
    state.dialogIndex = (state.dialogIndex + direction + state.dialogGames.length) % state.dialogGames.length;
    renderLightbox();
  }
  elements.filters.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-platform]');
    if (!button) return;
    state.platform = button.dataset.platform;
    render();
  });
  elements.search.addEventListener('input', () => { state.query = elements.search.value; render(); });
  elements.sort.addEventListener('change', () => { state.sort = elements.sort.value; render(); });
  $('#reset-filters').addEventListener('click', () => {
    state.query = ''; state.platform = 'all'; elements.search.value = ''; render(); elements.search.focus();
  });
  $('#lightbox-close').addEventListener('click', () => elements.dialog.close());
  elements.previous.addEventListener('click', () => changeScreenshot(-1));
  elements.next.addEventListener('click', () => changeScreenshot(1));
  elements.dialog.addEventListener('click', (event) => { if (event.target === elements.dialog) elements.dialog.close(); });
  elements.dialog.addEventListener('close', () => {
    document.body.classList.remove('modal-open');
    if (state.returnFocus?.isConnected) state.returnFocus.focus({ preventScroll: true });
  });
  elements.dialogImage.addEventListener('error', () => { elements.dialogImage.hidden = true; elements.dialogError.hidden = false; });
  document.addEventListener('keydown', (event) => {
    if (elements.dialog.open) {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); changeScreenshot(event.key === 'ArrowLeft' ? -1 : 1); }
      return;
    }
    if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !document.activeElement.isContentEditable) { event.preventDefault(); elements.search.focus(); }
  });
  window.addEventListener('popstate', () => { if (state.games.length) { readURL(); render({ writeURL: false }); } });
  async function loadGames() {
    elements.error.hidden = true;
    elements.grid.setAttribute('aria-busy', 'true');
    elements.count.textContent = '正在讀取遊戲記憶…';
    try {
      const response = await fetch('games.json');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data) || !data.length) throw new Error('遊戲清單格式不正確。');
      state.games = data.map((game, index) => {
        const entry = { ...game, title: String(game.title || game.original || `遊戲 ${index + 1}`), platform: canonicalPlatform(game.platform), _index: index };
        entry._search = normalize([entry.title, entry.original, entry.platform, game.platform, entry.year, entry.genre, entry.description, entry.note, { FC: 'Famicom NES 紅白機', SFC: 'Super Famicom SNES 超任', 'Game Boy Color': 'GB GBC', 'Mega Drive': 'MD Genesis', 'SEGA CD': 'Mega-CD MCD', 'Game Gear': 'GG' }[entry.platform]].filter(Boolean).join(' '));
        return entry;
      });
      readURL(); renderFilters(); populateHero(); render({ writeURL: false });
    } catch (error) {
      elements.error.hidden = false;
      elements.empty.hidden = true;
      elements.grid.setAttribute('aria-busy', 'false');
      elements.count.textContent = '尚未載入遊戲資料';
      console.error('The Pixel Archive could not load games.json:', error);
    }
  }
  $('#retry-load').addEventListener('click', loadGames);
  loadGames();
})();
