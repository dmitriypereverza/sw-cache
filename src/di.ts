import { buildContainer } from "ts-di-injector";
import { IndexDBStorage } from "storage/IndexDBStorage";
import {
  RequestSerializer,
  RequestSerializerInterface,
} from "services/requestSerializer";
import { DataStorageInterface } from "storage";
import { SWProcessingPipe } from "services/SWProcessingPipe";
import { MarkovPredictionPlugin } from "services/SWProcessingPlugins/MarkovPredictionPlugin";
import { ExpirationPlugin } from "services/SWProcessingPlugins/ExpirationPlugin";
import { EarlyInvalidationPlugin } from "services/SWProcessingPlugins/EarlyInvalidationPlugin";
import { InvalidationThresholdPlugin } from "services/SWProcessingPlugins/InvalidationThresholdPlugin";

export default buildContainer<{
  dataStorageService: DataStorageInterface;
  requestSerializerService: RequestSerializerInterface;
  SWProcessingPipe: SWProcessingPipe;
  markovPredictionPlugin: MarkovPredictionPlugin;
  expirationPlugin: ExpirationPlugin;
  earlyInvalidationPlugin: EarlyInvalidationPlugin;
  invalidationThresholdPlugin: InvalidationThresholdPlugin;
}>({
  params: {
    cacheId: "v1",
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
    markovPredictionPlugin: {
      class: MarkovPredictionPlugin,
      parameters: ["@dataStorageService", "#rangeTimeForRelatedRequests"],
    },
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
  },
});
