"""Verify the honest static deployment status, not the backend application."""
import sys
import time
from urllib.request import urlopen
from urllib.error import HTTPError, URLError

base = sys.argv[1] if len(sys.argv) > 1 else 'https://doees.github.io/crm-telko/'
for attempt in range(12):
    try:
        with urlopen(base, timeout=20) as response:
            html = response.read().decode()
            if response.status == 200 and 'Menunggu VPS dan domain' in html and 'Aplikasi backend belum dihosting' in html:
                print('200 deployment status verified:', base)
                break
    except (HTTPError, URLError, TimeoutError):
        pass
    if attempt == 11:
        raise RuntimeError('Deployment status not published: ' + base)
    time.sleep(5)
