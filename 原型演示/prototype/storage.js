(function () {
  var KEY = "yiting-mediation-records";

  function seeds() {
    return (window.PrototypeData && window.PrototypeData.seeds) || [];
  }

  function readRaw() {
    try {
      var parsed = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function list() {
    var byId = new Map();
    seeds().forEach(function (seed) { byId.set(seed.id, seed); });
    readRaw().forEach(function (record) {
      if (!byId.has(record.id)) byId.set(record.id, record);
    });
    return Array.from(byId.values()).sort(function (a, b) {
      return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;
    });
  }

  function customRecords() {
    return readRaw().filter(function (item) {
      return !seeds().some(function (seed) { return seed.id === item.id; });
    });
  }

  function append(record) {
    var custom = customRecords();
    custom.push(record);
    localStorage.setItem(KEY, JSON.stringify(custom));
    return list();
  }

  function get(id) {
    return list().find(function (item) { return item.id === id; }) || null;
  }

  function update(id, patch) {
    var custom = customRecords();
    var index = -1;
    custom.forEach(function (item, i) {
      if (item.id === id) index = i;
    });
    if (index < 0) return null;
    custom[index] = Object.assign({}, custom[index], patch);
    localStorage.setItem(KEY, JSON.stringify(custom));
    return custom[index];
  }

  function formatTime(iso) {
    var parts = new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(new Date(iso));
    function pick(type) {
      var found = parts.find(function (part) { return part.type === type; });
      return found ? found.value : "";
    }
    return pick("year") + "-" + pick("month") + "-" + pick("day") + " " + pick("hour") + ":" + pick("minute");
  }

  function money(amount, empty) {
    return amount == null ? empty : amount + "元";
  }

  window.MediationStorage = {
    list: list,
    get: get,
    append: append,
    update: update,
    formatTime: formatTime,
    money: money,
    key: KEY
  };
})();
