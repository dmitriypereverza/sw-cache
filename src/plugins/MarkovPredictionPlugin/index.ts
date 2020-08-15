import { values } from "ramda";
import { DataStorageInterface } from "storage";

import { HooksType, SWPipePluginInterface } from "../../SWProcessingPipe";

export class MarkovPredictionPlugin implements SWPipePluginInterface {
  private activeFetchEvents: Map<string, string>;
  constructor(
    private invalidationWeight: number,
    private dataStorageService: DataStorageInterface,
    private rangeTimeForRelatedRequests: number
  ) {
    this.dataStorageService.load();
    this.activeFetchEvents = new Map();
  }

  init(hooks: HooksType): void {
    hooks.onPostRequestProcessing.tap(
      "MarkovPredictionPlugin",
      async (args) => {
        const { request, fetchEventHash } = args;

        this.activeFetchEvents.set(fetchEventHash, request.url);

        this.dataStorageService
          .createRequestLog(request.url)
          .catch(console.error);

        this.updateMarkovStats(request).catch(console.error);
      }
    );

    hooks.isNeedToInvalidateCached.tapPromise(
      "MarkovPredictionPlugin",
      async (args) => {
        const { resultWeight, requestConfig, cacheInfo, fetchEventHash } = args;
        if (!fetchEventHash || !requestConfig.invalidateIfPredictedMoreThen) {
          return args;
        }
        const currentRequest = this.activeFetchEvents.get(fetchEventHash);
        if (!currentRequest) return args;

        const nextRequestChance = await this.getNextRequestChance(
          currentRequest,
          cacheInfo.url
        );

        // console.log(
        //   cacheInfo.url,
        //   `Шанс запроса ${nextRequestChance.toFixed(2)}%`,
        // );
        return {
          ...args,
          resultWeight:
            resultWeight +
            (resultWeight <= 0 &&
            nextRequestChance > requestConfig.invalidateIfPredictedMoreThen
              ? +this.invalidationWeight
              : 0),
        };
      }
    );

    hooks.onBackgroundTaskEnd.tapAsync(
      "MarkovPredictionPlugin",
      ({ fetchEventHash }) => {
        if (fetchEventHash && this.activeFetchEvents.has(fetchEventHash)) {
          this.activeFetchEvents.delete(fetchEventHash);
        }
      }
    );
  }

  async updateMarkovStats(request) {
    Promise.all([
      this.dataStorageService.getLastRequestsByFromTime(
        this.rangeTimeForRelatedRequests
      ),
      this.dataStorageService.getMarkovRowByUrl(request.url),
    ]).then(([lastRequests, markovRow]) => {
      const stat = lastRequests.reduce((acc, req) => {
        if (!acc[req.url]) {
          acc[req.url] = 1;
        } else {
          acc[req.url] += 1;
        }
        return acc;
      }, markovRow || {});
      this.dataStorageService.createOrUpdateMarkovRow(request.url, stat);
    });
  }

  private async getNextRequestChance(
    currentRequestUrl: string,
    nextRequestUrl: string
  ): Promise<number> {
    const markowRow = await this.dataStorageService.getMarkovRowByUrl(
      currentRequestUrl
    );
    if (!markowRow || markowRow[nextRequestUrl] === undefined) return 0;

    const requestTimes = markowRow[nextRequestUrl];
    const allCount = values(markowRow).reduce((a, b) => a + b, 0);

    if (allCount === 0 || !allCount) return 0;
    return (100 * requestTimes) / allCount;
  }
}
