const promptInput = document.getElementById("prompt");
const generateBtn = document.getElementById("generate-btn");
const progressPanel = document.getElementById("progress-panel");
const resultPanel = document.getElementById("results-panel");
const scriptTemplate = document.getElementById("script-template");

const overviewEl = document.getElementById("overview");
const systemsEl = document.getElementById("systems");
const scriptsEl = document.getElementById("scripts");
const uiPlanEl = document.getElementById("ui-plan");
const setupGuideEl = document.getElementById("setup-guide");

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function titleFromPrompt(prompt) {
  const match = prompt.match(/make\s+(an?\s+)?(.+?)\s+(tycoon|simulator)/i);
  if (match?.[2]) {
    return `${match[2]
      .replace(/[^a-zA-Z0-9 ]/g, "")
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase())} ${
      match[3][0].toUpperCase() + match[3].slice(1).toLowerCase()
    }`;
  }

  return "Custom Tycoon";
}

function detectFeatures(prompt) {
  const lower = prompt.toLowerCase();
  return {
    workers: /worker|staff|employee|hire/.test(lower),
    vip: /vip|gamepass|pass/.test(lower),
    rebirth: /rebirth|prestige/.test(lower),
    upgrades: /upgrade|tier|better/.test(lower),
  };
}

function buildPackage(prompt) {
  const features = detectFeatures(prompt);
  const title = titleFromPrompt(prompt);
  const theme = title.replace(/\s(Tycoon|Simulator)$/i, "");

  const systems = [
    "Tycoon ownership + claim pad",
    "Button purchase unlock flow",
    "Cash income and upgrades",
    "DataStore saving/loading",
  ];

  if (features.workers) systems.push("Worker system (hired NPC boosts income)");
  if (features.vip) systems.push("VIP gamepass multiplier + perks");
  if (features.rebirth) systems.push("Rebirth loop and permanent multiplier");

  const uiPlan = [
    "Top-left: Cash display + income per second",
    "Bottom-center: Purchase button prompt and cost",
    "Right panel: Upgrades/shop list",
    "Popup modal: Rebirth and VIP perks",
  ];

  const setup = [
    "Open Roblox Studio and create a new Baseplate project.",
    "In Workspace, add a Folder named 'Tycoon' and create Parts: ClaimPad, PurchaseButton, and Dropper.",
    "In ReplicatedStorage, add a Folder named 'Remotes' with RemoteEvent 'RequestPurchase'.",
    "Create a Script named 'TycoonHandler' in ServerScriptService and paste TycoonHandler.lua.",
    "Create a Script named 'MoneySystem' in ServerScriptService and paste MoneySystem.lua.",
    "Create a Script named 'ButtonPurchase' in ServerScriptService and paste ButtonPurchase.lua.",
    "Create a LocalScript named 'HUDController' in StarterPlayerScripts for cash + shop UI bindings.",
    "Press Play, claim the tycoon, buy a button, and verify cash saves after leaving/rejoining.",
  ];

  const scripts = [
    {
      name: "MoneySystem.lua",
      body: `local Players = game:GetService("Players")
local DataStoreService = game:GetService("DataStoreService")

local MoneyStore = DataStoreService:GetDataStore("TycoonCash_v1")
local DEFAULT_CASH = 100

local function setCash(player, amount)
  local stats = player:FindFirstChild("leaderstats")
  if not stats then return end
  local cash = stats:FindFirstChild("Cash")
  if cash then cash.Value = amount end
end

Players.PlayerAdded:Connect(function(player)
  local leaderstats = Instance.new("Folder")
  leaderstats.Name = "leaderstats"
  leaderstats.Parent = player

  local cash = Instance.new("IntValue")
  cash.Name = "Cash"
  cash.Value = DEFAULT_CASH
  cash.Parent = leaderstats

  local ok, data = pcall(function()
    return MoneyStore:GetAsync(player.UserId)
  end)

  if ok and type(data) == "number" then
    setCash(player, data)
  end
end)

Players.PlayerRemoving:Connect(function(player)
  local stats = player:FindFirstChild("leaderstats")
  local cash = stats and stats:FindFirstChild("Cash")
  if not cash then return end

  pcall(function()
    MoneyStore:SetAsync(player.UserId, cash.Value)
  end)
end)`,
    },
    {
      name: "TycoonHandler.lua",
      body: `local Workspace = game:GetService("Workspace")

local TycoonFolder = Workspace:WaitForChild("Tycoon")
local ClaimPad = TycoonFolder:WaitForChild("ClaimPad")
local ownerId = nil

ClaimPad.Touched:Connect(function(hit)
  if ownerId then return end

  local player = game.Players:GetPlayerFromCharacter(hit.Parent)
  if not player then return end

  ownerId = player.UserId
  ClaimPad.BrickColor = BrickColor.new("Lime green")
  ClaimPad.Name = player.Name .. "_ClaimedPad"
end)

function _G.GetTycoonOwnerId()
  return ownerId
end`,
    },
    {
      name: "ButtonPurchase.lua",
      body: `local ReplicatedStorage = game:GetService("ReplicatedStorage")

local RequestPurchase = ReplicatedStorage:WaitForChild("Remotes"):WaitForChild("RequestPurchase")

local COST = 150
local BASE_INCOME = 5
local workerMultiplier = ${features.workers ? "2" : "1"}
local vipMultiplier = ${features.vip ? "1.5" : "1"}
local rebirthMultiplier = ${features.rebirth ? "1.2" : "1"}

RequestPurchase.OnServerEvent:Connect(function(player)
  local stats = player:FindFirstChild("leaderstats")
  local cash = stats and stats:FindFirstChild("Cash")
  if not cash then return end

  if cash.Value < COST then return end

  cash.Value -= COST
  local incomeGain = math.floor(BASE_INCOME * workerMultiplier * vipMultiplier * rebirthMultiplier)
  cash.Value += incomeGain
end)`,
    },
  ];

  return {
    title,
    overview: [
      `${theme}: perform actions to generate cash and expand your production line.`,
      "Core Loop: interact with droppers → earn money → buy tycoon buttons → unlock better income.",
      `Progression: ${features.upgrades ? "tiered upgrades with stronger outputs" : "linear button unlock path"}.`,
      "Monetization: starter gamepasses (2x cash, VIP area access, auto-collect).",
    ],
    systems,
    scripts,
    uiPlan,
    setup,
  };
}

