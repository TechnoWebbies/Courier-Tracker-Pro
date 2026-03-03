// Storage keys
const SESSIONS_KEY = "courierPro_sessions";
const SETTINGS_KEY = "courierPro_settings";
const CURRENT_KEY = "courierPro_currentSession";
// Sessions edit
const sessionEditModal = document.getElementById("session-edit-modal");
const sessionEditForm = document.getElementById("session-edit-form");
const editIdInput = document.getElementById("edit-id");
const editDateInput = document.getElementById("edit-date");
const editStartTimeInput = document.getElementById("edit-startTime");
const editEndTimeInput = document.getElementById("edit-endTime");
const editOrdersInput = document.getElementById("edit-orders");
const editEarningsInput = document.getElementById("edit-earnings");
const editDistanceInput = document.getElementById("edit-distance");
const editCancelBtn = document.getElementById("edit-cancel");


const defaultSettings = {
  fuelCostPerKm: 0.15
};

// ---------- helpers for storage ----------
function loadSettings() {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) return { ...defaultSettings };
  try {
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return { ...defaultSettings };
  }
}

function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function loadSessions() {
  const raw = localStorage.getItem(SESSIONS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveSessions(sessions) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

function loadCurrentSession() {
  const raw = localStorage.getItem(CURRENT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveCurrentSession(sess) {
  localStorage.setItem(CURRENT_KEY, JSON.stringify(sess));
}

function clearCurrentSession() {
  localStorage.removeItem(CURRENT_KEY);
}

// ---------- utility ----------
function formatMoney(value) {
  return value.toFixed(2) + " €";
}

function todayDateStr() {
  return new Date().toISOString().slice(0, 10);
}

function calcHoursFromISO(startISO, endISO) {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const ms = end.getTime() - start.getTime();
  return ms > 0 ? ms / (1000 * 60 * 60) : 0;
}

// group sessions by date
function groupByDate(sessions, settings) {
  const map = {};
  sessions.forEach((s) => {
    if (!map[s.date]) {
      map[s.date] = {
        date: s.date,
        hours: 0,
        orders: 0,
        gross: 0,
        distanceKm: 0
      };
    }
    map[s.date].hours += s.hours;
    map[s.date].orders += s.orders;
    map[s.date].gross += s.earnings;
    map[s.date].distanceKm += s.distanceKm;
  });

  // compute fuel, net, hourly
  const days = Object.values(map).sort((a, b) => (a.date < b.date ? 1 : -1));
  days.forEach((d) => {
    d.fuel = d.distanceKm * settings.fuelCostPerKm;
    d.net = d.gross - d.fuel;
    d.hourly = d.hours > 0 ? d.net / d.hours : 0;
  });
  return days;
}

// ---------- DOM refs ----------
const tabButtons = document.querySelectorAll(".tab-button");
const tabs = document.querySelectorAll(".tab");

// Today tab
const startBtn = document.getElementById("start-btn");
const stopBtn = document.getElementById("stop-btn");
const noSessionDiv = document.getElementById("no-session");
const activeSessionDiv = document.getElementById("active-session");
const activeStartSpan = document.getElementById("active-start");

const sessionDetailsCard = document.getElementById("session-details-card");
const sessionForm = document.getElementById("session-form");
const sessEarningsInput = document.getElementById("sess-earnings");
const sessOrdersInput = document.getElementById("sess-orders");
const sessDistanceInput = document.getElementById("sess-distance");

const todayDateSpan = document.getElementById("today-date");
const todayHoursSpan = document.getElementById("today-hours");
const todayOrdersSpan = document.getElementById("today-orders");
const todayGrossSpan = document.getElementById("today-gross");
const todayFuelSpan = document.getElementById("today-fuel");
const todayNetSpan = document.getElementById("today-net");
const todayHourlySpan = document.getElementById("today-hourly");

// Days tab
const daysEmpty = document.getElementById("days-empty");
const daysTable = document.getElementById("days-table");
const daysBody = document.getElementById("days-body");

// Sessions tab
const sessionsEmpty = document.getElementById("sessions-empty");
const sessionsTable = document.getElementById("sessions-table");
const sessionsBody = document.getElementById("sessions-body");

// Settings
const settingsForm = document.getElementById("settings-form");
const fuelCostInput = document.getElementById("fuelCost");
const exportBtn = document.getElementById("exportJson");
const importInput = document.getElementById("importJson");

// ---------- tabs ----------
tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.tab;
    tabButtons.forEach((b) => b.classList.remove("active"));
    tabs.forEach((t) => t.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(target).classList.add("active");

    if (target === "today") renderToday();
    if (target === "days") renderDays();
    if (target === "sessions") renderSessions();
    if (target === "settings") initSettingsForm();
  });
});

// ---------- Today: Start/Stop ----------
function updateStartStopUI() {
  const current = loadCurrentSession();
  if (current) {
    noSessionDiv.classList.add("hidden");
    activeSessionDiv.classList.remove("hidden");
    const t = new Date(current.startISO);
    const hh = t.getHours().toString().padStart(2, "0");
    const mm = t.getMinutes().toString().padStart(2, "0");
    activeStartSpan.textContent = `${current.date} ${hh}:${mm}`;
  } else {
    noSessionDiv.classList.remove("hidden");
    activeSessionDiv.classList.add("hidden");
  }
}

startBtn.addEventListener("click", () => {
  const now = new Date();
  const session = {
    startISO: now.toISOString(),
    date: now.toISOString().slice(0, 10)
  };
  saveCurrentSession(session);
  sessionDetailsCard.classList.add("hidden");
  updateStartStopUI();
});

stopBtn.addEventListener("click", () => {
  const current = loadCurrentSession();
  if (!current) return;
  const now = new Date();
  current.endISO = now.toISOString();
  saveCurrentSession(current);

  // show details form
  sessEarningsInput.value = "";
  sessOrdersInput.value = "";
  sessDistanceInput.value = "";
  sessionDetailsCard.classList.remove("hidden");
});

// Save session details after Stop
sessionForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const current = loadCurrentSession();
  if (!current || !current.endISO) {
    alert("No session to save");
    return;
  }
  const settings = loadSettings();
  const earnings = parseFloat(sessEarningsInput.value || "0");
  const orders = parseInt(sessOrdersInput.value || "0", 10);
  const distanceKm = parseFloat(sessDistanceInput.value || "0");

  const hours = calcHoursFromISO(current.startISO, current.endISO);
  const fuelCost = distanceKm * settings.fuelCostPerKm;

  const session = {
    id: Date.now(),
    date: current.date,
    startISO: current.startISO,
    endISO: current.endISO,
    startTime: new Date(current.startISO).toTimeString().slice(0, 5),
    endTime: new Date(current.endISO).toTimeString().slice(0, 5),
    earnings,
    orders,
    distanceKm,
    hours,
    fuelCost
  };

  const sessions = loadSessions();
  sessions.push(session);
  saveSessions(sessions);
  clearCurrentSession();

  sessionDetailsCard.classList.add("hidden");
  updateStartStopUI();
  renderToday();
});

