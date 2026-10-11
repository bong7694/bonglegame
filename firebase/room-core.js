import { ref, get, set, update } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js";
import { db } from "./app.js";

const ROOM_TTL = 7200;

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

function itemsPath(game) {
  return "rooms/" + game + "/items";
}

function chatsPath(game, roomId) {
  return "rooms/" + game + "/chats/" + roomId;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function readItems(game) {
  const snap = await get(ref(db, itemsPath(game)));
  const val = snap.exists() ? snap.val() : {};
  return val && typeof val === "object" ? val : {};
}

async function writeRoom(game, room) {
  room.lastUpdate = nowSec();
  await set(ref(db, itemsPath(game) + "/" + room.id), room);
  return room;
}

function publicRoom(room) {
  if (!room) return null;
  const copy = { ...room };
  delete copy.password;
  return copy;
}

function freshItems(items) {
  const now = nowSec();
  const out = {};
  Object.keys(items).forEach((id) => {
    const room = items[id];
    if (!room || typeof room !== "object") return;
    const last = Number(room.lastUpdate) || 0;
    if (now - last < ROOM_TTL) out[id] = room;
  });
  return out;
}

async function pushChat(game, roomId, message) {
  const path = chatsPath(game, roomId);
  const snap = await get(ref(db, path));
  const list = snap.exists() && Array.isArray(snap.val()) ? snap.val() : [];
  list.push(message);
  const trimmed = list.slice(-100);
  await set(ref(db, path), trimmed);
  await update(ref(db, itemsPath(game) + "/" + roomId), { lastUpdate: nowSec() });
}

async function parseBody(init) {
  if (!init || !init.body) return {};
  const raw = typeof init.body === "string" ? init.body : await new Response(init.body).text();
  const type = (init.headers && (init.headers["Content-Type"] || init.headers["content-type"])) || "";
  if (String(type).includes("application/json")) {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  const params = new URLSearchParams(raw);
  const data = {};
  params.forEach((value, key) => {
    if ((value.startsWith("{") && value.endsWith("}")) || (value.startsWith("[") && value.endsWith("]"))) {
      try {
        data[key] = JSON.parse(value);
        return;
      } catch {
        /* keep string */
      }
    }
    data[key] = value;
  });
  return data;
}

async function handleDrawing(game, action, input, query) {
  if (action === "getRooms") {
    const items = freshItems(await readItems(game));
    const rooms = Object.values(items).map((room) => ({
      id: room.id,
      name: room.name || "방",
      hostName: room.hostName || "???",
      playerCount: (room.players || []).length,
      maxPlayers: room.maxPlayers || 8,
      isPrivate: !!room.password,
      mode: room.mode || "hint",
      gameStarted: !!room.gameStarted,
    }));
    return json({ success: true, rooms });
  }

  if (action === "getRoom") {
    const roomId = query.get("roomId") || input.roomId || "";
    const items = await readItems(game);
    const room = items[roomId];
    if (!room) return json({ success: false, error: "Room not found" });
    return json({ success: true, room: publicRoom(room) });
  }

  if (action === "getChat") {
    const roomId = query.get("roomId") || "";
    const since = Number(query.get("since") || 0);
    const snap = await get(ref(db, chatsPath(game, roomId)));
    const all = snap.exists() && Array.isArray(snap.val()) ? snap.val() : [];
    return json({ success: true, messages: all.filter((msg) => Number(msg.timestamp) > since) });
  }

  if (action === "createRoom") {
    const roomId = "room_" + Date.now() + "_" + Math.random().toString(16).slice(2, 8);
    const room = {
      id: roomId,
      name: input.name || "새 방",
      hostId: input.hostId || "",
      hostName: input.hostName || "???",
      password: input.password || "",
      maxPlayers: Number(input.maxPlayers || 8),
      mode: input.mode || "hint",
      timeLimit: 60,
      totalRounds: 3,
      players: [{ id: input.hostId, name: input.hostName, isHost: true, score: 0 }],
      gameStarted: false,
      gameState: null,
      lastUpdate: nowSec(),
    };
    await writeRoom(game, room);
    return json({ success: true, room: publicRoom(room) });
  }

  if (action === "joinRoom") {
    const items = await readItems(game);
    const room = items[input.roomId];
    if (!room) return json({ success: false, error: "Room not found" });
    if (room.password && room.password !== (input.password || "")) {
      return json({ success: false, error: "비밀번호가 틀립니다" });
    }
    const players = Array.isArray(room.players) ? room.players : [];
    if (players.length >= (room.maxPlayers || 8) && !players.some((p) => p.id === input.playerId)) {
      return json({ success: false, error: "방이 가득 찼습니다" });
    }
    const isSpectator = !!room.gameStarted;
    const found = players.find((p) => p.id === input.playerId);
    if (found) found.name = input.playerName || found.name;
    else {
      players.push({
        id: input.playerId,
        name: input.playerName || "???",
        isHost: false,
        score: 0,
        isSpectator,
      });
      await pushChat(game, room.id, {
        id: Date.now().toString(36),
        sender: "System",
        message: isSpectator
          ? (input.playerName || "플레이어") + "님이 관전자로 입장했습니다. (게임 종료 후 참가 가능)"
          : (input.playerName || "플레이어") + "님이 입장했습니다.",
        isSystem: true,
        timestamp: nowSec(),
      });
    }
    room.players = players;
    await writeRoom(game, room);
    return json({ success: true, room: publicRoom(room) });
  }

  if (action === "leaveRoom") {
    const items = await readItems(game);
    const room = items[input.roomId];
    if (!room) return json({ success: true });
    const players = (room.players || []).filter((p) => p.id !== input.playerId);
    const isHost = room.hostId === input.playerId;
    if (!players.length || isHost) {
      await set(ref(db, itemsPath(game) + "/" + room.id), null);
    } else {
      room.players = players;
      await writeRoom(game, room);
    }
    return json({ success: true });
  }

  if (action === "updateRoom") {
    const items = await readItems(game);
    const room = items[input.roomId];
    if (!room) return json({ success: false, error: "Room not found" });
    const data = input.roomData && typeof input.roomData === "object" ? input.roomData : {};
    Object.keys(data).forEach((key) => {
      if (key !== "password" && key !== "id") room[key] = data[key];
    });
    await writeRoom(game, room);
    return json({ success: true });
  }

  if (action === "startGame") {
    const items = await readItems(game);
    const room = items[input.roomId];
    if (!room) return json({ success: false, error: "Room not found" });
    if (room.hostId !== input.playerId) return json({ success: false, error: "방장만 게임을 시작할 수 있습니다" });
    if ((room.players || []).length < 2) return json({ success: false, error: "최소 2명이 필요합니다" });
    room.gameStarted = true;
    await writeRoom(game, room);
    await pushChat(game, room.id, {
      id: Date.now().toString(36),
      sender: "System",
      message: "게임이 시작되었습니다!",
      isSystem: true,
      timestamp: nowSec(),
    });
    return json({ success: true });
  }

  if (action === "chat") {
    await pushChat(game, input.roomId, {
      id: Date.now().toString(36),
      sender: input.isSystem ? "System" : input.playerName || "???",
      message: input.message || "",
      isSystem: !!input.isSystem,
      timestamp: nowSec(),
    });
    return json({ success: true });
  }

  return json({ success: false, error: "Unknown action: " + action });
}

async function handleGangster(game, action, input) {
  if (!action) {
    const items = freshItems(await readItems(game));
    return json({ success: true, rooms: Object.values(items).map(publicRoom) });
  }

  if (action === "createRoom") {
    const room = input.room && typeof input.room === "object" ? input.room : null;
    if (!room || !room.id) return json({ success: false, error: "Invalid data format" });
    room.lastUpdate = nowSec();
    await writeRoom(game, room);
    return json({ success: true, room: publicRoom(room) });
  }

  if (action === "updateRoom") {
    const room = input.room;
    if (!room || !room.id) return json({ success: false, error: "Room not found" });
    const items = await readItems(game);
    const prev = items[room.id];
    if (!prev) return json({ success: false, error: "Room not found" });
    if (prev.password) room.password = prev.password;
    await writeRoom(game, room);
    return json({ success: true });
  }

  if (action === "getRoom") {
    const items = await readItems(game);
    const room = items[input.roomId];
    if (!room) return json({ success: false, error: "Room not found", room: null });
    return json({ success: true, room: publicRoom(room) });
  }

  if (action === "deleteRoom") {
    await set(ref(db, itemsPath(game) + "/" + input.roomId), null);
    return json({ success: true });
  }

  if (action === "joinRoom") {
    const items = await readItems(game);
    const room = items[input.roomId];
    if (!room) return json({ success: false, error: "Room not found" });
    if (room.isPrivate && room.password && room.password !== (input.password || "")) {
      return json({ success: false, error: "Wrong password" });
    }
    room.playerIds = Array.isArray(room.playerIds) ? room.playerIds : [];
    room.players = Array.isArray(room.players) ? room.players : [];
    if (room.playerIds.length >= 6 && !room.playerIds.includes(input.playerId)) {
      return json({ success: false, error: "Room is full" });
    }
    if (!room.playerIds.includes(input.playerId)) {
      room.playerIds.push(input.playerId);
      room.players.push({ id: input.playerId, name: input.playerName, isBot: false });
    }
    await writeRoom(game, room);
    return json({ success: true, room: publicRoom(room) });
  }

  if (action === "sendChat") {
    const message = {
      id: Date.now().toString(36),
      sender: input.sender,
      message: input.message,
      isSystem: !!input.isSystem,
      isEmoji: !!input.isEmoji,
      timestamp: nowSec(),
    };
    await pushChat(game, input.roomId, message);
    return json({ success: true, message });
  }

  if (action === "getChats") {
    const since = Number(input.since || 0);
    const snap = await get(ref(db, chatsPath(game, input.roomId)));
    const all = snap.exists() && Array.isArray(snap.val()) ? snap.val() : [];
    return json({ success: true, messages: all.filter((msg) => Number(msg.timestamp) > since) });
  }

  return json({ success: false, error: "Unknown action: " + action });
}

export async function handleRoomRequest(game, url, init) {
  try {
    const parsed = new URL(url, location.href);
    const input = (init && init.method === "POST") || (init && init.body) ? await parseBody(init) : {};
    const action = parsed.searchParams.get("action") || input.action || "";
    if (game === "gangster") return await handleGangster(game, action, input);
    return await handleDrawing(game, action, input, parsed.searchParams);
  } catch (err) {
    return json({ success: false, error: err && err.message ? err.message : "firebase error" }, 500);
  }
}
