import { app } from "/scripts/app.js";
import { api } from "/scripts/api.js";

/** * YEDP MOCAP SURGEON
 * - Standalone tool for overlaying 3D rigs onto video plates for mocap alignment.
 * - Features: Transparent Canvas overlay, Perfect Aspect Ratio syncing, Video-driven Animation Clock.
 * - Update: MediaPipe Pose Landmarker Integration with Z=0 invisible plane raycasting.
 * - Update: Automatic FOV solving mapped to Mixamo 3D shoulder width.
 * - Update: Debug UI with 2D Canvas Overlay and Rig-Explosion protection (visibility threshold).
 * - Update: Soft Presence (Lerp to T-Pose), Ghost Rig Opacity, UI Confidence Slider, & Shoulder Anchor.
 * - FIX: NaN Guards, Global Scope locking, Loop Protection (Try/Catch), and Debug 'Force Move' Rule.
 * - FIX: Explicit Mixamo Bone Mapping Table, Bone Audit Logging, and Global MatrixWorld Force Update.
 * - FIX: Coordinate Harmonization - Z-Clamping, Pole Vector Hints, and Heavy Slerp Damping.
 * - REWRITE: Proxy Rotation Kinematics - Eliminated 2D Raycast stretching. Bones now calculate 3D World Vectors and use Quaternion Rotations to preserve exact mesh proportions.
 * - FIX: Head Rotation Inversion, Rig Transformation Reset, & Scaled FOV Stabilization.
 * - FIX: Naming Convention Swap (No Mirror X), Gimbal Lock Up-Vector Fix, and Mixamo T-Pose Roll Twist Corrections.
 * - UI/LOGIC FIX: Cleaned up unnecessary UI elements, added MP Points toggle, perfected Head Pitch/Roll cross-product.
 * - FINAL FIX: Disabled Frustum Culling, added Dynamic Hip Yaw, and implemented Spine/Leg Twist Inheritance.
 * - MIRROR FIX: Fully harmonized naming conventions for both Arms and Legs to solve limb-crossing and mesh inversion on mirrored video.
 * - FACING FIX: Maintained +Z Torso Forward math for correct character orientation.
 * - SMOOTHING FIX: 1€ (One Euro) Filter implemented for Position and Quaternion data to surgically eliminate jitter.
 * - REC & SCRUB FIX: Global motionData buffer implemented. MediaPipe is bypassed when paused/scrubbing to replay recorded data smoothly.
 * - UI/SERIALIZATION FIX: Theme-matched CSS styling for sliders using ComfyUI variables and workflow property serialization.
 * - OVERRIDE FIX: Added TransformControls, invisible Raycast joints, and 10-Frame SLERP Blending for seamless manual keyframe correction.
 * - VISUALIZER FIX: Added Mesh Toggle UI, Color-Coded Scale-Independent Raycast Joints, Selection Highlights, and Thick 3D Skeleton Cylinders.
 * - UPPER BODY INVERSION FIX: Reverted Arms to Direct Mapping and split the Torso Forward/Backward math to prevent elbow breaking.
 * - GLB EXPORT FIX: Implemented "Clean Skeleton Extraction". Renames all bones to simple strings to prevent GLTFExporter dot-notation crashes and strips all meshes for maximum stability.
 * - UPDATE: Integrated MediaPipe Face and Hand Landmarkers with Additive 70-Bone Face Tracking and Proxy Finger IK.
 * - UPDATE: Removed transparency for solid depth culling, separated Face/Hands toggles, added Upper Body stabilization, and Finger Hinge constraints.
 * - FIX: Swapped Hand Mapping array internal names and integrated Isotropic Pixel Space Face Scaling.
 * - WRIST FIX: Implemented full 3D Palm Normal Cross-Product rotation for the wrist, solving backward thumb and sideways fist deformation.
 * - FACE FIX: Reverted to old face tracking delta logic (-dy) as it was originally working better.
 * - SKELETON GLITCH FIX: Reverted Wrists to Direct Mapping to stop the 3D skeleton from criss-crossing over the chest.
 * - SYNTAX FIX: Cleaned up duplicate code blocks in the animate loop that were breaking the ComfyUI node rendering.
 * - MEMORY/UI FIX: Added global memory flush on new video load and updated UI to show Current / Total Frames.
 * - LOWER BODY FIX: Reverted Legs to Direct Mapping. Previously, swapping the leg indices caused the pelvis and lower body to twist 180 degrees backwards because the left leg was driving the right leg socket.
 * - SPINE/ARMS REST POSE FIX: Restored torsoBackward vector specifically to the Spine and Arms to prevent upper body twisting.
 * - ROLLBACK: Reverted Hips, Legs, Wrists, and Feet logic to previous baseline state for step-by-step debugging.
 * - VISUAL UPGRADE: Added 3-Point Lighting and MeshStandardMaterial to GeoDepth to make character volumes and twists readable.
 * - HIP FIX: Reverted dx/dz back to original to keep pelvis facing camera, but negated yaw angle to fix horizontal twist.
 * - MESH FIX: Automatically hide Geo_Depth_F to prevent double character rendering.
 * - TRACKING FIX: Synced MediaPipe strictly to video currentTimeMs instead of performance.now() to completely eliminate Face/Hand temporal jitter.
 * - UPPER BODY FIX: Applied dynamic shoulder yaw to the hips during Upper Body Only mode to preserve correct orientation.
 * - MP CLOCK CRASH FIX: Created a synthetic monotonically increasing mpClock to prevent MediaPipe from completely freezing when syncCamera fires or the video loops/rewinds.
 * - RAW LANDMARK SMOOTHING FIX: Applied 1-Euro Filter to the raw point clouds BEFORE 3D cross-products to prevent math-instability and eliminate extremity jitter.
 * - CRUSHED FACE FIX: Used smoothed 2D landmarks to compute the Face Isotropic basis vectors. This prevents the face coordinate space from violently oscillating and crushing the points into the origin.
 * - DELAYED FACE FIX: Added frame > 2 guard on face tracking to allow MediaPipe to stabilize and prevent capturing garbage rest-pose data.
 * - SHOULDER FIX: Removed artificial 0.3 backward pole vector hint that was dislocating upper arms and forcing them into the ribcage.
 * - LOWER BODY REVERT: Reversed limbs UP vector and forward hints back to torsoBackward for the legs specifically as requested.
 * - BICEP ROLL FIX: Inverted the 90-degree local Y-axis roll to correctly face the biceps outward toward the camera.
 * - FINGER EXPORT FIX: Fixed an aggressive string-matching bug in the GLB exporter that was accidentally renaming all fingers to "RightHand" or "LeftHand", causing finger keyframes to be dropped in the final file.
 * - UI LAYOUT FIX: Reorganized controls. Moved visualization toggles to the top. Grouped workflow buttons and sliders on row 1, tracking modifiers on row 2, and renamed 1-Euro variables to non-technical equivalents.
 * - EXPORT JITTER FIX: Applied dynamic 1-Euro Re-filtering on raw data during GLTF Bake so UI slider tweaks are perfectly saved.
 * - GLTF SPIN FIX: Applied Hemispherical Continuity constraints to the QuaternionKeyframeTrack arrays to eliminate violent 360-degree interpolation shaking in external software.
 * - MEMORY CORRUPTION FIX: Created temporary isolated filters for the GLB exporter and added isBlended flags. This prevents the export process from poisoning the live viewport filters with NaNs, resolving the scrubbing freeze.
 * - SLERP POPPING FIX: Added strict protection logic so playback doesn't overwrite manual edits. Corrected Slerp Target logic to blend into smoothed states, permanently eliminating GLB jitter snaps.
 * - GIZMO AXIS FIX: Switched TransformControls to Local space for bones (easier Maya-style rotation) and Global space for Hips translation.
 * - TIMELINE REWRITE: Separated AI Tracking (Record) from Playback (Review) to eliminate extreme stuttering and MP crashing.
 */

// --- ONE EURO FILTER IMPLEMENTATION ---
class LowPassFilter {
    constructor(alpha) { this.setAlpha(alpha); this.y = null; this.s = null; }
    setAlpha(alpha) { this.alpha = alpha; }
    filter(value) {
        if (this.y === null) { this.s = value; }
        else { this.s = this.alpha * value + (1.0 - this.alpha) * this.s; }
        this.y = value;
        return this.s;
    }
    lastValue() { return this.y; }
}

class OneEuroFilter {
    constructor(freq, mincutoff = 1.0, beta = 0.0, dcutoff = 1.0) {
        this.freq = freq;
        this.mincutoff = mincutoff;
        this.beta = beta;
        this.dcutoff = dcutoff;
        this.x = new LowPassFilter(this.alpha(this.mincutoff));
        this.dx = new LowPassFilter(this.alpha(this.dcutoff));
        this.lasttime = null;
    }
    alpha(cutoff) {
        let te = 1.0 / this.freq;
        let tau = 1.0 / (2 * Math.PI * cutoff);
        return 1.0 / (1.0 + tau / te);
    }
    filter(value, timestamp) {
        if (this.lasttime !== null && timestamp !== undefined) {
            let dt = timestamp - this.lasttime;
            if (dt > 0.0) this.freq = 1.0 / dt;
        }
        this.lasttime = timestamp;
        let prev_x = this.x.lastValue();
        let dx = prev_x === null ? 0.0 : (value - prev_x) * this.freq;
        let edx = this.dx.filter(dx);
        let cutoff = this.mincutoff + this.beta * Math.abs(edx);
        this.x.setAlpha(this.alpha(cutoff));
        return this.x.filter(value);
    }
}

class OneEuroFilter3D {
    constructor(freq = 30) {
        this.x = new OneEuroFilter(freq);
        this.y = new OneEuroFilter(freq);
        this.z = new OneEuroFilter(freq);
    }
    filter(v, timestamp, mincutoff, beta) {
        this.x.mincutoff = mincutoff; this.x.beta = beta;
        this.y.mincutoff = mincutoff; this.y.beta = beta;
        this.z.mincutoff = mincutoff; this.z.beta = beta;
        return {
            x: this.x.filter(v.x, timestamp),
            y: this.y.filter(v.y, timestamp),
            z: this.z.filter(v.z, timestamp)
        };
    }
}

class OneEuroFilterQuat {
    constructor(freq = 30) {
        this.x = new OneEuroFilter(freq);
        this.y = new OneEuroFilter(freq);
        this.z = new OneEuroFilter(freq);
        this.w = new OneEuroFilter(freq);
        this.lastQuat = null;
    }
    filter(q, timestamp, mincutoff, beta) {
        this.x.mincutoff = mincutoff; this.x.beta = beta;
        this.y.mincutoff = mincutoff; this.y.beta = beta;
        this.z.mincutoff = mincutoff; this.z.beta = beta;
        this.w.mincutoff = mincutoff; this.w.beta = beta;

        // Hemispherical continuity check (Shortest Path interpolation)
        if (this.lastQuat) {
            let dot = q.x * this.lastQuat.x + q.y * this.lastQuat.y + q.z * this.lastQuat.z + q.w * this.lastQuat.w;
            if (dot < 0) {
                q.x = -q.x; q.y = -q.y; q.z = -q.z; q.w = -q.w;
            }
        }
        this.lastQuat = { x: q.x, y: q.y, z: q.z, w: q.w };

        return {
            x: this.x.filter(q.x, timestamp),
            y: this.y.filter(q.y, timestamp),
            z: this.z.filter(q.z, timestamp),
            w: this.w.filter(q.w, timestamp)
        };
    }
}
// ------------------------------------------

const loadThreeJS = async () => {
    const baseUrl = new URL(".", import.meta.url).href;

    // Initialize core engine if not cached using a UNIQUE variable for Surgeon
    if (!window._YEDP_MOCAP_THREE_CACHE) {
        window._YEDP_MOCAP_THREE_CACHE = new Promise(async (resolve, reject) => {
            try {
                console.log("[Mocap Surgeon] Initializing Engine...");
                const THREE = await import(new URL("./three.module.js", baseUrl).href);

                // Backwards compatibility for color management
                if (THREE.ColorManagement && typeof THREE.ColorManagement.colorSpaceToWorking !== 'function') {
                    THREE.ColorManagement.colorSpaceToWorking = function (color, colorSpace) {
                        if (colorSpace === THREE.SRGBColorSpace || colorSpace === 'srgb') return color.convertSRGBToLinear();
                        return color;
                    };
                } else if (!THREE.ColorManagement) {
                    THREE.ColorManagement = { enabled: false, colorSpaceToWorking: function (color) { return color; } };
                }

                // Load base controllers
                const { OrbitControls } = await import(new URL("./OrbitControls.js", baseUrl).href);
                const { GLTFLoader } = await import(new URL("./GLTFLoader.js", baseUrl).href);
                const { TransformControls } = await import(new URL("./TransformControls.js", baseUrl).href);

                resolve({ THREE, OrbitControls, GLTFLoader, TransformControls });
            } catch (e) {
                console.error("[Mocap Surgeon] Critical Engine Load Failure:", e);
                reject(e);
            }
        });
    }

    const libs = await window._YEDP_MOCAP_THREE_CACHE;

    // SPA HOT-RELOAD FIX: Dynamically inject the GLTFExporter into the persistent cache 
    // if the user refreshed the node but the browser held onto the old memory object.
    if (!libs.GLTFExporter) {
        try {
            const gltfExpModule = await import(new URL("./GLTFExporter.js", baseUrl).href);
            // Support both direct named export and default export formats
            libs.GLTFExporter = gltfExpModule.GLTFExporter || gltfExpModule.default;
        } catch (e) {
            console.error("[Mocap Surgeon] Failed to inject GLTFExporter.js into cache:", e);
        }
    }

    return libs;
};

