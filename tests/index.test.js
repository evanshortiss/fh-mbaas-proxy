'use strict';

var test = require('ava')
  , sinon = require('sinon')
  , proxyquire = require('proxyquire');

var stubs = {
  'env-var': sinon.stub(),
  'fh-instance-url': {
    getUrl: sinon.stub(),
    getServiceCallHeaders: sinon.stub()
  },
  'connect-restreamer': sinon.stub().returns(
    sinon.stub().yields()
  ),
  'http-proxy': {
    createProxyServer: sinon.stub().returns({
      web: sinon.spy()
    })
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

test('should not throw an error', function (t) {
  t.notThrows(function () {
    adapter({
      guid: GUID,
      domain: DOMAIN,
      trim: '/test'
    });
  });
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

  stubs['fh-instance-url'].getUrl.yields(new Error('dummy error'));

  // Mimic a middleware call
  inst({
    url: '/auth',
    on: sinon.stub().yields()
  }, {}, function (err) {
    t.is(
      err.toString(),
      'VError: failed to proxy req to service 562etdecvqqgskbngvfdrj2kn on ' +
      'some.domain.com: failed to get service url: dummy error'
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
  stubs['fh-instance-url'].getUrl.yields(null, targetUrl);

  var inst = adapter({
    guid: GUID,
    domain: DOMAIN
  });

  var req = {
    on: sinon.stub().yields(),
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

test.cb('should proxy with trimmed url', function (t) {
  var proxyStub = {
    web: sinon.spy()
  };

  var targetUrl = 'https://some-url.com';

  stubs['http-proxy'].createProxyServer.returns(proxyStub);
  stubs['fh-instance-url'].getUrl.yields(null, targetUrl);

  var inst = adapter({
    guid: GUID,
    domain: DOMAIN,
    noTrim: false
  });

  var req = {
    on: sinon.stub().yields(),
    url: '/tostuff',
    originalUrl: '/path/tostuff'
  };

  var res = {send: function () {}};

  // Mimic a middleware call
  inst(req, res);

  t.is(proxyStub.web.called, true);
  t.is(proxyStub.web.getCall(0).args[0], req);
  t.is(proxyStub.web.getCall(0).args[0].url, '/tostuff');
  t.is(proxyStub.web.getCall(0).args[1], res);
  t.is(proxyStub.web.getCall(0).args[2].target, targetUrl);
  t.is(proxyStub.web.getCall(0).args[2].changeOrigin, true);

  t.end();
});

test.cb('should proxy with provided url - noTrim match', function (t) {
  var proxyStub = {
    web: sinon.spy()
  };

  var targetUrl = 'https://some-url.com';

  stubs['http-proxy'].createProxyServer.returns(proxyStub);
  stubs['fh-instance-url'].getUrl.yields(null, targetUrl);

  var inst = adapter({
    guid: GUID,
    domain: DOMAIN,
    noTrim: true
  });

  var req = {
    on: sinon.stub().yields(),
    url: '/tostuff',
    originalUrl: '/path/tostuff',
  };

  var res = {send: function () {}};

  // Mimic a middleware call
  inst(req, res);

  t.is(proxyStub.web.called, true);
  t.is(proxyStub.web.getCall(0).args[0], req);
  t.is(proxyStub.web.getCall(0).args[0].url, '/path/tostuff');
  t.is(proxyStub.web.getCall(0).args[1], res);
  t.is(proxyStub.web.getCall(0).args[2].target, targetUrl);
  t.is(proxyStub.web.getCall(0).args[2].changeOrigin, true);

  t.is(proxyStub.web.getCall(0).args[2].changeOrigin, true);

  t.end();
});
