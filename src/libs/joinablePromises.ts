export function getStickyPromisesBuilder(): {
  isExecute: (key: string) => boolean;
  run: (
    promiseHandler: (
      resolve: (data: any) => void,
      reject?: (data: any) => void,
    ) => void,
    key: string,
  ) => Promise<any>;
} {
  const list: { [key: string]: Promise<any> } = {};

  return {
    isExecute: (key) => !!list[key],
    run: (promiseHandler, key) => {
      if (!list[key]) {
        list[key] = new Promise((resolve, reject) => {
          promiseHandler(resolve, reject);
        }).then(
          (value) => {
            delete list[key];
            return value;
          },
          (err) => {
            delete list[key];
            return err;
          },
        );
      }

      return list[key];
    },
  };
}
