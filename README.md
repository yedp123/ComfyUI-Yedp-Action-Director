# **🎬 ComfyUI Yedp Action Director**


https://github.com/user-attachments/assets/0ee6fd2f-4167-48a9-ba3f-bd0a10c82ffc


**A powerful 3D viewport node for ComfyUI to direct, preview, and batch-render 3D character animations for ControlNet workflows.**


## **🌟 Overview**

**Yedp Action Director** is a custom node for ComfyUI that integrates a fully interactive 3D viewport directly into your workflow. It allows you to dynamically load up to 16 characters, assign independent MoCap animations (.fbx, .bvh, .glb), compose them in 3D space using Gizmos, animate camera movements, and bake pixel-perfect **OpenPose, Depth, Canny, and Normal** passes directly into your ControlNet pipelines.

## **✨ Key Features**

* **Interactive 3D Viewport:** Fully resizable, orbit controls, and real-time playback.  
* **Multi-Pass Rendering:** Generates 4 distinct batches in one go:  
  * **🔴 Pose:** Unlit flat colors for OpenPose.  
  * **⚫ Depth:** High-quality depth maps with **Manual Near/Far** controls.  
  * **⚪ Canny:** Procedural Rim-Light (Matcap) for perfect edge detection.  
  * **🔵 Normal:** Standard RGB normal maps for geometry detail.  
* **Format Support:** Supports standard .fbx and .glb animation files.  
* **Smart Retargeting:** Auto-detects and normalizes bone names (Mixamo-compatible).  
* **Infinite Scaling:** The node UI scales vertically and horizontally without limits.

## **🚀 What's New in V9**

The entire architecture has been rebuilt from the ground up for maximum performance and multi-character direction:

* **Multi-Character Support:** Dynamically add, select, and delete up to 16 characters in the same scene.  
* **3D Gizmo Tools:** Translate, Rotate, and Scale individual characters perfectly into your scene.  
* **Male / Female Quick Toggle:** Instantly swap between Male and Female body meshes on the fly per character.  
* **Props Support:** Attach hats, swords, or items to your rig; they will automatically render in the Depth/Normal/Canny passes\!  
* **Camera Sequencing:** Set dynamic camera movements (Start/End keyframes) with custom easing (Linear, Ease-In, Ease-Out).  
* **Python Memory Cache Bypass:** Completely eliminated browser QuotaExceededError crashes. Massive multi-frame renders now upload directly to Python RAM without freezing your UI\!  

## **📥 Installation**

1. **Clone the repository** into your ComfyUI custom nodes directory:  
   cd ComfyUI/custom\_nodes/  
   git clone https://github.com/yedp123/ComfyUI-Yedp-Action-Director.git

2. **Install Dependencies:**  
   No external Python dependencies are required beyond standard ComfyUI requirements. The frontend libraries (Three.js) are loaded dynamically.  
3. **Add Animations:**  
   * Create a folder named yedp\_anims inside your ComfyUI input directory.  
   * Place your .fbx or .glb character animations there.  
   * *Path:* ComfyUI/input/yedp\_anims/  
4. **Restart ComfyUI.**

## **🛠️ Usage**

### **1\. Getting Started**

1. **Add the Node:** Right-click \> Yedp \> MoCap \> Yedp Action Director.  
2. **Adjust Settings:**  
   * **Width/Height:** Set the output resolution (e.g., 512x512).  
   * **Frame Count:** Number of frames to render.  
   * **FPS:** Framerate of the animation.  
4. **Depth Control:**  
   * Check Depth in the viewport header to preview the depth pass.  
   * Adjust **N (Near)** and **F (Far)** values to set the white/black points for maximum contrast.
     
### **2\. Character Management**

* Click **\+ Add Char** to spawn a new character into the scene.  
* Select a character from the list and use the **Gizmo Tools** (Move, Rotate, Scale) to place them in the 3D viewport (MAKE SURE TO PRESS THE "DESELECT" ONCE YOU ARE DONE).  
* Assign an animation from the dropdown (automatically reads from your input/yedp_anims folder).  
* Toggle the **Loop** checkbox. The duration of the specific animation is displayed in frames (e.g., 52f).

### **3\. The M/F (Gender) Toggle**

Next to the Loop checkbox is a toggle button indicating **M** (Male) or **F** (Female). Clicking this instantly swaps the underlying depth mesh of the character, allowing you to direct scenes with mixed genders using the exact same underlying skeletal animation\!

### **4\. Camera Sequence**

You can animate the camera to create panning or zooming shots:

1. Move your 3D viewport camera to the desired starting position. Click **Set Start**.  
2. Move your camera to the desired ending position. Click **Set End**.  
3. Choose your interpolation (e.g., easeOut).  
4. When you hit **Play** or scrub the timeline, the camera will smoothly animate between these two points over the duration of your total frames\!

### **5\. Baking**

Adjust your global **frame_count** and **fps** in the node properties.

Click the **BAKE** button in the viewport header. The engine will rapidly generate 4 separate visual passes and output them as image batches directly into your ComfyUI workflow.

## **🛠️ Custom Rigging & Prop Setup (For Advanced Users)**

If you want to modify Yedp_Rig.glb in Blender to add your own meshes or props, the parser relies on a specific (but forgiving) naming convention in your node hierarchy:

1. **OpenPose Skeleton:** Any mesh containing pose or openpose in its hierarchy.  
2. **Female Depth Mesh:** Any mesh containing depth\_f, depthf, female, or woman in its hierarchy.  
3. **Male Depth Mesh:** Any mesh containing depth, male, or man in its hierarchy.  
4. **Props (Swords, Hats, etc.):** Any mesh attached to the rig that *does not* match the above words will automatically be treated as a prop\! The engine will smartly render it for **both** Male and Female depth/normal passes.

## **🖼️ Outputs Explained**

| Output | Description | Best Used For |
| :---- | :---- | :---- |
| **POSE\_BATCH** | Flat, unlit colors representing body parts. | **ControlNet OpenPose** (or custom color-based control). |
| **DEPTH\_BATCH** | Grayscale distance map (White=Near, Black=Far). | **ControlNet Depth**. Excellent for preserving volumetric shape. |
| **CANNY\_BATCH** | Black mesh with white illuminated edges (Rim Light). | **ControlNet Canny/Lineart**. Captures silhouette and internal details. |
| **NORMAL\_BATCH** | RGB Normal map relative to the camera. | **ControlNet NormalMap**. Great for surface detail and lighting. |

## **🐛 Troubleshooting**

* **"animation not playing":**  
  * the node has been built to play animations from mixamo, the rig needs to follow a similar prefix structure and a few known synonyms such as "Pelvis" for "Hips" (things such as mixamo:Hips/(prefix)_Hips should be recognized fine). Support for HY-MOTION rig name convention has also been added recently.
* **"Viewport is invisible on load":**  
  * *Solution:* Depending on your browser zoom, the viewport might initialize at size 0\. Simply **resize the node slightly** by dragging the bottom-right corner, and the viewport will snap into place.  
* **"Animation not found":**  
  * Ensure your files are in ComfyUI/input/yedp\_anims/. Refresh your browser if you just added them.
* **"slow downs":**  
  * the node as been tested on Chrome browser, potential issues might occur on other browsers.

## **📜 License**

This project is open-source and available under the **MIT License**.
