
export interface RequestLog {
  url: string;
  timestamp: number;
}

export interface DataStorageInterface {
  load(): Promise<IDBDatabase>;
  getLastRequestsByFromTime(seconds: number): Promise<RequestLog[]>;
  getMarkovRowByUrl(url: string): Promise<string[]>;

  createRequestLog(url: string);
  createOrUpdateMarkovRow(currentUrl: string, data: Record<string, Record<string, string[]>>): Promise<boolean>
}
