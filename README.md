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
Not published to npm yet, but can be installed via
```
npm install evanshortiss/fh-mbaas-proxy --save
```

## Known Issues

### express.static
In node.js version v0.10 this middleware must be placed **before**
_express.static_. If not placed before _express.static_ requests will fail to
proxy. This is not an issue in node.js v4. We have not confirmed other
middleware causing issues, but if you suspect that is the case then try
placing them **after** this middleware.


```js
/*
  filename: this-works.js

  This will proxy!
 */
app.use(require('fh-mbaas-proxy')(proxyOptions));
app.use(express.static(__dirname + '/public'));


/*
  filename: this-does-not-work.js

  This won't proxy, but will throw an error!
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
app.use(mbaasExpress.fhmiddleware());

app.get('/ping', function (req, res) {
  res.end('pong');
});

// Creates a middleware that will forward all requests to a service specified
// by the AUTH_SERVICE_GUID environment variable
var parentProxy = serviceProxy({
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
  domain: 'somedomain.feedhenry.com',

  // Trimming enables you to mount a proxy under a subpath to avoid route
  // conflicts, but then remove the subpath when the request os forwarded
  // to the MBaaS Service, e.g opts.trim="/parent" and the incoming request is
  // "/parent/child" then it would be sent to an MBaaS Service as just "/child"
  trim: '/parent'
});

// Forward all requests that lead with '/auth'
app.use('/parent', parentProxy);

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

### opts.trim (Optional)
Trimming enables you to mount a proxy under a subpath to avoid route conflicts,
but then remove the subpath when the request os forwarded to the MBaaS Service.
For example opts.trim is set to "/parent" and the incoming request is
"/parent/child" then it would be sent to an MBaaS Service as just "/child".

Here's a simple full URL example:

```bash
http://cloud.fh-app.com/parent/child => http://service.fh-app.com/child
```

And how it would look in code:

```js
var proxy = require('fh-mbaas-proxy')({
  guid: process.env.PROXY_GUID,
  trim: '/parent'
});

app.use('/parent', proxy);
```

It's worth noting that the _trim_ options must meet the following criteria:

* Is of type String
* Has a leading slash, e.g "/ok" is valid but "ok" is not.
* Does not containg a trailing slash, e.g "/ok" is valid but "/ok/" is not.
* Matches the root of the URL. In our example above, if the URL became,
"child/parent", then the URL would not change to "/child" since parent is not
the root.
