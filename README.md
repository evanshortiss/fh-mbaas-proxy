fh-mbaas-proxy
==============

 [![Circle CI](https://circleci.com/gh/evanshortiss/fh-mbaas-proxy/tree/master.svg?style=svg)](https://circleci.com/gh/evanshortiss/fh-mbaas-proxy/tree/master)

MBaaS Services are one of the most useful features of the Red Hat Mobile
Application Platform. These services enable developers to expose reusable
RESTful APIs (or anything else that you can serve over HTTP!) that can be used
by multiple projects. One drawback of this however is that code duplication
can occur in the dependent cloud applications since you might find the need to
call the same endpoints in each using $fh.service, and return those results
to a Client Application.

_fh-mbaas-proxy_ aims to resolve this duplication by serving as an express
middleware that can be added to any Cloud Application to expose service routes
as if they were part of it. Less time writing calls to _$fh.service_ means more
time getting features done, and less bugs!

## Install

```
npm install fh-mbaas-proxy --save
```

## Known Issues

### Express Middleware
Placing the proxy after certain express middleware can cause the proxied
request to timeout or receive an ECONNRESET error. Currently it appears that
placing it after _express.static_ can cause this issue. Other middleware might
also cause this issue, but only _express.static_ is confirmed.

You can work around this by structuring routes with nesting, or by ensuring
the proxy is included before such middleware until the reason for this issue
is discovered.

```js
/*
  filename: this-works.js

  This will proxy since the proxy middleware is before the static middleware.
 */
app.use(require('fh-mbaas-proxy')(proxyOptions));
app.use(express.static(__dirname + '/public'));

/*
  filename: this-also-works.js

  This will proxy so long as the route to be proxied does not begin with
  the path "/static" since it will then avoid the static middleware. For
  example "/ok/static" will work, but "/static/ok" will fail to proxy since
  it must pass thru the express.static middleware first
 */
app.use('/static', express.static(__dirname + '/public'));
app.use(require('fh-mbaas-proxy')(proxyOptions));


/*
  filename: this-does-not-work.js

  This won't proxy because the static middleware is run for EVERY incoming
  request BEFORE it reaches the proxy middleware.
 */
app.use(express.static(__dirname + '/public'));
app.use(require('fh-mbaas-proxy')(proxyOptions));
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


// Creates a middleware that will forward all requests to a service specified
// by the AUTH_SERVICE_GUID environment variable
var parentProxy = serviceProxy({
  headers: {
    'x-custom-header': 'some-header-value'
  },
  guid: process.env.SERVICE_GUID,
  domain: 'somedomain.feedhenry.com',
  noTrim: false
});

// Forward all requests that lead with '/parent', e.g '/parent/child'
app.use('/parent', parentProxy);

app.use(mbaasExpress.fhmiddleware());

app.get('/ping', function (req, res) {
  res.end('pong');
});

app.use(mbaasExpress.errorHandler());

app.listen(port, function() {
  console.log('App started at: ' + new Date() + ' on port: ' + port);
});
```

## Options

Provided options must be an Object.

### opts.headers (Optional)
Custom headers you would like to inject into a request being proxied.

### opts.guid (Required)
The ServiceID/GUID of the MBaaS Service you would like to proxy requests to.
This can be found on the Details tab of your MBaaS Service and is the same as
the _guid_ parameter you would pass to _$fh.service_ calls.

### opts.domain (Optional)
The domain that the target MBaaS Service is hosted on, e.g
your-domain.feedhenry.com. When running locally you _must_ set this, but when
running on RHMAP, this is set for you via the FH_MILLICORE environment
variable.

During local development you could set FH_MILLICORE by running the following
command in a terminal, thus removing the need to provide this option. Awesome!

```
export FH_MILLICORE='your-domain.feedhenry.com'
```

### opts.noTrim (Default - false)
Setting _noTrim_ to true will use the full path for proxying, e.g if your proxy
setup is like so:

```js
app.use('/parent', serviceProxy(options));
```

Then a client might call "/parent/child". By default we remove the "/parent"
when performing the proxy. Here's a simple full URL example of what this means:

```bash
http://cloud.fh-app.com/parent/child => http://service.fh-app.com/child
```

If you didn't want "/parent" getting removed then you can pass _noTrim_ with
the value, _true_ and the URL mapping will become as follows:

```bash
http://cloud.fh-app.com/parent/child => http://service.fh-app.com/parent/child
```

## Changelog

* 0.1.2 - Patch to fix bug for PUT/POST requests with JSON bodies - uses
restreamer
* 0.1.1 - Patch to fix bug for PUT/POST requests with JSON bodies
* 0.1.0 - Initial release
