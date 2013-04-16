# -*- coding: utf-8 -*-
from django.conf.urls.defaults import patterns, url, include
from .rest import MessageResource, LikeResource
from .views import tests
from tastypie.api import Api

api = Api(api_name='feeds_api')
api.register(MessageResource())
api.register(LikeResource())


urlpatterns = patterns('',
                       (r'', include(api.urls)),
                       (r'tests.html', tests),
                       )
