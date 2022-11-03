import {Util} from './util.js'
import {okhsl_to_srgb, okhsv_to_srgb} from './framework/oklab.js'

AFRAME.registerComponent('glb-pencil-tool', {
    dependencies: ['pencil-tool'],
    async init() {
        await Util.whenComponentInitialized(this.el, 'hand-draw-tool')
        this.el.components['pencil-tool'].handle.setAttribute('visible', false)
        this.el.components['pencil-tool'].tip.setAttribute('visible', false)
        this.el.querySelector('*[show-current-brush]').setAttribute('visible', false)
    }
})

AFRAME.registerComponent('align-to-self', {
    schema: {
        target: {type: 'selector'}
    },
    update(oldData) {
        if (this.data.target !== oldData.target && this.data.target)
        {
            Util.whenLoaded([this.el, this.data.target], () => {
                Util.positionObject3DAtTarget(this.data.target.object3D, this.el.object3D)
            })
        }
    }
})

AFRAME.registerComponent('contact-action', {
    dependencies: ['physx-contact-event'],
    schema: {
        // You should set either system or component
        system: {type: 'string'},
        // You should set either system or component
        component: {type: 'string'},

        // The name of the method to call when clicked
        action: {type: 'string'},

        impulseThreshold: {default: 0.0001},
        },
        events: {
        contactevent: function() {
            if (!this.data.action) return;
            console.log("Clicking", this)

            if (this.data.component.length)
            {
            this.el.sceneEl.components[this.data.component][this.data.action]()
            }
            else if (this.data.system.length)
            {
            this.el.sceneEl.systems[this.data.system][this.data.action]()
            }
            else
            {
            try {
                Util.traverseAncestors(this.el, (el) => {
                if (!el.hasAttribute('system-click-action')) return
                let data = el.getAttribute('system-click-action')
                if (data.component)
                {
                    this.el.sceneEl.components[data.component][this.data.action]()
                    throw 0
                }
                else if (data.system)
                {
                    this.el.sceneEl.components[data.system][this.data.action]()
                    throw 0
                }
                })
            }
            catch (e) {
                if (e !== 0)
                {
                console.error(e)
                }
            }
            }
        }
    },
    update(oldData)
    {
    this.el.setAttribute('physx-contact-event', 'impulseThreshold', this.data.impulseThreshold)
    }
})

AFRAME.registerComponent('color-spinning-wheel', {
    schema: {
        minRotation: {default: 0.001}
    },
    init() {
        this.tick = AFRAME.utils.throttleTick(this.tick, 100, this)
        this.lastRotation = 0.0
    },
    tick(t, dt) {
        let rot = this.el.object3D.rotation.x
        if (Math.abs(this.lastRotation - rot) > this.data.minRotation)
        {
            let c =  okhsl_to_srgb(this.el.object3D.rotation.x / Math.PI / 2.0, 1.0, 0.5)
            this.el.sceneEl.systems['paint-system'].color3.setRGB(c[0] / 255.0, c[1] / 255.0, c[2] / 255.0)
            this.el.sceneEl.systems['paint-system'].selectColor('#' + this.el.sceneEl.systems['paint-system'].color3.getHexString())
            this.lastRotation = rot
        }
    }
})

AFRAME.registerComponent('compositor-holder', {
    events: {

    },
    init() {
        Util.whenLoaded([this.el, Compositor.el], () => {
            Compositor.el.setAttribute('physx-no-collision', '')
            Compositor.el['redirect-grab'] = this.el
            this.el.object3D.add(Compositor.el.object3D)
            Compositor.el.setAttribute('manipulator-lock', "lockedPositionAxes: x, y, z; lockedRotationAxes: x, y, z; lockedScaleAxes: x, y, z")
        })
    }
})

AFRAME.registerComponent('main-menu-binder', {
    schema: {
        // openAngle: {default: 45},
        // closeAngle: {default: 25},
    },
    events: {
        opened: function(e) {
            document.querySelector('#ui').setAttribute('visible', true)
        },
        closed: function(e) {
            document.querySelector('#ui').setAttribute('visible', false)
        }
    },
    init() {
        this.tick = AFRAME.utils.throttleTick(this.tick, 400, this)
        this.isOpen = false
        this.binderBase = document.getElementById('ring_binder')
        this.topDirection = new THREE.Vector3()
        this.bottomDirection = new THREE.Vector3()
    },
    tick(t, dt) {
        // let angle = this.el.object3D.quaternion.angleTo(this.binderBase.object3D.quaternion)

        this.el.object3D.getWorldDirection(this.topDirection)
        this.binderBase.object3D.getWorldDirection(this.bottomDirection)
        let angle = this.bottomDirection.angleTo(this.topDirection)

        console.log("Angle", angle)

        // let openRadians = this.data.openAngle * Math.PI / 180.0;
        // let closeRadians = this.data.closeAngle * Math.PI / 180.0;
        // if (angle > openRadians && !this.isOpen)
        // {
        //     this.el.emit('opened', {})
        //     this.isOpen = true
        // }
        // else if (angle < closeRadians && this.isOpen)
        // {
        //     this.el.emit('closed', {})
        //     this.isOpen = false
        // }

        if (angle > 0.3 && !this.isOpen)
        {
            this.isOpen = true
            this.el.emit('opened', {})
        }
        else if (angle < 0.2 && this.isOpen)
        {
            this.isOpen = false
            this.el.emit('closed', {})
        }
    }
})