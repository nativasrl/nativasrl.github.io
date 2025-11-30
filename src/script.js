import "./main.css";

import { gsap } from "gsap";
import {
  ACESFilmicToneMapping,
  Clock,
  Color,
  DirectionalLight,
  Group,
  LoadingManager,
  Mesh,
  PCFSoftShadowMap,
  PMREMGenerator,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  SRGBColorSpace,
  Scene,
  ShadowMaterial,
  Vector2,
  WebGLRenderer
} from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { SMAAPass } from "three/examples/jsm/postprocessing/SMAAPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

class App {
  constructor() {
    this.container = document.getElementById("canvas-container");
    this.containerDetails = document.getElementById("canvas-container-details");
    this.watchedSection = document.querySelector(".second");
    this.navButtons = document.querySelectorAll("nav > .a");
    this.customCursor = document.querySelector(".cursor");

    this.scene = new Scene();
    this.width = this.container.clientWidth;
    this.height = this.container.clientHeight;
    this.clock = new Clock();
    this.previousTime = 0;
    this.cursor = { x: 0, y: 0 };
    this.secondContainer = false;
    this.envMap1 = null;
    this.envMap2 = null;

    this.loadingManager = new LoadingManager();
    this.loadingManager.onLoad = this.onLoadComplete.bind(this);

    this.initRenderers();
    this.initEnvironment();
    this.initCameras();
    this.initLights();
    this.loadModels();
    this.setupListeners();
    this.setupIntersectionObserver();

    this.renderLoop = this.renderLoop.bind(this);
    this.renderLoop();
  }

  initRenderers() {
    const pixelRatio = Math.min(window.devicePixelRatio, 2);

    // Renderer 1
    this.renderer = new WebGLRenderer({
      antialias: true,
      alpha: false,
    });
    this.renderer.autoClear = false;
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(this.width, this.height);
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.75;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    this.bloomPass = new UnrealBloomPass(
      new Vector2(this.width, this.height),
      0.05, // Further reduced strength
      0.2, // Reduced radius
      0.95 // High threshold to only bloom very bright parts
    );
    this.composer.addPass(this.bloomPass);

    const outputPass = new OutputPass();
    this.composer.addPass(outputPass);

    const smaaPass = new SMAAPass(this.width * pixelRatio, this.height * pixelRatio);
    this.composer.addPass(smaaPass);

    this.renderer2 = new WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    this.renderer2.autoClear = true;
    this.renderer2.setPixelRatio(pixelRatio);
    this.renderer2.setSize(this.width, this.height);
    this.renderer2.outputColorSpace = SRGBColorSpace;
    this.renderer2.toneMapping = ACESFilmicToneMapping;
    this.renderer2.toneMappingExposure = 0.75;
    this.renderer2.shadowMap.enabled = true;
    this.renderer2.shadowMap.type = PCFSoftShadowMap;
    this.containerDetails.appendChild(this.renderer2.domElement);
  }

  initEnvironment() {
    this.pmrem1 = new PMREMGenerator(this.renderer);
    this.pmrem1.compileEquirectangularShader();
    
    this.pmrem2 = new PMREMGenerator(this.renderer2);
    this.pmrem2.compileEquirectangularShader();

    new RGBELoader(this.loadingManager)
      .setPath("./hdr/")
      .load("qwantani_sunset_puresky_2k.hdr", (texture) => {
        this.envMap1 = this.pmrem1.fromEquirectangular(texture).texture;
        this.envMap2 = this.pmrem2.fromEquirectangular(texture).texture;
        this.scene.environment = this.envMap1;

        texture.dispose();
        this.pmrem1.dispose();
        this.pmrem2.dispose();
      });
  }

  initCameras() {
    this.cameraGroup = new Group();
    this.scene.add(this.cameraGroup);
    this.camera = new PerspectiveCamera(35, this.width / this.height, 1, 100);
    this.camera.position.set(20, 1.54, -0.1);
    this.cameraGroup.add(this.camera);
    this.camera2 = new PerspectiveCamera(35, this.width / this.height, 1, 100);
    this.camera2.position.set(2, 2, 2);
    this.camera2.rotation.set(0, 1, 0);
    this.scene.add(this.camera2);
  }

  initLights() {
    const sunLight = new DirectionalLight(0xff7711, 4);
    sunLight.position.set(-2, 2.5, 2);
    sunLight.castShadow = true;
    sunLight.shadow.camera.near = 0.1;
    sunLight.shadow.camera.far = 10;
    sunLight.shadow.bias = -0.0005; 
    sunLight.shadow.normalBias = 0.005; 
    sunLight.shadow.mapSize.width = 2048; 
    sunLight.shadow.mapSize.height = 2048;
    this.scene.add(sunLight);

    this.fillLight = new PointLight(0xffeeb1, 1.5, 2.5, 2);
    this.fillLight.position.set(0, 3, 3);
    this.scene.add(this.fillLight);

    // Shadow Plane
    const shadowMaterial = new ShadowMaterial({
      opacity: 0.3,
      color: 0x000000,
    });
    const shadowPlane = new Mesh(new PlaneGeometry(10, 10), shadowMaterial);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 1.845; 
    shadowPlane.receiveShadow = true;
    this.scene.add(shadowPlane);
  }

