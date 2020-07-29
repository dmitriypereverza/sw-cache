import { DataStorageInterface } from "storage";

import { HooksType, SWPipePluginInterface } from "../../SWProcessingPipe";

export class MarkovPredictionPlugin implements SWPipePluginInterface {
  constructor(
    private dataStorageService: DataStorageInterface,
    private rangeTimeForRelatedRequests: number,
  ) {
    this.dataStorageService.load();
  }

  init(hooks: HooksType): void {
    hooks.onPostRequestProcessing.tap(
      "MarkovPredictionPlugin",
      async (args) => {
        const { request } = args;

        this.dataStorageService
          .createRequestLog(request.url)
          .catch(console.error);

        this.updateMarkovStats(request).catch(console.error);
      },
    );
  }

  async updateMarkovStats(request) {
    Promise.all([
      this.dataStorageService.getLastRequestsByFromTime(
        this.rangeTimeForRelatedRequests,
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
}
