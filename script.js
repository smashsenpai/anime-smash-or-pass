// 🔥 IMPORTS (must be at top)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, increment, runTransaction
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// 🔥 FIREBASE CONFIGS
const liveConfig = {
  apiKey: "AIzaSyDNRa8_noLXsg1n591GexonnK733nZxa6M",
  authDomain: "animevoteapp.firebaseapp.com",
  projectId: "animevoteapp",
  storageBucket: "animevoteapp.appspot.com",
  messagingSenderId: "202781686417",
  appId: "1:202781686417:web:eb6bf936d2d9f73d6c5d30",
  measurementId: "G-CKL3026K7X"
};
const testConfig = {
  apiKey: "AIzaSyB4q2XirztsJOO5RvyYnMEPs7_3e13OaIE",
  authDomain: "anime-vote-leaderboard.firebaseapp.com",
  projectId: "anime-vote-leaderboard",
  storageBucket: "anime-vote-leaderboard.appspot.com",
  messagingSenderId: "153651694103",
  appId: "1:153651694103:web:dcee9781f4129fa04faa52",
  measurementId: "G-0QC1NNRH1T"
};
const useTest = true; // set to true for test project
const firebaseConfig = useTest ? testConfig : liveConfig;

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
// ===============================
// 🧠 VOTE BATCHING SYSTEM
// ===============================
import { writeBatch } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const voteBuffer = {};
let bufferedVotesCount = 0;
const FLUSH_LIMIT = 10;

// ⏱️ AUTO LEADERBOARD UPDATE (1 DAY)
const LEADERBOARD_UPDATE_DAYS = 1;


// Characters will be loaded from characters.json
let characters = { boys: [], girls: [], other: [] };

/**
 * formatName(raw)
 * Converts JSON name like "satoru_gojo" or "satoru gojo" to "Satoru Gojo"
 */
function formatName(raw) {
  if (!raw) return "";
  // replace underscores and multiple spaces with single space, trim
  const spaced = raw.replace(/_/g, " ").replace(/\s+/g, " ").trim();
  // title-case each word but keep existing capitalization for words that already have it
  return spaced.split(" ").map(w => {
    if (w.length === 0) return w;
    return w[0].toUpperCase() + w.slice(1);
  }).join(" ");
}

// Load JSON file (characters.json) and build characters arrays
async function loadCharacters() {
  try {
    const res = await fetch("characters.json");
    if (!res.ok) throw new Error("Failed to fetch characters.json: " + res.status);
    const data = await res.json();

    // reset arrays
    characters = { boys: [], girls: [], other: [] };

    data.forEach(c => {
      // Some JSON entries may already have underscores. Normalize id to use underscores without spaces.
      const rawName = c.name || "";
      const id = rawName.replace(/\s+/g, "_").replace(/__+/g, "_");
      // You said your image files are .jpg — if some files differ, you'll need to update this logic or provide full image paths in JSON.
      const ext = ".jpg";
      const fileName = id + ext;

      const genderRaw = (c.gender || "").toString().toLowerCase();
      const gender = genderRaw === "male" ? "boy" :
                     genderRaw === "female" ? "girl" : "other";

      const charObj = {
        id,
        // store raw name from JSON (underscored) but keep it so we can format for display
        name: rawName,
        anime: c.anime || "",
        gender,
        image: `images/${fileName}`
      };

      if (gender === "boy") characters.boys.push(charObj);
      else if (gender === "girl") characters.girls.push(charObj);
      else characters.other.push(charObj);
    });

    console.log(`✅ Loaded ${characters.boys.length} boys, ${characters.girls.length} girls, ${characters.other.length} others.`);
  } catch (err) {
    console.error("Error loading characters.json:", err);
    alert("Could not load characters.json — open browser console for details.");
  }
}

// --- State ---
let currentGroup = [];
let currentIndex = 0;
let dailyPool = [];
let dailyRoundSize = 16;
let dailyIndex = 0;
let dailyWinners = [];
let dailyGender = "";


// DOM references (will be set in init)
let gameArea, boyBtn, girlBtn, bothBtn, musicToggle, bgMusic;
function getDailyStateKey(gender) {
  return `daily_state_${gender}_${getTodayUTC()}`;
}

