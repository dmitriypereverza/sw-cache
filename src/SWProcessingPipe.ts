import {
  AsyncParallelHook,
  AsyncSeriesHook,
  AsyncSeriesWaterfallHook,
} from "tapable";
import throttle from "lodash/throttle";
import {
  getUnixTime,
  IndexDBStorage,
  RequestCacheRow,
} from "storage/IndexDBStorage";
import { assoc, pathEq } from "ramda";

import { RequestSerializerInterface } from "./services/requestSerializer";
import { getStickyPromisesBuilder } from "./libs/joinablePromises";

export interface SWPipePluginInterface {
  init: (hooks: HooksType) => void;
}
interface RequestCacheConfig extends Record<string, any> {
  url: string;
}

export interface HooksType {
  onInstall: AsyncParallelHook;
  onActive: AsyncParallelHook;
  onMessage: AsyncParallelHook;
  onFetch: AsyncParallelHook;
  onCachingRequest: AsyncSeriesHook;
  onPostRequestProcessing: AsyncSeriesHook<{
    fetchEventHash: string;
    request: Request;
    requestConfig: RequestCacheConfig;
  }>;
  onBackgroundTaskStart: AsyncParallelHook<{
    fetchEventHash?: string;
  }>;
  onBackgroundTaskEnd: AsyncParallelHook<{
    fetchEventHash?: string;
  }>;
  isNeedToSendCachedResponse: AsyncSeriesWaterfallHook<{
    fetchEventHash: string;
    request: Request;
    cacheInfo: RequestCacheRow;
    requestConfig: RequestCacheConfig;
    resultWeight: number;
  }>;
  isNeedToInvalidateCached: AsyncSeriesWaterfallHook<{
    fetchEventHash?: string;
    cacheInfo: RequestCacheRow;
    requestConfig: RequestCacheConfig;
    resultWeight: number;
  }>;
  onAfterFetch: AsyncParallelHook;
  onInsertCacheParams: AsyncSeriesWaterfallHook<{
    fetchEventHash?: string;
    params: any;
    cacheInfo: RequestCacheRow;
    requestConfig: RequestCacheConfig;
    isInvalidation?: boolean;
  }>;
}

interface InnerFetchInterface {
  isExecute: (key: string) => boolean;
  run: (
    promiseHandler: (
      resolve: (data: any) => void,
      reject?: (data: any) => void
    ) => void,
    key: string
  ) => Promise<any>;
}

export class SWProcessingPipe {
  private plugins: any[];
  private config: {
    list: RequestCacheConfig[];
  };
  private readonly hooks: HooksType;
  private readonly throttledFunc: any;

  private logClient: any;
  private innerFetch: InnerFetchInterface;

  constructor(
    private cacheId: string,
    private dataStorageService: IndexDBStorage,
    private requestSerializerService: RequestSerializerInterface
  ) {
    this.hooks = {
      onInstall: new AsyncParallelHook(),
      onActive: new AsyncParallelHook(),
      onMessage: new AsyncParallelHook(["type", "payload"]),
      onFetch: new AsyncParallelHook(["request"]),
      onCachingRequest: new AsyncSeriesHook(["request", "requestConfig"]),
      onPostRequestProcessing: new AsyncSeriesHook(["args"]),
      onBackgroundTaskStart: new AsyncParallelHook(["args"]),
      onBackgroundTaskEnd: new AsyncParallelHook(["args"]),
      isNeedToSendCachedResponse: new AsyncSeriesWaterfallHook(["args"]),
      isNeedToInvalidateCached: new AsyncSeriesWaterfallHook(["args"]),
      onAfterFetch: new AsyncParallelHook(["args"]),
      onInsertCacheParams: new AsyncSeriesWaterfallHook(["args"]),
    };

    this.innerFetch = getStickyPromisesBuilder();

    this.throttledFunc = throttle(
      (data) => this.checkInvalidateCandidates(data),
      3000,
      {
        trailing: true,
        leading: false,
      }
    );
    this.dataStorageService.load();
  }

