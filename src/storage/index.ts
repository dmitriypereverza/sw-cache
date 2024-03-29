import { RequestCacheRow } from "./IndexDBStorage";

export interface RequestLog {
  url: string;
  timestamp: number;
}

export interface DataStorageInterface {
  load(): Promise<any>;
  getLastRequestsByFromTime(seconds: number): Promise<RequestLog[]>;
  getMarkovRowByUrl(url: string): Promise<Record<string, number>>;
  getRequestCacheInfo(currentUrl: string): Promise<RequestCacheRow>;
  getAllRequestCacheInfo(): Promise<RequestCacheRow[]>;
  createOrUpdateRequestCache(
    currentUrl: string,
    data: RequestCacheRow,
  ): Promise<boolean>;

  createRequestLog(url: string);
  createOrUpdateMarkovRow(
    currentUrl: string,
    data: Record<string, number>,
  ): Promise<boolean>;
}
