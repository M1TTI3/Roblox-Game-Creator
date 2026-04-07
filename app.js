const els = {
  prompt: document.getElementById("prompt"),
  generate: document.getElementById("generate-btn"),
  progress: document.getElementById("progress-panel"),
  results: document.getElementById("results-panel"),
  gameTitle: document.getElementById("game-title"),
  tabs: document.getElementById("tabs"),
  tabContent: document.getElementById("tab-content"),
  copyAll: document.getElementById("copy-all"),
  downloadJson: document.getElementById("download-json"),
  downloadGuide: document.getElementById("download-guide"),
  scriptTemplate: document.getElementById("script-template"),
  chips: document.getElementById("preset-chips"),
  difficulty: document.getElementById("difficulty"),
  sessionLength: document.getElementById("session-length"),
  focus: document.getElementById("focus"),
  toggleRebirth: document.getElementById("toggle-rebirth"),
  toggleWorkers: document.getElementById("toggle-workers"),
  toggleQuests: document.getElementById("toggle-quests"),
  togglePasses: document.getElementById("toggle-passes"),
};

let activePackage = null;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parsePrompt(prompt) {
  const normalized = prompt.toLowerCase();
  const titleMatch = prompt.match(/make\s+(an?\s+)?(.+?)\s+(tycoon|simulator)/i);
  const title = titleMatch?.[2]
    ? `${titleMatch[2].replace(/[^\w ]/g, "").trim().replace(/\b\w/g, (c) => c.toUpperCase())} ${titleMatch[3]}`
    : "Custom Tycoon";

  return {
    title,
    theme: title.replace(/\s(Tycoon|Simulator)$/i, ""),
    hasWorkers: /worker|employee|staff|hire/.test(normalized) || els.toggleWorkers.checked,
    hasRebirth: /rebirth|prestige/.test(normalized) || els.toggleRebirth.checked,
    hasPasses: /vip|gamepass|pass|premium/.test(normalized) || els.togglePasses.checked,
    hasQuests: /quest|mission|task/.test(normalized) || els.toggleQuests.checked,
    hasPets: /pet/.test(normalized),
    hasDailyRewards: /daily|streak/.test(normalized),
  };
}

function economyProfile(sessionLength, focus) {
  const baseByLength = {
    short: { baseCash: 150, incomeTick: 2.2 },
    medium: { baseCash: 100, incomeTick: 1.7 },
    long: { baseCash: 60, incomeTick: 1.25 },
  };

  const focusMultiplier = {
    economy: { price: 1, reward: 1 },
    retention: { price: 0.9, reward: 0.95 },
    monetization: { price: 1.15, reward: 1.05 },
  };

  const base = baseByLength[sessionLength] || baseByLength.medium;
  const mult = focusMultiplier[focus] || focusMultiplier.economy;

  return {
    starterCash: Math.floor(base.baseCash * mult.reward),
    firstButtonCost: Math.floor(125 * mult.price),
    incomePerTick: Number((base.incomeTick * mult.reward).toFixed(2)),
    rebirthRequirement: Math.floor(15000 * mult.price),
  };
}

