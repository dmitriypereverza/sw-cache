const express = require("express");
const app = express();
const port = 3003;

const handlers = [
  ["/r1", 800],
  ["/r2", 2000],
  ["/r3", 3000],
];

app.use(express.static("public"));

handlers.forEach(([url, timeout]) => {
  app.get(url, (req, res) => {
    setTimeout(() => {
      res.send(url);
    }, timeout);
  });
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
