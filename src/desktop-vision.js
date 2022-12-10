import { Util } from './util.js'
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js'
import { XRHandModelFactory } from 'three/examples/jsm/webxr/XRHandModelFactory.js'

Util.registerComponentSystem('desktop-vision', {
    schema: {
    },
    init() {

    },
    addScript() {
        return new Promise((resolve, e) => {
            const script = document.createElement('script');
            script.src = "https://js.desktop.vision/three/v3.0.0/bundle.min.js";
            script.onload = () => {
                this.createComputer()
                resolve()
            }
            document.head.appendChild(script);
        })
    },
    async connectToDesktopVision() {
        await this.addScript()
    },

    async createComputer() {
        this.removeComputer()
        const {
            ManagedComputer
        } = window.DesktopVision.loadSDK(
            THREE,
            XRControllerModelFactory,
            XRHandModelFactory,
        )
        const video = document.createElement("video");
        const sceneContainer = document.querySelector('a-scene')
        const parent = document.querySelector('#camera-offsetter').object3D

        const scene = this.el.sceneEl
        const camera = scene.camera
        const renderer = scene.renderer
        const desktopOptions = {
            scene: scene.object3D,
            camera,
            sceneContainer,
            renderer,
            video,
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
        const desktop = new ManagedComputer(desktopOptions, { id: "wG99zpg7aA2mwwmm8XHV", key: "key" });

        desktop.refresh()

        const desktopEntity = document.createElement('a-entity')
        scene.appendChild(desktopEntity)

        desktopEntity.object3D.add(desktop);
        desktopEntity.object3D.position.y = 3
        desktopEntity.object3D.position.z = -3

        this.desktopEntity = desktopEntity
        this.desktop = desktop
    },

    removeComputer() {
        const { desktop, desktopEntity } = this
        if (!desktop) return
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
