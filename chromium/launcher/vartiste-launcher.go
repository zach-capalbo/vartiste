
package main

import (
	"fmt"
	"os"
	// "os/exec"
	// "io/ioutil"
	// "path/filepath"

	// "github.com/magefile/mage/mg" // mg contains helpful utility functions, like Deps
	// "github.com/magefile/mage/sh"

  "github.com/gen2brain/dlgs"
  // "fyne.io/fyne/app"
  // "fyne.io/fyne/widget"
)

type Config struct {
	name string
	cmd string
}


var Configs = []Config {
	Config{"Oculus (Latest VARTISTE)", fmt.Sprintf("--disable-features=XRSandbox --enable-features=oculus --force-webxr-runtime=oculus --autoplay-policy=no-user-gesture-required --user-data-dir=%s\\vartiste --app=https://vartiste.xyz", os.Getenv("APPDATA"))},
	Config{"SteamVR", fmt.Sprintf("--disable-features=XRSandbox --enable-features=OpenVR --force-webxr-runtime=OpenVR --autoplay-policy=no-user-gesture-required --user-data-dir=%s\\vartiste --app=https://vartiste.xyz", os.Getenv("APPDATA"))},
}


func main() {
  items := []string{}
  for _, c := range Configs {
    items = append(items, c.name)
  }
  item, _, err := dlgs.List("List", "Select item from list:", items)
  if err != nil {
      panic(err)
  }

  for _, c := range Configs {
    if c.name == item {
      fmt.Println(c.cmd)
    }
  }
  // a := app.New()
  // win := a.NewWindow("Launch VARTISTE")
  // win.SetContent(widget.NewVBox(
  //     widget.NewLabel("Hello World!"),
  //     widget.NewButton("Quit", func() {
  //         a.Quit()
  //     }),
  // ))
  // win.ShowAndRun()
}
