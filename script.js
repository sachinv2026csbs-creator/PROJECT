"use strict";

/* ---------- helpers ---------- */
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const store = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};
const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

/* ---------- state ---------- */
let cards = store.get("desky.cards", []);   // {id, topic, q, a, right, wrong}
let log = store.get("desky.log", {});       // {"YYYY-MM-DD": minutes}
let examDate = store.get("desky.exam", "");
const saveCards = () => store.set("desky.cards", cards);
const saveLog = () => store.set("desky.log", log);

/* ---------- tabs ---------- */
$$(".tab").forEach((b) => b.addEventListener("click", () => {
  $$(".tab").forEach((t) => t.classList.toggle("active", t === b));
  $$(".panel").forEach((p) => p.classList.toggle("active", p.id === b.dataset.tab));
  if (b.dataset.tab === "cards") renderCards();
  if (b.dataset.tab === "quiz") renderQuizTopics();
  if (b.dataset.tab === "progress") renderProgress();
}));

/* ---------- exam countdown ---------- */
function daysLeft() {
  if (!examDate) return null;
  const [y, m, d] = examDate.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.round((target - now) / 86400000);
}
function renderCountdown() {
  const el = $("#countdown");
  const d = daysLeft();
  if (d === null) el.textContent = "Set your exam date";
  else if (d > 1) el.textContent = d + " days to go";
  else if (d === 1) el.textContent = "1 day to go";
  else if (d === 0) el.textContent = "Exam day. You've got this!";
  else el.textContent = "Exam date has passed";
}
$("#examDate").value = examDate;
$("#examDate").addEventListener("change", (e) => {
  examDate = e.target.value;
  store.set("desky.exam", examDate);
  renderCountdown();
});

/* ---------- focus timer ---------- */
let duration = 25 * 60, remaining = duration, endAt = 0, ticker = null;
const fmt = (s) => String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");

function renderTimer() {
  $("#time").textContent = fmt(remaining);
  const pct = ((duration - remaining) / duration) * 100;
  $("#ring").style.setProperty("--p", pct.toFixed(1));
  document.title = ticker ? fmt(remaining) + " · DESKY" : "DESKY – Quick Study & Test Prep";
}
function renderToday() {
  const m = log[today()] || 0;
  $("#todayMinutes").textContent = m ? "Studied " + m + " min today" : "No sessions yet today. Start one!";
}
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 880; g.gain.value = 0.15;
    o.start(); o.stop(ctx.currentTime + 0.6);
  } catch {}
}
function stopTicker() { clearInterval(ticker); ticker = null; }
function startTimer() {
  if (ticker || remaining <= 0) return;
  endAt = Date.now() + remaining * 1000;
  ticker = setInterval(() => {
    remaining = Math.max(0, Math.round((endAt - Date.now()) / 1000));
    renderTimer();
    if (remaining === 0) finishTimer();
  }, 250);
  $("#timerMsg").textContent = $("#goal").value.trim() || "Focus";
  renderTimer();
}
function pauseTimer() {
  if (!ticker) return;
  stopTicker();
  $("#timerMsg").textContent = "Paused";
  renderTimer();
}
function resetTimer() {
  stopTicker();
  remaining = duration;
  $("#timerMsg").textContent = "Ready";
  renderTimer();
}
function finishTimer() {
  stopTicker();
  log[today()] = (log[today()] || 0) + Math.round(duration / 60);
  saveLog();
  $("#timerMsg").textContent = "Done! Take a break";
  beep();
  renderToday();
  renderTimer();
}
$("#startBtn").addEventListener("click", startTimer);
$("#pauseBtn").addEventListener("click", pauseTimer);
$("#resetBtn").addEventListener("click", resetTimer);
$$(".chip").forEach((c) => c.addEventListener("click", () => {
  if (ticker) return;
  $$(".chip").forEach((x) => x.classList.toggle("active", x === c));
  duration = Number(c.dataset.min) * 60;
  remaining = duration;
  $("#timerMsg").textContent = "Ready";
  renderTimer();
}));

/* ---------- cards ---------- */
let viewIdx = 0, flipped = false;

