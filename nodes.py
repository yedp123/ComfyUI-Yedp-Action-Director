import os
import torch
import numpy as np
import folder_paths
from server import PromptServer
from aiohttp import web
from PIL import Image
import base64
import io
import json
import hashlib
import uuid

# --- CONFIGURATION ---
if "yedp_anims" not in folder_paths.folder_names_and_paths:
    folder_paths.folder_names_and_paths["yedp_anims"] = ([os.path.join(folder_paths.get_input_directory(), "yedp_anims")], {".glb", ".fbx", ".bvh"})

if "yedp_envs" not in folder_paths.folder_names_and_paths:
    folder_paths.folder_names_and_paths["yedp_envs"] = ([os.path.join(folder_paths.get_input_directory(), "yedp_envs")], {".glb", ".gltf", ".fbx", ".obj", ".ply", ".splat", ".ksplat", ".spz", ".sog"})

if "yedp_cams" not in folder_paths.folder_names_and_paths:
    folder_paths.folder_names_and_paths["yedp_cams"] = ([os.path.join(folder_paths.get_input_directory(), "yedp_cams")], {".glb", ".fbx"})

if "yedp_rigs" not in folder_paths.folder_names_and_paths:
    folder_paths.folder_names_and_paths["yedp_rigs"] = ([os.path.join(folder_paths.get_input_directory(), "yedp_rigs")], {".glb", ".gltf", ".fbx"})

if "yedp_mocap" not in folder_paths.folder_names_and_paths:
    folder_paths.folder_names_and_paths["yedp_mocap"] = ([os.path.join(folder_paths.get_input_directory(), "yedp_mocap")], {".json"})

if "yedp_blockout" not in folder_paths.folder_names_and_paths:
    folder_paths.folder_names_and_paths["yedp_blockout"] = ([os.path.join(folder_paths.get_input_directory(), "yedp_blockout")], {".json"})

if "yedp_scenes" not in folder_paths.folder_names_and_paths:
    folder_paths.folder_names_and_paths["yedp_scenes"] = ([os.path.join(folder_paths.get_input_directory(), "yedp_scenes")], {".json"})

if "yedp_hdri" not in folder_paths.folder_names_and_paths:
    folder_paths.folder_names_and_paths["yedp_hdri"] = ([os.path.join(folder_paths.get_input_directory(), "yedp_hdri")], {".hdr", ".exr"})

# Global Caches for massive payloads
YEDP_PAYLOAD_CACHE = {}
YEDP_CHUNKS = {}

