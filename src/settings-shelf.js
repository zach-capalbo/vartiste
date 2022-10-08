const settingsShelfHTML = require('./partials/settings-shelf.html.slm')
const {Util} = require('./util.js')

AFRAME.registerComponent('settings-shelf', {
  init() {
    this.system = this.el.sceneEl.systems['settings-system']
    this.el.innerHTML = settingsShelfHTML

    this.el.addEventListener('click', (e) => {
      let action = e.target.getAttribute("click-action") + 'Action';
      if (action in this)
      {
        this[action](e)
      }
      else if (action in this.system)
      {
        this.system[action]()
      }
    })
    this.el.querySelector('.project-name').addEventListener('editfinished', e=>{
      this.system.setProjectName(e.detail.value)
    })
    this.el.querySelector('.project-name').addEventListener('loaded', e => {
      e.target.setAttribute('text', {value: this.el.sceneEl.systems['settings-system'].projectName})
    })
    this.el.sceneEl.addEventListener('projectnamechanged', e => {
      this.el.querySelector('.project-name').setAttribute('text', {value: this.el.sceneEl.systems['settings-system'].projectName})
    })
    Util.whenLoaded(this.el.querySelector('.project-name'), () => {
      console.log("Setting project name edit", this.el.sceneEl.systems['settings-system'].projectName)
      this.el.querySelector('.project-name').setAttribute('text', {value: this.el.sceneEl.systems['settings-system'].projectName})
    })

    // this.el.sceneEl.addEventListener('open-popup', e => {
    //   this.el.querySelector('.message').setAttribute('text', {value: `${e.detail}`})
    // })

    // this.el.sceneEl.addEventListener('stabilizationchanged', e => {
    //   this.el.querySelector('[click-action="noStabilization"]').components['toggle-button'].setToggle(e.detail.stabilization < 0.4)
    //   this.el.querySelector('[click-action="mediumStabilization"]').components['toggle-button'].setToggle(e.detail.stabilization >= 0.4 && e.detail.stabilization < 0.9)
    //   this.el.querySelector('[click-action="maxStabilization"]').components['toggle-button'].setToggle(e.detail.stabilization >= 0.9)
    // })

    this.el.sceneEl.addEventListener('qualitychanged', e => {
      this.el.querySelector('[click-action="lowQuality"]')?.components['toggle-button'].setToggle(e.detail.quality <= 0.25)
      this.el.querySelector('[click-action="mediumQuality"]')?.components['toggle-button'].setToggle(e.detail.quality > 0.25 && e.detail.quality <= 0.5)
      this.el.querySelector('[click-action="fullQuality"]')?.components['toggle-button'].setToggle(e.detail.quality > 0.5)
    })

    document.getElementById('canvas-view').addEventListener('resized', e => {
      this.el.querySelector('.width').setAttribute('text', {value: e.detail.width})
      this.el.querySelector('.height').setAttribute('text', {value: e.detail.height})
    })

    Util.whenLoaded([this.el, Compositor.el], () => {
      let w = this.el.querySelector('.width')
      Util.whenLoaded(w, () => w.setAttribute('text', 'value', Compositor.component.width))
      let h = this.el.querySelector('.height')
      Util.whenLoaded(h, () => h.setAttribute('text', 'value', Compositor.component.height))
    })

    // if (!this.el.sceneEl.systems.sketchfab.loggedIn())
    // {
    //   this.el.querySelector('.sketchfab-button').setAttribute('tooltip', "Log in to Sketchfab")
    // }
  },
  newCompositionAction(e) {
    let compositor = document.getElementById('canvas-view').components.compositor;

    if (e.target.hasAttribute('size'))
    {
      var {width, height} = AFRAME.utils.styleParser.parse(e.target.getAttribute('size'))
      width = parseInt(width)
      height = parseInt(height)
    }
    else
    {
      var width = parseInt(this.el.querySelector('.width').getAttribute('text').value)
      var height = parseInt(this.el.querySelector('.height').getAttribute('text').value)
    }

    if (!(Number.isInteger(width) && width > 0)) throw new Error(`Invalid composition width ${width}`)
    if (!(Number.isInteger(height) && height > 0)) throw new Error(`Invalid composition height ${height}`)

    console.log("Creating new composition", width, height, AFRAME.utils.styleParser.parse(e.target.getAttribute('size')), e.target.getAttribute('size'))
    width = parseInt(width)
    height = parseInt(height)

    compositor.layers.slice().forEach(layer => {
      compositor.deleteLayer(layer)
    })

    compositor.resize(width, height)

    let ctx = compositor.layers[0].canvas.getContext('2d')
    ctx.fillStyle = "#fff"
    ctx.fillRect(0,0,width,height)
    compositor.addLayer(1)
  },
  resampleAction(e, {resample = true, size, ...opts} = {}) {
    let compositor = document.getElementById('canvas-view').components.compositor;

    if (e.target.hasAttribute('size'))
    {
      var {width, height} = AFRAME.utils.styleParser.parse(e.target.getAttribute('size'))
      width = parseInt(width)
      height = parseInt(height)
    }
    else if (size)
    {
      var {width, height} = size
    }
    else
    {
      var width = parseInt(this.el.querySelector('.width').getAttribute('text').value)
      var height = parseInt(this.el.querySelector('.height').getAttribute('text').value)
    }

    if (!(Number.isInteger(width) && width > 0)) throw new Error(`Invalid composition width ${width}`)
    if (!(Number.isInteger(height) && height > 0)) throw new Error(`Invalid composition height ${height}`)

    compositor.resize(width, height, {resample, ...opts})
  },
  resizeCanvasAction(e) {
    this.resampleAction(e, {resample: false, resizeLayers: false})
  },
  resizeCanvasToCurrentLayerAction(e) {
    this.resampleAction(e, {resample: false, resizeLayers: false, size: Compositor.component.activeLayer})
  },
  toggleShadingAction() {
    let compositor = document.getElementById('canvas-view').components.compositor;

    if (compositor.el.getAttribute('material').shader === 'flat')
    {
      compositor.el.setAttribute('material', {shader: 'standard'})
    }
    else
    {
      compositor.el.setAttribute('material', {shader: 'flat'})
    }
  },
  startFreshAction(e) {
    console.log("Starting Fresh")
    this.newCompositionAction(e)
    this.el.sceneEl.systems['pencil-tool'].resetAllTools()
    this.el.sceneEl.systems['settings-system'].clearModels()
    this.el.sceneEl.systems['remember-position'].restoreAll()
    this.el.sceneEl.systems['artist-root'].resetCameraLocation()
  }
})

