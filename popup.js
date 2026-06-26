const toggleBtn = document.getElementById('toggleBtn');
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const minIntervalInput = document.getElementById('minInterval');
const maxIntervalInput = document.getElementById('maxInterval');
const clickCountDisplay = document.getElementById('clickCountDisplay');
const runTimeDisplay = document.getElementById('runTimeDisplay');
const resetBtn = document.getElementById('resetBtn');
const modeSelect = document.getElementById('modeSelect');

let isEnabled = false;
let currentMode = 'reload';
let runTimer = null;
let startTime = 0;
let refreshTimer = null;

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