// ---------- Today summary ----------
function renderToday() {
  const settings = loadSettings();
  const sessions = loadSessions();
  const today = todayDateStr();
  todayDateSpan.textContent = today;

  let hours = 0;
  let orders = 0;
  let gross = 0;
  let distanceKm = 0;

  sessions.forEach((s) => {
    if (s.date === today) {
      hours += s.hours;
      orders += s.orders;
      gross += s.earnings;
      distanceKm += s.distanceKm;
    }
  });

  const fuel = distanceKm * settings.fuelCostPerKm;
  const net = gross - fuel;
  const hourly = hours > 0 ? net / hours : 0;

  todayHoursSpan.textContent = hours.toFixed(2) + " h";
  todayOrdersSpan.textContent = String(orders);
  todayGrossSpan.textContent = formatMoney(gross);
  todayFuelSpan.textContent = formatMoney(fuel);
  todayNetSpan.textContent = formatMoney(net);
  todayHourlySpan.textContent = formatMoney(hourly);

  updateStartStopUI();
}

// ---------- Days tab ----------
function renderDays() {
  const settings = loadSettings();
  const sessions = loadSessions();
  if (!sessions.length) {
    daysEmpty.classList.remove("hidden");
    daysTable.classList.add("hidden");
    return;
  }
  daysEmpty.classList.add("hidden");
  daysTable.classList.remove("hidden");

  const days = groupByDate(sessions, settings);
  daysBody.innerHTML = "";
  days.forEach((d) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${d.date}</td>
      <td>${d.hours.toFixed(2)} h</td>
      <td>${d.orders}</td>
      <td>${formatMoney(d.net)}</td>
      <td>${formatMoney(d.hourly)}</td>
      <td>
        <button class="btn-small btn-danger" data-date="${d.date}">Delete</button>
      </td>
    `;
    daysBody.appendChild(tr);
  });

  // handle delete buttons
  daysBody.querySelectorAll("button[data-date]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const date = btn.getAttribute("data-date");
      if (!confirm(`Delete ALL sessions for ${date}?`)) return;
      const all = loadSessions();
      const remaining = all.filter((s) => s.date !== date);
      saveSessions(remaining);
      renderToday();
      renderDays();
      renderSessions();
    });
  });
}

// ---------- Sessions tab ----------
function renderSessions() {
  const sessions = loadSessions().sort((a, b) => b.id - a.id);
  if (!sessions.length) {
    sessionsEmpty.classList.remove("hidden");
    sessionsTable.classList.add("hidden");
    return;
  }
  sessionsEmpty.classList.add("hidden");
  sessionsTable.classList.remove("hidden");

  sessionsBody.innerHTML = "";
  sessions.forEach((s) => {
    const tr = document.createElement("tr");
    const timeStr = `${s.startTime}–${s.endTime}`;
    tr.innerHTML = `
      <td>${s.date}</td>
      <td>${timeStr}</td>
      <td>${s.orders}</td>
      <td>${formatMoney(s.earnings)}</td>
      <td>${s.hours.toFixed(2)} h</td>
      <td>
        <button class="btn-small btn-secondary" data-edit="${s.id}">Edit</button>
        <button class="btn-small btn-danger" data-delete="${s.id}">Delete</button>
      </td>
    `;
    sessionsBody.appendChild(tr);
  });

  function openSessionEdit(id) {
  const sessions = loadSessions();
  const s = sessions.find((x) => x.id === id);
  if (!s) return;

  editIdInput.value = s.id;
  editDateInput.value = s.date;
  editStartTimeInput.value = s.startTime;
  editEndTimeInput.value = s.endTime;
  editOrdersInput.value = s.orders;
  editEarningsInput.value = s.earnings;
  editDistanceInput.value = s.distanceKm;

  sessionEditModal.classList.remove("hidden");
}

editCancelBtn.addEventListener("click", () => {
  sessionEditModal.classList.add("hidden");
});

sessionEditForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const id = Number(editIdInput.value);
  const settings = loadSettings();
  const sessions = loadSessions();
  const index = sessions.findIndex((s) => s.id === id);
  if (index === -1) {
    alert("Session not found");
    return;
  }

  const date = editDateInput.value;
  const startTime = editStartTimeInput.value;
  const endTime = editEndTimeInput.value;
  const orders = parseInt(editOrdersInput.value || "0", 10);
  const earnings = parseFloat(editEarningsInput.value || "0");
  const distanceKm = parseFloat(editDistanceInput.value || "0");

  if (!date || !startTime || !endTime) {
    alert("Please fill date and times");
    return;
  }

  // Rebuild ISO times using the edited date + times
  const startISO = new Date(`${date}T${startTime}:00`).toISOString();
  const endISO = new Date(`${date}T${endTime}:00`).toISOString();
  const hours = calcHoursFromISO(startISO, endISO);
  const fuelCost = distanceKm * settings.fuelCostPerKm;

  sessions[index] = {
    ...sessions[index],
    date,
    startISO,
    endISO,
    startTime,
    endTime,
    orders,
    earnings,
    distanceKm,
    hours,
    fuelCost
  };

  saveSessions(sessions);
  sessionEditModal.classList.add("hidden");
  renderToday();
  renderDays();
  renderSessions();
});


  // Edit buttons
  sessionsBody.querySelectorAll("button[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number(btn.getAttribute("data-edit"));
      openSessionEdit(id);
    });
  });

  // Delete buttons
  sessionsBody.querySelectorAll("button[data-delete]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number(btn.getAttribute("data-delete"));
      if (!confirm("Delete this session?")) return;
      const all = loadSessions();
      const remaining = all.filter((s) => s.id !== id);
      saveSessions(remaining);
      renderToday();
      renderDays();
      renderSessions();
    });
  });
}


// ---------- Settings + backup ----------
function initSettingsForm() {
  const s = loadSettings();
  fuelCostInput.value = s.fuelCostPerKm.toString();
}

settingsForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const fuelCost = parseFloat(fuelCostInput.value || "0");
  saveSettings({ fuelCostPerKm: isNaN(fuelCost) ? 0 : fuelCost });
  alert("Settings saved");
});

// Export JSON
function downloadJSON(data, filename) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

if (exportBtn) {
  exportBtn.addEventListener("click", () => {
    const sessions = loadSessions();
    const settings = loadSettings();
    const backup = { sessions, settings, createdAt: new Date().toISOString() };
    downloadJSON(backup, "courier-tracker-pro-backup.json");
  });
}

// Import JSON
if (importInput) {
  importInput.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const data = JSON.parse(e.target.result);
        if (!data || !Array.isArray(data.sessions) || !data.settings) {
          alert("Invalid backup file");
          return;
        }
        saveSessions(data.sessions);
        saveSettings(data.settings);
        clearCurrentSession();
        alert("Backup restored");
        renderToday();
        renderDays();
        renderSessions();
        initSettingsForm();
      } catch (err) {
        console.error(err);
        alert("Could not read backup file");
      }
    };
    reader.readAsText(file);
  });

  if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js");
}

}

// ---------- init ----------
initSettingsForm();
renderToday();
