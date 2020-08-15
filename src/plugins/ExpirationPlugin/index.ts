import { getUnixTime } from "storage/IndexDBStorage";

import { HooksType, SWPipePluginInterface } from "../../SWProcessingPipe";

export class ExpirationPlugin implements SWPipePluginInterface {
  constructor(private expirationWeight: number) {}

  init(hooks: HooksType): void {
    hooks.isNeedToSendCachedResponse.tapPromise("ExpirationPlugin", (args) => {
      const { cacheInfo, resultWeight } = args;
      if (!cacheInfo) {
        return Promise.resolve(args);
      }
      return Promise.resolve({
        ...args,
        resultWeight:
          resultWeight +
          (getUnixTime() < cacheInfo.expireTime
            ? this.expirationWeight
            : -this.expirationWeight),
      });
    });

    hooks.onInsertCacheParams.tapPromise("ExpirationPlugin", async (args) => {
      const { params, requestConfig } = args;
      return Promise.resolve({
        ...args,
        params: {
          ...params,
          expireTime: getUnixTime() + requestConfig.expireTime,
        },
      });
    });
  }
}
