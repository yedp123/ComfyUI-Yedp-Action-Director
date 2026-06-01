# **🎬 ComfyUI Yedp Action Director**


https://github.com/user-attachments/assets/87328a44-5249-42f3-8b54-de18e7545398

https://github.com/user-attachments/assets/9e7d56c9-e2cd-4ff6-a505-93e4eabae959


**A powerful 3D viewport node for ComfyUI to direct, preview, and batch-render 3D character animations, environments, and custom cameras for ControlNet workflows.**

## **🌟 Overview**

**Yedp Action Director** is a custom node for ComfyUI that integrates a fully interactive 3D viewport directly into your workflow. It allows you to dynamically load up to 16 characters, assign sequenced MoCap animations, capture facial expressions via webcam/video, import 3D environments, animate custom cameras, and bake pixel-perfect **OpenPose, Depth, Canny, Normal, Shaded, Alpha, and Textured** passes directly into your ControlNet pipelines.

### **🦴 The Mixamo-Compatible Core**
**At its core, this engine is built around a Mixamo-compatible rig.** While the universal bone mapper attempts to normalize various hierarchies (like Character Creator or custom rigs) into a unified OpenPose standard, for the best plug-and-play experience, your custom characters and animations should utilize standard Mixamo skeletal naming conventions (or recognized synonyms). 

## **✨ Key Features**

* **Interactive 3D Viewport:** Fully resizable, click-to-select raycasting, orbit controls, and real-time playback scrubbing. 
* **Dynamic Folder Sync:** Click the `↻ SYNC FOLDERS` button to instantly hot-reload newly dropped `.fbx`, `.glb`, or `.bvh` files into your dropdowns without refreshing the browser page.
* **Native ComfyUI Serialization:** Your entire 3D scene state (Cameras, Keyframes, Characters, Environments, Lights, and Mocap bindings) is automatically saved directly inside your standard ComfyUI `.json` workflow file.
* **Multi-Pass Rendering:** Generates 7 distinct batches in one go:  
  * **🔴 Pose:** Unlit flat colors for OpenPose (includes facial landmarks).  
  * **⚫ Depth:** High-quality depth maps with **Manual Near/Far** controls.  
  * **⚪ Canny:** Procedural Rim-Light (Matcap) for perfect edge detection.  
  * **🔵 Normal:** Standard RGB normal maps for geometry detail.  
  * **🟠 Shaded:** Clay-style renders for spatial and lighting reference.  
  * **🏁 Alpha:** Pure black and white character/prop matte masks for compositing.  
  * **🎨 Textured:** Full RGB render utilizing original material base colors and textures.
* **Feeling lost? Click the "help" Icon in the Gizmo's tab!**

<img width="105" height="94" alt="image" src="https://github.com/user-attachments/assets/de1eec41-84ea-4c8f-94b3-74e25b3d0ac0" />

## **⚕️ Yedp Mocap Surgeon**

<img width="979" height="824" alt="a31d6b0750f308f97478e1f4379d62f3" src="https://github.com/user-attachments/assets/ee6992fb-853d-4ade-9513-78def709faa9" />


A dedicated, interactive companion node for extracting, cleaning, and surgically editing motion capture data directly from video plates within ComfyUI. 

Instead of relying on jittery raw AI outputs, Mocap Surgeon provides a professional 3D cleanup environment inspired by traditional animation software, allowing you to polish tracking data before it ever hits your rendering pipeline.

### **✨ Surgeon Key Features**
* **Local Video AI Tracking:** Integrated MediaPipe Pose, Hand, and 70-point Face Landmarkers running entirely locally.
* **1-Euro Jitter Filtering:** Professional-grade mathematical smoothing. Dial in exactly how much "Base Smoothing" you need for stability, and how much "Action Speed" you need to capture snappy movements like punches or kicks without lag.
* **Surgical Manual Override:** Pause the video, click any 3D joint, and use standard `G` (Translate) and `R` (Rotate) gizmos to fix tracking errors. The engine automatically utilizes pristine-backup Slerp-blending to seamlessly merge your manual fixes back into the raw AI tracking data without popping.
* **Time-Travel Onion Skinning:** Toggle a 3D constellation overlay that draws glowing ghost frames of the skeleton's past (Red) and future (Green) trajectories to aid in precise frame-by-frame posing.
* **Premiere-Style Range Editing:** Use `I` (In) and `O` (Out) hotkeys to isolate specific sections of the timeline. Press `D` to instantly delete bad tracking data or wipe manual mistakes across a targeted range.
* **Smart Range Baking:** Export clean, Mixamo-compatible `.glb` animations directly to your Action Director folders. Range exporting automatically zero-pads your clips, so grabbing a 3-second kick out of a 5-minute video exports a perfectly timed, ready-to-use asset.

