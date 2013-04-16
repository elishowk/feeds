# -*- coding: utf-8 -*-
"""
This is launched as a Django manage.py Command 'socketserver', so it can do that :
Public Websocket API for cross-domain ajax and bidirect. real-time communication
"""
import json
from sockjs.tornado import SockJSConnection
from django.conf import settings
from thoonkfeeds import ThoonkFeeds


class GlobalConnection(SockJSConnection):
    def __init__(self, *args, **kwargs):
        super(GlobalConnection, self).__init__(*args, **kwargs)
        self._thoonkfeeds = ThoonkFeeds(
            sockjsconnection=self)

    def on_open(self, connection_info):
        """
        Hello
        """
        self._userid = False

    def on_close(self):
        """
        Goodbye
        TODO close user session
        """
        pass

    def on_message(self, message):
        """
        receives requests or feed events formatted in JSON
        """
        event = json.loads(message)
        if 'feed' in event:
            self._thoonkfeeds.handle(event)
            return
        self.send_error({'statusText': 'bad request',
                         'message': 'not supported'}, 400)

    def send_error(self, content, status_code, headers=None):
        """
        sends error from this level of the application,
        let requests returns classical HTTP errors into send_response
        """
        if headers is None:
            headers = 'Content-Type: application/json'
        self.send(json.dumps({'metadata': {
                                  'data': content,
                                  'status_code': status_code,
                                  'headers': headers
                             }}))
