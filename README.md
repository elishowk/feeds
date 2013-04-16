# Feeds for Videotag

It's  a real-time and multi-user messaging and synchronization back-end for Django, built-on alos on Tornado and SockJS
It's developed at CommOnEcoute SAS (Paris, France) under [GNU AGPL 3](http://www.gnu.org/licenses/agpl.html)

## Install

1- install Redis-server
2- install django-tastypie, sockjs-tornado, thoonk and hiredis in your virtualenv

## API

The REST is built with Django-Tastypie.
If you create an Event item, you'll get a corresponding JSON by requesting its path according to default Tastypie behavior.

* http://django-tastypie.readthedocs.org/en/latest/index.html

## Feeds

* Integration of SockJS-tornado
* provides a client-side javascript class named 'Feeds' (see "static/feeds/feeds.js")
* To start tornado within django's configuration (install Redis server) use
    $ env/bin/python ./manage.py socketserver

### Event JSON specification

* json exchanged between static/feeds/feeds.js and the server follow the following rules

```javascript
event = {
    category: 'feed',
    feed: 'a feed name',
    action: 'join' | 'leave' | 'get_ids' | 'get_all' | 'get_item' | 'retract' | 'publish',
    uuid: 'optional uuid sent by the client to reference a callback client-side',
    id: '32 characters UUID4 hexa + (event.timecode  || nothing), required in get_item() and retract() actions',
    type: 'namespaced event, eg. feed.join, feed.leave, required',
    from: 'user unique id, required',
    datetime: 'seconds since EPOCH when publish action happened, required'
    timecode: '5 digits, optional'
    metadata: { clientDefined: 'metadata'}
};
```
