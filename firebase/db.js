import { ref, get, set } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js";
import { auth, db } from "./app.js";

export function currentUser() {
  return auth.currentUser;
}

function rankingPath(gameId, mode, userId) {
  const parts = ["rankings", gameId, mode || "normal"];
  if (userId) parts.push(String(userId));
  return parts.join("/");
}

/** rankings/{gameId}/{mode}/{userId} */
export function saveRanking(gameId, mode, userId, record) {
  if (!gameId || !userId) {
    return Promise.reject(new Error("gameId 와 userId 가 필요합니다."));
  }
  if (!auth.currentUser) {
    return Promise.reject(new Error("Firebase 로그인이 있어야 랭킹을 저장할 수 있습니다."));
  }
  return set(ref(db, rankingPath(gameId, mode, userId)), record);
}

export async function readRankings(gameId, mode) {
  if (!gameId) throw new Error("gameId 가 필요합니다.");
  const snap = await get(ref(db, rankingPath(gameId, mode)));
  return snap.exists() ? snap.val() : null;
}

export async function readRanking(gameId, mode, userId) {
  if (!gameId || !userId) throw new Error("gameId 와 userId 가 필요합니다.");
  const snap = await get(ref(db, rankingPath(gameId, mode, userId)));
  return snap.exists() ? snap.val() : null;
}
