# extensions.py
#
# Shared Flask extension instances, created here (not inside controller.py)
# so that blueprint modules like Auth/controller.py can import `limiter`
# directly and decorate their own routes with @limiter.limit(...) without
# creating a circular import with the main controller.py, which registers
# those same blueprints.

from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(get_remote_address, default_limits=["200 per hour"])