  loadModels() {
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(
      "https://cdn.jsdelivr.net/npm/three@0.164.1/examples/jsm/libs/draco/gltf/"
    );
    const loader = new GLTFLoader(this.loadingManager);
    loader.setDRACOLoader(dracoLoader);
    loader.load("models/cosmetics.glb", (gltf) => {
      const model = gltf.scene;
      model.traverse((t) => {
        if (t.isMesh) {
          t.castShadow = true;
          t.receiveShadow = true;
          if (
            t.name === "Cylinder025" ||
            t.name === "Cylinder025_1" ||
            t.name === "Cylinder025_3" ||
            t.name === "Cylinder024" ||
            t.name === "Cylinder024_2"
          ) {
            t.material.transmission = 1.0;
            t.material.color.set(0xeeeeee);
            t.material.roughness = 0.05;
            t.material.ior = 1.52;
            t.material.transparent = true;
            t.material.thickness = 0.01;
          }
          t.material.envMapIntensity = 1.5; // Boost reflections
          t.material.needsUpdate = true;
        }
      });
      model.position.y = 1.85;
      model.position.x = 0;
      model.rotation.y = -Math.PI / 2;
      this.scene.add(model);
    });
  }

  onLoadComplete() {
    document.querySelector(".main-container").style.visibility = "visible";
    document.querySelector("body").style.overflow = "auto";

    this.introAnimation();
    window.scroll(0, 0);
  }

  introAnimation() {
    this.camera.rotation.set(-0.25, 0, 0);
    this.camera.position.set(0, 3.5, 5);

    gsap.to(this.camera.position, {
      x: 0,
      y: 2.6,
      z: 2.25,
      duration: 3.5,
      ease: "power2.inOut",
    });

    gsap.delayedCall(0.5, () => {
      document.querySelector(".first>p").classList.add("ended");
    });

    gsap.delayedCall(1.0, () => {
      document.querySelector(".header").classList.add("ended");
    });
  }

  setupListeners() {
    window.addEventListener("resize", this.onResize.bind(this));
    document.addEventListener("mousemove", this.onMouseMove.bind(this));
    document.getElementById("product1").addEventListener("click", () => {
      this.setActiveDetail("product1");
      document.getElementById("content").innerHTML =
        "Detergente viso, a base di Olio d’Oliva, pensato per chi desidera una pulizia del viso delicata ma efficace, capace di rimuovere impurità e sebo senza irritare la pelle.<br>La sua formula di distingue per l’uso di:<ul><li>Oleox, principio attivo estratto dall’oliva con proprietà purificanti e lenitive</li><li>Estratti di vegetazione di oliva, materie prime upcycled, ricavate dagli scarti della filiera del frantoio che altrimenti verrebbero eliminati. Contribuiscono a nutrire e proteggere la pelle durante la detersione.</li></ul>La texture è un gel morbido e leggero, che scivola delicatamente sulla pelle, lasciandola pulita, fresca e luminosa. La sua profumazione si rifà agli odori fruttati delle coltivazioni marchigiane.<br><br>Disponibile nel formato da 150 ml al prezzo di 30€.";
      this.animateCamera2({ x: -1, y: 2, z: 1.5 }, { y: -0.1 });
    });
    document.getElementById("product2").addEventListener("click", () => {
      this.setActiveDetail("product2");
      document.getElementById("content").innerHTML =
        "Contorno occhi nato dagli estratti di Tartufo Bianco che aiuta a contrastare i segni del tempo e della stanchezza donando una sguardo più fresco e riposato.<br>Al suo interno troviamo:<ul><li>W TR-Active, attivo cosmetico derivato dal tartufo bianco, noto per le sue proprietà anti-età, illuminati e drenanti</li><li>Estratti di lavorazione tartufo bianco, materia prima upcycled, come scarti inutilizzabili per l'alimentazione o residui. Proprietà nutrienti e leviganti.</li></ul>La texture leggera permette di assorbire facilmente il prodotto senza ungere o appesantire la zona, offrendo una sensazione immediata di freschezza. <br>La profumazione, nonostante l’uso del tartufo non risulta pungente ma delicata e neutra.<br><br>Disponibile nel formato 15 ml al prezzo di 40€.";
      this.animateCamera2({ x: 0, y: 2, z: 1.5 }, { y: 0.1 });
    });
    document.getElementById("product3").addEventListener("click", () => {
      this.setActiveDetail("product3");
      document.getElementById("content").innerHTML =
        "Crema viso che si caratterizza per l’uso degli scarti del Fico D’India, pianta tipica del territorio.<br>La sua formulazione unisce due ingredienti distintivi:<ul><li>Hydropuntil, un attivo cosmetico estratto dalla polpa del frutto che vanta proprietà idratanti, lenitive e antiossidanti</li><li>Olio dei semi del Fico d’India, materia prima upcycled, ottenuto dalla spremitura a freddo dei semi che aiuta a nutrire proteggere e rinforzare la barriera cutanea</li></ul>Grazie a questa combinazione, la crema risulta idratante, nutriente e riequilibrante, rispettando sia la pelle che l’ambiente.<br>La texture leggera e di rapido assorbimento la rende perfetta per le pelli miste, lasciando la pelle morbida, luminosa ed equilibrata. La profumazione delicata, con note agrumate, richiama le atmosfere mediterranee e il profumo autentico del territorio siciliano.<br><br>Disponibile nel formato 50 ml al prezzo di 35€.";
      this.animateCamera2({ x: 0.5, y: 2, z: 1.5 }, { y: 0.2 });
    });
    this.navButtons.forEach((b) => {
      b.addEventListener("mousemove", this.updateNavHover.bind(this));
      b.addEventListener("mouseleave", this.updateNavHover.bind(this));
      b.addEventListener("mouseenter", () => this.customCursor.classList.add("hovered"));
      b.addEventListener("mouseleave", () => this.customCursor.classList.remove("hovered"));
    });

    const listItems = document.querySelectorAll(".second-container > ul > li");
    listItems.forEach((item) => {
      item.addEventListener("mouseenter", () => this.customCursor.classList.add("hovered"));
      item.addEventListener("mouseleave", () => this.customCursor.classList.remove("hovered"));
    });
  }