### **🛠️ The 4-Step Surgical Workflow**
1. **LOAD VIDEO:** Import your video, sync the camera FOV, and toggle Face or Hands tracking.
2. **PLAY & FILTER:** Play the video to cache the AI tracking, and dial in the smoothing sliders.
3. **SURGERY:** Use the Edit Mode, timeline Scrubber, and Onion Skin to manually correct clipping limbs, twisted shoulders, or missed steps.
4. **BAKE:** Select your perfect range and save the `.glb` animation directly to your disk.

## **🧊 Yedp Blockout**

<img width="1487" height="975" alt="2cf391510075d117a07ca4f0faee57a2" src="https://github.com/user-attachments/assets/ed12f04e-ab02-4ec4-ad0f-cd397e42df46" />

A user-friendly node meant to quickly build a 3D scene for generation, export GLB files directly to Yedp Action Director input folder. It acts both as its own renderer and a support node for building scenes quickly to use in the 3D compositor which is the Yedp Action Director node.

Once your scene is set up, click the "BAKE" button to render **Textured** / **Shaded** / **Depth** / **Normal** outputs.

### **✨ Blockout Key Features**

* **Basic Shapes:** Easily drop in cubes, spheres, cylinders, and planes
* **Asset Library:** It has organized tabs for things like Architecture, Vehicles, Furniture, Props, and Plants.
* **PBR workflow:** you can load diffuse/metalness/roughness/normal maps
* **Import Your Own:** You can upload your own custom 3D models (GLB, GLTF, or FBX formats) straight into the scene.
* **Studio Lights:** You can add specific lights like spotlights, point lights, and sun-like directional lights, complete with real shadows and adjustable intensity.
* **HDRI Environments:** You can load 360-degree images (HDRIs) to instantly give your scene realistic, real-world lighting and reflections.
* **Path Tracing:** It has a built-in "Path Tracer".
* **Size Reference:** You can toggle a "human silhouette" on and off to make sure the scale of your buildings and props looks correct.
* **Undo/Redo:** Made a mistake? Just hit undo.
* **Gizmos & Snapping:** Easy-to-use tools to move, rotate, and scale objects. You can also turn on "Grid Snapping" to perfectly align walls or floors.
* **Save & Load:** You can save your entire 3D scene and load it back up later, so you never lose your work.

It exports the 3D scene as a .glb file in the input folder Yedp Action Director import assets from by default.

## **🚀 What's New in V9.3 (Path Tracing, HDRI, Gaussian Splatting & Workflow Upgrades)**

### **✨ Physically Based Rendering & Lighting**
* **Path Tracing Engine:** A massive leap in render quality! You can now enable physically accurate ray-bouncing for your Shaded passes. The engine smartly drops back to the lightning-fast WebGL rasterizer while you move the camera or scrub the timeline, then progressively accumulates high-quality path-traced samples the second you stop.
* **HDRI / Image-Based Lighting (IBL):** Drop .hdr files into your yedp_hdri folder to light your characters and environments with real-world reflections and ambient lighting. Includes real-time rotation, intensity sliders, and visible background toggles.  

### **💾 Scene Management**
* **Physical Save & Load:** Say goodbye to lost setups if a node gets deleted. You can now serialize and save your entire 3D viewport state (characters, mocap bindings, lighting, environments, and camera keyframes) directly to your hard drive as .json files in the yedp_scenes folder.

### **🎬 Mocap & Interface Enhancements**
* **Video Trim Slider:** When importing a video file for facial motion capture, a new dual-handle range slider allows you to trim exactly which segment of the video you want to process, saving you processing time and memory.
* **Custom Capture Naming:** Added a dedicated input field to name your facial mocap tracks before recording, making it infinitely easier to organize and select them from your binding dropdowns later.
* **Expanded UI Layout:** Expanded the sidebar width to 280px to give the new features and transform inputs better breathing room without truncating text.

