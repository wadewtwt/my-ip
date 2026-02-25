document.addEventListener('DOMContentLoaded', () => {
  const loading = document.getElementById('loading');
  const content = document.getElementById('content');
  const ipText = document.getElementById('ip-address');
  const country = document.getElementById('country');
  const city = document.getElementById('city');
  const isp = document.getElementById('isp');
  const timeDisplay = document.getElementById('local-time');
  const refreshBtn = document.getElementById('refresh-btn');
  const copyBtn = document.getElementById('copy-btn');
  const historyBtn = document.getElementById('history-btn');
  const historyPanel = document.getElementById('history-panel');
  const historyList = document.getElementById('history-list');
  const closeHistory = document.getElementById('close-history');
  const clearHistoryBtn = document.getElementById('clear-history');


  // API 节点列表及数据适配逻辑
  const API_PROVIDERS = [
    {
      url: 'https://ipwhois.app/json/',
      handler: (d) => ({ ip: d.ip, country: d.country, city: d.city, isp: d.isp })
    },
    {
      url: 'https://freeipapi.com/api/json',
      handler: (d) => ({ ip: d.ipAddress, country: d.countryName, city: d.cityName, isp: d.as || 'Unknown' })
    },
    {
      url: 'https://ipapi.co/json/',
      handler: (d) => ({ ip: d.ip, country: d.country_name, city: d.city, isp: d.org })
    }
  ];

  // 带超时的请求函数
  async function fetchWithTimeout(url, timeout = 3000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(id);
      if (!response.ok) throw new Error('Status Error');
      return await response.json();
    } catch (e) {
      clearTimeout(id);
      throw e;
    }
  }

  // 保存到历史记录
  async function saveHistory(record) {
    const { history = [] } = await chrome.storage.local.get('history');
    if (history.length > 0 && history[0].ip === record.ip) return;

    const newHistory = [
      { ...record, time: new Date().toLocaleTimeString('en-US', { hour12: false }) },
      ...history
    ].slice(0, 20);

    await chrome.storage.local.set({ history: newHistory });
  }

  // 加载历史记录到 UI
  async function renderHistory() {
    const { history = [] } = await chrome.storage.local.get('history');
    historyList.innerHTML = history.length
      ? history.map(h => `
        <div class="history-item">
          <span class="h-time">${h.time}</span>
          <span class="h-ip">${h.ip}</span>
          <div class="h-info">${h.country} · ${h.city} · ${h.isp}</div>
        </div>
      `).join('')
      : '<p style="text-align:center; color:var(--text-sub); margin-top:20px;">No records found</p>';
  }

  // 获取 IP 信息
  async function fetchIpInfo() {
    loading.classList.remove('hidden');
    content.classList.add('hidden');

    let success = false;

    // 轮询各个接口
    for (const provider of API_PROVIDERS) {
      try {
        console.log(`尝试从接口获取数据: ${provider.url}`);
        const data = await fetchWithTimeout(provider.url, 3000);
        const result = provider.handler(data);

        ipText.textContent = result.ip || 'Unknown';
        country.textContent = result.country || '--';
        city.textContent = result.city || '--';
        isp.textContent = result.isp || '--';

        saveHistory(result); // 成功后保存历史

        success = true;
        break; // 成功获取则跳出循环
      } catch (error) {
        console.warn(`${provider.url} request failed or timeout:`, error.name === 'AbortError' ? 'Timeout' : error.message);
        // Continue to next loop
      }
    }

    loading.classList.add('hidden');
    content.classList.remove('hidden');

    if (!success) {
      ipText.textContent = 'Service unavailable';
    }
  }

  // 复制功能
  copyBtn.addEventListener('click', () => {
    const text = ipText.textContent;
    navigator.clipboard.writeText(text).then(() => {
      // 简单的反馈效果
      const originalColor = copyBtn.style.color;
      copyBtn.style.color = '#22c55e';
      setTimeout(() => {
        copyBtn.style.color = originalColor;
      }, 1000);
    });
  });

  // 刷新功能
  refreshBtn.addEventListener('click', fetchIpInfo);

  const confirmModal = document.getElementById('confirm-modal');
  const cancelConfirm = document.getElementById('cancel-confirm');
  const actionConfirm = document.getElementById('action-confirm');

  // 历史记录相关事件
  historyBtn.addEventListener('click', () => {
    historyPanel.classList.remove('hidden');
    renderHistory();
  });

  closeHistory.addEventListener('click', () => {
    historyPanel.classList.add('hidden');
  });

  clearHistoryBtn.addEventListener('click', () => {
    confirmModal.classList.remove('hidden');
  });

  cancelConfirm.addEventListener('click', () => {
    confirmModal.classList.add('hidden');
  });

  actionConfirm.addEventListener('click', async () => {
    await chrome.storage.local.set({ history: [] });
    renderHistory();
    confirmModal.classList.add('hidden');
  });

  // 初始化执行
  fetchIpInfo();
});
