let socket = null;
let isConnecting = false;

// Periodic alarm to attempt flushing the queue in case desktop app was closed
chrome.alarms.create("flushQueue", { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "flushQueue") {
    flushQueueIfConnected();
  }
});

async function getPendingMessages() {
  const result = await chrome.storage.local.get("pendingMessages");
  return result.pendingMessages || [];
}

async function addPendingMessage(msg) {
  const messages = await getPendingMessages();
  messages.push(msg);
  await chrome.storage.local.set({ pendingMessages: messages });
}

async function clearPendingMessages() {
  await chrome.storage.local.set({ pendingMessages: [] });
}

function flushQueueIfConnected() {
  if (socket && socket.readyState === WebSocket.OPEN) {
    getPendingMessages().then(async (messages) => {
      if (messages.length > 0) {
        for (const msg of messages) {
          socket.send(msg);
        }
        await clearPendingMessages();
      }
    });
  } else {
    connectWebSocket();
  }
}

function connectWebSocket() {
  if (isConnecting || (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING))) {
      return;
  }
  isConnecting = true;
  socket = new WebSocket('ws://127.0.0.1:14444');

  socket.onopen = () => {
    console.log("SUCCESS - Connected to Crackit Desktop App!");
    chrome.action.setBadgeText({ text: "OK" });
    chrome.action.setBadgeBackgroundColor({ color: "#4CAF50" }); // Green
    isConnecting = false;
    flushQueueIfConnected();
  };

  socket.onclose = () => {
    console.error("FAIL - Disconnected from Crackit Desktop App!");
    chrome.action.setBadgeText({ text: "ERR" });
    chrome.action.setBadgeBackgroundColor({ color: "#F44336" }); // Red
    isConnecting = false;
    socket = null;
  };
  
  socket.onerror = (err) => {
    console.error("FAIL - WebSocket Error:", err);
    chrome.action.setBadgeText({ text: "ERR" });
    chrome.action.setBadgeBackgroundColor({ color: "#F44336" }); // Red
    isConnecting = false;
  };
}

// Initial connection attempt when service worker wakes up
connectWebSocket();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "send_snip") {
    // Add to persistent queue and then try flushing
    addPendingMessage(request.data).then(() => {
      connectWebSocket();
      flushQueueIfConnected();
      sendResponse({ status: "queued_persistently" });
    });
    return true; // Keep the message channel open for the async response
  } else if (request.action === "capture_area") {
    // We use the native browser API to take a perfect screenshot of the visible tab
    chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        return;
      }
      
      // Send the full raw image back to the content script so it can precisely crop the selected element
      chrome.tabs.sendMessage(sender.tab.id, {
        action: "crop_and_send",
        dataUrl: dataUrl,
        rect: request.rect,
        contextText: request.contextText
      });
    });
  }
});

// When the extension icon is clicked, send a message to the content script of the active tab
chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.sendMessage(tab.id, { action: "trigger_capture" });
});
