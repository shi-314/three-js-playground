(function (playground) {

	'use strict';

	playground.Play = function () {
		this.container = document.getElementById('container');
		this.width = window.innerWidth;
		this.height = window.innerHeight;

		console.log('initializing (' + this.width + 'x' + this.height + ')');

		this.camera = new THREE.PerspectiveCamera(75, this.width / this.height, 10, 5000);
		this.camera.updateProjectionMatrix();

		this.controls = new THREE.PointerLockControls(this.camera);

		this.scene = new THREE.Scene();
		this.scene.fog = new THREE.FogExp2(0xffffff, 0.00045);

		this.scene.add(this.controls.getObject());

		this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
		this.renderer.setSize(this.width, this.height);
		this.renderer.setClearColor(this.scene.fog.color, 1);
		this.renderer.shadowMapEnabled = true;
		this.renderer.shadowMapType = THREE.PCFShadowMap;
		this.container.appendChild(this.renderer.domElement);

		this.stats = new Stats();
		this.stats.domElement.style.position = 'absolute';
		this.stats.domElement.style.top = '0px';
		this.stats.domElement.style.zIndex = 100;
		this.container.appendChild(this.stats.domElement);

		this.geometry = new THREE.CubeGeometry(200, 200, 200);

		//window.addEventListener('mousemove', this.onMouseMove.bind(this), false);
		window.addEventListener('resize', this.onWindowResize.bind(this), false);

		//
		// scene
		//

		// GROUND

		var geometry = new THREE.PlaneGeometry(100, 100);
		var planeMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
		planeMaterial.ambient = planeMaterial.color;

		var ground = new THREE.Mesh(geometry, planeMaterial);

		ground.rotation.x = -Math.PI / 2;
		ground.scale.set(100, 100, 100);
		ground.position.y = -400;

		ground.castShadow = false;
		ground.receiveShadow = true;

		this.scene.add(ground);

		var _that = this;
		var loader = new THREE.BinaryLoader(true);
		this.model = null;

		loader.load('/obj/lucy/Lucy100k_bin.js', function (geometry, materials) {

			var mesh = new THREE.Mesh(geometry, new THREE.MeshFaceMaterial(materials));
			mesh.scale.set(0.5, 0.5, 0.5);
			mesh.position.set(0, 0,-1000);
			mesh.updateMatrix();
			mesh.castShadow = true;
			mesh.receiveShadow = true;
			_that.scene.add(mesh);

			loader.statusDomElement.style.display = "none";

			console.log("geometry.vertices: " + geometry.vertices.length);
			console.log("geometry.faces: " + geometry.faces.length);

		});

		//
		// lights
		//

		var light = new THREE.SpotLight(0xffffff, 1, 0, Math.PI / 2, 0.5);
		light.position.set(1000, 1500, 1000);
		light.target.position.set(0, 200, 0);

		light.castShadow = true;

		light.shadowCameraNear = 200;
		light.shadowCameraFar = 10000;
		light.shadowCameraFov = 75;
		//light.shadowCameraVisible = true;
		light.shadowBias = 0.0001;
		light.shadowDarkness = 0.5;
		light.shadowMapWidth = 2048;
		light.shadowMapHeight = 2048;

		this.light = light;

		this.scene.add(light);

		this.scene.add(new THREE.AmbientLight(0x202020));


		// ambient occlusion

		var SCALE = 1.0;

		var effectSSAO = new THREE.ShaderPass(THREE.SSAOShader);
		var effectFXAA = new THREE.ShaderPass(THREE.FXAAShader);
		var effectScreen = new THREE.ShaderPass(THREE.CopyShader);

		var renderTargetParametersRGB = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBFormat };
		var renderTargetParametersRGBA = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat };
		var depthTarget = new THREE.WebGLRenderTarget(SCALE * this.width, SCALE * this.height, renderTargetParametersRGBA);
		var colorTarget = new THREE.WebGLRenderTarget(SCALE * this.width, SCALE * this.height, renderTargetParametersRGB);

		effectScreen.renderToScreen = true;
		effectScreen.enabled = true;
		effectSSAO.enabled = true;
		effectFXAA.enabled = true;

		var composer = new THREE.EffectComposer(this.renderer, colorTarget);
		composer.addPass(effectSSAO);
		composer.addPass(effectFXAA);
		composer.addPass(effectScreen);
		this.composer = composer;

		effectSSAO.uniforms[ 'tDepth' ].value = depthTarget;
		effectSSAO.uniforms[ 'size' ].value.set(SCALE * this.width, SCALE * this.height);
		effectSSAO.uniforms[ 'cameraNear' ].value = this.camera.near;
		effectSSAO.uniforms[ 'cameraFar' ].value = this.camera.far;
		effectSSAO.uniforms[ 'fogNear' ].value = this.scene.fog.near;
		effectSSAO.uniforms[ 'fogFar' ].value = this.scene.fog.far;
		effectSSAO.uniforms[ 'fogEnabled' ].value = 1;
		effectSSAO.uniforms[ 'aoClamp' ].value = 0.5;

		effectSSAO.material.defines = { "RGBA_DEPTH": true, "ONLY_AO_COLOR": "1.0, 0.7, 0.5" };
		effectFXAA.uniforms[ 'resolution' ].value.set(1 / ( SCALE * this.width ), 1 / ( SCALE * this.height ));

		// depth pass

		var depthPassPlugin = new THREE.DepthPassPlugin();
		depthPassPlugin.renderTarget = depthTarget;

		this.depthPassPlugin = depthPassPlugin;

		this.renderer.addPrePlugin(depthPassPlugin);

		this.clock = new THREE.Clock();

		this.lockPointer();
	}

	playground.Play.prototype.animate = function () {
		requestAnimationFrame(this.animate.bind(this), this.renderer);
		this.render();
	}

	playground.Play.prototype.render = function () {
		var dt = this.clock.getDelta();

		this.controls.update(dt);

		this.stats.update();
//		this.renderer.clear();
//		this.renderer.render( this.scene, this.camera );

		// render color and depth maps

		this.renderer.autoClear = false;
		this.renderer.autoUpdateObjects = true;
		this.renderer.shadowMapEnabled = true;
		this.depthPassPlugin.enabled = true;

		this.renderer.render(this.scene, this.camera, this.composer.renderTarget2, true);

		this.renderer.shadowMapEnabled = false;
		this.depthPassPlugin.enabled = false;

		// do postprocessing

		this.composer.render(dt);
	}

	playground.Play.prototype.onMouseMove = function (e) {
		var windowHalfX = window.innerWidth / 2;
		var windowHalfY = window.innerHeight / 2;

		var mouseX = ( event.clientX - windowHalfX );
		var mouseY = ( event.clientY - windowHalfY );

		this.light.position.x = mouseX;
		this.light.position.y = 600 - mouseY;
	}

	playground.Play.prototype.onWindowResize = function (e) {
		this.width = window.innerWidth;
		this.height = window.innerHeight;

		this.camera.aspect = this.width / this.height;
		this.camera.updateProjectionMatrix();

		this.renderer.setSize(this.width, this.height);

		console.log('resize (' + this.width + 'x' + this.height + ')');
	}

	playground.Play.prototype.lockPointer = function () {
		var havePointerLock = 'pointerLockElement' in document ||
			'mozPointerLockElement' in document ||
			'webkitPointerLockElement' in document;

		if (!havePointerLock) {
			console.log('pointer lock available: ' + havePointerLock);
			return;
		}

		var element = document.body;

		element.requestPointerLock = element.requestPointerLock || element.mozRequestPointerLock || element.webkitRequestPointerLock;

		document.addEventListener('pointerlockchange', this.onPointerLockChanged.bind(this), false);
		document.addEventListener('mozpointerlockchange', this.onPointerLockChanged.bind(this), false);
		document.addEventListener('webkitpointerlockchange', this.onPointerLockChanged.bind(this), false);

		document.addEventListener('pointerlockerror', this.onPointerLockError.bind(this), false);
		document.addEventListener('mozpointerlockerror', this.onPointerLockError.bind(this), false);
		document.addEventListener('webkitpointerlockerror', this.onPointerLockError.bind(this), false);

		element.addEventListener('click', function (event) {
			element.requestPointerLock = element.requestPointerLock || element.mozRequestPointerLock || element.webkitRequestPointerLock;
			element.requestPointerLock();
		}, false);
	}

	playground.Play.prototype.onPointerLockChanged = function (e) {
		console.log('pointer lock changed: ');

		var element = document.body;

		if (document.pointerLockElement === element || document.mozPointerLockElement === element || document.webkitPointerLockElement === element) {

			this.controls.enabled = true;

		} else {

			this.controls.enabled = false;

		}
	}

	playground.Play.prototype.onPointerLockError = function (e) {
		console.log('pointer lock error: ');
	}

})(window.playground = window.playground || {});