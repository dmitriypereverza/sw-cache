import { HooksType, SWPipePluginInterface } from "../../SWProcessingPipe";

export class InvalidationThresholdPlugin implements SWPipePluginInterface {
  constructor(private invalidationWeight: number) {}

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
        const { cacheInfo, requestConfig, resultWeight } = args;
        if (!cacheInfo || cacheInfo.invalidateCount === undefined) {
          return Promise.resolve(args);
        }

        const pluginWeight =
          cacheInfo.invalidateCount <= requestConfig.invalidateCount
            ? this.invalidationWeight
            : -this.invalidationWeight;

        return Promise.resolve({
          ...args,
          resultWeight: resultWeight + pluginWeight,
        });
      },
    );
  }
}
