"""HTTP smoke check for the deployed static demo (Python 3 standard library)."""
import sys
import time
from html.parser import HTMLParser
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import urlopen

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'https://doees.github.io/crm-telko/').rstrip('/') + '/'

class Assets(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = set()

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'script' and attrs.get('src'):
            self.urls.add(urljoin(BASE, attrs['src']))
        if tag == 'link' and attrs.get('rel') == 'stylesheet':
            self.urls.add(urljoin(BASE, attrs['href']))

# Allow the GitHub Pages CDN time to publish the new deployment.
for attempt in range(12):
    try:
        with urlopen(BASE, timeout=20) as response:
            html = response.read().decode()
            if response.status == 200 and 'Nusa CRM' in html:
                break
    except (HTTPError, URLError, TimeoutError):
        pass
    if attempt == 11:
        raise RuntimeError('Public dashboard is not ready: ' + BASE)
    time.sleep(5)

assets = set()
for route in ['', 'dashboard/', 'customers/', 'packages/', 'subscriptions/', 'tickets/', 'integrations/', 'reports/', 'settings/']:
    with urlopen(urljoin(BASE, route), timeout=20) as response:
        html = response.read().decode()
        assert response.status == 200 and 'Nusa CRM' in html, route
        parser = Assets()
        parser.feed(html)
        assets.update(parser.urls)
        print('200 HTML OK:', urljoin(BASE, route))

for asset in sorted(assets):
    assert asset.startswith(BASE + '_next/'), asset
    with urlopen(asset, timeout=20) as response:
        assert response.status == 200 and response.read(), asset
print('JS/CSS assets verified:', len(assets))

try:
    urlopen(urljoin(BASE, 'route-tidak-ada/'), timeout=20)
except HTTPError as error:
    assert error.code == 404, error.code
    print('404 OK: unknown route')
else:
    raise AssertionError('Unknown route must return 404')
