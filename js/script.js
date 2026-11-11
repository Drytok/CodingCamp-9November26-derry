/* Expense & Budget Visualizer
 * Vanilla JavaScript, data saved in the browser with Local Storage.
 * Optional challenges included: custom categories, sort transactions, spending limit,
 * dark/light mode (4 challenges).
 */

/* ---------- Constants ---------- */
const STORAGE_KEYS = {
  transactions: "ebv.transactions",
  limit: "ebv.limit",
  theme: "ebv.theme",
  categories: "ebv.categories",
};

const DEFAULT_CATEGORIES = ["Food", "Transport", "Fun"];

const DEFAULT_COLORS = {
  Food: "#2fa36b",
  Transport: "#2a7fba",
  Fun: "#e8892b",
};

// Colors handed out to custom categories, in the order they were added.
const CUSTOM_PALETTE = [
  "#8e5ac8", "#d1495b", "#2ab3a6", "#c9a227",
  "#e56fa0", "#5c6bc0", "#7a8b3c", "#a0522d",
];

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

/* ---------- State ---------- */
let transactions = loadJSON(STORAGE_KEYS.transactions, []);
let customCategories = loadJSON(STORAGE_KEYS.categories, []);
let spendingLimit = Number(loadJSON(STORAGE_KEYS.limit, 0)) || 0;
let chart = null;

/* ---------- DOM references ---------- */
const form = document.getElementById("transaction-form");
const nameInput = document.getElementById("item-name");
const amountInput = document.getElementById("item-amount");
const categoryInput = document.getElementById("item-category");
const formError = document.getElementById("form-error");
const newCategoryInput = document.getElementById("new-category");
const addCategoryButton = document.getElementById("add-category");

const balanceCard = document.getElementById("balance-card");
const balanceAmount = document.getElementById("balance-amount");
const limitInput = document.getElementById("limit-input");
const limitMeter = document.getElementById("limit-meter");
const limitFill = document.getElementById("limit-fill");
const limitMessage = document.getElementById("limit-message");

const list = document.getElementById("transaction-list");
const listEmpty = document.getElementById("list-empty");
const sortSelect = document.getElementById("sort-select");

const chartCanvas = document.getElementById("category-chart");
const chartWrap = chartCanvas.parentElement;
const chartEmpty = document.getElementById("chart-empty");

const themeToggle = document.getElementById("theme-toggle");

/* ---------- Local Storage helpers ---------- */
function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error("Could not save to Local Storage:", error);
  }
}

/* ---------- Categories ---------- */
function getAllCategories() {
  return [...DEFAULT_CATEGORIES, ...customCategories];
}

function colorFor(category) {
  if (DEFAULT_COLORS[category]) return DEFAULT_COLORS[category];
  const index = customCategories.indexOf(category);
  return CUSTOM_PALETTE[(index >= 0 ? index : 0) % CUSTOM_PALETTE.length];
}

function renderCategoryOptions(selected) {
  categoryInput.replaceChildren();

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Choose a category";
  categoryInput.appendChild(placeholder);

  getAllCategories().forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categoryInput.appendChild(option);
  });

  categoryInput.value = selected || "";
}

function addCategory() {
  const name = newCategoryInput.value.trim();

  if (!name) {
    formError.textContent = "Type a category name first.";
    return;
  }

  const exists = getAllCategories().some(
    (category) => category.toLowerCase() === name.toLowerCase()
  );
  if (exists) {
    formError.textContent = "That category already exists.";
    return;
  }

  customCategories.push(name);
  saveJSON(STORAGE_KEYS.categories, customCategories);
  formError.textContent = "";
  newCategoryInput.value = "";
  renderCategoryOptions(name); // select the new category right away
}

addCategoryButton.addEventListener("click", addCategory);
newCategoryInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault(); // do not submit the transaction form
    addCategory();
  }
});

/* ---------- Calculations ---------- */
function getTotal() {
  return transactions.reduce((sum, item) => sum + item.amount, 0);
}

function getTotalsByCategory() {
  const totals = {};
  transactions.forEach((item) => {
    totals[item.category] = (totals[item.category] || 0) + item.amount;
  });
  return totals;
}

function getSortedTransactions() {
  const sorted = [...transactions];
  switch (sortSelect.value) {
    case "amount-desc":
      return sorted.sort((a, b) => b.amount - a.amount);
    case "amount-asc":
      return sorted.sort((a, b) => a.amount - b.amount);
    case "category":
      return sorted.sort((a, b) => a.category.localeCompare(b.category));
    default: // newest first
      return sorted.sort((a, b) => b.id - a.id);
  }
}

/* ---------- Rendering ---------- */
function renderBalance() {
  const total = getTotal();
  balanceAmount.textContent = currency.format(total);

  const hasLimit = spendingLimit > 0;
  limitMeter.hidden = !hasLimit;
  balanceCard.classList.remove("over-limit");

  if (!hasLimit) {
    limitMessage.textContent = "";
    return;
  }

  const percent = Math.min((total / spendingLimit) * 100, 100);
  limitFill.style.width = percent + "%";

  if (total > spendingLimit) {
    balanceCard.classList.add("over-limit");
    limitMessage.textContent =
      "Over your limit by " + currency.format(total - spendingLimit);
  } else {
    limitMessage.textContent =
      currency.format(spendingLimit - total) + " left before your limit";
  }
}

