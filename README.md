fh-service-proxy
================

One of the most useful features of the Red Hat Mobile Application Platform is
mBaaS Services. These services enable developers to expose reusable RESTful
APIs that can be used by multiple projects. One drawback of this however is
that code duplication can occur in the dependent cloud applications.

_fh-service-proxy_ aims to resolve this duplication by serving as an express
middleware that can be added to any Cloud Application to expose service routes
as if they were part of it. Less time writing calls to _$fh.service_ means more
time getting features done, and less bugs!

## Install
Not published to npm yet, but can be installed via
```
npm install evanshortiss/fh-mbaas-proxy --save
```

## Usage

```js
var app = require('express')();
var fh = require('fh-mbaas-api');
var mbaasExpress = fh.mbaasExpress();
var serviceProxy = require('fh-mbaas-proxy');
var port = process.env.FH_PORT || process.env.VCAP_APP_PORT || 8004;

// RHMAP routes and config
app.use('/sys', mbaasExpress.sys([]));
app.use('/mbaas', mbaasExpress.mbaas);
app.use(mbaasExpress.fhmiddleware());

app.get('/ping', function (req, res) {
  res.end('pong');
});

// Creates a middleware that will forward all requests to a service specified
// by the AUTH_SERVICE_GUID environment variable
var authProxy = serviceProxy({
  // Optional headers to inject into the forwarded request, if the header
  // already exists in the incoming request then it will be overwritten
  headers: {
    'x-custom-header': 'some value'
  },

  // The guid of the target service for proxying
  guid: process.env.AUTH_SERVICE_GUID,

  // The domain you're working with. This is only required if FH_MILLICORE
  // environment variable is not set. It will always be set when running on
  // the platform, but your local development environment is beyond our control
  domain: 'somedomain.feedhenry.com'
});

// Forward all requests that lead with '/auth'
app.use('/auth', authProxy);

app.use(mbaasExpress.errorHandler());

app.listen(port, function() {
  console.log('App started at: ' + new Date() + ' on port: ' + port);
});
```
