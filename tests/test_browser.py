"""
Browser acceptance tests for ViewSimulation project.

Tests the main UI functionality using Playwright in headless Chromium.
Verifies that:
- The page loads without JavaScript errors
- Main UI elements are present and visible
- Floor slider updates the display correctly
"""

import unittest
import subprocess
import time
import socket
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright, Page


def find_free_port():
    """Find a free TCP port on localhost."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('127.0.0.1', 0))
        s.listen(1)
        port = s.getsockname()[1]
    return port


def wait_for_server(url, timeout=10):
    """Poll server URL until it responds with 200, or timeout."""
    import urllib.request
    import urllib.error
    start = time.time()
    while time.time() - start < timeout:
        try:
            with urllib.request.urlopen(url, timeout=2) as response:
                if response.status == 200:
                    return True
        except (urllib.error.URLError, OSError):
            time.sleep(0.2)
    return False


class BrowserTestCase(unittest.TestCase):
    """Base test case that manages HTTP server and browser lifecycle."""
    
    server_process = None
    playwright = None
    browser = None
    port = None
    base_url = None
    
    @classmethod
    def setUpClass(cls):
        """Start HTTP server and launch browser once for all tests."""
        # Find project root (where index.html is)
        repo_root = Path(__file__).parent.parent.resolve()
        
        # Start HTTP server on random free port
        cls.port = find_free_port()
        cls.base_url = f"http://127.0.0.1:{cls.port}"
        
        cls.server_process = subprocess.Popen(
            [sys.executable, '-m', 'http.server', str(cls.port), '--directory', str(repo_root)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            cwd=repo_root
        )
        
        # Wait for server to be ready
        if not wait_for_server(cls.base_url, timeout=10):
            cls.server_process.terminate()
            cls.server_process.wait()
            raise RuntimeError(f"HTTP server failed to start on port {cls.port}")
        
        # Launch Playwright browser
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(
            headless=True,
            args=['--use-gl=swiftshader']  # Software WebGL for CI
        )
    
    @classmethod
    def tearDownClass(cls):
        """Shut down browser and server."""
        if cls.browser:
            cls.browser.close()
        if cls.playwright:
            cls.playwright.stop()
        if cls.server_process:
            cls.server_process.terminate()
            cls.server_process.wait(timeout=5)
    
    def setUp(self):
        """Create a new page for each test."""
        self.page = self.browser.new_page()
        self.js_errors = []
        self.page_errors = []
        
        # Set up error listeners
        self.page.on('pageerror', lambda exc: self.page_errors.append(str(exc)))
        self.page.on('console', self._handle_console)
    
    def tearDown(self):
        """Close the page after each test."""
        if self.page:
            self.page.close()
    
    def _handle_console(self, msg):
        """Filter and collect console errors."""
        if msg.type == 'error':
            text = msg.text
            # Whitelist: ignore favicon, network errors, and Leaflet CSS warnings
            if any(pattern in text.lower() for pattern in ['favicon', 'net::err', 'leaflet']):
                return
            self.js_errors.append(text)


class ViewSimulationTests(BrowserTestCase):
    """Test suite for main ViewSimulation functionality."""
    
    def test_index_loads_without_js_errors(self):
        """Verify index.html loads and runs without JavaScript errors."""
        # Navigate to index
        self.page.goto(self.base_url + '/')
        
        # Wait for main scene canvas to appear
        self.page.wait_for_selector('#scene', timeout=10000)
        
        # Give time for Three.js CDN to load and initialize
        time.sleep(2)
        
        # Check for page errors (exceptions)
        if self.page_errors:
            self.fail(f"Page errors detected:\n" + "\n".join(self.page_errors))
        
        # Check for console errors (filtered)
        if self.js_errors:
            self.fail(f"Console errors detected:\n" + "\n".join(self.js_errors))
    
    def test_main_ui_elements_visible(self):
        """Verify all main UI elements are present and visible."""
        self.page.goto(self.base_url + '/')
        
        # List of critical selectors that must exist and be visible
        critical_elements = [
            '#scene',      # Main 3D canvas
            '#panel',      # Control panel
            '#floor',      # Floor slider
            '#flN',        # Floor number display
            '#htV',        # Height value display
            '#bXsec'       # Cross-section button
        ]
        
        for selector in critical_elements:
            locator = self.page.locator(selector)
            # Check element exists
            self.assertTrue(
                locator.count() > 0,
                f"Element {selector} not found in DOM"
            )
            # Check element is visible
            self.assertTrue(
                locator.is_visible(),
                f"Element {selector} exists but is not visible"
            )
    
    def test_floor_slider_updates_display(self):
        """Verify floor slider updates the floor number display."""
        self.page.goto(self.base_url + '/')
        
        # Wait for scene canvas to be ready
        self.page.wait_for_selector('#scene', timeout=10000)
        
        # Wait a moment for JavaScript to initialize
        time.sleep(1)
        
        # Get initial floor number
        initial_floor = self.page.locator('#flN').text_content()
        
        # Change floor slider to 50
        floor_slider = self.page.locator('#floor')
        floor_slider.fill('50')
        floor_slider.dispatch_event('input')
        
        # Wait for floor display to update
        try:
            self.page.wait_for_function(
                """document.querySelector('#flN').textContent === '50'""",
                timeout=5000
            )
        except Exception:
            actual = self.page.locator('#flN').text_content()
            self.fail(f"Floor display did not update to '50', got '{actual}'")
        
        # Verify the update
        updated_floor = self.page.locator('#flN').text_content()
        self.assertEqual(updated_floor, '50', "Floor number display should show '50'")
    
    def test_all_core_js_modules_accessible(self):
        """Verify core JavaScript modules can be fetched (safety net)."""
        self.page.goto(self.base_url + '/')
        
        core_modules = [
            '/js/main.js',
            '/js/constants.js',
            '/js/scene.js',
            '/js/visibility.js',
            '/js/terrain.js'
        ]
        
        for module_path in core_modules:
            response = self.page.request.get(self.base_url + module_path)
            self.assertEqual(
                response.status, 200,
                f"Core module {module_path} returned status {response.status}"
            )


if __name__ == '__main__':
    unittest.main()
