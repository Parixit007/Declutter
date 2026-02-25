// background.js (manifest v3 service worker)

// Keyboard shortcut listener
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "declutter-tabs") {
    const result = await declutterTabs().catch(() => ({ closedCount: 0, error: true }));

    const badgeLabel = result.error ? "ERR" : String(result.closedCount);
    const badgeColor = result.error ? "#E53935" : "#4CAF50";

    await chrome.action.setBadgeText({ text: badgeLabel });
    await chrome.action.setBadgeBackgroundColor({ color: badgeColor });

    setTimeout(() => chrome.action.setBadgeText({ text: "" }), 2000);
  }
});

// Popup button listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "DECLUTTER_NOW") {
    declutterTabs()
      .then((result) => sendResponse(result))
      .catch(() => sendResponse({ closedCount: 0, error: true }));
    return true;
  }
});

//=====================================================================================

function normalizeInput(raw) {
  const trimmed = raw.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return "https://" + trimmed;
}

function matchesTab(savedRaw, tabUrl) {
  try {
    const savedFull = normalizeInput(savedRaw);
    const saved = new URL(savedFull);
    const tab = new URL(tabUrl);

    const savedHasPath = saved.pathname !== "/" || savedFull.includes("/", 8);
    // 8 = length of "https://" so we skip the protocol slashes

    if (!savedHasPath) {
      // Case 1: domain only — close homepage only
      const hostnameMatch =
        tab.hostname === saved.hostname ||
        tab.hostname === "www." + saved.hostname ||
        "www." + tab.hostname === saved.hostname;

      const isHomePage = tab.pathname === "/" || tab.pathname === "";

      return hostnameMatch && isHomePage && tab.search === "";
    } else {
      // Case 2: full URL — exact match including query params
      return (
        tab.hostname === saved.hostname &&
        tab.pathname === saved.pathname &&
        tab.search === saved.search
      );
    }
  } catch (e) {
    return false;
  }
}

//===============================================================================

async function declutterTabs() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const { customSites } = await chrome.storage.sync.get({ customSites: [] });

  const tabsToClose = [];

  for (const tab of tabs) {
    if (tab.active) continue;
    if (tab.pinned) continue;
    if (!tab.url) continue;

    // New-tab detection
    if (
      tab.url.startsWith("chrome://newtab") ||
      tab.url.startsWith("chrome://new-tab-page") ||
      tab.url.startsWith("chrome-search://") ||
      tab.url === "about:blank"
    ) {
      console.log("Declutter: closing new-tab page:", tab.url);
      tabsToClose.push(tab.id);
      continue;
    }

    // Match against user's custom site list
    const matched = customSites.some((site) => matchesTab(site, tab.url));
    if (matched) {
      console.log("Declutter: closing matched tab:", tab.url);
      tabsToClose.push(tab.id);
      continue;
    }
  }

  if (tabsToClose.length > 0) {
    try {
      console.log("Declutter: removing tabs:", tabsToClose);
      await chrome.tabs.remove(tabsToClose);
    } catch (err) {
      console.error("Declutter: error removing tabs:", err);
    }
  } else {
    console.log("Declutter: nothing to remove.");
  }

  return { closedCount: tabsToClose.length };
}
//===================================================================