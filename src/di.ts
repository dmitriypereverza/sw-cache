import { buildContainer } from "ts-di-injector";
import { IndexDBStorage } from "storage/IndexDBStorage";
import {
  RequestSerializer,
  RequestSerializerInterface,
} from "services/requestSerializer";
import { SWProcessingPipe } from "./SWProcessingPipe";
import { MarkovPredictionPlugin } from "./plugins/MarkovPredictionPlugin";
import { ExpirationPlugin } from "./plugins/ExpirationPlugin";
import { EarlyInvalidationPlugin } from "./plugins/EarlyInvalidationPlugin";
import { InvalidationThresholdPlugin } from "./plugins/InvalidationThresholdPlugin";

export default buildContainer<{
  dataStorageService: IndexDBStorage;
  requestSerializerService: RequestSerializerInterface;
  SWProcessingPipe: SWProcessingPipe;
  markovPredictionPlugin: MarkovPredictionPlugin;
  expirationPlugin: ExpirationPlugin;
  earlyInvalidationPlugin: EarlyInvalidationPlugin;
  invalidationThresholdPlugin: InvalidationThresholdPlugin;
}>({
  params: {
    cacheId: "sw-cache",
    rangeTimeForRelatedRequests: 30,
  },
  classes: {
    SWProcessingPipe: {
      class: SWProcessingPipe,
      parameters: [
        "#cacheId",
        "@dataStorageService",
        "@requestSerializerService",
      ],
    },
    dataStorageService: {
      class: IndexDBStorage,
    },
    requestSerializerService: {
      class: RequestSerializer,
    },
    // plugins
    expirationPlugin: {
      class: ExpirationPlugin,
      parameters: ["1"],
    },
    earlyInvalidationPlugin: {
      class: EarlyInvalidationPlugin,
      parameters: ["1"],
    },
    invalidationThresholdPlugin: {
      class: InvalidationThresholdPlugin,
      parameters: ["2"],
    },
    markovPredictionPlugin: {
      class: MarkovPredictionPlugin,
      parameters: ["4", "@dataStorageService", "#rangeTimeForRelatedRequests"],
    },
  },
});
