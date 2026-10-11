import { currentUser, readRanking, saveRanking } from "../firebase/db.js";
import { seoulDay, nickname } from "./common.js";

export async function recordResult({ gameId, mode, won, metric }) {
  const user = currentUser();
  if (!user) {
    return { saved: false, reason: "Firebase 로그인이 있어야 랭킹이 저장됩니다." };
  }
  const day = seoulDay();
  const prev = (await readRanking(gameId, mode || "normal", user.uid)) || {};
  const streak = won ? (Number(prev.streak) || 0) + 1 : 0;
  const hasMetric = metric != null && metric !== "";
  const record = {
    nickname: nickname() || prev.nickname || "플레이어",
    plays: (Number(prev.plays) || 0) + 1,
    wins: (Number(prev.wins) || 0) + (won ? 1 : 0),
    streak,
    bestStreak: Math.max(Number(prev.bestStreak) || 0, streak),
    metricSum: (Number(prev.metricSum) || 0) + (hasMetric ? Number(metric) : 0),
    metricN: (Number(prev.metricN) || 0) + (hasMetric ? 1 : 0),
    today: day,
    todayWon: !!won,
    todayMetric: hasMetric ? Number(metric) : null,
    updatedAt: Date.now(),
  };
  await saveRanking(gameId, mode || "normal", user.uid, record);
  return { saved: true, record };
}
