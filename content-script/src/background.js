chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    isEnabled: true,
    aiModel: 'gpt-4o',
    autoReply: false,
    customPrompts: [],
  });
  console.log('[SW] Extension installed and default settings saved.');
});

// Handle screenshot & analysis request
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📩 BG received message:', request);
  if (request.action === 'runScroll') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'runScroll' });
    });
  }

  if (request.action === 'stopScroll') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'stopScroll' });
    });
  }

  // 📸 NEW HANDLER — called from content.js for each tweet
  if (request.action === 'captureAndAnalyzeRaw') {
    chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'png' }, async (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }

      try {
        const base64 = (dataUrl || '').split(',')[1];
        if (!base64) {
          sendResponse({ ok: false, error: 'No base64 from capture' });
          return;
        }

        const resp = await fetch('http://localhost:4000/bulk-analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ screenshotBase64: base64 }),
        });

        const text = await resp.text();
        console.log('📩 BG received text:123', text);
        if (!resp.ok) {
          sendResponse({ ok: false, error: `Backend ${resp.status}: ${text}` });
          return;
        }

        let json;
        try {
          json = JSON.parse(text);
        } catch (e) {
          sendResponse({ ok: false, error: `Backend JSON parse failed: ${e.message}`, raw: text });
          return;
        }

        sendResponse({ ok: true, backend: json });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    });

    return true;
  }
});