function renderList() {
  list.replaceChildren();
  listEmpty.hidden = transactions.length > 0;

  getSortedTransactions().forEach((item) => {
    const li = document.createElement("li");
    li.className = "transaction-item";

    const info = document.createElement("div");
    info.className = "transaction-info";

    const name = document.createElement("p");
    name.className = "transaction-name";
    name.textContent = item.name;

    const amount = document.createElement("p");
    amount.className = "transaction-amount";
    amount.textContent = currency.format(item.amount);

    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = item.category;
    badge.style.setProperty("--badge", colorFor(item.category));

    info.append(name, amount, badge);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "btn btn-delete";
    deleteButton.textContent = "Delete";
    deleteButton.setAttribute("aria-label", "Delete " + item.name);
    deleteButton.addEventListener("click", () => deleteTransaction(item.id));

    li.append(info, deleteButton);
    list.appendChild(li);
  });
}

function themeColors() {
  const styles = getComputedStyle(document.documentElement);
  return {
    text: styles.getPropertyValue("--ink").trim(),
    surface: styles.getPropertyValue("--surface").trim(),
  };
}

function renderChart() {
  if (typeof Chart === "undefined") {
    chartWrap.hidden = true;
    chartEmpty.hidden = false;
    chartEmpty.textContent = "Chart could not load. Check your internet connection.";
    return;
  }

  const totals = getTotalsByCategory();
  const labels = Object.keys(totals);
  const hasData = labels.length > 0;

  chartWrap.hidden = !hasData;
  chartEmpty.hidden = hasData;

  if (!hasData) {
    if (chart) {
      chart.destroy();
      chart = null;
    }
    return;
  }

  const colors = themeColors();
  const data = labels.map((label) => totals[label]);
  const backgrounds = labels.map((label) => colorFor(label));

  if (chart) {
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.data.datasets[0].backgroundColor = backgrounds;
    chart.data.datasets[0].borderColor = colors.surface;
    chart.options.plugins.legend.labels.color = colors.text;
    chart.update();
    return;
  }

  chart = new Chart(chartCanvas, {
    type: "pie",
    data: {
      labels: labels,
      datasets: [
        {
          data: data,
          backgroundColor: backgrounds,
          borderColor: colors.surface,
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: colors.text, font: { family: "Figtree" } },
        },
        tooltip: {
          callbacks: {
            label: (context) =>
              " " + context.label + ": " + currency.format(context.parsed),
          },
        },
      },
    },
  });
}

function renderAll() {
  renderBalance();
  renderList();
  renderChart();
}

/* ---------- Actions ---------- */
function addTransaction(name, amount, category) {
  transactions.push({ id: Date.now(), name, amount, category });
  saveJSON(STORAGE_KEYS.transactions, transactions);
  renderAll();
}

function deleteTransaction(id) {
  transactions = transactions.filter((item) => item.id !== id);
  saveJSON(STORAGE_KEYS.transactions, transactions);
  renderAll();
}

/* ---------- Form handling ---------- */
form.addEventListener("submit", (event) => {
  event.preventDefault();

  const name = nameInput.value.trim();
  const amount = parseFloat(amountInput.value);
  const category = categoryInput.value;

  if (!name || amountInput.value === "" || !category) {
    formError.textContent = "Please fill in the item name, amount, and category.";
    return;
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    formError.textContent = "Amount must be a number greater than 0.";
    return;
  }

  formError.textContent = "";
  addTransaction(name, Math.round(amount * 100) / 100, category);
  form.reset();
  nameInput.focus();
});

/* ---------- Sort ---------- */
sortSelect.addEventListener("change", renderList);

/* ---------- Spending limit ---------- */
limitInput.value = spendingLimit > 0 ? spendingLimit : "";

limitInput.addEventListener("input", () => {
  const value = parseFloat(limitInput.value);
  spendingLimit = Number.isFinite(value) && value > 0 ? value : 0;
  saveJSON(STORAGE_KEYS.limit, spendingLimit);
  renderBalance();
});

/* ---------- Dark / light mode ---------- */
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const isDark = theme === "dark";
  themeToggle.textContent = isDark ? "Light mode" : "Dark mode";
  themeToggle.setAttribute(
    "aria-label",
    isDark ? "Switch to light mode" : "Switch to dark mode"
  );
  renderChart(); // refresh chart text and border colors
}

themeToggle.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  saveJSON(STORAGE_KEYS.theme, next);
  applyTheme(next);
});

/* ---------- Start ---------- */
(function init() {
  const saved = loadJSON(STORAGE_KEYS.theme, null);
  const prefersDark =
    window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.setAttribute(
    "data-theme",
    saved || (prefersDark ? "dark" : "light")
  );
  applyTheme(document.documentElement.getAttribute("data-theme"));
  renderCategoryOptions();
  renderAll();
})();
