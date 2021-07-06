import { assocPath } from "ramda";

import { getUnixTime } from "storage/IndexDBStorage";

import { HooksType, SWPipePluginInterface } from "../../SWProcessingPipe";

export class EarlyInvalidationPlugin implements SWPipePluginInterface {
  constructor(private invalidationWeight: number) {}

  init(hooks: HooksType): void {
    hooks.isNeedToInvalidateCached.tapPromise(
      "EarlyInvalidationPlugin",
      (args) => {
        let { cacheInfo, resultWeight } = args;
        if (!cacheInfo?.invalidateTime) {
          return Promise.resolve(args);
        }

        console.log(cacheInfo.invalidateTime - getUnixTime());

        if (getUnixTime() > cacheInfo.invalidateTime) {
          resultWeight += this.invalidationWeight;
        }

        const result = assocPath(["resultWeight"], resultWeight, args);
        return Promise.resolve(result);
      }
    );

    hooks.onInsertCacheParams.tapPromise("EarlyInvalidationPlugin", (args) => {
      const {
        requestConfig: { invalidateTime },
      } = args;
      const result = assocPath(
        ["params", "invalidateTime"],
        getUnixTime() + invalidateTime,
        args
      );
      return Promise.resolve(result) as any;
    });
  }
}
