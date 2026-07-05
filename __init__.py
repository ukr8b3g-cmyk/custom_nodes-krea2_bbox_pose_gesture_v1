import json
from pathlib import Path

from .nodes_pose_gesture_injector import (
    NODE_CLASS_MAPPINGS,
    NODE_DISPLAY_NAME_MAPPINGS,
    PRESETS_BY_CATEGORY_DISPLAY,
)

WEB_DIRECTORY = "./web"

_PRESET_FILE = Path(__file__).resolve().parent / "pose_gesture_presets.json"


def _safe_preset_payload():
    try:
        data = json.loads(_PRESET_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {"version": "unavailable", "presets": []}
    if not isinstance(data, dict):
        return {"version": "invalid", "presets": []}
    presets = data.get("presets")
    if not isinstance(presets, list):
        data["presets"] = []
    data["categories"] = PRESETS_BY_CATEGORY_DISPLAY
    return data


try:
    from aiohttp import web
    from server import PromptServer

    @PromptServer.instance.routes.get("/krea2_bbox_pose_gesture/presets")
    async def krea2_pose_gesture_presets(request):
        return web.json_response(_safe_preset_payload())
except Exception:
    pass


__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
