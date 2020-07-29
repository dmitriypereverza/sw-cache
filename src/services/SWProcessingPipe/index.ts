import {
  AsyncParallelHook,
  AsyncSeriesHook,
  AsyncSeriesWaterfallHook,
} from "tapable";
import throttle from "lodash/throttle";
import { DataStorageInterface } from "storage";
import { getUnixTime, RequestCacheRow } from "storage/IndexDBStorage";

import { RequestSerializerInterface } from "../requestSerializer";

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
    request: Request;
    requestConfig: RequestCacheConfig;
  }>;
  onBackgroundTask: AsyncParallelHook;
  isNeedToSendCachedResponse: AsyncSeriesWaterfallHook<{
    request: Request;
    cacheInfo: RequestCacheRow;
    requestConfig: RequestCacheConfig;
    resultWeight: number;
  }>;
  isNeedToInvalidateCached: AsyncSeriesWaterfallHook<{
    cacheInfo: RequestCacheRow;
    requestConfig: RequestCacheConfig;
    resultWeight: number;
  }>;
  onAfterFetch: AsyncParallelHook;
  onInsertCacheParams: AsyncSeriesWaterfallHook<{
    params: any;
    cacheInfo: RequestCacheRow;
    requestConfig: RequestCacheConfig;
    isInvalidation?: boolean;
  }>;
}

export class SWProcessingPipe {
  // @ts-ignore
  private plugins: PluginInterface[];
  private config: {
    list: RequestCacheConfig[];
  };
  private hooks: HooksType;
  private trottledFunc: any;

  constructor(
    private cacheId: string,
    private dataStorageService: DataStorageInterface,
    private requestSerializerService: RequestSerializerInterface,
  ) {
    this.hooks = {
      onInstall: new AsyncParallelHook(),
      onActive: new AsyncParallelHook(),
      onMessage: new AsyncParallelHook(["type", "payload"]),
      onFetch: new AsyncParallelHook(["request"]),
      onCachingRequest: new AsyncSeriesHook(["request", "requestConfig"]),
      onPostRequestProcessing: new AsyncSeriesHook(["args"]),
      onBackgroundTask: new AsyncParallelHook(),
      isNeedToSendCachedResponse: new AsyncSeriesWaterfallHook(["args"]),
      isNeedToInvalidateCached: new AsyncSeriesWaterfallHook(["args"]),
      onAfterFetch: new AsyncParallelHook(["args"]),
      onInsertCacheParams: new AsyncSeriesWaterfallHook(["args"]),
    };

    this.trottledFunc = throttle(() => this.checkInvalidateCandidates(), 2000, {
      trailing: true,
      leading: false,
    });
    this.dataStorageService.load();
  }

  public setPlugins(plugins: SWPipePluginInterface[] = []) {
    this.plugins = plugins;
    this.plugins.forEach((plugin) => {
      plugin.init(this.hooks);
    });
  }

  public onInstall() {
    console.log("Установлен");
    this.hooks.onInstall.isUsed() && this.hooks.onInstall.callAsync();
  }

  public onActivate() {
    console.log("Активирован");
    this.hooks.onActive.isUsed() && this.hooks.onActive.callAsync();
  }

  public onMessage(type: string, payload: any) {
    if (type === "config") {
      this.config = payload;
    }
    this.hooks.onMessage.isUsed() &&
      this.hooks.onMessage.callAsync(type, payload);
  }

  public onFetchEvent(event: any) {
    this.hooks.onFetch.isUsed() && this.hooks.onFetch.promise(event.request);

    if (!this.config) return;
    const requestConfig = this.config.list.find((conf) =>
      event.request.url.match(conf.url),
    );

    if (requestConfig) {
      event.respondWith(this.runRequestPipe(event.request, requestConfig));

      if (this.hooks.onPostRequestProcessing.isUsed()) {
        event.waitUntil(
          this.hooks.onPostRequestProcessing.callAsync({
            request: event.request,
            requestConfig,
          }),
        );
      }
    }
    event.waitUntil(this.trottledFunc());
  }

  public async runRequestPipe(request, requestConfig: RequestCacheConfig) {
    const cache = await caches.open(this.cacheId);
    const cachedEl = await cache.match(request);
    const cacheInfo = await this.dataStorageService.getRequestCacheInfo(
      request.url,
    );

    if (cachedEl) {
      if (!this.hooks.isNeedToSendCachedResponse.isUsed()) {
        return cachedEl;
      }
      const {
        resultWeight,
      } = await this.hooks.isNeedToSendCachedResponse.promise({
        request,
        cacheInfo,
        requestConfig,
        resultWeight: 0,
      });
      if (resultWeight > 0) {
        return cachedEl;
      }
    }

    const response = await fetch(request);

    this.updateRequestCache({
      url: request.url,
      options: await this.requestSerializerService.serialize(request),
      requestConfig,
      response: response.clone(),
      isInvalidation: false,
    });

    return response;
  }

  async checkInvalidateCandidates() {
    console.log("checkInvalidateCandidates");
    if (this.hooks.onBackgroundTask.isUsed()) {
      this.hooks.onBackgroundTask.call();
    }
    const cache = await caches.open(this.cacheId);
    const cacheList = await this.dataStorageService.getAllRequestCacheInfo();

    for (let cacheInfo of cacheList) {
      let respCache = await cache.match(cacheInfo.url);

      const requestConfig = this.config.list.find((conf) =>
        cacheInfo.url.match(conf.url),
      );
      if (requestConfig && respCache) {
        if (!this.hooks.isNeedToInvalidateCached.isUsed()) continue;
        const {
          resultWeight,
        } = await this.hooks.isNeedToInvalidateCached.promise({
          cacheInfo,
          requestConfig,
          resultWeight: 0,
        });
        if (resultWeight <= 0) continue;
      }

      fetch(cacheInfo.url, JSON.parse(cacheInfo.options)).then((response) => {
        this.updateRequestCache({
          url: cacheInfo.url,
          options: cacheInfo.options,
          requestConfig,
          response,
          isInvalidation: true,
        });
      });
    }
  }

  async updateRequestCache({
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
    let params = {
      url: url,
      options: options,
      timestamp: getUnixTime(),
    };

    const cacheInfo = await this.dataStorageService.getRequestCacheInfo(url);
    if (this.hooks.onInsertCacheParams.isUsed()) {
      const {
        params: extendedParam,
      } = await this.hooks.onInsertCacheParams.promise({
        cacheInfo,
        params,
        requestConfig,
        isInvalidation,
      });
      params = extendedParam;
    }

    this.dataStorageService.createOrUpdateRequestCache(url, params as any);
    (await caches.open(this.cacheId)).put(url, response);
  }
}
