import { getUnixTime } from "storage/IndexDBStorage";

import { HooksType, SWPipePluginInterface } from "../../SWProcessingPipe";

export class EarlyInvalidationPlugin implements SWPipePluginInterface {
  constructor(private invalidationWeight: number) {}

  init(hooks: HooksType): void {
    hooks.isNeedToInvalidateCached.tapPromise(
      "EarlyInvalidationPlugin",
      (args) => {
        const { cacheInfo, resultWeight } = args;
        if (!cacheInfo || !cacheInfo.invalidateTime) {
          return Promise.resolve(args);
        }
        return Promise.resolve({
          ...args,
          resultWeight:
            resultWeight +
            (getUnixTime() > cacheInfo.invalidateTime
              ? +this.invalidationWeight
              : 0),
        });
      },
    );

    hooks.onInsertCacheParams.tapPromise("EarlyInvalidationPlugin", (args) => {
      const { params, requestConfig } = args;
      return Promise.resolve({
        ...args,
        params: {
          ...params,
          invalidateTime: getUnixTime() + requestConfig.invalidateTime,
        },
      });
    });
  }
}