  public setPlugins(plugins: SWPipePluginInterface[] = []) {
    this.plugins = plugins;
    this.plugins.forEach((plugin) => plugin.init(this.hooks));
  }

  public onInstall() {
    console.log("Установлен");
    this.hooks.onInstall.isUsed() && this.hooks.onInstall.callAsync();
  }

  public onActivate(_event: any) {
    console.log("Активирован");
    this.hooks.onActive.isUsed() && this.hooks.onActive.callAsync();
  }

  public async onMessage(type: string, payload: any, event) {
    this.hooks.onMessage.isUsed() &&
      this.hooks.onMessage.callAsync(type, payload);

    if (type === "logConnect" && event.ports[0]) {
      this.logClient = event.ports[0];
    }

    if (type === "config") {
      this.config = payload;
      this.deleteUnusedCache();
    }
  }

  private async deleteUnusedCache() {
    const cacheStorage = await caches.open(this.cacheId);
    cacheStorage.keys().then((cacheNames) =>
      cacheNames.forEach((cachedRequest) => {
        if (!this.getRequestConfig(cachedRequest.url)) {
          caches.delete(cachedRequest.url);
          this.dataStorageService.deleteRequestCacheInfo(cachedRequest.url);
        }
      })
    );
  }

  public onFetchEvent(event: any) {
    const fetchEventHash = Math.random().toString(36);
    this.hooks.onFetch.isUsed() &&
      this.hooks.onFetch.promise(fetchEventHash, event.request);

    if (!this.config) return;
    const requestConfig = this.getRequestConfig(event.request.url);
    if (!requestConfig) {
      event.waitUntil(this.throttledFunc());
      return;
    }

    event.respondWith(
      this.runCachedRequestPipe(
        fetchEventHash,
        event.request,
        requestConfig
      ).then((response) => {
        event.waitUntil(
          Promise.all([
            this.hooks.onPostRequestProcessing.isUsed()
              ? this.hooks.onPostRequestProcessing.promise({
                  fetchEventHash,
                  request: event.request,
                  requestConfig,
                })
              : Promise.resolve(),
            this.checkInvalidateCandidates(fetchEventHash, event.request.url),
          ])
        );
        return response;
      })
    );
    event.waitUntil(this.throttledFunc());
  }

  public async runCachedRequestPipe(
    fetchEventHash,
    request,
    requestConfig: RequestCacheConfig
  ) {
    const cacheStorage = await caches.open(this.cacheId);
    const cachedEl = await cacheStorage.match(request);
    const cacheInfo = await this.dataStorageService.getRequestCacheInfo(
      request.url
    );

    if (this.innerFetch.isExecute(request.url)) {
      this.logClient &&
        this.logClient.postMessage({
          url: request.url,
          type: "joinedRequest",
        });
      return this.executeRequest(() => fetch(request), request.url);
    }

    await this.dataStorageService.createOrUpdateRequestCache(
      request.url,
      assoc("status", "pending", cacheInfo)
    );

    if (cachedEl) {
      if (!this.hooks.isNeedToSendCachedResponse.isUsed()) {
        return cachedEl;
      }
      const {
        resultWeight,
      } = await this.hooks.isNeedToSendCachedResponse.promise({
        fetchEventHash,
        request,
        cacheInfo,
        requestConfig,
        resultWeight: 0,
      });
      if (resultWeight > 0) {
        this.logClient &&
          this.logClient.postMessage({
            url: request.url,
            type: "fromCache",
          });
        await this.dataStorageService.createOrUpdateRequestCache(
          request.url,
          assoc("status", "none", cacheInfo)
        );
        return cachedEl;
      }
    }

    this.logClient &&
      this.logClient.postMessage({
        url: request.url,
        type: "executeRequest",
      });
    const response = await this.executeRequest(
      () => fetch(request),
      request.url
    );

    await this.updateRequestCache({
      fetchEventHash,
      url: request.url,
      status: "none",
      options: await this.requestSerializerService.serialize(request),
      requestConfig,
      response: response.clone(),
      isInvalidation: false,
    });

    return response;
  }