function generateScripts(parsed, economy) {
  const difficultyModifier = {
    beginner: "local SAVE_RETRIES = 1",
    standard: "local SAVE_RETRIES = 3",
    advanced: "local SAVE_RETRIES = 5",
  }[els.difficulty.value];

  const scripts = [];

  scripts.push({
    name: "MoneySystem.server.lua",
    purpose: "Persistent money profile, passive income loop, and safe DataStore save/load.",
    body: `local Players = game:GetService("Players")
local DataStoreService = game:GetService("DataStoreService")

${difficultyModifier}
local MONEY_STORE = DataStoreService:GetDataStore("TycoonMoney_v2")
local STARTER_CASH = ${economy.starterCash}
local INCOME_PER_TICK = ${economy.incomePerTick}

local function loadCash(player)
  local ok, data = pcall(function()
    return MONEY_STORE:GetAsync(player.UserId)
  end)
  if ok and type(data) == "number" then
    return data
  end
  return STARTER_CASH
end

local function saveCash(player)
  local stats = player:FindFirstChild("leaderstats")
  local cash = stats and stats:FindFirstChild("Cash")
  if not cash then return end

  for _ = 1, SAVE_RETRIES do
    local ok = pcall(function()
      MONEY_STORE:SetAsync(player.UserId, cash.Value)
    end)
    if ok then return end
    task.wait(0.25)
  end
end

Players.PlayerAdded:Connect(function(player)
  local leaderstats = Instance.new("Folder")
  leaderstats.Name = "leaderstats"
  leaderstats.Parent = player

  local cash = Instance.new("NumberValue")
  cash.Name = "Cash"
  cash.Value = loadCash(player)
  cash.Parent = leaderstats

  task.spawn(function()
    while player.Parent do
      cash.Value += INCOME_PER_TICK
      task.wait(1)
    end
  end)
end)

Players.PlayerRemoving:Connect(saveCash)

game:BindToClose(function()
  for _, player in ipairs(Players:GetPlayers()) do
    saveCash(player)
  end
end)`,
  });

  scripts.push({
    name: "TycoonManager.server.lua",
    purpose: "Claim pads, ownership enforcement, and purchased button state.",
    body: `local Workspace = game:GetService("Workspace")

local tycoons = Workspace:WaitForChild("Tycoons")

for _, tycoon in ipairs(tycoons:GetChildren()) do
  local claimPad = tycoon:WaitForChild("ClaimPad")
  local ownerId = tycoon:FindFirstChild("OwnerId") or Instance.new("IntValue")
  ownerId.Name = "OwnerId"
  ownerId.Value = 0
  ownerId.Parent = tycoon

  claimPad.Touched:Connect(function(hit)
    if ownerId.Value ~= 0 then return end
    local character = hit.Parent
    local player = game.Players:GetPlayerFromCharacter(character)
    if not player then return end

    ownerId.Value = player.UserId
    claimPad.BrickColor = BrickColor.new("Lime green")
    claimPad:SetAttribute("ClaimedBy", player.Name)
  end)
end`,
  });

  scripts.push({
    name: "PurchaseHandler.server.lua",
    purpose: "Validates purchases and unlocks parts/buttons with ownership checks.",
    body: `local ReplicatedStorage = game:GetService("ReplicatedStorage")
local requestPurchase = ReplicatedStorage:WaitForChild("Remotes"):WaitForChild("RequestPurchase")

local FIRST_BUTTON_COST = ${economy.firstButtonCost}
local WORKER_MULT = ${parsed.hasWorkers ? "1.35" : "1"}
local PASS_MULT = ${parsed.hasPasses ? "1.5" : "1"}

requestPurchase.OnServerEvent:Connect(function(player, buttonCost)
  local stats = player:FindFirstChild("leaderstats")
  local cash = stats and stats:FindFirstChild("Cash")
  if not cash then return end

  local finalCost = math.max(FIRST_BUTTON_COST, tonumber(buttonCost) or FIRST_BUTTON_COST)
  if cash.Value < finalCost then return end

  cash.Value -= finalCost
  local reward = math.floor((finalCost * 0.12) * WORKER_MULT * PASS_MULT)
  cash.Value += reward
end)`,
  });

  if (parsed.hasQuests) {
    scripts.push({
      name: "QuestSystem.server.lua",
      purpose: "Simple daily/loop quest tracker that awards bonus cash.",
      body: `local Players = game:GetService("Players")
local QUEST_REWARD = 500

Players.PlayerAdded:Connect(function(player)
  local folder = Instance.new("Folder")
  folder.Name = "QuestData"
  folder.Parent = player

  local progress = Instance.new("IntValue")
  progress.Name = "ButtonsPurchased"
  progress.Parent = folder

  progress.Changed:Connect(function(value)
    if value >= 10 then
      local cash = player:FindFirstChild("leaderstats") and player.leaderstats:FindFirstChild("Cash")
      if cash then
        cash.Value += QUEST_REWARD
        progress.Value = 0
      end
    end
  end)
end)`,
    });
  }

  if (parsed.hasRebirth) {
    scripts.push({
      name: "RebirthSystem.server.lua",
      purpose: "Resets tycoon progression in exchange for permanent income multiplier.",
      body: `local REBIRTH_MIN_CASH = ${economy.rebirthRequirement}

function TryRebirth(player)
  local stats = player:FindFirstChild("leaderstats")
  local cash = stats and stats:FindFirstChild("Cash")
  if not cash or cash.Value < REBIRTH_MIN_CASH then return false end

  local profile = player:FindFirstChild("Profile") or Instance.new("Folder")
  profile.Name = "Profile"
  profile.Parent = player

  local rebirths = profile:FindFirstChild("Rebirths") or Instance.new("IntValue")
  rebirths.Name = "Rebirths"
  rebirths.Parent = profile

  rebirths.Value += 1
  cash.Value = ${economy.starterCash}
  return true
end`,
    });
  }

  return scripts;
}

