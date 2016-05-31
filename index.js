'use strict';

var httpProxy = require('http-proxy')
  , assert = require('assert')
  , VError = require('verror')
  , xtend = require('xtend')
  , fhurl = require('fh-instance-url')
  , env = require('env-var');

// 5 minutes is the default URL cache time
var DEFAULT_CACHE_TIMEOUT = (1000 * 60 * 5);


/**
 * Returns an express middleware function that will proxy any incoming request
 * to the service identified by opts.guid
 * @param  {Object}   opts
 * @return {Function}
 */
module.exports = function (opts) {
  // Stores the resolved service URL
  var serviceUrl = null;

  assert.equal(
    typeof opts,
    'object',
    'an options object should be passed to fh-mbaas-proxy calls'
  );

  // Cannot be empty string/falsey value
  assert(
    opts.guid,
    'opts.guid is a required parameter and should be the service guid/id'
  );

  // Need to know the domain the request is made to. RHMAP has a variable
  // present for this, but allow override if necessary
  opts.domain = opts.domain || env('FH_MILLICORE');

  // Cannot be empty string/falsey value
  assert(
    opts.domain,
    'opts.domain or FH_MILLICORE env var must be set to the domain your ' +
    'service is hosted on, e.g your-domain'
  );

  assert.equal(
    typeof opts.domain,
    'string',
    'opts.domain or FH_MILLICORE env var must be a string'
  );

  if (opts.trim) {
    assert.equal(
      typeof opts.trim,
      'string',
      'opts.trim must be a string'
    );

    assert(
      opts.trim.length > 1,
      'opts.trim must be a string with length above 1'
    );

    assert.equal(
      opts.trim[0],
      '/',
      'opts.trim must be a valid path with leading slash, e.g "/stuff"'
    );

    assert.notEqual(
      opts.trim[opts.trim.length - 1],
      '/',
      'opts.trim must not end with a "/"'
    );
  }

  // Get a logger with the package name and target guid
  var log = require('fh-bunyan')
    .getLogger(require('./package.json').name + '-' + opts.guid);


  var proxy = httpProxy.createProxyServer({
    // We need to add in service call headers to ensure the request is not
    // rejected. We also add in custom headers if the dev would like to
    headers: xtend(
      opts.headers || {},
      fhurl.getServiceCallHeaders()
    )
  });

  log.info(
    'created proxy to target service %s on domain %s',
    opts.guid,
    opts.domain
  );

  /**
   * Store the service url in a local var and set a timer to invalidate it.
   * @param  {String}     url
   * @param  {Function}   callback
   * @return {undefined}
   */
  function cacheServiceUrl (url, callback) {
    var cacheMs = opts.urlCacheTimeout || DEFAULT_CACHE_TIMEOUT;

    log.info('caching url %s for %sms', url, cacheMs);

    serviceUrl = url;

    setTimeout(function invalidateCachedUrl () {
      log.info('url %s cache expired', serviceUrl);
      serviceUrl = null;
    }, cacheMs);

    callback(null, url);
  }


  /**
   * Fetches the URL for the service we want to proxy our request to.
   * @param  {Function} callback
   * @return {Function}
   */
  function getServiceUrl (callback) {
    if (serviceUrl) {
      callback(null, serviceUrl);
    } else {
      log.info(
        'requesting service url for %s on domain %s',
        opts.guid,
        opts.domain
      );

      fhurl.getUrl({
        guid: opts.guid,
        domain: opts.domain
      }, function (err, url) {
        if (err) {
          callback(
            new VError(err, 'failed to get service url'),
            null
          );
        } else {
          log.info(
            'successfully retrieved url for %s on %s',
            opts.guid,
            opts.domain
          );
          cacheServiceUrl(url, callback);
        }
      });
    }
  }


  /**
   * Our middleware function that performs the request proxy
   * @param  {IncomingRequest}     req
   * @param  {OutgoingResponse}    res
   * @param  {Function}            next
   * @return {undefined}
   */
  return function fhMbaasProxyMiddleware (req, res, next) {
    log.debug('received request for %s', req.url);

    getServiceUrl(function onServiceUrl (err, url) {
      if (err) {
        next(
          new VError(
            err,
            'failed to proxy req to service %s on %s',
            opts.guid,
            opts.domain
          )
        );
      } else {
        var originalPath = req.url;

        // Update the request url to no longer contain the specified path
        if (opts.trim && req.url.indexOf(opts.trim) === 0) {
          req.url = req.url.replace(opts.trim, '');
        }

        log.debug('proxying request for %s to %s', originalPath, req.url);

        proxy.web(req, res, {
          target: url
        });
      }
    });
  };

};
