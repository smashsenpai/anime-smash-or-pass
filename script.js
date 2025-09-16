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
const useTest = false; // set to true for test project
const firebaseConfig = useTest ? testConfig : liveConfig;

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

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
let currentDaily = false;
let dailyChar = null;

// DOM references (will be set in init)
let gameArea, boyBtn, girlBtn, bothBtn, musicToggle, bgMusic;

// --- Helper: shuffle ---
function shuffleArray(arr) {
  return arr
    .map(value => ({ value, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ value }) => value);
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

// --- Voting function (same optimistic + firestore logic) ---
async function vote(characterId, isSmash) {
  const buttons = document.querySelectorAll(".choice-buttons button");
  buttons.forEach(btn => (btn.disabled = true));

  const todayUTC = new Date().toISOString().slice(0, 10);
  const voteKey = `voted_${characterId}_${todayUTC}`;

  if (currentDaily && localStorage.getItem(voteKey)) {
    const vr = document.getElementById("voteResult");
    if (vr) vr.innerText = "⚠️ You've already voted today!";
    buttons.forEach(btn => (btn.disabled = false));
    return;
  }

  const vr = document.getElementById("voteResult");
  if (vr) vr.innerText = "✅ Vote submitted!";
  localStorage.setItem(voteKey, "true");

  setTimeout(() => {
    currentIndex++;
    showCharacter();
  }, 500);

  // Background save
  (async () => {
    try {
      const ref = doc(db, "votes", characterId);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, { smash: 0, nah: 0 });
      }
      const field = isSmash ? "smash" : "nah";
      await updateDoc(ref, { [field]: increment(1) });
    } catch (err) {
      console.error("Vote error:", err);
      const vr2 = document.getElementById("voteResult");
      if (vr2) vr2.innerText = "⚠️ Network error — your vote may not have counted.";
    }
  })();
}

