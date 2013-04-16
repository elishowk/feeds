# -*- coding: utf-8 -*-
from django.conf import settings
from django.shortcuts import render_to_response
from django.core.urlresolvers import reverse
from django.template.context import RequestContext


def tests(request):
    """
    returns application configuration into the template
    """
    context = _get_app_context(request)
    return render_to_response('feeds/tests.html', context)


def _get_app_context(request):
    context = RequestContext(request)
    abs_uri = request.build_absolute_uri('/').rstrip('/')
    context['feedsApiUrl'] = '%s%s' % (abs_uri, reverse('api_feeds_api_top_level', args=['feeds_api']))
    context['sockjsUrl'] = "%s%s" % (settings.SOCKJS_HOST, settings.SOCKJS_CHANNEL)
    return context