  onResize() {
    this.width = this.container.clientWidth;
    this.height = this.container.clientHeight;
    
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    
    const detailWidth = this.containerDetails.clientWidth;
    const detailHeight = this.containerDetails.clientHeight;
    this.camera2.aspect = detailWidth / detailHeight;
    this.camera2.updateProjectionMatrix();

    this.renderer.setSize(this.width, this.height);
    this.composer.setSize(this.width, this.height);
    this.renderer2.setSize(detailWidth, detailHeight);

    const pixelRatio = Math.min(window.devicePixelRatio, 2);
    this.renderer.setPixelRatio(pixelRatio);
    this.composer.setPixelRatio(pixelRatio);
    this.renderer2.setPixelRatio(pixelRatio);
  }

  onMouseMove(event) {
    event.preventDefault();
    this.cursor.x = event.clientX / window.innerWidth - 0.5;
    this.cursor.y = event.clientY / window.innerHeight - 0.5;
    const x = event.clientX;
    const y = event.clientY;
    this.customCursor.style.cssText = `left: ${x}px; top: ${y}px;`;
  }

  updateNavHover(e) {
    const span = e.currentTarget.querySelector("span");
    if (e.type === "mouseleave") {
      span.style.cssText = "";
    } else {
      const { offsetX: x, offsetY: y } = e;
      const { offsetWidth: width, offsetHeight: height } = e.currentTarget;
      const walk = 20;
      const xWalk = (x / width) * (walk * 2) - walk;
      const yWalk = (y / height) * (walk * 2) - walk;
      span.style.cssText = `transform: translate(${xWalk}px, ${yWalk}px);`;
    }
  }

  setActiveDetail(activeId) {
    ["product1", "product2", "product3"].forEach((id) => {
      document.getElementById(id).classList.toggle("active", id === activeId);
    });
  }

  animateCamera2(position, rotation) {
    gsap.to(this.camera2.position, {
      ...position,
      duration: 1.8,
      ease: "power2.inOut",
    });
    gsap.to(this.camera2.rotation, {
      ...rotation,
      duration: 1.8,
      ease: "power2.inOut",
    });
  }

  setupIntersectionObserver() {
    const obCallback = (payload) => {
      this.secondContainer = payload[0].intersectionRatio > 0.05;
    };
    const ob = new IntersectionObserver(obCallback, { threshold: 0.05 });
    ob.observe(this.watchedSection);
  }

  renderLoop() {
    const elapsedTime = this.clock.getElapsedTime();
    const deltaTime = elapsedTime - this.previousTime;
    this.previousTime = elapsedTime;

    if (!this.secondContainer) {
      this.scene.background = new Color(0xe8f3e8); // Light green background
      if (this.envMap1) this.scene.environment = this.envMap1;

      const parallaxY = this.cursor.y;
      const parallaxX = this.cursor.x;

      this.fillLight.position.y -=
        (parallaxY * 9 + this.fillLight.position.y - 2) * deltaTime;
      this.fillLight.position.x +=
        (parallaxX * 8 - this.fillLight.position.x) * 2 * deltaTime;
      this.fillLight.position.z += (1.8 - this.fillLight.position.z) * 0.1;

      this.cameraGroup.position.z -=
        (parallaxY / 3 + this.cameraGroup.position.z) * 2 * deltaTime;
      this.cameraGroup.position.x +=
        (parallaxX / 3 - this.cameraGroup.position.x) * 2 * deltaTime;

      this.renderPass.camera = this.camera;
      this.composer.render();
    } else {
      this.scene.background = new Color(0xe8f3e8); // Light green background
      if (this.envMap2) this.scene.environment = this.envMap2;
      
      this.renderer2.render(this.scene, this.camera2);
    }

    requestAnimationFrame(this.renderLoop);
  }
}

new App();
