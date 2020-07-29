import { HooksType, SWPipePluginInterface } from "../../SWProcessingPipe";

export class InvalidationThresholdPlugin implements SWPipePluginInterface {
  init(hooks: HooksType): void {
    hooks.onInsertCacheParams.tapPromise(
      "InvalidationThresholdPlugin",
      async (args) => {
        const { params, isInvalidation, cacheInfo } = args;

        params["invalidateCount"] = 0;
        if (isInvalidation) {
          if (cacheInfo && cacheInfo.invalidateCount) {
            params["invalidateCount"] = cacheInfo.invalidateCount + 1;
          } else {
            params["invalidateCount"] = 1;
          }
        }
        return Promise.resolve({ ...args, params });
      },
    );

    hooks.isNeedToInvalidateCached.tapPromise(
      "InvalidationThresholdPlugin",
      (args) => {
        const { cacheInfo, requestConfig, result } = args;
        if (!cacheInfo || cacheInfo.invalidateCount === undefined) {
          return Promise.resolve(args);
        }
        console.log(cacheInfo.invalidateCount <= requestConfig.invalidateCount);
        console.log(cacheInfo.invalidateCount - requestConfig.invalidateCount);
        return Promise.resolve({
          ...args,
          result:
            result &&
            cacheInfo.invalidateCount <= requestConfig.invalidateCount,
        });
      },
    );
  }
}
