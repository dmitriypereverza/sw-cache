import diContainer from "./di";

const SWProcessingPipe = diContainer.get("SWProcessingPipe");

SWProcessingPipe.setPlugins([
  diContainer.get("expirationPlugin"),
  diContainer.get("earlyInvalidationPlugin"),
  diContainer.get("invalidationThresholdPlugin"),
  // diContainer.get("markovPredictionPlugin"),
]);

self.addEventListener("install", () => {
  // @ts-ignore
  self.skipWaiting();
  SWProcessingPipe.onInstall();
});

self.addEventListener("activate", (event: any) => {
  // @ts-ignore
  event.waitUntil(clients.claim());
  SWProcessingPipe.onActivate(event);
});

self.addEventListener("message", (event: any) => {
  SWProcessingPipe.onMessage(event.data.type, event.data.payload, event);
});

self.addEventListener("fetch", (ev) => SWProcessingPipe.onFetchEvent(ev));
