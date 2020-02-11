class Pool {
  static init(where) {
    where._pool = {}
    where.pool = function pool(name, type) {
        if (this._pool[name]) return this._pool[name]
        this._pool[name] = new type()
        return this._pool[name]
    }
  }
}

export {Pool}
