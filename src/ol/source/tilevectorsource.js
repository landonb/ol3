goog.provide('ol.source.TileVector');
goog.provide('ol.source.TileVectorEventLoad');
goog.provide('ol.source.TileVectorEventLoadType');
goog.provide('ol.source.TileVectorEventLoaded');
goog.provide('ol.source.TileVectorEventLoadedType');
goog.provide('ol.source.TileVectorEventLoading');
goog.provide('ol.source.TileVectorEventLoadingType');

goog.require('goog.array');
goog.require('goog.asserts');
goog.require('goog.events.Event');
goog.require('goog.object');
goog.require('ol.TileCoord');
goog.require('ol.TileUrlFunction');
goog.require('ol.featureloader');
goog.require('ol.source.State');
goog.require('ol.source.Vector');
goog.require('ol.tilegrid.TileGrid');



/**
 * @enum {string}
 */
ol.source.TileVectorEventLoadType = {
  /**
   * Triggered when the features for a tile are received.
   * @event ol.source.TileVectorEventLoadType#loadtilefeatures
   * @api
   */
  LOADTILEFEATURES: 'loadtilefeatures'
};


/**
 * @enum {string}
 */
ol.source.TileVectorEventLoadedType = {
  /**
   * Triggered when all outstanding tile requests have been completed.
   * @event ol.source.TileVectorEventLoadedType#alltilesloaded
   * @api
   */
  ALLTILESLOADED: 'alltilesloaded'
};


/**
 * @enum {string}
 */
ol.source.TileVectorEventLoadingType = {
  /**
   * Triggered when one or more tile requests have been initiated and
   * previously there were none outstanding.
   * @event ol.source.TileVectorEventLoadingType#loadingtiles
   * @api
   */
  LOADINGTILES: 'loadingtiles'
};


/**
 * @classdesc
 * A vector source in one of the supported formats, where the data is divided
 * into tiles in a fixed grid pattern.
 *
 * @constructor
 * @extends {ol.source.Vector}
 * @param {olx.source.TileVectorOptions} options Options.
 * @api
 */
ol.source.TileVector = function(options) {

  goog.base(this, {
    attributions: options.attributions,
    logo: options.logo,
    projection: undefined,
    state: ol.source.State.READY
  });

  /**
   * @private
   * @type {ol.format.Feature}
   */
  this.format_ = options.format;

  goog.asserts.assert(goog.isDefAndNotNull(this.format_),
      'ol.source.TileVector requires a format');

  /**
   * @private
   * @type {ol.tilegrid.TileGrid}
   */
  this.tileGrid_ = options.tileGrid;

  /**
   * @private
   * @type {ol.TileUrlFunctionType}
   */
  this.tileUrlFunction_ = ol.TileUrlFunction.nullTileUrlFunction;

  /**
   * @private
   * @type {ol.TileCoordTransformType}
   */
  this.tileCoordTransform_ = this.tileGrid_.createTileCoordTransform();

  /**
   * @private
   * @type {Object.<string, Array.<ol.Feature>>}
   */
  this.tiles_ = {};

  if (goog.isDef(options.tileUrlFunction)) {
    this.setTileUrlFunction(options.tileUrlFunction);
  } else if (goog.isDef(options.urls)) {
    this.setUrls(options.urls);
  } else if (goog.isDef(options.url)) {
    this.setUrl(options.url);
  }

  /**
   * @private
   * @type {string}
   */
  this.postBody_ = options.postBody;

  /**
   * @private
   * @type {Object.<string, goog.net.XhrIo>}
   */
  this.outstanding_ = {};

  /**
   * @private
   * @type {number}
   */
  this.n_outstanding_ = 0;
};
goog.inherits(ol.source.TileVector, ol.source.Vector);


/**
 * Cancel (abort) all outstanding XHR tile requests.
 * @api
 */
ol.source.TileVector.prototype.abortAll = function() {
  for (var tileKey in this.outstanding_) {
    if (this.outstanding_.hasOwnProperty(tileKey)) {
      this.outstanding_[tileKey].abort();
    }
  }
};


/**
 * @inheritDoc
 */
ol.source.TileVector.prototype.addFeature = goog.abstractMethod;


/**
 * @inheritDoc
 */
ol.source.TileVector.prototype.addFeatures = goog.abstractMethod;


/**
 * Cleanup an outstanding tile request.
 * @param {string} tileKey Tile key.
 * @private
 */
ol.source.TileVector.prototype.cleanup_request = function(tileKey) {
    delete this.outstanding_[tileKey];
    this.n_outstanding_ -= 1;
    if (this.n_outstanding_ == 0) {
      this.dispatchEvent(
        new ol.source.TileVectorEventLoaded(
          ol.source.TileVectorEventLoadedType.ALLTILESLOADED));
    }
};


/**
 * @inheritDoc
 */
ol.source.TileVector.prototype.clear = function() {
  goog.object.clear(this.tiles_);
};


/**
 * @inheritDoc
 */
ol.source.TileVector.prototype.forEachFeature = goog.abstractMethod;


