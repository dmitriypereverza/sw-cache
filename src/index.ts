import throttle from "lodash/throttle";

import diContainer from "./di";
import { getUnixTime } from "./storage/IndexDBStorage";

const throttledCheckInvalidateCandidates = throttle(
  checkInvalidateCandidates,
  2000,
  { trailing: true, leading: false },
);

const rangeTimeForRelatedRequests = 30;
const CACHE = "v1";

const dataStorageService = diContainer.get("dataStorageService");
const requestSerializerService = diContainer.get("requestSerializerService");

interface RequestCacheConfig {
  url: string;
  expireTime: number;
  invalidateTime: number;
}

let config: {
  list: RequestCacheConfig[];
} = null;

self.addEventListener("install", async () => {
  await dataStorageService.load();
  console.log("Установлен");
});

self.addEventListener("activate", () => {
  console.log("Активирован");
});

self.addEventListener("message", (event: any) => {
  if (event.data && event.data.type === "config") {
    config = event.data.payload;
  }
});

self.addEventListener("fetch", async (event: any) => {
  if (!config) return;
  const reqConfig = config.list.find((conf) =>
    event.request.url.match(conf.url),
  );
  if (reqConfig) {
    event.respondWith(runRequestPipe(event.request, reqConfig));
    event.waitUntil(postRequestProcessing(event.request));
  }
  event.waitUntil(throttledCheckInvalidateCandidates());
});

async function updateRequestCache({
  requestConfig,
  url,
  options,
  response,
  isInvalidation,
}: {
  url: string;
  options: string;
  requestConfig: RequestCacheConfig;
  response: Response;
  isInvalidation?: boolean;
}) {
  const cache = await caches.open(CACHE);
  let params = {
    url: url,
    options: options,
    timestamp: getUnixTime(),
    expireTime: getUnixTime() + requestConfig.expireTime,
    invalidateTime: getUnixTime() + requestConfig.invalidateTime,
  };
  if (isInvalidation) {
    const cacheInfo = await dataStorageService.getRequestCacheInfo(url);
    if (cacheInfo && cacheInfo.invalidateCount) {
      params["invalidateCount"] = cacheInfo.invalidateCount + 1;
    } else {
      params["invalidateCount"] = 1;
    }
  }

  dataStorageService.createOrUpdateRequestCache(url, params as any);
  cache.put(url, response);
}

async function runRequestPipe(request, requestConfig: RequestCacheConfig) {
  const cache = await caches.open(CACHE);
  const cachedEl = await cache.match(request);
  const cacheInfo = await dataStorageService.getRequestCacheInfo(request.url);

  if (cachedEl && cacheInfo && getUnixTime() < cacheInfo.expireTime) {
    return cachedEl;
  }
  const response = await fetch(request);

  updateRequestCache({
    url: request.url,
    options: await requestSerializerService.serialize(request),
    requestConfig,
    response: response.clone(),
  });
  return response;
}

async function postRequestProcessing(request: any) {
  dataStorageService.createRequestLog(request.url).catch(console.error);
  updateMarkovStats(request).catch(console.error);
}

async function updateMarkovStats(request) {
  const lastRequests = await dataStorageService.getLastRequestsByFromTime(
    rangeTimeForRelatedRequests,
  );
  const markovRow = await dataStorageService.getMarkovRowByUrl(request.url);
  const stat = lastRequests.reduce((acc, req) => {
    if (!acc[req.url]) {
      acc[req.url] = 1;
    } else {
      acc[req.url] += 1;
    }
    return acc;
  }, markovRow || {});
  await dataStorageService.createOrUpdateMarkovRow(request.url, stat);
}

async function checkInvalidateCandidates() {
  const cache = await caches.open(CACHE);
  const cacheList = await dataStorageService.getAllRequestCacheInfo();

  for (let cacheEl of cacheList) {
    let respCache = await cache.match(cacheEl.url);

    console.log('url', cacheEl.url);
    console.log('invalidateTime left', cacheEl.invalidateTime - getUnixTime());
    console.log('expireTime left', cacheEl.expireTime - getUnixTime());
    console.log('invalidateCount', cacheEl.invalidateCount);
    console.log('   ');

    const requestConfig = config.list.find((conf) =>
      cacheEl.url.match(conf.url),
    );
    if (requestConfig && respCache && getUnixTime() < cacheEl.invalidateTime) {
      continue;
    }

    fetch(cacheEl.url, JSON.parse(cacheEl.options)).then((response) => {
      updateRequestCache({
        url: cacheEl.url,
        options: cacheEl.options,
        requestConfig,
        response,
        isInvalidation: true,
      });
    });
  }
}
