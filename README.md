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


## Usage

### Simple Example
```js
const serviceProxy = require('fh-mbaas-proxy');

// Creates a middleware instance that will forward all requests to a service
// specified by the given guid
const proxyMiddleware = serviceProxy({
  guid: process.env.SERVICE_GUID,
  noTrim: false
});

```


### Full Example
A full RHMAP sample express application.

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
// by the SERVICE_GUID environment variable
var parentProxy = serviceProxy({
  headers: {
    'x-custom-header': 'some-header-value'
  },
  guid: process.env.SERVICE_GUID,
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


## Example
An example is included in this repo. To run it, open two terminals and *cd* to
this repository in each. Run _npm install_ in one of the terminals, then, in one
terminal run _npm run example-service_, and in the other run
_npm run example-cloud_.

The cloud should now be running on *http://127.0.0.1:8001*, and the service on
*http://127.0.0.1:8002*. You can make a request through the cloud by hitting
*http://127.0.0.1:8001/parent/some-path-you-like* which will be served by the
service.

Try messing with the _noTrim_ boolean in the _example/cloud.js_ to see the
effect it has on the request made to the service via the cloud!


## Known Issues

### Express Middleware
Placing the proxy after certain express middleware can cause the proxied
request to timeout or receive an ECONNRESET error, or the request can simply
hang to eventually timeout. It appears to be related to this [issue](https://github.com/nodejitsu/node-http-proxy/issues/180).

You can work around this by structuring routes with nesting, or by ensuring
the proxy is included before such middleware until a fix is implemented. The
easiest fix is to place the proxy before all other routes if possible since
it's been observed that POST/PUT will generally fail if any middleware is
triggered/matched before hitting the proxy middleware.

```js
/*
  filename: this-works.js

  This will work since the proxy middleware is before the static middleware.
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
your-domain.feedhenry.com.

You only need to set this if you don't have an
*fhconfig.json* in the root of you project. You can read about the
*fhconfig.json* [here](https://github.com/feedhenry-staff/fh-instance-url#fhconfigjson).

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


## CHANGELOG

* 1.0.0 - Support only node.js versions above 4.4.2. Use `debug` for logging.
* 0.2.1 - Fix excessive info level logs
* 0.2.0 - Update to support _fhconfig.json_ for configuration. Improve docs.
* 0.1.3 - Remove 0.1.2 fixes since they are not working as expected
* 0.1.2 - Patch to fix bug for PUT/POST requests with JSON bodies - uses
restreamer
* 0.1.1 - Patch to fix bug for PUT/POST requests with JSON bodies
* 0.1.0 - Initial release
