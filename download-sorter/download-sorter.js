const Conf = require('conf');
const path = require('path');
const mkdirp = require('mkdirp').sync;
const ls = require('ls');
const mv = require('move-file').sync;

async function delay(t) { return new Promise(r => setTimeout(r, t)); }

class NameError extends Error { constructor(...args) { super(...args); } }

class Project {
  constructor(vars) {
    Object.assign(this, vars)
    this.regex = new RegExp(`^${this.name}-\\d{4}-\\d{2}-\\d{2}T\\d{2}`)
  }
  shouldOwn(file) {
    return this.regex.test(path.basename(file))
  }
  take(file) {
    mv(file, path.resolve(path.join(this.path, path.basename(file))))
  }

  static fromDirectory(directory) {
    return new Project({
      name: directory.name,
      path: directory.full
    })
  }

  static fromCandidate(file, {destination}) {
    let match = path.basename(file).match(/^(.*)-\d{4}-\d{2}-\d{2}T\d{2}/)

    if (!match) throw new NameError(`Could not match project name for ${file}`)

    let name = match[1]

    if (!name) throw new NameError(`Could not match project name for ${file}`)

    let directory = path.resolve(`${destination}/${name}`)

    mkdirp(directory)

    return new Project({
      name,
      path: directory
    })
  }
}

class DownloadSorter {
  constructor() {
    this.conf = new Conf({defaults: {
        destination: path.resolve(`${process.env.HOME}/Documents/vartiste`),
        source: path.resolve(`E:/Downloads`)
    }})
  }
  get destination() {
    return path.resolve(this.conf.get("destination"))
  }
  get source() {
    return path.resolve(this.conf.get("source"))
  }
  setupDestination() {
    mkdirp(this.destination)
  }
  takeStock() {
    let {destination, source} = this
    this.projects = ls(`${destination}/*`).map(d => Project.fromDirectory(d))
  }
  createCandidateProjects() {
    let candidates = ls(`${this.source}/*.vartiste`).concat(ls(`${this.source}/*.vartistez`))
    for (let candidate of candidates)
    {
      if (!this.projects.some(p => p.shouldOwn(candidate.full)))
      {
        try {
          this.projects.push(Project.fromCandidate(candidate.full, this))
        }
        catch (e)
        {
          if (!(e instanceof NameError)) throw e
        }
      }
    }
  }
  async waitFor(msg) {
    if (this.stdin)
    {
      return await this.waitKey(`${msg}`)
    }
    console.info(msg)
    await delay(1000)
  }
  waitKey(msg) {
    console.info(msg + " (m)ove/(s)kip")
    return new Promise((r, e) => {
      this.resolve = r;
      this.err = e;
    })
  }
  async sortSourceFiles({wait = false} = {}) {
    let {destination, source} = this

    const CANDIDATE_FORMATS = [
      "vartiste",
      "vartistez",
      "png",
      "jpg",
      "webm",
      "glb",
      "gif",
      "mp4"
    ]

    let filesToCheck = ls(`${this.source}/*.{${CANDIDATE_FORMATS.join(",")}}`)

    for (let project of this.projects)
    {
      let hasFile = false
      console.info(`Project: ${project.name} (${project.path})`)
      for (let file of filesToCheck)
      {
        if (project.shouldOwn(file.full))
        {
          hasFile = true
          console.info(` - ${file.full}`)
        }
      }

      if (!hasFile) continue;

      if (wait) {
        try {
          await this.waitFor(project.name)
        } catch (e) {
          continue
        }
      };
      for (let file of filesToCheck)
      {
        if (project.shouldOwn(file.full))
        {
          console.log("Taking", file.full)
          project.take(file.full)
        }
      }
    }
  }
  sort() {
    this.setupDestination()
    this.takeStock()
    this.createCandidateProjects()
    this.sortSourceFiles()
  }
  async sortWait() {
    this.setupDestination()
    this.takeStock()
    this.createCandidateProjects()
    for (let project of this.projects)
    {
      console.log(`- ${project.name}: ${project.path}`)
    }
    await delay(5000)
    this.sortSourceFiles({wait: true})
  }
  async sortInteractive() {
    var stdin = process.stdin;

    // without this, we would only get streams once enter is pressed
    //stdin.setRawMode( true );

    // resume stdin in the parent process (node app won't quit all by itself
    // unless an error or process.exit() happens)
    stdin.resume();
    // i don't want binary, do you?
    stdin.setEncoding( 'utf8' );

    // on any data into stdin
    stdin.on( 'data', ( key ) =>
    {
      // ctrl-c ( end of text )
      if ( key === '\u0003' ) {
        process.exit();
      }

      if (!this.resolve)
      {
        return
      }

      // without rawmode, it returns EOL with the string
      if (key.indexOf('m')==0)
      {
        this.resolve()
      }

      if (key.indexOf('s')==0)
      {
        this.err()
      }

      // write the key to stdout all normal like
      // process.stdout.write( key );
    });

    this.stdin = stdin

    this.setupDestination()
    this.takeStock()
    this.createCandidateProjects()
    // for (let project of this.projects)
    // {
    //   console.log(`- ${project.name}: ${project.path}`)
    // }
    // await delay(5000)
    await this.sortSourceFiles({wait: true})
    process.exit();
  }
}

module.exports = {DownloadSorter, Project}

new DownloadSorter().sortInteractive()