AFRAME.registerComponent('load-shelf', {
  schema: {
    projectPage: {default: 0},
    projectsPerPage: {default: 7}
  },
  events: {
    click: function(e) {
      if (!e.target.hasAttribute('click-action')) return
      let action = e.target.getAttribute('click-action')
      if (!(action in this)) return
      this[action](e)
    }
  },
  init() {
    this.el.parentEl.addEventListener('popupshown', e => this.repopulate())
    this.inputEl = document.createElement('input')
    this.inputEl.setAttribute('type', "file")
    this.inputEl.setAttribute('accept', ".vartiste, .vartistez, .glb, .png, .jpg, .zip, .vartiste-brushes")
    this.inputEl.style="display: none"
    this.inputEl.addEventListener('change', (e) => {this.upload(e)})
    document.body.append(this.inputEl)
  },
  update() {
    this.repopulate()
  },
  projectsNext() {
    this.el.setAttribute('load-shelf', 'projectPage', ++this.data.projectPage)
  },
  projectsPrevious() {
    this.el.setAttribute('load-shelf', 'projectPage', --this.data.projectPage)
  },
  async repopulate() {
    console.log("Repopulating projects")
    let projectsEl = this.el.querySelector('.projects')
    projectsEl.innerHTML = ""
    let settings = this.el.sceneEl.systems['settings-system']
    let db = settings.openProjectsDB()
    let projects = await db.projects.orderBy('modified').primaryKeys()

    if (location.host === "vartiste.xyz" && projects.length === 0)
    {
      this.el.querySelector('.old-domain').setAttribute('visible', true)
    }

    projects = projects.reverse()
    for (let i = 0; i < this.data.projectsPerPage; ++i)
    {
      let project = projects[this.data.projectPage * this.data.projectsPerPage + i]
      if (!project) continue
      let rowEl = document.createElement('a-entity')
      rowEl.innerHTML = require('./partials/load-project-row.html.slm')
      let nameEl = rowEl.querySelector('.name')
      Util.whenLoaded(nameEl, () => nameEl.setAttribute('text', {value: project}))
      rowEl.setAttribute('position', `-2 ${-i * 0.6 - 0.5} 0`)

      rowEl.addEventListener('click', e => {
        let action = e.target.getAttribute('project-action')
        if (!action) return
        this[action](project)
      })

      let previewEl = rowEl.querySelector('.preview')
      Util.whenLoaded(previewEl, async () => {
        let previewSrc = (await db.previews.get(project)).src
        previewEl.setAttribute('material', {src: previewSrc})
      })

      projectsEl.append(rowEl)
    }
  },
  open(project) {
    this.el.sceneEl.systems['settings-system'].loadFromBrowser(project)
    this.el.emit('popupaction', 'close')
  },
  async delete(project) {
    await this.el.sceneEl.systems['settings-system'].deleteFromBrowser(project)
    await this.repopulate()
  },
  browse() {
    this.inputEl.click()
  },
  upload(e) {
    for (let file of this.inputEl.files)
    {
      this.el.sceneEl.systems['file-upload'].handleFile(file)
    }
    this.el.emit('popupaction', 'close')
  },
  loadURLField() {
    let url = this.el.querySelector('#load-url-field').getAttribute('text').value
    console.log("Handling url:", url)
    this.el.sceneEl.systems['file-upload'].handleURL(url)
  },
  openOldDomain() {
    location.href = "https://zach-geek.gitlab.io/vartiste/?gitlabURL=true"
  }
})