function addCardsFromNotes() {
  const topic = $("#topic").value.trim() || "General";
  const lines = $("#notes").value.split("\n");
  let added = 0, skipped = 0;
  lines.forEach((line) => {
    if (!line.trim()) return;
    const i = line.indexOf("|");
    if (i === -1) { skipped++; return; }
    const q = line.slice(0, i).trim(), a = line.slice(i + 1).trim();
    if (!q || !a) { skipped++; return; }
    cards.push({ id: uid(), topic, q, a, right: 0, wrong: 0 });
    added++;
  });
  saveCards();
  $("#notes").value = "";
  $("#cardMsg").textContent = added + " card(s) added" + (skipped ? ", " + skipped + " line(s) skipped (use Question | Answer)" : "") + ".";
  renderCards();
}
function loadSample() {
  const sample = [
    ["Physics", "Newton's second law?", "F = ma"],
    ["Physics", "SI unit of force?", "Newton (N)"],
    ["Physics", "Speed of light in vacuum?", "About 3 x 10^8 m/s"],
    ["Chemistry", "Atomic number of Carbon?", "6"],
    ["Chemistry", "pH of a neutral solution?", "7"],
    ["Maths", "Derivative of sin x?", "cos x"],
    ["Maths", "Value of pi (2 decimals)?", "3.14"]
  ];
  sample.forEach(([topic, q, a]) => cards.push({ id: uid(), topic, q, a, right: 0, wrong: 0 }));
  saveCards();
  $("#cardMsg").textContent = "Sample cards added.";
  renderCards();
}
function renderCards() {
  const viewer = $("#viewer");
  if (!cards.length) viewer.classList.add("hidden");
  else {
    viewer.classList.remove("hidden");
    if (viewIdx >= cards.length) viewIdx = 0;
    const c = cards[viewIdx];
    $("#flashText").textContent = flipped ? c.a : c.q;
    $("#flash").classList.toggle("flipped", flipped);
    $("#cardPos").textContent = (viewIdx + 1) + " / " + cards.length + " · " + c.topic;
  }
  const list = $("#cardList");
  list.textContent = "";
  cards.forEach((c) => {
    const li = document.createElement("li");
    const left = document.createElement("div");
    const tag = document.createElement("span"); tag.className = "tag"; tag.textContent = c.topic;
    const txt = document.createElement("span"); txt.textContent = c.q + " → " + c.a;
    left.append(tag, txt);
    const del = document.createElement("button");
    del.textContent = "×"; del.setAttribute("aria-label", "Delete card");
    del.addEventListener("click", () => { cards = cards.filter((x) => x.id !== c.id); saveCards(); renderCards(); });
    li.append(left, del);
    list.append(li);
  });
}
$("#addCards").addEventListener("click", addCardsFromNotes);
$("#sampleBtn").addEventListener("click", loadSample);
$("#flash").addEventListener("click", () => { flipped = !flipped; renderCards(); });
$("#nextCard").addEventListener("click", () => { viewIdx = (viewIdx + 1) % cards.length; flipped = false; renderCards(); });
$("#prevCard").addEventListener("click", () => { viewIdx = (viewIdx - 1 + cards.length) % cards.length; flipped = false; renderCards(); });

/* ---------- quiz ---------- */
let queue = [], qi = 0, score = 0;

