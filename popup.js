const toggleBtn = document.getElementById('toggleBtn');
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const minIntervalInput = document.getElementById('minInterval');
const maxIntervalInput = document.getElementById('maxInterval');
const clickCountDisplay = document.getElementById('clickCountDisplay');
const runTimeDisplay = document.getElementById('runTimeDisplay');
const resetBtn = document.getElementById('resetBtn');
const modeSelect = document.getElementById('modeSelect');

// 目标配置相关
const urlPatternInput = document.getElementById('urlPatternInput');
const exactMatchCheck = document.getElementById('exactMatchCheck');
const addUrlPatternBtn = document.getElementById('addUrlPatternBtn');
const urlPatternList = document.getElementById('urlPatternList');
const tabCheckList = document.getElementById('tabCheckList');
const refreshTabListBtn = document.getElementById('refreshTabListBtn');
const tabIndexInput = document.getElementById('tabIndexInput');
const addTabIndexBtn = document.getElementById('addTabIndexBtn');
const tabIndexList = document.getElementById('tabIndexList');
const targetToggle = document.getElementById('targetToggle');
const targetBody = document.getElementById('targetBody');
const targetArrow = document.getElementById('targetArrow');
const targetSummary = document.getElementById('targetSummary');

let isEnabled = false;
let currentMode = 'reload';
let runTimer = null;
let startTime = 0;
let refreshTimer = null;

// 目标配置数据
let targets = {
  urlPatterns: [],      // [{ pattern: string, exact: boolean }]
  selectedUrls: [],     // [{ url: string, title: string }]
  tabIndexes: []        // [number] (0-indexed)
};

// ===== 基础 UI 函数 =====

function updateCountDisplay(count) {
  const label = currentMode === 'reload' ? '刷新' : '点击';
  clickCountDisplay.textContent = `已${label} ${count} 次`;
}

