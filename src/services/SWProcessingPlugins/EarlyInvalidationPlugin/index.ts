import { HooksType, SWPipePluginInterface } from "../../SWProcessingPipe";
import { getUnixTime } from "../../../storage/IndexDBStorage";

export class EarlyInvalidationPlugin implements SWPipePluginInterface {
  init(hooks: HooksType): void {
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
