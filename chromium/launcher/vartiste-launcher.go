
package main

import (
	// "fmt"
	"os"
	"os/exec"
	// "io/ioutil"
	// "path/filepath"
	// "fmt"
	"log"
	"net/http"
	// "net"

	// "github.com/magefile/mage/mg" // mg contains helpful utility functions, like Deps
	// "github.com/magefile/mage/sh"

  // "github.com/gen2brain/dlgs"
  // "fyne.io/fyne/app"
  // "fyne.io/fyne/widget"
)

// func findPort()(string) {
// 	addr, err := net.ResolveTCPAddr("tcp", "localhost:0")
// 	if err != nil {
// 		log.Fatal(err)
// 	}
//
// 	l, err := net.ListenTCP("tcp", addr)
// 	if err != nil {
// 		log.Fatal(err)
// 	}
// 	defer l.Close()
// 	return fmt.Sprintf("%d", l.Addr().(*net.TCPAddr).Port)
// }

func main() {
		http.Handle("/", http.FileServer(http.Dir("./vartiste-dist")))

		// The problem with findPort is that anything saved to the browser is lost
		// on reload, since it's a different origin then
		port := "7806" //findPort()

		go func() {
    	log.Fatal(http.ListenAndServe("127.0.0.1:" + port, nil))
		}()

		log.Printf("Serving port: %s", port)

		cmd := exec.Command("./chromium-vartiste/chrome", "--app=http://localhost:" + port + "/launcher.html", "--user-data-dir=" + os.Getenv("APPDATA")  + "\\vartiste", "--disable-features=XRSandbox", "--force-webxr-runtime=OpenXR", "--autoplay-policy=no-user-gesture-required")

		err := cmd.Run()
		log.Printf("Command finished with error: %v", err)
}