class YedpActionDirector:
    """
    ComfyUI-Yedp-Action-Director (V9.3 Edition - Sequencer, Mocap, & Textured Pass)
    """
    
    def __init__(self):
        self.output_dir = folder_paths.get_output_directory()
        self.type = "output"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "width": ("INT", {"default": 512, "min": 64, "max": 4096, "step": 8}),
                "height": ("INT", {"default": 512, "min": 64, "max": 4096, "step": 8}),
                "frame_count": ("INT", {"default": 48, "min": 1, "max": 3000}),
                "fps": ("INT", {"default": 24, "min": 1, "max": 60}),
                "client_data": ("STRING", {"default": "", "multiline": False}), 
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
            }
        }

    RETURN_TYPES = ("IMAGE", "IMAGE", "IMAGE", "IMAGE", "IMAGE", "IMAGE", "IMAGE")
    RETURN_NAMES = ("POSE_BATCH", "DEPTH_BATCH", "CANNY_BATCH", "NORMAL_BATCH", "SHADED_BATCH", "ALPHA_BATCH", "TEXTURED_BATCH")
    FUNCTION = "render"
    CATEGORY = "Yedp/MoCap"
    
    DESCRIPTION = "Controls multiple 3D characters, environment props (GLTF/FBX/PLY), and camera keyframes."

    @classmethod
    def IS_CHANGED(cls, width, height, frame_count, fps, client_data=None, unique_id=None):
        if client_data:
            return hashlib.md5(client_data.encode()).hexdigest()
        return float("NaN")

    def decode_batch(self, b64_list, width, height, debug_name="batch"):
        tensor_list = []
        
        for i, b64_str in enumerate(b64_list):
            if "," in b64_str:
                b64_str = b64_str.split(",")[1]
            
            try:
                image_data = base64.b64decode(b64_str)
                image = Image.open(io.BytesIO(image_data)).convert("RGB")
                
                if image.size != (width, height):
                    image = image.resize((width, height), Image.LANCZOS)
                    
                img_np = np.array(image).astype(np.float32) / 255.0
                tensor_list.append(torch.from_numpy(img_np))
            except Exception as e:
                print(f"[Yedp] Frame {i} error: {e}")
                tensor_list.append(torch.zeros((height, width, 3)))

        if not tensor_list:
            return torch.zeros((1, height, width, 3))

        return torch.stack(tensor_list)

    def render(self, width, height, frame_count, fps, client_data=None, unique_id=None):
        if not client_data or len(client_data) < 10:
            print("[Yedp] ERROR: No image data received from frontend.")
            red_frame = torch.zeros((1, height, width, 3))
            red_frame[:,:,:,0] = 1.0 
            return (red_frame, red_frame, red_frame, red_frame, red_frame, red_frame, red_frame)

        global YEDP_PAYLOAD_CACHE
        data = {}
        
        if client_data.startswith("yedp_payload_"):
            if client_data in YEDP_PAYLOAD_CACHE:
                data = YEDP_PAYLOAD_CACHE[client_data]
            else:
                print(f"[Yedp] ERROR: Payload ID {client_data} not found in memory cache! Please click BAKE in the node again.")
                red_frame = torch.zeros((1, height, width, 3))
                red_frame[:,:,:,0] = 1.0 
                return (red_frame, red_frame, red_frame, red_frame, red_frame, red_frame, red_frame)
        else:
            try:
                data = json.loads(client_data)
            except json.JSONDecodeError as e:
                print(f"[Yedp] JSON Decode Error.")
                raise ValueError("Failed to parse JSON from client.")

        pose_batch = self.decode_batch(data.get("pose", []), width, height, "pose")
        depth_batch = self.decode_batch(data.get("depth", []), width, height, "depth")
        canny_batch = self.decode_batch(data.get("canny", []), width, height, "canny")
        normal_batch = self.decode_batch(data.get("normal", []), width, height, "normal")
        shaded_batch = self.decode_batch(data.get("shaded", []), width, height, "shaded")
        alpha_batch = self.decode_batch(data.get("alpha", []), width, height, "alpha")
        textured_batch = self.decode_batch(data.get("textured", []), width, height, "textured")
        
        print(f"[Yedp] Successfully rendered {len(pose_batch)} frames (7 batches).")
        return (pose_batch, depth_batch, canny_batch, normal_batch, shaded_batch, alpha_batch, textured_batch)


class YedpMocapSurgeon:
    """
    ComfyUI-Yedp-Mocap-Surgeon
    Standalone tool for overlaying 3D rigs onto video plates for mocap alignment.
    This is primarily a visual frontend node.
    """
    def __init__(self):
        self.type = "output"

    @classmethod
    def INPUT_TYPES(cls):

        return {
            "required": {
                "info": ("STRING", {"default": "Frontend visualization tool. No backend execution required.", "multiline": True}),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
            }
        }

    RETURN_TYPES = ()
    FUNCTION = "run"
    CATEGORY = "Yedp/MoCap"
    OUTPUT_NODE = True

    def run(self, info="", unique_id=None):
        # Mocap Surgeon does all its work in the browser, so it just passes through on execution.
        return ()


