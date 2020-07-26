import { DataStorageInterface, RequestLog } from "../index";

export function getUnixTime() {
  return Math.round(new Date().getTime() / 1000);
}

interface RequestCacheRow {
  url: string;
  options: string;
  timestamp: number;
  expireTime: number;
  invalidateTime: number;
  invalidateCount: number;
}

export class IndexDBStorage implements DataStorageInterface {
  private db: IDBDatabase;

  constructor() {
    this.load();
  }

  public load() {
    return new Promise<IDBDatabase>((resolve, reject) => {
      if (this.db) resolve(this.db);
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
        this.db = event.target.result;
        // @ts-ignore
        resolve(event.target.result);
      };
      dbReq.onerror = (event: any) =>
        reject("error opening database " + event.target.errorCode);
    });
  }

  public getLastRequestsByFromTime(seconds: number): Promise<RequestLog[]> {
    return new Promise<RequestLog[]>((resolve, reject) => {
      const tx = this.db.transaction(["requests"], "readonly");
      const lastRequests = tx
        .objectStore("requests")
        .index("timestamp")
        .getAll(IDBKeyRange.lowerBound(getUnixTime() - seconds));

      lastRequests.onsuccess = function () {
        if (!lastRequests.result || !lastRequests.result.length) {
          resolve([]);
          return;
        }
        resolve(lastRequests.result);
      };
      lastRequests.onerror = function (event: any) {
        reject(event.target.errorCode);
      };
    });
  }

  public getMarkovRowByUrl(url: string): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
      const tx = this.db.transaction(["markov_map"], "readonly");
      const markovMap = tx.objectStore("markov_map");
      const markovQuery = markovMap.get(url);

      markovQuery.onsuccess = function (markovEvent: any) {
        const markovElement = markovEvent.target.result;
        resolve(markovElement);
      };
      markovQuery.onerror = function (event: any) {
        reject(event.target.errorCode);
      };
    });
  }

  public createRequestLog(url: string): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      const tx = this.db.transaction(["requests"], "readwrite");
      const requests = tx.objectStore("requests");

      const requestsQuery = requests.add({
        url: url,
        timestamp: getUnixTime(),
      });
      requestsQuery.onsuccess = function (ev: any) {
        resolve(!!ev.target.result);
      };
      requestsQuery.onerror = function (event: any) {
        reject(event.target.errorCode);
      };
    });
  }

  public createOrUpdateMarkovRow(
    currentUrl: string,
    data: Record<string, Record<string, string[]>>,
  ): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      const tx = this.db.transaction(["markov_map"], "readwrite");
      const markovMap = tx.objectStore("markov_map");
      const markovQuery = markovMap.put(data, currentUrl);

      markovQuery.onsuccess = function (markovEvent: any) {
        const markovElement = !!markovEvent.target.result;
        resolve(markovElement);
      };
      markovQuery.onerror = function (event: any) {
        reject(event.target.errorCode);
      };
    });
  }

  public getRequestCacheInfo(currentUrl: string): Promise<RequestCacheRow> {
    return new Promise<RequestCacheRow>((resolve, reject) => {
      const tx = this.db.transaction(["requests_cache"], "readonly");
      const requestsCacheStore = tx.objectStore("requests_cache");
      const requestsCacheQuery = requestsCacheStore.get(currentUrl);

      requestsCacheQuery.onsuccess = function (ev: any) {
        resolve(ev.target.result);
      };
      requestsCacheQuery.onerror = function (event: any) {
        reject(event.target.errorCode);
      };
    });
  }

  public getAllRequestCacheInfo(): Promise<RequestCacheRow[]> {
    return new Promise<RequestCacheRow[]>((resolve, reject) => {
      const tx = this.db.transaction(["requests_cache"], "readonly");
      const requestsCacheStore = tx.objectStore("requests_cache");
      const requestsCacheQuery = requestsCacheStore.getAll();
      requestsCacheQuery.onsuccess = function (ev: any) {
        resolve(ev.target.result);
      };
      requestsCacheQuery.onerror = function (event: any) {
        reject(event.target.errorCode);
      };
    });
  }

  public createOrUpdateRequestCache(
    currentUrl: string,
    data: RequestCacheRow,
  ): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      const tx = this.db.transaction(["requests_cache"], "readwrite");
      const requestsCacheStore = tx.objectStore("requests_cache");
      const requestsCacheQuery = requestsCacheStore.put(data, currentUrl);

      requestsCacheQuery.onsuccess = function (ev: any) {
        resolve(!!ev.target.result);
      };
      requestsCacheQuery.onerror = function (event: any) {
        reject(event.target.errorCode);
      };
    });
  }
}
