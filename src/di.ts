import { buildContainer } from "ts-di-injector";

import { IndexDBStorage } from "./storage/IndexDBStorage";
import { RequestSerializer } from "./services/requestSerializer";

export default buildContainer({
  classes: {
    dataStorageService: {
      class: IndexDBStorage,
    },
    requestSerializerService: {
      class: RequestSerializer,
    },
  },
});
