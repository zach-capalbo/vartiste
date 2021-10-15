var poolSize = 0

class Pool {
  static init(where) {
    where._pool = {}
    if (where.system)
    {
      where.pool = function pool(name, type) {
          if (this.system._pool[name]) return this.system._pool[name]
          this.system._pool[name] = new type()
          // console.log("SysPooling", type)
          return this.system._pool[name]
      }
    }
    else
    {
      where.pool = function pool(name, type) {
          if (this._pool[name]) return this._pool[name]
          this._pool[name] = new type()
          // console.log("Pooling", type)
          return this._pool[name]
      }
    }
  }
}

export {Pool}
