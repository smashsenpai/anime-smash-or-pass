import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, increment
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDNRa8_noLXsg1n591GexonnK733nZxa6M",
  authDomain: "animevoteapp.firebaseapp.com",
  projectId: "animevoteapp",
  storageBucket: "animevoteapp.appspot.com",
  messagingSenderId: "202781686417",
  appId: "1:202781686417:web:eb6bf936d2d9f73d6c5d30",
  measurementId: "G-CKL3026K7X"
};

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
    { id: "boy12", image: "images/boy12.jpg", gender: "boy" }
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
    { id: "girl11", image: "images/girl11.jpg", gender: "girl" }
  ]
};

let currentGroup = [];
let currentIndex = 0;

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

function startMode(mode) {
  const group =
    mode === "both"
      ? [...characters.boys, ...characters.girls]
      : [...characters[mode]];

  currentGroup = shuffleArray(group);
  currentIndex = 0;
  document.getElementById("menu").style.display = "none";
  showCharacter();
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

async function vote(characterId, isSmash) {
  const ref = doc(db, "votes", characterId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { smash: 0, nah: 0 });
  }

  const field = isSmash ? "smash" : "nah";
  await updateDoc(ref, { [field]: increment(1) });

  const updatedSnap = await getDoc(ref);
  const data = updatedSnap.data();
  const total = data.smash + data.nah;
  const percent = ((data.smash / total) * 100).toFixed(1);

  document.getElementById("voteResult").innerText = `😍 ${percent}% (${data.smash}/${total})`;

  setTimeout(() => {
    currentIndex++;
    showCharacter();
  }, 1500);
}

function playAgain() {
  currentIndex = 0;
  showCharacter();
}

function returnHome() {
  gameArea.innerHTML = "";
  document.getElementById("menu").style.display = "flex";
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
  sorted.forEach(s => {
    const char = group.find(c => c.id === s.id);
    const li = document.createElement("li");
    li.innerHTML = `
      <img src="${char.image}" class="leaderboard-img" />
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
