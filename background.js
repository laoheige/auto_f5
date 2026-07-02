let localCount = 0;

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    isEnabled: false, minInterval: 30, maxInterval: 120,
    clickCount: 0, mode: 'reload',
    targets: { urlPatterns: [], selectedUrls: [], tabIndexes: [] }
  });
});

function doClick(tabId) {
  chrome.tabs.sendMessage(tabId, { action: 'keepAlive' }).catch(() => {});
  localCount++;
  chrome.storage.local.set({ clickCount: localCount });
}

function doReload(tabId) {
  chrome.tabs.reload(tabId, { bypassCache: true });
  localCount++;
  chrome.storage.local.set({ clickCount: localCount });
}

function scheduleNext() {
  chrome.storage.local.get(['minInterval', 'maxInterval'], (result) => {
    const min = result.minInterval || 30;
    const max = result.maxInterval || 120;
    const delay = Math.floor(Math.random() * (max - min + 1) + min);
    chrome.storage.local.set({ isEnabled: true });
    chrome.alarms.create('keepAlive', { delayInMinutes: delay / 60 });
  });
}

function stopAuto() {
  chrome.alarms.clear('keepAlive');
  chrome.storage.local.set({ isEnabled: false });
}

// ===== 目标标签页匹配 =====

function matchGlob(url, pattern) {
  if (!url || !pattern) return false;
  try {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(url);
  } catch (e) {
    return false;
  }
}

function isTabTargeted(tab, targets) {
  if (!targets || !tab.url) return false;

  // 检查 URL 模式匹配
  if (targets.urlPatterns && targets.urlPatterns.length > 0) {
    for (const p of targets.urlPatterns) {
      if (p.exact) {
        if (tab.url === p.pattern) return true;
      } else {
        if (matchGlob(tab.url, p.pattern)) return true;
      }
    }
  }

  // 检查选中标签页 URL
  if (targets.selectedUrls && targets.selectedUrls.length > 0) {
    for (const s of targets.selectedUrls) {
      if (tab.url === s.url) return true;
    }
  }

  // 检查固定索引
  if (targets.tabIndexes && targets.tabIndexes.length > 0) {
    if (targets.tabIndexes.includes(tab.index)) return true;
  }

  return false;
}

// ===== Alarm 处理 =====

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== 'keepAlive') return;
  chrome.storage.local.get(['mode', 'targets'], (result) => {
    const action = result.mode === 'click' ? doClick : doReload;
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.url && !tab.url.startsWith('chrome://') && isTabTargeted(tab, result.targets)) {
          action(tab.id);
        }
      });
    });
  });
  scheduleNext();
});

// ===== 消息处理 =====

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggle') {
    chrome.storage.local.get(['isEnabled'], (result) => {
      const newState = !result.isEnabled;
      if (newState) scheduleNext();
      else stopAuto();
      sendResponse({ isEnabled: newState });
    });
    return true;
  } else if (request.action === 'getStatus') {
    chrome.storage.local.get(['isEnabled', 'minInterval', 'maxInterval', 'mode'], (result) => {
      sendResponse(result);
    });
    return true;
  } else if (request.action === 'setInterval') {
    chrome.storage.local.set({ minInterval: request.minInterval, maxInterval: request.maxInterval });
    sendResponse({ success: true });
    return true;
  } else if (request.action === 'setMode') {
    chrome.storage.local.set({ mode: request.mode });
    sendResponse({ success: true });
    return true;
  } else if (request.action === 'getCount') {
    chrome.storage.local.get(['clickCount'], (result) => {
      sendResponse({ clickCount: result.clickCount || 0 });
    });
    return true;
  } else if (request.action === 'resetCount') {
    localCount = 0;
    chrome.storage.local.set({ clickCount: 0 });
    sendResponse({ success: true });
    return true;

  // ===== 目标配置相关 =====
  } else if (request.action === 'getAllTabs') {
    chrome.tabs.query({}, (tabs) => {
      const tabList = tabs.map((tab, i) => ({
        id: tab.id,
        index: tab.index,
        url: tab.url || '',
        title: tab.title || ''
      }));
      sendResponse({ tabs: tabList });
    });
    return true;
  } else if (request.action === 'saveTargets') {
    chrome.storage.local.set({ targets: request.targets });
    sendResponse({ success: true });
    return true;
  } else if (request.action === 'loadTargets') {
    chrome.storage.local.get(['targets'], (result) => {
      sendResponse({ targets: result.targets || { urlPatterns: [], selectedUrls: [], tabIndexes: [] } });
    });
    return true;
  }
});