class MocapSurgeonViewport {
    constructor(node, container) {
        this.node = node;
        this.node.properties = this.node.properties || {}; // Ensure properties object exists for serialization
        this.container = container;
        this.baseUrl = new URL(".", import.meta.url).href;

        this.isInitialized = false;
        this.isPlaying = false;
        this.isRecordingMode = false; // Distinguishes between AI processing and just watching playback

        // --- Async Tracking Decoupling ---
        this._trackingInFlight = false; // Prevents overlapping MediaPipe inference calls
        this._pendingPose = null;       // Staging area for latest MP pose results
        this._pendingHands = null;      // Staging area for latest MP hand results  
        this._pendingFace = null;       // Staging area for latest MP face results
        this._pendingTimestamp = 0;     // Video time that was being processed
        this._lastProcessedVideoTimeMs = -1; // Track which video frame was last sent to MP
        this._mpNeedsRestart = false;   // Recovery flag after MediaPipe crash
        this._lastPlaybackFrame = -1;   // Skip redundant bone updates in playback mode

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.transformControls = null;

        this.videoEl = null;
        this.canvasWrap = null;
        this.debugCanvas = null;

        this.rig = null;
        this.mixer = null;

        // Custom Scale-Independent Visualizers
        this.pickerGroup = null;
        this.customSkeletonGroup = null;
        this.boneCylinders = [];
        this.pickableObjects = [];

        // --- Tracking & Recording Subsystem ---
        this.visionLib = null;
        this.poseLandmarker = null;
        this.faceLandmarker = null;
        this.handLandmarker = null;
        this.raycaster = null;
        this.zPlane = null;

        this.motionData = {}; // Global Buffer to record Filtered Frame Data
        this.currentFrameIndex = null;
        this.isScrubbing = false;

        // --- Interaction & UI States ---
        this.recordingIndicator = null;
        this.editedIndicator = null;
        this.timelineSlider = null;
        this.timeLabel = null;
        this.selectedMpIdx = null;

        // --- Display Flags & Toggles ---
        this.showOpenPose = true;
        this.showGeoDepth = true; // New Toggle for the Character Mesh
        this.showSkeleton = true;
        this.showMPPoints = false;
        this.trackFace = false; // Isolated Face Toggle
        this.trackHands = false; // Isolated Hands Toggle
        this.upperBodyOnly = false; // Upper Body Stabilization Toggle
        this.showOnionSkin = false;
        this.onionSkinLayers = 2; // Default to 2 frames before & after
        this.onionSkinStep = 3;   // Default to 3 frames between layers

        // --- 1€ Filter States ---
        this.filterMinCutoff = 0.01;
        this.filterBeta = 20.0;

        // Post-Math Rotation Filters
        this.boneFilters = {};
        this.hipsPosFilter = null;

        // PRE-MATH RAW LANDMARK FILTERS
        this.pose2DFilters = [];
        this.poseWorldFilters = [];
        this.handWorldFilters = { "Left": [], "Right": [] };
        this.hand2DFilters = { "Left": [], "Right": [] };
        this.face2DFilters = []; // The localized face double-filter was removed as it crushed points

        this.mocapBones = {};
        this.baseRigShoulderWidth = 0.35;
        this.baseRigShoulderMidpoint = null;

        this.lastVideoTimeMs = -1;
        this.mpClock = 0; // Monotonically increasing synthetic clock to prevent MediaPipe crashes

        this.currentPose = null;
        this.currentHands = null;
        this.currentFace = null;

        // Storage for 2D UI display
        this.smoothedPose2D = null;
        this.smoothedHands2D = [];
        this.smoothedFace2D = null;

        this.baseFaceLandmarks = null; // Cache to compute additive delta for face meshes

        this.confidenceThreshold = 0.3; // Hardcoded fallback value
        this.rigScale = 1.0; // Hardcoded default scale

        // EXPLICIT MAPPING TABLE: 
        // Direct body mapping for physically accurate representation
        this.MP_TO_MIXAMO = {
            0: ["mixamorigHead", "mixamorig_Head", "Mixamo:Head", "Head"],
            11: ["mixamorigLeftArm", "mixamorig_LeftArm", "Mixamo:LeftArm", "LeftArm"],             // Direct
            12: ["mixamorigRightArm", "mixamorig_RightArm", "Mixamo:RightArm", "RightArm"],         // Direct
            13: ["mixamorigLeftForeArm", "mixamorig_LeftForeArm", "Mixamo:LeftForeArm", "LeftForeArm"],   // Direct
            14: ["mixamorigRightForeArm", "mixamorig_RightForeArm", "Mixamo:RightForeArm", "RightForeArm"],// Direct
            15: ["mixamorigLeftHand", "mixamorig_LeftHand", "Mixamo:LeftHand", "LeftHand"],         // Direct
            16: ["mixamorigRightHand", "mixamorig_RightHand", "Mixamo:RightHand", "RightHand"],     // Direct
            23: ["mixamorigLeftUpLeg", "mixamorig_LeftUpLeg", "Mixamo:LeftUpLeg", "LeftUpLeg"],     // Direct
            24: ["mixamorigRightUpLeg", "mixamorig_RightUpLeg", "Mixamo:RightUpLeg", "RightUpLeg"], // Direct
            25: ["mixamorigLeftLeg", "mixamorig_LeftLeg", "Mixamo:LeftLeg", "LeftLeg"],             // Direct
            26: ["mixamorigRightLeg", "mixamorig_RightLeg", "Mixamo:RightLeg", "RightLeg"],         // Direct
            27: ["mixamorigLeftFoot", "mixamorig_LeftFoot", "Mixamo:LeftFoot", "LeftFoot"],         // Direct
            28: ["mixamorigRightFoot", "mixamorig_RightFoot", "Mixamo:RightFoot", "RightFoot"],     // Direct
            99: ["mixamorigHips", "mixamorig_Hips", "Mixamo:Hips", "Hips", "Pelvis"],
            901: ["mixamorigSpine", "mixamorig_Spine", "Mixamo:Spine", "Spine"],
            902: ["mixamorigSpine1", "mixamorig_Spine1", "Mixamo:Spine1", "Spine1"],
            903: ["mixamorigSpine2", "mixamorig_Spine2", "Mixamo:Spine2", "Spine2"]
        };

        // NEW: Clean export names mapping to bypass GLTF naming bugs
        this.BONE_EXPORT_NAMES = {
            0: "Head", 11: "LeftArm", 12: "RightArm", 13: "LeftForeArm", 14: "RightForeArm",
            15: "LeftHand", 16: "RightHand", 23: "LeftUpLeg", 24: "RightUpLeg",
            25: "LeftLeg", 26: "RightLeg", 27: "LeftFoot", 28: "RightFoot",
            99: "Hips", 901: "Spine", 902: "Spine1", 903: "Spine2"
        };

        // EXACT MP FACE MAPPING (70 Points)
        this.MP_FACE_INDICES = [
            162, 234, 93, 58, 172, 136, 149, 148, 152, 377, 378, 365, 397, 288, 323, 454, 389, 46, 53, 52,
            65, 55, 285, 295, 282, 283, 276, 6, 197, 195, 5, 98, 97, 2, 326, 327, 33, 160, 158, 133, 153, 144,
            362, 385, 387, 263, 373, 380, 61, 39, 37, 0, 267, 269, 291, 405, 314, 17, 84, 181, 78, 81, 13, 311,
            308, 402, 14, 178, 468, 473
        ];

        // EXPLICIT HAND TO MIXAMO MAPPING TABLE (Uses 100/200 series for internal ID tracking)
        // Hand Pose has 4 points per finger (Base, PIP, DIP, Tip). We extract 3 bone vectors from them.
        this.HAND_DICT = {
            "Left": [
                { id: 101, name: "RightHandThumb1", p1: 1, p2: 2 },
                { id: 102, name: "RightHandThumb2", p1: 2, p2: 3 },
                { id: 103, name: "RightHandThumb3", p1: 3, p2: 4 },
                { id: 105, name: "RightHandIndex1", p1: 5, p2: 6 },
                { id: 106, name: "RightHandIndex2", p1: 6, p2: 7 },
                { id: 107, name: "RightHandIndex3", p1: 7, p2: 8 },
                { id: 109, name: "RightHandMiddle1", p1: 9, p2: 10 },
                { id: 110, name: "RightHandMiddle2", p1: 10, p2: 11 },
                { id: 111, name: "RightHandMiddle3", p1: 11, p2: 12 },
                { id: 113, name: "RightHandRing1", p1: 13, p2: 14 },
                { id: 114, name: "RightHandRing2", p1: 14, p2: 15 },
                { id: 115, name: "RightHandRing3", p1: 15, p2: 16 },
                { id: 117, name: "RightHandPinky1", p1: 17, p2: 18 },
                { id: 118, name: "RightHandPinky2", p1: 18, p2: 19 },
                { id: 119, name: "RightHandPinky3", p1: 19, p2: 20 }
            ],
            "Right": [
                { id: 201, name: "LeftHandThumb1", p1: 1, p2: 2 },
                { id: 202, name: "LeftHandThumb2", p1: 2, p2: 3 },
                { id: 203, name: "LeftHandThumb3", p1: 3, p2: 4 },
                { id: 205, name: "LeftHandIndex1", p1: 5, p2: 6 },
                { id: 206, name: "LeftHandIndex2", p1: 6, p2: 7 },
                { id: 207, name: "LeftHandIndex3", p1: 7, p2: 8 },
                { id: 209, name: "LeftHandMiddle1", p1: 9, p2: 10 },
                { id: 210, name: "LeftHandMiddle2", p1: 10, p2: 11 },
                { id: 211, name: "LeftHandMiddle3", p1: 11, p2: 12 },
                { id: 213, name: "LeftHandRing1", p1: 13, p2: 14 },
                { id: 214, name: "LeftHandRing2", p1: 14, p2: 15 },
                { id: 215, name: "LeftHandRing3", p1: 15, p2: 16 },
                { id: 217, name: "LeftHandPinky1", p1: 17, p2: 18 },
                { id: 218, name: "LeftHandPinky2", p1: 18, p2: 19 },
                { id: 219, name: "LeftHandPinky3", p1: 19, p2: 20 }
            ]
        };

        // Lines to draw on the debug overlay
        this.POSE_CONNECTIONS = [
            [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [15, 19], [16, 20], // Upper body
            [11, 23], [12, 24], [23, 24],                     // Torso
            [23, 25], [25, 27], [24, 26], [26, 28], [27, 31], [28, 32] // Lower body
        ];

        // 3D Skeleton Cylinder Connections (Accurately mirrors Mixamo internal hierarchy)
        this.BONE_CONNECTIONS = [
            [99, 901], [901, 902], [902, 903], [903, 0], // Center Spine & Head
            [903, 12], [12, 14], [14, 16], // Right Arm (Visual Left)
            [903, 11], [11, 13], [13, 15], // Left Arm (Visual Right)
            [99, 24], [24, 26], [26, 28],  // Right Leg (Visual Left)
            [99, 23], [23, 25], [25, 27]   // Left Leg (Visual Right)
        ];

        // Strict top-down evaluation order to prevent hierarchy tearing when overriding transforms globally
        this.HIERARCHY_ORDER = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];

        this.resizeObserver = null;

        this.init();
    }

    async init() {
        try {
            const libs = await loadThreeJS();
            this.THREE = libs.THREE;
            this.OrbitControls = libs.OrbitControls;
            this.GLTFLoaderClass = libs.GLTFLoader;
            this.TransformControlsClass = libs.TransformControls;
            this.GLTFExporterClass = libs.GLTFExporter;

            // Geometry Tools
            this.raycaster = new this.THREE.Raycaster();
            // Give the raycaster a slight buffer for easier picking
            this.raycaster.params.Line.threshold = 0.1;
            this.zPlane = new this.THREE.Plane(new this.THREE.Vector3(0, 0, 1), 0);

            // --- 1. DOM LAYOUT ---
            this.container.innerHTML = "";
            this.container.tabIndex = 0; // Required for keydown listening
            Object.assign(this.container.style, {
                position: "relative",
                width: "100%",
                height: "100%",
                backgroundColor: "#111",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                overflow: "hidden",
                borderRadius: "8px"
            });

            // Theme-matched styles for sliders
            const style = document.createElement("style");
            style.innerHTML = `
                .mocap-theme-slider {
                    -webkit-appearance: none;
                    background: transparent;
                }
                .mocap-theme-slider:focus { outline: none; }
                .mocap-theme-slider::-webkit-slider-runnable-track {
                    width: 100%; height: 6px; cursor: pointer;
                    background: var(--border-color, #444); border-radius: 3px;
                }
                .mocap-theme-slider::-webkit-slider-thumb {
                    height: 14px; width: 14px; border-radius: 50%;
                    background: var(--primary-bg, #006699); cursor: pointer;
                    -webkit-appearance: none; margin-top: -4px;
                    border: 2px solid var(--fg-color, #fff);
                }
                .mocap-theme-slider::-moz-range-track {
                    width: 100%; height: 6px; cursor: pointer;
                    background: var(--border-color, #444); border-radius: 3px;
                }
                .mocap-theme-slider::-moz-range-thumb {
                    height: 14px; width: 14px; border-radius: 50%;
                    background: var(--primary-bg, #006699); cursor: pointer;
                    border: 2px solid var(--fg-color, #fff);
                }
                .mocap-save-input {
                    background: #222;
                    color: #fff;
                    border: 1px solid #555;
                    border-radius: 4px;
                    padding: 6px 8px;
                    font-size: 12px;
                    outline: none;
                }
                .mocap-save-input:focus {
                    border-color: #006699;
                }
            `;
            this.container.appendChild(style);

            // Video Background
            this.videoEl = document.createElement("video");
            Object.assign(this.videoEl.style, {
                position: "absolute",
                width: "100%",
                height: "100%",
                objectFit: "contain",
                zIndex: "1"
            });
            this.videoEl.playsInline = true;
            this.videoEl.loop = false; // 1. Disable infinite looping

            // 2. Safely auto-stop recording when the video finishes
            this.videoEl.addEventListener('ended', () => {
                if (this.isRecordingMode) {
                    this.isRecordingMode = false;
                    this.updatePlayState(false);
                    console.log("[Mocap Surgeon] Reached end of video. Recording automatically finished.");
                }
            });

            // Sync play state if user clicks native video controls
            this.videoEl.addEventListener('play', () => this.updatePlayState(true));
            this.videoEl.addEventListener('pause', () => this.updatePlayState(false));

            // WebGL Canvas Wrapper (Sits directly on top of the scaled video)
            this.canvasWrap = document.createElement("div");
            Object.assign(this.canvasWrap.style, {
                position: "absolute",
                width: "100%",
                height: "100%",
                zIndex: "2",
                pointerEvents: "auto" // Let Three.js catch orbit controls
            });

            // 2D Debug Canvas (Overlaying the video but transparent to clicks)
            this.debugCanvas = document.createElement("canvas");
            Object.assign(this.debugCanvas.style, {
                position: "absolute",
                top: 0, left: 0,
                width: "100%", height: "100%",
                zIndex: "3", // Sit on top of ThreeJS
                pointerEvents: "none"
            });

            this.container.appendChild(this.videoEl);
            this.container.appendChild(this.canvasWrap);
            this.canvasWrap.appendChild(this.debugCanvas);

            this.buildUI();

            // --- 2. 3D ENGINE SETUP ---
            this.scene = new this.THREE.Scene();

            this.onionGroup = new this.THREE.Group();

            // --- NEW: LIGHTING SETUP FOR MESH VOLUME ---
            const ambientLight = new this.THREE.AmbientLight(0xffffff, 0.4);
            this.scene.add(ambientLight);

            // Key Light
            const dirLight = new this.THREE.DirectionalLight(0xffffff, 1.5);
            dirLight.position.set(0, 5, 5);
            this.scene.add(dirLight);

            // Rim Light
            const backLight = new this.THREE.DirectionalLight(0xffffff, 0.5);
            backLight.position.set(0, 2, -5);
            this.scene.add(backLight);

            // Initialize Custom Visualizer Groups
            this.pickerGroup = new this.THREE.Group();
            this.customSkeletonGroup = new this.THREE.Group();
            this.scene.add(this.pickerGroup);
            this.scene.add(this.customSkeletonGroup);

            this.camera = new this.THREE.PerspectiveCamera(45, 1, 0.01, 1000);
            this.camera.position.set(0, 1.2, 3);

            this.renderer = new this.THREE.WebGLRenderer({
                antialias: true,
                alpha: true // Enables transparent background
            });
            this.renderer.setClearColor(0x000000, 0); // Pure transparency
            if (this.renderer.outputColorSpace) this.renderer.outputColorSpace = this.THREE.SRGBColorSpace;

            this.canvasWrap.appendChild(this.renderer.domElement);
            Object.assign(this.renderer.domElement.style, {
                width: "100%",
                height: "100%",
                display: "block"
            });

            // Helpers
            const gridHelper = new this.THREE.GridHelper(10, 10, 0x444444, 0x222222);
            this.scene.add(gridHelper);

            // Orbit Controls
            this.controls = new this.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.target.set(0, 1, 0);
            this.controls.enableDamping = true;

            // Transform Controls (Manual Rig Override)
            this.transformControls = new this.TransformControlsClass(this.camera, this.renderer.domElement);
            // Default space is local for everything except Hips position which will be swapped dynamically
            this.transformControls.setSpace('local');
            this.scene.add(this.transformControls);

            // Disable OrbitControls while dragging the Transform Gizmo
            this.transformControls.addEventListener('dragging-changed', (event) => {
                this.controls.enabled = !event.value;
                if (!event.value) {
                    // Fired when the user releases the mouse button from the gizmo
                    this.saveManualEdit();
                }
            });

            // NEW: Update numbers while dragging the Gizmo
            this.transformControls.addEventListener('change', () => {
                this.updateTransformPanelUI();
            });

            // Hotkeys: Frame Stepping, Premiere Range Selection & Gizmo 
            this.container.addEventListener('keydown', (e) => {

                // 1. Frame Stepping Logic
                if (e.key === 'ArrowLeft' || e.key === ',') {
                    if (this.videoEl) {
                        if (!this.videoEl.paused) this.videoEl.pause();
                        this.videoEl.currentTime = Math.max(0, this.videoEl.currentTime - (1 / 30));
                        this.node.properties.scrubbedTime = this.videoEl.currentTime;
                        this.node.properties.scrubbedFrame = Math.round(this.videoEl.currentTime * 30);
                    }
                    return;
                }
                if (e.key === 'ArrowRight' || e.key === '.') {
                    if (this.videoEl) {
                        if (!this.videoEl.paused) this.videoEl.pause();
                        this.videoEl.currentTime = Math.min(this.videoEl.duration || Number.MAX_VALUE, this.videoEl.currentTime + (1 / 30));
                        this.node.properties.scrubbedTime = this.videoEl.currentTime;
                        this.node.properties.scrubbedFrame = Math.round(this.videoEl.currentTime * 30);
                    }
                    return;
                }

                // 2. Premiere-style In/Out Range Selection
                if (e.key === 'i' || e.key === 'I') {
                    this.markInFrame = this.currentFrameIndex;
                    this.updateRangeHighlight();
                    return;
                }
                if (e.key === 'o' || e.key === 'O') {
                    this.markOutFrame = this.currentFrameIndex;
                    this.updateRangeHighlight();
                    return;
                }
                if (e.key === 'Escape') {
                    this.markInFrame = null;
                    this.markOutFrame = null;
                    this.updateRangeHighlight();
                    return;
                }

                // 3. Delete Data Hotkey
                if (e.key === 'd' || e.key === 'D') {
                    this.deleteData();
                    return;
                }

                // 4. Transform Gizmo Hotkeys
                if (!this.transformControls || !this.transformControls.object) return;

                if (e.key === 'r' || e.key === 'R') {
                    this.transformControls.setMode('rotate');
                    this.transformControls.setSpace('local');
                } else if (e.key === 'g' || e.key === 'G') {
                    if (this.selectedMpIdx == 99) {
                        this.transformControls.setMode('translate');
                        this.transformControls.setSpace('world');
                    }
                }
            });

            // Raycaster Interaction: Picking specific visible joint spheres
            this.canvasWrap.addEventListener('pointerdown', (e) => {
                // Only pick when the system is paused to avoid fighting tracking data
                if (!this.videoEl.paused) return;

                // Do not interrupt raycasting if the user is already interacting with the Gizmo handles
                if (this.transformControls.axis !== null) return;

                const rect = this.canvasWrap.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

                this.raycaster.setFromCamera(new this.THREE.Vector2(x, y), this.camera);
                const intersects = this.raycaster.intersectObjects(this.pickableObjects);

                // Reset all picker colors back to their native Visual-Side colors
                this.pickableObjects.forEach(p => p.userData.baseColor && p.material.color.setHex(p.userData.baseColor));

                if (intersects.length > 0) {
                    const selectedPicker = intersects[0].object;
                    this.selectedMpIdx = selectedPicker.userData.mpIdx;

                    // Highlight selected joint in pure white
                    selectedPicker.material.color.setHex(0xffffff);

                    this.transformControls.attach(this.mocapBones[this.selectedMpIdx]);

                    // Smart Gizmo Switcher: Hips gets Global Translate. Bones get Local Rotate.
                    if (this.selectedMpIdx == 99) {
                        this.transformControls.setMode('translate');
                        this.transformControls.setSpace('world');
                    } else {
                        this.transformControls.setMode('rotate');
                        this.transformControls.setSpace('local');
                    }

                    // NEW: Show panel when clicked
                    this.updateTransformPanelUI();

                } else {
                    this.transformControls.detach();
                    this.selectedMpIdx = null;

                    // NEW: Hide panel when clicking empty space
                    this.updateTransformPanelUI();
                }
            });

            // Handle Resizing
            this.resizeObserver = new ResizeObserver(() => this.onResize());
            this.resizeObserver.observe(this.container);

            // Initialize Background Machine Learning Model
            this.initMediaPipe();

            // Load Rig immediately
            await this.loadRig();

            this.isInitialized = true;
            this.animate();

        } catch (e) {
            this.container.innerHTML = `<div style="color:red; padding:20px;">Init Error: ${e.message}</div>`;
        }
    }

    async initMediaPipe() {
        if (this.visionLib) return;
        try {
            console.log("[Mocap Surgeon] Mounting MediaPipe AI Core...");
            const visionUrl = new URL("./tasks_vision.js", this.baseUrl).href;
            this.visionLib = await import(visionUrl);
            const visionTask = await this.visionLib.FilesetResolver.forVisionTasks(this.baseUrl);
            const poseTaskUrl = new URL("./pose_landmarker_full.task", this.baseUrl).href;

            this.poseLandmarker = await this.visionLib.PoseLandmarker.createFromOptions(visionTask, {
                baseOptions: { modelAssetPath: poseTaskUrl, delegate: "GPU" },
                runningMode: "VIDEO", numPoses: 1
            });
            console.log("[Mocap Surgeon] Pose Landmarker Ready.");

            // Optional Detailed Task Models for Extremities
            const faceTaskUrl = new URL("./face_landmarker.task", this.baseUrl).href;
            const handTaskUrl = new URL("./hand_landmarker.task", this.baseUrl).href;

            try {
                this.faceLandmarker = await this.visionLib.FaceLandmarker.createFromOptions(visionTask, {
                    baseOptions: { modelAssetPath: faceTaskUrl, delegate: "GPU" },
                    runningMode: "VIDEO", numFaces: 1
                });

                this.handLandmarker = await this.visionLib.HandLandmarker.createFromOptions(visionTask, {
                    baseOptions: { modelAssetPath: handTaskUrl, delegate: "GPU" },
                    runningMode: "VIDEO", numHands: 2
                });
                console.log("[Mocap Surgeon] Advanced Face & Hand Landmarkers Ready.");
            } catch (e2) {
                console.warn("[Mocap Surgeon] Optional Face/Hand models failed to load. Ensure .task files exist in the directory.", e2);
            }

        } catch (e) {
            console.error("[Mocap Surgeon] AI Boot failure. Ensure pose_landmarker_full.task is in the root.", e);
        }
    }