/**
 * Iterate through all features whose geometries contain the provided
 * coordinate at the provided resolution, calling the callback with each
 * feature. If the callback returns a "truthy" value, iteration will stop and
 * the function will return the same value.
 *
 * @param {ol.Coordinate} coordinate Coordinate.
 * @param {number} resolution Resolution.
 * @param {function(this: T, ol.Feature): S} callback Called with each feature
 *     whose goemetry contains the provided coordinate.
 * @param {T=} opt_this The object to use as `this` in the callback.
 * @return {S|undefined} The return value from the last call to the callback.
 * @template T,S
 */
ol.source.TileVector.prototype.forEachFeatureAtCoordinateAndResolution =
    function(coordinate, resolution, callback, opt_this) {

  var tileGrid = this.tileGrid_;
  var tiles = this.tiles_;
  var tileCoord = tileGrid.getTileCoordForCoordAndResolution(coordinate,
      resolution);

  var tileKey = this.getTileKeyZXY_(tileCoord[0], tileCoord[1], tileCoord[2]);
  var features = tiles[tileKey];
  if (goog.isDef(features)) {
    var i, ii;
    for (i = 0, ii = features.length; i < ii; ++i) {
      var feature = features[i];
      var geometry = feature.getGeometry();
      goog.asserts.assert(goog.isDefAndNotNull(geometry),
          'feature geometry is defined and not null');
      if (geometry.containsCoordinate(coordinate)) {
        var result = callback.call(opt_this, feature);
        if (result) {
          return result;
        }
      }
    }
  }
  return undefined;
};


/**
 * @inheritDoc
 */
ol.source.TileVector.prototype.forEachFeatureInExtent = goog.abstractMethod;


/**
 * @inheritDoc
 */
ol.source.TileVector.prototype.forEachFeatureInExtentAtResolution =
    function(extent, resolution, f, opt_this) {
  var tileGrid = this.tileGrid_;
  var tiles = this.tiles_;
  var z = tileGrid.getZForResolution(resolution);
  var tileRange = tileGrid.getTileRangeForExtentAndZ(extent, z);
  var x, y;
  for (x = tileRange.minX; x <= tileRange.maxX; ++x) {
    for (y = tileRange.minY; y <= tileRange.maxY; ++y) {
      var tileKey = this.getTileKeyZXY_(z, x, y);
      var features = tiles[tileKey];
      if (goog.isDef(features)) {
        var i, ii;
        for (i = 0, ii = features.length; i < ii; ++i) {
          var result = f.call(opt_this, features[i]);
          if (result) {
            return result;
          }
        }
      }
    }
  }
  return undefined;
};


/**
 * @inheritDoc
 */
ol.source.TileVector.prototype.getClosestFeatureToCoordinate =
    goog.abstractMethod;


/**
 * @inheritDoc
 */
ol.source.TileVector.prototype.getExtent = goog.abstractMethod;


/**
 * Return the features of the TileVector source.
 * @inheritDoc
 * @api
 */
ol.source.TileVector.prototype.getFeatures = function() {
  var tiles = this.tiles_;
  var features = [];
  var tileKey;
  for (tileKey in tiles) {
    goog.array.extend(features, tiles[tileKey]);
  }
  return features;
};


/**
 * Get all features whose geometry intersects the provided coordinate for the
 * provided resolution.
 * @param {ol.Coordinate} coordinate Coordinate.
 * @param {number} resolution Resolution.
 * @return {Array.<ol.Feature>} Features.
 * @api
 */
ol.source.TileVector.prototype.getFeaturesAtCoordinateAndResolution =
    function(coordinate, resolution) {
  var features = [];
  this.forEachFeatureAtCoordinateAndResolution(coordinate, resolution,
      /**
       * @param {ol.Feature} feature Feature.
       */
      function(feature) {
        features.push(feature);
      });
  return features;
};


/**
 * @inheritDoc
 */
ol.source.TileVector.prototype.getFeaturesInExtent = goog.abstractMethod;


/**
 * @param {number} z Z.
 * @param {number} x X.
 * @param {number} y Y.
 * @private
 * @return {string} Tile key.
 */
ol.source.TileVector.prototype.getTileKeyZXY_ = function(z, x, y) {
  return z + '/' + x + '/' + y;
};


/**
 * @inheritDoc
 */
