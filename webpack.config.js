const path = require("path");

module.exports = {
  entry: "./src/index.ts",
  module: {
    rules: [
      {
        test: /\.ts?$/,
        use: "ts-loader",
      },
    ],
  },
  resolve: {
    extensions: [".ts", ".js"],
    alias: {
      services: path.resolve(__dirname, "./src/services"),
      storage: path.resolve(__dirname, "./src/storage"),
    },
  },
  output: {
    filename: "sw.js",
    path: path.resolve(__dirname, "../"),
  },
};