function saveDailyState() {
  localStorage.setItem(
    getDailyStateKey(dailyGender),
    JSON.stringify({
      dailyPool,
      dailyIndex,
      dailyWinners,
      dailyGender,
      date: getTodayUTC()
    })
  );
}

function loadDailyState(gender) {
  const raw = localStorage.getItem(getDailyStateKey(gender));
  if (!raw) return false;

  const data = JSON.parse(raw);
  if (data.date !== getTodayUTC()) return false;

  dailyPool = data.dailyPool;
  dailyIndex = data.dailyIndex;
  dailyWinners = data.dailyWinners;
  dailyGender = data.dailyGender;
 dailyRoundSize = dailyPool.length;
  return true;
}

function clearDailyState(gender) {
  localStorage.removeItem(getDailyStateKey(gender));
}
function scrollUpSlightly() {
  window.scrollBy({
    top: -300, // adjust this value
    behavior: "smooth"
  });
}
function scrollDownSlightly() {
  window.scrollBy({
    top: 300, // adjust if needed
    behavior: "smooth"
  });
}




// --- Helper: shuffle ---
function pickDailyById(id) {
  const selected = dailyPool.find(c => c.id === id);
  if (selected) pickDaily(selected);
}
window.pickDailyById = pickDailyById;

function shuffleArray(arr) {
  return arr
    .map(value => ({ value, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ value }) => value);
}
function getTodayUTC() {
  return new Date().toISOString().slice(0, 10);
}

async function getDailyPool(gender) {
  const today = getTodayUTC();
  const docId = `${gender}_${today}`;
  const ref = doc(db, "daily_modes", docId);

  const snap = await getDoc(ref);

  // ✅ Already generated for today
  if (snap.exists()) {
    return snap.data().pool;
  }

  // ⛔ Generate ONLY ONCE (transaction-safe)
  return await runTransaction(db, async (tx) => {
    const freshSnap = await tx.get(ref);
    if (freshSnap.exists()) {
      return freshSnap.data().pool;
    }

    const source =
      gender === "girl" ? characters.girls : characters.boys;

    const pool = shuffleArray(source)
      .slice(0, 16)
      .map(c => c.id);

    tx.set(ref, {
      date: today,
      gender,
      pool,
      createdAt: new Date()
    });

    return pool;
  });
}
function hasPlayedDaily(gender) {
  const key = `daily_played_${gender}_${getTodayUTC()}`;
  return localStorage.getItem(key) === "true";
}

function markDailyPlayed(gender) {
  const key = `daily_played_${gender}_${getTodayUTC()}`;
  localStorage.setItem(key, "true");
}