AFRAME.registerComponent('lag-tooltip', {
  schema: {
    color: {type: 'color', default: '#eaa'},
    initialTime: {default: 10 * 1000},
    uiShownMessage: {default: 'Slowdown detected. Click button to toggle UI'},
    uiHiddenMessage: {default: 'Slowdown still detected. See documentation for performance tips.'},
  },
  init() {
    this.tick = AFRAME.utils.throttleTick(this.tick, 300, this)

    let container = document.createElement('a-entity')
    container.setAttribute('geometry', 'primitive: plane; height: 0.5; width: 0')
    container.setAttribute('material', {color: this.data.color, shader: 'flat'})
    container.setAttribute('position', '-1 0 0')
    container.setAttribute('text', `color: #000; width: 1; align: left; value: ${this.data.uiShownMessage}; wrapCount: 15`)
    container.setAttribute('visible', false)
    this.el.append(container)
    this.container = container
    this.uiroot = document.querySelector('#ui')
    this.uiroot.addEventListener('componentchanged', (e) => {
      if (e.detail.name === 'visible')
      {
        if (this.uiroot.getAttribute('visible'))
        {
          this.container.setAttribute('text', 'value', this.data.uiShownMessage)
        }
        else
        {
          Compositor.component.slowCount = 0
          this.shownT = -2000
          this.container.setAttribute('text', 'value', this.data.uiHiddenMessage)
        }
      }
    })
    // container.classList.add('clickable')
    this.shownT = 0
  },
  tick(t, dt) {
    if (t < this.data.initialTime) return
    if (this.container.object3D.visible)
    {
      if (Compositor.component.slowCount < 2)
      {
        if (t - this.shownT > 2000)
        {
          this.container.object3D.visible = false
          if (this.uiroot.getAttribute('visible'))
          {
            this.container.setAttribute('text', 'value', this.data.uiShownMessage)
          }
          else
          {
            this.container.setAttribute('text', 'value', this.data.uiHiddenMessage)
          }
          this.el.setAttribute('button-style', 'color', '#abe')
          this.el.components['icon-button'].setColor('#abe')
        }
      }
      else
      {
        this.shownT = t
      }
    }
    else
    {
      if (Compositor.component.slowCount > 4)
      {
        this.container.object3D.visible = true

        this.el.setAttribute('button-style', 'color', this.data.color)
        this.el.components['icon-button'].setColor(this.data.color)

        this.shownT = t
      }
    }
  }
})