    updateMeshVisibility() {
        if (!this.rig) return;
        this.rig.traverse((child) => {
            if (child.isMesh || child.isSkinnedMesh) {
                if (child.name === "Geo_Depth_F") {
                    child.visible = false;
                    return;
                }

                let fullPath = "";
                let curr = child;
                while (curr && curr !== this.rig && curr !== null) {
                    if (curr.name) fullPath += curr.name.toLowerCase() + "|";
                    curr = curr.parent;
                }
                const n = fullPath.replace(/[\s_]/g, '');

                if (n.includes("pose") || n.includes("openpose")) {
                    child.visible = this.showOpenPose;
                } else {
                    child.visible = this.showGeoDepth;
                }
            }
        });
    }

    buildUI() {
        // Red Recording Indicator overlay
        this.recordingIndicator = document.createElement("div");
        this.recordingIndicator.innerHTML = "🔴 REC";
        Object.assign(this.recordingIndicator.style, {
            position: "absolute", top: "16px", left: "16px", color: "#ff4444",
            fontWeight: "bold", fontSize: "14px", display: "none", zIndex: "10",
            background: "rgba(20, 20, 20, 0.8)", padding: "6px 12px", borderRadius: "4px",
            border: "1px solid #ff4444", letterSpacing: "1px", boxShadow: "0 0 8px rgba(255, 0, 0, 0.3)"
        });
        this.container.appendChild(this.recordingIndicator);

        // Orange Edited Tag overlay (Shifted left to make room for Help button)
        this.editedIndicator = document.createElement("div");
        this.editedIndicator.innerHTML = "📝 EDITED";
        Object.assign(this.editedIndicator.style, {
            position: "absolute", top: "16px", right: "64px", color: "#ffa500",
            fontWeight: "bold", fontSize: "14px", display: "none", zIndex: "10",
            background: "rgba(20, 20, 20, 0.8)", padding: "6px 12px", borderRadius: "4px",
            border: "1px solid #ffa500", letterSpacing: "1px", boxShadow: "0 0 8px rgba(255, 165, 0, 0.3)"
        });
        this.container.appendChild(this.editedIndicator);

        // --- NEW: FLOATING HELP BUTTON ---
        const btnHelp = document.createElement("button");
        btnHelp.innerHTML = "?";
        Object.assign(btnHelp.style, {
            position: "absolute", top: "16px", right: "16px",
            width: "36px", height: "36px", borderRadius: "50%",
            background: "rgba(0, 210, 255, 0.1)", border: "2px solid #00d2ff",
            color: "#00d2ff", fontSize: "20px", fontWeight: "bold", transition: "all 0.2s",
            cursor: "pointer", zIndex: "100", display: "flex",
            justifyContent: "center", alignItems: "center",
            boxShadow: "0 0 10px rgba(0, 210, 255, 0.3)", backdropFilter: "blur(4px)"
        });
        btnHelp.onmouseover = () => { btnHelp.style.background = "rgba(0, 210, 255, 0.3)"; btnHelp.style.transform = "scale(1.05)"; };
        btnHelp.onmouseout = () => { btnHelp.style.background = "rgba(0, 210, 255, 0.1)"; btnHelp.style.transform = "scale(1)"; };
        btnHelp.onclick = () => this.helpModal.style.display = this.helpModal.style.display === "none" ? "flex" : "none";
        this.container.appendChild(btnHelp);

        // --- NEW: HELP OVERLAY MODAL ---
        this.helpModal = document.createElement("div");
        Object.assign(this.helpModal.style, {
            position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            width: "80%", maxWidth: "600px", background: "rgba(15, 15, 20, 0.95)",
            border: "1px solid #00d2ff", borderRadius: "8px", padding: "24px",
            color: "#ccc", fontSize: "13px", lineHeight: "1.6", zIndex: "101",
            display: "none", flexDirection: "column", gap: "12px",
            boxShadow: "0 0 30px rgba(0, 210, 255, 0.4)", backdropFilter: "blur(8px)"
        });

        this.helpModal.innerHTML = `
            <h2 style="color: #00d2ff; margin: 0 0 8px 0; border-bottom: 1px solid #333; padding-bottom: 8px;">Mocap Surgeon - Workflow Guide</h2>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                <div>
                    <h4 style="color: #4ade80; margin: 0 0 4px 0;">🎥 STEP 1: LOAD VIDEO</h4>
                    <ul style="margin: 0; padding-left: 16px;">
                        <li>Load a video and press <b>Sync Camera</b> to lock the 3D space.</li>
                        <li>Toggle Face/Hands tracking if needed (requires more processing).</li>
                    </ul>
                    <h4 style="color: #ffb020; margin: 12px 0 4px 0;">⚙️ STEP 2: PLAY & FILTER</h4>
                    <ul style="margin: 0; padding-left: 16px;">
                        <li>Press <b>🔴 Record</b> to let the AI process and capture the motion.</li>
                        <li>Press <b>▶ Play Review</b> to watch your recording and edits smoothly.</li>
                        <li>Adjust Smoothing and Action Speed while recording to tune AI responses.</li>
                    </ul>
                </div>
                <div>
                    <h4 style="color: #ff4444; margin: 0 0 4px 0;">✂️ STEP 3: SURGERY</h4>
                    <ul style="margin: 0; padding-left: 16px;">
                        <li>Enable <b>Edit Mode</b> and click any joint to select it.</li>
                        <li>Press <b>R</b> to Rotate, <b>G</b> to Translate (Hips only).</li>
                        <li>Use <b>I</b> and <b>O</b> to set an editing range.</li>
                        <li>Press <b>D</b> to Delete bad tracking or manual edits.</li>
                        <li>Use <b>Left Arrow or ,</b> and <b>Right Arrow or .</b> to step frame-by-frame.</li>
                    </ul>
                    <h4 style="color: #b055ff; margin: 12px 0 4px 0;">💾 STEP 4: BAKE</h4>
                    <ul style="margin: 0; padding-left: 16px;">
                        <li>Type a name and press Save to bake to the Action Director.</li>
                    </ul>
                </div>
            </div>
            <button id="closeHelpBtn" style="margin-top: 12px; align-self: center; background: #333; color: white; border: 1px solid #555; padding: 6px 24px; border-radius: 4px; cursor: pointer; font-weight: bold;">Got it!</button>
        `;
        this.container.appendChild(this.helpModal);
        this.helpModal.querySelector("#closeHelpBtn").onclick = () => this.helpModal.style.display = "none";

        // UI Builder Helpers
        const createBtn = (text, color) => {
            const btn = document.createElement("button");
            btn.innerText = text;
            Object.assign(btn.style, {
                background: color, color: "#fff", border: "1px solid #555", borderRadius: "4px",
                padding: "6px 12px", cursor: "pointer", fontSize: "12px", fontWeight: "bold", transition: "all 0.2s"
            });
            btn.onmouseover = () => btn.style.filter = "brightness(1.2)";
            btn.onmouseout = () => btn.style.filter = "brightness(1.0)";
            return btn;
        };

        const buildSlider = (labelStr, min, max, step, def, onChange) => {
            const wrap = document.createElement("div");
            Object.assign(wrap.style, { display: "flex", gap: "4px", color: "#ccc", fontSize: "11px", alignItems: "center", marginLeft: "4px" });
            const lbl = document.createElement("span"); lbl.innerText = labelStr;
            const sld = document.createElement("input");
            sld.type = "range"; sld.min = min; sld.max = max; sld.step = step; sld.value = def;
            sld.className = "mocap-theme-slider";
            Object.assign(sld.style, { width: "60px" });
            const val = document.createElement("span"); val.innerText = def;
            sld.oninput = (e) => { val.innerText = e.target.value; onChange(parseFloat(e.target.value)); };
            wrap.append(lbl, sld, val);
            return wrap;
        };

        const buildToggle = (labelText, defaultState, callback) => {
            const lbl = document.createElement("label");
            Object.assign(lbl.style, { display: "flex", gap: "6px", color: "#ccc", fontSize: "12px", alignItems: "center", cursor: "pointer", marginLeft: "8px", fontWeight: "bold" });
            const chk = document.createElement("input");
            chk.type = "checkbox"; chk.checked = defaultState;
            chk.onchange = (e) => callback(e.target.checked);
            lbl.append(chk, " " + labelText);
            return lbl;
        };

        const buildStepBox = (titleText, color) => {
            const box = document.createElement("div");
            Object.assign(box.style, {
                border: `1px solid ${color}`, borderRadius: "6px", padding: "14px 8px 8px 8px",
                display: "flex", flexWrap: "wrap", gap: "8px", position: "relative",
                background: "rgba(0, 0, 0, 0.4)", alignItems: "center", justifyContent: "center", flexGrow: "1"
            });
            const title = document.createElement("div");
            title.innerText = titleText;
            Object.assign(title.style, {
                position: "absolute", top: "-8px", left: "12px", background: "#1a1a1a",
                padding: "0 6px", color: color, fontSize: "10px", fontWeight: "bold", letterSpacing: "1px"
            });
            box.appendChild(title);
            return box;
        };

        // --- TOP PANEL ---
        const topPanel = document.createElement("div");
        Object.assign(topPanel.style, {
            position: "absolute", top: "16px", left: "50%", transform: "translateX(-50%)",
            display: "flex", gap: "16px", background: "rgba(20, 20, 20, 0.85)", padding: "8px 16px",
            borderRadius: "8px", border: "1px solid #444", zIndex: "10", backdropFilter: "blur(4px)",
            alignItems: "center", flexWrap: "wrap", justifyContent: "center"
        });

        const tglOpenPose = buildToggle("OpenPose Proxy", this.showOpenPose, (v) => { this.showOpenPose = v; this.updateMeshVisibility(); });
        const tglGeoDepth = buildToggle("Character Mesh", this.showGeoDepth, (v) => { this.showGeoDepth = v; this.updateMeshVisibility(); });
        const tglMP = buildToggle("MP Points", this.showMPPoints, (v) => this.showMPPoints = v);

        topPanel.append(tglGeoDepth, tglOpenPose, tglMP);
        this.container.appendChild(topPanel);

        // --- BOTTOM PANEL ASSEMBLY ---
        const uiPanel = document.createElement("div");
        Object.assign(uiPanel.style, {
            position: "absolute", bottom: "16px", left: "50%", transform: "translateX(-50%)",
            display: "flex", flexDirection: "column", gap: "8px", background: "rgba(20, 20, 20, 0.85)",
            padding: "12px 16px", borderRadius: "8px", border: "1px solid #444", zIndex: "10",
            backdropFilter: "blur(4px)", alignItems: "stretch", minWidth: "80%"
        });

        const fileInput = document.createElement("input"); fileInput.type = "file"; fileInput.accept = "video/*"; fileInput.style.display = "none";
        const btnLoad = createBtn("📂 Load", "#2a2a2a");
        const btnSync = createBtn("🎥 Sync", "#006699");

        // NEW SEPARATE PLAYBACK CONTROLS
        this.btnRecord = createBtn("🔴 Record", "#8b0000");
        this.btnPlayReview = createBtn("▶ Play Review", "#2d5a27");

        const sldCutoff = buildSlider("Base Smoothing (Lower=Stronger):", 0.001, 5.0, 0.01, 0.01, v => this.filterMinCutoff = v);
        const sldBeta = buildSlider("Action Speed (Higher=Snappier):", 0.0, 50.0, 0.1, 20.0, v => this.filterBeta = v);

        // --- STEP 1: LOAD VIDEO ---
        const step1Box = buildStepBox("STEP 1: LOAD VIDEO", "#4ade80");
        const tglUpper = buildToggle("Upper Body", this.upperBodyOnly, (v) => this.upperBodyOnly = v);
        const tglHands = buildToggle("Hands", this.trackHands, (v) => this.trackHands = v);
        const tglFace = buildToggle("Face", this.trackFace, (v) => this.trackFace = v);
        step1Box.append(fileInput, btnLoad, btnSync, tglUpper, tglHands, tglFace);

        // --- STEP 2: RECORD & REVIEW ---
        const step2Box = buildStepBox("STEP 2: RECORD & REVIEW", "#ffb020");
        step2Box.append(this.btnRecord, this.btnPlayReview, sldCutoff, sldBeta);

        const topRows = document.createElement("div");
        Object.assign(topRows.style, { display: "flex", gap: "8px", width: "100%" });
        topRows.append(step1Box, step2Box);

        // --- STEP 3: SURGERY ---
        const step3Box = buildStepBox("STEP 3: SURGERY", "#ff4444");
        Object.assign(step3Box.style, { flexDirection: "column", width: "100%" });

        const surgeryToolsRow = document.createElement("div");
        Object.assign(surgeryToolsRow.style, { display: "flex", width: "100%", gap: "16px", justifyContent: "center", alignItems: "center", background: "rgba(0,0,0,0.3)", padding: "6px", borderRadius: "4px" });

        const tglEditMode = buildToggle("Edit Mode", this.showSkeleton, (v) => {
            this.showSkeleton = v;
            if (this.customSkeletonGroup) this.customSkeletonGroup.visible = this.showSkeleton;
            if (this.pickerGroup) this.pickerGroup.visible = this.showSkeleton;
        });
        tglEditMode.style.color = "#ff4444";

        const sepSurgery = document.createElement("div"); sepSurgery.innerText = " | "; Object.assign(sepSurgery.style, { color: "#666", fontWeight: "bold" });

        const tglOnion = buildToggle("Onion Skin", this.showOnionSkin, (v) => this.showOnionSkin = v);
        tglOnion.style.color = "#00d2ff";
        const sldOnionLayers = buildSlider("Layers:", 1, 5, 1, 2, v => this.onionSkinLayers = v);
        const sldOnionStep = buildSlider("Step:", 1, 10, 1, 3, v => this.onionSkinStep = v);

        surgeryToolsRow.append(tglEditMode, sepSurgery, tglOnion, sldOnionLayers, sldOnionStep);

        const rangeRow = document.createElement("div");
        Object.assign(rangeRow.style, { display: "flex", width: "100%", gap: "8px", justifyContent: "center", marginTop: "4px" });
        const btnIn = createBtn("❲ Set IN (I)", "#006699");
        const btnOut = createBtn("Set OUT (O) ❳", "#006699");
        const btnDel = createBtn("🗑️ Delete Data (D)", "#aa0000");
        btnIn.onclick = () => { this.markInFrame = this.currentFrameIndex; this.updateRangeHighlight(); };
        btnOut.onclick = () => { this.markOutFrame = this.currentFrameIndex; this.updateRangeHighlight(); };
        btnDel.onclick = () => this.deleteData();
        rangeRow.append(btnIn, btnOut, btnDel);

        const timelineRow = document.createElement("div");
        Object.assign(timelineRow.style, { display: "flex", width: "100%", gap: "8px", alignItems: "center" });

        this.timeLabel = document.createElement("span");
        this.timeLabel.innerText = "0 / 0 f";
        Object.assign(this.timeLabel.style, { color: "#ccc", fontSize: "11px", minWidth: "70px", whiteSpace: "nowrap" });

        this.timelineSlider = document.createElement("input");
        this.timelineSlider.type = "range"; this.timelineSlider.min = 0; this.timelineSlider.max = 100;
        this.timelineSlider.step = 0.01; this.timelineSlider.value = 0;
        this.timelineSlider.className = "mocap-theme-slider";
        Object.assign(this.timelineSlider.style, { width: "100%", margin: "0", zIndex: "2", position: "relative" });

        this.sliderWrap = document.createElement("div");
        Object.assign(this.sliderWrap.style, { position: "relative", flexGrow: "1", display: "flex", alignItems: "center", height: "20px" });

        this.ticksContainer = document.createElement("div");
        Object.assign(this.ticksContainer.style, { position: "absolute", left: "0", top: "0", width: "100%", height: "100%", pointerEvents: "none", zIndex: "1" });

        this.rangeHighlight = document.createElement("div");
        Object.assign(this.rangeHighlight.style, {
            position: "absolute", left: "0%", width: "0%", top: "2px", height: "16px",
            backgroundColor: "rgba(0, 210, 255, 0.4)", borderRadius: "2px", pointerEvents: "none", display: "none", zIndex: "5"
        });
        this.ticksContainer.appendChild(this.rangeHighlight);
        this.sliderWrap.append(this.ticksContainer, this.timelineSlider);

        this.timelineSlider.oninput = (e) => {
            if (!this.isScrubbing) {
                // Just started scrubbing, reset MP state to avoid timestamp crashes
                this._resetMpTimestamps();
            }
            this.isScrubbing = true;
            this._lastPlaybackFrame = -1;
            if (this.videoEl && !this.videoEl.paused) this.videoEl.pause();
            const scrubTime = parseFloat(e.target.value);
            if (this.videoEl) this.videoEl.currentTime = scrubTime;
            this.node.properties.scrubbedTime = scrubTime;
            this.node.properties.scrubbedFrame = Math.round(scrubTime * 30);
        };
        this.timelineSlider.onchange = () => this.isScrubbing = false;

        timelineRow.append(this.timeLabel, this.sliderWrap);
        step3Box.append(surgeryToolsRow, rangeRow, timelineRow);

        // --- STEP 4: BAKE & EXPORT ---
        const step4Box = buildStepBox("STEP 4: BAKE", "#b055ff");
        const glbNameInput = document.createElement("input");
        glbNameInput.type = "text"; glbNameInput.value = "Yedp_Clean_Mocap"; glbNameInput.className = "mocap-save-input";
        Object.assign(glbNameInput.style, { width: "140px" });
        const btnExport = createBtn("💾 Save to Action Director", "#800080");

        btnExport.onclick = async () => {
            btnExport.innerText = "⏳ Baking..."; btnExport.style.background = "#555";
            const success = await this.exportToGLB(glbNameInput.value);
            if (success) { btnExport.innerText = "✅ Saved!"; btnExport.style.background = "#008000"; }
            else { btnExport.innerText = "❌ Error"; btnExport.style.background = "#ff0000"; }
            setTimeout(() => { btnExport.innerText = "💾 Save to Action Director"; btnExport.style.background = "#800080"; }, 3000);
        };
        step4Box.append(glbNameInput, btnExport);

        const bottomRows = document.createElement("div");
        Object.assign(bottomRows.style, { display: "flex", gap: "8px", width: "100%" });
        bottomRows.append(step3Box, step4Box);

        uiPanel.append(topRows, bottomRows);
        this.container.appendChild(uiPanel);

        // --- RIGHT TRANSFORM PANEL ---
        this.transformPanelEl = document.createElement("div");
        Object.assign(this.transformPanelEl.style, {
            position: "absolute", right: "16px", top: "50%", transform: "translateY(-50%)",
            display: "none", flexDirection: "column", gap: "8px", background: "rgba(20, 20, 20, 0.85)",
            padding: "12px", borderRadius: "8px", border: "1px solid #444", zIndex: "10", backdropFilter: "blur(4px)"
        });

        const panelTitle = document.createElement("div");
        panelTitle.innerText = "Transform";
        Object.assign(panelTitle.style, { color: "#00d2ff", fontSize: "12px", fontWeight: "bold", textAlign: "center", marginBottom: "4px" });
        this.transformPanelEl.appendChild(panelTitle);

        this.uiTransformInputs = {};

        const buildTransformRow = (labelStr, keys) => {
            const row = document.createElement("div");
            Object.assign(row.style, { display: "flex", gap: "4px", alignItems: "center" });
            const lbl = document.createElement("span");
            lbl.innerText = labelStr;
            Object.assign(lbl.style, { color: "#888", fontSize: "11px", width: "25px" });
            row.appendChild(lbl);

            keys.forEach(k => {
                const inp = document.createElement("input");
                inp.type = "number"; inp.step = k.startsWith('p') ? "0.01" : "1";
                Object.assign(inp.style, { width: "45px", background: "#111", color: "#fff", border: "1px solid #555", borderRadius: "3px", fontSize: "11px", padding: "2px", textAlign: "right" });
                inp.addEventListener('keydown', e => e.stopPropagation());
                inp.addEventListener('keyup', e => e.stopPropagation());
                inp.onchange = () => this.applyManualTransformFromUI();
                this.uiTransformInputs[k] = inp;
                row.appendChild(inp);
            });
            return row;
        };

        this.transformPanelEl.appendChild(buildTransformRow("Pos", ['px', 'py', 'pz']));
        this.transformPanelEl.appendChild(buildTransformRow("Rot", ['rx', 'ry', 'rz']));
        this.container.appendChild(this.transformPanelEl);

        // UI Events
        btnLoad.onclick = () => fileInput.click();

        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            this.motionData = {};
            if (this.ticksContainer) {
                const existingTicks = this.ticksContainer.querySelectorAll('.mocap-tick');
                existingTicks.forEach(t => t.remove());
            }
            this.boneFilters = {};
            this.hipsPosFilter = null;
            this.baseFaceLandmarks = null;
            this.currentFrameIndex = 0;
            this.isRecordingMode = false;

            this.pose2DFilters = [];
            this.poseWorldFilters = [];
            this.handWorldFilters = { "Left": [], "Right": [] };
            this.hand2DFilters = { "Left": [], "Right": [] };
            this.face2DFilters = [];

            this.lastVideoTimeMs = -1;

            if (this.videoEl.src && this.videoEl.src.startsWith('blob:')) {
                URL.revokeObjectURL(this.videoEl.src);
            }

            this.videoEl.src = URL.createObjectURL(file);
            this.videoEl.onloadedmetadata = () => {
                console.log(`[Mocap Surgeon] Loaded video: ${file.name}`);
                if (this.timelineSlider) this.timelineSlider.max = this.videoEl.duration;

                if (this.node.properties && this.node.properties.scrubbedTime !== undefined) {
                    if (this.node.properties.scrubbedTime <= this.videoEl.duration) {
                        this.videoEl.currentTime = this.node.properties.scrubbedTime;
                        this.timelineSlider.value = this.node.properties.scrubbedTime;
                    }
                }
                this.syncCamera();
            };
        };

