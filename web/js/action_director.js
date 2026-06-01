import { app } from "/scripts/app.js";
import { api } from "/scripts/api.js";

/** * YEDP ACTION DIRECTOR - V9.3 (Perfected Face Mocap, Offline Video, & Sequencer)
 * - Update: Added Multi-Clip Animation Sequencer! Characters can now queue an infinite sequence of animations.
 * - Update: Auto-Crossfade System. Sequencer automatically calculates 0.5s overlapping weight blends.
 * - Update: Circular Time-Wrapping. Looping a character now mathematically blends the final sequence clip flawlessly back into the first.
 * - Update: Implemented Offline Video Processing. Video files now process sequentially frame-by-frame for zero dropped frames and perfect 30 FPS synchronization.
 * - Update: Switched coordinate extraction to Isotropic Pixel Space to completely eliminate mesh-mangling bugs on non-16:9 video aspect ratios.
 * - Update: Matrix Un-Rotation applied to MediaPipe capture. Expressions are now stored in pure Local Space and are completely decoupled from head rotation!
 * - Update: Perfected the 17-point Jawline mapping array for absolute symmetry, fixing gaps near the chin.
 * - Update: Switched to Additive Mocap! MediaPipe now tracks relative deltas from frame 0 and applies them to the Rig's rest pose.
 * - Update: Proportional Auto-Scaling measures the 3D rig's ear-to-ear distance to scale mocap perfectly to any character.
 * - Feature: Added JSON disk-saving and loading for recorded Mocap tracks!
 * - Feature: Continuous Root Motion Tracking! Automatically strips loop snapping and integrates spatial movement indefinitely. 
 * - Feature: Added PLYLoader support for Gaussian Splats / Point Clouds and a new TEXTURED Render pass!
 * - UI Update: Fixed truncated elements and expanded sidebar width to 280px for better breathing room.
 * - UI Update: Added custom Range Selection Slider for trimming video Face Mocap captures.
 * - UI Update: Added custom Capture Name input field for Face Mocap bindings.
 * - UI Update: Added real-time toggle between Point Cloud and Gaussian Splat for PLY environments.
 * - Feature: Save & Load physical node states natively to prevent workflow data loss.
 */

const loadThreeJS = async () => {
    if (window._YEDP_THREE_CACHE) return window._YEDP_THREE_CACHE;

    return window._YEDP_THREE_CACHE = new Promise(async (resolve, reject) => {
        const baseUrl = new URL(".", import.meta.url).href;
        try {
            console.log("[Yedp] Initializing Engine V9.3 (Sequencer Mode)...");
            
            const THREE = await import(new URL("./three.module.js", baseUrl).href);

            if (THREE.ColorManagement && typeof THREE.ColorManagement.colorSpaceToWorking !== 'function') {
                THREE.ColorManagement.colorSpaceToWorking = function (color, colorSpace) {
                    if (colorSpace === THREE.SRGBColorSpace || colorSpace === 'srgb') return color.convertSRGBToLinear();
                    return color;
                };
            } else if (!THREE.ColorManagement) {
                THREE.ColorManagement = { enabled: false, colorSpaceToWorking: function (color) { return color; } };
            }

            const { OrbitControls } = await import(new URL("./OrbitControls.js", baseUrl).href);
            const { TransformControls } = await import(new URL("./TransformControls.js", baseUrl).href);
            const { GLTFLoader } = await import(new URL("./GLTFLoader.js", baseUrl).href);
            await import(new URL("./fflate.module.js", baseUrl).href); 
            const { FBXLoader } = await import(new URL("./FBXLoader.js", baseUrl).href);
            const { BVHLoader } = await import(new URL("./BVHLoader.js", baseUrl).href);
            const { PLYLoader } = await import(new URL("./PLYLoader.js", baseUrl).href);
            const { HDRLoader } = await import(new URL("./HDRLoader.js", baseUrl).href);
            const { clone } = await import(new URL("./SkeletonUtils.js", baseUrl).href);
            const splatLib = await import(new URL("./gaussian-splats-3d.module.js", baseUrl).href);
            const DropInViewer = splatLib.DropInViewer || splatLib.default?.DropInViewer;

            // --- NEW: Path Tracing Imports ---
            const bvhLib = await import(new URL("./three-mesh-bvh.module.js", baseUrl).href);
            THREE.BufferGeometry.prototype.computeBoundsTree = bvhLib.computeBoundsTree;
            THREE.BufferGeometry.prototype.disposeBoundsTree = bvhLib.disposeBoundsTree;
            THREE.Mesh.prototype.raycast = bvhLib.acceleratedRaycast;
            
            const ptLib = await import(new URL("./three-gpu-pathtracer.module.js", baseUrl).href);
            // ---------------------------------
            
            const { GLTFExporter } = await import(new URL("./GLTFExporter.js", baseUrl).href);

            resolve({ THREE, OrbitControls, TransformControls, GLTFLoader, FBXLoader, BVHLoader, PLYLoader, HDRLoader, SkeletonUtils: { clone }, DropInViewer, bvhLib, ptLib, GLTFExporter });
            
        } catch (e) {
            console.error("[Yedp] Critical Engine Load Failure:", e);
            reject(e);
        }
    });
};

// --- UNIVERSAL BONE MAPPING DICTIONARY ---
const { BONE_MAP, BONE_KEYS_SORTED } = (() => {
    const map = {};
    const synonyms = {
        "hips": ["hips", "pelvis", "root", "cg", "center"],
        "spine": ["spine", "spine0", "spine00", "abdomen", "waist", "lowerback"],
        "spine1": ["spine1", "spine01", "spine001", "chest", "chest1", "torso1", "middleback"],
        "spine2": ["spine2", "spine02", "spine002", "upperchest", "chest2", "torso2", "upperback"],
        "spine3": ["spine3", "spine03", "spine003", "chest3", "torso3"],
        "neck": ["neck", "neck0", "neck00", "cervical"],
        "head": ["head"],
        "leftshoulder": ["leftshoulder", "lshoulder", "shoulderl", "lclavicle", "claviclel", "leftcollar", "lcollar", "collarl"],
        "leftarm": ["leftarm", "larm", "arml", "leftuparm", "luparm", "uparml", "leftupperarm", "lupperarm", "upperarml", "lshldr", "leftbicep"],
        "leftforearm": ["leftforearm", "lforearm", "forearml", "leftelbow", "lelbow", "elbowl", "leftlowerarm", "llowerarm", "lowerarml"],
        "lefthand": ["lefthand", "lhand", "handl", "leftwrist", "lwrist", "wristl"],
        "rightshoulder": ["rightshoulder", "rshoulder", "shoulderr", "rclavicle", "clavicler", "rightcollar", "rcollar", "collarr"],
        "rightarm": ["rightarm", "rarm", "armr", "rightuparm", "ruparm", "uparmr", "rightupperarm", "rupperarm", "upperarmr", "rshldr", "rightbicep"],
        "rightforearm": ["rightforearm", "rforearm", "forearmr", "rightelbow", "relbow", "elbowr", "rightlowerarm", "rlowerarm", "lowerarmr"],
        "righthand": ["righthand", "rhand", "handr", "rightwrist", "rwrist", "wristr"],
        "leftupleg": ["leftupleg", "lupleg", "uplegl", "leftthigh", "lthigh", "thighl", "leftupperleg", "lupperleg", "upperlegl", "lefthip", "lhip", "hip_l"],
        "leftleg": ["leftleg", "lleg", "legl", "leftcalf", "lcalf", "calfl", "leftknee", "lknee", "kneel", "leftlowerleg", "llowerleg", "lowerlegl", "lshin", "shinl"],
        "leftfoot": ["leftfoot", "lfoot", "footl", "leftankle", "lankle", "anklel"],
        "lefttoebase": ["lefttoebase", "ltoebase", "toebasel", "lefttoe", "ltoe", "toel", "lefttoes", "ltoes", "toesl", "leftfootball", "lfootball", "footballl"],
        "rightupleg": ["rightupleg", "rupleg", "uplegr", "rightthigh", "rthigh", "thighr", "rightupperleg", "rupperleg", "upperlegr", "righthip", "rhip", "hip_r"],
        "rightleg": ["rightleg", "rleg", "legr", "rightcalf", "rcalf", "calfr", "rightknee", "rknee", "kneer", "rightlowerleg", "rlowerleg", "lowerlegr", "rshin", "shinr"],
        "rightfoot": ["rightfoot", "rfoot", "footr", "rightankle", "rankle", "ankler"],
        "righttoebase": ["righttoebase", "rtoebase", "toebaser", "righttoe", "rtoe", "toer", "righttoes", "rtoes", "toesr", "rightfootball", "rfootball", "footballr"]
    };

    for (const [canonical, synList] of Object.entries(synonyms)) {
        map[canonical] = canonical;
        for (const syn of synList) map[syn] = canonical;
    }

    const fingers = ["thumb", "index", "middle", "ring", "pinky"];
    const sides = [ { canon: "lefthand", shorts: ["l", "left"] }, { canon: "righthand", shorts: ["r", "right"] } ];

    sides.forEach(side => {
        fingers.forEach(finger => {
            for (let i = 1; i <= 4; i++) {
                const canonical = `${side.canon}${finger}${i}`;
                map[canonical] = canonical;
                side.shorts.forEach(s => {
                    map[`${s}${finger}${i}`] = canonical;
                    map[`${finger}${i}${s}`] = canonical;
                    map[`${s}${finger}0${i}`] = canonical;
                    if (finger === "pinky") {
                        map[`${s}little${i}`] = canonical;
                        map[`little${i}${s}`] = canonical;
                        map[`${s}pinkie${i}`] = canonical;
                    }
                });
            }
        });
    });
    return { BONE_MAP: map, BONE_KEYS_SORTED: Object.keys(map).sort((a, b) => b.length - a.length) };
})();

const semanticNormalize = (name) => {
    if (!name) return "";
    let clean = name.split(/[:/|]/).pop();
    const lower = clean.toLowerCase();
    
    if (lower === "l_foot" || lower === "left_foot") return BONE_MAP["lefttoebase"];
    if (lower === "r_foot" || lower === "right_foot") return BONE_MAP["righttoebase"];
    if (lower === "l_ankle" || lower === "left_ankle") return BONE_MAP["leftfoot"];
    if (lower === "r_ankle" || lower === "right_ankle") return BONE_MAP["rightfoot"];
    if (lower === "l_hip" || lower === "left_hip") return BONE_MAP["leftupleg"];
    if (lower === "r_hip" || lower === "right_hip") return BONE_MAP["rightupleg"];
    if (lower === "l_collar" || lower === "left_collar") return BONE_MAP["leftshoulder"];
    if (lower === "r_collar" || lower === "right_collar") return BONE_MAP["rightshoulder"];
    if (lower === "l_shoulder" || lower === "left_shoulder") return BONE_MAP["leftarm"];
    if (lower === "r_shoulder" || lower === "right_shoulder") return BONE_MAP["rightarm"];

    clean = clean.replace(/^(b_|j_bip_|bip_|cc_base_|def_|org_|mch_|mixamorig\d*_?|mixamo_?)/i, "")
                 .replace(/(ik|fk|nub|end|twist\d*)$/i, "")
                 .replace(/[\s\-_.[\]]+/g, "")
                 .toLowerCase();

    if (BONE_MAP[clean]) return BONE_MAP[clean];
    for (const key of BONE_KEYS_SORTED) {
        if (clean.endsWith(key)) return BONE_MAP[key];
    }
    return clean;
};

// --- MOCAP CONSTANTS ---
const MP_TO_OP_FACE = [
    162, 234, 93, 58, 172, 136, 149, 148, 152, 377, 378, 365, 397, 288, 323, 454, 389, // 0-16 Jaw
    46, 53, 52, 65, 55,       // 17-21 Right Brow
    285, 295, 282, 283, 276,  // 22-26 Left Brow
    6, 197, 195, 5,           // 27-30 Nose Bridge
    98, 97, 2, 326, 327,      // 31-35 Nose Bottom
    33, 160, 158, 133, 153, 144, // 36-41 Right Eye
    362, 385, 387, 263, 373, 380, // 42-47 Left Eye
    61, 39, 37, 0, 267, 269, 291, 405, 314, 17, 84, 181, // 48-59 Outer Lips
    78, 81, 13, 311, 308, 402, 14, 178, // 60-67 Inner Lips
    468, 473                  // 68-69 Pupils
];

// --- CLASSES ---
class CharacterInstance {
    constructor(id, baseRig, THREE) {
        this.id = id;
        this.scene = window._YEDP_SKEL_UTILS.clone(baseRig);
        this.mixer = new THREE.AnimationMixer(this.scene);
        
        // Sequencer Architecture replaces single action
        this.animSequence = [];
        this.animIdCounter = 0;
        
        this.duration = 0; 
        this.loop = true;
        this.blendDuration = 0.5; 
        this.gender = 'M'; 
        this.showFace = true;
        this.hasFemaleMesh = false; 
        this.faceScale = 1.0; 

        // Root Motion state tracking
        this.useRootMotion = false;
        this.rootBone = null;
        this.continuousPos = new THREE.Vector3();
        this.lastRawPos = new THREE.Vector3();
        this.lastDomItem = null;
        this.lastDomTau = -1;
        this.lastEvalTime = -1; // Global timeline evaluation tracker

        this.poseMeshes = [];
        this.poseFaceMeshes = []; 
        this.depthMeshesM = [];
        this.depthMeshesF = [];
        
        this.opFaceBones = new Array(70).fill(null);
        this.opFaceBonesRest = new Array(70).fill(null); 

        this.skeletonHelper = new THREE.SkeletonHelper(this.scene);
        this.skeletonHelper.visible = true;

        this.scene.position.set((id - 1) * 1.0, 0, 0);

        this.scene.traverse((child) => {
            // Find Top Level Bone
            if (child.isBone && !this.rootBone && child.parent && child.parent.type !== 'Bone') {
                this.rootBone = child;
            }

            if (child.isBone && child.name.includes("OP_Face_")) {
                const match = child.name.match(/OP_Face_(\d+)/);
                if (match) {
                    const idx = parseInt(match[1]);
                    if (idx >= 0 && idx < 70) {
                        this.opFaceBones[idx] = child;
                        this.opFaceBonesRest[idx] = child.position.clone();
                    }
                }
            }

            if(child.isMesh || child.isSkinnedMesh || child.isPoints || child.type === 'Points') {
                child.visible = true; 
                child.frustumCulled = false; 
                child.castShadow = true;
                child.receiveShadow = true;
                
                let fullPath = "";
                let curr = child;
                while (curr && curr !== this.scene && curr !== null) {
                    if (curr.name) fullPath += curr.name.toLowerCase() + "|";
                    curr = curr.parent;
                }

                const n = fullPath.replace(/[\s_]/g, '');
                let category = "";

                if (n.includes("openpose") || n.includes("pose")) {
                    this.poseMeshes.push(child);
                    if (n.includes("face")) {
                        this.poseFaceMeshes.push(child);
                    }
                    category = "Pose";
                    if (child.material) {
                        const processMat = (mat) => {
                            const oldColor = mat.color || new THREE.Color(0xffffff);
                            const newMat = new THREE.MeshBasicMaterial({ color: oldColor });
                            if (mat.map) { newMat.map = mat.map; newMat.color.setHex(0xffffff); }
                            return newMat;
                        };
                        if (Array.isArray(child.material)) child.material = child.material.map(processMat);
                        else child.material = processMat(child.material);
                    }

                } else if (n.includes("depthf") || n.includes("female") || n.includes("woman") || n.includes("|f|") || n.endsWith("f|")) {
                    this.hasFemaleMesh = true;
                    this.depthMeshesF.push(child);
                    child.visible = false; 
                    category = "Female Depth";
                } else if (n.includes("depth") || n.includes("male") || n.includes("man")) {
                    this.depthMeshesM.push(child);
                    child.visible = false; 
                    category = "Male Depth";
                } else {
                    this.depthMeshesM.push(child);
                    this.depthMeshesF.push(child);
                    child.visible = false;
                    category = "Prop (Fallback)";
                }
            }
        });
    }

    get activeDepthMeshes() { return (this.gender === 'F' && this.hasFemaleMesh) ? this.depthMeshesF : this.depthMeshesM; }
    get inactiveDepthMeshes() { return (this.gender === 'F' && this.hasFemaleMesh) ? this.depthMeshesM : this.depthMeshesF; }

    addSequenceItem(filename = "none") {
        this.animIdCounter++;
        const item = {
            id: this.animIdCounter,
            file: filename,
            action: null,
            duration: 0,
            startTime: 0,
            blendIn: 0,
            blendOut: 0
        };
        this.animSequence.push(item);
        return item;
    }

    destroy(scene) {
        scene.remove(this.scene);
        scene.remove(this.skeletonHelper);
        this.mixer.stopAllAction();
    }
}

class EnvironmentInstance {
    constructor(id, THREE) {
        this.id = id;
        this.THREE = THREE;
        this.group = new THREE.Group();
        this.mixer = new THREE.AnimationMixer(this.group);
        this.action = null;
        this.duration = 0;
        this.loop = true;
        this.envFile = "none";
        this.meshes = [];
        this.splatViewer = null;
        this.forceSplat = null; // Toggle property for PLY files
    }

    destroy(scene) {
        if (this.splatViewer && typeof this.splatViewer.dispose === 'function') {
            this.splatViewer.dispose();
        }
        scene.remove(this.group);
        this.mixer.stopAllAction();
    }
}

// --- MAIN VIEWPORT ---
class YedpViewport {
    constructor(node, container) {
        this.node = node;
        this.container = container;
        this.baseUrl = new URL(".", import.meta.url).href;
        
        this.isInitialized = false;

        this.scene = null;
        this.camera = null;
        this.perspCam = null;
        this.orthoCam = null;
        this.isOrthographic = false;

        this.renderer = null;
        this.controls = null;
        this.transformControls = null;
        this.clock = null;
        
        this.baseRig = null;
        this.rigCaches = new Map();
        
        this.characters = []; 
        this.charCounter = 0;
        
        this.environments = [];
        this.envCounter = 0;

        this.lights = [];
        this.lightCounter = 0;

        // Face Mocap State
        this.recordedMocaps = [];
        this.mocapBindings = [];  
        this.mocapBindingCounter = 0;
        
        // MediaPipe Integration State
        this.visionLib = null;
        this.faceLandmarker = null;
        this.isMocapActive = false;
        this.isMocapRecording = false;
        this.isMocapStarting = false;
        this.mocapVideoEl = null;
        this.mocapCanvasEl = null;
        this.currentMocapSession = null;
        this.mocapMediaStream = null;
        this.mocapOverlay = null;
        this.mocapTimer = null;
        
        this.mocapRangeStart = 0; // Video Trim Start (0.0 to 1.0)
        this.mocapRangeEnd = 1;   // Video Trim End (0.0 to 1.0)

        this.selected = { obj: null, type: null, id: null };

        this.gridHelper = null;
        this.axesHelper = null;
        this.semanticMap = new Map(); 

        this.camKeys = { start: null, end: null, ease: 'linear' };
        this.cameraAnimGroup = null;
        this.cameraMixer = null;
        this.cameraAction = null;
        this.cameraAnimNode = null;
        this.importedCamProxy = null; 
        this.isCameraOverride = false;
        
        this.camOverrideOffset = { rx: 0, ry: 0, rz: 0 };
        this.camOverrideScale = 1.0;
        
        this.matsSkinned = null;
        this.matsStatic = null;
        this.originalMaterials = new Map();
        
        this.isShadedMode = false;
        this.isDepthMode = false;
        this.isTexturedMode = false;
        // --- NEW: Path Tracing State ---
        this.isPathTracingEnabled = false;
        this.ptRenderer = null;
        this.ptSceneGenerator = null;
        this.ptPreviewSamples = 32;   // Slider target for viewport preview
        this.ptBakeSamples = 128;     // Slider target for final sequence bake
        this.ptAccumulatedSamples = 0; // Current sample count
        this.needsPtReset = true;      // Flag to tell the accumulator to clear and restart
        this.needsPtBvhUpdate = true;  // NEW: Flag for slow mesh/bone updates vs fast camera updates
        // -------------------------------
        this.userNear = 0.1;
        this.userFar = 10.0;
        this.defaultNear = 0.1;
        this.defaultFar = 100.0;

        this.isPlaying = false;
        this.isBaking = false; 
        this.globalTime = 0;
        this.isCameraMoving = false;
        
        this.renderWidth = 512;
        this.renderHeight = 512;
        this.availableAnimations = ["none"];
        this.availableEnvs = ["none"];
        this.availableCams = ["none"];
        this.availableRigs = ["Yedp_Rig.glb"];

        // Cached DOM refs for the animation loop (set in setupTimeline)
        this._sliderEl = null;
        this._timeLabelEl = null;

        this.availableHdris = ["none"];
        this.currentHdriMap = null;
        this.isHdriEnabled = false;
        this.isHdriBgEnabled = false;
        this.hdriIntensity = 1.0;
        this.hdriRotation = 0;

        this.uiSidebar = null;
        this.uiCharList = null;
        this.uiEnvList = null;
        this.uiLightList = null;
        this.uiMocapList = null; 
        this.uiMocapDropdowns = []; 
        
        this.uiTransformInputs = {};
        this.helpModal = null; 
        this.loadModal = null; // Store reference to load modal

        this.isHovered = false;
        this._handleKeyDown = this.handleKeyDown.bind(this);
        window.addEventListener('keydown', this._handleKeyDown);
        
        // Pre-allocated temp objects for hot-path reuse (avoids GC pressure)
        this._tmpVec3A = null; // Initialized after THREE is loaded
        this._tmpVec3B = null;
        this._tmpQuatA = null;
        this._tmpEulerA = null;
        
        // Reference stored to allow unbinding during cleanup
        this.resizeObserver = null; 

        this.init();
    }

    async fetchHdris() {
        try {
            const res = await api.fetchApi("/yedp/get_hdris");
            const data = await res.json();
            if (data.files && data.files.length > 0) this.availableHdris = ["none", ...data.files.filter(f => f !== "none")];
        } catch(e) { console.error("Failed to fetch HDRIs."); }
    }

    async loadHDRI(filename) {
        this.hdriFile = filename; // <-- WE MUST TRACK THE FILENAME FOR SAVING
        if (!filename || filename === "none") {
            this.currentHdriMap = null;
            this.updateHDRI();
            return;
        }
        const url = `/view?filename=${encodeURIComponent(filename)}&type=input&subfolder=yedp_hdri&t=${Date.now()}`;
        try {
            const loader = new this.HDRLoader(); 
            const texture = await loader.loadAsync(url);
            texture.mapping = this.THREE.EquirectangularReflectionMapping;
            this.currentHdriMap = texture;
            this.updateHDRI();
        } catch(e) { 
            console.error("HDRI Load Error", e); 
        }
    }

    updateHDRI() {
        const rotDeg = parseFloat(this.hdriRotation) || 0;
        const rotRad = this.THREE.MathUtils.degToRad(rotDeg);
        const intensity = parseFloat(this.hdriIntensity) || 1.0;

        // --- NINJA PATCH: Ensure Path Tracer always gets the RAW map ---
        if (this.ptRenderer && !this.ptRenderer._isYedpPatched) {
            const originalSetScene = this.ptRenderer.setScene.bind(this.ptRenderer);
            this.ptRenderer.setScene = (s, c) => {
                const tEnv = s.environment; const tBg = s.background;
                if (this.isHdriEnabled && this.currentHdriMap) {
                    s.environment = this.currentHdriMap;
                    s.background = this.isHdriBgEnabled ? this.currentHdriMap : new this.THREE.Color(0x1a1a1a);
                }
                originalSetScene(s, c);
                s.environment = tEnv; s.background = tBg;
            };
            this.ptRenderer._isYedpPatched = true;
        }

        if (this.isHdriEnabled && this.currentHdriMap) {
            
            // --- 1. SETUP WEBGL CUBE CAMERA ---
            if (!this.hdriScene) {
                this.hdriScene = new this.THREE.Scene();
                const options = {
                    generateMipmaps: true,
                    minFilter: this.THREE.LinearMipmapLinearFilter,
                    magFilter: this.THREE.LinearFilter,
                    type: this.currentHdriMap.type || this.THREE.HalfFloatType,
                    format: this.currentHdriMap.format || this.THREE.RGBAFormat
                };
                if (this.currentHdriMap.colorSpace) options.colorSpace = this.currentHdriMap.colorSpace;
                
                this.hdriRenderTarget = new this.THREE.WebGLCubeRenderTarget(512, options);
                this.hdriCamera = new this.THREE.CubeCamera(0.1, 100, this.hdriRenderTarget);
                this.hdriScene.add(this.hdriCamera);
            }

            // --- 2. BAKE ROTATED CUBEMAP ---
            this.hdriScene.background = this.currentHdriMap;
            this.hdriCamera.rotation.y = rotRad; 
            this.hdriCamera.updateMatrixWorld();
            
            const currentRenderTarget = this.renderer.getRenderTarget();
            this.hdriCamera.update(this.renderer, this.hdriScene);
            this.renderer.setRenderTarget(currentRenderTarget);

            // --- 3. FEED BAKED CUBEMAP TO WEBGL ---
            this.scene.environment = this.hdriRenderTarget.texture;
            this.scene.background = this.isHdriBgEnabled ? this.hdriRenderTarget.texture : new this.THREE.Color(0x1a1a1a);
            
            if (!this.scene.environmentRotation) this.scene.environmentRotation = new this.THREE.Euler();
            if (!this.scene.backgroundRotation) this.scene.backgroundRotation = new this.THREE.Euler();
            this.scene.environmentRotation.y = rotRad;
            this.scene.backgroundRotation.y = rotRad;
            this.scene.environmentIntensity = intensity;
            this.scene.backgroundIntensity = intensity;
            
            this.scene.traverse((child) => {
                if (child.isMesh && child.material) {
                    // Shield Gaussian Splats (and other custom shaders) from forced recompilation
                    const isCustomShader = Array.isArray(child.material) 
                        ? child.material.some(m => m.isShaderMaterial) 
                        : child.material.isShaderMaterial;

                    if (!isCustomShader) {
                        const updateMat = (mat) => {
                            if (mat.envMapIntensity !== undefined) mat.envMapIntensity = intensity;
                            mat.needsUpdate = true;
                        };
                        if (Array.isArray(child.material)) child.material.forEach(updateMat);
                        else updateMat(child.material);
                    }
                }
            });

            // --- 4. UPDATE PATH TRACER ---
            if (this.ptRenderer) {
                const tEnv = this.scene.environment; const tBg = this.scene.background;
                this.scene.environment = this.currentHdriMap;
                this.scene.background = this.isHdriBgEnabled ? this.currentHdriMap : new this.THREE.Color(0x1a1a1a);
                
                this.ptRenderer.updateEnvironment();
                this.needsPtReset = true;
                
                this.scene.environment = tEnv;
                this.scene.background = tBg;
            }

        } else {
            this.scene.environment = null;
            this.scene.background = new this.THREE.Color(0x1a1a1a);

            if (this.ptRenderer) {
                this.ptRenderer.updateEnvironment();
                this.needsPtReset = true;
            }

            this.scene.traverse((child) => {
                if (child.isMesh && child.material) {
                    // Shield Gaussian Splats (and other custom shaders) from forced recompilation
                    const isCustomShader = Array.isArray(child.material) 
                        ? child.material.some(m => m.isShaderMaterial) 
                        : child.material.isShaderMaterial;

                    if (!isCustomShader) {
                        const resetMat = (mat) => {
                            if (mat.envMapIntensity !== undefined) mat.envMapIntensity = 1.0;
                            mat.needsUpdate = true;
                        };
                        if (Array.isArray(child.material)) child.material.forEach(resetMat);
                        else resetMat(child.material);
                    }
                }
            });
        }
        
        this.forceUpdateFrame();
    }

