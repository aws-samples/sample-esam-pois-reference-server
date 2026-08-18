# External Action Plugins

This directory contains concrete implementations of action plugins.

## Available Plugins

### MediaLive Plugin (`medialive_plugin.py`)
Controls AWS MediaLive channels through schedule actions.

**Supported Actions:**
- `static_image_activate` - Insert logo/image overlay
- `static_image_deactivate` - Remove logo/image overlay
- `motion_graphics_activate` - Activate motion graphics
- `motion_graphics_deactivate` - Deactivate motion graphics
- `input_switch` - Switch between inputs
- `scte35_splice_insert` - Insert SCTE-35 splice
- `scte35_time_signal` - Insert SCTE-35 time signal
- `pause_state` - Pause pipeline

**Features:**
- Automatic cleanup actions (deactivate after activate)
- Rate limiting (5 calls/second)
- AWS IAM role support

### Webhook Plugin (`webhook_plugin.py`)
Calls arbitrary HTTP APIs when signals are detected.

**Supported Methods:**
- GET, POST, PUT, DELETE

**Authentication:**
- None
- Basic Auth
- Bearer Token

**Features:**
- Template-based request bodies
- Custom headers
- SSL verification (configurable)

## Usage Example

```python
from domain.services.plugin_registry import get_global_registry
from domain.services.plugins.medialive_plugin import MediaLiveActionPlugin
from domain.services.plugins.webhook_plugin import WebhookActionPlugin

# Register plugins
registry = get_global_registry()
registry.register(MediaLiveActionPlugin())
registry.register(WebhookActionPlugin())

# Plugins are now available for use
```