        btnSync.onclick = () => this.syncCamera();

        // Separate Record Button Logic
        this.btnRecord.onclick = async () => {
            if (this.videoEl.paused) {
                this.isRecordingMode = true;
                this._lastPlaybackFrame = -1;

                // --- THE WARM-UP FIX ---
                this.btnRecord.innerText = "⏳ Warming Up...";
                this.btnRecord.style.background = "#555";

                // Force a single frame through the AI to load models into the GPU memory
                // BEFORE we let the video start playing natively.
                if (this.poseLandmarker && this.videoEl.readyState >= 2) {
                    try {
                        let mpTimestamp = performance.now();
                        if (this.lastMpTimestamp !== undefined && mpTimestamp <= this.lastMpTimestamp) {
                            mpTimestamp = this.lastMpTimestamp + 0.1;
                        }
                        this.lastMpTimestamp = mpTimestamp;
                        this.poseLandmarker.detectForVideo(this.videoEl, mpTimestamp);
                    } catch (e) { console.warn("Warmup skip", e); }
                }

                // Now start the video (tracking will immediately catch frame 0)
                this.updatePlayState(true);
                const playPromise = this.videoEl.play();
                if (playPromise !== undefined) playPromise.catch(e => console.warn("[Mocap Surgeon] Record Play interrupted:", e));
            } else {
                // Pausing
                this.videoEl.pause();
                this.updatePlayState(false);
                if (this.videoEl) {
                    this.node.properties.scrubbedTime = this.videoEl.currentTime;
                    this.node.properties.scrubbedFrame = Math.round(this.videoEl.currentTime * 30);
                }
            }
        };