async function startDailyMode(gender) {
  
  dailyGender = gender;
    const winnerKey = `daily_winner_${gender}_${getTodayUTC()}`;
  const storedWinner = localStorage.getItem(winnerKey);

  if (storedWinner) {
    const winner = JSON.parse(storedWinner);
    document.getElementById("menu").style.display = "none";

    gameArea.innerHTML = `
      <h2>👑 ${gender === "girl" ? "Waifu" : "Husbando"} of the Day</h2>
      <img src="${winner.image}" class="character-img gold-frame" />
      <h3>${formatName(winner.name)}</h3>
      <p class="anime-name">${winner.anime}</p>
     <p style="opacity:0.8;margin-top:10px;">
  🌙 Come back tomorrow for a new ${dailyGender === "girl" ? "Waifu" : "Husbando"}!
</p>

<button class="btn" onclick="returnHome()">Return Home</button>

    `;
    return;
  }
// winner check FIRST (already added above)

// then resume unfinished match
if (loadDailyState(gender)) {

  document.getElementById("menu").style.display = "none";
  showDailyMatch();
  return;
}




  const poolIds = await getDailyPool(gender);

  dailyPool = poolIds.map(id =>
    [...characters.boys, ...characters.girls].find(c => c.id === id)
  ).filter(Boolean);

  dailyRoundSize = dailyPool.length;
  dailyIndex = 0;
  dailyWinners = [];

  document.getElementById("menu").style.display = "none";
  showDailyMatch();
 

}
function showDailyMatch() {
  const roundNames = {
    16: "Round of 16",
    8: "Quarterfinals",
    4: "Semifinals",
    2: "Final 👑"
    

  };

 if (dailyPool.length === 1) {
  const winner = dailyPool[0];
  markDailyPlayed(dailyGender);

localStorage.setItem(
  `daily_winner_${dailyGender}_${getTodayUTC()}`,
  JSON.stringify(dailyPool[0])
);


  gameArea.innerHTML = `
    <h2>👑 ${dailyGender === "girl" ? "Waifu" : "Husbando"} of the Day</h2>
    <img src="${winner.image}" class="character-img gold-frame" />
    <h3>${formatName(winner.name)}</h3>
    <p>(${winner.anime})</p>
    <button class="btn" onclick="returnHome()">Return Home</button>
  `;
  return;
}


  const a = dailyPool[dailyIndex];
  const b = dailyPool[dailyIndex + 1];
   if (!a || !b) {
  console.warn("⚠️ Invalid daily pair detected, skipping");

  dailyIndex += 2;

  if (dailyIndex >= dailyPool.length) {
    dailyPool = dailyWinners;
    
    dailyWinners = [];
    dailyIndex = 0;
  }

  saveDailyState();
  showDailyMatch();
  return;
}


  gameArea.innerHTML = `
   <h2>${roundNames[dailyPool.length] || "Final 👑"}</h2>


    <button class="btn secondary" onclick="returnHome()">← Return to Menu</button>


    <div class="vs-container">
      <div class="vs-card">

        <img src="${a.image}" />
        <p>${formatName(a.name)}</p>
        <span>${a.anime}</span>
        <button onclick="pickDailyById('${a.id}')">Choose</button>

      </div>

      <div class="vs-text">VS</div>
<div class="vs-card">

        <img src="${b.image}" />
        <p>${formatName(b.name)}</p>
        <span>${b.anime}</span>
       <button onclick="pickDailyById('${b.id}')">Choose</button>


      </div>
    </div>
  `;


}
function pickDaily(selected) {
  dailyWinners.push(selected);
  dailyIndex += 2;

  // round finished
  if (dailyIndex >= dailyPool.length) {
    dailyPool = dailyWinners;
    dailyRoundSize = dailyPool.length; // ✅ ONLY HERE
    dailyWinners = [];
    dailyIndex = 0;
  }

  saveDailyState();
  showDailyMatch();
}


// --- Display single character (game view) ---
function showCharacter() {
  if (!gameArea) return;
  if (currentIndex >= currentGroup.length) {
    gameArea.innerHTML = `
      <button class="btn" onclick="playAgain()">Play Again</button>
      <button class="btn" onclick="returnHome()">Return to Homepage</button>
    `;
    return;
  }

  const char = currentGroup[currentIndex];
  const label = (char.gender === "boy") ? "Husband or Nah?" : "Wife or Nah?";
  const displayName = formatName(char.name); // formatted display name

  gameArea.innerHTML = `
    <h2>${label}</h2>
    <img src="${char.image}" class="character-img" onerror="this.style.opacity=0.4; this.title='Image not found: ${char.image}'" />
    <p class="char-name">${displayName}</p>
    <div class="choice-buttons">
      <button onclick="vote('${char.id}', true)">smash</button>
      <button onclick="vote('${char.id}', false)">pass</button>
    </div>
    <div id="voteResult"></div>
    <div style="margin-top: 20px;">
      <button class="btn" onclick="returnHome()">Return to Homepage</button>
    </div>
  `;
}
async function flushVoteBuffer() {
  if (bufferedVotesCount === 0) return;

  try {
    const batch = writeBatch(db);

    Object.entries(voteBuffer).forEach(([id, counts]) => {
      const ref = doc(db, "votes", id);
      batch.set(
        ref,
        {
          smash: increment(counts.smash || 0),
          nah: increment(counts.nah || 0)
        },
        { merge: true }
      );
    });

    await batch.commit();

    // reset buffer
    for (const k in voteBuffer) delete voteBuffer[k];
    bufferedVotesCount = 0;

    console.log("✅ Votes flushed to Firestore");
  } catch (err) {
    console.error("❌ Failed to flush votes:", err);
  }
}

