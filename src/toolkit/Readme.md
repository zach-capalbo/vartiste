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

# Component Reference

The full API and component reference can be found at
[https://vartiste.xyz/docs.html](https://vartiste.xyz/docs.html). Please note
that it is still under construction. The source code is available as well at
[https://gitlab.com/zach-geek/vartiste](https://gitlab.com/zach-geek/vartiste),
and contributions, both code-wise and documentation-wise are welcome.

# Example Scene

```html
<!DOCTYPE html>
<html>
   <head>
      <title>VARTISTE Toolkit Demo</title>
      <script src="https://aframe.io/releases/1.0.4/aframe.js"></script>
      <!--Just include the toolkit js file-->
      <script src="https://unpkg.com/aframe-vartiste-toolkit@latest/vartiste-toolkit.js"></script>
   </head>
   <body>
      <a-scene icon-button="shader: matcap">
         <a-assets>
            <!--You can use all the default VARTISTE assets with the vartiste-asset meta-asset--><!--Otherwise, only the ones needed for other components are included-->
            <a-asset vartiste-assets=""></a-asset>
         </a-assets>
         <a-sky color="#333"></a-sky>
         <a-entity light="type: hemisphere; color: #eee; groundColor: #333; intensity: 0.6"></a-entity>
         <a-entity light="type: ambient; color: #fff; intensity: 0.6"></a-entity>
         <!--vartiste-user-root sets up the default laser pointer / mouse & keyboard--><!--interactions. If you want to define your own user setup, you'll want to--><!--make sure to include the manipulator components on both of the hand--><!--components to ensure that things can be grabbed and resized.-->
         <a-entity vartiste-user-root=""></a-entity>
         <a-entity position="0 0 -2.5">
            <!--A shelf provides a definitive place to put things. "grab-root" ensures that grab-and-move events propogate to the whole shelf-->
            <a-entity class="grab-root" shelf="">
               <!--icon-buttons position themselves in a row automatically. So we just position this outer entity where we want the row to start-->
               <a-entity position="-1.5 1.1 0">
                  <!--Simply pass an asset to icon-button, and boom, you've got an icon button that responds to a wide range of clicks-->
                  <a-entity icon-button="#asset-eye" onclick="alert(&#39;click&#39;)" tooltip="Run Javascript onclick handler"></a-entity>
                  <!--You can make it a toggle button by adding the toggle-button component-->
                  <a-entity icon-button="#asset-oven" toggle-button="" tooltip="Toggle Me"></a-entity>
                  <!--You can style it, too-->
                  <a-entity button-style="color: #ed8607; clickColor: #8607ed; intersectedColor: #07ed86" icon-button="" tooltip="Look at the colors! Woah!"></a-entity>
                  <!--Add the system-click-action to easily call methods of systems-->
                  <a-entity icon-button="#asset-account-voice" system-click-action="system: toolkit-demo; action: speak" tooltip="Speak entered text if enabled"></a-entity>
                  <!--Or add component properties directly for the toggle buttons to toggle-->
                  <a-entity icon-button="#asset-check-outline" toggle-button="target: a-scene; component: speech; property: speak" tooltip="Toggle Speaking Enabled"></a-entity>
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
            </a-entity>
         </a-entity>
         <!--You can put a frame around anything with a geometry. The frame can optionally be closeable, or pinnable to your hand-->
         <a-image frame="" position="0 2 -1" src="#asset-vartiste" tooltip="Here&#39;s a floating frame!" tooltip-style="offset: 0 0.5 0"></a-image>
         <!--Adding clickable to anything makes it grabbable-->
         <a-entity class="clickable" position="-3.0 0 -2.5" text="width: 2.4; wrapCount: 25; value: Desktop Controls:\n-Left Click: Click buttons\n-Right Mouse Buton Drag: Look around\n-Shift+Left Mouse Button Drag: Move things\n-WASD: Move around"></a-entity>
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


For information, you can also read through the source code:

[https://gitlab.com/zach-geek/vartiste/-/blob/release/src/vartiste-toolkit.js](https://gitlab.com/zach-geek/vartiste/-/blob/release/src/vartiste-toolkit.js)