        // Separate Play Review Logic (Bypasses MP inference entirely)
        this.btnPlayReview.onclick = () => {
            if (this.videoEl.paused) {
                this.isRecordingMode = false; // Explicitly disable recording
                this._lastPlaybackFrame = -1;
                const playPromise = this.videoEl.play();
                if (playPromise !== undefined) playPromise.catch(e => console.warn("[Mocap Surgeon] Playback interrupted:", e));
            } else {
                this.videoEl.pause();
                this.isRecordingMode = false; // Explicitly disable recording
                if (this.videoEl) {
                    this.node.properties.scrubbedTime = this.videoEl.currentTime;
                    this.node.properties.scrubbedFrame = Math.round(this.videoEl.currentTime * 30);
                }
            }
        };
    }

    updatePlayState(isPlaying) {
        this.isPlaying = isPlaying;
        // NOTE: We no longer auto-reset isRecordingMode on pause.
        // Recording intent is only changed by explicit user action (Record/Review buttons).

        if (this.btnRecord && this.btnPlayReview) {
            if (isPlaying) {
                if (this.isRecordingMode) {
                    this.btnRecord.innerText = "⏸ Pause Rec";
                    this.btnRecord.style.background = "#5a2727";
                    this.btnPlayReview.innerText = "▶ Play Review";
                    this.btnPlayReview.style.background = "#2d5a27";
                } else {
                    this.btnPlayReview.innerText = "⏸ Pause Review";
                    this.btnPlayReview.style.background = "#5a2727";
                    this.btnRecord.innerText = "🔴 Record";
                    this.btnRecord.style.background = "#8b0000";
                }
            } else {
                // Show paused state but preserve the mode intent
                if (this.isRecordingMode) {
                    this.btnRecord.innerText = "🔴 Resume Rec";
                    this.btnRecord.style.background = "#8b0000";
                } else {
                    this.btnRecord.innerText = "🔴 Record";
                    this.btnRecord.style.background = "#8b0000";
                }
                this.btnPlayReview.innerText = "▶ Play Review";
                this.btnPlayReview.style.background = "#2d5a27";
            }
        }
    }

    async loadRig() {
        const rigUrl = new URL(`../Yedp_Rig.glb?t=${Date.now()}`, this.baseUrl).href;

        try {
            console.log("[Mocap Surgeon] Loading reference rig from:", rigUrl);
            const model = await new this.GLTFLoaderClass().loadAsync(rigUrl);
            this.rig = model.scene;
            this.mocapBones = {};
            this.pickableObjects = [];
            this.boneCylinders = [];

            this.rig.rotation.set(0, Math.PI, 0);
            this.rig.updateMatrixWorld(true);

            console.log("---- [Mocap Surgeon] RIG BONE AUDIT START ----");

            const getSideColor = (idx) => {
                const i = parseInt(idx);
                if ([12, 14, 16, 24, 26, 28].includes(i)) return 0x886666;
                if ([11, 13, 15, 23, 25, 27].includes(i)) return 0x666688;
                return 0x668866;
            };

            const pickerGeo = new this.THREE.SphereGeometry(0.04, 12, 12);

            this.rig.traverse((child) => {
                if (child.isBone) {
                    let mapped = false;
                    for (const [mpIdx, boneNames] of Object.entries(this.MP_TO_MIXAMO)) {
                        if (!mapped && boneNames.some(bn => child.name === bn || child.name.endsWith(bn))) {
                            this.mocapBones[mpIdx] = child;
                            mapped = true;

                            const jointColor = getSideColor(mpIdx);
                            const pickerMat = new this.THREE.MeshBasicMaterial({
                                color: jointColor, transparent: true, opacity: 0.8, depthTest: false, depthWrite: false
                            });
                            const picker = new this.THREE.Mesh(pickerGeo, pickerMat);
                            picker.userData.mpIdx = mpIdx;
                            picker.userData.baseColor = jointColor;
                            this.pickerGroup.add(picker);
                            this.pickableObjects.push(picker);
                        }
                    }

                    if (!mapped && child.name.includes("OP_Face_")) {
                        const match = child.name.match(/OP_Face_(\d+)/);
                        if (match) {
                            const fIdx = parseInt(match[1]);
                            if (fIdx >= 0 && fIdx < 70) {
                                const faceId = 300 + fIdx;
                                this.mocapBones[faceId] = child;
                                this.BONE_EXPORT_NAMES[faceId] = `OP_Face_${fIdx}`;
                                mapped = true;
                            }
                        }
                    }

                    if (!mapped) {
                        ["Left", "Right"].forEach(side => {
                            this.HAND_DICT[side].forEach(finger => {
                                if (child.name.includes(finger.name)) {
                                    this.mocapBones[finger.id] = child;
                                    this.BONE_EXPORT_NAMES[finger.id] = finger.name;
                                    mapped = true;
                                }
                            });
                        });
                    }
                }

                if (child.isMesh || child.isSkinnedMesh) {
                    child.frustumCulled = false;

                    const processMat = (mat) => {
                        const oldColor = mat.color || new this.THREE.Color(0xffffff);
                        const newMat = new this.THREE.MeshStandardMaterial({
                            color: oldColor,
                            roughness: 0.6,
                            metalness: 0.1
                        });

                        if (mat.map) {
                            newMat.map = mat.map;
                            newMat.color.setHex(0xffffff);
                        }

                        newMat.transparent = false;
                        newMat.opacity = 1.0;
                        newMat.depthWrite = true;
                        newMat.side = this.THREE.DoubleSide;
                        return newMat;
                    };

                    if (Array.isArray(child.material)) {
                        child.material = child.material.map(processMat);
                    } else if (child.material) {
                        child.material = processMat(child.material);
                    }
                }
            });

            this.updateMeshVisibility();
            console.log("---- [Mocap Surgeon] RIG BONE AUDIT END ----");

            const cylGeo = new this.THREE.CylinderGeometry(0.015, 0.015, 1, 8);
            cylGeo.translate(0, 0.5, 0);

            this.BONE_CONNECTIONS.forEach(([idx1, idx2]) => {
                const color = getSideColor(idx1);
                const mat = new this.THREE.MeshBasicMaterial({
                    color: color,
                    transparent: true, opacity: 0.9,
                    depthTest: false, depthWrite: false
                });
                const mesh = new this.THREE.Mesh(cylGeo, mat);
                this.customSkeletonGroup.add(mesh);
                this.boneCylinders.push({ mesh, i: idx1, j: idx2 });
            });

            this.scene.add(this.rig);
            this.rig.add(this.onionGroup);

            this.rig.updateMatrixWorld(true);

            if (this.mocapBones[11] && this.mocapBones[12]) {
                const lPos = new this.THREE.Vector3(); this.mocapBones[11].getWorldPosition(lPos);
                const rPos = new this.THREE.Vector3(); this.mocapBones[12].getWorldPosition(rPos);
                this.baseRigShoulderWidth = lPos.distanceTo(rPos);
                this.baseRigShoulderMidpoint = new this.THREE.Vector3().addVectors(lPos, rPos).multiplyScalar(0.5);
                console.log(`[Mocap Surgeon] Calibrated Rig Base Shoulder Width: ${this.baseRigShoulderWidth.toFixed(4)}`);
            }

            for (const [mpIdx, bone] of Object.entries(this.mocapBones)) {
                bone.userData.restQuaternion = bone.quaternion.clone();
                bone.userData.restPosition = bone.position.clone();
            }

            this.mixer = new this.THREE.AnimationMixer(this.rig);
            if (model.animations && model.animations.length > 0) {
                const action = this.mixer.clipAction(model.animations[0]);
                action.play();
            }

        } catch (e) {
            console.error("[Mocap Surgeon] Failed to load Yedp_Rig.glb", e);
        }
    }

    updateTransformPanelUI() {
        if (!this.selectedMpIdx || !this.mocapBones[this.selectedMpIdx]) {
            if (this.transformPanelEl) this.transformPanelEl.style.display = "none";
            return;
        }

        if (this.transformPanelEl) this.transformPanelEl.style.display = "flex";

        const bone = this.mocapBones[this.selectedMpIdx];
        const ui = this.uiTransformInputs;
        if (!ui || !ui.px) return;

        ui.px.value = bone.position.x.toFixed(3);
        ui.py.value = bone.position.y.toFixed(3);
        ui.pz.value = bone.position.z.toFixed(3);

        const euler = new this.THREE.Euler().setFromQuaternion(bone.quaternion);
        ui.rx.value = this.THREE.MathUtils.radToDeg(euler.x).toFixed(1);
        ui.ry.value = this.THREE.MathUtils.radToDeg(euler.y).toFixed(1);
        ui.rz.value = this.THREE.MathUtils.radToDeg(euler.z).toFixed(1);

        const isHips = (this.selectedMpIdx == 99);
        ui.px.disabled = !isHips; ui.py.disabled = !isHips; ui.pz.disabled = !isHips;
        ui.px.style.opacity = isHips ? "1.0" : "0.3";
        ui.py.style.opacity = isHips ? "1.0" : "0.3";
        ui.pz.style.opacity = isHips ? "1.0" : "0.3";
    }

    applyManualTransformFromUI() {
        if (!this.selectedMpIdx || !this.mocapBones[this.selectedMpIdx]) return;

        const bone = this.mocapBones[this.selectedMpIdx];
        const ui = this.uiTransformInputs;

        if (this.selectedMpIdx == 99) {
            bone.position.set(parseFloat(ui.px.value) || 0, parseFloat(ui.py.value) || 0, parseFloat(ui.pz.value) || 0);
        }

        const rx = this.THREE.MathUtils.degToRad(parseFloat(ui.rx.value) || 0);
        const ry = this.THREE.MathUtils.degToRad(parseFloat(ui.ry.value) || 0);
        const rz = this.THREE.MathUtils.degToRad(parseFloat(ui.rz.value) || 0);
        bone.quaternion.setFromEuler(new this.THREE.Euler(rx, ry, rz));

        bone.updateMatrixWorld(true);
        this.saveManualEdit();
    }

    updateTimelineTicks() {
        if (!this.ticksContainer || !this.videoEl || isNaN(this.videoEl.duration) || this.videoEl.duration === 0) return;

        const existingTicks = this.ticksContainer.querySelectorAll('.mocap-tick');
        existingTicks.forEach(t => t.remove());

        const totalFrames = Math.round(this.videoEl.duration * 30);
        if (totalFrames <= 0) return;

        for (const [frameStr, data] of Object.entries(this.motionData)) {
            if (data && data.hasManualEdits) {
                const fIdx = parseInt(frameStr);
                const percent = (fIdx / totalFrames) * 100;

                const tick = document.createElement("div");
                tick.className = "mocap-tick";
                Object.assign(tick.style, {
                    position: "absolute", left: `${percent}%`, top: "14px",
                    width: "2px", height: "6px", backgroundColor: "#ffa500",
                    transform: "translateX(-50%)", borderRadius: "1px"
                });
                this.ticksContainer.appendChild(tick);
            }
        }
    }

    drawOnionSkin() {
        if (!this.onionGroup) return;

        if (!this.showOnionSkin || this.currentFrameIndex === null || (this.videoEl && !this.videoEl.paused)) {
            if (this.onionGroup.children.length > 0) this.onionGroup.clear();
            this.wasShowingOnion = false;
            return;
        }

        if (!this.wasShowingOnion) {
            this.lastOnionFrame = -1;
            this.wasShowingOnion = true;
        }

        const isDragging = this.transformControls && this.transformControls.dragging;
        if (this.currentFrameIndex === this.lastOnionFrame && !isDragging) {
            return;
        }
        this.lastOnionFrame = this.currentFrameIndex;

        if (this.onionGroup.parent !== this.scene) this.scene.add(this.onionGroup);
        this.onionGroup.clear();

        const backupState = {};
        for (const [mpIdx, bone] of Object.entries(this.mocapBones)) {
            backupState[mpIdx] = {
                pos: bone.position.clone(),
                quat: bone.quaternion.clone()
            };
        }

        const dotGeo = new this.THREE.SphereGeometry(0.015, 6, 6);

        const drawSkeleton = (fIdx, colorHex, opacity) => {
            const frameData = this.motionData[fIdx];
            if (!frameData || !frameData.bones) return;

            for (const [mpIdx, dat] of Object.entries(frameData.bones)) {
                const bone = this.mocapBones[mpIdx];
                if (!bone || !dat) continue;

                if (parseInt(mpIdx) >= 300 && parseInt(mpIdx) <= 369) {
                    if (dat.posX !== undefined) bone.position.set(dat.posX, dat.posY, dat.posZ);
                } else {
                    if (dat.x !== undefined) bone.quaternion.set(dat.x, dat.y, dat.z, dat.w);
                }
            }
            if (frameData.hipsPos && this.mocapBones[99]) {
                this.mocapBones[99].position.set(frameData.hipsPos.x, frameData.hipsPos.y, frameData.hipsPos.z);
            }

            this.rig.updateMatrixWorld(true);

            const worldPositions = {};
            [99, 901, 902, 903, 0, 11, 13, 15, 12, 14, 16, 23, 25, 27, 24, 26, 28].forEach(idx => {
                if (this.mocapBones[idx]) {
                    worldPositions[idx] = this.mocapBones[idx].getWorldPosition(new this.THREE.Vector3());
                }
            });

            const material = new this.THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: opacity, depthTest: false, depthWrite: false });

            for (let i in worldPositions) {
                let dot = new this.THREE.Mesh(dotGeo, material);
                dot.position.copy(worldPositions[i]);
                this.onionGroup.add(dot);
            }

            const linePoints = [];
            this.BONE_CONNECTIONS.forEach(([i, j]) => {
                if (worldPositions[i] && worldPositions[j]) {
                    linePoints.push(worldPositions[i], worldPositions[j]);
                }
            });
            if (linePoints.length > 0) {
                const lineGeo = new this.THREE.BufferGeometry().setFromPoints(linePoints);
                const lineMat = new this.THREE.LineBasicMaterial({ color: colorHex, transparent: true, opacity: opacity * 0.5, depthTest: false });
                this.onionGroup.add(new this.THREE.LineSegments(lineGeo, lineMat));
            }
        };

        const getNearestFrame = (targetF) => {
            if (this.motionData[targetF] && this.motionData[targetF].bones) return targetF;
            for (let offset = 1; offset <= 6; offset++) {
                if (this.motionData[targetF - offset] && this.motionData[targetF - offset].bones) return targetF - offset;
                if (this.motionData[targetF + offset] && this.motionData[targetF + offset].bones) return targetF + offset;
            }
            return null;
        };

        for (let i = 1; i <= this.onionSkinLayers; i++) {
            let actualF = getNearestFrame(this.currentFrameIndex - (i * this.onionSkinStep));
            if (actualF !== null) drawSkeleton(actualF, 0xff0000, Math.max(0.15, 1.0 - (i * 0.35)));
        }

        for (let i = 1; i <= this.onionSkinLayers; i++) {
            let actualF = getNearestFrame(this.currentFrameIndex + (i * this.onionSkinStep));
            if (actualF !== null) drawSkeleton(actualF, 0x00ff00, Math.max(0.15, 1.0 - (i * 0.35)));
        }

        for (const [mpIdx, state] of Object.entries(backupState)) {
            const bone = this.mocapBones[mpIdx];
            if (bone) {
                bone.position.copy(state.pos);
                bone.quaternion.copy(state.quat);
            }
        }
        this.rig.updateMatrixWorld(true);
    }

    saveManualEdit() {
        if (!this.selectedMpIdx || this.currentFrameIndex === null) return;

        let mpIdx = this.selectedMpIdx;
        let frameIdx = this.currentFrameIndex;

        if (!this.motionData[frameIdx]) this.motionData[frameIdx] = { bones: {} };
        if (!this.motionData[frameIdx].bones[mpIdx]) this.motionData[frameIdx].bones[mpIdx] = {};

        const bone = this.mocapBones[mpIdx];
        const quat = bone.quaternion;

        this.motionData[frameIdx].hasManualEdits = true;
        this.motionData[frameIdx].bones[mpIdx].isManual = true;

        let bDat = this.motionData[frameIdx].bones[mpIdx];
        if (bDat.baseX === undefined && bDat.x !== undefined) {
            bDat.baseX = bDat.x; bDat.baseY = bDat.y; bDat.baseZ = bDat.z;
            if (bDat.w !== undefined) bDat.baseW = bDat.w;
        }

        bDat.x = quat.x; bDat.y = quat.y; bDat.z = quat.z; bDat.w = quat.w;

        if (mpIdx == 99) {
            if (!this.motionData[frameIdx].hipsPos) this.motionData[frameIdx].hipsPos = {};
            let hDat = this.motionData[frameIdx].hipsPos;

            if (hDat.baseX === undefined && hDat.x !== undefined) {
                hDat.baseX = hDat.x; hDat.baseY = hDat.y; hDat.baseZ = hDat.z;
            }
            hDat.x = bone.position.x; hDat.y = bone.position.y; hDat.z = bone.position.z;
            hDat.isManual = true;
        }

        this.performBlendAt(frameIdx, mpIdx);

        this.updateTimelineTicks();
        this.lastOnionFrame = -1;
    }

    performBlendAt(frameIdx, mpIdx) {
        const BLEND_FRAMES = 10;
        const keysArray = Object.keys(this.motionData).map(Number);
        const totalFrames = keysArray.length > 0 ? Math.max(...keysArray) : 0;

        let manualKeys = [];
        for (let f = 0; f <= totalFrames; f++) {
            if (this.motionData[f] && this.motionData[f].bones[mpIdx]) {
                const bData = this.motionData[f].bones[mpIdx];
                if (bData.isManual) {
                    manualKeys.push(f);
                } else if (bData.isBlended) {
                    if (bData.baseX !== undefined) {
                        bData.x = bData.baseX; bData.y = bData.baseY; bData.z = bData.baseZ;
                        if (bData.baseW !== undefined) bData.w = bData.baseW;
                    }
                    bData.isBlended = false;
                }
            }
            if (mpIdx == 99 && this.motionData[f] && this.motionData[f].hipsPos) {
                const pDat = this.motionData[f].hipsPos;
                if (!pDat.isManual && pDat.isBlended) {
                    if (pDat.baseX !== undefined) {
                        pDat.x = pDat.baseX; pDat.y = pDat.baseY; pDat.z = pDat.baseZ;
                    }
                    pDat.isBlended = false;
                }
            }
        }

        const getRawQuat = (f) => {
            const b = this.motionData[f].bones[mpIdx];
            if (b.baseX !== undefined) return new this.THREE.Quaternion(b.baseX, b.baseY, b.baseZ, b.baseW);
            return new this.THREE.Quaternion(b.x, b.y, b.z, b.w);
        };
        const getManQuat = (f) => {
            const b = this.motionData[f].bones[mpIdx];
            return new this.THREE.Quaternion(b.x, b.y, b.z, b.w);
        };
        const getRawPos = (f) => {
            const p = this.motionData[f].hipsPos;
            if (p.baseX !== undefined) return new this.THREE.Vector3(p.baseX, p.baseY, p.baseZ);
            return new this.THREE.Vector3(p.x, p.y, p.z);
        };
        const getManPos = (f) => {
            const p = this.motionData[f].hipsPos;
            return new this.THREE.Vector3(p.x, p.y, p.z);
        };

        for (let i = 0; i < manualKeys.length; i++) {
            const mk = manualKeys[i];
            const qMan = getManQuat(mk);
            const qRaw = getRawQuat(mk);
            const qOffsetA = qRaw.clone().invert().multiply(qMan);

            let pOffsetA = null;
            if (mpIdx == 99 && this.motionData[mk].hipsPos && this.motionData[mk].hipsPos.isManual) {
                pOffsetA = getManPos(mk).clone().sub(getRawPos(mk));
            }

            const nextMK = i < manualKeys.length - 1 ? manualKeys[i + 1] : null;
            const forwardDist = nextMK !== null ? nextMK - mk : 999999;

            if (nextMK !== null && forwardDist <= BLEND_FRAMES * 2) {
                const qOffsetB = getRawQuat(nextMK).clone().invert().multiply(getManQuat(nextMK));
                let pOffsetB = null;
                if (mpIdx == 99 && this.motionData[nextMK].hipsPos && this.motionData[nextMK].hipsPos.isManual) {
                    pOffsetB = getManPos(nextMK).clone().sub(getRawPos(nextMK));
                }

                for (let d = 1; d < forwardDist; d++) {
                    let f = mk + d;
                    if (!this.motionData[f] || !this.motionData[f].bones[mpIdx]) continue;
                    let t = d / forwardDist;
                    let currentOffset = new this.THREE.Quaternion().copy(qOffsetA).slerp(qOffsetB, t);
                    let finalQ = getRawQuat(f).clone().multiply(currentOffset);

                    const bDat = this.motionData[f].bones[mpIdx];
                    if (bDat.baseX === undefined) {
                        bDat.baseX = bDat.x; bDat.baseY = bDat.y; bDat.baseZ = bDat.z; bDat.baseW = bDat.w;
                    }
                    bDat.x = finalQ.x; bDat.y = finalQ.y; bDat.z = finalQ.z; bDat.w = finalQ.w;
                    bDat.isBlended = true;

                    if (pOffsetA && pOffsetB && this.motionData[f].hipsPos) {
                        let curPOffset = pOffsetA.clone().lerp(pOffsetB, t);
                        let finalP = getRawPos(f).clone().add(curPOffset);
                        const pDat = this.motionData[f].hipsPos;
                        if (pDat.baseX === undefined) {
                            pDat.baseX = pDat.x; pDat.baseY = pDat.y; pDat.baseZ = pDat.z;
                        }
                        pDat.x = finalP.x; pDat.y = finalP.y; pDat.z = finalP.z;
                        pDat.isBlended = true;
                    }
                    this.motionData[f].hasManualEdits = true;
                }
            } else {
                for (let d = 1; d <= BLEND_FRAMES && d < forwardDist; d++) {
                    let f = mk + d;
                    if (!this.motionData[f] || !this.motionData[f].bones[mpIdx]) continue;
                    let t = d / (BLEND_FRAMES + 1);
                    let currentOffset = new this.THREE.Quaternion().copy(qOffsetA).slerp(new this.THREE.Quaternion(), t);
                    let finalQ = getRawQuat(f).clone().multiply(currentOffset);

                    const bDat = this.motionData[f].bones[mpIdx];
                    if (bDat.baseX === undefined) {
                        bDat.baseX = bDat.x; bDat.baseY = bDat.y; bDat.baseZ = bDat.z; bDat.baseW = bDat.w;
                    }
                    bDat.x = finalQ.x; bDat.y = finalQ.y; bDat.z = finalQ.z; bDat.w = finalQ.w;
                    bDat.isBlended = true;

                    if (pOffsetA && this.motionData[f].hipsPos) {
                        let curPOffset = pOffsetA.clone().lerp(new this.THREE.Vector3(0, 0, 0), t);
                        let finalP = getRawPos(f).clone().add(curPOffset);
                        const pDat = this.motionData[f].hipsPos;
                        if (pDat.baseX === undefined) {
                            pDat.baseX = pDat.x; pDat.baseY = pDat.y; pDat.baseZ = pDat.z;
                        }
                        pDat.x = finalP.x; pDat.y = finalP.y; pDat.z = finalP.z;
                        pDat.isBlended = true;
                    }
                    this.motionData[f].hasManualEdits = true;
                }
            }

            const prevMK = i > 0 ? manualKeys[i - 1] : null;
            const backDist = prevMK !== null ? mk - prevMK : 999999;
            if (prevMK !== null && backDist <= BLEND_FRAMES * 2) {
                // Handled by forward pass of prevMK
            } else {
                for (let d = 1; d <= BLEND_FRAMES && d < backDist; d++) {
                    let f = mk - d;
                    if (!this.motionData[f] || !this.motionData[f].bones[mpIdx]) continue;
                    let t = d / (BLEND_FRAMES + 1);
                    let currentOffset = new this.THREE.Quaternion().copy(qOffsetA).slerp(new this.THREE.Quaternion(), t);
                    let finalQ = getRawQuat(f).clone().multiply(currentOffset);

                    const bDat = this.motionData[f].bones[mpIdx];
                    if (bDat.baseX === undefined) {
                        bDat.baseX = bDat.x; bDat.baseY = bDat.y; bDat.baseZ = bDat.z; bDat.baseW = bDat.w;
                    }
                    bDat.x = finalQ.x; bDat.y = finalQ.y; bDat.z = finalQ.z; bDat.w = finalQ.w;
                    bDat.isBlended = true;

                    if (pOffsetA && this.motionData[f].hipsPos) {
                        let curPOffset = pOffsetA.clone().lerp(new this.THREE.Vector3(0, 0, 0), t);
                        let finalP = getRawPos(f).clone().add(curPOffset);
                        const pDat = this.motionData[f].hipsPos;
                        if (pDat.baseX === undefined) {
                            pDat.baseX = pDat.x; pDat.baseY = pDat.y; pDat.baseZ = pDat.z;
                        }
                        pDat.x = finalP.x; pDat.y = finalP.y; pDat.z = finalP.z;
                        pDat.isBlended = true;
                    }
                    this.motionData[f].hasManualEdits = true;
                }
            }
        }
    }


    updateRangeHighlight() {
        if (!this.rangeHighlight || !this.videoEl || isNaN(this.videoEl.duration) || this.videoEl.duration === 0) return;
        const totalFrames = Math.round(this.videoEl.duration * 30);

        if (!this.inMarker) {
            this.inMarker = document.createElement("div");
            Object.assign(this.inMarker.style, {
                position: "absolute", top: "-4px", color: "#00ff00", fontWeight: "900",
                fontSize: "24px", pointerEvents: "none", zIndex: "3", display: "none", transform: "translateX(-50%)"
            });
            this.inMarker.innerText = "❲";
            this.ticksContainer.appendChild(this.inMarker);

            this.outMarker = document.createElement("div");
            Object.assign(this.outMarker.style, {
                position: "absolute", top: "-4px", color: "#ff0000", fontWeight: "900",
                fontSize: "24px", pointerEvents: "none", zIndex: "3", display: "none", transform: "translateX(-50%)"
            });
            this.outMarker.innerText = "❳";
            this.ticksContainer.appendChild(this.outMarker);
        }

        if (this.markInFrame != null || this.markOutFrame != null) {
            this.rangeHighlight.style.display = "block";
            let start = this.markInFrame != null ? this.markInFrame : 0;
            let end = this.markOutFrame != null ? this.markOutFrame : totalFrames;

            if (start > end) { let temp = start; start = end; end = temp; }

            let startPct = (start / totalFrames) * 100;
            let endPct = (end / totalFrames) * 100;

            this.rangeHighlight.style.left = `${startPct}%`;
            this.rangeHighlight.style.width = `${Math.max(0.5, endPct - startPct)}%`;
            this.rangeHighlight.style.zIndex = "5";
            this.rangeHighlight.style.borderLeft = this.markInFrame != null ? "4px solid #00ff00" : "none";
            this.rangeHighlight.style.borderRight = this.markOutFrame != null ? "4px solid #ff0000" : "none";
            this.rangeHighlight.style.height = "16px";
            this.rangeHighlight.style.top = "2px";

            if (this.markInFrame != null) {
                this.inMarker.style.display = "block";
                this.inMarker.style.left = `${(this.markInFrame / totalFrames) * 100}%`;
            } else this.inMarker.style.display = "none";

            if (this.markOutFrame != null) {
                this.outMarker.style.display = "block";
                this.outMarker.style.left = `${(this.markOutFrame / totalFrames) * 100}%`;
            } else this.outMarker.style.display = "none";
        } else {
            this.rangeHighlight.style.display = "none";
            this.inMarker.style.display = "none";
            this.outMarker.style.display = "none";
        }
    }

    deleteData() {
        if (!this.videoEl || this.currentFrameIndex === null) return;
        const totalFrames = Math.round(this.videoEl.duration * 30);

        let start = this.markInFrame != null ? this.markInFrame : this.currentFrameIndex;
        let end = this.markOutFrame != null ? this.markOutFrame : this.currentFrameIndex;
        if (start > end) { let temp = start; start = end; end = temp; }

        let paddedStart = Math.max(0, start - 10);
        let paddedEnd = Math.min(totalFrames, end + 10);

        for (let f = paddedStart; f <= paddedEnd; f++) {
            if (this.motionData[f] && this.motionData[f].bones) {
                let targetBones = Object.keys(this.motionData[f].bones);
                if (this.selectedMpIdx && this.markInFrame == null && this.markOutFrame == null) {
                    targetBones = [this.selectedMpIdx];
                }

                targetBones.forEach(mpIdx => {
                    let bDat = this.motionData[f].bones[mpIdx];
                    if (bDat) {
                        if (f >= start && f <= end) bDat.isManual = false;

                        bDat.isBlended = false;
                        if (bDat.baseX !== undefined) {
                            bDat.x = bDat.baseX; bDat.y = bDat.baseY; bDat.z = bDat.baseZ;
                            if (bDat.baseW !== undefined) bDat.w = bDat.baseW;
                        }
                    }
                    if (mpIdx == 99 && this.motionData[f].hipsPos) {
                        let hDat = this.motionData[f].hipsPos;
                        if (f >= start && f <= end) hDat.isManual = false;
                        hDat.isBlended = false;
                        if (hDat.baseX !== undefined) {
                            hDat.x = hDat.baseX; hDat.y = hDat.baseY; hDat.z = hDat.baseZ;
                        }
                    }
                });

                let anyManual = false;
                for (let key in this.motionData[f].bones) {
                    if (this.motionData[f].bones[key].isManual) anyManual = true;
                }
                this.motionData[f].hasManualEdits = anyManual;
            }
        }

        for (let f = paddedStart - 10; f <= paddedEnd + 10; f++) {
            if (this.motionData[f] && this.motionData[f].bones) {
                let targetBones = this.selectedMpIdx && this.markInFrame == null && this.markOutFrame == null ? [this.selectedMpIdx] : Object.keys(this.motionData[f].bones);
                targetBones.forEach(mpIdx => {
                    if (this.motionData[f].bones[mpIdx] && this.motionData[f].bones[mpIdx].isManual) {
                        this.performBlendAt(f, mpIdx);
                    }
                });
            }
        }

        this.markInFrame = null;
        this.markOutFrame = null;
        this.updateRangeHighlight();
        this.updateTimelineTicks();
        this.lastOnionFrame = -1;
    }

    syncCamera() {
        if (!this.videoEl || !this.videoEl.videoWidth) return;

        const vw = this.videoEl.videoWidth;
        const vh = this.videoEl.videoHeight;
        const videoAspect = vw / vh;

        const cw = this.container.clientWidth;
        const ch = this.container.clientHeight;
        const containerAspect = cw / ch;

        let renderWidth, renderHeight;

        if (containerAspect > videoAspect) {
            renderHeight = ch;
            renderWidth = ch * videoAspect;
        } else {
            renderWidth = cw;
            renderHeight = cw / videoAspect;
        }

        this.canvasWrap.style.width = `${renderWidth}px`;
        this.canvasWrap.style.height = `${renderHeight}px`;

        this.renderer.setSize(renderWidth, renderHeight, false);

        this.debugCanvas.width = renderWidth;
        this.debugCanvas.height = renderHeight;

        this.camera.aspect = videoAspect;
        this.camera.updateProjectionMatrix();

        if (this.poseLandmarker && this.baseRigShoulderWidth > 0) {
            let targetPose = this.currentPose;
            if (!targetPose && this.videoEl.readyState >= 2) {
                try {
                    this.mpClock += 33.333;
                    let nextTimestamp = Math.floor(this.mpClock);
                    if (this.lastMpTimestamp !== undefined && nextTimestamp <= this.lastMpTimestamp) {
                        nextTimestamp = this.lastMpTimestamp + 1;
                    }
                    this.lastMpTimestamp = nextTimestamp;

                    if (!this.processCanvas) {
                        this.processCanvas = document.createElement("canvas");
                    }
                    if (this.processCanvas.width !== this.videoEl.videoWidth || this.processCanvas.height !== this.videoEl.videoHeight) {
                        this.processCanvas.width = this.videoEl.videoWidth || 640;
                        this.processCanvas.height = this.videoEl.videoHeight || 480;
                    }
                    const pCtx = this.processCanvas.getContext('2d', { willReadFrequently: true });
                    pCtx.drawImage(this.videoEl, 0, 0, this.processCanvas.width, this.processCanvas.height);

                    targetPose = this.poseLandmarker.detectForVideo(this.processCanvas, nextTimestamp);
                } catch (e) { console.error("Camera Sync MP Error:", e); }
            }

            if (targetPose && targetPose.landmarks && targetPose.landmarks.length > 0) {
                const rawPose = targetPose.landmarks[0];
                const l2D = rawPose[11];
                const r2D = rawPose[12];

                if (l2D && r2D) {
                    const dx_norm = (r2D.x - l2D.x) * videoAspect;
                    const dy_norm = (r2D.y - l2D.y);
                    const mpShoulderDistance = Math.hypot(dx_norm, dy_norm);

                    const dx_px = (r2D.x - l2D.x) * renderWidth;
                    const dy_px = (r2D.y - l2D.y) * renderHeight;
                    const shoulderDistancePixels = Math.hypot(dx_px, dy_px);

                    const distance = Math.abs(this.camera.position.z);
                    const currentRigWidth = this.baseRigShoulderWidth * this.rigScale;

                    if (mpShoulderDistance > 0.001) {
                        const tanFovOver2 = currentRigWidth / (mpShoulderDistance * 2 * distance);
                        const fovRad = 2 * Math.atan(tanFovOver2);

                        this.camera.fov = this.THREE.MathUtils.radToDeg(fovRad);
                        this.camera.updateProjectionMatrix();
                    }
                }
            }
        }
    }

    onResize() {
        if (!this.renderer || !this.camera) return;

        if (this.videoEl && this.videoEl.videoWidth) {
            this.syncCamera();
        } else {
            const w = this.container.clientWidth;
            const h = this.container.clientHeight;
            this.canvasWrap.style.width = `100%`;
            this.canvasWrap.style.height = `100%`;
            this.renderer.setSize(w, h, false);
            if (this.debugCanvas) {
                this.debugCanvas.width = w;
                this.debugCanvas.height = h;
            }
            this.camera.aspect = w / h;
            this.camera.updateProjectionMatrix();
        }
    }

    filterLandmarks(landmarks, filtersArray, timestamp, customCutoff = this.filterMinCutoff, customBeta = this.filterBeta) {
        if (!landmarks) return null;

        if (customCutoff === -1) {
            return landmarks.map(lm => ({
                x: lm.x, y: lm.y, z: lm.z,
                visibility: lm.visibility !== undefined ? lm.visibility : 1.0
            }));
        }

        let smoothed = [];
        for (let i = 0; i < landmarks.length; i++) {
            let lm = landmarks[i];
            if (!lm) continue;

            if (!filtersArray[i]) {
                filtersArray[i] = new OneEuroFilter3D(30);
            }

            let f = filtersArray[i].filter({ x: lm.x, y: lm.y, z: lm.z }, timestamp, customCutoff, customBeta);

            smoothed[i] = {
                x: f.x,
                y: f.y,
                z: f.z,
                visibility: lm.visibility !== undefined ? lm.visibility : 1.0
            };
        }
        return smoothed;
    }

    getMappedPose(pose) {
        if (!pose) return null;
        const mapped = [];
        for (let i = 0; i < pose.length; i++) {
            let lm = pose[i];
            if (!lm) continue;
            mapped[i] = { x: lm.x, y: lm.y, z: lm.z, visibility: lm.visibility };
        }
        return mapped;
    }

    getRaycast3D(pose, index1, index2 = null) {
        if (!pose || !pose[index1]) return null;
        let x = pose[index1].x;
        let y = pose[index1].y;
        let vis = pose[index1].visibility;

        if (index2 !== null && pose[index2]) {
            x = (x + pose[index2].x) / 2;
            y = (y + pose[index2].y) / 2;
            vis = Math.min(vis, pose[index2].visibility);
        }

        if (vis < this.confidenceThreshold) return null;
        if (isNaN(x) || isNaN(y)) return null;

        const ndcX = (x * 2) - 1;
        const ndcY = -(y * 2) + 1;

        this.raycaster.setFromCamera(new this.THREE.Vector2(ndcX, ndcY), this.camera);

        const target3D = new this.THREE.Vector3();
        if (this.raycaster.ray.intersectPlane(this.zPlane, target3D)) {
            if (!isNaN(target3D.x) && !isNaN(target3D.y) && !isNaN(target3D.z)) {
                target3D.z = 0;
                return target3D;
            }
        }
        return null;
    }

    getDirectionVector(p1, p2, forwardHintMag = 0, flattenZ = false, torsoForward = null) {
        if (!p1 || !p2) return null;
        if (p1.visibility !== undefined && (p1.visibility < this.confidenceThreshold || p2.visibility < this.confidenceThreshold)) return null;

        const dx = (p2.x - p1.x);
        const dy = -(p2.y - p1.y);
        let dz = -(p2.z - p1.z);

        if (flattenZ) dz = 0;

        const dir = new this.THREE.Vector3(dx, dy, dz).normalize();

        if (isNaN(dir.x) || isNaN(dir.y) || isNaN(dir.z)) return null;

        if (forwardHintMag !== 0) {
            if (torsoForward) {
                dir.addScaledVector(torsoForward, forwardHintMag);
            } else {
                dir.z += forwardHintMag;
            }

            dir.normalize();
            if (isNaN(dir.x) || isNaN(dir.y) || isNaN(dir.z)) return null;
        }
        return dir;
    }

    boneLookAtDir(mpIdx, bone, dirVector, timestamp, customUp = null, pitchOffset = Math.PI / 2, rollOffset = 0) {
        if (!bone) return;

        if (!this.boneFilters[mpIdx]) {
            this.boneFilters[mpIdx] = new OneEuroFilterQuat(30);
        }

        if (!bone.userData.restQuaternion) {
            bone.userData.restQuaternion = bone.quaternion.clone();
        }

        if (!dirVector) {
            bone.quaternion.slerp(bone.userData.restQuaternion, 0.05);
            bone.updateMatrixWorld(true);
            return;
        }

        const targetPos = new this.THREE.Vector3();
        bone.getWorldPosition(targetPos);
        targetPos.add(dirVector);

        if (customUp) {
            bone.up.copy(customUp);
        } else {
            bone.up.set(0, 1, 0);
        }

        bone.lookAt(targetPos);
        if (pitchOffset !== 0) bone.rotateX(pitchOffset);
        if (rollOffset !== 0) bone.rotateY(rollOffset);

        const targetQuat = bone.quaternion.clone();

        if (isNaN(targetQuat.x) || isNaN(targetQuat.y) || isNaN(targetQuat.z) || isNaN(targetQuat.w)) return;

        let fq = this.boneFilters[mpIdx].filter(targetQuat, timestamp, this.filterMinCutoff, this.filterBeta);

        if (isNaN(fq.x)) {
            this.boneFilters[mpIdx] = new OneEuroFilterQuat(30);
            return;
        }

        const existingData = this.currentFrameIndex !== null && this.motionData[this.currentFrameIndex] && this.motionData[this.currentFrameIndex].bones ? this.motionData[this.currentFrameIndex].bones[mpIdx] : null;
        const isProtected = existingData && (existingData.isManual || existingData.isBlended);

        if (isProtected) {
            bone.quaternion.set(existingData.x, existingData.y, existingData.z, existingData.w).normalize();
        } else {
            bone.quaternion.set(fq.x, fq.y, fq.z, fq.w).normalize();

            if (this.currentFrameIndex !== null && this.motionData[this.currentFrameIndex]) {
                this.motionData[this.currentFrameIndex].bones[mpIdx] = {
                    x: bone.quaternion.x, y: bone.quaternion.y, z: bone.quaternion.z, w: bone.quaternion.w,
                    rawX: targetQuat.x, rawY: targetQuat.y, rawZ: targetQuat.z, rawW: targetQuat.w,
                    isManual: false
                };
            }
        }

        bone.updateMatrixWorld(true);
    }

    boneSwingAtDir(mpIdx, bone, dirVector, timestamp, customCutoff = this.filterMinCutoff, customBeta = this.filterBeta) {
        if (!bone || !dirVector) return;

        if (!this.boneFilters[mpIdx]) {
            this.boneFilters[mpIdx] = new OneEuroFilterQuat(30);
        }
        if (!bone.userData.restQuaternion) {
            bone.userData.restQuaternion = bone.quaternion.clone();
        }

        bone.quaternion.copy(bone.userData.restQuaternion);
        bone.updateMatrixWorld(true);

        let currentGlobalQ = new this.THREE.Quaternion();
        bone.getWorldQuaternion(currentGlobalQ);
        let fwd = new this.THREE.Vector3(0, 1, 0).applyQuaternion(currentGlobalQ).normalize();

        let targetDir = dirVector.clone().normalize();

        let swing = new this.THREE.Quaternion().setFromUnitVectors(fwd, targetDir);

        let targetGlobalQ = swing.multiply(currentGlobalQ);

        let parentGlobalQ = new this.THREE.Quaternion();
        if (bone.parent) {
            bone.parent.getWorldQuaternion(parentGlobalQ);
        }
        let targetLocalQ = parentGlobalQ.invert().multiply(targetGlobalQ);

        let fq;
        if (customCutoff === -1) {
            fq = { x: targetLocalQ.x, y: targetLocalQ.y, z: targetLocalQ.z, w: targetLocalQ.w };
        } else {
            fq = this.boneFilters[mpIdx].filter(targetLocalQ, timestamp, customCutoff, customBeta);
        }

        if (!isNaN(fq.x)) {
            const existingData = this.currentFrameIndex !== null && this.motionData[this.currentFrameIndex] && this.motionData[this.currentFrameIndex].bones ? this.motionData[this.currentFrameIndex].bones[mpIdx] : null;
            const isProtected = existingData && (existingData.isManual || existingData.isBlended);

            if (isProtected) {
                bone.quaternion.set(existingData.x, existingData.y, existingData.z, existingData.w).normalize();
            } else {
                bone.quaternion.set(fq.x, fq.y, fq.z, fq.w).normalize();

                if (this.currentFrameIndex !== null && this.motionData[this.currentFrameIndex]) {
                    this.motionData[this.currentFrameIndex].bones[mpIdx] = {
                        x: bone.quaternion.x, y: bone.quaternion.y, z: bone.quaternion.z, w: bone.quaternion.w,
                        rawX: targetLocalQ.x, rawY: targetLocalQ.y, rawZ: targetLocalQ.z, rawW: targetLocalQ.w,
                        isManual: false
                    };
                }
            }
        }
        bone.updateMatrixWorld(true);
    }

    extractFaceData(face, w, h) {
        const toVec3 = (mpPoint) => new this.THREE.Vector3(mpPoint.x * w, mpPoint.y * h, mpPoint.z * w);
        const pLeft = toVec3(face[234]);
        const pRight = toVec3(face[454]);
        const pTop = toVec3(face[10]);
        const pNoseBridge = toVec3(face[168]);
        const pOrigin = toVec3(face[1]);

        const xAxis = new this.THREE.Vector3().subVectors(pRight, pLeft).normalize();
        const yAxisTmp = new this.THREE.Vector3().subVectors(pNoseBridge, pTop).normalize();
        const zAxis = new this.THREE.Vector3().crossVectors(xAxis, yAxisTmp).normalize();
        const yAxis = new this.THREE.Vector3().crossVectors(zAxis, xAxis).normalize();

        const faceMatrixInv = new this.THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis).invert();

        return this.MP_FACE_INDICES.map(idx => {
            const p = toVec3(face[idx]);
            p.sub(pOrigin);
            p.applyMatrix4(faceMatrixInv);
            return { x: p.x, y: p.y, z: p.z };
        });
    }

    bonePositionDelta(mpIdx, bone, dx, dy, dz, timestamp, customCutoff = this.filterMinCutoff, customBeta = this.filterBeta) {
        if (!bone) return;

        if (!this.boneFilters[mpIdx]) {
            this.boneFilters[mpIdx] = new OneEuroFilter3D(30);
        }

        let targetPos = bone.userData.restPosition.clone().add(new this.THREE.Vector3(dx, dy, dz));

        let fPos;
        if (customCutoff === -1) {
            fPos = { x: targetPos.x, y: targetPos.y, z: targetPos.z };
        } else {
            fPos = this.boneFilters[mpIdx].filter(targetPos, timestamp, customCutoff, customBeta);
        }

        if (!isNaN(fPos.x)) {
            const existingData = this.currentFrameIndex !== null && this.motionData[this.currentFrameIndex] && this.motionData[this.currentFrameIndex].bones ? this.motionData[this.currentFrameIndex].bones[mpIdx] : null;
            const isProtected = existingData && (existingData.isManual || existingData.isBlended);

            if (isProtected) {
                bone.position.set(existingData.posX, existingData.posY, existingData.posZ);
            } else {
                bone.position.set(fPos.x, fPos.y, fPos.z);

                if (this.currentFrameIndex !== null && this.motionData[this.currentFrameIndex]) {
                    if (!this.motionData[this.currentFrameIndex].bones) this.motionData[this.currentFrameIndex].bones = {};
                    this.motionData[this.currentFrameIndex].bones[mpIdx] = {
                        posX: fPos.x, posY: fPos.y, posZ: fPos.z,
                        rawX: targetPos.x, rawY: targetPos.y, rawZ: targetPos.z,
                        isManual: false
                    };
                }
            }
        }

        bone.updateMatrixWorld(true);
    }

    // --- TIMESTAMP MANAGEMENT ---
    _resetMpTimestamps() {
        // Reset the synthetic monotonic clock so MediaPipe doesn't get stale/backwards timestamps
        this.mpClock = 0;
        this.lastMpTimestamp = undefined;
        this.lastVideoTimeMs = -1;
        this._lastProcessedVideoTimeMs = -1;
        this._mpNeedsRestart = false;
        this._trackingInFlight = false;
        this._pendingPose = null;
        this._pendingHands = null;
        this._pendingFace = null;
    }

    // --- ASYNC MEDIAPIPE INFERENCE (decoupled from render loop) ---
    async processTrackingFrame(videoEl, currentTimeMs) {
        // Guard: don't overlap inference calls
        if (this._trackingInFlight) return;
        if (!this.poseLandmarker || !videoEl || videoEl.readyState < 2) return;

        // Guard: don't re-process the same video frame
        if (currentTimeMs === this._lastProcessedVideoTimeMs) return;

        this._trackingInFlight = true;
        this._lastProcessedVideoTimeMs = currentTimeMs;

        try {
            // Recovery: if MP crashed previously, reset the clock
            if (this._mpNeedsRestart) {
                this._resetMpTimestamps();
            }

            // Build a monotonically increasing timestamp for MediaPipe
            let delta = 33.333;
            if (this.lastVideoTimeMs >= 0) {
                delta = currentTimeMs - this.lastVideoTimeMs;
                if (delta <= 0) delta = 33.333;
            }
            this.mpClock += delta;
            this.lastVideoTimeMs = currentTimeMs;

            let nextTimestamp = Math.floor(this.mpClock);
            if (this.lastMpTimestamp !== undefined && nextTimestamp <= this.lastMpTimestamp) {
                nextTimestamp = this.lastMpTimestamp + 1;
            }
            this.lastMpTimestamp = nextTimestamp;
            const mpTimestamp = nextTimestamp;

            // Prepare the processing canvas
            if (!this.processCanvas) {
                this.processCanvas = document.createElement("canvas");
            }
            if (this.processCanvas.width !== videoEl.videoWidth || this.processCanvas.height !== videoEl.videoHeight) {
                this.processCanvas.width = videoEl.videoWidth || 640;
                this.processCanvas.height = videoEl.videoHeight || 480;
            }
            const pCtx = this.processCanvas.getContext('2d', { willReadFrequently: true });
            pCtx.drawImage(videoEl, 0, 0, this.processCanvas.width, this.processCanvas.height);

            // Run MediaPipe inference (this is the expensive part)
            let poseResult = null, handResult = null, faceResult = null;

            try {
                poseResult = this.poseLandmarker.detectForVideo(this.processCanvas, mpTimestamp);
            } catch (e) {
                console.error("[Mocap Surgeon] MediaPipe Pose Inference crashed:", e);
                this._mpNeedsRestart = true;
            }

            if (!this._mpNeedsRestart && this.trackHands && this.handLandmarker) {
                try { handResult = this.handLandmarker.detectForVideo(this.processCanvas, mpTimestamp); } catch (e) {
                    console.warn("[Mocap Surgeon] Hand inference error:", e);
                }
            }

            if (!this._mpNeedsRestart && this.trackFace && this.faceLandmarker) {
                try { faceResult = this.faceLandmarker.detectForVideo(this.processCanvas, mpTimestamp); } catch (e) {
                    console.warn("[Mocap Surgeon] Face inference error:", e);
                }
            }

            // Stage results for the next render frame to pick up
            this._pendingPose = poseResult;
            this._pendingHands = handResult;
            this._pendingFace = faceResult;
            this._pendingTimestamp = videoEl.currentTime;

        } catch (e) {
            console.error("[Mocap Surgeon] processTrackingFrame error:", e);
            this._mpNeedsRestart = true;
        } finally {
            this._trackingInFlight = false;
        }
    }

    _interpolateFrames(frameA, frameB, t) {
        let result = { hipsPos: null, bones: {}, hasManualEdits: false };

        if (frameA.hipsPos && frameB.hipsPos) {
            result.hipsPos = {
                x: this.THREE.MathUtils.lerp(frameA.hipsPos.x, frameB.hipsPos.x, t),
                y: this.THREE.MathUtils.lerp(frameA.hipsPos.y, frameB.hipsPos.y, t),
                z: this.THREE.MathUtils.lerp(frameA.hipsPos.z, frameB.hipsPos.z, t)
            };
        }

        for (let mpIdx in frameA.bones) {
            if (frameB.bones[mpIdx]) {
                let bA = frameA.bones[mpIdx];
                let bB = frameB.bones[mpIdx];

                if (parseInt(mpIdx) >= 300 && parseInt(mpIdx) <= 369) {
                    // Face positional deltas
                    if (bA.posX !== undefined && bB.posX !== undefined) {
                        result.bones[mpIdx] = {
                            posX: this.THREE.MathUtils.lerp(bA.posX, bB.posX, t),
                            posY: this.THREE.MathUtils.lerp(bA.posY, bB.posY, t),
                            posZ: this.THREE.MathUtils.lerp(bA.posZ, bB.posZ, t)
                        };
                    }
                } else {
                    // Rotations
                    if (bA.x !== undefined && bB.x !== undefined) {
                        let qA = new this.THREE.Quaternion(bA.x, bA.y, bA.z, bA.w);
                        let qB = new this.THREE.Quaternion(bB.x, bB.y, bB.z, bB.w);
                        let qRes = new this.THREE.Quaternion().slerpQuaternions(qA, qB, t);

                        result.bones[mpIdx] = { x: qRes.x, y: qRes.y, z: qRes.z, w: qRes.w };
                    }
                }
            }
        }
        return result;
    }

    animate() {
        if (!this.renderer) return;
        requestAnimationFrame(() => this.animate());

        let currentTimeSec = this.videoEl ? this.videoEl.currentTime : 0;
        this.currentFrameIndex = Math.round(currentTimeSec * 30);

        const isActivelyPlaying = this.videoEl && !this.videoEl.paused;
        const isRecordingPass = isActivelyPlaying && this.isRecordingMode && !this.isScrubbing;

        if (this.mixer && this.videoEl) {
            this.mixer.setTime(currentTimeSec);
        }

        if (this.controls) this.controls.update();

        const ctx = this.debugCanvas ? this.debugCanvas.getContext('2d') : null;
        if (ctx) ctx.clearRect(0, 0, this.debugCanvas.width, this.debugCanvas.height);

        // --- SCRUBBER & REC UI SYNC ---
        if (this.timelineSlider && !this.isScrubbing) {
            this.timelineSlider.value = currentTimeSec;
        }

        if (this.timeLabel) {
            const totalFrames = (this.videoEl && !isNaN(this.videoEl.duration)) ? Math.round(this.videoEl.duration * 30) : 0;
            let rangeText = "";
            if (this.markInFrame != null || this.markOutFrame != null) {
                let inF = this.markInFrame != null ? this.markInFrame : 0;
                let outF = this.markOutFrame != null ? this.markOutFrame : totalFrames;
                rangeText = `<span style="color:#00d2ff; font-weight:bold; margin-right:8px;">[ ${inF} ➔ ${outF} ]</span>`;
            }
            this.timeLabel.innerHTML = `${rangeText}${this.currentFrameIndex} / ${totalFrames} f`;
        }

        if (this.recordingIndicator) {
            this.recordingIndicator.style.display = (isRecordingPass) ? "block" : "none";
        }

        let isEditedFrame = false;
        if (this.currentFrameIndex !== null && this.motionData[this.currentFrameIndex]) {
            isEditedFrame = this.motionData[this.currentFrameIndex].hasManualEdits;
        }
        if (this.editedIndicator) {
            this.editedIndicator.style.display = (!isRecordingPass && isEditedFrame) ? "block" : "none";
        }

        if (isActivelyPlaying && this.transformControls && this.transformControls.object) {
            this.transformControls.detach();
            this.selectedMpIdx = null;
        }

        const confThresh = this.confidenceThreshold;

        // --- MASTER SYSTEM TOGGLE: RECORD VS SCRUB/REVIEW ---
        if (isRecordingPass) {

            if (!this.motionData[this.currentFrameIndex]) {
                this.motionData[this.currentFrameIndex] = { hipsPos: null, bones: {}, hasManualEdits: false };
            }

            // --- RAYCAST MOCAP ENGINE (RECORDING) ---
            if (this.poseLandmarker && this.videoEl && this.videoEl.readyState >= 2) {
                let currentTimeMs = currentTimeSec * 1000;
                let isNewVideoFrame = (currentTimeMs !== this.lastVideoTimeMs);

                // SYNCHRONOUS LOCK: Only process exactly when the video frame updates
                if (isNewVideoFrame) {
                    this.lastVideoTimeMs = currentTimeMs;

                    // 1. BULLETPROOF TIMESTAMP: Prevent MediaPipe crashing on loops
                    let mpTimestamp = performance.now();
                    if (this.lastMpTimestamp !== undefined && mpTimestamp <= this.lastMpTimestamp) {
                        mpTimestamp = this.lastMpTimestamp + 0.1;
                    }
                    this.lastMpTimestamp = mpTimestamp;

                    try {
                        // FORCE SYNCHRONOUS INFERENCE: Blocks render until AI finishes
                        this.currentPose = this.poseLandmarker.detectForVideo(this.videoEl, mpTimestamp);
                    } catch (e) {
                        console.error("[Mocap Surgeon] MediaPipe Crash:", e);
                        this.isRecordingMode = false;
                        this.updatePlayState(false);
                        this.videoEl.pause();
                        return;
                    }

                    if (this.trackHands && this.handLandmarker) {
                        try { this.currentHands = this.handLandmarker.detectForVideo(this.videoEl, mpTimestamp); } catch (e) { }
                    } else { this.currentHands = null; }

                    if (this.trackFace && this.faceLandmarker) {
                        try { this.currentFace = this.faceLandmarker.detectForVideo(this.videoEl, mpTimestamp); } catch (e) { }
                    } else { this.currentFace = null; }

                    if (this.currentPose && this.currentPose.landmarks && this.currentPose.landmarks.length > 0) {
                        const rawPose = this.currentPose.landmarks[0];
                        const rawWorldPose = this.currentPose.worldLandmarks && this.currentPose.worldLandmarks[0];

                        // PERFECT dt SYNC: Send the exact Video Time to the 1-Euro Filters
                        this.smoothedPose2D = this.filterLandmarks(rawPose, this.pose2DFilters, currentTimeSec);
                        const smoothedWorldPose = this.filterLandmarks(rawWorldPose, this.poseWorldFilters, currentTimeSec);

                        const pose = this.getMappedPose(this.smoothedPose2D);
                        const worldPose = this.getMappedPose(smoothedWorldPose);

                        const hips3D = this.upperBodyOnly ? null : this.getRaycast3D(pose, 23, 24);
                        const hipsBone = this.mocapBones[99];
                        if (hipsBone) {
                            if (!hipsBone.userData.restPosition) hipsBone.userData.restPosition = hipsBone.position.clone();

                            const existingHips = this.motionData[this.currentFrameIndex] ? this.motionData[this.currentFrameIndex].hipsPos : null;
                            const isHipsProtected = existingHips && (existingHips.isManual || existingHips.isBlended);

                            if (this.upperBodyOnly) {
                                if (isHipsProtected) {
                                    hipsBone.position.set(existingHips.x, existingHips.y, existingHips.z);
                                } else {
                                    hipsBone.position.copy(hipsBone.userData.restPosition);
                                    this.motionData[this.currentFrameIndex].hipsPos = {
                                        x: hipsBone.position.x, y: hipsBone.position.y, z: hipsBone.position.z,
                                        rawX: hipsBone.position.x, rawY: hipsBone.position.y, rawZ: hipsBone.position.z,
                                        isManual: false
                                    };
                                }
                            } else if (hips3D) {
                                if (hipsBone.parent) {
                                    hipsBone.parent.updateMatrixWorld(true);
                                    hipsBone.parent.worldToLocal(hips3D);
                                }
                                if (!this.hipsPosFilter) this.hipsPosFilter = new OneEuroFilter3D(30);
                                let fPos = this.hipsPosFilter.filter(hips3D, currentTimeSec, this.filterMinCutoff, this.filterBeta);

                                if (!isNaN(fPos.x)) {
                                    if (isHipsProtected) {
                                        hipsBone.position.set(existingHips.x, existingHips.y, existingHips.z);
                                    } else {
                                        hipsBone.position.set(fPos.x, fPos.y, fPos.z);
                                        this.motionData[this.currentFrameIndex].hipsPos = {
                                            x: fPos.x, y: fPos.y, z: fPos.z,
                                            rawX: hips3D.x, rawY: hips3D.y, rawZ: hips3D.z,
                                            isManual: false
                                        };
                                    }
                                }
                            } else {
                                if (isHipsProtected) {
                                    hipsBone.position.set(existingHips.x, existingHips.y, existingHips.z);
                                } else {
                                    hipsBone.position.lerp(hipsBone.userData.restPosition, 0.05);
                                }
                            }

                            if (this.upperBodyOnly) {
                                let yaw = 0;
                                if (worldPose && worldPose[11] && worldPose[12]) {
                                    const dx = worldPose[12].x - worldPose[11].x;
                                    const dz = -(worldPose[12].z - worldPose[11].z);
                                    yaw = -Math.atan2(dz, dx);
                                }
                                const yawQuat = new this.THREE.Quaternion().setFromAxisAngle(new this.THREE.Vector3(0, 1, 0), yaw);
                                const targetQuat = hipsBone.userData.restQuaternion.clone().premultiply(yawQuat);

                                if (!this.boneFilters[99]) this.boneFilters[99] = new OneEuroFilterQuat(30);
                                let fq = this.boneFilters[99].filter(targetQuat, currentTimeSec, this.filterMinCutoff, this.filterBeta);

                                if (!isNaN(fq.x)) {
                                    const existingB99 = this.motionData[this.currentFrameIndex] && this.motionData[this.currentFrameIndex].bones ? this.motionData[this.currentFrameIndex].bones[99] : null;
                                    const isB99Protected = existingB99 && (existingB99.isManual || existingB99.isBlended);

                                    if (isB99Protected) {
                                        hipsBone.quaternion.set(existingB99.x, existingB99.y, existingB99.z, existingB99.w).normalize();
                                    } else {
                                        hipsBone.quaternion.set(fq.x, fq.y, fq.z, fq.w).normalize();
                                        this.motionData[this.currentFrameIndex].bones[99] = {
                                            x: fq.x, y: fq.y, z: fq.z, w: fq.w,
                                            rawX: targetQuat.x, rawY: targetQuat.y, rawZ: targetQuat.z, rawW: targetQuat.w,
                                            isManual: false
                                        };
                                    }
                                }
                            } else if (worldPose && worldPose[23] && worldPose[24]) {
                                const dx = worldPose[24].x - worldPose[23].x;
                                const dz = -(worldPose[24].z - worldPose[23].z);
                                const yaw = -Math.atan2(dz, dx);
                                const yawQuat = new this.THREE.Quaternion().setFromAxisAngle(new this.THREE.Vector3(0, 1, 0), yaw);
                                const targetQuat = hipsBone.userData.restQuaternion.clone().premultiply(yawQuat);

                                if (!this.boneFilters[99]) this.boneFilters[99] = new OneEuroFilterQuat(30);
                                let fq = this.boneFilters[99].filter(targetQuat, currentTimeSec, this.filterMinCutoff, this.filterBeta);

                                if (!isNaN(fq.x)) {
                                    const existingB99 = this.motionData[this.currentFrameIndex] && this.motionData[this.currentFrameIndex].bones ? this.motionData[this.currentFrameIndex].bones[99] : null;
                                    const isB99Protected = existingB99 && (existingB99.isManual || existingB99.isBlended);

                                    if (isB99Protected) {
                                        hipsBone.quaternion.set(existingB99.x, existingB99.y, existingB99.z, existingB99.w).normalize();
                                    } else {
                                        hipsBone.quaternion.set(fq.x, fq.y, fq.z, fq.w).normalize();
                                        this.motionData[this.currentFrameIndex].bones[99] = {
                                            x: fq.x, y: fq.y, z: fq.z, w: fq.w,
                                            rawX: targetQuat.x, rawY: targetQuat.y, rawZ: targetQuat.z, rawW: targetQuat.w,
                                            isManual: false
                                        };
                                    }
                                }
                            } else {
                                const existingB99 = this.motionData[this.currentFrameIndex] && this.motionData[this.currentFrameIndex].bones ? this.motionData[this.currentFrameIndex].bones[99] : null;
                                const isB99Protected = existingB99 && (existingB99.isManual || existingB99.isBlended);

                                if (isB99Protected) {
                                    hipsBone.quaternion.set(existingB99.x, existingB99.y, existingB99.z, existingB99.w).normalize();
                                } else {
                                    hipsBone.quaternion.slerp(hipsBone.userData.restQuaternion, 0.1);
                                }
                            }
                            hipsBone.updateMatrixWorld(true);
                        }

                        if (worldPose && this.rig) {
                            try {
                                const FORWARD = new this.THREE.Vector3(0, 0, 1).transformDirection(this.rig.matrixWorld);
                                let spineDir = null;
                                let torsoForward = FORWARD;

                                if (worldPose[11] && worldPose[12]) {
                                    const shoulderMid = {
                                        x: (worldPose[11].x + worldPose[12].x) / 2,
                                        y: (worldPose[11].y + worldPose[12].y) / 2,
                                        z: (worldPose[11].z + worldPose[12].z) / 2,
                                        visibility: Math.min(worldPose[11].visibility, worldPose[12].visibility)
                                    };

                                    if (this.upperBodyOnly) {
                                        spineDir = new this.THREE.Vector3(0, 1, 0);

                                        let shoulderLeft = this.getDirectionVector(worldPose[12], worldPose[11]);
                                        if (shoulderLeft) {
                                            shoulderLeft.y = 0;
                                            shoulderLeft.normalize();
                                            torsoForward = new this.THREE.Vector3().crossVectors(shoulderLeft, spineDir).normalize();
                                            if (isNaN(torsoForward.x)) torsoForward = FORWARD;
                                        }
                                    } else if (worldPose[23] && worldPose[24]) {
                                        const hipMid = {
                                            x: (worldPose[23].x + worldPose[24].x) / 2,
                                            y: (worldPose[23].y + worldPose[24].y) / 2,
                                            z: (worldPose[23].z + worldPose[24].z) / 2,
                                            visibility: Math.min(worldPose[23].visibility, worldPose[24].visibility)
                                        };
                                        spineDir = this.getDirectionVector(hipMid, shoulderMid);
                                        const hipLeft = this.getDirectionVector(worldPose[24], worldPose[23]);
                                        if (hipLeft && spineDir && hipLeft.lengthSq() > 0.001) {
                                            torsoForward = new this.THREE.Vector3().crossVectors(hipLeft, spineDir).normalize();
                                            if (isNaN(torsoForward.x)) torsoForward = FORWARD;
                                        }
                                    }
                                }

                                const torsoBackward = torsoForward.clone().negate();

                                this.boneLookAtDir(901, this.mocapBones[901], spineDir, currentTimeSec, torsoBackward);
                                this.boneLookAtDir(902, this.mocapBones[902], spineDir, currentTimeSec, torsoBackward);
                                this.boneLookAtDir(903, this.mocapBones[903], spineDir, currentTimeSec, torsoBackward);

                                const leftRoll = -Math.PI / 2;
                                const rightRoll = Math.PI / 2;

                                this.boneLookAtDir(11, this.mocapBones[11], this.getDirectionVector(worldPose[11], worldPose[13], 0, false, torsoForward), currentTimeSec, torsoForward, Math.PI / 2, leftRoll);
                                this.boneLookAtDir(12, this.mocapBones[12], this.getDirectionVector(worldPose[12], worldPose[14], 0, false, torsoForward), currentTimeSec, torsoForward, Math.PI / 2, rightRoll);
                                this.boneLookAtDir(13, this.mocapBones[13], this.getDirectionVector(worldPose[13], worldPose[15], 0, false, torsoForward), currentTimeSec, torsoForward, Math.PI / 2, leftRoll);
                                this.boneLookAtDir(14, this.mocapBones[14], this.getDirectionVector(worldPose[14], worldPose[16], 0, false, torsoForward), currentTimeSec, torsoForward, Math.PI / 2, rightRoll);

                                if (!this.trackHands) {
                                    this.boneLookAtDir(15, this.mocapBones[15], this.getDirectionVector(worldPose[15], worldPose[19], 0, false, torsoForward), currentTimeSec, torsoForward, Math.PI / 2, leftRoll);
                                    this.boneLookAtDir(16, this.mocapBones[16], this.getDirectionVector(worldPose[16], worldPose[20], 0, false, torsoForward), currentTimeSec, torsoForward, Math.PI / 2, rightRoll);
                                }

                                if (!this.upperBodyOnly) {
                                    this.boneLookAtDir(23, this.mocapBones[23], this.getDirectionVector(worldPose[23], worldPose[25], 0.3, false, torsoBackward), currentTimeSec, torsoBackward);
                                    this.boneLookAtDir(24, this.mocapBones[24], this.getDirectionVector(worldPose[24], worldPose[26], 0.3, false, torsoBackward), currentTimeSec, torsoBackward);
                                    this.boneLookAtDir(25, this.mocapBones[25], this.getDirectionVector(worldPose[25], worldPose[27], 0, false, torsoBackward), currentTimeSec, torsoBackward);
                                    this.boneLookAtDir(26, this.mocapBones[26], this.getDirectionVector(worldPose[26], worldPose[28], 0, false, torsoBackward), currentTimeSec, torsoBackward);

                                    this.boneLookAtDir(27, this.mocapBones[27], this.getDirectionVector(worldPose[27], worldPose[31], 1.0, false, torsoBackward), currentTimeSec, torsoBackward);
                                    this.boneLookAtDir(28, this.mocapBones[28], this.getDirectionVector(worldPose[28], worldPose[32], 1.0, false, torsoBackward), currentTimeSec, torsoBackward);
                                } else {
                                    [23, 24, 25, 26, 27, 28].forEach(idx => {
                                        const existingB = this.motionData[this.currentFrameIndex] && this.motionData[this.currentFrameIndex].bones ? this.motionData[this.currentFrameIndex].bones[idx] : null;
                                        const isBProtected = existingB && (existingB.isManual || existingB.isBlended);

                                        const b = this.mocapBones[idx];
                                        if (b && b.userData.restQuaternion) {
                                            if (isBProtected) {
                                                b.quaternion.set(existingB.x, existingB.y, existingB.z, existingB.w).normalize();
                                            } else {
                                                b.quaternion.copy(b.userData.restQuaternion);
                                                this.motionData[this.currentFrameIndex].bones[idx] = {
                                                    x: b.quaternion.x, y: b.quaternion.y, z: b.quaternion.z, w: b.quaternion.w,
                                                    rawX: b.quaternion.x, rawY: b.quaternion.y, rawZ: b.quaternion.z, rawW: b.quaternion.w,
                                                    isManual: false
                                                };
                                            }
                                        }
                                    });
                                }

                                if (worldPose[7] && worldPose[8] && worldPose[0]) {
                                    const earMid = {
                                        x: (worldPose[7].x + worldPose[8].x) / 2,
                                        y: (worldPose[7].y + worldPose[8].y) / 2,
                                        z: (worldPose[7].z + worldPose[8].z) / 2,
                                        visibility: Math.min(worldPose[7].visibility, worldPose[8].visibility)
                                    };

                                    const headZ = this.getDirectionVector(earMid, worldPose[0]);
                                    const headX = this.getDirectionVector(worldPose[8], worldPose[7]);

                                    let headUp = null;
                                    if (headZ && headX && headX.lengthSq() > 0.001) {
                                        headUp = new this.THREE.Vector3().crossVectors(headZ, headX).normalize();
                                    }
                                    this.boneLookAtDir(0, this.mocapBones[0], headZ, currentTimeSec, headUp, 0);
                                }
                            } catch (boneError) {
                                console.error("[Mocap Surgeon] Proxy Rotation Math Error:", boneError);
                            }
                        }
                        if (this.rig) this.rig.updateMatrixWorld(true);
                    }

                    if (this.trackHands && this.currentHands && this.currentHands.worldLandmarks && this.currentHands.worldLandmarks.length > 0) {
                        this.smoothedHands2D = [];

                        for (let h = 0; h < this.currentHands.worldLandmarks.length; h++) {
                            const rawHandWorldPose = this.currentHands.worldLandmarks[h];
                            const rawHand2DPose = this.currentHands.landmarks[h];
                            const handedness = this.currentHands.handednesses[h][0].categoryName;

                            const handWorldPose = this.filterLandmarks(rawHandWorldPose, this.handWorldFilters[handedness], currentTimeSec, 3, 0.0);
                            const hand2DPose = this.filterLandmarks(rawHand2DPose, this.hand2DFilters[handedness], currentTimeSec, 3, 0.0);

                            if (hand2DPose) this.smoothedHands2D.push(hand2DPose);

                            const isVisualLeft = handedness === "Left";
                            const wristBoneId = isVisualLeft ? 16 : 15;
                            const wristBone = this.mocapBones[wristBoneId];

                            if (wristBone && handWorldPose) {
                                const handForward = this.getDirectionVector(handWorldPose[0], handWorldPose[9]);
                                const indexDir = this.getDirectionVector(handWorldPose[0], handWorldPose[5]);
                                const pinkyDir = this.getDirectionVector(handWorldPose[0], handWorldPose[17]);

                                if (handForward && indexDir && pinkyDir) {
                                    let palmUp = new this.THREE.Vector3().crossVectors(indexDir, pinkyDir).normalize();
                                    if (isVisualLeft) palmUp.negate();

                                    this.boneLookAtDir(wristBoneId, wristBone, handForward, currentTimeSec, palmUp);
                                }
                            }

                            const dict = this.HAND_DICT[handedness];
                            if (dict && handWorldPose) {
                                for (let finger of dict) {
                                    const dir = this.getDirectionVector(handWorldPose[finger.p1], handWorldPose[finger.p2]);
                                    this.boneSwingAtDir(finger.id, this.mocapBones[finger.id], dir, currentTimeSec, 3.0, 0.0);
                                }
                            }
                        }
                    }

                    if (this.trackFace && this.currentFrameIndex > 2 && this.currentFace && this.currentFace.faceLandmarks && this.currentFace.faceLandmarks.length > 0) {
                        const currentFaceLm = this.currentFace.faceLandmarks[0];

                        this.smoothedFace2D = this.filterLandmarks(currentFaceLm, this.face2DFilters, currentTimeSec, -1.0, 0.0);

                        const vw = this.videoEl.videoWidth || 640;
                        const vh = this.videoEl.videoHeight || 480;

                        const localFace = this.extractFaceData(this.smoothedFace2D, vw, vh);

                        if (!this.baseFaceLandmarks && localFace) {
                            this.baseFaceLandmarks = localFace;
                        }

                        const rigL = this.mocapBones[300];
                        const rigR = this.mocapBones[316];
                        const rigChin = this.mocapBones[308];
                        const rigNose = this.mocapBones[327];

                        let scaleX = 1.0, scaleY = 1.0;

                        if (rigL && rigR && rigChin && rigNose && this.baseFaceLandmarks) {
                            const rigWidth = rigL.userData.restPosition.distanceTo(rigR.userData.restPosition) || 0.15;
                            const rigHeight = rigChin.userData.restPosition.distanceTo(rigNose.userData.restPosition) || 0.15;

                            const mpL = this.baseFaceLandmarks[0];
                            const mpR = this.baseFaceLandmarks[16];
                            const mpChin = this.baseFaceLandmarks[8];
                            const mpNose = this.baseFaceLandmarks[27];

                            const mpWidth = Math.hypot(mpR.x - mpL.x, mpR.y - mpL.y, mpR.z - mpL.z) || 1.0;
                            const mpHeight = Math.hypot(mpNose.x - mpChin.x, mpNose.y - mpChin.y, mpNose.z - mpChin.z) || 1.0;

                            scaleX = rigWidth / mpWidth;
                            scaleY = rigHeight / mpHeight;
                        }

                        if (localFace && this.baseFaceLandmarks) {
                            for (let i = 0; i < 70; i++) {
                                const mpIdx = this.MP_FACE_INDICES[i];
                                const baseLm = this.baseFaceLandmarks[i];
                                const currLm = localFace[i];

                                if (baseLm && currLm) {
                                    const dx = (currLm.x - baseLm.x) * scaleX;
                                    const dy = -(currLm.y - baseLm.y) * scaleY;
                                    const dz = -(currLm.z - baseLm.z) * scaleX;

                                    this.bonePositionDelta(300 + i, this.mocapBones[300 + i], dx, dy, dz, currentTimeSec, -1.0, 0.0);
                                }
                            }
                        }
                    }
                } // End of isNewVideoFrame block

                if (ctx && this.showMPPoints) {
                    const w = this.debugCanvas.width;
                    const h = this.debugCanvas.height;

                    if (this.smoothedPose2D && this.smoothedPose2D.length > 0) {
                        const pose = this.getMappedPose(this.smoothedPose2D);

                        ctx.lineWidth = 2;
                        ctx.strokeStyle = "rgba(0, 255, 0, 0.5)";
                        this.POSE_CONNECTIONS.forEach(([i, j]) => {
                            const p1 = pose[i];
                            const p2 = pose[j];
                            if (p1 && p2 && !isNaN(p1.x) && !isNaN(p2.x)) {
                                ctx.beginPath();
                                ctx.moveTo(p1.x * w, p1.y * h);
                                ctx.lineTo(p2.x * w, p2.y * h);
                                ctx.stroke();
                            }
                        });

                        pose.forEach((lm, idx) => {
                            if (this.MP_TO_MIXAMO[idx] && !isNaN(lm.x)) {
                                ctx.fillStyle = lm.visibility >= confThresh ? "#00ff00" : "#ff0000";
                                ctx.beginPath();
                                ctx.arc(lm.x * w, lm.y * h, 4, 0, 2 * Math.PI);
                                ctx.fill();
                            }
                        });
                    }

                    if (this.trackFace && this.smoothedFace2D && this.smoothedFace2D.length > 0) {
                        ctx.fillStyle = "white";
                        this.MP_FACE_INDICES.forEach(idx => {
                            const pt = this.smoothedFace2D[idx];
                            if (pt && !isNaN(pt.x)) {
                                ctx.beginPath();
                                ctx.arc(pt.x * w, pt.y * h, 2, 0, 2 * Math.PI);
                                ctx.fill();
                            }
                        });
                    }

                    if (this.trackHands && this.smoothedHands2D && this.smoothedHands2D.length > 0) {
                        ctx.fillStyle = "magenta";
                        this.smoothedHands2D.forEach(handLm => {
                            handLm.forEach(pt => {
                                if (pt && !isNaN(pt.x)) {
                                    ctx.beginPath();
                                    ctx.arc(pt.x * w, pt.y * h, 2, 0, 2 * Math.PI);
                                    ctx.fill();
                                }
                            });
                        });
                    }
                }
            }
        } else {
            // --- PLAYBACK / SCRUB MODE (BYPASS AI AND READ FROM MEMORY) ---
            if (this.currentFrameIndex !== this._lastPlaybackFrame) {
                this._lastPlaybackFrame = this.currentFrameIndex;
                let savedFrame = this.motionData[this.currentFrameIndex];

                // HOLE FILLING / INTERPOLATION
                if (!savedFrame && Object.keys(this.motionData).length > 0) {
                    let prevIdx = this.currentFrameIndex - 1;
                    while (prevIdx >= 0 && !this.motionData[prevIdx]) prevIdx--;

                    let nextIdx = this.currentFrameIndex + 1;
                    let maxIdx = Math.max(...Object.keys(this.motionData).map(Number));
                    while (nextIdx <= maxIdx && !this.motionData[nextIdx]) nextIdx++;

                    if (this.motionData[prevIdx] && this.motionData[nextIdx]) {
                        let t = (this.currentFrameIndex - prevIdx) / (nextIdx - prevIdx);
                        savedFrame = this._interpolateFrames(this.motionData[prevIdx], this.motionData[nextIdx], t);
                    } else if (this.motionData[prevIdx]) {
                        savedFrame = this.motionData[prevIdx];
                    } else if (this.motionData[nextIdx]) {
                        savedFrame = this.motionData[nextIdx];
                    }
                }

                if (savedFrame && this.rig) {
                    const hipsBone = this.mocapBones[99];
                    if (hipsBone && savedFrame.hipsPos) {
                        if (!(this.transformControls && this.transformControls.dragging && this.selectedMpIdx == 99 && this.transformControls.mode === 'translate')) {
                            hipsBone.position.set(savedFrame.hipsPos.x, savedFrame.hipsPos.y, savedFrame.hipsPos.z);
                        }
                    }

                    for (const [mpIdx, dat] of Object.entries(savedFrame.bones)) {
                        if (this.transformControls && this.transformControls.dragging && String(this.selectedMpIdx) === String(mpIdx) && this.transformControls.mode === 'rotate') {
                            continue;
                        }
                        const bone = this.mocapBones[mpIdx];
                        if (bone && dat) {
                            if (parseInt(mpIdx) >= 300 && parseInt(mpIdx) <= 369) {
                                if (dat.posX !== undefined) bone.position.set(dat.posX, dat.posY, dat.posZ);
                            } else {
                                if (dat.x !== undefined) bone.quaternion.set(dat.x, dat.y, dat.z, dat.w);
                            }
                        }
                    }

                    this.rig.updateMatrixWorld(true);
                }
            }
        }

        if (this.customSkeletonGroup && this.showSkeleton) {
            this.pickableObjects.forEach(picker => {
                const bone = this.mocapBones[picker.userData.mpIdx];
                if (bone) {
                    bone.getWorldPosition(picker.position);
                }
            });

            this.boneCylinders.forEach(cyl => {
                const b1 = this.mocapBones[cyl.i];
                const b2 = this.mocapBones[cyl.j];
                if (b1 && b2) {
                    const p1 = b1.getWorldPosition(new this.THREE.Vector3());
                    const p2 = b2.getWorldPosition(new this.THREE.Vector3());
                    const distance = p1.distanceTo(p2);

                    if (distance > 0.001) {
                        cyl.mesh.position.copy(p1);
                        cyl.mesh.quaternion.setFromUnitVectors(new this.THREE.Vector3(0, 1, 0), p2.clone().sub(p1).normalize());
                        cyl.mesh.scale.set(1, distance, 1);
                        cyl.mesh.visible = true;
                    } else {
                        cyl.mesh.visible = false;
                    }
                }
            });
        }

        this.drawOnionSkin();
        this.renderer.render(this.scene, this.camera);
    }

    async exportToGLB(filename) {
        if (!this.rig || Object.keys(this.motionData).length === 0) {
            console.error("[Mocap Surgeon] No rig or motion data to export.");
            return false;
        }

        const fps = 30;

        let startF = this.markInFrame != null ? this.markInFrame : 0;
        let endF = this.markOutFrame != null ? this.markOutFrame : Number.MAX_SAFE_INTEGER;
        if (startF > endF) { let temp = startF; startF = endF; endF = temp; }

        const frameIndices = Object.keys(this.motionData)
            .map(Number)
            .filter(f => f >= startF && f <= endF)
            .sort((a, b) => a - b);

        if (frameIndices.length === 0) return false;

        const exportStartTime = frameIndices[0];

        let originalRootBone = null;
        this.rig.traverse(child => {
            if (child.isBone && !(child.parent && child.parent.isBone)) {
                originalRootBone = child;
            }
        });

        if (!originalRootBone) {
            console.error("[Mocap Surgeon] Root bone not found in rig.");
            return false;
        }

        const exportScene = new this.THREE.Scene();
        exportScene.name = "ActionDirector_Mocap_Export";

        const clonedRoot = originalRootBone.clone(true);
        exportScene.add(clonedRoot);

        clonedRoot.traverse(child => {
            if (child.isBone) {
                let found = false;

                for (const [mpIdx, mixamoNames] of Object.entries(this.MP_TO_MIXAMO)) {
                    if (mixamoNames.some(mn => child.name === mn || child.name.endsWith(mn))) {
                        child.name = this.BONE_EXPORT_NAMES[mpIdx];
                        found = true;
                        break;
                    }
                }

                if (!found && child.name.includes("OP_Face_")) {
                    const match = child.name.match(/OP_Face_(\d+)/);
                    if (match) {
                        child.name = `OP_Face_${match[1]}`;
                        found = true;
                    }
                }

                if (!found) {
                    ["Left", "Right"].forEach(side => {
                        this.HAND_DICT[side].forEach(finger => {
                            if (child.name.includes(finger.name)) {
                                child.name = finger.name;
                            }
                        });
                    });
                }

                child.matrixAutoUpdate = true;
            } else {
                if (child.parent) child.parent.remove(child);
            }
        });

        const tracks = [];

        const tempQuatFilters = {};
        const tempPosFilters = {};

        for (const [mpIdx, simpleName] of Object.entries(this.BONE_EXPORT_NAMES)) {
            const posTimes = [], posVals = [];
            const quatTimes = [], quatVals = [];

            frameIndices.forEach(fIdx => {
                const frame = this.motionData[fIdx];
                const t = (fIdx - exportStartTime) / fps;

                if (mpIdx == 99 && frame.hipsPos && !isNaN(frame.hipsPos.x)) {
                    let hPos = frame.hipsPos;
                    if (hPos.rawX !== undefined) {
                        if (!tempPosFilters[99]) tempPosFilters[99] = new OneEuroFilter3D(30);
                        let rawP = { x: hPos.rawX, y: hPos.rawY, z: hPos.rawZ };
                        let fp = tempPosFilters[99].filter(rawP, t, this.filterMinCutoff, this.filterBeta);

                        if (hPos.isManual || hPos.isBlended) {
                            posTimes.push(t);
                            posVals.push(hPos.x, hPos.y, hPos.z);
                        } else if (!isNaN(fp.x)) {
                            posTimes.push(t);
                            posVals.push(fp.x, fp.y, fp.z);
                        } else {
                            posTimes.push(t);
                            posVals.push(hPos.x, hPos.y, hPos.z);
                        }
                    } else {
                        posTimes.push(t);
                        posVals.push(hPos.x, hPos.y, hPos.z);
                    }
                }

                const boneFrame = frame.bones && frame.bones[mpIdx];
                if (boneFrame) {
                    if (mpIdx >= 300 && mpIdx <= 369 && !isNaN(boneFrame.posX)) {
                        if (boneFrame.rawX !== undefined) {
                            if (!tempPosFilters[mpIdx]) tempPosFilters[mpIdx] = new OneEuroFilter3D(30);
                            let rawP = { x: boneFrame.rawX, y: boneFrame.rawY, z: boneFrame.rawZ };
                            let fp = tempPosFilters[mpIdx].filter(rawP, t, this.filterMinCutoff, this.filterBeta);

                            if (boneFrame.isManual || boneFrame.isBlended) {
                                posTimes.push(t);
                                posVals.push(boneFrame.posX, boneFrame.posY, boneFrame.posZ);
                            } else if (!isNaN(fp.x)) {
                                posTimes.push(t);
                                posVals.push(fp.x, fp.y, fp.z);
                            } else {
                                posTimes.push(t);
                                posVals.push(boneFrame.posX, boneFrame.posY, boneFrame.posZ);
                            }
                        } else {
                            posTimes.push(t);
                            posVals.push(boneFrame.posX, boneFrame.posY, boneFrame.posZ);
                        }
                    } else if (!isNaN(boneFrame.x)) {
                        if (boneFrame.rawX !== undefined) {
                            if (!tempQuatFilters[mpIdx]) tempQuatFilters[mpIdx] = new OneEuroFilterQuat(30);
                            let rawQ = { x: boneFrame.rawX, y: boneFrame.rawY, z: boneFrame.rawZ, w: boneFrame.rawW };
                            let fq = tempQuatFilters[mpIdx].filter(rawQ, t, this.filterMinCutoff, this.filterBeta);

                            if (boneFrame.isManual || boneFrame.isBlended) {
                                quatTimes.push(t);
                                quatVals.push(boneFrame.x, boneFrame.y, boneFrame.z, boneFrame.w);
                            } else if (!isNaN(fq.x)) {
                                quatTimes.push(t);
                                quatVals.push(fq.x, fq.y, fq.z, fq.w);
                            } else {
                                quatTimes.push(t);
                                quatVals.push(boneFrame.x, boneFrame.y, boneFrame.z, boneFrame.w);
                            }
                        } else {
                            quatTimes.push(t);
                            quatVals.push(boneFrame.x, boneFrame.y, boneFrame.z, boneFrame.w);
                        }
                    }
                }
            });

            if (posVals.length > 0) {
                tracks.push(new this.THREE.VectorKeyframeTrack(`${simpleName}.position`, posTimes, posVals));
            }
            if (quatVals.length > 0) {
                tracks.push(new this.THREE.QuaternionKeyframeTrack(`${simpleName}.quaternion`, quatTimes, quatVals));
            }
        }

        if (tracks.length === 0) {
            console.error("[Mocap Surgeon] Export failed: No valid animation tracks baked.");
            return false;
        }

        const clip = new this.THREE.AnimationClip("MocapBake", -1, tracks);

        clip.userData = clip.userData || {};
        exportScene.userData = exportScene.userData || {};

        if (!this.THREE.AnimationClip.prototype._mocapSurgeonPatched) {
            const originalClone = this.THREE.AnimationClip.prototype.clone;
            this.THREE.AnimationClip.prototype.clone = function () {
                const cloned = originalClone.apply(this, arguments);
                cloned.userData = cloned.userData || {};
                return cloned;
            };
            this.THREE.AnimationClip.prototype._mocapSurgeonPatched = true;
        }

        exportScene.updateMatrixWorld(true);

        try {
            const glbResult = await new Promise((resolve, reject) => {
                const exporter = new this.GLTFExporterClass();
                exporter.parse(
                    exportScene,
                    (res) => resolve(res),
                    (err) => reject(err),
                    {
                        binary: true,
                        animations: [clip],
                        includeCustomExtensions: false
                    }
                );
            });

            const blob = new Blob([glbResult], { type: 'application/octet-stream' });
            const formData = new FormData();
            formData.append("file", blob);
            formData.append("filename", filename);

            const res = await fetch('/action_director/upload_glb', {
                method: 'POST',
                body: formData
            });

            return res.ok;
        } catch (e) {
            console.error("[Mocap Surgeon] GLB Export failed:", e);
            return false;
        }
    }
}

