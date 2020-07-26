const rangeTimeForRelatedRequests = 60 * 2;
const CACHE = "v1";

self.addEventListener("install", () => {
  console.log("Установлен");
});

self.addEventListener("activate", () => {
  console.log("Активирован");
});

self.addEventListener("fetch", (event: any) => {
  if (
    !event.request.url.match(/.\/api\/./) ||
    event.request.method === "POST"
  ) {
    return;
  }

  event.respondWith(fromCache(event.request).catch(() => fetch(event.request)));
  event.waitUntil(update(event.request));

  dbConnect().then(async (db) => {
    const tx = db.transaction(["requests", "markov_map"], "readwrite");
    const markovMap = tx.objectStore("markov_map");
    const requests = tx.objectStore("requests");

    requests.add({
      url: event.request.url,
      timestamp: getUnixTime(),
    });

    const lastRequests = requests
      .index("timestamp")
      .getAll(
        IDBKeyRange.lowerBound(getUnixTime() - rangeTimeForRelatedRequests),
      );

    lastRequests.onsuccess = function () {
      if (!lastRequests.result || !lastRequests.result.length) {
        return;
      }
      markovMap.get(event.request.url).onsuccess = function (markovEvent: any) {
        const markovElement = markovEvent.target.result;
        const stat = lastRequests.result.reduce((acc, req) => {
          if (!acc[req.url]) {
            acc[req.url] = 1;
          } else {
            acc[req.url] += 1;
          }
          return acc;
        }, markovElement || {});
        markovMap.put(stat, event.request.url);
      };
    };
  });
});

function fromCache(request) {
  return caches
    .open(CACHE)
    .then((cache) =>
      cache
        .match(request)
        .then((matching) => matching || Promise.reject("no-match")),
    );
}

function update(request) {
  return caches
    .open(CACHE)
    .then((cache) =>
      fetch(request).then((response) => cache.put(request, response)),
    );
}

function getUnixTime() {
  return Math.round(new Date().getTime() / 1000);
}

function dbConnect() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const dbReq = indexedDB.open("kss-portal", 1);
    dbReq.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      db.createObjectStore("markov_map");
      db.createObjectStore("requests_cache");
      db.createObjectStore("requests", { autoIncrement: true }).createIndex(
        "timestamp",
        "timestamp",
      );
    };
    dbReq.onsuccess = (event) => {
      // @ts-ignore
      resolve(event.target.result);
    };
    dbReq.onerror = (event: any) => {
      reject("error opening database1 " + event.target.errorCode);
    };
  });
}
