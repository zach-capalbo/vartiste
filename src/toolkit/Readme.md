# VARTISTE Toolkit

The VARTISTE toolkit is a collection of components developed while creating
[VARTISTE](https://vartiste.xyz). I've compiled them into a stand-alone module
in the hopes that it might be useable to folks to jump start their own projects.

# Installation / Use

The easiest way to use it is to include the `.js` file from a CDN, such as
unpkg:

```html
<html>
<head>
  <script src="https://unpkg.com/aframe-vartiste-toolkit@latest/vartiste-toolkit.js"></script>
</head>
...
</html>
```

Including the javascript file automatically registers the components and
systems.

**Note:** It is recommended to specify a version instead of using _latest_, in order to avoid unexpected changes. E.g:

```html
<html>
<head>
  <script src="https://unpkg.com/aframe-vartiste-toolkit@1.27.1/vartiste-toolkit.js"></script>
</head>
...
</html>
```

## New Project vs. Existing Project

If you're creating a new project, the aframe-vartiste-toolkit has a lot of
features and functionality, and I recommend pulling in the whole thing. This is
the default behavior when including the toolkit script. The components and
systems can work together to provide more functionality when everything is
available.

If you're bringing aframe-vartiste-toolkit into an existing project, you can
either [bring in specific pieces of the toolkit](#customization), or you can
bring in the whole thing. If possible, I recommend pulling in the whole toolkit,
since some components may depend on other components or systems, but if there's
concern for naming or functionality conflicts, most components can also operate
on their own.

# Toolkit Overview

The *aframe-vartiste-toolkit* has a lot of stuff in it. It's built by exporting
every little bit and piece of the [VARTISTE](https://vartiste.xyz) app, and so
[VARTISTE](https://vartiste.xyz) and the [VARTISTE source
code](https://gitlab.com/zach-geek/vartiste) are ultimately the best places to
see what's available and how it works. Nonetheless, I've written some
documentation as a best-spare-time-effort. Here's some of the key things to get you started.

## Philosophy and Terms

VARTISTE leans pretty heavily into the entity-component-system framework that
a-frame makes available; most things are components, which use systems when
needed, and can be attached to entities pretty readily. Plenty of components
also spawn their own children entities.

There are a few notable exceptions in the form of utility classes, such as [`VARTISTE.Util`](#util.js) and [`VARTISTE.Undo`](#undo.js). These utility classes are exposed under the `VARTISTE` global variable.

Most components (but not all) respond correctly to updates via
`setAttribute`; fewer things respond entirely correctly to `remove()` so if you
run into issues, double check the docs here or the source.

One extension to the ECS framework in VARTISTE is "component systems", created
via [`VARTISTE.Util.registerComponentSystem`](#util.js). These are basically
components for the `a-scene` which get automatically attached (like systems do).
They have the full schema and update abilities of components, with the
auto-attach convenience of systems. They are accessible via `sceneEl.systems` *and* `sceneEl.components`.

## UI Components

VARTISTE has a quick-and-dirty user interface, focused around the [`icon-button`](#icon-button), a button with an icon on it. These are usually collected into an [`icon-row`](#icon-row), where they're automatically layed-out horizontally. Most clickable things have a [`tooltip`](#tooltip), which also has the advantage of being able to be ready by the built-in [text-to-speech](#speech.js) system.

In addition to [`icon-button`s](#icon-button), there are [`edit-field`s](#edit-field) and [`lever`s](#lever) for providing input.

All of these components are usually arranged on a [`shelf`](#shelf) which provides a background and frame, and allows for easy closing or pinning to the a controller.

## User Rig

VARTISTE is based on a laser-pointer type interface. I've created a user rig
layout based on the laser-pointer concept, and you can incorporate it all with
just the [`vartiste-user-root`](#vartiste-user-root) component. Some of the things it includes:

- Automatic "Press any key to reset orientation" when entering VR.
- Cool "VR Goggles" that show up in the spectator camera (but not during normal
  display)
- Ultra leap hand tracking
- [`hand-action-tooltip`](#hand-action-tooltip) context sensitive button help
  tied to the controllers
- WebXR controller-only mode. I.e., you can use you controllers without your
  headset, but just displaying on the desktop. Uses the [`xr-controllers`](#xr-controllers.js) system
- Controller motion smoothing by default. Really improves experiences for jumpy controllers (*cough*ReverbG2*cough*)

Note this user rig uses the
[`webxr-motion-controller`](#webxr-motion-controller) and
[`webxr-laser`](#webxr-laser) components rather than the a-frame built-in
`laser-controls`. I found the [webxr-input-profiles
motion-controllers](https://github.com/immersive-web/webxr-input-profiles) to be
more consistent and up-to-date than the components built into a-frame, so I
built the [`webxr-input-profiles`](#webxr-input-profiles) systen to use that
instead.

## Interaction Components

User interaction is built around laser-control-type raycasting. Interactive
elements have the `clickable` HTML class set, which makes them visible to the
raycasters. `click` events are emitted when these elements are clicked.

Every `clickable` entity, by default, can also be grabbed and moved. Grabbing
and moving is handled via the [`manipulator`](#manipulator) component, which is installed on the user motion controllers or mouse controls. A lot more info can be found at the documentation for [`manipulator`](#manipulator)

There's also a bunch of built-in constraints, which can be set on entities to
restrict how they move when grabbed. For instance
[`manipulator-weight`](#manipulator-weight) makes entities feel "heavy" by
slowing down their movement when grabbed.

## Drawing Components

[VARTISTE](https://vartiste.xyz) of course is a drawing and image editing
application. I've brought many of the drawing components into the toolkit to
allow easily adding drawing to other A-Frame applications.

The easiest way to get started adding drawing to your app is to add the
[`drawable`](#drawable) component to whatever you want to be able to draw on,
and the [`hand-draw-tool`](#hand-draw-tool) component to whichever raycasters
you want to be able to draw. These are already set up if you use the
[`vartiste-user-root`](#vartiste-user-root) component. Additionally, you can
create [`pencil-tool`](#pencil-tool) components to create grabbable pencils that
can be easier to use in VR.

You can create your own brushes with the [`set-brush`](#set-brush) component.
Scene-wide drawing parameters are managed by the
[`paint-system`](#paint-system).

## Other cool stuff

There's lots of other nifty components and systems, for instance
[`canvas-fx`](#canvas-fx), which lets you quickly apply special effects to a
canvas, or [`glb-exporter`](#glb-exporter) which will let you download any
arbitrary entity or `THREE.Object3D` as a glb file in a single function call. There's even a PhysX-based [physics system](#physics.js)!

Ultimately, the best way to find out everything that's available is to read
through these documents, play around with the examples and VARTISTE itself, and
failing that to read the source code.

Also, VARTISTE uses a bunch of premade environments, these are packaged separately in the [aframe-enviropacks](https://www.npmjs.com/package/aframe-enviropacks) package.

## Assets

Assets required for some of the basic component use are automatically included
by the javascript source file.

If you want to include *all* VARTISTE assets in your project, you just need an
`a-asset` with a `vartiste-assets` property, like this:

```html
<a-scene>
  <a-assets>
    <!-- Your assets ... -->
    <a-asset vartiste-assets=""></a-asset>
  </a-assets>
  <!-- Rest of your scene, etc -->
</a-scene>
```

## Customization

You can optionally customize which components and systems are registered by the
aframe-vartiste-toolkit by setting the `VARTISTE_TOOLKIT` variable *before* the vartiste-toolkit.js file is loaded. `VARTISTE_TOOLKIT` should either be `undefined` (default) or be an object having any of the following properties:

- `excludeComponents`: Array of strings specifying which components, systems, or
  systemComponents specifically to exclude from being registered
- `includeComponents`: Array of strings specifying which components, systems, or
  systemComponents to be registered. All other components, systems, and
  systemComponents will be excluded.
- `excludeFiles`: Array of strings specifying all aframe-vartiste-toolkit source
  code files (from [the component reference](https://vartiste.xyz/docs.html)) to
  exclude entirely from registration. All components, systems, and
  systemComponents in those files will *not* be registered. Any classes in those
  files will not be defined.
- `includeFiles`: Array of strings specifying which aframe-vartiste-toolkit
  source code files (from [the component
  reference](https://vartiste.xyz/docs.html)) to include in registration. All
  components, systems, and systemComponents, and classes in other files will be
  excluded.
- `assetUrl`: VARTISTE Toolkit assets will be fetched from
  `assetUrl/assets/####.###`. Use this option if you want to use webpack and
  have a custom public-facing URL

## Component Reference

The full API and component reference can be found at
[https://vartiste.xyz/docs.html](https://vartiste.xyz/docs.html). Please note
that it is still under construction. The source code is available as well at
[https://gitlab.com/zach-geek/vartiste](https://gitlab.com/zach-geek/vartiste),
and contributions, both code-wise and documentation-wise are welcome.

# Examples

## Example Scene

```html
<!DOCTYPE html>
<html>

<head>
  <title>VARTISTE Toolkit Demo</title>
  <script src="https://aframe.io/releases/1.1.0/aframe.js"></script>
  <!-- <script src="https://aframe.io/releases/1.0.4/aframe.js"></script> -->
  <!-- You can specify components / systems, or files to exclude from being registered -->
  <script>VARTISTE_TOOLKIT = {
      /*excludeComponents: ["frame"], */ // Will exclude "frame" component
      /*includeComponents: ["shelf", "hdri-environment"], */ // Will include *ONLY* the shelf component and hdri-environment system
      /*excludeFiles: ['icon-button'], */ // Will exclude all components found in  aframe-vartiste-toolkit source file 'icon-button.js'
      /*includeFiles: ['icon-button'], */ // Will include *only* the components found in  aframe-vartiste-toolkit source file 'icon-button.js'
      /*assetUrl: 'https://example.com:8080/', */ // Will load vartiste assets from https://example.com:8080/ rather than the script's location
    }</script>
  <!--Just include the toolkit js file-->
  <script src="https://unpkg.com/aframe-vartiste-toolkit@latest/vartiste-toolkit.js"></script>
  <link rel="icon" href="/assets/favicon.png">
</head>

<body>
  <a-scene icon-button="shader: matcap" renderer="colorManagement: true; physicallyCorrectLights: true" xr-controllers-only="addUseControllerButton: true" spectator-camera="camera: #spectator-camera; state: SPECTATOR_CAMERA">
    <a-assets timeout="600000">
      <canvas height="768" id="draw-canvas-asset" width="1024"></canvas>

      <!-- You can easily load your own HDRI if you want! -->
      <a-asset id="hdr" src="asset/studio.hdr"></a-asset>

      <!--You can use all the default VARTISTE assets with the vartiste-asset
      component. Otherwise, only the ones needed for other components are
      included-->
      <a-asset vartiste-assets=""></a-asset>

      <!-- You can override some built-in components by defining mixins -->
      <a-mixin id="lever-grip" material="color: #a2c4fa"></a-mixin>
      <a-mixin id="shelf-bg" materia="shader: standard"></a-mixin>
    </a-assets>

    <!-- HDRIs are an easy way to get nice lighting and backgrounds really quickly -->
    <a-sky color="#333" hdri-environment="src: #hdr"></a-sky>

    <a-entity light="type: hemisphere; color: #eee; groundColor: #333; intensity: 0.6"></a-entity>
    <a-entity light="type: ambient; color: #fff; intensity: 0.6"></a-entity>

    <!-- vartiste-user-root sets up the default laser pointer / mouse & keyboard
    interactions. If you want to define your own user setup, you'll want to make
    sure to include the manipulator components on both of the hand components to
    ensure that things can be grabbed and resized. -->
    <a-entity vartiste-user-root=""></a-entity>

    <a-entity position="0 0 -2.5">

      <!--A shelf provides a definitive place to put things. "grab-root" ensures
      that grab-and-move events propogate to the whole shelf-->
      <a-entity class="grab-root" shelf="">
        <!--icon-buttons position themselves in a row automatically. So we just
        position this outer entity where we want the row to start-->
        <a-entity position="-1.5 1.1 0" icon-row="">
          <!--Simply pass an asset to icon-button, and boom, you've got an icon
          button that responds to a wide range of clicks-->
          <a-entity icon-button="#asset-eye" onclick="alert('click')" tooltip="Run Javascript onclick handler"></a-entity>
          <!--You can make it a toggle button by adding the toggle-button
          component-->
          <a-entity icon-button="#asset-oven" toggle-button="" tooltip="Toggle Me"></a-entity>
          <!--You can style it, too-->
          <a-entity button-style="color: #ed8607; clickColor: #8607ed; intersectedColor: #07ed86" icon-button="" tooltip="Look at the colors! Woah!" onclick="this.sceneEl.systems['canvas-fx'].applyFX('invert', document.getElementById('draw-canvas-asset'))"></a-entity>
          <!--Add the system-click-action to easily call methods of systems-->
          <a-entity icon-button="#asset-account-voice" system-click-action="system: toolkit-demo; action: speak" tooltip="Speak entered text if enabled"></a-entity>
          <!--Or add component properties directly for the toggle buttons to
          toggle-->
          <a-entity icon-button="#asset-check-outline" toggle-button="target: a-scene; component: speech; property: speak" tooltip="Toggle Speaking Enabled"></a-entity>

          <!-- Easily export entities or even the entire scene to a GLB file -->
          <a-entity icon-button="#asset-floppy" tooltip="Download this scene as GLB" system-click-action="system: glb-exporter; action: downloadGLB"></a-entity>

          <!-- Use the VARTISTE undo system to easily undo changes, too -->
          <a-entity icon-button="#asset-undo" tooltip="Undo" onclick="VARTISTE.Undo.undo()"></a-entity>

          <a-entity icon-button="#asset-help-circle-outline" system-click-action="system: toolkit-demo; action: help" tooltip="VARTISTE Toolkit Documentation"></a-entity>
        </a-entity>
        <a-entity position="0 0.5 0" text="width: 3.4; wrapCount: 35; value: Welcome to the VARTISTE toolkit demo"></a-entity>
        <a-entity>

          <!--You can use edit fields which pop up a keyboard-->
          <a-entity edit-field="type: string; tooltip: Edit a string!" id="demo-input" text="width: 2; wrapCount: 20; value: default text"></a-entity>
        </a-entity>
        <a-entity position="0 -0.6 0">

          <!--You can also have a numerical edit field-->
          <a-entity edit-field="type: number; tooltip: Edit a number" text="width: 2; wrapCount: 4"></a-entity>
        </a-entity>

        <!-- You can make interactables, like this lever -->
        <a-entity lever="valueRange: 2 0; target: a-sky; component: hdri-environment; property: exposure; initialValue: 0.724" position="-1.621 -0.917 0" scale="2 2 2" tooltip="Adjust Lighting"></a-entity>
      </a-entity>
    </a-entity>

    <!--You can put a frame around anything with a geometry. The frame can optionally be closeable, or pinnable to your hand-->
    <a-image frame="" position="0 2 -1" src="#asset-vartiste" tooltip="Here's a floating frame!" tooltip-style="offset: 0 0.5 0"></a-image>

    <!--Adding the clickable class to anything makes it grabbable-->
    <a-entity class="clickable" position="-3.0 0 -2.5" text="width: 2.4; wrapCount: 25; value: Desktop Controls:\n-Left Click: Click buttons\n-Right Mouse Buton Drag: Look around\n-Shift+Left Mouse Button Drag: Move things\n-WASD: Move around"></a-entity>

    <!--You can use some of the VARTISTE drawing tools, too!-->
    <a-entity id="draw-canvas-demo" class="clickable"
              drawable="canvas:#draw-canvas-asset" frame=""
              geometry="primitive: plane; width: 2; height: 1.75"
              material="shader: flat; src: #draw-canvas-asset; npot: true"
              position="3.1 0 -2.4" tooltip="Draw Here" tooltip-style="offset: 0 0.75 0"></a-entity>
    <a-entity class="clickable" color-picker="" geometry="primitive: circle; radius: 1; height: 1.75" position="3.1 2 -2.4"></a-entity>
    <a-entity position="4.5 2 -2.4" icon-button="#asset-brush" tooltip="Change brush" set-brush="brushType: ImageBrush; image: #asset-brush; color: blue; scale: 5; activationEvent: click"></a-entity>
    <a-entity position="3.1 0 -1.4" rotation="90 0 0" scale="2 2 2" pencil-tool="" tooltip="Grabbable Pencil" set-brush="brushType: ImageBrush; image: #asset-lead-pencil; color: green; scale: 5"></a-entity>

    <!-- There's a few handy default constraints to restrict how things can be grabbed -->
    <a-sphere class="clickable"
              constrain-to-sphere=""
              manipulator-weight="type: slow; weight: 0.9"
              grab-options="undoable: true"
              material="shader: standard; roughness: 0.3; metalness: 0.7" position="0 0.4 -0.4" radius="0.1"></a-sphere>

    <a-entity id="spectator-camera" camera="" position="2 1 1" rotation="0 80 0" camera-layers="layers: spectator"></a-entity>

    <!-- The toolkit also includes a PhysX-backed physics engine, with lots of nifty utilities. See https://glitch.com/edit/#!/fascinated-hip-period?path=index.html for a full demo! -->
    <a-box material="shader: standard; color: white" width="0.3" height="0.3" depth="0.3"
           position="-2.276 0.3 0.165"
           physx-body="type: static"></a-box>
    <a-entity icon-button="#asset-nudge-brush" tooltip="Start Physics" system-click-action="system: physx; action: startPhysX" position="-2.105 0.3 0.13" rotation="0 90 0" scale="0.6 0.6 0.6"></a-entity>
    <a-entity gltf-model="#asset-hand"
              preactivate-tooltip="Press Start Physics below!"
              position="-2.276 1 0.165"
              class="clickable"
              physx-body="type: dynamic"></a-entity>
  </a-scene>
</body>
</html>
```

[View the demo on CodePen](https://codepen.io/zach-capalbo/pen/oNbKagV)

<p class="codepen" data-height="330" data-theme-id="light" data-default-tab="html,result" data-user="zach-capalbo" data-slug-hash="oNbKagV" data-preview="true" style="height: 330px; box-sizing: border-box; display: flex; align-items: center; justify-content: center; border: 2px solid; margin: 1em 0; padding: 1em;" data-pen-title="aframe-vartiste-toolkit-demo">
  <span>See the Pen <a href="https://codepen.io/zach-capalbo/pen/oNbKagV">
  aframe-vartiste-toolkit-demo</a> by Zachary Capalbo (<a href="https://codepen.io/zach-capalbo">@zach-capalbo</a>)
  on <a href="https://codepen.io">CodePen</a>.</span>
</p>
<script async src="https://static.codepen.io/assets/embed/ei.js"></script>

## Physics playground

The [aframe-vartiste-toolkit physics playground](https://glitch.com/edit/#!/fascinated-hip-period?path=index.html%3A1%3A0) is a good example of using the toolkit for things other than painting and drawing, and the best example of the [physics](#physics.js) components so far.

# Source Code

For information, you can also read through the source code:

[https://gitlab.com/zach-geek/vartiste/-/blob/release/src/vartiste-toolkit.js](https://gitlab.com/zach-geek/vartiste/-/blob/release/src/vartiste-toolkit.js)
