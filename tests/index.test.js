'use strict';

var test = require('ava')
  , sinon = require('sinon')
  , expect = require('chai').expect
  , proxyquire = require('proxyquire');

var stubs = {
  'env-var': sinon.stub(),
  'fh-instance-url': {
    getServiceUrl: sinon.stub(),
    getServiceCallHeaders: sinon.stub()
  },
  'http-proxy': {
    createProxyServer: sinon.stub()
  }
};

var adapter = proxyquire('index.js', stubs);

var GUID = '562etdecvqqgskbngvfdrj2kn';
var DOMAIN = 'some.domain.com';


test('should throw an assertion error - no opts', function (t) {
  t.throws(function () {
    adapter();
  }, 'an options object should be passed to fh-mbaas-proxy calls');
});

test('should throw an assertion error - bad guid', function (t) {
  t.throws(function () {
    adapter({
      guid: '',
      domain: 'some.domain.com'
    });
  }, 'opts.guid is a required parameter and should be the service guid/id');
});

test('should throw an assertion error - bad domain', function (t) {
  t.throws(function () {
    adapter({
      guid: GUID,
      domain: 12
    });
  }, 'opts.domain or FH_MILLICORE env var must be a string');
});

test('should throw an assertion error - bad domain', function (t) {
  stubs['env-var'].returns('');

  t.throws(function () {
    adapter({
      guid: GUID
    });
  }, 'opts.domain or FH_MILLICORE env var must be set to the domain your' +
  ' service is hosted on, e.g your-domain');
});

test('should return a middleware instance', function (t) {
  var inst = adapter({
    guid: GUID,
    domain: DOMAIN
  });

  t.is(typeof inst, 'function');
});

test.cb('should fail to proxy due to failure getting service url', function (t) {
  var inst = adapter({
    guid: GUID,
    domain: DOMAIN
  });

  stubs['fh-instance-url'].getServiceUrl.yields(new Error('dummy error'));

  // Mimic a middleware call
  inst({
    url: '/auth'
  }, {}, function (err) {
    t.is(
      err.toString(),
      'VError: failed to proxy req to service 562etdecvqqgskbngvfdrj2kn: ' +
        'failed to get service url: dummy error'
    );

    t.end();
  });
});

test.cb('should return the service url and attempt to proxy', function (t) {
  var proxyStub = {
    web: sinon.spy()
  };

  var targetUrl = 'https://some-url.com';

  stubs['http-proxy'].createProxyServer.returns(proxyStub);
  stubs['fh-instance-url'].getServiceUrl.yields(null, targetUrl);

  var inst = adapter({
    guid: GUID,
    domain: DOMAIN
  });

  var req = {
    url: '/path'
  };

  var res = {send: function () {}};

  // Mimic a middleware call
  inst(req, res);

  t.is(proxyStub.web.called, true);
  t.is(proxyStub.web.getCall(0).args[0], req);
  t.is(proxyStub.web.getCall(0).args[1], res);
  t.is(proxyStub.web.getCall(0).args[2].target, targetUrl);

  t.end();
});

test.cb('should use cached service url and attempt to proxy', function (t) {
  var proxyStub = {
    web: sinon.spy()
  };

  var targetUrl = 'https://some-url.com';

  stubs['http-proxy'].createProxyServer.returns(proxyStub);
  stubs['fh-instance-url'].getServiceUrl.yields(null, targetUrl);

  var inst = adapter({
    guid: GUID,
    domain: DOMAIN
  });

  var req = {
    url: '/path'
  };

  var res = {send: function () {}};

  // Mimic a middleware call
  inst(req, res);

  t.is(proxyStub.web.called, true);
  t.is(proxyStub.web.getCall(0).args[0], req);
  t.is(proxyStub.web.getCall(0).args[1], res);
  t.is(proxyStub.web.getCall(0).args[2].target, targetUrl);

  t.end();
});