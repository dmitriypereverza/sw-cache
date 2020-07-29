import { buildContainer } from "ts-di-injector";
import { IndexDBStorage } from "storage/IndexDBStorage";
import {
  RequestSerializer,
  RequestSerializerInterface,
} from "services/requestSerializer";
import { DataStorageInterface } from "storage";
import { SWProcessingPipe } from "services/SWProcessingPipe";

export default buildContainer<{
  dataStorageService: DataStorageInterface;
  requestSerializerService: RequestSerializerInterface;
  SWProcessingPipe: SWProcessingPipe;
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
  },
});
