'use strict';

var app = require('express')();
var port = 8002;


app.use('/*', function (req, res) {
  console.log('received request for %s', req.originalUrl);
  res.end('served url ' + req.originalUrl + ' successfully!');
});

app.listen(port, function (err) {
  if (err) {
    throw err;
  }

  console.log('service for proxy is listening on %s', port);
});
