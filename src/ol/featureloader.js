goog.provide('ol.FeatureLoader');
goog.provide('ol.featureloader');

goog.require('goog.asserts');
goog.require('goog.events');
goog.require('goog.net.EventType');
goog.require('goog.net.XhrIo');
goog.require('goog.net.XhrIo.ResponseType');
goog.require('goog.net.CorsXmlHttpFactory');
goog.require('ol.format.FormatType');
goog.require('ol.xml');


/**
 * @api
 * @typedef {function(this:ol.source.Vector, ol.Extent, number,
 *                    ol.proj.Projection)}
 */
ol.FeatureLoader;


/**
 * @param {string} url Feature URL service.
 * @param {ol.format.Feature} format Feature format.
 * @param {function(this:ol.source.Vector, Array.<ol.Feature>)} success
 *     Function called with the loaded features. Called with the vector
 *     source as `this`.
 * @param {function(this:ol.source.Vector, Event)|null} failure
 *     Function called on error. Called with the vector source as `this`
 *     and the `event`.
 * @param {string|null|undefined} postBody Use 'POST' HTTP method rather than 'GET'
 *     and send this as the message body.
 * @param {boolean|null|undefined} useCORS Use a goog.net.CorsXmlHttpFactory for
 * CORs compatible XHR requests (useful for IE8-9).
 * @return {ol.FeatureLoader} The feature loader.
 */
ol.featureloader.loadFeaturesXhr = function(url, format, success, failure, postBody, useCORS) {
  return (
      /**
       * @param {ol.Extent} extent Extent.
       * @param {number} resolution Resolution.
       * @param {ol.proj.Projection} projection Projection.
       * @this {ol.source.Vector}
       */
      function(extent, resolution, projection) {
        var xhrIo = new goog.net.XhrIo();
        if(useCORS) {
            xhrIo = new goog.net.XhrIo(new goog.net.CorsXmlHttpFactory());
        }
        xhrIo.setResponseType(goog.net.XhrIo.ResponseType.TEXT);
        goog.events.listen(xhrIo, goog.net.EventType.COMPLETE,
            /**
             * @param {Event} event Event.
             * @private
             * @this {ol.source.Vector}
             */
            function(event) {
              var xhrIo = event.target;
              goog.asserts.assertInstanceof(xhrIo, goog.net.XhrIo,
                  'event.target/xhrIo is an instance of goog.net.XhrIo');
              if (xhrIo.isSuccess()) {
                var type = format.getType();
                /** @type {Document|Node|Object|string|undefined} */
                var source;
                if (type == ol.format.FormatType.JSON) {
                  source = xhrIo.getResponseText();
                } else if (type == ol.format.FormatType.TEXT) {
                  source = xhrIo.getResponseText();
                } else if (type == ol.format.FormatType.XML) {
                  if (!goog.userAgent.IE) {
                    source = xhrIo.getResponseXml();
                  }
                  if (!goog.isDefAndNotNull(source)) {
                    source = ol.xml.parse(xhrIo.getResponseText());
                  }
                } else {
                  goog.asserts.fail('unexpected format type');
                }
                if (goog.isDefAndNotNull(source)) {
                  var features = format.readFeatures(source,
                      {featureProjection: projection});
                  success.call(this, features);
                } else {
                  goog.asserts.fail('undefined or null source');
                }
              } else {
                if (failure != null) {
                  failure.call(this, event);
                }
              }
              goog.dispose(xhrIo);
            }, false, this);

        if (!postBody) {
          xhrIo.send(url);
        }
        else {
          goog.asserts.assert(goog.isString(postBody), 'postBody is a string');
          var http_method = 'POST';
          xhrIo.send(url, http_method, postBody);
        }
        return xhrIo;
      });
};


/**
 * Create an XHR feature loader for a `url` and `format`. The feature loader
 * loads features (with XHR), parses the features, and adds them to the
 * vector source.
 * @param {string} url Feature URL service.
 * @param {ol.format.Feature} format Feature format.
 * @param {string|null|undefined} postBody Send 'POST' request with this message body.
 * @param {boolean|null|undefined} useCORS Use a goog.net.CorsXmlHttpFactory for
 * CORs compatible XHR requests (useful for IE8-9).
 * @return {ol.FeatureLoader} The feature loader.
 * @api
 */
ol.featureloader.xhr = function(url, format, postBody, useCORS) {
  return ol.featureloader.loadFeaturesXhr(url, format,
      /**
       * @param {Array.<ol.Feature>} features The loaded features.
       * @this {ol.source.Vector}
       */
      function(features) {
        this.addFeatures(features);
      },
      null,
      postBody,
      useCORS);
};