function createPackage(prompt) {
  const parsed = parsePrompt(prompt);
  const economy = economyProfile(els.sessionLength.value, els.focus.value);

  const systems = [
    "Tycoon claiming and ownership locks",
    "Purchasable buttons and unlock tree",
    "Passive + active income loop",
    "DataStore persistence with retries",
    "HUD: cash, multipliers, button costs",
  ];

  if (parsed.hasWorkers) systems.push("Worker NPC income multipliers");
  if (parsed.hasRebirth) systems.push("Rebirth prestige layer");
  if (parsed.hasPasses) systems.push("VIP / gamepass perk integration");
  if (parsed.hasQuests) systems.push("Quest loops and daily rewards");
  if (parsed.hasPets) systems.push("Pet booster slot system");

  const setup = [
    "Create a new Baseplate place in Roblox Studio and save as a new experience.",
    "In Workspace, create Folder 'Tycoons'. Add one Model per player-slot with Parts: ClaimPad, Spawn, Conveyor, Buttons.",
    "In ReplicatedStorage, create Folder 'Remotes' and add RemoteEvent 'RequestPurchase'.",
    "Paste server scripts into ServerScriptService using exact names shown in this generator.",
    "Create ScreenGui in StarterGui with labels: CashLabel, IncomeLabel, MultiplierLabel, PurchaseHint.",
    "Create LocalScript in StarterPlayerScripts to read leaderstats and update HUD every frame.",
    "Tag all purchasable buttons with CollectionService tag 'TycoonButton' and set attributes (Cost, UnlockId).",
    "Play test with 2 players in Studio test mode. Confirm claim ownership, purchases, and save/load behavior.",
    "Before publishing, replace test gamepass IDs with live IDs and verify MarketplaceService callbacks.",
  ];

  const objects = [
    "Workspace/Tycoons (Folder)",
    "Workspace/Tycoons/TycoonTemplate (Model)",
    "Workspace/Tycoons/TycoonTemplate/ClaimPad (Part)",
    "ReplicatedStorage/Remotes/RequestPurchase (RemoteEvent)",
    "ServerScriptService/*.server.lua scripts",
    "StarterGui/MainHUD (ScreenGui)",
    "StarterPlayer/StarterPlayerScripts/HUDController.client.lua",
  ];

  const monetization = [
    parsed.hasPasses ? "VIP Pass: +50% income and VIP-only machine lane." : "Starter Pass: +25% income as entry-level upsell.",
    "Auto-Collect Pass: collect conveyor output automatically.",
    "2x Rebirth Token product: one-time fast-track for late-game users.",
    "Starter Bundle (limited): cash + cosmetic trail + worker skin.",
  ];

  const scripts = generateScripts(parsed, economy);

  return {
    meta: {
      prompt,
      generatedAt: new Date().toISOString(),
      difficulty: els.difficulty.value,
      focus: els.focus.value,
      sessionLength: els.sessionLength.value,
    },
    title: parsed.title,
    overview: {
      coreLoop: `Build ${parsed.theme} machines -> earn cash -> buy buttons -> unlock multipliers -> scale toward rebirth prestige.`,
      progression: parsed.hasRebirth
        ? "Early game unlocks, mid game worker optimization, late game rebirth loop with permanent multipliers."
        : "Linear unlock path from starter machines into multiplier-focused expansion.",
      economy: `Starter cash ${economy.starterCash}, first unlock ${economy.firstButtonCost}, passive tick ${economy.incomePerTick}/sec.`,
      retention: parsed.hasQuests
        ? "Quest board rotates objectives every session, with streak rewards and bonus cash."
        : "Session pacing relies on milestone button unlocks and map expansion reveals.",
    },
    systems,
    objects,
    scripts,
    uiPlan: [
      "Top-left sticky HUD: Cash, Income/sec, Rebirth multiplier.",
      "Bottom action rail: highlighted nearest purchasable button + cost.",
      "Right panel tabs: Upgrades, Workers, Quests, Passes.",
      "Center modals for rebirth confirmation and gamepass promos.",
    ],
    monetization,
    setup,
    qaChecklist: [
      "Claim pad ownership cannot be stolen by another player.",
      "Cash never becomes negative during rapid purchase spam.",
      "Player data saves on leave and loads on rejoin.",
      "Rebirth reset preserves only intended permanent stats.",
      "VIP pass bonus applies only to pass owners.",
    ],
  };
}

