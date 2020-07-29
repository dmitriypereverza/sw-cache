import { getUnixTime } from "storage/IndexDBStorage";

import { HooksType, SWPipePluginInterface } from "../../SWProcessingPipe";

export class ExpirationPlugin implements SWPipePluginInterface {
  init(hooks: HooksType): void {
    hooks.isNeedToSendCachedResponse.tapPromise("ExpirationPlugin", (args) => {
      const { cacheInfo, result } = args;
      if (!cacheInfo) {
        return Promise.resolve(args);
      }
      return Promise.resolve({
        ...args,
        result: result && getUnixTime() < cacheInfo.expireTime,
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