### **🌍 Advanced Environment Support**
* **Native Gaussian Splatting:** Full support for .ply and .spz files (.splat, .ksplat and .sog format are untested!). Load massive scanned environments directly into the viewport.
* **Splat-to-Proxy Shadows:** A custom internal shader allows Points Clouds to cast dense, accurate shadows and generate proper Z-Depth maps, making them fully compatible with ControlNet workflows.
* **Dynamic PLY Toggling:** For .ply files, you can now toggle in real-time between standard Point Cloud rendering and Gaussian Splat mode (Option appearing upon pressing the "Sync Folders" button).


## **📥 Installation**

1. **Clone the repository** into your ComfyUI custom nodes directory:  
   cd ComfyUI/custom\_nodes/  
   git clone https://github.com/yedp123/ComfyUI-Yedp-Action-Director.git  
2. **Install Dependencies:** No external Python dependencies are required beyond standard ComfyUI requirements. The frontend libraries (Three.js and MediaPipe) are loaded dynamically.  
3. **Add Animations & Assets:** Create the following folders inside your ComfyUI input directory and place your files accordingly:  
   * **Characters:** ComfyUI/input/yedp\_anims/  
   * **Environments:** ComfyUI/input/yedp\_envs/  
   * **Cameras:** ComfyUI/input/yedp\_cams/  
   * **Mocap Data:** ComfyUI/input/yedp\_mocap/ *(Auto-created upon first save)*  
4. **Restart ComfyUI.**

## **🛠️ Usage**

### **1\. Getting Started**

* **Add the Node:** Right-click \> Yedp \> MoCap \> Yedp Action Director.  
* **Adjust Settings:** Set your Output width & height, total frame\_count, and fps.  
* **Viewport Toggles:** Use the top checkboxes to preview your scene in Shaded, Depth, or Skel (Skeleton) modes. Adjust the Depth Near/Far inputs to maximize contrast.

### **2. Scene Assembly & Animation Sequencing**
* Click **+ Add Char** or **+ Add Env** to spawn elements into the scene. Click directly on objects in the viewport to select them.  
* Use the floating Gizmo icons (or hotkeys G, R, S) to Move, Rotate, and Scale.  
* **Sequencer:** Under the Character card, click **+ Add Sequence Anim** to add a slot. Select an animation from the dropdown. Add as many as you need—the engine will automatically crossfade between them!

### **3. The M/F (Gender) Toggle**
Next to the Character Loop checkbox is a toggle button indicating **M** (Male) or **F** (Female). Clicking this instantly swaps the underlying depth mesh of the character, allowing you to direct scenes with mixed genders using the exact same skeletal animation!

### **4. Facial Motion Capture (Mocap)**
1. Open the **Motion Capture** sidebar tab.  
2. Select **Webcam** or **Video File**.  
3. Click **📷 Start** (or 📂 Load for video).  
4. Once tracking begins (you will see the green dots), click **🔴 Rec** to begin recording.  
5. Click **⏹ Stop** (or let the video finish). The performance is automatically saved!  
6. Click **+ Add Face Bind**, assign it to your Character, and select your newly recorded Mocap from the dropdown to apply it. Use the "Amp" slider to exaggerate or dampen the expressions.

### **5. Camera Direction**
You have two ways to animate your camera:
* **Internal Keyframing:** Move your viewport camera to a start position and click **Set Start**. Move to an end position and click **Set End**. Choose your interpolation (e.g., easeOut). The camera will smoothly animate between the two points!
* **Maya/Blender Override:** Import an FBX camera from the `yedp_cams` folder. Adjust the scale/rotation fixes if your 3D software uses different axes, verify it with the cyan ghost proxy, and then check **Override** to lock your viewport to the imported track.

### **6. Baking**
Click the **BAKE V9.3** button in the viewport header (or BAKE FRAME for a single test frame). The engine will rapidly generate 7 separate visual passes, temporarily cache them to avoid browser crashes, and output them as image batches directly into your ComfyUI workflow.

## **🛠️ Custom Rigging & Prop Setup (For Advanced Users)**
The parser relies on a specific (but forgiving) naming convention in your node hierarchy. Remember that **Mixamo compatibility** is heavily recommended for best results:
1. **OpenPose Skeleton:** Any mesh containing `pose` or `openpose` in its hierarchy.  
2. **Female Depth Mesh:** Any mesh containing `depth_f`, `depthf`, `female`, or `woman` in its hierarchy.  
3. **Male Depth Mesh:** Any mesh containing `depth`, `male`, or `man` in its hierarchy.  
4. **Props (Swords, Hats, etc.):** Any mesh attached to the rig that *does not* match the above words will automatically be treated as a prop! The engine will smartly render it for **both** Male and Female depth/normal passes.

