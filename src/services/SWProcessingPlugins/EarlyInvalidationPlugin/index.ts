import { HooksType, SWPipePluginInterface } from "../../SWProcessingPipe";
import { getUnixTime } from "../../../storage/IndexDBStorage";

export class EarlyInvalidationPlugin implements SWPipePluginInterface {
  init(hooks: HooksType): void {
    hooks.isNeedToInvalidateCached.tapPromise(
      "EarlyInvalidationPlugin",
      (args) => {
        const { cacheInfo, result } = args;
        if (!cacheInfo || !cacheInfo.invalidateTime) {
          return Promise.resolve(args);
        }
        return Promise.resolve({
          ...args,
          result: result && getUnixTime() > cacheInfo.invalidateTime,
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