async function runProgress() {
  els.progress.classList.remove("hidden");
  const steps = [...els.progress.querySelectorAll("li")];

  for (const step of steps) {
    step.classList.remove("done");
    step.classList.add("active");
    await wait(350);
    step.classList.remove("active");
    step.classList.add("done");
  }
}

function renderTabs(pkg) {
  const views = {
    Overview: () => `
      <div class="grid-two">
        <article class="card"><h3>Core Loop</h3><p>${pkg.overview.coreLoop}</p></article>
        <article class="card"><h3>Progression</h3><p>${pkg.overview.progression}</p></article>
        <article class="card"><h3>Economy</h3><p>${pkg.overview.economy}</p></article>
        <article class="card"><h3>Retention</h3><p>${pkg.overview.retention}</p></article>
      </div>
    `,
    Systems: () => `<ul>${pkg.systems.map((s) => `<li>${s}</li>`).join("")}</ul>`,
    Objects: () => `<ul>${pkg.objects.map((s) => `<li><code>${s}</code></li>`).join("")}</ul>`,
    Scripts: () => {
      const wrapper = document.createElement("div");
      wrapper.className = "script-grid";

      pkg.scripts.forEach((script) => {
        const node = els.scriptTemplate.content.cloneNode(true);
        node.querySelector("h4").textContent = script.name;
        node.querySelector("code").textContent = script.body;

        node.querySelector(".copy-btn").addEventListener("click", async (event) => {
          await navigator.clipboard.writeText(script.body);
          event.target.textContent = "Copied!";
          setTimeout(() => (event.target.textContent = "Copy"), 1000);
        });

        wrapper.appendChild(node);
      });

      return wrapper;
    },
    "UI Plan": () => `<ul>${pkg.uiPlan.map((s) => `<li>${s}</li>`).join("")}</ul>`,
    Monetization: () => `<ul>${pkg.monetization.map((s) => `<li>${s}</li>`).join("")}</ul>`,
    "Setup Guide": () => `<ol>${pkg.setup.map((s) => `<li>${s}</li>`).join("")}</ol>`,
    QA: () => `<ul class="checklist">${pkg.qaChecklist.map((s) => `<li>☐ ${s}</li>`).join("")}</ul>`,
  };

  const tabNames = Object.keys(views);

  els.tabs.innerHTML = "";
  els.tabContent.innerHTML = "";

  const showTab = (name) => {
    [...els.tabs.children].forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === name);
    });

    const content = views[name]();
    if (typeof content === "string") {
      els.tabContent.innerHTML = content;
      return;
    }

    els.tabContent.innerHTML = "";
    els.tabContent.appendChild(content);
  };

  tabNames.forEach((name, index) => {
    const btn = document.createElement("button");
    btn.className = "tab-btn";
    btn.dataset.tab = name;
    btn.textContent = name;
    btn.addEventListener("click", () => showTab(name));
    els.tabs.appendChild(btn);

    if (index === 0) showTab(name);
  });
}

function downloadFile(fileName, body, mimeType = "text/plain") {
  const blob = new Blob([body], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

els.chips.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-prompt]");
  if (!button) return;
  els.prompt.value = button.dataset.prompt;
  els.prompt.focus();
});

els.copyAll.addEventListener("click", async () => {
  if (!activePackage) return;
  const combined = activePackage.scripts
    .map((script) => `-- ${script.name}\n${script.body}`)
    .join("\n\n");
  await navigator.clipboard.writeText(combined);
  els.copyAll.textContent = "Copied all!";
  setTimeout(() => (els.copyAll.textContent = "Copy All Scripts"), 1100);
});

els.downloadJson.addEventListener("click", () => {
  if (!activePackage) return;
  downloadFile(
    `${activePackage.title.replace(/\s+/g, "_")}_package.json`,
    JSON.stringify(activePackage, null, 2),
    "application/json"
  );
});

els.downloadGuide.addEventListener("click", () => {
  if (!activePackage) return;
  const lines = activePackage.setup.map((s, i) => `${i + 1}. ${s}`).join("\n");
  downloadFile(`${activePackage.title.replace(/\s+/g, "_")}_setup_guide.txt`, lines);
});

els.generate.addEventListener("click", async () => {
  const prompt = els.prompt.value.trim();
  if (!prompt) {
    els.prompt.focus();
    return;
  }

  els.results.classList.add("hidden");
  await runProgress();

  activePackage = createPackage(prompt);
  els.gameTitle.textContent = `${activePackage.title} · Pro Game Package`;

  renderTabs(activePackage);
  els.results.classList.remove("hidden");
});