| Output | Description | Best Used For |
| :--- | :--- | :--- |
| **POSE_BATCH** | Flat, unlit colors representing body parts. | **ControlNet OpenPose** (or custom color-based control). |
| **DEPTH_BATCH** | Grayscale distance map (White=Near, Black=Far). | **ControlNet Depth**. Excellent for preserving volumetric shape. |
| **CANNY_BATCH** | Black mesh with white illuminated edges (Rim Light). | **ControlNet Canny/Lineart**. Captures silhouette and internal details. |
| **NORMAL_BATCH** | RGB Normal map relative to the camera. | **ControlNet NormalMap**. Great for surface detail and lighting. |
| **SHADED_BATCH** | Standard 3D clay render with active lighting. | General scene preview or image-to-image styling references. |
| **ALPHA_BATCH** | Pure white characters/props on black background. | **Masking/Compositing**. Easily separate subjects from environments. |
| **TEXTURED_BATCH** | Full RGB render with original materials and vertex colors. | Final visualization or heavily stylized image-to-image base inputs. |

## **🐛 Troubleshooting**
* **"Animation not playing":** The node has been built to play animations from Mixamo. The rig needs to follow a similar prefix structure and a few known synonyms such as "Pelvis" for "Hips". Support for HY-MOTION rig naming conventions is also included.  
* **"Viewport is invisible on load":** *Solution:* Depending on your browser zoom, the viewport might initialize at size 0. Simply **resize the node slightly** by dragging the bottom-right corner, and the viewport will snap into place.  
* **"Animation/Environment not found":** Ensure your files are in the correct `input/` subfolders. Click your custom **↻ SYNC FOLDERS** button in the ComfyUI menu if you just added them!
* **"imported .ply doesn't show":** .ply files are imported as Gaussion Splat by default, if your .ply file are points cloud, make sure to press the **↻ SYNC FOLDERS** button to make the settings appear and uncheck "Render as Gaussian Splat" (currently doesn't show dynamically, hopefully will be fixed in the future!)
 <img width="285" height="144" alt="image" src="https://github.com/user-attachments/assets/53625815-4664-4248-b4f2-7afb2638eb3d" />
 
* **"Path tracing takes a long time to activate after toggled on the first time":** the first time, the GPU has to compile thousands of lines of complex math from scratch. This blocks the main thread and causes that long freeze before the first sample appears.


## **📜 License**

This project is open-source and available under the **MIT License**.

## **❤️ Credits**

created by Yedp. 

**Special thanks:** 
- [mizumori-bit](https://github.com/mizumori-bit) for his contribution on Orthographic/Views/Lighting implementation.
- [MundusCaeli](https://github.com/MundusCaeli) for improving error handling for webcam streams, fixed recording-pause bugs, and adding real-time Mocap UI feedback.
- Some of the 3D models used in Yedp Blockout node are CCO models generously shared by [Tim Steer](https://www.thebasemesh.com/about), feel free to give him a tip if you like his amazing work!


Yedp-Action-Director is built upon the incredible work of the open-source community.

-------------------

**🛠️ Core Engine & Libraries**
Three.js: The backbone of the 3D viewport, including essential modules like GLTFLoader, FBXLoader, BVHLoader, and SkeletonUtils.

Three-GPU-PathTracer (gkjohnson): Powers the high-performance, physically-based path tracing engine for realistic lighting and shadows.

Three-Mesh-BVH (gkjohnson): Essential for spatial acceleration, allowing the engine to handle complex geometry and ray-casting with minimal performance impact.

MediaPipe (Google): Powers the high-performance, local facial motion capture and landmark detection.

GaussianSplats3D (mkkellogg): For the optimized implementation and rendering of 3D Gaussian Splatting within the Three.js environment.

fflate: Used for high-speed, memory-efficient decompression of 3D asset files.

-------------------

**📜 Format & Asset Support**
PLY Loader: For supporting the import and visualization of PLY point cloud data.

Mixamo & HY-MOTION: For providing the skeletal naming conventions that our auto-retargeting system follows.