    async init() {
        try {
            const libs = await loadThreeJS();
            this.THREE = libs.THREE;
            this.OrbitControls = libs.OrbitControls;
            this.TransformControls = libs.TransformControls;
            this.GLTFLoaderClass = libs.GLTFLoader;
            this.FBXLoader = libs.FBXLoader; 
            this.BVHLoader = libs.BVHLoader;
            this.PLYLoader = libs.PLYLoader;
            this.HDRLoader = libs.HDRLoader;
            this.DropInViewer = libs.DropInViewer;
            window._YEDP_SKEL_UTILS = libs.SkeletonUtils;

            // --- Map the Path Tracing Libraries ---
            this.bvhLib = libs.bvhLib;
            this.ptLib = libs.ptLib;
            // -------------------------------------------

            const createMats = () => {
                const m = {
                    shaded: new this.THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.6, metalness: 0.1 }),
                    depth: new this.THREE.MeshDepthMaterial({ depthPacking: this.THREE.BasicDepthPacking }),
                    canny: new this.THREE.MeshMatcapMaterial({ matcap: this.createRimTexture() }),
                    normal: new this.THREE.MeshNormalMaterial(),
                    alpha: new this.THREE.MeshBasicMaterial({ color: 0xffffff })
                };
                
                const pointVert = `
                    void main() {
                        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                        gl_Position = projectionMatrix * mvPosition;
                        if (projectionMatrix[3][3] > 0.5) {
                            gl_PointSize = 30.0; // Large sizes cast better, solid shadow maps without holes
                        } else {
                            gl_PointSize = 25.0 / -mvPosition.z;
                        }
                    }
                `;
                
                m.depthPoints = new this.THREE.ShaderMaterial({
                    vertexShader: pointVert,
                    fragmentShader: `
                        void main() {
                            vec2 xy = gl_PointCoord.xy - vec2(0.5);
                            if(length(xy) > 0.5) discard;
                            gl_FragColor = vec4(vec3(1.0 - gl_FragCoord.z), 1.0); // Inverted to match BasicDepthPacking (near=white, far=black)
                        }
                    `
                });

                m.normalPoints = new this.THREE.ShaderMaterial({
                    vertexShader: pointVert,
                    fragmentShader: `
                        void main() {
                            vec2 xy = gl_PointCoord.xy - vec2(0.5);
                            float ll = length(xy);
                            if(ll > 0.5) discard;
                            vec3 normal = normalize(vec3(xy.x * 2.0, -xy.y * 2.0, sqrt(max(0.0, 1.0 - (xy.x*2.0)*(xy.x*2.0) - (xy.y*2.0)*(xy.y*2.0)))));
                            gl_FragColor = vec4((normal + 1.0) * 0.5, 1.0);
                        }
                    `
                });

                // MeshDepthMaterial is necessary so the Three.js shadow renderer perfectly respects light packing definitions
                m.depthPointsShadow = new this.THREE.MeshDepthMaterial({ depthPacking: this.THREE.RGBADepthPacking });
                m.depthPointsShadow.onBeforeCompile = (shader) => {
                    shader.vertexShader = shader.vertexShader.replace(
                        '#include <project_vertex>',
                        `#include <project_vertex>
                        if (projectionMatrix[3][3] > 0.5) { gl_PointSize = 30.0; } else { gl_PointSize = 25.0 / -mvPosition.z; }`
                    );
                    shader.fragmentShader = shader.fragmentShader.replace(
                        'void main() {',
                        `void main() {
                            vec2 xy = gl_PointCoord.xy - vec2(0.5);
                            if(length(xy) > 0.5) discard;`
                    );
                };

                // MeshDistanceMaterial handles shadows for PointLights natively
                m.distancePointsShadow = new this.THREE.MeshDistanceMaterial();
                m.distancePointsShadow.onBeforeCompile = (shader) => {
                    shader.vertexShader = shader.vertexShader.replace(
                        '#include <project_vertex>',
                        `#include <project_vertex>
                        if (projectionMatrix[3][3] > 0.5) { gl_PointSize = 30.0; } else { gl_PointSize = 25.0 / -mvPosition.z; }`
                    );
                    shader.fragmentShader = shader.fragmentShader.replace(
                        'void main() {',
                        `void main() {
                            vec2 xy = gl_PointCoord.xy - vec2(0.5);
                            if(length(xy) > 0.5) discard;`
                    );
                };

                return m;
            };
            this.matsSkinned = createMats();
            this.matsStatic = createMats();

            // --- LAYOUT ---
            this.container.innerHTML = "";
            Object.assign(this.container.style, {
                display: "flex", flexDirection: "row", background: "#111",
                width: "100%", height: "100%", overflow: "hidden",
                border: "1px solid #333", borderRadius: "4px",
                boxSizing: "border-box"
            });

            // MAIN VIEW AREA
            const mainCol = document.createElement("div");
            Object.assign(mainCol.style, { display: "flex", flexDirection: "column", flex: "1", minWidth: 0, overflow: "hidden" });
            this.container.appendChild(mainCol);

            // SIDEBAR - Increased to 280px to fix cramped inputs
            this.uiSidebar = document.createElement("div");
            Object.assign(this.uiSidebar.style, {
                width: "280px", flex: "0 0 280px", background: "#1a1a1a", borderLeft: "1px solid #333",
                display: "flex", flexDirection: "column", overflowY: "auto", padding: "8px", boxSizing: "border-box",
                gap: "8px", fontSize: "11px", color: "#ccc"
            });
            this.container.appendChild(this.uiSidebar);

            // INSIDE MAIN COL
            const headerDiv = document.createElement("div");
            Object.assign(headerDiv.style, {
                height: "36px", flex: "0 0 36px", background: "#222", borderBottom: "1px solid #333",
                display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 8px",
                boxSizing: "border-box" 
            });
            mainCol.appendChild(headerDiv);

            const viewportDiv = document.createElement("div");
            viewportDiv.className = "yedp-vp-area";
            Object.assign(viewportDiv.style, { flex: "1 1 0", position: "relative", overflow: "hidden", background: "#000" });
            mainCol.appendChild(viewportDiv);

            const timelineDiv = document.createElement("div");
            Object.assign(timelineDiv.style, {
                height: "30px", flex: "0 0 30px", background: "#1a1a1a", borderTop: "1px solid #333",
                display: "flex", alignItems: "center", padding: "0 8px", gap: "8px",
                boxSizing: "border-box" 
            });
            mainCol.appendChild(timelineDiv);

            // --- 3D ENGINE SETUP ---
            this.clock = new this.THREE.Clock();
            this.scene = new this.THREE.Scene();
            this.scene.background = new this.THREE.Color(0x1a1a1a); 

            // Initialize pre-allocated temp objects now that THREE is available
            this._tmpVec3A = new this.THREE.Vector3();
            this._tmpVec3B = new this.THREE.Vector3();
            this._tmpQuatA = new this.THREE.Quaternion();
            this._tmpEulerA = new this.THREE.Euler();

            this.gridHelper = new this.THREE.GridHelper(10, 10, 0x444444, 0x222222);
            this.scene.add(this.gridHelper);
            this.axesHelper = new this.THREE.AxesHelper(1);
            this.scene.add(this.axesHelper);

            const floorGeo = new this.THREE.PlaneGeometry(50, 50);
            this.floorMat = new this.THREE.ShadowMaterial({ opacity: 0.6 }); 
            this.floor = new this.THREE.Mesh(floorGeo, this.floorMat);
            this.floor.rotation.x = -Math.PI / 2;
            this.floor.receiveShadow = true;
            this.scene.add(this.floor);

            // Setup Cameras
            const aspect = this.renderWidth / this.renderHeight || 1;
            this.perspCam = new this.THREE.PerspectiveCamera(45, aspect, 0.01, 2000);
            this.perspCam.position.set(0, 1.2, 4);

