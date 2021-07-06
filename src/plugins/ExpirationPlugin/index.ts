import { assocPath } from "ramda";

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

      let expirationWeight = resultWeight;
      if (getUnixTime() < cacheInfo.expireTime) {
        expirationWeight += this.expirationWeight;
      } else {
        expirationWeight -= this.expirationWeight;
      }

      const result = assocPath(["resultWeight"], expirationWeight, args);
      return Promise.resolve(result);
    });

    hooks.onInsertCacheParams.tapPromise("ExpirationPlugin", async (args) => {
      const { requestConfig } = args;
      const result = assocPath(
        ["params", "expireTime"],
        getUnixTime() + requestConfig.expireTime,
        args
      );
      return Promise.resolve(result);
    });
  }
}
