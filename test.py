import secrets
from datetime import datetime, timedelta
token=secrets.token_urlsafe(64)
expiry = (datetime.now() + timedelta(minutes=30))
print(token)
print(expiry)