  async checkInvalidateCandidates(
    fetchEventHash?: string,
    currentUrl?: string
  ) {
    if (this.hooks.onBackgroundTaskStart.isUsed()) {
      this.hooks.onBackgroundTaskStart.call({ fetchEventHash });
    }

    const isNeedToInvalidateRequest = async (
      requestConfig,
      respCache,
      cacheInfo
    ): Promise<boolean> => {
      if (!requestConfig || !respCache) {
        return false;
      }
      if (!this.hooks.isNeedToInvalidateCached.isUsed()) return false;
      const {
        resultWeight,
      } = await this.hooks.isNeedToInvalidateCached.promise({
        fetchEventHash,
        cacheInfo,
        requestConfig,
        resultWeight: 0,
      });
      return resultWeight > 0;
    };

    const cacheList = await this.dataStorageService.getAllRequestCacheInfo();
    for (let cacheInfo of cacheList) {
      if (currentUrl && currentUrl === cacheInfo.url) {
        continue;
      }

      const isRequestExecuting = pathEq(["status"], "pending", cacheInfo);
      if (isRequestExecuting) {
        return;
      }

      await this.dataStorageService.createOrUpdateRequestCache(
        cacheInfo.url,
        assoc("status", "pending", cacheInfo)
      );

      const cache = await caches.open(this.cacheId);
      const respCache = await cache.match(cacheInfo.url);
      const requestConfig = this.getRequestConfig(cacheInfo.url);
      const needInvalidate = await isNeedToInvalidateRequest(
        requestConfig,
        respCache,
        cacheInfo
      );

      if (!needInvalidate) {
        await this.dataStorageService.createOrUpdateRequestCache(
          cacheInfo.url,
          assoc("status", "none", cacheInfo)
        );
        continue;
      }
      this.logClient &&
        this.logClient.postMessage({
          url: cacheInfo.url,
          type: "invalidate",
        });

      this.executeRequest(
        () => fetch(cacheInfo.url, JSON.parse(cacheInfo.options)),
        cacheInfo.url
      ).then((response) => {
        this.updateRequestCache({
          fetchEventHash,
          url: cacheInfo.url,
          status: "none",
          options: cacheInfo.options,
          requestConfig,
          response,
          isInvalidation: true,
        });
      });
    }

    if (this.hooks.onBackgroundTaskEnd.isUsed()) {
      this.hooks.onBackgroundTaskEnd.callAsync({ fetchEventHash });
    }
  }

  async updateRequestCache({
    fetchEventHash,
    requestConfig,
    url,
    options,
    status,
    response,
    isInvalidation,
  }: {
    fetchEventHash: string;
    url: string;
    status: string;
    options: string;
    requestConfig: RequestCacheConfig;
    response: Response;
    isInvalidation?: boolean;
  }) {
    let params = {
      url,
      status,
      options,
      timestamp: getUnixTime(),
    };

    const cacheInfo = await this.dataStorageService.getRequestCacheInfo(url);
    if (this.hooks.onInsertCacheParams.isUsed()) {
      const {
        params: extendedParam,
      } = await this.hooks.onInsertCacheParams.promise({
        fetchEventHash,
        cacheInfo,
        params,
        requestConfig,
        isInvalidation,
      });
      params = extendedParam;
    }

    // noinspection ES6MissingAwait
    this.dataStorageService.createOrUpdateRequestCache(url, params as any);
    // noinspection ES6MissingAwait
    (await caches.open(this.cacheId)).put(url, response);
  }

  private getRequestConfig(url: any): RequestCacheConfig | null {
    return this.config.list.find((conf) => url.match(conf.url));
  }

  private executeRequest(
    promiseFunc: () => Promise<Response>,
    url: string
  ): Promise<Response> {
    return this.innerFetch
      .run((resolve, reject) => promiseFunc().then(resolve, reject), url)
      .then((response) => response.clone());
  }
}
