let clickTimer = null;
let localClickCount = 0;

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ isEnabled: false, interval: 10, clickCount: 0, tabMode: 'current' });
});

function doClick(tabId) {
  chrome.tabs.sendMessage(tabId, { action: 'click' }).catch(() => {});
  localClickCount++;
  chrome.storage.local.set({ clickCount: localClickCount });
}

function startAutoClick(interval, tabMode) {
  stopAutoClick();
  chrome.storage.local.get(['clickCount'], (result) => {
    localClickCount = result.clickCount || 0;
  });
  clickTimer = setInterval(() => {
    if (tabMode === 'all') {
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          if (tab.url && !tab.url.startsWith('chrome://')) {
            doClick(tab.id);
          }
        });
      });
    } else {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].url && !tabs[0].url.startsWith('chrome://')) {
          doClick(tabs[0].id);
        }
      });
    }
  }, interval * 1000);
}

function stopAutoClick() {
  if (clickTimer) {
    clearInterval(clickTimer);
    clickTimer = null;
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggle') {
    chrome.storage.local.get(['isEnabled', 'interval', 'tabMode'], (result) => {
      const newState = !result.isEnabled;
      const intv = result.interval || 10;
      const mode = result.tabMode || 'current';
      chrome.storage.local.set({ isEnabled: newState });
      if (newState) {
        startAutoClick(intv, mode);
      } else {
        stopAutoClick();
      }
      sendResponse({ isEnabled: newState });
    });
    return true;
  } else if (request.action === 'getStatus') {
    chrome.storage.local.get(['isEnabled', 'interval', 'tabMode'], (result) => {
      sendResponse(result);
    });
    return true;
  } else if (request.action === 'setInterval') {
    chrome.storage.local.get(['isEnabled', 'tabMode'], (result) => {
      chrome.storage.local.set({ interval: request.interval });
      if (result.isEnabled) {
        startAutoClick(request.interval, result.tabMode || 'current');
      }
      sendResponse({ success: true });
    });
    return true;
  } else if (request.action === 'setTabMode') {
    chrome.storage.local.get(['isEnabled', 'interval'], (result) => {
      chrome.storage.local.set({ tabMode: request.tabMode });
      if (result.isEnabled) {
        startAutoClick(result.interval || 10, request.tabMode);
      }
      sendResponse({ success: true });
    });
    return true;
  } else if (request.action === 'getCount') {
    chrome.storage.local.get(['clickCount'], (result) => {
      sendResponse({ clickCount: result.clickCount || 0 });
    });
    return true;
  } else if (request.action === 'resetCount') {
    chrome.storage.local.set({ clickCount: 0 });
    sendResponse({ success: true });
  }
});
