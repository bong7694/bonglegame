(function () {
  const game = window.BONGLE_ROOM_GAME || "drawing";
  const orig = window.fetch.bind(window);
  const core = import("../firebase/room-core.js");
  window.fetch = function (input, init) {
    const url = typeof input === "string" ? input : (input && input.url) || "";
    if (url.indexOf("api.php") === -1) return orig(input, init);
    return core.then((mod) => mod.handleRoomRequest(game, url, init || {}));
  };
})();
