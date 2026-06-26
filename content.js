chrome.runtime.onMessage.addListener((request) => {
  if (request.action !== 'keepAlive') return;

  // 1. 使用 .click() 模拟真实点击（和浏览器控制台一样）
  const refreshBtn = document.querySelector('[name="refresh"]');
  if (refreshBtn) {
    refreshBtn.click();
  }

  // 2. 发送 HTTP 请求续期服务端会话（双重保障）
  fetch(window.location.href, { method: 'HEAD', cache: 'no-store', credentials: 'include' }).catch(() => {});
});
