// 🔥 IMPORTS
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, increment
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// 🔥 FIREBASE CONFIGS
// Live project (AnimeVoteApp)
const liveConfig = {
  apiKey: "AIzaSyDNRa8_noLXsg1n591GexonnK733nZxa6M",
  authDomain: "animevoteapp.firebaseapp.com",
  projectId: "animevoteapp",
  storageBucket: "animevoteapp.appspot.com",
  messagingSenderId: "202781686417",
  appId: "1:202781686417:web:eb6bf936d2d9f73d6c5d30",
  measurementId: "G-CKL3026K7X"
};

// Test project (anime-vote-leaderboard)
const testConfig = {
  apiKey: "AIzaSyB4q2XirztsJOO5RvyYnMEPs7_3e13OaIE",
  authDomain: "anime-vote-leaderboard.firebaseapp.com",
  projectId: "anime-vote-leaderboard",
  storageBucket: "anime-vote-leaderboard.appspot.com",
  messagingSenderId: "153651694103",
  appId: "1:153651694103:web:dcee9781f4129fa04faa52",
  measurementId: "G-0QC1NNRH1T"
};

// 🔥 Toggle between live & test
const useTest = false;// change to false when you want to use live
const firebaseConfig = useTest ? testConfig : liveConfig;

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);


const characters = {
  boys: [
    { id: "boy1", image: "images/boy1.png", gender: "boy" },
    { id: "boy2", image: "images/boy2.jpg", gender: "boy" },
    { id: "boy3", image: "images/boy3.jpg", gender: "boy" },
    { id: "boy4", image: "images/boy4.jpg", gender: "boy" },
    { id: "boy5", image: "images/boy5.jpg", gender: "boy" },
    { id: "boy6", image: "images/boy6.jpg", gender: "boy" },
    { id: "boy7", image: "images/boy7.jpg", gender: "boy" },
    { id: "boy8", image: "images/boy8.jpg", gender: "boy" },
    { id: "boy9", image: "images/boy9.jpg", gender: "boy" },
    { id: "boy10", image: "images/boy10.jpg", gender: "boy" },
    { id: "boy11", image: "images/boy11.jpg", gender: "boy" },
    { id: "boy12", image: "images/boy12.jpg", gender: "boy" },
    { id: "boy13", image: "images/boy13.jpg", gender: "boy" },
    { id: "boy14", image: "images/boy14.jpg", gender: "boy" },
    { id: "boy15", image: "images/boy15.jpg", gender: "boy" },
    { id: "boy16", image: "images/boy16.jpg", gender: "boy" },
    { id: "boy17", image: "images/boy17.jpg", gender: "boy" },
    { id: "boy18", image: "images/boy18.jpg", gender: "boy" },
    { id: "boy19", image: "images/boy19.jpg", gender: "boy" },
    { id: "boy20", image: "images/boy20.jpg", gender: "boy" },
    { id: "boy21", image: "images/boy21.jpg", gender: "boy" },
    { id: "boy22", image: "images/boy22.jpg", gender: "boy" }

  ],
  girls: [
    { id: "girl1", image: "images/girl1.jpg", gender: "girl" },
    { id: "girl2", image: "images/girl2.jpg", gender: "girl" },
    { id: "girl3", image: "images/girl3.jpg", gender: "girl" },
    { id: "girl4", image: "images/girl4.jpg", gender: "girl" },
    { id: "girl5", image: "images/girl5.jpg", gender: "girl" },
    { id: "girl6", image: "images/girl6.jpg", gender: "girl" },
    { id: "girl7", image: "images/girl7.jpg", gender: "girl" },
    { id: "girl8", image: "images/girl8.jpg", gender: "girl" },
    { id: "girl9", image: "images/girl9.jpg", gender: "girl" },
    { id: "girl10", image: "images/girl10.jpg", gender: "girl" },
      { id: "girl11", image: "images/girl11.jpg", gender: "girl" },
    { id: "girl12", image: "images/girl12.jpg", gender: "girl" },
      { id: "girl13", image: "images/girl13.jpg", gender: "girl" },
    { id: "girl14", image: "images/girl14.jpg", gender: "girl" },
    { id: "girl15", image: "images/girl15.jpg", gender: "girl" },
    { id: "girl16", image: "images/girl16.jpg", gender: "girl" },
      { id: "girl17", image: "images/girl17.jpg", gender: "girl" },
        { id: "girl18", image: "images/girl18.jpg", gender: "girl" },
            { id: "girl19", image: "images/girl19.jpg", gender: "girl" },
                { id: "girl20", image: "images/girl20.jpg", gender: "girl" },
                    { id: "girl21", image: "images/girl21.jpg", gender: "girl" },
                        { id: "girl22", image: "images/girl22.jpg", gender: "girl" }

  ]
};

