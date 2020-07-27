import { pick } from "ramda";

export interface RequestSerializerInterface {
  serialize(req: Request): Promise<string>;
}

export class RequestSerializer implements RequestSerializerInterface {
  async serialize(req: Request): Promise<string> {
    const request = req.clone();

    const res = pick(
      ["method", "mode", "cache", "credentials", "redirect", "referrerPolicy"],
      request,
    );
    res["headers"] = {};
    request.headers.forEach((val, key) => {
      res["headers"][key] = val;
    });

    return JSON.stringify(res);
  }
}
