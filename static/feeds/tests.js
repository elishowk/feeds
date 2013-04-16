/**
 * Tests.
 */
//window.WebSocket = undefined;
require([window.feedsTestsConfig.baseUrl + 'feeds/feeds.js',
        window.feedsTestsConfig.baseUrl + 'lib/chai-1.4.0.js'],
    function(Feeds, chai) {

    var sockjsurl = window.feedsTestsConfig.sockjsUrl;
    var apiurl = window.feedsTestsConfig.feedsApiUrl + '/';

    describe('testing feeds.js on sockjs at ' + sockjsurl, function() {

        it('instanciate Feeds that must have the right functions', function() {
            expect(Feeds).to.be.a('function');
            var feeds = Feeds(sockjsurl);
            expect(feeds).to.be.a('object');
            expect(feeds).to.have.property('sock');
            expect(feeds).to.have.property('feed');
            expect(feeds).to.have.property('trigger');
            expect(feeds).to.have.property('send');
        });

        it('connection', function(done) {
            var feeds = Feeds(sockjsurl);
            feeds.initialize(function() {
                expect(feeds.sock).to.be.a('Object');
                feeds.sock.close();
                done();
            });
        });

        it('instanciate a Feed that must have the right functions', function(done) {
            var feeds = Feeds(sockjsurl);
            feeds.initialize(function() {
                var testfeed = feeds.feed('testfeed');
                expect(testfeed).to.have.property('client');
                expect(testfeed).to.have.property('handlers');
                expect(testfeed).to.have.property('trigger');
                expect(testfeed).to.have.property('unbind');
                expect(testfeed).to.have.property('on');
                done();
            });
        });

        it('one client joins a feed, listen to its join and GET the event',
            function(done) {
            var joinid = Date.now();
            var feeds = Feeds(sockjsurl);
            feeds.initialize(function() {
                var testfeed = feeds.feed('testfeed');
                testfeed.on('join', function(event) {
                    expect(event.action).to.equal('join');
                    expect(event.id).to.equal(joinid);
                    expect(event.feed).to.equal('testfeed');
                    done();
                    testfeed.leave();
                });
                testfeed.join(joinid);
            });
        });

        it('one joins and listens to another leaving', function(done) {
            var feeds = Feeds(sockjsurl);
            feeds.initialize(function() {
                var testfeed = feeds.feed('testfeed');
                var otherfeeds = Feeds(sockjsurl);
                otherfeeds.initialize(function() {
                    var othertestfeed = otherfeeds.feed('testfeed');
                    var leaveid = Date.now();
                    testfeed.on('join', function(event) {
                        othertestfeed.leave(leaveid);
                    });
                    testfeed.on('leave', function(event) {
                        expect(event.action).to.equal('leave');
                        expect(event.id).to.equal(leaveid);
                        expect(event.feed).to.be.a('string');
                        done();
                        testfeed.leave();
                    });
                    testfeed.join();
                    othertestfeed.join();
                });
            });
        });


        it('GET something 404', function(done) {
            $.ajax({
                type: 'GET',
                url: apiurl + 'message/azerty',
                contentType: 'application/json',
                dataType: 'json',
                statusCode: {
                    404: function(data) {
                        done();
                    }}
            });
        });
        /*it('GET something 200', function(done) {
            $.ajax({
                type: 'GET',
                url: apiurl + 'message/?ztbdsqvbaqerfvs=testfeed',
                contentType: 'application/json',
                dataType: 'json',
                statusCode: {
                    200: function(data) {
                        if (data.meta.total_count==0)
                        // TODO tastypie ignores bad parameters, it's bad
                            done();
                    }}
            });
        });*/
        it('GET all', function(done) {
            $.ajax({
                type: 'GET',
                url: apiurl + 'message/?feed=testfeed',
                contentType: 'application/json',
                dataType: 'json',
                statusCode: {
                    200: function(data) {
                        if (data.objects) {
                            done();
                        }
                    }
                }
            });
        });
        it('POST an event, listens to it publication, then GETs it', function(done) {
            var feed_name = 'test_' + Date.now();
            var feeds = Feeds(sockjsurl);
            var global = 1;
            feeds.initialize(function() {
                var testfeed = feeds.feed(feed_name);
                testfeed.on('join', function(event) {
                    /*for (var i = 0; i < 10; i++) {*/
                        $.ajax({
                            type: 'POST',
                            url: apiurl + 'message/',
                            data: JSON.stringify({
                                action: 'test.event',
                                feed: feed_name,
                                metadata: JSON.stringify({'number': 4}),
                                parent: 4,
                                reference: '34'
                            }),
                            contentType: 'application/json',
                            dataType: 'json',
                            /*success: function(data) {
                                console.log(data);
                            }*/
                        });
                    /*}*/
                });
                testfeed.on('test.event', function(eventdata) {
                    expect(eventdata.action).to.equal('test.event');
                    expect(eventdata.id).to.be.a('number');
                    expect(eventdata.parent).to.equal(4);
                    expect(eventdata.feed).to.equal(feed_name);
                    expect(eventdata.reference).to.equal('34');
                    global++;
                    $.ajax({
                        type: 'GET',
                        url: apiurl + 'message/' + eventdata.id,
                        contentType: 'application/json',
                        dataType: 'json',
                        success: function(data) {
                            expect(data.created_at).to.be.a('string');
                            expect(data.created_by).to.be.a('number');
                            expect(eventdata.action).to.equal(data.action);
                            expect(eventdata.id).to.equal(data.id);
                            expect(eventdata.feed).to.equal(data.feed);
                            expect(eventdata.parent).to.equal(data.parent);
                            expect(eventdata.reference).to.equal(data.reference);
                            data.metadata = JSON.parse(data.metadata);
                            expect(data.metadata['number']).to.equal(4);
                            done();
                        }
                    });
                    /*if (global == 10) {*/
                    /*}*/
                });
                testfeed.join();
            });
        });
        it('POST an event and GET ALL events checking if it is here', function(done) {
            var feed_name = 'test_' + Date.now();
            var feeds = Feeds(sockjsurl);
            var global = 1;
            feeds.initialize(function() {
                var testfeed = feeds.feed(feed_name);
                testfeed.on('join', function(event) {
                    /*for (var i = 0; i < 10; i++) {*/
                        $.ajax({
                            type: 'POST',
                            url: apiurl + 'message/',
                            data: JSON.stringify({
                                action: 'test.event',
                                feed: feed_name
                            }),
                            contentType: 'application/json',
                            dataType: 'json',
                            success: function(data) {
                            }
                        });
                    /*}*/
                });
                testfeed.join();
                testfeed.on('test.event', function(event) {
                    expect(event.action).to.equal('test.event');
                    expect(event.id).to.be.a('number');
                    expect(event.parent).to.be.a('null');
                    expect(event.feed).to.equal(feed_name);
                    $.ajax({
                        type: 'GET',
                        url: apiurl + 'message/?feed='+feed_name,
                        contentType: 'application/json',
                        dataType: 'json',
                        success: function(data) {
                            for (var i=0; i<data.objects.length; i++) {
                                if (data.objects[i].id == event.id) {
                                    done();
                                    testfeed.leave();
                                    return;
                                }
                            }
                        }
                    });
                });
            });
        });

        it('POST an event and DELETE it', function(done) {
            var feed_name = 'test_' + Date.now();
            var feeds = Feeds(sockjsurl);
            var eid = null;
            feeds.initialize(function() {
                var testfeed = feeds.feed(feed_name);
                testfeed.on('join', function(event) {
                    /*for (var i = 0; i < 10; i++) {*/
                        $.ajax({
                            type: 'POST',
                            url: apiurl + 'message/',
                            data: JSON.stringify({
                                action: 'test.event',
                                feed: feed_name
                            }),
                            contentType: 'application/json',
                            dataType: 'json',
                            success: function(data) {}
                        });
                    /*}*/
                });
                testfeed.join();
                testfeed.on('test.event.delete', function(event) {
                    expect(event.id).to.equal(eid);
                    $.ajax({
                        type: 'GET',
                        url: apiurl + 'message/' + event.id,
                        contentType: 'application/json',
                        dataType: 'json',
                        statusCode: {
                            404: function(data, jqXHR) {
                                done();
                        }}
                    });
                });
                testfeed.on('test.event', function(event) {
                    expect(event.id).to.be.a('number');
                    eid = event.id;
                    $.ajax({
                        type: 'DELETE',
                        url: apiurl + 'message/' + event.id,
                        contentType: 'application/json',
                        dataType: 'json',
                        statusCode: {
                            204: function(data) {
                                expect(data).to.equal(null);
                        }}
                    });
                });
            });
        });
        it('POST an like and DELETE it', function(done) {
            var feed_name = 'test_' + Date.now();
            var feeds = Feeds(sockjsurl);
            var eid = null;
            feeds.initialize(function() {
                var testfeed = feeds.feed(feed_name);
                testfeed.on('join', function(event) {
                    /*for (var i = 0; i < 10; i++) {*/
                        $.ajax({
                            type: 'POST',
                            url: apiurl + 'like/',
                            data: JSON.stringify({
                                action: 'message.like',
                                feed: feed_name,
                                parent: 666
                            }),
                            contentType: 'application/json',
                            dataType: 'json',
                            success: function(data) {
                            }
                        });
                    /*}*/
                });
                testfeed.join();
                testfeed.on('message.like.delete', function(event) {
                    expect(event.id).to.equal(eid);
                    expect(event.reference).to.equal(0);
                    expect(event.parent).to.equal(666);
                    $.ajax({
                        type: 'GET',
                        url: apiurl + 'like/' + event.id,
                        contentType: 'application/json',
                        dataType: 'json',
                        statusCode: {
                            404: function(data, jqXHR) {
                                done();
                        }}
                    });
                });
                testfeed.on('message.like', function(event) {
                    expect(event.id).to.be.a('number');
                    expect(event.parent).to.equal(666);
                    expect(event.reference).to.equal(1);
                    eid = event.id;
                    $.ajax({
                        type: 'DELETE',
                        url: apiurl + 'like/' + event.id,
                        contentType: 'application/json',
                        dataType: 'json',
                        statusCode: {
                            204: function(data) {
                                expect(data).to.equal(null);
                        }}
                    });
                });
            });
        });
    });

    expect = chai.expect;
    if (window.mochaPhantomJS) { mochaPhantomJS.run(); }
    else { mocha.run(); }

});