async function runProgress() {
  progressPanel.classList.remove("hidden");
  const steps = Array.from(progressPanel.querySelectorAll("li"));

  for (const step of steps) {
    step.classList.remove("done");
    step.classList.add("active");
    await wait(450);
    step.classList.remove("active");
    step.classList.add("done");
  }
}

function renderPackage(pkg) {
  resultPanel.classList.remove("hidden");

  overviewEl.innerHTML = `
    <h4>${pkg.title}</h4>
    <ul>${pkg.overview.map((item) => `<li>${item}</li>`).join("")}</ul>
  `;

  systemsEl.innerHTML = pkg.systems.map((item) => `<li>${item}</li>`).join("");
  uiPlanEl.innerHTML = pkg.uiPlan.map((item) => `<li>${item}</li>`).join("");
  setupGuideEl.innerHTML = pkg.setup.map((item) => `<li>${item}</li>`).join("");

  scriptsEl.innerHTML = "";
  pkg.scripts.forEach((script) => {
    const node = scriptTemplate.content.cloneNode(true);
    const titleEl = node.querySelector("h4");
    const codeEl = node.querySelector("code");
    const copyBtn = node.querySelector(".copy-btn");

    titleEl.textContent = script.name;
    codeEl.textContent = script.body;

    copyBtn.addEventListener("click", async () => {
      await navigator.clipboard.writeText(script.body);
      copyBtn.textContent = "Copied!";
      setTimeout(() => {
        copyBtn.textContent = "Copy";
      }, 1200);
    });

    scriptsEl.appendChild(node);
  });
}

generateBtn.addEventListener("click", async () => {
  const prompt = promptInput.value.trim();
  if (!prompt) {
    promptInput.focus();
    return;
  }

  resultPanel.classList.add("hidden");
  await runProgress();
  const gamePackage = buildPackage(prompt);
  renderPackage(gamePackage);
});
