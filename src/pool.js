var poolSize = 0

function sysPool(name, type) {
    if (this.system._pool[name]) return this.system._pool[name]
    this.system._pool[name] = new type()
    // console.log("SysPooling", type.name)
    return this.system._pool[name]
}

function pool(name, type) {
    if (this._pool[name]) return this._pool[name]
    this._pool[name] = new type()
    // console.log("Pooling", type.name)
    return this._pool[name]
}

class Pool {
  static init(where, {useSystem = false} = {}) {
    if (useSystem)
    {
      if (!where.system) {
        console.error("No system for system pool", where.attrName)
      }
      if (!where.system._pool) where.system._pool = {};

      where.pool = sysPool;
    }
    else
    {
      where._pool = {}
      where.pool = pool;
    }
  }
}

export {Pool}