// --- Play again / return home ---
function playAgain() {
  currentIndex = 0;
  showCharacter();
}
function returnHome() {
  gameArea.innerHTML = "";
  const menu = document.getElementById("menu");
  const dailyMenu = document.getElementById("dailyMenu");
  if (menu) menu.style.display = "flex";
  if (dailyMenu) dailyMenu.style.display = "flex";
  const gameCountdown = document.getElementById("dailyCountdownGame");
  if (gameCountdown) gameCountdown.style.display = "none";
}
// --- Character Gallery ---
function showGallery() {
  const menu = document.getElementById("menu");
  const dailyMenu = document.getElementById("dailyMenu");
  if (menu) menu.style.display = "none";
  if (dailyMenu) dailyMenu.style.display = "none";

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


// --- Leaderboard display (uses dynamically loaded characters) ---
async function displayLeaderboard(gender, targetId, title) {
  const all = [...characters.boys, ...characters.girls, ...characters.other];
  const group = all.filter(c => c.gender === gender);

  const board = document.getElementById(targetId);
  if (!board) return; // safe guard if element missing

  board.innerHTML = `<h3>${title}</h3>`; // reset

  try {
    const allVotesSnap = await getDocs(collection(db, "votes"));
    const scores = [];

    allVotesSnap.forEach(docSnap => {
      const data = docSnap.data() || {};
      const smash = data.smash || 0;
      const nah = data.nah || 0;
      const total = smash + nah;
      if (total > 0) scores.push({ id: docSnap.id, smash, total });
    });

    // only characters in this gender
    const filtered = scores.filter(s => group.some(c => c.id === s.id));
    const sorted = filtered.sort((a, b) => b.smash - a.smash).slice(0, 5);

    const ul = document.createElement("ul");

    sorted.forEach((s, index) => {
  const char = group.find(c => c.id === s.id);
  if (!char) return;

  const li = document.createElement("li");

  let frameClass = "";
  let ultimateTitle = "";
  if (index === 0) {
    frameClass = "gold-frame";
    ultimateTitle = `<div class="ultimate-title">${
      gender === "girl" ? "Ultimate Waifu" : "Ultimate Husbando"
    }</div>`;
  } else if (index === 1) {
    frameClass = "silver-frame";
  } else if (index === 2) {
    frameClass = "bronze-frame";
  }

  li.innerHTML = `
    <div class="leaderboard-img-container ${frameClass}">
      <img src="${char.image}" class="leaderboard-img" />
    </div>
    <div class="leaderboard-info">
      <p class="leaderboard-name">${char.name} ${ultimateTitle}</p>
      <span>🔥 ${s.smash} smashes (${s.total} votes)</span>
    </div>
  `;

  ul.appendChild(li);
});

    board.appendChild(ul);
  } catch (err) {
    console.error("displayLeaderboard error:", err);
    board.innerHTML += `<p style="color:#ff8c42;">Error loading leaderboard</p>`;
  }
}

// --- Daily countdown & daily logic (keeps your original behavior) ---
let countdownInterval;
function startDailyCountdown() {
  const homeEl = document.getElementById("dailyCountdownHome");
  const gameEl = document.getElementById("dailyCountdownGame");
  if (countdownInterval) clearInterval(countdownInterval);

  async function updateCountdown() {
    const now = new Date();
    const nextUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
    const diff = nextUTC.getTime() - now.getTime();

    if (diff <= 0) {
      await ensureDailyCharacter("girl");
      await ensureDailyCharacter("boy");
      if (currentDaily && dailyChar) {
        const gender = dailyChar.gender;
        const todayUTC = new Date().toISOString().slice(0, 10);
        const dailyRef = doc(db, "daily", `${gender}_${todayUTC}`);
        const dailySnap = await getDoc(dailyRef);
        if (dailySnap.exists()) {
          dailyChar = dailySnap.data();
          currentGroup = [dailyChar];
          currentIndex = 0;
          showCharacter();
        }
      }
      return;
    }

    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    const text = `⏰ New characters in: ${hours}h ${minutes}m ${seconds}s`;
    if (homeEl) homeEl.innerText = text;
    if (gameEl) gameEl.innerText = text;
  }

  updateCountdown();
  countdownInterval = setInterval(updateCountdown, 1000);
}

async function ensureDailyCharacter(gender) {
  const todayUTC = new Date().toISOString().slice(0, 10);
  const dailyRef = doc(db, "daily", `${gender}_${todayUTC}`);
  const dailySnap = await getDoc(dailyRef);
  if (!dailySnap.exists()) {
    const historyRef = doc(db, "dailyHistory", gender);
    const pool = characters[gender === "girl" ? "girls" : "boys"];
    const historySnap = await getDoc(historyRef);
    let used = historySnap.exists() ? historySnap.data().used : [];
    let available = pool.filter(c => !used.includes(c.id));
    if (available.length === 0) { available = pool; used = []; }
    const newChar = available[Math.floor(Math.random() * available.length)];
    await setDoc(dailyRef, newChar);
    await setDoc(historyRef, { used: [...used, newChar.id] });
  }
}

function startDailyMode(gender) {
  const todayUTC = new Date().toISOString().slice(0, 10);
  const dailyRef = doc(db, "daily", `${gender}_${todayUTC}`);
  const historyRef = doc(db, "dailyHistory", gender);

  runTransaction(db, async (transaction) => {
    const dailySnap = await transaction.get(dailyRef);
    if (dailySnap.exists()) {
      dailyChar = dailySnap.data();
    } else {
      const pool = characters[gender === "girl" ? "girls" : "boys"];
      const historySnap = await transaction.get(historyRef);
      let used = historySnap.exists() ? historySnap.data().used : [];
      let available = pool.filter(c => !used.includes(c.id));
      if (available.length === 0) { available = pool; used = []; }
      dailyChar = available[Math.floor(Math.random() * available.length)];
      transaction.set(dailyRef, dailyChar);
      transaction.set(historyRef, { used: [...used, dailyChar.id] });
    }
  })
  .then(() => {
    currentGroup = [dailyChar];
    currentIndex = 0;
    currentDaily = true;
    const menu = document.getElementById("menu");
    const dailyMenu = document.getElementById("dailyMenu");
    if (menu) menu.style.display = "none";
    if (dailyMenu) dailyMenu.style.display = "none";
    const gameCountdown = document.getElementById("dailyCountdownGame");
    if (gameCountdown) gameCountdown.style.display = "block";
    showCharacter();
  })
  .catch((e) => console.error("Transaction failed: ", e));
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

// --- Initialization (run once) ---
(async function init() {
  await loadCharacters();

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

  if (boyBtn) boyBtn.onclick = () => { currentGroup = shuffleArray(characters.boys); currentIndex = 0; currentDaily = false; document.getElementById("menu").style.display = "none"; document.getElementById("dailyMenu").style.display = "none"; showCharacter(); };
  if (girlBtn) girlBtn.onclick = () => { currentGroup = shuffleArray(characters.girls); currentIndex = 0; currentDaily = false; document.getElementById("menu").style.display = "none"; document.getElementById("dailyMenu").style.display = "none"; showCharacter(); };
  if (bothBtn) bothBtn.onclick = () => { currentGroup = shuffleArray([...characters.boys, ...characters.girls]); currentIndex = 0; currentDaily = false; document.getElementById("menu").style.display = "none"; document.getElementById("dailyMenu").style.display = "none"; showCharacter(); };

  // music toggle
  if (musicToggle && bgMusic) {
    musicToggle.addEventListener("click", () => {
      if (bgMusic.paused) { bgMusic.play().catch(()=>{}); musicToggle.textContent = "🔊"; }
      else { bgMusic.pause(); musicToggle.textContent = "🔇"; }
    });
  }
  document.body.addEventListener("click", () => { if (bgMusic && bgMusic.paused) bgMusic.play().catch(()=>{}); }, { once: true });

  // wire daily buttons (if present)
  const dailyWaifuBtn = document.getElementById("dailyWaifuBtn");
  const dailyHusbandoBtn = document.getElementById("dailyHusbandoBtn");
  if (dailyWaifuBtn) dailyWaifuBtn.onclick = () => startDailyMode("girl");
  if (dailyHusbandoBtn) dailyHusbandoBtn.onclick = () => startDailyMode("boy");

  // start countdown + wallpapers + leaderboards
  startDailyCountdown();
  setRandomWallpaper();
  setInterval(setRandomWallpaper, 180000);

  await displayLeaderboard("boy", "husbandBoard", "Top Husbands");
  await displayLeaderboard("girl", "wifeBoard", "Top Wives");

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