            const d = 2.0; 
            this.orthoCam = new this.THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 0.01, 2000);
            this.orthoCam.position.set(0, 1.2, 4);

            this.camera = this.perspCam;
            this.isOrthographic = false;
            
            this.cameraAnimGroup = new this.THREE.Group();
            this.cameraAnimGroup.visible = false;
            this.scene.add(this.cameraAnimGroup);

            this.importedCamProxy = new this.THREE.Group();
            const boxG = new this.THREE.BoxGeometry(0.2, 0.2, 0.4);
            const boxM = new this.THREE.MeshBasicMaterial({ color: 0x00d2ff, wireframe: true });
            const pBox = new this.THREE.Mesh(boxG, boxM);
            const coneG = new this.THREE.ConeGeometry(0.3, 0.5, 4);
            const coneM = new this.THREE.MeshBasicMaterial({ color: 0x00d2ff, wireframe: true });
            const pCone = new this.THREE.Mesh(coneG, coneM);
            pCone.rotation.x = -Math.PI / 2; pCone.rotation.y = Math.PI / 4; pCone.position.z = -0.4;
            this.importedCamProxy.add(pBox); this.importedCamProxy.add(pCone);
            this.scene.add(this.importedCamProxy);
            this.importedCamProxy.visible = false;
            
            this.renderer = new this.THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
            if (this.renderer.outputColorSpace) this.renderer.outputColorSpace = this.THREE.SRGBColorSpace;
            else this.renderer.outputEncoding = this.THREE.sRGBEncoding;
            
            this.renderer.shadowMap.enabled = true;

            // --- NEW: Path Tracer Init ---
            if (this.ptLib && this.ptLib.WebGLPathTracer) {
                this.ptRenderer = new this.ptLib.WebGLPathTracer(this.renderer);
                //this.ptRenderer.tiles.set(2, 2); // Splits the render into tiles to prevent GPU timeouts on heavy scenes
                this.ptRenderer.bounces = 3;     // Keep bounces low (3) for real-time IC Light shading
                this.ptRenderer.renderScale = 1; 

                this.ptRenderer.rasterizeScene = false;   // Stops the WebGL scene from rendering underneath
                this.ptRenderer.fadeDuration = 0;         // Removes the blurry fade-in effect
                this.ptRenderer.filterGlossyFactor = 0.5; // Blurs glossy rays slightly to kill bright fireflies
            }
            // -----------------------------

            this.renderer.shadowMap.type = this.THREE.PCFSoftShadowMap;

            viewportDiv.appendChild(this.renderer.domElement);
            Object.assign(this.renderer.domElement.style, { width: "100%", height: "100%", display: "block" });

            this.gate = document.createElement("div");
            this.gate.className = "yedp-resolution-gate";
            Object.assign(this.gate.style, {
                position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
                border: "2px solid #00d2ff", boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.65)", pointerEvents: "none", zIndex: "10",
                boxSizing: "content-box" 
            });
            viewportDiv.appendChild(this.gate);

            // Controls
            this.controls = new this.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.target.set(0, 1, 0);
            this.controls.enableDamping = true;

            // --- NEW: Track camera movement for WebGL Fallback ---
            this.controls.addEventListener('start', () => { this.isCameraMoving = true; });
            this.controls.addEventListener('end', () => { 
                this.isCameraMoving = false; 
                this.needsPtReset = true; 
            });
            
            this.controls.addEventListener('change', () => {
                this.needsPtReset = true; 
                if (this.selected && this.selected.type === 'camera' && this.uiTransformInputs) {
                    const isTyping = Object.values(this.uiTransformInputs).some(inp => inp === document.activeElement);
                    if (!isTyping) this.updateTransformUIFromObject();
                }
            });

            this.transformControls = new this.TransformControls(this.camera, this.renderer.domElement);
            
            this.transformControls.addEventListener('dragging-changed', (event) => {
                this.controls.enabled = !event.value && !this.isCameraOverride;
            });
            
            this.transformControls.addEventListener('change', () => {
                this.updateTransformUIFromObject();
                this.needsPtReset = true; // Just clear the noise when the gizmo rotates
            });

            // THIS PREVENTS THE FREEZE: Only rebuild BVH when an object is actually moved!
            this.transformControls.addEventListener('objectChange', () => {
                this.needsPtBvhUpdate = true;  
                this.needsPtReset = true;
            });
            
            this.scene.add(this.transformControls);

            this.raycaster = new this.THREE.Raycaster();
            this.mouse = new this.THREE.Vector2();
            this.pointerDownPos = new this.THREE.Vector2();

            viewportDiv.addEventListener('pointerdown', (e) => {
                this.pointerDownPos.set(e.clientX, e.clientY);
            });

            viewportDiv.addEventListener('pointerup', (e) => {
                if (e.target !== this.renderer.domElement) return;
                if (this.transformControls.dragging || this.transformControls.axis) return;
                
                const dist = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);
                if (dist > 5) return;

                const rect = viewportDiv.getBoundingClientRect();
                this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

                this.raycaster.setFromCamera(this.mouse, this.camera);

                const interactables = [];
                const objMap = new Map();

                this.characters.forEach(c => {
                    if (c.scene.visible) {
                        interactables.push(c.scene);
                        c.scene.traverse(child => { if(child.isMesh || child.isSkinnedMesh) objMap.set(child, { obj: c, type: 'character', id: c.id }); });
                    }
                });
                
                this.environments.forEach(env => {
                    if (env.group.visible) {
                        interactables.push(env.group);
                        env.group.traverse(child => { if(child.isMesh || child.isSkinnedMesh || child.isPoints) objMap.set(child, { obj: env, type: 'environment', id: env.id }); });
                    }
                });
                
                this.lights.forEach(l => {
                    if (l.helper && l.helper.visible) {
                        interactables.push(l.helper);
                        l.helper.traverse(child => { objMap.set(child, { obj: l, type: 'light', id: l.id }); });
                    }
                });

                const intersects = this.raycaster.intersectObjects(interactables, true);
                const hit = intersects.find(i => i.object.visible);

                if (hit && objMap.has(hit.object)) {
                    const match = objMap.get(hit.object);
                    this.selectObject(match.obj, match.type, match.id);
                } else {
                    this.selectObject(null, null, null);
                }
            });

            await this.fetchAnimations();
            await this.fetchEnvs();
            await this.fetchCams(); 
            await this.fetchMocaps(); 
            await this.fetchRigs();
            await this.fetchHdris();

            this.setupHeader(headerDiv);
            this.setupTimeline(timelineDiv);
            this.buildGizmoPanel(viewportDiv);
            this.buildViewNav(viewportDiv);
            this.buildSidebar();
            
            // Build the help & load modals right after layout is structured
            this.buildHelpModal(this.container);
            this.buildLoadModal(this.container);

            this.addLight("ambient");
            this.addLight("directional");
            const dl = this.lights[1].group;
            dl.position.set(2, 4, 3);
            dl.lookAt(0, 0, 0); 
            
            await this.loadRig("Yedp_Rig.glb");
            if (!this.node.saved_scene_state) {
                await this.addCharacter("Yedp_Rig.glb");
            }
            
            this.hookNodeWidgets();

            this.resizeObserver = new ResizeObserver(() => this.onResize(viewportDiv));
            this.resizeObserver.observe(viewportDiv);

            this.isInitialized = true;
            if (this.node.saved_scene_state) {
                await this.loadScene(this.node.saved_scene_state);
            }

            this.animate();

        } catch (e) {
            this.container.innerHTML = '';
            const errDiv = document.createElement('div');
            Object.assign(errDiv.style, { color: 'red', padding: '20px' });
            errDiv.textContent = 'Init Error: ' + e.message;
            this.container.appendChild(errDiv);
        }
    }

    buildHelpModal(container) {
        this.helpModal = document.createElement("div");
        Object.assign(this.helpModal.style, {
            position: "absolute", top: "0", left: "0", width: "100%", height: "100%",
            backgroundColor: "rgba(0, 0, 0, 0.8)", zIndex: "9999",
            display: "none", justifyContent: "center", alignItems: "center", backdropFilter: "blur(4px)"
        });

        const contentBox = document.createElement("div");
        Object.assign(contentBox.style, {
            width: "80%", maxWidth: "800px", height: "85%", backgroundColor: "#1a1a1a",
            border: "1px solid #444", borderRadius: "8px", display: "flex", flexDirection: "column",
            boxShadow: "0 10px 40px rgba(0,0,0,0.8)", overflow: "hidden"
        });

        const header = document.createElement("div");
        Object.assign(header.style, {
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "12px 20px", borderBottom: "1px solid #333", backgroundColor: "#222"
        });
        header.innerHTML = `<span style="color:#00d2ff; font-weight:bold; font-size:16px;">🎬 Yedp Action Director - User Manual</span>`;

        const closeBtn = document.createElement("button");
        closeBtn.innerText = "✖";
        Object.assign(closeBtn.style, {
            background: "transparent", border: "none", color: "#ccc", cursor: "pointer", fontSize: "16px", padding: "4px"
        });
        closeBtn.onmouseover = () => closeBtn.style.color = "#fff";
        closeBtn.onmouseout = () => closeBtn.style.color = "#ccc";
        closeBtn.onclick = () => this.helpModal.style.display = "none";
        header.appendChild(closeBtn);

        const body = document.createElement("div");
        body.className = "manual-body";
        Object.assign(body.style, {
            padding: "24px", overflowY: "auto", color: "#ccc", fontSize: "13px", lineHeight: "1.6", fontFamily: "sans-serif"
        });
        
        // Let's populate an empty loading state
        body.innerHTML = `<div style="text-align:center; padding: 40px; color:#888;">Loading manual...</div>`;

        contentBox.append(header, body);
        this.helpModal.appendChild(contentBox);
        container.appendChild(this.helpModal);

        // Close when clicking outside the box
        this.helpModal.addEventListener('click', (e) => {
            if(e.target === this.helpModal) this.helpModal.style.display = "none";
        });
    }

    buildLoadModal(container) {
        this.loadModal = document.createElement("div");
        Object.assign(this.loadModal.style, {
            position: "absolute", top: "0", left: "0", width: "100%", height: "100%",
            backgroundColor: "rgba(0, 0, 0, 0.8)", zIndex: "9999",
            display: "none", justifyContent: "center", alignItems: "center", backdropFilter: "blur(4px)"
        });

        const contentBox = document.createElement("div");
        Object.assign(contentBox.style, {
            width: "400px", maxHeight: "80%", backgroundColor: "#1a1a1a",
            border: "1px solid #444", borderRadius: "8px", display: "flex", flexDirection: "column",
            boxShadow: "0 10px 40px rgba(0,0,0,0.8)", overflow: "hidden"
        });

        const header = document.createElement("div");
        Object.assign(header.style, {
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "12px 20px", borderBottom: "1px solid #333", backgroundColor: "#222"
        });
        header.innerHTML = `<span style="color:#00d2ff; font-weight:bold; font-size:16px;">📂 Load Scene</span>`;

        const closeBtn = document.createElement("button");
        closeBtn.innerText = "✖";
        Object.assign(closeBtn.style, {
            background: "transparent", border: "none", color: "#ccc", cursor: "pointer", fontSize: "16px", padding: "4px"
        });
        closeBtn.onmouseover = () => closeBtn.style.color = "#fff";
        closeBtn.onmouseout = () => closeBtn.style.color = "#ccc";
        closeBtn.onclick = () => this.loadModal.style.display = "none";
        header.appendChild(closeBtn);

        const body = document.createElement("div");
        body.className = "load-body";
        Object.assign(body.style, {
            padding: "16px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px"
        });

        contentBox.append(header, body);
        this.loadModal.appendChild(contentBox);
        container.appendChild(this.loadModal);

        this.loadModal.addEventListener('click', (e) => {
            if(e.target === this.loadModal) this.loadModal.style.display = "none";
        });
    }

    async showLoadModal() {
        if (!this.loadModal) return;
        const body = this.loadModal.querySelector('.load-body');
        body.innerHTML = `<div style="color:#888; text-align:center;">Fetching saved scenes...</div>`;
        this.loadModal.style.display = "flex";
        
        try {
            const res = await api.fetchApi("/yedp/get_ad_scenes");
            const data = await res.json();
            body.innerHTML = "";
            
            if (!data.files || data.files.length === 0) {
                body.innerHTML = `<div style="color:#888; text-align:center;">No saved scenes found in input/yedp_scenes.</div>`;
                return;
            }
            
            data.files.reverse().forEach(file => {
                const btn = document.createElement("button");
                btn.innerText = file;
                Object.assign(btn.style, {
                    background: "#222", border: "1px solid #444", color: "#ccc", padding: "10px",
                    borderRadius: "4px", cursor: "pointer", textAlign: "left", fontSize: "13px",
                    transition: "background 0.2s", fontFamily: "monospace"
                });
                btn.onmouseover = () => btn.style.background = "#333";
                btn.onmouseout = () => btn.style.background = "#222";
                btn.onclick = async () => {
                    const origText = btn.innerText;
                    btn.innerText = "Loading...";
                    btn.style.color = "#00d2ff";
                    try {
                        const url = `/view?filename=${encodeURIComponent(file)}&type=input&subfolder=yedp_scenes&t=${Date.now()}`;
                        const req = await fetch(url);
                        const sceneJsonStr = await req.text(); 
                        await this.loadScene(sceneJsonStr);
                        this.loadModal.style.display = "none";
                    } catch(e) {
                        console.error("Load failed:", e);
                        btn.innerText = "Failed to load!";
                        btn.style.color = "#ff5555";
                        setTimeout(() => { btn.innerText = origText; btn.style.color = "#ccc"; }, 2000);
                    }
                };
                body.appendChild(btn);
            });
        } catch (e) {
            body.innerHTML = `<div style="color:#ff5555; text-align:center;">Failed to fetch scenes list.</div>`;
        }
    }

    createRimTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 256;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, 256, 256);
        const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
        
        grad.addColorStop(0.0, '#000000'); 
        grad.addColorStop(0.88, '#000000'); 
        grad.addColorStop(0.90, '#ffffff'); 
        grad.addColorStop(1.0, '#ffffff'); 
        
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(128, 128, 128, 0, Math.PI * 2); ctx.fill();
        const tex = new this.THREE.CanvasTexture(canvas);
        tex.colorSpace = this.THREE.SRGBColorSpace;
        return tex;
    }

    // --- COMfyUI STATE SERIALIZATION ---
    serializeScene() {
        if (!this.camera || !this.controls) return null; // SAFETY CHECK

        return JSON.stringify({
            version: 3,
            camera: {
                pos: this.camera.position.toArray(),
                rot: this.camera.rotation.toArray(),
                target: this.controls.target.toArray(),
                fov: this.perspCam.fov,
                isOrtho: this.isOrthographic,
                camOverrideOffset: this.camOverrideOffset,
                camOverrideScale: this.camOverrideScale,
                isCameraOverride: this.isCameraOverride,
                defaultNear: this.defaultNear,
                defaultFar: this.defaultFar,
                camKeys: {
                    start: this.camKeys.start ? { pos: this.camKeys.start.pos.toArray(), quat: this.camKeys.start.quat.toArray(), zoom: this.camKeys.start.zoom } : null,
                    end: this.camKeys.end ? { pos: this.camKeys.end.pos.toArray(), quat: this.camKeys.end.quat.toArray(), zoom: this.camKeys.end.zoom } : null,
                    ease: this.camKeys.ease
                }
            },
            lights: this.lights.map(l => ({
                type: l.type, color: l.color, intensity: l.intensity,
                range: l.range, angle: l.angle, castShadow: l.castShadow,
                pos: l.group.position.toArray(), rot: l.group.rotation.toArray()
            })),
            characters: this.characters.map(c => ({
                pos: c.scene.position.toArray(), rot: c.scene.rotation.toArray(), scl: c.scene.scale.toArray(),
                gender: c.gender, loop: c.loop, 
                useRootMotion: c.useRootMotion, 
                blendDuration: c.blendDuration !== undefined ? c.blendDuration : 0.5,
                animSequence: c.animSequence.map(a => a.file), 
                animFile: c.animSequence.length > 0 ? c.animSequence[0].file : "none", // Legacy fallback
                showFace: c.showFace, faceScale: c.faceScale,
                rigFile: c.rigFile
            })),
            environments: this.environments.map(e => ({
                pos: e.group.position.toArray(), rot: e.group.rotation.toArray(), scl: e.group.scale.toArray(),
                loop: e.loop, envFile: e.envFile, forceSplat: e.forceSplat !== undefined ? e.forceSplat : null
            })),
            mocap: {
                recordings: [], 
                bindings: this.mocapBindings
            },
            settings: {
                isShadedMode: this.isShadedMode,
                isDepthMode: this.isDepthMode,
                isTexturedMode: this.isTexturedMode,
                userNear: this.userNear,
                userFar: this.userFar,
                customCamAnim: this.container.querySelector("#sel-cam-anim")?.value || "none",
                isPathTracingEnabled: this.isPathTracingEnabled,
                ptPreviewSamples: this.ptPreviewSamples,
                ptBakeSamples: this.ptBakeSamples,
                hdriFile: this.hdriFile || "none",
                isHdriEnabled: this.isHdriEnabled,
                isHdriBgEnabled: this.isHdriBgEnabled,
                hdriRotation: this.hdriRotation,
                hdriIntensity: this.hdriIntensity
            }
        });
    }

    async loadScene(stateStr) {
        if (!stateStr) return;
        try {
            console.log("[Yedp] Loading saved scene state from ComfyUI Workflow...");
            const state = JSON.parse(stateStr);
            
            const oldChars = [...this.characters]; oldChars.forEach(c => this.removeCharacter(c.id));
            const oldEnvs = [...this.environments]; oldEnvs.forEach(e => this.removeEnvironment(e.id));
            const oldLights = [...this.lights]; oldLights.forEach(l => this.removeLight(l.id));

            if (state.settings) {
                this.isShadedMode = state.settings.isShadedMode ?? false;
                this.isDepthMode = state.settings.isDepthMode ?? false;
                this.isTexturedMode = state.settings.isTexturedMode ?? false;
                this.userNear = state.settings.userNear ?? 0.1;
                this.userFar = state.settings.userFar ?? 10.0;
                
                const chkT = this.container.querySelector("#chk-textured"); if(chkT) chkT.checked = this.isTexturedMode;
                const chkS = this.container.querySelector("#chk-shaded"); if(chkS) chkS.checked = this.isShadedMode;
                const chkD = this.container.querySelector("#chk-depth"); if(chkD) chkD.checked = this.isDepthMode;
                const inpN = this.container.querySelector("#inp-near"); if(inpN) inpN.value = this.userNear;
                const inpF = this.container.querySelector("#inp-far"); if(inpF) inpF.value = this.userFar;
                if (this.isDepthMode) this.container.querySelector("#depth-ctrls").style.opacity = "1.0";
                this.isPathTracingEnabled = state.settings.isPathTracingEnabled ?? false;
                const chkPt = this.container.querySelector("#chk-pt-en"); if(chkPt) chkPt.checked = this.isPathTracingEnabled;
                
                this.ptPreviewSamples = state.settings.ptPreviewSamples ?? 32;
                this.ptBakeSamples = state.settings.ptBakeSamples ?? 128;
                // Note: If you want the sliders to visually update their numbers, you can select them by creating IDs for them too, 
                // but they will respect the internal variables regardless.
                
                this.isHdriEnabled = state.settings.isHdriEnabled ?? false;
                const chkHdriEn = this.container.querySelector("#chk-hdri-en"); if(chkHdriEn) chkHdriEn.checked = this.isHdriEnabled;
                
                this.isHdriBgEnabled = state.settings.isHdriBgEnabled ?? false;
                const chkHdriBg = this.container.querySelector("#chk-hdri-bg"); if(chkHdriBg) chkHdriBg.checked = this.isHdriBgEnabled;
                
                this.hdriRotation = state.settings.hdriRotation ?? 0;
                const sldRot = this.container.querySelector("#sld-hdri-rot"); if(sldRot) sldRot.value = this.hdriRotation;
                const inpRot = this.container.querySelector("#inp-hdri-rot"); if(inpRot) inpRot.value = this.hdriRotation;
                
                this.hdriIntensity = state.settings.hdriIntensity !== undefined ? state.settings.hdriIntensity : 1.0;
                const inpInt = this.container.querySelector("#inp-hdri-int"); if(inpInt) inpInt.value = this.hdriIntensity;
                
                this.hdriFile = state.settings.hdriFile || "none";
                const selHdriUI = this.container.querySelector("#sel-hdri"); if(selHdriUI) selHdriUI.value = this.hdriFile;
                
                if (this.hdriFile !== "none") {
                    this.loadHDRI(this.hdriFile);
                }
            }

            if (state.camera) {
                this.defaultNear = state.camera.defaultNear !== undefined ? state.camera.defaultNear : 0.1;
                this.defaultFar = state.camera.defaultFar !== undefined ? state.camera.defaultFar : 100.0;

                const valNear = this.container.querySelector("#inp-cam-near-val"); if(valNear) valNear.value = this.defaultNear;
                const valFar = this.container.querySelector("#inp-cam-far-val"); if(valFar) valFar.value = this.defaultFar;
                const valMm = this.container.querySelector("#inp-cam-mm-val"); if(valMm) valMm.value = Math.round(this.perspCam.getFocalLength());

                this.isOrthographic = state.camera.isOrtho || false;
                const chkOrtho = this.container.querySelector("#chk-ortho"); if(chkOrtho) chkOrtho.checked = this.isOrthographic;
                
                this.perspCam.fov = state.camera.fov || 45;
                const fovSld = this.container.querySelector("#inp-cam-fov-sld"); if(fovSld) fovSld.value = this.perspCam.fov;
                const fovVal = this.container.querySelector("#inp-cam-fov-val"); if(fovVal) fovVal.value = this.perspCam.fov;
                this.perspCam.updateProjectionMatrix();

                this.camera = this.isOrthographic ? this.orthoCam : this.perspCam;
                this.camera.position.fromArray(state.camera.pos || [0, 1.2, 4]);
                this.camera.rotation.fromArray(state.camera.rot || [0, 0, 0]);
                
                if (state.camera.target) this.controls.target.fromArray(state.camera.target);
                else {
                    const forward = new this.THREE.Vector3(0, 0, -1).applyEuler(this.camera.rotation);
                    this.controls.target.copy(this.camera.position).add(forward.multiplyScalar(4));
                }
                
                this.camOverrideOffset = state.camera.camOverrideOffset || { rx:0, ry:0, rz:0 };
                this.camOverrideScale = state.camera.camOverrideScale || 1.0;
                this.cameraAnimGroup.scale.setScalar(this.camOverrideScale);
                
                const inpRx = this.container.querySelector("#inp-cam-rx"); if(inpRx) inpRx.value = this.camOverrideOffset.rx;
                const inpRy = this.container.querySelector("#inp-cam-ry"); if(inpRy) inpRy.value = this.camOverrideOffset.ry;
                const inpRz = this.container.querySelector("#inp-cam-rz"); if(inpRz) inpRz.value = this.camOverrideOffset.rz;
                const inpSc = this.container.querySelector("#inp-cam-scl"); if(inpSc) inpSc.value = this.camOverrideScale;

                this.isCameraOverride = state.camera.isCameraOverride || false;
                const chkOvr = this.container.querySelector("#cam-override-chk"); if(chkOvr) chkOvr.checked = this.isCameraOverride;
                this.controls.enabled = !this.isCameraOverride;
                
                if (state.camera.camKeys) {
                    this.camKeys.ease = state.camera.camKeys.ease || 'linear';
                    if (state.camera.camKeys.start) {
                        this.camKeys.start = { pos: new this.THREE.Vector3().fromArray(state.camera.camKeys.start.pos), quat: new this.THREE.Quaternion().fromArray(state.camera.camKeys.start.quat), zoom: state.camera.camKeys.start.zoom || 1 };
                    }
                    if (state.camera.camKeys.end) {
                        this.camKeys.end = { pos: new this.THREE.Vector3().fromArray(state.camera.camKeys.end.pos), quat: new this.THREE.Quaternion().fromArray(state.camera.camKeys.end.quat), zoom: state.camera.camKeys.end.zoom || 1 };
                    }
                }
                this.controls.object = this.camera;
                this.controls.update();
            }

            if (state.settings && state.settings.customCamAnim && state.settings.customCamAnim !== "none") {
                const selCam = this.container.querySelector("#sel-cam-anim");
                if (selCam) selCam.value = state.settings.customCamAnim;
                await this.loadCameraAnim(state.settings.customCamAnim);
            }

            if (state.lights) {
                state.lights.forEach(l => {
                    this.addLight(l.type);
                    const newL = this.lights[this.lights.length - 1];
                    newL.color = l.color; newL.intensity = l.intensity; newL.range = l.range; newL.angle = l.angle; newL.castShadow = l.castShadow;
                    newL.group.position.fromArray(l.pos); newL.group.rotation.fromArray(l.rot);
                    this.updateLightType(newL);
                });
            }

            // Restore Characters & their Sequence!
            if (state.characters) {
                for (const cData of state.characters) {
                    await this.addCharacter(cData.rigFile || "Yedp_Rig.glb");
                    const newC = this.characters[this.characters.length - 1];
                    if (!newC) continue;
                    
                    newC.scene.position.fromArray(cData.pos);
                    newC.scene.rotation.fromArray(cData.rot);
                    newC.scene.scale.fromArray(cData.scl);
                    newC.gender = cData.gender || 'M';
                    newC.loop = cData.loop !== false;
                    newC.useRootMotion = cData.useRootMotion || false; 
                    newC.blendDuration = cData.blendDuration !== undefined ? cData.blendDuration : 0.5;
                    newC.showFace = cData.showFace !== false;
                    newC.faceScale = cData.faceScale !== undefined ? cData.faceScale : 1.0;
                    
                    newC.opFaceBones.forEach(b => { if(b) b.scale.setScalar(newC.faceScale); });
                    
                    newC.animSequence = []; // Clear the default added item
                    
                    if (cData.animSequence && cData.animSequence.length > 0) {
                        for (const f of cData.animSequence) {
                            const item = newC.addSequenceItem(f);
                            if (f !== "none") await this.loadSequenceAnim(newC, item, f);
                        }
                    } else if (cData.animFile && cData.animFile !== "none") {
                        const item = newC.addSequenceItem(cData.animFile);
                        await this.loadSequenceAnim(newC, item, cData.animFile);
                    } else {
                        newC.addSequenceItem("none");
                    }
                }
            }

            if (state.environments) {
                for (const eData of state.environments) {
                    this.addEnvironment();
                    const newE = this.environments[this.environments.length - 1];
                    newE.group.position.fromArray(eData.pos);
                    newE.group.rotation.fromArray(eData.rot);
                    newE.group.scale.fromArray(eData.scl);
                    newE.loop = eData.loop !== false;
                    newE.forceSplat = eData.forceSplat !== undefined ? eData.forceSplat : null;
                    if (eData.envFile && eData.envFile !== "none") await this.loadEnvironmentFile(newE, eData.envFile);
                }
            }
            
            if (state.mocap) {
                this.mocapBindings = (state.mocap.bindings || []).map(b => ({
                    id: b.id, charId: b.charId, mocapId: b.mocapId,
                    amplitude: b.amplitude !== undefined ? b.amplitude : (b.scale !== undefined ? b.scale : 1.0),
                    loop: b.loop !== undefined ? b.loop : true
                }));
                if(this.mocapBindings.length > 0) {
                    this.mocapBindingCounter = Math.max(...this.mocapBindings.map(b => b.id)) + 1;
                }
            }

            this.updateVisibilities();
            this.renderCharacterCards();
            this.renderEnvironmentCards();
            this.renderLightCards();
            this.syncMocapDropdowns();
            this.renderMocapBindings();
            this.forceUpdateFrame();
            

        } catch (e) {
            console.error("[Yedp] Failed to load saved scene state:", e);
        }
    }

    forceUpdateFrame() {
        const totalFrames = this.getWidgetValue("frame_count", 48);
        const slider = this.container.querySelector("#t-slider");
        const currentFrame = slider ? parseInt(slider.value) : 0;
        
        const timeLabel = this.container.querySelector("#t-time");
        if (timeLabel) timeLabel.innerText = `${currentFrame} / ${totalFrames}`;

        this.evaluateAnimations(this.globalTime);
        this.applyCameraKeyframes(currentFrame / Math.max(1, totalFrames - 1));
        
        this.characters.forEach(c => c.scene.updateMatrixWorld(true));
        this.environments.forEach(e => e.group.updateMatrixWorld(true));
        
        if (this.controls && !this.isCameraOverride) this.controls.update();

        // --- NEW: Path Tracer Update Flags ---
        this.needsPtReset = true;
        this.needsPtBvhUpdate = true;
        if (this.ptRenderer && this.ptRenderer.scene) this.ptRenderer.updateLights();
        // -------------------------------------
    }

    // --- UI SETUP ---
    setupHeader(div) {
        div.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px;">
                <label style="color:#ccc; font-size:11px; cursor:pointer;"><input type="checkbox" id="chk-textured"> Textured</label>
                <div style="width:1px; height:16px; background:#444;"></div>
                <label style="color:#ccc; font-size:11px; cursor:pointer;"><input type="checkbox" id="chk-shaded"> Shaded</label>
                <div style="width:1px; height:16px; background:#444;"></div>
                <label style="color:#ccc; font-size:11px; cursor:pointer;"><input type="checkbox" id="chk-depth"> Depth</label>
                <div id="depth-ctrls" style="display:flex; align-items:center; gap:4px; opacity:0.5; transition:opacity 0.2s;">
                    <span style="color:#4ade80; font-size:10px; font-weight:bold;">NEAR:</span>
                    <input id="inp-near" type="number" step="0.1" value="0.1" style="width:40px; background:#111; color:#4ade80; border:1px solid #4ade80; font-size:10px; padding:1px 2px; border-radius:2px; font-weight:bold;">
                    <span style="color:#4ade80; font-size:10px; font-weight:bold; margin-left:4px;">FAR:</span>
                    <input id="inp-far" type="number" step="0.5" value="10.0" style="width:40px; background:#111; color:#4ade80; border:1px solid #4ade80; font-size:10px; padding:1px 2px; border-radius:2px; font-weight:bold;">
                </div>
                <div style="width:1px; height:16px; background:#444;"></div>
                <label style="color:#666; font-size:11px; cursor:pointer;"><input type="checkbox" id="chk-skel" checked> Skel</label>
            </div>
            <div style="display:flex; gap:4px; align-items:center;">
                <span id="lbl-res" style="color:#00d2ff; font-family:monospace; font-size:10px; margin-right:5px; align-self:center;">512x512</span>
                <button id="btn-save-scene" style="border:1px solid #00d2ff; color:#00d2ff; background:transparent; padding:0px 6px; font-size:10px; cursor:pointer; border-radius:3px;" title="Save Scene to Disk">💾 SAVE</button>
                <button id="btn-load-scene" style="border:1px solid #00d2ff; color:#00d2ff; background:transparent; padding:0px 6px; font-size:10px; cursor:pointer; border-radius:3px;" title="Load Scene from Disk">📂 LOAD</button>
                <div style="width:1px; height:16px; background:#444; margin:0 2px;"></div>
                <button id="btn-refresh" style="border:1px solid #4ade80; color:#4ade80; background:transparent; padding:0px 6px; font-size:10px; cursor:pointer; border-radius:3px;" title="Refresh Files">↻ SYNC FOLDERS</button>
                <button id="btn-bake-frame" style="border:1px solid #ffaa00; color:#ffaa00; background:transparent; padding:0px 6px; font-size:10px; cursor:pointer; border-radius:3px;">BAKE FRAME</button>
                <button id="btn-bake" style="border:1px solid #ff0055; color:#ff0055; background:transparent; padding:0px 6px; font-size:10px; cursor:pointer; border-radius:3px;">BAKE V9.3</button>
            </div>
        `;

        const chkTextured = div.querySelector("#chk-textured");
        const chkShaded = div.querySelector("#chk-shaded");
        const chkDepth = div.querySelector("#chk-depth");

        chkTextured.onchange = (e) => {
            if (e.target.checked) {
                chkShaded.checked = false; chkDepth.checked = false;
                this.isShadedMode = false; this.isDepthMode = false;
                div.querySelector("#depth-ctrls").style.opacity = "0.5";
            }
            this.isTexturedMode = e.target.checked;
            this.updateVisibilities();
            this.forceUpdateFrame();
        }

        chkShaded.onchange = (e) => { 
            if (e.target.checked) {
                chkTextured.checked = false; chkDepth.checked = false;
                this.isTexturedMode = false; this.isDepthMode = false;
                div.querySelector("#depth-ctrls").style.opacity = "0.5";
            }
            this.isShadedMode = e.target.checked; 
            this.updateVisibilities(); 
            this.forceUpdateFrame();
        };
        
        chkDepth.onchange = (e) => {
            if (e.target.checked) {
                chkTextured.checked = false; chkShaded.checked = false;
                this.isTexturedMode = false; this.isShadedMode = false;
            }
            this.isDepthMode = e.target.checked;
            div.querySelector("#depth-ctrls").style.opacity = this.isDepthMode ? "1.0" : "0.5";
            this.updateVisibilities();
            this.forceUpdateFrame();
        };

        const stop = e => e.stopPropagation();
        const inpNear = div.querySelector("#inp-near");
        inpNear.onchange = (e) => { this.userNear = parseFloat(e.target.value); if(this.isDepthMode) { this.updateCameraBounds(); this.forceUpdateFrame(); } };
        inpNear.addEventListener('keydown', stop); inpNear.addEventListener('mousedown', stop);

        const inpFar = div.querySelector("#inp-far");
        inpFar.onchange = (e) => { this.userFar = parseFloat(e.target.value); if(this.isDepthMode) { this.updateCameraBounds(); this.forceUpdateFrame(); } };
        inpFar.addEventListener('keydown', stop); inpFar.addEventListener('mousedown', stop);

        div.querySelector("#chk-skel").onchange = (e) => {
            this.characters.forEach(c => { if(c.skeletonHelper) c.skeletonHelper.visible = e.target.checked; });
            this.forceUpdateFrame();
        };

        // --- PHYSICAL SAVE/LOAD LOGIC ---
        div.querySelector("#btn-save-scene").onclick = async () => {
            const date = new Date();
            const defaultName = `Scene_${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}_${String(date.getHours()).padStart(2,'0')}-${String(date.getMinutes()).padStart(2,'0')}`;
            const name = prompt("Enter a name for your save file:", defaultName);
            if (!name) return;
        
            let safeName = name.replace(/[\/\\:*?"<>|]+/g, '_').substring(0, 128);
            if (!safeName.toLowerCase().endsWith('.json')) {
            safeName += '.json';
            }
            
            const btn = div.querySelector("#btn-save-scene");
            btn.innerText = "SAVING...";
            try {
                const sceneData = this.serializeScene();
                const res = await api.fetchApi("/yedp/save_ad_scene", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: safeName, data: sceneData })
                });
                const result = await res.json();
                if (result.status === "success") {
                    btn.innerText = "SAVED ✓";
                    setTimeout(() => btn.innerText = "💾 SAVE", 2000);
                } else {
                    alert("Failed to save scene.");
                    btn.innerText = "💾 SAVE";
                }
            } catch (e) {
                console.error(e);
                alert("Error saving scene.");
                btn.innerText = "💾 SAVE";
            }
        };

        div.querySelector("#btn-load-scene").onclick = () => this.showLoadModal();
        
        div.querySelector("#btn-refresh").onclick = async () => {
            const btn = div.querySelector("#btn-refresh");
            btn.innerText = "SYNCING...";
            await this.fetchAnimations();
            await this.fetchEnvs();
            await this.fetchCams();
            await this.fetchMocaps();
            await this.fetchRigs();
            await this.fetchHdris();
            
            this.renderCharacterCards();
            this.renderEnvironmentCards();

            // update the HDRI dropdown:
            const selHdriUI = this.container.querySelector("#sel-hdri");
            if (selHdriUI) {
                const currentHdri = selHdriUI.value;
                selHdriUI.innerHTML = "";
                this.availableHdris.forEach(h => selHdriUI.add(new Option(h, h)));
                selHdriUI.value = this.availableHdris.includes(currentHdri) ? currentHdri : "none";
            }
            
            const selCam = this.container.querySelector("#sel-cam-anim");
            if (selCam) {
                const currentVal = selCam.value;
                selCam.innerHTML = "";
                this.availableCams.forEach(anim => selCam.add(new Option(anim, anim)));
                selCam.value = this.availableCams.includes(currentVal) ? currentVal : "none";
            }
            
            btn.innerText = "↻ SYNC FOLDERS";
        };

        div.querySelector("#btn-bake-frame").onclick = () => this.performBake(true);
        div.querySelector("#btn-bake").onclick = () => this.performBake(false);
    }

    setupTimeline(div) {
        div.innerHTML = `
            <div style="display:flex; width:100%; align-items:center; gap:5px;">
                <button id="btn-play" style="background:none;border:none;color:#fff;cursor:pointer;width:20px;">▶</button>
                <input type="range" id="t-slider" min="0" max="100" value="0" step="1" style="flex:1;cursor:pointer;">
                <span id="t-time" style="font-family:monospace;font-size:10px;color:#888;min-width:70px;text-align:right;">0 / 0</span>
            </div>`;
        
        const btn = div.querySelector("#btn-play");
        const slider = div.querySelector("#t-slider");
        
        // Cache DOM refs for the animation loop
        this._sliderEl = slider;
        this._timeLabelEl = div.querySelector("#t-time");
        
        btn.onclick = () => { this.isPlaying = !this.isPlaying; btn.innerText = this.isPlaying ? "⏸" : "▶"; };
        slider.onmousedown = () => { this.isDraggingSlider = true; this.isPlaying = false; btn.innerText = "▶"; };
        slider.onmouseup = () => { this.isDraggingSlider = false; };
        
        slider.oninput = (e) => {
            const frame = parseInt(e.target.value);
            const fps = this.getWidgetValue("fps", 24);
            this.globalTime = frame / fps;
            this.forceUpdateFrame();
        };
    }

    // --- ANIMATION SCHEDULER (NEW!) ---
    updateSequenceSchedule(c) {
        const seq = c.animSequence.filter(a => a.action && a.duration > 0);
        if (seq.length === 0) {
            c.duration = 0;
            return;
        }
        if (seq.length === 1) {
            seq[0].startTime = 0;
            seq[0].blendIn = 0;
            seq[0].blendOut = 0;
            c.duration = seq[0].duration;
            return;
        }

        const maxBlend = c.blendDuration !== undefined ? c.blendDuration : 0.5;
        let currentTime = 0;

        // Pass 1: Calculate the outgoing blend limits
        for (let i = 0; i < seq.length; i++) {
            const current = seq[i];
            const next = seq[(i + 1) % seq.length];
            
            let b = Math.min(maxBlend, current.duration / 2, next.duration / 2);
            if (!c.loop && i === seq.length - 1) b = 0; // Final clip shouldn't blend out to void
            
            current.blendOut = b;
        }
        
        // Pass 2: Transfer outgoing blend limits to the next incoming clip
        for (let i = 0; i < seq.length; i++) {
            const prev = seq[(i - 1 + seq.length) % seq.length];
            seq[i].blendIn = prev.blendOut;
            if (!c.loop && i === 0) seq[i].blendIn = 0; // First clip shouldn't blend in from void
        }

        // Pass 3: Map sequence absolutely to timeline
        for (let i = 0; i < seq.length; i++) {
            seq[i].startTime = currentTime;
            currentTime += seq[i].duration - seq[i].blendOut;
        }
        
        // Final Duration Definition
        if (c.loop) {
            // For perfectly looping, the timeline wraps cleanly exactly when the blend out starts!
            c.duration = currentTime;
        } else {
            const last = seq[seq.length - 1];
            c.duration = last.startTime + last.duration;
        }
    }

    evaluateAnimations(t) {
        // Evaluate Sequenced Animation Rig
        this.characters.forEach(c => {
            if (c.animSequence && c.animSequence.length > 0 && c.duration > 0) {
                const seq = c.animSequence.filter(a => a.action && a.duration > 0);
                const t_eval = c.loop ? (t % c.duration) : Math.min(t, c.duration);
                
                let maxWeight = -1;
                let domItem = null;
                let domTau = 0;
                
                seq.forEach((item, i) => {
                    let tau = t_eval - item.startTime;
                    
                    if (c.loop) {
                        tau = tau % c.duration;
                        if (tau < 0) tau += c.duration;
                    } else {
                        if (i === seq.length - 1 && tau >= item.duration - 0.001) {
                            tau = Math.max(0, item.duration - 0.001); 
                        }
                    }
                    
                    if (tau >= -0.001 && tau <= item.duration + 0.001) {
                        tau = Math.max(0, Math.min(item.duration, tau)); 
                        let weight = 1.0;
                        
                        if (item.blendIn > 0 && tau <= item.blendIn) {
                            weight = tau / item.blendIn;
                        }
                        if (item.blendOut > 0 && tau >= item.duration - item.blendOut) {
                            weight = Math.min(weight, (item.duration - tau) / item.blendOut);
                        }
                        
                        if (weight > maxWeight) {
                            maxWeight = weight;
                            domItem = item;
                            domTau = tau;
                        }
                        
                        item.action.time = tau;
                        item.action.setEffectiveWeight(weight);
                    } else {
                        item.action.setEffectiveWeight(0);
                    }
                });
                
                c.mixer.update(0); 

                // ROOT MOTION LOGIC
                if (c.rootBone) {
                    if (t === 0 || (t < c.lastEvalTime && !this.isPlaying)) {
                        c.continuousPos.set(0, 0, 0);
                        c.lastDomTau = -1; 
                    }

                    if (c.useRootMotion && domItem && domItem.rootInterpolant) {
                        let rawPosArr = domItem.rootInterpolant.evaluate(domTau);
                        this._tmpVec3A.set(rawPosArr[0], rawPosArr[1], rawPosArr[2]);
                        let currentRawPos = this._tmpVec3A;
                        
                        if (c.lastDomItem !== domItem || domTau < c.lastDomTau - 0.01 || Math.abs(domTau - c.lastDomTau) > 0.5) {
                            c.lastRawPos.copy(currentRawPos);
                        } else {
                            let pdx = currentRawPos.x - c.lastRawPos.x;
                            let pdz = currentRawPos.z - c.lastRawPos.z;
                            c.continuousPos.x += pdx;
                            c.continuousPos.z += pdz;
                            c.lastRawPos.copy(currentRawPos);
                        }
                        
                        c.rootBone.position.set(c.continuousPos.x, c.rootBone.position.y, c.continuousPos.z);
                        
                        c.lastDomItem = domItem;
                        c.lastDomTau = domTau;
                    } else {
                        c.continuousPos.copy(c.rootBone.position);
                        c.lastRawPos.copy(c.rootBone.position);
                        c.lastDomItem = null;
                        c.lastDomTau = -1;
                    }
                    
                    c.lastEvalTime = t; 
                }
            }
        });

        this.environments.forEach(e => {
            if(e.action && e.duration > 0) { 
                let evalTime = e.loop ? (t % e.duration) : Math.max(0, Math.min(t, e.duration - 0.001));
                e.mixer.setTime(evalTime);
            }
        });
        
        // PERFECTED CAMERA UPDATE: Replaced action.time with strict mixer.setTime
        if (this.cameraAction && this.cameraMixer) {
            const d = this.cameraAction.getClip().duration;
            this.cameraMixer.setTime(t % d);
        }

        // Apply Native Face Mocaps
        this.mocapBindings.forEach(binding => {
            const char = this.characters.find(c => c.id == binding.charId);
            const mocap = this.recordedMocaps.find(m => m.id === binding.mocapId);
            
            if (!char || !mocap || mocap.frames.length === 0) return;

            let frameIdx;
            if (binding.loop !== false) {
                frameIdx = Math.floor((t % mocap.duration) * mocap.fps) % mocap.frames.length;
            } else {
                frameIdx = Math.min(Math.floor(t * mocap.fps), mocap.frames.length - 1);
            }
            
            const pArr = mocap.frames[frameIdx];
            const pArrZero = mocap.frames[0]; 

            const rigLeftEar = char.opFaceBonesRest[0];
            const rigRightEar = char.opFaceBonesRest[16];
            const rigChin = char.opFaceBonesRest[8];
            const rigNose = char.opFaceBonesRest[27]; 

            if (rigLeftEar && rigRightEar && rigChin && rigNose) {
                const rigWidth = rigLeftEar.distanceTo(rigRightEar) || 13.8;
                const rigHeight = rigChin.distanceTo(rigNose) || 15.0;

                const mpZero = mocap.frames[0];
                const mpWidth = Math.hypot(mpZero[16].x - mpZero[0].x, mpZero[16].y - mpZero[0].y, mpZero[16].z - mpZero[0].z) || 1.0;
                const mpHeight = Math.hypot(mpZero[27].x - mpZero[8].x, mpZero[27].y - mpZero[8].y, mpZero[27].z - mpZero[8].z) || 1.0;

                const amp = binding.amplitude !== undefined ? binding.amplitude : 1.0;
                const scaleX = (rigWidth / mpWidth) * amp;
                const scaleY = (rigHeight / mpHeight) * amp;
                const scaleZ = scaleX;

                pArr.forEach((p, i) => {
                    const bone = char.opFaceBones[i];
                    const rest = char.opFaceBonesRest[i];
                    
                    if (bone && rest) {
                        const p0 = pArrZero[i];
                        const dx = p.x - p0.x;
                        const dy = p.y - p0.y;
                        const dz = p.z - p0.z;

                        bone.position.set(
                            rest.x + (dx * scaleX),
                            rest.y + (-dy * scaleY),
                            rest.z + (-dz * scaleZ)
                        );
                    }
                });
            }
        });
    }

    handleKeyDown(e) {
        if (!this.isHovered || !this.selected.obj || this.isBaking || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        const k = e.key.toLowerCase();
        if (k === 'g') { this.transformControls.setMode("translate"); this.updateGizmoUI("translate"); }
        if (k === 'r') { this.transformControls.setMode("rotate"); this.updateGizmoUI("rotate"); }
        if (k === 's' && (this.selected.type === 'character' || this.selected.type === 'environment')) { 
            this.transformControls.setMode("scale"); this.updateGizmoUI("scale"); 
        }
    }

    buildGizmoPanel(vpDiv) {
        this.container.addEventListener('mouseenter', () => this.isHovered = true);
        this.container.addEventListener('mouseleave', () => this.isHovered = false);

        this.gizmoBtns = {};
        const panel = document.createElement("div");
        Object.assign(panel.style, {
            position: "absolute", top: "10px", left: "10px", zIndex: "100",
            display: "flex", flexDirection: "column", gap: "6px",
            background: "rgba(20,20,20,0.8)", padding: "6px", borderRadius: "6px", border: "1px solid #333"
        });

        const createIconBtn = (id, svgPath, tooltip, onClick) => {
            const b = document.createElement("button");
            b.title = tooltip;
            Object.assign(b.style, {
                width: "32px", height: "32px", background: "#333", color: "#ccc",
                border: "1px solid #555", borderRadius: "4px", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", padding: "4px",
                transition: "all 0.1s"
            });
            b.innerHTML = `<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${svgPath}</svg>`;
            b.onmouseover = () => { if(b.dataset.active !== "true") b.style.background = "#555"; };
            b.onmouseout = () => { if(b.dataset.active !== "true") b.style.background = "#333"; };
            b.onclick = () => { onClick(); };
            this.gizmoBtns[id] = b;
            return b;
        };

        const pathMove = `<path d="M5 9l-3 3 3 3M9 5l3-3 3 3M9 19l3 3 3-3M19 9l3 3-3 3M2 12h20M12 2v20"/>`;
        const pathRot = `<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>`;
        const pathScale = `<path d="M21 3l-6 6"/><path d="M21 3v6"/><path d="M21 3h-6"/><path d="M3 21l6-6"/><path d="M3 21v-6"/><path d="M3 21h6"/><path d="M14 10l-4 4"/>`;
        const pathDeselect = `<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>`;
        const pathHelp = `<circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><path d="M12 17h.01"></path>`;

        const btnHelp = createIconBtn("help", pathHelp, "User Manual", () => {
            if (this.helpModal) {
                this.helpModal.style.display = "flex";
                if (!this.helpModal.dataset.loaded) {
                    const body = this.helpModal.querySelector('.manual-body');
                    body.innerHTML = `<div style="text-align:center; padding: 40px; color:#888;">Loading manual...</div>`;
                    
                    fetch(new URL("./yedp_manual.html", import.meta.url).href)
                        .then(response => {
                            if (!response.ok) throw new Error("Manual file not found.");
                            return response.text();
                        })
                        .then(html => {
                            body.innerHTML = html;
                            this.helpModal.dataset.loaded = "true";
                        })
                        .catch(err => {
                            body.innerHTML = '';
                            const errWrap = document.createElement('div');
                            Object.assign(errWrap.style, { color: '#ff5555', padding: '20px', textAlign: 'center' });
                            const h3 = document.createElement('h3');
                            h3.textContent = 'Failed to load manual';
                            const p1 = document.createElement('p');
                            p1.textContent = err.message;
                            const p2 = document.createElement('p');
                            p2.innerHTML = 'Make sure <b>yedp_manual.html</b> is placed in the same folder as <b>action_director.js</b>.';
                            errWrap.append(h3, p1, p2);
                            body.appendChild(errWrap);
                        });
                }
            }
        });
        btnHelp.style.marginTop = "8px"; 
        btnHelp.style.color = "#ffaa00"; 
        btnHelp.style.borderColor = "#ffaa00";

        panel.append(
            createIconBtn("translate", pathMove, "Move (G)", () => { this.transformControls.setMode("translate"); this.updateGizmoUI("translate"); }),
            createIconBtn("rotate", pathRot, "Rotate (R)", () => { this.transformControls.setMode("rotate"); this.updateGizmoUI("rotate"); }),
            createIconBtn("scale", pathScale, "Scale (S)", () => { if(['character', 'environment'].includes(this.selected.type)) { this.transformControls.setMode("scale"); this.updateGizmoUI("scale"); } }),
            createIconBtn("deselect", pathDeselect, "Deselect", () => { this.selectObject(null, null, null); }),
            btnHelp
        );
        vpDiv.appendChild(panel);
        this.updateGizmoUI("translate");
    }

    updateGizmoUI(mode) {
        Object.keys(this.gizmoBtns).forEach(k => {
            const b = this.gizmoBtns[k];
            if (k === 'help') return; 
            
            if (k === mode) {
                b.dataset.active = "true"; b.style.background = "#00d2ff"; b.style.color = "#000"; b.style.borderColor = "#00d2ff";
            } else {
                b.dataset.active = "false"; b.style.background = "#333"; b.style.color = "#ccc"; b.style.borderColor = "#555";
            }
            if (k === 'scale' && !['character', 'environment'].includes(this.selected.type)) {
                b.style.opacity = "0.3"; b.style.pointerEvents = "none";
            } else if (k === 'scale') {
                b.style.opacity = "1.0"; b.style.pointerEvents = "auto";
            }
        });
    }

    buildViewNav(vpDiv) {
        const nav = document.createElement("div");
        Object.assign(nav.style, {
            position: "absolute", top: "10px", right: "10px", zIndex: "100",
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px",
            background: "rgba(20,20,20,0.8)", padding: "6px", borderRadius: "6px", border: "1px solid #333"
        });

        const createViewBtn = (lbl, dir) => {
            const b = document.createElement("button");
            b.innerText = lbl;
            Object.assign(b.style, { background: "#222", color: "#ccc", border: "1px solid #444", borderRadius: "3px", cursor: "pointer", fontSize: "9px", padding: "4px 8px", fontWeight: "bold", transition: "all 0.1s" });
            b.onmouseover = () => { b.style.background = "#00d2ff"; b.style.color = "#000"; b.style.borderColor = "#00d2ff"; };
            b.onmouseout = () => { b.style.background = "#222"; b.style.color = "#ccc"; b.style.borderColor = "#444"; };
            b.onclick = () => {
                const dist = this.camera.position.distanceTo(this.controls.target);
                const tgt = this.controls.target;
                const p = this.camera.position;
                switch(dir) {
                    case 'top': p.set(tgt.x, tgt.y + dist, tgt.z); break;
                    case 'bottom': p.set(tgt.x, tgt.y - dist, tgt.z); break;
                    case 'front': p.set(tgt.x, tgt.y, tgt.z + dist); break;
                    case 'back': p.set(tgt.x, tgt.y, tgt.z - dist); break;
                    case 'left': p.set(tgt.x - dist, tgt.y, tgt.z); break;
                    case 'right': p.set(tgt.x + dist, tgt.y, tgt.z); break;
                    case 'reset': 
                        p.set(0, 1.2, 4);
                        tgt.set(0, 1, 0);
                        this.camera.zoom = 1;
                        if(this.isOrthographic) this.orthoCam.updateProjectionMatrix();
                        else this.perspCam.updateProjectionMatrix();
                        
                        const ovrChk = this.container.querySelector("#cam-override-chk");
                        if (this.isCameraOverride && ovrChk) {
                            ovrChk.checked = false;
                            this.isCameraOverride = false;
                            this.controls.enabled = true; 
                        }
                        break;
                }
                this.controls.update(); 
                this.updateTransformUIFromObject();
                this.forceUpdateFrame();
            };
            return b;
        };
        nav.append(
            createViewBtn("TOP", "top"), createViewBtn("BTM", "bottom"),
            createViewBtn("LEFT", "left"), createViewBtn("RIGHT", "right"), 
            createViewBtn("FRONT", "front"), createViewBtn("BACK", "back"),
            createViewBtn("RESET", "reset")
        );
        nav.lastChild.style.gridColumn = "1 / span 2";
        nav.lastChild.style.borderColor = "#555";
        
        vpDiv.appendChild(nav);
    }

    buildSidebar() {
        const createBtn = (text, color="#444", hover="#555") => {
            const b = document.createElement("button"); b.innerText = text;
            Object.assign(b.style, { background: color, color: "#fff", border: "1px solid #555", borderRadius: "3px", cursor: "pointer", padding: "4px", fontSize: "10px", flex: "1" });
            b.onmouseover = () => b.style.background = hover;
            b.onmouseout = () => b.style.background = color;
            return b;
        };

        const createCollapsible = (titleText, defaultOpen) => {
            const wrap = document.createElement("div");
            Object.assign(wrap.style, { background: "#222", borderRadius: "4px", border: "1px solid #333" });
            const head = document.createElement("div");
            Object.assign(head.style, { 
                background: "#16252d", borderLeft: "3px solid #00d2ff", padding: "8px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", 
                borderBottom: defaultOpen ? "1px solid #333" : "none", borderTopRightRadius: "4px", borderBottomRightRadius: defaultOpen ? "0px" : "4px" 
            });
            const titleSpan = document.createElement("span");
            Object.assign(titleSpan.style, { fontWeight: "bold", color: "#fff", fontSize: "11px", display: "flex", alignItems: "center", gap: "6px" });
            titleSpan.innerHTML = `<span style="color:#00d2ff; font-size:9px; width:10px; display:inline-block; text-align:center;">${defaultOpen ? '▼' : '▶'}</span> <span style="display:flex; align-items:center; gap:4px;">${titleText}</span>`;
            head.appendChild(titleSpan);
            const content = document.createElement("div");
            Object.assign(content.style, { padding: "8px", display: defaultOpen ? "flex" : "none", flexDirection: "column", gap: "6px" });
            head.onclick = (e) => {
                if (['BUTTON', 'INPUT', 'SELECT', 'OPTION'].includes(e.target.tagName)) return; 
                const isOpen = content.style.display !== "none";
                content.style.display = isOpen ? "none" : "flex";
                head.style.borderBottom = isOpen ? "none" : "1px solid #333";
                head.style.borderBottomRightRadius = isOpen ? "4px" : "0px";
                titleSpan.innerHTML = `<span style="color:#00d2ff; font-size:9px; width:10px; display:inline-block; text-align:center;">${isOpen ? '▶' : '▼'}</span> <span style="display:flex; align-items:center; gap:4px;">${titleText}</span>`;
            };
            wrap.append(head, content);
            return { wrap, head, content };
        };

        const iconTransform = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>`;
        const iconCamera = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>`;
        const iconLighting = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
        const iconChars = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
        const iconEnv = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`;
        const iconMocap = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg>`;

        const stopEvent = e => e.stopPropagation();

        // TRANSFORM
        const transCol = createCollapsible(`${iconTransform} Transform`, true);
        const tRow = (lbl, keys) => {
            const r = document.createElement("div"); r.style.display = "flex"; r.style.gap = "4px"; r.style.alignItems = "center";
            const l = document.createElement("span"); l.innerText = lbl; l.style.width = "20px"; l.style.color = "#888"; r.appendChild(l);
            keys.forEach(k => {
            const inp = document.createElement("input"); inp.type = "number"; inp.step = "0.1";
            Object.assign(inp.style, { flex: "1", width: "0", background: "#111", color: "#fff", border: "1px solid #444", fontSize: "10px", padding: "2px" });
            inp.onchange = () => { this.updateObjectFromTransformUI(); this.forceUpdateFrame(); };
            inp.addEventListener('keydown', stopEvent); inp.addEventListener('keyup', stopEvent);
            inp.addEventListener('keypress', stopEvent); inp.addEventListener('mousedown', stopEvent);
            inp.addEventListener('pointerdown', stopEvent);
            this.uiTransformInputs[k] = inp; r.appendChild(inp);
        });
        return r;
    };
    transCol.content.append(tRow("Pos", ['px', 'py', 'pz']), tRow("Rot", ['rx', 'ry', 'rz']), tRow("Scl", ['sx', 'sy', 'sz']));

    // CAMERA
    const camCol = createCollapsible(`${iconCamera} Camera`, false);
    
    const camSettingsRow = document.createElement("div");
    Object.assign(camSettingsRow.style, { display: "flex", gap: "6px", alignItems: "center", marginBottom: "6px", justifyContent: "space-between" });
    const btnSelCam = createBtn("Select Cam", "#334", "#445");
    btnSelCam.style.flex = "1"; btnSelCam.onclick = () => this.selectObject(this.camera, 'camera', 'main');

    const lblOrtho = document.createElement("label");
    Object.assign(lblOrtho.style, { cursor: "pointer", display: "flex", gap: "4px", color: "#ccc", fontSize: "10px", alignItems: "center" });
    const chkOrtho = document.createElement("input"); chkOrtho.type = "checkbox"; chkOrtho.checked = this.isOrthographic;
    chkOrtho.id = "chk-ortho";
    lblOrtho.append(chkOrtho, "Ortho");
    camSettingsRow.append(btnSelCam, lblOrtho);

    const fovContainer = document.createElement("div");
    Object.assign(fovContainer.style, { display: "flex", gap: "4px", alignItems: "center", marginBottom: "6px", transition: "opacity 0.2s" });
    const lblFov = document.createElement("span"); lblFov.innerText = "FOV"; Object.assign(lblFov.style, {fontSize: "9px", color: "#888", width: "22px"});
    const sldFov = document.createElement("input"); sldFov.type = "range"; sldFov.min = 10; sldFov.max = 120; sldFov.value = this.perspCam.fov; 
    sldFov.id = "inp-cam-fov-sld";
    Object.assign(sldFov.style, { flex: "1", width: "0", minWidth: "20px" });
    
    const valFov = document.createElement("input"); valFov.type = "number"; valFov.min = 10; valFov.max = 120; valFov.value = this.perspCam.fov; 
    valFov.id = "inp-cam-fov-val";
    Object.assign(valFov.style, { fontSize: "9px", color: "#00d2ff", width: "32px", background: "#111", border: "1px solid #444", padding: "2px", borderRadius: "2px", textAlign: "right" });
    const degSym = document.createElement("span"); degSym.innerText = "°"; degSym.style.fontSize = "9px"; degSym.style.color = "#888";
    
    const valMm = document.createElement("input"); valMm.type = "number"; valMm.value = Math.round(this.perspCam.getFocalLength());
    valMm.id = "inp-cam-mm-val";
    Object.assign(valMm.style, { fontSize: "9px", color: "#4ade80", width: "36px", background: "#111", border: "1px solid #444", padding: "2px", borderRadius: "2px", textAlign: "right", marginLeft: "2px" });
    const mmSym = document.createElement("span"); mmSym.innerText = "mm"; mmSym.style.fontSize = "9px"; mmSym.style.color = "#888";

    valFov.addEventListener('keydown', stopEvent); valFov.addEventListener('mousedown', stopEvent);
    valMm.addEventListener('keydown', stopEvent); valMm.addEventListener('mousedown', stopEvent);
    
    const syncFov = (val, isMm = false) => {
        let fovDeg;
        if (isMm) {
            const mm = Math.max(1, parseFloat(val) || 35);
            this.perspCam.setFocalLength(mm);
            fovDeg = this.perspCam.fov;
        } else {
            fovDeg = Math.max(10, Math.min(120, parseFloat(val) || 45));
            this.perspCam.fov = fovDeg;
        }
        this.perspCam.updateProjectionMatrix();
        sldFov.value = fovDeg;
        valFov.value = Math.round(fovDeg * 10) / 10;
        valMm.value = Math.round(this.perspCam.getFocalLength());
        this.forceUpdateFrame();
    };

    sldFov.oninput = (e) => syncFov(e.target.value);
    valFov.onchange = (e) => syncFov(e.target.value);
    valMm.onchange = (e) => syncFov(e.target.value, true);

    fovContainer.append(lblFov, sldFov, valFov, degSym, valMm, mmSym);

    const clipContainer = document.createElement("div");
    Object.assign(clipContainer.style, { display: "flex", gap: "2px", alignItems: "center", marginBottom: "6px" });
    const lblClip = document.createElement("span"); lblClip.innerText = "Clip"; Object.assign(lblClip.style, {fontSize: "9px", color: "#888", width: "22px"});
    const lblNear = document.createElement("span"); lblNear.innerText = "N:"; Object.assign(lblNear.style, {fontSize: "9px", color: "#666"});
    const valNear = document.createElement("input"); valNear.type = "number"; valNear.step = "0.1"; valNear.value = this.defaultNear;
    valNear.id = "inp-cam-near-val";
    Object.assign(valNear.style, { flex: "1", width: "0", fontSize: "9px", color: "#fff", background: "#111", border: "1px solid #444", padding: "2px", borderRadius: "2px" });
    const lblFar = document.createElement("span"); lblFar.innerText = "F:"; Object.assign(lblFar.style, {fontSize: "9px", color: "#666", marginLeft: "2px"});
    const valFar = document.createElement("input"); valFar.type = "number"; valFar.step = "10"; valFar.value = this.defaultFar;
    valFar.id = "inp-cam-far-val";
    Object.assign(valFar.style, { flex: "1", width: "0", fontSize: "9px", color: "#fff", background: "#111", border: "1px solid #444", padding: "2px", borderRadius: "2px" });

    valNear.addEventListener('keydown', stopEvent); valNear.addEventListener('mousedown', stopEvent);
    valFar.addEventListener('keydown', stopEvent); valFar.addEventListener('mousedown', stopEvent);

    const syncClip = () => {
        this.defaultNear = parseFloat(valNear.value) || 0.1;
        this.defaultFar = parseFloat(valFar.value) || 100.0;
        if (!this.isDepthMode) {
            this.resetCamera();
            this.forceUpdateFrame();
        }
    };
    valNear.onchange = syncClip;
    valFar.onchange = syncClip;
    clipContainer.append(lblClip, lblNear, valNear, lblFar, valFar);

    chkOrtho.onchange = (e) => {
        this.isOrthographic = e.target.checked;
        fovContainer.style.opacity = this.isOrthographic ? "0.3" : "1.0";
        sldFov.disabled = this.isOrthographic; valFov.disabled = this.isOrthographic; valMm.disabled = this.isOrthographic;

        const oldCam = this.isOrthographic ? this.perspCam : this.orthoCam;
        this.camera = this.isOrthographic ? this.orthoCam : this.perspCam;
        this.camera.position.copy(oldCam.position); this.camera.quaternion.copy(oldCam.quaternion); this.camera.zoom = oldCam.zoom;

        this.controls.object = this.camera;
        if (this.selected.type !== 'camera') this.transformControls.camera = this.camera;
        if (this.selected.type === 'camera') this.selectObject(this.camera, 'camera', 'main');
        const vpArea = this.container.querySelector(".yedp-vp-area");
        if (vpArea) this.onResize(vpArea); 
        this.forceUpdateFrame();
    };

    const camRow1 = document.createElement("div"); camRow1.style.display = "flex"; camRow1.style.gap = "4px"; camRow1.style.marginBottom = "4px";
        const btnSetStart = createBtn("Set Start Frame"); const btnSetEnd = createBtn("Set End Frame");
        btnSetStart.onclick = () => {
            this.camKeys.start = { pos: this.camera.position.clone(), quat: this.camera.quaternion.clone(), target: this.controls.target.clone(), zoom: this.camera.zoom };
            btnSetStart.innerText = "Start Frame Set ✓"; btnSetStart.style.borderColor = "#0f0";
        };
        btnSetEnd.onclick = () => {
            this.camKeys.end = { pos: this.camera.position.clone(), quat: this.camera.quaternion.clone(), target: this.controls.target.clone(), zoom: this.camera.zoom };
            btnSetEnd.innerText = "End Frame Set ✓"; btnSetEnd.style.borderColor = "#0f0";
        };
        
        const camRow2 = document.createElement("div"); camRow2.style.display = "flex"; camRow2.style.gap = "4px";
        const selEase = document.createElement("select");
        Object.assign(selEase.style, { flex: "1", background: "#111", color: "#fff", border: "1px solid #444", borderRadius: "3px", fontSize: "10px", padding: "2px" });
        ['linear', 'easeIn', 'easeOut', 'easeInOut'].forEach(e => selEase.add(new Option(e, e)));
        selEase.onchange = (e) => { this.camKeys.ease = e.target.value; this.forceUpdateFrame(); };
        const btnClearCam = createBtn("Clear Keyframes", "#522", "#733");
        btnClearCam.onclick = () => {
            this.camKeys.start = null; this.camKeys.end = null;
            btnSetStart.innerText = "Set Start"; btnSetStart.style.borderColor = "#555";
            btnSetEnd.innerText = "Set End"; btnSetEnd.style.borderColor = "#555";
        };
        camRow1.append(btnSetStart, btnSetEnd); camRow2.append(selEase, btnClearCam);

        const camImportRow = document.createElement("div");
        Object.assign(camImportRow.style, { display: "flex", gap: "4px", alignItems: "center", marginTop: "8px", borderTop: "1px solid #333", paddingTop: "8px" });
        
        const lblOverride = document.createElement("label");
        Object.assign(lblOverride.style, { cursor: "pointer", display: "flex", gap: "2px", color: "#ccc", fontSize: "10px", alignItems: "center", whiteSpace: "nowrap" });
        const chkOverride = document.createElement("input"); 
        chkOverride.type = "checkbox"; 
        chkOverride.id = "cam-override-chk";
        chkOverride.checked = this.isCameraOverride;
        chkOverride.onchange = (e) => { 
            this.isCameraOverride = e.target.checked; 
            this.controls.enabled = !this.isCameraOverride;
            this.forceUpdateFrame();
        };
        lblOverride.append(chkOverride, "Override");

        const selCamAnim = document.createElement("select");
        selCamAnim.id = "sel-cam-anim";
        Object.assign(selCamAnim.style, { flex: "1", background: "#111", color: "#fff", border: "1px solid #444", borderRadius: "3px", fontSize: "10px", padding: "2px" });
        this.availableCams.forEach(anim => selCamAnim.add(new Option(anim, anim))); 
        selCamAnim.onchange = (e) => { this.loadCameraAnim(e.target.value); };

        // NEW: Upload Camera Button
        const uploadCamBtn = this.createUploadButton("Upload Custom Camera", ".glb,.fbx", "yedp_cams", async (filename) => {
            if (!this.availableCams.includes(filename)) this.availableCams.push(filename);
            selCamAnim.add(new Option(filename, filename));
            selCamAnim.value = filename;
            await this.loadCameraAnim(filename);
        });

        camImportRow.append(lblOverride, selCamAnim, uploadCamBtn);

        const camImportFixRow = document.createElement("div");
        Object.assign(camImportFixRow.style, { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px", marginTop: "4px" });
        
        const makeFixRow = (lbl, def, callback, id) => {
            const wrap = document.createElement("div");
            Object.assign(wrap.style, { display: "flex", gap: "2px", alignItems: "center", color: "#888", fontSize: "9px" });
            const inp = document.createElement("input"); inp.type = "number"; inp.step = "0.1"; inp.value = def;
            inp.id = id;
            Object.assign(inp.style, { width: "100%", background: "#111", color: "#fff", border: "1px solid #444", fontSize: "9px", padding: "1px" });
            inp.onchange = callback;
            inp.addEventListener('keydown', stopEvent); inp.addEventListener('keyup', stopEvent);
            inp.addEventListener('keypress', stopEvent); inp.addEventListener('mousedown', stopEvent);
            const label = document.createElement("span"); label.innerText = lbl; label.style.width = "20px";
            wrap.append(label, inp);
            return wrap;
        };

        const rxWrap = makeFixRow("Rx", "0", (e) => { this.camOverrideOffset.rx = parseFloat(e.target.value)||0; this.forceUpdateFrame(); }, "inp-cam-rx");
        const ryWrap = makeFixRow("Ry", "0", (e) => { this.camOverrideOffset.ry = parseFloat(e.target.value)||0; this.forceUpdateFrame(); }, "inp-cam-ry");
        const rzWrap = makeFixRow("Rz", "0", (e) => { this.camOverrideOffset.rz = parseFloat(e.target.value)||0; this.forceUpdateFrame(); }, "inp-cam-rz");
    const scWrap = makeFixRow("Scl", "1.0", (e) => { this.camOverrideScale = parseFloat(e.target.value)||1.0; this.cameraAnimGroup.scale.setScalar(this.camOverrideScale); this.cameraAnimGroup.updateMatrixWorld(true); this.forceUpdateFrame(); }, "inp-cam-scl");
    scWrap.querySelector('input').step = "0.01";

    camImportFixRow.append(rxWrap, ryWrap, rzWrap, scWrap);

    // --- NEW: Path Tracer UI ---
    const ptRow = document.createElement("div");
    Object.assign(ptRow.style, { display: "flex", flexDirection: "column", gap: "4px", marginTop: "8px", borderTop: "1px solid #333", paddingTop: "8px" });
    
    const ptToggleWrap = document.createElement("div");
    ptToggleWrap.style.display = "flex"; ptToggleWrap.style.justifyContent = "space-between";
    const lblPt = document.createElement("label");
    Object.assign(lblPt.style, { cursor: "pointer", display: "flex", gap: "4px", color: "#ffaa00", fontSize: "10px", alignItems: "center", fontWeight: "bold" });
    const chkPt = document.createElement("input"); 
    chkPt.type = "checkbox"; chkPt.checked = this.isPathTracingEnabled;
    chkPt.onchange = (e) => { 
        this.isPathTracingEnabled = e.target.checked; 
        this.needsPtReset = true;
        this.forceUpdateFrame(); 
    };
    lblPt.append(chkPt, "Enable Path Tracing (Shaded Pass)");
    
    const lblPtSamples = document.createElement("span");
    lblPtSamples.id = "pt-sample-counter";
    Object.assign(lblPtSamples.style, { fontSize: "9px", color: "#888", fontFamily: "monospace" });
    lblPtSamples.innerText = "0 / 32";
    ptToggleWrap.append(lblPt, lblPtSamples);

    const makePtSlider = (lbl, min, max, def, callback) => {
        const wrap = document.createElement("div");
        wrap.style.display = "flex"; wrap.style.gap = "4px"; wrap.style.alignItems = "center";
        const label = document.createElement("span"); label.innerText = lbl; label.style.fontSize = "9px"; label.style.color = "#888"; label.style.width = "40px";
        const sld = document.createElement("input"); sld.type = "range"; sld.min = min; sld.max = max; sld.step = "1"; sld.value = def;
        sld.style.flex = "1";
        const val = document.createElement("input"); val.type = "number"; val.value = def;
        Object.assign(val.style, { width: "36px", background: "#111", color: "#fff", border: "1px solid #444", fontSize: "9px", padding: "1px", textAlign: "right" });
        const sync = (v) => { sld.value = v; val.value = v; callback(parseInt(v)); };
        sld.oninput = (e) => sync(e.target.value);
        val.onchange = (e) => sync(e.target.value);
        wrap.append(label, sld, val);
        return wrap;
    };

    const ptPrevSld = makePtSlider("Preview", 1, 256, this.ptPreviewSamples, (v) => { this.ptPreviewSamples = v; this.needsPtReset = true; this.forceUpdateFrame(); });
    const ptBakeSld = makePtSlider("Bake", 1, 1024, this.ptBakeSamples, (v) => { this.ptBakeSamples = v; });

    ptRow.append(ptToggleWrap, ptPrevSld, ptBakeSld);
    // ---------------------------

    camCol.content.append(camSettingsRow, fovContainer, clipContainer, camRow1, camRow2, camImportRow, camImportFixRow);

    // LIGHTING
    const lightCol = createCollapsible(`${iconLighting} Lighting`, false);

// --- HDRI UI BLOCK ---
        const hdriRow = document.createElement("div");
        Object.assign(hdriRow.style, { display: "flex", flexDirection: "column", gap: "4px", marginBottom: "8px", paddingBottom: "8px", borderBottom: "1px solid #333" });
        
        const hdriLbl = document.createElement("span");
        hdriLbl.innerText = "Load HDR:";
        hdriLbl.style.fontSize = "10px";
        hdriLbl.style.color = "#00d2ff";
        
        const selHdri = document.createElement("select");
        selHdri.id = "sel-hdri"; // Added ID for the sync button
        Object.assign(selHdri.style, { width: "100%", background: "#111", color: "#fff", border: "1px solid #444", borderRadius: "3px", fontSize: "10px", padding: "2px" });
        this.availableHdris.forEach(h => selHdri.add(new Option(h, h)));
        selHdri.onchange = (e) => this.loadHDRI(e.target.value);



        const toggleRow = document.createElement("div");
        toggleRow.style.display = "flex"; toggleRow.style.gap = "8px";
        
        const lblHdriEn = document.createElement("label");
        Object.assign(lblHdriEn.style, { cursor: "pointer", display: "flex", gap: "4px", color: "#ccc", fontSize: "9px", alignItems: "center" });
        const chkHdriEn = document.createElement("input");
        chkHdriEn.type = "checkbox"; 
        chkHdriEn.checked = this.isHdriEnabled;
        chkHdriEn.id = "chk-hdri-en";
        chkHdriEn.onchange = (e) => { this.isHdriEnabled = e.target.checked; this.updateHDRI(); };
        lblHdriEn.append(chkHdriEn, "Enable IBL");

        const lblHdriBg = document.createElement("label");
        Object.assign(lblHdriBg.style, { cursor: "pointer", display: "flex", gap: "4px", color: "#ccc", fontSize: "9px", alignItems: "center" });
        const chkHdriBg = document.createElement("input"); 
        chkHdriBg.type = "checkbox"; 
        chkHdriBg.checked = this.isHdriBgEnabled;
        chkHdriBg.id = "chk-hdri-bg";
        chkHdriBg.onchange = (e) => { this.isHdriBgEnabled = e.target.checked; this.updateHDRI(); };
        lblHdriBg.append(chkHdriBg, "Visible BG");
        
        toggleRow.append(lblHdriEn, lblHdriBg);
        
        // Add Rotation and Intensity Controls
        const rotIntRow = document.createElement("div");
        rotIntRow.style.display = "flex"; rotIntRow.style.gap = "4px"; rotIntRow.style.alignItems = "center";

        const lblRot = document.createElement("span"); 
        lblRot.innerText = "Rot"; 
        lblRot.style.fontSize="9px"; 
        lblRot.style.color="#888";

        const sldRot = document.createElement("input"); 
        sldRot.type = "range"; 
        sldRot.id = "sld-hdri-rot";
        sldRot.min = "0"; 
        sldRot.max = "360"; 
        sldRot.value = this.hdriRotation;
        sldRot.style.flex = "1"; sldRot.style.width = "0";

        const inpRot = document.createElement("input"); 
        inpRot.type = "number"; 
        inpRot.id = "inp-hdri-rot";
        inpRot.step = "1"; 
        inpRot.value = this.hdriRotation;
        Object.assign(inpRot.style, { width:"36px", background:"#111", color:"#00d2ff", border:"1px solid #444", fontSize:"9px", padding:"2px", textAlign:"right" });

        let hdriRotDebounceTimer = null;
        const debouncedSyncRot = (v) => {
            this.hdriRotation = v;
            sldRot.value = v;
            inpRot.value = v;
            if (hdriRotDebounceTimer) clearTimeout(hdriRotDebounceTimer);
            hdriRotDebounceTimer = setTimeout(() => this.updateHDRI(), 50);
        };

        sldRot.oninput = (e) => debouncedSyncRot(e.target.value);
        inpRot.onchange = (e) => { this.hdriRotation = parseFloat(e.target.value) || 0; sldRot.value = this.hdriRotation; this.updateHDRI(); };
        inpRot.addEventListener('keydown', stopEvent); 
        inpRot.addEventListener('mousedown', stopEvent);

        const lblInt = document.createElement("span"); lblInt.innerText = "Int"; lblInt.style.fontSize="9px"; lblInt.style.color="#888";
        
        const inpInt = document.createElement("input"); 
        inpInt.type = "number"; 
        inpInt.id = "inp-hdri-int";
        inpInt.step = "0.1"; 
        inpInt.value = this.hdriIntensity;
        Object.assign(inpInt.style, { width:"36px", background:"#111", color:"#00d2ff", border:"1px solid #444", fontSize:"9px", padding:"2px", textAlign:"right" });
        inpInt.onchange = (e) => { this.hdriIntensity = parseFloat(e.target.value) || 1.0; this.updateHDRI(); };
        inpInt.addEventListener('keydown', stopEvent); inpInt.addEventListener('mousedown', stopEvent);

        rotIntRow.append(lblRot, sldRot, inpRot, lblInt, inpInt);
        hdriRow.append(hdriLbl, selHdri, toggleRow, rotIntRow);
        
        lightCol.content.append(hdriRow, ptRow); // Appending HDRI and Path Tracing here!

        const btnAddLight = createBtn("+ Add Light", "#542", "#653");
        btnAddLight.style.flex = "none"; btnAddLight.style.padding = "2px 6px"; btnAddLight.style.fontSize = "9px";
        btnAddLight.onclick = (e) => { e.stopPropagation(); this.addLight(); };
        lightCol.head.appendChild(btnAddLight);
        this.uiLightList = document.createElement("div");
        this.uiLightList.style.display = "flex"; this.uiLightList.style.flexDirection = "column"; this.uiLightList.style.gap = "6px";
        lightCol.content.appendChild(this.uiLightList);

        // CHARACTERS
        const charCol = createCollapsible(`${iconChars} Characters`, true);

        const charHeadControls = document.createElement("div");
        charHeadControls.style.display = "flex"; charHeadControls.style.gap = "4px";

        const btnAddChar = createBtn("+ Add Char", "#252", "#373");
        btnAddChar.style.flex = "none"; btnAddChar.style.padding = "2px 6px"; btnAddChar.style.fontSize = "9px";
        btnAddChar.onclick = async (e) => { e.stopPropagation(); await this.addCharacter("Yedp_Rig.glb"); };

        charHeadControls.append(btnAddChar);
        charCol.head.appendChild(charHeadControls);

        this.uiCharList = document.createElement("div");
        this.uiCharList.style.display = "flex"; this.uiCharList.style.flexDirection = "column"; this.uiCharList.style.gap = "6px";
        charCol.content.appendChild(this.uiCharList);

        // MOCAP
        const mocapCol = createCollapsible(`${iconMocap} Motion Capture`, false);
        
        const mocapPrevWrapper = document.createElement("div");
        Object.assign(mocapPrevWrapper.style, { position: "relative", width: "100%", background: "#000", border: "1px solid #444", borderRadius: "4px", aspectRatio: "16/9", display: "flex", justifyContent: "center", alignItems: "center", overflow: "hidden" });
        this.mocapVideoEl = document.createElement("video");
        Object.assign(this.mocapVideoEl.style, { width: "100%", height: "100%", objectFit: "contain", display: "none" }); 
        this.mocapVideoEl.setAttribute("playsinline", ""); this.mocapVideoEl.muted = true;
        this.mocapCanvasEl = document.createElement("canvas");
        Object.assign(this.mocapCanvasEl.style, { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "contain" });
        
        const mocapOverlay = document.createElement("div");
        Object.assign(mocapOverlay.style, { position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", fontSize: "48px", fontWeight: "bold", color: "white", textShadow: "0px 0px 10px black", pointerEvents: "none", display: "none", zIndex: "50" });
        this.mocapOverlay = mocapOverlay;

        const mocapStatus = document.createElement("div");
        Object.assign(mocapStatus.style, { position: "absolute", bottom: "4px", left: "4px", fontSize: "9px", color: "#0f0", background: "rgba(0,0,0,0.6)", padding: "2px 4px", borderRadius: "2px" });
        mocapStatus.innerText = "Inactive";
        this.debugMocapText = mocapStatus;
        mocapPrevWrapper.append(this.mocapVideoEl, this.mocapCanvasEl, this.mocapOverlay, mocapStatus);
        
        const mocapCtrlRow1 = document.createElement("div");
        mocapCtrlRow1.style.display = "flex"; mocapCtrlRow1.style.gap = "4px"; mocapCtrlRow1.style.marginBottom = "4px";
        const selSource = document.createElement("select");
        selSource.id = "mocap-sel-source"; 
        Object.assign(selSource.style, { flex: "1", background: "#111", color: "#fff", border: "1px solid #444", borderRadius: "3px", fontSize: "10px", padding: "2px", width: "0" });
        selSource.add(new Option("Webcam", "webcam")); selSource.add(new Option("Video File", "video"));
        
        const fileIn = document.createElement("input"); fileIn.type = "file"; fileIn.accept = "video/*"; fileIn.style.display = "none";
        
        const btnAction = createBtn("📷 Start", "#242", "#363");
        const btnStop = createBtn("⏹ Stop", "#422", "#633");
        const btnRec = createBtn("🔴 Rec", "#511", "#811");
        btnRec.disabled = true; btnRec.style.opacity = "0.5";

        mocapCtrlRow1.append(selSource, fileIn, btnAction, btnStop, btnRec);

        // --- IMPROVED VIDEO MOCAP RANGE SELECTION UI ---
        const mocapCtrlRow2 = document.createElement("div");
        mocapCtrlRow2.style.display = "none"; mocapCtrlRow2.style.flexDirection = "column"; mocapCtrlRow2.style.gap = "4px"; mocapCtrlRow2.style.marginBottom = "4px";
        
        const playRow = document.createElement("div");
        playRow.style.display = "flex"; playRow.style.alignItems = "center"; playRow.style.gap = "4px";

        const btnPlayPause = createBtn("⏸", "#333", "#555");
        btnPlayPause.style.flex = "none"; btnPlayPause.style.width = "30px"; btnPlayPause.style.padding = "2px";
        
        const vidTimeline = document.createElement("input");
        vidTimeline.type = "range"; vidTimeline.min = 0; vidTimeline.max = 100; vidTimeline.value = 0;
        vidTimeline.style.flex = "1";
        this._mocapVideoTimeline = vidTimeline;
        
        playRow.append(btnPlayPause, vidTimeline);

        // Custom Range Slider wrapper
        const rangeWrapper = document.createElement("div");
        Object.assign(rangeWrapper.style, { display: "flex", flexDirection: "column", width: "100%", gap: "2px", marginTop: "2px", touchAction: "none" });
        
        const timeLabels = document.createElement("div");
        Object.assign(timeLabels.style, { display: "flex", justifyContent: "space-between", fontSize: "9px", color: "#00d2ff", fontFamily: "monospace", padding: "0 2px" });
        const lblStart = document.createElement("span"); lblStart.innerText = "00:00.00";
        const lblEnd = document.createElement("span"); lblEnd.innerText = "00:00.00";
        timeLabels.append(lblStart, lblEnd);

        const dualSliderContainer = document.createElement("div");
        Object.assign(dualSliderContainer.style, { position: "relative", height: "12px", background: "#222", borderRadius: "2px", border: "1px solid #444", cursor: "pointer", margin: "0 4px" });
        
        const trackHighlight = document.createElement("div");
        Object.assign(trackHighlight.style, { position: "absolute", top: "0", bottom: "0", background: "#00d2ff", opacity: "0.5", left: "0%", width: "100%", pointerEvents: "none" });
        
        const handleStart = document.createElement("div");
        Object.assign(handleStart.style, { position: "absolute", top: "-4px", bottom: "-4px", width: "8px", background: "#fff", cursor: "ew-resize", left: "0%", transform: "translateX(-50%)", zIndex: 10, borderRadius: "2px", border: "1px solid #000" });
        
        const handleEnd = document.createElement("div");
        Object.assign(handleEnd.style, { position: "absolute", top: "-4px", bottom: "-4px", width: "8px", background: "#fff", cursor: "ew-resize", left: "100%", transform: "translateX(-50%)", zIndex: 10, borderRadius: "2px", border: "1px solid #000" });

        dualSliderContainer.append(trackHighlight, handleStart, handleEnd);
        rangeWrapper.append(dualSliderContainer, timeLabels);

        mocapCtrlRow2.append(playRow, rangeWrapper);
        
        // Setup robust drag logic utilizing pointer capture to prevent memory leaks and glitching
        const formatTime = (sec) => {
            if (isNaN(sec)) return "00:00.00";
            const m = Math.floor(sec / 60);
            const s = Math.floor(sec % 60);
            const ms = Math.floor((sec % 1) * 100);
            return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}.${ms.toString().padStart(2,'0')}`;
        };

        const updateRangeHandles = () => {
            handleStart.style.left = `${this.mocapRangeStart * 100}%`;
            handleEnd.style.left = `${this.mocapRangeEnd * 100}%`;
            trackHighlight.style.left = `${this.mocapRangeStart * 100}%`;
            trackHighlight.style.width = `${(this.mocapRangeEnd - this.mocapRangeStart) * 100}%`;
            
            if (this.mocapVideoEl && this.mocapVideoEl.duration) {
                lblStart.innerText = formatTime(this.mocapRangeStart * this.mocapVideoEl.duration);
                lblEnd.innerText = formatTime(this.mocapRangeEnd * this.mocapVideoEl.duration);
            }
        };

        let isDraggingStart = false; let isDraggingEnd = false;
        const getValFromEvent = (e) => {
            const rect = dualSliderContainer.getBoundingClientRect();
            let x = e.clientX - rect.left;
            return Math.max(0, Math.min(1, x / rect.width));
        };

        const onPointerMove = (e) => {
            if (!isDraggingStart && !isDraggingEnd) return;
            const val = getValFromEvent(e);
            if (isDraggingStart) {
                this.mocapRangeStart = Math.min(val, this.mocapRangeEnd - 0.02); // 2% minimum gap
                if (this.mocapVideoEl && this.mocapVideoEl.duration) this.mocapVideoEl.currentTime = this.mocapRangeStart * this.mocapVideoEl.duration;
            } else if (isDraggingEnd) {
                this.mocapRangeEnd = Math.max(val, this.mocapRangeStart + 0.02);
                if (this.mocapVideoEl && this.mocapVideoEl.duration) this.mocapVideoEl.currentTime = this.mocapRangeEnd * this.mocapVideoEl.duration;
            }
            updateRangeHandles();
        };

        const onPointerUp = (e) => {
            if (isDraggingStart) { isDraggingStart = false; handleStart.releasePointerCapture(e.pointerId); }
            if (isDraggingEnd) { isDraggingEnd = false; handleEnd.releasePointerCapture(e.pointerId); }
        };

        handleStart.onpointerdown = (e) => { isDraggingStart = true; handleStart.setPointerCapture(e.pointerId); e.stopPropagation(); };
        handleEnd.onpointerdown = (e) => { isDraggingEnd = true; handleEnd.setPointerCapture(e.pointerId); e.stopPropagation(); };

        handleStart.onpointermove = onPointerMove;
        handleEnd.onpointermove = onPointerMove;
        dualSliderContainer.onpointermove = onPointerMove; 

        handleStart.onpointerup = onPointerUp;
        handleEnd.onpointerup = onPointerUp;
        dualSliderContainer.onpointerup = onPointerUp;
        // --- END RANGE SELECTION UI ---

        selSource.onchange = () => {
            if (selSource.value === "video") {
                btnAction.innerText = "📂 Load";
                mocapCtrlRow2.style.display = "flex";
                this.mocapVideoEl.style.transform = "none"; 
                updateRangeHandles(); // Refresh UI layout
            } else {
                btnAction.innerText = "📷 Start";
                mocapCtrlRow2.style.display = "none";
                this.mocapVideoEl.style.transform = "scaleX(-1)"; 
            }
            btnStop.click(); 
        };

        this.mocapVideoEl.style.transform = "scaleX(-1)";

        btnAction.onclick = async () => {
            await this.initMediaPipe();
            if (!this.visionLib) return;

            if (selSource.value === "webcam") {
                if (this.isMocapActive) return;
                try {
                    this.mocapMediaStream = await navigator.mediaDevices.getUserMedia({video: true});
                    this.mocapVideoEl.srcObject = this.mocapMediaStream;
                    this.mocapVideoEl.onloadedmetadata = async () => {
                        try {
                            await this.mocapVideoEl.play();
                        } catch (err) {
                            console.error("[Yedp] mocapVideoEl.play() failed:", err);
                            this.debugMocapText.innerText = `Play failed: ${err.message}`;
                            this.debugMocapText.style.color = "#f55";
                        }
                        console.log(`[Yedp] Webcam ready. paused=${this.mocapVideoEl.paused}, readyState=${this.mocapVideoEl.readyState}`);
                        this.isMocapActive = true;
                        btnRec.disabled = false; btnRec.style.opacity = "1.0";
                        this.mocapLoop();
                    };
                } catch(e) { alert("Webcam error: " + e.message); }
            } else {
                fileIn.click();
            }
        };

        fileIn.onchange = (e) => {
            const f = e.target.files[0]; if(!f) return;
            if(this.mocapVideoEl.src && this.mocapVideoEl.src.startsWith('blob:')) {
                URL.revokeObjectURL(this.mocapVideoEl.src);
            }
            this.mocapVideoEl.src = URL.createObjectURL(f);
            this.mocapVideoEl.onloadedmetadata = () => {
                this.mocapVideoEl.play(); this.isMocapActive = true;
                btnRec.disabled = false; btnRec.style.opacity = "1.0";
                btnPlayPause.innerText = "⏸";
                updateRangeHandles();
                this.mocapLoop(); 
            }
        };

        btnPlayPause.onclick = () => {
            if (this.mocapVideoEl.paused) {
                this.mocapVideoEl.play(); btnPlayPause.innerText = "⏸";
            } else {
                this.mocapVideoEl.pause(); btnPlayPause.innerText = "▶";
            }
        };

        vidTimeline.oninput = (e) => {
            if (this.mocapVideoEl.duration) {
                this.mocapVideoEl.currentTime = (e.target.value / 100) * this.mocapVideoEl.duration;
            }
        };

        btnStop.onclick = () => {
            this.isMocapActive = false;
            this.isMocapStarting = false;
            if (this.isMocapRecording) btnRec.click(); 
            if (this.mocapTimer) { clearInterval(this.mocapTimer); this.mocapOverlay.style.display = "none"; }
            if (this.mocapMediaStream) this.mocapMediaStream.getTracks().forEach(t=>t.stop());
            this.mocapVideoEl.pause();
            if (this.mocapVideoEl.src && this.mocapVideoEl.src.startsWith('blob:')) {
                URL.revokeObjectURL(this.mocapVideoEl.src);
            }
            this.mocapVideoEl.srcObject = null; this.mocapVideoEl.removeAttribute('src');
            this.mocapCanvasEl.getContext("2d").clearRect(0,0,this.mocapCanvasEl.width,this.mocapCanvasEl.height);
            this.debugMocapText.innerText = "Inactive";
            btnRec.disabled = true; btnRec.style.opacity = "0.5";
            this.currentMocapSession = null;
        };

        btnRec.onclick = () => {
            if (!this.isMocapActive && selSource.value !== "video") return;
            
            // Capture name extraction
            const nameInput = this.container.querySelector("#mocap-name-input");
            const customName = nameInput && nameInput.value.trim() !== "" ? nameInput.value.trim() : `Capture ${this.recordedMocaps.length + 1}`;
            
            if (!this.isMocapRecording) {
                if (selSource.value === "video") {
                    this.isMocapRecording = true;
                    btnRec.disabled = true;
                    btnRec.innerText = "Processing...";
                    btnRec.style.background = "#811";
                    this.mocapVideoEl.pause();
                    btnPlayPause.innerText = "▶";
                    
                    this.currentMocapSession = {
                        id: `mocap_${Date.now()}`,
                        name: customName,
                        frames: [], duration: 0, fps: 30
                    };
                    
                    const duration = this.mocapVideoEl.duration;
                    const FPS = 30;
                    const step = 1/FPS;
                    
                    // Constrain processing to the user-selected slider range
                    let currentTime = this.mocapRangeStart * duration;
                    const targetEndTime = this.mocapRangeEnd * duration;
                    
                    const w = this.mocapVideoEl.videoWidth || 640;
                    const h = this.mocapVideoEl.videoHeight || 480;

                    const wasActive = this.isMocapActive;
                    this.isMocapActive = false; 

                    let monotonicTime = performance.now();

                    const processFrame = async () => {
                        // Stop processing if we exceed the dragged range handle or file duration
                        if (currentTime > targetEndTime || currentTime >= duration) {
                            this.currentMocapSession.duration = this.currentMocapSession.frames.length / FPS;
                            this.recordedMocaps.push(this.currentMocapSession);
                            this.syncMocapDropdowns();
                            this.saveMocapToServer(this.currentMocapSession); 
                            this.debugMocapText.innerText = `Saved (${this.currentMocapSession.frames.length}f)`;
                            
                            // Clear input visually for next capture
                            if (nameInput) nameInput.value = "";

                            this.isMocapRecording = false;
                            this.currentMocapSession = null;
                            btnRec.disabled = false;
                            btnRec.innerText = "🔴 Rec";
                            btnRec.style.background = "#511";
                            this.isMocapActive = wasActive;
                            if(this.isMocapActive) this.mocapLoop();
                            return;
                        }

                        await new Promise(r => {
                            let done = false;
                            const onSeek = () => { if(done)return; done=true; this.mocapVideoEl.removeEventListener('seeked', onSeek); r(); };
                            this.mocapVideoEl.addEventListener('seeked', onSeek);
                            this.mocapVideoEl.currentTime = currentTime;
                            setTimeout(() => { if(!done) onSeek(); }, 500); 
                        });

                        monotonicTime += (1000 / FPS); 
                        
                        const ctx = this.mocapCanvasEl.getContext("2d");
                        ctx.save();
                        ctx.drawImage(this.mocapVideoEl, 0, 0, w, h);
                        ctx.restore();

                        try {
                            const res = this.faceLandmarker.detectForVideo(this.mocapCanvasEl, monotonicTime);
                            if (res.faceLandmarks && res.faceLandmarks.length > 0) {
                                const face = res.faceLandmarks[0];
                                
                                ctx.fillStyle = "#0f0";
                                MP_TO_OP_FACE.forEach(idx => {
                                    const p = face[idx];
                                    ctx.beginPath();
                                    ctx.arc(p.x * w, p.y * h, 2, 0, 2 * Math.PI);
                                    ctx.fill();
                                });

                                const framePoints = this.extractFaceData(face, w, h);
                                this.currentMocapSession.frames.push(framePoints);
                            } else if (this.currentMocapSession.frames.length > 0) {
                                this.currentMocapSession.frames.push(this.currentMocapSession.frames[this.currentMocapSession.frames.length-1]);
                            }
                        } catch(e) { console.warn("[Yedp] Face detection frame error:", e); }
                        
                        const rangeSpan = targetEndTime - (this.mocapRangeStart * duration);
                        const progress = rangeSpan > 0 ? ((currentTime - (this.mocapRangeStart * duration)) / rangeSpan) * 100 : 100;
                        
                        this.debugMocapText.innerText = `Processing: ${Math.round(progress)}%`;
                        vidTimeline.value = (currentTime/duration)*100;
                        
                        currentTime += step;
                        setTimeout(processFrame, 1); 
                    };
                    processFrame();

                } else {
                    if (this.isMocapStarting) return; 
                    this.isMocapStarting = true;
                    
                    let c = 3;
                    this.debugMocapText.innerText = "Starting in 3...";
                    btnRec.disabled = true; btnRec.style.opacity = "0.5";
                    
                    this.mocapOverlay.innerText = c;
                    this.mocapOverlay.style.display = "block";

                    this.mocapTimer = setInterval(() => {
                        c--;
                        if(c > 0) {
                            this.debugMocapText.innerText = `Starting in ${c}...`;
                            this.mocapOverlay.innerText = c;
                        } else {
                            clearInterval(this.mocapTimer);
                            this.isMocapStarting = false;
                            this.mocapOverlay.style.display = "none";
                            btnRec.disabled = false; btnRec.style.opacity = "1.0";
                            
                            this.isMocapRecording = true;
                            btnRec.innerText = "⬛ Save";
                            btnRec.style.background = "#811";
                            this.currentMocapSession = {
                                id: `mocap_${Date.now()}`,
                                name: customName,
                                frames: [], duration: 0, fps: 30, startTime: performance.now()
                            };
                            this.debugMocapText.innerText = "🔴 RECORDING...";
                        }
                    }, 1000);
                }

            } else {
                this.isMocapRecording = false;
                btnRec.innerText = "🔴 Rec"; btnRec.style.background = "#511";
                this.debugMocapText.style.color = "";
                this.debugMocapText.innerText = "Tracking";
                if (this.currentMocapSession && this.currentMocapSession.frames.length > 0) {
                    const elapsed = (performance.now() - this.currentMocapSession.startTime) / 1000;
                    this.currentMocapSession.duration = elapsed;
                    this.currentMocapSession.fps = this.currentMocapSession.frames.length / elapsed;
                    this.recordedMocaps.push(this.currentMocapSession);
                    this.syncMocapDropdowns();
                    this.saveMocapToServer(this.currentMocapSession);
                    this.debugMocapText.innerText = `Saving (${this.currentMocapSession.frames.length}f)...`;

                    // Clear input visually for next capture
                    if (nameInput) nameInput.value = "";
                } else {
                    const reason = !this.faceLandmarker
                        ? "MediaPipe not loaded"
                        : "No face detected during recording (check lighting / face in frame)";
                    this.debugMocapText.innerText = `⚠ Empty capture discarded — ${reason}`;
                    this.debugMocapText.style.color = "#fb3";
                    console.warn(`[Yedp] Empty mocap capture discarded. Reason: ${reason}`);
                }
                this.currentMocapSession = null;
            }
        }

        // --- CUSTOM CAPTURE NAME FIELD ---
        const nameInputRow = document.createElement("div");
        nameInputRow.style.display = "flex"; nameInputRow.style.gap = "4px"; nameInputRow.style.marginTop = "8px";
        const mocapNameInput = document.createElement("input");
        mocapNameInput.type = "text";
        mocapNameInput.placeholder = "Enter Capture Name...";
        mocapNameInput.id = "mocap-name-input";
        Object.assign(mocapNameInput.style, { flex: "1", background: "#111", color: "#00d2ff", border: "1px solid #444", borderRadius: "3px", fontSize: "10px", padding: "4px" });
        mocapNameInput.addEventListener('keydown', e => e.stopPropagation()); // stop hotkeys from triggering
        nameInputRow.appendChild(mocapNameInput);

        const btnAddMocapBinding = createBtn("+ Add Face Bind", "#255", "#377");
        btnAddMocapBinding.style.flex = "none"; btnAddMocapBinding.style.padding = "2px 6px"; btnAddMocapBinding.style.fontSize = "9px";
        btnAddMocapBinding.style.marginTop = "4px";
        btnAddMocapBinding.onclick = (e) => { e.stopPropagation(); this.addMocapBinding(); };
        
        this.uiMocapList = document.createElement("div");
        this.uiMocapList.style.display = "flex"; this.uiMocapList.style.flexDirection = "column"; this.uiMocapList.style.gap = "6px";

        mocapCol.content.append(mocapPrevWrapper, mocapCtrlRow1, mocapCtrlRow2, nameInputRow, btnAddMocapBinding, this.uiMocapList);

        // ENVIRONMENTS
        const envCol = createCollapsible(`${iconEnv} Environments`, true);
        const btnAddEnv = createBtn("+ Add Env", "#353", "#474");
        btnAddEnv.style.flex = "none"; btnAddEnv.style.padding = "2px 6px"; btnAddEnv.style.fontSize = "9px";
        btnAddEnv.onclick = (e) => { e.stopPropagation(); this.addEnvironment(); };
        envCol.head.appendChild(btnAddEnv);
        this.uiEnvList = document.createElement("div");
        this.uiEnvList.style.display = "flex"; this.uiEnvList.style.flexDirection = "column"; this.uiEnvList.style.gap = "6px";
        envCol.content.appendChild(this.uiEnvList);
        
        this.uiSidebar.appendChild(transCol.wrap);
        this.uiSidebar.appendChild(camCol.wrap);
        this.uiSidebar.appendChild(lightCol.wrap);
        this.uiSidebar.appendChild(charCol.wrap);
        this.uiSidebar.appendChild(mocapCol.wrap); 
        this.uiSidebar.appendChild(envCol.wrap);

        this.updateTransformUIFromObject();
    }

    // --- LOGIC: DATA FETCHING & SAVING MOCAP ---
    async fetchRigs() {
        try {
            const res = await api.fetchApi("/yedp/get_rigs");
            const data = await res.json();
            if (data.files && data.files.length > 0) this.availableRigs = data.files;
            else this.availableRigs = ["Yedp_Rig.glb"];
        } catch(e) { 
            console.error("Failed to fetch rigs."); 
            this.availableRigs = ["Yedp_Rig.glb"]; 
        }
    }

    async fetchMocaps() {
        try {
            const res = await api.fetchApi("/yedp/get_mocaps");
            const data = await res.json();
            if (data.files && data.files.length > 0) {
                let updated = false;
                for (const file of data.files) {
                    try {
                        const url = `/view?filename=${encodeURIComponent(file)}&type=input&subfolder=yedp_mocap&t=${Date.now()}`;
                        const req = await fetch(url);
                        const mocapData = await req.json();
                        
                        if (!this.recordedMocaps.find(m => m.id === mocapData.id)) {
                            this.recordedMocaps.push(mocapData);
                            updated = true;
                        }
                    } catch (err) {
                        console.error(`[Yedp] Failed to parse mocap JSON file: ${file}`, err);
                    }
                }
                if (updated) this.syncMocapDropdowns();
            }
        } catch(e) { console.error("Failed to fetch mocaps.", e); }
    }

    async saveMocapToServer(mocapData) {
        try {
            const res = await api.fetchApi("/yedp/save_mocap", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(mocapData)
            });
            if (!res.ok) {
                const txt = await res.text().catch(() => `HTTP ${res.status}`);
                console.error(`[Yedp] Save mocap HTTP ${res.status}:`, txt);
                if (this.debugMocapText) {
                    this.debugMocapText.innerText = `Save FAILED (HTTP ${res.status}) — see console`;
                    this.debugMocapText.style.color = "#f55";
                }
                return;
            }
            const data = await res.json();
            if (data.status === "success") {
                console.log(`[Yedp] Saved mocap to file: ${data.file}`);
                if (this.debugMocapText) {
                    this.debugMocapText.innerText = `✅ Saved: ${data.file}`;
                    this.debugMocapText.style.color = "#5f5";
                }
            } else {
                console.error("[Yedp] Save mocap returned error:", data);
                if (this.debugMocapText) {
                    this.debugMocapText.innerText = `Save error: ${data.message || "unknown"}`;
                    this.debugMocapText.style.color = "#f55";
                }
            }
        } catch (e) {
            console.error("[Yedp] Failed to save mocap to disk", e);
            if (this.debugMocapText) {
                this.debugMocapText.innerText = `Save FAILED: ${e.message}`;
                this.debugMocapText.style.color = "#f55";
            }
        }
    }

    // --- LOGIC: MOCAP & MEDIAPIPE ---
    async initMediaPipe() {
        if (this.visionLib) return;
        this.debugMocapText.innerText = "Loading MediaPipe...";
        try {
            const visionUrl = new URL("./tasks_vision.js", this.baseUrl).href;
            this.visionLib = await import(visionUrl);
            const visionTask = await this.visionLib.FilesetResolver.forVisionTasks(this.baseUrl);
            const faceTaskUrl = new URL("./face_landmarker.task", this.baseUrl).href;
            
            this.faceLandmarker = await this.visionLib.FaceLandmarker.createFromOptions(visionTask, {
                baseOptions: { modelAssetPath: faceTaskUrl, delegate: "GPU" },
                runningMode: "VIDEO", numFaces: 1
            });
            this.debugMocapText.innerText = "Ready";
        } catch(e) {
            console.error(e);
            this.debugMocapText.innerText = "Failed to load MediaPipe";
            this.debugMocapText.style.color = "red";
        }
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
        
        return MP_TO_OP_FACE.map(idx => {
            const p = toVec3(face[idx]);
            p.sub(pOrigin); 
            p.applyMatrix4(faceMatrixInv); 
            return { x: p.x, y: p.y, z: p.z }; 
        });
    }

    mocapLoop() {
        if (!this.isMocapActive) return;
        requestAnimationFrame(() => this.mocapLoop());
        
        if (this.mocapVideoEl.readyState >= 2) {
            if (this.mocapVideoEl.duration) {
                if (this._mocapVideoTimeline && !this.mocapVideoEl.paused) {
                    this._mocapVideoTimeline.value = (this.mocapVideoEl.currentTime / this.mocapVideoEl.duration) * 100;
                }
            }

            const w = this.mocapVideoEl.videoWidth || 640;
            const h = this.mocapVideoEl.videoHeight || 480;
            
            const sourceSel = this.container.querySelector("#mocap-sel-source");
            const isWebcam = sourceSel ? sourceSel.value === "webcam" : true; 

            if (this.mocapCanvasEl.width !== w) {
                this.mocapCanvasEl.width = w; 
                this.mocapCanvasEl.height = h;
            }

            const ctx = this.mocapCanvasEl.getContext("2d");
            ctx.save();
            if (isWebcam) {
                ctx.scale(-1, 1); 
                ctx.translate(-w, 0);
            }
            ctx.drawImage(this.mocapVideoEl, 0, 0, w, h);
            ctx.restore();

            if (this.faceLandmarker) {
                const res = this.faceLandmarker.detectForVideo(this.mocapVideoEl, performance.now());
                if (res.faceLandmarks && res.faceLandmarks.length > 0) {
                    const face = res.faceLandmarks[0];
                    
                    ctx.fillStyle = "#0f0";
                    MP_TO_OP_FACE.forEach(idx => {
                        const p = face[idx];
                        ctx.beginPath();
                        if (isWebcam) {
                            ctx.arc((1 - p.x) * w, p.y * h, 2, 0, 2 * Math.PI);
                        } else {
                            ctx.arc(p.x * w, p.y * h, 2, 0, 2 * Math.PI);
                        }
                        ctx.fill();
                    });

                    if (this.isMocapRecording && this.currentMocapSession && isWebcam) {
                        const framePoints = this.extractFaceData(face, w, h);
                        this.currentMocapSession.frames.push(framePoints);
                        const n = this.currentMocapSession.frames.length;
                        if (n === 1) {
                            console.log(`[Yedp] First webcam frame captured. paused=${this.mocapVideoEl.paused}, readyState=${this.mocapVideoEl.readyState}, ts=${performance.now()}`);
                        }
                        if (n % 10 === 0) {
                            this.debugMocapText.innerText = `🔴 RECORDING... ${n}f`;
                        }
                    }
                }
            }
        }
    }

    addMocapBinding() {
        this.mocapBindingCounter++;
        const id = this.mocapBindingCounter;
        this.mocapBindings.push({
            id: id,
            charId: this.characters.length > 0 ? this.characters[0].id : null,
            mocapId: null,
            amplitude: 1.0, 
            loop: true
        });
        this.renderMocapBindings();
        this.forceUpdateFrame();
    }

    removeMocapBinding(id) {
        this.mocapBindings = this.mocapBindings.filter(b => b.id !== id);
        this.renderMocapBindings();
        this.forceUpdateFrame();
    }

    syncMocapDropdowns() {
        this.uiMocapDropdowns.forEach(sel => {
            const current = sel.value;
            sel.innerHTML = '<option value="none">-- Select Mocap --</option>';
            this.recordedMocaps.forEach(m => sel.add(new Option(m.name, m.id)));
            if (this.recordedMocaps.find(m => m.id === current)) sel.value = current;
        });
    }

    renderMocapBindings() {
        this.uiMocapList.innerHTML = "";
        this.uiMocapDropdowns = [];
        
        const stopEvent = e => e.stopPropagation();

        this.mocapBindings.forEach(b => {
            const card = document.createElement("div"); 
            Object.assign(card.style, { background: "#222", border: "1px solid #444", borderRadius: "4px", padding: "6px" });
            
            const head = document.createElement("div"); head.style.display = "flex"; head.style.justifyContent = "space-between"; head.style.marginBottom = "4px";
            head.innerHTML = `<span style="font-weight:bold; font-size:10px; color:#00d2ff;">Face Rig Bind</span>`;
            const btnDel = document.createElement("button"); btnDel.innerText = "X"; Object.assign(btnDel.style, { background: "#622", color: "#fff", border: "1px solid #555", borderRadius: "2px", cursor: "pointer", fontSize: "9px" }); 
            btnDel.onclick = () => this.removeMocapBinding(b.id);
            head.appendChild(btnDel);

            const rowSel = document.createElement("div"); rowSel.style.display = "flex"; rowSel.style.gap = "4px"; rowSel.style.marginBottom = "4px";
            
            const selChar = document.createElement("select");
            Object.assign(selChar.style, { flex: "1", width: "0", background: "#111", color: "#fff", border: "1px solid #444", borderRadius: "3px", fontSize: "9px", padding: "2px" });
            selChar.add(new Option("-- Target --", "none"));
            this.characters.forEach(c => selChar.add(new Option(`Char ${c.id}`, c.id)));
            selChar.value = b.charId || "none";
            selChar.onchange = (e) => { b.charId = e.target.value === "none" ? null : parseInt(e.target.value); this.forceUpdateFrame(); };

            const selMocap = document.createElement("select");
            Object.assign(selMocap.style, { flex: "1", width: "0", background: "#111", color: "#fff", border: "1px solid #444", borderRadius: "3px", fontSize: "9px", padding: "2px" });
            selMocap.add(new Option("-- Select Mocap --", "none"));
            this.recordedMocaps.forEach(m => selMocap.add(new Option(m.name, m.id)));
            selMocap.value = b.mocapId || "none";
            selMocap.onchange = (e) => { b.mocapId = e.target.value === "none" ? null : e.target.value; this.forceUpdateFrame(); };
            this.uiMocapDropdowns.push(selMocap);

            rowSel.append(selChar, selMocap);

            const rowScl = document.createElement("div"); 
            rowScl.style.display = "flex"; rowScl.style.alignItems = "center"; rowScl.style.gap = "4px";
            
            const s = document.createElement("span"); s.innerText = "Amp"; s.style.fontSize="9px"; s.style.color="#888"; s.style.width="20px";
            
            const currentAmp = b.amplitude !== undefined ? b.amplitude : (b.scale !== undefined ? b.scale : 1.0);
            
            const sld = document.createElement("input"); 
            sld.type = "range"; sld.min = "0.0"; sld.max = "3.0"; sld.step = "0.05"; sld.value = currentAmp;
            Object.assign(sld.style, { flex: "1", width: "0" });
            
            const inp = document.createElement("input"); 
            inp.type="number"; inp.step="0.05"; inp.value = currentAmp; 
            Object.assign(inp.style, { width:"36px", background:"#111", color:"#00d2ff", border:"1px solid #444", fontSize:"9px", padding:"2px", textAlign:"right" }); 
            
            const syncUI = (v) => { 
                b.amplitude = v; sld.value = v; inp.value = v; 
                this.forceUpdateFrame(); 
            };
            
            sld.oninput = (e) => syncUI(parseFloat(e.target.value));
            inp.onchange = (e) => syncUI(parseFloat(e.target.value)||1.0);
            
            inp.addEventListener('keydown', stopEvent); inp.addEventListener('keyup', stopEvent);
            inp.addEventListener('keypress', stopEvent); inp.addEventListener('pointerdown', stopEvent);
            inp.addEventListener('mousedown', stopEvent);

            const lblLoop = document.createElement("label"); lblLoop.style.cursor = "pointer"; lblLoop.style.display = "flex"; lblLoop.style.gap = "2px"; lblLoop.style.fontSize = "9px"; lblLoop.style.color = "#ccc"; lblLoop.style.whiteSpace = "nowrap";
            const chkLoop = document.createElement("input"); chkLoop.type = "checkbox"; chkLoop.checked = b.loop !== false;
            chkLoop.onchange = (e) => { b.loop = e.target.checked; this.forceUpdateFrame(); };
            lblLoop.append(chkLoop, "Loop");

            rowScl.append(s, sld, inp, lblLoop);
            card.append(head, rowSel, rowScl);
            this.uiMocapList.appendChild(card);
        });
    }

    // --- SELECTION & TRANSFORM ---
    selectObject(obj, type, id) {
        this.selected = { obj, type, id };
        
        if (!obj) {
            this.transformControls.detach();
        } else if (type === 'camera') {
            this.transformControls.detach(); 
        } else {
            this.transformControls.attach(type === 'character' ? obj.scene : obj.group);
            if (type === 'light' && this.transformControls.getMode() === 'scale') {
                this.transformControls.setMode('translate'); 
            }
        }
        
        this.updateGizmoUI(this.transformControls.getMode());
        this.refreshSidebarHighlights();
        this.updateTransformUIFromObject();
    }

    updateTransformUIFromObject() {
        const ui = this.uiTransformInputs;
        const s = this.selected;
        if (!s.obj) {
            Object.values(ui).forEach(inp => { inp.value = "0.0"; inp.disabled = true; inp.style.opacity = "0.3"; });
            return;
        }
        
        const tgt = s.type === 'character' ? s.obj.scene : (s.type === 'light' || s.type === 'environment' ? s.obj.group : s.obj);
        
        Object.values(ui).forEach(inp => { inp.disabled = false; inp.style.opacity = "1.0"; });
        
        ui.px.value = tgt.position.x.toFixed(2); ui.py.value = tgt.position.y.toFixed(2); ui.pz.value = tgt.position.z.toFixed(2);
        ui.rx.value = this.THREE.MathUtils.radToDeg(tgt.rotation.x).toFixed(1); 
        ui.ry.value = this.THREE.MathUtils.radToDeg(tgt.rotation.y).toFixed(1); 
        ui.rz.value = this.THREE.MathUtils.radToDeg(tgt.rotation.z).toFixed(1);
        
        if (s.type === 'camera' || s.type === 'light') {
            ui.sx.disabled = ui.sy.disabled = ui.sz.disabled = true;
            ui.sx.style.opacity = ui.sy.style.opacity = ui.sz.style.opacity = "0.3";
            ui.sx.value = ui.sy.value = ui.sz.value = "1.0";
        } else {
            ui.sx.value = tgt.scale.x.toFixed(2); ui.sy.value = tgt.scale.y.toFixed(2); ui.sz.value = tgt.scale.z.toFixed(2);
        }
    }

    updateObjectFromTransformUI() {
        const s = this.selected;
        if (!s.obj) return;
        const tgt = s.type === 'character' ? s.obj.scene : (s.type === 'light' || s.type === 'environment' ? s.obj.group : s.obj);
        const ui = this.uiTransformInputs;
        
        const px = parseFloat(ui.px.value)||0; const py = parseFloat(ui.py.value)||0; const pz = parseFloat(ui.pz.value)||0;
        const rx = this.THREE.MathUtils.degToRad(parseFloat(ui.rx.value)||0);
        const ry = this.THREE.MathUtils.degToRad(parseFloat(ui.ry.value)||0);
        const rz = this.THREE.MathUtils.degToRad(parseFloat(ui.rz.value)||0);

        if (s.type === 'camera') {
            const deltaPos = new this.THREE.Vector3(px, py, pz).sub(this.camera.position);
            this.camera.position.add(deltaPos);
            this.controls.target.add(deltaPos);
            const dist = this.camera.position.distanceTo(this.controls.target) || 1.0;
            this.camera.rotation.set(rx, ry, rz);
            const forward = new this.THREE.Vector3(0, 0, -1).applyEuler(this.camera.rotation);
            this.controls.target.copy(this.camera.position).add(forward.multiplyScalar(dist));
            this.controls.update();
        } else {
            tgt.position.set(px, py, pz); tgt.rotation.set(rx, ry, rz);
            if (s.type === 'character' || s.type === 'environment') tgt.scale.set(parseFloat(ui.sx.value)||1, parseFloat(ui.sy.value)||1, parseFloat(ui.sz.value)||1);
        }
    }

    refreshSidebarHighlights() {
        const resetStyles = (list, type) => {
            if(list) Array.from(list.children).forEach(card => {
                const isActive = this.selected.type === type && card.dataset.id == this.selected.id;
                card.style.borderColor = isActive ? "#00d2ff" : "#444";
            });
        };
        resetStyles(this.uiCharList, 'character');
        resetStyles(this.uiEnvList, 'environment');
        resetStyles(this.uiLightList, 'light');
    }

    // --- LOGIC: DATA FETCHING ---
    async fetchAnimations() {
        try {
            const res = await api.fetchApi("/yedp/get_animations");
            const data = await res.json();
            if (data.files && data.files.length > 0) this.availableAnimations = ["none", ...data.files.filter(f => f !== "none")];
        } catch(e) { console.error("Failed to fetch animations."); }
    }

    async fetchEnvs() {
        try {
            const res = await api.fetchApi("/yedp/get_envs");
            const data = await res.json();
            if (data.files && data.files.length > 0) this.availableEnvs = ["none", ...data.files.filter(f => f !== "none")];
        } catch(e) { console.error("Failed to fetch envs."); }
    }

    async fetchCams() {
        try {
            const res = await api.fetchApi("/yedp/get_cams");
            const data = await res.json();
            if (data.files && data.files.length > 0) this.availableCams = ["none", ...data.files.filter(f => f !== "none")];
        } catch(e) { console.error("Failed to fetch cams."); }
    }

    async loadRig(filename) {
        if (this.rigCaches.has(filename)) return this.rigCaches.get(filename);
        
        const isFBX = filename.toLowerCase().endsWith(".fbx");
        const loader = isFBX ? new this.FBXLoader() : new this.GLTFLoaderClass();
        let rigUrl;
        // Default rig and any .glb/.fbx found in the extension's web folder
        const webUrl = new URL(`../${filename}?t=${Date.now()}`, this.baseUrl).href;
        const inputUrl = `/view?filename=${encodeURIComponent(filename)}&type=input&subfolder=yedp_rigs&t=${Date.now()}`;
        
        // Try web folder first for all rigs (the Python backend lists web folder rigs too)
        // then fall back to input/yedp_rigs/
        const tryUrls = [webUrl, inputUrl];
        
        for (const url of tryUrls) {
            try {
                console.log("[Yedp] Trying to load Rig from:", url);
                const model = await loader.loadAsync(url);
                const rig = isFBX ? model : model.scene;
                
                rig.traverse((child) => {
                    if(child.isBone || child.type === "Bone" || child.isObject3D) {
                        const normalized = semanticNormalize(child.name);
                        if (normalized) this.semanticMap.set(normalized, child.name);
                    }
                });
                
                this.rigCaches.set(filename, rig);
                return rig;
            } catch(e) {
                console.warn(`[Yedp] Rig not found at ${url}, trying next...`);
                continue;
            }
        }
        
        // All URLs failed
        console.error("[Yedp] Failed to load rig from any location:", filename);
        if(filename !== "Yedp_Rig.glb") {
            return await this.loadRig("Yedp_Rig.glb"); // Fallback
        }
        throw new Error(`Failed to load rig: ${filename}`);
    }

    async loadCameraAnim(filename) {
        if(!filename || filename === "none") {
            this.cameraMixer?.stopAllAction();
            this.cameraAction = null;
            this.cameraAnimNode = null;
            this.forceUpdateFrame();
            return;
        }
        const isFBX = filename.toLowerCase().endsWith(".fbx");
        const url = `/view?filename=${encodeURIComponent(filename)}&type=input&subfolder=yedp_cams&t=${Date.now()}`;
        try {
            const model = isFBX ? await new this.FBXLoader().loadAsync(url) : await new this.GLTFLoaderClass().loadAsync(url);
            let clip = isFBX ? model.animations?.[0] : (model.animations?.[0] || model.scene?.animations?.[0] || model.asset?.animations?.[0]);
            
            if (clip) {
                this.cameraAnimGroup.clear();
                let animTarget = model.scene || model;
                
                this.cameraAnimGroup.add(animTarget);
                this.cameraMixer = new this.THREE.AnimationMixer(animTarget);
                
                this.cameraAction = this.cameraMixer.clipAction(clip);
                this.cameraAction.setLoop(this.THREE.LoopRepeat);
                this.cameraAction.play();
                
                // PERFECTED TARGETING: Traverse hierarchy if native isCamera flag fails (common in FBX)
                let foundCam = animTarget.getObjectByProperty('isCamera', true);
                if (!foundCam) {
                    animTarget.traverse(child => {
                        if (!foundCam && child.name.toLowerCase().includes('camera')) {
                            foundCam = child;
                        }
                    });
                }
                
                this.cameraAnimNode = foundCam || animTarget;
                console.log("[Yedp] Bound custom animated camera tracking to:", this.cameraAnimNode.name);
                this.forceUpdateFrame();
            }
        } catch(e) { 
            console.error("Camera Anim Load Error:", e); 
        }
    }

    // --- LOGIC: LIGHTING ---
    addLight(presetType = 'point') {
        this.lightCounter++;
        const id = this.lightCounter;
        const group = new this.THREE.Group(); group.position.set(0, 2, 2);
        const lObj = { id, group, helper: null, light: null, type: presetType, color: '#ffffff', intensity: 1.0, range: 10, angle: 45, castShadow: true };
        this.lights.push(lObj);
        this.scene.add(group);
        this.updateLightType(lObj);
        this.renderLightCards();
    }
    removeLight(id) {
        const idx = this.lights.findIndex(l => l.id === id);
        if (idx === -1) return;
        const l = this.lights[idx];
        if (this.selected.type === 'light' && this.selected.id === id) this.selectObject(null, null, null);
        this.scene.remove(l.group);
        this.lights.splice(idx, 1);
        this.renderLightCards();
    }
    updateLightType(lObj) {
        if (lObj.light) lObj.group.remove(lObj.light);
        if (lObj.helper) lObj.group.remove(lObj.helper);
        const c = new this.THREE.Color(lObj.color);
        switch(lObj.type) {
            case 'ambient': lObj.light = new this.THREE.AmbientLight(c, lObj.intensity); break;
            case 'directional': lObj.light = new this.THREE.DirectionalLight(c, lObj.intensity); break;
            case 'point': lObj.light = new this.THREE.PointLight(c, lObj.intensity, lObj.range); break;
            case 'spot': lObj.light = new this.THREE.SpotLight(c, lObj.intensity, lObj.range, this.THREE.MathUtils.degToRad(lObj.angle), 0.5, 1); break;
        }
        if (lObj.type === 'directional' || lObj.type === 'spot') {
            lObj.light.target.position.set(0, 0, -1); lObj.group.add(lObj.light.target);
        }
        const helperMat = new this.THREE.MeshBasicMaterial({color:0xffaa00, wireframe:true});
        if (lObj.type === 'point') lObj.helper = new this.THREE.Mesh(new this.THREE.SphereGeometry(0.2, 8, 8), helperMat);
        else if (lObj.type === 'spot') {
            lObj.helper = new this.THREE.Mesh(new this.THREE.ConeGeometry(0.3, 0.6, 8, 1, true), helperMat);
            lObj.helper.rotation.x = Math.PI / 2; lObj.helper.position.z = -0.3;
        } else if (lObj.type === 'directional') {
            lObj.helper = new this.THREE.Group();
            const shaft = new this.THREE.Mesh(new this.THREE.CylinderGeometry(0.02, 0.02, 0.4), helperMat);
            shaft.rotation.x = Math.PI / 2; shaft.position.z = -0.2;
            const head = new this.THREE.Mesh(new this.THREE.ConeGeometry(0.1, 0.2), helperMat);
            head.rotation.x = -Math.PI / 2; head.position.z = -0.5;
            lObj.helper.add(shaft, head);
        } else lObj.helper = new this.THREE.Group();
        
        if (lObj.type !== 'ambient') {
            lObj.light.castShadow = lObj.castShadow;
            if (lObj.light.shadow) { lObj.light.shadow.mapSize.width = 1024; lObj.light.shadow.mapSize.height = 1024; }
        }
        lObj.group.add(lObj.light); lObj.group.add(lObj.helper);
        lObj.helper.visible = lObj.type !== 'ambient'; 
        this.forceUpdateFrame();
    }
    renderLightCards() {
        this.uiLightList.innerHTML = "";
        
        const stopEvent = e => e.stopPropagation();

        this.lights.forEach(l => {
            const card = document.createElement("div"); card.dataset.id = l.id;
            Object.assign(card.style, { background: "#222", border: "1px solid #444", borderRadius: "4px", padding: "6px", cursor: "pointer", transition: "border-color 0.2s" });
            
            card.onclick = (e) => {
                if (['button', 'input', 'select', 'option'].includes(e.target.tagName.toLowerCase())) return;
                this.selectObject(l, 'light', l.id);
            };

            const head = document.createElement("div"); head.style.display = "flex"; head.style.justifyContent = "space-between"; head.style.marginBottom = "4px";
            const selType = document.createElement("select");
            Object.assign(selType.style, { background: "#111", color: "#fff", border: "1px solid #444", borderRadius: "3px", fontSize: "10px", padding: "1px" });
            ['ambient', 'directional', 'point', 'spot'].forEach(t => selType.add(new Option(t, t)));
            selType.value = l.type; selType.onchange = (e) => { l.type = e.target.value; this.updateLightType(l); this.renderLightCards(); };
            
            const btnDel = document.createElement("button"); btnDel.innerText = "X"; Object.assign(btnDel.style, { background: "#622", color: "#fff", border: "1px solid #555", borderRadius: "2px", cursor: "pointer", fontSize: "9px" }); btnDel.onclick = () => this.removeLight(l.id);
            head.append(selType, btnDel);

            const ctrls = document.createElement("div"); ctrls.style.display = "grid"; ctrls.style.gridTemplateColumns = "1fr 1fr"; ctrls.style.gap = "4px";
            const wrap = (lbl, elem) => { const d = document.createElement("div"); d.style.display="flex"; d.style.alignItems="center"; d.style.gap="4px"; const s = document.createElement("span"); s.innerText = lbl; s.style.fontSize="9px"; s.style.color="#888"; s.style.width="20px"; d.append(s, elem); return d; };

            const inpCol = document.createElement("input"); inpCol.type = "color"; inpCol.value = l.color; inpCol.style.width = "100%"; inpCol.style.height = "16px"; inpCol.style.padding = "0"; inpCol.style.border = "none"; inpCol.onchange = (e) => { l.color = e.target.value; this.updateLightType(l); };
            const inpInt = document.createElement("input"); inpInt.type = "number"; inpInt.step = "0.1"; inpInt.value = l.intensity; Object.assign(inpInt.style, { width:"100%", background:"#111", color:"#fff", border:"1px solid #444", fontSize:"10px" }); inpInt.onchange = (e) => { l.intensity = parseFloat(e.target.value); this.updateLightType(l); };
            inpInt.addEventListener('keydown', stopEvent); inpInt.addEventListener('mousedown', stopEvent);
            ctrls.append(wrap("Col", inpCol), wrap("Int", inpInt));

            if (l.type === 'point' || l.type === 'spot') {
                const inpRng = document.createElement("input"); inpRng.type = "number"; inpRng.step = "1"; inpRng.value = l.range; Object.assign(inpRng.style, { width:"100%", background:"#111", color:"#fff", border:"1px solid #444", fontSize:"10px" }); inpRng.onchange = (e) => { l.range = parseFloat(e.target.value); this.updateLightType(l); }; 
                inpRng.addEventListener('keydown', stopEvent); inpRng.addEventListener('mousedown', stopEvent);
                ctrls.append(wrap("Rng", inpRng));
            }
            if (l.type === 'spot') {
                const inpAng = document.createElement("input"); inpAng.type = "number"; inpAng.step = "1"; inpAng.value = l.angle; Object.assign(inpAng.style, { width:"100%", background:"#111", color:"#fff", border:"1px solid #444", fontSize:"10px" }); inpAng.onchange = (e) => { l.angle = parseFloat(e.target.value); this.updateLightType(l); }; 
                inpAng.addEventListener('keydown', stopEvent); inpAng.addEventListener('mousedown', stopEvent);
                ctrls.append(wrap("Ang", inpAng));
            }
            if (l.type !== 'ambient') {
                const lblShad = document.createElement("label"); lblShad.style.fontSize="9px"; lblShad.style.color="#ccc"; lblShad.style.display="flex"; lblShad.style.gap="2px"; lblShad.style.alignItems="center";
                const chkShad = document.createElement("input"); chkShad.type = "checkbox"; chkShad.checked = l.castShadow; chkShad.onchange = (e) => { l.castShadow = e.target.checked; this.updateLightType(l); };
                lblShad.append(chkShad, "Shadows"); ctrls.append(lblShad);
            }
            card.append(head, ctrls); this.uiLightList.appendChild(card);
        });
        this.refreshSidebarHighlights();
    }

    // --- LOGIC: ENVIRONMENTS ---
    addEnvironment() {
        this.envCounter++;
        const newEnv = new EnvironmentInstance(this.envCounter, this.THREE);
        this.scene.add(newEnv.group);
        this.environments.push(newEnv);
        this.renderEnvironmentCards();
    }

    removeEnvironment(id) {
        const idx = this.environments.findIndex(e => e.id === id);
        if (idx === -1) return;
        const e = this.environments[idx];
        if (this.selected.type === 'environment' && this.selected.id === id) this.selectObject(null, null, null);
        e.destroy(this.scene);
        this.environments.splice(idx, 1);
        this.renderEnvironmentCards();
    }

    async loadEnvironmentFile(envObj, filename) {
        const info = this.container.querySelector(`#env-mesh-info-${envObj.id}`);
        if(info) info.innerText = `[Loading...]`;

        if(!filename || filename === "none") {
            if (envObj.splatViewer && typeof envObj.splatViewer.dispose === 'function') {
                envObj.splatViewer.dispose();
            }
            envObj.group.clear();
            envObj.meshes = [];
            envObj.splatViewer = null;
            envObj.mixer.stopAllAction();
            envObj.action = null;
            envObj.forceSplat = null;
            if(info) info.innerText = `[Meshes: 0]`;
            this.forceUpdateFrame();
            return;
        }
        envObj.envFile = filename;
        const isFBX = filename.toLowerCase().endsWith(".fbx");
        const isPLY = filename.toLowerCase().endsWith(".ply");
        
        // Custom toggle logic allowing dynamic switching for PLY point clouds vs splats
        let isSPLAT = filename.toLowerCase().endsWith(".splat") || filename.toLowerCase().endsWith(".ksplat") || filename.toLowerCase().endsWith(".spz") || filename.toLowerCase().endsWith(".sog");
        
        if (isPLY) {
            if (envObj.forceSplat !== undefined && envObj.forceSplat !== null) {
                isSPLAT = envObj.forceSplat;
            } else {
                isSPLAT = filename.toLowerCase().includes("splat");
                envObj.forceSplat = isSPLAT;
            }
        } else {
            envObj.forceSplat = null;
        }

        const ext = filename.split('.').pop().toLowerCase();
        const url = `/view?filename=${encodeURIComponent(filename)}&type=input&subfolder=yedp_envs&t=${Date.now()}#.${ext}`;
        try {
            let targetObj;
            let model;

            if (isSPLAT) {
                
                const viewer = new this.DropInViewer({
                    gpuAcceleratedSort: false,     // BUGFIX 1: Stops the transparent/black screen rendering bug
                    sharedMemoryForWorkers: false,
                    rootElement: this.container    // BUGFIX 2: Forces the viewer to see the ComfyUI canvas size
                });
                
                await viewer.addSplatScene(url, {
                    showLoadingUI: false,
                    progressiveLoad: false
                    // NOTE: splatAlphaRemovalThreshold has been deleted to stop the crash!
                });
                
                // PATCH: Automatically fix the COLMAP upside-down coordinate system
                viewer.rotation.x = Math.PI;

                targetObj = viewer;
                model = targetObj;
            } else if (isFBX) {
                model = await new this.FBXLoader().loadAsync(url);
                targetObj = model;
            } else if (isPLY) {
                const geometry = await new this.PLYLoader().loadAsync(url);
                geometry.computeVertexNormals();
                if (geometry.attributes.color) {
                    const mat = new this.THREE.PointsMaterial({ size: 0.05, vertexColors: true });
                    targetObj = new this.THREE.Points(geometry, mat);
                } else {
                    const mat = new this.THREE.MeshStandardMaterial({ color: 0xcccccc });
                    targetObj = new this.THREE.Mesh(geometry, mat);
                }
                model = targetObj; 
            } else {
                model = await new this.GLTFLoaderClass().loadAsync(url);
                targetObj = model.scene;
            }
            
            // Critical cleanup to prevent WebGL GPU Leaks when toggling files
            if (envObj.splatViewer && typeof envObj.splatViewer.dispose === 'function') {
                envObj.splatViewer.dispose();
            }
            envObj.group.clear();
            envObj.meshes = [];
            envObj.splatViewer = null; // Clear old reference
            envObj.group.add(targetObj);
            
            if (!isSPLAT) {
                targetObj.traverse((child) => {
                    child.visible = true; 
                    if(child.isMesh || child.isSkinnedMesh || child.isPoints || child.type === 'Mesh' || child.type === 'SkinnedMesh' || child.type === 'Points') {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        if (child.isPoints || child.type === 'Points') {
                            child.customDepthMaterial = this.matsStatic.depthPointsShadow;
                            child.customDistanceMaterial = this.matsStatic.distancePointsShadow;
                        }
                        child.frustumCulled = false; 
                        
                        if (child.material) {
                            const fixMat = (mat) => {
                                if (mat.transparent && mat.opacity < 0.01) {
                                    mat.transparent = false;
                                    mat.opacity = 1.0;
                                }
                                mat.side = this.THREE.DoubleSide; 
                            };
                            if (Array.isArray(child.material)) child.material.forEach(fixMat);
                            else fixMat(child.material);
                        }
                        
                        envObj.meshes.push(child);
                        if(!this.originalMaterials.has(child)) this.originalMaterials.set(child, child.material);
                    }
                });
            } else {
                // Store splat reference explicitly to bypass the standard materials map but control visibility!
                envObj.splatViewer = targetObj;
            }
            
            if(info) info.innerText = isSPLAT ? `[Gaussian Splat]` : `[Meshes: ${envObj.meshes.length}]`;

            let clip = isFBX ? model.animations?.[0] : (!isPLY ? (model.animations?.[0] || model.scene?.animations?.[0] || model.asset?.animations?.[0]) : null);
            if(clip) {
                envObj.mixer = new this.THREE.AnimationMixer(targetObj);
                envObj.action = envObj.mixer.clipAction(clip);
                envObj.action.setLoop(this.THREE.LoopRepeat);
                envObj.action.reset().setEffectiveWeight(1).play();
                envObj.duration = clip.duration;
            } else {
                envObj.action = null;
                envObj.duration = 0;
            }
            
            const lbl = this.container.querySelector(`#env-dur-${envObj.id}`);
            if (lbl) {
                const fps = this.getWidgetValue("fps", 24);
                lbl.innerText = envObj.duration > 0 ? `${Math.floor(envObj.duration * fps)}f` : "Static";
            }
            
            this.updateVisibilities();
            this.forceUpdateFrame();

        } catch(e) { 
            console.error("Env Load Error:", e); 
            envObj.group.clear();
            if(info) info.innerHTML = `<span style="color:red;">[Load Error]</span>`;
        }
    }

    renderEnvironmentCards() {
        this.uiEnvList.innerHTML = "";
        this.environments.forEach(e => {
            const card = document.createElement("div"); card.dataset.id = e.id;
            Object.assign(card.style, { background: "#222", border: "1px solid #444", borderRadius: "4px", padding: "6px", cursor: "pointer", transition: "border-color 0.2s" });
            
            card.onclick = (evt) => {
                if (['button', 'input', 'select', 'option'].includes(evt.target.tagName.toLowerCase())) return;
                this.selectObject(e, 'environment', e.id);
            };

            const head = document.createElement("div"); head.style.display = "flex"; head.style.justifyContent = "space-between"; head.style.marginBottom = "2px";
            head.innerHTML = `<span style="font-weight:bold; font-size:12px;">Env ${e.id}</span>`;
            
            const btnDel = document.createElement("button"); btnDel.innerText = "X"; Object.assign(btnDel.style, { background: "#622", color: "#fff", border: "1px solid #555", borderRadius: "2px", cursor: "pointer", fontSize: "9px" }); btnDel.onclick = () => this.removeEnvironment(e.id);
            head.appendChild(btnDel);
            
            const meshInfo = document.createElement("div");
            meshInfo.style.fontSize = "9px";
            meshInfo.style.color = "#888";
            meshInfo.style.marginBottom = "4px";
            meshInfo.id = `env-mesh-info-${e.id}`;
            meshInfo.innerText = `[Meshes: ${e.meshes.length}]`;
            
            // NEW: Upload Env Layout
            const envRow = document.createElement("div");
            envRow.style.display = "flex"; envRow.style.alignItems = "center"; envRow.style.marginBottom = "4px";
            
            const selEnv = document.createElement("select");
            Object.assign(selEnv.style, { flex: "1", width: "0", background: "#111", color: "#fff", border: "1px solid #444", borderRadius: "3px", fontSize: "10px", padding: "2px" });
            this.availableEnvs.forEach(env => selEnv.add(new Option(env, env)));
            selEnv.value = e.envFile;
            selEnv.onchange = (evt) => this.loadEnvironmentFile(e, evt.target.value);
            
            const uploadEnvBtn = this.createUploadButton("Upload Custom Env", ".glb,.fbx,.ply,.splat,.ksplat", "yedp_envs", async (filename) => {
                if (!this.availableEnvs.includes(filename)) this.availableEnvs.push(filename);
                selEnv.add(new Option(filename, filename));
                selEnv.value = filename;
                await this.loadEnvironmentFile(e, filename);
            });
            
            envRow.append(selEnv, uploadEnvBtn);
            card.append(head, meshInfo, envRow);

            if (e.envFile && e.envFile.toLowerCase().endsWith(".ply")) {
                const splatRow = document.createElement("div");
                splatRow.style.display = "flex"; splatRow.style.alignItems = "center"; splatRow.style.gap = "4px"; splatRow.style.marginBottom = "4px";
                
                const lblSplat = document.createElement("label");
                Object.assign(lblSplat.style, { cursor: "pointer", display: "flex", gap: "4px", fontSize: "10px", color: "#00d2ff" });
                
                const chkSplat = document.createElement("input");
                chkSplat.type = "checkbox";
                chkSplat.checked = e.forceSplat === true;
                chkSplat.onchange = (evt) => {
                    e.forceSplat = evt.target.checked;
                    this.loadEnvironmentFile(e, e.envFile);
                };
                
                lblSplat.append(chkSplat, "Render as Gaussian Splat");
                splatRow.appendChild(lblSplat);
                card.appendChild(splatRow);
            }

            const foot = document.createElement("div"); foot.style.display = "flex"; foot.style.justifyContent = "space-between"; foot.style.alignItems = "center";
            const lblLoop = document.createElement("label"); lblLoop.style.cursor = "pointer"; lblLoop.style.display = "flex"; lblLoop.style.gap = "2px";
            const chkLoop = document.createElement("input"); chkLoop.type = "checkbox"; chkLoop.checked = e.loop;
            chkLoop.onchange = (evt) => { 
                e.loop = evt.target.checked; 
                this.forceUpdateFrame();
            };
            lblLoop.append(chkLoop, "Loop (Anim)");
            
            const lblDur = document.createElement("span");
            const fps = this.getWidgetValue("fps", 24);
            lblDur.innerText = e.duration > 0 ? `${Math.floor(e.duration * fps)}f` : "Static";
            lblDur.id = `env-dur-${e.id}`; lblDur.style.color = "#888"; lblDur.style.fontFamily = "monospace";
            
            foot.append(lblLoop, lblDur);
            card.append(foot);
            this.uiEnvList.appendChild(card);
        });
        this.refreshSidebarHighlights();
    }

    createUploadButton(tooltip, accept, subfolder, onUploaded) {
        const wrap = document.createElement("div");
        wrap.style.display = "flex";
        
        const btn = document.createElement("button");
        btn.innerText = "📁";
        btn.title = tooltip;
        Object.assign(btn.style, { 
            background: "#222", color: "#fff", border: "1px solid #444", 
            borderRadius: "3px", cursor: "pointer", fontSize: "10px", 
            padding: "2px 4px", marginLeft: "4px", flex: "none" 
        });
        
        const fileIn = document.createElement("input");
        fileIn.type = "file"; 
        fileIn.accept = accept; 
        fileIn.style.display = "none";
        
        btn.onclick = (e) => { e.stopPropagation(); fileIn.click(); };
        fileIn.onchange = async (e) => {
            const f = e.target.files[0];
            if (!f) return;
            const origText = btn.innerText;
            btn.innerText = "⏳";
            btn.style.background = "#552"; // Visual feedback during upload
            
            const filename = await this.uploadCustomAsset(f, subfolder);
            
            btn.innerText = origText;
            btn.style.background = "#222";
            if (filename) onUploaded(filename);
            fileIn.value = ""; // Reset input so the same file can be uploaded again if needed
        };
        
        wrap.append(btn, fileIn);
        return wrap;
    }

    async uploadCustomAsset(file, subfolder) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("subfolder", subfolder);
        
        try {
            const res = await api.fetchApi("/yedp/upload_asset", {
                method: "POST",
                body: formData
            });
            const data = await res.json();
            return data.filename; 
        } catch (e) {
            console.error("[Yedp] Custom Upload failed:", e);
            alert("Upload failed! Ensure your Python backend has the /yedp/upload_asset route configured.");
            return null;
        }
    }

    // --- LOGIC: CHARACTERS ---
    renderCharacterCards() {
        this.uiCharList.innerHTML = "";
        
        const stopEvent = e => e.stopPropagation();
        
        this.characters.forEach(c => {
            const card = document.createElement("div"); card.dataset.id = c.id;
            Object.assign(card.style, { background: "#222", border: "1px solid #444", borderRadius: "4px", padding: "6px", cursor: "pointer", transition: "border-color 0.2s" });
            
            card.onclick = (evt) => {
                if (['button', 'input', 'select', 'option'].includes(evt.target.tagName.toLowerCase())) return;
                this.selectObject(c, 'character', c.id);
            };

            const head = document.createElement("div"); head.style.display = "flex"; head.style.justifyContent = "space-between"; head.style.marginBottom = "2px";
            head.innerHTML = `<span style="font-weight:bold; font-size:12px;">Char ${c.id}</span>`;
            
            const btnDel = document.createElement("button"); btnDel.innerText = "X"; Object.assign(btnDel.style, { background: "#622", color: "#fff", border: "1px solid #555", borderRadius: "2px", cursor: "pointer", fontSize: "9px" }); btnDel.onclick = () => this.removeCharacter(c.id);
            head.appendChild(btnDel);
            
            const meshInfo = document.createElement("div");
            meshInfo.id = `char-mesh-info-${c.id}`;
            meshInfo.style.fontSize = "9px";
            meshInfo.style.color = "#888";
            meshInfo.style.marginBottom = "4px";
            meshInfo.innerText = `[M:${c.depthMeshesM.length} | F:${c.depthMeshesF.length} | Pose:${c.poseMeshes.length}]`;
            
            // RIG SWAP UI
            const selRigRow = document.createElement("div");
            selRigRow.style.display = "flex"; selRigRow.style.alignItems = "center"; selRigRow.style.marginBottom = "4px";
            const rigLbl = document.createElement("span");
            rigLbl.innerText = "Model:"; rigLbl.style.fontSize = "9px"; rigLbl.style.color = "#888"; rigLbl.style.width = "35px";
            const selRig = document.createElement("select");
            Object.assign(selRig.style, { flex: "1", width: "0", background: "#111", color: "#fff", border: "1px solid #444", borderRadius: "3px", fontSize: "10px", padding: "2px" });
            this.availableRigs.forEach(r => selRig.add(new Option(r, r)));
            selRig.value = c.rigFile;
            selRig.onchange = (e) => { e.stopPropagation(); this.swapCharacterRig(c.id, e.target.value); };
            
            // NEW: Upload Rig Button
            const uploadRigBtn = this.createUploadButton("Upload Custom Rig", ".glb,.fbx", "yedp_rigs", async (filename) => {
                if (!this.availableRigs.includes(filename)) this.availableRigs.push(filename);
                selRig.add(new Option(filename, filename));
                selRig.value = filename;
                await this.swapCharacterRig(c.id, filename);
            });

            selRigRow.append(rigLbl, selRig, uploadRigBtn);

            // MULTI-CLIP SEQUENCER UI
            const seqWrap = document.createElement("div");
            Object.assign(seqWrap.style, { display: "flex", flexDirection: "column", gap: "4px", marginBottom: "4px", background: "#1a1a1a", padding: "4px", borderRadius: "3px", border: "1px solid #333" });

            const seqTitle = document.createElement("div");
            seqTitle.innerText = "Animation Sequence:";
            seqTitle.style.fontSize = "9px"; seqTitle.style.color = "#888"; seqTitle.style.fontWeight = "bold";
            seqWrap.appendChild(seqTitle);

            c.animSequence.forEach((item, index) => {
                const row = document.createElement("div");
                row.style.display = "flex"; row.style.alignItems = "center";
                
                const idxLbl = document.createElement("span");
                idxLbl.innerText = `${index + 1}.`;
                idxLbl.style.fontSize = "9px"; idxLbl.style.color = "#666"; idxLbl.style.width = "12px";
                
                const selAnim = document.createElement("select");
                Object.assign(selAnim.style, { flex: "1", width: "0", background: "#111", color: "#fff", border: "1px solid #444", borderRadius: "3px", fontSize: "10px", padding: "2px" });
                this.availableAnimations.forEach(anim => selAnim.add(new Option(anim, anim)));
                selAnim.value = item.file;
                selAnim.onchange = (e) => this.loadSequenceAnim(c, item, e.target.value);
                
                // NEW: Upload Anim Button
                const uploadAnimBtn = this.createUploadButton("Upload Custom Anim", ".glb,.fbx,.bvh", "yedp_anims", async (filename) => {
                    if (!this.availableAnimations.includes(filename)) this.availableAnimations.push(filename);
                    selAnim.add(new Option(filename, filename));
                    selAnim.value = filename;
                    await this.loadSequenceAnim(c, item, filename);
                });

                const btnDelSeq = document.createElement("button");
                btnDelSeq.innerText = "X";
                Object.assign(btnDelSeq.style, { background: "#622", color: "#fff", border: "1px solid #555", borderRadius: "2px", cursor: "pointer", fontSize: "9px", padding: "2px 4px", marginLeft: "4px" });
                btnDelSeq.onclick = (evt) => {
                    evt.stopPropagation();
                    c.animSequence = c.animSequence.filter(a => a.id !== item.id);
                    if (item.action) { item.action.stop(); }
                    this.updateSequenceSchedule(c);
                    this.renderCharacterCards();
                    this.forceUpdateFrame();
                };
                
                row.append(idxLbl, selAnim, uploadAnimBtn, btnDelSeq);
                seqWrap.appendChild(row);
            });

            const btnAddSeq = document.createElement("button");
            btnAddSeq.innerText = "+ Add Sequence Anim";
            Object.assign(btnAddSeq.style, { background: "#255", color: "#fff", border: "1px solid #477", borderRadius: "3px", cursor: "pointer", fontSize: "9px", padding: "2px", marginTop: "2px" });
            btnAddSeq.onclick = (evt) => {
                evt.stopPropagation();
                c.addSequenceItem("none");
                this.renderCharacterCards();
            };
            seqWrap.appendChild(btnAddSeq);

            const blendRow = document.createElement("div");
            blendRow.style.display = "flex"; blendRow.style.alignItems = "center"; blendRow.style.gap = "4px"; blendRow.style.marginTop = "4px";
            
            const bLbl = document.createElement("span"); bLbl.innerText = "Blend (s)"; bLbl.style.fontSize="9px"; bLbl.style.color="#888"; bLbl.style.width="40px";
            const bSld = document.createElement("input"); bSld.type = "range"; bSld.min = "0.0"; bSld.max = "2.0"; bSld.step = "0.1"; bSld.value = c.blendDuration; Object.assign(bSld.style, { flex: "1", width: "0" });
            const bInp = document.createElement("input"); bInp.type = "number"; bInp.step = "0.1"; bInp.value = c.blendDuration; Object.assign(bInp.style, {width:"36px", background:"#111", color:"#00d2ff", border:"1px solid #444", fontSize:"9px", padding:"2px", textAlign:"right"});
            
            const syncBlend = (v) => {
                c.blendDuration = v; bSld.value = v; bInp.value = v;
                this.updateSequenceSchedule(c);
                const lblDur = this.container.querySelector(`#dur-${c.id}`);
                if (lblDur) {
                    const fps = this.getWidgetValue("fps", 24);
                    lblDur.innerText = c.duration > 0 ? `${Math.floor(c.duration * fps)}f` : "--";
                }
                this.forceUpdateFrame();
            };
            bSld.oninput = (e) => syncBlend(parseFloat(e.target.value));
            bInp.onchange = (e) => syncBlend(parseFloat(e.target.value)||0);
            bInp.addEventListener('keydown', stopEvent); bInp.addEventListener('mousedown', stopEvent);
            
            blendRow.append(bLbl, bSld, bInp);
            seqWrap.appendChild(blendRow);
            
            const faceScaleRow = document.createElement("div");
            faceScaleRow.style.display = "flex"; faceScaleRow.style.alignItems = "center"; faceScaleRow.style.gap = "4px"; faceScaleRow.style.marginBottom = "4px";
            
            const fsLbl = document.createElement("span"); fsLbl.innerText = "Pt Size"; fsLbl.style.fontSize="9px"; fsLbl.style.color="#888"; fsLbl.style.width="35px";
            const fsSld = document.createElement("input"); fsSld.type = "range"; fsSld.min = "0.1"; fsSld.max = "3.0"; fsSld.step = "0.1"; fsSld.value = c.faceScale; Object.assign(fsSld.style, { flex: "1", width: "0" });
            const fsInp = document.createElement("input"); fsInp.type = "number"; fsInp.step = "0.1"; fsInp.value = c.faceScale; Object.assign(fsInp.style, {width:"36px", background:"#111", color:"#00d2ff", border:"1px solid #444", fontSize:"9px", padding:"2px", textAlign:"right"});
            
            const syncFs = (v) => {
                c.faceScale = v; fsSld.value = v; fsInp.value = v;
                c.opFaceBones.forEach(b => { if(b) b.scale.setScalar(v); });
                this.forceUpdateFrame();
            };
            fsSld.oninput = (e) => syncFs(parseFloat(e.target.value));
            fsInp.onchange = (e) => syncFs(parseFloat(e.target.value)||1.0);
            fsInp.addEventListener('keydown', stopEvent); fsInp.addEventListener('mousedown', stopEvent);
            
            faceScaleRow.append(fsLbl, fsSld, fsInp);

            const foot = document.createElement("div"); foot.style.display = "flex"; foot.style.justifyContent = "space-between"; foot.style.alignItems = "center";
            const loopBox = document.createElement("div"); loopBox.style.display = "flex"; loopBox.style.alignItems = "center"; loopBox.style.gap = "6px"; loopBox.style.flexWrap = "wrap";
            
            const btnGender = document.createElement("button"); btnGender.innerText = c.gender;
            Object.assign(btnGender.style, { background: "#111", border: "1px solid #444", borderRadius: "3px", cursor: "pointer", fontSize: "10px", padding: "1px 6px", fontWeight: "bold", color: c.gender === 'F' ? '#ff66b2' : '#66b2ff' });
            btnGender.onclick = () => { c.gender = c.gender === 'M' ? 'F' : 'M'; btnGender.innerText = c.gender; btnGender.style.color = c.gender === 'F' ? '#ff66b2' : '#66b2ff'; this.updateVisibilities(); this.forceUpdateFrame(); };

            const lblFace = document.createElement("label"); lblFace.style.cursor = "pointer"; lblFace.style.display = "flex"; lblFace.style.gap = "2px"; lblFace.style.fontSize = "10px"; lblFace.style.whiteSpace = "nowrap";
            const chkFace = document.createElement("input"); chkFace.type = "checkbox"; chkFace.checked = c.showFace;
            chkFace.onchange = (e) => { c.showFace = e.target.checked; this.updateVisibilities(); this.forceUpdateFrame(); };
            lblFace.append(chkFace, "Face");

            const lblLoop = document.createElement("label"); lblLoop.style.cursor = "pointer"; lblLoop.style.display = "flex"; lblLoop.style.gap = "2px"; lblLoop.style.fontSize = "10px"; lblLoop.style.whiteSpace = "nowrap";
            const chkLoop = document.createElement("input"); chkLoop.type = "checkbox"; chkLoop.checked = c.loop;
            chkLoop.onchange = (e) => { 
                c.loop = e.target.checked; 
                this.updateSequenceSchedule(c); 
                const lblDur = this.container.querySelector(`#dur-${c.id}`);
                if (lblDur) {
                    const fps = this.getWidgetValue("fps", 24);
                    lblDur.innerText = c.duration > 0 ? `${Math.floor(c.duration * fps)}f` : "--";
                }
                this.forceUpdateFrame(); 
            };
            lblLoop.append(chkLoop, "Loop"); 
            
            const lblRoot = document.createElement("label"); lblRoot.style.cursor = "pointer"; lblRoot.style.display = "flex"; lblRoot.style.gap = "2px"; lblRoot.style.fontSize = "10px"; lblRoot.style.whiteSpace = "nowrap";
            const chkRoot = document.createElement("input"); chkRoot.type = "checkbox"; chkRoot.checked = c.useRootMotion;
            chkRoot.onchange = (e) => { 
                c.useRootMotion = e.target.checked; 
                if (c.useRootMotion) c.continuousPos.set(0, 0, 0); 
                c.lastDomTau = -1; 
                this.forceUpdateFrame(); 
            };
            lblRoot.append(chkRoot, "Root M.");

            loopBox.append(btnGender, lblFace, lblLoop, lblRoot);

            const lblDur = document.createElement("span");
            const fps = this.getWidgetValue("fps", 24);
            lblDur.innerText = c.duration > 0 ? `${Math.floor(c.duration * fps)}f` : "--";
            lblDur.id = `dur-${c.id}`; lblDur.style.color = "#888"; lblDur.style.fontFamily = "monospace";
            
            foot.append(loopBox, lblDur); 
            card.append(head, meshInfo, selRigRow, seqWrap, faceScaleRow, foot); 
            this.uiCharList.appendChild(card);
        });
        this.refreshSidebarHighlights();
        this.renderMocapBindings(); 
    }

    async addCharacter(rigFilename = "Yedp_Rig.glb") {
        if (this.characters.length >= 16) { alert("Maximum 16 characters recommended for WebGL performance."); return; }
        
        let rig;
        try {
            rig = await this.loadRig(rigFilename);
        } catch (e) {
            console.error("Failed to load rig:", rigFilename);
            return;
        }

        this.charCounter++;
        const newChar = new CharacterInstance(this.charCounter, rig, this.THREE);
        newChar.rigFile = rigFilename; // keep track of selected rig to save state
        newChar.addSequenceItem("none"); // Default first empty slot
        
        newChar.scene.traverse((child) => {
            if (child.isPoints || child.type === 'Points') {
                child.customDepthMaterial = this.matsStatic.depthPointsShadow;
                child.customDistanceMaterial = this.matsStatic.distancePointsShadow;
            }
        });

        this.scene.add(newChar.scene); 
        this.scene.add(newChar.skeletonHelper);
        this.characters.push(newChar);

        newChar.depthMeshesM.forEach(m => { if(m.isMesh && !this.originalMaterials.has(m)) this.originalMaterials.set(m, m.material); });
        newChar.depthMeshesF.forEach(m => { if(m.isMesh && !this.originalMaterials.has(m)) this.originalMaterials.set(m, m.material); });

        this.updateVisibilities(); 
        this.renderCharacterCards();
    }

    async swapCharacterRig(charId, newRigFilename) {
        const c = this.characters.find(c => c.id === charId);
        if (!c) return;

        const infoLbl = this.container.querySelector(`#char-mesh-info-${c.id}`);
        if(infoLbl) infoLbl.innerText = "[Loading Rig...]";

        try {
            const newBaseRig = await this.loadRig(newRigFilename);
            const newScene = window._YEDP_SKEL_UTILS.clone(newBaseRig);

            // Copy transform state
            newScene.position.copy(c.scene.position);
            newScene.rotation.copy(c.scene.rotation);
            newScene.scale.copy(c.scene.scale);

            // Clean up old scene
            this.scene.remove(c.scene);
            this.scene.remove(c.skeletonHelper);
            c.mixer.stopAllAction();

            // Swap scene reference and reinitialize core arrays
            c.scene = newScene;
            c.mixer = new this.THREE.AnimationMixer(c.scene);
            c.rootBone = null;
            c.poseMeshes = [];
            c.poseFaceMeshes = [];
            c.depthMeshesM = [];
            c.depthMeshesF = [];
            c.hasFemaleMesh = false;
            c.opFaceBones = new Array(70).fill(null);
            c.opFaceBonesRest = new Array(70).fill(null);
            c.rigFile = newRigFilename;

            c.skeletonHelper = new this.THREE.SkeletonHelper(c.scene);
            c.skeletonHelper.visible = this.container.querySelector("#chk-skel")?.checked || false;

            c.scene.traverse((child) => {
                if (child.isBone && !c.rootBone && child.parent && child.parent.type !== 'Bone') {
                    c.rootBone = child;
                }
                if (child.isBone && child.name.includes("OP_Face_")) {
                    const match = child.name.match(/OP_Face_(\d+)/);
                    if (match) {
                        const idx = parseInt(match[1]);
                        if (idx >= 0 && idx < 70) {
                            c.opFaceBones[idx] = child;
                            c.opFaceBonesRest[idx] = child.position.clone();
                            child.scale.setScalar(c.faceScale); 
                        }
                    }
                }
                if(child.isMesh || child.isSkinnedMesh || child.isPoints || child.type === 'Points') {
                    child.visible = true;
                    child.frustumCulled = false;
                    child.castShadow = true;
                    child.receiveShadow = true;
                    if (child.isPoints || child.type === 'Points') {
                        child.customDepthMaterial = this.matsStatic.depthPointsShadow;
                        child.customDistanceMaterial = this.matsStatic.distancePointsShadow;
                    }

                    let fullPath = "";
                    let curr = child;
                    while (curr && curr !== c.scene && curr !== null) {
                        if (curr.name) fullPath += curr.name.toLowerCase() + "|";
                        curr = curr.parent;
                    }

                    const n = fullPath.replace(/[\s_]/g, '');
                    if (n.includes("openpose") || n.includes("pose")) {
                        c.poseMeshes.push(child);
                        if (n.includes("face")) c.poseFaceMeshes.push(child);
                        if (child.material) {
                            const processMat = (mat) => {
                                const oldColor = mat.color || new this.THREE.Color(0xffffff);
                                const newMat = new this.THREE.MeshBasicMaterial({ color: oldColor });
                                if (mat.map) { newMat.map = mat.map; newMat.color.setHex(0xffffff); }
                                return newMat;
                            };
                            if (Array.isArray(child.material)) child.material = child.material.map(processMat);
                            else child.material = processMat(child.material);
                        }
                    } else if (n.includes("depthf") || n.includes("female") || n.includes("woman") || n.includes("|f|") || n.endsWith("f|")) {
                        c.hasFemaleMesh = true;
                        c.depthMeshesF.push(child);
                        child.visible = false;
                    } else if (n.includes("depth") || n.includes("male") || n.includes("man")) {
                        c.depthMeshesM.push(child);
                        child.visible = false;
                    } else {
                        c.depthMeshesM.push(child);
                        c.depthMeshesF.push(child);
                        child.visible = false;
                    }
                }
            });

            // Cache new materials
            c.depthMeshesM.forEach(m => { if(m.isMesh && !this.originalMaterials.has(m)) this.originalMaterials.set(m, m.material); });
            c.depthMeshesF.forEach(m => { if(m.isMesh && !this.originalMaterials.has(m)) this.originalMaterials.set(m, m.material); });

            this.scene.add(c.scene);
            this.scene.add(c.skeletonHelper);

            // Rebind sequential animations to the new mixer
            for (const item of c.animSequence) {
                if (item.file !== "none") {
                    await this.loadSequenceAnim(c, item, item.file);
                }
            }

            if (this.selected.type === 'character' && this.selected.id === c.id) {
                this.transformControls.attach(c.scene);
            }

            this.updateVisibilities();
            this.renderCharacterCards();
            this.forceUpdateFrame();

        } catch (e) {
            console.error("Rig swap failed:", e);
            if(infoLbl) infoLbl.innerHTML = `<span style="color:red;">Load Error</span>`;
        }
    }

    removeCharacter(id) {
        const idx = this.characters.findIndex(c => c.id === id);
        if (idx === -1) return;
        const c = this.characters[idx];
        if (this.selected.type === 'character' && this.selected.id === id) this.selectObject(null, null, null);
        c.destroy(this.scene); this.characters.splice(idx, 1);
        this.renderCharacterCards();
    }

    async loadSequenceAnim(charObj, item, filename) {
        const lbl = this.container.querySelector(`#dur-${charObj.id}`);
        if (lbl) lbl.innerText = "Loading...";

        if (item.action) {
            item.action.stop();
            item.action = null;
        }

        if(!filename || filename === "none") {
            item.file = "none";
            item.duration = 0;
            this.updateSequenceSchedule(charObj);
            
            if (lbl) {
                const fps = this.getWidgetValue("fps", 24);
                lbl.innerText = charObj.duration > 0 ? `${Math.floor(charObj.duration * fps)}f` : "--";
            }
            this.forceUpdateFrame();
            return;
        }
        
        item.file = filename;
        const isFBX = filename.toLowerCase().endsWith(".fbx");
        const isBVH = filename.toLowerCase().endsWith(".bvh");
        const url = `/view?filename=${encodeURIComponent(filename)}&type=input&subfolder=yedp_anims&t=${Date.now()}`;
        
        try {
            let model;
            if(isFBX) model = await new this.FBXLoader().loadAsync(url);
            else if (isBVH) model = await new this.BVHLoader().loadAsync(url);
            else model = await new this.GLTFLoaderClass().loadAsync(url);

            let clip = isBVH ? model.clip : (model.animations?.[0] || model.scene?.animations?.[0] || model.asset?.animations?.[0]);

            if(clip) {
                const tracks = [];
                clip.tracks.forEach(t => {
                    const lastDot = t.name.lastIndexOf(".");
                    const prop = t.name.substring(lastDot + 1);
                    const fullBonePath = t.name.substring(0, lastDot);
                    
                    //if (fullBonePath.includes("OP_Face_") || fullBonePath.toLowerCase().includes("op_face")) return;
                    
                    const normalizedTrackBone = semanticNormalize(fullBonePath);
                    if (prop === "scale") return; 
                    if(this.semanticMap.has(normalizedTrackBone)) {
                        const tc = t.clone(); 
                        tc.name = `${this.semanticMap.get(normalizedTrackBone)}.${prop}`;
                        tracks.push(tc);
                    }
                });

                const cleanClip = new this.THREE.AnimationClip(clip.name, clip.duration, tracks);
                
                item.action = charObj.mixer.clipAction(cleanClip);
                item.action.setLoop(this.THREE.LoopRepeat);
                item.action.reset().play();
                item.action.setEffectiveWeight(0); 
                item.duration = cleanClip.duration;
                
                if (charObj.rootBone) {
                    const rootTrack = cleanClip.tracks.find(t => t.name === `${charObj.rootBone.name}.position`);
                    if (rootTrack) {
                        item.rootInterpolant = rootTrack.createInterpolant(new Float32Array(3));
                    } else {
                        item.rootInterpolant = null;
                    }
                }
                
                this.updateSequenceSchedule(charObj);
                
                if (lbl) {
                    const fps = this.getWidgetValue("fps", 24);
                    lbl.innerText = `${Math.floor(charObj.duration * fps)}f`;
                }
                
                this.isPlaying = true; 
                const btn = this.container.querySelector("#btn-play"); 
                if(btn) btn.innerText = "⏸";
                
                this.forceUpdateFrame();
            }
        } catch(e) { 
            console.error("Anim Load Error:", e); 
            if (lbl) lbl.innerHTML = `<span style="color:red;">Error</span>`;
        }
    }

    applyCameraKeyframes(timeRatio) {
        if (this.cameraAnimNode && this.cameraAction) {
            this.cameraAnimGroup.updateMatrixWorld(true);
            
            const worldPos = this._tmpVec3A;
            const worldQuat = this._tmpQuatA;
            this.cameraAnimNode.getWorldPosition(worldPos);
            this.cameraAnimNode.getWorldQuaternion(worldQuat);

            this._tmpEulerA.set(
                this.THREE.MathUtils.degToRad(this.camOverrideOffset.rx),
                this.THREE.MathUtils.degToRad(this.camOverrideOffset.ry),
                this.THREE.MathUtils.degToRad(this.camOverrideOffset.rz),
                'XYZ'
            );
            // _tmpQuatB used for offset since worldQuat occupies _tmpQuatA
            if (!this._tmpQuatB) this._tmpQuatB = new this.THREE.Quaternion();
            this._tmpQuatB.setFromEuler(this._tmpEulerA);
            worldQuat.multiply(this._tmpQuatB);

            this.importedCamProxy.visible = !this.isCameraOverride && !this.isBaking;
            if (!this.isCameraOverride) {
                this.importedCamProxy.position.copy(worldPos);
                this.importedCamProxy.quaternion.copy(worldQuat);
            }

            if (this.isCameraOverride) {
                this.camera.position.copy(worldPos);
                this.camera.quaternion.copy(worldQuat);
                
                const forward = new this.THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
                this.controls.target.copy(this.camera.position).add(forward.multiplyScalar(5.0));
                
                if (this.selected.type === 'camera') this.updateTransformUIFromObject();
                return;
            }
        }

        if (!this.camKeys.start || !this.camKeys.end) return;
        let t = timeRatio;
        if (this.camKeys.ease === 'easeIn') t = t * t;
        else if (this.camKeys.ease === 'easeOut') t = t * (2 - t);
        else if (this.camKeys.ease === 'easeInOut') t = t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

        this.camera.position.lerpVectors(this.camKeys.start.pos, this.camKeys.end.pos, t);
        this.camera.quaternion.slerpQuaternions(this.camKeys.start.quat, this.camKeys.end.quat, t);
        
        if (this.camKeys.start.zoom !== undefined && this.camKeys.end.zoom !== undefined) {
            this.camera.zoom = this.camKeys.start.zoom + (this.camKeys.end.zoom - this.camKeys.start.zoom) * t;
            this.camera.updateProjectionMatrix();
        }
        if (this.controls && this.camKeys.start.target && this.camKeys.end.target) {
            this.controls.target.lerpVectors(this.camKeys.start.target, this.camKeys.end.target, t);
        }
        
        if (this.selected.type === 'camera') this.updateTransformUIFromObject();
    }

    animate() {
        if (!this.renderer) return;
        requestAnimationFrame(() => this.animate());
        if (this.isBaking) return;

        const delta = this.clock.getDelta();
        const totalFrames = this.getWidgetValue("frame_count", 48);
        const fps = this.getWidgetValue("fps", 24);

        // 1. Track exactly where the camera is right now
        const oldCamPos = this.camera.position.clone();
        const oldCamRot = this.camera.rotation.clone();

        if (this.isPlaying) {
            this.globalTime += delta;
            const totalDuration = totalFrames / fps;
            if (this.globalTime >= totalDuration) this.globalTime = this.globalTime % totalDuration; 
            
            const currentFrame = Math.floor(this.globalTime * fps);
            
            const slider = this._sliderEl;
            if (slider && !this.isDraggingSlider) slider.value = currentFrame;
            
            const timeLabel = this._timeLabelEl;
            if (timeLabel) timeLabel.innerText = `${currentFrame} / ${totalFrames}`;

            this.evaluateAnimations(this.globalTime);
            this.applyCameraKeyframes(currentFrame / Math.max(1, totalFrames - 1));

            // Force BVH rebuild while animation plays
            this.needsPtReset = true;
            this.needsPtBvhUpdate = true;
        }
        
        if (this.controls) this.controls.update();

        // 2. Native Camera Movement Detection (Handles Damping perfectly!)
        const posDist = this.camera.position.distanceToSquared(oldCamPos);
        const rotDist = Math.abs(this.camera.rotation.x - oldCamRot.x) + 
                Math.abs(this.camera.rotation.y - oldCamRot.y) + 
                Math.abs(this.camera.rotation.z - oldCamRot.z);
                
        // Threshold cuts off the invisible damping tail so pathtracing starts instantly
        const isCameraMoving = posDist > 0.00001 || rotDist > 0.00001;

        if (isCameraMoving || this.isDraggingSlider) {
            this.needsPtReset = true;
        }

        // --- THE RENDER DISPATCHER ---
        const isPTActive = this.isPathTracingEnabled && this.isShadedMode && this.ptRenderer;

        if (isPTActive && !isCameraMoving && !this.isPlaying && !this.isDraggingSlider) {
            
            // A. PATH TRACING MODE
            if (this.needsPtReset) {
                if (this.needsPtBvhUpdate) {
                    // NINJA SWAP: Hide UI Gizmos BEFORE giving scene to path tracer
                    if (this.gridHelper) this.gridHelper.visible = false;
                    if (this.axesHelper) this.axesHelper.visible = false;
                    if (this.transformControls) this.transformControls.visible = false;
                    this.lights.forEach(l => { if (l.helper) l.helper.visible = false; });
                    
                    // NINJA SWAP: Temporarily change the transparent WebGL floor to a physical matte material
                    const origFloorMat = this.floor.material;
                    if (!this.ptFloorMat) this.ptFloorMat = new this.THREE.MeshStandardMaterial({ color: 0x222222, roughness: 1.0, metalness: 0.0 });
                    this.floor.material = this.ptFloorMat;

                    // Build the BVH from the clean scene!
                    this.ptRenderer.setScene(this.scene, this.camera);
                    
                    // Put the original WebGL floor back
                    this.floor.material = origFloorMat;
                    
                    this.needsPtBvhUpdate = false;
                } else {
                    this.ptRenderer.updateCamera(); 
                }
                this.needsPtReset = false;
            }

            if (this.ptRenderer.samples < this.ptPreviewSamples) {
                this.ptRenderer.renderSample();
            }

            const counter = this.container.querySelector("#pt-sample-counter");
            if (counter) counter.innerText = `${this.ptRenderer.samples.toFixed(1)} / ${this.ptPreviewSamples}`;
            
        } else {
            
            // B. FAST WEBGL FALLBACK MODE
            if (isPTActive) {
                // Instantly unhide UI Gizmos for the WebGL view
                if (this.gridHelper) this.gridHelper.visible = true;
                if (this.axesHelper) this.axesHelper.visible = true;
                if (this.transformControls && this.selected.obj) this.transformControls.visible = true;
                this.lights.forEach(l => { if (l.helper && l.type !== 'ambient') l.helper.visible = true; });
                
                const counter = this.container.querySelector("#pt-sample-counter");
                if (counter) counter.innerText = `0 / ${this.ptPreviewSamples}`;
                
                // Force a reset when motion stops so we don't carry over old noise
                this.needsPtReset = true; 
            }
            
            this.renderer.render(this.scene, this.camera);
        }
    }

    updateVisibilities() {
        const isDepth = this.isDepthMode;
        const isShaded = this.isShadedMode;
        const isTextured = this.isTexturedMode;

        const isPTActive = this.isPathTracingEnabled && this.isShadedMode;
        if (this.gridHelper) this.gridHelper.visible = !isPTActive;
        if (this.axesHelper) this.axesHelper.visible = !isPTActive;
        if (this.floor) {
            this.floor.material = isPTActive ? this.matsStatic.shaded : this.floorMat;
        }

        const getMat = (m) => {
            if (isDepth) return m.isPoints ? this.matsStatic.depthPoints : (m.isSkinnedMesh ? this.matsSkinned.depth : this.matsStatic.depth);
            if (isShaded) return m.isPoints ? (this.originalMaterials.get(m) || m.material) : (m.isSkinnedMesh ? this.matsSkinned.shaded : this.matsStatic.shaded);
            return this.originalMaterials.get(m) || m.material;
        };

        this.characters.forEach(c => {
            c.inactiveDepthMeshes.forEach(m => m.visible = false);
            const showDepthMeshes = isDepth || isShaded || isTextured;
            
            c.activeDepthMeshes.forEach(m => {
                m.visible = showDepthMeshes;
                m.material = getMat(m);
            });
            c.poseMeshes.forEach(m => {
                const isFace = c.poseFaceMeshes.includes(m);
                m.visible = !showDepthMeshes && (!isFace || c.showFace);
            });
        });

        this.environments.forEach(e => {
            e.meshes.forEach(m => {
                m.visible = true; 
                m.material = getMat(m);
            });
            // NEW LOGIC: Hide Splats if in Depth or Shaded mode, as they don't support those materials natively
            if (e.splatViewer) {
                e.splatViewer.visible = (isTextured);
            }
        });

        if (isDepth) this.updateCameraBounds();
        else this.resetCamera();

        // --- NEW HDRI PROTECTION LOGIC ---
        if (isShaded || isTextured) {
            const activeHdriMap = this.hdriRenderTarget ? this.hdriRenderTarget.texture : this.currentHdriMap;
            this.scene.environment = this.isHdriEnabled ? activeHdriMap : null;
            this.scene.background = (this.isHdriEnabled && this.isHdriBgEnabled) ? activeHdriMap : new this.THREE.Color(0x000000);
        } else {
            this.scene.environment = null;
            this.scene.background = new this.THREE.Color(0x000000); 
        }

        // --- NEW: Inject Scene to Path Tracer ---
        if (this.isPathTracingEnabled && this.isShadedMode && this.ptRenderer) {
            
            // 1. Hide ALL helpers so the path tracer doesn't render their shadows
            if (this.gridHelper) this.gridHelper.visible = false;
            if (this.axesHelper) this.axesHelper.visible = false;
            if (this.transformControls) this.transformControls.visible = false;
            this.lights.forEach(l => { if (l.helper) l.helper.visible = false; });
            
            // 2. Feed the clean scene to the path tracer
            this.ptRenderer.setScene(this.scene, this.camera);
            this.needsPtReset = true;
            this.needsPtBvhUpdate = false; 
            
            // 3. Turn the Transform gizmo back on for the UI overlay
            if (this.transformControls) this.transformControls.visible = true;
        }
        // ----------------------------------------
    }

    updateCameraBounds() {
        if(!this.camera) return;
        this.camera.near = Math.max(0.01, this.userNear); this.camera.far = Math.max(0.1, this.userFar);
        this.camera.updateProjectionMatrix();
    }
    resetCamera() {
        if(!this.camera) return;
        this.camera.near = this.defaultNear; this.camera.far = this.defaultFar;
        this.camera.updateProjectionMatrix();
    }

    hookNodeWidgets() {
        const updateDim = (w, val) => {
            if(w && w.name === "width") this.renderWidth = val; 
            else if(w && w.name === "height") this.renderHeight = val;
            const lbl = this.container.querySelector("#lbl-res");
            if(lbl) lbl.innerText = `${this.renderWidth}x${this.renderHeight}`;
            this.onResize(this.container.querySelector(".yedp-vp-area"));
        };
        const wWidget = this.node.widgets?.find(w => w.name === "width");
        const hWidget = this.node.widgets?.find(w => w.name === "height");
        if(wWidget) { this.renderWidth = wWidget.value; const orig = wWidget.callback; wWidget.callback = v => { updateDim(wWidget, v); if(orig) orig(v); }; }
        if(hWidget) { this.renderHeight = hWidget.value; const orig = hWidget.callback; hWidget.callback = v => { updateDim(hWidget, v); if(orig) orig(v); }; }
        updateDim();
        const slider = this.container.querySelector("#t-slider");
        const fWidget = this.node.widgets?.find(w => w.name === "frame_count");
        if(fWidget && slider) {
            slider.max = fWidget.value;
            const orig = fWidget.callback; fWidget.callback = v => { slider.max = v; if(orig) orig(v); };
        }
    }

    onResize(vpDiv) {
        if (this.isBaking || !this.renderer || !vpDiv || !this.camera) return;
        const w = vpDiv.clientWidth; const h = vpDiv.clientHeight;
        if (w && h) {
            this.renderer.setSize(w, h, false);
            
            const aspectContainer = w / h; 
            const aspectTarget = this.renderWidth / this.renderHeight;
            let gw, gh;
            
            // The gate has a 20px padding on the tightest dimension
            if (aspectContainer > aspectTarget) { 
                gh = h - 20; 
                gw = gh * aspectTarget; 
            } else { 
                gw = w - 20; 
                gh = gw / aspectTarget; 
            }
            
            if(this.gate) { 
                this.gate.style.width = `${gw}px`; 
                this.gate.style.height = `${gh}px`; 
            }

            // --- PERFECT FRAMING FIX ---
            // We tell the cameras to frame perfectly to the gate's FOV/Frustum, but offset onto the larger canvas
            if (this.perspCam) {
                this.perspCam.aspect = aspectTarget; 
                this.perspCam.setViewOffset(gw, gh, (gw - w) / 2, (gh - h) / 2, w, h);
                this.perspCam.updateProjectionMatrix();
            }
            if (this.orthoCam) {
                const frustumSize = 4.0;
                this.orthoCam.left = -frustumSize * aspectTarget / 2;
                this.orthoCam.right = frustumSize * aspectTarget / 2;
                this.orthoCam.top = frustumSize / 2;
                this.orthoCam.bottom = -frustumSize / 2;
                this.orthoCam.setViewOffset(gw, gh, (gw - w) / 2, (gh - h) / 2, w, h);
                this.orthoCam.updateProjectionMatrix();
            }
        }
    }

    getWidgetValue(name, defaultVal) {
        const w = this.node.widgets?.find(x => x.name === name); return w ? w.value : defaultVal;
    }

    async performBake(isSingleFrame = false) {
        if (this.characters.length === 0 && this.environments.length === 0) { alert("Scene is empty!"); return; }
        const THREE = this.THREE;
        
        const btnId = isSingleFrame ? '#btn-bake-frame' : '#btn-bake';
        const originalBtnText = isSingleFrame ? 'BAKE FRAME' : 'BAKE V9.3';
        const btn = this.container.querySelector(btnId); btn.innerText = "PREPARING...";
        
        this.isBaking = true; 
        this.isPlaying = false;
        
        this.transformControls.detach();
        this.lights.forEach(l => l.helper.visible = false);

        const originalSize = new THREE.Vector2(); this.renderer.getSize(originalSize);
        //const originalAspect = this.camera.aspect || (originalSize.width / originalSize.height);
        //const originalZoom = this.camera.zoom; 
        const originalBg = this.scene.background;
        
        // --- PERFECT FRAMING BAKE FIX ---
        // 1. Force exact resolution size
        //this.renderer.setSize(this.renderWidth, this.renderHeight);
        this.renderer.setSize(this.renderWidth, this.renderHeight, false);
        const targetRenderAspect = this.renderWidth / this.renderHeight;
        
        // 2. Clear view offset so it strictly renders the raw gate boundaries
        if (this.perspCam) {
            this.perspCam.aspect = targetRenderAspect;
            if (this.perspCam.clearViewOffset) this.perspCam.clearViewOffset();
            this.perspCam.updateProjectionMatrix();
        }

        if (this.orthoCam) {
            const frustumSize = 4.0;
            this.orthoCam.left = -frustumSize * targetRenderAspect / 2;
            this.orthoCam.right = frustumSize * targetRenderAspect / 2;
            this.orthoCam.top = frustumSize / 2;
            this.orthoCam.bottom = -frustumSize / 2;
            if (this.orthoCam.clearViewOffset) this.orthoCam.clearViewOffset();
            this.orthoCam.updateProjectionMatrix();
        }

        const totalNodeFrames = this.getWidgetValue("frame_count", 48);
        const fps = this.getWidgetValue("fps", 24);
        const step = 1.0 / fps;
        
        const framesToRender = isSingleFrame ? 1 : totalNodeFrames;
        const currentUIFrame = parseInt(this.container.querySelector("#t-slider").value) || 0;
        
        const results = { pose: [], depth: [], canny: [], normal: [], shaded: [], alpha: [], textured: [] };

        const visSkel = this.container.querySelector("#chk-skel").checked;
        const toggleHelpers = (vis) => { 
            if(this.gridHelper) this.gridHelper.visible = vis; 
            if(this.axesHelper) this.axesHelper.visible = vis; 
            if(this.floor) this.floor.visible = vis; 
            if(this.importedCamProxy) this.importedCamProxy.visible = false; 
        };
        toggleHelpers(false);

        const setVisibility = (mode) => {
            const showPose = mode === 'pose';
            const showDepth = ['depth', 'canny', 'normal', 'shaded', 'alpha', 'textured'].includes(mode);
            const showEnv = ['depth', 'normal', 'shaded', 'textured'].includes(mode);

            this.characters.forEach(c => {
                c.poseMeshes.forEach(m => {
                    const isFace = c.poseFaceMeshes.includes(m);
                    m.visible = showPose && (!isFace || c.showFace);
                });
                c.inactiveDepthMeshes.forEach(m => m.visible = false); 
                c.activeDepthMeshes.forEach(m => m.visible = showDepth);
                c.skeletonHelper.visible = false; 
            });
            this.environments.forEach(e => {
                e.meshes.forEach(m => m.visible = showEnv);
                // NEW LOGIC: Splats should ONLY appear in the textured pass (or default background).
                // They will break Depth/Normal/Canny passes if left visible.
                if (e.splatViewer) {
                    e.splatViewer.visible = (mode === 'textured');
                }
            });

            // NEW HDRI PROTECTION LOGIC
            if (mode === 'shaded' || mode === 'textured') {
                const activeHdriMap = this.hdriRenderTarget ? this.hdriRenderTarget.texture : this.currentHdriMap;
                this.scene.environment = this.isHdriEnabled ? activeHdriMap : null;
                this.scene.background = (this.isHdriEnabled && this.isHdriBgEnabled) ? activeHdriMap : new this.THREE.Color(0x000000);
            } else {
                this.scene.environment = null;
                this.scene.background = new this.THREE.Color(0x000000); 
            }
            
            //this.scene.background = new THREE.Color(0x000000); 
        };

        const compressCanvas = document.createElement("canvas");
        compressCanvas.width = this.renderWidth; compressCanvas.height = this.renderHeight;
        const compressCtx = compressCanvas.getContext("2d");

        const captureFrame = (array, mimeType = "image/png", quality = undefined, skipRender = false) => {
            if (!skipRender) {
                this.renderer.render(this.scene, this.camera);
            }
            this.renderer.getContext().finish(); 
            if (mimeType === "image/jpeg") {
                compressCtx.fillStyle = "#000000"; compressCtx.fillRect(0, 0, this.renderWidth, this.renderHeight);
                compressCtx.drawImage(this.renderer.domElement, 0, 0); array.push(compressCanvas.toDataURL(mimeType, quality));
            } else array.push(this.renderer.domElement.toDataURL(mimeType));
        };

        const executeMaterialPass = (matKey, arrayObj) => {
            const restores = [];
            const applyMat = (m) => {
                restores.push({mesh: m, mat: m.material});
                if (matKey === 'textured') {
                    m.material = this.originalMaterials.get(m) || m.material; 
                } else if (m.isPoints) {
                    if (matKey === 'depth') m.material = this.matsStatic.depthPoints;
                    else if (matKey === 'normal') m.material = this.matsStatic.normalPoints;
                    else m.material = this.originalMaterials.get(m) || m.material; 
                } else {
                    m.material = m.isSkinnedMesh ? this.matsSkinned[matKey] : this.matsStatic[matKey];
                }
            };

            this.characters.forEach(c => c.activeDepthMeshes.forEach(applyMat));
            this.environments.forEach(e => e.meshes.forEach(applyMat));
            
            captureFrame(arrayObj, "image/png");
            
            restores.forEach(o => o.mesh.material = o.mat);
        };

        // RENDER LOOP
        for (let idx = 0; idx < framesToRender; idx++) {
            const actualFrame = isSingleFrame ? currentUIFrame : idx;
            const time = actualFrame * step;
            const timeRatio = totalNodeFrames > 1 ? actualFrame / (totalNodeFrames - 1) : 0;
            
            btn.innerText = `BAKING ${idx+1}/${framesToRender}`;
            
            this.evaluateAnimations(time);
            this.characters.forEach(c => c.scene.updateMatrixWorld(true));
            this.environments.forEach(e => e.group.updateMatrixWorld(true));
            this.applyCameraKeyframes(timeRatio);

            setVisibility('pose'); this.resetCamera(); 
            captureFrame(results.pose, "image/png"); 

            setVisibility('depth');
            this.camera.near = Math.max(0.01, this.userNear); this.camera.far = Math.max(0.1, this.userFar); this.camera.updateProjectionMatrix();
            executeMaterialPass('depth', results.depth);

            setVisibility('canny'); this.resetCamera();
            executeMaterialPass('canny', results.canny);

            setVisibility('normal'); this.resetCamera();
            executeMaterialPass('normal', results.normal);
            
            setVisibility('shaded'); this.resetCamera();
            
            if (this.isPathTracingEnabled && this.ptRenderer) {
                // 1. Swap the floor to the matte physical material (like in animate)
                const origFloorMat = this.floor.material;
                if (!this.ptFloorMat) this.ptFloorMat = new this.THREE.MeshStandardMaterial({ color: 0x222222, roughness: 1.0, metalness: 0.0 });
                this.floor.material = this.ptFloorMat;

                // 2. Temporarily assign shaded materials
                const restores = [];
                const applyMat = (m) => {
                    restores.push({mesh: m, mat: m.material});
                    if (!m.isPoints) m.material = m.isSkinnedMesh ? this.matsSkinned.shaded : this.matsStatic.shaded;
                };
                this.characters.forEach(c => c.activeDepthMeshes.forEach(applyMat));
                this.environments.forEach(e => e.meshes.forEach(applyMat));

                // 3. Inject scene and bake the Path Traced samples
                this.ptRenderer.setScene(this.scene, this.camera);
                
                let lastUIUpdate = 0;
                while (this.ptRenderer.samples < this.ptBakeSamples) {
                    this.ptRenderer.renderSample();
                    
                    const currentSample = Math.floor(this.ptRenderer.samples);
                    // Only yield to the UI when a full new sample is completed
                    if (currentSample > lastUIUpdate) {
                        lastUIUpdate = currentSample;
                        btn.innerText = `PT BAKING ${idx+1}/${framesToRender} [${currentSample}/${this.ptBakeSamples}]`;
                        
                        // Yield every 5 samples to keep the UI responsive without throttling the GPU
                        if (currentSample % 5 === 0) {
                            await new Promise(r => setTimeout(r, 1)); 
                        }
                    }
                }
                
                // 4. Capture frame and restore materials
                captureFrame(results.shaded, "image/png", undefined, true);
                restores.forEach(o => o.mesh.material = o.mat);
                this.floor.material = origFloorMat;
                
            } else {
                // Fallback to normal fast WebGL shading
                executeMaterialPass('shaded', results.shaded);
            }

            setVisibility('alpha'); this.resetCamera();
            executeMaterialPass('alpha', results.alpha);

            setVisibility('textured'); this.resetCamera();
            executeMaterialPass('textured', results.textured);

            await new Promise(r => setTimeout(r, 10)); 
        }
        
        // --- RESTORATION BLOCK START ---
        this.isBaking = false; 
        this.renderer.setSize(originalSize.width, originalSize.height, false);
        
        // Let onResize cleanly restore the offset view mapping for the layout UI
        const vpAreaRestore = this.container.querySelector(".yedp-vp-area");
        if (vpAreaRestore) this.onResize(vpAreaRestore);
        
        // Restore camera boundaries
        if(this.isDepthMode) { 
            this.updateCameraBounds(); 
        } else { 
            this.resetCamera(); 
        }
        
        // Bring back the grid, axes, and floor
        toggleHelpers(true); 
        
        // Restore the original background color (fixes the black screen)
        this.scene.background = originalBg; 
        
        // Unhide the light gizmos
        this.lights.forEach(l => { 
            if (l.helper) l.helper.visible = l.type !== 'ambient'; 
        });
        
        // Reattach the transform controls to whatever was selected before baking
        if (this.selected.obj) {
            this.selectObject(this.selected.obj, this.selected.type, this.selected.id);
        }
        
        // Restore character meshes and skeletons
        this.updateVisibilities();
        this.characters.forEach(c => { 
            c.skeletonHelper.visible = visSkel; 
        });
        
        // Reset the bake button text
        btn.innerText = originalBtnText;
        // --- RESTORATION BLOCK END ---

        // Send to python backend
        await this.sendBakeToServer(results);
    }

    async sendBakeToServer(results) {
        // Find whichever button triggered the bake to update its text
        const btn = this.container.querySelector("#btn-bake") || this.container.querySelector("#btn-bake-frame");
        const originalBtnText = btn ? btn.innerText : "BAKE";
        if (btn) btn.innerText = "PREPARING UPLOAD...";

        try {
            // 1. Generate a unique payload ID for this session
            const payloadId = typeof crypto !== 'undefined' && crypto.randomUUID 
                ? `yedp_payload_${crypto.randomUUID()}`
                : `yedp_payload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // 2. Upload each visual pass as smaller individual chunks to stay under 100MB limits safely
            const passNames = Object.keys(results);
            const CHUNK_SIZE = 50; // Batch frames by 50 to easily dodge the HTTP 413 error limit

            for (let i = 0; i < passNames.length; i++) {
                const passName = passNames[i];
                const frames = results[passName];
                const totalChunks = Math.ceil(frames.length / CHUNK_SIZE);

                for (let j = 0; j < totalChunks; j++) {
                    if (btn) {
                        btn.innerText = `UPLOADING PASS ${i + 1}/${passNames.length} (Batch ${j + 1}/${totalChunks})`;
                    }
                    
                    const chunkFrames = frames.slice(j * CHUNK_SIZE, (j + 1) * CHUNK_SIZE);
                    
                    await api.fetchApi("/yedp/upload_payload_chunk", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            payload_id: payloadId,
                            pass: passName,
                            frames: chunkFrames
                        })
                    });
                }
            }

            // 3. Tell Python we are done and receive the final payload ID for the node execution
            if (btn) btn.innerText = "FINISHING UPLOAD...";
            const res = await api.fetchApi("/yedp/upload_payload_finish", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ payload_id: payloadId })
            });
            
            const data = await res.json();
            if (data.payload_id) {
                const widget = this.node.widgets?.find(w => w.name === "client_data");
                if (widget) {
                    widget.value = data.payload_id;
                }
            }
        } catch (e) {
            console.error("[Yedp] Failed to send bake to server", e);
            alert("Bake upload failed. See console.");
        } finally {
            if (btn) btn.innerText = originalBtnText;
        }
    }
}

// --- COMfyUI EXTENSION REGISTRATION ---
app.registerExtension({
    name: "Yedp.ActionDirector",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "YedpActionDirector") {
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
                
                const container = document.createElement("div");
                container.classList.add("yedp-container");
                // Let Vue handle the external sizing, just fill the space and hide overflow to stop corner bleeding
                container.style.width = "100%"; 
                container.style.height = "100%"; 
                container.style.overflow = "hidden"; 
                container.style.borderRadius = "8px"; // Optional: match ComfyUI's rounded corners
                
                const widget = this.addDOMWidget("3d_viewport", "vp", container, { serialize: false, hideOnZoom: false });
                
                setTimeout(() => {
                    const vp = new YedpViewport(this, container);
                    this.vp = vp; 
                    
                    // Hide the raw JSON payload input cleanly
                    const w = this.widgets?.find(w => w.name === "client_data");
                    if (w?.inputEl) w.inputEl.style.display = "none";
                }, 100);
                
                // Provide a default starting size, let the user/Vue scale it from here
                this.setSize([720, 600]);
                
                this.onRemoved = function() {
                    if (this.vp) {
                        this.vp.isBaking = false; this.vp.isPlaying = false;
                        if (this.vp.resizeObserver) this.vp.resizeObserver.disconnect();
                        if (this.vp.isMocapActive) {
                            this.vp.isMocapActive = false;
                            if (this.vp.mocapTimer) clearInterval(this.vp.mocapTimer);
                            if (this.vp.mocapMediaStream) this.vp.mocapMediaStream.getTracks().forEach(t=>t.stop());
                            if (this.vp.mocapVideoEl) { this.vp.mocapVideoEl.pause(); this.vp.mocapVideoEl.srcObject = null; }
                        }
                        if (this.vp._handleKeyDown) window.removeEventListener('keydown', this.vp._handleKeyDown);
                        if (this.vp.renderer) { this.vp.renderer.dispose(); this.vp.renderer = null; }
                    }
                };
                return r;
            };

            const onSerializeOrig = nodeType.prototype.onSerialize;
            nodeType.prototype.onSerialize = function (o) {
                if (onSerializeOrig) onSerializeOrig.apply(this, arguments);
                if (this.vp) {
                    o.scene_state = this.vp.serializeScene();
                }
            };

            const onConfigureOrig = nodeType.prototype.onConfigure;
            nodeType.prototype.onConfigure = function (o) {
                if (onConfigureOrig) onConfigureOrig.apply(this, arguments);
                if (o.scene_state) {
                    this.saved_scene_state = o.scene_state;
                    if (this.vp && this.vp.isInitialized) {
                        this.vp.loadScene(this.saved_scene_state);
                    }
                }
            };
        }
    }
});
