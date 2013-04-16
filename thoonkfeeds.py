# -*- coding: utf-8 -*-
"""
Thoonk overlay to handle Poser SockJS websocket messages
"""
from django.conf import settings
from tornado.ioloop import IOLoop
from thoonk import Thoonk
import json


class ThoonkFeeds(Thoonk):
    """
    each ThoonkFeeds instance is ONE sockjs connection
    """

    def __init__(self, sockjsconnection):
        super(ThoonkFeeds, self).__init__(
            host=settings.REDIS['host'],
            port=settings.REDIS['port'],
            db=settings.REDIS['db'],
            listen=True)
        self.feeds = {}
        self.register_handler("publish", self.publish_callback)
        self.register_handler("retract", self.retract_callback)
        self.sockjs = sockjsconnection

    def publish_callback(self, feedname, item, pid):
        """
        Sends a published event, raw style
        """
        if feedname in self.feeds:
            self.send_json(item, raw=True)

    def retract_callback(self, feedname, pid):
        """
        Sends a retracted event
        """
        if feedname in self.feeds:
            self.send_json({
                'id': pid,
                'feed': feedname,
                'action': 'message.delete'
            })

    def send_json(self, data, raw=False):
        """
        prepares data and schedule the execution
        of the lambda function in the main thread
        preventing from race condition
        """
        if raw is False:
            data = json.dumps(data)
        IOLoop.instance().add_callback(lambda: self.sockjs.send(data))

    def handle(self, event):
        """
        TODO check user's group/event authorizations
        """
        if self._validate_event(event) is False:
            return
        if self.dispatch(event) is False:
            self.sockjs.send_error({'statusText': 'bad request',
                                    'message': 'not implemented'},
                                   400)

    def dispatch(self, event):
        """
        Maps event['action'] to a method
        """
        method = getattr(self, event['action'])
        if not method:
            return False
        method(event)

    def join(self, event):
        """
        Subscribe user to a channel
        Start sending live events
        Push 'join' to the other users
        """
        feedname = event['feed']
        feed = self.feed(feedname)
        self.feeds[feedname] = feed
        self.publish_action({
            'id': int(event['id']),
            'action': 'join',
            'feed': feedname,
        })

    def leave(self, event):
        """
        Unsubscribe user to a channel
        Stop sending live events
        Push 'leave' to the other users
        """
        if event['feed'] not in self.feeds:
            return
        feedname = event['feed']
        self.publish_action({
            'id': int(event['id']),
            'action': 'leave',
            'feed': feedname,
        })
        del self.feeds[feedname]

    def publish_action(self, event):
        """
        Push notification
        """
        if 'created_by' not in event and self.sockjs._userid:
            event['created_by'] = self.sockjs._userid
        else:
            event['created_by'] = -1
        try:
            feed = self.feed(event['feed'])
            feed.publish(json.dumps(event), str(event['id']))
        except Exception, exc:
            self.sockjs.send_error({'statusText': 'server error',
                                    'message':
                                    'Exception on feed.publish(): %s' %
                                    exc}, 500)

    def _validate_event(self, event):
        """
        checks event syntax dude
        """
        if 'feed' not in event:
            self.sockjs.send_error({'statusText': 'bad request',
                                    'message': 'missing event.feed'},
                                   400)
            return False
        if 'action' not in event:
            self.sockjs.send_error({'statusText': 'bad request',
                                    'message': 'missing event.action'},
                                   400)
            return False
