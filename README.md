# **🎬 ComfyUI Yedp Action Director**

![preview](https://github.com/user-attachments/assets/1ecd1b2b-ec4c-475c-9268-4485f70d5415)

**A powerful 3D viewport node for ComfyUI to direct, preview, and batch-render 3D character animations for ControlNet workflows.**


## **🌟 Overview**

**Yedp Action Director** is a custom node for ComfyUI that integrates a fully interactive 3D viewport directly into your workflow. It allows you to load **FBX** or **GLB** animations, preview them in real-time, and batch-render essential passes (OpenPose, Depth, Canny, Normal) to drive ControlNet generation.

Unlike static image loaders, this node performs the rendering **client-side** (in your browser) using Three.js and sends the pixel data back to ComfyUI for processing.

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

1. **Add the Node:** Right-click \> Yedp \> MoCap \> Yedp Action Director.  
2. **Select Animation:** Choose a file from the animation dropdown.  
3. **Adjust Settings:**  
   * **Width/Height:** Set the output resolution (e.g., 512x512).  
   * **Frame Count:** Number of frames to render.  
   * **FPS:** Framerate of the animation.  
4. **Depth Control (Optional):**  
   * Check Depth in the viewport header to preview the depth pass.  
   * Adjust **N (Near)** and **F (Far)** values to set the white/black points for maximum contrast.  
5. **Bake:** Click the **BAKE** button in the node header. The node will play through the animation and send the data to the outputs.  
6. **Connect Outputs:** Connect POSE\_BATCH, DEPTH\_BATCH, etc., to your ControlNet Preprocessors or Preview Image nodes.

## **🖼️ Outputs Explained**

| Output | Description | Best Used For |
| :---- | :---- | :---- |
| **POSE\_BATCH** | Flat, unlit colors representing body parts. | **ControlNet OpenPose** (or custom color-based control). |
| **DEPTH\_BATCH** | Grayscale distance map (White=Near, Black=Far). | **ControlNet Depth**. Excellent for preserving volumetric shape. |
| **CANNY\_BATCH** | Black mesh with white illuminated edges (Rim Light). | **ControlNet Canny/Lineart**. Captures silhouette and internal details. |
| **NORMAL\_BATCH** | RGB Normal map relative to the camera. | **ControlNet NormalMap**. Great for surface detail and lighting. |

## **🐛 Troubleshooting**

* **"Viewport is invisible on load":**  
  * *Solution:* Depending on your browser zoom, the viewport might initialize at size 0\. Simply **resize the node slightly** by dragging the bottom-right corner, and the viewport will snap into place.  
* **"Animation not found":**  
  * Ensure your files are in ComfyUI/input/yedp\_anims/. Refresh your browser if you just added them.

## **📜 License**

This project is open-source and available under the **MIT License**.