class YedpBlockout:
    """
    ComfyUI-Yedp-Blockout
    Minimal 3D blockout viewport for scene layout and composition.
    All rendering and interaction happens in the browser frontend.
    """
    def __init__(self):
        self.type = "output"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "width": ("INT", {"default": 512, "min": 64, "max": 4096, "step": 8}),
                "height": ("INT", {"default": 512, "min": 64, "max": 4096, "step": 8}),
                "info": ("STRING", {"default": "Blockout viewport. All interaction happens in the browser.", "multiline": False}),
                "client_data": ("STRING", {"default": "", "multiline": False}),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
            }
        }

    RETURN_TYPES = ("IMAGE", "IMAGE", "IMAGE", "IMAGE")
    RETURN_NAMES = ("SHADED", "TEXTURED", "DEPTH", "NORMAL")
    FUNCTION = "render"
    CATEGORY = "Yedp/Blockout"
    OUTPUT_NODE = True
    DESCRIPTION = "Minimal 3D viewport for blockout and scene composition."

    @classmethod
    def IS_CHANGED(cls, width, height, info, client_data=None, unique_id=None):
        if client_data:
            return hashlib.md5(client_data.encode()).hexdigest()
        return float("NaN")

    def decode_single_image(self, b64_str, width, height, debug_name="image"):
        if not b64_str:
            return torch.zeros((1, height, width, 3))
            
        if "," in b64_str:
            b64_str = b64_str.split(",")[1]
            
        try:
            image_data = base64.b64decode(b64_str)
            image = Image.open(io.BytesIO(image_data)).convert("RGB")
            
            if image.size != (width, height):
                image = image.resize((width, height), Image.LANCZOS)
                
            img_np = np.array(image).astype(np.float32) / 255.0
            return torch.from_numpy(img_np).unsqueeze(0)
        except Exception as e:
            print(f"[Yedp] Blockout {debug_name} decode error: {e}")
            return torch.zeros((1, height, width, 3))

    def render(self, width, height, info="", client_data=None, unique_id=None):
        if not client_data or len(client_data) < 10:
            print("[Yedp] ERROR: No image data received from frontend for Blockout.")
            red_frame = torch.zeros((1, height, width, 3))
            red_frame[:,:,:,0] = 1.0 
            return (red_frame, red_frame, red_frame, red_frame)

        try:
            data = json.loads(client_data)
        except json.JSONDecodeError as e:
            print(f"[Yedp] JSON Decode Error.")
            red_frame = torch.zeros((1, height, width, 3))
            red_frame[:,:,:,0] = 1.0 
            return (red_frame, red_frame, red_frame, red_frame)

        shaded = self.decode_single_image(data.get("shaded", ""), width, height, "shaded")
        textured = self.decode_single_image(data.get("textured", ""), width, height, "textured")
        depth = self.decode_single_image(data.get("depth", ""), width, height, "depth")
        normal = self.decode_single_image(data.get("normal", ""), width, height, "normal")
        
        print(f"[Yedp] Successfully rendered Blockout outputs.")
        return (shaded, textured, depth, normal)


# --- API ROUTES ---

@PromptServer.instance.routes.get("/yedp/get_blockout_assets")
async def get_blockout_assets(request):
    """
    Scans the local web/blockout/ subdirectories for custom user templates.
    """
    base_dir = os.path.join(os.path.dirname(__file__), "web", "blockout")
    assets = {}
    categories = ["architecture", "vehicle", "furniture", "props", "plants", "food", "weapons", "lighting"]
    
    for cat in categories:
        cat_dir = os.path.join(base_dir, cat)
        try:
            os.makedirs(cat_dir, exist_ok=True)
        except Exception:
            pass # Symlinks or permissions might throw, safely ignore
            
        if os.path.exists(cat_dir):
            assets[cat] = [f for f in os.listdir(cat_dir) if f.lower().endswith(('.glb', '.gltf', '.fbx'))]
        else:
            assets[cat] = []
            
    return web.json_response({"assets": assets})