// --- Voting function (same optimistic + firestore logic) ---
async function vote(characterId, isSmash) {
  const buttons = document.querySelectorAll(".choice-buttons button");
  buttons.forEach(btn => (btn.disabled = true));

  const todayUTC = new Date().toISOString().slice(0, 10);
  const voteKey = `voted_${characterId}_${todayUTC}`;

 

  const vr = document.getElementById("voteResult");
  if (vr) vr.innerText = "✅ Vote submitted!";
  localStorage.setItem(voteKey, "true");
  if (window.incrementVoteStat) window.incrementVoteStat();


  setTimeout(() => {
    currentIndex++;
    showCharacter();
  }, 500);

// 🧠 Queue vote locally instead of immediate write
voteBuffer[characterId] ??= { smash: 0, nah: 0 };

if (isSmash) voteBuffer[characterId].smash++;
else voteBuffer[characterId].nah++;

bufferedVotesCount++;

// 🔥 Auto flush every 10 votes
if (bufferedVotesCount >= FLUSH_LIMIT) {
  flushVoteBuffer();
}

}

// --- Play again / return home ---
function playAgain() {
  currentIndex = 0;
  showCharacter();
}
function returnHome() {
  flushVoteBuffer(); // 🔥 ensure votes are saved
  scrollUpSlightly();
  gameArea.innerHTML = "";
  const menu = document.getElementById("menu");
  if (menu) menu.style.display = "flex";
}

// --- Character Gallery ---
function showGallery() {
  const menu = document.getElementById("menu");
 
  if (menu) menu.style.display = "none";
  

  gameArea.innerHTML = `
    <div id="galleryHeader">
      <h2>Character Gallery</h2>
      <input type="text" id="searchInput" placeholder="🔍 Search characters..." />
      <button onclick="returnHome()">Back to Menu</button>
    </div>
    <div id="characterGallery"></div>
    <div id="characterModal" class="modal" style="display:none;">
  <div class="modal-content">
    <span class="close-btn">&times;</span>
    <img id="modalImage" src="" alt="" />
    <h3 id="modalName"></h3>
    <p id="modalVotes"></p>
  </div>
</div>

  `;

  const galleryArea = document.getElementById("characterGallery");
  const allChars = [...characters.boys, ...characters.girls, ...characters.other];

  allChars.forEach(c => {
    const card = document.createElement("div");
    card.className = "gallery-card";
    card.dataset.id = c.id;
    card.dataset.name = formatName(c.name);


    card.innerHTML = `
      <img src="${c.image}" alt="${c.name}" 
      loading="lazy"
           onerror="this.style.opacity=0.3; this.title='Image missing';">
      <p>${formatName(c.name)}</p>
    `;

    // 🔥 click to open modal
    card.addEventListener("click", () => openModal(c));

    galleryArea.appendChild(card);
  });

  // 🔎 Search filter
  const searchInput = document.getElementById("searchInput");
  searchInput.addEventListener("input", () => {
    const query = searchInput.value.toLowerCase();
    document.querySelectorAll(".gallery-card").forEach(card => {
      const name = card.dataset.name.toLowerCase();
      card.style.display = name.includes(query) ? "block" : "none";
    });
  });
}

// --- Modal logic ---
async function openModal(char) {
  const modal = document.getElementById("characterModal");
  const modalImg = document.getElementById("modalImage");
  const modalName = document.getElementById("modalName");
  const modalVotes = document.getElementById("modalVotes");
  

  modalImg.src = char.image;
  modalName.innerText = formatName(char.name);

  try {
    const ref = doc(db, "votes", char.id);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const d = snap.data();
      modalVotes.innerText = `🔥 ${d.smash || 0} smashes | ❌ ${d.nah || 0} passes`;
    } else {
      modalVotes.innerText = "No votes yet.";
    }
  } catch {
    modalVotes.innerText = "Error loading votes.";
  }

  modal.style.display = "flex";

  // Close with X
  document.querySelector(".close-btn").onclick = () => {
    modal.style.display = "none";
  };
  // ESC key support