// 🔥 VARIABLES
let currentGroup = [];
let currentIndex = 0;
let currentDaily = false;
let dailyChar = null;

const gameArea = document.getElementById("gameArea");
const boyBtn = document.getElementById("boyBtn");
const girlBtn = document.getElementById("girlBtn");
const bothBtn = document.getElementById("bothBtn");
const musicToggle = document.getElementById("musicToggle");
const bgMusic = document.getElementById("bgMusic");

let isMuted = false;
musicToggle.addEventListener("click", () => {
  if (isMuted) {
    bgMusic.play();
    musicToggle.textContent = "🔊";
  } else {
    bgMusic.pause();
    musicToggle.textContent = "🔇";
  }
  isMuted = !isMuted;
});

document.body.addEventListener("click", () => {
  if (!isMuted && bgMusic.paused) {
    bgMusic.play().catch(() => {});
  }
}, { once: true });

boyBtn.onclick = () => startMode("boys");
girlBtn.onclick = () => startMode("girls");
bothBtn.onclick = () => startMode("both");

// 🔥 NEW BUTTONS FOR DAILY MODES
document.getElementById("dailyWaifuBtn").onclick = () => startDailyMode("girl");
document.getElementById("dailyHusbandoBtn").onclick = () => startDailyMode("boy");

function startMode(mode) {
  const group =
    mode === "both"
      ? [...characters.boys, ...characters.girls]
      : [...characters[mode]];

  currentGroup = shuffleArray(group);
  currentIndex = 0;
  currentDaily = false;
  document.getElementById("menu").style.display = "none";
  document.getElementById("dailyMenu").style.display = "none";
  showCharacter();
  
}
import { runTransaction } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// 🔥 NEW: DAILY MODE (TRANSACTION SAFE)
async function startDailyMode(gender) {
  const today = new Date().toISOString().split("T")[0];
  const dailyRef = doc(db, "daily", `${gender}_${today}`);
  const historyRef = doc(db, "dailyHistory", gender);

  try {
    await runTransaction(db, async (transaction) => {
      const dailySnap = await transaction.get(dailyRef);

      if (dailySnap.exists()) {
        // ✅ Already chosen, use it
        dailyChar = dailySnap.data();
      } else {
        // ✅ Pick a new one
        const pool = characters[gender === "girl" ? "girls" : "boys"];

        const historySnap = await transaction.get(historyRef);
        let used = historySnap.exists() ? historySnap.data().used : [];

        // find unused
        let available = pool.filter(c => !used.includes(c.id));
        if (available.length === 0) {
          available = pool;
          used = [];
        }

        // random pick
        dailyChar = available[Math.floor(Math.random() * available.length)];

        // save today's choice
        transaction.set(dailyRef, dailyChar);

        // update history
        transaction.set(historyRef, { used: [...used, dailyChar.id] });
      }
    });

    // show the daily character
    currentGroup = [dailyChar];
    currentIndex = 0;
    currentDaily = true;
    document.getElementById("menu").style.display = "none";
    document.getElementById("dailyMenu").style.display = "none";
    showCharacter();

  } catch (e) {
    console.error("Transaction failed: ", e);
  }
}


