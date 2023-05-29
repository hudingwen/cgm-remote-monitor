'use strict';

var _ = require('lodash');
var async = require('async');
var request = require('request');

var times = require('../times');

function init (env) {

  var keys = null;
  var announcementKeys = null;
  if(env){
    keys = env.extendedSettings && env.extendedSettings.maker &&
    env.extendedSettings.maker.key && env.extendedSettings.maker.key.split(' ');

    announcementKeys = (env.extendedSettings && env.extendedSettings.maker &&
      env.extendedSettings.maker.announcementKey && env.extendedSettings.maker.announcementKey.split(' ')) || keys;
  }
  
  

  var maker = { };

  var lastAllClear = 0;

  maker.sendAllClear = function sendAllClear (notify, callback) {
    if (Date.now() - lastAllClear > times.mins(30).msecs) {
      lastAllClear = Date.now();

      //can be used to prevent maker/twitter deduping (add to IFTTT tweet text)
      var shortTimestamp = Math.round(Date.now() / 1000 / 60);

      maker.makeKeyRequests({
        value1: (notify && notify.title) || 'All Clear'
        , value2: notify && notify.message && '\n' + notify.message
        , value3: '\n' + shortTimestamp
      }, 'ns-allclear', function allClearCallback (err) {
        if (err) {
          lastAllClear = 0;
          callback(err);
        } else if (callback) {
          callback(null, {sent: true});
        }
      });
    } else if (callback) {
      callback(null, {sent: false});
    }
  };

  maker.sendEvent = function sendEvent (event, callback) {
    if (!event || !event.name) {
      callback('No event name found');
    } else if (!event.level) {
      callback('No event level found');
    } else {
      maker.makeRequests(event, function sendCallback (err, response) {
        if (err) {
          callback(err);
        } else {
          lastAllClear = 0;
          callback(null, response);
        }
      });
    }
  };

  //exposed for testing
  maker.valuesToQuery = function valuesToQuery (event) {
    var query = '';

    for (var i = 1; i <= 10; i++) {
      var name = 'value' + i;
      var value = event[name];
      lastAllClear = 0;
      if (value) {
        if (query) {
          query += '&';
        } else {
          query += '?';
        }
        query += name + '=' + encodeURIComponent(value);
      }
    }

    return query;
  };

  maker.makeRequests = function makeRequests(event, callback) {
    function sendGeneric (callback) {
      maker.makeKeyRequests(event, 'ns-event', callback);
    }

    function sendByLevel (callback) {
      maker.makeKeyRequests (event, 'ns-' + event.level, callback);
    }

    function sendByLevelAndName (callback) {
      maker.makeKeyRequests(event, 'ns' + ((event.level && '-' + event.level) || '') + '-' + event.name, callback);
    }

    //since maker events only filter on name, we are sending multiple events and different levels of granularity
    async.series([sendGeneric, sendByLevel, sendByLevelAndName], callback);
  };

  maker.makeKeyRequests = function makeKeyRequests(event, eventName, callback) {
    var selectedKeys = event.isAnnouncement ? announcementKeys : keys;

    _.each(selectedKeys, function eachKey(key) {
      maker.makeKeyRequest(key, event, eventName, callback);
    });
  };

  maker.makeKeyRequest = function makeKeyRequest(key, event, eventName, callback) {
    
    console.info('sent maker eventName: ', eventName);
    console.info('sent maker event: ', event);

    event['value3'] = event['name'];
    event['value4'] = process.env['uid'];
    event['value5'] = eventName;
    var pushUrl = process.env['PUSH_URL']
    var url = pushUrl + maker.valuesToQuery(event);
    
    // event['eventName'] = eventName;
    // event['value1'] = "";
    // event['value2'] = "";
    // event['value3'] = "";
    // event['value4'] = "";
    // event['isAnnouncement'] = false;
    request
      .get(url)
      .on('response', function (response) {
        console.info('sent maker request: ', url);
        // console.info('sent maker response: ', response);
        // if(callback) callback(null, response);
      })
      .on('error', function (err) {
        console.info('sent maker request err: ', err);
        // if(callback) callback(err);
      });
  };

  if (keys && keys.length > 0) {
    return maker;
  } else {
    return null;
  }

}

module.exports = init;