/*
 * Poser feeds library
 * @license GNU AGPL3
 * Copyright SAS CommOnEcoute
 * @author Elias Showk elias.showk@commonecoute.fr
 * @version 0.1
 */

define(['feeds/sockjs-0.3', 'lib/lodash-1.0.0.min'], function() {
    var SockJS = window.SockJS;
    return function Feeds(sockjsurl) {
        /*
         * A Poser feed is a channel of bidirectionnal live and persisted events
         */
        function Feed(client, feedname) {
            this.handlers = [];
            this.callbacks = {};
            this.client = client;
            this.name = feedname;
        }

        var tools = {
            'random': {
                'int': function (min, max) {
                    return (min + (Math.random() * (max - min))).toFixed();
                },
                'string': function (len) {
                    var str = '';

                    while (len) {
                        len -= 1;
                        str += String.fromCharCode(tools.random['int'](32, 126));
                    }

                    return str;
                }
            }
        };

        Feed.prototype = {
            /**
             * Join the feed, and starts receiving events
             */
            join: function(uuid) {
                if (uuid === undefined) {
                    uuid = tools.random.int(0, 999999999);
                }
                this.client.send({
                    action: 'join',
                    id: uuid
                }, this.name);
                return uuid;
            },
            /**
             * Leave the feed, and stops receiving events
             */
            leave: function(uuid) {
                if (uuid === undefined) {
                    uuid = tools.random.int(0, 999999999);
                }
                this.client.send({
                    action: 'leave',
                    id: uuid
                }, this.name);
                return uuid;
            },
            /**
             * Trigger event on the internal queue
             * @param Object event
             */
            trigger: function(event) {
                _.each(this.handlers, function(item, i) {
                    if (!item.action) {
                        item.callback(event);
                    } else {
                        if (item.action == event.action)
                            item.callback(event);
                    }
                });
            },
            /**
             * Alias of on()
             */
            bind: function() {
                var args = Array.prototype.slice.call(arguments);
                return this.on.apply(this, args);
            },
            /**
             * Bind event handler
             * @param String action
             * @param Function callback.
             */
            on: function(action, callback) {
                if (!callback) {
                    callback  = action;
                    action = null;
                }
                this.handlers.push({action: action,
                                    callback: callback});
                return this;
            },
            /**
             * Remove event listener
             * @param String action
             * @param Function callback
             */
            unbind: function(action, callback) {
                if (!callback) {
                    callback = action;
                    action = null;
                }
                this.handlers = _.filter(this.handlers,
                    function(handler) {
                        return !(handler.callback == callback && handler.action == action);
                });
                return this;
            }
        };
        return {
            sock: null,
            options: {
                reconnectTimeout: 1000,
                sockjsurl: sockjsurl
            },
            _feedsCache: {},
            feed: function(feedname) {
                if (!this._feedsCache[feedname]) {
                    this._feedsCache[feedname] = new Feed(this, feedname);
                }
                return this._feedsCache[feedname];
            },
            leaveAll: function() {
                for (var name in this._feedsCache) {
                    this._feedsCache[name].leave();
                }
            },
            joinBackAll: function() {
                for (var name in this._feedsCache) {
                    this._feedsCache[name].join();
                }
            },
            trigger: function(event) {
                if (this._feedsCache[event.feed] !== undefined) {
                    this._feedsCache[event.feed].trigger(event);
                }
            },
            /*
            * Serialize the message to be sent
            */
            send: function(data, feed) {
                data.feed = feed;
                this.sock.send(JSON.stringify(data));
            },
            /*
            * SockJS Connection and reconnection
            */
            initialize: function(callback) {
                if (this.sock !== null) {
                    if (this.sock.readyState == SockJS.OPEN) return;
                    if (this.sock.readyState == SockJS.CONNECTING) return;
                    this.sock = null;
                }
                if (this.lastSockJsConnectionTimeout) {
                    clearTimeout(this.lastSockJsConnectionTimeout);
                }
                try {
                    this.sock = new SockJS(this.options.sockjsurl, undefined, {
                        'protocols_whitelist': [
                            'websocket',
                            'xdr-streaming',
                            'xhr-streaming',
                            'iframe-eventsource',
                            'iframe-htmlfile',
                            'xdr-polling',
                            'xhr-polling',
                            'iframe-xhr-polling',
                            'jsonp-polling']
                    });
                } catch (err) {
                    var that = this;
                    this.lastSockJsConnectionTimeout = setTimeout(function() {
                        that.initialize.call(that, callback);
                    }, this.options.reconnectTimeout);
                    return;
                }
                var self = this;
                this.sock.onopen = function() {
                    // TODO check user auth
                    self.lastSockJsConnectionSuccess = Date.now();
                    if (_.isFunction(callback)) {
                        callback();
                    }
                }
                this.sock.onclose = function() {
                    // TODO send "user leaving event"
                    console.log('close, retrying connection');
                    if (self.lastSockJsConnectionTimeout) {
                        window.clearTimeout(self.lastSockJsConnectionTimeout);
                    }
                    var that = self;
                    self.lastSockJsConnectionTimeout = setTimeout(function() {
                        that.initialize.call(that);
                    }, self.options.reconnectTimeout);
                }
                /*
                * Message dispatcher
                */
                this.sock.onmessage = function(e) {
                    if (e.type != 'message') {
                        // TODO self is not a sockjs message
                        console.error(e);
                    } else {
                        var data = JSON.parse(e.data);
                        if (data.feed !== undefined) {
                            self.trigger(data);
                            return;
                        }
                        if (data.metadata.status_code === undefined) {
                            // TODO this is an unknown error
                            console.error(data);
                            return;
                        }
                        if (data.metadata.status_code >= 400) {
                            // TODO raise something
                            console.error(data);
                            return;
                        }
                        if (data.metadata.data.not_found) {
                            // TODO raise something
                            console.error(data);
                        }
                    }
                }
            }
        };
    }
});
