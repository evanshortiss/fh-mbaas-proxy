'use strict';

var httpProxy = require('http-proxy')
  , assert = require('assert')
  , VError = require('verror')
  , xtend = require('xtend')
  , fhurl = require('fh-instance-url');

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

  // Get a logger with the package name and target guid
  var log = require('fh-bunyan')
    .getLogger(require('./package.json').name + '-' + opts.guid);

  log.info('creating proxy with opts, %j', opts);

  var proxy = httpProxy.createProxyServer({
    // We need to add in service call headers to ensure the request is not
    // rejected. We also add in custom headers if the dev would like to
    headers: xtend(
      opts.headers || {},
      fhurl.getServiceCallHeaders()
    )
  });

  log.info('created proxy to target service %s', opts.guid);

  /**
   * Store the service url in a local var and set a timer to invalidate it.
   * @param  {String}     url
   * @param  {Function}   callback
   * @return {undefined}
   */
  function cacheServiceUrl (url, callback) {
    var cacheMs = opts.urlCacheTimeout || DEFAULT_CACHE_TIMEOUT;

    log.debug('caching url %s for %sms', url, cacheMs);

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
      log.debug('requesting service url for %s on domain %s', opts.guid);

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
          log.debug('successfully retrieved url for %s on %s', opts.guid);
          cacheServiceUrl(url, callback);
        }
      });
    }
  }

  return function _fhProxyMiddleware (req, res, next) {
    log.debug('received request for %s', req.url);

    getServiceUrl(function onServiceUrl (err, url) {
      if (err) {
        next(
          new VError(err, 'failed to proxy req to service %s', opts.guid)
        );
      } else {
        var originalUrl = req.originalUrl;

        // Trim behaviour uses: req.url, req.originalUrl, req.baseUrl
        // e.g /things/car
        // req.url = '/car'
        // req.originalUrl = '/things/car'
        // req.baseUrl = '/things'

        if (opts.noTrim === true) {
          // Use the full URL, e.g /things/car
          req.url = req.originalUrl;
        }

        log.debug(
          'proxying request for %s to %s%s',
          originalUrl,
          url,
          req.url
        );

        proxy.web(req, res, {
          target: url,
          // Required to ensure requests get routed through
          // fh correctly, otherwise they come back to this service
          changeOrigin: true
        }, function onProxyError (err) {
          var eStr = 'failed to proxy request to ' + req.originalUrl;

          log.error(err, eStr);

          res.writeHead(500, {
            'Content-Type': 'text/plain'
          });

          res.end(eStr);
        });
      }
    });
  };


};
