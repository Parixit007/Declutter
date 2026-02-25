// popup.js

document.addEventListener("DOMContentLoaded", () => {
  const button = document.getElementById("mybutton");
  const resultText = document.getElementById("result");
  const urlInput = document.getElementById("url-input");
  const addButton = document.getElementById("add-button");
  const siteList = document.getElementById("site-list");

  // ─── Load and Render ────────────────────────────────────────────────────────

  function renderList(sites) {
    siteList.innerHTML = "";

    if (sites.length === 0) {
      siteList.innerHTML = "<p class='empty'>No sites added yet.</p>";
      return;
    }

    sites.forEach((site) => {
      const row = document.createElement("div");
      row.className = "row";

      const name = document.createElement("span");
      name.className = "name";
      name.textContent = site;

      const removeBtn = document.createElement("button");
      removeBtn.className = "remove-btn";
      removeBtn.textContent = "✕";
      removeBtn.addEventListener("click", () => removeSite(site));

      row.appendChild(name);
      row.appendChild(removeBtn);
      siteList.appendChild(row);
    });
  }

  function loadSites() {
    chrome.storage.sync.get({ customSites: [] }, (data) => {
      renderList(data.customSites);
    });
  }

  // ─── Validation ──────────────────────────────────────────────────────────────

  function normalizeInput(raw) {
    const trimmed = raw.trim().toLowerCase();
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return trimmed;
    }
    return "https://" + trimmed;
  }

  function isValidUrl(raw) {
    try {
      const url = new URL(normalizeInput(raw));
      const hostname = url.hostname;

      // Must have at least one dot (e.g. "google.com", not just "google")
      if (!hostname.includes(".")) return false;

      // TLD must be at least 2 chars (e.g. .com, .io, .co.uk)
      const parts = hostname.split(".");
      const tld = parts[parts.length - 1];
      if (tld.length < 2) return false;

      // No spaces, must be a real-looking hostname
      if (/\s/.test(hostname)) return false;

      return true;
    } catch (e) {
      return false;
    }
  }

  // ─── Add Site ────────────────────────────────────────────────────────────────

  function addSite() {
    const raw = urlInput.value.trim();

    if (!raw) {
      resultText.textContent = "Please enter a URL.";
      return;
    }

    if (!isValidUrl(raw)) {
      resultText.textContent = "Invalid URL";
      return;
    }

    const normalized = normalizeInput(raw);
    const toStore = normalized.replace(/^https?:\/\//, "");

    chrome.storage.sync.get({ customSites: [] }, (data) => {
      const sites = data.customSites;

      if (sites.includes(toStore)) {
        resultText.textContent = "This site is already in your list.";
        return;
      }

      const updated = [...sites, toStore];
      chrome.storage.sync.set({ customSites: updated }, () => {
        urlInput.value = "";
        resultText.textContent = "";
        renderList(updated);
      });
    });
  }

  // ─── Remove Site ─────────────────────────────────────────────────────────────

  function removeSite(site) {
    chrome.storage.sync.get({ customSites: [] }, (data) => {
      const updated = data.customSites.filter((s) => s !== site);
      chrome.storage.sync.set({ customSites: updated }, () => {
        renderList(updated);
      });
    });
  }

  // ─── Declutter Button ────────────────────────────────────────────────────────

  button.addEventListener("click", () => {
    resultText.textContent = "Working...";

    chrome.runtime.sendMessage({ action: "DECLUTTER_NOW" }, (response) => {
      if (chrome.runtime.lastError) {
        resultText.textContent = "Something went wrong.";
        return;
      }

      if (response && response.closedCount !== undefined) {
        if (response.closedCount === 0) {
          resultText.textContent = "No unnecessary tabs found. ✅";
        } else {
          resultText.textContent = `Closed ${response.closedCount} tab(s). ✅`;
        }
      }
    });
  });

  // ─── Event Listeners ─────────────────────────────────────────────────────────

  addButton.addEventListener("click", addSite);

  urlInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addSite();
  });

  // ─── Init ────────────────────────────────────────────────────────────────────

  loadSites();
});