function renderQuizTopics() {
  const sel = $("#quizTopic");
  const prev = sel.value;
  sel.textContent = "";
  const topics = [...new Set(cards.map((c) => c.topic))];
  const all = document.createElement("option"); all.value = ""; all.textContent = "All topics";
  sel.append(all);
  topics.forEach((t) => { const o = document.createElement("option"); o.value = t; o.textContent = t; sel.append(o); });
  sel.value = topics.includes(prev) ? prev : "";
}
function startQuiz() {
  const t = $("#quizTopic").value;
  const pool = cards.filter((c) => !t || c.topic === t);
  if (!pool.length) { $("#quizResult").textContent = "Add some cards first."; $("#quizBox").classList.add("hidden"); return; }
  queue = shuffle(pool); qi = 0; score = 0;
  $("#quizResult").textContent = "";
  $("#quizBox").classList.remove("hidden");
  showQuestion();
}
function showQuestion() {
  const c = queue[qi];
  $("#quizProgress").textContent = "Question " + (qi + 1) + " of " + queue.length + " · " + c.topic;
  $("#quizQ").textContent = c.q;
  $("#quizA").textContent = c.a;
  $("#quizA").classList.add("hidden");
  $("#showBtn").classList.remove("hidden");
  $("#gotBtn").classList.add("hidden");
  $("#missBtn").classList.add("hidden");
}
function revealAnswer() {
  $("#quizA").classList.remove("hidden");
  $("#showBtn").classList.add("hidden");
  $("#gotBtn").classList.remove("hidden");
  $("#missBtn").classList.remove("hidden");
}
function grade(ok) {
  const c = cards.find((x) => x.id === queue[qi].id);
  if (c) { ok ? c.right++ : c.wrong++; }
  if (ok) score++;
  saveCards();
  qi++;
  if (qi >= queue.length) {
    $("#quizBox").classList.add("hidden");
    const pct = Math.round((score / queue.length) * 100);
    $("#quizResult").textContent = "Finished! " + score + " / " + queue.length + " (" + pct + "%). Check Progress for weak topics.";
  } else showQuestion();
}
$("#startQuiz").addEventListener("click", startQuiz);
$("#showBtn").addEventListener("click", revealAnswer);
$("#gotBtn").addEventListener("click", () => grade(true));
$("#missBtn").addEventListener("click", () => grade(false));

/* ---------- progress ---------- */
function topicStats() {
  const map = {};
  cards.forEach((c) => {
    const s = map[c.topic] || (map[c.topic] = { topic: c.topic, right: 0, wrong: 0 });
    s.right += c.right; s.wrong += c.wrong;
  });
  return Object.values(map)
    .filter((s) => s.right + s.wrong > 0)
    .map((s) => ({ ...s, acc: Math.round((s.right / (s.right + s.wrong)) * 100) }))
    .sort((a, b) => a.acc - b.acc);
}
function streak() {
  let n = 0;
  const d = new Date();
  if (!log[d.toLocaleDateString("en-CA")]) d.setDate(d.getDate() - 1);
  while (log[d.toLocaleDateString("en-CA")]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
function renderProgress() {
  const stats = topicStats();
  const right = cards.reduce((a, c) => a + c.right, 0);
  const wrong = cards.reduce((a, c) => a + c.wrong, 0);
  $("#sMinutes").textContent = log[today()] || 0;
  $("#sStreak").textContent = streak();
  $("#sCards").textContent = cards.length;
  $("#sAcc").textContent = right + wrong ? Math.round((right / (right + wrong)) * 100) + "%" : "–";

  const weak = $("#weak");
  weak.textContent = "";
  if (!stats.length) {
    const p = document.createElement("p"); p.className = "muted"; p.textContent = "Take a quiz to see which topics need work.";
    weak.append(p);
  }
  stats.forEach((s) => {
    const row = document.createElement("div"); row.className = "bar-row";
    const label = document.createElement("div"); label.className = "bar-label";
    const n = document.createElement("span"); n.textContent = s.topic;
    const v = document.createElement("span"); v.textContent = s.acc + "%";
    label.append(n, v);
    const bar = document.createElement("div"); bar.className = "bar";
    const fill = document.createElement("i");
    fill.style.width = s.acc + "%";
    if (s.acc >= 75) fill.className = "ok"; else if (s.acc >= 50) fill.className = "mid";
    bar.append(fill);
    row.append(label, bar);
    weak.append(row);
  });

  let plan;
  const d = daysLeft();
  if (!cards.length) plan = "Add a few cards, then come back for your daily plan.";
  else {
    const focus = stats.length ? stats[0].topic : null;
    const perDay = d && d > 0 ? Math.ceil(cards.length / d) : cards.length;
    plan = "Review about " + perDay + " card(s) today" + (d && d > 0 ? " to finish before your exam in " + d + " day(s)" : "") + ". ";
    plan += focus ? "Start with your weakest topic: " + focus + "." : "Run a quiz to find your weak spots.";
  }
  $("#plan").textContent = plan;
}
$("#resetAll").addEventListener("click", () => {
  if (!confirm("Delete all cards, history and exam date?")) return;
  cards = []; log = {}; examDate = "";
  saveCards(); saveLog(); store.set("desky.exam", "");
  $("#examDate").value = "";
  renderCountdown(); renderToday(); renderProgress(); renderCards();
});

/* ---------- init ---------- */
renderCountdown();
renderTimer();
renderToday();
renderCards();