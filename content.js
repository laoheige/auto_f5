function performClick() {
  try {
    const target = document.body || document.documentElement;
    target.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));
    console.log('[防过期] 已点击空白处');
  } catch (e) {}
}

chrome.runtime.onMessage.addListener((request) => {
  if (request.action === 'click') {
    performClick();
  }
});
