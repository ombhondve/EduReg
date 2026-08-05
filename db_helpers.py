# db_helpers.py
from flask import g
from shared.model import controller
from superadmin_Dash_APIs.model import superadmin_models
# from wherever search_class lives
from services.search_user import search_class

def get_superadmin_db():
    if 'obj_sup' not in g:
        g.obj_sup = superadmin_models()
    return g.obj_sup

def get_main_db():
    if 'obj' not in g:
        g.obj = controller()
    return g.obj

def get_search_db():
    if 'search_obj' not in g:
        g.search_obj = search_class()
    return g.search_obj

def close_db(exception):
    for key in ('obj_sup', 'obj', 'search_obj'):
        instance = g.pop(key, None)
        if instance is not None:
            instance.close()