document.onkeydown = (e) => {
  if (e.key === "Escape") {
    modal.style.display = "none";
    document.onkeydown = null; // cleanup
  }
};


  // 🔥 Close when clicking outside modal-content
  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.style.display = "none";
    }
  };
}
// ===============================
// 🔒 ADMIN: BUILD LEADERBOARD ON DEMAND
// ===============================
async function adminUpdateLeaderboard(gender) {
  const all = [...characters.boys, ...characters.girls];
  const group = all.filter(c => c.gender === gender);

  const votesSnap = await getDocs(collection(db, "votes"));
  const scores = [];

  votesSnap.forEach(d => {
    const data = d.data();
    const smash = data.smash || 0;
    const nah = data.nah || 0;
    const total = smash + nah;

    if (total > 0 && group.some(c => c.id === d.id)) {
      scores.push({ id: d.id, smash, total });
    }
  });

  const top = scores
    .sort((a, b) => b.smash - a.smash)
    .slice(0, 5);

  await setDoc(doc(db, "leaderboard_cache", gender), {
    updatedAt: new Date(),
    top
  });

  console.log(`✅ ${gender} leaderboard updated`);

}
window.addEventListener("beforeunload", () => {
  flushVoteBuffer();
});


// ===============================
// 📊 FRONTEND: READ CACHED LEADERBOARD
// ===============================
async function displayLeaderboard(gender, targetId, title) {
  const board = document.getElementById(targetId);
  if (!board) return;

  board.innerHTML = `<h3>${title}</h3>`;

  try {
    const snap = await getDoc(doc(db, "leaderboard_cache", gender));
    if (!snap.exists()) {
      board.innerHTML += "<p>Leaderboard updating soon 🔄</p>";
      return;
    }

    const data = snap.data();
    const ul = document.createElement("ul");

    data.top.forEach((s, index) => {
      const char = [...characters.boys, ...characters.girls].find(c => c.id === s.id);
      if (!char) return;

      let frameClass = "";
      let ultimateTitle = "";

      if (index === 0) {
        frameClass = "gold-frame";
        ultimateTitle = `<div class="ultimate-title">${gender === "girl" ? "Ultimate Waifu" : "Ultimate Husbando"}</div>`;
      } else if (index === 1) frameClass = "silver-frame";
      else if (index === 2) frameClass = "bronze-frame";

      const li = document.createElement("li");
      li.innerHTML = `
        <div class="leaderboard-img-container ${frameClass}">
          <img src="${char.image}" class="leaderboard-img" />
        </div>
        <div class="leaderboard-info">
          <p class="leaderboard-name">${formatName(char.name)} ${ultimateTitle}</p>
          <span>🔥 ${s.smash} smashes (${s.total} votes)</span>
        </div>
      `;
      ul.appendChild(li);
    });

    board.appendChild(ul);
  } catch (err) {
    console.error(err);
    board.innerHTML += "<p>Error loading leaderboard</p>";
  }
}



// --- Wallpaper logic ---
const wallpapers = [
  "images/wall1.png",
  "images/wall2.png",
  "images/wall3.jpg",
  "images/wall4.png"
];
function setRandomWallpaper() {
  const randomIndex = Math.floor(Math.random() * wallpapers.length);
  document.body.style.backgroundImage = `url('${wallpapers[randomIndex]}')`;
  document.body.style.backgroundSize = "cover";
  document.body.style.backgroundPosition = "center";
  document.body.style.backgroundAttachment = "fixed";
}
async function autoUpdateLeaderboardIfNeeded() {
  const metaRef = doc(db, "leaderboard_cache", "meta");
  const metaSnap = await getDoc(metaRef);

  const now = Date.now();
  const interval = LEADERBOARD_UPDATE_DAYS * 24 * 60 * 60 * 1000;

  if (metaSnap.exists()) {
    const last = metaSnap.data().lastUpdated?.toMillis?.() || 0;
    if (now - last < interval) {
      return; // ⛔ too soon, skip update
    }
  }

  console.log("🔄 Auto-updating leaderboard (daily)");

  await adminUpdateLeaderboard("boy");
  await adminUpdateLeaderboard("girl");

  await setDoc(metaRef, {
    lastUpdated: new Date()
  });
}

