export function seoulDay(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function hashStr(text) {
  let h = 2166136261;
  const s = String(text);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function nickname() {
  return (localStorage.getItem("bongle_nick") || "").trim();
}

export function setNickname(name) {
  const nick = String(name || "").trim();
  if (nick) localStorage.setItem("bongle_nick", nick);
  return nick;
}

export const GAMES = [
  { id: "gangster", title: "갱스터", emoji: "🎰", desc: "칩으로 승부", higherBetter: true, metric: (v) => (v == null ? "-" : Math.round(v) + "점"), modes: [{ id: "normal", label: "일반" }] },
  { id: "drawing", title: "드로잉", emoji: "🎨", desc: "그림 맞추기", higherBetter: true, metric: (v) => (v == null ? "-" : Math.round(v) + "점"), modes: [{ id: "normal", label: "일반" }] },
  { id: "simcheong", title: "심청", emoji: "👁️", desc: "요괴 토벌", higherBetter: true, metric: (v) => (v == null ? "-" : Math.round(v) + " HP"), modes: [{ id: "normal", label: "일반" }, { id: "challenge", label: "지옥" }] },
  { id: "hundoku", title: "훈도쿠", emoji: "😎", desc: "훈남 찾기", higherBetter: false, metric: (v) => (v == null ? "-" : Number(v).toFixed(1) + "점"), modes: [{ id: "normal", label: "일반" }, { id: "challenge", label: "챌린지" }] },
  { id: "glbaseball", title: "글야구", emoji: "🔤", desc: "한글 자모 야구", higherBetter: false, metric: (v) => (v == null ? "-" : Number(v).toFixed(1) + "회"), modes: [{ id: "normal", label: "일반" }, { id: "challenge", label: "챌린지" }] },
];

export function gameById(id) {
  return GAMES.find((g) => g.id === id) || GAMES[0];
}
