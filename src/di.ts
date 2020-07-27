import { buildContainer } from "ts-di-injector";

import { IndexDBStorage } from "./storage/IndexDBStorage";
import {
  RequestSerializer,
  RequestSerializerInterface
} from "./services/requestSerializer";
import { DataStorageInterface } from "./storage";

export default buildContainer<{
  dataStorageService: DataStorageInterface;
  requestSerializerService: RequestSerializerInterface;
}>({
  classes: {
    dataStorageService: {
      class: IndexDBStorage,
    },
    requestSerializerService: {
      class: RequestSerializer,
    },
  },
});
