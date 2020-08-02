import diContainer from "./di";

const SWProcessingPipe = diContainer.get("SWProcessingPipe");

SWProcessingPipe.setPlugins([
  diContainer.get("expirationPlugin"),
  diContainer.get("earlyInvalidationPlugin"),
  diContainer.get("invalidationThresholdPlugin"),
  // diContainer.get("markovPredictionPlugin"),
]);

self.addEventListener("install", () => SWProcessingPipe.onInstall());

self.addEventListener("activate", () => SWProcessingPipe.onActivate());

self.addEventListener("message", (event: any) => {
  SWProcessingPipe.onMessage(event.data.type, event.data.payload, event);
});

self.addEventListener("fetch", (ev) => SWProcessingPipe.onFetchEvent(ev));