// --- Initialization (run once) ---
(async function init() {
  await loadCharacters();
  window.startDailyMode = startDailyMode;


  // DOM refs (ensure script is loaded at end of body or DOM exists)
  gameArea = document.getElementById("gameArea");
  boyBtn = document.getElementById("boyBtn");
  girlBtn = document.getElementById("girlBtn");
  bothBtn = document.getElementById("bothBtn");
    // gallery button
  const galleryBtn = document.getElementById("galleryBtn");
  if (galleryBtn) galleryBtn.onclick = () => showGallery();

  musicToggle = document.getElementById("musicToggle");
  bgMusic = document.getElementById("bgMusic");
if (boyBtn) boyBtn.onclick = () => {
  currentGroup = shuffleArray(characters.boys);
  currentIndex = 0;
  document.getElementById("menu").style.display = "none";
  scrollDownSlightly();
  showCharacter();
};

if (girlBtn) girlBtn.onclick = () => {
  currentGroup = shuffleArray(characters.girls);
  currentIndex = 0;
  document.getElementById("menu").style.display = "none";
  scrollDownSlightly();
  showCharacter();
};

if (bothBtn) bothBtn.onclick = () => {
  currentGroup = shuffleArray([...characters.boys, ...characters.girls]);
  currentIndex = 0;
  document.getElementById("menu").style.display = "none";
  scrollDownSlightly();
  showCharacter();
};

  // music toggle
  if (musicToggle && bgMusic) {
    musicToggle.addEventListener("click", () => {
      if (bgMusic.paused) { bgMusic.play().catch(()=>{}); musicToggle.textContent = "🔊"; }
      else { bgMusic.pause(); musicToggle.textContent = "🔇"; }
    });
  }
  document.body.addEventListener("click", () => { if (bgMusic && bgMusic.paused) bgMusic.play().catch(()=>{}); }, { once: true });

  

  // start countdown + wallpapers + leaderboards
  
  setRandomWallpaper();
  setInterval(setRandomWallpaper, 180000);
await autoUpdateLeaderboardIfNeeded();

 displayLeaderboard("boy", "husbandBoard", "Top Husbands");
displayLeaderboard("girl", "wifeBoard", "Top Wives");


  // expose functions for inline onclicks used in HTML
  window.vote = vote;
  window.playAgain = playAgain;
  window.returnHome = returnHome;
 

})();
// 🔎 Debug missing images + auto fallback
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("img").forEach(img => {
    img.onerror = () => {
      console.warn("⚠️ Missing image:", img.src); // logs broken image
      img.src = "images/placeholder.png";        // swap to fallback
    };
  });
});
function getRarity(percent) {
  if (percent >= 70) return { label: "Common", emoji: "🟢" };
  if (percent >= 40) return { label: "Uncommon", emoji: "🔵" };
  if (percent >= 15) return { label: "Rare", emoji: "🟣" };
  if (percent >= 5)  return { label: "Epic", emoji: "🟠" };
  return { label: "Legendary", emoji: "🔴" };
}

// ===============================
// 🏆 ACHIEVEMENTS SYSTEM
// ===============================
async function loadAchievements() {
  const container = document.getElementById("achievementsGrid");
  if (!container) return;

  try {
    const res = await fetch("achievements.json");
    const achievements = await res.json();

    // 🔥 Read stats from localStorage
    const stats = {
      votes: parseInt(localStorage.getItem("totalVotes") || "0"),
      days: parseInt(localStorage.getItem("daysPlayed") || "0"),
      streak: parseInt(localStorage.getItem("streak") || "0")
    };

    container.innerHTML = "";

    achievements.forEach(a => {
      let unlocked = false;
if (a.type === "votes" && stats.votes >= a.value) unlocked = true;
if (a.type === "days_played" && stats.days >= a.value) unlocked = true;
if (a.type === "streak" && stats.streak >= a.value) unlocked = true;

      const card = document.createElement("div");
      card.className = "achievement-card" + (unlocked ? " unlocked" : "");
const rarity = getRarity(a.percent);

      card.innerHTML = `
  <div class="achievement-icon">${a.icon}</div>
  <div class="achievement-name">${a.name}</div>
  <div class="achievement-desc">${a.description}</div>

  <div class="achievement-rarity">
    ${rarity.emoji}
    <strong>${rarity.label}</strong>
    — Only ${a.percent}% of players
  </div>
`;


      container.appendChild(card);
    });

  } catch (err) {
    console.error("Achievements load failed:", err);
    container.innerHTML = "<p>⚠️ Failed to load achievements</p>";
  }
}

// 🔄 Reload achievements whenever stats change
document.addEventListener("DOMContentLoaded", loadAchievements);

// 🔥 Hook into vote system
const originalIncrement = window.incrementVoteStat;
if (originalIncrement) {
  window.incrementVoteStat = function () {
    originalIncrement();
    loadAchievements();
  };
}