// --- COMfyUI EXTENSION REGISTRATION ---
app.registerExtension({
    name: "Yedp.MocapSurgeon",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {

        if (nodeData.name === "YedpMocapSurgeon") {
            const onNodeCreated = nodeType.prototype.onNodeCreated;

            nodeType.prototype.onNodeCreated = function () {
                const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;

                const container = document.createElement("div");
                container.classList.add("yedp-mocap-surgeon-container");

                const widget = this.addDOMWidget("mocap_viewport", "vp", container, { serialize: false, hideOnZoom: false });

                // 1. Dynamic Widget Sizing: Tell LiteGraph this widget consumes the entire node height
                widget.computeSize = function (width) {
                    // We subtract ~40px to account for the node title bar
                    return [width, this.parent ? this.parent.size[1] - 40 : 480];
                };

                setTimeout(() => {
                    this.vp = new MocapSurgeonViewport(this, container);

                    // Robust logic to find and hide the backend string output
                    if (this.widgets) {
                        for (let w of this.widgets) {
                            if (w.name === "info" || w.type === "customtext" || typeof w.value === "string") {
                                w.computeSize = () => [0, -4];
                                if (w.inputEl) {
                                    w.inputEl.style.display = "none";
                                } else if (w.element) {
                                    w.element.style.display = "none";
                                }
                            }
                        }
                    }

                    // Force an initial layout sync after the UI settles
                    if (this.size) {
                        container.style.width = this.size[0] + "px";
                        container.style.height = (this.size[1] - 40) + "px";
                        if (this.vp) this.vp.onResize();
                    }
                }, 100);

                // 2. The Crucial Resize Hook: Actively push pixel dimensions to the DOM
                const onResize = this.onResize;
                this.onResize = function (size) {
                    if (onResize) onResize.apply(this, arguments);

                    if (container) {
                        // size[0] is width, size[1] is height
                        container.style.width = size[0] + "px";
                        container.style.height = (size[1] - 40) + "px";
                    }

                    // Tell Three.js the canvas changed size so the camera aspect updates
                    if (this.vp) {
                        this.vp.onResize();
                    }
                };

                // Set a comfortable default size for a 3D viewport
                this.setSize([800, 600]);

                this.onRemoved = function () {
                    if (this.vp) {
                        if (this.vp.resizeObserver) this.vp.resizeObserver.disconnect();
                        if (this.vp.renderer) { this.vp.renderer.dispose(); this.vp.renderer = null; }
                        if (this.vp.videoEl) {
                            this.vp.videoEl.pause();
                            this.vp.videoEl.src = "";
                        }
                    }
                };
                return r;
            };
        }
    }
});