@PromptServer.instance.routes.post("/yedp/upload_asset")
async def upload_asset(request):
    try:
        reader = await request.multipart()
        subfolder = "yedp_envs" # Fallback
        filename = "uploaded_asset.glb"
        file_path = None
        
        async for field in reader:
            if field.name == 'subfolder':
                subfolder = (await field.read()).decode('utf-8')
            elif field.name == 'file':
                if field.filename:
                    filename = field.filename
                
                # Sanitize filename
                safe_name = "".join([c for c in filename if c.isalnum() or c in [' ', '_', '.', '-']]).rstrip()
                
                # Verify subfolder exists in paths to prevent saving outside allowed directories
                if subfolder not in folder_paths.folder_names_and_paths:
                    return web.json_response({"status": "error", "message": "Invalid subfolder configuration"}, status=400)
                
                target_dir = folder_paths.folder_names_and_paths[subfolder][0][0]
                target_dir = os.path.realpath(target_dir) # Resolves Windows/Linux Symlinks perfectly
                try:
                    os.makedirs(target_dir, exist_ok=True)
                except Exception as e:
                    pass 
                
                file_path = os.path.join(target_dir, safe_name)
                
                temp_path = file_path + ".tmp"
                
                # Stream the file in chunks to a temporary file
                with open(temp_path, "wb") as f:
                    while True:
                        chunk = await field.read_chunk()
                        if not chunk:
                            break
                        f.write(chunk)
                
                # Replace the original file with the temporary file
                try:
                    if os.path.exists(file_path):
                        os.remove(file_path)
                    os.rename(temp_path, file_path)
                except PermissionError:
                    # On Windows, if the user uploads a file from the destination folder, 
                    # the browser locks the file for reading, causing os.remove to fail.
                    # We can safely discard the temp file since the original is already in place.
                    if os.path.exists(temp_path):
                        try:
                            os.remove(temp_path)
                        except:
                            pass
                except Exception as e:
                    print(f"[Yedp] Error moving temp file: {e}")
                
        if not file_path:
            return web.json_response({"status": "error", "message": "No file received"}, status=400)
            
        print(f"[Yedp] Successfully uploaded asset to {file_path}")
        return web.json_response({"status": "success", "filename": safe_name})
        
    except Exception as e:
        print(f"[Yedp] Failed to upload asset: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)


@PromptServer.instance.routes.get("/yedp/get_hdris")
async def get_hdris(request):
    files = folder_paths.get_filename_list("yedp_hdri")
    if not files:
        files = []
    return web.json_response({"files": files})

@PromptServer.instance.routes.get("/yedp/get_animations")
async def get_animations(request):
    files = folder_paths.get_filename_list("yedp_anims")
    if not files:
        files = []
    return web.json_response({"files": files})

@PromptServer.instance.routes.get("/yedp/get_envs")
async def get_envs(request):
    files = folder_paths.get_filename_list("yedp_envs")
    if not files:
        files = []
    return web.json_response({"files": files})

@PromptServer.instance.routes.get("/yedp/get_cams")
async def get_cams(request):
    files = folder_paths.get_filename_list("yedp_cams")
    if not files:
        files = []
    return web.json_response({"files": files})

@PromptServer.instance.routes.get("/yedp/get_mocaps")
async def get_mocaps(request):
    files = folder_paths.get_filename_list("yedp_mocap")
    if not files:
        files = []
    return web.json_response({"files": files})

@PromptServer.instance.routes.post("/yedp/save_mocap")
async def save_mocap(request):
    try:
        data = await request.json()
        name = data.get("name", "Capture")
        mocap_id = data.get("id", uuid.uuid4().hex[:8])
        
        safe_name = "".join([c for c in name if c.isalnum() or c in [' ', '_']]).rstrip()
        safe_name = safe_name.replace(" ", "_")
        file_name = f"{safe_name}_{mocap_id}.json"

        mocap_dir = folder_paths.folder_names_and_paths["yedp_mocap"][0][0]
        os.makedirs(mocap_dir, exist_ok=True)
        
        file_path = os.path.join(mocap_dir, file_name)
        with open(file_path, "w") as f:
            json.dump(data, f)
            
        print(f"[Yedp] Saved Mocap data to {file_path}")
        return web.json_response({"status": "success", "file": file_name})
    except Exception as e:
        print(f"[Yedp] Failed to save Mocap: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)

@PromptServer.instance.routes.get("/yedp/get_scenes")
async def get_scenes(request):
    files = folder_paths.get_filename_list("yedp_blockout")
    if not files:
        files = []
    return web.json_response({"files": files})

@PromptServer.instance.routes.post("/yedp/save_scene")
async def save_scene(request):
    try:
        data = await request.json()
        name = data.get("name", "SavedScene")
        scene_data = data.get("data", "{}")
        
        safe_name = "".join([c for c in name if c.isalnum() or c in [' ', '_', '-', '.']]).rstrip()
        safe_name = safe_name.replace(" ", "_")
        if not safe_name.endswith(".json"):
            safe_name += ".json"

        scene_dir = folder_paths.folder_names_and_paths["yedp_blockout"][0][0]
        scene_dir = os.path.realpath(scene_dir)
        try:
            os.makedirs(scene_dir, exist_ok=True)
        except Exception as e:
            pass 
        
        file_path = os.path.join(scene_dir, safe_name)
        
        if isinstance(scene_data, str):
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(scene_data)
        else:
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(scene_data, f)
            
        print(f"[Yedp] Saved Scene data to {file_path}")
        return web.json_response({"status": "success", "file": safe_name})
    except Exception as e:
        print(f"[Yedp] Failed to save Scene: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)

@PromptServer.instance.routes.get("/yedp/get_ad_scenes")
async def get_ad_scenes(request):
    files = folder_paths.get_filename_list("yedp_scenes")
    if not files:
        files = []
    return web.json_response({"files": files})

@PromptServer.instance.routes.post("/yedp/save_ad_scene")
async def save_ad_scene(request):
    try:
        data = await request.json()
        name = data.get("name", "SavedScene")
        scene_data = data.get("data", "{}")
        
        safe_name = "".join([c for c in name if c.isalnum() or c in [' ', '_', '-', '.']]).rstrip()
        safe_name = safe_name.replace(" ", "_")
        if not safe_name.endswith(".json"):
            safe_name += ".json"

        scene_dir = folder_paths.folder_names_and_paths["yedp_scenes"][0][0]
        scene_dir = os.path.realpath(scene_dir)
        try:
            os.makedirs(scene_dir, exist_ok=True)
        except Exception as e:
            pass 
        
        file_path = os.path.join(scene_dir, safe_name)
        
        if isinstance(scene_data, str):
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(scene_data)
        else:
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(scene_data, f)
            
        print(f"[Yedp] Saved Action Director Scene data to {file_path}")
        return web.json_response({"status": "success", "file": safe_name})
    except Exception as e:
        print(f"[Yedp] Failed to save Action Director Scene: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)


@PromptServer.instance.routes.post("/yedp/upload_payload_chunk")
async def upload_payload_chunk(request):
    data = await request.json()
    payload_id = data.get("payload_id")
    pass_name = data.get("pass")
    frames = data.get("frames", [])
    
    global YEDP_CHUNKS
    if payload_id not in YEDP_CHUNKS:
        YEDP_CHUNKS[payload_id] = {}
        
    if pass_name not in YEDP_CHUNKS[payload_id]:
        YEDP_CHUNKS[payload_id][pass_name] = []
        
    YEDP_CHUNKS[payload_id][pass_name].extend(frames)
    
    return web.json_response({"status": "ok"})


@PromptServer.instance.routes.post("/yedp/upload_payload_finish")
async def upload_payload_finish(request):
    data = await request.json()
    payload_id = data.get("payload_id")
    
    global YEDP_PAYLOAD_CACHE, YEDP_CHUNKS
    if payload_id in YEDP_CHUNKS:
        YEDP_PAYLOAD_CACHE[payload_id] = YEDP_CHUNKS.pop(payload_id)
        
        if len(YEDP_PAYLOAD_CACHE) > 3:
            oldest_key = list(YEDP_PAYLOAD_CACHE.keys())[0]
            del YEDP_PAYLOAD_CACHE[oldest_key]
            
        return web.json_response({"payload_id": payload_id})
    return web.json_response({"error": "payload not found"}, status=400)


@PromptServer.instance.routes.get("/yedp/get_rigs")
async def get_rigs(request):
    files = folder_paths.get_filename_list("yedp_rigs")
    if not files:
        files = []
        
    web_dir = os.path.join(os.path.dirname(__file__), "web")
    if os.path.exists(web_dir):
        web_files = [f for f in os.listdir(web_dir) if f.lower().endswith(('.glb', '.gltf', '.fbx'))]
        for wf in web_files:
            if wf not in files:
                files.append(wf)
    
    if "Yedp_Rig.glb" not in files:
        files.insert(0, "Yedp_Rig.glb")
        
    return web.json_response({"files": files})


@PromptServer.instance.routes.post("/action_director/upload_glb")
async def upload_glb(request):
    try:
        reader = await request.multipart()
        filename = "Yedp_Clean_Mocap.glb"
        file_data = None
        
        async for field in reader:
            if field.name == 'filename':
                filename_bytes = await field.read()
                filename = filename_bytes.decode('utf-8')
            elif field.name == 'file':
                file_data = await field.read()
        
        if file_data is None:
            return web.json_response({"status": "error", "message": "No file data received"}, status=400)
        
        safe_name = "".join([c for c in filename if c.isalnum() or c in [' ', '_', '-']]).rstrip()
        if not safe_name.lower().endswith('.glb'):
            safe_name += ".glb"
            
        anim_dir = folder_paths.folder_names_and_paths["yedp_anims"][0][0]
        anim_dir = os.path.realpath(anim_dir)
        try:
            os.makedirs(anim_dir, exist_ok=True)
        except Exception as e:
            pass
        
        file_path = os.path.join(anim_dir, safe_name)
        
        with open(file_path, "wb") as f:
            f.write(file_data)
            
        print(f"[Yedp] Successfully baked and saved GLB animation to {file_path}")
        return web.json_response({"status": "success", "file": safe_name})
        
    except Exception as e:
        print(f"[Yedp] Failed to upload GLB: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)
