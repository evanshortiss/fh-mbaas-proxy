'use strict';

var app = require('express')();
var port = 8001;

// Local development override for guid
process.env.FH_SERVICE_MAP = JSON.stringify({
  fakeServiceGuid: 'http://127.0.0.1:8002'
});

app.use(function (req, res, next) {
  console.log('got req for %s', req.url);
  next();
});
app.use('/parent', require('../index.js')({
  guid: 'fakeServiceGuid',
  domain: 'your-domain.feedhenry.com',
  noTrim: true
}));

app.listen(port, function (err) {
  if (err) {
    throw err;
  }

  console.log('cloud with proxy is listening on %s', port);
});
