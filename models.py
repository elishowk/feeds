# -*- coding: utf-8 -*-
from django.db import models


class Event(models.Model):
    """
    An Event
    """
    feed = models.CharField(db_index=True, max_length=255)
    action = models.CharField(db_index=True, max_length=255)
    created_by = models.IntegerField(db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    parent = models.IntegerField(null=True, blank=True)
    metadata = models.TextField(null=True, blank=True)
    reference = models.CharField(null=True, blank=True, max_length=12)