function formatTime(seconds) {
  if (seconds < 60) return `${seconds}秒`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分${seconds % 60}秒`;
  return `${Math.floor(seconds / 3600)}时${Math.floor((seconds % 3600) / 60)}分`;
}

function updateRunTime() {
  if (!isEnabled || !startTime) return;
  const seconds = Math.floor((Date.now() - startTime) / 1000);
  runTimeDisplay.textContent = `运行 ${formatTime(seconds)}`;
}

function startRunTimer() {
  stopRunTimer();
  chrome.storage.local.get(['startTime'], (result) => {
    startTime = result.startTime || Date.now();
    chrome.storage.local.set({ startTime });
    runTimer = setInterval(updateRunTime, 1000);
    updateRunTime();
  });
}

function stopRunTimer() {
  if (runTimer) {
    clearInterval(runTimer);
    runTimer = null;
  }
}

function refreshCount() {
  chrome.runtime.sendMessage({ action: 'getCount' }, (response) => {
    if (response) {
      updateCountDisplay(response.clickCount);
    }
  });
}

function updateUI() {
  if (isEnabled) {
    statusIndicator.classList.add('active');
    statusIndicator.classList.remove('inactive');
    statusText.textContent = '运行中';
    toggleBtn.textContent = '停止';
    toggleBtn.classList.add('stop');
    toggleBtn.classList.remove('start');
  } else {
    statusIndicator.classList.remove('active');
    statusIndicator.classList.add('inactive');
    statusText.textContent = '已停止';
    toggleBtn.textContent = '启动';
    toggleBtn.classList.remove('stop');
    toggleBtn.classList.add('start');
  }
}

toggleBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'toggle' }, (response) => {
    isEnabled = response.isEnabled;
    updateUI();

    if (isEnabled) {
      startRunTimer();
    } else {
      stopRunTimer();
    }
  });
});

function saveInterval() {
  const min = parseInt(minIntervalInput.value) || 30;
  const max = parseInt(maxIntervalInput.value) || 120;
  if (min > max) {
    maxIntervalInput.value = min;
  }
  chrome.runtime.sendMessage({
    action: 'setInterval',
    minInterval: Math.min(min, parseInt(maxIntervalInput.value) || max),
    maxInterval: Math.max(parseInt(maxIntervalInput.value) || max, min)
  });
}

minIntervalInput.addEventListener('change', saveInterval);
maxIntervalInput.addEventListener('change', saveInterval);

modeSelect.addEventListener('change', () => {
  currentMode = modeSelect.value;
  chrome.runtime.sendMessage({ action: 'setMode', mode: currentMode });
  updateCountDisplay(0);
});

resetBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'resetCount' }, () => {
    updateCountDisplay(0);
    if (isEnabled) {
      stopRunTimer();
      startTime = Date.now();
      chrome.storage.local.set({ startTime });
      runTimer = setInterval(updateRunTime, 1000);
      updateRunTime();
    } else {
      startTime = 0;
      chrome.storage.local.set({ startTime: 0 });
      runTimeDisplay.textContent = '运行 0秒';
    }
  });
});

chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => {
  if (response) {
    isEnabled = response.isEnabled;
    minIntervalInput.value = response.minInterval || 30;
    maxIntervalInput.value = response.maxInterval || 120;
    currentMode = response.mode || 'reload';
    modeSelect.value = currentMode;
    updateUI();
    updateCountDisplay(0);
    if (isEnabled) {
      startRunTimer();
    }
  }
});

refreshCount();
refreshTimer = setInterval(refreshCount, 1000);

// ===== 目标配置 =====

function updateTargetSummary() {
  const parts = [];
  if (targets.urlPatterns.length > 0) parts.push(`URL ${targets.urlPatterns.length}条`);
  if (targets.selectedUrls.length > 0) parts.push(`已选 ${targets.selectedUrls.length}个`);
  if (targets.tabIndexes.length > 0) parts.push(`索引 ${targets.tabIndexes.length}个`);
  targetSummary.textContent = parts.length > 0 ? parts.join(' | ') : '未配置';
}

function saveTargets() {
  chrome.runtime.sendMessage({ action: 'saveTargets', targets });
  updateTargetSummary();
}

// ---- URL 模式匹配 ----

function renderUrlPatterns() {
  if (targets.urlPatterns.length === 0) {
    urlPatternList.innerHTML = '<div class="empty-hint">尚未添加 URL 规则</div>';
    return;
  }
  urlPatternList.innerHTML = targets.urlPatterns.map((p, i) =>
    `<div class="tag-item">
      <span class="tag-label">${escapeHtml(p.pattern)}</span>
      <span class="tag-badge">${p.exact ? '完整' : '通配'}</span>
      <button class="btn btn-danger" data-idx="${i}" data-type="url">删除</button>
    </div>`
  ).join('');
}

addUrlPatternBtn.addEventListener('click', () => {
  const pattern = urlPatternInput.value.trim();
  if (!pattern) return;
  targets.urlPatterns.push({ pattern, exact: exactMatchCheck.checked });
  urlPatternInput.value = '';
  exactMatchCheck.checked = false;
  renderUrlPatterns();
  saveTargets();
});

urlPatternInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addUrlPatternBtn.click();
});

// ---- 选取当前标签页 ----

function renderTabList(tabs) {
  if (tabs.length === 0) {
    tabCheckList.innerHTML = '<div class="empty-hint">没有打开的标签页</div>';
    return;
  }
  tabCheckList.innerHTML = tabs.map((tab, i) => {
    const isChecked = targets.selectedUrls.some(s => s.url === tab.url);
    return `<div class="tab-item">
      <input type="checkbox" data-url="${escapeHtml(tab.url)}" data-title="${escapeHtml(tab.title)}" ${isChecked ? 'checked' : ''}>
      <div class="tab-info">
        <div class="tab-title">${escapeHtml(tab.title || '(无标题)')}</div>
        <div class="tab-url">${escapeHtml(tab.url)}</div>
      </div>
      <span class="tab-index">#${tab.index + 1}</span>
    </div>`;
  }).join('');

  // 监听 checkbox 变化
  tabCheckList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const url = cb.dataset.url;
      const title = cb.dataset.title;
      if (cb.checked) {
        if (!targets.selectedUrls.some(s => s.url === url)) {
          targets.selectedUrls.push({ url, title });
        }
      } else {
        targets.selectedUrls = targets.selectedUrls.filter(s => s.url !== url);
      }
      renderUrlPatterns();
      saveTargets();
    });
  });
}

function refreshTabList() {
  chrome.runtime.sendMessage({ action: 'getAllTabs' }, (response) => {
    if (response && response.tabs) {
      renderTabList(response.tabs);
    }
  });
}

refreshTabListBtn.addEventListener('click', refreshTabList);

// ---- 固定索引 ----

function renderTabIndexes() {
  if (targets.tabIndexes.length === 0) {
    tabIndexList.innerHTML = '<div class="empty-hint">尚未添加索引</div>';
    return;
  }
  tabIndexList.innerHTML = targets.tabIndexes.map((idx, i) =>
    `<div class="tag-item">
      <span class="tag-label">第 ${idx + 1} 个标签页</span>
      <button class="btn btn-danger" data-idx="${i}" data-type="index">删除</button>
    </div>`
  ).join('');
}

addTabIndexBtn.addEventListener('click', () => {
  const val = parseInt(tabIndexInput.value);
  if (isNaN(val) || val < 1) return;
  const zeroBased = val - 1;
  if (!targets.tabIndexes.includes(zeroBased)) {
    targets.tabIndexes.push(zeroBased);
    targets.tabIndexes.sort((a, b) => a - b);
  }
  tabIndexInput.value = '1';
  renderTabIndexes();
  saveTargets();
});

tabIndexInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addTabIndexBtn.click();
});

// ---- 公共事件委托（删除按钮） ----

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-danger');
  if (!btn) return;

  const idx = parseInt(btn.dataset.idx);
  const type = btn.dataset.type;

  if (type === 'url') {
    targets.urlPatterns.splice(idx, 1);
    renderUrlPatterns();
    saveTargets();
  } else if (type === 'index') {
    targets.tabIndexes.splice(idx, 1);
    renderTabIndexes();
    saveTargets();
  }
});

// ---- 折叠/展开 ----

let targetCollapsed = false;

targetToggle.addEventListener('click', () => {
  targetCollapsed = !targetCollapsed;
  targetBody.classList.toggle('collapsed', targetCollapsed);
  targetArrow.classList.toggle('collapsed', targetCollapsed);
});

// ---- 加载保存的目标配置 ----

function loadTargets() {
  chrome.runtime.sendMessage({ action: 'loadTargets' }, (response) => {
    if (response && response.targets) {
      targets = response.targets;
      if (!targets.urlPatterns) targets.urlPatterns = [];
      if (!targets.selectedUrls) targets.selectedUrls = [];
      if (!targets.tabIndexes) targets.tabIndexes = [];
      renderUrlPatterns();
      renderTabIndexes();
      updateTargetSummary();
      // 自动加载标签页列表
      refreshTabList();
    }
  });
}

// ===== 工具函数 =====

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ===== 初始化 =====

loadTargets();