ol.source.TileVector.prototype.loadFeatures =
    function(extent, resolution, projection) {
  var tileCoordTransform = this.tileCoordTransform_;
  var tileGrid = this.tileGrid_;
  var tileUrlFunction = this.tileUrlFunction_;
  var tiles = this.tiles_;
  var z = tileGrid.getZForResolution(resolution);
  var tileRange = tileGrid.getTileRangeForExtentAndZ(extent, z);
  var tileCoord = [z, 0, 0];
  var x, y;
  var old_outstanding = this.n_outstanding_;
  /**
   * @param {string} z Z.
   * @param {number} x X.
   * @param {number} y Y.
   * @param {string} tileKey Tile key.
   * @param {Array.<ol.Feature>} features Features.
   * @this {ol.source.TileVector}
   */
  function success(z, x, y, tileKey, features) {
    this.cleanup_request(tileKey);
    tiles[tileKey] = features;
    this.changed();
    // New event so users can bulk-process loaded features.
    this.dispatchEvent(
      new ol.source.TileVectorEventLoad(
        ol.source.TileVectorEventLoadType.LOADTILEFEATURES,
        z, x, y, tileKey, features));
  }
  /**
   * @param {string} tileKey Tile key.
   * @param {Event} event Event.
   * @this {ol.source.TileVector}
   */
  function failure(tileKey, event) {
    this.cleanup_request(tileKey);
  }
  for (x = tileRange.minX; x <= tileRange.maxX; ++x) {
    for (y = tileRange.minY; y <= tileRange.maxY; ++y) {
      var tileKey = this.getTileKeyZXY_(z, x, y);
      if (!(tileKey in tiles)) {
        tileCoord[0] = z;
        tileCoord[1] = x;
        tileCoord[2] = y;
        tileCoordTransform(tileCoord, projection, tileCoord);
        var url = tileUrlFunction(tileCoord, 1, projection);
        if (goog.isDef(url)) {
          tiles[tileKey] = [];
          var loader = ol.featureloader.loadFeaturesXhr(url, this.format_,
            goog.partial(success, z, x, y, tileKey),
            goog.partial(failure, tileKey), this.postBody_);
          // Remember the xhr object so the caller can cancel tile requests.
          var xhrIo = loader.call(this, extent, resolution, projection);
          this.outstanding_[tileKey] = xhrIo;
          this.n_outstanding_ += 1;
        }
      }
    }
  }
  if (this.n_outstanding_ > 0) {
    var new_requests = this.n_outstanding_ - old_outstanding;
    if (old_outstanding == 0) {
      this.dispatchEvent(
        new ol.source.TileVectorEventLoading(
          ol.source.TileVectorEventLoadingType.LOADINGTILES));
    }
  }
};


/**
 * @return {number} Number of outstanding requests.
 * @api
 */
ol.source.TileVector.prototype.outstanding = function() {
  return this.n_outstanding_;
};


/**
 * @inheritDoc
 */
ol.source.TileVector.prototype.removeFeature = goog.abstractMethod;


/**
 * @param {string} postBody POST payload.
 * @api
 */
ol.source.TileVector.prototype.setPostBody = function(postBody) {
  this.postBody_ = postBody;
  this.changed();
};


/**
 * @param {ol.TileUrlFunctionType} tileUrlFunction Tile URL function.
 */
ol.source.TileVector.prototype.setTileUrlFunction = function(tileUrlFunction) {
  this.tileUrlFunction_ = tileUrlFunction;
  this.changed();
};


/**
 * @param {string} url URL.
 */
ol.source.TileVector.prototype.setUrl = function(url) {
  this.setTileUrlFunction(ol.TileUrlFunction.createFromTemplates(
      ol.TileUrlFunction.expandUrl(url)));
};


/**
 * @param {Array.<string>} urls URLs.
 */
ol.source.TileVector.prototype.setUrls = function(urls) {
  this.setTileUrlFunction(ol.TileUrlFunction.createFromTemplates(urls));
};



/**
 * @classdesc
 * Some events emitted by {@link ol.source.TileVector} instances are instances
 * of this type.
 *
 * @constructor
 * @extends {goog.events.Event}
 * @implements {oli.source.TileVectorEventLoad}
 * @param {string} type Type.
 * @param {string} z Z.
 * @param {number} x X.
 * @param {number} y Y.
 * @param {string} tileKey Tile key.
 * @param {Array.<ol.Feature>} features Features.
 */
ol.source.TileVectorEventLoad = function(type, z, x, y, tileKey, features) {

  goog.base(this, type);

  /**
   * The z Z.
   * @type {string}
   * @api
   */
  this.z = z;

  /**
   * The x X.
   * @type {number}
   * @api
   */
  this.x = x;

  /**
   * The y Y.
   * @type {number}
   * @api
   */
  this.y = y;

  /**
   * The tileKey identifier in this.tiles_.
   * @type {string}
   * @api
   */
  this.tileKey = tileKey;

  /**
   * The features loaded into the tile.
   * @type {Array.<ol.Feature>}
   * @api
   */
  this.features = features;

};
goog.inherits(ol.source.TileVectorEventLoad, goog.events.Event);



/**
 * @classdesc
 * Some events emitted by {@link ol.source.TileVector} instances are instances
 * of this type.
 *
 * @constructor
 * @extends {goog.events.Event}
 * @implements {oli.source.TileVectorEventLoading}
 * @param {string} type Type.
 */
ol.source.TileVectorEventLoading = function(type) {

  goog.base(this, type);

};
goog.inherits(ol.source.TileVectorEventLoading, goog.events.Event);



/**
 * @classdesc
 * Some events emitted by {@link ol.source.TileVector} instances are instances
 * of this type.
 *
 * @constructor
 * @extends {goog.events.Event}
 * @implements {oli.source.TileVectorEventLoaded}
 * @param {string} type Type.
 */
ol.source.TileVectorEventLoaded = function(type) {

  goog.base(this, type);

};
goog.inherits(ol.source.TileVectorEventLoaded, goog.events.Event);
