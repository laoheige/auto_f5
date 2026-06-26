let localCount = 0;

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ isEnabled: false, minInterval: 30, maxInterval: 120, clickCount: 0, mode: 'reload' });
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

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== 'keepAlive') return;
  chrome.storage.local.get(['mode'], (result) => {
    const action = result.mode === 'click' ? doClick : doReload;
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.url && !tab.url.startsWith('chrome://')) {
          action(tab.id);
        }
      });
    });
  });
  scheduleNext();
});

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
  }
});
