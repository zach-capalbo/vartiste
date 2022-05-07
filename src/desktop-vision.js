import { Util } from './util.js'
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js'
import { XRHandModelFactory } from 'three/examples/jsm/webxr/XRHandModelFactory.js'

Util.registerComponentSystem('desktop-vision', {
    schema: {
    },
    init() {
        // Load the Desktop Vision script asynchronously on init if the
        // desktop.vision oath parameters are specified.
        // The sdk is then loaded immediately to manage the oauth flow
        // and automatically close Desktop Vision oauth redirect popup windows.
        let params = new URLSearchParams(document.location.search)
        let token = params.get("oauth")

        if (token === 'desktopvision')
        {
          console.log("Desktop vision authentication token detected. Auto loading desktop.vision")
          this.addScript()
        }

    },
    addScript() {
      return new Promise((r, e) => {
        const script = document.createElement('script');
        script.src = "https://js.desktop.vision/three.min.js";
        script.onload = () => {
          window.DesktopVision.loadSDK(THREE, XRControllerModelFactory, XRHandModelFactory);
          r()
        }
        document.head.appendChild(script);
      })

      this.addScript = function() {};
    },
    async connectToDesktopVision() {
        await this.addScript()
        this.removeComputer();
        const scope = encodeURIComponent("connect,list");
        const clientID = "wG99zpg7aA2mwwmm8XHV"
        const redirectURL = new URL(window.location.href);
        const scene = this.el.sceneEl
        const renderer = scene.renderer

        const session = renderer.xr.getSession();
        if (session !== null) {
            await session.end();
        }

        redirectURL.searchParams.set("oauth", "desktopvision");
        const redirectUri = encodeURIComponent(redirectURL);
        window.open(`https://desktop.vision/login/?response_type=code&client_id=${clientID}&scope=${scope}&redirect_uri=${redirectUri}&redirect_type=popup&selectComputer=true`);

        let roomOptionsInterval = setInterval(() => {
            try {
                const options = localStorage.getItem('DESKTOP_VISION_ROOM_OPTIONS')
                localStorage.setItem("DESKTOP_VISION_ROOM_OPTIONS", null)
                const roomOptions = JSON.parse(options)
                if (roomOptions) {
                    clearInterval(roomOptionsInterval)
                    this.createComputer(roomOptions)
                }
            } catch (e) {
            }
        }, 1000);
    },

    async createComputer(roomOptions) {
        await this.addScript()
        const { ComputerConnection, Computer } = window.DesktopVision.loadSDK(THREE, XRControllerModelFactory, XRHandModelFactory);
        const sceneContainer = document.querySelector('a-scene')
        const parent = document.querySelector('#camera-offsetter').object3D

        const scene = this.el.sceneEl
        const camera = scene.camera
        const renderer = scene.renderer

        this.computerConnection = new ComputerConnection(roomOptions);
        this.video = document.createElement("video");
        this.computerConnection.on("stream-added", (newStream) => {
            const { video, computerConnection } = this
            video.setAttribute('webkit-playsinline', 'webkit-playsinline');
            video.setAttribute('playsinline', 'playsinline');
            video.srcObject = newStream;
            video.muted = false
            video.play();
            const desktopOptions = {
                renderScreenBack: true,
                initialScalar: 1,
                initialWidth: 2,
                includeKeyboard: true,
                renderAsLayer: false,
                xrOptions: {
                    hideControllers: true,
                    hideHands: true,
                    hideCursors: true,
                    hideRay: true,
                    parent
                },
            }
            const desktop = new Computer(scene.object3D, sceneContainer, video, renderer, computerConnection, camera, desktopOptions);
            const desktopEntity = document.createElement('a-entity')
            scene.appendChild(desktopEntity)

            desktopEntity.object3D.add(desktop);
            desktopEntity.object3D.position.y = 2.6
            desktopEntity.object3D.position.z = -2

            this.desktopEntity = desktopEntity
            this.desktop = desktop
        });
    },

    removeComputer() {
        const { computerConnection, desktop, desktopEntity } = this
        if (!desktop) return
        try {
            computerConnection.disconnect()
        } catch (e) {
            console.log(e)
        }
        try {
            desktop.destroy()
        } catch (e) {
            console.log(e)
        }
        try {
            desktopEntity.parentNode.removeChild(desktopEntity);
        } catch (e) {
            console.log(e)
        }
    },
})
