# -*- coding: utf-8 -*-
"""
Public REST API
"""
from copy import deepcopy
from .models import Event
from tastypie.resources import ModelResource, ALL
from tastypie.authentication import Authentication
from tastypie.authorization import Authorization
from tastypie.exceptions import NotFound
import json
from thoonk import Thoonk
from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist


class AbstractEventResource(ModelResource):
    class Meta:
        queryset = Event.objects.all()
        resource_name = 'event'
        always_return_data = True
        filtering = {
            'created_by': ALL,
            'created_at': ALL,
            'action': ALL,
            'parent': ALL,
            'id': ALL,
            'feed': ALL,
            'reference': ALL
        }
        ordering = [
            'created_by',
            'created_at',
            'action',
            'parent',
            'id',
            'feed',
            'reference'
        ]
        # TODO
        authentication = Authentication()
        authorization = Authorization()

    def __init__(self, *args, **kwargs):
        self._thoonkfeeds = Thoonk(
            host=settings.REDIS['host'],
            port=settings.REDIS['port'],
            db=settings.REDIS['db'])
        super(AbstractEventResource, self).__init__(self, *args, **kwargs)

    def _publish_on_thoonk(self, bundle):
        """
        Notifies the corresponding Thoonk Feed of an Event instance
        """
        if bundle.obj.feed is not None:
            feedname = bundle.obj.feed
        elif 'feed' in bundle.data:
            feedname = bundle.data['feed']
        else:
            return

        if bundle.obj.action is not None:
            actionname = bundle.obj.action
        elif 'action' in bundle.data:
            actionname = bundle.data['action']
        else:
            return

        feed = self._thoonkfeeds.feed(feedname)

        if bundle.obj.id is not None:
            eid = bundle.obj.id
        elif 'id' in bundle.data:
            eid = bundle.data['id']
        else:
            return

        reference = None
        if bundle.obj.reference is not None:
            reference = bundle.obj.reference
        elif 'reference' in bundle.data:
            reference = bundle.data['reference']

        parent = None
        if bundle.obj.parent is not None:
            parent = bundle.obj.parent
        elif 'parent' in bundle.data:
            parent = bundle.data['parent']

        feed.publish(json.dumps({
            'id': eid,
            'action': actionname,
            'feed': feedname,
            'reference': reference,
            'parent': parent
        }), str(eid))

    def obj_create(self, bundle, request=None, **kwargs):
        """
        A Resource-specific implementation of ``obj_create``.
        """
        if request and request.user.is_authenticated():
            bundle.data['created_by'] = request.user.id
        elif 'created_by' not in bundle.data:
            bundle.data['created_by'] = -1

        bundle = super(AbstractEventResource, self).obj_create(bundle, request, **kwargs)
        self._publish_on_thoonk(bundle)
        return bundle

    def obj_update(self, bundle, request=None, **kwargs):
        """
        A Resource-specific implementation of ``obj_update``.
        """
        bundle = super(AbstractEventResource, self).obj_update(bundle, request, **kwargs)
        self._publish_on_thoonk(bundle)
        return bundle

    def obj_delete(self, request=None, **kwargs):
        """
        A Resource-specific implementation of ``obj_delete``.
        """
        obj = kwargs.pop('_obj', None)

        if not hasattr(obj, 'delete'):
            try:
                obj = self.obj_get(request, **kwargs)
            except ObjectDoesNotExist:
                raise NotFound("A model instance matching the provided arguments could not be found.")
        eid = obj.id
        copyobj = deepcopy(obj)
        actionname = obj.action + ".delete"
        obj.delete()
        feed = self._thoonkfeeds.feed(obj.feed)
        if feed:
            feed.publish(json.dumps({
                'id': eid,
                'action': actionname,
                'feed': obj.feed,
                'reference': obj.reference,
                'parent': obj.parent
            }))
        return copyobj


class MessageResource(AbstractEventResource):
    class Meta:
        queryset = Event.objects.all()
        resource_name = 'message'
        always_return_data = True
        filtering = {
            'created_by': ALL,
            'created_at': ALL,
            'action': ALL,
            'parent': ALL,
            'id': ALL,
            'feed': ALL,
            'reference': ALL
        }
        ordering = [
            'created_by',
            'created_at',
            'action',
            'parent',
            'id',
            'feed',
            'reference'
        ]
        # TODO
        authentication = Authentication()
        authorization = Authorization()

    def dehydrate(self, bundle):
        """
        Like data aggregated
        """
        bundle.data['like_count'] = self.get_object_list(bundle.request).filter(
            parent=bundle.obj.id,
            action='message.like',
            feed=bundle.obj.feed).count()
        if bundle.request.user.is_authenticated():
            bundle.data['like_user'] = self.get_object_list(bundle.request).filter(
                parent=bundle.obj.id,
                created_by=bundle.request.user.id,
                action='message.like',
                feed=bundle.obj.feed).order_by('created_at').values('id')
            if len(bundle.data['like_user']) == 0:
                bundle.data['like_user'] = False
            else:
                bundle.data['like_user'] = bundle.data['like_user'][0]['id']
        else:
            bundle.data['like_user'] = False
        return bundle


class LikeResource(AbstractEventResource):
    """
    Resource for "like" Events
    """
    class Meta:
        queryset = Event.objects.all()
        resource_name = 'like'
        always_return_data = True
        filtering = {
            'created_by': ALL,
            'created_at': ALL,
            'action': ALL,
            'parent': ALL,
            'id': ALL,
            'feed': ALL,
            'reference': ALL
        }
        ordering = [
            'created_by',
            'created_at',
            'action',
            'parent',
            'id',
            'feed',
            'reference'
        ]
        # TODO
        authentication = Authentication()
        authorization = Authorization()

    def _get_total(self, parent, feed, action):
        return Event.objects.filter(parent=parent, feed=feed, action=action).count()

    def dehydrate(self, bundle):
        if not bundle.obj.parent or not bundle.obj.feed or not bundle.obj.action:
            return bundle
        bundle.data['reference'] = self._get_total(bundle.obj.parent, bundle.obj.feed, bundle.obj.action)
        return bundle

    def obj_delete(self, request=None, **kwargs):
        """
        A Resource-specific implementation of ``obj_delete``.
        """
        obj = kwargs.pop('_obj', None)

        if not hasattr(obj, 'delete'):
            try:
                obj = self.obj_get(request, **kwargs)
            except ObjectDoesNotExist:
                raise NotFound("A model instance matching the provided arguments could not be found.")
        copyobj = deepcopy(obj)
        actionname = obj.action + ".delete"
        obj.delete()
        feed = self._thoonkfeeds.feed(obj.feed)
        if feed:
            bundle = self.build_bundle(obj=copyobj, request=request)
            bundle = self.full_dehydrate(bundle)
            bundle = self.alter_detail_data_to_serialize(request, bundle)
            bundle.data['action'] = actionname
            response = self.create_response(request, bundle)
            feed.publish(response.content)
        return copyobj

    def obj_create(self, bundle, request=None, **kwargs):
        """
        A Resource-specific implementation of ``obj_create``.
        """
        if request and request.user.is_authenticated():
            bundle.data['created_by'] = request.user.id
        elif 'created_by' not in bundle.data:
            bundle.data['created_by'] = -1

        bundle = super(AbstractEventResource, self).obj_create(bundle, request, **kwargs)
        try:
            bundle.data['reference'] = self._get_total(bundle.data['parent'], bundle.data['feed'], bundle.data['action'])
        except:
            pass
        self._publish_on_thoonk(bundle)
        return bundle
