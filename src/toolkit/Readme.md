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

# Components Reference

Component Reference Documentation is under construction. For now, start by
checking out the demo:



For information, you can also read through the source code:

[https://gitlab.com/zach-geek/vartiste/-/blob/release/src/vartiste-toolkit.js](https://gitlab.com/zach-geek/vartiste/-/blob/release/src/vartiste-toolkit.js)