function showCharacter() {
  if (currentIndex >= currentGroup.length) {
    gameArea.innerHTML = `
      <button onclick="playAgain()">Play Again</button>
      <button onclick="returnHome()">Return to Homepage</button>
    `;
    return;
  }

  const char = currentGroup[currentIndex];
  const label = (char.gender === "boy") ? "Husband or Nah?" : "Wife or Nah?";

  gameArea.innerHTML = `
    <h2>${label}</h2>
    <img src="${char.image}" class="character-img" />
    <div class="choice-buttons">
      <button onclick="vote('${char.id}', true)">😍</button>
      <button onclick="vote('${char.id}', false)">💀</button>
    </div>
    <div id="voteResult"></div>
    <div style="margin-top: 20px;">
      <button onclick="returnHome()">Return to Homepage</button>
    </div>
  `;
}

// 🔥 VOTING (OPTIMISTIC + BACKGROUND + ERROR FEEDBACK)
function vote(characterId, isSmash) {
  const buttons = document.querySelectorAll(".choice-buttons button");
  buttons.forEach(btn => (btn.disabled = true)); // disable instantly

  const voteKey = `voted_${characterId}_${new Date().toISOString().split("T")[0]}`;
  if (currentDaily && localStorage.getItem(voteKey)) {
    document.getElementById("voteResult").innerText = "⚠️ You've already voted today!";
    buttons.forEach(btn => (btn.disabled = false)); 
    return;
  }

  // ✅ Instant optimistic feedback
  document.getElementById("voteResult").innerText = "✅ Vote submitted!";
  localStorage.setItem(voteKey, "true");

  // ⏩ Move on immediately
  setTimeout(() => {
    currentIndex++;
    showCharacter();
  }, 500);

  // 🔥 Background Firestore save
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
      // ⚠️ Show friendly feedback instead of silent fail
      document.getElementById("voteResult").innerText = 
        "⚠️ Network error — your vote may not have counted.";
    }
  })();
}

function playAgain() {
  currentIndex = 0;
  showCharacter();
}

function returnHome() {
  gameArea.innerHTML = "";
  document.getElementById("menu").style.display = "flex";
  document.getElementById("dailyMenu").style.display = "flex";
  
}

async function displayLeaderboard(gender, targetId, title) {
  const all = [...characters.boys, ...characters.girls];
  const group = all.filter(c => c.gender === gender);
  const allVotesSnap = await getDocs(collection(db, "votes"));
  const scores = [];

  allVotesSnap.forEach(docSnap => {
    const data = docSnap.data();
    const total = data.smash + data.nah;
    if (total > 0) {
      const percent = data.smash / total;
      scores.push({ id: docSnap.id, percent, total });
    }
  });

  const filtered = scores.filter(s => group.find(c => c.id === s.id));
  const sorted = filtered.sort((a, b) => b.percent - a.percent).slice(0, 5);

  const board = document.getElementById(targetId);
  board.innerHTML = `<h3>${title}</h3>`;

  const ul = document.createElement("ul");

  sorted.forEach((s, index) => {
    const char = group.find(c => c.id === s.id);
    const li = document.createElement("li");

    let frameClass = "";
    let crownIcon = "";
    let ultimateTitle = "";

    if (index === 0) {
      frameClass = "gold-frame";
      crownIcon = `<div class="emoji-crown">👑</div>`;
      ultimateTitle = `<div class="ultimate-title">${gender === "girl" ? "Ultimate Waifu" : "Ultimate Husbando"}</div>`;
    } else if (index === 1) {
      frameClass = "silver-frame";
    } else if (index === 2) {
      frameClass = "bronze-frame";
    }

    li.innerHTML = `
      <div class="crown-container">
        ${crownIcon}
        <div class="leaderboard-img-container ${frameClass}">
          <img src="${char.image}" class="leaderboard-img" />
        </div>
      </div>
      ${ultimateTitle}
      <span>${(s.percent * 100).toFixed(1)}% (${s.total} votes)</span>
    `;
    ul.appendChild(li);
  });

  board.appendChild(ul);
}

function shuffleArray(arr) {
  return arr
    .map(value => ({ value, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ value }) => value);
}

displayLeaderboard("boy", "husbandBoard", "Top Husbands");
displayLeaderboard("girl", "wifeBoard", "Top Wives");

window.vote = vote;
window.playAgain = playAgain;
window.returnHome = returnHome;
