'use strict';

var app = require('express')();
var port = 8001;

process.env.FH_USE_LOCAL_DB = 'true';

app.use(function (req, res, next) {
  console.log('got req for %s', req.url);
  next();
});
app.use('/parent', require('../index.js')({
  guid: '48fhsf6mxzlyqi3ffbpkfh38',
  noTrim: true
}));

app.listen(port, function (err) {
  if (err) {
    throw err;
  }

  console.log('cloud with proxy is listening on %s', port);
});
