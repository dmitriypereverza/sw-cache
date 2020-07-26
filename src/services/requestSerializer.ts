import { pick } from "ramda";

export class RequestSerializer {
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
